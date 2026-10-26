import { requireHouseholdMember } from '../../../../utils/auth'
import { strOrNull } from '../../../../utils/validation'
import type { Currency } from '#shared/types'
import type { AccountType } from '#shared/types/household'

const ACCOUNT_TYPES: AccountType[] = ['CASH', 'BANK', 'WALLET', 'CREDIT_CARD', 'OTHER']
const CURRENCIES: Currency[] = ['ARS', 'USD']

export default defineEventHandler(async (event) => {
  const householdId = getRouterParam(event, 'id') ?? ''
  const accountId = getRouterParam(event, 'accountId') ?? ''
  await requireHouseholdMember(event, householdId)
  const sb = useSupabaseAdmin()

  if (event.method !== 'PATCH') {
    throw createError({ statusCode: 405, statusMessage: 'Método no permitido' })
  }

  const body = await readBody<Record<string, unknown>>(event)
  const patch: Record<string, unknown> = {}

  if (body.name !== undefined) {
    const name = String(body.name).trim()
    if (!name) throw createError({ statusCode: 400, statusMessage: 'El nombre no puede estar vacío' })
    patch.name = name
  }
  if (body.type !== undefined) {
    if (!ACCOUNT_TYPES.includes(String(body.type) as AccountType)) {
      throw createError({ statusCode: 400, statusMessage: 'Tipo de cuenta inválido' })
    }
    patch.type = body.type
  }
  if (body.currency !== undefined) {
    if (!CURRENCIES.includes(String(body.currency) as Currency)) {
      throw createError({ statusCode: 400, statusMessage: 'Moneda inválida' })
    }
    patch.currency = body.currency
  }
  if (body.openingBalance !== undefined) {
    const value = Number(body.openingBalance)
    if (!Number.isFinite(value)) throw createError({ statusCode: 400, statusMessage: 'Saldo inicial inválido' })
    patch.opening_balance = value
  }
  if (body.ownerId !== undefined) {
    const ownerId = strOrNull(body.ownerId)
    if (ownerId) await assertMember(sb, householdId, ownerId)
    patch.owner_id = ownerId
  }
  if (body.active !== undefined) patch.active = Boolean(body.active)

  if (Object.keys(patch).length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'No hay cambios para aplicar' })
  }

  const { data, error } = await sb
    .from('accounts')
    .update(patch)
    .eq('id', accountId)
    .eq('household_id', householdId)
    .select('id, household_id, name, type, currency, owner_id, opening_balance, active, created_at')
    .maybeSingle()

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })
  if (!data) throw createError({ statusCode: 404, statusMessage: 'Cuenta no encontrada' })
  return { ...data, opening_balance: Number(data.opening_balance) || 0 }
})

async function assertMember(sb: ReturnType<typeof useSupabaseAdmin>, householdId: string, memberId: string) {
  const { data, error } = await sb
    .from('household_members')
    .select('id')
    .eq('id', memberId)
    .eq('household_id', householdId)
    .eq('active', true)
    .maybeSingle()

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })
  if (!data) throw createError({ statusCode: 400, statusMessage: 'El integrante no pertenece al hogar' })
}
