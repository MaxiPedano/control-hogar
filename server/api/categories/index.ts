import type { Category, CategoryType } from '#shared/types'

const TYPES: CategoryType[] = ['EXPENSE', 'INCOME']
const COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f59e0b',
  '#84cc16', '#10b981', '#14b8a6', '#0ea5e9', '#64748b',
]

export default defineEventHandler(async (event) => {
  const sb = useSupabaseAdmin()
  const method = event.method

  if (method === 'GET') {
    const query = getQuery(event)
    let q = sb.from('categories').select('id, name, type, color').order('name')
    if (query.type === 'EXPENSE' || query.type === 'INCOME') {
      q = q.eq('type', query.type)
    }
    const { data, error } = await q
    if (error) throw createError({ statusCode: 500, statusMessage: error.message })
    return data as Category[]
  }

  if (method === 'POST') {
    const body = await readBody<Record<string, unknown>>(event)
    const name = String(body.name ?? '').trim()
    const type = String(body.type ?? '')
    let color = String(body.color ?? '').trim()

    if (!name) throw createError({ statusCode: 400, statusMessage: 'El nombre es obligatorio' })
    if (!TYPES.includes(type as CategoryType)) {
      throw createError({ statusCode: 400, statusMessage: 'Tipo inválido' })
    }
    if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
      color = COLORS[Math.floor(Math.random() * COLORS.length)]!
    }

    const { data, error } = await sb
      .from('categories')
      .insert({ name, type, color })
      .select('id, name, type, color')
      .single()

    if (error) {
      if (error.code === '23505') {
        throw createError({ statusCode: 409, statusMessage: `Ya existe la categoría "${name}"` })
      }
      throw createError({ statusCode: 500, statusMessage: error.message })
    }
    setResponseStatus(event, 201)
    return data as Category
  }

  throw createError({ statusCode: 405, statusMessage: 'Método no permitido' })
})
