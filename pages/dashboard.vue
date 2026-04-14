<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const IGNORED_IDS_KEY = 'alarm:ignoredIds'

function loadIgnoredIds(): Set<string> {
  if (typeof localStorage === 'undefined') return new Set()
  try {
    const raw = localStorage.getItem(IGNORED_IDS_KEY)
    if (raw) return new Set(JSON.parse(raw) as string[])
  } catch { /* ignore */ }
  return new Set()
}

const now = useNow()
const selectedDate = ref(new Date())
const schedule = useSchedule(selectedDate)
const { settings, setOffset, setAlarmSound, setAlarmVolume, setAlarmRingDuration } = useSettings()

const offsetRef = computed(() => settings.value.alarmOffsetMinutes)
const soundRef = computed(() => settings.value.alarmSound)
const volumeRef = computed(() => settings.value.alarmVolume)
const ringDurationRef = computed(() => settings.value.alarmRingDuration)

const ignoredIds = ref(loadIgnoredIds())

watch(ignoredIds, (ids) => {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(IGNORED_IDS_KEY, JSON.stringify([...ids]))
}, { deep: true })

function toggleIgnore(eventId: string) {
  const next = new Set(ignoredIds.value)
  if (next.has(eventId)) {
    next.delete(eventId)
  } else {
    next.add(eventId)
  }
  ignoredIds.value = next
}

const alarms = useAlarms({
  events: schedule.events,
  offsetMinutes: offsetRef,
  ignoredIds,
  alarmSound: soundRef,
  alarmVolume: volumeRef,
  alarmRingDuration: ringDurationRef,
})

const greeting = computed(() => {
  const h = now.value.getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
})

const dateLine = computed(() =>
  now.value.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }),
)

const clock = computed(() =>
  now.value.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: true }),
)

// Stats row values
const upcomingCount = computed(() =>
  schedule.events.value.filter((e) => new Date(e.start).getTime() > now.value.getTime()).length,
)

const nextEvent = computed(() => {
  const t = now.value.getTime()
  return schedule.events.value.find((e) => new Date(e.start).getTime() > t) ?? null
})

const minsToNext = computed(() => {
  if (!nextEvent.value) return null
  return Math.max(0, Math.round((new Date(nextEvent.value.start).getTime() - now.value.getTime()) / 60000))
})

async function onOffsetUpdate(minutes: number) {
  await setOffset(minutes)
}

async function onSoundUpdate(sound: import('~/server/types/models').AlarmSound) {
  await setAlarmSound(sound)
}

async function onVolumeUpdate(volume: number) {
  await setAlarmVolume(volume)
}

async function onRingDurationUpdate(minutes: number) {
  await setAlarmRingDuration(minutes)
}

async function logout() {
  await $fetch('/api/session/logout', { method: 'POST' })
  await navigateTo('/')
}
</script>

