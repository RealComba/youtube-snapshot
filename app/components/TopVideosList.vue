<script setup lang="ts">
const store = useChannelStore()
const { formatNumber, formatDate, formatDuration } = useFormatters()

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
    recommendedTags: string[]
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

const sortBy = ref<'date' | 'views' | 'likes' | 'engagement'>('date')
const filterType = ref<'all' | 'outlier' | 'short' | 'long'>('all')

const selectedVideo = ref<typeof store.videos[number] | null>(null)
const modalOpen = ref(false)
const activeModalTab = ref<'title' | 'seo' | 'review'>('title')
const copiedIndex = ref<number | null>(null)
const copiedTag = ref<string | null>(null)
const aiRemaining = ref<number | null>(null)

// Cache of AI diagnoses per videoId
const videoInsights = ref<Record<string, VideoInsightData>>({})
const diagnosisLoading = ref(false)

async function fetchAiQuota() {
  try {
    const data = await $fetch<{ remaining: number }>('/api/ai-quota')
    aiRemaining.value = data.remaining
  } catch {
    aiRemaining.value = null
  }
}

function openVideo(video: typeof store.videos[number]) {
  selectedVideo.value = video
  activeModalTab.value = 'title'
  modalOpen.value = true
  fetchAiQuota()
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

function copyTag(tag: string) {
  navigator.clipboard.writeText(tag.startsWith('#') ? tag : `#${tag}`)
  copiedTag.value = tag
  setTimeout(() => {
    copiedTag.value = null
  }, 2000)
}

function engagementRate(video: { viewCount: number, likeCount: number, commentCount: number }) {
  if (video.viewCount === 0) return 0
  return ((video.likeCount + video.commentCount) / video.viewCount) * 100
}

function performanceMultiplier(viewCount: number) {
  if (store.avgViews === 0) return 0
  return viewCount / store.avgViews
}

function getSeoHealth(video: typeof store.videos[number]) {
  let score = 50
  const len = video.title.length
  if (len >= 40 && len <= 70) score += 20
  else if (len >= 25 && len < 90) score += 10
  else score -= 10

  const mult = performanceMultiplier(video.viewCount)
  if (mult >= 1.5) score += 20
  else if (mult >= 1.0) score += 10

  const eng = engagementRate(video)
  if (eng >= 4) score += 10
  else if (eng >= 2) score += 5

  const bounded = Math.max(25, Math.min(98, score))
  if (bounded >= 75) {
    return {
      score: bounded,
      label: 'Good',
      color: 'emerald',
      badgeClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
      dotClass: 'bg-emerald-500'
    }
  }
  if (bounded >= 50) {
    return {
      score: bounded,
      label: 'Fair',
      color: 'amber',
      badgeClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
      dotClass: 'bg-amber-500'
    }
  }
  return {
    score: bounded,
    label: 'Low',
    color: 'rose',
    badgeClass: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
    dotClass: 'bg-rose-500'
  }
}

async function fetchVideoDiagnosis(video: typeof store.videos[number]) {
  if (videoInsights.value[video.id] || diagnosisLoading.value) return

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
        channelTitle: store.channel?.title,
        avgViews: store.avgViews
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
        seoAlgorithm: { analysis: msg, seoScore: 50, recommendedTags: [], searchBrowseFit: 'Standard' },
        contentReview: { analysis: msg, hookScore: 50, strengths: [], retentionLeaks: [], nextAction: 'Focus on early audience retention.' },
        overallSummary: msg
      },
      generatedAt: new Date().toISOString()
    }
  } finally {
    diagnosisLoading.value = false
  }
}

const filteredVideos = computed(() => {
  let result = [...store.videos]

  if (filterType.value === 'outlier') result = result.filter(v => performanceMultiplier(v.viewCount) >= 1.5)
  if (filterType.value === 'short') result = result.filter(v => v.isShort)
  if (filterType.value === 'long') result = result.filter(v => !v.isShort)

  switch (sortBy.value) {
    case 'views':
      result.sort((a, b) => b.viewCount - a.viewCount)
      break
    case 'likes':
      result.sort((a, b) => b.likeCount - a.likeCount)
      break
    case 'engagement':
      result.sort((a, b) => engagementRate(b) - engagementRate(a))
      break
    case 'date':
    default:
      result.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
  }

  return result
})

