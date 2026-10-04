import { getUserYtQuotaStatus, USER_DAILY_YT_LIMIT } from '../utils/ytLimit'

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  const status = await getUserYtQuotaStatus(user.id)

  const percentUsed = Math.min(100, Math.round((status.totalUsed / USER_DAILY_YT_LIMIT) * 100))

  return {
    limit: USER_DAILY_YT_LIMIT,
    percentUsed,
    ...status
  }
})
