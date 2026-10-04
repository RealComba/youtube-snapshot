import { usePrisma } from '../../utils/prisma'

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  const body = await readBody(event).catch(() => null) as { title?: string } | null
  const prisma = usePrisma()

  const title = (typeof body?.title === 'string' && body.title.trim()) || 'New Strategy Session'

  const session = await prisma.chatSession.create({
    data: {
      userId: user.id,
      title
    }
  })

  return session
})
