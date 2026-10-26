import { requireUser } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const sb = useSupabaseAdmin()

  if (event.method === 'GET') {
    const { data, error } = await sb
      .from('household_members')
      .select('id, household_id, name, active, created_at, household:households(id, name, created_at)')
      .eq('user_id', user.id)
      .eq('active', true)
      .order('created_at', { ascending: true })

    if (error) throw createError({ statusCode: 500, statusMessage: error.message })
    return data ?? []
  }

  if (event.method === 'POST') {
    const body = await readBody<Record<string, unknown>>(event)
    const name = String(body.name ?? '').trim()
    const memberName = String(body.memberName ?? user.user_metadata?.name ?? '').trim()

    if (!name) throw createError({ statusCode: 400, statusMessage: 'El nombre del hogar es obligatorio' })
    if (!memberName) throw createError({ statusCode: 400, statusMessage: 'El nombre del integrante es obligatorio' })

    const { data: household, error: householdError } = await sb
      .from('households')
      .insert({ name })
      .select('id, name, created_at')
      .single()

    if (householdError) throw createError({ statusCode: 500, statusMessage: householdError.message })

    const { data: member, error: memberError } = await sb
      .from('household_members')
      .insert({ household_id: household.id, user_id: user.id, name: memberName })
      .select('id, household_id, name, active, created_at')
      .single()

    if (memberError) {
      await sb.from('households').delete().eq('id', household.id)
      throw createError({ statusCode: 500, statusMessage: memberError.message })
    }

    setResponseStatus(event, 201)
    return { household, member }
  }

  throw createError({ statusCode: 405, statusMessage: 'Método no permitido' })
})
