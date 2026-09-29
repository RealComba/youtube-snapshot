import { Redis } from '@upstash/redis'

let redisClient: Redis | null = null

export function useRedis(): Redis {
  if (!redisClient) {
    const config = useRuntimeConfig()

    redisClient = new Redis({
      url: config.upstashRedisUrl,
      token: config.upstashRedisToken
    })
  }

  return redisClient
}