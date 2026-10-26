import { num } from '../../utils/supabase'
import { strOrNull, validateWorkEntry } from '../../utils/validation'

const SELECT = 'id, entry_date, hours, hourly_rate, description'

export default defineEventHandler(async (event) => {
  const sb = useSupabaseAdmin()
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Falta el id' })

  if (event.method !== 'PUT' && event.method !== 'DELETE') {
    throw createError({ statusCode: 405, statusMessage: 'Método no permitido' })
  }

  if (event.method === 'DELETE') {
    const { error } = await sb.from('work_entries').delete().eq('id', id)
    if (error) throw createError({ statusCode: 500, statusMessage: error.message })
    return { ok: true }
  }

  const body = await readBody<Record<string, unknown>>(event)
  await validateWorkEntry(body)

  const update: Record<string, unknown> = {}
  if (body.entryDate !== undefined) update.entry_date = String(body.entryDate)
  if (body.hours !== undefined) update.hours = Number(body.hours)
  if (body.description !== undefined) update.description = strOrNull(body.description)
  if (body.hourlyRate !== undefined) {
    update.hourly_rate =
      body.hourlyRate === null || String(body.hourlyRate).trim() === '' ? null : Number(body.hourlyRate)
  }

  const { data, error } = await sb
    .from('work_entries')
    .update(update)
    .eq('id', id)
    .select(SELECT)
    .single()

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })
  return data
})
