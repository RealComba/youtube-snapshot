import { useRedis } from '../utils/redis'
import { checkAndConsumeQuota, YOUTUBE_COSTS } from '../utils/quota'
import { checkRateLimit } from '../utils/rateLimit'
import { usePrisma } from '../utils/prisma'

interface YoutubeChannelListResponse {
  items?: Array<{
    id: string
    snippet: {
      title: string
      description: string
      thumbnails: {
        medium: { url: string }
      }
    }
    statistics: {
      viewCount: string
      subscriberCount: string
      videoCount: string
    }
  }>
}

type ChannelPayload = ReturnType<typeof buildChannelPayload>

const CACHE_TTL_SECONDS = 60 * 60 * 24 // 24h — i dati canale non cambiano al minuto

export default defineEventHandler(async (event) => {
  const { handle, id } = getQuery(event)

  if (!handle && !id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Param "handle" needed (@channelname) or id (Channel Id)'
    })
  }

const clientIdentifier = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'
  const rateLimit = await checkRateLimit(clientIdentifier)
 
  if (!rateLimit.allowed) {
    throw createError({
      statusCode: 429,
      statusMessage: `Too many request. Retry after ${rateLimit.resetInSeconds}s.`
    })
  }

  const cacheKey = `yt:channel:${handle ?? id}`
  const redis = useRedis()

  // 1. Controlla la cache prima di chiamare YouTube
  const cached = await redis.get<ChannelPayload>(cacheKey)
  if (cached) {
    return cached
  }

  const quota = await checkAndConsumeQuota(YOUTUBE_COSTS.channels)
  if (!quota.allowed) {
    throw createError({
      statusCode: 429,
      statusMessage: 'Daily quota limit reached, try again after reset.'
    })
  }

  const config = useRuntimeConfig()

  const params: Record<string, string> = {
    part: 'statistics,snippet',
    key: config.youtubeApiKey
  }

  if (handle) params.forHandle = String(handle)
  if (id) params.id = String(id)

  try {
    const response = await $fetch<YoutubeChannelListResponse>(
      'https://www.googleapis.com/youtube/v3/channels',
      { params }
    )

    if (!response.items || response.items.length === 0) {
      throw createError({
        statusCode: 404,
        statusMessage: 'No channel found'
      })
    }

    const channel = response.items[0]

    if (!channel) {
      throw createError({
        statusCode: 404,
        statusMessage: 'No channel found'
      })
    }



    const payload = buildChannelPayload(channel)

    await redis.set(cacheKey, payload, { ex: CACHE_TTL_SECONDS })

     try {
      const prisma = usePrisma()
 
      await prisma.channel.upsert({
        where: { id: payload.id },
        create: {
          id: payload.id,
          handle: typeof handle === 'string' ? handle : null,
          title: payload.title,
          thumbnail: payload.thumbnail
        },
        update: {
          title: payload.title,
          thumbnail: payload.thumbnail
        }
      })
 
      await prisma.channelSnapshot.create({
        data: {
          channelId: payload.id,
          subscriberCount: payload.subscriberCount,
          viewCount: payload.viewCount,
          videoCount: payload.videoCount
        }
      })
    } catch (dbError) {
      console.error('Errore salvataggio snapshot canale:', dbError)
    }

    return payload
  } catch (error: any) {
    if (error.statusCode) throw error

    throw createError({
      statusCode: 502,
      statusMessage: 'Error while calling YouTube Data API.',
      data: error.data ?? error.message
    })
  }
})

function buildChannelPayload(channel: NonNullable<YoutubeChannelListResponse['items']>[number]) {
  return {
    id: channel.id,
    title: channel.snippet.title,
    description: channel.snippet.description,
    thumbnail: channel.snippet.thumbnails.medium.url,
    subscriberCount: Number(channel.statistics.subscriberCount),
    viewCount: Number(channel.statistics.viewCount),
    videoCount: Number(channel.statistics.videoCount)
  }
}