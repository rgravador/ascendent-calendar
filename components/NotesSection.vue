<script setup lang="ts">
import { ref } from 'vue'

const { notes, loading, add, update, remove } = useNotes()

const newBody = ref('')
const newTitle = ref('')
const expanded = ref(false)
const adding = ref(false)

async function onCreate() {
  const body = newBody.value.trim()
  if (!body) return
  adding.value = true
  try {
    await add({ body, ...(newTitle.value.trim() ? { title: newTitle.value.trim() } : {}) })
    newTitle.value = ''
    newBody.value = ''
    expanded.value = false
  } finally {
    adding.value = false
  }
}

async function onSave(id: string, patch: { title?: string | null; body?: string }) {
  try { await update(id, patch) } catch { /* noop */ }
}
async function onRemove(id: string) {
  try { await remove(id) } catch { /* rolled back */ }
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-4">
      <h2 class="font-display text-base text-ink">Notes</h2>
      <span v-if="notes.length > 0" class="tag">
        {{ notes.length }}
      </span>
    </div>

    <form class="rounded-xl bg-surface-soft p-3 mb-4 border border-rule" @submit.prevent="onCreate">
      <input
        v-if="expanded"
        v-model="newTitle"
        placeholder="Title (optional)"
        maxlength="120"
        class="field mb-2 text-sm"
      >
      <textarea
        v-model="newBody"
        :rows="expanded ? 3 : 2"
        maxlength="2000"
        placeholder="Write a note..."
        class="field resize-none text-sm"
        @focus="expanded = true"
      />
      <div v-if="expanded" class="flex items-center justify-between mt-2">
        <span class="text-xs text-mute tabular-nums">{{ newBody.length }}/2000</span>
        <div class="flex gap-2">
          <button
            type="button"
            class="btn btn-ghost text-xs"
            @click="expanded = false; newTitle = ''; newBody = ''"
          >
            Cancel
          </button>
          <button
            type="submit"
            :disabled="adding || !newBody.trim()"
            class="btn btn-accent text-xs"
          >
            Save
          </button>
        </div>
      </div>
    </form>

    <div v-if="loading" class="text-mute text-sm py-4">Loading...</div>

    <div v-else-if="notes.length === 0" class="rounded-xl bg-surface-soft border border-rule p-6 text-center">
      <p class="text-sm text-ink">No notes yet</p>
      <p class="text-xs text-mute mt-1">Start typing above.</p>
    </div>

    <div v-else class="space-y-2.5">
      <NoteCard
        v-for="n in notes"
        :key="n._id"
        :note="n"
        @save="onSave"
        @remove="onRemove"
      />
    </div>
  </div>
</template>
