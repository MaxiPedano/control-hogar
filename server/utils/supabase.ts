import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let cached: SupabaseClient | null = null

export function useSupabaseAdmin(): SupabaseClient {
  if (cached) return cached

  const config = useRuntimeConfig()
  const url = config.supabaseUrl
  const key = config.supabaseServiceKey

  if (!url || !key || url.includes('TU-PROYECTO')) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Supabase no configurado',
      message:
        'Supabase no configurado: completá NUXT_SUPABASE_URL y NUXT_SUPABASE_SERVICE_KEY en el archivo .env',
    })
  }

  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return cached
}

export interface PeriodRange {
  start: string
  end: string
}

export function monthRange(year: number, month: number): PeriodRange {
  const y = year
  const m = String(month).padStart(2, '0')
  const nextMonth = month === 12 ? 1 : month + 1
  const nextYear = month === 12 ? year + 1 : year
  return {
    start: `${y}-${m}-01`,
    end: `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`,
  }
}

export function parsePeriod(query: Record<string, unknown>): { year: number; month: number } {
  const now = new Date()
  let year = Number.parseInt(String(query.year ?? ''), 10)
  let month = Number.parseInt(String(query.month ?? ''), 10)
  if (!Number.isFinite(year) || year < 2000 || year > 2200) year = now.getFullYear()
  if (!Number.isFinite(month) || month < 1 || month > 12) month = now.getMonth() + 1
  return { year, month }
}

export function num(value: unknown): number {
  return Number(value ?? 0) || 0
}
