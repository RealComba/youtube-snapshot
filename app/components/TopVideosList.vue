<script setup lang="ts">
const store = useChannelStore()
const { formatNumber, formatDate, formatDuration } = useFormatters()

const sortBy = ref<'date' | 'views' | 'likes' | 'engagement'>('date')
const filterType = ref<'all' | 'short' | 'long'>('all')

const selectedVideo = ref<typeof store.videos[number] | null>(null)
const modalOpen = ref(false)

// Cache of AI diagnoses per videoId
const videoDiagnoses = ref<Record<string, string>>({})
const diagnosisLoading = ref(false)

function openVideo(video: typeof store.videos[number]) {
  selectedVideo.value = video
  modalOpen.value = true
}

function engagementRate(video: { viewCount: number, likeCount: number, commentCount: number }) {
  if (video.viewCount === 0) return 0
  return ((video.likeCount + video.commentCount) / video.viewCount) * 100
}

function performanceMultiplier(viewCount: number) {
  if (store.avgViews === 0) return 0
  return viewCount / store.avgViews
}

async function fetchVideoDiagnosis(video: typeof store.videos[number]) {
  if (videoDiagnoses.value[video.id] || diagnosisLoading.value) return

  diagnosisLoading.value = true
  try {
    const res = await $fetch<{ diagnosis: string }>('/api/video-insight', {
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
    videoDiagnoses.value[video.id] = res.diagnosis
  } catch {
    videoDiagnoses.value[video.id] = 'Could not generate AI diagnosis for this video right now.'
  } finally {
    diagnosisLoading.value = false
  }
}

const filteredVideos = computed(() => {
  let result = [...store.videos]

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
            <UBadge
              v-if="performanceMultiplier(video.viewCount) >= 2"
              :label="`🔥 ${performanceMultiplier(video.viewCount).toFixed(1)}x avg`"
              color="warning"
              variant="solid"
              class="absolute top-2 right-2"
            />
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

          <div class="mt-2 text-xs text-muted">
            Engagement: {{ engagementRate(video).toFixed(2) }}%
          </div>
        </UCard>
      </div>
    </div>

    <p v-if="filteredVideos.length === 0" class="text-sm text-muted text-center py-8">
      No videos found matching this filter.
    </p>

    <!-- Video Detail Modal -->
    <UModal v-model:open="modalOpen">
      <template v-if="selectedVideo" #content>
        <div class="p-6 space-y-4">
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

          <!-- AI Viral Diagnosis Section -->
          <div class="rounded-lg border border-neutral-200 dark:border-neutral-800 p-4 space-y-3">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <UIcon name="i-lucide-sparkles" class="size-4 text-primary" />
                <h4 class="text-sm font-semibold">AI Viral Diagnosis</h4>
              </div>
              <UButton
                v-if="!videoDiagnoses[selectedVideo.id]"
                label="Diagnose Video"
                icon="i-lucide-sparkles"
                size="xs"
                variant="soft"
                :loading="diagnosisLoading"
                @click="fetchVideoDiagnosis(selectedVideo)"
              />
            </div>

            <!-- Loading State -->
            <div v-if="diagnosisLoading && !videoDiagnoses[selectedVideo.id]" class="space-y-2 py-1">
              <span class="text-xs text-muted animate-pulse">Analyzing title hook psychology and algorithmic retention...</span>
              <USkeleton class="h-14 w-full rounded" />
            </div>

            <!-- Diagnosis Result -->
            <div v-else-if="videoDiagnoses[selectedVideo.id]" class="text-xs leading-relaxed text-neutral-700 dark:text-neutral-300 whitespace-pre-line bg-neutral-50 dark:bg-neutral-900/50 p-3 rounded">
              {{ videoDiagnoses[selectedVideo.id] }}
            </div>

            <!-- Hint before generation -->
            <p v-else class="text-xs text-muted">
              Get an AI breakdown of title hook psychology, algorithmic pacing, and why this video succeeded or underperformed.
            </p>
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