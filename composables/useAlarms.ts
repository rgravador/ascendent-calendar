import { ref, watch, onBeforeUnmount, type Ref } from 'vue'
import type { CalendarEventDTO } from '~/server/services/calendar'
import type { AlarmSound } from '~/server/types/models'

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

export interface RingingAlarm {
  eventId: string
  eventTitle: string
}

export interface AlarmsApi {
  permission: Ref<PermissionState>
  soundUnlocked: Ref<boolean>
  ringing: Ref<RingingAlarm | null>
  dismiss: () => void
  requestPermission: () => Promise<void>
  unlockSound: () => Promise<void>
  testFire: () => void
  previewSound: (sound: AlarmSound) => void
}

interface Options {
  events: Ref<CalendarEventDTO[]>
  offsetMinutes: Ref<number>
  ignoredIds: Ref<Set<string>>
  alarmSound: Ref<AlarmSound>
  alarmVolume: Ref<number> // 0–100
  alarmRingDuration: Ref<number> // minutes (1–10)
}

function playSynthSound(ctx: AudioContext, sound: AlarmSound, volume: number) {
  const gain01 = Math.max(0, Math.min(1, volume / 100))
  const now = ctx.currentTime

  switch (sound) {
    case 'chime': {
      const frequencies = [880, 1318.51]
      frequencies.forEach((freq, i) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.value = freq
        const start = now + i * 0.18
        const end = start + 0.35
        gain.gain.setValueAtTime(0, start)
        gain.gain.linearRampToValueAtTime(0.22 * gain01, start + 0.02)
        gain.gain.exponentialRampToValueAtTime(0.0001, end)
        osc.connect(gain).connect(ctx.destination)
        osc.start(start)
        osc.stop(end + 0.05)
      })
      break
    }
    case 'bell': {
      const harmonics = [
        { freq: 523.25, amp: 1.0, decay: 1.2 },
        { freq: 1046.5, amp: 0.6, decay: 0.8 },
        { freq: 1569.75, amp: 0.3, decay: 0.5 },
      ]
      harmonics.forEach(({ freq, amp, decay }) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.value = freq
        const peak = amp * 0.3 * gain01
        gain.gain.setValueAtTime(peak, now)
        gain.gain.exponentialRampToValueAtTime(0.0001, now + decay)
        osc.connect(gain).connect(ctx.destination)
        osc.start(now)
        osc.stop(now + decay + 0.05)
      })
      break
    }
    case 'pulse': {
      for (let i = 0; i < 2; i++) {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'square'
        osc.frequency.value = 1000
        const start = now + i * 0.2
        const end = start + 0.1
        gain.gain.setValueAtTime(0.15 * gain01, start)
        gain.gain.setValueAtTime(0, end)
        osc.connect(gain).connect(ctx.destination)
        osc.start(start)
        osc.stop(end + 0.01)
      }
      break
    }
    case 'marimba': {
      const notes = [659.25, 783.99, 659.25]
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'triangle'
        osc.frequency.value = freq
        const start = now + i * 0.15
        const peak = 0.28 * gain01
        gain.gain.setValueAtTime(0, start)
        gain.gain.linearRampToValueAtTime(peak, start + 0.005)
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.45)
        osc.connect(gain).connect(ctx.destination)
        osc.start(start)
        osc.stop(start + 0.5)
      })
      break
    }
  }
}

const RING_INTERVAL_MS = 3_000 // replay sound every 3 seconds

export function useAlarms({ events, offsetMinutes, ignoredIds, alarmSound, alarmVolume, alarmRingDuration }: Options): AlarmsApi {
  const permission = ref<PermissionState>('default')
  const soundUnlocked = ref(false)
  const ringing = ref<RingingAlarm | null>(null)
  const timers = new Set<ReturnType<typeof setTimeout>>()
  let audioCtx: AudioContext | null = null
  let ringInterval: ReturnType<typeof setInterval> | null = null
  let ringTimeout: ReturnType<typeof setTimeout> | null = null

  function ensureAudioCtx(): AudioContext | null {
    if (typeof window === 'undefined') return null
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (Ctx && !audioCtx) audioCtx = new Ctx()
    } catch {
      // ignore
    }
    return audioCtx
  }

  function playSound() {
    const ctx = ensureAudioCtx()
    if (!ctx) return
    if (ctx.state === 'suspended') void ctx.resume()
    playSynthSound(ctx, alarmSound.value, alarmVolume.value)
  }

  function stopRinging() {
    if (ringInterval) {
      clearInterval(ringInterval)
      ringInterval = null
    }
    if (ringTimeout) {
      clearTimeout(ringTimeout)
      ringTimeout = null
    }
    ringing.value = null
  }

  function dismiss() {
    stopRinging()
  }

  function startRinging(event: CalendarEventDTO) {
    // If already ringing for another event, stop the previous one first
    stopRinging()

    ringing.value = { eventId: event.id, eventTitle: event.title }

    // Play immediately, then repeat every RING_INTERVAL_MS
    playSound()
    ringInterval = setInterval(() => playSound(), RING_INTERVAL_MS)

    // Auto-stop after configured duration
    const durationMs = Math.max(1, alarmRingDuration.value) * MS_PER_MINUTE
    ringTimeout = setTimeout(() => stopRinging(), durationMs)
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
        // in certain contexts. Silent failure is fine — the sound still plays.
      }
    }

    if (!soundUnlocked.value) return
    startRinging(event)
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
        fire(ev)
      }
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

    try {
      const ctx = ensureAudioCtx()
      if (ctx && ctx.state === 'suspended') await ctx.resume()
    } catch {
      // ignore
    }

    soundUnlocked.value = Boolean(audioCtx)
  }

  function testFire() {
    if (events.value.length === 0) return
    fire(events.value[0]!)
  }

  function previewSound(sound: AlarmSound) {
    const ctx = ensureAudioCtx()
    if (!ctx) return
    if (ctx.state === 'suspended') void ctx.resume()
    playSynthSound(ctx, sound, alarmVolume.value)
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
    stopRinging()
  })

  return { permission, soundUnlocked, ringing, dismiss, requestPermission, unlockSound, testFire, previewSound }
}
