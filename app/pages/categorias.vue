<script setup lang="ts">
import type { Category } from '#shared/types'

const toast = useToast()

const { data: categories, status, error, refresh } = await useFetch<Category[]>('/api/categories')

const modalOpen = ref(false)
const editingId = ref<string | null>(null)
const saving = ref(false)

const emptyForm = () => ({
  name: '',
  type: 'EXPENSE' as string,
  color: '#6366f1',
})
const form = reactive(emptyForm())

function openCreate() {
  editingId.value = null
  Object.assign(form, emptyForm())
  modalOpen.value = true
}

function openEdit(c: Category) {
  editingId.value = c.id
  form.name = c.name
  form.type = c.type
  form.color = c.color
  modalOpen.value = true
}

async function save() {
  saving.value = true
  try {
    await $fetch(editingId.value ? `/api/categories/${editingId.value}` : '/api/categories', {
      method: editingId.value ? 'PUT' : 'POST',
      body: { name: form.name, type: form.type, color: form.color },
    })
    toast.add({ title: editingId.value ? 'Categoría actualizada' : 'Categoría creada', color: 'success' })
    modalOpen.value = false
    await refresh()
  } catch (e: unknown) {
    toast.add({ title: errMsg(e), color: 'error' })
  } finally {
    saving.value = false
  }
}

async function remove(c: Category) {
  if (!window.confirm(`¿Borrar la categoría "${c.name}"?`)) return
  try {
    await $fetch(`/api/categories/${c.id}`, { method: 'DELETE' })
    toast.add({ title: 'Categoría borrada', color: 'success' })
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
    <div class="mb-6 flex items-center justify-between gap-3">
      <h1 class="text-2xl font-bold">Categorías</h1>
      <UButton label="Nueva categoría" @click="openCreate" />
    </div>

    <UAlert v-if="error" color="error" variant="soft" :title="error.statusMessage || 'Error'" class="mb-4" />

    <div v-if="status === 'pending'" class="text-muted text-sm py-8 text-center">Cargando…</div>

    <div v-else-if="!categories?.length" class="rounded-lg border border-default p-8 text-center text-muted">
      Todavía no hay categorías. Creá la primera para clasificar tus gastos e ingresos.
    </div>

    <div v-else class="rounded-lg border border-default overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-default text-left text-muted text-xs uppercase tracking-wide">
            <th class="px-4 py-3 font-medium">Nombre</th>
            <th class="px-4 py-3 font-medium">Tipo</th>
            <th class="px-4 py-3 font-medium w-32"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in categories" :key="c.id" class="border-b border-default last:border-0 hover:bg-elevated/50">
            <td class="px-4 py-3">
              <span class="inline-flex items-center gap-2">
                <span class="inline-block size-3 rounded-full" :style="{ background: c.color }" />
                {{ c.name }}
              </span>
            </td>
            <td class="px-4 py-3">
              <UBadge :color="c.type === 'EXPENSE' ? 'error' : 'success'" variant="subtle">
                {{ c.type === 'EXPENSE' ? 'Gasto' : 'Ingreso' }}
              </UBadge>
            </td>
            <td class="px-4 py-3">
              <div class="flex gap-1 justify-end">
                <UButton variant="ghost" size="sm" color="neutral" label="Editar" @click="openEdit(c)" />
                <UButton variant="ghost" size="sm" color="error" label="Borrar" @click="remove(c)" />
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <UModal v-model:open="modalOpen" :title="editingId ? 'Editar categoría' : 'Nueva categoría'">
      <template #body>
        <form class="space-y-4" @submit.prevent="save">
          <UInput v-model="form.name" placeholder="Nombre de la categoría" class="w-full" />
          <USelect
            v-model="form.type"
            :items="[ { label: 'Gasto', value: 'EXPENSE' }, { label: 'Ingreso', value: 'INCOME' } ]"
            class="w-full"
            :disabled="!!editingId"
          />
          <div class="flex items-center gap-3">
            <span class="text-sm text-muted">Color:</span>
            <input v-model="form.color" type="color" class="h-9 w-14 cursor-pointer rounded border border-default bg-transparent" />
            <span class="inline-block size-5 rounded-full" :style="{ background: form.color }" />
          </div>
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
