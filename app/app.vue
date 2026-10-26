<script setup lang="ts">
const route = useRoute()

const nav = [
  { to: '/', label: 'Inicio' },
  { to: '/movimientos', label: 'Movimientos' },
  { to: '/categorias', label: 'Categorías' },
  { to: '/presupuestos', label: 'Presupuestos' },
  { to: '/horas', label: 'Horas' },
]

function isActive(to: string): boolean {
  return to === '/' ? route.path === '/' : route.path.startsWith(to)
}
</script>

<template>
  <UApp>
    <div class="min-h-screen flex flex-col sm:flex-row bg-default text-default">
      <!-- Sidebar desktop -->
      <aside
        class="hidden sm:flex w-56 shrink-0 flex-col gap-1 border-r border-default p-4"
      >
        <div class="mb-6 px-3 py-2 text-lg font-bold tracking-tight">
          Control Hogar
        </div>
        <NuxtLink
          v-for="item in nav"
          :key="item.to"
          :to="item.to"
          class="rounded-md px-3 py-2 text-sm font-medium transition-colors"
          :class="
            isActive(item.to)
              ? 'bg-primary/10 text-primary'
              : 'text-muted hover:bg-elevated hover:text-highlighted'
          "
        >
          {{ item.label }}
        </NuxtLink>
      </aside>

      <!-- Top nav mobile -->
      <header class="sm:hidden border-b border-default px-4 py-3">
        <div class="mb-2 text-lg font-bold tracking-tight">Control Hogar</div>
        <nav class="flex gap-1 overflow-x-auto">
          <NuxtLink
            v-for="item in nav"
            :key="item.to"
            :to="item.to"
            class="whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium"
            :class="isActive(item.to) ? 'bg-primary/10 text-primary' : 'text-muted'"
          >
            {{ item.label }}
          </NuxtLink>
        </nav>
      </header>

      <main class="flex-1 p-4 sm:p-6 max-w-5xl w-full mx-auto">
        <NuxtPage />
      </main>
    </div>
  </UApp>
</template>
