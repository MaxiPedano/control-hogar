import 'dotenv/config'

function required(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

function numberEnv(name: string, fallback: number): number {
  const value = Number(process.env[name] ?? fallback)
  return Number.isFinite(value) && value > 0 ? value : fallback
}

export const config = {
  supabaseUrl: required('SUPABASE_URL'),
  serviceRoleKey: required('SUPABASE_SERVICE_ROLE_KEY'),
  householdId: required('HOUSEHOLD_ID'),
  groupId: process.env.WHATSAPP_GROUP_ID?.trim() || null,
  authDir: process.env.WHATSAPP_AUTH_DIR?.trim() || './data/whatsapp-auth',
  port: numberEnv('PORT', 8787),
  reconnectDelayMs: numberEnv('RECONNECT_DELAY_MS', 5000),
}