<template>
  <div class="min-h-screen">
    <!-- Top bar -->
    <header class="border-b border-rule bg-surface/80 backdrop-blur-lg sticky top-0 z-10">
      <div class="mx-auto max-w-[1440px] px-4 md:px-8 h-14 flex items-center justify-between gap-4">
        <div class="flex items-center gap-4">
          <div class="flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-lg bg-accent-soft flex items-center justify-center">
              <svg class="w-4 h-4 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </div>
            <span class="font-display text-lg text-ink">My Day</span>
          </div>
          <span class="hidden md:inline text-sm text-mute">{{ dateLine }}</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-sm font-medium text-ink-soft tabular-nums">{{ clock }}</span>
          <SettingsPopover
            :offset-minutes="settings.alarmOffsetMinutes"
            :alarm-sound="settings.alarmSound"
            :alarm-volume="settings.alarmVolume"
            :alarm-ring-duration="settings.alarmRingDuration"
            @update:offset="onOffsetUpdate"
            @update:sound="onSoundUpdate"
            @update:volume="onVolumeUpdate"
            @update:ring-duration="onRingDurationUpdate"
            @preview="alarms.previewSound"
          />
          <button class="btn btn-ghost text-xs" @click="logout">
            Sign out
          </button>
        </div>
      </div>
    </header>

    <!-- Greeting & stats -->
    <div class="mx-auto max-w-[1440px] px-4 md:px-8 pt-8">
      <h1 class="font-display text-2xl md:text-3xl text-ink">{{ greeting }}</h1>

      <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
        <div class="card p-4">
          <div class="section-label">Events today</div>
          <div class="font-display text-2xl mt-1.5 text-ink">{{ schedule.events.value.length }}</div>
          <div class="text-xs text-mute mt-1">
            <span class="arrow-up" />{{ upcomingCount }} upcoming
          </div>
        </div>
        <div class="card p-4">
          <div class="section-label">Next in</div>
          <div class="font-display text-2xl mt-1.5" :class="minsToNext !== null ? 'text-accent' : 'text-mute'">
            {{ minsToNext !== null ? `${minsToNext}m` : '--' }}
          </div>
          <div class="text-xs text-mute mt-1 truncate">
            {{ nextEvent?.title ?? 'No upcoming events' }}
          </div>
        </div>
        <div class="card p-4">
          <div class="section-label">Alarm offset</div>
          <div class="font-display text-2xl mt-1.5 text-ink">{{ settings.alarmOffsetMinutes }}m</div>
          <div class="text-xs text-mute mt-1">Before each event</div>
        </div>
        <div class="card p-4">
          <div class="section-label">Notifications</div>
          <div class="font-display text-2xl mt-1.5" :class="alarms.permission.value === 'granted' && alarms.soundUnlocked.value ? 'text-success' : 'text-mute'">
            {{ alarms.permission.value === 'granted' && alarms.soundUnlocked.value ? 'On' : 'Off' }}
          </div>
          <div class="text-xs text-mute mt-1">
            {{ alarms.permission.value === 'granted' && alarms.soundUnlocked.value ? 'Sound & alerts ready' : 'Enable below' }}
          </div>
        </div>
      </div>

      <PermissionBanner
        :permission="alarms.permission.value"
        :sound-unlocked="alarms.soundUnlocked.value"
        @request-permission="alarms.requestPermission"
        @unlock-sound="alarms.unlockSound"
      />

      <!-- Active alarm banner -->
      <div
        v-if="alarms.ringing.value"
        class="mt-3 card border-danger/30 bg-danger-soft p-4 flex items-center justify-between gap-4 animate-pulse"
      >
        <div class="flex items-center gap-3 min-w-0">
          <span class="w-3 h-3 rounded-full bg-danger shrink-0 pulse" />
          <div class="min-w-0">
            <div class="font-display text-sm text-danger">Alarm ringing</div>
            <div class="text-sm text-ink truncate mt-0.5">{{ alarms.ringing.value.eventTitle }}</div>
          </div>
        </div>
        <button
          class="btn btn-accent text-xs shrink-0"
          @click="alarms.dismiss"
        >
          Dismiss
        </button>
      </div>
    </div>

    <!-- Three-column grid -->
    <section class="mx-auto max-w-[1440px] px-4 md:px-8 py-6 grid grid-cols-1 lg:grid-cols-[1.2fr_1fr_1.1fr] gap-4">
      <div class="card p-5 min-w-0">
        <ScheduleSection
          :events="schedule.events.value"
          :loading="schedule.loading.value"
          :error="schedule.error.value"
          :now="now"
          :ignored-ids="ignoredIds"
          :selected-date="selectedDate"
          :is-today="schedule.isToday.value"
          @toggle-ignore="toggleIgnore"
          @update:selected-date="selectedDate = $event"
        />
      </div>
      <div class="card p-5 min-w-0">
        <TodosSection />
      </div>
      <div class="card p-5 min-w-0">
        <NotesSection />
      </div>
    </section>

    <footer class="mx-auto max-w-[1440px] px-4 md:px-8 pb-6">
      <div class="text-xs text-mute flex items-center justify-between border-t border-rule pt-4">
        <span class="font-display font-semibold tracking-wide">My Day</span>
        <span class="tabular-nums">v1.0.0</span>
      </div>
    </footer>
  </div>
</template>
