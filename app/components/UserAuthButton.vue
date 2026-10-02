<script setup lang="ts">
const { loggedIn, user, clear } = useUserSession()
const store = useChannelStore()
const router = useRouter()

const popoverOpen = ref(false)

function openMyChannel() {
  if (!user.value?.ownChannel) return
  popoverOpen.value = false
  router.push('/')
  const target = user.value.ownChannel.handle || user.value.ownChannel.id
  if (target) {
    store.search(target)
  }
}

async function handleSignOut() {
  popoverOpen.value = false
  await clear()
}
</script>

<template>
  <div v-if="!loggedIn">
    <a href="/auth/google">
      <UButton
        label="Sign in"
        icon="i-simple-icons-google"
        variant="solid"
        color="neutral"
        size="sm"
      />
    </a>
  </div>

  <div v-else class="flex items-center gap-2">
    <!-- Quick-access badge to own YouTube channel -->
    <UButton
      v-if="user?.ownChannel"
      :label="user.ownChannel.title"
      icon="i-simple-icons-youtube"
      color="error"
      variant="soft"
      size="xs"
      class="max-w-[150px] truncate hidden sm:inline-flex"
      @click="openMyChannel"
    />

    <!-- User Profile Popover -->
    <UPopover v-model:open="popoverOpen">
      <UButton color="neutral" variant="ghost" size="sm" class="p-1 rounded-full">
        <UAvatar
          :src="user?.image || undefined"
          :alt="user?.name || 'User'"
          size="xs"
          class="ring-1 ring-neutral-300 dark:ring-neutral-700"
        />
      </UButton>

      <template #content>
        <div class="p-4 w-64 space-y-3">
          <!-- User info -->
          <div class="flex items-center gap-3 pb-3 border-b border-neutral-100 dark:border-neutral-800">
            <UAvatar :src="user?.image || undefined" :alt="user?.name || 'User'" size="md" />
            <div class="min-w-0">
              <p class="font-bold text-sm truncate">{{ user?.name || 'User' }}</p>
              <p class="text-xs text-muted truncate">{{ user?.email }}</p>
            </div>
          </div>

          <!-- YouTube Channel Link Status -->
          <div class="space-y-1">
            <p class="text-[11px] uppercase font-bold text-muted tracking-wider">Connected Channel</p>
            <div v-if="user?.ownChannel" class="flex items-center justify-between gap-2 p-2 rounded bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
              <div class="flex items-center gap-2 min-w-0">
                <UIcon name="i-simple-icons-youtube" class="size-4 text-red-500 shrink-0" />
                <span class="text-xs font-semibold truncate">{{ user.ownChannel.title }}</span>
              </div>
              <UButton label="Analyze" size="xs" color="primary" variant="subtle" @click="openMyChannel" />
            </div>
            <div v-else class="text-xs text-muted p-2 rounded bg-neutral-50 dark:bg-neutral-900">
              No YouTube channel found for this Google account.
            </div>
          </div>

          <!-- Actions -->
          <div class="pt-2 border-t border-neutral-100 dark:border-neutral-800">
            <UButton
              label="Sign out"
              icon="i-lucide-log-out"
              color="error"
              variant="ghost"
              size="xs"
              block
              @click="handleSignOut"
            />
          </div>
        </div>
      </template>
    </UPopover>
  </div>
</template>
