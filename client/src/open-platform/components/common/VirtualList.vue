<template>
  <div class="virtual-list" :style="{ height: containerHeight + 'px' }">
    <div
      class="virtual-list-container"
      :style="{ height: totalHeight + 'px' }"
      @scroll="handleScroll"
      ref="containerRef"
    >
      <div
        class="virtual-list-content"
        :style="{ transform: `translateY(${offsetY}px)` }"
      >
        <div
          v-for="item in visibleItems"
          :key="getItemKey(item)"
          class="virtual-list-item"
          :style="{ height: itemHeight + 'px' }"
        >
          <slot :item="item" :index="item.index" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

interface VirtualListItem {
  id?: string | number
  index?: number
  [key: string]: unknown
}

interface Props {
  items: VirtualListItem[]
  itemHeight: number
  containerHeight: number
  getItemKey?: (item: VirtualListItem) => string | number
}

const props = withDefaults(defineProps<Props>(), {
  getItemKey: (item: VirtualListItem) => item.id ?? item.index ?? 0,
})

const containerRef = ref<HTMLElement>()
const scrollTop = ref(0)

// 计算可见区域
const visibleStart = computed(() => {
  return Math.floor(scrollTop.value / props.itemHeight)
})

const visibleEnd = computed(() => {
  const visibleCount = Math.ceil(props.containerHeight / props.itemHeight)
  return Math.min(visibleStart.value + visibleCount + 1, props.items.length)
})

const visibleItems = computed(() => {
  return props.items
    .slice(visibleStart.value, visibleEnd.value)
    .map((item: VirtualListItem, idx: number) => ({
      ...(item as Record<string, unknown>),
      index: visibleStart.value + idx,
    }))
})

const offsetY = computed(() => {
  return visibleStart.value * props.itemHeight
})

const totalHeight = computed(() => {
  return props.items.length * props.itemHeight
})

// 滚动处理
const handleScroll = (e: Event) => {
  const target = e.target as HTMLElement
  scrollTop.value = target.scrollTop
}

</script>

<style scoped lang="scss">
.virtual-list {
  overflow: hidden;

  .virtual-list-container {
    overflow: hidden auto;
  }

  .virtual-list-content {
    position: relative;
  }

  .virtual-list-item {
    box-sizing: border-box;
  }
}
</style>
