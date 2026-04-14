import { createError, setHeader, getQuery } from 'h3'
import { fetchDayEvents, CalendarNotConfiguredError, CalendarAuthError } from '~/server/services/calendar'
import { getUserById } from '~/server/repositories/users'
import { isMockMode } from '~/server/utils/mock-mode'

function parseDateParam(raw: unknown): Date | undefined {
  if (typeof raw !== 'string' || !raw) return undefined
  const d = new Date(raw + 'T00:00:00')
  return isNaN(d.getTime()) ? undefined : d
}

export default defineEventHandler(async (event) => {
  try {
    const { date: dateParam } = getQuery(event)
    const date = parseDateParam(dateParam)

    if (isMockMode()) {
      const events = await fetchDayEvents('', date)
      setHeader(event, 'Cache-Control', 'no-store')
      return { events }
    }

    const userId = event.context.userId as string
    const user = await getUserById(userId)
    if (!user?.googleRefreshToken) throw new CalendarNotConfiguredError()

    const events = await fetchDayEvents(user.googleRefreshToken, date)
    setHeader(event, 'Cache-Control', 'no-store')
    return { events }
  } catch (err: unknown) {
    if (err instanceof CalendarNotConfiguredError) {
      throw createError({ statusCode: 409, statusMessage: err.message })
    }
    if (err instanceof CalendarAuthError) {
      throw createError({ statusCode: 502, statusMessage: err.message })
    }
    throw createError({ statusCode: 502, statusMessage: 'Failed to load calendar events' })
  }
})
