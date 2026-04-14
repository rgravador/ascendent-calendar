import { ref, watch, onMounted, onBeforeUnmount, type Ref } from 'vue'
import type { CalendarEventDTO } from '~/server/services/calendar'

const POLL_INTERVAL_MS = 5 * 60 * 1000

export type ScheduleError =
  | { kind: 'not_connected' }
  | { kind: 'auth_failed' }
  | { kind: 'unknown'; message: string }

function toDateString(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate()
}

export function useSchedule(selectedDate?: Ref<Date>) {
  const events = ref<CalendarEventDTO[]>([])
  const loading = ref(true)
  const error = ref<ScheduleError | null>(null)
  let timer: ReturnType<typeof setInterval> | null = null

  const isToday = computed(() => {
    if (!selectedDate) return true
    return isSameDay(selectedDate.value, new Date())
  })

  async function refresh() {
    try {
      const query: Record<string, string> = {}
      if (selectedDate && !isSameDay(selectedDate.value, new Date())) {
        query.date = toDateString(selectedDate.value)
      }
      const res = await $fetch<{ events: CalendarEventDTO[] }>('/api/calendar/today', { query })
      events.value = res.events
      error.value = null
    } catch (e: unknown) {
      const err = e as { statusCode?: number; statusMessage?: string }
      if (err.statusCode === 409) error.value = { kind: 'not_connected' }
      else if (err.statusCode === 502) error.value = { kind: 'auth_failed' }
      else error.value = { kind: 'unknown', message: err.statusMessage ?? 'Calendar unavailable' }
    } finally {
      loading.value = false
    }
  }

  function handleVisibility() {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      refresh()
    }
  }

  if (selectedDate) {
    watch(selectedDate, () => {
      loading.value = true
      refresh()
    })
  }

  onMounted(() => {
    refresh()
    timer = setInterval(refresh, POLL_INTERVAL_MS)
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibility)
    }
  })

  onBeforeUnmount(() => {
    if (timer) clearInterval(timer)
    timer = null
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  })

  return { events, loading, error, refresh, isToday }
}
