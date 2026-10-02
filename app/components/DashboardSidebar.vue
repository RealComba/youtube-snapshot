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
        badge: 'Connected',
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
</script>

<template>
    <aside class="w-64 border-r border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 flex flex-col
  justify-between shrink-0 min-h-screen">
        <div class="p-4 space-y-6">
            <div class="flex items-center justify-between px-2">
                <NuxtLink to="/" class="flex items-center gap-2 font-bold text-lg">
                    <UIcon name="i-lucide-bar-chart-3" class="size-6 text-primary" />
                    <span>YT Analyzer</span>
                </NuxtLink>
                <UBadge label="Pro" color="primary" variant="subtle" size="xs" />
            </div>

            <div v-if="user?.ownChannel"
                class="p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-xs space-y-2">
                <div class="flex items-center gap-2.5">
                    <UAvatar :src="user.ownChannel.thumbnail" :alt="user.ownChannel.title" size="sm" />
                    <div class="min-w-0 flex-1">
                        <p class="text-xs font-bold truncate">{{ user.ownChannel.title }}</p>
                        <p class="text-[10px] text-muted truncate">
                            {{ user.ownChannel.handle || 'Synced Channel' }}
                        </p>
                    </div>
                </div>
                <div
                    class="flex items-center gap-1.5 pt-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                    <span class="size-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span>Channel Sync Active</span>
                </div>
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

        <div class="p-4 border-t border-neutral-200 dark:border-neutral-800 space-y-3">
            <div class="flex items-center justify-between gap-2 px-1">
                <div class="flex items-center gap-2.5 min-w-0">
                    <UAvatar :src="user?.image || undefined" :alt="user?.name || 'User'" size="sm" />
                    <div class="min-w-0">
                        <p class="text-xs font-bold truncate">{{ user?.name || 'Creator' }}</p>
                        <p class="text-[10px] text-muted truncate">{{ user?.email }}</p>
                    </div>
                </div>
                <UColorModeButton size="xs" />
            </div>

            <UButton label="Sign out" icon="i-lucide-log-out" color="neutral" variant="ghost" size="xs" block
                @click="clear" />
        </div>
    </aside>
</template>
