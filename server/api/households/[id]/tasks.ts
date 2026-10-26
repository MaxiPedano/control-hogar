import { requireHouseholdMember } from '../../../utils/auth'
import { strOrNull } from '../../../utils/validation'
import type { Currency } from '#shared/types'
import type { TaskPriority, TaskStatus } from '#shared/types/household'

const PRIORITIES: TaskPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT']
const STATUSES: TaskStatus[] = ['PENDING', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED', 'CANCELLED']
const CURRENCIES: Currency[] = ['ARS', 'USD']
const SELECT = 'id, household_id, title, description, category, priority, status, responsible_member_id, responsible_member:household_members(id, name), due_date, estimated_cost, actual_cost, currency, related_transaction_id, created_at, completed_at, notes'

export default defineEventHandler(async (event) => {
  const householdId = getRouterParam(event, 'id') ?? ''
  await requireHouseholdMember(event, householdId)
  const sb = useSupabaseAdmin()

  if (event.method === 'GET') {
    let query = sb.from('household_tasks').select(SELECT).eq('household_id', householdId).order('due_date', { ascending: true, nullsFirst: false }).order('created_at', { ascending: false })
    const params = getQuery(event)
    if (typeof params.status === 'string' && STATUSES.includes(params.status as TaskStatus)) query = query.eq('status', params.status)
    if (typeof params.priority === 'string' && PRIORITIES.includes(params.priority as TaskPriority)) query = query.eq('priority', params.priority)
    if (typeof params.responsibleMemberId === 'string' && params.responsibleMemberId) query = query.eq('responsible_member_id', params.responsibleMemberId)

    const { data, error } = await query
    if (error) throw createError({ statusCode: 500, statusMessage: error.message })
    return (data ?? []).map(normalizeTask)
  }

  if (event.method === 'POST') {
    const body = await readBody<Record<string, unknown>>(event)
    const input = validateTask(body)
    await assertMember(sb, householdId, input.responsible_member_id as string | null)

    const { data, error } = await sb
      .from('household_tasks')
      .insert({ household_id: householdId, ...input })
      .select(SELECT)
      .single()

    if (error) throw createError({ statusCode: 500, statusMessage: error.message })
    setResponseStatus(event, 201)
    return normalizeTask(data)
  }

  throw createError({ statusCode: 405, statusMessage: 'Método no permitido' })
})

function validateTask(body: Record<string, unknown>): Record<string, unknown> {
  const title = String(body.title ?? '').trim()
  const priority = String(body.priority ?? 'MEDIUM') as TaskPriority
  const status = String(body.status ?? 'PENDING') as TaskStatus
  const currency = String(body.currency ?? 'ARS') as Currency
  const estimatedCost = nullableAmount(body.estimatedCost, 'Costo estimado inválido')
  const actualCost = nullableAmount(body.actualCost, 'Costo real inválido')
  const dueDate = strOrNull(body.dueDate)

  if (!title) throw createError({ statusCode: 400, statusMessage: 'El título es obligatorio' })
  if (!PRIORITIES.includes(priority)) throw createError({ statusCode: 400, statusMessage: 'Prioridad inválida' })
  if (!STATUSES.includes(status)) throw createError({ statusCode: 400, statusMessage: 'Estado inválido' })
  if (!CURRENCIES.includes(currency)) throw createError({ statusCode: 400, statusMessage: 'Moneda inválida' })
  if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) throw createError({ statusCode: 400, statusMessage: 'Fecha de vencimiento inválida' })

  return {
    title,
    description: strOrNull(body.description),
    category: strOrNull(body.category),
    priority,
    status,
    responsible_member_id: strOrNull(body.responsibleMemberId),
    due_date: dueDate,
    estimated_cost: estimatedCost,
    actual_cost: actualCost,
    currency,
    related_transaction_id: strOrNull(body.relatedTransactionId),
    notes: strOrNull(body.notes),
    completed_at: status === 'COMPLETED' ? new Date().toISOString() : null,
  }
}

function nullableAmount(value: unknown, message: string): number | null {
  if (value === undefined || value === null || value === '') return null
  const amount = Number(value)
  if (!Number.isFinite(amount) || amount < 0) throw createError({ statusCode: 400, statusMessage: message })
  return amount
}

async function assertMember(sb: ReturnType<typeof useSupabaseAdmin>, householdId: string, memberId: string | null) {
  if (!memberId) return
  const { data, error } = await sb.from('household_members').select('id').eq('id', memberId).eq('household_id', householdId).eq('active', true).maybeSingle()
  if (error) throw createError({ statusCode: 500, statusMessage: error.message })
  if (!data) throw createError({ statusCode: 400, statusMessage: 'El responsable no pertenece al hogar' })
}

function normalizeTask(task: Record<string, unknown>) {
  return {
    ...task,
    estimated_cost: task.estimated_cost === null ? null : Number(task.estimated_cost) || 0,
    actual_cost: task.actual_cost === null ? null : Number(task.actual_cost) || 0,
  }
}
