<script setup lang="ts">
const store = useChannelStore()
const { loggedIn, user } = useUserSession()


onMounted(() => {
    // Clear any previously searched channel when entering the analyzer
    if (store.channel) {
        store.channel = null
        store.videos = []
    }
})
</script>

<template>
  <div>
    <div v-if="loggedIn" class="py-8 px-4 sm:px-6 max-w-6xl mx-auto space-y-8">
      <div :class="[!store.channel && !store.loading ? 'flex flex-col items-center text-center mt-12 mb-16' : 'space-y-4']">
        <div>
          <h1 class="font-bold tracking-tight transition-all" :class="[!store.channel && !store.loading ? 'text-4xl' : 'text-2xl']">Channel Analyzer</h1>
          <p class="text-muted transition-all mt-2" :class="[!store.channel && !store.loading ? 'text-base max-w-md mx-auto' : 'text-sm']">Inspect any creator, competitor, or paste a YouTube URL to view in-depth
            performance.</p>
        </div>
        <div :class="[!store.channel && !store.loading ? 'max-w-2xl w-full mx-auto mt-8' : 'max-w-xl']">
          <ChannelInput />
        </div>
      </div>

      <UAlert v-if="store.error" color="error" icon="i-lucide-alert-circle" :title="store.error" />

      <div v-if="store.loading" class="space-y-6">
        <USkeleton class="h-40 w-full rounded-lg" />
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <USkeleton v-for="i in 6" :key="i" class="h-64 rounded-lg" />
        </div>
      </div>

      <div v-if="!store.loading && store.channel" class="space-y-8">
        <StatsOverview />
        <AiInsightCard />
        <GrowthChart />
        <TopVideosList />
      </div>

      <div v-else-if="!store.loading && !store.channel">
        <FeaturedNiches />
      </div>
    </div>

    <div v-else>
      <ProductLandingCarousel />
    </div>
  </div>
</template>
