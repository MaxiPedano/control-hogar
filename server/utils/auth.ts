import type { H3Event } from 'h3'
import type { User } from '@supabase/supabase-js'

export interface HouseholdContext {
  user: User
  householdId: string
  memberId: string
}

export async function requireUser(event: H3Event): Promise<User> {
  const authorization = getHeader(event, 'authorization')
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]

  if (!token) {
    throw createError({ statusCode: 401, statusMessage: 'Autenticación requerida' })
  }

  const { data, error } = await useSupabaseAdmin().auth.getUser(token)
  if (error || !data.user) {
    throw createError({ statusCode: 401, statusMessage: 'Sesión inválida o vencida' })
  }

  return data.user
}

export async function requireHouseholdMember(
  event: H3Event,
  householdId: string,
): Promise<HouseholdContext> {
  if (!/^[0-9a-f-]{36}$/i.test(householdId)) {
    throw createError({ statusCode: 400, statusMessage: 'Hogar inválido' })
  }

  const user = await requireUser(event)
  const { data, error } = await useSupabaseAdmin()
    .from('household_members')
    .select('id, household_id')
    .eq('household_id', householdId)
    .eq('user_id', user.id)
    .eq('active', true)
    .maybeSingle()

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })
  if (!data) throw createError({ statusCode: 403, statusMessage: 'Sin acceso a este hogar' })

  return { user, householdId: data.household_id as string, memberId: data.id as string }
}
