<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { computed } from 'vue'
import { cn } from '@/lib/utils'

const props = withDefaults(
  defineProps<{
    total: number
    page?: number
    pageSize?: number
    pageSizes?: number[]
    layout?: string
    background?: boolean
    class?: HTMLAttributes['class']
  }>(),
  {
    page: 1,
    pageSize: 10,
    pageSizes: () => [10, 20, 50, 100],
    layout: 'prev, pager, next, jumper, total, sizes',
    background: true,
  },
)

const emit = defineEmits<{
  'update:page': [page: number]
  'update:pageSize': [size: number]
  change: [page: number, pageSize: number]
  'current-change': [page: number]
  'size-change': [size: number]
}>()

const currentPage = computed({
  get: () => props.page,
  set: (val) => {
    emit('update:page', val)
    emit('current-change', val)
    emit('change', val, props.pageSize)
  },
})

const totalPages = computed(() => Math.ceil(props.total / props.pageSize) || 1)

const pages = computed(() => {
  const result: number[] = []
  const current = currentPage.value
  const total = totalPages.value
  if (total <= 7) {
    for (let i = 1; i <= total; i++) result.push(i)
  } else {
    result.push(1)
    if (current > 4) result.push(-1)
    const start = Math.max(2, current - 1)
    const end = Math.min(total - 1, current + 1)
    for (let i = start; i <= end; i++) result.push(i)
    if (current < total - 3) result.push(-2)
    result.push(total)
  }
  return result
})

const goPrev = () => {
  if (currentPage.value > 1) currentPage.value = currentPage.value - 1
}

const goNext = () => {
  if (currentPage.value < totalPages.value) currentPage.value = currentPage.value + 1
}

const goTo = (page: number) => {
  if (page > 0 && page <= totalPages.value) currentPage.value = page
}

const handleSizeChange = (e: Event) => {
  const size = Number((e.target as HTMLSelectElement).value)
  emit('update:pageSize', size)
  emit('size-change', size)
  emit('change', 1, size)
  emit('update:page', 1)
}
</script>

<template>
  <div :class="cn('flex flex-wrap items-center gap-2 text-sm', props.class)">
    <template v-if="layout.includes('total')">
      <span class="text-muted-foreground">共 {{ total }} 条</span>
    </template>
    <template v-if="layout.includes('sizes')">
      <select
        :value="pageSize"
        class="h-8 rounded-md border border-input bg-background px-2 text-xs"
        @change="handleSizeChange"
      >
        <option v-for="size in pageSizes" :key="size" :value="size">{{ size }} 条/页</option>
      </select>
    </template>
    <template v-if="layout.includes('prev')">
      <button
        type="button"
        :disabled="currentPage <= 1"
        :class="
          cn(
            'inline-flex h-8 min-w-8 items-center justify-center rounded-md border px-2 text-sm transition-colors',
            background ? 'border-input bg-background' : 'border-transparent',
            currentPage <= 1 ? 'cursor-not-allowed opacity-50' : 'hover:bg-accent hover:text-accent-foreground',
          )
        "
        @click="goPrev"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>
    </template>
    <template v-if="layout.includes('pager')">
      <template v-for="p in pages" :key="p">
        <span v-if="p < 0" class="inline-flex h-8 w-8 items-center justify-center text-muted-foreground">...</span>
        <button
          v-else
          type="button"
          :class="
            cn(
              'inline-flex h-8 min-w-8 items-center justify-center rounded-md border px-2 text-sm transition-colors',
              background ? 'border-input bg-background' : 'border-transparent',
              p === currentPage ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-accent hover:text-accent-foreground',
            )
          "
          @click="goTo(p)"
        >
          {{ p }}
        </button>
      </template>
    </template>
    <template v-if="layout.includes('next')">
      <button
        type="button"
        :disabled="currentPage >= totalPages"
        :class="
          cn(
            'inline-flex h-8 min-w-8 items-center justify-center rounded-md border px-2 text-sm transition-colors',
            background ? 'border-input bg-background' : 'border-transparent',
            currentPage >= totalPages ? 'cursor-not-allowed opacity-50' : 'hover:bg-accent hover:text-accent-foreground',
          )
        "
        @click="goNext"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>
    </template>
    <template v-if="layout.includes('jumper')">
      <span class="text-muted-foreground">前往</span>
      <input
        type="number"
        :value="currentPage"
        class="h-8 w-12 rounded-md border border-input bg-background px-2 text-center text-sm"
        @keyup.enter="goTo(Number(($event.target as HTMLInputElement).value))"
      />
      <span class="text-muted-foreground">页</span>
    </template>
  </div>
</template>
