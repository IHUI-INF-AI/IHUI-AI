<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'

interface VirtualScrollItem {
  id?: string | number
  [key: string]: any
}

interface Props<T extends VirtualScrollItem> {
  items: T[]
  itemHeight: number
  buffer?: number
  keyField?: string
}

const props = withDefaults(defineProps<Props<VirtualScrollItem>>(), {
  buffer: 5,
  keyField: 'id',
})

const emit = defineEmits<{
  scroll: [scrollTop: number]
  visibleChange: [startIndex: number, endIndex: number]
}>()

const containerRef = ref<HTMLElement | null>(null)
const scrollTop = ref(0)
const containerHeight = ref(0)

const totalHeight = computed(() => props.items.length * props.itemHeight)

const startIndex = computed(() => {
  const index = Math.floor(scrollTop.value / props.itemHeight) - props.buffer
  return Math.max(0, index)
})

const endIndex = computed(() => {
  const visibleCount = Math.ceil(containerHeight.value / props.itemHeight)
  const index = startIndex.value + visibleCount + props.buffer * 2
  return Math.min(props.items.length, index)
})

interface VisibleItem {
  item: VirtualScrollItem
  index: number
  key: string | number
  style: {
    position: 'absolute'
    top: string
    height: string
    width: string
  }
}

const visibleItems = computed(() => {
  const result: VisibleItem[] = []
  for (let i = startIndex.value; i < endIndex.value; i++) {
    const item = props.items[i]
    if (item) {
      const keyValue = props.keyField && item[props.keyField]
      result.push({
        item,
        index: i,
        key: keyValue !== undefined ? String(keyValue) : i,
        style: {
          position: 'absolute',
          top: `${i * props.itemHeight}px`,
          height: `${props.itemHeight}px`,
          width: '100%',
        },
      })
    }
  }
  return result
})

const offsetY = computed(() => startIndex.value * props.itemHeight)

const handleScroll = (e: Event) => {
  const target = e.target as HTMLElement
  scrollTop.value = target.scrollTop
  emit('scroll', scrollTop.value)
}

const updateContainerHeight = () => {
  if (containerRef.value) {
    containerHeight.value = containerRef.value.clientHeight
  }
}

let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  nextTick(() => {
    updateContainerHeight()
    if (containerRef.value) {
      resizeObserver = new ResizeObserver(() => {
        updateContainerHeight()
      })
      resizeObserver.observe(containerRef.value)
    }
  })
})

onUnmounted(() => {
  resizeObserver?.disconnect()
})

watch([startIndex, endIndex], ([newStart, newEnd]) => {
  emit('visibleChange', newStart, newEnd)
})

const scrollToIndex = (index: number) => {
  if (containerRef.value) {
    containerRef.value.scrollTop = index * props.itemHeight
  }
}

const scrollToTop = () => {
  if (containerRef.value) {
    containerRef.value.scrollTop = 0
  }
}

defineExpose({
  scrollToIndex,
  scrollToTop,
  scrollTop,
  startIndex,
  endIndex,
})
</script>

<template>
  <div
    ref="containerRef"
    class="virtual-scroll-container"
    @scroll="handleScroll"
  >
    <div
      class="virtual-scroll-content"
      :style="{ height: `${totalHeight}px` }"
    >
      <div
        class="virtual-scroll-viewport"
        :style="{ transform: `translateY(${offsetY}px)` }"
      >
        <div
          v-for="{ item, index, key, style } in visibleItems"
          :key="key"
          class="virtual-scroll-item"
          :style="style"
        >
          <slot :item="item" :index="index" />
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.virtual-scroll-container {
  overflow-y: auto;
  position: relative;
  width: 100%;
  height: 100%;
}

.virtual-scroll-content {
  position: relative;
  width: 100%;
}

.virtual-scroll-viewport {
  position: relative;
  width: 100%;
}

.virtual-scroll-item {
  box-sizing: border-box;
}
</style>
