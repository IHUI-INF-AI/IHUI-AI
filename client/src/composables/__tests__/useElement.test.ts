import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref, nextTick } from 'vue'
import { useElementSize, useElementBounding, useElementVisibility } from '../useElement'

// 收集 onUnmounted 回调，测试中手动触发清理
const unmountCallbacks: Array<() => void> = []

// ============ Mock ResizeObserver ============
let resizeCallback: (() => void) | null = null
let observedResizeElements: HTMLElement[] = []
class MockResizeObserver {
  cb: () => void
  constructor(cb: () => void) {
    this.cb = cb
    resizeCallback = cb
  }
  observe(el: HTMLElement) { observedResizeElements.push(el) }
  disconnect() { resizeCallback = null; observedResizeElements = [] }
  unobserve() {}
}

// ============ Mock IntersectionObserver ============
let intersectionCallback: ((entries: Array<{ isIntersecting: boolean }>) => void) | null = null
let observedIntersectionElements: HTMLElement[] = []
class MockIntersectionObserver {
  cb: (entries: Array<{ isIntersecting: boolean }>) => void
  constructor(cb: (entries: Array<{ isIntersecting: boolean }>) => void) {
    this.cb = cb
    intersectionCallback = cb
  }
  observe(el: HTMLElement) { observedIntersectionElements.push(el) }
  disconnect() { intersectionCallback = null; observedIntersectionElements = [] }
  unobserve() {}
  takeRecords() { return [] }
}

vi.mock('vue', async () => {
  const actual = await vi.importActual('vue')
  return {
    ...actual,
    // 使用真实 watch，让 target 变化能触发回调
    watch: actual.watch,
    // onMounted 立即调用，便于同步测试
    onMounted: vi.fn((fn: () => void) => fn()),
    // onUnmounted 收集到 unmountCallbacks，测试中手动触发
    onUnmounted: vi.fn((fn: () => void) => { unmountCallbacks.push(fn) }),
  }
})

// 保存原始 rAF / cancelRaf
const originalRaf = window.requestAnimationFrame.bind(window)
const originalCancelRaf = window.cancelAnimationFrame.bind(window)

