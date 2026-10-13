export interface NicheVideoItem {
  id: string
  title: string
  description: string
  channelId: string
  channelTitle: string
  publishedAt: string
  thumbnail: string
  viewCount: number
  likeCount: number
  commentCount: number
  durationSeconds: number
  isShort: boolean
  categoryId?: string
  viewsPerHour: number
}

interface YouTubeVideosListResponse {
  nextPageToken?: string
  items?: Array<{
    id: string
    snippet: {
      publishedAt: string
      channelId: string
      title: string
      description: string
      thumbnails: {
        default?: { url: string }
        medium?: { url: string }
        high?: { url: string }
        standard?: { url: string }
        maxres?: { url: string }
      }
      channelTitle: string
      tags?: string[]
      categoryId?: string
    }
    contentDetails: {
      duration: string
    }
    statistics: {
      viewCount?: string
      likeCount?: string
      commentCount?: string
    }
  }>
}

function parseISO8601Duration(duration: string): number {
  if (!duration) return 0
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match) return 0

  const hours = Number(match[1] ?? 0)
  const minutes = Number(match[2] ?? 0)
  const seconds = Number(match[3] ?? 0)

  return hours * 3600 + minutes * 60 + seconds
}

function calculateViewsPerHour(viewCount: number, publishedAt: string): number {
  const publishedTime = new Date(publishedAt).getTime()
  const now = Date.now()
  const hoursSincePublished = Math.max(0.5, (now - publishedTime) / (1000 * 60 * 60))
  return Math.round(viewCount / hoursSincePublished)
}

const CACHE_TTL_SECONDS = 24 * 60 * 60 // 24 hours (system managed once per day)

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const regionCode = String(query.regionCode || 'US').toUpperCase()
  const categoryId = query.categoryId && query.categoryId !== 'all' ? String(query.categoryId) : ''
  const forceRefresh = query.forceRefresh === 'true'

  // IP rate limiting to prevent spamming
  const clientIdentifier = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'
  const rateLimit = await checkRateLimit(clientIdentifier, { windowSeconds: 60, maxRequests: 60 })
  if (!rateLimit.allowed) {
    throw createError({
      statusCode: 429,
      statusMessage: `Too many requests. Please wait ${rateLimit.resetInSeconds}s.`
    })
  }

  const redis = useRedis()
  const cacheKey = `yt:niche:popular:v1:${regionCode}:${categoryId || 'all'}`

  // 1. Check Redis Cache first (0 quota cost to anyone)
  if (!forceRefresh) {
    try {
      const cached = await redis.get<NicheVideoItem[]>(cacheKey)
      if (cached && Array.isArray(cached) && cached.length > 0) {
        return {
          source: 'cache',
          regionCode,
          categoryId: categoryId || 'all',
          total: cached.length,
          videos: cached
        }
      }
    } catch (err) {
      console.warn('Redis niche cache read error:', err)
    }
  }

  // 2. Fetch from YouTube Data API (chart=mostPopular, 2 pages of 50 = 100 items total)
  const config = useRuntimeConfig()
  const apiKey = config.youtubeApiKey
  if (!apiKey) {
    throw createError({
      statusCode: 500,
      statusMessage: 'YouTube API Key is not configured on the server.'
    })
  }

  // System quota consumption: 2 units (1 per 50 videos list call)
  const quota = await checkAndConsumeQuota(2)
  if (!quota.allowed) {
    throw createError({
      statusCode: 429,
      statusMessage: 'Daily system YouTube quota limit reached. Please try again tomorrow.'
    })
  }

  try {
    const baseParams: Record<string, string | number> = {
      part: 'snippet,contentDetails,statistics',
      chart: 'mostPopular',
      maxResults: 50,
      regionCode,
      key: apiKey
    }
    if (categoryId) {
      baseParams.videoCategoryId = categoryId
    }

    // Page 1 (up to 50 videos)
    const page1 = await $fetch<YouTubeVideosListResponse>('https://www.googleapis.com/youtube/v3/videos', {
      params: baseParams
    })

    const rawItems = [...(page1.items || [])]

    // Page 2 (next 50 videos) if nextPageToken exists
    if (page1.nextPageToken && rawItems.length >= 50) {
      try {
        const page2 = await $fetch<YouTubeVideosListResponse>('https://www.googleapis.com/youtube/v3/videos', {
          params: {
            ...baseParams,
            pageToken: page1.nextPageToken
          }
        })
        if (page2.items && page2.items.length > 0) {
          rawItems.push(...page2.items)
        }
      } catch (page2Err) {
        console.warn('Failed to fetch page 2 of mostPopular videos:', page2Err)
      }
    }

    const videos: NicheVideoItem[] = rawItems.map((video) => {
      const durationSeconds = parseISO8601Duration(video.contentDetails?.duration || '')
      const titleLower = (video.snippet?.title || '').toLowerCase()
      const descLower = (video.snippet?.description || '').toLowerCase()
      const isShort = (durationSeconds > 0 && durationSeconds <= 60)
        || titleLower.includes('#short')
        || descLower.includes('#shorts')

      const viewCount = Number(video.statistics?.viewCount ?? 0)
      const publishedAt = video.snippet?.publishedAt || new Date().toISOString()
      const viewsPerHour = calculateViewsPerHour(viewCount, publishedAt)

      const thumb = video.snippet?.thumbnails?.maxres?.url
        || video.snippet?.thumbnails?.standard?.url
        || video.snippet?.thumbnails?.high?.url
        || video.snippet?.thumbnails?.medium?.url
        || video.snippet?.thumbnails?.default?.url
        || ''

      return {
        id: video.id,
        title: video.snippet?.title || 'Untitled',
        description: video.snippet?.description || '',
        channelId: video.snippet?.channelId || '',
        channelTitle: video.snippet?.channelTitle || 'Unknown Channel',
        publishedAt,
        thumbnail: thumb,
        viewCount,
        likeCount: Number(video.statistics?.likeCount ?? 0),
        commentCount: Number(video.statistics?.commentCount ?? 0),
        durationSeconds,
        isShort,
        categoryId: video.snippet?.categoryId,
        viewsPerHour
      }
    })

    // 3. Cache into Redis for 24 hours
    if (videos.length > 0) {
      try {
        await redis.set(cacheKey, videos, { ex: CACHE_TTL_SECONDS })
      } catch (cacheErr) {
        console.warn('Failed to write niche videos to Redis:', cacheErr)
      }
    }

    return {
      source: 'youtube-api',
      regionCode,
      categoryId: categoryId || 'all',
      total: videos.length,
      videos
    }
  } catch (error: any) {
    if (error.statusCode === 429) throw error

    // If category has no chart in this region (404), return empty list cleanly
    if (error?.statusCode === 404 || error?.status === 404 || error?.data?.error?.code === 404) {
      return {
        source: 'empty',
        regionCode,
        categoryId: categoryId || 'all',
        total: 0,
        videos: []
      }
    }

    console.error('YouTube Niche API Error:', error)
    throw createError({
      statusCode: 502,
      statusMessage: error?.data?.error?.message || 'Error fetching trending videos from YouTube API.',
      data: error?.data || error?.message
    })
  }
})
