import { google } from 'googleapis'
import { buildAuthenticatedClient } from '~/server/utils/google-oauth'
import { isMockMode } from '~/server/utils/mock-mode'
import { mockTodaysEvents } from '~/server/mock/store'

export interface CalendarEventDTO {
  id: string
  title: string
  start: string // ISO
  end: string // ISO
  location?: string
  htmlLink?: string
}

export class CalendarNotConfiguredError extends Error {
  constructor() {
    super('Google Calendar is not connected. Please sign in again.')
    this.name = 'CalendarNotConfiguredError'
  }
}

export class CalendarAuthError extends Error {
  constructor(cause?: unknown) {
    super('Google Calendar auth failed. Please sign out and sign in again.')
    this.name = 'CalendarAuthError'
    this.cause = cause
  }
}

function startOfLocalDay(now: Date = new Date()): Date {
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  return d
}

function endOfLocalDay(now: Date = new Date()): Date {
  const d = new Date(now)
  d.setHours(23, 59, 59, 999)
  return d
}

export async function fetchDayEvents(refreshToken: string, date?: Date): Promise<CalendarEventDTO[]> {
  if (isMockMode()) return mockTodaysEvents()

  const auth = buildAuthenticatedClient(refreshToken)
  const calendar = google.calendar({ version: 'v3', auth })

  const now = date ?? new Date()
  try {
    const res = await calendar.events.list({
      calendarId: 'primary',
      timeMin: startOfLocalDay(now).toISOString(),
      timeMax: endOfLocalDay(now).toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 50,
    })

    const items = res.data.items ?? []
    return items
      .filter((e) => e.start?.dateTime && e.end?.dateTime)
      .map((e): CalendarEventDTO => ({
        id: e.id ?? '',
        title: e.summary ?? '(no title)',
        start: e.start!.dateTime!,
        end: e.end!.dateTime!,
        ...(e.location ? { location: e.location } : {}),
        ...(e.htmlLink ? { htmlLink: e.htmlLink } : {}),
      }))
      .filter((e) => e.id.length > 0)
  } catch (err: unknown) {
    const e = err as { response?: { data?: { error?: string } }; message?: string }
    const code = e?.response?.data?.error
    if (code === 'invalid_grant' || (e?.message ?? '').includes('invalid_grant')) {
      throw new CalendarAuthError(err)
    }
    throw err
  }
}
