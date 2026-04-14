import { getSettings } from '~/server/repositories/settings'
import { getUserById } from '~/server/repositories/users'
import { isMockMode } from '~/server/utils/mock-mode'

export default defineEventHandler(async (event) => {
  const userId = event.context.userId as string
  const s = await getSettings(userId)

  let calendarConnected = false
  if (isMockMode()) {
    calendarConnected = true
  } else {
    const user = await getUserById(userId)
    calendarConnected = Boolean(user?.googleRefreshToken)
  }

  return {
    alarmOffsetMinutes: s.alarmOffsetMinutes,
    alarmSound: s.alarmSound,
    alarmVolume: s.alarmVolume,
    alarmRingDuration: s.alarmRingDuration,
    calendarConnected,
  }
})
