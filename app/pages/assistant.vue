<script setup lang="ts">
import { renderMarkdown } from '~/composables/useMarkdown'

definePageMeta({ middleware: 'auth' })

interface SessionItem {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  _count?: { messages: number }
}

interface MessageItem {
  id: string
  sessionId: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
}

interface FullSession {
  id: string
  title: string
  messages: MessageItem[]
}

const { user } = useUserSession()

const sessions = ref<SessionItem[]>([])
const activeSessionId = ref<string | null>(null)
const activeSession = ref<FullSession | null>(null)
const loadingSessions = ref(true)
const loadingMessages = ref(false)
const sending = ref(false)
const thinkingSeconds = ref(0)
let thinkingTimer: ReturnType<typeof setInterval> | null = null

const thinkingPhrase = computed(() => {
  const s = thinkingSeconds.value
  if (s < 3) return 'Analyzing channel metrics & niche patterns...'
  if (s < 7) return 'Drafting high-converting title hooks & blueprints...'
  if (s < 12) return 'Polishing strategy & retention breakdown...'
  return 'Finalizing comprehensive growth blueprint...'
})

const inputMessage = ref('')
const messageContainer = ref<HTMLElement | null>(null)
const sidebarOpen = ref(true)

const quota = ref<{
  remaining: number
  totalUsed: number
  limit: number
} | null>(null)

const starterPrompts = [
  {
    icon: 'i-lucide-lightbulb',
    title: '5 Viral Video Concepts',
    prompt: 'Give me 5 viral video concepts tailored to my channel niche with high-converting title formulas and thumbnail ideas.'
  },
  {
    icon: 'i-lucide-gauge',
    title: 'First 30s Retention Hook',
    prompt: 'How can I structure the first 30 seconds of my next long-form video to stop viewers from clicking off?'
  },
  {
    icon: 'i-lucide-split',
    title: 'Shorts vs Long-form Funnel',
    prompt: 'What is the optimal strategy to convert viral Shorts viewers into loyal subscribers for my long-form uploads?'
  },
  {
    icon: 'i-lucide-sparkles',
    title: 'Title Psychology Breakdown',
    prompt: 'Analyze what psychological triggers and curiosity gaps work best for tech & educational titles in 2026.'
  }
]

async function fetchQuota() {
  try {
    const res = await $fetch<{ remaining: number, totalUsed: number, limit: number }>('/api/ai-quota')
    quota.value = res
  } catch (err) {
    console.warn('Could not fetch AI quota status:', err)
  }
}

async function fetchSessions(skipAutoSelect = false) {
  loadingSessions.value = true
  try {
    const data = await $fetch<SessionItem[]>('/api/chat/sessions')
    sessions.value = data

    if (skipAutoSelect) return

    // If no active session, auto-select the latest one or create new
    if (!activeSessionId.value && data.length > 0) {
      await selectSession(data[0]!.id)
    } else if (data.length === 0) {
      await createNewSession()
    }
  } catch (err) {
    console.error('Error fetching sessions:', err)
  } finally {
    loadingSessions.value = false
  }
}

async function selectSession(id: string) {
  if (activeSessionId.value === id && activeSession.value) return

  activeSessionId.value = id
  loadingMessages.value = true
  try {
    const session = await $fetch<FullSession>(`/api/chat/${id}`)
    activeSession.value = session
    scrollToBottom()
  } catch (err) {
    console.error('Error loading session messages:', err)
  } finally {
    loadingMessages.value = false
  }
}

async function createNewSession(initialPrompt?: string, customTitle?: string) {
  try {
    const newSession = await $fetch<SessionItem>('/api/chat/sessions', {
      method: 'POST',
      body: { title: customTitle || 'New Strategy Session' }
    })

    sessions.value.unshift(newSession)
    activeSessionId.value = newSession.id
    activeSession.value = {
      id: newSession.id,
      title: newSession.title,
      messages: []
    }

    if (initialPrompt) {
      await sendMessage(initialPrompt)
    }
  } catch (err) {
    console.error('Error creating new session:', err)
  }
}

