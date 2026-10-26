import type { Transaction } from '#shared/types'
import { monthRange, num, parsePeriod } from '../../utils/supabase'
import { strOrNull, validateTransaction } from '../../utils/validation'

const SELECT = 'id, type, amount, description, date, category_id, category:categories(id, name, color)'

export default defineEventHandler(async (event) => {
  const sb = useSupabaseAdmin()
  const method = event.method

  if (method === 'GET') {
    const query = getQuery(event)
    let q = sb
      .from('transactions')
      .select(SELECT)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })

    if (query.year || query.month) {
      const { year, month } = parsePeriod(query)
      const { start, end } = monthRange(year, month)
      q = q.gte('date', start).lt('date', end)
    }
    if (query.type === 'INCOME' || query.type === 'EXPENSE') q = q.eq('type', query.type)
    if (typeof query.categoryId === 'string' && query.categoryId) {
      q = q.eq('category_id', query.categoryId)
    }

    const { data, error } = await q
    if (error) throw createError({ statusCode: 500, statusMessage: error.message })

    return ((data ?? []).map((t) => ({ ...t, amount: num(t.amount) }))) as unknown as Transaction[]
  }

  if (method === 'POST') {
    const body = await readBody<Record<string, unknown>>(event)

    if (!body.type || !body.amount || !body.date) {
      throw createError({ statusCode: 400, statusMessage: 'Tipo, monto y fecha son obligatorios' })
    }
    await validateTransaction(sb, body)

    const { data, error } = await sb
      .from('transactions')
      .insert({
        type: String(body.type),
        amount: Number(body.amount),
        description: strOrNull(body.description),
        date: String(body.date),
        category_id: strOrNull(body.categoryId),
      })
      .select(SELECT)
      .single()

    if (error) throw createError({ statusCode: 500, statusMessage: error.message })
    setResponseStatus(event, 201)
    return { ...data, amount: num(data.amount) } as unknown as Transaction
  }

  throw createError({ statusCode: 405, statusMessage: 'Método no permitido' })
})
