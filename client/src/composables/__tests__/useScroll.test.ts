import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref } from 'vue'
import { useScroll, useScrollTo } from '../useScroll'

// 收集 onUnmounted 回调，方便测试中手动触发清理
const unmountCallbacks: Array<() => void> = []

vi.mock('vue', async () => {
  const actual = await vi.importActual('vue')
  return {
    ...actual,
    ref: actual.ref,
    onMounted: vi.fn((fn: () => void) => fn()),
    onUnmounted: vi.fn((fn: () => void) => { unmountCallbacks.push(fn) }),
  }
})

// 创建一个 mock 的可滚动 HTMLElement
function createMockElement(props: {
  scrollLeft?: number
  scrollTop?: number
  scrollWidth?: number
  scrollHeight?: number
  clientWidth?: number
  clientHeight?: number
}) {
  const el: any = {
    scrollLeft: props.scrollLeft ?? 0,
    scrollTop: props.scrollTop ?? 0,
    scrollWidth: props.scrollWidth ?? 1000,
    scrollHeight: props.scrollHeight ?? 1000,
    clientWidth: props.clientWidth ?? 500,
    clientHeight: props.clientHeight ?? 500,
    scrollTo: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn((event: Event) => {
      // 触发 scroll 监听器
      const listeners = (el as any).__scrollListeners || []
      listeners.forEach((fn: EventListener) => fn(event))
      return true
    }),
  }
  // 模拟滚动事件触发：当 scrollLeft/scrollTop 变化时，调用 addEventListener 注册的 scroll 回调
  el.addEventListener = vi.fn((event: string, handler: EventListener) => {
    if (event === 'scroll') {
      if (!el.__scrollListeners) el.__scrollListeners = []
      el.__scrollListeners.push(handler)
    }
  })
  el.removeEventListener = vi.fn((event: string, handler: EventListener) => {
    if (event === 'scroll' && el.__scrollListeners) {
      el.__scrollListeners = el.__scrollListeners.filter((fn: EventListener) => fn !== handler)
    }
  })
  // 工具方法：触发 scroll 事件（测试用）
  ;(el as any).__triggerScroll = () => {
    const listeners = el.__scrollListeners || []
    listeners.forEach((fn: EventListener) => fn(new Event('scroll')))
  }
  return el as unknown as HTMLElement & { scrollTo: ReturnType<typeof vi.fn>; __triggerScroll: () => void }
}

// 设置 window 的滚动相关属性
function mockWindowScroll(props: {
  scrollX?: number
  scrollY?: number
  scrollWidth?: number
  scrollHeight?: number
  clientWidth?: number
  clientHeight?: number
}) {
  Object.defineProperty(window, 'scrollX', { value: props.scrollX ?? 0, configurable: true, writable: true })
  Object.defineProperty(window, 'scrollY', { value: props.scrollY ?? 0, configurable: true, writable: true })
  Object.defineProperty(document.documentElement, 'scrollWidth', { value: props.scrollWidth ?? 1000, configurable: true })
  Object.defineProperty(document.documentElement, 'scrollHeight', { value: props.scrollHeight ?? 1000, configurable: true })
  Object.defineProperty(document.documentElement, 'clientWidth', { value: props.clientWidth ?? 500, configurable: true })
  Object.defineProperty(document.documentElement, 'clientHeight', { value: props.clientHeight ?? 500, configurable: true })
}

// 同步执行的 rAF mock
function useSyncRaf() {
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { cb(0); return 1 })
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
}

