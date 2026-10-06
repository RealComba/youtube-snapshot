<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const { user } = useUserSession()
const store = useChannelStore()

onMounted(() => {
  if (user.value?.ownChannel) {
    const target = user.value.ownChannel.handle || user.value.ownChannel.id
    if (target && store.channel?.id !== user.value.ownChannel.id) {
      store.search(target)
    }
  }
})
</script>

<template>
  <div class="py-8 px-4 sm:px-6 max-w-6xl mx-auto space-y-8">
    <!-- Header -->
    <div class="flex items-center justify-between flex-wrap gap-4 border-b border-neutral-200 dark:border-neutral-800 pb-5">
      <div>
        <div class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-red-500/10 text-red-500 mb-2">
          <UIcon name="i-simple-icons-youtube" class="size-3.5" />
          My Creator Studio
        </div>
        <h1 class="text-2xl font-bold tracking-tight">Your Channel Overview</h1>
        <p class="text-sm text-muted">Real-time performance, recent uploads, and AI growth diagnosis for your channel.</p>
      </div>

      <div v-if="user?.ownChannel" class="flex items-center gap-2">
        <a :href="`https://youtube.com/channel/${user.ownChannel.id}`" target="_blank" rel="noopener">
          <UButton label="View on YouTube" icon="i-lucide-external-link" variant="subtle" size="sm" />
        </a>
      </div>
    </div>

    <!-- If user has a linked YouTube channel -->
    <template v-if="user?.ownChannel">
      <!-- Loading Skeleton -->
      <div v-if="store.loading" class="space-y-6">
        <USkeleton class="h-40 w-full rounded-lg" />
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <USkeleton v-for="i in 6" :key="i" class="h-64 rounded-lg" />
        </div>
      </div>

      <!-- Channel Analytics Section -->
      <div v-else-if="store.channel" class="space-y-8">
        <StatsOverview />
        <TopVideosList />
      </div>
    </template>

    <!-- If user has no YouTube channel on this account -->
    <UCard v-else class="text-center py-12 max-w-lg mx-auto">
      <div class="space-y-4">
        <div class="size-12 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mx-auto text-muted">
          <UIcon name="i-simple-icons-youtube" class="size-6 text-neutral-400" />
        </div>
        <h3 class="text-lg font-bold">No YouTube Channel Connected</h3>
        <p class="text-sm text-muted leading-relaxed">
          It looks like your Google account (<strong>{{ user?.email }}</strong>) doesn't have an active YouTube channel yet, or permission was not granted.
        </p>
        <div class="pt-2">
          <NuxtLink to="/">
            <UButton label="Analyze other channels" icon="i-lucide-search" color="primary" variant="subtle" />
          </NuxtLink>
        </div>
      </div>
    </UCard>
  </div>
</template>
