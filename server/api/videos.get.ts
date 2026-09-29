interface ChannelContentDetailsResponse {
  items?: Array<{
    contentDetails: {
      relatedPlaylists: {
        uploads: string
      }
    }
  }>
}
 
interface PlaylistItemsResponse {
  items?: Array<{
    contentDetails: {
      videoId: string
    }
  }>
}
 
interface VideosListResponse {
  items?: Array<{
    id: string
    snippet: {
      title: string
      publishedAt: string
      thumbnails: {
        medium: { url: string }
      }
    }
    statistics: {
      viewCount?: string
      likeCount?: string
      commentCount?: string
    }
    contentDetails: {
      duration: string 
    }
  }>
}
 
interface VideoSummary {
  id: string
  title: string
  publishedAt: string
  thumbnail: string
  viewCount: number
  likeCount: number
  commentCount: number
  durationSeconds: number
  isShort: boolean 
}
 
function parseISO8601Duration(duration: string): number {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match) return 0
 
  const hours = Number(match[1] ?? 0)
  const minutes = Number(match[2] ?? 0)
  const seconds = Number(match[3] ?? 0)
 
  return hours * 3600 + minutes * 60 + seconds
}
 
const CACHE_TTL_SECONDS = 60 * 60 * 6 
 
export default defineEventHandler(async (event) => {
  const { channelId, maxResults } = getQuery(event)
 
  if (!channelId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Param "channelId" needed (UCxxxxxxxx)'
    })
  }
 
  const limit = Math.min(Number(maxResults) || 10, 50) 
 
  const clientIdentifier = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'
  const rateLimit = await checkRateLimit(clientIdentifier)
  if (!rateLimit.allowed) {
    throw createError({
      statusCode: 429,
      statusMessage: `Too many request. Retry after ${rateLimit.resetInSeconds}s.`
    })
  }
 
  const cacheKey = `yt:videos:${channelId}:${limit}`
  const redis = useRedis()
 
  const cached = await redis.get<VideoSummary[]>(cacheKey)
  if (cached) return cached
 
  const config = useRuntimeConfig()
  const apiKey = config.youtubeApiKey
 
  try {
    // 1. Trova la uploads playlist del canale
    let quota = await checkAndConsumeQuota(YOUTUBE_COSTS.channels)
    if (!quota.allowed) throw quotaExceededError()
 
    const channelRes = await $fetch<ChannelContentDetailsResponse>(
      'https://www.googleapis.com/youtube/v3/channels',
      { params: { part: 'contentDetails', id: String(channelId), key: apiKey } }
    )
 
    const uploadsPlaylistId = channelRes.items?.[0]?.contentDetails.relatedPlaylists.uploads
    if (!uploadsPlaylistId) {
      throw createError({ statusCode: 404, statusMessage: 'Channel not found.' })
    }
 
    // 2. Prendi gli ID degli ultimi video dalla uploads playlist
    quota = await checkAndConsumeQuota(YOUTUBE_COSTS.videos)
    if (!quota.allowed) throw quotaExceededError()
 
    let playlistRes: PlaylistItemsResponse
    try {
      playlistRes = await $fetch<PlaylistItemsResponse>(
        'https://www.googleapis.com/youtube/v3/playlistItems',
        { params: { part: 'contentDetails', playlistId: uploadsPlaylistId, maxResults: limit, key: apiKey } }
      )
    } catch {
      await redis.set(cacheKey, [], { ex: CACHE_TTL_SECONDS })
      return []
    }
 
    const videoIds = (playlistRes.items ?? []).map((item) => item.contentDetails.videoId)
    if (videoIds.length === 0) return []
 
    quota = await checkAndConsumeQuota(YOUTUBE_COSTS.videos)
    if (!quota.allowed) throw quotaExceededError()
 
    const videosRes = await $fetch<VideosListResponse>(
      'https://www.googleapis.com/youtube/v3/videos',
      { params: { part: 'statistics,snippet,contentDetails', id: videoIds.join(','), key: apiKey } }
    )
 
    const summaries: VideoSummary[] = (videosRes.items ?? []).map((video) => {
      const durationSeconds = parseISO8601Duration(video.contentDetails.duration)
 
      return {
        id: video.id,
        title: video.snippet.title,
        publishedAt: video.snippet.publishedAt,
        thumbnail: video.snippet.thumbnails.medium.url,
        viewCount: Number(video.statistics.viewCount ?? 0),
        likeCount: Number(video.statistics.likeCount ?? 0),
        commentCount: Number(video.statistics.commentCount ?? 0),
        durationSeconds,
        isShort: durationSeconds > 0 && durationSeconds <= 60
      }
    })
 
    await redis.set(cacheKey, summaries, { ex: CACHE_TTL_SECONDS })
 
    return summaries
  } catch (error: any) {
    if (error.statusCode) throw error
 
    throw createError({
      statusCode: 502,
      statusMessage: 'Error while calling Youtube API.',
      data: error.data ?? error.message
    })
  }
})
 
function quotaExceededError() {
  return createError({
    statusCode: 429,
    statusMessage: 'Daily Quote Youtube limit reached. Try again after Reset.'
  })
}