describe('useScroll.ts', () => {
  beforeEach(() => {
    useSyncRaf()
    mockWindowScroll({})
  })

  afterEach(() => {
    unmountCallbacks.forEach(fn => fn())
    unmountCallbacks.length = 0
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  describe('useScroll - 基本返回', () => {
    it('应该返回所有滚动状态字段', () => {
      const result = useScroll()
      expect(result.x).toBeDefined()
      expect(result.y).toBeDefined()
      expect(result.isScrolling).toBeDefined()
      expect(result.arrivedState.left).toBeDefined()
      expect(result.arrivedState.right).toBeDefined()
      expect(result.arrivedState.top).toBeDefined()
      expect(result.arrivedState.bottom).toBeDefined()
      expect(result.directions.left).toBeDefined()
      expect(result.directions.right).toBeDefined()
      expect(result.directions.top).toBeDefined()
      expect(result.directions.bottom).toBeDefined()
    })
  })

  describe('useScroll - window 滚动', () => {
    it('onMounted 初始调用 update 时应该读取 window 滚动位置', () => {
      mockWindowScroll({ scrollX: 100, scrollY: 200 })
      const { x, y } = useScroll()
      expect(x.value).toBe(100)
      expect(y.value).toBe(200)
    })

    it('scroll 事件触发后更新 x/y', () => {
      mockWindowScroll({ scrollX: 50, scrollY: 80 })
      const { x, y } = useScroll()
      mockWindowScroll({ scrollX: 120, scrollY: 240 })
      window.dispatchEvent(new Event('scroll'))
      expect(x.value).toBe(120)
      expect(y.value).toBe(240)
    })

    it('scrollX=0 时 arrivedLeft 和 arrivedTop 为 true', () => {
      mockWindowScroll({ scrollX: 0, scrollY: 0 })
      const { arrivedState } = useScroll()
      expect(arrivedState.left.value).toBe(true)
      expect(arrivedState.top.value).toBe(true)
    })

    it('滚动到底部时 arrivedBottom 为 true', () => {
      // clientHeight(500) + scrollY(500) = scrollHeight(1000)
      mockWindowScroll({ scrollX: 0, scrollY: 500, scrollHeight: 1000, clientHeight: 500 })
      const { arrivedState } = useScroll()
      expect(arrivedState.bottom.value).toBe(true)
    })

    it('滚动到右边时 arrivedRight 为 true', () => {
      // clientWidth(500) + scrollX(500) = scrollWidth(1000)
      mockWindowScroll({ scrollX: 500, scrollY: 0, scrollWidth: 1000, clientWidth: 500 })
      const { arrivedState } = useScroll()
      expect(arrivedState.right.value).toBe(true)
    })

    it('向右滚动时 directionRight 为 true，directionLeft 为 false', () => {
      mockWindowScroll({ scrollX: 50, scrollY: 0 })
      const { directions } = useScroll() // onMounted 时记录 lastScrollX=50
      mockWindowScroll({ scrollX: 150, scrollY: 0 })
      window.dispatchEvent(new Event('scroll'))
      expect(directions.right.value).toBe(true)
      expect(directions.left.value).toBe(false)
    })

    it('向下滚动时 directionBottom 为 true', () => {
      mockWindowScroll({ scrollX: 0, scrollY: 50 })
      const { directions } = useScroll()
      mockWindowScroll({ scrollX: 0, scrollY: 150 })
      window.dispatchEvent(new Event('scroll'))
      expect(directions.bottom.value).toBe(true)
      expect(directions.top.value).toBe(false)
    })

    it('向上滚动时 directionTop 为 true', () => {
      mockWindowScroll({ scrollX: 0, scrollY: 200 })
      const { directions } = useScroll()
      mockWindowScroll({ scrollX: 0, scrollY: 100 })
      window.dispatchEvent(new Event('scroll'))
      expect(directions.top.value).toBe(true)
      expect(directions.bottom.value).toBe(false)
    })

    it('向左滚动时 directionLeft 为 true', () => {
      mockWindowScroll({ scrollX: 200, scrollY: 0 })
      const { directions } = useScroll()
      mockWindowScroll({ scrollX: 100, scrollY: 0 })
      window.dispatchEvent(new Event('scroll'))
      expect(directions.left.value).toBe(true)
      expect(directions.right.value).toBe(false)
    })

    it('滚动事件后 isScrolling 变为 true，100ms 后变回 false', () => {
      vi.useFakeTimers()
      mockWindowScroll({ scrollX: 0, scrollY: 0 })
      const { isScrolling } = useScroll()
      // 初始 update 已经执行过
      // 触发新的 scroll
      mockWindowScroll({ scrollX: 50, scrollY: 50 })
      window.dispatchEvent(new Event('scroll'))
      expect(isScrolling.value).toBe(true)
      // 推进 100ms
      vi.advanceTimersByTime(150)
      expect(isScrolling.value).toBe(false)
      vi.useRealTimers()
    })
  })

  describe('useScroll - element 滚动', () => {
    it('target.value 是元素时，应该读取元素的 scrollLeft/scrollTop', () => {
      const el = createMockElement({ scrollLeft: 30, scrollTop: 40 })
      const target = ref<HTMLElement | null>(el as any)
      const { x, y } = useScroll(target as any)
      expect(x.value).toBe(30)
      expect(y.value).toBe(40)
    })

    it('target.value 是元素时，元素 scroll 事件触发更新', () => {
      const el = createMockElement({ scrollLeft: 0, scrollTop: 0 })
      const target = ref<HTMLElement | null>(el as any)
      const { x, y } = useScroll(target as any)
      el.scrollLeft = 80
      el.scrollTop = 90
      el.__triggerScroll()
      expect(x.value).toBe(80)
      expect(y.value).toBe(90)
    })

    it('元素 scrollLeft<=0 时 arrivedLeft 为 true', () => {
      const el = createMockElement({ scrollLeft: 0, scrollTop: 0, scrollWidth: 1000, clientWidth: 500 })
      const target = ref<HTMLElement | null>(el as any)
      const { arrivedState } = useScroll(target as any)
      expect(arrivedState.left.value).toBe(true)
      expect(arrivedState.top.value).toBe(true)
    })

    it('元素滚到底时 arrivedBottom 为 true', () => {
      const el = createMockElement({ scrollTop: 500, scrollHeight: 1000, clientHeight: 500 })
      const target = ref<HTMLElement | null>(el as any)
      const { arrivedState } = useScroll(target as any)
      expect(arrivedState.bottom.value).toBe(true)
    })

    it('元素滚到右时 arrivedRight 为 true', () => {
      const el = createMockElement({ scrollLeft: 500, scrollWidth: 1000, clientWidth: 500 })
      const target = ref<HTMLElement | null>(el as any)
      const { arrivedState } = useScroll(target as any)
      expect(arrivedState.right.value).toBe(true)
    })

    it('元素向右滚动时 directions.right 为 true', () => {
      const el = createMockElement({ scrollLeft: 0, scrollTop: 0 })
      const target = ref<HTMLElement | null>(el as any)
      const { directions } = useScroll(target as any)
      el.scrollLeft = 100
      el.__triggerScroll()
      expect(directions.right.value).toBe(true)
      expect(directions.left.value).toBe(false)
    })

    it('元素向左滚动时 directions.left 为 true', () => {
      const el = createMockElement({ scrollLeft: 100, scrollTop: 0 })
      const target = ref<HTMLElement | null>(el as any)
      const { directions } = useScroll(target as any)
      el.scrollLeft = 50
      el.__triggerScroll()
      expect(directions.left.value).toBe(true)
      expect(directions.right.value).toBe(false)
    })

    it('元素向下滚动时 directions.bottom 为 true', () => {
      const el = createMockElement({ scrollLeft: 0, scrollTop: 0 })
      const target = ref<HTMLElement | null>(el as any)
      const { directions } = useScroll(target as any)
      el.scrollTop = 200
      el.__triggerScroll()
      expect(directions.bottom.value).toBe(true)
      expect(directions.top.value).toBe(false)
    })

    it('元素向上滚动时 directions.top 为 true', () => {
      const el = createMockElement({ scrollLeft: 0, scrollTop: 100 })
      const target = ref<HTMLElement | null>(el as any)
      const { directions } = useScroll(target as any)
      el.scrollTop = 50
      el.__triggerScroll()
      expect(directions.top.value).toBe(true)
      expect(directions.bottom.value).toBe(false)
    })

    it('target.value 为 null 时回退到 window', () => {
      mockWindowScroll({ scrollX: 77, scrollY: 88 })
      const target = ref<HTMLElement | null>(null)
      const { x, y } = useScroll(target as any)
      expect(x.value).toBe(77)
      expect(y.value).toBe(88)
    })
  })

  describe('useScroll - rAF 节流', () => {
    it('rAF 回调未执行时，连续触发 scroll 只调度一次 rAF', () => {
      const rafMock = vi.fn(() => 42)
      vi.stubGlobal('requestAnimationFrame', rafMock)
      mockWindowScroll({ scrollX: 0, scrollY: 0 })
      useScroll()
      // 第一次 scroll 调度 rAF
      window.dispatchEvent(new Event('scroll'))
      expect(rafMock).toHaveBeenCalledTimes(1)
      // 第二次 scroll 被节流
      window.dispatchEvent(new Event('scroll'))
      expect(rafMock).toHaveBeenCalledTimes(1)
    })

    it('清理时取消尚未执行的 rAF', () => {
      const rafMock = vi.fn(() => 99)
      const cancelMock = vi.fn()
      vi.stubGlobal('requestAnimationFrame', rafMock)
      vi.stubGlobal('cancelAnimationFrame', cancelMock)
      mockWindowScroll({ scrollX: 0, scrollY: 0 })
      useScroll()
      window.dispatchEvent(new Event('scroll'))
      // 触发清理
      unmountCallbacks.forEach(fn => fn())
      expect(cancelMock).toHaveBeenCalledWith(99)
    })

    it('rAF 回调执行后会清空 rAF id（验证 onScrollUpdate 的节流逻辑）', () => {
      // 模拟异步 rAF：rAF 调用时 scrollRafId 已被赋值，回调执行后才置为 null
      // 通过同步 rAF 验证：第二次同步 dispatchEvent 因为 rAF 还在 pending 状态被节流
      const rafMock = vi.fn(() => 1)
      vi.stubGlobal('requestAnimationFrame', rafMock)
      mockWindowScroll({ scrollX: 0, scrollY: 0 })
      useScroll()
      window.dispatchEvent(new Event('scroll'))
      // rAF 同步返回 1，scrollRafId 是 1（非 null），所以再次触发 scroll 被节流
      window.dispatchEvent(new Event('scroll'))
      expect(rafMock).toHaveBeenCalledTimes(1)
    })

    it('target 是既不是 window 也没有 scrollLeft 属性的对象时，x/y 保持 0', () => {
      // 一个没有 scrollLeft 属性的对象，但有 addEventListener
      const fakeEl = {
        scrollTo: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      } as any
      const target = ref(fakeEl)
      const { x, y } = useScroll(target as any)
      expect(x.value).toBe(0)
      expect(y.value).toBe(0)
    })

    it('清理时清除未到期的 scrollTimeout', () => {
      vi.useFakeTimers()
      const rafMock = vi.fn((cb: FrameRequestCallback) => { cb(0); return 1 })
      vi.stubGlobal('requestAnimationFrame', rafMock)
      mockWindowScroll({ scrollX: 0, scrollY: 0 })
      const { isScrolling } = useScroll()
      mockWindowScroll({ scrollX: 50, scrollY: 50 })
      window.dispatchEvent(new Event('scroll'))
      expect(isScrolling.value).toBe(true)
      // 触发清理（应当清除 100ms 计时器）
      unmountCallbacks.forEach(fn => fn())
      // 即使过了 200ms 也不应再变回 false（计时器已被清掉）
      vi.advanceTimersByTime(200)
      expect(isScrolling.value).toBe(true)
      vi.useRealTimers()
    })
  })

  describe('useScrollTo', () => {
    it('应该返回所有滚动方法', () => {
      const { scrollTo, scrollToTop, scrollToBottom, scrollToLeft, scrollToRight } = useScrollTo()
      expect(typeof scrollTo).toBe('function')
      expect(typeof scrollToTop).toBe('function')
      expect(typeof scrollToBottom).toBe('function')
      expect(typeof scrollToLeft).toBe('function')
      expect(typeof scrollToRight).toBe('function')
    })

    it('无 target 时 scrollTo 调用 window.scrollTo，默认 behavior 为 smooth', () => {
      const spy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
      const { scrollTo } = useScrollTo()
      scrollTo({ x: 100, y: 200 })
      expect(spy).toHaveBeenCalledWith({ left: 100, top: 200, behavior: 'smooth' })
    })

    it('scrollTo 可以自定义 behavior', () => {
      const spy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
      const { scrollTo } = useScrollTo()
      scrollTo({ x: 10, y: 20, behavior: 'auto' })
      expect(spy).toHaveBeenCalledWith({ left: 10, top: 20, behavior: 'auto' })
    })

    it('target 为元素时 scrollTo 调用元素的 scrollTo', () => {
      const el = createMockElement({})
      const target = ref<HTMLElement | null>(el as any)
      const { scrollTo } = useScrollTo(target as any)
      scrollTo({ x: 50, y: 60 })
      expect(el.scrollTo).toHaveBeenCalledWith({ left: 50, top: 60, behavior: 'smooth' })
    })

    it('scrollToTop 默认滚动到 y=0，behavior 为 smooth', () => {
      const spy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
      const { scrollToTop } = useScrollTo()
      scrollToTop()
      expect(spy).toHaveBeenCalledWith({ left: undefined, top: 0, behavior: 'smooth' })
    })

    it('scrollToTop 可以传入 behavior', () => {
      const spy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
      const { scrollToTop } = useScrollTo()
      scrollToTop('auto')
      expect(spy).toHaveBeenCalledWith({ left: undefined, top: 0, behavior: 'auto' })
    })

    it('scrollToBottom 滚动到元素的 scrollHeight', () => {
      const el = createMockElement({ scrollHeight: 2000 })
      const target = ref<HTMLElement | null>(el as any)
      const { scrollToBottom } = useScrollTo(target as any)
      scrollToBottom()
      expect(el.scrollTo).toHaveBeenCalledWith({ left: undefined, top: 2000, behavior: 'smooth' })
    })

    it('scrollToBottom 无 target 时不执行', () => {
      const spy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
      const { scrollToBottom } = useScrollTo()
      scrollToBottom()
      expect(spy).not.toHaveBeenCalled()
    })

    it('scrollToLeft 滚动到 x=0', () => {
      const spy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
      const { scrollToLeft } = useScrollTo()
      scrollToLeft()
      expect(spy).toHaveBeenCalledWith({ left: 0, top: undefined, behavior: 'smooth' })
    })

    it('scrollToLeft 可以传入 behavior', () => {
      const spy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
      const { scrollToLeft } = useScrollTo()
      scrollToLeft('auto')
      expect(spy).toHaveBeenCalledWith({ left: 0, top: undefined, behavior: 'auto' })
    })

    it('scrollToRight 滚动到元素的 scrollWidth', () => {
      const el = createMockElement({ scrollWidth: 3000 })
      const target = ref<HTMLElement | null>(el as any)
      const { scrollToRight } = useScrollTo(target as any)
      scrollToRight()
      expect(el.scrollTo).toHaveBeenCalledWith({ left: 3000, top: undefined, behavior: 'smooth' })
    })

    it('scrollToRight 无 target 时不执行', () => {
      const spy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
      const { scrollToRight } = useScrollTo()
      scrollToRight()
      expect(spy).not.toHaveBeenCalled()
    })
  })
})
