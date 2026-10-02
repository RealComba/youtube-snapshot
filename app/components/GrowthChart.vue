<script setup lang="ts">

interface Snapshot {
    subscriberCount: number
    viewCount: number
    videoCount: number
    capturedAt: string
}

const store = useChannelStore()
const { formatNumber } = useFormatters()



const snapshots = ref<Snapshot[]>([])
const loading = ref(false)
const activeMetric = ref<'subscriberCount' | 'viewCount'>('subscriberCount')

async function fetchHistory() {
    if (!store.channel) return
    loading.value = true
    try {
        const data = await $fetch<Snapshot[]>('/api/history', {
            params: { channelId: store.channel.id }
        })
        snapshots.value = data
    } catch {
        snapshots.value = []
    } finally {
        loading.value = false
    }
}

watch(() => store.channel?.id, (id) => {
    if (id) fetchHistory()
})

const chartWidth = 600
const chartHeight = 200
const padding = 40

const points = computed(() => {
    if (snapshots.value.length < 2) return []

    const data = snapshots.value.map(s => s[activeMetric.value])
    const min = Math.min(...data)
    const max = Math.max(...data)
    const range = max - min || 1

    return snapshots.value.map((s, i) => {
        const x = padding + (i / (snapshots.value.length - 1)) * (chartWidth - padding * 2)
        const y = chartHeight - padding - ((s[activeMetric.value] - min) / range) * (chartHeight -
            padding * 2)
        return { x, y, value: s[activeMetric.value], date: s.capturedAt }
    })
})

const polyline = computed(() => points.value.map(p => `${p.x},${p.y}`).join(' '))

const areaPath = computed(() => {
    if (points.value.length < 2) return ''
    const first = points.value[0]!
    const last = points.value[points.value.length - 1]!
    return `M${first.x},${chartHeight - padding} L${polyline.value.split(' ').join(' L')} L${last.
        x},${chartHeight - padding} Z`
})

function formatShortDate(iso: string) {
    return new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })
}

const metricOptions = [
    { label: 'Subscribers', value: 'subscriberCount' },
    { label: 'Views', value: 'viewCount' }
]
</script>

<template>
    <UCard v-if="!loading && snapshots.length >= 2">
        <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-2">
                <UIcon name="i-lucide-trending-up" class="size-5 text-primary" />
                <h3 class="font-semibold">Growth Trend</h3>
            </div>
            <USelect v-model="activeMetric" :items="metricOptions" size="sm" />
        </div>

        <svg :viewBox="`0 0 ${chartWidth} ${chartHeight}`" class="w-full h-48">
            <path :d="areaPath" class="fill-primary/10" />

            <polyline :points="polyline" fill="none" class="stroke-primary" stroke-width="2" stroke-linejoin="round" />

            <g v-for="(point, i) in points" :key="i">
                <circle :cx="point.x" :cy="point.y" r="4" class="fill-primary stroke-white dark:stroke-neutral-900"
                    stroke-width="2" />
                <text v-if="i === 0 || i === points.length - 1" :x="point.x" :y="chartHeight - 10" text-anchor="middle"
                    class="fill-neutral-500 text-[11px]">
                    {{ formatShortDate(point.date) }}
                </text>
                <text v-if="i === 0 || i === points.length - 1" :x="point.x" :y="point.y - 12" text-anchor="middle"
                    class="fill-neutral-600 dark:fill-neutral-400 text-[11px] font-medium">
                    {{ formatNumber(point.value) }}
                </text>
            </g>
        </svg>

        <p class="text-xs text-muted text-center mt-2">
            {{ snapshots.length }} snapshot.
        </p>
    </UCard>

    <UCard v-else-if="!loading && store.channel && snapshots.length < 2">
        <div class="flex items-center gap-2 text-sm text-muted">
            <UIcon name="i-lucide-trending-up" class="size-5" />
            <span>The growth trend will be available after more snapshots. Come back to search this channel in the next few days!</span>
        </div>
    </UCard>
</template>
