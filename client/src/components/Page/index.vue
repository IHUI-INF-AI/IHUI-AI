<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { cn } from '@/lib/utils'

defineOptions({ name: 'Page', inheritAttrs: false })

const props = defineProps({
  total: { type: Number, default: 0 },
  pageSize: { type: Number, default: 20 },
  current: { type: Number, default: 1 },
  currentChange: { type: Function, default: null },
  sizeChange: { type: Function, default: null },
  layout: { type: String, default: 'total, sizes, prev, pager, next, jumper' },
  pageSizes: { type: Array as any, default: () => [10, 20, 50, 100] },
  pagerCount: { type: Number, default: 7 },
})

const emit = defineEmits<{
  change: [currentPage: number, pageSize: number]
  'current-change': [currentPage: number]
  'size-change': [size: number]
  'update:current': [currentPage: number]
  'update:pageSize': [size: number]
}>()

const innerCurrent = ref(props.current)
const innerSize = ref(props.pageSize)
const jumper = ref('')

watch(
  () => props.current,
  (val) => {
    innerCurrent.value = val
  },
)

watch(
  () => props.pageSize,
  (val) => {
    innerSize.value = val
  },
)

const totalPages = computed(() => Math.max(1, Math.ceil(props.total / innerSize.value)))

const layoutList = computed(() =>
  props.layout
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
)

const pagers = computed<any[]>(() => {
  const count = props.pagerCount
  const half = Math.floor((count - 1) / 2)
  const cur = innerCurrent.value
  const total = totalPages.value
  const pages: any[] = []

  if (total <= count) {
    for (let i = 1; i <= total; i++) pages.push(i)
    return pages
  }

  let start = cur - half
  let end = cur + half
  if (start < 1) {
    start = 1
    end = count
  }
  if (end > total) {
    end = total
    start = total - count + 1
  }

  if (start > 1) {
    pages.push(1)
    if (start > 2) pages.push('prev-ellipsis')
  }
  for (let i = start; i <= end; i++) pages.push(i)
  if (end < total) {
    if (end < total - 1) pages.push('next-ellipsis')
    pages.push(total)
  }
  return pages
})

const goTo = (page: number) => {
  const target = Math.min(Math.max(1, page), totalPages.value)
  if (target === innerCurrent.value) return
  innerCurrent.value = target
  emit('update:current', target)
  emit('current-change', target)
  emit('change', target, innerSize.value)
  props.currentChange?.(target)
}

const changeSize = (event: Event) => {
  const target = event.target as HTMLSelectElement
  const size = Number(target.value)
  innerSize.value = size
  emit('update:pageSize', size)
  emit('size-change', size)
  emit('change', innerCurrent.value, size)
  props.sizeChange?.(size)
  const maxPage = Math.max(1, Math.ceil(props.total / size))
  if (innerCurrent.value > maxPage) goTo(maxPage)
}

const submitJumper = () => {
  const page = parseInt(jumper.value, 10)
  if (!isNaN(page)) goTo(page)
  jumper.value = ''
}
</script>

<template>
  <div :class="cn('flex flex-wrap items-center gap-2 text-sm text-muted-foreground', $attrs.class as any)" :style="($attrs.style as any)">
    <span v-if="layoutList.includes('total')" class="mr-1">
      共 <span class="font-medium text-foreground">{{ total }}</span> 条
    </span>

    <select
      v-if="layoutList.includes('sizes')"
      :value="innerSize"
      class="h-8 rounded-md border border-input bg-background px-2 text-foreground text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background"
      @change="changeSize"
    >
      <option v-for="size in pageSizes" :key="size" :value="size">{{ size }} 条/页</option>
    </select>

    <template v-if="layoutList.includes('prev')">
      <button
        type="button"
        :disabled="innerCurrent <= 1"
        class="inline-flex h-8 min-w-8 items-center justify-center rounded-md border border-input bg-background px-2 text-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50"
        @click="goTo(innerCurrent - 1)"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
      </button>
    </template>

    <template v-if="layoutList.includes('pager')">
      <template v-for="(page, index) in pagers" :key="index">
        <span v-if="page === 'prev-ellipsis' || page === 'next-ellipsis'" class="inline-flex h-8 min-w-8 items-center justify-center text-muted-foreground">···</span>
        <button
          v-else
          type="button"
          :class="
            cn(
              'inline-flex h-8 min-w-8 items-center justify-center rounded-md border px-2 text-sm transition-colors',
              page === innerCurrent
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-input bg-background text-foreground hover:bg-accent hover:text-accent-foreground',
            )
          "
          @click="goTo(page as number)"
        >
          {{ page }}
        </button>
      </template>
    </template>

    <template v-if="layoutList.includes('next')">
      <button
        type="button"
        :disabled="innerCurrent >= totalPages"
        class="inline-flex h-8 min-w-8 items-center justify-center rounded-md border border-input bg-background px-2 text-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50"
        @click="goTo(innerCurrent + 1)"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
      </button>
    </template>

    <span v-if="layoutList.includes('jumper')" class="ml-1 inline-flex items-center gap-1">
      前往
      <input
        v-model="jumper"
        type="number"
        class="h-8 w-12 rounded-md border border-input bg-background px-2 text-center text-foreground text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background"
        @keyup.enter="submitJumper"
      />
      页
    </span>
  </div>
</template>
