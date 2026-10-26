import { createServer } from 'node:http'
import type { ConnectorStatus } from './whatsapp.js'
import { config } from './config.js'

export function startHealthServer(getStatus: () => ConnectorStatus) {
  const server = createServer((request, response) => {
    if (request.method !== 'GET' || request.url !== '/health') {
      response.writeHead(404).end()
      return
    }
    response.writeHead(200, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ service: 'whatsapp-connector', ...getStatus() }))
  })
  server.listen(config.port, '0.0.0.0')
  return server
}
