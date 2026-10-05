<script setup lang="ts">
import { button } from '#build/ui'

definePageMeta({ middleware: 'auth' })

const { formatNumber } = useFormatters()
const { user } = useUserSession()
const channelStore = useChannelStore()

function useMyChannel() {
  const ownChannel = user.value?.ownChannel
  if (!ownChannel) return 

  if (!handleA.value.trim()) {
    handleA.value = ownChannel.handle || ownChannel.id
  } else if (!handleB.value.trim()) {
    handleB.value = ownChannel.handle || ownChannel.id
  } else {
    handleB.value = ownChannel.handle || ownChannel.id
  }

  if (handleA.value && handleB.value) {
    compare()
  }
}

function clearAll() {
  handleA.value = ''
  handleB.value = ''
  channelA.value = null
  channelB.value = null
  insightA.value = null
  insightB.value = null
  error.value = null
  lastCompared.value = null
}

const ownChannelHandle = computed(() => {
  const ownChannel = user.value?.ownChannel
  return ownChannel?.handle || ownChannel?.id || ''
})


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
  if (!canCompare.value) return
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
    lastCompared.value = { a: cleanA.value, b: cleanB.value }
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

const comparisonPresets = [
  { label: 'Airrack vs Jakidale', a: '@airrack', b: '@jakidale', badge: 'Creator Showdown' },
  { label: 'MrBeast vs T-Series', a: '@MrBeast', b: '@tseries', badge: 'Global Scale' },
  { label: 'MKBHD vs Dave2D', a: '@mkbhd', b: '@Dave2D', badge: 'Tech Reviews' },
  { label: 'Veritasium vs Mark Rober', a: '@veritasium', b: '@MarkRober', badge: 'STEM' },
  { label: 'Fireship vs ThePrimeTime', a: '@Fireship', b: '@ThePrimeTimeagen', badge: 'Devs' }
]

const cleanA = computed(() => handleA.value.trim().toLowerCase().replace(/^@/, ''))
const cleanB = computed(() => handleB.value.trim().toLowerCase().replace(/^@/, ''))

const isSameChannel = computed(() => {
  return cleanA.value !== '' && cleanA.value === cleanB.value
})

const isMyChannelSelected = computed(() => {
  if (!ownChannelHandle.value) return false
  const own = ownChannelHandle.value.toLowerCase().replace(/^@/, '')
  return cleanA.value === own || cleanB.value === own
})

const lastCompared = ref<{ a: string; b: string } | null>(null)

const canCompare = computed(() => {
  if (!cleanA.value || !cleanB.value) return false
  if (isSameChannel.value) return false
  if (loading.value) return false
  if (lastCompared.value && lastCompared.value.a === cleanA.value && lastCompared.value.b === cleanB.value) {
    return false
  }
  return true
})

function selectPreset(preset: typeof comparisonPresets[number]) {
  handleA.value = preset.a
  handleB.value = preset.b
  compare()
}

function handleEnterCompare() {
  if (canCompare.value) {
    compare()
  }
}
</script>

