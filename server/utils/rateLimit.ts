interface RateLimitOptions {
  windowSeconds: number
  maxRequests: number
}

interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetInSeconds: number
}

const DEFAULT_OPTIONS: RateLimitOptions = {
  windowSeconds: 60,
  maxRequests: 20
}

export async function checkRateLimit(
  identifier: string,
  options: RateLimitOptions = DEFAULT_OPTIONS
): Promise<RateLimitResult> {
  const redis = useRedis()
  const key = `ratelimit:${identifier}`
  const now = Date.now()
  const windowStartMs = now - options.windowSeconds * 1000
 
await redis.zremrangebyscore(key, 0, windowStartMs)

const count = await redis.zcard(key)


if (count >= options.maxRequests) {
    const oldest = await redis.zrange<string[]>(key, 0, 0, { withScores: true })
    const oldestTimestamp = oldest.length > 1 ? Number(oldest[1]) : now
    const resetInSeconds = Math.ceil((oldestTimestamp + options.windowSeconds * 1000 - now) / 1000)
 
    return { allowed: false, remaining: 0, resetInSeconds: Math.max(0, resetInSeconds) }
}

await redis.zadd(key, { score: now, member: `${now}-${Math.random()}` })
  await redis.expire(key, options.windowSeconds)
 
  return {
    allowed: true,
    remaining: options.maxRequests - count - 1,
    resetInSeconds: options.windowSeconds
  }
}

