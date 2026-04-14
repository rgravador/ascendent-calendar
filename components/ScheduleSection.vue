<script setup lang="ts">
import { computed } from 'vue'
import type { CalendarEventDTO } from '~/server/services/calendar'
import type { ScheduleError } from '~/composables/useSchedule'

const props = defineProps<{
  events: CalendarEventDTO[]
  loading: boolean
  error: ScheduleError | null
  now: Date
  ignoredIds: Set<string>
}>()

const emit = defineEmits<{
  toggleIgnore: [eventId: string]
}>()

const hasEvents = computed(() => props.events.length > 0)
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-4">
      <div class="flex items-center gap-2">
        <span class="kicker text-accent">01</span>
        <h2 class="text-sm text-ink font-medium tracking-wide">Schedule</h2>
      </div>
      <span v-if="events.length > 0" class="tag tag-info num">
        {{ String(events.length).padStart(2, '0') }}
      </span>
    </div>

    <div v-if="error?.kind === 'not_connected'" class="rounded-md bg-surface-soft border border-rule p-4 text-center">
      <p class="text-sm text-ink">Calendar not connected</p>
      <p class="text-xs text-mute mt-1">Sign out and sign in again to reconnect.</p>
    </div>

    <div v-else-if="error?.kind === 'auth_failed'" class="rounded-md bg-bear-soft border border-bear/30 p-4 text-center">
      <p class="text-sm text-bear">Authorization expired</p>
      <p class="text-xs text-mute mt-1">Sign out and sign in again to refresh.</p>
    </div>

    <div v-else-if="error?.kind === 'unknown'" class="rounded-md bg-warn-soft border border-warn/30 p-4">
      <p class="text-sm text-warn">Calendar temporarily unavailable</p>
      <p class="text-xs text-mute mt-1">{{ error.message }} — retrying.</p>
    </div>

    <div v-else-if="loading" class="text-mute text-xs font-mono py-4">Loading…</div>

    <div v-else-if="!hasEvents" class="rounded-md bg-surface-soft border border-rule p-6 text-center">
      <p class="text-sm text-ink">No events today</p>
      <p class="text-xs text-mute mt-1">Your schedule is clear.</p>
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
