import type { WAMessage } from '@whiskeysockets/baileys'
import { config } from './config.js'
import { extractMessage } from './extraction.js'
import { supabase } from './supabase.js'

let connectionId: string | null = null
let groupId: string | null = null

export async function ensureAuthorizedGroup(): Promise<boolean> {
  if (!config.groupId) return false

  const { data, error } = await supabase
    .from('whatsapp_groups')
    .select('id, connection_id, enabled')
    .eq('household_id', config.householdId)
    .eq('whatsapp_group_id', config.groupId)
    .eq('enabled', true)
    .maybeSingle()

  if (error) throw error
  if (!data) return false
  groupId = data.id as string
  connectionId = data.connection_id as string
  return true
}

export async function setConnectionStatus(status: 'PAIRING' | 'CONNECTED' | 'DISCONNECTED' | 'ERROR') {
  if (!connectionId) {
    const { data, error } = await supabase
      .from('whatsapp_connections')
      .insert({ household_id: config.householdId, status })
      .select('id')
      .single()
    if (error) throw error
    connectionId = data.id as string
    return
  }

  const { error } = await supabase
    .from('whatsapp_connections')
    .update({ status, last_seen_at: new Date().toISOString(), ...(status === 'CONNECTED' ? { connected_at: new Date().toISOString() } : {}) })
    .eq('id', connectionId)
  if (error) throw error
}

export async function persistMessage(message: WAMessage): Promise<void> {
  if (!groupId || !message.key.id) return
  const text = messageText(message)
  const timestamp = new Date(Number(message.messageTimestamp ?? Math.floor(Date.now() / 1000)) * 1000)
  const { data, error } = await supabase
    .from('whatsapp_messages')
    .upsert({
      household_id: config.householdId,
      group_id: groupId,
      whatsapp_message_id: message.key.id,
      sender_id: message.key.participant ?? message.key.remoteJid ?? 'unknown',
      sender_name: message.pushName ?? null,
      message_timestamp: timestamp.toISOString(),
      message_type: messageType(message),
      content: text,
      processing_status: text ? 'PROCESSED' : 'IGNORED',
    }, { onConflict: 'group_id,whatsapp_message_id' })
    .select('id')
    .single()

  if (error) throw error
  if (!text || !data) return

  const extraction = extractMessage(text, timestamp)
  const { error: extractionError } = await supabase
    .from('whatsapp_extractions')
    .upsert({ message_id: data.id, ...extraction, validation_status: 'PENDING_REVIEW' }, { onConflict: 'message_id' })
  if (extractionError) throw extractionError
}

function messageText(message: WAMessage): string | null {
  return message.message?.conversation
    ?? message.message?.extendedTextMessage?.text
    ?? null
}

function messageType(message: WAMessage): string {
  if (message.message?.conversation || message.message?.extendedTextMessage) return 'text'
  if (message.message?.imageMessage) return 'image'
  if (message.message?.documentMessage) return 'document'
  if (message.message?.audioMessage) return 'audio'
  return 'other'
}
