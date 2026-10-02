<script setup lang="ts">
const store = useChannelStore()
const handle = ref('')

function onSearch() {
    const value = handle.value.trim()
    if (!value) return
    store.search(extractHandle(value))
}

const examples = [
    { label: '@mkbhd', handle: '@mkbhd' },
    { label: '@MrBeast', handle: '@MrBeast' },
    { label: '@veritasium', handle: '@veritasium' }
]

function searchExample(h: string) {
    handle.value = h
    store.search(h)
}

function extractHandle(input: string): string {
    const trimmed = input.trim()

   const urlMatch = trimmed.match(/youtube\.com\/@([\w.-]+)/)
   if (urlMatch?.[1]) return urlMatch[1]

   return trimmed
}

</script>

<template>
    <div class="flex flex-col gap-4">
        <form class="flex items-center gap-2" @submit.prevent="onSearch">
            <UInput v-model="handle" placeholder="@channelname or YouTube URL" icon="i-lucide-search" size="xl" class="flex-1"
                :disabled="store.loading" />
            <UButton type="submit" label="Analyze" icon="i-lucide-bar-chart-3" size="xl" :loading="store.loading" />
        </form>

        <div class="flex items-center gap-2 flex-wrap">
            <span class="text-sm text-muted">Try:</span>
            <UButton v-for="ex in examples" :key="ex.handle" :label="ex.label" size="xs" color="neutral"
                variant="subtle" :disabled="store.loading" @click="searchExample(ex.handle)" />
        </div>
    </div>
</template>