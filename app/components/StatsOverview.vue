<script setup lang="ts">
const store = useChannelStore()
const { formatNumber } = useFormatters()
const { user } = useUserSession()

function navigateToAiChat() {
  if (!store.channel) return

  const channel = store.channel
  let resolvedHandle = channel.handle
  if (!resolvedHandle && user.value?.ownChannel?.id === channel.id && user.value.ownChannel.handle) {
    resolvedHandle = user.value.ownChannel.handle
  }
  const handleStr = resolvedHandle
    ? (resolvedHandle.startsWith('@') ? resolvedHandle : `@${resolvedHandle}`)
    : `@${channel.title.toLowerCase().replace(/\s+/g, '')}`

  const sessionTitle = resolvedHandle ? `${channel.title} (${handleStr})` : channel.title

  const prompt = `Act as an elite YouTube Strategy Coach & Growth Consultant (VidIQ Pro & Think Media caliber). Please generate a comprehensive, deep-dive growth analysis for the YouTube channel "${channel.title}" (${handleStr}):

[Channel Overview & Real-Time Metrics]
- Channel Display Name: ${channel.title}
- Channel Handle: ${handleStr}
- Subscribers: ${channel.subscriberCount.toLocaleString()}
- Total Lifetime Views: ${channel.viewCount.toLocaleString()}
- Total Uploads: ${channel.videoCount.toLocaleString()}
- Average Views per Recent Upload: ${store.avgViews.toLocaleString()}

Please deliver an in-depth strategic breakdown:
1. Channel Velocity & Market Scale: Evaluate this creator's current audience momentum, reach, and positioning in their niche.
2. Content Strategy & Format Synergy: Provide concrete recommendations on their upload cadence, optimal pacing, and Shorts vs Long-form leverage.
3. Retention & Hook Psychology: First 15-30 second retention hook formulas, title curiosity gaps, and thumbnail contrast strategies tailored to their topic.
4. Actionable Growth Blueprint: Provide 5 concrete video title concepts with hook blueprints, and 3 immediate strategic priorities to scale to the next milestone.

Maintain your signature data-driven, practical, and punchy tone with clear Markdown sections.`

  navigateTo({
    path: '/assistant',
    query: {
      prompt,
      channelTitle: sessionTitle
    }
  })
}
</script>

<template>
  <UCard v-if="store.channel" class="overflow-hidden">
    <!-- Channel Header & Actions -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-6 border-b border-neutral-100 dark:border-neutral-800">
      <div class="flex items-start sm:items-center gap-4 min-w-0">
        <UAvatar
          :src="store.channel.thumbnail"
          :alt="store.channel.title"
          size="xl"
          class="ring-2 ring-primary/20 shrink-0 size-16"
        />
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2 flex-wrap">
            <h2 class="text-xl sm:text-2xl font-bold tracking-tight truncate">
              {{ store.channel.title }}
            </h2>
            <UBadge
              v-if="store.channel.handle"
              :label="store.channel.handle.startsWith('@') ? store.channel.handle : `@${store.channel.handle}`"
              color="neutral"
              variant="subtle"
              size="xs"
              class="font-mono text-xs"
            />
          </div>
          <p class="text-sm text-muted line-clamp-2 mt-1 max-w-2xl">
            {{ store.channel.description || 'No description provided for this channel.' }}
          </p>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="flex items-center gap-2 shrink-0 self-start md:self-center">
        <a
          :href="`https://youtube.com/channel/${store.channel.id}`"
          target="_blank"
          rel="noopener noreferrer"
        >
          <UButton
            icon="i-lucide-external-link"
            label="YouTube"
            color="neutral"
            variant="subtle"
            size="sm"
          />
        </a>

        <!-- Primary AI Deep Dive CTA -->
        <UButton
          icon="i-lucide-sparkles"
          label="Analyze in AI Chat"
          color="primary"
          variant="solid"
          size="sm"
          class="font-semibold shadow-xs cursor-pointer"
          @click="navigateToAiChat"
        />
      </div>
    </div>

    <!-- Metrics Grid -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      <!-- Subscribers -->
      <div class="bg-neutral-50 dark:bg-neutral-800/40 rounded-xl p-4 border border-neutral-200/60 dark:border-neutral-800/80 transition-all hover:border-red-500/30">
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs font-medium text-muted uppercase tracking-wider">Subscribers</span>
          <div class="p-1.5 rounded-lg bg-red-500/10 text-red-500">
            <UIcon name="i-lucide-users" class="size-4" />
          </div>
        </div>
        <p class="text-2xl font-bold text-neutral-900 dark:text-neutral-50 tracking-tight">
          {{ formatNumber(store.channel.subscriberCount) }}
        </p>
        <span class="text-[11px] text-muted">Audience size</span>
      </div>

      <!-- Total Views -->
      <div class="bg-neutral-50 dark:bg-neutral-800/40 rounded-xl p-4 border border-neutral-200/60 dark:border-neutral-800/80 transition-all hover:border-blue-500/30">
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs font-medium text-muted uppercase tracking-wider">Total Views</span>
          <div class="p-1.5 rounded-lg bg-blue-500/10 text-blue-500">
            <UIcon name="i-lucide-eye" class="size-4" />
          </div>
        </div>
        <p class="text-2xl font-bold text-neutral-900 dark:text-neutral-50 tracking-tight">
          {{ formatNumber(store.channel.viewCount) }}
        </p>
        <span class="text-[11px] text-muted">Lifetime impressions</span>
      </div>

      <!-- Total Videos -->
      <div class="bg-neutral-50 dark:bg-neutral-800/40 rounded-xl p-4 border border-neutral-200/60 dark:border-neutral-800/80 transition-all hover:border-amber-500/30">
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs font-medium text-muted uppercase tracking-wider">Videos</span>
          <div class="p-1.5 rounded-lg bg-amber-500/10 text-amber-500">
            <UIcon name="i-lucide-video" class="size-4" />
          </div>
        </div>
        <p class="text-2xl font-bold text-neutral-900 dark:text-neutral-50 tracking-tight">
          {{ formatNumber(store.channel.videoCount) }}
        </p>
        <span class="text-[11px] text-muted">Published uploads</span>
      </div>

      <!-- Avg Views / Upload -->
      <div class="bg-neutral-50 dark:bg-neutral-800/40 rounded-xl p-4 border border-neutral-200/60 dark:border-neutral-800/80 transition-all hover:border-emerald-500/30">
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs font-medium text-muted uppercase tracking-wider">Avg Views</span>
          <div class="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500">
            <UIcon name="i-lucide-trending-up" class="size-4" />
          </div>
        </div>
        <p class="text-2xl font-bold text-neutral-900 dark:text-neutral-50 tracking-tight">
          {{ formatNumber(store.avgViews) }}
        </p>
        <span class="text-[11px] text-muted">Per recent upload</span>
      </div>
    </div>
  </UCard>
</template>
