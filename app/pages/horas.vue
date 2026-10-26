<script setup lang="ts">
import type { WorkEntry } from '#shared/types'

const toast = useToast()

const now = new Date()
const month = ref(now.getMonth() + 1)
const year = ref(now.getFullYear())

interface WorkResponse {
  entries: WorkEntry[]
  monthTotals: { hours: number; earnings: number }
  weekTotals: { hours: number; earnings: number }
}

const { data, status, error, refresh } = await useFetch<WorkResponse>('/api/work-entries', {
  query: { month, year },
})

// ─── Form alta rápida ────────────────────────────────────────
const saving = ref(false)
const form = reactive({
  entryDate: new Date().toISOString().slice(0, 10),
  hours: '',
  hourlyRate: '',
  description: '',
})

async function addEntry() {
  if (!form.entryDate || !form.hours) {
    toast.add({ title: 'Completá fecha y horas', color: 'warning' })
    return
  }
  saving.value = true
  try {
    await $fetch('/api/work-entries', {
      method: 'POST',
      body: {
        entryDate: form.entryDate,
        hours: Number(form.hours),
        hourlyRate: form.hourlyRate,
        description: form.description,
      },
    })
    toast.add({ title: 'Horas registradas', color: 'success' })
    form.hours = ''
    form.description = ''
    await refresh()
  } catch (e: unknown) {
    toast.add({ title: errMsg(e), color: 'error' })
  } finally {
    saving.value = false
  }
}

// ─── Edición ─────────────────────────────────────────────────
const modalOpen = ref(false)
const editingId = ref<string | null>(null)
const editSaving = ref(false)
const editForm = reactive({ entryDate: '', hours: '', hourlyRate: '', description: '' })

function openEdit(e: WorkEntry) {
  editingId.value = e.id
  editForm.entryDate = e.entry_date
  editForm.hours = String(e.hours)
  editForm.hourlyRate = e.hourly_rate !== null ? String(e.hourly_rate) : ''
  editForm.description = e.description ?? ''
  modalOpen.value = true
}

async function saveEdit() {
  if (!editingId.value) return
  editSaving.value = true
  try {
    await $fetch(`/api/work-entries/${editingId.value}`, {
      method: 'PUT',
      body: {
        entryDate: editForm.entryDate,
        hours: Number(editForm.hours),
        hourlyRate: editForm.hourlyRate,
        description: editForm.description,
      },
    })
    toast.add({ title: 'Registro actualizado', color: 'success' })
    modalOpen.value = false
    await refresh()
  } catch (e: unknown) {
    toast.add({ title: errMsg(e), color: 'error' })
  } finally {
    editSaving.value = false
  }
}

async function remove(e: WorkEntry) {
  if (!window.confirm('¿Borrar este registro de horas?')) return
  try {
    await $fetch(`/api/work-entries/${e.id}`, { method: 'DELETE' })
    toast.add({ title: 'Registro borrado', color: 'success' })
    await refresh()
  } catch (err: unknown) {
    toast.add({ title: errMsg(err), color: 'error' })
  }
}

function subtotal(e: WorkEntry): number {
  return Math.round(e.hours * (e.hourly_rate ?? 0) * 100) / 100
}

function errMsg(e: unknown): string {
  const err = e as { data?: { statusMessage?: string }; statusMessage?: string; message?: string }
  return err?.data?.statusMessage ?? err?.statusMessage ?? err?.message ?? 'Error inesperado'
}
</script>

