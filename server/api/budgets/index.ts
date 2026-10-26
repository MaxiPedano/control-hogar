import type { BudgetItem } from '#shared/types'
import { monthRange, num, parsePeriod } from '../../utils/supabase'

export default defineEventHandler(async (event) => {
  const sb = useSupabaseAdmin()
  const method = event.method
  const query = getQuery(event)
  const { year, month } = parsePeriod(query)
  const { start, end } = monthRange(year, month)

  if (method === 'GET') {
    const [catsRes, budgetsRes, txnsRes] = await Promise.all([
      sb.from('categories').select('id, name, color').eq('type', 'EXPENSE').order('name'),
      sb.from('budgets').select('id, category_id, amount').eq('year', year).eq('month', month),
      sb
        .from('transactions')
        .select('category_id, amount')
        .eq('type', 'EXPENSE')
        .gte('date', start)
        .lt('date', end),
    ])

    for (const r of [catsRes, budgetsRes, txnsRes]) {
      if (r.error) throw createError({ statusCode: 500, statusMessage: r.error.message })
    }

    const budgetByCat = new Map<string, { id: string; amount: number }>()
    for (const b of budgetsRes.data ?? []) {
      budgetByCat.set(b.category_id as string, { id: b.id as string, amount: num(b.amount) })
    }

    const spentByCat = new Map<string, number>()
    for (const t of txnsRes.data ?? []) {
      const cid = t.category_id as string | null
      if (!cid) continue
      spentByCat.set(cid, (spentByCat.get(cid) ?? 0) + num(t.amount))
    }

    const items: BudgetItem[] = (catsRes.data ?? []).map((c) => {
      const b = budgetByCat.get(c.id)
      return {
        categoryId: c.id,
        name: c.name,
        color: c.color,
        budgetId: b?.id ?? null,
        budget: b?.amount ?? null,
        spent: round2(spentByCat.get(c.id) ?? 0),
      }
    })

    return { year, month, items }
  }

  if (method === 'PUT') {
    const body = await readBody<Record<string, unknown>>(event)
    const categoryId = String(body.categoryId ?? '')
    const amount = Number(body.amount ?? 0)
    let bYear = Number.parseInt(String(body.year ?? ''), 10)
    let bMonth = Number.parseInt(String(body.month ?? ''), 10)

    if (!categoryId) throw createError({ statusCode: 400, statusMessage: 'Falta la categoría' })
    if (!Number.isFinite(bYear) || bYear < 2000 || bYear > 2200) {
      throw createError({ statusCode: 400, statusMessage: 'Año inválido' })
    }
    if (!Number.isFinite(bMonth) || bMonth < 1 || bMonth > 12) {
      throw createError({ statusCode: 400, statusMessage: 'Mes inválido' })
    }

    // Monto vacío o <= 0 => quitar el presupuesto de esa categoría/mes
    if (!Number.isFinite(amount) || amount <= 0) {
      const { error } = await sb
        .from('budgets')
        .delete()
        .eq('category_id', categoryId)
        .eq('year', bYear)
        .eq('month', bMonth)
      if (error) throw createError({ statusCode: 500, statusMessage: error.message })
      return { deleted: true }
    }

    const { data, error } = await sb
      .from('budgets')
      .upsert(
        { category_id: categoryId, year: bYear, month: bMonth, amount },
        { onConflict: 'category_id,year,month' },
      )
      .select('id')
      .single()

    if (error) throw createError({ statusCode: 500, statusMessage: error.message })
    return { id: data?.id, amount }
  }

  throw createError({ statusCode: 405, statusMessage: 'Método no permitido' })
})

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
