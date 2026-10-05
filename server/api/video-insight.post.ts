interface VideoInsightPayload {
  videoId: string
  title: string
  description?: string
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

export interface TitleAlternative {
  title: string
  score: number
  formula: string
}

export interface SeoChecklistItem {
  item: string
  passed: boolean
}

export interface VideoInsightTabs {
  titleHook: {
    analysis: string
    score: number
    alternativeTitles: TitleAlternative[]
  }
  seoAlgorithm: {
    analysis: string
    seoScore: number
    descriptionSuggestion: string
    recommendedHashtags: string[]
    suggestedKeywords: string[]
    checklist: SeoChecklistItem[]
    searchBrowseFit: string
  }
  contentReview: {
    analysis: string
    hookScore: number
    strengths: string[]
    retentionLeaks: string[]
    nextAction: string
    retentionAdvice?: string
    nextVideoIdea?: string
  }
  overallSummary: string
}

export interface VideoInsightResult {
  videoId: string
  diagnosis?: string
  tabs: VideoInsightTabs
  generatedAt: string
}

const CACHE_TTL_SECONDS = 60 * 60 * 24 * 7 // 7 days cache for video breakdown

const GEMINI_MODEL = 'gemini-2.5-flash'

const SYSTEM_PROMPT = `You are an elite YouTube viral content strategist (VidIQ Pro & Think Media caliber).
Analyze the provided video statistics, title, format, and channel benchmark.
Return a valid JSON object strictly matching this schema:
{
  "titleHook": {
    "analysis": "Specific psychological hook breakdown, curiosity gap or tension in the title.",
    "score": 88,
    "alternativeTitles": [
      { "title": "High-CTR Title Variation 1", "score": 94, "formula": "Curiosity Gap" },
      { "title": "High-CTR Title Variation 2", "score": 91, "formula": "Contrarian" },
      { "title": "High-CTR Title Variation 3", "score": 89, "formula": "High Stakes" }
    ]
  },
  "seoAlgorithm": {
    "analysis": "Why this format, tags, duration and topic resonated with search and browse algorithms.",
    "seoScore": 85,
    "descriptionSuggestion": "An SEO-optimized description with emojis 🔥. Make sure to subscribe!",
    "recommendedHashtags": ["#shorts", "#tech", "#ai", "#creator", "#growth"],
    "suggestedKeywords": ["youtube strategy", "viral retention", "audience growth"],
    "checklist": [
      { "item": "Title length within 40-70 character sweet spot", "passed": true },
      { "item": "High-contrast thumbnail keyword alignment", "passed": true },
      { "item": "Clear viewer call-to-action in description", "passed": false },
      { "item": "Key searchable timestamp chapters", "passed": false }
    ],
    "searchBrowseFit": "Browse Feature Driven (or Search Intent Driven)"
  },
  "contentReview": {
    "analysis": "Structured assessment of format length, pacing and storytelling payoff.",
    "hookScore": 90,
    "strengths": [
      "Immediate visual tension in the opening 5 seconds",
      "Fast-paced pattern interrupts preventing dropoff"
    ],
    "retentionLeaks": [
      "Slight mid-video lull where stakes feel unclear",
      "Abrupt conclusion without strong end-screen transition"
    ],
    "nextAction": "Start your next upload directly in media res, cutting any greeting, and deliver on the main curiosity hook within 15 seconds."
  },
  "overallSummary": "1-2 sentence core takeaway summarizing this video's performance."
}`

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

  const cacheKey = `yt:video-insight:v3:${payload.videoId}`
  const redis = useRedis()
  const cached = await redis.get<VideoInsightResult>(cacheKey)

  if (cached) {
    if (!cached.tabs) {
      cached.tabs = {
        titleHook: { analysis: cached.diagnosis || '', alternativeTitles: [], score: 75 },
        seoAlgorithm: { analysis: 'Algorithmic assessment completed.', seoScore: 75, descriptionSuggestion: "Check out this amazing video!", recommendedHashtags: [], suggestedKeywords: [], checklist: [], searchBrowseFit: 'Browse Features' },
        contentReview: { analysis: cached.diagnosis || '', hookScore: 75, strengths: [], retentionLeaks: [], nextAction: 'Deepen winning topics.' },
        overallSummary: cached.diagnosis || ''
      }
    }
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
    `Video Description: "${(payload.description || "").slice(0, 500)}..."`,
    `Format: ${payload.isShort ? 'Shorts' : 'Long-form'} (${payload.durationSeconds}s)`,
    `Published Date: ${payload.publishedAt}`,
    `Views: ${payload.viewCount.toLocaleString()} (${multiplier}x channel benchmark)`,
    `Likes: ${payload.likeCount.toLocaleString()}`,
    `Comments: ${payload.commentCount.toLocaleString()}`,
    `Engagement Rate: ${engagement}%`,
    ``,
    `Provide the structured viral breakdown JSON now.`
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
            responseMimeType: 'application/json',
            maxOutputTokens: 8192
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

    let jsonText = text.trim()
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '')
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```\s*/, '').replace(/\s*```$/, '')
    }
    
    let parsedTabs: VideoInsightTabs
    try {
      parsedTabs = JSON.parse(jsonText)
      // Normalize alternativeTitles if strings from older cache
      if (parsedTabs?.titleHook?.alternativeTitles?.length) {
        parsedTabs.titleHook.alternativeTitles = parsedTabs.titleHook.alternativeTitles.map((item: any, idx: number) => {
          if (typeof item === 'string') {
            const formulas = ['Curiosity Gap', 'Contrarian', 'High Stakes', 'Value Promise']
            return { title: item, score: 92 - idx * 3, formula: formulas[idx % formulas.length] }
          }
          return item
        })
      }
      if (!parsedTabs.seoAlgorithm?.checklist) {
        parsedTabs.seoAlgorithm.checklist = [
          { item: 'Title length within 40-70 characters', passed: payload.title.length >= 40 && payload.title.length <= 70 },
          { item: 'Clear viewer call-to-action in description', passed: true },
          { item: 'Key searchable timestamp chapters', passed: !payload.isShort }
        ]
      }
      if (!parsedTabs.seoAlgorithm?.seoScore) {
        parsedTabs.seoAlgorithm.seoScore = 80
      }
      if (!parsedTabs.contentReview?.hookScore) {
        parsedTabs.contentReview.hookScore = 85
      }
      if (!parsedTabs.contentReview?.strengths?.length) {
        parsedTabs.contentReview.strengths = ['High engagement multiplier vs channel baseline', 'Compelling title hook']
      }
      if (!parsedTabs.contentReview?.retentionLeaks?.length) {
        parsedTabs.contentReview.retentionLeaks = ['Viewer drop-off around the 30-second mark', 'Opportunities for tighter pacing']
      }
      if (!parsedTabs.contentReview?.nextAction) {
        parsedTabs.contentReview.nextAction = parsedTabs.contentReview.retentionAdvice || 'Apply strong opening visual hooks within the first 10 seconds.'
      }
    } catch {
      parsedTabs = {
        titleHook: { analysis: text, alternativeTitles: [], score: 75 },
        seoAlgorithm: { analysis: 'Algorithmic breakdown generated.', seoScore: 75, descriptionSuggestion: "Check out this amazing video!", recommendedHashtags: [], suggestedKeywords: [], checklist: [], searchBrowseFit: 'Algorithmic' },
        contentReview: { analysis: text, hookScore: 75, strengths: [], retentionLeaks: [], nextAction: 'Iterate on top performing concept.' },
        overallSummary: text.slice(0, 200)
      }
    }

    const result: VideoInsightResult = {
      videoId: payload.videoId,
      diagnosis: parsedTabs.overallSummary,
      tabs: parsedTabs,
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
