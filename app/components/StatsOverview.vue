<script setup lang="ts">
const store = useChannelStore()

function formatNumber(n: number): string {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') +
        'M'
    if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K'
    return n.toString()
}
</script>

<template>
    <UCard v-if="store.channel">
        <div class="flex items-center gap-4 mb-6">
            <UAvatar :src="store.channel.thumbnail" :alt="store.channel.title" size="xl" />
            <div>
                <h2 class="text-xl font-bold">
                    {{ store.channel.title }}
                </h2>
                <p class="text-sm text-muted line-clamp-2">
                    {{ store.channel.description }}
                </p>
            </div>
        </div>

        <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div class="text-center">
                <p class="text-2xl font-bold text-primary">
                    {{ formatNumber(store.channel.subscriberCount) }}
                </p>
                <p class="text-sm text-muted">
                    Iscritti
                </p>
            </div>

            <div class="text-center">
                <p class="text-2xl font-bold text-primary">
                    {{ formatNumber(store.channel.viewCount) }}
                </p>
                <p class="text-sm text-muted">
                    Views totali
                </p>
            </div>

            <div class="text-center">
                <p class="text-2xl font-bold text-primary">
                    {{ formatNumber(store.channel.videoCount) }}
                </p>
                <p class="text-sm text-muted">
                    Video
                </p>
            </div>

            <div class="text-center">
                <p class="text-2xl font-bold text-primary">
                    {{ formatNumber(store.avgViews) }}
                </p>
                <p class="text-sm text-muted">
                    Media views
                </p>
            </div>
        </div>
    </UCard>
</template>
