import { ref, type Ref } from 'vue'

const STORAGE_KEY = 'ignored-events'

function loadIgnored(): Set<string> {
  if (typeof localStorage === 'undefined') return new Set()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as string[]
    return new Set(parsed)
  } catch {
    return new Set()
  }
}

function persist(ids: Set<string>) {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]))
}

export interface IgnoredEventsApi {
  ignoredIds: Ref<Set<string>>
  toggle: (eventId: string) => void
  isIgnored: (eventId: string) => boolean
}

export function useIgnoredEvents(): IgnoredEventsApi {
  const ignoredIds = ref(loadIgnored())

  function toggle(eventId: string) {
    const next = new Set(ignoredIds.value)
    if (next.has(eventId)) {
      next.delete(eventId)
    } else {
      next.add(eventId)
    }
    ignoredIds.value = next
    persist(next)
  }

  function isIgnored(eventId: string): boolean {
    return ignoredIds.value.has(eventId)
  }

  return { ignoredIds, toggle, isIgnored }
}
