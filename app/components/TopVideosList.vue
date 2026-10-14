<script setup lang="ts">
import type { ChannelData, VideoData } from '~/stores/channel'

const props = defineProps<{
  videos?: VideoData[]
  channel?: ChannelData | null
  avgViews?: number
}>()

const store = useChannelStore()
const { formatNumber, formatDate, formatDuration } = useFormatters()

const activeVideos = computed(() => props.videos ?? store.videos)
const activeChannel = computed(() => props.channel ?? store.channel)
const activeAvgViews = computed(() => {
  if (props.avgViews !== undefined) return props.avgViews
  if (props.videos) {
    if (props.videos.length === 0) return 0
    const total = props.videos.reduce((sum, v) => sum + v.viewCount, 0)
    return Math.round(total / props.videos.length)
  }
  return store.avgViews
})

const sortBy = ref<'date' | 'views' | 'likes' | 'engagement'>('date')
const filterType = ref<'all' | 'outlier' | 'short' | 'long'>('all')

const selectedVideo = ref<typeof store.videos[number] | null>(null)
const modalOpen = ref(false)

function openVideo(video: typeof store.videos[number]) {
  selectedVideo.value = video
  modalOpen.value = true
}

function engagementRate(video: { viewCount: number, likeCount: number, commentCount: number }) {
  if (video.viewCount === 0) return 0
  return ((video.likeCount + video.commentCount) / video.viewCount) * 100
}

function performanceMultiplier(viewCount: number) {
  if (activeAvgViews.value === 0) return 0
  return viewCount / activeAvgViews.value
}

function getSeoHealth(video: any) {
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

const filteredVideos = computed(() => {
  let result = [...activeVideos.value]

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
  <div v-if="activeVideos.length > 0">
    <!-- Header with controls -->
    <div class="flex items-center justify-between mb-4 flex-wrap gap-3">
      <div class="flex items-center gap-2">
        <h3 class="text-lg font-semibold">
          Recent Uploads
        </h3>
        <UBadge
          :label="`${filteredVideos.length} videos`"
          color="neutral"
          variant="subtle"
          size="xs"
        />
      </div>

      <div class="flex items-center gap-2">
        <USelect
          v-model="filterType"
          :items="filterOptions"
          size="sm"
        />
        <USelect
          v-model="sortBy"
          :items="sortOptions"
          size="sm"
        />
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
            <img
              :src="video.thumbnail"
              :alt="video.title"
              class="w-full aspect-video object-cover rounded-md"
            >
            <UBadge
              :label="formatDuration(video.durationSeconds)"
              color="neutral"
              variant="solid"
              class="absolute bottom-2 right-2"
            />
            <UBadge
              v-if="video.isShort"
              label="Short"
              color="error"
              variant="solid"
              class="absolute top-2 left-2"
            />
            <div
              v-if="performanceMultiplier(video.viewCount) >= 1.5"
              class="absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500 text-white shadow-xs"
            >
              <UIcon
                name="i-lucide-flame"
                class="size-3"
              />
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
              <UIcon
                name="i-lucide-eye"
                class="size-4"
              />
              {{ formatNumber(video.viewCount) }}
            </span>
            <span class="flex items-center gap-1">
              <UIcon
                name="i-lucide-thumbs-up"
                class="size-4"
              />
              {{ formatNumber(video.likeCount) }}
            </span>
            <span class="flex items-center gap-1">
              <UIcon
                name="i-lucide-message-circle"
                class="size-4"
              />
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
              <span
                class="size-1.5 rounded-full"
                :class="getSeoHealth(video).dotClass"
              />
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
    <div
      v-if="filteredVideos.length > 0 && !props.videos && store.hasMoreVideos"
      class="flex flex-col items-center justify-center pt-8 pb-4"
    >
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
        Showing {{ activeVideos.length }} of {{ activeChannel?.videoCount || activeVideos.length }} uploads
      </p>
    </div>
    <div
      v-else-if="filteredVideos.length > 0 && activeVideos.length >= 50"
      class="text-center pt-6 pb-2 text-xs text-muted"
    >
      Showing maximum 50 recent uploads
    </div>

    <p
      v-if="filteredVideos.length === 0"
      class="text-sm text-muted text-center py-8"
    >
      No videos found matching this filter.
    </p>

    <!-- Video Detail Modal with 4-Tab Analysis & AI Diagnosis -->
    <VideoAnalysisModal
      v-model:open="modalOpen"
      :video="selectedVideo"
      :channel="activeChannel"
      :avg-views="activeAvgViews"
    />
  </div>
</template>
