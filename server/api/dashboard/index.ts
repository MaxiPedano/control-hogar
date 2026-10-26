import type { CategoryTotal, DashboardBudget } from '#shared/types'
import { monthRange, num, parsePeriod } from '../../utils/supabase'

export default defineEventHandler(async (event) => {
  const sb = useSupabaseAdmin()
  const query = getQuery(event)
  const { year, month } = parsePeriod(query)
  const { start, end } = monthRange(year, month)

  const [txnsRes, entriesRes, budgetsRes] = await Promise.all([
    sb
      .from('transactions')
      .select('type, amount, category_id, category:categories(name, color)')
      .gte('date', start)
      .lt('date', end),
    sb.from('work_entries').select('hours, hourly_rate').gte('entry_date', start).lt('entry_date', end),
    sb
      .from('budgets')
      .select('amount, category_id, category:categories(id, name, color)')
      .eq('year', year)
      .eq('month', month),
  ])

  for (const r of [txnsRes, entriesRes, budgetsRes]) {
    if (r.error) throw createError({ statusCode: 500, statusMessage: r.error.message })
  }

  let income = 0
  let expense = 0
  const spentByCat = new Map<string, number>()
  const catMeta = new Map<string, { name: string; color: string }>()

  for (const t of txnsRes.data ?? []) {
    const amount = num(t.amount)
    if (t.type === 'INCOME') income += amount
    else expense += amount

    if (t.type === 'EXPENSE') {
      const cid = t.category_id as string | null
      const meta = t.category as unknown as { name?: string; color?: string } | null
      if (cid) {
        spentByCat.set(cid, (spentByCat.get(cid) ?? 0) + amount)
        if (meta?.name) catMeta.set(cid, { name: meta.name, color: meta.color ?? '#64748b' })
      }
    }
  }

  let hours = 0
  let earnings = 0
  for (const e of entriesRes.data ?? []) {
    const h = num(e.hours)
    hours += h
    earnings += h * num(e.hourly_rate)
  }

  const budgets: DashboardBudget[] = []
  for (const b of budgetsRes.data ?? []) {
    const cid = b.category_id as string
    const meta = b.category as unknown as { name?: string; color?: string } | null
    const budget = num(b.amount)
    const spent = round2(spentByCat.get(cid) ?? 0)
    if (!meta?.name && !catMeta.has(cid)) continue // categoría borrada
    const info = meta?.name ? { name: meta.name, color: meta.color ?? '#64748b' } : catMeta.get(cid)!
    budgets.push({
      categoryId: cid,
      name: info.name,
      color: info.color,
      budget,
      spent,
      pct: budget > 0 ? Math.round((spent / budget) * 100) : 0,
    })
  }
  budgets.sort((a, b) => b.pct - a.pct)

  const expensesByCategory: CategoryTotal[] = [...spentByCat.entries()]
    .map(([cid, total]) => ({
      name: catMeta.get(cid)?.name ?? 'Sin nombre',
      color: catMeta.get(cid)?.color ?? '#64748b',
      total: round2(total),
    }))
    .sort((a, b) => b.total - a.total)

  return {
    income: round2(income),
    expense: round2(expense),
    balance: round2(income - expense),
    hours: round2(hours),
    earnings: round2(earnings),
    budgets,
    expensesByCategory,
  }
})

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
