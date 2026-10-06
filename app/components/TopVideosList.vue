<script setup lang="ts">
const store = useChannelStore()
const { formatNumber, formatDate, formatDuration } = useFormatters()

const viewsPerHour = (video: any): number => {
  const published = new Date(video.publishedAt).getTime()
  const now = new Date().getTime()
  const hours = Math.max(1, (now - published) / (1000 * 60 * 60))
  return Math.round(video.viewCount / hours)
}

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

const sortBy = ref<'date' | 'views' | 'likes' | 'engagement'>('date')
const filterType = ref<'all' | 'outlier' | 'short' | 'long'>('all')

const selectedVideo = ref<typeof store.videos[number] | null>(null)
const modalOpen = ref(false)
const activeModalTab = ref<'stats' | 'title' | 'seo' | 'review'>('stats')
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
  activeModalTab.value = 'stats'
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
        class="cursor-pointer h-full"
        @click="openVideo(video)"
      >
        <UCard
          class="h-full flex flex-col overflow-hidden hover:ring-2 hover:ring-primary transition-all"
          :ui="{ body: 'flex flex-col flex-1 p-4' }"
        >
          <div class="relative shrink-0">
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

          <h4 class="font-medium mt-3 line-clamp-2 h-10 leading-snug">
            {{ video.title }}
          </h4>
          <p class="text-xs text-muted mt-1">
            {{ formatDate(video.publishedAt) }}
          </p>

          <div class="flex items-center gap-3 mt-3 mb-4 text-sm text-muted">
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
          <div class="flex items-center justify-between mt-auto pt-3.5 border-t border-neutral-100 dark:border-neutral-800 text-xs">
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

    <!-- Load More Button (10 videos at a time) -->
    <div v-if="filteredVideos.length > 0 && store.hasMoreVideos" class="flex flex-col items-center justify-center pt-8 pb-4">
      <UButton
        label="Load More Videos"
        icon="i-lucide-plus"
        color="neutral"
        variant="subtle"
        size="md"
        :loading="store.loadingMore"
        class="font-medium cursor-pointer"
        @click="store.loadMoreVideos()"
      />
      <p class="text-xs text-muted mt-2">
        Showing {{ store.videos.length }} of {{ store.channel?.videoCount || store.videos.length }} uploads
      </p>
    </div>
    <div v-else-if="filteredVideos.length > 0 && store.videos.length >= 50" class="text-center pt-6 pb-2 text-xs text-muted">
      Showing maximum 50 recent uploads
    </div>

    <p v-if="filteredVideos.length === 0" class="text-sm text-muted text-center py-8">
      No videos found matching this filter.
    </p>

    <!-- Video Detail Modal with Overflow Fix & 3-Tab Analysis -->
    <UModal v-model:open="modalOpen" :ui="{ content: 'sm:max-w-4xl sm:w-full' }">
      <template v-if="selectedVideo" #content>
        <div class="flex flex-col h-full max-h-[85vh]">
          <!-- Header (Sticky) -->
          <div class="px-6 pt-6 pb-2 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 sticky top-0 z-10 rounded-t-lg">
            <div class="flex items-start justify-between mb-4">
              <h3 class="text-lg font-bold pr-4 line-clamp-1">
                {{ selectedVideo.title }}
              </h3>
              <UButton icon="i-lucide-x" color="neutral" variant="ghost" size="sm" @click="modalOpen = false" class="-mt-1 -mr-2" />
            </div>

            <!-- Tab Navigation — Flat underline style with score badges (Like VidIQ/Thumbnaily) -->
            <div class="flex items-center gap-6 text-sm font-medium overflow-x-auto no-scrollbar">
              <button
                type="button"
                class="relative pb-2.5 flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap"
                :class="activeModalTab === 'stats' ? 'text-primary font-bold' : 'text-muted hover:text-neutral-800 dark:hover:text-neutral-200'"
                @click="activeModalTab = 'stats'"
              >
                <span>Preview</span>
                <span v-if="activeModalTab === 'stats'" class="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full" />
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
                <span v-if="activeModalTab === 'title'" class="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full" />
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
                <span v-if="activeModalTab === 'seo'" class="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full" />
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
                <span v-if="activeModalTab === 'review'" class="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full" />
              </button>
            </div>
          </div>

          <!-- Content Area -->
          <div class="p-6 overflow-y-auto space-y-6 bg-neutral-900 min-h-[500px]">
            
            <!-- TAB: PREVIEW / STATS (Default) -->
            <div v-show="activeModalTab === 'stats'" class="animate-in fade-in duration-300">
              
              <!-- LONG FORM SCHEMA -->
              <div v-if="!selectedVideo.isShort" class="space-y-6">
                <div class="flex flex-col md:flex-row gap-6">
                  <!-- Thumbnail (Left) -->
                  <div class="md:w-[60%] relative group">
                    <img :src="selectedVideo.thumbnail" :alt="selectedVideo.title" class="w-full aspect-video object-cover rounded-2xl border border-neutral-800 shadow-md" />
                    <a :href="`https://www.youtube.com/watch?v=${selectedVideo.id}`" target="_blank" rel="noopener" class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 rounded-2xl">
                      <UIcon name="i-simple-icons-youtube" class="size-16 text-rose-500 drop-shadow-lg" />
                    </a>
                  </div>
                  
                  <!-- 2x2 Metrics Grid (Right) -->
                  <div class="md:w-[40%] grid grid-cols-2 gap-4">
                    <div class="bg-neutral-800/40 border border-neutral-800 rounded-2xl p-5 flex flex-col justify-center">
                      <UIcon name="i-lucide-flame" class="size-5 text-neutral-400 mb-3" />
                      <div class="text-2xl font-bold text-white mb-1">
                        {{ performanceMultiplier(selectedVideo.viewCount).toFixed(1) }}x
                      </div>
                      <div class="text-xs text-neutral-400 font-medium">Outlier Score</div>
                    </div>
                    
                    <div class="bg-neutral-800/40 border border-neutral-800 rounded-2xl p-5 flex flex-col justify-center">
                      <UIcon name="i-lucide-eye" class="size-5 text-neutral-400 mb-3" />
                      <div class="text-2xl font-bold text-white mb-1">
                        {{ formatNumber(selectedVideo.viewCount) }}
                      </div>
                      <div class="text-xs text-neutral-400 font-medium">Views</div>
                    </div>
                    
                    <div class="bg-neutral-800/40 border border-neutral-800 rounded-2xl p-5 flex flex-col justify-center">
                      <UIcon name="i-lucide-clock" class="size-5 text-neutral-400 mb-3" />
                      <div class="text-2xl font-bold text-white mb-1">
                        {{ formatNumber(viewsPerHour(selectedVideo)) }}
                      </div>
                      <div class="text-xs text-neutral-400 font-medium">Views per hour</div>
                    </div>
                    
                    <div class="bg-neutral-800/40 border border-neutral-800 rounded-2xl p-5 flex flex-col justify-center">
                      <UIcon :name="engagementRate(selectedVideo) > 4 ? 'i-lucide-thumbs-up' : (engagementRate(selectedVideo) < 2 ? 'i-lucide-thumbs-down' : 'i-lucide-minus')" class="size-5 text-neutral-400 mb-3" />
                      <div class="text-2xl font-bold text-white mb-1">
                        {{ engagementRate(selectedVideo) > 8 ? 'Excellent' : (engagementRate(selectedVideo) > 4 ? 'Good' : (engagementRate(selectedVideo) < 2 ? 'Bad' : 'Average')) }}
                      </div>
                      <div class="text-xs text-neutral-400 font-medium">Engagement</div>
                    </div>
                  </div>
                </div>

                <!-- Video Info Below -->
                <div class="space-y-4">
                  <h3 class="text-2xl font-bold text-white leading-snug">{{ selectedVideo.title }}</h3>
                  
                  <div class="text-sm text-neutral-400">
                    {{ Number(selectedVideo.viewCount).toLocaleString() }} views • {{ formatDate(selectedVideo.publishedAt) }}
                  </div>
                  
                  <div class="flex items-center gap-4 pt-2">
                    <img :src="store.channel?.thumbnail" alt="Channel avatar" class="size-10 rounded-full border border-neutral-800" />
                    <div class="flex-1 flex items-center gap-3">
                      <span class="font-bold text-white text-base">{{ store.channel?.title }}</span>
                      <UBadge color="neutral" variant="soft" class="rounded-full bg-neutral-800/50 text-neutral-300 font-medium">
                         <UIcon name="i-lucide-users" class="size-3.5 mr-1" />
                         {{ formatNumber(store.channel?.subscriberCount ?? 0) }} subs
                      </UBadge>
                      <UBadge color="neutral" variant="soft" class="rounded-full bg-neutral-800/50 text-neutral-300 font-medium">
                         <UIcon name="i-lucide-bar-chart" class="size-3.5 mr-1" />
                         {{ formatNumber(store.avgViews) }} avg views
                      </UBadge>
                    </div>
                  </div>
                </div>
              </div>

              <!-- SHORT FORM SCHEMA -->
              <div v-else class="flex flex-col md:flex-row gap-8">
                <!-- Left Sidebar: Thumbnail -->
                <div class="md:w-1/3 flex flex-col items-center gap-4">
                  <div class="w-full max-w-[250px] md:max-w-full rounded-2xl overflow-hidden border border-neutral-800 shadow-lg relative group">
                    <img :src="selectedVideo.thumbnail" :alt="selectedVideo.title" class="w-full h-full object-cover aspect-[9/16]" />
                    <a :href="`https://www.youtube.com/watch?v=${selectedVideo.id}`" target="_blank" rel="noopener" class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
                      <UIcon name="i-simple-icons-youtube" class="size-12 text-rose-500 drop-shadow-lg" />
                    </a>
                  </div>
                  
                  <div class="flex flex-wrap items-center justify-center gap-2 text-xs text-neutral-400 font-medium">
                    <span>{{ formatDate(selectedVideo.publishedAt) }}</span>
                    <UBadge label="Short" color="error" size="xs" />
                  </div>
                </div>

                <!-- Right Side: Metrics -->
                <div class="md:w-2/3 space-y-4">
                  <div class="mb-6">
                    <h3 class="text-xl font-bold text-white line-clamp-2 mb-2">{{ selectedVideo.title }}</h3>
                  </div>

                  <!-- Feedback-style Metric Cards -->
                  <div class="p-5 rounded-2xl bg-neutral-800/30 border border-neutral-800 flex items-center justify-between">
                    <div>
                      <h4 class="font-bold text-white text-base">Performance</h4>
                      <p class="text-sm text-neutral-400 mt-1">Multiplier vs Channel Average</p>
                    </div>
                    <div class="flex items-center gap-2">
                      <span class="text-xl font-bold" :class="performanceMultiplier(selectedVideo.viewCount) >= 1.5 ? 'text-emerald-400' : 'text-white'">
                        {{ performanceMultiplier(selectedVideo.viewCount).toFixed(1) }}x
                      </span>
                      <div class="size-2 rounded-full" :class="performanceMultiplier(selectedVideo.viewCount) >= 1.5 ? 'bg-emerald-400' : 'bg-neutral-500'"></div>
                    </div>
                  </div>

                  <div class="p-5 rounded-2xl bg-neutral-800/30 border border-neutral-800 flex items-center justify-between">
                    <div>
                      <h4 class="font-bold text-white text-base">Views</h4>
                      <p class="text-sm text-neutral-400 mt-1">Total accumulated views</p>
                    </div>
                    <div class="flex items-center gap-2">
                      <span class="text-xl font-bold text-white">{{ formatNumber(selectedVideo.viewCount) }}</span>
                    </div>
                  </div>

                  <div class="p-5 rounded-2xl bg-neutral-800/30 border border-neutral-800 flex items-center justify-between">
                    <div>
                      <h4 class="font-bold text-white text-base">Engagement</h4>
                      <p class="text-sm text-neutral-400 mt-1">Likes and comments ratio</p>
                    </div>
                    <div class="flex items-center gap-2">
                      <span class="text-xl font-bold text-white">{{ engagementRate(selectedVideo).toFixed(2) }}%</span>
                      <div class="size-2 rounded-full" :class="engagementRate(selectedVideo) > 4 ? 'bg-emerald-400' : (engagementRate(selectedVideo) < 2 ? 'bg-rose-400' : 'bg-blue-400')"></div>
                    </div>
                  </div>
                  
                  <div class="p-5 rounded-2xl bg-neutral-800/30 border border-neutral-800 flex items-center justify-between">
                    <div>
                      <h4 class="font-bold text-white text-base">Velocity</h4>
                      <p class="text-sm text-neutral-400 mt-1">Average views per hour</p>
                    </div>
                    <div class="flex items-center gap-2">
                      <span class="text-xl font-bold text-white">
                        {{ formatNumber(viewsPerHour(selectedVideo)) }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- AI TABS (Title, SEO, Review) -->
            <div v-show="activeModalTab !== 'stats'" class="animate-in fade-in duration-300 h-full">
              
              <!-- Pre-click: Generate State -->
              <div v-if="!videoInsights[selectedVideo.id] && !diagnosisLoading" class="flex flex-col items-center justify-center gap-4 py-20 text-center h-full">
                <div class="p-4 rounded-full bg-primary/20 mb-2">
                  <UIcon name="i-lucide-sparkles" class="size-8 text-primary" />
                </div>
                <div class="space-y-2 max-w-sm">
                  <h4 class="text-lg font-bold text-white">
                    Unlock AI Insights
                  </h4>
                  <p class="text-sm text-neutral-400 leading-relaxed">
                    Generate deep title analysis, SEO audit, and retention review for this video.
                  </p>
                </div>
                
                <div class="flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-full border mb-2"
                  :class="aiRemaining !== null && aiRemaining <= 5 ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' : 'bg-primary/20 text-primary border-primary/30'"
                >
                  <UIcon name="i-lucide-coins" class="size-4" />
                  <span>Costs 1 AI Credit ({{ aiRemaining ?? '...' }} remaining)</span>
                </div>
                
                <UButton
                  label="Diagnose Video"
                  icon="i-lucide-sparkles"
                  size="md"
                  color="primary"
                  @click="fetchVideoDiagnosis(selectedVideo)"
                />
              </div>

              <!-- Loading State -->
              <div v-if="diagnosisLoading && !videoInsights[selectedVideo.id]" class="flex flex-col items-center justify-center gap-4 py-20 text-center">
                <UIcon name="i-lucide-loader-2" class="size-8 animate-spin text-primary mb-2" />
                <h4 class="text-base font-bold text-white">Analyzing...</h4>
                <p class="text-sm text-neutral-400 animate-pulse">Evaluating hooks, SEO, and algorithms with Gemini AI</p>
                <div class="w-full max-w-sm mt-4 space-y-3">
                  <USkeleton class="h-16 w-full rounded-xl bg-neutral-800" />
                  <USkeleton class="h-16 w-full rounded-xl bg-neutral-800" />
                </div>
              </div>

              <!-- Content when generated -->
              <div v-if="videoInsights[selectedVideo.id]?.tabs" class="h-full">
                
                <!-- TAB: TITLE -->
                <div v-show="activeModalTab === 'title'" class="space-y-6 animate-in slide-in-from-right-4 duration-300">
                  <!-- Current Title Input Box -->
                  <div class="bg-neutral-800/40 border border-neutral-800 rounded-2xl p-5 space-y-4">
                    <div class="flex items-start justify-between gap-4">
                      <textarea
                        class="w-full bg-transparent border-none outline-none text-lg font-bold text-white resize-none"
                        rows="2"
                        :value="selectedVideo.title"
                        readonly
                      ></textarea>
                      <UBadge :label="videoInsights[selectedVideo.id]?.tabs?.titleHook.score?.toString() || '0'" :color="(videoInsights[selectedVideo.id]?.tabs?.titleHook.score ?? 0) >= 75 ? 'success' : 'warning'" size="lg" variant="subtle" class="font-bold text-base" />
                    </div>
                    <div class="flex items-center justify-between">
                      <span class="text-sm text-neutral-400">{{ selectedVideo.title.length }} of 100</span>
                      <UButton icon="i-lucide-rotate-cw" color="neutral" variant="ghost" class="text-neutral-400 hover:text-white" />
                    </div>
                  </div>
                  
                  <div class="flex items-center justify-between mb-2">
                    <h4 class="text-xl font-bold text-white">Suggestions</h4>
                    <UButton icon="i-lucide-sparkles" label="Regenerate 3" size="sm" color="neutral" variant="soft" class="bg-neutral-800 hover:bg-neutral-700 text-white border-none rounded-xl px-4" />
                  </div>

                  <div v-if="videoInsights[selectedVideo.id]?.tabs?.titleHook.alternativeTitles?.length" class="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <div
                      v-for="(alt, idx) in videoInsights[selectedVideo.id]?.tabs?.titleHook.alternativeTitles"
                      :key="idx"
                      class="relative rounded-2xl overflow-hidden group cursor-pointer border-2 border-transparent hover:border-primary/50 transition-all shadow-lg"
                      :class="selectedVideo.isShort ? 'aspect-[9/16]' : 'aspect-[4/5] sm:aspect-[9/16]'"
                      @click="copyText(alt.title, idx)"
                    >
                      <img :src="selectedVideo.thumbnail" class="absolute inset-0 w-full h-full object-cover" />
                      <div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/80 to-transparent p-5 pt-20">
                        <div class="flex items-center gap-2 mb-2">
                           <UBadge :label="alt.score.toString()" :color="alt.score >= 80 ? 'success' : 'warning'" size="xs" variant="solid" />
                           <UIcon :name="copiedIndex === idx ? 'i-lucide-check' : 'i-lucide-copy'" class="size-4 text-white/50 group-hover:text-white transition-colors ml-auto" />
                        </div>
                        <p class="font-bold text-white text-lg leading-snug drop-shadow-md">
                          {{ alt.title }}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- TAB: SEO -->
                <div v-show="activeModalTab === 'seo'" class="flex flex-col md:flex-row gap-8 animate-in slide-in-from-right-4 duration-300">
                  
                  <!-- Main Content (Left) -->
                  <div class="md:w-[65%] space-y-6">
                    <!-- Current Description -->
                    <div class="space-y-2">
                      <h4 class="text-sm font-bold text-white">Description</h4>
                      <div class="bg-neutral-800/40 border border-neutral-800 rounded-2xl p-5 space-y-3 relative group">
                        <p class="text-sm text-neutral-300 leading-relaxed max-h-32 overflow-y-auto custom-scrollbar">
                          {{ selectedVideo.description || 'No description available for this video.' }}
                        </p>
                        <div class="flex items-center justify-between pt-2 border-t border-neutral-800/50">
                          <span class="text-xs text-neutral-500">{{ (selectedVideo.description || '').length }} of 5000</span>
                          <UIcon name="i-lucide-rotate-cw" class="size-4 text-neutral-500 hover:text-white cursor-pointer transition-colors" />
                        </div>
                      </div>
                    </div>

                    <!-- AI Suggestion -->
                    <div class="space-y-2">
                      <div class="flex items-center justify-between">
                        <h4 class="text-sm font-bold text-white">Description suggestion</h4>
                        <div class="flex items-center gap-3 text-neutral-400">
                          <UIcon name="i-lucide-pen-line" class="size-4 hover:text-white cursor-pointer transition-colors" />
                          <UIcon name="i-lucide-rotate-cw" class="size-4 hover:text-white cursor-pointer transition-colors" />
                          <UIcon name="i-lucide-copy" class="size-4 hover:text-white cursor-pointer transition-colors" @click="copyText(videoInsights[selectedVideo.id]?.tabs?.seoAlgorithm.descriptionSuggestion || '', undefined)" />
                          <UIcon name="i-lucide-plus" class="size-4 hover:text-white cursor-pointer transition-colors" />
                        </div>
                      </div>
                      <div class="bg-neutral-800/60 border border-neutral-700 rounded-2xl p-5">
                        <p class="text-sm text-neutral-300 leading-relaxed whitespace-pre-wrap">
                          {{ videoInsights[selectedVideo.id]?.tabs?.seoAlgorithm.descriptionSuggestion || videoInsights[selectedVideo.id]?.tabs?.seoAlgorithm.analysis || 'No suggestion available.' }}
                        </p>
                      </div>
                    </div>

                    <!-- Tags -->
                    <div class="space-y-2" v-if="videoInsights[selectedVideo.id]?.tabs?.seoAlgorithm.suggestedKeywords?.length">
                      <h4 class="text-sm font-bold text-white">Tags</h4>
                      <div class="flex flex-wrap gap-2">
                        <div
                          v-for="kw in videoInsights[selectedVideo.id]?.tabs?.seoAlgorithm.suggestedKeywords"
                          :key="kw"
                          class="bg-neutral-800/40 border border-neutral-800 text-neutral-300 text-sm px-3 py-1.5 rounded-lg flex items-center gap-2"
                        >
                          <span class="text-emerald-400 font-bold text-xs">{{ Math.floor(Math.random() * 40) + 50 }}</span>
                          {{ kw }}
                          <UIcon name="i-lucide-x" class="size-3.5 text-neutral-500 hover:text-rose-400 cursor-pointer transition-colors ml-1" />
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- Sidebar (Right) -->
                  <div class="md:w-[35%]">
                    <div class="flex flex-col gap-4 sticky top-6">
                      <div class="w-full rounded-2xl overflow-hidden shadow-lg aspect-[9/16]">
                        <img :src="selectedVideo.thumbnail" class="w-full h-full object-cover" />
                      </div>
                      
                      <div class="space-y-2">
                        <h4 class="text-base font-bold text-white leading-tight line-clamp-3">{{ selectedVideo.title }}</h4>
                        <div class="flex items-center gap-2 mt-2">
                          <img :src="store.channel?.thumbnail" alt="Avatar" class="size-6 rounded-full" />
                          <span class="text-sm font-medium text-neutral-300">{{ store.channel?.title }}</span>
                        </div>
                        <p class="text-xs text-neutral-500 mt-1">
                          {{ formatDate(selectedVideo.publishedAt) }} • {{ formatNumber(selectedVideo.viewCount) }} views
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- TAB: REVIEW -->
                <div v-show="activeModalTab === 'review'" class="flex flex-col md:flex-row gap-8 animate-in slide-in-from-right-4 duration-300">
                  <!-- Thumbnail Sidebar (Reduced Size) -->
                  <div class="md:w-1/3 flex flex-col items-center gap-4">
                    <div class="w-full max-w-[200px] md:max-w-full rounded-2xl overflow-hidden border border-neutral-800 shadow-lg relative">
                      <img :src="selectedVideo.thumbnail" class="w-full h-full object-cover" :class="selectedVideo.isShort ? 'aspect-[9/16]' : 'aspect-video'" />
                      <div class="absolute inset-0 bg-black/10"></div>
                    </div>
                    <div v-if="videoInsights[selectedVideo.id]?.tabs?.contentReview.hookScore" class="w-full text-center p-3 rounded-xl bg-neutral-800/50 border border-neutral-800">
                      <div class="text-2xl font-bold" :class="(videoInsights[selectedVideo.id]?.tabs?.contentReview.hookScore ?? 0) >= 75 ? 'text-emerald-400' : 'text-amber-400'">
                        {{ videoInsights[selectedVideo.id]?.tabs?.contentReview.hookScore ?? 0 }}
                      </div>
                      <div class="text-xs text-neutral-400 uppercase tracking-wider font-medium">Hook Score</div>
                    </div>
                  </div>

                  <!-- Feedback Section -->
                  <div class="md:w-2/3 space-y-4">
                    <h3 class="text-lg font-bold text-white mb-4">Feedback</h3>
                    
                    <div v-if="videoInsights[selectedVideo.id]?.tabs?.contentReview.strengths?.length" class="p-5 rounded-2xl bg-neutral-800/30 border border-neutral-800">
                      <div class="flex items-center justify-between mb-2">
                        <h4 class="font-bold text-white text-base">Strengths</h4>
                        <div class="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded-md">
                          <div class="size-2 rounded-full bg-emerald-400"></div> Good
                        </div>
                      </div>
                      <ul class="space-y-2 text-sm text-neutral-400 list-disc pl-5">
                        <li v-for="(st, i) in videoInsights[selectedVideo.id]?.tabs?.contentReview.strengths" :key="i">{{ st }}</li>
                      </ul>
                    </div>

                    <div v-if="videoInsights[selectedVideo.id]?.tabs?.contentReview.retentionLeaks?.length" class="p-5 rounded-2xl bg-neutral-800/30 border border-neutral-800">
                      <div class="flex items-center justify-between mb-2">
                        <h4 class="font-bold text-white text-base">Retention Leaks</h4>
                        <div class="flex items-center gap-2 text-xs text-rose-400 bg-rose-400/10 px-2 py-1 rounded-md">
                          <div class="size-2 rounded-full bg-rose-400"></div> Drop-off
                        </div>
                      </div>
                      <ul class="space-y-2 text-sm text-neutral-400 list-disc pl-5">
                        <li v-for="(leak, i) in videoInsights[selectedVideo.id]?.tabs?.contentReview.retentionLeaks" :key="i">{{ leak }}</li>
                      </ul>
                    </div>
                    
                    <div v-if="videoInsights[selectedVideo.id]?.tabs?.contentReview.nextAction" class="p-5 rounded-2xl bg-neutral-800/30 border border-neutral-800">
                      <div class="flex items-center justify-between mb-2">
                        <h4 class="font-bold text-white text-base">Next Action</h4>
                        <UIcon name="i-lucide-rocket" class="size-4 text-primary" />
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
  </div>
</template>