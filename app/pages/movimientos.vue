<script setup lang="ts">
import type { Category, Transaction } from '#shared/types'

const toast = useToast()

const now = new Date()
const month = ref(now.getMonth() + 1)
const year = ref(now.getFullYear())
const typeFilter = ref<string>('ALL')
const categoryFilter = ref<string>('')

const { data: categories } = await useFetch<Category[]>('/api/categories')

const { data: txns, status, error, refresh } = await useFetch<Transaction[]>('/api/transactions', {
  query: { month, year, type: typeFilter, categoryId: categoryFilter },
})

const typeOptions = [
  { label: 'Ingresos y gastos', value: 'ALL' },
  { label: 'Solo ingresos', value: 'INCOME' },
  { label: 'Solo gastos', value: 'EXPENSE' },
]

const catOptions = computed(() =>
  (categories.value ?? [])
    .filter((c) => typeFilter.value === 'ALL' || c.type === typeFilter.value)
    .map((c) => ({ label: c.name, value: c.id })),
)

const catMap = computed(() => {
  const map = new Map<string, Category>()
  for (const c of categories.value ?? []) map.set(c.id, c)
  return map
})

// ─── Modal form ──────────────────────────────────────────────
const modalOpen = ref(false)
const editingId = ref<string | null>(null)
const saving = ref(false)

const emptyForm = () => ({
  type: 'EXPENSE' as string,
  amount: '',
  date: new Date().toISOString().slice(0, 10),
  categoryId: '',
  description: '',
})
const form = reactive(emptyForm())

const formCats = computed(() =>
  (categories.value ?? [])
    .filter((c) => c.type === form.type)
    .map((c) => ({ label: c.name, value: c.id })),
)

function openCreate() {
  editingId.value = null
  Object.assign(form, emptyForm())
  if (typeFilter.value) form.type = typeFilter.value
  modalOpen.value = true
}

function openEdit(t: Transaction) {
  editingId.value = t.id
  form.type = t.type
  form.amount = String(t.amount)
  form.date = t.date
  form.categoryId = t.category_id ?? ''
  form.description = t.description ?? ''
  modalOpen.value = true
}

async function save() {
  saving.value = true
  try {
    await $fetch(editingId.value ? `/api/transactions/${editingId.value}` : '/api/transactions', {
      method: editingId.value ? 'PUT' : 'POST',
      body: {
        type: form.type,
        amount: Number(form.amount),
        date: form.date,
        categoryId: form.categoryId || null,
        description: form.description,
      },
    })
    toast.add({ title: editingId.value ? 'Movimiento actualizado' : 'Movimiento agregado', color: 'success' })
    modalOpen.value = false
    await refresh()
  } catch (e: unknown) {
    toast.add({ title: errMsg(e), color: 'error' })
  } finally {
    saving.value = false
  }
}

async function remove(t: Transaction) {
  if (!window.confirm('¿Borrar este movimiento?')) return
  try {
    await $fetch(`/api/transactions/${t.id}`, { method: 'DELETE' })
    toast.add({ title: 'Movimiento borrado', color: 'success' })
    await refresh()
  } catch (e: unknown) {
    toast.add({ title: errMsg(e), color: 'error' })
  }
}

function errMsg(e: unknown): string {
  const err = e as { data?: { statusMessage?: string }; statusMessage?: string; message?: string }
  return err?.data?.statusMessage ?? err?.statusMessage ?? err?.message ?? 'Error inesperado'
}
</script>

<template>
  <div>
    <div class="mb-6 flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-2xl font-bold">Movimientos</h1>
      <div class="flex flex-wrap items-center gap-2">
        <MonthPicker v-model:month="month" v-model:year="year" />
        <UButton label="Nuevo movimiento" @click="openCreate" />
      </div>
    </div>

    <!-- Filtros -->
    <div class="flex flex-wrap gap-2 mb-4">
      <USelect v-model="typeFilter" :items="typeOptions" class="w-44" />
      <USelect
        v-model="categoryFilter"
        :items="catOptions"
        placeholder="Todas las categorías"
        class="w-52"
      />
    </div>

    <UAlert v-if="error" color="error" variant="soft" :title="error.statusMessage || 'Error'" class="mb-4" />

    <div v-if="status === 'pending'" class="text-muted text-sm py-8 text-center">Cargando…</div>

    <div v-else-if="!txns?.length" class="rounded-lg border border-default p-8 text-center text-muted">
      Sin movimientos en el período.
    </div>

    <div v-else class="rounded-lg border border-default overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-default text-left text-muted text-xs uppercase tracking-wide">
            <th class="px-4 py-3 font-medium">Fecha</th>
            <th class="px-4 py-3 font-medium">Descripción</th>
            <th class="px-4 py-3 font-medium">Categoría</th>
            <th class="px-4 py-3 font-medium text-right">Monto</th>
            <th class="px-4 py-3 font-medium w-24"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="t in txns" :key="t.id" class="border-b border-default last:border-0 hover:bg-elevated/50">
            <td class="px-4 py-3 whitespace-nowrap tabular-nums">{{ formatDate(t.date) }}</td>
            <td class="px-4 py-3 max-w-xs truncate">{{ t.description || '—' }}</td>
            <td class="px-4 py-3">
              <span v-if="t.category_id" class="inline-flex items-center gap-1.5">
                <span
                  class="inline-block size-2.5 rounded-full"
                  :style="{ background: t.category?.color ?? catMap.get(t.category_id)?.color ?? '#94a3b8' }"
                />
                {{ t.category?.name ?? catMap.get(t.category_id)?.name }}
              </span>
              <span v-else class="text-muted">—</span>
            </td>
            <td
              class="px-4 py-3 text-right tabular-nums font-semibold whitespace-nowrap"
              :class="t.type === 'INCOME' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'"
            >
              {{ t.type === 'INCOME' ? '+' : '−' }}{{ formatMoney(t.amount) }}
            </td>
            <td class="px-4 py-3">
              <div class="flex gap-1 justify-end">
                <UButton variant="ghost" size="sm" color="neutral" label="Editar" @click="openEdit(t)" />
                <UButton variant="ghost" size="sm" color="error" label="Borrar" @click="remove(t)" />
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Modal alta/edición -->
    <UModal v-model:open="modalOpen" :title="editingId ? 'Editar movimiento' : 'Nuevo movimiento'">
      <template #body>
        <form class="space-y-4" @submit.prevent="save">
          <USelect v-model="form.type" :items="[ { label: 'Gasto', value: 'EXPENSE' }, { label: 'Ingreso', value: 'INCOME' } ]" class="w-full" />
          <UInput v-model="form.amount" type="number" step="0.01" min="0" placeholder="Monto" class="w-full" />
          <UInput v-model="form.date" type="date" class="w-full" />
          <USelect v-model="form.categoryId" :items="formCats" placeholder="Sin categoría" class="w-full" />
          <UInput v-model="form.description" placeholder="Descripción (opcional)" class="w-full" />
        </form>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2 w-full">
          <UButton variant="ghost" color="neutral" label="Cancelar" @click="modalOpen = false" />
          <UButton :loading="saving" label="Guardar" @click="save" />
        </div>
      </template>
    </UModal>
  </div>
</template>