<template>
  <div>
    <div class="mb-6 flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-2xl font-bold">Horas de trabajo</h1>
      <MonthPicker v-model:month="month" v-model:year="year" />
    </div>

    <!-- Totales -->
    <div class="grid grid-cols-2 gap-4 mb-6 max-w-md">
      <div class="rounded-lg border border-default p-4">
        <p class="text-sm text-muted mb-1">Este mes</p>
        <p class="text-xl font-bold">{{ formatHours(data?.monthTotals.hours) }}</p>
        <p v-if="(data?.monthTotals.earnings ?? 0) > 0" class="text-xs text-muted mt-0.5">
          ≈ {{ formatMoney(data?.monthTotals.earnings) }}
        </p>
      </div>
      <div class="rounded-lg border border-default p-4">
        <p class="text-sm text-muted mb-1">Semana actual</p>
        <p class="text-xl font-bold">{{ formatHours(data?.weekTotals.hours) }}</p>
        <p v-if="(data?.weekTotals.earnings ?? 0) > 0" class="text-xs text-muted mt-0.5">
          ≈ {{ formatMoney(data?.weekTotals.earnings) }}
        </p>
      </div>
    </div>

    <!-- Alta rápida -->
    <form class="rounded-lg border border-default p-4 mb-6 grid gap-3 sm:grid-cols-[150px_110px_140px_1fr_auto] items-center" @submit.prevent="addEntry">
      <UInput v-model="form.entryDate" type="date" class="w-full" />
      <UInput v-model="form.hours" type="number" step="0.25" min="0" placeholder="Horas" class="w-full" />
      <UInput v-model="form.hourlyRate" type="number" step="0.01" min="0" placeholder="Tarifa/h (opcional)" class="w-full" />
      <UInput v-model="form.description" placeholder="¿En qué trabajaste? (opcional)" class="w-full" />
      <UButton type="submit" :loading="saving" label="Agregar" />
    </form>

    <UAlert v-if="error" color="error" variant="soft" :title="error.statusMessage || 'Error'" class="mb-4" />

    <div v-if="status === 'pending'" class="text-muted text-sm py-8 text-center">Cargando…</div>

    <div v-else-if="!data?.entries.length" class="rounded-lg border border-default p-8 text-center text-muted">
      Sin horas registradas en el período.
    </div>

    <div v-else class="rounded-lg border border-default overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-default text-left text-muted text-xs uppercase tracking-wide">
            <th class="px-4 py-3 font-medium">Fecha</th>
            <th class="px-4 py-3 font-medium">Descripción</th>
            <th class="px-4 py-3 font-medium text-right">Horas</th>
            <th class="px-4 py-3 font-medium text-right">Tarifa/h</th>
            <th class="px-4 py-3 font-medium text-right">Subtotal</th>
            <th class="px-4 py-3 font-medium w-24"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="e in data.entries" :key="e.id" class="border-b border-default last:border-0 hover:bg-elevated/50">
            <td class="px-4 py-3 whitespace-nowrap tabular-nums">{{ formatDate(e.entry_date) }}</td>
            <td class="px-4 py-3 max-w-xs truncate">{{ e.description || '—' }}</td>
            <td class="px-4 py-3 text-right tabular-nums">{{ formatHours(e.hours) }}</td>
            <td class="px-4 py-3 text-right tabular-nums">{{ e.hourly_rate !== null ? formatMoney(e.hourly_rate) : '—' }}</td>
            <td class="px-4 py-3 text-right tabular-nums font-semibold">{{ e.hourly_rate !== null ? formatMoney(subtotal(e)) : '—' }}</td>
            <td class="px-4 py-3">
              <div class="flex gap-1 justify-end">
                <UButton variant="ghost" size="sm" color="neutral" label="Editar" @click="openEdit(e)" />
                <UButton variant="ghost" size="sm" color="error" label="Borrar" @click="remove(e)" />
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Modal edición -->
    <UModal v-model:open="modalOpen" title="Editar registro de horas">
      <template #body>
        <form class="space-y-4" @submit.prevent="saveEdit">
          <UInput v-model="editForm.entryDate" type="date" class="w-full" />
          <UInput v-model="editForm.hours" type="number" step="0.25" min="0" placeholder="Horas" class="w-full" />
          <UInput v-model="editForm.hourlyRate" type="number" step="0.01" min="0" placeholder="Tarifa por hora" class="w-full" />
          <UInput v-model="editForm.description" placeholder="Descripción" class="w-full" />
        </form>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2 w-full">
          <UButton variant="ghost" color="neutral" label="Cancelar" @click="modalOpen = false" />
          <UButton :loading="editSaving" label="Guardar" @click="saveEdit" />
        </div>
      </template>
    </UModal>
  </div>
</template>
