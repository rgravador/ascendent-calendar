import { listTodos } from '~/server/repositories/todos'

export default defineEventHandler(async (event) => {
  const userId = event.context.userId as string
  return { todos: await listTodos(userId) }
})
