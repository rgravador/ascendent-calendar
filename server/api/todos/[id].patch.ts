import { readBody, getRouterParam, createError } from 'h3'
import { updateTodo } from '~/server/repositories/todos'
import type { Priority } from '~/server/types/models'

export default defineEventHandler(async (event) => {
  const userId = event.context.userId as string
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id is required' })
  const body = await readBody<{
    text?: string
    priority?: Priority
    dueDate?: string | null
    done?: boolean
  }>(event).catch(() => ({}))
  try {
    const todo = await updateTodo(userId, id, body)
    if (!todo) throw createError({ statusCode: 404, statusMessage: 'Not found' })
    return { todo }
  } catch (e: unknown) {
    if ((e as { statusCode?: number }).statusCode) throw e
    const msg = e instanceof Error ? e.message : 'Invalid todo'
    throw createError({ statusCode: 400, statusMessage: msg })
  }
})
