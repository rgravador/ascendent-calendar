export type Priority = 'high' | 'med' | 'low'

export const PRIORITIES: readonly Priority[] = ['high', 'med', 'low'] as const

export interface User {
  _id: string // Google sub (unique ID)
  email: string
  name: string
  picture?: string
  googleRefreshToken: string
  googleTokenUpdatedAt: string
  createdAt: string
  updatedAt: string
}

export type AlarmSound = 'chime' | 'bell' | 'pulse' | 'marimba'

export const ALARM_SOUNDS: readonly AlarmSound[] = ['chime', 'bell', 'pulse', 'marimba'] as const

export interface Settings {
  _id: 'singleton'
  alarmOffsetMinutes: number
  alarmSound: AlarmSound
  alarmVolume: number // 0–100
  alarmRingDuration: number // minutes (1–10)
  googleRefreshToken?: string
  googleTokenUpdatedAt?: string
}

export interface Todo {
  _id: string
  text: string
  priority: Priority
  dueDate?: string // ISO date (YYYY-MM-DD) or full ISO
  done: boolean
  createdAt: string
  updatedAt: string
}

export interface Note {
  _id: string
  title?: string
  body: string
  createdAt: string
  updatedAt: string
}

export const DEFAULT_SETTINGS: Settings = {
  _id: 'singleton',
  alarmOffsetMinutes: 5,
  alarmSound: 'chime',
  alarmVolume: 70,
  alarmRingDuration: 2,
}
