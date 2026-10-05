import { defineStore } from 'pinia'

interface ChannelData {
    id: string
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
    const error = ref<string | null>(null)
    const insight = ref<string | null>(null)
    const insightLoading = ref(false)

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


    async function search(handle: string) {
        loading.value = true
        error.value = null
        channel.value = null
        videos.value = []

        try {
            const channelData = await $fetch<ChannelData>('/api/channel', {
                params: { handle }
            })
            channel.value = channelData

            const videosData = await $fetch<VideoData[]>('/api/videos', {
                params: { channelId: channelData.id, maxResults: 50 }
            })
            videos.value = videosData
        } catch (err: any) {
            error.value = err?.data?.statusMessage
                || err?.statusMessage
                || 'Error while searching'
        } finally {
            loading.value = false
        }
    }


    const avgViews = computed(() => {
        if (videos.value.length === 0) return 0
        const total = videos.value.reduce((sum, v) => sum + v.viewCount, 0)
        return Math.round(total / videos.value.length)
    })


    return { channel, videos, loading, error, search, avgViews, insight, insightLoading, fetchInsight }
})


