import type { Transaction } from '#shared/types'
import { num } from '../../utils/supabase'
import { strOrNull, validateTransaction } from '../../utils/validation'

const SELECT = 'id, type, amount, description, date, category_id, category:categories(id, name, color)'

export default defineEventHandler(async (event) => {
  const sb = useSupabaseAdmin()
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Falta el id' })

  if (event.method !== 'PUT' && event.method !== 'DELETE') {
    throw createError({ statusCode: 405, statusMessage: 'Método no permitido' })
  }

  if (event.method === 'DELETE') {
    const { error } = await sb.from('transactions').delete().eq('id', id)
    if (error) throw createError({ statusCode: 500, statusMessage: error.message })
    return { ok: true }
  }

  const body = await readBody<Record<string, unknown>>(event)
  await validateTransaction(sb, body)

  const update: Record<string, unknown> = {}
  if (body.type !== undefined) update.type = String(body.type)
  if (body.amount !== undefined) update.amount = Number(body.amount)
  if (body.date !== undefined) update.date = String(body.date)
  if (body.description !== undefined) update.description = strOrNull(body.description)
  if (body.categoryId !== undefined) update.category_id = strOrNull(body.categoryId)

  const { data, error } = await sb
    .from('transactions')
    .update(update)
    .eq('id', id)
    .select(SELECT)
    .single()

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })
  return { ...data, amount: num(data.amount) } as unknown as Transaction
})
