import { getDb } from '~/server/utils/mongo'
import { isMockMode } from '~/server/utils/mock-mode'
import { mockSettings } from '~/server/mock/store'
import { ALARM_SOUNDS, defaultSettings, type Settings } from '~/server/types/models'

const COLLECTION = 'settings'

export async function getSettings(userId: string): Promise<Settings> {
  if (isMockMode()) return mockSettings.get(userId)
  const db = await getDb()
  const doc = await db.collection<Settings>(COLLECTION).findOne({ _id: userId })
  const defaults = defaultSettings(userId)
  if (!doc) return { ...defaults }
  return { ...defaults, ...doc }
}

export async function updateSettings(userId: string, patch: Partial<Omit<Settings, '_id'>>): Promise<Settings> {
  if (isMockMode()) return mockSettings.patch(userId, patch)
  const db = await getDb()
  const defaults = defaultSettings(userId)
  const safePatch: Partial<Omit<Settings, '_id'>> = {}
  if (typeof patch.alarmOffsetMinutes === 'number' && Number.isFinite(patch.alarmOffsetMinutes)) {
    safePatch.alarmOffsetMinutes = Math.max(0, Math.floor(patch.alarmOffsetMinutes))
  }
  if (typeof patch.alarmSound === 'string' && ALARM_SOUNDS.includes(patch.alarmSound)) {
    safePatch.alarmSound = patch.alarmSound
  }
  if (typeof patch.alarmVolume === 'number' && Number.isFinite(patch.alarmVolume)) {
    safePatch.alarmVolume = Math.max(0, Math.min(100, Math.round(patch.alarmVolume)))
  }
  if (typeof patch.alarmRingDuration === 'number' && Number.isFinite(patch.alarmRingDuration)) {
    safePatch.alarmRingDuration = Math.max(1, Math.min(10, Math.round(patch.alarmRingDuration)))
  }
  await db.collection<Settings>(COLLECTION).updateOne(
    { _id: userId },
    { $set: safePatch, $setOnInsert: { _id: userId, alarmOffsetMinutes: defaults.alarmOffsetMinutes } },
    { upsert: true },
  )
  return getSettings(userId)
}
