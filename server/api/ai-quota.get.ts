import { getAiQuotaStatus, USER_DAILY_AI_LIMIT } from '../utils/aiLimit'

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  const status = await getAiQuotaStatus(user.id)

  return {
    limit: USER_DAILY_AI_LIMIT,
    ...status
  }
})
