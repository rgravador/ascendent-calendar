import { ref, onMounted } from 'vue'
import type { AlarmSound } from '~/server/types/models'

interface ClientSettings {
  alarmOffsetMinutes: number
  alarmSound: AlarmSound
  alarmVolume: number
  alarmRingDuration: number
  calendarConnected: boolean
}

const DEFAULTS: ClientSettings = { alarmOffsetMinutes: 5, alarmSound: 'bells', alarmVolume: 70, alarmRingDuration: 2, calendarConnected: false }

export function useSettings() {
  const settings = ref<ClientSettings>({ ...DEFAULTS })
  const loading = ref(true)

  async function load() {
    try {
      settings.value = await $fetch<ClientSettings>('/api/settings')
    } catch {
      settings.value = { ...DEFAULTS }
    } finally {
      loading.value = false
    }
  }

  async function patch(body: Partial<Pick<ClientSettings, 'alarmOffsetMinutes' | 'alarmSound' | 'alarmVolume' | 'alarmRingDuration'>>) {
    const updated = await $fetch<Partial<ClientSettings>>('/api/settings', {
      method: 'PATCH',
      body,
    })
    settings.value = { ...settings.value, ...updated }
  }

  async function setOffset(minutes: number) {
    await patch({ alarmOffsetMinutes: minutes })
  }

  async function setAlarmSound(sound: AlarmSound) {
    await patch({ alarmSound: sound })
  }

  async function setAlarmVolume(volume: number) {
    await patch({ alarmVolume: volume })
  }

  async function setAlarmRingDuration(minutes: number) {
    await patch({ alarmRingDuration: minutes })
  }

  onMounted(load)

  return { settings, loading, setOffset, setAlarmSound, setAlarmVolume, setAlarmRingDuration, reload: load }
}
