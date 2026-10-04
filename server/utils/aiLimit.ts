import { useRedis } from './redis'

export const USER_DAILY_AI_LIMIT = 30

interface AiQuotaResult {
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
 * Checks and consumes AI quota for an authenticated user.
 * Each call costs 1 unit from the daily allowance (default 30/day).
 */
export async function checkAndConsumeAiQuota(userId: string, cost = 1): Promise<AiQuotaResult> {
  const redis = useRedis()
  const key = `user:ai:limit:${userId}:${currentDateUTC()}`
  const ttl = secondsUntilMidnightUTC()

  const newTotal = await redis.incrby(key, cost)
  await redis.expire(key, ttl)

  if (newTotal > USER_DAILY_AI_LIMIT) {
    // Rollback consumed amount if over limit
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
    remaining: Math.max(0, USER_DAILY_AI_LIMIT - newTotal),
    totalUsed: newTotal,
    resetInSeconds: ttl
  }
}

/**
 * Read-only check for user's remaining AI quota.
 */
export async function getAiQuotaStatus(userId: string): Promise<AiQuotaResult> {
  const redis = useRedis()
  const key = `user:ai:limit:${userId}:${currentDateUTC()}`
  const total = Number(await redis.get(key) || 0)
  const ttl = secondsUntilMidnightUTC()

  return {
    allowed: total < USER_DAILY_AI_LIMIT,
    remaining: Math.max(0, USER_DAILY_AI_LIMIT - total),
    totalUsed: total,
    resetInSeconds: ttl
  }
}
