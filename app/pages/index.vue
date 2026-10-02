<template>
  <UContainer class="py-10">
    <!-- Header -->
    <div class="text-center mb-8">
      <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary mb-3">
        <UIcon name="i-lucide-sparkles" class="size-3.5" />
        AI-Powered YouTube Intelligence
      </div>
      <h1 class="text-3xl font-bold tracking-tight">
        YouTube Niche Analyzer
      </h1>
      <p class="text-muted mt-2 max-w-lg mx-auto text-sm">
        Analyze creator velocity, diagnose outlier viral videos, and generate strategic growth insights.
      </p>
    </div>

    <!-- Search Bar -->
    <div class="max-w-xl mx-auto mb-10">
      <ChannelInput />
    </div>

    <!-- Error Alert -->
    <UAlert
      v-if="store.error"
      color="error"
      icon="i-lucide-alert-circle"
      :title="store.error"
      class="mb-6"
    />

    <!-- Loading skeleton -->
    <div v-if="store.loading" class="space-y-6">
      <USkeleton class="h-40 w-full rounded-lg" />
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <USkeleton v-for="i in 6" :key="i" class="h-64 rounded-lg" />
      </div>
    </div>

    <!-- Results Section -->
    <div v-if="!store.loading && store.channel" class="space-y-8">
      <StatsOverview />
      <AiInsightCard />
      <GrowthChart />
      <TopVideosList />
    </div>

    <!-- Empty State: Featured Niches & Channels -->
    <div v-else-if="!store.loading && !store.channel">
      <FeaturedNiches />
    </div>
  </UContainer>
</template>

<script setup lang="ts">
const store = useChannelStore()
</script>
