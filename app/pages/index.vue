<script setup lang="ts">
const store = useChannelStore()
const { loggedIn } = useUserSession()
</script>

<template>
  <div>
    <div
      v-if="loggedIn"
      class="py-8 px-4 sm:px-6 max-w-6xl mx-auto space-y-8"
    >
      <div :class="[!store.channel && !store.loading ? 'flex flex-col items-center text-center mt-12 mb-16' : 'space-y-4']">
        <div>
          <h1
            class="font-bold tracking-tight transition-all"
            :class="[!store.channel && !store.loading ? 'text-4xl' : 'text-2xl']"
          >
            Channel Analyzer
          </h1>
          <p
            class="text-muted transition-all mt-2"
            :class="[!store.channel && !store.loading ? 'text-base max-w-md mx-auto' : 'text-sm']"
          >
            Inspect any creator, competitor, or paste a YouTube URL to view in-depth performance.
          </p>
        </div>

        <div :class="[!store.channel && !store.loading ? 'max-w-2xl w-full mx-auto mt-8 space-y-3' : 'max-w-xl space-y-2']">
          <ChannelInput />

          <!-- Recent Searches Chips Bar -->
          <div
            v-if="store.recentSearches.length > 0 && !store.loading"
            class="flex items-center flex-wrap gap-2 pt-1"
            :class="[!store.channel ? 'justify-center' : 'justify-start']"
          >
            <span class="text-xs text-muted font-medium flex items-center gap-1">
              <UIcon
                name="i-lucide-history"
                class="size-3.5"
              />
              Recent:
            </span>
            <button
              v-for="recent in store.recentSearches"
              :key="recent.id"
              type="button"
              class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs transition-all cursor-pointer border"
              :class="store.channel?.id === recent.id
                ? 'bg-primary/10 border-primary text-primary font-bold shadow-2xs'
                : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:border-neutral-400 dark:hover:border-neutral-600'"
              @click="store.search(recent.handle || recent.id)"
            >
              <UAvatar
                :src="recent.thumbnail"
                :alt="recent.title"
                size="xs"
                class="size-4 shrink-0 rounded-full"
              />
              <span class="truncate max-w-[120px]">{{ recent.handle || recent.title }}</span>
            </button>
            <button
              type="button"
              class="text-[11px] text-muted hover:text-red-500 transition-colors cursor-pointer px-1"
              title="Clear recent searches"
              @click="store.clearRecentSearches()"
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      <UAlert
        v-if="store.error"
        color="error"
        icon="i-lucide-alert-circle"
        :title="store.error"
      />

      <div
        v-if="store.loading"
        class="space-y-6"
      >
        <USkeleton class="h-40 w-full rounded-lg" />
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <USkeleton
            v-for="i in 6"
            :key="i"
            class="h-64 rounded-lg"
          />
        </div>
      </div>

      <div
        v-if="!store.loading && store.channel"
        class="space-y-8"
      >
        <StatsOverview />
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
