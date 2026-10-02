<script setup lang="ts">
    const store = useChannelStore()
    </script>
    
    <template>
    <UCard v-if="!store.insight && !store.insightLoading">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-sparkles" class="size-5 text-primary" />
            <span class="text-sm">AI Channel Growth Analysis available</span>
          </div>
          <UButton label="Generate Analysis" icon="i-lucide-sparkles" size="sm" @click="store.fetchInsight()" />
        </div>
    </UCard>

    <UCard v-else-if="store.insightLoading">
        <div class="flex items-center gap-3">
          <UIcon name="i-lucide-sparkles" class="size-5 text-primary animate-pulse" />
          <span class="text-sm text-muted">Gemini is analyzing channel velocity, upload cadence and audience retention...</span>
        </div>
        <USkeleton class="h-20 w-full rounded-md mt-3" />
    </UCard>
    
    <UCard v-else-if="store.insight">
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-sparkles" class="size-5 text-primary" />
            <h3 class="font-semibold">AI Growth Insight</h3>
          </div>
          <UButton icon="i-lucide-refresh-cw" color="neutral" variant="ghost" size="xs" :loading="store.insightLoading" @click="store.fetchInsight()" />
        </div>
        <p class="text-sm leading-relaxed whitespace-pre-line text-neutral-700 dark:text-neutral-300">
          {{ store.insight }}
        </p>
    </UCard>
    </template>