<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    open?: boolean
    modelValue?: boolean
    video?: any | null
    channel?: {
      title?: string
      thumbnail?: string
      subscriberCount?: number
    } | null
    avgViews?: number
  }>(),
  {
    open: false,
    modelValue: false,
    video: null,
    channel: null,
    avgViews: 0
  }
)

const emit = defineEmits<{
  (e: 'update:open' | 'update:modelValue', val: boolean): void
}>()

const isOpen = computed({
  get: () => props.open || props.modelValue,
  set: (val: boolean) => {
    emit('update:open', val)
    emit('update:modelValue', val)
  }
})

const { formatNumber, formatDate } = useFormatters()

interface TitleAlternative {
  title: string
  score: number
  formula: string
}

interface SeoChecklistItem {
  item: string
  passed: boolean
}

interface VideoInsightTabs {
  titleHook: {
    analysis: string
    score: number
    alternativeTitles: TitleAlternative[]
  }
  seoAlgorithm: {
    analysis: string
    seoScore: number
    descriptionSuggestion?: string
    recommendedHashtags: string[]
    suggestedKeywords?: string[]
    checklist?: SeoChecklistItem[]
    searchBrowseFit: string
  }
  contentReview: {
    analysis: string
    hookScore: number
    strengths?: string[]
    retentionLeaks?: string[]
    nextAction?: string
    retentionAdvice?: string
    nextVideoIdea?: string
  }
  overallSummary: string
}

interface VideoInsightData {
  videoId: string
  diagnosis?: string
  tabs?: VideoInsightTabs
  generatedAt: string
}

const activeModalTab = ref<'stats' | 'title' | 'seo' | 'review'>('stats')
const copiedIndex = ref<number | null>(null)
const copiedTag = ref(false)
const aiRemaining = ref<number | null>(null)
const diagnosisLoading = ref(false)
const videoInsights = ref<Record<string, VideoInsightData>>({})

const selectedVideo = computed(() => props.video)

const channelDisplay = computed(() => {
  return {
    title: props.channel?.title || props.video?.channelTitle || 'Creator',
    thumbnail: props.channel?.thumbnail || '',
    subscriberCount: props.channel?.subscriberCount ?? 0
  }
})

const activeAvgViews = computed(() => props.avgViews || 0)

function viewsPerHour(video: any): number {
  if (!video) return 0
  if (typeof video.viewsPerHour === 'number' && video.viewsPerHour > 0) {
    return video.viewsPerHour
  }
  const published = new Date(video.publishedAt).getTime()
  const now = new Date().getTime()
  const hours = Math.max(1, (now - published) / (1000 * 60 * 60))
  return Math.round((video.viewCount || 0) / hours)
}

function performanceMultiplier(viewCount: number) {
  if (!activeAvgViews.value || activeAvgViews.value === 0) return 1
  return viewCount / activeAvgViews.value
}

function engagementRate(video: any) {
  if (!video || !video.viewCount) return 0
  return (((video.likeCount || 0) + (video.commentCount || 0)) / video.viewCount) * 100
}

function copyText(text: string, index?: number) {
  navigator.clipboard.writeText(text)
  if (typeof index === 'number') {
    copiedIndex.value = index
    setTimeout(() => {
      copiedIndex.value = null
    }, 2000)
  }
}

function copyAllTags(tags: string[]) {
  navigator.clipboard.writeText(tags.join(' '))
  copiedTag.value = true
  setTimeout(() => {
    copiedTag.value = false
  }, 2000)
}

async function fetchAiQuota() {
  try {
    const data = await $fetch<{ remaining: number }>('/api/ai-quota')
    aiRemaining.value = data.remaining
  } catch {
    aiRemaining.value = null
  }
}