describe('useElement.ts', () => {
  beforeEach(() => {
    unmountCallbacks.length = 0
    resizeCallback = null
    observedResizeElements = []
    intersectionCallback = null
    observedIntersectionElements = []
    // 在每个测试前注入全局 Observer（jsdom 中不存在）
    ;(globalThis as { ResizeObserver?: unknown }).ResizeObserver = MockResizeObserver
    ;(globalThis as { IntersectionObserver?: unknown }).IntersectionObserver = MockIntersectionObserver
    // 默认 rAF 同步执行
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { cb(0); return 0 })
    vi.stubGlobal('cancelAnimationFrame', () => {})
  })

  afterEach(() => {
    // 手动触发所有 onUnmounted，清理监听器
    unmountCallbacks.forEach(fn => fn())
    vi.unstubAllGlobals()
    delete (globalThis as { ResizeObserver?: unknown }).ResizeObserver
    delete (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver
    window.requestAnimationFrame = originalRaf
    window.cancelAnimationFrame = originalCancelRaf
  })

  // ============ useElementSize ============
  describe('useElementSize', () => {
    it('应该返回 width 和 height ref', () => {
      const target = ref<HTMLElement | null>(null)
      const { width, height } = useElementSize(target)
      expect(width.value).toBeDefined()
      expect(height.value).toBeDefined()
    })

    it('target 为元素时应读取 offsetWidth 和 offsetHeight', () => {
      const el = document.createElement('div')
      Object.defineProperty(el, 'offsetWidth', { value: 120, configurable: true })
      Object.defineProperty(el, 'offsetHeight', { value: 80, configurable: true })
      const target = ref<HTMLElement | null>(el)
      const { width, height } = useElementSize(target)
      expect(width.value).toBe(120)
      expect(height.value).toBe(80)
    })

    it('应该创建 ResizeObserver 并观察元素', () => {
      const el = document.createElement('div')
      const target = ref<HTMLElement | null>(el)
      useElementSize(target)
      expect(resizeCallback).not.toBeNull()
      expect(observedResizeElements).toContain(el)
    })

    it('ResizeObserver 回调触发时应更新尺寸', () => {
      const el = document.createElement('div')
      Object.defineProperty(el, 'offsetWidth', { value: 100, configurable: true })
      Object.defineProperty(el, 'offsetHeight', { value: 200, configurable: true })
      const target = ref<HTMLElement | null>(el)
      const { width, height } = useElementSize(target)
      // 模拟尺寸变化
      Object.defineProperty(el, 'offsetWidth', { value: 300, configurable: true })
      Object.defineProperty(el, 'offsetHeight', { value: 400, configurable: true })
      resizeCallback!()
      expect(width.value).toBe(300)
      expect(height.value).toBe(400)
    })

    it('target 变化为新元素时应观察新元素', async () => {
      const el1 = document.createElement('div')
      const el2 = document.createElement('div')
      const target = ref<HTMLElement | null>(el1)
      useElementSize(target)
      target.value = el2
      await nextTick()
      expect(observedResizeElements).toContain(el2)
    })

    it('target 变为 null 时应停止观察', async () => {
      const el = document.createElement('div')
      const target = ref<HTMLElement | null>(el)
      useElementSize(target)
      expect(resizeCallback).not.toBeNull()
      target.value = null
      await nextTick()
      expect(resizeCallback).toBeNull()
    })

    it('组件卸载时应停止观察', () => {
      const el = document.createElement('div')
      const target = ref<HTMLElement | null>(el)
      useElementSize(target)
      expect(resizeCallback).not.toBeNull()
      unmountCallbacks.forEach(fn => fn())
      expect(resizeCallback).toBeNull()
    })

    it('ResizeObserver 不存在时应优雅跳过观察', () => {
      const original = (globalThis as { ResizeObserver?: unknown }).ResizeObserver
      // @ts-expect-error 测试需要移除
      delete (globalThis as { ResizeObserver?: unknown }).ResizeObserver
      const el = document.createElement('div')
      const target = ref<HTMLElement | null>(el)
      expect(() => useElementSize(target)).not.toThrow()
      ;(globalThis as { ResizeObserver?: unknown }).ResizeObserver = original
    })
  })

  // ============ useElementBounding ============
  describe('useElementBounding', () => {
    it('应该返回所有 8 个边界 ref', () => {
      const target = ref<HTMLElement | null>(null)
      const r = useElementBounding(target)
      expect(r.left).toBeDefined()
      expect(r.top).toBeDefined()
      expect(r.right).toBeDefined()
      expect(r.bottom).toBeDefined()
      expect(r.width).toBeDefined()
      expect(r.height).toBeDefined()
      expect(r.x).toBeDefined()
      expect(r.y).toBeDefined()
    })

    it('target 为元素时应更新所有 8 个边界值', () => {
      const el = {
        getBoundingClientRect: () => ({
          left: 10, top: 20, right: 110, bottom: 220,
          width: 100, height: 200, x: 10, y: 20,
        }),
      } as unknown as HTMLElement
      const target = ref<HTMLElement | null>(el)
      const r = useElementBounding(target)
      expect(r.left.value).toBe(10)
      expect(r.top.value).toBe(20)
      expect(r.right.value).toBe(110)
      expect(r.bottom.value).toBe(220)
      expect(r.width.value).toBe(100)
      expect(r.height.value).toBe(200)
      expect(r.x.value).toBe(10)
      expect(r.y.value).toBe(20)
    })

    it('target 为 null 时不更新值（保持 0）', () => {
      const target = ref<HTMLElement | null>(null)
      const r = useElementBounding(target)
      expect(r.left.value).toBe(0)
      expect(r.top.value).toBe(0)
      expect(r.right.value).toBe(0)
      expect(r.bottom.value).toBe(0)
    })

    it('resize 事件触发时应该更新位置', () => {
      const el = {
        getBoundingClientRect: () => ({
          left: 0, top: 0, right: 0, bottom: 0,
          width: 0, height: 0, x: 0, y: 0,
        }),
      } as unknown as HTMLElement
      const target = ref<HTMLElement | null>(el)
      const r = useElementBounding(target)
      el.getBoundingClientRect = () => ({
        left: 50, top: 60, right: 70, bottom: 80,
        width: 90, height: 100, x: 110, y: 120,
      })
      window.dispatchEvent(new Event('resize'))
      expect(r.left.value).toBe(50)
      expect(r.top.value).toBe(60)
      expect(r.right.value).toBe(70)
      expect(r.bottom.value).toBe(80)
      expect(r.width.value).toBe(90)
      expect(r.height.value).toBe(100)
      expect(r.x.value).toBe(110)
      expect(r.y.value).toBe(120)
    })

    it('scroll 事件触发时应该更新位置', () => {
      const el = {
        getBoundingClientRect: () => ({
          left: 0, top: 0, right: 0, bottom: 0,
          width: 0, height: 0, x: 0, y: 0,
        }),
      } as unknown as HTMLElement
      const target = ref<HTMLElement | null>(el)
      const r = useElementBounding(target)
      el.getBoundingClientRect = () => ({
        left: 11, top: 22, right: 33, bottom: 44,
        width: 55, height: 66, x: 77, y: 88,
      })
      window.dispatchEvent(new Event('scroll'))
      expect(r.left.value).toBe(11)
    })

    it('rAF 期间应该节流，不重复调度', () => {
      const rafMock = vi.fn(() => 1)
      vi.stubGlobal('requestAnimationFrame', rafMock)
      const el = {
        getBoundingClientRect: () => ({
          left: 0, top: 0, right: 0, bottom: 0,
          width: 0, height: 0, x: 0, y: 0,
        }),
      } as unknown as HTMLElement
      const target = ref<HTMLElement | null>(el)
      useElementBounding(target)
      window.dispatchEvent(new Event('resize'))
      expect(rafMock).toHaveBeenCalledTimes(1)
      // 再次触发应被节流
      window.dispatchEvent(new Event('resize'))
      expect(rafMock).toHaveBeenCalledTimes(1)
    })

    it('组件卸载时应该取消未完成的 rAF', () => {
      vi.stubGlobal('requestAnimationFrame', vi.fn(() => 42))
      const cancelMock = vi.fn(() => {})
      vi.stubGlobal('cancelAnimationFrame', cancelMock)
      const el = {
        getBoundingClientRect: () => ({
          left: 0, top: 0, right: 0, bottom: 0,
          width: 0, height: 0, x: 0, y: 0,
        }),
      } as unknown as HTMLElement
      const target = ref<HTMLElement | null>(el)
      useElementBounding(target)
      window.dispatchEvent(new Event('resize'))
      expect(cancelMock).not.toHaveBeenCalled()
      unmountCallbacks.forEach(fn => fn())
      expect(cancelMock).toHaveBeenCalledWith(42)
    })
  })

  // ============ useElementVisibility ============
  describe('useElementVisibility', () => {
    it('应该返回 isVisible ref（初始为 false）', () => {
      const target = ref<HTMLElement | null>(null)
      const isVisible = useElementVisibility(target)
      expect(isVisible.value).toBe(false)
    })

    it('应该创建 IntersectionObserver 并观察元素', () => {
      const el = document.createElement('div')
      const target = ref<HTMLElement | null>(el)
      useElementVisibility(target)
      expect(intersectionCallback).not.toBeNull()
      expect(observedIntersectionElements).toContain(el)
    })

    it('intersection 回调 isIntersecting=true 时应更新可见性为 true', () => {
      const el = document.createElement('div')
      const target = ref<HTMLElement | null>(el)
      const isVisible = useElementVisibility(target)
      intersectionCallback!([{ isIntersecting: true }])
      expect(isVisible.value).toBe(true)
    })

    it('intersection 回调 isIntersecting=false 时应更新可见性为 false', () => {
      const el = document.createElement('div')
      const target = ref<HTMLElement | null>(el)
      const isVisible = useElementVisibility(target)
      intersectionCallback!([{ isIntersecting: true }])
      expect(isVisible.value).toBe(true)
      intersectionCallback!([{ isIntersecting: false }])
      expect(isVisible.value).toBe(false)
    })

    it('target 变化为新元素时应观察新元素', async () => {
      const el1 = document.createElement('div')
      const el2 = document.createElement('div')
      const target = ref<HTMLElement | null>(el1)
      useElementVisibility(target)
      target.value = el2
      await nextTick()
      expect(observedIntersectionElements).toContain(el2)
    })

    it('target 变为 null 时应停止观察', async () => {
      const el = document.createElement('div')
      const target = ref<HTMLElement | null>(el)
      useElementVisibility(target)
      expect(intersectionCallback).not.toBeNull()
      target.value = null
      await nextTick()
      expect(intersectionCallback).toBeNull()
    })

    it('组件卸载时应停止观察', () => {
      const el = document.createElement('div')
      const target = ref<HTMLElement | null>(el)
      useElementVisibility(target)
      expect(intersectionCallback).not.toBeNull()
      unmountCallbacks.forEach(fn => fn())
      expect(intersectionCallback).toBeNull()
    })

    it('IntersectionObserver 不存在时应优雅跳过观察', () => {
      const original = (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver
      // @ts-expect-error 测试需要移除
      delete (globalThis as { IntersectionObserver?: unknown }).IntersectionObserver
      const el = document.createElement('div')
      const target = ref<HTMLElement | null>(el)
      expect(() => useElementVisibility(target)).not.toThrow()
      ;(globalThis as { IntersectionObserver?: unknown }).IntersectionObserver = original
    })
  })
})
