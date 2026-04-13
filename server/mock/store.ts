import { randomUUID } from 'node:crypto'
import type { Note, Settings, Todo } from '~/server/types/models'
import type { CalendarEventDTO } from '~/server/services/calendar'

/**
 * Process-local in-memory storage used when MOCK_MODE is on.
 * Persists across requests in the same dev server session, resets on restart.
 * Seeded with a bit of sample content so the UI is never empty.
 */

function iso(d: Date): string {
  return d.toISOString()
}

function now(): string {
  return iso(new Date())
}

function todayAt(hour: number, minute: number = 0): Date {
  const d = new Date()
  d.setHours(hour, minute, 0, 0)
  return d
}

// --- settings ---

const settingsState: Settings = {
  _id: 'singleton',
  alarmOffsetMinutes: 5,
  googleRefreshToken: 'mock-refresh-token',
  googleTokenUpdatedAt: now(),
}

export const mockSettings = {
  get(): Settings {
    return { ...settingsState }
  },
  patch(patch: Partial<Omit<Settings, '_id'>>): Settings {
    if (typeof patch.alarmOffsetMinutes === 'number' && Number.isFinite(patch.alarmOffsetMinutes)) {
      settingsState.alarmOffsetMinutes = Math.max(0, Math.floor(patch.alarmOffsetMinutes))
    }
    if (typeof patch.googleRefreshToken === 'string') {
      settingsState.googleRefreshToken = patch.googleRefreshToken
      settingsState.googleTokenUpdatedAt = now()
    }
    return { ...settingsState }
  },
}

// --- todos ---

const todos: Map<string, Todo> = new Map()

function seedTodos() {
  const seed: Omit<Todo, '_id'>[] = [
    { text: 'Reply to Marcus about the Q2 proposal', priority: 'high', dueDate: iso(todayAt(17)), done: false, createdAt: now(), updatedAt: now() },
    { text: 'Draft the launch announcement', priority: 'med', done: false, createdAt: now(), updatedAt: now() },
    { text: 'Book flights for the conference', priority: 'low', dueDate: iso(new Date(Date.now() + 3 * 24 * 3600 * 1000)), done: false, createdAt: now(), updatedAt: now() },
    { text: 'Renew domain registration', priority: 'low', done: true, createdAt: now(), updatedAt: now() },
  ]
  for (const t of seed) {
    const id = randomUUID()
    todos.set(id, { _id: id, ...t })
  }
}
seedTodos()

export const mockTodos = {
  list(): Todo[] {
    return Array.from(todos.values())
  },
  create(todo: Todo): Todo {
    todos.set(todo._id, todo)
    return todo
  },
  update(id: string, patch: Partial<Todo>, unsetDueDate: boolean): Todo | null {
    const existing = todos.get(id)
    if (!existing) return null
    const next: Todo = { ...existing, ...patch, updatedAt: now() }
    if (unsetDueDate) delete next.dueDate
    todos.set(id, next)
    return next
  },
  remove(id: string): boolean {
    return todos.delete(id)
  },
}

// --- notes ---

const notes: Map<string, Note> = new Map()

function seedNotes() {
  const seed: Omit<Note, '_id'>[] = [
    {
      title: 'On routine',
      body: 'A day goes well when the first hour is uncluttered. Protect the first hour.',
      createdAt: now(),
      updatedAt: now(),
    },
    {
      body: 'Idea: a weekly review built into the dashboard — simple prompt, 3 lines, no more.',
      createdAt: now(),
      updatedAt: iso(new Date(Date.now() - 30 * 60 * 1000)),
    },
    {
      title: 'Groceries',
      body: 'olives · bread · sparkling water · coffee beans',
      createdAt: now(),
      updatedAt: iso(new Date(Date.now() - 2 * 3600 * 1000)),
    },
  ]
  for (const n of seed) {
    const id = randomUUID()
    notes.set(id, { _id: id, ...n })
  }
}
seedNotes()

export const mockNotes = {
  list(): Note[] {
    return Array.from(notes.values())
  },
  create(note: Note): Note {
    notes.set(note._id, note)
    return note
  },
  update(id: string, patch: Partial<Note>, unsetTitle: boolean): Note | null {
    const existing = notes.get(id)
    if (!existing) return null
    const next: Note = { ...existing, ...patch, updatedAt: now() }
    if (unsetTitle) delete next.title
    notes.set(id, next)
    return next
  },
  remove(id: string): boolean {
    return notes.delete(id)
  },
}

// --- calendar events ---

/**
 * Synthesise a believable daily schedule relative to "now".
 * Returns events spread across the day with at least one within the
 * alarm window so the scheduler has something to demonstrate.
 */
export function mockTodaysEvents(): CalendarEventDTO[] {
  const current = new Date()

  function at(hour: number, minute: number, durationMins: number, title: string, location?: string): CalendarEventDTO {
    const start = new Date(current)
    start.setHours(hour, minute, 0, 0)
    const end = new Date(start.getTime() + durationMins * 60_000)
    return {
      id: `mock-${hour}-${minute}-${title.replace(/\s+/g, '-').toLowerCase()}`,
      title,
      start: iso(start),
      end: iso(end),
      ...(location ? { location } : {}),
      htmlLink: 'https://calendar.google.com/',
    }
  }

  // An event 3 minutes from now so the alarm fires quickly in demos
  const soonStart = new Date(current.getTime() + 3 * 60_000)
  const soonEnd = new Date(soonStart.getTime() + 30 * 60_000)
  const imminent: CalendarEventDTO = {
    id: 'mock-imminent',
    title: 'Demo alarm in 3 minutes',
    start: iso(soonStart),
    end: iso(soonEnd),
    location: 'Right here',
    htmlLink: 'https://calendar.google.com/',
  }

  return [
    at(9, 0, 30, 'Morning standup', 'Zoom'),
    at(10, 30, 45, 'Design review — Q2 launch', 'Studio'),
    imminent,
    at(13, 0, 60, 'Lunch with Sam'),
    at(15, 30, 30, '1:1 with Priya'),
    at(17, 0, 60, 'Deep work block'),
  ]
    .sort((a, b) => a.start.localeCompare(b.start))
}
