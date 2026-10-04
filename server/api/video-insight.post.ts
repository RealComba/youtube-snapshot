interface VideoInsightPayload {
  videoId: string
  title: string
  publishedAt: string
  viewCount: number
  likeCount: number
  commentCount: number
  durationSeconds: number
  isShort: boolean
  channelTitle?: string
  avgViews?: number
}

interface GeminiGenerateContentResponse {
  candidates?: Array<{
    content: {
      parts: Array<{ text?: string }>
    }
  }>
}

interface VideoInsightResult {
  videoId: string
  diagnosis: string
  generatedAt: string
}

const CACHE_TTL_SECONDS = 60 * 60 * 24 * 7 // 7 days cache for video breakdown

const GEMINI_MODEL = 'gemini-2.5-flash'

const SYSTEM_PROMPT = `You are a YouTube viral content strategist (VidIQ style). 
Analyze the provided video statistics, title, format, and channel benchmark.
Diagnose WHY the video performed the way it did (outlier virality, title hook psychology, format suitability, or algorithmic factors).

Format your response in 3 brief, distinct bullet points:
• 🎯 Title & Hook: The specific psychological trigger or curiosity gap in the title.
• ⚡ Algorithmic Engine: Why the format (Shorts vs Long), duration, or topic resonated with viewers and retention.
• 💡 Key Creator Takeaway: One practical insight any creator can replicate.

Keep it concise, analytical, realistic (call out luck/trend if applicable), and under 150 words.`

export default defineEventHandler(async (event) => {
  // 🔐 Auth guard: requires valid session or returns 401
  const { user } = await requireUserSession(event)

  const payload = await readBody<VideoInsightPayload>(event)

  if (!payload?.videoId || !payload?.title) {
    throw createError({
      statusCode: 400,
      statusMessage: 'videoId and title are required'
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

  const cacheKey = `yt:video-insight:${payload.videoId}`
  const redis = useRedis()
  const cached = await redis.get<VideoInsightResult>(cacheKey)

  if (cached) {
    return { ...cached, cached: true }
  }

  // 🛡️ Per-user daily AI quota consumption on cache miss
  const aiQuota = await checkAndConsumeAiQuota(user.id)
  if (!aiQuota.allowed) {
    throw createError({
      statusCode: 429,
      statusMessage: `Daily AI limit reached (30/30 credits used). Quota resets in ${Math.ceil(aiQuota.resetInSeconds / 60)} minutes.`
    })
  }

  const channelAvg = payload.avgViews || 0
  const multiplier = channelAvg > 0 ? (payload.viewCount / channelAvg).toFixed(1) : '1.0'
  const engagement = payload.viewCount > 0
    ? (((payload.likeCount + payload.commentCount) / payload.viewCount) * 100).toFixed(2)
    : '0.00'

  const prompt = [
    `Channel: ${payload.channelTitle || 'Unknown Creator'}`,
    `Channel Average Views per Upload: ${channelAvg.toLocaleString()}`,
    `Video Title: "${payload.title}"`,
    `Format: ${payload.isShort ? 'Shorts' : 'Long-form'} (${payload.durationSeconds}s)`,
    `Published Date: ${payload.publishedAt}`,
    `Views: ${payload.viewCount.toLocaleString()} (${multiplier}x channel benchmark)`,
    `Likes: ${payload.likeCount.toLocaleString()}`,
    `Comments: ${payload.commentCount.toLocaleString()}`,
    `Engagement Rate: ${engagement}%`,
    ``,
    `Provide the viral breakdown now.`
  ].join('\n')

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
            parts: [{ text: SYSTEM_PROMPT }]
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

    const text = extractText(response)

    if (!text) {
      throw createError({
        statusCode: 502,
        statusMessage: 'Empty response from Gemini.'
      })
    }

    const result: VideoInsightResult = {
      videoId: payload.videoId,
      diagnosis: text,
      generatedAt: new Date().toISOString()
    }

    await redis.set(cacheKey, result, { ex: CACHE_TTL_SECONDS })

    return { ...result, cached: false }
  } catch (error: any) {
    if (error.statusCode) throw error

    throw createError({
      statusCode: 502,
      statusMessage: 'Error generating video insight',
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
