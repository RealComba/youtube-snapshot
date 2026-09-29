import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export function usePrisma(): PrismaClient {
  if (!globalForPrisma.prisma) {
    const config = useRuntimeConfig()

    const adapter = new PrismaPg({
      connectionString: config.databaseUrl
    })

    globalForPrisma.prisma = new PrismaClient({ adapter })
  }

  return globalForPrisma.prisma
}