<script setup lang="ts">
import { computed } from 'vue'
import type { CalendarEventDTO } from '~/server/services/calendar'
import { formatClock, formatDuration, isCurrent, diffMinutes } from '~/utils/time'

const props = defineProps<{
  event: CalendarEventDTO
  now: Date
  ignored: boolean
}>()

const emit = defineEmits<{
  toggleIgnore: [eventId: string]
}>()

const clock = computed(() => formatClock(props.event.start))
const duration = computed(() => formatDuration(props.event.start, props.event.end))
const current = computed(() => isCurrent(props.event.start, props.event.end, props.now))
const minsToStart = computed(() => diffMinutes(props.event.start, props.now))
const past = computed(() => !current.value && new Date(props.event.end).getTime() < props.now.getTime())

const state = computed(() => {
  if (current.value) return 'live'
  if (past.value) return 'closed'
  if (minsToStart.value <= 15) return 'imminent'
  return 'queued'
})

const relative = computed(() => {
  if (current.value) return 'Now'
  if (past.value) return 'Done'
  const m = minsToStart.value
  if (m < 60) return `in ${m}m`
  return `in ${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`
})

const relativeClass = computed(() => {
  if (current.value) return 'tag-bull'
  if (past.value) return ''
  if (state.value === 'imminent') return 'tag-warn'
  return 'tag-info'
})
</script>

<template>
  <li
    class="py-3 flex gap-3 items-start group transition"
    :class="{ 'opacity-40': past, 'opacity-30': ignored }"
  >
    <!-- time rail -->
    <div class="flex flex-col items-end min-w-[3.5rem] pt-0.5">
      <span
        class="num text-sm leading-none font-medium"
        :class="current ? 'text-success' : 'text-ink'"
      >{{ clock }}</span>
      <span class="text-[0.65rem] text-mute mt-1 num">{{ duration }}</span>
    </div>

    <!-- border tick -->
    <div
      class="w-[3px] self-stretch rounded-full"
      :class="{
        'bg-success': current,
        'bg-warn': state === 'imminent',
        'bg-info': state === 'queued',
        'bg-rule-strong': past,
      }"
    />

    <!-- content -->
    <div class="flex-1 min-w-0">
      <div class="flex items-start justify-between gap-2">
        <a
          v-if="event.htmlLink"
          :href="event.htmlLink"
          target="_blank"
          rel="noopener"
          class="text-sm font-medium leading-snug hover:text-accent transition line-clamp-2"
        >{{ event.title }}</a>
        <span v-else class="text-sm font-medium leading-snug line-clamp-2">{{ event.title }}</span>
        <span class="tag shrink-0" :class="relativeClass">
          {{ relative }}
        </span>
      </div>
      <div v-if="event.location" class="text-xs text-mute mt-1 truncate">
        {{ event.location }}
      </div>
      <button
        class="mt-2 text-xs transition-opacity"
        :class="ignored ? 'text-warn opacity-100' : 'text-mute hover:text-warn opacity-0 group-hover:opacity-100'"
        :title="ignored ? 'Resume alarms' : 'Silence alarms'"
        @click="emit('toggleIgnore', event.id)"
      >
        {{ ignored ? 'Ignored' : 'Ignore' }}
      </button>
    </div>
  </li>
</template>
