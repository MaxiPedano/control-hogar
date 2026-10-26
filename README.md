# Control Hogar

Plataforma familiar para controlar **finanzas**, **cuentas**, **presupuestos**,
**deudas**, **tarjetas**, **obligaciones**, **tareas del hogar** y mensajes
financieros recibidos desde un grupo autorizado de WhatsApp. La funcionalidad
original de horas de trabajo, ingresos, gastos, categorías y presupuestos se
mantiene.

Stack: Nuxt 4 + Nuxt UI v4 + Supabase (Postgres) — los datos viven en la nube,
la service_role key se usa solo en el servidor.

---

## 1. Crear el proyecto en Supabase (una sola vez)

1. Entrá a <https://supabase.com> → **Sign up** (cuenta gratis).
2. **New project**:
   - Name: `control-hogar`
   - Database Password: guardala (no se usa en esta app, pero anotala)
   - Region: `South America (São Paulo)` o la más cercana
3. Cuando termine de crearse (~2 min):
   - Andé a **Project Settings → API**
   - Copiá `Project URL` y `service_role` (secret)

## 2. Configurar credenciales

Editá `.env` y pega tus valores:

```
NUXT_SUPABASE_URL=https://TU-PROYECTO.supabase.co
NUXT_SUPABASE_SERVICE_KEY=eyJhbGciOi...tu service_role key
```

> La `service_role` nunca llega al navegador: solo la usan las rutas API del servidor.

## 3. Crear o migrar las tablas

- Para una instalación nueva, ejecutá `supabase/schema.sql` desde **SQL Editor**.
- Para una instalación existente, revisá primero el esquema remoto y aplicá las
  migraciones de `supabase/migrations/` en orden.
- La migración `0001_control_hogar_2_foundation.sql` es no destructiva, pero no
  asigna registros históricos a un hogar automáticamente. Esa asignación debe
  ser explícita y auditada.
- La migración `0002_legacy_assignment_audit.sql` agrega únicamente el registro
  de auditoría de decisiones de asociación; tampoco modifica históricos.
- No ejecutes migraciones sobre producción sin respaldo, revisión del esquema y
  autorización.

### Estado remoto actual

Proyecto Supabase: `nwiujscmeumxgenhkfok`.

Según la última revisión autorizada, existen solamente:

- `categories`: 15 registros.
- `transactions`: 13 registros.
- `budgets`: 11 registros.
- `work_entries`: 0 registros.

Las cuatro tablas tienen RLS activado sin políticas configuradas y todavía no
tienen `household_id`. Las migraciones 0001 y 0002 están pendientes de
autorización y ejecución. No se deben presentar como aplicadas. Las columnas
nuevas en tablas históricas se agregan nullable para no materializar estados,
monedas o fuentes inventadas.

## 4. Levantar la app

```bash
pnpm install
pnpm dev
```

Abrí <http://localhost:3100>

## Scripts

| Comando           | Descripción                  |
| ----------------- | ---------------------------- |
| `pnpm dev`        | Servidor de desarrollo :3100 |
| `pnpm build`      | Build de producción          |
| `pnpm preview`    | Preview del build            |
| `pnpm typecheck`  | Chequeo de tipos             |

## Secciones

- **Inicio**: resumen del mes (ingresos, gastos, balance, horas) + presupuesto vs real por categoría
- **Movimientos**: alta/edición/borrado de ingresos y gastos
- **Categorías**: CRUD de categorías de gasto/ingreso con color
- **Presupuestos**: monto mensual por categoría + comparativo contra lo gastado
- **Horas**: registro diario de horas trabajadas con tarifa opcional

## Arquitectura 2.0

- `app/`: páginas, componentes y estilos Nuxt.
- `server/api/`: BFF y validaciones server-side.
- `shared/types/`: contratos TypeScript compartidos.
- `supabase/migrations/`: cambios incrementales de PostgreSQL, RLS y dominio.
- `services/whatsapp-connector/`: conector independiente de Baileys, pendiente
  de implementación.

Los endpoints nuevos de hogares requieren un token de Supabase en el header
`Authorization` y validan la membresía activa en servidor. La resolución de
hogar usa `X-Household-Id`; no se acepta un hogar solo por un valor enviado por
el cliente. Las rutas legacy todavía usan el cliente administrativo y serán
migradas antes de habilitar el uso multiusuario en producción.

Las primeras APIs de dominio autenticadas son:

- `/api/households/:id/accounts` para cuentas en ARS/USD.
- `/api/households/:id/tasks` para tareas, responsables, prioridades, costos y
  estados.

Baileys no se ejecutará dentro del frontend. El conector solo persistirá
mensajes del grupo autorizado por su identificador real, con deduplicación y
estado `PENDING_REVIEW` para las interpretaciones. No se enviarán mensajes
masivos ni se descargarán medios ajenos a la finalidad financiera.

## Responsabilidades y datos reales

**OpenCode implementa software. ChatGPT administra la información financiera
real. No insertar datos financieros históricos o ficticios en producción.**

No se guardan secretos, sesiones de WhatsApp ni movimientos financieros reales
en el repositorio.
