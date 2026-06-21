/**
 * 流式处理工具
 * 提供流式内容的滚动和防抖功能
 */

import { ref } from 'vue'

/**
 * 使用智能滚动
 * 自动跟踪滚动位置并在新内容到达时决定是否滚动
 */
export function useSmartScroll(container?: HTMLElement, threshold?: number) {
  const scrollTop = ref(0)
  const isScrolling = ref(false)
  const isAtBottom = ref(true)
  let scrollTimeout: ReturnType<typeof setTimeout>

  const handleScroll = () => {
    const element = container || document.documentElement
    scrollTop.value = element.scrollTop
    isAtBottom.value = element.scrollHeight - element.scrollTop - element.clientHeight < (threshold || 50)
    isScrolling.value = true
    clearTimeout(scrollTimeout)
    scrollTimeout = setTimeout(() => {
      isScrolling.value = false
    }, 150)
  }

  const scrollToBottom = () => {
    const element = container || document.documentElement
    element.scrollTop = element.scrollHeight
  }

  const shouldAutoScroll = () => {
    return isAtBottom.value
  }

  // 如果传入了容器，添加滚动监听
  if (container) {
    container.addEventListener('scroll', handleScroll, { passive: true })
  }

  return {
    scrollTop,
    isScrolling,
    isAtBottom,
    handleScroll,
    scrollToBottom,
    shouldAutoScroll,
  }
}

/**
 * 防抖滚动
 * 延迟执行滚动操作
 */
export function debounceScroll(callback: () => void, delay = 100): () => void {
  let timeout: ReturnType<typeof setTimeout>
  return () => {
    clearTimeout(timeout)
    timeout = setTimeout(callback, delay)
  }
}

/**
 * 使用自动滚动
 * 在内容更新时自动滚动到底部
 */
export function useAutoScroll(options?: { threshold?: number }) {
  const { threshold = 100 } = options || {}
  const shouldAutoScroll = ref(true)

  const handleScroll = (container: HTMLElement) => {
    const { scrollTop, scrollHeight, clientHeight } = container
    const isNearBottom = scrollHeight - scrollTop - clientHeight < threshold
    shouldAutoScroll.value = isNearBottom
  }

  const scrollToBottom = (container: HTMLElement) => {
    if (shouldAutoScroll.value) {
      container.scrollTop = container.scrollHeight
    }
  }

  return {
    shouldAutoScroll,
    handleScroll,
    scrollToBottom,
  }
}
