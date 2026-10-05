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
    highlight: 'Visual Blue vs Rose ratio tracking with lead multipliers',
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
  <div class="max-w-5xl mx-auto py-4 sm:py-6 px-4 space-y-4 sm:space-y-5 min-h-[calc(100vh-2rem)] flex flex-col justify-center">
    <!-- Top Hero Section (Compact Single-Screen Style) -->
    <div class="text-center space-y-3 max-w-3xl mx-auto">
      <h1 class="text-3xl sm:text-4xl font-extrabold tracking-tight leading-tight">
        Connect your
        <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-xl bg-red-500/10 text-red-600 dark:text-red-500 border border-red-500/20 align-middle">
          <UIcon name="i-simple-icons-youtube" class="size-6 sm:size-7 text-red-600 dark:text-red-500 shrink-0" />
          <span>YouTube</span>
        </span>
        channel to unlock AI growth insights
      </h1>

      <p class="text-xs sm:text-sm text-muted leading-relaxed max-w-xl mx-auto">
        Get comprehensive channel audits, diagnose viral outlier videos, benchmark competitors, and get tailored growth strategies from Gemini AI.
      </p>

      <!-- Main CTA Button -->
      <div class="pt-1 flex flex-col sm:flex-row items-center justify-center gap-3">
        <a href="/auth/google">
          <button
            type="button"
            class="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-xl font-bold text-sm text-white bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-600/20 transition-all cursor-pointer hover:scale-[1.01]"
          >
            <span>Connect with</span>
            <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white text-neutral-900 font-extrabold text-xs shadow-xs">
              <UIcon name="i-simple-icons-youtube" class="size-3.5 text-red-600" />
              YouTube
            </span>
          </button>
        </a>
      </div>

      <p class="text-[11px] text-muted flex items-center justify-center gap-1">
        <UIcon name="i-lucide-shield-check" class="size-3.5 text-blue-500" />
        Official YouTube Data API OAuth • Read-only analytics access
      </p>
    </div>

    <!-- Product Feature Carousel (Uniform Fixed Height - No Layout Shift) -->
    <div
      class="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 p-4 sm:p-6 space-y-4 shadow-xs transition-all overflow-hidden"
      @mouseenter="isPaused = true"
      @mouseleave="isPaused = false"
    >
      <!-- Animated Slide Transition Container (Fixed Uniform Height) -->
      <div class="relative h-[255px] overflow-hidden">
        <Transition name="carousel-slide" mode="out-in">
          <div :key="currentSlide" class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center h-full">
            <!-- Left: Copy & Explanations (Uniform Height) -->
            <div class="lg:col-span-5 h-[230px] flex flex-col justify-between py-1">
              <div class="space-y-2">
                <div class="flex items-center">
                  <div class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-neutral-200 dark:border dark:border-neutral-700 dark:bg-neutral-800 text-muted">
                    <UIcon :name="slides[currentSlide]!.icon" class="size-3 text-primary" />
                    {{ slides[currentSlide]!.tag }}
                  </div>
                </div>

                <h3 class="text-xl font-bold tracking-tight">
                  {{ slides[currentSlide]!.title }}
                </h3>

                <p class="text-xs text-muted leading-relaxed line-clamp-3">
                  {{ slides[currentSlide]!.subtitle }}
                </p>
              </div>

              <div class="pt-1 text-xs font-medium text-primary flex items-center gap-1.5">
                <UIcon name="i-lucide-check-circle-2" class="size-3.5 shrink-0" />
                <span class="truncate">{{ slides[currentSlide]!.highlight }}</span>
              </div>
            </div>

            <!-- Right: Interactive Feature Mockup Previews (Fixed Height h-[230px]) -->
            <div class="lg:col-span-7">
              <UCard class="border-2 border-neutral-200 dark:border-neutral-800 overflow-hidden shadow-xs h-[230px] flex flex-col justify-center">
                <!-- Mock 1: Channel Audit (MrBeast) -->
                <div v-if="slides[currentSlide]!.previewType === 'audit'" class="space-y-2.5 p-1">
                  <div class="flex items-center gap-2.5">
                    <img
                      src="https://unavatar.io/youtube/MrBeast"
                      alt="MrBeast"
                      class="size-9 rounded-full object-cover ring-2 ring-primary/40 shrink-0"
                    />
                    <div>
                      <h4 class="font-bold text-xs">MrBeast</h4>
                      <p class="text-[10px] text-muted">@MrBeast • 350M subscribers</p>
                    </div>
                  </div>

                  <div class="grid grid-cols-3 gap-2 text-center">
                    <div class="p-1.5 rounded bg-neutral-100 dark:bg-neutral-800/80">
                      <p class="text-sm font-bold text-primary">350M</p>
                      <p class="text-[9px] text-muted">Subscribers</p>
                    </div>
                    <div class="p-1.5 rounded bg-neutral-100 dark:bg-neutral-800/80">
                      <p class="text-sm font-bold text-primary">65B</p>
                      <p class="text-[9px] text-muted">Total Views</p>
                    </div>
                    <div class="p-1.5 rounded bg-neutral-100 dark:bg-neutral-800/80">
                      <p class="text-sm font-bold text-primary">85M</p>
                      <p class="text-[9px] text-muted">Avg / Video</p>
                    </div>
                  </div>

                  <div class="p-2 rounded-lg border border-primary/20 bg-primary/5 text-[11px] text-muted space-y-0.5">
                    <span class="font-semibold text-primary flex items-center gap-1 text-[11px]">
                      <UIcon name="i-lucide-sparkles" class="size-3" />
                      AI Cadence Insight
                    </span>
                    <p class="line-clamp-2">Viral velocity pacing delivers high-stakes spectacle with 12.8% retention baseline.</p>
                  </div>
                </div>

                <!-- Mock 2: Viral Outlier (Squid Game) -->
                <div v-else-if="slides[currentSlide]!.previewType === 'outlier'" class="space-y-2 p-1">
                  <div class="relative rounded-lg overflow-hidden border border-neutral-200 dark:border-neutral-800 bg-neutral-100 dark:bg-neutral-800 h-24 flex items-center justify-center">
                    <img
                      src="https://i.ytimg.com/vi/0e3GPea1Tyg/maxresdefault.jpg"
                      alt="$456,000 Squid Game in Real Life"
                      class="w-full h-full object-cover"
                    />
                    <UBadge label="🔥 4.2x Channel Benchmark" color="warning" variant="solid" class="absolute top-1.5 right-1.5 text-[10px] font-bold" />
                    <UBadge label="Long-form • 25:41" color="neutral" variant="solid" class="absolute bottom-1.5 right-1.5 text-[9px]" />
                  </div>
                  <h4 class="font-bold text-xs truncate">$456,000 Squid Game In Real Life!</h4>
                  <div class="p-2 rounded-lg bg-neutral-100 dark:bg-neutral-800/60 text-[11px] space-y-0.5">
                    <p class="font-bold text-primary flex items-center gap-1 text-[11px]">
                      <UIcon name="i-lucide-sparkles" class="size-3" />
                      Why it went viral:
                    </p>
                    <p class="text-muted leading-relaxed line-clamp-2">
                      Leveraged global cultural trend at its peak. Massive real-life scale produced record 18.4% CTR in first 24h.
                    </p>
                  </div>
                </div>

                <!-- Mock 3: Compare Head-to-Head (Airrack vs Jakidale) -->
                <div v-else-if="slides[currentSlide]!.previewType === 'compare'" class="space-y-2.5 p-1">
                  <div class="flex items-center justify-between text-xs font-bold pb-2 border-b border-neutral-100 dark:border-neutral-800">
                    <!-- Airrack (Channel A - Blue) -->
                    <div class="flex items-center gap-2 min-w-0">
                      <img
                        src="https://unavatar.io/youtube/airrack"
                        alt="Airrack"
                        class="size-7 rounded-full object-cover ring-2 ring-blue-500/40 shrink-0"
                      />
                      <div class="min-w-0 leading-tight">
                        <span class="text-blue-600 dark:text-blue-400 font-bold block truncate text-xs">Airrack</span>
                        <span class="text-[10px] text-muted font-normal block">15.4M Subs</span>
                      </div>
                    </div>

                    <!-- Center VS Badge -->
                    <span class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-muted shrink-0 mx-2">
                      VS
                    </span>

                    <!-- Jakidale (Channel B - Rose) -->
                    <div class="flex items-center gap-2 justify-end min-w-0 text-right">
                      <div class="min-w-0 leading-tight">
                        <span class="text-rose-500 dark:text-rose-400 font-bold block truncate text-xs">Jakidale</span>
                        <span class="text-[10px] text-muted font-normal block">2.4M Subs</span>
                      </div>
                      <img
                        src="https://unavatar.io/youtube/jakidale"
                        alt="Jakidale"
                        class="size-7 rounded-full object-cover ring-2 ring-rose-500/40 shrink-0"
                      />
                    </div>
                  </div>

                  <div class="space-y-2">
                    <div class="space-y-1">
                      <div class="flex justify-between text-[11px]">
                        <span class="font-bold text-blue-500">2.8B Views</span>
                        <span class="text-[9px] uppercase text-muted font-bold">Lifetime Views</span>
                        <span class="font-bold text-rose-500">740M Views</span>
                      </div>
                      <div class="h-2 rounded-full flex p-0.5 bg-neutral-200 dark:bg-neutral-800 gap-1 overflow-hidden">
                        <div class="h-full rounded-full bg-blue-500 w-[78%]"></div>
                        <div class="h-full rounded-full bg-rose-500 w-[22%]"></div>
                      </div>
                    </div>

                    <div class="space-y-1">
                      <div class="flex justify-between text-[11px]">
                        <span class="font-bold text-blue-500">4.5M Avg</span>
                        <span class="text-[9px] uppercase text-muted font-bold">Velocity / Upload</span>
                        <span class="font-bold text-rose-500">220K Avg</span>
                      </div>
                      <div class="h-2 rounded-full flex p-0.5 bg-neutral-200 dark:bg-neutral-800 gap-1 overflow-hidden">
                        <div class="h-full rounded-full bg-blue-500 w-[85%]"></div>
                        <div class="h-full rounded-full bg-rose-500 w-[15%]"></div>
                      </div>
                    </div>

                    <div class="p-1.5 rounded bg-neutral-100 dark:bg-neutral-800/60 text-[10px] text-muted flex items-center justify-between">
                      <span>Lead Multiplier:</span>
                      <span class="font-bold text-blue-500">+3.8x Total Views (Airrack)</span>
                    </div>
                  </div>
                </div>

                <!-- Mock 4: AI Assistant Chat -->
                <div v-else-if="slides[currentSlide]!.previewType === 'assistant'" class="space-y-2.5 p-1">
                  <div class="flex items-start gap-2">
                    <div class="size-5 rounded-full bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center text-[9px] font-bold shrink-0">You</div>
                    <div class="p-2 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-[11px] text-muted max-w-[85%]">
                      What video idea should I film next to boost CTR in tech?
                    </div>
                  </div>
                  <div class="flex items-start gap-2">
                    <div class="size-5 rounded-full bg-primary/20 text-primary flex items-center justify-center shrink-0">
                      <UIcon name="i-lucide-sparkles" class="size-3" />
                    </div>
                    <div class="p-2 rounded-lg bg-primary/10 text-[11px] text-neutral-800 dark:text-neutral-200 space-y-0.5 max-w-[90%]">
                      <p class="font-bold text-primary text-[11px]">Winning formula for this week:</p>
                      <p class="text-muted leading-tight">"Why Everyone Is Wrong About [New Tool]": taps into controversy bias with 4.5% higher CTR.</p>
                    </div>
                  </div>
                </div>
              </UCard>
            </div>
          </div>
        </Transition>
      </div>

      <!-- Animated Segmented Progress Indicator Bars (Apple / VidIQ style) -->
      <div class="grid grid-cols-4 gap-2.5 pt-1">
        <button
          v-for="(_, index) in slides"
          :key="index"
          class="group py-1.5 flex flex-col gap-1 cursor-pointer text-left focus:outline-none"
          @click="goToSlide(index)"
        >
          <!-- Track Bar -->
          <div class="h-1 w-full rounded-full overflow-hidden bg-neutral-200 dark:bg-neutral-800">
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