async function deleteSession(id: string, event: Event) {
  event.stopPropagation()
  if (!confirm('Are you sure you want to delete this strategy session?')) return

  try {
    await $fetch(`/api/chat/${id}`, { method: 'DELETE' })
    sessions.value = sessions.value.filter(s => s.id !== id)

    if (activeSessionId.value === id) {
      if (sessions.value.length > 0) {
        await selectSession(sessions.value[0]!.id)
      } else {
        await createNewSession()
      }
    }
  } catch (err) {
    console.error('Error deleting session:', err)
  }
}

async function sendMessage(promptOverride?: string) {
  const text = (promptOverride || inputMessage.value).trim()
  if (!text || sending.value || !activeSessionId.value) return

  inputMessage.value = ''
  sending.value = true
  thinkingSeconds.value = 0
  if (thinkingTimer) clearInterval(thinkingTimer)
  thinkingTimer = setInterval(() => {
    thinkingSeconds.value++
  }, 1000)

  // Optimistic user message in UI
  const tempUserMsg: MessageItem = {
    id: `temp-${Date.now()}`,
    sessionId: activeSessionId.value,
    role: 'user',
    content: text,
    createdAt: new Date().toISOString()
  }

  if (activeSession.value) {
    activeSession.value.messages.push(tempUserMsg)
  }
  scrollToBottom()

  try {
    const res = await $fetch<{
      message: MessageItem
      remainingQuota: number
    }>('/api/chat/message', {
      method: 'POST',
      body: {
        sessionId: activeSessionId.value,
        content: text
      }
    })

    // Stop thinking animation before starting the stream
    if (thinkingTimer) {
      clearInterval(thinkingTimer)
      thinkingTimer = null
    }
    sending.value = false

    // Update remaining quota
    if (quota.value) {
      quota.value.remaining = res.remainingQuota
      quota.value.totalUsed = quota.value.limit - res.remainingQuota
    }
    
    // Notify global listeners (e.g. sidebar)
    if (import.meta.client) {
      window.dispatchEvent(new Event('quota-updated'))
    }

    // Refresh session title in sidebar if updated
    const currentSession = sessions.value.find(s => s.id === activeSessionId.value)
    if (currentSession && currentSession.title === 'New Strategy Session') {
      currentSession.title = text.slice(0, 40) + (text.length > 40 ? '...' : '')
      if (activeSession.value) activeSession.value.title = currentSession.title
    }

    // Animate output starting from top of message and descending smoothly to the end
    await streamAssistantMessage(res.message.content, res.message.id)
  } catch (err: any) {
    console.error('Error sending message:', err)
    const errorMsg = err?.data?.statusMessage || err?.statusMessage || 'Failed to generate response. Please try again.'

    if (activeSession.value) {
      activeSession.value.messages.push({
        id: `err-${Date.now()}`,
        sessionId: activeSessionId.value,
        role: 'assistant',
        content: `**Error**: ${errorMsg}`,
        createdAt: new Date().toISOString()
      })
    }
    scrollToBottom()
  } finally {
    if (thinkingTimer) {
      clearInterval(thinkingTimer)
      thinkingTimer = null
    }
    sending.value = false
  }
}

