<script setup lang="ts">
import { computed, ref } from 'vue'
import type { CalendarEventDTO } from '~/server/services/calendar'
import type { ScheduleError } from '~/composables/useSchedule'

const props = defineProps<{
  events: CalendarEventDTO[]
  loading: boolean
  error: ScheduleError | null
  now: Date
  ignoredIds: Set<string>
  selectedDate: Date
  isToday: boolean
}>()

const emit = defineEmits<{
  toggleIgnore: [eventId: string]
  'update:selectedDate': [date: Date]
}>()

const hasEvents = computed(() => props.events.length > 0)

const dateInputValue = computed(() => {
  const d = props.selectedDate
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
})

function onDateInput(e: Event) {
  const value = (e.target as HTMLInputElement).value
  if (!value) return
  const [y, m, d] = value.split('-').map(Number)
  emit('update:selectedDate', new Date(y, m - 1, d))
}

function goToToday() {
  emit('update:selectedDate', new Date())
}

const noEventsMessage = computed(() =>
  props.isToday ? 'No events today' : 'No events on this day',
)

const noEventsSubtext = computed(() =>
  props.isToday ? 'Your schedule is clear.' : 'Nothing scheduled.',
)
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-4">
      <h2 class="font-display text-base text-ink">Schedule</h2>
      <span v-if="events.length > 0" class="tag tag-info">
        {{ events.length }} {{ events.length === 1 ? 'event' : 'events' }}
      </span>
    </div>

    <!-- Date selector -->
    <div class="flex items-center gap-2 mb-4">
      <div class="date-picker-wrap">
        <input
          type="date"
          :value="dateInputValue"
          class="date-picker field num text-xs"
          @input="onDateInput"
        />
      </div>
      <button
        v-if="!isToday"
        class="tag tag-accent cursor-pointer hover:brightness-125 transition-all"
        @click="goToToday"
      >
        Back to today
      </button>
    </div>

    <div v-if="error?.kind === 'not_connected'" class="rounded-xl bg-surface-soft border border-rule p-4 text-center">
      <p class="text-sm text-ink">Calendar not connected</p>
      <p class="text-xs text-mute mt-1">Sign out and sign in again to reconnect.</p>
    </div>

    <div v-else-if="error?.kind === 'auth_failed'" class="rounded-xl bg-danger-soft border border-danger/20 p-4 text-center">
      <p class="text-sm text-danger">Authorization expired</p>
      <p class="text-xs text-mute mt-1">Sign out and sign in again to refresh.</p>
    </div>

    <div v-else-if="error?.kind === 'unknown'" class="rounded-xl bg-warn-soft border border-warn/20 p-4">
      <p class="text-sm text-warn">Calendar temporarily unavailable</p>
      <p class="text-xs text-mute mt-1">{{ error.message }} — retrying.</p>
    </div>

    <div v-else-if="loading" class="text-mute text-sm py-4">Loading...</div>

    <div v-else-if="!hasEvents" class="rounded-xl bg-surface-soft border border-rule p-6 text-center">
      <p class="text-sm text-ink">{{ noEventsMessage }}</p>
      <p class="text-xs text-mute mt-1">{{ noEventsSubtext }}</p>
    </div>

    <ol v-else class="divide-y divide-rule">
      <EventRow
        v-for="e in events"
        :key="e.id"
        :event="e"
        :now="now"
        :ignored="ignoredIds.has(e.id)"
        @toggle-ignore="emit('toggleIgnore', $event)"
      />
    </ol>
  </div>
</template>

<style scoped>
.date-picker-wrap {
  position: relative;
}

.date-picker {
  padding: 0.35rem 0.6rem;
  font-size: 0.75rem;
  line-height: 1;
  border-radius: 0.5rem;
  cursor: pointer;
  color-scheme: dark;
}

.date-picker::-webkit-calendar-picker-indicator {
  filter: invert(0.7) sepia(1) saturate(2) hue-rotate(200deg);
  cursor: pointer;
  opacity: 0.6;
  transition: opacity 160ms ease;
}

.date-picker:hover::-webkit-calendar-picker-indicator {
  opacity: 1;
}
</style>