const sortOptions = [
  { label: 'Most Recent', value: 'date' },
  { label: 'Most Viewed', value: 'views' },
  { label: 'Most Liked', value: 'likes' },
  { label: 'Highest Engagement', value: 'engagement' }
]

const filterOptions = [
  { label: 'All Formats', value: 'all' },
  { label: 'Outliers (>1.5x)', value: 'outlier' },
  { label: 'Shorts Only', value: 'short' },
  { label: 'Long-form Only', value: 'long' }
]
</script>

<template>
  <div v-if="store.videos.length > 0">
    <!-- Header with controls -->
    <div class="flex items-center justify-between mb-4 flex-wrap gap-3">
      <div class="flex items-center gap-2">
        <h3 class="text-lg font-semibold">
          Recent Uploads
        </h3>
        <UBadge :label="`${filteredVideos.length} videos`" color="neutral" variant="subtle" size="xs" />
      </div>

      <div class="flex items-center gap-2">
        <USelect v-model="filterType" :items="filterOptions" size="sm" />
        <USelect v-model="sortBy" :items="sortOptions" size="sm" />
      </div>
    </div>

    <!-- Video Grid -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <div
        v-for="video in filteredVideos"
        :key="video.id"
        class="cursor-pointer"
        @click="openVideo(video)"
      >
        <UCard class="overflow-hidden hover:ring-2 hover:ring-primary transition-all">
          <div class="relative">
            <img :src="video.thumbnail" :alt="video.title" class="w-full aspect-video object-cover rounded-md">
            <UBadge :label="formatDuration(video.durationSeconds)" color="neutral" variant="solid"
              class="absolute bottom-2 right-2" />
            <UBadge v-if="video.isShort" label="Short" color="error" variant="solid"
              class="absolute top-2 left-2" />
            <div
              v-if="performanceMultiplier(video.viewCount) >= 1.5"
              class="absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500 text-white shadow-xs"
            >
              <UIcon name="i-lucide-flame" class="size-3" />
              <span>{{ performanceMultiplier(video.viewCount).toFixed(1) }}x avg</span>
            </div>
          </div>

          <h4 class="font-medium mt-3 line-clamp-2">
            {{ video.title }}
          </h4>
          <p class="text-xs text-muted mt-1">
            {{ formatDate(video.publishedAt) }}
          </p>

          <div class="flex items-center gap-3 mt-3 text-sm text-muted">
            <span class="flex items-center gap-1">
              <UIcon name="i-lucide-eye" class="size-4" />
              {{ formatNumber(video.viewCount) }}
            </span>
            <span class="flex items-center gap-1">
              <UIcon name="i-lucide-thumbs-up" class="size-4" />
              {{ formatNumber(video.likeCount) }}
            </span>
            <span class="flex items-center gap-1">
              <UIcon name="i-lucide-message-circle" class="size-4" />
              {{ formatNumber(video.commentCount) }}
            </span>
          </div>

          <!-- Card Footer with SEO Health Semaphore & ER -->
          <div class="flex items-center justify-between mt-3 pt-2.5 border-t border-neutral-100 dark:border-neutral-800 text-xs">
            <div
              class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold border"
              :class="getSeoHealth(video).badgeClass"
              :title="`SEO Health Score: ${getSeoHealth(video).score}/100`"
            >
              <span class="size-1.5 rounded-full" :class="getSeoHealth(video).dotClass" />
              <span>SEO {{ getSeoHealth(video).score }}</span>
            </div>

            <span class="text-muted text-[11px] font-medium">
              {{ engagementRate(video).toFixed(2) }}% ER
            </span>
          </div>
        </UCard>
      </div>
    </div>

    <p v-if="filteredVideos.length === 0" class="text-sm text-muted text-center py-8">
      No videos found matching this filter.
    </p>

    <!-- Video Detail Modal with Overflow Fix & 3-Tab Analysis -->
    <UModal v-model:open="modalOpen">
      <template v-if="selectedVideo" #content>
        <div class="p-6 space-y-4 max-h-[85vh] overflow-y-auto pr-1">
          <!-- Header with close button -->
          <div class="flex items-start justify-between">
            <h3 class="text-lg font-bold pr-4">
              {{ selectedVideo.title }}
            </h3>
            <UButton icon="i-lucide-x" color="neutral" variant="ghost" size="sm" @click="modalOpen = false" />
          </div>

          <!-- Thumbnail -->
          <img :src="selectedVideo.thumbnail" :alt="selectedVideo.title"
            class="w-full aspect-video object-cover rounded-lg" />

          <!-- Date & Format Badge -->
          <div class="flex items-center gap-2 text-sm text-muted">
            <span>{{ formatDate(selectedVideo.publishedAt) }}</span>
            <UBadge v-if="selectedVideo.isShort" label="Short" color="error" size="xs" />
            <UBadge v-else label="Long-form" color="neutral" size="xs" />
            <span>• {{ formatDuration(selectedVideo.durationSeconds) }}</span>
          </div>

          <!-- Core Metrics -->
          <div class="grid grid-cols-3 gap-4 text-center rounded-lg border border-neutral-200 dark:border-neutral-800 p-4">
            <div>
              <p class="text-xl font-bold text-primary">{{ formatNumber(selectedVideo.viewCount) }}</p>
              <p class="text-xs text-muted">Views</p>
            </div>
            <div>
              <p class="text-xl font-bold text-primary">{{ formatNumber(selectedVideo.likeCount) }}</p>
              <p class="text-xs text-muted">Likes</p>
            </div>
            <div>
              <p class="text-xl font-bold text-primary">{{ formatNumber(selectedVideo.commentCount) }}</p>
              <p class="text-xs text-muted">Comments</p>
            </div>
          </div>

          <!-- Benchmark & Engagement -->
          <div class="grid grid-cols-2 gap-4 text-center rounded-lg border border-neutral-200 dark:border-neutral-800 p-4">
            <div>
              <p class="text-lg font-semibold" :class="performanceMultiplier(selectedVideo.viewCount) >= 1.5 ? 'text-primary' : ''">
                {{ performanceMultiplier(selectedVideo.viewCount).toFixed(1) }}x
              </p>
              <p class="text-xs text-muted">vs Channel Average</p>
            </div>
            <div>
              <p class="text-lg font-semibold">
                {{ engagementRate(selectedVideo).toFixed(2) }}%
              </p>
              <p class="text-xs text-muted">Engagement Rate</p>
            </div>
          </div>

          <!-- AI Viral Diagnosis 3-Tab Section -->
          <div class="rounded-xl border border-neutral-200 dark:border-neutral-800 p-4 space-y-4 bg-neutral-50/50 dark:bg-neutral-900/50">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <UIcon name="i-lucide-sparkles" class="size-4 text-primary" />
                <h4 class="text-sm font-bold">AI Strategy Breakdown</h4>
                <UBadge v-if="videoInsights[selectedVideo.id]?.tabs" label="1 AI Credit" size="xs" color="primary" variant="subtle" />
              </div>
              <UButton
                v-if="!videoInsights[selectedVideo.id]"
                label="Diagnose Video"
                icon="i-lucide-sparkles"
                size="xs"
                color="primary"
                :loading="diagnosisLoading"
                @click="fetchVideoDiagnosis(selectedVideo)"
              />
            </div>

            <!-- Loading State -->
            <div v-if="diagnosisLoading && !videoInsights[selectedVideo.id]" class="space-y-2 py-2">
              <span class="text-xs text-muted flex items-center gap-2 animate-pulse">
                <UIcon name="i-lucide-loader-2" class="size-3.5 animate-spin text-primary" />
                <span>Analyzing title hooks, SEO keywords, and retention pacing...</span>
              </span>
              <USkeleton class="h-24 w-full rounded-lg" />
            </div>

            <!-- 3-Tab Diagnosis Result -->
            <div v-else-if="videoInsights[selectedVideo.id]?.tabs" class="space-y-3">
              <!-- Tab Navigation Buttons -->
              <div class="flex items-center gap-1.5 p-1 bg-neutral-200/60 dark:bg-neutral-800/80 rounded-lg text-xs font-medium">
                <button
                  type="button"
                  class="flex-1 py-1.5 px-2 rounded-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  :class="activeModalTab === 'title' ? 'bg-white dark:bg-neutral-900 text-primary font-bold shadow-xs' : 'text-muted hover:text-neutral-900 dark:hover:text-white'"
                  @click="activeModalTab = 'title'"
                >
                  <UIcon name="i-lucide-heading" class="size-3.5" />
                  <span>Title & Hook</span>
                </button>

                <button
                  type="button"
                  class="flex-1 py-1.5 px-2 rounded-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  :class="activeModalTab === 'seo' ? 'bg-white dark:bg-neutral-900 text-primary font-bold shadow-xs' : 'text-muted hover:text-neutral-900 dark:hover:text-white'"
                  @click="activeModalTab = 'seo'"
                >
                  <UIcon name="i-lucide-search" class="size-3.5" />
                  <span>SEO & Algo</span>
                </button>

                <button
                  type="button"
                  class="flex-1 py-1.5 px-2 rounded-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  :class="activeModalTab === 'review' ? 'bg-white dark:bg-neutral-900 text-primary font-bold shadow-xs' : 'text-muted hover:text-neutral-900 dark:hover:text-white'"
                  @click="activeModalTab = 'review'"
                >
                  <UIcon name="i-lucide-play-circle" class="size-3.5" />
                  <span>Content Review</span>
                </button>
              </div>

              <!-- Tab 1: Title Hook -->
              <div v-if="activeModalTab === 'title'" class="space-y-4 bg-white dark:bg-neutral-900 p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 text-xs">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-1.5 font-bold text-neutral-800 dark:text-neutral-200">
                    <UIcon name="i-lucide-sparkles" class="size-4 text-primary" />
                    <span>Title Hook & Psychological Angle</span>
                  </div>
                  <UBadge :label="`Hook Score: ${videoInsights[selectedVideo.id]?.tabs?.titleHook.score ?? 85}/100`" color="primary" variant="subtle" size="xs" />
                </div>

                <p class="text-neutral-700 dark:text-neutral-300 leading-relaxed">
                  {{ videoInsights[selectedVideo.id]?.tabs?.titleHook.analysis }}
                </p>

                <div v-if="videoInsights[selectedVideo.id]?.tabs?.titleHook.alternativeTitles?.length" class="space-y-2.5 pt-2 border-t border-neutral-100 dark:border-neutral-800">
                  <span class="text-[11px] font-bold uppercase tracking-wider text-muted flex items-center gap-1">
                    <UIcon name="i-lucide-zap" class="size-3.5 text-primary" />
                    High-CTR Alternative Formulas:
                  </span>

                  <div class="space-y-2">
                    <div
                      v-for="(alt, idx) in videoInsights[selectedVideo.id]?.tabs?.titleHook.alternativeTitles"
                      :key="idx"
                      class="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200/80 dark:border-neutral-700/80 space-y-2 hover:border-primary/40 transition-colors"
                    >
                      <div class="flex items-center justify-between gap-2">
                        <UBadge :label="alt.formula || 'High Stakes'" color="primary" variant="subtle" size="xs" />
                        <div class="flex items-center gap-2">
                          <span class="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">Score {{ alt.score }}/100</span>
                          <UButton
                            :label="copiedIndex === idx ? 'Copied' : 'Copy Title'"
                            :icon="copiedIndex === idx ? 'i-lucide-check' : 'i-lucide-copy'"
                            size="xs"
                            color="neutral"
                            variant="soft"
                            @click="copyText(alt.title, idx)"
                          />
                        </div>
                      </div>
                      <p class="font-medium text-sm text-neutral-900 dark:text-neutral-100 leading-snug">
                        {{ alt.title }}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Tab 2: SEO & Algo -->
              <div v-else-if="activeModalTab === 'seo'" class="space-y-4 bg-white dark:bg-neutral-900 p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 text-xs">
                <!-- Global SEO Score Semaphore Bar -->
                <div class="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200/80 dark:border-neutral-700/80 space-y-2">
                  <div class="flex items-center justify-between">
                    <span class="font-bold text-neutral-800 dark:text-neutral-200">Global SEO & Indexing Health</span>
                    <span
                      class="text-xs font-bold px-2 py-0.5 rounded-full"
                      :class="(videoInsights[selectedVideo.id]?.tabs?.seoAlgorithm.seoScore ?? 80) >= 75
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                        : (videoInsights[selectedVideo.id]?.tabs?.seoAlgorithm.seoScore ?? 80) >= 50
                          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                          : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'"
                    >
                      Score {{ videoInsights[selectedVideo.id]?.tabs?.seoAlgorithm.seoScore ?? 80 }}/100
                    </span>
                  </div>
                  <!-- Semaphore progress bar -->
                  <div class="h-2 w-full rounded-full bg-neutral-200 dark:bg-neutral-700 overflow-hidden">
                    <div
                      class="h-full rounded-full transition-all duration-500"
                      :class="(videoInsights[selectedVideo.id]?.tabs?.seoAlgorithm.seoScore ?? 80) >= 75
                        ? 'bg-emerald-500'
                        : (videoInsights[selectedVideo.id]?.tabs?.seoAlgorithm.seoScore ?? 80) >= 50
                          ? 'bg-amber-500'
                          : 'bg-rose-500'"
                      :style="{ width: `${videoInsights[selectedVideo.id]?.tabs?.seoAlgorithm.seoScore ?? 80}%` }"
                    />
                  </div>
                </div>

                <div class="flex items-center justify-between">
                  <span class="font-semibold text-neutral-800 dark:text-neutral-200">Algorithmic Distribution</span>
                  <UBadge :label="videoInsights[selectedVideo.id]?.tabs?.seoAlgorithm.searchBrowseFit || 'Browse Feature Driven'" color="neutral" variant="subtle" size="xs" />
                </div>

                <p class="text-neutral-700 dark:text-neutral-300 leading-relaxed">
                  {{ videoInsights[selectedVideo.id]?.tabs?.seoAlgorithm.analysis }}
                </p>

                <!-- Recommended Hashtags (Click to copy) -->
                <div v-if="videoInsights[selectedVideo.id]?.tabs?.seoAlgorithm.recommendedTags?.length" class="space-y-1.5 pt-2 border-t border-neutral-100 dark:border-neutral-800">
                  <span class="text-[11px] font-bold text-muted flex items-center gap-1">
                    <UIcon name="i-lucide-hash" class="size-3.5 text-primary" />
                    Recommended Hashtags (Click to copy):
                  </span>
                  <div class="flex flex-wrap gap-1.5">
                    <button
                      v-for="tag in videoInsights[selectedVideo.id]?.tabs?.seoAlgorithm.recommendedTags"
                      :key="tag"
                      type="button"
                      class="px-2.5 py-1 rounded-md text-[11px] font-mono cursor-pointer transition-all border flex items-center gap-1"
                      :class="copiedTag === tag
                        ? 'bg-emerald-500 text-white border-emerald-500'
                        : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700 hover:border-primary/50'"
                      @click="copyTag(tag)"
                    >
                      <span>#{{ tag.replace(/^#/, '') }}</span>
                      <UIcon :name="copiedTag === tag ? 'i-lucide-check' : 'i-lucide-copy'" class="size-2.5 opacity-70" />
                    </button>
                  </div>
                </div>

                <!-- Suggested Algorithm Keywords -->
                <div v-if="videoInsights[selectedVideo.id]?.tabs?.seoAlgorithm.suggestedKeywords?.length" class="space-y-1.5 pt-2 border-t border-neutral-100 dark:border-neutral-800">
                  <span class="text-[11px] font-bold text-muted flex items-center gap-1">
                    <UIcon name="i-lucide-search" class="size-3.5 text-primary" />
                    Suggested YouTube Algorithm Keywords:
                  </span>
                  <div class="flex flex-wrap gap-1.5">
                    <span
                      v-for="kw in videoInsights[selectedVideo.id]?.tabs?.seoAlgorithm.suggestedKeywords"
                      :key="kw"
                      class="px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20 text-[11px] font-medium"
                    >
                      {{ kw }}
                    </span>
                  </div>
                </div>

                <!-- Missing Elements Checklist -->
                <div v-if="videoInsights[selectedVideo.id]?.tabs?.seoAlgorithm.checklist?.length" class="space-y-2 pt-2 border-t border-neutral-100 dark:border-neutral-800">
                  <span class="text-[11px] font-bold text-muted flex items-center gap-1">
                    <UIcon name="i-lucide-check-square" class="size-3.5 text-primary" />
                    Optimization Checklist:
                  </span>
                  <div class="grid grid-cols-1 gap-1.5">
                    <div
                      v-for="(item, i) in videoInsights[selectedVideo.id]?.tabs?.seoAlgorithm.checklist"
                      :key="i"
                      class="flex items-center gap-2 p-2 rounded-md bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/60 dark:border-neutral-700/60"
                    >
                      <UIcon
                        :name="item.passed ? 'i-lucide-check-circle-2' : 'i-lucide-x-circle'"
                        class="size-4 shrink-0"
                        :class="item.passed ? 'text-emerald-500' : 'text-rose-500'"
                      />
                      <span class="text-neutral-800 dark:text-neutral-200 text-xs" :class="item.passed ? '' : 'font-medium'">
                        {{ item.item }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Tab 3: Content Review -->
              <div v-else-if="activeModalTab === 'review'" class="space-y-4 bg-white dark:bg-neutral-900 p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 text-xs">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-1.5 font-bold text-neutral-800 dark:text-neutral-200">
                    <UIcon name="i-lucide-zap" class="size-4 text-primary" />
                    <span>Retention & Story Pacing</span>
                  </div>
                  <UBadge :label="`Hook Score (0-15s): ${videoInsights[selectedVideo.id]?.tabs?.contentReview.hookScore ?? 85}/100`" color="primary" variant="subtle" size="xs" />
                </div>

                <p class="text-neutral-700 dark:text-neutral-300 leading-relaxed">
                  {{ videoInsights[selectedVideo.id]?.tabs?.contentReview.analysis }}
                </p>

                <!-- Strengths (Cosa ha funzionato) -->
                <div v-if="videoInsights[selectedVideo.id]?.tabs?.contentReview.strengths?.length" class="p-3 rounded-lg bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/20 space-y-2">
                  <span class="font-bold text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-1.5">
                    <UIcon name="i-lucide-check-circle-2" class="size-4" />
                    What Worked (Strengths):
                  </span>
                  <ul class="space-y-1 pl-4 list-disc text-neutral-800 dark:text-neutral-200 leading-normal">
                    <li v-for="(st, i) in videoInsights[selectedVideo.id]?.tabs?.contentReview.strengths" :key="i">
                      {{ st }}
                    </li>
                  </ul>
                </div>

                <!-- Retention Leaks (Punti di abbandono del pubblico) -->
                <div v-if="videoInsights[selectedVideo.id]?.tabs?.contentReview.retentionLeaks?.length" class="p-3 rounded-lg bg-rose-500/5 dark:bg-rose-500/10 border border-rose-500/20 space-y-2">
                  <span class="font-bold text-rose-600 dark:text-rose-400 text-xs flex items-center gap-1.5">
                    <UIcon name="i-lucide-alert-triangle" class="size-4" />
                    Audience Dropoff (Retention Leaks):
                  </span>
                  <ul class="space-y-1 pl-4 list-disc text-neutral-800 dark:text-neutral-200 leading-normal">
                    <li v-for="(leak, i) in videoInsights[selectedVideo.id]?.tabs?.contentReview.retentionLeaks" :key="i">
                      {{ leak }}
                    </li>
                  </ul>
                </div>

                <!-- Practical Action for Next Video -->
                <div v-if="videoInsights[selectedVideo.id]?.tabs?.contentReview.nextAction" class="p-3.5 rounded-lg bg-primary/5 dark:bg-primary/10 border border-primary/25 space-y-1.5">
                  <span class="font-bold text-primary text-xs flex items-center gap-1.5">
                    <UIcon name="i-lucide-rocket" class="size-4" />
                    Practical Action for Next Video:
                  </span>
                  <p class="text-neutral-800 dark:text-neutral-200 leading-relaxed font-medium">
                    {{ videoInsights[selectedVideo.id]?.tabs?.contentReview.nextAction }}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <!-- YouTube Link Button -->
          <a
            :href="`https://www.youtube.com/watch?v=${selectedVideo.id}`"
            target="_blank"
            rel="noopener"
          >
            <UButton label="Watch on YouTube" icon="i-simple-icons-youtube" color="error" variant="solid" block />
          </a>
        </div>
      </template>
    </UModal>
  </div>
</template>