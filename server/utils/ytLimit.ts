import { useRedis } from './redis'

export const USER_DAILY_YT_LIMIT = 300

interface YtQuotaResult {
  allowed: boolean
  remaining: number
  totalUsed: number
  resetInSeconds: number
}

function currentDateUTC(): string {
  return new Date().toISOString().split('T')[0]!
}

function secondsUntilMidnightUTC(): number {
  const now = new Date()
  const midnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0))
  return Math.max(1, Math.floor((midnight.getTime() - now.getTime()) / 1000))
}

/**
 * Checks and consumes YouTube API quota for an authenticated user.
 * Default allowance is 300 units per day.
 */
export async function checkAndConsumeUserYtQuota(userId: string, cost = 1): Promise<YtQuotaResult> {
  const redis = useRedis()
  const key = `user:yt:quota:${userId}:${currentDateUTC()}`
  const ttl = secondsUntilMidnightUTC()

  const newTotal = await redis.incrby(key, cost)
  await redis.expire(key, ttl)

  if (newTotal > USER_DAILY_YT_LIMIT) {
    await redis.decrby(key, cost)
    return {
      allowed: false,
      remaining: 0,
      totalUsed: newTotal - cost,
      resetInSeconds: ttl
    }
  }

  return {
    allowed: true,
    remaining: Math.max(0, USER_DAILY_YT_LIMIT - newTotal),
    totalUsed: newTotal,
    resetInSeconds: ttl
  }
}

/**
 * Read-only check for user's remaining YouTube quota.
 */
export async function getUserYtQuotaStatus(userId: string): Promise<YtQuotaResult> {
  const redis = useRedis()
  const key = `user:yt:quota:${userId}:${currentDateUTC()}`
  const total = Number(await redis.get(key) || 0)
  const ttl = secondsUntilMidnightUTC()

  return {
    allowed: total < USER_DAILY_YT_LIMIT,
    remaining: Math.max(0, USER_DAILY_YT_LIMIT - total),
    totalUsed: total,
    resetInSeconds: ttl
  }
}
