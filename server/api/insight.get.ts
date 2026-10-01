interface ChannelPayload {
  id: string
  title: string
  description: string
  thumbnail: string
  subscriberCount: number
  viewCount: number
  videoCount: number
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

interface GeminiGenerateContentResponse {
  candidates?: Array<{
    content: {
      parts: Array<{ text?: string }>
    }
  }>
}

interface InsightResult {
  insight: string
  generatedAt: string
}

const CACHE_TTL_SECONDS = 60 * 60 * 24 


const GEMINI_MODEL = 'gemini-2.5-flash'

const INSIGHT_SYSTEM_PROMPT = `You are a growth analyst for YouTube creators. You receive a channel's statistics and its latest videos.

Write a short, concrete, specific analysis in 3-4 sentences, in English — never generic, never just a restatement of the numbers you were given.

Point out real patterns: upload cadence, the mix of Shorts vs long-form videos, which video is outperforming the others and a hypothesis for why. If the data is insufficient for a solid pattern, say so honestly instead of inventing a weak observation.`

export default defineEventHandler(async (event) => {
  const { channelId } = getQuery(event)

  if (!channelId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Param "channelId" needed (UCxxxxxxxx)'
    })
  }

  const clientIdentifier = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'
  const rateLimit = await checkRateLimit(clientIdentifier)

  if (!rateLimit.allowed) {
    throw createError({
      statusCode: 429,
      statusMessage: `Too many requests. Try again in ${rateLimit.resetInSeconds}s.`
    })
  }

  const cacheKey = `yt:insight:${channelId}`
  const redis = useRedis()
  const cached = await redis.get<InsightResult>(cacheKey)

  if (cached) {
    return { channelId: String(channelId), ...cached, cached: true }
  }

  const [channel, videos] = await Promise.all([
    $fetch<ChannelPayload>('/api/channel', { params: { id: channelId } }),
    $fetch<VideoSummary[]>('/api/videos', { params: { channelId, maxResults: 10 } })
  ])

  const prompt = buildInsightPrompt(channel, videos)
  const config = useRuntimeConfig()

  try {
    const response = await $fetch<GeminiGenerateContentResponse>(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: 'POST',
        headers: {
          'x-goog-api-key': config.geminiApiKey,
          'content-type': 'application/json'
        },
        body: {
          systemInstruction: {
            parts: [{ text: INSIGHT_SYSTEM_PROMPT }]
          },
          contents: [
            { role: 'user', parts: [{ text: prompt }] }
          ],
          generationConfig: {
            maxOutputTokens: 400
          }
        }
      }
    )

    const insightText = extractText(response)

    if (!insightText) {
      throw createError({
        statusCode: 502,
        statusMessage: 'Empty response from Gemini.'
      })
    }

    const result: InsightResult = {
      insight: insightText,
      generatedAt: new Date().toISOString()
    }

    await redis.set(cacheKey, result, { ex: CACHE_TTL_SECONDS })

    return { channelId: String(channelId), ...result, cached: false }
  }
  catch (error: any) {
    if (error.statusCode) throw error

    throw createError({
      statusCode: 502,
      statusMessage: 'Error calling Gemini API.',
      data: error.data ?? error.message
    })
  }
})


function extractText(response: GeminiGenerateContentResponse): string {
  const parts = response.candidates?.[0]?.content?.parts ?? []

  return parts
    .map(part => part.text ?? '')
    .join('')
    .trim()
}

function buildInsightPrompt(channel: ChannelPayload, videos: VideoSummary[]): string {
  const header = [
    `Channel: ${channel.title}`,
    `Subscribers: ${channel.subscriberCount}`,
    `Total views: ${channel.viewCount}`,
    `Total videos: ${channel.videoCount}`
  ].join('\n')

  if (videos.length === 0) {
    return `${header}\n\nNo recent videos available for detailed analysis.`
  }

  const videoLines = videos
    .map(v =>
      `- "${v.title}" | ${v.isShort ? 'Short' : 'Long-form'} `
      + `| ${v.viewCount} views, ${v.likeCount} likes, ${v.commentCount} comments `
      + `| published ${v.publishedAt}`
    )
    .join('\n')

  return `${header}\n\nLatest ${videos.length} published videos:\n${videoLines}\n\nGenerate the analysis.`
}