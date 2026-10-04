import { usePrisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Session id is required'
    })
  }

  const prisma = usePrisma()

  const session = await prisma.chatSession.findFirst({
    where: {
      id,
      userId: user.id
    },
    include: {
      messages: {
        orderBy: { createdAt: 'asc' }
      }
    }
  })

  if (!session) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Chat session not found'
    })
  }

  return session
})
