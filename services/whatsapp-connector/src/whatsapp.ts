import {
  Browsers,
  DisconnectReason,
  makeWASocket,
  useMultiFileAuthState,
  makeCacheableSignalKeyStore,
  type WASocket,
} from '@whiskeysockets/baileys'
import pino from 'pino'
import qrcode from 'qrcode-terminal'
import { mkdir } from 'node:fs/promises'
import { config } from './config.js'
import { ensureAuthorizedGroup, persistMessage, setConnectionStatus } from './repository.js'

export interface ConnectorStatus {
  status: 'starting' | 'pairing' | 'connected' | 'disconnected' | 'error'
  groupAuthorized: boolean
  lastError: string | null
}

const logger = pino({ level: process.env.LOG_LEVEL ?? 'info' })
let socket: WASocket | null = null
let reconnectTimer: NodeJS.Timeout | null = null
let reconnecting = false
const current: ConnectorStatus = { status: 'starting', groupAuthorized: false, lastError: null }

export function getStatus(): ConnectorStatus {
  return { ...current }
}

export async function startWhatsApp(): Promise<void> {
  if (reconnecting) return
  reconnecting = true
  await mkdir(config.authDir, { recursive: true })

  try {
    current.groupAuthorized = await ensureAuthorizedGroup()
    if (!current.groupAuthorized) {
      current.status = 'error'
      current.lastError = 'The configured group is not enabled in Supabase.'
      logger.error({ groupId: config.groupId }, current.lastError)
      return
    }

    const { state, saveCreds } = await useMultiFileAuthState(config.authDir)
    const nextSocket = makeWASocket({
      auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, logger) },
      browser: Browsers.ubuntu('Control Hogar'),
      logger,
      markOnlineOnConnect: false,
      syncFullHistory: false,
    })
    socket = nextSocket
    nextSocket.ev.on('creds.update', saveCreds)
    nextSocket.ev.on('connection.update', update => handleConnectionUpdate(update))
    nextSocket.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return
      for (const message of messages) {
        if (message.key.fromMe || message.key.remoteJid !== config.groupId) continue
        try {
          await persistMessage(message)
        } catch (error) {
          current.lastError = error instanceof Error ? error.message : String(error)
          logger.error({ err: error, messageId: message.key.id }, 'Message persistence failed')
        }
      }
    })
  } catch (error) {
    current.status = 'error'
    current.lastError = error instanceof Error ? error.message : String(error)
    logger.error({ err: error }, 'WhatsApp startup failed')
    scheduleReconnect()
  } finally {
    reconnecting = false
  }
}

async function handleConnectionUpdate(update: { connection?: 'open' | 'close' | 'connecting'; lastDisconnect?: { error?: Error }; qr?: string }) {
  if (update.qr) {
    current.status = 'pairing'
    await setConnectionStatus('PAIRING')
    qrcode.generate(update.qr, { small: true })
  }
  if (update.connection === 'open') {
    current.status = 'connected'
    current.lastError = null
    await setConnectionStatus('CONNECTED')
    logger.info('WhatsApp connected')
  }
  if (update.connection !== 'close') return

  socket = null
  current.status = 'disconnected'
  await setConnectionStatus('DISCONNECTED').catch(error => logger.error({ err: error }, 'Could not update disconnect status'))
  const code = (update.lastDisconnect?.error as { output?: { statusCode?: number } } | undefined)?.output?.statusCode
  if (code === DisconnectReason.loggedOut) {
    current.lastError = 'WhatsApp session logged out; manual relinking is required.'
    current.status = 'error'
    logger.error(current.lastError)
    return
  }
  scheduleReconnect()
}

function scheduleReconnect() {
  if (reconnectTimer) return
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    void startWhatsApp()
  }, config.reconnectDelayMs)
}
