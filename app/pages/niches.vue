<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const router = useRouter()
const channelStore = useChannelStore()
const { formatNumber, formatDate, formatDuration } = useFormatters()

export interface NicheVideoItem {
  id: string
  title: string
  description: string
  channelId: string
  channelTitle: string
  publishedAt: string
  thumbnail: string
  viewCount: number
  likeCount: number
  commentCount: number
  durationSeconds: number
  isShort: boolean
  categoryId?: string
  viewsPerHour: number
}

// Filter States
const selectedRegion = ref('US')
const selectedCategory = ref('all')
const selectedType = ref<'all' | 'videos' | 'shorts'>('all')
const sortBy = ref<'velocity' | 'views' | 'likes' | 'comments' | 'newest'>('velocity')
const searchQuery = ref('')
const loading = ref(false)
const error = ref<string | null>(null)
const cacheSource = ref<'cache' | 'youtube-api' | 'empty' | null>(null)

// Raw loaded videos (up to 100)
const allVideos = ref<NicheVideoItem[]>([])

const categories = [
  { id: 'all', label: 'All Niches', icon: 'i-lucide-sparkles' },
  { id: '28', label: 'Tech & Science', icon: 'i-lucide-cpu' },
  { id: '20', label: 'Gaming', icon: 'i-lucide-gamepad-2' },
  { id: '24', label: 'Entertainment', icon: 'i-lucide-clapperboard' },
  { id: '23', label: 'Comedy', icon: 'i-lucide-laugh' },
  { id: '26', label: 'How-to & Style', icon: 'i-lucide-wrench' },
  { id: '25', label: 'News & Politics', icon: 'i-lucide-newspaper' },
  { id: '17', label: 'Sports', icon: 'i-lucide-trophy' },
  { id: '10', label: 'Music', icon: 'i-lucide-music' }
]

const regions = [
  { label: '🇺🇸 United States', value: 'US' },
  { label: '🇬🇧 United Kingdom', value: 'GB' },
  { label: '🇮🇹 Italy', value: 'IT' },
  { label: '🇨🇦 Canada', value: 'CA' },
  { label: '🇦🇺 Australia', value: 'AU' },
  { label: '🇩🇪 Germany', value: 'DE' },
  { label: '🇫🇷 France', value: 'FR' },
  { label: '🇪🇸 Spain', value: 'ES' },
  { label: '🇯🇵 Japan', value: 'JP' },
  { label: '🇧🇷 Brazil', value: 'BR' }
]

const sortOptions = [
  { label: '⚡ Viral Velocity (views/h)', value: 'velocity' },
  { label: '👁️ Most Viewed', value: 'views' },
  { label: '👍 Most Liked', value: 'likes' },
  { label: '💬 Most Comments', value: 'comments' },
  { label: '🕒 Recently Uploaded', value: 'newest' }
]

// Fetch 100 popular videos for current region + category
async function loadNicheVideos(forceRefresh = false) {
  loading.value = true
  error.value = null

  try {
    const data = await $fetch<{
      source: 'cache' | 'youtube-api' | 'empty'
      regionCode: string
      categoryId: string
      total: number
      videos: NicheVideoItem[]
    }>('/api/niche-videos', {
      params: {
        regionCode: selectedRegion.value,
        categoryId: selectedCategory.value,
        forceRefresh: forceRefresh ? 'true' : undefined
      }
    })

    allVideos.value = data.videos || []
    cacheSource.value = data.source
  } catch (err: any) {
    console.error('Failed to load niche videos:', err)
    error.value = err?.data?.statusMessage || err?.statusMessage || 'Failed to load popular videos from YouTube.'
  } finally {
    loading.value = false
  }
}

// Counts for the type tabs
const totalCount = computed(() => allVideos.value.length)
const shortsCount = computed(() => allVideos.value.filter(v => v.isShort).length)
const longVideosCount = computed(() => allVideos.value.filter(v => !v.isShort).length)

