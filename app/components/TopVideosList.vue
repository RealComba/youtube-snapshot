<script setup lang="ts">
const store = useChannelStore()

function formatNumber(n: number): string {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') +
        'M'
    if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K'
    return n.toString()
}

function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('it-IT', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    })
}

function formatDuration(seconds: number): string {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
}
</script>

<template>
    <div v-if="store.videos.length > 0">
        <h3 class="text-lg font-semibold mb-4">
            Ultimi video
        </h3>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <UCard v-for="video in store.videos" :key="video.id" class="overflow-hidden">
                <div class="relative">
                    <img :src="video.thumbnail" :alt="video.title" class="w-full aspect-video object-cover rounded-md">
                    <UBadge :label="formatDuration(video.durationSeconds)" color="neutral" variant="solid"
                        class="absolute bottom-2 right-2" />
                    <UBadge v-if="video.isShort" label="Short" color="error" variant="solid"
                        class="absolute top-2 left-2" />
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
            </UCard>
        </div>
    </div>
</template>