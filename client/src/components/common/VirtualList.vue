<template>
  <div
    ref="containerRef"
    class="virtual-list-container"
    :style="{ height: `${height}px`, overflow: 'auto' }"
    @scroll="handleScroll"
  >
    <div :style="{ height: `${totalHeight}px`, position: 'relative' }">
      <div
        :style="{
          transform: `translateY(${offsetY}px)`,
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
        }"
      >
        <div
          v-for="item in visibleItems"
          :key="getItemKey(item, item.index)"
          :style="{ height: `${itemHeight}px` }"
        >
          <slot :item="item.data" :index="item.index" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

interface Props {
  items: unknown[]
  itemHeight: number
  height: number
  overscan?: number
  getItemKey?: (item: unknown, index: number) => string | number
}

const props = withDefaults(defineProps<Props>(), {
  overscan: 3,
  getItemKey: (_: unknown, index: number) => index,
})

const containerRef = ref<HTMLElement | null>(null)
const scrollTop = ref(0)

// 计算可见范围
const visibleRange = computed(() => {
  const start = Math.max(0, Math.floor(scrollTop.value / props.itemHeight) - props.overscan)
  const end = Math.min(
    props.items.length - 1,
    Math.ceil((scrollTop.value + props.height) / props.itemHeight) + props.overscan
  )
  return { start, end }
})

// 可见项
const visibleItems = computed(() => {
  const { start, end } = visibleRange.value
  return props.items.slice(start, end + 1).map((item: unknown, index: number) => ({
    data: item,
    index: start + index,
  }))
})

// 总高度
const totalHeight = computed(() => props.items.length * props.itemHeight)

// 偏移量
const offsetY = computed(() => visibleRange.value.start * props.itemHeight)

// 处理滚动
const handleScroll = (event: Event) => {
  const target = event.target as HTMLElement
  scrollTop.value = target.scrollTop
}

// 滚动到指定索引
const scrollToIndex = (index: number) => {
  if (containerRef.value) {
    const targetScrollTop = index * props.itemHeight
    containerRef.value.scrollTop = targetScrollTop
  }
}

// 滚动到顶部
const scrollToTop = () => {
  scrollToIndex(0)
}

// 滚动到底部
const scrollToBottom = () => {
  scrollToIndex(props.items.length - 1)
}

defineExpose({
  scrollToIndex,
  scrollToTop,
  scrollToBottom,
})
</script>

<style scoped lang="scss">
.virtual-list-container {
  position: relative;
  overflow: hidden auto;
  -webkit-overflow-scrolling: touch;
}
</style>
