import { readBody, createError } from 'h3'
import { updateSettings } from '~/server/repositories/settings'
import { ALARM_SOUNDS, type AlarmSound } from '~/server/types/models'

const MIN_OFFSET = 0
const MAX_OFFSET = 120
const MIN_VOLUME = 0
const MAX_VOLUME = 100
const MIN_RING_DURATION = 1
const MAX_RING_DURATION = 10

interface PatchBody {
  alarmOffsetMinutes?: number
  alarmSound?: AlarmSound
  alarmVolume?: number
  alarmRingDuration?: number
}

export default defineEventHandler(async (event) => {
  const body = await readBody<PatchBody>(event).catch(() => ({}))
  const patch: Partial<{ alarmOffsetMinutes: number; alarmSound: AlarmSound; alarmVolume: number; alarmRingDuration: number }> = {}

  if (body.alarmOffsetMinutes !== undefined) {
    const offset = body.alarmOffsetMinutes
    if (typeof offset !== 'number' || !Number.isFinite(offset)) {
      throw createError({ statusCode: 400, statusMessage: 'alarmOffsetMinutes must be a number' })
    }
    if (offset < MIN_OFFSET || offset > MAX_OFFSET) {
      throw createError({ statusCode: 400, statusMessage: `alarmOffsetMinutes must be between ${MIN_OFFSET} and ${MAX_OFFSET}` })
    }
    patch.alarmOffsetMinutes = Math.floor(offset)
  }

  if (body.alarmSound !== undefined) {
    if (!ALARM_SOUNDS.includes(body.alarmSound)) {
      throw createError({ statusCode: 400, statusMessage: `alarmSound must be one of: ${ALARM_SOUNDS.join(', ')}` })
    }
    patch.alarmSound = body.alarmSound
  }

  if (body.alarmVolume !== undefined) {
    const vol = body.alarmVolume
    if (typeof vol !== 'number' || !Number.isFinite(vol)) {
      throw createError({ statusCode: 400, statusMessage: 'alarmVolume must be a number' })
    }
    if (vol < MIN_VOLUME || vol > MAX_VOLUME) {
      throw createError({ statusCode: 400, statusMessage: `alarmVolume must be between ${MIN_VOLUME} and ${MAX_VOLUME}` })
    }
    patch.alarmVolume = Math.round(vol)
  }

  if (body.alarmRingDuration !== undefined) {
    const dur = body.alarmRingDuration
    if (typeof dur !== 'number' || !Number.isFinite(dur)) {
      throw createError({ statusCode: 400, statusMessage: 'alarmRingDuration must be a number' })
    }
    if (dur < MIN_RING_DURATION || dur > MAX_RING_DURATION) {
      throw createError({ statusCode: 400, statusMessage: `alarmRingDuration must be between ${MIN_RING_DURATION} and ${MAX_RING_DURATION}` })
    }
    patch.alarmRingDuration = Math.round(dur)
  }

  if (Object.keys(patch).length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'No valid fields to update' })
  }

  const updated = await updateSettings(patch)
  return {
    alarmOffsetMinutes: updated.alarmOffsetMinutes,
    alarmSound: updated.alarmSound,
    alarmVolume: updated.alarmVolume,
    alarmRingDuration: updated.alarmRingDuration,
    calendarConnected: Boolean(updated.googleRefreshToken),
  }
})
