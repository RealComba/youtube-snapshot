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

const INSIGHT_SYSTEM_PROMPT = `You are an elite YouTube growth analyst (VidIQ / SocialBlade style). You receive a channel's statistics and its latest videos.

Write a sharp, high-value analysis in 3-4 concise, complete sentences in English — never generic, never just a restatement of the raw numbers.

Point out real patterns:
1. Upload cadence and consistency.
2. Mix and performance of Shorts vs long-form content.
3. Standout outlier videos and a concrete hypothesis for why they performed well or underperformed.

IMPORTANT: Always conclude with a complete, fully formed sentence. Never stop mid-thought or mid-sentence.`

export default defineEventHandler(async (event) => {
  // 🔐 Auth guard: requires valid session or returns 401
  const { user } = await requireUserSession(event)

  const { channel, videos } = await readBody<{
    channel: ChannelPayload
    videos: VideoSummary[]
  }>(event)

  if (!channel?.id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Channel data is required'
    })
  }

  const clientIdentifier = `user:${user.id}`
  const rateLimit = await checkRateLimit(clientIdentifier, { windowSeconds: 60, maxRequests: 10 })

  if (!rateLimit.allowed) {
    throw createError({
      statusCode: 429,
      statusMessage: `Too many requests. Try again in ${rateLimit.resetInSeconds}s.`
    })
  }

  const cacheKey = `yt:insight:${channel.id}`
  const redis = useRedis()
  const cached = await redis.get<InsightResult>(cacheKey)

  if (cached) {
    return { channelId: channel.id, ...cached, cached: true }
  }

  // 🛡️ Per-user daily AI quota consumption on cache miss
  const aiQuota = await checkAndConsumeAiQuota(user.id)
  if (!aiQuota.allowed) {
    throw createError({
      statusCode: 429,
      statusMessage: `Daily AI limit reached (30/30 credits used). Quota resets in ${Math.ceil(aiQuota.resetInSeconds / 60)} minutes.`
    })
  }

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
            maxOutputTokens: 1000
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

    return { channelId: channel.id, ...result, cached: false }
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