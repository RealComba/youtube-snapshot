import { defineStore } from 'pinia'

export interface ChannelData {
  id: string
  handle?: string
  title: string
  description: string
  thumbnail: string
  subscriberCount: number
  viewCount: number
  videoCount: number
}

export interface VideoData {
  id: string
  title: string
  description: string
  publishedAt: string
  thumbnail: string
  viewCount: number
  likeCount: number
  commentCount: number
  durationSeconds: number
  isShort: boolean
}

export const useChannelStore = defineStore('channel', () => {
  // 1. Searched channel state (for Channel Analyzer / index.vue)
  const channel = ref<ChannelData | null>(null)
  const videos = ref<VideoData[]>([])
  const loading = ref(false)
  const loadingMore = ref(false)
  const noMoreVideos = ref(false)
  const error = ref<string | null>(null)
  const insight = ref<string | null>(null)
  const insightLoading = ref(false)

  // 2. Own channel state (for My Channel / my-channel.vue - separated so they don't overwrite each other)
  const ownChannel = ref<ChannelData | null>(null)
  const ownVideos = ref<VideoData[]>([])
  const ownLoading = ref(false)

  // 3. In-memory cache of channels: key = lowercased handle/id
  const channelCache = ref<Record<string, { channel: ChannelData, videos: VideoData[] }>>({})

  // 4. Recent searches list (persisted in localStorage)
  const recentSearches = ref<ChannelData[]>([])

  const BATCH_SIZE = 9

  // Initialize recent searches from localStorage on client
  if (import.meta.client) {
    try {
      const saved = localStorage.getItem('yt_recent_searches')
      if (saved) {
        recentSearches.value = JSON.parse(saved)
      }
    } catch (e) {
      console.warn('Failed to parse recent searches from localStorage', e)
    }
  }

  function saveRecentSearches() {
    if (!import.meta.client) return
    try {
      localStorage.setItem('yt_recent_searches', JSON.stringify(recentSearches.value))
    } catch (e) {
      console.warn('Failed to save recent searches', e)
    }
  }

  function addRecentSearch(ch: ChannelData) {
    const filtered = recentSearches.value.filter(item => item.id !== ch.id)
    filtered.unshift(ch)
    recentSearches.value = filtered.slice(0, 8)
    saveRecentSearches()
  }

  function removeRecentSearch(channelId: string) {
    recentSearches.value = recentSearches.value.filter(item => item.id !== channelId)
    saveRecentSearches()
  }

  function clearRecentSearches() {
    recentSearches.value = []
    saveRecentSearches()
  }

  function normalizeKey(str: string): string {
    return str.trim().toLowerCase().replace(/^@/, '')
  }

  const hasMoreVideos = computed(() => {
    if (!channel.value || noMoreVideos.value) return false
    if (videos.value.length >= 50) return false
    if (channel.value.videoCount && videos.value.length >= channel.value.videoCount) return false
    return true
  })

  async function fetchInsight() {
    insightLoading.value = true
    insight.value = null
    try {
      const data = await $fetch<{ insight: string }>('/api/insight', {
        method: 'POST',
        body: {
          channel: channel.value,
          videos: videos.value
        }
      })
      insight.value = data.insight
    } catch {
      insight.value = null
    } finally {
      insightLoading.value = false
    }
  }

  // Search a channel in Analyzer
  async function search(handle: string, forceRefresh = false) {
    const key = normalizeKey(handle)
    loading.value = true
    loadingMore.value = false
    noMoreVideos.value = false
    error.value = null

    // Check in-memory cache first if not forceRefresh
    if (!forceRefresh && channelCache.value[key]) {
      const cached = channelCache.value[key]!
      channel.value = cached.channel
      videos.value = cached.videos
      addRecentSearch(cached.channel)
      loading.value = false
      return
    }

    try {
      const channelData = await $fetch<ChannelData>('/api/channel', {
        params: { handle }
      })
      channel.value = channelData

      const videosData = await $fetch<VideoData[]>('/api/videos', {
        params: { channelId: channelData.id, maxResults: BATCH_SIZE }
      })
      videos.value = videosData
      if (videosData.length < BATCH_SIZE) {
        noMoreVideos.value = true
      }

      // Cache in memory by both handle and channel id
      const cacheEntry = { channel: channelData, videos: videosData }
      channelCache.value[normalizeKey(channelData.id)] = cacheEntry
      if (channelData.handle) {
        channelCache.value[normalizeKey(channelData.handle)] = cacheEntry
      }
      channelCache.value[key] = cacheEntry

      addRecentSearch(channelData)
    } catch (err: any) {
      error.value = err?.data?.statusMessage
        || err?.statusMessage
        || 'Error while searching'
    } finally {
      loading.value = false
    }
  }

  // Load user's own channel (used in my-channel.vue) - Caches in ownChannel so it NEVER calls API twice!
  async function loadOwnChannel(target: string, forceRefresh = false) {
    if (!forceRefresh && ownChannel.value) {
      // Already loaded! Zero network calls.
      return
    }

    ownLoading.value = true
    try {
      const channelData = await $fetch<ChannelData>('/api/channel', {
        params: { handle: target }
      })
      ownChannel.value = channelData

      const videosData = await $fetch<VideoData[]>('/api/videos', {
        params: { channelId: channelData.id, maxResults: BATCH_SIZE }
      })
      ownVideos.value = videosData

      // Also cache in memory
      const cacheEntry = { channel: channelData, videos: videosData }
      channelCache.value[normalizeKey(channelData.id)] = cacheEntry
      if (channelData.handle) {
        channelCache.value[normalizeKey(channelData.handle)] = cacheEntry
      }
    } catch (err: any) {
      console.error('Error loading own channel:', err)
    } finally {
      ownLoading.value = false
    }
  }

  async function loadMoreVideos() {
    if (!channel.value || loadingMore.value || !hasMoreVideos.value) return
    loadingMore.value = true
    try {
      const nextLimit = Math.min(videos.value.length + BATCH_SIZE, 50)
      const videosData = await $fetch<VideoData[]>('/api/videos', {
        params: { channelId: channel.value.id, maxResults: nextLimit }
      })
      if (videosData.length <= videos.value.length || videosData.length < nextLimit) {
        noMoreVideos.value = true
      }
      videos.value = videosData

      // Update in-memory cache
      if (channel.value) {
        const key = normalizeKey(channel.value.id)
        if (channelCache.value[key]) {
          channelCache.value[key]!.videos = videosData
        }
      }
    } catch (err) {
      console.error('Error loading more videos:', err)
    } finally {
      loadingMore.value = false
    }
  }

  const avgViews = computed(() => {
    if (videos.value.length === 0) return 0
    const total = videos.value.reduce((sum, v) => sum + v.viewCount, 0)
    return Math.round(total / videos.value.length)
  })

  const ownAvgViews = computed(() => {
    if (ownVideos.value.length === 0) return 0
    const total = ownVideos.value.reduce((sum, v) => sum + v.viewCount, 0)
    return Math.round(total / ownVideos.value.length)
  })

  return {
    channel,
    videos,
    loading,
    loadingMore,
    noMoreVideos,
    hasMoreVideos,
    error,
    search,
    loadMoreVideos,
    avgViews,
    ownChannel,
    ownVideos,
    ownLoading,
    ownAvgViews,
    loadOwnChannel,
    recentSearches,
    removeRecentSearch,
    clearRecentSearches,
    insight,
    insightLoading,
    fetchInsight
  }
})