async function streamAssistantMessage(fullContent: string, messageId: string) {
  if (!activeSession.value) return

  const assistantMsg: MessageItem = {
    id: messageId,
    sessionId: activeSessionId.value!,
    role: 'assistant',
    content: '',
    createdAt: new Date().toISOString()
  }

  activeSession.value.messages.push(assistantMsg)

  // Scroll so the beginning of this assistant message is in view
  await nextTick()
  if (messageContainer.value) {
    const items = messageContainer.value.querySelectorAll('.message-item')
    const lastItem = items[items.length - 1] as HTMLElement | undefined
    if (lastItem) {
      lastItem.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  return new Promise<void>((resolve) => {
    let currentLength = 0
    const totalLength = fullContent.length
    const chunkSize = Math.max(6, Math.ceil(totalLength / 90))
    const intervalMs = 25

    const intervalId = setInterval(() => {
      currentLength += chunkSize
      if (currentLength >= totalLength) {
        assistantMsg.content = fullContent
        clearInterval(intervalId)
        if (messageContainer.value) {
          messageContainer.value.scrollTo({
            top: messageContainer.value.scrollHeight,
            behavior: 'smooth'
          })
        }
        resolve()
      } else {
        assistantMsg.content = fullContent.slice(0, currentLength)
        if (messageContainer.value) {
          messageContainer.value.scrollTo({
            top: messageContainer.value.scrollHeight,
            behavior: 'smooth'
          })
        }
      }
    }, intervalMs)
  })
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    sendMessage()
  }
}

function scrollToBottom() {
  nextTick(() => {
    if (messageContainer.value) {
      messageContainer.value.scrollTop = messageContainer.value.scrollHeight
    }
  })
}

function copyMessage(content: string) {
  navigator.clipboard.writeText(content)
}

const route = useRoute()
const router = useRouter()

onMounted(async () => {
  const incomingPrompt = route.query.prompt ? String(route.query.prompt) : null
  const incomingTitle = route.query.channelTitle ? `Strategy: ${route.query.channelTitle}` : 'Channel Strategy Blueprint'

  if (incomingPrompt) {
    // Clear query parameter from the URL to avoid resubmitting on page refresh
    router.replace({ query: {} })
    await Promise.all([fetchSessions(true), fetchQuota()])
    await createNewSession(incomingPrompt, incomingTitle)
  } else {
    await Promise.all([fetchSessions(false), fetchQuota()])
  }
})
</script>

<template>
  <div class="h-[calc(100vh-3.5rem)] md:h-screen flex overflow-hidden bg-neutral-50 dark:bg-neutral-950">
    <!-- Sub-Sidebar: Chat History & Quota Counter -->
    <aside
      class="border-r border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex flex-col shrink-0 transition-all duration-300 z-20"
      :class="sidebarOpen ? 'w-72' : 'w-0 overflow-hidden border-none'"
    >
      <!-- Top Actions -->
      <div class="p-3 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between gap-2">
        <button
          type="button"
          class="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-primary/10 hover:bg-primary/15 text-primary text-xs font-bold transition-all cursor-pointer"
          @click="createNewSession()"
        >
          <UIcon name="i-lucide-plus" class="size-4" />
          <span>New Session</span>
        </button>

        <button
          type="button"
          class="p-2 rounded-lg text-muted hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 md:hidden cursor-pointer"
          @click="sidebarOpen = false"
        >
          <UIcon name="i-lucide-x" class="size-4" />
        </button>
      </div>

      <!-- Sessions List -->
      <div class="flex-1 overflow-y-auto p-2 space-y-1">
        <div v-if="loadingSessions" class="space-y-2 p-2">
          <USkeleton v-for="i in 5" :key="i" class="h-10 rounded-lg w-full" />
        </div>

        <div v-else-if="sessions.length === 0" class="p-4 text-center text-xs text-muted">
          No previous sessions yet.
        </div>

        <div
          v-for="s in sessions"
          v-else
          :key="s.id"
          role="button"
          tabindex="0"
          class="group w-full flex items-center justify-between p-2.5 rounded-lg text-left text-xs transition-colors cursor-pointer"
          :class="activeSessionId === s.id
            ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white font-semibold'
            : 'text-muted hover:bg-neutral-100/60 dark:hover:bg-neutral-800/40 hover:text-neutral-800 dark:hover:text-neutral-200'"
          @click="selectSession(s.id)"
          @keydown.enter="selectSession(s.id)"
        >
          <div class="flex items-center gap-2 min-w-0 flex-1">
            <UIcon name="i-lucide-message-square" class="size-3.5 shrink-0 text-primary" />
            <span class="truncate">{{ s.title }}</span>
          </div>

          <button
            type="button"
            class="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 rounded transition-opacity cursor-pointer shrink-0"
            title="Delete session"
            @click.stop="deleteSession(s.id, $event)"
          >
            <UIcon name="i-lucide-trash-2" class="size-3" />
          </button>
        </div>
      </div>

      <!-- Quota Counter Card (VidIQ Pro Style) -->
      <div class="p-3 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50">
        <div class="p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-2">
          <div class="flex items-center justify-between text-[11px]">
            <span class="font-bold flex items-center gap-1.5 text-neutral-800 dark:text-neutral-200">
              <UIcon name="i-lucide-sparkles" class="size-3.5 text-primary" />
              Daily AI Credits
            </span>
            <span class="font-mono font-bold text-primary">
              {{ quota ? quota.remaining : 30 }}/{{ quota ? quota.limit : 30 }}
            </span>
          </div>

          <div class="w-full h-1.5 rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
            <div
              class="h-full bg-primary rounded-full transition-all duration-300"
              :style="{ width: `${quota ? (quota.remaining / quota.limit) * 100 : 100}%` }"
            />
          </div>

          <p class="text-[10px] text-muted leading-tight">
            Resets daily at 00:00 UTC. Powered by Gemini 2.5 Flash reasoning.
          </p>
        </div>
      </div>
    </aside>

    <!-- Main Chat Workspace -->
    <main class="flex-1 flex flex-col min-w-0 bg-neutral-50 dark:bg-neutral-950">
      <!-- Chat Header -->
      <header class="h-14 border-b border-neutral-200 dark:border-neutral-800 px-4 flex items-center justify-between bg-white/80 dark:bg-neutral-900/80 backdrop-blur-sm shrink-0">
        <div class="flex items-center gap-3 min-w-0">
          <button
            type="button"
            class="p-1.5 rounded-lg text-muted hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
            title="Toggle Sessions"
            @click="sidebarOpen = !sidebarOpen"
          >
            <UIcon name="i-lucide-panel-left" class="size-4" />
          </button>

          <div class="min-w-0">
            <h2 class="text-sm font-bold truncate">
              {{ activeSession?.title || 'AI Strategy Chat' }}
            </h2>
            <p class="text-[10px] text-muted">
              Context: {{ user?.ownChannel ? `Synced to @${user.ownChannel.handle || user.ownChannel.title}` : 'General Creator Knowledge' }}
            </p>
          </div>
        </div>

        <div class="flex items-center gap-2">
          
        </div>
      </header>

      <!-- Messages Thread -->
      <div
        ref="messageContainer"
        class="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 max-w-4xl w-full mx-auto"
      >
        <!-- Welcome Hero if no messages -->
        <div
          v-if="!loadingMessages && (!activeSession?.messages || activeSession.messages.length === 0)"
          class="py-10 space-y-8 max-w-2xl mx-auto text-center"
        >
          <div class="space-y-3">
            <div class="size-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto shadow-xs">
              <UIcon name="i-lucide-sparkles" class="size-6" />
            </div>
            <h3 class="text-2xl font-extrabold tracking-tight">
              YouTube Strategy & Growth Assistant
            </h3>
            <p class="text-sm text-muted max-w-md mx-auto leading-relaxed">
              Ask about viral titles, thumbnail psychology, retention hooks, and audience conversion blueprints tailored to your channel.
            </p>
          </div>

          <!-- Starter Chips Grid -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
            <button
              v-for="chip in starterPrompts"
              :key="chip.title"
              type="button"
              class="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-primary/50 dark:hover:border-primary/50 hover:shadow-xs transition-all text-left cursor-pointer space-y-1.5 group"
              @click="sendMessage(chip.prompt)"
            >
              <div class="flex items-center gap-2 font-bold text-xs group-hover:text-primary transition-colors">
                <UIcon :name="chip.icon" class="size-3.5 text-primary" />
                <span>{{ chip.title }}</span>
              </div>
              <p class="text-[11px] text-muted line-clamp-2 leading-relaxed">
                {{ chip.prompt }}
              </p>
            </button>
          </div>
        </div>

        <!-- Skeleton during loading -->
        <div v-else-if="loadingMessages" class="space-y-4">
          <USkeleton class="h-20 w-3/4 rounded-xl" />
          <USkeleton class="h-28 w-5/6 rounded-xl ml-auto" />
          <USkeleton class="h-24 w-2/3 rounded-xl" />
        </div>

        <!-- Rendered Message Bubbles -->
        <template v-else>
          <div
            v-for="msg in activeSession?.messages"
            :key="msg.id"
            class="flex gap-3 message-item"
            :class="msg.role === 'user' ? 'justify-end' : 'justify-start'"
          >
            <!-- Message Body -->
            <div
              class="max-w-[85%] sm:max-w-[75%] text-sm space-y-2 ml-6"
              :class="msg.role === 'user'
                ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 rounded-xl px-3 py-2 shadow-xs'
                : 'bg-transparent text-neutral-800 dark:text-neutral-200 mt-0.5 pb-2 fade-in-slow'"
            >
              <!-- Message Header on Assistant -->
              <div v-if="msg.role === 'assistant'" class="flex items-center justify-between gap-4 pb-2">
                <button
                  type="button"
                  class="text-[10px] text-muted hover:text-neutral-900 dark:hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
                  @click="copyMessage(msg.content)"
                >
                  <UIcon name="i-lucide-copy" class="size-3" />
                  <span>Copy</span>
                </button>
              </div>

              <!-- Content with HTML/Markdown rendering -->
              <div
                v-if="msg.role === 'assistant'"
                class="chat-markdown"
                v-html="renderMarkdown(msg.content)"
              />
              <p v-else class="whitespace-pre-wrap leading-relaxed">
                {{ msg.content }}
              </p>
            </div>
          </div>

          <!-- Claude-Style Inline Typing Indicator -->
          <div v-if="sending" class="flex gap-4 items-start transition-all duration-300">
            
            <div class="flex flex-col min-w-0 mt-0.5">
               
               <div class="flex flex-col mt-1 gap-1">
                 <div class="flex items-center gap-3 h-5">
                    <div class="flex space-x-1.5 items-center opacity-60">
                      <div class="size-1.5 bg-neutral-600 dark:bg-neutral-400 rounded-full animate-bounce" style="animation-duration: 0.8s; animation-delay: 0s"></div>
                      <div class="size-1.5 bg-neutral-600 dark:bg-neutral-400 rounded-full animate-bounce" style="animation-duration: 0.8s; animation-delay: 0.15s"></div>
                      <div class="size-1.5 bg-neutral-600 dark:bg-neutral-400 rounded-full animate-bounce" style="animation-duration: 0.8s; animation-delay: 0.3s"></div>
                    </div>
                                     <span class="text-[12px] text-muted">{{ thinkingSeconds }}s</span>

                    
                    <Transition name="fade">
                      <span v-if="thinkingSeconds >= 3" class="text-xs text-muted font-medium italic">
                        {{ thinkingPhrase }}
                      </span>
                    </Transition>
                 </div>
               </div>
            </div>
          </div>
        </template>
      </div>

      <!-- Sticky Input Bar -->
      <div class="p-4 border-t border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shrink-0">
        <div class="max-w-4xl mx-auto space-y-2">
          <form class="relative flex items-center gap-2" @submit.prevent="sendMessage()">
            <textarea
              v-model="inputMessage"
              rows="1"
              placeholder="Ask for title ideas, audience retention advice, or competitor critique..."
              class="w-full resize-none rounded-full border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/60 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all pr-12 max-h-32"
              :disabled="sending"
              @keydown="handleKeydown"
            />

            <button
              type="submit"
              class="flex items-center justify-center absolute right-2 p-2 rounded-full bg-primary hover:bg-primary/90 text-white font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-xs"
              :disabled="!inputMessage.trim() || sending"
              title="Send message"
            >
              <UIcon v-if="!sending" name="i-lucide-send" class="size-4" />
              <UIcon v-else name="i-lucide-loader-2" class="size-4 animate-spin" />
            </button>
          </form>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@keyframes fadeInSlow {
  0% { opacity: 0; transform: translateY(5px); }
  100% { opacity: 1; transform: translateY(0); }
}
.fade-in-slow {
  animation: fadeInSlow 0.6s ease-out forwards;
}
</style>
