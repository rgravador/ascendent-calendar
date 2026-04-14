import { ref, watch, onBeforeUnmount, type Ref } from 'vue'
import type { CalendarEventDTO } from '~/server/services/calendar'

const MS_PER_MINUTE = 60_000
const GRACE_WINDOW_MS = 2 * MS_PER_MINUTE // fire late alarms if we missed them by < 2 min

function todayKey(date: Date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function firedStorageKey(dateKey: string, eventId: string): string {
  return `fired:${dateKey}:${eventId}`
}

export type PermissionState = 'default' | 'granted' | 'denied' | 'unsupported'

export interface AlarmsApi {
  permission: Ref<PermissionState>
  soundUnlocked: Ref<boolean>
  requestPermission: () => Promise<void>
  unlockSound: () => Promise<void>
  testFire: () => void
}

interface Options {
  events: Ref<CalendarEventDTO[]>
  offsetMinutes: Ref<number>
  ignoredIds: Ref<Set<string>>
  soundSrc?: string
}

export function useAlarms({ events, offsetMinutes, ignoredIds, soundSrc = '/sounds/chime.mp3' }: Options): AlarmsApi {
  const permission = ref<PermissionState>('default')
  const soundUnlocked = ref(false)
  const timers = new Set<ReturnType<typeof setTimeout>>()
  let audio: HTMLAudioElement | null = null
  let audioCtx: AudioContext | null = null
  let audioFileMissing = false

  function playSynthChime() {
    if (!audioCtx) return
    const ctx = audioCtx
    const now = ctx.currentTime
    // Two soft tones: perfect fifth, short.
    const frequencies = [880, 1318.51]
    frequencies.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      const start = now + i * 0.18
      const end = start + 0.35
      gain.gain.setValueAtTime(0, start)
      gain.gain.linearRampToValueAtTime(0.22, start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, end)
      osc.connect(gain).connect(ctx.destination)
      osc.start(start)
      osc.stop(end + 0.05)
    })
  }

  function clearAllTimers() {
    for (const t of timers) clearTimeout(t)
    timers.clear()
  }

  function hasFired(dateKey: string, eventId: string): boolean {
    if (typeof localStorage === 'undefined') return false
    return localStorage.getItem(firedStorageKey(dateKey, eventId)) === '1'
  }

  function markFired(dateKey: string, eventId: string) {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(firedStorageKey(dateKey, eventId), '1')
  }

  function fire(event: CalendarEventDTO) {
    const dateKey = todayKey(new Date(event.start))
    if (hasFired(dateKey, event.id)) return
    markFired(dateKey, event.id)

    // Desktop notification
    if (permission.value === 'granted' && typeof Notification !== 'undefined') {
      const startAt = new Date(event.start).toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
      const body = `Starts at ${startAt}`
      try {
        new Notification(event.title, { body, tag: event.id })
      } catch {
        // Some browsers throw when Notification is used outside a user gesture
        // in certain contexts. Silent failure is fine — the chime still plays.
      }
    }

    // Chime — try file first, fall back to synthesised tone
    if (!soundUnlocked.value) return
    if (audio && !audioFileMissing) {
      try {
        audio.currentTime = 0
        void audio.play().catch(() => {
          audioFileMissing = true
          playSynthChime()
        })
        return
      } catch {
        audioFileMissing = true
      }
    }
    playSynthChime()
  }

  function rebuild() {
    clearAllTimers()
    if (typeof window === 'undefined') return

    const now = Date.now()
    const offsetMs = Math.max(0, offsetMinutes.value) * MS_PER_MINUTE

    for (const ev of events.value) {
      if (!ev.id) continue
      if (ignoredIds.value.has(ev.id)) continue
      const startMs = new Date(ev.start).getTime()
      const fireAt = startMs - offsetMs
      const delay = fireAt - now
      const dateKey = todayKey(new Date(ev.start))
      if (hasFired(dateKey, ev.id)) continue

      if (delay > 0) {
        const t = setTimeout(() => fire(ev), delay)
        timers.add(t)
      } else if (delay >= -GRACE_WINDOW_MS) {
        // Missed it recently — fire immediately, once.
        fire(ev)
      }
      // else: too far in the past, skip
    }
  }

  async function requestPermission() {
    if (typeof Notification === 'undefined') {
      permission.value = 'unsupported'
      return
    }
    if (Notification.permission === 'granted') {
      permission.value = 'granted'
      return
    }
    try {
      const result = await Notification.requestPermission()
      permission.value = result as PermissionState
    } catch {
      permission.value = 'denied'
    }
  }

  async function unlockSound() {
    if (typeof window === 'undefined') return

    // Prime an AudioContext so the synth fallback works under autoplay rules.
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (Ctx && !audioCtx) audioCtx = new Ctx()
      if (audioCtx && audioCtx.state === 'suspended') await audioCtx.resume()
    } catch {
      // ignore
    }

    if (!audio) {
      audio = new Audio(soundSrc)
      audio.preload = 'auto'
      audio.volume = 0.7
    }
    try {
      audio.muted = true
      await audio.play()
      audio.pause()
      audio.currentTime = 0
      audio.muted = false
    } catch {
      // File unavailable — that's fine, synth fallback will handle it.
      audioFileMissing = true
    }
    soundUnlocked.value = Boolean(audioCtx) || !audioFileMissing
  }

  function testFire() {
    if (events.value.length === 0) return
    fire(events.value[0]!)
  }

  // Initial permission probe
  if (typeof Notification !== 'undefined') {
    permission.value = Notification.permission as PermissionState
  } else if (typeof window !== 'undefined') {
    permission.value = 'unsupported'
  }

  watch(
    [events, offsetMinutes, ignoredIds],
    () => {
      rebuild()
    },
    { immediate: true, deep: true },
  )

  onBeforeUnmount(() => {
    clearAllTimers()
  })

  return { permission, soundUnlocked, requestPermission, unlockSound, testFire }
}
