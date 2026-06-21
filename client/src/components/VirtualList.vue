<template>
  <div
    ref="scrollRef"
    class="virtual-list"
    :style="{ height: containerHeight + 'px' }"
    @scroll="onScroll"
  >
    <div class="virtual-phantom" :style="{ height: totalHeight + 'px' }">
      <div
        class="virtual-content"
        :style="{ transform: `translateY(${offsetY}px)` }"
      >
        <div
          v-for="(item, idx) in visibleItems"
          :key="getKey(item, startIndex + idx)"
          class="virtual-item"
          :style="{ height: itemHeight + 'px' }"
        >
          <slot :item="item" :index="startIndex + idx" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts" generic="T extends Record<string, any>">
import { ref, computed, onMounted, onUnmounted } from 'vue'

interface Props {
  items: T[]
  itemHeight: number
  containerHeight: number
  overscan?: number
  keyField?: keyof T | ((item: T) => string | number)
}

const props = withDefaults(defineProps<Props>(), {
  overscan: 5,
})

const emit = defineEmits<{
  (e: 'scroll', offset: number): void
  (e: 'reach-bottom'): void
}>()

const scrollRef = ref<HTMLDivElement | null>(null)
const scrollTop = ref(0)
const startIndex = computed(() =>
  Math.max(0, Math.floor(scrollTop.value / props.itemHeight) - props.overscan)
)
const visibleCount = computed(() =>
  Math.ceil(props.containerHeight / props.itemHeight) + props.overscan * 2
)
const endIndex = computed(() =>
  Math.min(props.items.length, startIndex.value + visibleCount.value)
)
const visibleItems = computed(() => props.items.slice(startIndex.value, endIndex.value))
const totalHeight = computed(() => props.items.length * props.itemHeight)
const offsetY = computed(() => startIndex.value * props.itemHeight)

function getKey(item: T, idx: number): string | number {
  if (!props.keyField) return idx
  if (typeof props.keyField === 'function') return props.keyField(item)
  return String(item[props.keyField] ?? idx)
}

function onScroll() {
  if (!scrollRef.value) return
  scrollTop.value = scrollRef.value.scrollTop
  emit('scroll', scrollTop.value)
  if (
    scrollTop.value + props.containerHeight >=
    totalHeight.value - props.itemHeight * 3
  ) {
    emit('reach-bottom')
  }
}

function scrollToIndex(idx: number) {
  if (!scrollRef.value) return
  scrollRef.value.scrollTop = idx * props.itemHeight
}

function scrollToTop() {
  if (!scrollRef.value) return
  scrollRef.value.scrollTop = 0
}

onMounted(() => {
  if (scrollRef.value) scrollRef.value.scrollTop = scrollTop.value
})

onUnmounted(() => {
  // 清理 (此处无定时器, 占位)
})

defineExpose({ scrollToIndex, scrollToTop })
</script>

<style scoped lang="scss">
@use '@/styles/variables' as v;

$text-sec: var(--el-text-color-secondary);

.virtual-list {
  position: relative;
  overflow-y: auto;
  width: 100%;
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  background: var(--el-bg-color);
}

.virtual-phantom {
  position: relative;
  width: 100%;
}

.virtual-content {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  will-change: transform;
}

.virtual-item {
  width: 100%;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  border-bottom: var(--unified-border-bottom);
}
</style>
