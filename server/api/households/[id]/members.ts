import { requireHouseholdMember } from '../../../utils/auth'

export default defineEventHandler(async (event) => {
  const householdId = getRouterParam(event, 'id') ?? ''
  await requireHouseholdMember(event, householdId)
  const sb = useSupabaseAdmin()

  if (event.method === 'GET') {
    const { data, error } = await sb
      .from('household_members')
      .select('id, household_id, name, active, created_at')
      .eq('household_id', householdId)
      .order('created_at', { ascending: true })

    if (error) throw createError({ statusCode: 500, statusMessage: error.message })
    return data ?? []
  }

  if (event.method === 'POST') {
    const body = await readBody<Record<string, unknown>>(event)
    const name = String(body.name ?? '').trim()
    const userId = String(body.userId ?? '').trim()

    if (!name || !userId) {
      throw createError({ statusCode: 400, statusMessage: 'Nombre y userId son obligatorios' })
    }
    if (!/^[0-9a-f-]{36}$/i.test(userId)) {
      throw createError({ statusCode: 400, statusMessage: 'userId inválido' })
    }

    const { data, error } = await sb
      .from('household_members')
      .upsert(
        { household_id: householdId, user_id: userId, name, active: true },
        { onConflict: 'household_id,user_id' },
      )
      .select('id, household_id, name, active, created_at')
      .single()

    if (error) throw createError({ statusCode: 500, statusMessage: error.message })
    setResponseStatus(event, 201)
    return data
  }

  throw createError({ statusCode: 405, statusMessage: 'Método no permitido' })
})
