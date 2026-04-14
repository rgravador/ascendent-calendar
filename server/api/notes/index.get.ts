import { listNotes } from '~/server/repositories/notes'

export default defineEventHandler(async (event) => {
  const userId = event.context.userId as string
  return { notes: await listNotes(userId) }
})
