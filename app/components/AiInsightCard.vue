<script setup lang="ts">
    const store = useChannelStore()
    </script>
    
    <template>
    <UCard v-if="!store.insight && !store.insightLoading">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-sparkles" class="size-5 text-primary" />
            <span class="text-sm">AI Channel Analysis available</span>
          </div>
          <UButton label="Generate Analysis" icon="i-lucide-sparkles" size="sm" @click="store.fetchInsight()" />
        </div>
    </UCard>
    
      <UCard v-else-if="store.insight">
        <div class="flex items-center gap-2 mb-3">
          <UIcon name="i-lucide-sparkles" class="size-5 text-primary" />
          <h3 class="font-semibold">AI Insight</h3>
        </div>
        <p class="text-sm leading-relaxed whitespace-pre-line">
          {{ store.insight }}
        </p>
      </UCard>
    </template>