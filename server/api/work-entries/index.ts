import type { WorkEntry } from '#shared/types'
import { monthRange, num, parsePeriod } from '../../utils/supabase'
import { strOrNull, validateWorkEntry } from '../../utils/validation'

const SELECT = 'id, entry_date, hours, hourly_rate, description'

export default defineEventHandler(async (event) => {
  const sb = useSupabaseAdmin()
  const method = event.method

  if (method === 'GET') {
    const query = getQuery(event)
    const { year, month } = parsePeriod(query)
    const { start, end } = monthRange(year, month)

    const { data, error } = await sb
      .from('work_entries')
      .select(SELECT)
      .gte('entry_date', start)
      .lt('entry_date', end)
      .order('entry_date', { ascending: false })
    if (error) throw createError({ statusCode: 500, statusMessage: error.message })

    const entries: WorkEntry[] = (data ?? []).map((e) => ({
      ...e,
      hours: num(e.hours),
      hourly_rate: e.hourly_rate === null ? null : num(e.hourly_rate),
    })) as unknown as WorkEntry[]

    const weekStart = startOfWeek(new Date())
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 7)
    const ws = toISODate(weekStart)
    const we = toISODate(weekEnd)

    let weekHours = 0
    let weekEarnings = 0
    let monthHours = 0
    let monthEarnings = 0
    for (const e of entries) {
      const earn = e.hours * (e.hourly_rate ?? 0)
      monthHours += e.hours
      monthEarnings += earn
      if (e.entry_date >= ws && e.entry_date < we) {
        weekHours += e.hours
        weekEarnings += earn
      }
    }

    return {
      entries,
      monthTotals: { hours: round2(monthHours), earnings: round2(monthEarnings) },
      weekTotals: { hours: round2(weekHours), earnings: round2(weekEarnings) },
    }
  }

  if (method === 'POST') {
    const body = await readBody<Record<string, unknown>>(event)

    if (!body.entryDate || !body.hours) {
      throw createError({ statusCode: 400, statusMessage: 'Fecha y horas son obligatorias' })
    }
    await validateWorkEntry(body)

    const rateRaw = body.hourlyRate
    const hasRate = rateRaw !== undefined && rateRaw !== null && String(rateRaw).trim() !== ''

    const { data, error } = await sb
      .from('work_entries')
      .insert({
        entry_date: String(body.entryDate),
        hours: Number(body.hours),
        hourly_rate: hasRate ? Number(rateRaw) : null,
        description: strOrNull(body.description),
      })
      .select(SELECT)
      .single()

    if (error) throw createError({ statusCode: 500, statusMessage: error.message })
    setResponseStatus(event, 201)
    return data
  }

  throw createError({ statusCode: 405, statusMessage: 'Método no permitido' })
})

function startOfWeek(d: Date): Date {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const day = date.getUTCDay() || 7 // lunes = 1 ... domingo = 7
  date.setUTCDate(date.getUTCDate() - day + 1)
  return date
}

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
