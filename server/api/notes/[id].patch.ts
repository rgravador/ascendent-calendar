import { readBody, getRouterParam, createError } from 'h3'
import { updateNote } from '~/server/repositories/notes'

export default defineEventHandler(async (event) => {
  const userId = event.context.userId as string
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id is required' })
  const body = await readBody<{ title?: string | null; body?: string }>(event).catch(() => ({}))
  try {
    const note = await updateNote(userId, id, body)
    if (!note) throw createError({ statusCode: 404, statusMessage: 'Not found' })
    return { note }
  } catch (e: unknown) {
    if ((e as { statusCode?: number }).statusCode) throw e
    const msg = e instanceof Error ? e.message : 'Invalid note'
    throw createError({ statusCode: 400, statusMessage: msg })
  }
})