// Filtered and sorted videos
const filteredVideos = computed(() => {
  let list = [...allVideos.value]

  // Content type filter
  if (selectedType.value === 'shorts') {
    list = list.filter(v => v.isShort)
  } else if (selectedType.value === 'videos') {
    list = list.filter(v => !v.isShort)
  }

  // Live search filter
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase().trim()
    list = list.filter(v =>
      v.title.toLowerCase().includes(q)
      || v.channelTitle.toLowerCase().includes(q)
    )
  }

  // Sorting
  list.sort((a, b) => {
    switch (sortBy.value) {
      case 'velocity':
        return b.viewsPerHour - a.viewsPerHour
      case 'views':
        return b.viewCount - a.viewCount
      case 'likes':
        return b.likeCount - a.likeCount
      case 'comments':
        return b.commentCount - a.commentCount
      case 'newest':
        return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
      default:
        return 0
    }
  })

  return list
})

// Summary metrics computed over current filtered list
const avgViews = computed(() => {
  if (filteredVideos.value.length === 0) return 0
  const total = filteredVideos.value.reduce((acc, v) => acc + v.viewCount, 0)
  return Math.round(total / filteredVideos.value.length)
})

const peakVelocity = computed(() => {
  if (filteredVideos.value.length === 0) return 0
  return Math.max(...filteredVideos.value.map(v => v.viewsPerHour))
})

function timeAgo(dateIso: string): string {
  const diffMs = Date.now() - new Date(dateIso).getTime()
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  if (diffHours < 1) return 'Just now'
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 30) return `${diffDays}d ago`
  return formatDate(dateIso)
}

function getVelocityBadge(vph: number) {
  if (vph >= 50000) {
    return {
      label: `🔥 ${formatNumber(vph)}/h`,
      class: 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30'
    }
  }
  if (vph >= 10000) {
    return {
      label: `⚡ ${formatNumber(vph)}/h`,
      class: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
    }
  }
  return {
    label: `${formatNumber(vph)}/h`,
    class: 'bg-neutral-500/10 text-neutral-600 dark:text-neutral-400 border-neutral-500/20'
  }
}

// Navigate to Channel Analyzer and immediately inspect creator
async function analyzeChannel(channelId: string) {
  await router.push('/')
  channelStore.search(channelId)
}

// Jump to AI Chat with tailored trend diagnostic prompt
async function analyzeWithAi(video: NicheVideoItem) {
  const currentCategoryName = categories.find(c => c.id === selectedCategory.value)?.label || 'Trending'
  const prompt = `I'm analyzing breakout YouTube content in the "${currentCategoryName}" niche.\n\nTrending video:\n- Title: "${video.title}"\n- Creator: "${video.channelTitle}"\n- Format: ${video.isShort ? 'YouTube Short' : 'Long-form Video'}\n- Performance: ${formatNumber(video.viewCount)} views (${formatNumber(video.viewsPerHour)} views/hr viral velocity)\n- Likes: ${formatNumber(video.likeCount)} | Comments: ${formatNumber(video.commentCount)}\n\nCan you analyze why this title, hook, and topic are capturing audience attention right now, and give me 3 actionable video concepts I can adapt for my own channel in this niche?`

  await router.push({
    path: '/assistant',
    query: {
      prompt,
      channelTitle: `Trend: ${video.channelTitle}`
    }
  })
}

// Watchers
watch([selectedRegion, selectedCategory], () => {
  loadNicheVideos()
})

onMounted(() => {
  loadNicheVideos()
})
</script>

