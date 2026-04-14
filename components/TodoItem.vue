<script setup lang="ts">
import { computed } from 'vue'
import type { Todo } from '~/server/types/models'

const props = defineProps<{
  todo: Todo
}>()

const emit = defineEmits<{
  (e: 'toggle', id: string, done: boolean): void
  (e: 'remove', id: string): void
}>()

const priorityLabel = computed(() => ({ high: 'Urgent', med: 'Medium', low: 'Low' }[props.todo.priority]))
const priorityTag = computed(() => ({
  high: 'tag-bear',
  med: 'tag-warn',
  low: 'tag-info',
}[props.todo.priority]))

const isOverdue = computed(() => {
  if (props.todo.done || !props.todo.dueDate) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return new Date(props.todo.dueDate).getTime() < today.getTime()
})

const dueLabel = computed(() => {
  if (!props.todo.dueDate) return null
  const d = new Date(props.todo.dueDate)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
})
</script>

<template>
  <li class="group flex items-start gap-3 py-2.5">
    <button
      class="shrink-0 mt-0.5 w-[18px] h-[18px] rounded-md border flex items-center justify-center transition"
      :class="todo.done
        ? 'bg-accent border-accent text-white'
        : 'border-rule-strong hover:border-accent hover:bg-accent-soft'"
      :aria-label="todo.done ? 'Mark incomplete' : 'Mark complete'"
      @click="emit('toggle', todo._id, !todo.done)"
    >
      <svg v-if="todo.done" class="w-2.5 h-2.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="3">
        <path d="M3 8.5 L7 12 L13 4" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>

    <div class="flex-1 min-w-0">
      <div
        class="text-sm leading-snug"
        :class="{ 'line-through text-mute': todo.done }"
      >
        {{ todo.text }}
      </div>
      <div class="flex items-center gap-1.5 mt-1.5 flex-wrap">
        <span v-if="!todo.done" class="tag" :class="priorityTag">{{ priorityLabel }}</span>
        <span v-if="dueLabel" class="tag" :class="isOverdue ? 'tag-bear' : ''">
          {{ isOverdue ? 'Overdue · ' : '' }}{{ dueLabel }}
        </span>
      </div>
    </div>

    <button
      class="shrink-0 opacity-0 group-hover:opacity-100 text-mute hover:text-danger transition text-xs px-1.5"
      :aria-label="`Delete ${todo.text}`"
      @click="emit('remove', todo._id)"
    >
      <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    </button>
  </li>
</template>
