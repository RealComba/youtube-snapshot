<script setup>
useHead({
  meta: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1' }
  ],
  link: [
    { rel: 'icon', href: '/favicon.ico' }
  ],
  htmlAttrs: {
    lang: 'en'
  }
})

useSeoMeta({
  title: 'YouTube Niche Analyzer',
  description: 'Analizza canali YouTube: iscritti, views, video e trend dicrescita nel tempo.',
  ogTitle: 'YouTube Niche Analyzer',
  ogDescription: 'Analizza canali YouTube: iscritti, views, video e trend di crescita nel tempo.'
})
</script>

<template>
  <UApp>
    <UHeader>
      <template #left>
        <NuxtLink to="/" class="flex items-center gap-2 font-bold text-lg">
          <UIcon name="i-lucide-bar-chart-3" class="size-6 text-primary" />
          YT Analyzer
        </NuxtLink>
      </template>

      <template #right>
        <NuxtLink to="/compare">
          <UButton label="Compare" icon="i-lucide-git-compare-arrows" variant="ghost" size="sm" />
        </NuxtLink>
        <UColorModeButton />
      </template>
    </UHeader>

    <UMain>
      <NuxtPage />
    </UMain>

    <UFooter>
      <template #left>
        <p class="text-sm text-muted">
          YouTube Niche Analyzer • © {{ new Date().getFullYear() }}
        </p>
      </template>
    </UFooter>
  </UApp>
</template>
