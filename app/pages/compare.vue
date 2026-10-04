<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const { formatNumber } = useFormatters()

interface ChannelData {
  id: string
  title: string
  description: string
  thumbnail: string
  subscriberCount: number
  viewCount: number
  videoCount: number
}

const handleA = ref('')
const handleB = ref('')
const channelA = ref<ChannelData | null>(null)
const channelB = ref<ChannelData | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)

const insightA = ref<string | null>(null)
const insightB = ref<string | null>(null)
const insightLoadingA = ref(false)
const insightLoadingB = ref(false)

async function compare() {
  if (!handleA.value.trim() || !handleB.value.trim()) return
  loading.value = true
  error.value = null
  channelA.value = null
  channelB.value = null
  insightA.value = null
  insightB.value = null

  try {
    const [a, b] = await Promise.all([
      $fetch<ChannelData>('/api/channel', { params: { handle: handleA.value.trim() } }),
      $fetch<ChannelData>('/api/channel', { params: { handle: handleB.value.trim() } })
    ])
    channelA.value = a
    channelB.value = b
  } catch (err: any) {
    error.value = err?.data?.statusMessage || 'Error while comparing channels'
  } finally {
    loading.value = false
  }
}

async function fetchInsight(side: 'a' | 'b') {
  const ch = side === 'a' ? channelA.value : channelB.value
  if (!ch) return

  if (side === 'a') insightLoadingA.value = true
  else insightLoadingB.value = true

  try {
    const videos = await $fetch<any[]>('/api/videos', {
      params: { channelId: ch.id, maxResults: 10 }
    })
    const data = await $fetch<{ insight: string }>('/api/insight', {
      method: 'POST',
      body: { channel: ch, videos }
    })
    if (side === 'a') insightA.value = data.insight
    else insightB.value = data.insight
  } catch {
    // silent fail
  } finally {
    if (side === 'a') insightLoadingA.value = false
    else insightLoadingB.value = false
  }
}

function winner(metric: 'subscriberCount' | 'viewCount' | 'videoCount' | 'avgViews') {
  if (!channelA.value || !channelB.value) return null
  const a = metric === 'avgViews'
    ? channelA.value.viewCount / (channelA.value.videoCount || 1)
    : channelA.value[metric]
  const b = metric === 'avgViews'
    ? channelB.value.viewCount / (channelB.value.videoCount || 1)
    : channelB.value[metric]
  if (a > b) return 'a'
  if (b > a) return 'b'
  return null
}

function barPercent(a: number, b: number) {
  const total = a + b
  if (total === 0) return 50
  return (a / total) * 100
}

function getLeadBadge(higher: number, lower: number): string {
  if (!lower || lower === 0) return 'Dominant'
  const ratio = higher / lower
  if (ratio >= 1.1) {
    return `+${ratio.toFixed(1)}x`
  }
  return 'Ahead'
}
</script>

