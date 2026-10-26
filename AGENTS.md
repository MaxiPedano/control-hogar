# Control Hogar

## Propósito

Control Hogar es una aplicación familiar para administrar finanzas, cuentas,
presupuestos, deudas, tarjetas, obligaciones, tareas del hogar y mensajes
financieros recibidos desde un grupo autorizado de WhatsApp.

## Arquitectura y stack

- Frontend y BFF: Nuxt 4, Vue, Nuxt UI y Nitro.
- Lenguaje: TypeScript.
- Persistencia: PostgreSQL administrado por Supabase.
- Autenticación prevista: Supabase Auth.
- Integración WhatsApp: servicio Node.js/TypeScript independiente con Baileys.
- El frontend nunca debe recibir la `service_role` key ni credenciales de Baileys.

La aplicación web vive en `app/` y sus endpoints en `server/api/`. Los tipos
compartidos están en `shared/types/`. Las migraciones SQL se guardan en
`supabase/migrations/`. El conector independiente vive en
`services/whatsapp-connector/`.

## Convenciones

- Usar TypeScript estricto y nombres de columnas en `snake_case` para Supabase.
- Validar entradas en el servidor antes de escribir en la base.
- Mantener importes como `numeric` en PostgreSQL y convertirlos a `number` solo
  en los límites de la API.
- Preferir cambios incrementales y migraciones no destructivas.
- No agregar datos de ejemplo a entornos reales.

## Comandos

```bash
pnpm dev
pnpm run typecheck
pnpm run build
```

## Modelo de datos

Las tablas originales son `categories`, `transactions`, `budgets` y
`work_entries`. La ampliación agrega hogares e integrantes, cuentas, deudas,
obligaciones recurrentes, ingresos, tarjetas, tareas y el dominio de WhatsApp.
Todos los registros nuevos deben quedar aislados por `household_id` y las
relaciones financieras deben conservar la moneda (`ARS` o `USD`).

Reglas importantes:

- Una transferencia entre cuentas propias no es un ingreso familiar.
- Un pago de resumen de tarjeta no vuelve a contar sus compras como gastos.
- Una tarea no crea automáticamente una transacción.
- Las obligaciones futuras y los movimientos reales tienen estados distintos.
- Los importes pendientes de confirmar no deben presentarse como cobrados o
  pagados.
- Un mensaje de WhatsApp nunca crea una transacción definitiva sin revisión.

## WhatsApp

Baileys se ejecuta únicamente en `services/whatsapp-connector`. El servicio
solo escucha el `whatsapp_group_id` autorizado, deduplica por identificador de
mensaje y persiste el texto mínimo necesario. La extracción determinística
queda en `PENDING_REVIEW`; las interpretaciones ambiguas requieren corrección o
rechazo manual. No se descargan medios ajenos a la finalidad financiera, no se
envían mensajes masivos y no se guardan credenciales en Git.

Baileys no es una API oficial de WhatsApp: pueden ocurrir desconexiones,
re-vinculaciones y cambios incompatibles. El despliegue debe contemplar sesión
persistente protegida, reconexión controlada, logs técnicos sin secretos y
consentimiento de los participantes del grupo.

## Seguridad y migraciones

- Activar RLS en toda tabla con información familiar.
- Autorizar por usuario autenticado y pertenencia a `household_members`.
- Usar la service key solo en servidor y nunca en código cliente.
- No aplicar políticas públicas indiscriminadas.
- Registrar cambios sensibles y definir retención/eliminación de mensajes.
- Revisar el esquema remoto antes de aplicar cada migración.
- No ejecutar migraciones destructivas ni sobrescribir datos existentes.

Las migraciones de `supabase/migrations/` se aplican en orden. La migración
fundacional deja las columnas de hogar de datos históricos como `nullable` para
no inventar una asignación. La asignación de registros existentes debe hacerse
con una decisión explícita y auditada.

Estado remoto conocido del proyecto `nwiujscmeumxgenhkfok`: existen solamente
`categories` (15), `transactions` (13), `budgets` (11) y `work_entries` (0).
RLS está activado en esas tablas, sin políticas configuradas, y no existe aún
`household_id`. Las migraciones locales `0001` y `0002` están pendientes; no se
debe afirmar que fueron aplicadas hasta verificarlo en Supabase. Las columnas
nuevas sobre tablas históricas se agregan nullable y sin defaults que escriban
valores en registros existentes.

Antes de ejecutar SQL en producción, presentar el SQL, revisar el esquema
remoto, obtener autorización explícita y conservar un registro del resultado.

## Pruebas

Cada etapa debe ejecutar `pnpm run typecheck` y `pnpm run build`. Las pruebas
de integración deben verificar RLS, aislamiento por hogar, deduplicación de
WhatsApp, ausencia de doble contabilización de tarjetas y separación entre
pagos reales y obligaciones futuras.

## Responsabilidades

**OpenCode implementa software. ChatGPT administra la información financiera
real. No insertar datos financieros históricos o ficticios en producción.**

OpenCode puede persistir mensajes recibidos en una bandeja de revisión, pero no
debe convertirlos automáticamente en movimientos definitivos. ChatGPT carga,
concilia, clasifica y analiza la información financiera real mediante la
conexión autorizada a Supabase.
