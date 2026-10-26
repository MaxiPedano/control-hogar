<script setup lang="ts">
import type { DashboardData } from '#shared/types'

const now = new Date()
const month = ref(now.getMonth() + 1)
const year = ref(now.getFullYear())

const { data, status, error, refresh } = await useFetch<DashboardData>('/api/dashboard', {
  query: { month, year },
})

function pctColor(b: { budget: number; spent: number; pct: number }): string {
  if (b.budget <= 0) return 'bg-neutral-400'
  if (b.pct > 100) return 'bg-red-500'
  if (b.pct >= 80) return 'bg-amber-500'
  return 'bg-emerald-500'
}

const empty = computed(() => !data.value || (data.value.income === 0 && data.value.expense === 0 && data.value.hours === 0))
</script>

<template>
  <div>
    <div class="mb-6 flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-2xl font-bold">Resumen</h1>
      <MonthPicker v-model:month="month" v-model:year="year" />
    </div>

    <UAlert
      v-if="error"
      color="error"
      variant="soft"
      :title="error.statusMessage || 'Error'"
      class="mb-4"
    />

    <div v-if="status === 'pending'" class="text-muted text-sm py-8 text-center">Cargando…</div>

    <template v-else-if="data">
      <div v-if="empty" class="rounded-lg border border-default p-8 text-center text-muted mb-6">
        No hay datos para {{ monthName(month) }} {{ year }}.
        Cargá movimientos u horas desde el menú.
      </div>

      <!-- Totales -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div class="rounded-lg border border-default p-4">
          <p class="text-sm text-muted mb-1">Ingresos</p>
          <p class="text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {{ formatMoney(data.income) }}
          </p>
        </div>
        <div class="rounded-lg border border-default p-4">
          <p class="text-sm text-muted mb-1">Gastos</p>
          <p class="text-xl sm:text-2xl font-bold text-red-600 dark:text-red-400">
            {{ formatMoney(data.expense) }}
          </p>
        </div>
        <div class="rounded-lg border border-default p-4">
          <p class="text-sm text-muted mb-1">Balance</p>
          <p
            class="text-xl sm:text-2xl font-bold"
            :class="data.balance >= 0 ? 'text-default' : 'text-red-600 dark:text-red-400'"
          >
            {{ formatMoney(data.balance) }}
          </p>
        </div>
        <div class="rounded-lg border border-default p-4">
          <p class="text-sm text-muted mb-1">Horas trabajadas</p>
          <p class="text-xl sm:text-2xl font-bold">{{ formatHours(data.hours) }}</p>
          <p v-if="data.earnings > 0" class="text-xs text-muted mt-1">
            ≈ {{ formatMoney(data.earnings) }} según tarifas
          </p>
        </div>
      </div>

      <!-- Presupuestos -->
      <section v-if="data.budgets.length" class="mb-8">
        <h2 class="text-lg font-semibold mb-3">Presupuesto vs gasto — {{ monthName(month) }}</h2>
        <div class="space-y-4 rounded-lg border border-default p-4">
          <div v-for="b in data.budgets" :key="b.categoryId">
            <div class="flex justify-between text-sm mb-1.5">
              <span class="font-medium flex items-center gap-2">
                <span class="inline-block size-2.5 rounded-full" :style="{ background: b.color }" />
                {{ b.name }}
              </span>
              <span class="text-muted tabular-nums">
                {{ formatMoney(b.spent) }} / {{ formatMoney(b.budget) }}
                <span
                  v-if="b.budget > 0"
                  class="ml-1 font-medium"
                  :class="b.pct > 100 ? 'text-red-500' : 'text-muted'"
                >
                  ({{ b.pct }}%)
                </span>
              </span>
            </div>
            <div class="h-2 w-full rounded-full bg-elevated overflow-hidden">
              <div
                class="h-full rounded-full transition-all"
                :class="pctColor(b)"
                :style="{ width: `${Math.min(b.pct, 100)}%` }"
              />
            </div>
          </div>
        </div>
      </section>

      <!-- Gastos por categoría -->
      <section v-if="data.expensesByCategory.length">
        <h2 class="text-lg font-semibold mb-3">Gastos por categoría</h2>
        <div class="space-y-3 rounded-lg border border-default p-4">
          <div v-for="c in data.expensesByCategory" :key="c.name">
            <div class="flex justify-between text-sm mb-1">
              <span class="flex items-center gap-2">
                <span class="inline-block size-2.5 rounded-full" :style="{ background: c.color }" />
                {{ c.name }}
              </span>
              <span class="tabular-nums">{{ formatMoney(c.total) }}</span>
            </div>
            <div class="h-1.5 w-full rounded-full bg-elevated overflow-hidden">
              <div
                class="h-full rounded-full"
                :style="{
                  background: c.color,
                  width: `${(c.total / (data!.expensesByCategory[0]?.total || 1)) * 100}%`,
                }"
              />
            </div>
          </div>
        </div>
      </section>

      <UButton
        variant="ghost"
        color="neutral"
        label="Actualizar"
        class="mt-6"
        @click="refresh()"
      />
    </template>
  </div>
</template>
