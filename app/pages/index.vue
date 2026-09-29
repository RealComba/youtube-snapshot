<template>
      <UContainer class="py-10">
        <!-- Titolo -->
        <div class="text-center mb-8">
          <h1 class="text-3xl font-bold">
            YouTube Niche Analyzer
          </h1>
          <p class="text-muted mt-2">
            Analizza qualsiasi canale YouTube: iscritti, views, ultimi video e trend di crescita.
          </p>
        </div>
    
        <!-- Barra di ricerca -->
        <div class="max-w-xl mx-auto mb-10">
          <ChannelInput />
        </div>
    
        <!-- Errore -->
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
    
        <!-- Risultati -->
        <div v-if="!store.loading && store.channel" class="space-y-8">
          <StatsOverview />
          <TopVideosList />
        </div>
      </UContainer>
    </template>
    
    <script setup lang="ts">
    const store = useChannelStore()
    </script>
