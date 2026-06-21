import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useSmartScroll, debounceScroll, useAutoScroll } from '../streaming'

describe('streaming', () => {
  let container: HTMLElement

  beforeEach(() => {
    container = document.createElement('div')
    container.style.height = '100px'
    container.style.overflow = 'auto'
    document.body.appendChild(container)
  })

  afterEach(() => {
    document.body.removeChild(container)
    vi.clearAllMocks()
  })

  describe('useSmartScroll', () => {
    it('应该返回滚动状态', () => {
      const { scrollTop, isScrolling, isAtBottom } = useSmartScroll()

      expect(scrollTop.value).toBe(0)
      expect(isScrolling.value).toBe(false)
      expect(isAtBottom.value).toBe(true)
    })

    it('应该处理滚动事件', () => {
      const { handleScroll, scrollTop } = useSmartScroll()

      Object.defineProperty(document.documentElement, 'scrollTop', { value: 100, writable: true })
      Object.defineProperty(document.documentElement, 'scrollHeight', { value: 500, writable: true })
      Object.defineProperty(document.documentElement, 'clientHeight', { value: 400, writable: true })

      handleScroll()

      expect(scrollTop.value).toBe(100)
    })

    it('应该滚动到底部', () => {
      const { scrollToBottom } = useSmartScroll()

      Object.defineProperty(document.documentElement, 'scrollHeight', { value: 1000, writable: true })
      scrollToBottom()

      expect(document.documentElement.scrollTop).toBe(1000)
    })

    it('应该返回是否应该自动滚动', () => {
      const { shouldAutoScroll } = useSmartScroll()

      expect(shouldAutoScroll()).toBe(true)
    })

    it('应该使用自定义容器', () => {
      const mockAddEventListener = vi.fn()
      container.addEventListener = mockAddEventListener

      useSmartScroll(container)

      expect(mockAddEventListener).toHaveBeenCalledWith('scroll', expect.any(Function), { passive: true })
    })

    it('应该检测是否在底部', () => {
      const { handleScroll, isAtBottom } = useSmartScroll()

      Object.defineProperty(document.documentElement, 'scrollTop', { value: 450, writable: true })
      Object.defineProperty(document.documentElement, 'scrollHeight', { value: 500, writable: true })
      Object.defineProperty(document.documentElement, 'clientHeight', { value: 400, writable: true })

      handleScroll()

      expect(isAtBottom.value).toBe(true)
    })

    it('应该检测是否不在底部', () => {
      const { handleScroll, isAtBottom } = useSmartScroll()

      Object.defineProperty(document.documentElement, 'scrollTop', { value: 0, writable: true })
      Object.defineProperty(document.documentElement, 'scrollHeight', { value: 1000, writable: true })
      Object.defineProperty(document.documentElement, 'clientHeight', { value: 400, writable: true })

      handleScroll()

      expect(isAtBottom.value).toBe(false)
    })

    it('应该使用自定义阈值', () => {
      const { handleScroll, isAtBottom } = useSmartScroll(undefined, 100)

      Object.defineProperty(document.documentElement, 'scrollTop', { value: 350, writable: true })
      Object.defineProperty(document.documentElement, 'scrollHeight', { value: 500, writable: true })
      Object.defineProperty(document.documentElement, 'clientHeight', { value: 400, writable: true })

      handleScroll()

      expect(isAtBottom.value).toBe(true)
    })
  })

  describe('debounceScroll', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('应该防抖滚动回调', () => {
      const callback = vi.fn()
      const debounced = debounceScroll(callback, 100)

      debounced()
      debounced()
      debounced()

      expect(callback).not.toHaveBeenCalled()

      vi.advanceTimersByTime(100)

      expect(callback).toHaveBeenCalledTimes(1)
    })

    it('应该使用默认延迟', () => {
      const callback = vi.fn()
      const debounced = debounceScroll(callback)

      debounced()
      vi.advanceTimersByTime(100)

      expect(callback).toHaveBeenCalledTimes(1)
    })
  })

  describe('useAutoScroll', () => {
    it('应该返回自动滚动状态', () => {
      const { shouldAutoScroll } = useAutoScroll()

      expect(shouldAutoScroll.value).toBe(true)
    })

    it('应该处理滚动事件', () => {
      const { handleScroll, shouldAutoScroll } = useAutoScroll({ threshold: 100 })

      Object.defineProperty(container, 'scrollTop', { value: 850, writable: true })
      Object.defineProperty(container, 'scrollHeight', { value: 1000, writable: true })
      Object.defineProperty(container, 'clientHeight', { value: 100, writable: true })

      handleScroll(container)

      expect(shouldAutoScroll.value).toBe(true)
    })

    it('应该检测不在底部', () => {
      const { handleScroll, shouldAutoScroll } = useAutoScroll({ threshold: 100 })

      Object.defineProperty(container, 'scrollTop', { value: 0, writable: true })
      Object.defineProperty(container, 'scrollHeight', { value: 1000, writable: true })
      Object.defineProperty(container, 'clientHeight', { value: 100, writable: true })

      handleScroll(container)

      expect(shouldAutoScroll.value).toBe(false)
    })

    it('应该滚动到底部当shouldAutoScroll为true', () => {
      const { scrollToBottom, shouldAutoScroll } = useAutoScroll()

      shouldAutoScroll.value = true
      Object.defineProperty(container, 'scrollHeight', { value: 1000, writable: true })

      scrollToBottom(container)

      expect(container.scrollTop).toBe(1000)
    })

    it('应该不滚动当shouldAutoScroll为false', () => {
      const { scrollToBottom, shouldAutoScroll } = useAutoScroll()

      shouldAutoScroll.value = false
      Object.defineProperty(container, 'scrollHeight', { value: 1000, writable: true })

      scrollToBottom(container)

      expect(container.scrollTop).toBe(0)
    })

    it('应该使用自定义阈值', () => {
      const { handleScroll, shouldAutoScroll } = useAutoScroll({ threshold: 50 })

      Object.defineProperty(container, 'scrollTop', { value: 900, writable: true })
      Object.defineProperty(container, 'scrollHeight', { value: 1000, writable: true })
      Object.defineProperty(container, 'clientHeight', { value: 100, writable: true })

      handleScroll(container)

      expect(shouldAutoScroll.value).toBe(true)
    })
  })
})
