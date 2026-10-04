<script setup lang="ts">
const { loggedIn } = useUserSession()

useHead({
  meta: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1' },
    { name: 'referrer', content: 'no-referrer' }
  ],
  link: [
    { rel: 'icon', href: '/favicon.ico' }
  ],
  htmlAttrs: {
    lang: 'en'
  }
})

useSeoMeta({
  title: 'YT Analyzer — VidIQ-like AI YouTube Intelligence',
  description: 'Analyze creator velocity, uncover outlier viral videos, and generate strategic growth insights.',
  ogTitle: 'YT Analyzer — VidIQ-like AI YouTube Intelligence',
  ogDescription: 'Analyze creator velocity, uncover outlier viral videos, and generate strategic growth insights.'
})
</script>

<template>
  <UApp>
    <!-- LOGGED IN: App Shell with Left Sidebar -->
    <div v-if="loggedIn" class="flex min-h-screen">
      <DashboardSidebar class="hidden md:flex" />

      <div class="flex-1 flex flex-col min-w-0">
        <!-- Top bar for mobile / quick status -->
        <header
          class="h-14 border-b border-neutral-200 dark:border-neutral-800 px-4 flex items-center justify-between md:hidden">
          <NuxtLink to="/" class="flex items-center gap-2 font-bold text-base">
            <UIcon name="i-lucide-bar-chart-3" class="size-5 text-primary" />
            <span>YT Analyzer</span>
          </NuxtLink>
          <div class="flex items-center gap-2">
            <UColorModeButton size="xs" />
            <NuxtLink to="/my-channel">
              <UButton icon="i-simple-icons-youtube" size="xs" color="error" variant="subtle" />
            </NuxtLink>
          </div>
        </header>

        <main class="flex-1 overflow-y-auto">
          <NuxtPage />
        </main>
      </div>
    </div>

    <!-- PUBLIC / GUEST: Clean Landing Shell -->
    <div v-else class="min-h-screen flex flex-col">
      <UHeader>
        <template #left>
        </template>

        <template #right>
        </template>
      </UHeader>

      <main class="flex-1">
        <NuxtPage />
      </main>

      <UFooter>
        <template #left>
          <p class="text-sm text-muted">
          </p>
        </template>
      </UFooter>
    </div>
  </UApp>
</template>