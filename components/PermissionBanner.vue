<script setup lang="ts">
import { computed } from 'vue'
import type { PermissionState } from '~/composables/useAlarms'

const props = defineProps<{
  permission: PermissionState
  soundUnlocked: boolean
}>()

const emit = defineEmits<{
  (e: 'request-permission'): void
  (e: 'unlock-sound'): void
}>()

const visible = computed(() => props.permission !== 'granted' || !props.soundUnlocked)

const message = computed(() => {
  if (props.permission === 'unsupported') return 'This browser doesn\'t support desktop notifications.'
  if (props.permission === 'denied') return 'Notifications are blocked. Sound will still play when enabled.'
  if (props.permission !== 'granted') return 'Enable notifications so alarms can reach you.'
  if (!props.soundUnlocked) return 'Enable sound to hear the alarm chime.'
  return ''
})
</script>

<template>
  <div
    v-if="visible"
    class="mt-5 rounded-xl bg-accent-soft border border-accent/15 px-4 py-3 flex flex-wrap items-center justify-between gap-3"
  >
    <div class="text-sm text-ink-soft flex items-center gap-2">
      <span class="dot text-accent" />
      <span>{{ message }}</span>
    </div>
    <div class="flex gap-2">
      <button
        v-if="permission === 'default'"
        class="btn btn-accent text-xs"
        @click="emit('request-permission')"
      >
        Enable notifications
      </button>
      <button
        v-if="!soundUnlocked"
        class="btn btn-ghost text-xs"
        @click="emit('unlock-sound')"
      >
        Enable sound
      </button>
    </div>
  </div>
</template>
