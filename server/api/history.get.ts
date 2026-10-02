import { usePrisma } from '../utils/prisma'
    
    export default defineEventHandler(async (event) => {
      const { channelId } = getQuery(event)
    
      if (!channelId) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Param "channelId" needed'
        })
      }
    
      const prisma = usePrisma()
    
      const snapshots = await prisma.channelSnapshot.findMany({
        where: { channelId: String(channelId) },
        orderBy: { capturedAt: 'asc' },
        select: {
          subscriberCount: true,
          viewCount: true,
          videoCount: true,
          capturedAt: true
        }
      })
    
      return snapshots
    })
