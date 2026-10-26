import type { SupabaseClient } from '@supabase/supabase-js'
import type { TxnType } from '#shared/types'

const TXN_TYPES: TxnType[] = ['INCOME', 'EXPENSE']

export function strOrNull(value: unknown): string | null {
  const s = String(value ?? '').trim()
  return s.length > 0 ? s : null
}

export async function validateTransaction(
  sb: SupabaseClient,
  body: Record<string, unknown>,
): Promise<void> {
  if (body.type !== undefined && !TXN_TYPES.includes(body.type as TxnType)) {
    throw createError({ statusCode: 400, statusMessage: 'Tipo inválido' })
  }
  if (body.amount !== undefined && !(Number(body.amount) > 0)) {
    throw createError({ statusCode: 400, statusMessage: 'El monto debe ser mayor a 0' })
  }
  if (body.date !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(String(body.date))) {
    throw createError({ statusCode: 400, statusMessage: 'Fecha inválida' })
  }
  const categoryId = strOrNull(body.categoryId)
  if (categoryId) {
    const type = String(body.type ?? '')
    const { data: cat, error } = await sb
      .from('categories')
      .select('type')
      .eq('id', categoryId)
      .maybeSingle()
    if (error) throw createError({ statusCode: 500, statusMessage: error.message })
    if (!cat) throw createError({ statusCode: 400, statusMessage: 'La categoría no existe' })
    if (type && cat.type !== type) {
      throw createError({
        statusCode: 400,
        statusMessage: `La categoría elegida es de tipo ${cat.type === 'EXPENSE' ? 'gasto' : 'ingreso'}`,
      })
    }
  }
}

export async function validateWorkEntry(body: Record<string, unknown>): Promise<void> {
  if (body.entryDate !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(String(body.entryDate))) {
    throw createError({ statusCode: 400, statusMessage: 'Fecha inválida' })
  }
  if (body.hours !== undefined && !(Number(body.hours) > 0)) {
    throw createError({ statusCode: 400, statusMessage: 'Las horas deben ser mayores a 0' })
  }
  if (body.hourlyRate !== undefined && body.hourlyRate !== null && body.hourlyRate !== '' && !(Number(body.hourlyRate) >= 0)) {
    throw createError({ statusCode: 400, statusMessage: 'Tarifa inválida' })
  }
}
