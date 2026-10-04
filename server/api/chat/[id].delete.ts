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

  await prisma.chatSession.deleteMany({
    where: {
      id,
      userId: user.id
    }
  })

  return { success: true }
})