async function fetchVideoDiagnosis(video: any) {
  if (!video?.id || videoInsights.value[video.id] || diagnosisLoading.value) return

  diagnosisLoading.value = true
  try {
    const res = await $fetch<VideoInsightData>('/api/video-insight', {
      method: 'POST',
      body: {
        videoId: video.id,
        title: video.title,
        publishedAt: video.publishedAt,
        viewCount: video.viewCount,
        likeCount: video.likeCount,
        commentCount: video.commentCount,
        durationSeconds: video.durationSeconds,
        isShort: video.isShort,
        channelTitle: channelDisplay.value.title,
        avgViews: activeAvgViews.value
      }
    })
    videoInsights.value[video.id] = res
    if (aiRemaining.value !== null && aiRemaining.value > 0) {
      aiRemaining.value--
    }
    if (import.meta.client) {
      window.dispatchEvent(new Event('quota-updated'))
    }
  } catch (err: any) {
    const msg = err?.data?.statusMessage || 'Could not generate AI diagnosis for this video right now.'
    videoInsights.value[video.id] = {
      videoId: video.id,
      diagnosis: msg,
      tabs: {
        titleHook: { analysis: msg, alternativeTitles: [], score: 50 },
        seoAlgorithm: { analysis: msg, seoScore: 50, recommendedHashtags: [], suggestedKeywords: [], checklist: [], searchBrowseFit: 'Standard' },
        contentReview: { analysis: msg, hookScore: 50, strengths: [], retentionLeaks: [], nextAction: 'Focus on early audience retention.' },
        overallSummary: msg
      },
      generatedAt: new Date().toISOString()
    }
  } finally {
    diagnosisLoading.value = false
  }
}

watch(isOpen, (newVal) => {
  if (newVal) {
    activeModalTab.value = 'stats'
    fetchAiQuota()
  }
})
</script>

