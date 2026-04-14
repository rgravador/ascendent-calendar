<script setup lang="ts">
import { ref, watch } from 'vue'
import { ALARM_SOUNDS, type AlarmSound } from '~/server/types/models'

const SOUND_LABELS: Record<AlarmSound, string> = {
  bells: 'Bells',
  birds: 'Birds',
  childhood: 'Childhood',
  classic: 'Classic',
  cuckoo: 'Cuckoo',
  flute: 'Flute',
  glow: 'Glow',
  guitar: 'Guitar',
  happy: 'Happy',
  harp: 'Harp',
  musicBox: 'Music Box',
  paradiseIsland: 'Paradise Island',
  piano: 'Piano',
  pipe: 'Pipe',
  pizzicato: 'Pizzicato',
  rooster: 'Rooster',
  savannah: 'Savannah',
  school: 'School',
  twinkle: 'Twinkle',
  windChimes: 'Wind Chimes',
  xylophone: 'Xylophone',
}

const props = defineProps<{
  offsetMinutes: number
  alarmSound: AlarmSound
  alarmVolume: number
  alarmRingDuration: number
}>()

const emit = defineEmits<{
  (e: 'update:offset', minutes: number): void
  (e: 'update:sound', sound: AlarmSound): void
  (e: 'update:volume', volume: number): void
  (e: 'update:ringDuration', minutes: number): void
  (e: 'preview', sound: AlarmSound): void
}>()

const open = ref(false)
const draftOffset = ref<number>(props.offsetMinutes)
const draftSound = ref<AlarmSound>(props.alarmSound)
const draftVolume = ref<number>(props.alarmVolume)
const draftRingDuration = ref<number>(props.alarmRingDuration)
const saving = ref(false)

watch(() => props.offsetMinutes, (v) => { draftOffset.value = v })
watch(() => props.alarmSound, (v) => { draftSound.value = v })
watch(() => props.alarmVolume, (v) => { draftVolume.value = v })
watch(() => props.alarmRingDuration, (v) => { draftRingDuration.value = v })

function selectSound(sound: AlarmSound) {
  draftSound.value = sound
  emit('preview', sound)
}

async function save() {
  saving.value = true
  try {
    const offset = Math.max(0, Math.min(120, Math.floor(Number(draftOffset.value) || 0)))
    const volume = Math.max(0, Math.min(100, Math.round(Number(draftVolume.value) || 0)))
    const ringDuration = Math.max(1, Math.min(10, Math.round(Number(draftRingDuration.value) || 2)))
    emit('update:offset', offset)
    emit('update:sound', draftSound.value)
    emit('update:volume', volume)
    emit('update:ringDuration', ringDuration)
  } finally {
    saving.value = false
    open.value = false
  }
}

const PRESETS = [0, 5, 10, 15, 30]
const DURATION_PRESETS = [1, 2, 3, 5, 10]
</script>

<template>
  <div class="relative inline-block">
    <button
      class="btn btn-ghost text-xs"
      @click="open = !open"
    >
      <span class="dot text-accent" />
      <span>Alarm · {{ offsetMinutes }}m before</span>
    </button>

    <div
      v-if="open"
      class="absolute right-0 mt-2 w-72 card p-4 z-20"
    >
      <div class="kicker">Alarm lead time</div>
      <p class="text-xs text-mute mt-1">How long before each event to alert you.</p>

      <div class="flex gap-1.5 flex-wrap mt-3">
        <button
          v-for="p in PRESETS"
          :key="p"
          type="button"
          class="tag hover:bg-accent-soft hover:text-accent transition cursor-pointer"
          :class="draftOffset === p ? 'tag-accent' : ''"
          @click="draftOffset = p"
        >
          {{ p }}m
        </button>
      </div>

      <label class="block mt-4">
        <span class="text-xs text-mute">Custom</span>
        <input
          v-model.number="draftOffset"
          type="number"
          min="0"
          max="120"
          class="field text-sm mt-1 tabular-nums"
        >
      </label>

      <!-- Alarm sound -->
      <div class="mt-5">
        <div class="kicker">Alarm sound</div>
        <p class="text-xs text-mute mt-1">Tap to preview, then save.</p>

        <div class="flex gap-1.5 flex-wrap mt-3">
          <button
            v-for="s in ALARM_SOUNDS"
            :key="s"
            type="button"
            class="tag hover:bg-accent-soft hover:text-accent transition cursor-pointer"
            :class="draftSound === s ? 'tag-accent' : ''"
            @click="selectSound(s)"
          >
            {{ SOUND_LABELS[s] }}
          </button>
        </div>
      </div>

      <!-- Volume -->
      <div class="mt-5">
        <div class="flex items-center justify-between">
          <div class="kicker">Volume</div>
          <span class="num text-xs tabular-nums text-mute">{{ draftVolume }}%</span>
        </div>
        <input
          v-model.number="draftVolume"
          type="range"
          min="0"
          max="100"
          step="5"
          class="w-full mt-2 accent-[var(--accent)]"
        >
      </div>

      <!-- Ring duration -->
      <div class="mt-5">
        <div class="kicker">Ring duration</div>
        <p class="text-xs text-mute mt-1">How long the alarm rings before auto-stopping.</p>

        <div class="flex gap-1.5 flex-wrap mt-3">
          <button
            v-for="d in DURATION_PRESETS"
            :key="d"
            type="button"
            class="tag hover:bg-accent-soft hover:text-accent transition cursor-pointer"
            :class="draftRingDuration === d ? 'tag-accent' : ''"
            @click="draftRingDuration = d"
          >
            {{ d }}m
          </button>
        </div>
      </div>

      <div class="flex justify-end gap-2 mt-4">
        <button class="btn btn-ghost text-xs" @click="open = false">Cancel</button>
        <button
          class="btn btn-accent text-xs"
          :disabled="saving"
          @click="save"
        >
          {{ saving ? 'Saving…' : 'Save' }}
        </button>
      </div>
    </div>
  </div>
</template>
