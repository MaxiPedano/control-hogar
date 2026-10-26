import { requireHouseholdMember } from '../../../../utils/auth'
import { strOrNull } from '../../../../utils/validation'
import type { Currency } from '#shared/types'
import type { TaskPriority, TaskStatus } from '#shared/types/household'

const PRIORITIES: TaskPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT']
const STATUSES: TaskStatus[] = ['PENDING', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED', 'CANCELLED']
const CURRENCIES: Currency[] = ['ARS', 'USD']

export default defineEventHandler(async (event) => {
  const householdId = getRouterParam(event, 'id') ?? ''
  const taskId = getRouterParam(event, 'taskId') ?? ''
  await requireHouseholdMember(event, householdId)
  const sb = useSupabaseAdmin()

  if (event.method !== 'PATCH') throw createError({ statusCode: 405, statusMessage: 'Método no permitido' })

  const body = await readBody<Record<string, unknown>>(event)
  const patch: Record<string, unknown> = {}
  if (body.title !== undefined) {
    const title = String(body.title).trim()
    if (!title) throw createError({ statusCode: 400, statusMessage: 'El título no puede estar vacío' })
    patch.title = title
  }
  if (body.description !== undefined) patch.description = strOrNull(body.description)
  if (body.category !== undefined) patch.category = strOrNull(body.category)
  if (body.notes !== undefined) patch.notes = strOrNull(body.notes)
  if (body.responsibleMemberId !== undefined) {
    const memberId = strOrNull(body.responsibleMemberId)
    await assertMember(sb, householdId, memberId)
    patch.responsible_member_id = memberId
  }
  if (body.dueDate !== undefined) {
    const dueDate = strOrNull(body.dueDate)
    if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) throw createError({ statusCode: 400, statusMessage: 'Fecha de vencimiento inválida' })
    patch.due_date = dueDate
  }
  if (body.priority !== undefined) {
    if (!PRIORITIES.includes(String(body.priority) as TaskPriority)) throw createError({ statusCode: 400, statusMessage: 'Prioridad inválida' })
    patch.priority = body.priority
  }
  if (body.status !== undefined) {
    const status = String(body.status) as TaskStatus
    if (!STATUSES.includes(status)) throw createError({ statusCode: 400, statusMessage: 'Estado inválido' })
    patch.status = status
    patch.completed_at = status === 'COMPLETED' ? new Date().toISOString() : null
  }
  if (body.currency !== undefined) {
    if (!CURRENCIES.includes(String(body.currency) as Currency)) throw createError({ statusCode: 400, statusMessage: 'Moneda inválida' })
    patch.currency = body.currency
  }
  for (const [key, target] of [['estimatedCost', 'estimated_cost'], ['actualCost', 'actual_cost']] as const) {
    if (body[key] !== undefined) {
      const value = body[key] === null || body[key] === '' ? null : Number(body[key])
      if (value !== null && (!Number.isFinite(value) || value < 0)) throw createError({ statusCode: 400, statusMessage: 'Costo inválido' })
      patch[target] = value
    }
  }
  if (body.relatedTransactionId !== undefined) patch.related_transaction_id = strOrNull(body.relatedTransactionId)

  if (!Object.keys(patch).length) throw createError({ statusCode: 400, statusMessage: 'No hay cambios para aplicar' })

  const { data, error } = await sb
    .from('household_tasks')
    .update(patch)
    .eq('id', taskId)
    .eq('household_id', householdId)
    .select('id, household_id, title, description, category, priority, status, responsible_member_id, responsible_member:household_members(id, name), due_date, estimated_cost, actual_cost, currency, related_transaction_id, created_at, completed_at, notes')
    .maybeSingle()

  if (error) throw createError({ statusCode: 500, statusMessage: error.message })
  if (!data) throw createError({ statusCode: 404, statusMessage: 'Tarea no encontrada' })
  return { ...data, estimated_cost: data.estimated_cost === null ? null : Number(data.estimated_cost) || 0, actual_cost: data.actual_cost === null ? null : Number(data.actual_cost) || 0 }
})

async function assertMember(sb: ReturnType<typeof useSupabaseAdmin>, householdId: string, memberId: string | null) {
  if (!memberId) return
  const { data, error } = await sb.from('household_members').select('id').eq('id', memberId).eq('household_id', householdId).eq('active', true).maybeSingle()
  if (error) throw createError({ statusCode: 500, statusMessage: error.message })
  if (!data) throw createError({ statusCode: 400, statusMessage: 'El responsable no pertenece al hogar' })
}
