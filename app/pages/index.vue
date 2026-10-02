<script setup lang="ts">
const store = useChannelStore()
const { loggedIn, user } = useUserSession()

onMounted(() => {
  if (loggedIn.value && !store.channel && !store.loading) {
    const target = user.value?.ownChannel?.handle || user.value?.ownChannel?.id || '@mkbhd'
    store.search(target)
  }
})
</script>

<template>
  <div>
    <div v-if="loggedIn" class="py-8 px-4 sm:px-6 max-w-6xl mx-auto space-y-8">
      <div class="space-y-4">
        <div>
          <h1 class="text-2xl font-bold tracking-tight">Channel Analyzer</h1>
          <p class="text-sm text-muted">Inspect any creator, competitor, or paste a YouTube URL to view in-depth
            performance.</p>
        </div>
        <div class="max-w-xl">
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
