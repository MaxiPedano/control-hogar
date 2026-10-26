# Control Hogar WhatsApp Connector

Servicio independiente de Node.js, TypeScript y Baileys. No se ejecuta dentro
de Nuxt y no envía mensajes.

## Alcance

- Escucha únicamente `WHATSAPP_GROUP_ID`.
- Requiere que ese grupo exista y esté `enabled = true` en `whatsapp_groups`.
- Si `WHATSAPP_GROUP_ID` está vacío durante la primera vinculación, lista los
  grupos disponibles en los logs sin persistir ni procesar sus mensajes.
- Persiste texto mínimo, remitente, fecha, tipo e identificador del mensaje.
- Deduplica con `group_id, whatsapp_message_id`.
- Genera extracciones determinísticas con `PENDING_REVIEW`.
- No confirma movimientos, no descarga medios y no procesa otros grupos.
- Guarda la sesión en `WHATSAPP_AUTH_DIR`, que debe ser un volumen persistente
  protegido y nunca debe entrar en Git.

## Configuración

Copiá `.env.example` a `.env` y completá los valores en el entorno de
despliegue. `SUPABASE_SERVICE_ROLE_KEY` solo debe existir en este servicio y
nunca en el frontend. Dejá `WHATSAPP_GROUP_ID` vacío durante la primera
vinculación si todavía no conocés el identificador técnico.

```bash
pnpm install
pnpm run build
pnpm start
```

El endpoint `GET /health` expone únicamente el estado técnico, autorización del
grupo y último error sin secretos.

## Vinculación

Al iniciar sin una sesión válida, Baileys imprime un QR en los logs. La sesión
queda en el volumen configurado. Las desconexiones se reintentan, excepto una
sesión explícitamente deslogueada, que requiere vinculación manual.

Después de escanear el QR, copiá del log el `id` del grupo correcto, configurá
`WHATSAPP_GROUP_ID`, insertá ese mismo ID en `whatsapp_groups` con
`enabled = true` y reiniciá el servicio.

## Riesgos operativos

Baileys no es una API oficial de WhatsApp. Pueden ocurrir cambios incompatibles,
desconexiones, restricciones o re-vinculaciones. Se requiere consentimiento de
los participantes del grupo, retención mínima de mensajes y monitoreo del
servicio.
