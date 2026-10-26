import type { Category } from '#shared/types'

export default defineEventHandler(async (event) => {
  const sb = useSupabaseAdmin()
  const id = getRouterParam(event, 'id')
  const method = event.method

  if (!id) throw createError({ statusCode: 400, statusMessage: 'Falta el id' })

  if (method === 'PUT') {
    const body = await readBody<Record<string, unknown>>(event)
    const name = String(body.name ?? '').trim()
    const color = String(body.color ?? '').trim()

    if (!name) throw createError({ statusCode: 400, statusMessage: 'El nombre es obligatorio' })
    if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
      throw createError({ statusCode: 400, statusMessage: 'Color inválido' })
    }

    const { data, error } = await sb
      .from('categories')
      .update({ name, color })
      .eq('id', id)
      .select('id, name, type, color')
      .single()

    if (error) {
      if (error.code === '23505') {
        throw createError({ statusCode: 409, statusMessage: `Ya existe la categoría "${name}"` })
      }
      throw createError({ statusCode: 500, statusMessage: error.message })
    }
    return data as Category
  }

  if (method === 'DELETE') {
    const { count, error: countError } = await sb
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('category_id', id)

    if (countError) throw createError({ statusCode: 500, statusMessage: countError.message })
    if ((count ?? 0) > 0) {
      throw createError({
        statusCode: 409,
        statusMessage: `La categoría tiene ${count} movimiento(s) asociado(s). No se puede borrar.`,
      })
    }

    const { error } = await sb.from('categories').delete().eq('id', id)
    if (error) throw createError({ statusCode: 500, statusMessage: error.message })
    return { ok: true }
  }

  throw createError({ statusCode: 405, statusMessage: 'Método no permitido' })
})
