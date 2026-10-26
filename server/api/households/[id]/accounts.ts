import { requireHouseholdMember } from '../../../utils/auth'
import { strOrNull } from '../../../utils/validation'
import type { Currency } from '#shared/types'
import type { AccountType } from '#shared/types/household'

const ACCOUNT_TYPES: AccountType[] = ['CASH', 'BANK', 'WALLET', 'CREDIT_CARD', 'OTHER']
const CURRENCIES: Currency[] = ['ARS', 'USD']
const SELECT = 'id, household_id, name, type, currency, owner_id, opening_balance, active, created_at'

export default defineEventHandler(async (event) => {
  const householdId = getRouterParam(event, 'id') ?? ''
  await requireHouseholdMember(event, householdId)
  const sb = useSupabaseAdmin()

  if (event.method === 'GET') {
    const { data, error } = await sb
      .from('accounts')
      .select(SELECT)
      .eq('household_id', householdId)
      .order('active', { ascending: false })
      .order('name')

    if (error) throw createError({ statusCode: 500, statusMessage: error.message })
    return (data ?? []).map((account) => ({ ...account, opening_balance: Number(account.opening_balance) || 0 }))
  }

  if (event.method === 'POST') {
    const body = await readBody<Record<string, unknown>>(event)
    const name = String(body.name ?? '').trim()
    const type = String(body.type ?? '') as AccountType
    const currency = String(body.currency ?? '') as Currency
    const openingBalance = Number(body.openingBalance ?? 0)
    const ownerId = strOrNull(body.ownerId)

    if (!name) throw createError({ statusCode: 400, statusMessage: 'El nombre es obligatorio' })
    if (!ACCOUNT_TYPES.includes(type)) throw createError({ statusCode: 400, statusMessage: 'Tipo de cuenta inválido' })
    if (!CURRENCIES.includes(currency)) throw createError({ statusCode: 400, statusMessage: 'Moneda inválida' })
    if (!Number.isFinite(openingBalance)) throw createError({ statusCode: 400, statusMessage: 'Saldo inicial inválido' })

    if (ownerId) await assertMember(sb, householdId, ownerId)

    const { data, error } = await sb
      .from('accounts')
      .insert({
        household_id: householdId,
        name,
        type,
        currency,
        owner_id: ownerId,
        opening_balance: openingBalance,
      })
      .select(SELECT)
      .single()

    if (error) throw createError({ statusCode: 500, statusMessage: error.message })
    setResponseStatus(event, 201)
    return { ...data, opening_balance: Number(data.opening_balance) || 0 }
  }

  throw createError({ statusCode: 405, statusMessage: 'Método no permitido' })
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
