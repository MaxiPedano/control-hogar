export default defineEventHandler(async (event) => {
  const sb = useSupabaseAdmin()
  if (event.method !== 'DELETE') {
    throw createError({ statusCode: 405, statusMessage: 'Método no permitido' })
  }

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Falta el id' })

  const { error } = await sb.from('budgets').delete().eq('id', id)
  if (error) throw createError({ statusCode: 500, statusMessage: error.message })
  return { ok: true }
})
