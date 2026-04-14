<script setup lang="ts">
import { computed } from 'vue'

const now = useNow()
const schedule = useSchedule()
const { settings, setOffset } = useSettings()
const { ignoredIds, toggle: toggleIgnore } = useIgnoredEvents()

const offsetRef = computed(() => settings.value.alarmOffsetMinutes)

const alarms = useAlarms({
  events: schedule.events,
  offsetMinutes: offsetRef,
  ignoredIds,
})

const dateLine = computed(() =>
  now.value.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  }).toUpperCase(),
)

const clock = computed(() =>
  now.value.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }),
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

async function logout() {
  await $fetch('/api/session/logout', { method: 'POST' })
  await navigateTo('/')
}
</script>

<template>
  <div class="min-h-screen">
    <!-- Top bar — terminal-style -->
    <header class="border-b border-rule bg-surface/60 backdrop-blur sticky top-0 z-10">
      <div class="mx-auto max-w-[1600px] px-4 md:px-8 h-12 flex items-center justify-between gap-4">
        <div class="flex items-center gap-4">
          <div class="flex items-center gap-2">
            <span class="w-2 h-2 rounded-full bg-bull pulse" />
            <span class="kicker text-ink">DESK // LIVE</span>
          </div>
          <span class="kicker hidden md:inline">{{ dateLine }}</span>
          <span class="num text-sm text-ink tabular-nums">{{ clock }}</span>
        </div>
        <div class="flex items-center gap-2">
          <SettingsPopover
            :offset-minutes="settings.alarmOffsetMinutes"
            @update="onOffsetUpdate"
          />
          <button class="btn btn-ghost text-xs" @click="logout">
            Sign out
          </button>
        </div>
      </div>
    </header>

    <!-- Stats strip -->
    <div class="mx-auto max-w-[1600px] px-4 md:px-8 pt-6">
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div class="card p-4">
          <div class="kicker">Events Today</div>
          <div class="num text-2xl mt-1 text-ink">{{ schedule.events.value.length }}</div>
          <div class="text-xs text-mute mt-1">
            <span class="arrow-up" />{{ upcomingCount }} upcoming
          </div>
        </div>
        <div class="card p-4">
          <div class="kicker">Next In</div>
          <div class="num text-2xl mt-1" :class="minsToNext !== null ? 'text-bull' : 'text-mute'">
            {{ minsToNext !== null ? `${minsToNext}m` : '--' }}
          </div>
          <div class="text-xs text-mute mt-1 truncate">
            {{ nextEvent?.title ?? 'No upcoming events' }}
          </div>
        </div>
        <div class="card p-4">
          <div class="kicker">Alarm Offset</div>
          <div class="num text-2xl mt-1 text-warn">{{ settings.alarmOffsetMinutes }}m</div>
          <div class="text-xs text-mute mt-1">Pre-event window</div>
        </div>
        <div class="card p-4">
          <div class="kicker">Signal Status</div>
          <div class="num text-2xl mt-1" :class="alarms.permission.value === 'granted' && alarms.soundUnlocked.value ? 'text-bull' : 'text-bear'">
            {{ alarms.permission.value === 'granted' && alarms.soundUnlocked.value ? 'ARMED' : 'OFF' }}
          </div>
          <div class="text-xs text-mute mt-1">
            {{ alarms.permission.value === 'granted' && alarms.soundUnlocked.value ? 'Notifications + sound ready' : 'Enable below' }}
          </div>
        </div>
      </div>

      <PermissionBanner
        :permission="alarms.permission.value"
        :sound-unlocked="alarms.soundUnlocked.value"
        @request-permission="alarms.requestPermission"
        @unlock-sound="alarms.unlockSound"
      />
    </div>

    <!-- Three-column terminal grid -->
    <section class="mx-auto max-w-[1600px] px-4 md:px-8 py-6 grid grid-cols-1 lg:grid-cols-[1.2fr_1fr_1.1fr] gap-4">
      <div class="card p-5 min-w-0">
        <ScheduleSection
          :events="schedule.events.value"
          :loading="schedule.loading.value"
          :error="schedule.error.value"
          :now="now"
          :ignored-ids="ignoredIds"
          @toggle-ignore="toggleIgnore"
        />
      </div>
      <div class="card p-5 min-w-0">
        <TodosSection />
      </div>
      <div class="card p-5 min-w-0">
        <NotesSection />
      </div>
    </section>

    <footer class="mx-auto max-w-[1600px] px-4 md:px-8 pb-6">
      <div class="text-xs text-mute flex items-center justify-between border-t border-rule pt-4">
        <span class="kicker">Desk // Personal Terminal</span>
        <span class="num">v1.0.0 · {{ now.getFullYear() }}</span>
      </div>
    </footer>
  </div>
</template>
