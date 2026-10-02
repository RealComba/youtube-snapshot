<script setup lang="ts">
const store = useChannelStore()

interface FeaturedCreator {
  handle: string
  name: string
  niche: 'Tech' | 'Viral' | 'Finance' | 'Education'
  avatar: string
  subs: string
  highlight: string
}

const activeCategory = ref<'All' | 'Tech' | 'Viral' | 'Finance' | 'Education'>('All')

const creators: FeaturedCreator[] = [
  {
    handle: '@mkbhd',
    name: 'Marques Brownlee',
    niche: 'Tech',
    avatar: 'https://unavatar.io/youtube/mkbhd',
    subs: '19M+',
    highlight: 'Clean aesthetic, gadget benchmarks & high production value'
  },
  {
    handle: '@MrBeast',
    name: 'MrBeast',
    niche: 'Viral',
    avatar: 'https://unavatar.io/youtube/MrBeast',
    subs: '350M+',
    highlight: 'High retention pacing, curiosity hooks & extreme challenges'
  },
  {
    handle: '@veritasium',
    name: 'Veritasium',
    niche: 'Education',
    avatar: 'https://unavatar.io/youtube/veritasium',
    subs: '16M+',
    highlight: 'Deep inquiry, scientific misconceptions & long-tail search'
  },
  {
    handle: '@Fireship',
    name: 'Fireship',
    niche: 'Tech',
    avatar: 'https://unavatar.io/youtube/Fireship',
    subs: '3.5M+',
    highlight: 'Ultra-fast pacing, code in 100 seconds & meme velocity'
  },
  {
    handle: '@AliAbdaal',
    name: 'Ali Abdaal',
    niche: 'Finance',
    avatar: 'https://unavatar.io/youtube/AliAbdaal',
    subs: '5.8M+',
    highlight: 'Productivity workflows, passive income & book breakdowns'
  },
  {
    handle: '@RyanTrahan',
    name: 'Ryan Trahan',
    niche: 'Viral',
    avatar: 'https://unavatar.io/youtube/RyanTrahan',
    subs: '16.5M+',
    highlight: 'Penny challenge storytelling & authentic audience connection'
  }
]

const filteredCreators = computed(() => {
  if (activeCategory.value === 'All') return creators
  return creators.filter(c => c.niche === activeCategory.value)
})

function selectCreator(handle: string) {
  store.search(handle)
}
</script>

<template>
  <div class="mt-12 space-y-6">
    <div class="text-center space-y-2">
      <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
        <UIcon name="i-lucide-flame" class="size-3.5" />
        Explore High-Performing Niches
      </div>
      <h2 class="text-xl font-bold">Trending Creators & Benchmark Channels</h2>
      <p class="text-sm text-muted max-w-lg mx-auto">
        Click any channel to immediately analyze their audience velocity, Shorts vs long-form ratio, and AI diagnosis.
      </p>
    </div>

    <!-- Category Filters -->
    <div class="flex items-center justify-center gap-2 flex-wrap">
      <UButton
        v-for="cat in (['All', 'Tech', 'Viral', 'Finance', 'Education'] as const)"
        :key="cat"
        :label="cat"
        size="xs"
        :color="activeCategory === cat ? 'primary' : 'neutral'"
        :variant="activeCategory === cat ? 'solid' : 'subtle'"
        @click="activeCategory = cat"
      />
    </div>

    <!-- Creator Cards -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <div
        v-for="creator in filteredCreators"
        :key="creator.handle"
        class="cursor-pointer group"
        @click="selectCreator(creator.handle)"
      >
        <UCard class="h-full transition-all group-hover:border-primary/50 group-hover:shadow-md">
          <div class="flex items-start justify-between gap-3">
            <div class="flex items-center gap-3">
              <UAvatar
                :src="creator.avatar"
                :alt="creator.name"
                size="lg"
                class="ring-2 ring-neutral-200 dark:ring-neutral-800 group-hover:ring-primary transition-all"
              />
              <div>
                <h3 class="font-bold text-sm group-hover:text-primary transition-colors">
                  {{ creator.name }}
                </h3>
                <p class="text-xs text-muted">{{ creator.handle }}</p>
              </div>
            </div>

            <UBadge :label="creator.niche" color="neutral" variant="subtle" size="xs" />
          </div>

          <p class="text-xs text-muted mt-3 line-clamp-2">
            {{ creator.highlight }}
          </p>

          <div class="mt-4 pt-3 border-t border-neutral-100 dark:border-neutral-800/80 flex items-center justify-between text-xs">
            <span class="font-semibold text-primary">{{ creator.subs }} subs</span>
            <span class="text-muted flex items-center gap-1 group-hover:text-primary transition-colors">
              Analyze Channel
              <UIcon name="i-lucide-arrow-right" class="size-3 group-hover:translate-x-0.5 transition-transform" />
            </span>
          </div>
        </UCard>
      </div>
    </div>
  </div>
</template>
