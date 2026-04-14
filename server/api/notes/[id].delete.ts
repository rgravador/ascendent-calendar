import { getRouterParam, createError } from 'h3'
import { deleteNote } from '~/server/repositories/notes'

export default defineEventHandler(async (event) => {
  const userId = event.context.userId as string
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id is required' })
  const ok = await deleteNote(userId, id)
  if (!ok) throw createError({ statusCode: 404, statusMessage: 'Not found' })
  return { ok: true }
})
