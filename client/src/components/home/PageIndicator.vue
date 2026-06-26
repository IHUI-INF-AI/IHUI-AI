<template>
  <div
    ref="tablistRef"
    class="page-indicator"
    role="tablist"
    aria-label="页面导航"
    tabindex="0"
    @keydown="handleKeydown"
  >
    <div
      v-for="(label, index) in pageLabels"
      :key="index"
      class="indicator-dot"
      :class="{ active: currentPage === index }"
      role="tab"
      :aria-selected="currentPage === index"
      :aria-label="`跳转到第 ${label} 页`"
      :tabindex="currentPage === index ? 0 : -1"
      :title="label"
      @click="handleClick(index, $event)"
    ></div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

interface Props {
  currentPage: number
  totalPages: number
  scrollToPage: (index: number) => void
}

const props = defineProps<Props>()

const tablistRef = ref<HTMLElement | null>(null)

const pageLabels = computed(() => {
  const labels: string[] = []
  for (let i = 1; i <= props.totalPages; i += 1) {
    labels.push(String(i))
  }
  return labels
})

// 点击圆点：跳转并把焦点拉回 tablist，键盘可继续操作
const handleClick = (index: number, event: MouseEvent) => {
  props.scrollToPage(index)
  // 将焦点保持在 tablist 上，便于后续键盘操作
  const target = event.currentTarget as HTMLElement | null
  target?.focus({ preventScroll: true })
}

// 键盘左右键切换：参考 ARIA Tabs 设计模式（roving tabindex）
const handleKeydown = (event: KeyboardEvent) => {
  const total = props.totalPages
  if (total === 0) return

  let nextIndex: number | null = null

  switch (event.key) {
    case 'ArrowDown':
    case 'ArrowRight':
      nextIndex = (props.currentPage + 1) % total
      break
    case 'ArrowUp':
    case 'ArrowLeft':
      nextIndex = (props.currentPage - 1 + total) % total
      break
    case 'Home':
      nextIndex = 0
      break
    case 'End':
      nextIndex = total - 1
      break
    default:
      return
  }

  event.preventDefault()
  props.scrollToPage(nextIndex)
  // 切换后将焦点移动到对应 tab，保持键盘可达
  requestAnimationFrame(() => {
    const dots = tablistRef.value?.querySelectorAll<HTMLElement>('.indicator-dot')
    dots?.[nextIndex!]?.focus({ preventScroll: true })
  })
}
</script>

<style scoped lang="scss">
.page-indicator {
  position: fixed;
  right: 16px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px 6px;
  background-color: var(--color-white-90);
  border: var(--unified-border);
  border-radius: var(--global-border-radius);
  z-index: var(--z-dropdown);
  pointer-events: auto;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  outline: none;
}

.page-indicator:focus-visible {
  border: 1px solid var(--el-color-primary);
}

.indicator-dot {
  width: 6px;
  height: 6px;
  border-radius: var(--global-border-radius);
  background-color: var(--el-text-color-regular);
  cursor: pointer;
  transition: background-color 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), width 0.3s cubic-bezier(0.4, 0, 0.2, 1), height 0.3s cubic-bezier(0.4, 0, 0.2, 1), border-radius 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  outline: none;
}

.indicator-dot:hover {
  background-color: var(--el-text-color-primary);
  transform: scale(1.2);
}

.indicator-dot:active {
  transform: scale(1.6);
  transition: transform 0.1s ease;
}

.indicator-dot.active {
  width: 6px;
  height: 18px;
  border-radius: var(--global-border-radius);
  background-color: var(--el-text-color-primary);
}

.indicator-dot.active:active {
  transform: scale(1.2);
  transition: transform 0.1s ease;
}

.indicator-dot:focus-visible {
  outline: 1px solid var(--el-color-primary);
  outline-offset: 2px;
}

/* 暗色模式适配 */
:where(html.dark) .page-indicator {
  background-color: var(--color-white-10);
  border: var(--unified-border);
}

:where(html.dark) .indicator-dot {
  background-color: var(--el-text-color-regular);
}

:where(html.dark) .indicator-dot:hover,
:where(html.dark) .indicator-dot.active {
  background-color: var(--el-text-color-primary);
}

@media (width <= 768px) {
  .page-indicator {
    display: none;
  }
}
</style>
