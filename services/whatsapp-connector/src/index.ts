import { getStatus, startWhatsApp } from './whatsapp.js'
import { startHealthServer } from './server.js'

startHealthServer(getStatus)
void startWhatsApp()

process.on('SIGTERM', () => process.exit(0))
process.on('SIGINT', () => process.exit(0))
