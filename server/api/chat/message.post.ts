import { usePrisma } from '../../utils/prisma'
import { checkRateLimit } from '../../utils/rateLimit'
import { checkAndConsumeAiQuota } from '../../utils/aiLimit'

interface ChatMessagePayload {
  sessionId: string
  content: string
}

interface GeminiGenerateContentResponse {
  candidates?: Array<{
    content: {
      parts: Array<{ text?: string }>
    }
  }>
}

const GEMINI_MODEL = 'gemini-2.5-flash'

const BASE_SYSTEM_PROMPT = `You are an elite YouTube Strategy Coach & AI Growth Consultant (VidIQ Pro & Think Media caliber).
Your mission is to help creators maximize views, click-through-rate (CTR), average view duration (AVD), and subscriber growth.

Your core competencies:
1. Title Hooks & Psychology: High-converting formulas, curiosity gaps, tension-building, and search vs browse intent.
2. Thumbnail Concepting: Visual hierarchy, 3-element rule, focal contrast, and emotion drivers.
3. Retention Pacing: First 15-30s hook formulas, pattern interrupts, and payoff delivery.
4. Channel Strategy: Upload cadence, Shorts-to-Long-form funnel, and niche authority building.

Style guidelines:
- Be ultra-specific, data-driven, and actionable. Avoid vague fluff like "make good content".
- Give concrete title examples, thumbnail briefs, and step-by-step scripts when relevant.
- Format using clean Markdown with bolding, concise bullet points, and clear sections.`

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  const body = await readBody<ChatMessagePayload>(event)

  if (!body?.sessionId || !body?.content?.trim()) {
    throw createError({
      statusCode: 400,
      statusMessage: 'sessionId and message content are required'
    })
  }

  const prisma = usePrisma()

  // 1. Verify session exists and belongs to user
  const session = await prisma.chatSession.findFirst({
    where: {
      id: body.sessionId,
      userId: user.id
    },
    include: {
      user: {
        include: {
          ownChannel: {
            include: {
              snapshots: {
                orderBy: { capturedAt: 'desc' },
                take: 1
              }
            }
          }
        }
      }
    }
  })

  if (!session) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Chat session not found'
    })
  }

  // 2. Per-user rate limit (10 requests per minute)
  const rateLimit = await checkRateLimit(`user:${user.id}:chat`, { windowSeconds: 60, maxRequests: 10 })
  if (!rateLimit.allowed) {
    throw createError({
      statusCode: 429,
      statusMessage: `Too many chat requests. Please wait ${rateLimit.resetInSeconds}s.`
    })
  }

  // 3. Per-user daily AI quota check (30 credits / 24h)
  const quota = await checkAndConsumeAiQuota(user.id)
  if (!quota.allowed) {
    throw createError({
      statusCode: 429,
      statusMessage: `Daily AI limit reached (30/30 credits used today). Quota resets in ${Math.ceil(quota.resetInSeconds / 60)} minutes.`
    })
  }

  // 4. Save user message to database
  await prisma.chatMessage.create({
    data: {
      sessionId: session.id,
      role: 'user',
      content: body.content.trim()
    }
  })

  // 5. Fetch previous messages for context (last 10)
  const pastMessages = await prisma.chatMessage.findMany({
    where: { sessionId: session.id },
    orderBy: { createdAt: 'asc' },
    take: 12
  })

  // 6. Build channel-enriched system prompt
  let channelContext = ''
  const ownChannel = session.user.ownChannel
  if (ownChannel) {
    const snap = ownChannel.snapshots?.[0]
    channelContext = `\n\n[USER CONNECTED CHANNEL CONTEXT]:
- Channel Title: "${ownChannel.title}"
- Handle: ${ownChannel.handle || 'N/A'}
- Subscribers: ${snap ? snap.subscriberCount.toLocaleString() : 'N/A'}
- Total Views: ${snap ? snap.viewCount.toString() : 'N/A'}
- Total Videos: ${snap ? snap.videoCount.toLocaleString() : 'N/A'}
Tailor recommendations specifically to this creator's scale and niche whenever relevant.`
  }

  const systemInstruction = BASE_SYSTEM_PROMPT + channelContext

  // 7. Format conversation for Gemini
  const contents = pastMessages.map((msg) => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content }]
  }))

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
            parts: [{ text: systemInstruction }]
          },
          contents,
          generationConfig: {
            maxOutputTokens: 1500,
            thinkingConfig: {
              thinkingBudget: 512
            }
          }
        }
      }
    )

    const assistantText = response.candidates?.[0]?.content?.parts
      ?.map((p) => p.text ?? '')
      .join('')
      .trim()

    if (!assistantText) {
      throw createError({
        statusCode: 502,
        statusMessage: 'Empty response received from AI model.'
      })
    }

    // 8. Save assistant message to database
    const assistantMessage = await prisma.chatMessage.create({
      data: {
        sessionId: session.id,
        role: 'assistant',
        content: assistantText
      }
    })

    // 9. Auto-title session if it was still the default title
    if (session.title === 'New Strategy Session') {
      const generatedTitle = body.content.trim().slice(0, 40) + (body.content.length > 40 ? '...' : '')
      await prisma.chatSession.update({
        where: { id: session.id },
        data: {
          title: generatedTitle,
          updatedAt: new Date()
        }
      })
    } else {
      await prisma.chatSession.update({
        where: { id: session.id },
        data: { updatedAt: new Date() }
      })
    }

    return {
      message: assistantMessage,
      remainingQuota: quota.remaining
    }
  } catch (err: any) {
    if (err.statusCode) throw err

    throw createError({
      statusCode: 502,
      statusMessage: 'Error communicating with Gemini AI',
      data: err.data ?? err.message
    })
  }
})
