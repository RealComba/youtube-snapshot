<script setup lang="ts">
interface Slide {
  id: string
  tag: string
  title: string
  subtitle: string
  icon: string
  badgeColor: 'primary' | 'error' | 'warning' | 'neutral'
  highlight: string
  previewType: 'audit' | 'outlier' | 'compare' | 'assistant'
}

const currentSlide = ref(0)
const isPaused = ref(false)
const progress = ref(0)

const SLIDE_DURATION = 5000 // 5 seconds per slide
const TICK_INTERVAL = 50 // updates every 50ms for ultra smooth progress

const slides: Slide[] = [
  {
    id: 'audit',
    tag: 'Channel Health & Velocity',
    title: 'Instant Channel Audit & Historical Velocity',
    subtitle: 'Benchmark your channel metrics against YouTube standards. Track upload cadence, subscriber velocity, and average views per video.',
    icon: 'i-lucide-activity',
    badgeColor: 'primary',
    highlight: 'Real-time Redis caching & PostgreSQL snapshot tracking',
    previewType: 'audit'
  },
  {
    id: 'outlier',
    tag: 'AI Viral Diagnosis',
    title: 'Detect Outlier Videos & Why They Exploded',
    subtitle: 'Identify which videos surpassed channel averages. Gemini AI analyzes title curiosity gaps, pacing, and retention drivers.',
    icon: 'i-lucide-flame',
    badgeColor: 'warning',
    highlight: '🔥 3.2x Channel Benchmark Detection with Gemini AI',
    previewType: 'outlier'
  },
  {
    id: 'compare',
    tag: 'Head-to-Head Comparison',
    title: 'Side-by-Side Competitor Benchmarking',
    subtitle: 'Pit your channel against rival creators in your niche. Spot who is winning in views, uploads, and audience conversion with dual-color metrics.',
    icon: 'i-lucide-git-compare-arrows',
    badgeColor: 'primary',
    highlight: 'Visual Emerald vs Indigo ratio tracking with lead multipliers',
    previewType: 'compare'
  },
  {
    id: 'assistant',
    tag: 'AI Creator Strategy',
    title: 'Your 24/7 Personal YouTube Growth Strategist',
    subtitle: 'Brainstorm high-CTR title formulas, diagnose why a topic is trending, and plan your next 30 days of long-form and Shorts content.',
    icon: 'i-lucide-sparkles',
    badgeColor: 'primary',
    highlight: 'Context-aware Gemini model with saved chat history',
    previewType: 'assistant'
  }
]

let intervalId: any = null

function startProgressLoop() {
  if (intervalId) clearInterval(intervalId)
  progress.value = 0

  intervalId = setInterval(() => {
    if (!isPaused.value) {
      progress.value += (TICK_INTERVAL / SLIDE_DURATION) * 100

      if (progress.value >= 100) {
        progress.value = 0
        currentSlide.value = (currentSlide.value + 1) % slides.length
      }
    }
  }, TICK_INTERVAL)
}

function goToSlide(index: number) {
  currentSlide.value = index
  progress.value = 0
}

function getBarWidth(index: number) {
  if (index < currentSlide.value) return '100%'
  if (index > currentSlide.value) return '0%'
  return `${progress.value}%`
}

onMounted(() => {
  startProgressLoop()
})

onUnmounted(() => {
  if (intervalId) clearInterval(intervalId)
})
</script>

