<script setup lang="ts">
import { computed, ref } from 'vue'

const { todos, loading, add, update, remove } = useTodos()

const showDone = ref(false)

const active = computed(() => todos.value.filter((t) => !t.done))
const done = computed(() => todos.value.filter((t) => t.done))
const highCount = computed(() => active.value.filter((t) => t.priority === 'high').length)

async function onAdd(input: { text: string; priority: 'high' | 'med' | 'low'; dueDate?: string }) {
  try { await add(input) } catch { /* noop */ }
}
async function onToggle(id: string, isDone: boolean) {
  try { await update(id, { done: isDone }) } catch { /* rolled back */ }
}
async function onRemove(id: string) {
  try { await remove(id) } catch { /* rolled back */ }
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-4">
      <h2 class="font-display text-base text-ink">Todos</h2>
      <div class="flex gap-1.5">
        <span v-if="highCount > 0" class="tag tag-bear">{{ highCount }} urgent</span>
        <span class="tag">{{ active.length }}</span>
      </div>
    </div>

    <TodoAddForm @add="onAdd" />

    <div v-if="loading" class="text-mute text-sm py-4">Loading...</div>

    <div v-else-if="active.length === 0 && done.length === 0" class="rounded-xl bg-surface-soft border border-rule p-6 text-center">
      <p class="text-sm text-ink">Nothing to do</p>
      <p class="text-xs text-mute mt-1">Your list is empty.</p>
    </div>

    <ul v-else class="divide-y divide-rule mt-3">
      <TodoItem
        v-for="t in active"
        :key="t._id"
        :todo="t"
        @toggle="onToggle"
        @remove="onRemove"
      />
    </ul>

    <div v-if="done.length > 0" class="mt-5 pt-3 border-t border-rule">
      <button
        class="section-label hover:text-ink transition flex items-center gap-1.5"
        @click="showDone = !showDone"
      >
        <span>{{ showDone ? '▾' : '▸' }}</span>
        <span>Completed ({{ done.length }})</span>
      </button>
      <ul v-if="showDone" class="mt-2 divide-y divide-rule">
        <TodoItem
          v-for="t in done"
          :key="t._id"
          :todo="t"
          @toggle="onToggle"
          @remove="onRemove"
        />
      </ul>
    </div>
  </div>
</template>
