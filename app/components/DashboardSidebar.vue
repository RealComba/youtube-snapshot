<script setup lang="ts">
const { user, clear } = useUserSession()
const route = useRoute()

const navLinks = [
    {
        label: 'Channel Analyzer',
        to: '/',
        icon: 'i-lucide-search',
        description: 'Inspect any creator or competitor'
    },
    {
        label: 'My Channel Studio',
        to: '/my-channel',
        icon: 'i-simple-icons-youtube',
        description: 'Your synced YouTube analytics'
    },
    {
        label: 'Channel Compare',
        to: '/compare',
        icon: 'i-lucide-git-compare-arrows',
        description: 'Side-by-side head-to-head metrics'
    },
    {
        label: 'Niche Explorer',
        to: '/niches',
        icon: 'i-lucide-compass',
        description: 'Top niches & creator benchmarks'
    },
    {
        label: 'AI Strategy Chat',
        to: '/assistant',
        icon: 'i-lucide-sparkles',
        badge: 'AI',
        description: 'Custom growth ideas with Gemini'
    }
]

const ytQuota = ref<{ limit: number, remaining: number, totalUsed: number, percentUsed: number } | null>(null)
const aiQuota = ref<{ limit: number, remaining: number, totalUsed: number } | null>(null)

async function refreshQuotas() {
    if (!user.value) return
    try {
        const [yt, ai] = await Promise.allSettled([
            $fetch<{ limit: number, remaining: number, totalUsed: number, percentUsed: number }>('/api/yt-quota'),
            $fetch<{ limit: number, remaining: number, totalUsed: number }>('/api/ai-quota')
        ])
        if (yt.status === 'fulfilled') ytQuota.value = yt.value
        if (ai.status === 'fulfilled') aiQuota.value = ai.value
    } catch {
    }
}

onMounted(() => {
    refreshQuotas()
    if (import.meta.client) {
        window.addEventListener('quota-updated', refreshQuotas)
    }
})

onUnmounted(() => {
    if (import.meta.client) {
        window.removeEventListener('quota-updated', refreshQuotas)
    }
})

watch(() => route.fullPath, () => {
    refreshQuotas()
})
</script>

<template>
    <aside class="w-70 border-r border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 flex flex-col
  justify-between shrink-0 h-screen sticky top-0 backdrop-blur-sm">
        <div class="p-4 space-y-6">
            <div class="flex items-center justify-between px-2">
                <NuxtLink to="/" class="flex items-center gap-2 font-bold text-lg">
                    <UIcon name="i-lucide-bar-chart-3" class="size-6 text-primary" />
                    <span>YT Analyzer</span>
                </NuxtLink>
                <UBadge label="Beta" color="primary" variant="subtle" size="md" />
            </div>

            <nav class="space-y-1">
                <NuxtLink v-for="link in navLinks" :key="link.to" :to="link.to"
                    class="flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors"
                    :class="route.path === link.to
                        ? 'bg-primary/10 text-primary font-semibold'
                        : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800/60'">
                    <div class="flex items-center gap-3">
                        <UIcon :name="link.icon" class="size-4 shrink-0" />
                        <span>{{ link.label }}</span>
                    </div>
                    <UBadge v-if="link.badge" :label="link.badge" size="xs"
                        :color="link.badge === 'AI' ? 'primary' : 'neutral'" variant="subtle" />
                </NuxtLink>
            </nav>
        </div>

        

        <div class="p-4 border-t border-neutral-200 dark:border-neutral-800">
            <UPopover mode="click" :popper="{ placement: 'right-end' }" class="w-full">
                <div class="flex items-center justify-between gap-2 p-2 -mx-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer cursor-pointer">
                    <div class="flex items-center gap-2.5 min-w-0">
                        <UAvatar :src="user?.image || undefined" :alt="user?.name || 'User'" size="sm" />
                        <div class="min-w-0">
                            <p class="text-xs font-bold truncate">{{ user?.name || 'Creator' }}</p>
                            <p class="text-[10px] text-muted truncate">{{ user?.email }}</p>
                        </div>
                    </div>
                </div>
                
                <template #content>
                    <div class="w-64 p-4 flex flex-col gap-4">
                        <div class="flex items-center justify-between text-xs border-b border-neutral-100 dark:border-neutral-800 pb-2">
                            <span class="font-bold text-neutral-700 dark:text-neutral-300">Daily Quotas</span>
                            <span class="text-[10px] text-muted">Reset 00:00 UTC</span>
                        </div>

                        <!-- YouTube API Quota -->
                        <div class="space-y-1.5">
                            <div class="flex items-center justify-between text-xs">
                                <span class="text-muted flex items-center gap-1.5">
                                    <UIcon name="i-simple-icons-youtube" class="size-3.5 text-red-500" />
                                    <span>YouTube API</span>
                                </span>
                                <span class="font-semibold text-neutral-800 dark:text-neutral-200">
                                    {{ ytQuota?.remaining ?? 300 }} / {{ ytQuota?.limit ?? 300 }}
                                </span>
                            </div>
                            <div class="h-1.5 rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
                                <div
                                    class="h-full rounded-full bg-red-500 transition-all duration-300"
                                    :style="{ width: `${Math.max(4, ((ytQuota?.remaining ?? 300) / (ytQuota?.limit ?? 300)) * 100)}%` }"
                                />
                            </div>
                        </div>

                        <!-- Gemini AI Quota -->
                        <div class="space-y-1.5">
                            <div class="flex items-center justify-between text-xs">
                                <span class="text-muted flex items-center gap-1.5">
                                    <UIcon name="i-lucide-sparkles" class="size-3.5 text-primary" />
                                    <span>Gemini AI</span>
                                </span>
                                <span class="font-semibold text-neutral-800 dark:text-neutral-200">
                                    {{ aiQuota?.remaining ?? 30 }} / {{ aiQuota?.limit ?? 30 }}
                                </span>
                            </div>
                            <div class="h-1.5 rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
                                <div
                                    class="h-full rounded-full bg-primary transition-all duration-300"
                                    :style="{ width: `${Math.max(4, ((aiQuota?.remaining ?? 30) / (aiQuota?.limit ?? 30)) * 100)}%` }"
                                />
                            </div>
                        </div>
                        
                        <div class="pt-3 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
                             <UColorModeButton size="xs" />
                             <UButton label="Sign out" icon="i-lucide-log-out" color="neutral" variant="ghost" size="xs" @click="clear" />
                        </div>
                    </div>
                </template>
            </UPopover>
        </div>
    </aside>
</template>
