<script setup lang="ts">
const props = defineProps<{ month: number; year: number }>()
const emit = defineEmits<{
  'update:month': [value: number]
  'update:year': [value: number]
}>()

const mProxy = computed({
  get: () => props.month,
  set: (v) => emit('update:month', Number(v)),
})
const yProxy = computed({
  get: () => props.year,
  set: (v) => emit('update:year', Number(v)),
})

const months = monthOptions()
const years = yearOptions()
</script>

<template>
  <div class="flex items-center gap-2">
    <USelect v-model="mProxy" :items="months" class="w-36" />
    <USelect v-model="yProxy" :items="years" class="w-24" />
  </div>
</template>
