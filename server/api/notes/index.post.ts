import { readBody, createError } from 'h3'
import { createNote } from '~/server/repositories/notes'

export default defineEventHandler(async (event) => {
  const userId = event.context.userId as string
  const body = await readBody<{ title?: string; body?: string }>(event).catch(() => ({}))
  if (typeof body.body !== 'string' || !body.body.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'body is required' })
  }
  try {
    const note = await createNote(userId, {
      ...(body.title ? { title: body.title } : {}),
      body: body.body,
    })
    return { note }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Invalid note'
    throw createError({ statusCode: 400, statusMessage: msg })
  }
})
