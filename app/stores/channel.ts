import { defineStore } from 'pinia'

interface ChannelData {
    id: string
    handle?: string
    title: string
    description: string
    thumbnail: string
    subscriberCount: number
    viewCount: number
    videoCount: number
}

interface VideoData {
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
    const channel = ref<ChannelData | null>(null)
    const videos = ref<VideoData[]>([])
    const loading = ref(false)
    const loadingMore = ref(false)
    const noMoreVideos = ref(false)
    const error = ref<string | null>(null)
    const insight = ref<string | null>(null)
    const insightLoading = ref(false)

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


    const BATCH_SIZE = 9

    async function search(handle: string) {
        loading.value = true
        loadingMore.value = false
        noMoreVideos.value = false
        error.value = null
        channel.value = null
        videos.value = []

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
        } catch (err: any) {
            error.value = err?.data?.statusMessage
                || err?.statusMessage
                || 'Error while searching'
        } finally {
            loading.value = false
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
        insight,
        insightLoading,
        fetchInsight
    }
})