<template>
  <div class="py-8 px-4 sm:px-6 max-w-7xl mx-auto space-y-7">
    <!-- Header Hero -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-neutral-200 dark:border-neutral-800 pb-6">
      <div class="space-y-1.5">
        <div class="flex items-center gap-2 flex-wrap">
          <div class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary">
            <UIcon
              name="i-lucide-radar"
              class="size-3.5"
            />
            <span>Niche & Viral Radar</span>
          </div>
          <div class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <UIcon
              name="i-lucide-database"
              class="size-3"
            />
            <span>System Redis (24h Cache • 0 Quota)</span>
          </div>
        </div>
        <h1 class="text-3xl font-extrabold tracking-tight">
          Trending YouTube Radar
        </h1>
        <p class="text-sm text-muted max-w-2xl">
          Live feed of top 100 trending videos and breakout Shorts across major categories. Benchmark breakout velocity and uncover viral content hooks.
        </p>
      </div>

      <!-- Region Selector & Refresh -->
      <div class="flex items-center gap-3 shrink-0">
        <USelect
          v-model="selectedRegion"
          :items="regions"
          size="sm"
          class="w-48"
        />
        <UButton
          icon="i-lucide-refresh-cw"
          color="neutral"
          variant="subtle"
          size="sm"
          :loading="loading"
          title="Reload popular list"
          @click="loadNicheVideos(true)"
        />
      </div>
    </div>

    <!-- Category Pills Navigation -->
    <div class="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
      <button
        v-for="cat in categories"
        :key="cat.id"
        type="button"
        class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer border"
        :class="selectedCategory === cat.id
          ? 'bg-primary text-white border-primary shadow-xs'
          : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:border-neutral-400 dark:hover:border-neutral-600'"
        @click="selectedCategory = cat.id"
      >
        <UIcon
          :name="cat.icon"
          class="size-3.5"
        />
        <span>{{ cat.label }}</span>
      </button>
    </div>

    <!-- Filter & Menu Bar -->
    <div class="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-4 shadow-2xs space-y-4">
      <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <!-- Content Type Menu Tabs (All, Long-form, Shorts) -->
        <div class="inline-flex items-center p-1 bg-neutral-100 dark:bg-neutral-800/70 rounded-lg text-xs font-medium">
          <button
            type="button"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all cursor-pointer"
            :class="selectedType === 'all'
              ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white font-bold shadow-2xs'
              : 'text-muted hover:text-neutral-900 dark:hover:text-white'"
            @click="selectedType = 'all'"
          >
            <span>All Content</span>
            <span class="px-1.5 py-0.2 rounded-full text-[10px] bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300">
              {{ totalCount }}
            </span>
          </button>

          <button
            type="button"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all cursor-pointer"
            :class="selectedType === 'videos'
              ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white font-bold shadow-2xs'
              : 'text-muted hover:text-neutral-900 dark:hover:text-white'"
            @click="selectedType = 'videos'"
          >
            <UIcon
              name="i-lucide-play-square"
              class="size-3.5"
            />
            <span>Videos</span>
            <span class="px-1.5 py-0.2 rounded-full text-[10px] bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300">
              {{ longVideosCount }}
            </span>
          </button>

          <button
            type="button"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all cursor-pointer"
            :class="selectedType === 'shorts'
              ? 'bg-white dark:bg-neutral-900 text-red-600 dark:text-red-400 font-bold shadow-2xs'
              : 'text-muted hover:text-neutral-900 dark:hover:text-white'"
            @click="selectedType = 'shorts'"
          >
            <UIcon
              name="i-lucide-zap"
              class="size-3.5 text-red-500"
            />
            <span>Shorts</span>
            <span class="px-1.5 py-0.2 rounded-full text-[10px] bg-red-500/15 text-red-600 dark:text-red-400 font-bold">
              {{ shortsCount }}
            </span>
          </button>
        </div>

        <!-- Search & Sort Controls -->
        <div class="flex items-center gap-3 flex-wrap lg:flex-nowrap">
          <div class="w-full sm:w-64">
            <UInput
              v-model="searchQuery"
              icon="i-lucide-search"
              placeholder="Search title or channel..."
              size="sm"
            />
          </div>

          <div class="flex items-center gap-2 shrink-0">
            <span class="text-xs text-muted font-medium hidden sm:inline">Sort:</span>
            <USelect
              v-model="sortBy"
              :items="sortOptions"
              size="sm"
              class="w-52"
            />
          </div>
        </div>
      </div>

      <!-- Quick Summary Stats Bar -->
      <div
        v-if="!loading && filteredVideos.length > 0"
        class="pt-3 border-t border-neutral-100 dark:border-neutral-800/80 flex items-center justify-between flex-wrap gap-3 text-xs text-muted"
      >
        <div class="flex items-center gap-4 flex-wrap">
          <span>Showing <strong class="text-neutral-900 dark:text-white">{{ filteredVideos.length }}</strong> of {{ totalCount }} items</span>
          <span>•</span>
          <span>Avg views: <strong class="text-neutral-900 dark:text-white">{{ formatNumber(avgViews) }}</strong></span>
          <span>•</span>
          <span>Peak velocity: <strong class="text-red-500 font-semibold">{{ formatNumber(peakVelocity) }} views/h</strong></span>
        </div>

        <div class="text-[11px] text-muted flex items-center gap-1">
          <UIcon
            name="i-lucide-info"
            class="size-3.5"
          />
          <span>Click "Analyze" to inspect creator in Channel Analyzer</span>
        </div>
      </div>
    </div>

    <!-- Error Alert -->
    <UAlert
      v-if="error"
      color="error"
      icon="i-lucide-alert-circle"
      :title="error"
    />

    <!-- Loading Skeleton Grid -->
    <div
      v-if="loading"
      class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
    >
      <div
        v-for="i in 6"
        :key="i"
        class="space-y-3 p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900"
      >
        <USkeleton class="aspect-video w-full rounded-lg" />
        <USkeleton class="h-4 w-3/4 rounded" />
        <USkeleton class="h-3 w-1/2 rounded" />
        <div class="flex justify-between pt-2">
          <USkeleton class="h-3 w-20 rounded" />
          <USkeleton class="h-3 w-20 rounded" />
        </div>
      </div>
    </div>

    <!-- Video Grid -->
    <div
      v-else-if="filteredVideos.length > 0"
      class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
    >
      <UCard
        v-for="video in filteredVideos"
        :key="video.id"
        class="h-full flex flex-col overflow-hidden hover:border-neutral-400 dark:hover:border-neutral-700 hover:shadow-md transition-all group"
        :ui="{ body: 'flex flex-col flex-1 p-4' }"
      >
        <!-- Thumbnail Container -->
        <div class="relative shrink-0 overflow-hidden rounded-lg bg-neutral-100 dark:bg-neutral-800">
          <a
            :href="`https://www.youtube.com/watch?v=${video.id}`"
            target="_blank"
            rel="noopener"
            class="block aspect-video"
          >
            <img
              :src="video.thumbnail"
              :alt="video.title"
              loading="lazy"
              class="w-full h-full object-cover group-hover:scale-102 transition-transform duration-300"
            >
          </a>

          <!-- Top-Left Short Badge -->
          <div
            v-if="video.isShort"
            class="absolute top-2 left-2 inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-red-600 text-white shadow-xs"
          >
            <UIcon
              name="i-lucide-zap"
              class="size-3"
            />
            <span>SHORT</span>
          </div>

          <!-- Bottom-Right Duration Badge -->
          <div
            v-if="video.durationSeconds > 0"
            class="absolute bottom-2 right-2 px-1.5 py-0.5 rounded text-[11px] font-mono font-medium bg-black/80 text-white backdrop-blur-xs"
          >
            {{ formatDuration(video.durationSeconds) }}
          </div>

          <!-- Top-Right Velocity Badge -->
          <div
            class="absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border backdrop-blur-xs shadow-2xs"
            :class="getVelocityBadge(video.viewsPerHour).class"
          >
            <span>{{ getVelocityBadge(video.viewsPerHour).label }}</span>
          </div>
        </div>

        <!-- Title -->
        <h3
          class="font-semibold text-sm mt-3 line-clamp-2 h-10 leading-snug group-hover:text-primary transition-colors cursor-pointer"
          :title="video.title"
          @click="analyzeChannel(video.channelId)"
        >
          {{ video.title }}
        </h3>

        <!-- Creator & Upload Date -->
        <div class="flex items-center justify-between text-xs text-muted mt-2">
          <button
            type="button"
            class="font-medium hover:text-neutral-900 dark:hover:text-white truncate max-w-[170px] text-left transition-colors cursor-pointer flex items-center gap-1.5"
            :title="`Analyze ${video.channelTitle}`"
            @click="analyzeChannel(video.channelId)"
          >
            <span class="truncate">{{ video.channelTitle }}</span>
          </button>
          <span class="shrink-0 text-[11px]">{{ timeAgo(video.publishedAt) }}</span>
        </div>

        <!-- Metrics Row -->
        <div class="flex items-center gap-3.5 mt-3 mb-4 text-xs text-muted">
          <span class="flex items-center gap-1 font-medium text-neutral-800 dark:text-neutral-200">
            <UIcon
              name="i-lucide-eye"
              class="size-3.5 text-neutral-400"
            />
            {{ formatNumber(video.viewCount) }}
          </span>
          <span class="flex items-center gap-1">
            <UIcon
              name="i-lucide-thumbs-up"
              class="size-3.5 text-neutral-400"
            />
            {{ formatNumber(video.likeCount) }}
          </span>
          <span class="flex items-center gap-1">
            <UIcon
              name="i-lucide-message-circle"
              class="size-3.5 text-neutral-400"
            />
            {{ formatNumber(video.commentCount) }}
          </span>
        </div>

        <!-- Footer Actions Bar -->
        <div class="flex items-center justify-between gap-2 mt-auto pt-3 border-t border-neutral-100 dark:border-neutral-800/80">
          <!-- Button: Analyze Creator in Channel Analyzer -->
          <UButton
            label="Analyze Creator"
            icon="i-lucide-search"
            color="primary"
            variant="subtle"
            size="xs"
            class="font-semibold cursor-pointer"
            @click="analyzeChannel(video.channelId)"
          />

          <div class="flex items-center gap-1">
            <!-- Button: AI Strategy Chat Breakdown -->
            <button
              type="button"
              class="p-1.5 rounded-md text-neutral-500 hover:text-primary hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
              title="Break down why this is viral in AI Chat"
              @click="analyzeWithAi(video)"
            >
              <UIcon
                name="i-lucide-sparkles"
                class="size-4"
              />
            </button>

            <!-- Link: Open on YouTube -->
            <a
              :href="`https://www.youtube.com/watch?v=${video.id}`"
              target="_blank"
              rel="noopener"
              class="p-1.5 rounded-md text-neutral-500 hover:text-red-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              title="Watch on YouTube"
            >
              <UIcon
                name="i-lucide-external-link"
                class="size-4"
              />
            </a>
          </div>
        </div>
      </UCard>
    </div>

    <!-- Empty Filter State -->
    <div
      v-else-if="!loading && filteredVideos.length === 0"
      class="text-center py-16 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl space-y-3"
    >
      <div class="size-12 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mx-auto text-muted">
        <UIcon
          name="i-lucide-search-x"
          class="size-6"
        />
      </div>
      <h3 class="text-base font-bold">
        No videos match your criteria
      </h3>
      <p class="text-xs text-muted max-w-sm mx-auto">
        Try clearing your search query or switching to another category or content type.
      </p>
      <div class="pt-2">
        <UButton
          label="Reset filters"
          size="xs"
          variant="subtle"
          @click="searchQuery = ''; selectedType = 'all'"
        />
      </div>
    </div>
  </div>
</template>
