import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  lazyLoadImages,
  preloadCriticalResources,
  useIdle,
  monitorTasks,
  requestDeduplicator,
  debounce,
  throttle,
  initOptimization,
  useOptimization,
} from '../optimization'

vi.mock('../logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}))

vi.mock('../format', () => ({
  debounce: vi.fn((fn) => fn),
  throttle: vi.fn((fn) => fn),
}))

describe('optimization', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
    document.body.innerHTML = ''
  })

  describe('lazyLoadImages', () => {
    it('应该在不支持IntersectionObserver时不报错', () => {
      delete (window as unknown as Record<string, unknown>).IntersectionObserver
      expect(() => lazyLoadImages()).not.toThrow()
    })

    it('应该跳过当没有lazy图片', () => {
      const mockObserve = vi.fn()
      class MockIntersectionObserver {
        observe = mockObserve
        unobserve = vi.fn()
        disconnect = vi.fn()
      }
      window.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver

      document.body.innerHTML = '<img src="test.jpg" />'
      lazyLoadImages()

      expect(mockObserve).not.toHaveBeenCalled()
    })

    it('应该观察lazy图片', () => {
      const mockObserve = vi.fn()
      class MockIntersectionObserver {
        observe = mockObserve
        unobserve = vi.fn()
        disconnect = vi.fn()
      }
      window.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver

      document.body.innerHTML = '<img class="lazy" data-src="test.jpg" />'
      lazyLoadImages()

      expect(mockObserve).toHaveBeenCalled()
    })

    it('应该加载可见的lazy图片', () => {
      let observerCallback: (entries: { isIntersecting: boolean; target: HTMLImageElement }[], observer: { disconnect: () => void; unobserve: () => void }) => void
      const mockUnobserve = vi.fn()
      const mockDisconnect = vi.fn()

      class MockIntersectionObserver {
        observe = vi.fn()
        unobserve = mockUnobserve
        disconnect = mockDisconnect
        constructor(cb: (entries: { isIntersecting: boolean; target: HTMLImageElement }[], observer: { disconnect: () => void; unobserve: () => void }) => void) {
          observerCallback = cb
        }
      }
      window.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver

      document.body.innerHTML = '<img class="lazy" data-src="loaded.jpg" src="placeholder.jpg" />'
      lazyLoadImages()

      const img = document.querySelector('img') as HTMLImageElement
      const mockObserver = { disconnect: mockDisconnect, unobserve: mockUnobserve }
      observerCallback!([{ isIntersecting: true, target: img }], mockObserver)

      expect(img.src).toContain('loaded.jpg')
      expect(mockUnobserve).toHaveBeenCalled()
    })

    it('应该不移除不可见图片的lazy类', () => {
      let observerCallback: (entries: { isIntersecting: boolean; target: HTMLImageElement }[], observer: { disconnect: () => void; unobserve: () => void }) => void

      class MockIntersectionObserver {
        observe = vi.fn()
        unobserve = vi.fn()
        disconnect = vi.fn()
        constructor(cb: (entries: { isIntersecting: boolean; target: HTMLImageElement }[], observer: { disconnect: () => void; unobserve: () => void }) => void) {
          observerCallback = cb
        }
      }
      window.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver

      document.body.innerHTML = '<img class="lazy" data-src="loaded.jpg" src="placeholder.jpg" />'
      lazyLoadImages()

      const img = document.querySelector('img') as HTMLImageElement
      const mockObserver = { disconnect: vi.fn(), unobserve: vi.fn() }
      observerCallback!([{ isIntersecting: false, target: img }], mockObserver)

      expect(img.classList.contains('lazy')).toBe(true)
    })
  })

  describe('preloadCriticalResources', () => {
    it('应该预加载CSS资源', () => {
      const links: HTMLLinkElement[] = []
      document.head.appendChild = vi.fn((link) => {
        links.push(link as HTMLLinkElement)
        return link
      }) as unknown as typeof document.head.appendChild

      preloadCriticalResources(['test.css'])

      expect(links.length).toBe(1)
      expect(links[0].rel).toBe('preload')
      expect(links[0].as).toBe('style')
    })

    it('应该预加载JS资源', () => {
      const links: HTMLLinkElement[] = []
      document.head.appendChild = vi.fn((link) => {
        links.push(link as HTMLLinkElement)
        return link
      }) as unknown as typeof document.head.appendChild

      preloadCriticalResources(['test.js'])

      expect(links.length).toBe(1)
      expect(links[0].as).toBe('script')
    })
  })

  describe('useIdle', () => {
    it('应该使用requestIdleCallback当可用', () => {
      const callback = vi.fn()
      window.requestIdleCallback = vi.fn((cb) => {
        cb({} as IdleDeadline)
        return 1
      })

      useIdle(callback)

      expect(window.requestIdleCallback).toHaveBeenCalled()
    })

    it('应该使用setTimeout作为降级', () => {
      delete (window as unknown as Record<string, unknown>).requestIdleCallback
      const callback = vi.fn()

      useIdle(callback, 500)

      expect(callback).not.toHaveBeenCalled()
      vi.advanceTimersByTime(500)
      expect(callback).toHaveBeenCalled()
    })
  })

  describe('monitorTasks', () => {
    it('应该在不支持PerformanceObserver时不报错', () => {
      delete (window as unknown as Record<string, unknown>).PerformanceObserver
      expect(() => monitorTasks()).not.toThrow()
    })

    it('应该支持延迟启动监控', () => {
      class MockPerformanceObserver {
        observe = vi.fn()
        disconnect = vi.fn()
      }
      window.PerformanceObserver = MockPerformanceObserver as unknown as typeof PerformanceObserver

      monitorTasks(undefined, { delay: 1000 })

      vi.advanceTimersByTime(1000)
    })

    it('应该捕获PerformanceObserver错误', () => {
      class MockPerformanceObserver {
        observe = vi.fn(() => {
          throw new Error('Not supported')
        })
        disconnect = vi.fn()
      }
      window.PerformanceObserver = MockPerformanceObserver as unknown as typeof PerformanceObserver

      expect(() => monitorTasks()).not.toThrow()
    })

    it('应该调用回调当检测到长任务', () => {
      const callback = vi.fn()
      let observerCallback: (list: { getEntries: () => { duration: number }[] }) => void

      class MockPerformanceObserver {
        observe = vi.fn()
        disconnect = vi.fn()
        constructor(cb: (list: { getEntries: () => { duration: number }[] }) => void) {
          observerCallback = cb
        }
      }
      window.PerformanceObserver = MockPerformanceObserver as unknown as typeof PerformanceObserver

      monitorTasks(callback, { threshold: 50 })

      observerCallback!({ getEntries: () => [{ duration: 100 }] })
      expect(callback).toHaveBeenCalledWith(100)
    })

    it('应该不调用回调当任务时长低于阈值', () => {
      const callback = vi.fn()
      let observerCallback: (list: { getEntries: () => { duration: number }[] }) => void

      class MockPerformanceObserver {
        observe = vi.fn()
        disconnect = vi.fn()
        constructor(cb: (list: { getEntries: () => { duration: number }[] }) => void) {
          observerCallback = cb
        }
      }
      window.PerformanceObserver = MockPerformanceObserver as unknown as typeof PerformanceObserver

      monitorTasks(callback, { threshold: 100 })

      observerCallback!({ getEntries: () => [{ duration: 50 }] })
      expect(callback).not.toHaveBeenCalled()
    })

    it('应该记录警告当没有回调', () => {
      let observerCallback: (list: { getEntries: () => { duration: number }[] }) => void

      class MockPerformanceObserver {
        observe = vi.fn()
        disconnect = vi.fn()
        constructor(cb: (list: { getEntries: () => { duration: number }[] }) => void) {
          observerCallback = cb
        }
      }
      window.PerformanceObserver = MockPerformanceObserver as unknown as typeof PerformanceObserver

      monitorTasks(undefined, { threshold: 50 })

      observerCallback!({ getEntries: () => [{ duration: 100 }] })
    })
  })

  describe('requestDeduplicator', () => {
    it('应该去重相同的请求', async () => {
      const fn = vi.fn().mockResolvedValue('result')
      const deduplicatedFn = requestDeduplicator(fn)

      const promise1 = deduplicatedFn('arg1')
      const promise2 = deduplicatedFn('arg1')

      expect(fn).toHaveBeenCalledTimes(1)
      expect(promise1).toBe(promise2)

      const result = await promise1
      expect(result).toBe('result')
    })

    it('应该允许不同参数的请求', async () => {
      const fn = vi.fn().mockResolvedValue('result')
      const deduplicatedFn = requestDeduplicator(fn)

      const promise1 = deduplicatedFn('arg1')
      const promise2 = deduplicatedFn('arg2')

      expect(fn).toHaveBeenCalledTimes(2)

      await Promise.all([promise1, promise2])
    })

    it('应该支持自定义key生成器', async () => {
      const fn = vi.fn().mockResolvedValue('result')
      const keyGenerator = vi.fn().mockReturnValue('custom-key')
      const deduplicatedFn = requestDeduplicator(fn, keyGenerator)

      const promise1 = deduplicatedFn('arg1')
      const promise2 = deduplicatedFn('arg2')

      expect(keyGenerator).toHaveBeenCalledTimes(2)
      expect(fn).toHaveBeenCalledTimes(1)

      await promise1
    })

    it('应该清除已完成的请求', async () => {
      const fn = vi.fn().mockResolvedValue('result')
      const deduplicatedFn = requestDeduplicator(fn)

      await deduplicatedFn('arg1')
      await deduplicatedFn('arg1')

      expect(fn).toHaveBeenCalledTimes(2)
    })

    it('应该处理请求失败', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('failed'))
      const deduplicatedFn = requestDeduplicator(fn)

      await expect(deduplicatedFn('arg1')).rejects.toThrow('failed')

      await expect(deduplicatedFn('arg1')).rejects.toThrow('failed')

      expect(fn).toHaveBeenCalledTimes(2)
    })
  })

  describe('debounce', () => {
    it('应该返回防抖函数', () => {
      const fn = vi.fn()
      const debounced = debounce(fn, 100)
      expect(typeof debounced).toBe('function')
    })
  })

  describe('throttle', () => {
    it('应该返回节流函数', () => {
      const fn = vi.fn()
      const throttled = throttle(fn, 100)
      expect(typeof throttled).toBe('function')
    })
  })

  describe('initOptimization', () => {
    it('应该初始化优化', () => {
      initOptimization()
    })
  })

  describe('useOptimization', () => {
    it('应该返回优化工具', () => {
      const result = useOptimization()
      expect(result.isVisible).toBeDefined()
      expect(result.debounce).toBeDefined()
      expect(result.throttle).toBeDefined()
      expect(result.lazyLoadImages).toBeDefined()
      expect(result.preloadCriticalResources).toBeDefined()
      expect(result.useIdle).toBeDefined()
      expect(result.monitorTasks).toBeDefined()
    })
  })
})
