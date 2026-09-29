const DAILY_QUOTA_LIMIT = 10000

export const YOUTUBE_COSTS = {
  search: 100,
  channels: 1,
  videos: 1,
  commentThreads: 1
} as const

interface QuotaResult {
  allowed: boolean
  remaining: number
}

function currentDatePT(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date())
}

function secondsUntilMidnightPT(): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).formatToParts(new Date())

  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0)
  const secondsSinceMidnight = get('hour') * 3600 + get('minute') * 60 + get('second')
 
  return 24 * 3600 - secondsSinceMidnight
}

export async function checkAndConsumeQuota(cost: number): Promise<QuotaResult> {
  const redis = useRedis()
  const key = `yt:quota:${currentDatePT()}`
 
  const newTotal = await redis.incrby(key, cost)
 
  await redis.expire(key, secondsUntilMidnightPT())
 
  if (newTotal > DAILY_QUOTA_LIMIT) {
    await redis.decrby(key, cost) 
    return { allowed: false, remaining: Math.max(0, DAILY_QUOTA_LIMIT - (newTotal - cost)) }
  }
 
  return { allowed: true, remaining: DAILY_QUOTA_LIMIT - newTotal }
}
