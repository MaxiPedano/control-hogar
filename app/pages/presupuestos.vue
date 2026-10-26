<script setup lang="ts">
import type { BudgetItem } from '#shared/types'

const toast = useToast()

const now = new Date()
const month = ref(now.getMonth() + 1)
const year = ref(now.getFullYear())

interface BudgetsResponse {
  year: number
  month: number
  items: BudgetItem[]
}

const { data, status, error, refresh } = await useFetch<BudgetsResponse>('/api/budgets', {
  query: { month, year },
})

// Valores editables por categoría
const amounts = reactive<Record<string, string>>({})
const dirty = ref(new Set<string>())
const saving = ref(false)

watch(
  data,
  (d) => {
    if (!d) return
    for (const item of d.items) {
      amounts[item.categoryId] = item.budget !== null ? String(item.budget) : ''
    }
    dirty.value.clear()
  },
  { immediate: true },
)

function markDirty(id: string) {
  dirty.value.add(id)
}

async function saveAll() {
  const items = data.value?.items ?? []
  saving.value = true
  try {
    for (const item of items) {
      if (!dirty.value.has(item.categoryId)) continue
      await $fetch('/api/budgets', {
        method: 'PUT',
        body: {
          categoryId: item.categoryId,
          year: year.value,
          month: month.value,
          amount: Number(amounts[item.categoryId] || 0),
        },
      })
    }
    toast.add({ title: 'Presupuestos guardados', color: 'success' })
    dirty.value.clear()
    await refresh()
  } catch (e: unknown) {
    toast.add({ title: errMsg(e), color: 'error' })
  } finally {
    saving.value = false
  }
}

const hasDirty = computed(() => dirty.value.size > 0)

function barClass(item: BudgetItem): string {
  if (!item.budget || item.budget <= 0) return 'bg-neutral-400'
  const pct = Math.round((item.spent / item.budget) * 100)
  if (pct > 100) return 'bg-red-500'
  if (pct >= 80) return 'bg-amber-500'
  return 'bg-emerald-500'
}

function pct(item: BudgetItem): number {
  if (!item.budget || item.budget <= 0) return 0
  return Math.round((item.spent / item.budget) * 100)
}

function totalBudget(): number {
  return (data.value?.items ?? []).reduce((acc, i) => acc + (Number(amounts[i.categoryId]) || 0), 0)
}
function totalSpent(): number {
  return (data.value?.items ?? []).reduce((acc, i) => acc + i.spent, 0)
}

function errMsg(e: unknown): string {
  const err = e as { data?: { statusMessage?: string }; statusMessage?: string; message?: string }
  return err?.data?.statusMessage ?? err?.statusMessage ?? err?.message ?? 'Error inesperado'
}
</script>

<template>
  <div>
    <div class="mb-6 flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-2xl font-bold">Presupuestos</h1>
      <div class="flex items-center gap-2">
        <MonthPicker v-model:month="month" v-model:year="year" />
        <UButton :loading="saving" :disabled="!hasDirty" label="Guardar cambios" @click="saveAll" />
      </div>
    </div>

    <UAlert v-if="error" color="error" variant="soft" :title="error.statusMessage || 'Error'" class="mb-4" />

    <div v-if="status === 'pending'" class="text-muted text-sm py-8 text-center">Cargando…</div>

    <template v-else-if="data">
      <div v-if="!data.items.length" class="rounded-lg border border-default p-8 text-center text-muted mb-6">
        Primero creá categorías de tipo gasto para poder presupuestar.
      </div>

      <div class="mb-4 flex gap-6 text-sm text-muted">
        <span>Presupuesto total: <b class="text-default tabular-nums">{{ formatMoney(totalBudget()) }}</b></span>
        <span>Gastado: <b class="text-default tabular-nums">{{ formatMoney(totalSpent()) }}</b></span>
      </div>

      <div class="space-y-3 rounded-lg border border-default p-4">
        <div v-for="item in data.items" :key="item.categoryId" class="flex flex-wrap items-center gap-x-6 gap-y-3 py-1">
          <!-- nombre -->
          <div class="w-48 shrink-0 flex items-center gap-2 font-medium text-sm">
            <span class="inline-block size-2.5 rounded-full shrink-0" :style="{ background: item.color }" />
            <span class="truncate">{{ item.name }}</span>
          </div>

          <!-- input presupuesto -->
          <UInput
            v-model="amounts[item.categoryId]"
            type="number"
            step="0.01"
            min="0"
            placeholder="Sin presupuesto"
            class="w-36"
            @update:model-value="markDirty(item.categoryId)"
          />

          <!-- barra progreso -->
          <div class="flex-1 min-w-[180px]">
            <div class="flex justify-between text-xs text-muted mb-1 tabular-nums">
              <span>Gastado: {{ formatMoney(item.spent) }}</span>
              <span v-if="item.budget">{{ pct(item) }}%</span>
            </div>
            <div class="h-2 w-full rounded-full bg-elevated overflow-hidden">
              <div class="h-full rounded-full transition-all" :class="barClass(item)" :style="{ width: `${Math.min(pct(item), 100)}%` }" />
            </div>
          </div>
        </div>

        <p class="text-xs text-muted pt-2 border-t border-default">
          Dejá el campo vacío o en 0 para quitar el presupuesto de una categoría.
        </p>
      </div>
    </template>
  </div>
</template>
