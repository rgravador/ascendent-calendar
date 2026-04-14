import { readBody, createError } from 'h3'
import { createTodo } from '~/server/repositories/todos'
import type { Priority } from '~/server/types/models'

export default defineEventHandler(async (event) => {
  const userId = event.context.userId as string
  const body = await readBody<{ text?: string; priority?: Priority; dueDate?: string }>(event).catch(() => ({}))
  if (typeof body.text !== 'string' || !body.text.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'text is required' })
  }
  if (!body.priority) {
    throw createError({ statusCode: 400, statusMessage: 'priority is required' })
  }
  try {
    const todo = await createTodo(userId, {
      text: body.text,
      priority: body.priority,
      ...(body.dueDate ? { dueDate: body.dueDate } : {}),
    })
    return { todo }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Invalid todo'
    throw createError({ statusCode: 400, statusMessage: msg })
  }
})
