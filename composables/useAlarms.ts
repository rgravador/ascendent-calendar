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

function osc(ctx: AudioContext, type: OscillatorType, freq: number, start: number, stop: number, gainNode: GainNode) {
  const o = ctx.createOscillator()
  o.type = type
  o.frequency.value = freq
  o.connect(gainNode).connect(ctx.destination)
  o.start(start)
  o.stop(stop)
  return o
}

function env(g: GainNode, start: number, peak: number, attackEnd: number, decayEnd: number) {
  g.gain.setValueAtTime(0, start)
  g.gain.linearRampToValueAtTime(peak, attackEnd)
  g.gain.exponentialRampToValueAtTime(0.0001, decayEnd)
}

function playSynthSound(ctx: AudioContext, sound: AlarmSound, volume: number) {
  const v = Math.max(0, Math.min(1, volume / 100))
  const t = ctx.currentTime

  switch (sound) {
    case 'bells': {
      // Two bright bell tones in sequence
      const freqs = [880, 1318.51]
      freqs.forEach((freq, i) => {
        const g = ctx.createGain()
        const s = t + i * 0.18
        env(g, s, 0.22 * v, s + 0.02, s + 0.35)
        osc(ctx, 'sine', freq, s, s + 0.4, g)
      })
      break
    }
    case 'birds': {
      // Chirp-like frequency sweeps
      for (let i = 0; i < 3; i++) {
        const g = ctx.createGain()
        const o = ctx.createOscillator()
        o.type = 'sine'
        const s = t + i * 0.25
        o.frequency.setValueAtTime(2200, s)
        o.frequency.linearRampToValueAtTime(3200, s + 0.06)
        o.frequency.linearRampToValueAtTime(2400, s + 0.12)
        env(g, s, 0.18 * v, s + 0.01, s + 0.15)
        o.connect(g).connect(ctx.destination)
        o.start(s)
        o.stop(s + 0.2)
      }
      break
    }
    case 'childhood': {
      // Playful ascending melody (C5-E5-G5-C6)
      const notes = [523.25, 659.25, 783.99, 1046.5]
      notes.forEach((freq, i) => {
        const g = ctx.createGain()
        const s = t + i * 0.15
        env(g, s, 0.2 * v, s + 0.01, s + 0.28)
        osc(ctx, 'triangle', freq, s, s + 0.32, g)
      })
      break
    }
    case 'classic': {
      // Traditional alarm: two alternating tones
      for (let i = 0; i < 4; i++) {
        const g = ctx.createGain()
        const freq = i % 2 === 0 ? 800 : 1000
        const s = t + i * 0.15
        g.gain.setValueAtTime(0.2 * v, s)
        g.gain.setValueAtTime(0, s + 0.12)
        osc(ctx, 'square', freq, s, s + 0.13, g)
      }
      break
    }
    case 'cuckoo': {
      // Two descending tones (G5 → E5)
      const tones = [783.99, 659.25]
      tones.forEach((freq, i) => {
        const g = ctx.createGain()
        const s = t + i * 0.35
        env(g, s, 0.22 * v, s + 0.01, s + 0.3)
        osc(ctx, 'triangle', freq, s, s + 0.35, g)
      })
      break
    }
    case 'flute': {
      // Soft sine with vibrato
      const g = ctx.createGain()
      const o = ctx.createOscillator()
      const lfo = ctx.createOscillator()
      const lfoGain = ctx.createGain()
      o.type = 'sine'
      o.frequency.value = 880
      lfo.type = 'sine'
      lfo.frequency.value = 5
      lfoGain.gain.value = 8
      lfo.connect(lfoGain).connect(o.frequency)
      env(g, t, 0.2 * v, t + 0.05, t + 0.8)
      o.connect(g).connect(ctx.destination)
      o.start(t)
      o.stop(t + 0.85)
      lfo.start(t)
      lfo.stop(t + 0.85)
      break
    }
    case 'glow': {
      // Warm pad swell
      const harmonics = [440, 554.37, 659.25]
      harmonics.forEach((freq) => {
        const g = ctx.createGain()
        env(g, t, 0.12 * v, t + 0.3, t + 1.2)
        osc(ctx, 'sine', freq, t, t + 1.25, g)
      })
      break
    }
    case 'guitar': {
      // Plucked string simulation (sharp attack, quick decay)
      const notes = [329.63, 392.0, 493.88]
      notes.forEach((freq, i) => {
        const g = ctx.createGain()
        const s = t + i * 0.2
        env(g, s, 0.25 * v, s + 0.003, s + 0.5)
        osc(ctx, 'triangle', freq, s, s + 0.55, g)
        // Add harmonic overtone
        const g2 = ctx.createGain()
        env(g2, s, 0.08 * v, s + 0.003, s + 0.25)
        osc(ctx, 'sine', freq * 2, s, s + 0.3, g2)
      })
      break
    }
    case 'happy': {
      // Upbeat ascending arpeggio (C-E-G-C)
      const notes = [523.25, 659.25, 783.99, 1046.5]
      notes.forEach((freq, i) => {
        const g = ctx.createGain()
        const s = t + i * 0.1
        env(g, s, 0.22 * v, s + 0.008, s + 0.2)
        osc(ctx, 'sine', freq, s, s + 0.25, g)
      })
      break
    }
    case 'harp': {
      // Cascading arpeggiated tones
      const notes = [261.63, 329.63, 392.0, 493.88, 523.25, 659.25]
      notes.forEach((freq, i) => {
        const g = ctx.createGain()
        const s = t + i * 0.1
        env(g, s, 0.18 * v, s + 0.005, s + 0.7)
        osc(ctx, 'sine', freq, s, s + 0.75, g)
      })
      break
    }
    case 'musicBox': {
      // Delicate high-pitched melody
      const notes = [1046.5, 1174.66, 1318.51, 1174.66, 1046.5]
      notes.forEach((freq, i) => {
        const g = ctx.createGain()
        const s = t + i * 0.18
        env(g, s, 0.15 * v, s + 0.005, s + 0.35)
        osc(ctx, 'sine', freq, s, s + 0.4, g)
      })
      break
    }
    case 'paradiseIsland': {
      // Steel drum-like tones with warm resonance
      const notes = [523.25, 659.25, 783.99, 659.25]
      notes.forEach((freq, i) => {
        const g = ctx.createGain()
        const s = t + i * 0.22
        env(g, s, 0.2 * v, s + 0.005, s + 0.45)
        osc(ctx, 'sine', freq, s, s + 0.5, g)
        // Octave harmonic for brightness
        const g2 = ctx.createGain()
        env(g2, s, 0.06 * v, s + 0.005, s + 0.2)
        osc(ctx, 'sine', freq * 2, s, s + 0.25, g2)
      })
      break
    }
    case 'piano': {
      // Rich piano-like tone with harmonics
      const notes = [523.25, 659.25, 783.99]
      notes.forEach((freq, i) => {
        const g = ctx.createGain()
        const s = t + i * 0.25
        env(g, s, 0.25 * v, s + 0.005, s + 0.8)
        osc(ctx, 'sine', freq, s, s + 0.85, g)
        // 2nd harmonic
        const g2 = ctx.createGain()
        env(g2, s, 0.1 * v, s + 0.005, s + 0.5)
        osc(ctx, 'sine', freq * 2, s, s + 0.55, g2)
        // 3rd harmonic
        const g3 = ctx.createGain()
        env(g3, s, 0.04 * v, s + 0.005, s + 0.3)
        osc(ctx, 'sine', freq * 3, s, s + 0.35, g3)
      })
      break
    }
    case 'pipe': {
      // Organ pipe sound — sustained with slight tremolo
      const g = ctx.createGain()
      const o = ctx.createOscillator()
      const lfo = ctx.createOscillator()
      const lfoGain = ctx.createGain()
      o.type = 'sine'
      o.frequency.value = 587.33 // D5
      lfo.type = 'sine'
      lfo.frequency.value = 3.5
      lfoGain.gain.value = 0.03 * v
      lfo.connect(lfoGain).connect(g.gain)
      g.gain.setValueAtTime(0, t)
      g.gain.linearRampToValueAtTime(0.2 * v, t + 0.08)
      g.gain.setValueAtTime(0.18 * v, t + 0.6)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9)
      o.connect(g).connect(ctx.destination)
      o.start(t)
      o.stop(t + 0.95)
      lfo.start(t)
      lfo.stop(t + 0.95)
      break
    }
    case 'pizzicato': {
      // Short plucked string bursts
      const notes = [440, 554.37, 659.25, 554.37]
      notes.forEach((freq, i) => {
        const g = ctx.createGain()
        const s = t + i * 0.15
        env(g, s, 0.28 * v, s + 0.003, s + 0.18)
        osc(ctx, 'triangle', freq, s, s + 0.22, g)
      })
      break
    }
    case 'rooster': {
      // Rising frequency sweep (cock-a-doodle)
      for (let i = 0; i < 2; i++) {
        const g = ctx.createGain()
        const o = ctx.createOscillator()
        o.type = 'sawtooth'
        const s = t + i * 0.4
        o.frequency.setValueAtTime(400, s)
        o.frequency.linearRampToValueAtTime(900, s + 0.15)
        o.frequency.linearRampToValueAtTime(700, s + 0.3)
        env(g, s, 0.12 * v, s + 0.02, s + 0.35)
        o.connect(g).connect(ctx.destination)
        o.start(s)
        o.stop(s + 0.4)
      }
      break
    }
    case 'savannah': {
      // Warm, deep tones evoking open landscape
      const notes = [220, 261.63, 329.63]
      notes.forEach((freq, i) => {
        const g = ctx.createGain()
        const s = t + i * 0.3
        env(g, s, 0.18 * v, s + 0.05, s + 0.8)
        osc(ctx, 'sine', freq, s, s + 0.85, g)
      })
      break
    }
    case 'school': {
      // Classic school bell — rapid hits
      for (let i = 0; i < 3; i++) {
        const s = t + i * 0.2
        const harmonics = [
          { freq: 1200, amp: 1.0, decay: 0.3 },
          { freq: 2400, amp: 0.4, decay: 0.15 },
        ]
        harmonics.forEach(({ freq, amp, decay }) => {
          const gn = ctx.createGain()
          gn.gain.setValueAtTime(amp * 0.2 * v, s)
          gn.gain.exponentialRampToValueAtTime(0.0001, s + decay)
          osc(ctx, 'sine', freq, s, s + decay + 0.05, gn)
        })
      }
      break
    }
    case 'twinkle': {
      // Sparkling high-pitched descending notes
      const notes = [1568, 1396.91, 1318.51, 1174.66, 1046.5]
      notes.forEach((freq, i) => {
        const g = ctx.createGain()
        const s = t + i * 0.12
        env(g, s, 0.14 * v, s + 0.005, s + 0.25)
        osc(ctx, 'sine', freq, s, s + 0.3, g)
      })
      break
    }
    case 'windChimes': {
      // Random-ish high metallic tones
      const notes = [1046.5, 1174.66, 1318.51, 1396.91, 1568]
      notes.forEach((freq, i) => {
        const g = ctx.createGain()
        const s = t + i * 0.15 + (i % 2) * 0.05
        env(g, s, 0.12 * v, s + 0.01, s + 0.6)
        osc(ctx, 'sine', freq, s, s + 0.65, g)
      })
      break
    }
    case 'xylophone': {
      // Bright mallet hits
      const notes = [659.25, 783.99, 659.25]
      notes.forEach((freq, i) => {
        const g = ctx.createGain()
        const s = t + i * 0.15
        env(g, s, 0.28 * v, s + 0.005, s + 0.45)
        osc(ctx, 'triangle', freq, s, s + 0.5, g)
      })
      break
    }
  }
}

const RING_INTERVAL_MS = 1_000 // replay sound every 1 second
const SOUND_UNLOCKED_KEY = 'alarm:soundUnlocked'

export function useAlarms({ events, offsetMinutes, ignoredIds, alarmSound, alarmVolume, alarmRingDuration }: Options): AlarmsApi {
  const permission = ref<PermissionState>('default')
  const wasPreviouslyUnlocked = typeof localStorage !== 'undefined' && localStorage.getItem(SOUND_UNLOCKED_KEY) === '1'
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
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(SOUND_UNLOCKED_KEY, soundUnlocked.value ? '1' : '0')
    }
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

  // Auto-unlock sound if it was previously enabled
  if (wasPreviouslyUnlocked) {
    void unlockSound()
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