<template>
  <UContainer class="py-10">
    <div class="text-center mb-8">
      <h1 class="text-3xl font-bold">Compare Channels</h1>
      <p class="text-muted mt-2">Put two YouTube channels head-to-head</p>
    </div>

    <!-- Input Form -->
    <form class="max-w-2xl mx-auto mb-10" @submit.prevent="compare">
      <div class="flex items-center gap-3">
        <UInput v-model="handleA" placeholder="@first_channel" icon="i-lucide-search" size="xl" class="flex-1"
          :disabled="loading" />
        <span class="text-muted font-bold text-sm">VS</span>
        <UInput v-model="handleB" placeholder="@second_channel" icon="i-lucide-search" size="xl" class="flex-1"
          :disabled="loading" />
        <UButton type="submit" label="Compare" icon="i-lucide-git-compare-arrows" size="xl" :loading="loading" />
      </div>
    </form>

    <UAlert v-if="error" color="error" icon="i-lucide-alert-circle" :title="error" class="mb-6" />

    <div v-if="loading" class="grid grid-cols-2 gap-6">
      <USkeleton class="h-48 rounded-lg" />
      <USkeleton class="h-48 rounded-lg" />
    </div>

    <!-- Results -->
    <div v-if="!loading && channelA && channelB" class="space-y-6">
      <!-- Channel cards side by side -->
      <div class="grid grid-cols-2 gap-6">
        <!-- Channel A (Emerald Theme) -->
        <UCard class="border-t-4 border-t-emerald-500">
          <div class="flex items-center gap-3 mb-3">
            <UAvatar :src="channelA.thumbnail" :alt="channelA.title" size="lg" class="ring-2 ring-emerald-500/30" />
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <span class="size-2 rounded-full bg-emerald-500 inline-block"></span>
                <h3 class="text-lg font-bold truncate">{{ channelA.title }}</h3>
              </div>
              <p class="text-sm text-muted line-clamp-2 mt-0.5">{{ channelA.description }}</p>
            </div>
          </div>

          <div class="grid grid-cols-3 gap-3 text-center mt-4 pt-3 border-t border-neutral-100 dark:border-neutral-800">
            <div>
              <p class="text-xl font-bold" :class="winner('subscriberCount') === 'a' ? 'text-emerald-500 font-extrabold' : 'text-neutral-500'">
                {{ formatNumber(channelA.subscriberCount) }}
              </p>
              <p class="text-xs text-muted">Subscribers</p>
            </div>
            <div>
              <p class="text-xl font-bold" :class="winner('viewCount') === 'a' ? 'text-emerald-500 font-extrabold' : 'text-neutral-500'">
                {{ formatNumber(channelA.viewCount) }}
              </p>
              <p class="text-xs text-muted">Total Views</p>
            </div>
            <div>
              <p class="text-xl font-bold" :class="winner('videoCount') === 'a' ? 'text-emerald-500 font-extrabold' : 'text-neutral-500'">
                {{ formatNumber(channelA.videoCount) }}
              </p>
              <p class="text-xs text-muted">Videos</p>
            </div>
          </div>

          <!-- AI Insight A -->
          <div class="mt-4">
            <USkeleton v-if="insightLoadingA" class="h-16 w-full rounded-md" />
            <p v-else-if="insightA" class="text-sm leading-relaxed whitespace-pre-line text-neutral-700 dark:text-neutral-300">{{ insightA }}</p>
            <UButton v-else label="AI Snapshot" icon="i-lucide-sparkles" size="sm" variant="soft" block
              @click="fetchInsight('a')" />
          </div>
        </UCard>

        <!-- Channel B (Indigo Theme) -->
        <UCard class="border-t-4 border-t-indigo-500">
          <div class="flex items-center gap-3 mb-3">
            <UAvatar :src="channelB.thumbnail" :alt="channelB.title" size="lg" class="ring-2 ring-indigo-500/30" />
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <span class="size-2 rounded-full bg-indigo-500 inline-block"></span>
                <h3 class="text-lg font-bold truncate">{{ channelB.title }}</h3>
              </div>
              <p class="text-sm text-muted line-clamp-2 mt-0.5">{{ channelB.description }}</p>
            </div>
          </div>

          <div class="grid grid-cols-3 gap-3 text-center mt-4 pt-3 border-t border-neutral-100 dark:border-neutral-800">
            <div>
              <p class="text-xl font-bold" :class="winner('subscriberCount') === 'b' ? 'text-indigo-500 font-extrabold' : 'text-neutral-500'">
                {{ formatNumber(channelB.subscriberCount) }}
              </p>
              <p class="text-xs text-muted">Subscribers</p>
            </div>
            <div>
              <p class="text-xl font-bold" :class="winner('viewCount') === 'b' ? 'text-indigo-500 font-extrabold' : 'text-neutral-500'">
                {{ formatNumber(channelB.viewCount) }}
              </p>
              <p class="text-xs text-muted">Total Views</p>
            </div>
            <div>
              <p class="text-xl font-bold" :class="winner('videoCount') === 'b' ? 'text-indigo-500 font-extrabold' : 'text-neutral-500'">
                {{ formatNumber(channelB.videoCount) }}
              </p>
              <p class="text-xs text-muted">Videos</p>
            </div>
          </div>

          <!-- AI Insight B -->
          <div class="mt-4">
            <USkeleton v-if="insightLoadingB" class="h-16 w-full rounded-md" />
            <p v-else-if="insightB" class="text-sm leading-relaxed whitespace-pre-line text-neutral-700 dark:text-neutral-300">{{ insightB }}</p>
            <UButton v-else label="AI Snapshot" icon="i-lucide-sparkles" size="sm" variant="soft" block
              @click="fetchInsight('b')" />
          </div>
        </UCard>
      </div>

      <!-- Comparative Head-to-Head Section -->
      <UCard>
        <!-- Header with colored badges -->
        <div class="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-4 mb-6">
          <div class="flex items-center gap-2.5">
            <span class="size-3 rounded-full bg-emerald-500 ring-4 ring-emerald-500/20"></span>
            <span class="font-bold text-base truncate max-w-[220px] text-emerald-600 dark:text-emerald-400">
              {{ channelA.title }}
            </span>
          </div>

          <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-neutral-100 dark:bg-neutral-800 text-muted">
            <UIcon name="i-lucide-swords" class="size-3.5" />
            Head-to-head
          </div>

          <div class="flex items-center gap-2.5">
            <span class="font-bold text-base truncate max-w-[220px] text-right text-indigo-600 dark:text-indigo-400">
              {{ channelB.title }}
            </span>
            <span class="size-3 rounded-full bg-indigo-500 ring-4 ring-indigo-500/20"></span>
          </div>
        </div>

        <!-- Metrics comparison rows -->
        <div class="space-y-6">
          <div
            v-for="metric in [
              { key: 'subscriberCount' as const, label: 'Subscribers', vA: channelA.subscriberCount, vB: channelB.subscriberCount },
              { key: 'viewCount' as const, label: 'Total Views', vA: channelA.viewCount, vB: channelB.viewCount },
              { key: 'videoCount' as const, label: 'Videos Uploaded', vA: channelA.videoCount, vB: channelB.videoCount },
              { key: 'avgViews' as const, label: 'Avg Views / Video', vA: Math.round(channelA.viewCount / (channelA.videoCount || 1)), vB: Math.round(channelB.viewCount / (channelB.videoCount || 1)) }
            ]"
            :key="metric.key"
            class="space-y-2.5"
          >
            <!-- Label in center, numbers on sides -->
            <div class="flex items-center justify-between">
              <!-- Channel A (Emerald) -->
              <div class="flex items-center gap-2">
                <span
                  class="text-xl font-bold tracking-tight"
                  :class="winner(metric.key) === 'a' ? 'text-emerald-500 font-extrabold' : 'text-neutral-500 dark:text-neutral-400'"
                >
                  {{ formatNumber(metric.vA) }}
                </span>
                <span
                  v-if="winner(metric.key) === 'a'"
                  class="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                >
                  {{ getLeadBadge(metric.vA, metric.vB) }}
                </span>
              </div>

              <!-- Metric Center Title -->
              <span class="text-xs font-bold uppercase tracking-wider text-muted">
                {{ metric.label }}
              </span>

              <!-- Channel B (Indigo) -->
              <div class="flex items-center gap-2">
                <span
                  v-if="winner(metric.key) === 'b'"
                  class="text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20"
                >
                  {{ getLeadBadge(metric.vB, metric.vA) }}
                </span>
                <span
                  class="text-xl font-bold tracking-tight"
                  :class="winner(metric.key) === 'b' ? 'text-indigo-500 font-extrabold' : 'text-neutral-500 dark:text-neutral-400'"
                >
                  {{ formatNumber(metric.vB) }}
                </span>
              </div>
            </div>

            <!-- Segmented Dual-Color Bar (Emerald vs Indigo) -->
            <div class="h-3.5 rounded-full overflow-hidden flex p-1 bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 gap-1">
              <!-- Left side (Channel A - Emerald) -->
              <div
                class="h-full rounded-full bg-emerald-500 transition-all duration-500"
                :style="{ width: `${barPercent(metric.vA, metric.vB)}%` }"
              />

              <!-- Right side (Channel B - Indigo) -->
              <div
                class="h-full rounded-full bg-indigo-500 transition-all duration-500"
                :style="{ width: `${100 - barPercent(metric.vA, metric.vB)}%` }"
              />
            </div>
          </div>
        </div>
      </UCard>
    </div>
  </UContainer>
</template>