<template>
  <UContainer class="py-10">
    <div class="text-center mb-6">
      <h1 class="text-3xl font-bold">Compare Channels</h1>
      <p class="text-muted mt-2">Put two YouTube channels head-to-head</p>
    </div>

    <!-- Popular Rivalries (Sopra gli input, rimosso solo quando ricerco / caricato) -->
    <div v-if="!loading && (!channelA || !channelB)" class="max-w-2xl mx-auto mb-6 flex flex-wrap items-center justify-center gap-2">
      <span class="text-xs text-muted flex items-center gap-1 font-medium mr-1">
        <UIcon name="i-lucide-zap" class="size-3.5 text-primary" />
        Popular Rivalries:
      </span>
      <button v-for="preset in comparisonPresets" :key="preset.label" type="button" class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs border border-neutral-200
            dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-primary/50 hover:bg-primary/5 transition-all
            cursor-pointer font-medium" @click="selectPreset(preset)">
        <span>{{ preset.label }}</span>
        <span class="text-[10px] text-muted font-normal">({{ preset.badge }})</span>
      </button>
    </div>

    <!-- Area Controllo (max-w-3xl standard) -->
    <!-- STATO 1: Pre-ricerca canale (!channelA || !channelB) -->
    <div v-if="!channelA || !channelB" class="max-w-3xl mx-auto mb-8 space-y-4 flex items-center justify-center flex-col">
      <!-- Symmetrical Row: Slot A | VS (Centro esatto) | Slot B -->
      <div class="flex items-center gap-3 w-full">
        <!-- Slot A (h-10) -->
        <div class="flex-1 h-10 px-3 rounded-lg border flex items-center transition-all"
          :class="channelA || handleA === ownChannelHandle ? 'border-blue-500 bg-blue-500/5 dark:bg-blue-500/10' : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 focus-within:border-blue-500'">
          <div v-if="channelA || handleA === ownChannelHandle" class="flex items-center justify-between gap-2 w-full">
            <div class="flex items-center gap-2 min-w-0">
              <UAvatar :src="channelA?.thumbnail || (handleA === ownChannelHandle ? user?.ownChannel?.thumbnail : undefined)"
                :alt="handleA" size="xs" class="ring-1 ring-blue-500/30 shrink-0" />
              <div class="min-w-0">
                <p class="text-xs font-bold text-blue-600 dark:text-blue-400 truncate leading-tight">{{ channelA?.title || user?.ownChannel?.title || handleA }}</p>
                <p class="text-[10px] text-muted truncate leading-tight">{{ handleA }}</p>
              </div>
            </div>
            <UButton icon="i-lucide-x" size="xs" color="neutral" variant="ghost" class="shrink-0" @click="handleA = ''; channelA = null; lastCompared = null" />
          </div>
          <div v-else class="flex items-center gap-2 w-full">
            <UIcon name="i-lucide-search" class="size-4 text-muted shrink-0" />
            <input v-model="handleA" placeholder="@first_channel" class="w-full bg-transparent text-sm focus:outline-none placeholder:text-muted" @keydown.enter.prevent="handleEnterCompare" />
          </div>
        </div>

        <!-- VS (size-7, discreto al centro esatto) -->
        <div class="flex-shrink-0 flex items-center justify-center size-7 rounded-full bg-neutral-100 dark:bg-neutral-800 text-muted font-bold text-[11px] border border-neutral-200 dark:border-neutral-700">
          VS
        </div>

        <!-- Slot B (h-10) -->
        <div class="flex-1 h-10 px-3 rounded-lg border flex items-center transition-all"
          :class="channelB || handleB === ownChannelHandle ? 'border-rose-500 bg-rose-500/5 dark:bg-rose-500/10' : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 focus-within:border-rose-500'">
          <div v-if="channelB || handleB === ownChannelHandle" class="flex items-center justify-between gap-2 w-full">
            <div class="flex items-center gap-2 min-w-0">
              <UAvatar :src="channelB?.thumbnail || (handleB === ownChannelHandle ? user?.ownChannel?.thumbnail : undefined)"
                :alt="handleB" size="xs" class="ring-1 ring-rose-500/30 shrink-0" />
              <div class="min-w-0">
                <p class="text-xs font-bold text-rose-500 truncate leading-tight">{{ channelB?.title || user?.ownChannel?.title || handleB }}</p>
                <p class="text-[10px] text-muted truncate leading-tight">{{ handleB }}</p>
              </div>
            </div>
            <UButton icon="i-lucide-x" size="xs" color="neutral" variant="ghost" class="shrink-0" @click="handleB = ''; channelB = null; lastCompared = null" />
          </div>
          <div v-else class="flex items-center gap-2 w-full">
            <UIcon name="i-lucide-search" class="size-4 text-muted shrink-0" />
            <input v-model="handleB" placeholder="@second_channel" class="w-full bg-transparent text-sm focus:outline-none placeholder:text-muted" @keydown.enter.prevent="handleEnterCompare" />
          </div>
        </div>
      </div>

      <!-- BOTTONI IN FILA AL CENTRO (Pre-ricerca) -->
      <div class="flex items-center justify-center gap-3 pt-1">

        <UButton
          label="Compare Channels"
          icon="i-lucide-git-compare-arrows"
          size="sm"
          :color="canCompare ? 'primary' : 'neutral'"
          :variant="canCompare ? 'solid' : 'subtle'"
          :loading="loading"
          :disabled="!canCompare"
          class="h-9 px-5 font-semibold shadow-xs transition-all w-[170px]"
          :class="!canCompare ? 'opacity-60 cursor-not-allowed' : ''"
          @click="compare"
        />

        <UButton
          v-if="user?.ownChannel"
          :label="isMyChannelSelected ? 'Channel Added' : 'Use My Channel'"
          icon="i-lucide-user"
          variant="subtle"
          size="sm"
          :color="isMyChannelSelected ? 'neutral' : 'primary'"
          :disabled="isMyChannelSelected"
          class="h-9 px-7 font-medium transition-all w-[170px]"
          :class="isMyChannelSelected ? 'opacity-60 cursor-not-allowed' : ''"
          @click="useMyChannel"
        />
      </div>

      <UButton v-if="handleA || handleB" label="Clear" variant="ghost" color="neutral" size="sm"
        class="h-9 px-4 font-medium" @click="clearAll" />

      <!-- Avviso canali duplicati (Anti-spreco Redis) -->

    </div>

    <!-- STATO 2: Post-ricerca canale (channelA && channelB trovati) -> Barra compatta in alto -->
    <div v-else class="max-w-3xl mx-auto mb-8">
      <div class="flex items-center gap-2.5 w-full">
        <!-- Slot A (h-10) -->
        <div class="flex-1 h-10 px-3 rounded-lg border flex items-center transition-all border-blue-500 bg-blue-500/5 dark:bg-blue-500/10">
          <div class="flex items-center justify-between gap-2 w-full">
            <div class="flex items-center gap-2 min-w-0">
              <UAvatar :src="channelA?.thumbnail" :alt="handleA" size="xs" class="ring-1 ring-blue-500/30 shrink-0" />
              <div class="min-w-0">
                <p class="text-xs font-bold text-blue-600 dark:text-blue-400 truncate leading-tight">{{ channelA?.title }}</p>
                <p class="text-[10px] text-muted truncate leading-tight">{{ handleA }}</p>
              </div>
            </div>
            <UButton icon="i-lucide-x" size="xs" color="neutral" variant="ghost" class="shrink-0" @click="handleA = ''; channelA = null; lastCompared = null" />
          </div>
        </div>

        <!-- VS -->
        <div class="flex-shrink-0 flex items-center justify-center size-7 rounded-full bg-neutral-100 dark:bg-neutral-800 text-muted font-bold text-[11px] border border-neutral-200 dark:border-neutral-700">
          VS
        </div>

        <!-- Slot B (h-10) -->
        <div class="flex-1 h-10 px-3 rounded-lg border flex items-center transition-all border-rose-500 bg-rose-500/5 dark:bg-rose-500/10">
          <div class="flex items-center justify-between gap-2 w-full">
            <div class="flex items-center gap-2 min-w-0">
              <UAvatar :src="channelB?.thumbnail" :alt="handleB" size="xs" class="ring-1 ring-rose-500/30 shrink-0" />
              <div class="min-w-0">
                <p class="text-xs font-bold text-rose-500 truncate leading-tight">{{ channelB?.title }}</p>
                <p class="text-[10px] text-muted truncate leading-tight">{{ handleB }}</p>
              </div>
            </div>
            <UButton icon="i-lucide-x" size="xs" color="neutral" variant="ghost" class="shrink-0" @click="handleB = ''; channelB = null; lastCompared = null" />
          </div>
        </div>

        <!-- Azioni Compatte a fine riga (Clear + Compare Inattivo) -->
        <div class="flex items-center gap-2 shrink-0">
          <UButton label="Clear" variant="ghost" color="neutral" size="md" @click="clearAll" />
          <UButton
            label="Compare"
            icon="i-lucide-git-compare-arrows"
            size="md"
            :color="canCompare ? 'primary' : 'neutral'"
            :variant="canCompare ? 'solid' : 'subtle'"
            :loading="loading"
            :disabled="!canCompare"
            class="transition-all"
            :class="!canCompare ? 'opacity-60 cursor-not-allowed' : ''"
            @click="compare"
          />
        </div>
      </div>
    </div>

    <UAlert v-if="error" color="error" icon="i-lucide-alert-circle" :title="error" class="mb-6 max-w-3xl mx-auto" />

    <div v-if="loading" class="grid grid-cols-2 gap-6 mb-6">
      <USkeleton class="h-48 rounded-lg" />
      <USkeleton class="h-48 rounded-lg" />
    </div>

    <!-- Results -->
    <div v-if="!loading && channelA && channelB" class="space-y-6">

      <!-- Channel cards side by side -->
      <div class="grid grid-cols-2 gap-6">
        <!-- Channel A (Blue Theme) -->
        <UCard class="border-t-4 border-t-blue-500">
          <div class="flex items-center gap-3 mb-3">
            <UAvatar :src="channelA.thumbnail" :alt="channelA.title" size="lg" class="ring-2 ring-blue-500/30" />
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <span class="size-2 rounded-full bg-blue-500 inline-block"></span>
                <h3 class="text-lg font-bold truncate">{{ channelA.title }}</h3>
              </div>
              <p class="text-sm text-muted line-clamp-2 mt-0.5">{{ channelA.description }}</p>
            </div>
          </div>

          <div class="grid grid-cols-3 gap-3 text-center mt-4 pt-3 border-t border-neutral-100 dark:border-neutral-800">
            <div>
              <p class="text-xl font-bold" :class="winner('subscriberCount') === 'a' ? 'text-blue-500 font-extrabold' : 'text-neutral-500'">
                {{ formatNumber(channelA.subscriberCount) }}
              </p>
              <p class="text-xs text-muted">Subscribers</p>
            </div>
            <div>
              <p class="text-xl font-bold" :class="winner('viewCount') === 'a' ? 'text-blue-500 font-extrabold' : 'text-neutral-500'">
                {{ formatNumber(channelA.viewCount) }}
              </p>
              <p class="text-xs text-muted">Total Views</p>
            </div>
            <div>
              <p class="text-xl font-bold" :class="winner('videoCount') === 'a' ? 'text-blue-500 font-extrabold' : 'text-neutral-500'">
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
        <UCard class="border-t-4 border-t-rose-500">
          <div class="flex items-center gap-3 mb-3">
            <UAvatar :src="channelB.thumbnail" :alt="channelB.title" size="lg" class="ring-2 ring-rose-500/30" />
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <span class="size-2 rounded-full bg-rose-500 inline-block"></span>
                <h3 class="text-lg font-bold truncate">{{ channelB.title }}</h3>
              </div>
              <p class="text-sm text-muted line-clamp-2 mt-0.5">{{ channelB.description }}</p>
            </div>
          </div>

          <div class="grid grid-cols-3 gap-3 text-center mt-4 pt-3 border-t border-neutral-100 dark:border-neutral-800">
            <div>
              <p class="text-xl font-bold" :class="winner('subscriberCount') === 'b' ? 'text-rose-500 font-extrabold' : 'text-neutral-500'">
                {{ formatNumber(channelB.subscriberCount) }}
              </p>
              <p class="text-xs text-muted">Subscribers</p>
            </div>
            <div>
              <p class="text-xl font-bold" :class="winner('viewCount') === 'b' ? 'text-rose-500 font-extrabold' : 'text-neutral-500'">
                {{ formatNumber(channelB.viewCount) }}
              </p>
              <p class="text-xs text-muted">Total Views</p>
            </div>
            <div>
              <p class="text-xl font-bold" :class="winner('videoCount') === 'b' ? 'text-rose-500 font-extrabold' : 'text-neutral-500'">
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
            <span class="size-3 rounded-full bg-blue-500 ring-4 ring-blue-500/20"></span>
            <span class="font-bold text-base truncate max-w-[220px] text-blue-600 dark:text-blue-400">
              {{ channelA.title }}
            </span>
          </div>

          <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-neutral-100 dark:bg-neutral-800 text-muted">
            <UIcon name="i-lucide-swords" class="size-3.5" />
            Head-to-head
          </div>

          <div class="flex items-center gap-2.5">
            <span class="font-bold text-base truncate max-w-[220px] text-right text-rose-600 dark:text-rose-400">
              {{ channelB.title }}
            </span>
            <span class="size-3 rounded-full bg-rose-500 ring-4 ring-rose-500/20"></span>
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
              <!-- Channel A (Blue) -->
              <div class="flex items-center gap-2">
                <span
                  class="text-xl font-bold tracking-tight"
                  :class="winner(metric.key) === 'a' ? 'text-blue-500 font-extrabold' : 'text-neutral-500 dark:text-neutral-400'"
                >
                  {{ formatNumber(metric.vA) }}
                </span>
                <span
                  v-if="winner(metric.key) === 'a'"
                  class="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
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
                  class="text-[11px] font-bold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                >
                  {{ getLeadBadge(metric.vB, metric.vA) }}
                </span>
                <span
                  class="text-xl font-bold tracking-tight"
                  :class="winner(metric.key) === 'b' ? 'text-rose-500 font-extrabold' : 'text-neutral-500 dark:text-neutral-400'"
                >
                  {{ formatNumber(metric.vB) }}
                </span>
              </div>
            </div>

            <!-- Segmented Dual-Color Bar (Blue vs Indigo) -->
            <div class="h-3.5 rounded-full overflow-hidden flex p-1 bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 gap-1">
              <!-- Left side (Channel A - Blue) -->
              <div
                class="h-full rounded-full bg-blue-500 transition-all duration-500"
                :style="{ width: `${barPercent(metric.vA, metric.vB)}%` }"
              />

              <!-- Right side (Channel B - Indigo) -->
              <div
                class="h-full rounded-full bg-rose-500 transition-all duration-500"
                :style="{ width: `${100 - barPercent(metric.vA, metric.vB)}%` }"
              />
            </div>
          </div>
        </div>
      </UCard>
    </div>
  </UContainer>
</template>