<template>
  <UModal
    v-model:open="isOpen"
    :ui="{ content: 'sm:max-w-4xl sm:w-full' }"
  >
    <template
      v-if="selectedVideo"
      #content
    >
      <div class="flex flex-col h-full max-h-[85vh]">
        <!-- Header (Sticky) -->
        <div class="px-6 pt-6 pb-2 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 sticky top-0 z-10 rounded-t-lg">
          <div class="flex items-start justify-between mb-4">
            <h3 class="text-lg font-bold pr-4 line-clamp-1">
              {{ selectedVideo.title }}
            </h3>
            <UButton
              icon="i-lucide-x"
              color="neutral"
              variant="ghost"
              size="sm"
              class="-mt-1 -mr-2 cursor-pointer"
              @click="isOpen = false"
            />
          </div>

          <!-- Tab Navigation -->
          <div class="flex items-center gap-6 text-sm font-medium overflow-x-auto no-scrollbar">
            <button
              type="button"
              class="relative pb-2.5 flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap"
              :class="activeModalTab === 'stats' ? 'text-primary font-bold' : 'text-muted hover:text-neutral-800 dark:hover:text-neutral-200'"
              @click="activeModalTab = 'stats'"
            >
              <span>Preview</span>
              <span
                v-if="activeModalTab === 'stats'"
                class="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full"
              />
            </button>

            <button
              type="button"
              class="relative pb-2.5 flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap"
              :class="activeModalTab === 'title' ? 'text-primary font-bold' : 'text-muted hover:text-neutral-800 dark:hover:text-neutral-200'"
              @click="activeModalTab = 'title'"
            >
              <span>Title</span>
              <span
                v-if="videoInsights[selectedVideo.id]?.tabs"
                class="text-[11px] font-bold px-1.5 py-0.5 rounded-md"
                :class="(videoInsights[selectedVideo.id]?.tabs?.titleHook.score ?? 0) >= 75 ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : (videoInsights[selectedVideo.id]?.tabs?.titleHook.score ?? 0) >= 50 ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400' : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'"
              >{{ videoInsights[selectedVideo.id]?.tabs?.titleHook.score ?? 0 }}</span>
              <span
                v-if="activeModalTab === 'title'"
                class="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full"
              />
            </button>

            <button
              type="button"
              class="relative pb-2.5 flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap"
              :class="activeModalTab === 'seo' ? 'text-primary font-bold' : 'text-muted hover:text-neutral-800 dark:hover:text-neutral-200'"
              @click="activeModalTab = 'seo'"
            >
              <span>SEO</span>
              <span
                v-if="videoInsights[selectedVideo.id]?.tabs"
                class="text-[11px] font-bold px-1.5 py-0.5 rounded-md"
                :class="(videoInsights[selectedVideo.id]?.tabs?.seoAlgorithm.seoScore ?? 0) >= 75 ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : (videoInsights[selectedVideo.id]?.tabs?.seoAlgorithm.seoScore ?? 0) >= 50 ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400' : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'"
              >{{ videoInsights[selectedVideo.id]?.tabs?.seoAlgorithm.seoScore ?? 0 }}</span>
              <span
                v-if="activeModalTab === 'seo'"
                class="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full"
              />
            </button>

            <button
              type="button"
              class="relative pb-2.5 flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap"
              :class="activeModalTab === 'review' ? 'text-primary font-bold' : 'text-muted hover:text-neutral-800 dark:hover:text-neutral-200'"
              @click="activeModalTab = 'review'"
            >
              <span>Review</span>
              <span
                v-if="videoInsights[selectedVideo.id]?.tabs"
                class="text-[11px] font-bold px-1.5 py-0.5 rounded-md"
                :class="(videoInsights[selectedVideo.id]?.tabs?.contentReview.hookScore ?? 0) >= 75 ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : (videoInsights[selectedVideo.id]?.tabs?.contentReview.hookScore ?? 0) >= 50 ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400' : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'"
              >{{ videoInsights[selectedVideo.id]?.tabs?.contentReview.hookScore ?? 0 }}</span>
              <span
                v-if="activeModalTab === 'review'"
                class="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full"
              />
            </button>
          </div>
        </div>

        <!-- Content Area -->
        <div class="p-6 overflow-y-auto space-y-6 bg-neutral-900 min-h-[500px]">
          <!-- TAB: PREVIEW / STATS -->
          <div
            v-show="activeModalTab === 'stats'"
            class="animate-in fade-in duration-300"
          >
            <!-- LONG FORM SCHEMA -->
            <div
              v-if="!selectedVideo.isShort"
              class="space-y-6"
            >
              <div class="flex flex-col md:flex-row gap-6">
                <!-- Thumbnail (Left) -->
                <div class="md:w-[60%] relative group">
                  <img
                    :src="selectedVideo.thumbnail"
                    :alt="selectedVideo.title"
                    class="w-full aspect-video object-cover rounded-2xl border border-neutral-800 shadow-md"
                  >
                  <a
                    :href="`https://www.youtube.com/watch?v=${selectedVideo.id}`"
                    target="_blank"
                    rel="noopener"
                    class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 rounded-2xl"
                  >
                    <UIcon
                      name="i-simple-icons-youtube"
                      class="size-16 text-rose-500 drop-shadow-lg"
                    />
                  </a>
                </div>

                <!-- 2x2 Metrics Grid (Right) -->
                <div class="md:w-[40%] grid grid-cols-2 gap-4">
                  <div class="bg-neutral-800/40 border border-neutral-800 rounded-2xl p-5 flex flex-col justify-center">
                    <UIcon
                      name="i-lucide-flame"
                      class="size-5 text-neutral-400 mb-3"
                    />
                    <div class="text-2xl font-bold text-white mb-1">
                      {{ performanceMultiplier(selectedVideo.viewCount).toFixed(1) }}x
                    </div>
                    <div class="text-xs text-neutral-400 font-medium">
                      Outlier Score
                    </div>
                  </div>

                  <div class="bg-neutral-800/40 border border-neutral-800 rounded-2xl p-5 flex flex-col justify-center">
                    <UIcon
                      name="i-lucide-eye"
                      class="size-5 text-neutral-400 mb-3"
                    />
                    <div class="text-2xl font-bold text-white mb-1">
                      {{ formatNumber(selectedVideo.viewCount) }}
                    </div>
                    <div class="text-xs text-neutral-400 font-medium">
                      Views
                    </div>
                  </div>

                  <div class="bg-neutral-800/40 border border-neutral-800 rounded-2xl p-5 flex flex-col justify-center">
                    <UIcon
                      name="i-lucide-clock"
                      class="size-5 text-neutral-400 mb-3"
                    />
                    <div class="text-2xl font-bold text-white mb-1">
                      {{ formatNumber(viewsPerHour(selectedVideo)) }}
                    </div>
                    <div class="text-xs text-neutral-400 font-medium">
                      Views per hour
                    </div>
                  </div>

                  <div class="bg-neutral-800/40 border border-neutral-800 rounded-2xl p-5 flex flex-col justify-center">
                    <UIcon
                      :name="engagementRate(selectedVideo) > 4 ? 'i-lucide-thumbs-up' : (engagementRate(selectedVideo) < 2 ? 'i-lucide-thumbs-down' : 'i-lucide-minus')"
                      class="size-5 text-neutral-400 mb-3"
                    />
                    <div class="text-2xl font-bold text-white mb-1">
                      {{ engagementRate(selectedVideo) > 8 ? 'Excellent' : (engagementRate(selectedVideo) > 4 ? 'Good' : (engagementRate(selectedVideo) < 2 ? 'Bad' : 'Average')) }}
                    </div>
                    <div class="text-xs text-neutral-400 font-medium">
                      Engagement
                    </div>
                  </div>
                </div>
              </div>

              <!-- Video Info Below -->
              <div class="space-y-4">
                <h3 class="text-2xl font-bold text-white leading-snug">
                  {{ selectedVideo.title }}
                </h3>

                <div class="text-sm text-neutral-400">
                  {{ Number(selectedVideo.viewCount).toLocaleString() }} views • {{ formatDate(selectedVideo.publishedAt) }}
                </div>

                <div class="flex items-center gap-4 pt-2">
                  <div
                    v-if="!channelDisplay.thumbnail"
                    class="size-10 rounded-full border border-neutral-800 bg-neutral-800 flex items-center justify-center text-primary font-bold text-sm"
                  >
                    {{ channelDisplay.title.slice(0, 2).toUpperCase() }}
                  </div>
                  <img
                    v-else
                    :src="channelDisplay.thumbnail"
                    alt="Channel avatar"
                    class="size-10 rounded-full border border-neutral-800"
                  >
                  <div class="flex-1 flex items-center gap-3 flex-wrap">
                    <span class="font-bold text-white text-base">{{ channelDisplay.title }}</span>
                    <UBadge
                      v-if="channelDisplay.subscriberCount > 0"
                      color="neutral"
                      variant="soft"
                      class="rounded-full bg-neutral-800/50 text-neutral-300 font-medium"
                    >
                      <UIcon
                        name="i-lucide-users"
                        class="size-3.5 mr-1"
                      />
                      {{ formatNumber(channelDisplay.subscriberCount) }} subs
                    </UBadge>
                    <UBadge
                      v-if="activeAvgViews > 0"
                      color="neutral"
                      variant="soft"
                      class="rounded-full bg-neutral-800/50 text-neutral-300 font-medium"
                    >
                      <UIcon
                        name="i-lucide-bar-chart"
                        class="size-3.5 mr-1"
                      />
                      {{ formatNumber(activeAvgViews) }} avg views
                    </UBadge>
                  </div>
                </div>
              </div>
            </div>

            <!-- SHORT FORM SCHEMA -->
            <div
              v-else
              class="flex flex-col md:flex-row gap-8"
            >
              <!-- Left Sidebar: Thumbnail -->
              <div class="md:w-5/12 flex flex-col items-center">
                <div class="w-full max-w-[280px] aspect-[9/16] relative rounded-3xl overflow-hidden border border-neutral-800 shadow-2xl group bg-black">
                  <img
                    :src="selectedVideo.thumbnail"
                    :alt="selectedVideo.title"
                    class="w-full h-full object-cover"
                  >
                  <a
                    :href="`https://www.youtube.com/watch?v=${selectedVideo.id}`"
                    target="_blank"
                    rel="noopener"
                    class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40"
                  >
                    <UIcon
                      name="i-simple-icons-youtube"
                      class="size-16 text-rose-500 drop-shadow-lg"
                    />
                  </a>
                </div>
              </div>

              <!-- Right Content Area -->
              <div class="md:w-7/12 flex flex-col justify-between space-y-6">
                <div class="space-y-4">
                  <h3 class="text-2xl font-bold text-white leading-snug">
                    {{ selectedVideo.title }}
                  </h3>

                  <div class="text-sm text-neutral-400">
                    {{ Number(selectedVideo.viewCount).toLocaleString() }} views • {{ formatDate(selectedVideo.publishedAt) }}
                  </div>

                  <div class="flex items-center gap-3 pt-2">
                    <div
                      v-if="!channelDisplay.thumbnail"
                      class="size-10 rounded-full border border-neutral-800 bg-neutral-800 flex items-center justify-center text-primary font-bold text-sm"
                    >
                      {{ channelDisplay.title.slice(0, 2).toUpperCase() }}
                    </div>
                    <img
                      v-else
                      :src="channelDisplay.thumbnail"
                      alt="Channel avatar"
                      class="size-10 rounded-full border border-neutral-800"
                    >
                    <div class="flex items-center gap-3 flex-wrap">
                      <span class="font-bold text-white text-base">{{ channelDisplay.title }}</span>
                      <UBadge
                        v-if="channelDisplay.subscriberCount > 0"
                        color="neutral"
                        variant="soft"
                        class="rounded-full bg-neutral-800/50 text-neutral-300 font-medium"
                      >
                        <UIcon
                          name="i-lucide-users"
                          class="size-3.5 mr-1"
                        />
                        {{ formatNumber(channelDisplay.subscriberCount) }} subs
                      </UBadge>
                    </div>
                  </div>
                </div>

                <!-- Metrics Grid for Shorts -->
                <div class="grid grid-cols-2 gap-4">
                  <div class="bg-neutral-800/40 border border-neutral-800 rounded-2xl p-5 flex flex-col justify-center">
                    <UIcon
                      name="i-lucide-flame"
                      class="size-5 text-neutral-400 mb-3"
                    />
                    <div class="text-2xl font-bold text-white mb-1">
                      {{ performanceMultiplier(selectedVideo.viewCount).toFixed(1) }}x
                    </div>
                    <div class="text-xs text-neutral-400 font-medium">
                      Outlier Score
                    </div>
                  </div>

                  <div class="bg-neutral-800/40 border border-neutral-800 rounded-2xl p-5 flex flex-col justify-center">
                    <UIcon
                      name="i-lucide-eye"
                      class="size-5 text-neutral-400 mb-3"
                    />
                    <div class="text-2xl font-bold text-white mb-1">
                      {{ formatNumber(selectedVideo.viewCount) }}
                    </div>
                    <div class="text-xs text-neutral-400 font-medium">
                      Views
                    </div>
                  </div>

                  <div class="bg-neutral-800/40 border border-neutral-800 rounded-2xl p-5 flex flex-col justify-center">
                    <UIcon
                      name="i-lucide-clock"
                      class="size-5 text-neutral-400 mb-3"
                    />
                    <div class="text-2xl font-bold text-white mb-1">
                      {{ formatNumber(viewsPerHour(selectedVideo)) }}
                    </div>
                    <div class="text-xs text-neutral-400 font-medium">
                      Views per hour
                    </div>
                  </div>

                  <div class="bg-neutral-800/40 border border-neutral-800 rounded-2xl p-5 flex flex-col justify-center">
                    <UIcon
                      :name="engagementRate(selectedVideo) > 4 ? 'i-lucide-thumbs-up' : (engagementRate(selectedVideo) < 2 ? 'i-lucide-thumbs-down' : 'i-lucide-minus')"
                      class="size-5 text-neutral-400 mb-3"
                    />
                    <div class="text-2xl font-bold text-white mb-1">
                      {{ engagementRate(selectedVideo) > 8 ? 'Excellent' : (engagementRate(selectedVideo) > 4 ? 'Good' : (engagementRate(selectedVideo) < 2 ? 'Bad' : 'Average')) }}
                    </div>
                    <div class="text-xs text-neutral-400 font-medium">
                      Engagement
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- COMMON TABS AI CONTAINER -->
          <div
            v-show="activeModalTab !== 'stats'"
            class="animate-in fade-in duration-300"
          >
            <!-- Call to Action state if not fetched -->
            <div
              v-if="!videoInsights[selectedVideo.id] && !diagnosisLoading"
              class="flex flex-col items-center justify-center gap-4 py-16 text-center"
            >
              <div class="size-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-2">
                <UIcon
                  name="i-lucide-sparkles"
                  class="size-6"
                />
              </div>
              <h4 class="text-lg font-bold text-white">
                Unlock Deep AI Video Diagnosis
              </h4>
              <p class="text-sm text-neutral-400 max-w-md">
                Generate tailored title formulas, algorithm alignment scoring, retention leaks analysis, and SEO tags.
              </p>

              <div
                class="flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-full border mb-2"
                :class="aiRemaining !== null && aiRemaining <= 5 ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-primary/20 text-primary border-primary/30'"
              >
                <UIcon
                  name="i-lucide-coins"
                  class="size-4"
                />
                <span>Costs 1 AI Credit ({{ aiRemaining ?? '...' }} remaining)</span>
              </div>

              <UButton
                label="Diagnose Video"
                icon="i-lucide-sparkles"
                size="md"
                color="primary"
                class="cursor-pointer"
                @click="fetchVideoDiagnosis(selectedVideo)"
              />
            </div>

            <!-- Loading State -->
            <div
              v-if="diagnosisLoading && !videoInsights[selectedVideo.id]"
              class="flex flex-col items-center justify-center gap-4 py-20 text-center"
            >
              <UIcon
                name="i-lucide-loader-2"
                class="size-8 animate-spin text-primary mb-2"
              />
              <h4 class="text-base font-bold text-white">
                Analyzing...
              </h4>
              <p class="text-sm text-neutral-400 animate-pulse">
                Evaluating hooks, SEO, and algorithms with Gemini AI
              </p>
              <div class="w-full max-w-sm mt-4 space-y-3">
                <USkeleton class="h-16 w-full rounded-xl bg-neutral-800" />
                <USkeleton class="h-16 w-full rounded-xl bg-neutral-800" />
              </div>
            </div>

            <!-- Content when generated -->
            <div
              v-if="videoInsights[selectedVideo.id]?.tabs"
              class="space-y-6"
            >
              <!-- TAB 2: TITLE -->
              <div
                v-if="activeModalTab === 'title'"
                class="flex flex-col md:flex-row gap-8"
              >
                <!-- Psychological Hook Score (Left) -->
                <div class="md:w-1/3 flex flex-col gap-4">
                  <div class="p-6 rounded-2xl bg-neutral-800/40 border border-neutral-800 flex flex-col items-center justify-center text-center">
                    <div
                      class="text-5xl font-black mb-2"
                      :class="(videoInsights[selectedVideo.id]?.tabs?.titleHook.score ?? 0) >= 75 ? 'text-emerald-400' : 'text-amber-400'"
                    >
                      {{ videoInsights[selectedVideo.id]?.tabs?.titleHook.score ?? 0 }}
                    </div>
                    <div class="text-sm text-neutral-400 uppercase tracking-wider font-semibold">
                      Hook Score
                    </div>
                  </div>

                  <div class="p-5 rounded-2xl bg-neutral-800/30 border border-neutral-800 space-y-2">
                    <h5 class="text-xs font-bold text-white uppercase tracking-wider">
                      Psychological Breakdown
                    </h5>
                    <p class="text-sm text-neutral-300 leading-relaxed">
                      {{ videoInsights[selectedVideo.id]?.tabs?.titleHook.analysis }}
                    </p>
                  </div>
                </div>

                <!-- High-CTR Title Formulas (Right) -->
                <div class="md:w-2/3 space-y-4">
                  <h3 class="text-lg font-bold text-white mb-4">
                    High-CTR Title Alternatives
                  </h3>

                  <div class="space-y-3">
                    <div
                      v-for="(alt, i) in videoInsights[selectedVideo.id]?.tabs?.titleHook.alternativeTitles"
                      :key="i"
                      class="p-4 rounded-2xl bg-neutral-800/40 border border-neutral-800 flex items-center justify-between gap-4 group hover:border-neutral-700 transition-colors"
                    >
                      <div class="space-y-1">
                        <div class="flex items-center gap-2">
                          <UBadge
                            color="neutral"
                            variant="subtle"
                            class="rounded-full text-[10px] bg-neutral-800 text-neutral-400"
                          >
                            {{ alt.formula }}
                          </UBadge>
                          <span class="text-xs text-emerald-400 font-semibold">{{ alt.score }} CTR</span>
                        </div>
                        <div class="text-base text-white font-medium">
                          {{ alt.title }}
                        </div>
                      </div>

                      <UButton
                        :icon="copiedIndex === i ? 'i-lucide-check' : 'i-lucide-copy'"
                        color="neutral"
                        variant="ghost"
                        size="sm"
                        class="opacity-70 group-hover:opacity-100 transition-opacity cursor-pointer"
                        @click="copyText(alt.title, i)"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <!-- TAB 3: SEO -->
              <div
                v-else-if="activeModalTab === 'seo'"
                class="flex flex-col md:flex-row gap-8"
              >
                <!-- Left Column: SEO Score -->
                <div class="md:w-1/3 flex flex-col gap-4">
                  <div class="p-6 rounded-2xl bg-neutral-800/40 border border-neutral-800 flex flex-col items-center justify-center text-center">
                    <div
                      class="text-5xl font-black mb-2"
                      :class="(videoInsights[selectedVideo.id]?.tabs?.seoAlgorithm.seoScore ?? 0) >= 75 ? 'text-emerald-400' : 'text-amber-400'"
                    >
                      {{ videoInsights[selectedVideo.id]?.tabs?.seoAlgorithm.seoScore ?? 0 }}
                    </div>
                    <div class="text-sm text-neutral-400 uppercase tracking-wider font-semibold">
                      SEO Score
                    </div>
                  </div>

                  <div class="p-5 rounded-2xl bg-neutral-800/30 border border-neutral-800 space-y-2">
                    <h5 class="text-xs font-bold text-white uppercase tracking-wider">
                      Search & Browse Intent
                    </h5>
                    <div class="text-sm font-semibold text-primary">
                      {{ videoInsights[selectedVideo.id]?.tabs?.seoAlgorithm.searchBrowseFit }}
                    </div>
                    <p class="text-xs text-neutral-400 leading-relaxed pt-1">
                      {{ videoInsights[selectedVideo.id]?.tabs?.seoAlgorithm.analysis }}
                    </p>
                  </div>
                </div>

                <!-- Right Column: Keywords, Description & Checklist -->
                <div class="md:w-2/3 space-y-6">
                  <!-- Suggested Keywords -->
                  <div
                    v-if="videoInsights[selectedVideo.id]?.tabs?.seoAlgorithm.suggestedKeywords?.length"
                    class="space-y-3"
                  >
                    <h4 class="text-sm font-bold text-white uppercase tracking-wider">
                      Suggested Keywords
                    </h4>
                    <div class="flex flex-wrap gap-2">
                      <span
                        v-for="(kw, k) in videoInsights[selectedVideo.id]?.tabs?.seoAlgorithm.suggestedKeywords"
                        :key="k"
                        class="px-3 py-1 bg-neutral-800/60 border border-neutral-700/60 rounded-full text-xs text-neutral-200"
                      >
                        {{ kw }}
                      </span>
                    </div>
                  </div>

                  <!-- Description Suggestion -->
                  <div
                    v-if="videoInsights[selectedVideo.id]?.tabs?.seoAlgorithm.descriptionSuggestion"
                    class="space-y-2"
                  >
                    <div class="flex items-center justify-between">
                      <h4 class="text-sm font-bold text-white uppercase tracking-wider">
                        Optimized Description
                      </h4>
                      <UButton
                        :icon="copiedIndex === 99 ? 'i-lucide-check' : 'i-lucide-copy'"
                        label="Copy"
                        color="neutral"
                        variant="ghost"
                        size="xs"
                        class="cursor-pointer"
                        @click="copyText(videoInsights[selectedVideo.id]?.tabs?.seoAlgorithm.descriptionSuggestion || '', 99)"
                      />
                    </div>
                    <div class="p-4 rounded-xl bg-neutral-800/30 border border-neutral-800 text-xs text-neutral-300 font-mono whitespace-pre-wrap leading-relaxed">
                      {{ videoInsights[selectedVideo.id]?.tabs?.seoAlgorithm.descriptionSuggestion }}
                    </div>
                  </div>

                  <!-- Hashtags -->
                  <div
                    v-if="videoInsights[selectedVideo.id]?.tabs?.seoAlgorithm.recommendedHashtags?.length"
                    class="space-y-2"
                  >
                    <div class="flex items-center justify-between">
                      <h4 class="text-sm font-bold text-white uppercase tracking-wider">
                        Recommended Hashtags
                      </h4>
                      <UButton
                        :icon="copiedTag ? 'i-lucide-check' : 'i-lucide-copy'"
                        label="Copy All"
                        color="neutral"
                        variant="ghost"
                        size="xs"
                        class="cursor-pointer"
                        @click="copyAllTags(videoInsights[selectedVideo.id]?.tabs?.seoAlgorithm.recommendedHashtags || [])"
                      />
                    </div>
                    <div class="flex flex-wrap gap-2">
                      <span
                        v-for="(tag, t) in videoInsights[selectedVideo.id]?.tabs?.seoAlgorithm.recommendedHashtags"
                        :key="t"
                        class="text-xs text-primary font-medium bg-primary/10 px-2.5 py-1 rounded-md"
                      >
                        {{ tag }}
                      </span>
                    </div>
                  </div>

                  <!-- Checklist -->
                  <div
                    v-if="videoInsights[selectedVideo.id]?.tabs?.seoAlgorithm.checklist?.length"
                    class="space-y-3 pt-2"
                  >
                    <h4 class="text-sm font-bold text-white uppercase tracking-wider">
                      SEO Optimization Checklist
                    </h4>
                    <div class="space-y-2">
                      <div
                        v-for="(item, idx) in videoInsights[selectedVideo.id]?.tabs?.seoAlgorithm.checklist"
                        :key="idx"
                        class="flex items-center gap-3 p-3 rounded-xl bg-neutral-800/20 border border-neutral-800 text-xs"
                      >
                        <UIcon
                          :name="item.passed ? 'i-lucide-check-circle-2' : 'i-lucide-x-circle'"
                          class="size-4 shrink-0"
                          :class="item.passed ? 'text-emerald-400' : 'text-neutral-500'"
                        />
                        <span :class="item.passed ? 'text-neutral-200' : 'text-neutral-400'">{{ item.item }}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- TAB 4: REVIEW -->
              <div
                v-else-if="activeModalTab === 'review'"
                class="flex flex-col md:flex-row gap-8"
              >
                <!-- Retention Hook Score (Left) -->
                <div class="md:w-1/3 flex flex-col gap-4">
                  <div class="p-6 rounded-2xl bg-neutral-800/40 border border-neutral-800 flex flex-col items-center justify-center text-center">
                    <div
                      class="text-5xl font-black mb-2"
                      :class="(videoInsights[selectedVideo.id]?.tabs?.contentReview.hookScore ?? 0) >= 75 ? 'text-emerald-400' : 'text-amber-400'"
                    >
                      {{ videoInsights[selectedVideo.id]?.tabs?.contentReview.hookScore ?? 0 }}
                    </div>
                    <div class="text-sm text-neutral-400 uppercase tracking-wider font-semibold">
                      Retention Score
                    </div>
                  </div>

                  <div class="p-5 rounded-2xl bg-neutral-800/30 border border-neutral-800 space-y-2">
                    <h5 class="text-xs font-bold text-white uppercase tracking-wider">
                      Content Assessment
                    </h5>
                    <p class="text-sm text-neutral-300 leading-relaxed">
                      {{ videoInsights[selectedVideo.id]?.tabs?.contentReview.analysis }}
                    </p>
                  </div>
                </div>

                <!-- Feedback Section (Right) -->
                <div class="md:w-2/3 space-y-4">
                  <h3 class="text-lg font-bold text-white mb-4">
                    Pacing & Retention Feedback
                  </h3>

                  <div
                    v-if="videoInsights[selectedVideo.id]?.tabs?.contentReview.strengths?.length"
                    class="p-5 rounded-2xl bg-neutral-800/30 border border-neutral-800"
                  >
                    <div class="flex items-center justify-between mb-2">
                      <h4 class="font-bold text-white text-base">
                        Strengths
                      </h4>
                      <div class="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded-md">
                        <div class="size-2 rounded-full bg-emerald-400" /> Good
                      </div>
                    </div>
                    <ul class="space-y-2 text-sm text-neutral-400 list-disc pl-5">
                      <li
                        v-for="(st, i) in videoInsights[selectedVideo.id]?.tabs?.contentReview.strengths"
                        :key="i"
                      >
                        {{ st }}
                      </li>
                    </ul>
                  </div>

                  <div
                    v-if="videoInsights[selectedVideo.id]?.tabs?.contentReview.retentionLeaks?.length"
                    class="p-5 rounded-2xl bg-neutral-800/30 border border-neutral-800"
                  >
                    <div class="flex items-center justify-between mb-2">
                      <h4 class="font-bold text-white text-base">
                        Retention Leaks
                      </h4>
                      <div class="flex items-center gap-2 text-xs text-rose-400 bg-rose-400/10 px-2 py-1 rounded-md">
                        <div class="size-2 rounded-full bg-rose-400" /> Drop-off
                      </div>
                    </div>
                    <ul class="space-y-2 text-sm text-neutral-400 list-disc pl-5">
                      <li
                        v-for="(leak, i) in videoInsights[selectedVideo.id]?.tabs?.contentReview.retentionLeaks"
                        :key="i"
                      >
                        {{ leak }}
                      </li>
                    </ul>
                  </div>

                  <div
                    v-if="videoInsights[selectedVideo.id]?.tabs?.contentReview.nextAction"
                    class="p-5 rounded-2xl bg-neutral-800/30 border border-neutral-800"
                  >
                    <div class="flex items-center justify-between mb-2">
                      <h4 class="font-bold text-white text-base">
                        Next Action
                      </h4>
                      <UIcon
                        name="i-lucide-rocket"
                        class="size-4 text-primary"
                      />
                    </div>
                    <p class="text-sm text-neutral-400 leading-relaxed">
                      {{ videoInsights[selectedVideo.id]?.tabs?.contentReview.nextAction }}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </UModal>
</template>