<template>
  <div class="max-w-5xl mx-auto py-10 px-4 space-y-12">
    <!-- Top Hero Section (VidIQ Style with Red YouTube Logo & Bluish Palette) -->
    <div class="text-center space-y-5 max-w-3xl mx-auto pt-4">
      <h1 class="text-4xl sm:text-5xl font-extrabold tracking-tight leading-tight">
        Connect your
        <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-red-500/10 text-red-600 dark:text-red-500 border border-red-500/20 align-middle">
          <UIcon name="i-simple-icons-youtube" class="size-8 sm:size-10 text-red-600 dark:text-red-500 shrink-0" />
          <span>YouTube</span>
        </span>
        channel to unlock AI growth insights
      </h1>

      <p class="text-base text-muted leading-relaxed max-w-2xl mx-auto">
        Get comprehensive channel audits, diagnose viral outlier videos, benchmark competitors, and get tailored growth strategies from Gemini AI.
      </p>

      <!-- Main CTA Button (Bluish theme highlighting the red YouTube logo) -->
      <div class="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
        <a href="/auth/google">
          <button
            type="button"
            class="inline-flex items-center gap-3 px-6 py-3.5 rounded-xl font-bold text-base text-white bg-blue-600 hover:bg-blue-500 shadow-xl shadow-blue-600/25 transition-all cursor-pointer hover:scale-[1.02]"
          >
            <span>Connect with</span>
            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white text-neutral-900 font-extrabold text-sm shadow-xs">
              <UIcon name="i-simple-icons-youtube" class="size-4 text-red-600" />
              YouTube
            </span>
          </button>
        </a>
      </div>

      <p class="text-xs text-muted flex items-center justify-center gap-1.5 pt-1">
        <UIcon name="i-lucide-shield-check" class="size-4 text-blue-500" />
        Official YouTube Data API OAuth • Read-only analytics access
      </p>
    </div>

    <!-- Product Feature Carousel (Pause on Hover) -->
    <div
      class="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 p-6 sm:p-8 space-y-8 shadow-sm transition-all overflow-hidden"
      @mouseenter="isPaused = true"
      @mouseleave="isPaused = false"
    >

      <!-- Animated Slide Transition Container -->
      <div class="relative min-h-[320px]">
        <Transition name="carousel-slide" mode="out-in">
          <div :key="currentSlide" class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <!-- Left: Copy & Explanations -->
            <div class="lg:col-span-5 space-y-4">
              <div class="flex items-center">
                <div class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-neutral-200 dark:border dark:border-neutral-700 dark:bg-neutral-800 text-muted">
                  <UIcon :name="slides[currentSlide]!.icon" class="size-3.5 text-primary" />
                  {{ slides[currentSlide]!.tag }}
                </div>
              </div>

              <h3 class="text-2xl font-bold tracking-tight">
                {{ slides[currentSlide]!.title }}
              </h3>

              <p class="text-sm text-muted leading-relaxed">
                {{ slides[currentSlide]!.subtitle }}
              </p>

              <div class="pt-2 text-xs font-medium text-primary flex items-center gap-2">
                <UIcon name="i-lucide-check-circle-2" class="size-4 shrink-0" />
                <span>{{ slides[currentSlide]!.highlight }}</span>
              </div>
            </div>

            <!-- Right: Interactive Feature Mockup Previews -->
            <div class="lg:col-span-7">
              <UCard class="border-2 border-neutral-200 dark:border-neutral-800 overflow-hidden shadow-md">
                <!-- Mock 1: Channel Audit (MrBeast) -->
                <div v-if="slides[currentSlide]!.previewType === 'audit'" class="space-y-4 p-2">
                  <div class="flex items-center gap-3">
                    <img
                      src="https://unavatar.io/youtube/MrBeast"
                      alt="MrBeast"
                      class="size-11 rounded-full object-cover ring-2 ring-primary/40 shrink-0"
                    />
                    <div>
                      <h4 class="font-bold text-sm">MrBeast</h4>
                      <p class="text-xs text-muted">@MrBeast • 350M subscribers</p>
                    </div>
                  </div>

                  <div class="grid grid-cols-3 gap-2 text-center">
                    <div class="p-2 rounded bg-neutral-100 dark:bg-neutral-800/80">
                      <p class="text-base font-bold text-primary">350M</p>
                      <p class="text-[10px] text-muted">Subscribers</p>
                    </div>
                    <div class="p-2 rounded bg-neutral-100 dark:bg-neutral-800/80">
                      <p class="text-base font-bold text-primary">65B</p>
                      <p class="text-[10px] text-muted">Total Views</p>
                    </div>
                    <div class="p-2 rounded bg-neutral-100 dark:bg-neutral-800/80">
                      <p class="text-base font-bold text-primary">85M</p>
                      <p class="text-[10px] text-muted">Avg / Video</p>
                    </div>
                  </div>

                  <div class="p-3 rounded-lg border border-primary/20 bg-primary/5 text-xs text-muted space-y-1">
                    <span class="font-semibold text-primary flex items-center gap-1">
                      <UIcon name="i-lucide-sparkles" class="size-3.5" />
                      AI Cadence Insight
                    </span>
                    <p>Unprecedented viral velocity. First 5-second pacing delivers high-stakes spectacle with 12.8% retention baseline.</p>
                  </div>
                </div>

                <!-- Mock 2: Viral Outlier (Long-form Video) -->
                <div v-else-if="slides[currentSlide]!.previewType === 'outlier'" class="space-y-3 p-2">
                  <div class="relative rounded-lg overflow-hidden border border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-800 h-36 flex items-center justify-center">
                    <img
                      src="https://i.ytimg.com/vi/0e3GPea1Tyg/maxresdefault.jpg"
                      alt="$456,000 Squid Game in Real Life"
                      class="w-full h-full object-cover"
                    />
                    <UBadge label="🔥 4.2x Channel Benchmark" color="warning" variant="solid" class="absolute top-2 right-2 text-xs font-bold" />
                    <UBadge label="Long-form • 25:41" color="neutral" variant="solid" class="absolute bottom-2 right-2 text-[10px]" />
                  </div>
                  <h4 class="font-bold text-sm">$456,000 Squid Game In Real Life!</h4>
                  <div class="p-3 rounded-lg bg-neutral-100 dark:bg-neutral-800/60 text-xs space-y-1">
                    <p class="font-bold text-primary flex items-center gap-1">
                      <UIcon name="i-lucide-sparkles" class="size-3.5" />
                      Why it went viral:
                    </p>
                    <p class="text-muted leading-relaxed">
                      Leveraged a global cultural trend at its peak. Massive real-life scale and high-stakes survival challenge produced a record 18.4% CTR in the first 24 hours.
                    </p>
                  </div>
                </div>

                <!-- Mock 3: Compare Head-to-Head -->
                <div v-else-if="slides[currentSlide]!.previewType === 'compare'" class="space-y-4 p-2">
                  <div class="flex items-center justify-between text-xs font-bold">
                    <span class="text-emerald-500">Creator A (19.3M Subs)</span>
                    <span class="text-muted">VS</span>
                    <span class="text-indigo-500">Creator B (16.2M Subs)</span>
                  </div>

                  <div class="space-y-3">
                    <div class="space-y-1">
                      <div class="flex justify-between text-xs">
                        <span class="font-bold text-emerald-500">4.2B Views</span>
                        <span class="text-[10px] uppercase text-muted font-bold">Lifetime Views</span>
                        <span class="font-bold text-indigo-500">2.8B Views</span>
                      </div>
                      <div class="h-3 rounded-full flex p-0.5 bg-neutral-200 dark:bg-neutral-800 gap-1">
                        <div class="h-full rounded-full bg-emerald-500 w-[60%]"></div>
                        <div class="h-full rounded-full bg-indigo-500 w-[40%]"></div>
                      </div>
                    </div>

                    <div class="space-y-1">
                      <div class="flex justify-between text-xs">
                        <span class="font-bold text-emerald-500">2.1M Avg</span>
                        <span class="text-[10px] uppercase text-muted font-bold">Velocity / Upload</span>
                        <span class="font-bold text-indigo-500">1.4M Avg</span>
                      </div>
                      <div class="h-3 rounded-full flex p-0.5 bg-neutral-200 dark:bg-neutral-800 gap-1">
                        <div class="h-full rounded-full bg-emerald-500 w-[65%]"></div>
                        <div class="h-full rounded-full bg-indigo-500 w-[35%]"></div>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Mock 4: AI Assistant Chat -->
                <div v-else-if="slides[currentSlide]!.previewType === 'assistant'" class="space-y-3 p-2">
                  <div class="flex items-start gap-2.5">
                    <div class="size-6 rounded-full bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center text-[10px] font-bold shrink-0">You</div>
                    <div class="p-2 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-xs text-muted max-w-[85%]">
                      What video idea should I film next to boost CTR in tech?
                    </div>
                  </div>
                  <div class="flex items-start gap-2.5">
                    <div class="size-6 rounded-full bg-primary/20 text-primary flex items-center justify-center shrink-0">
                      <UIcon name="i-lucide-sparkles" class="size-3.5" />
                    </div>
                    <div class="p-2.5 rounded-lg bg-primary/10 text-xs text-neutral-800 dark:text-neutral-200 space-y-1 max-w-[90%]">
                      <p class="font-bold text-primary">Winning formula for this week:</p>
                      <p class="text-muted">"Why Everyone Is Wrong About [New Tool/Gadget]": taps into controversy bias with 4.5% higher clickthrough.</p>
                    </div>
                  </div>
                </div>
              </UCard>
            </div>
          </div>
        </Transition>
      </div>

      <!-- Animated Segmented Progress Indicator Bars (Apple / VidIQ style) -->
      <div class="grid grid-cols-4 gap-3 pt-2">
        <button
          v-for="(_, index) in slides"
          :key="index"
          class="group py-2 flex flex-col gap-1.5 cursor-pointer text-left focus:outline-none"
          @click="goToSlide(index)"
        >
          <!-- Track Bar -->
          <div class="h-1.5 w-full rounded-full overflow-hidden bg-neutral-200 dark:bg-neutral-800">
            <div
              class="h-full bg-blue-600 rounded-full transition-all duration-75"
              :style="{ width: getBarWidth(index) }"
            />
          </div>
          <!-- Label below bar -->
          <span
            class="text-[10px] font-semibold truncate transition-colors"
            :class="currentSlide === index ? 'text-blue-600 dark:text-blue-400 font-bold' : 'text-muted group-hover:text-neutral-700 dark:group-hover:text-neutral-300'"
          >
            {{ slides[index]!.tag }}
          </span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.carousel-slide-enter-active,
.carousel-slide-leave-active {
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

.carousel-slide-enter-from {
  opacity: 0;
  transform: translateX(30px);
}

.carousel-slide-leave-to {
  opacity: 0;
  transform: translateX(-30px);
}
</style>
