import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { errorTracker, initErrorTracker, captureError, captureMessage, addBreadcrumb, setErrorContext } from '../errorTracker'

describe('errorTracker', () => {
  const originalAddEventListener = window.addEventListener
  const mockAddEventListener = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    window.addEventListener = mockAddEventListener
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'info').mockImplementation(() => {})
  })

  afterEach(() => {
    window.addEventListener = originalAddEventListener
    vi.restoreAllMocks()
  })

  describe('init', () => {
    it('应该正确初始化并设置全局错误处理器', () => {
      initErrorTracker({
        dsn: 'https://api.example.com/errors',
        environment: 'test',
        release: '1.0.0',
      })

      expect(mockAddEventListener).toHaveBeenCalledWith('error', expect.any(Function))
      expect(mockAddEventListener).toHaveBeenCalledWith('unhandledrejection', expect.any(Function))
    })
  })

  describe('setContext', () => {
    it('应该设置错误上下文', () => {
      initErrorTracker({})
      setErrorContext({ userId: 'user-123', userRole: 'admin' })

      const error = new Error('测试错误')
      const spy = vi.spyOn(errorTracker, 'captureError')
      errorTracker.captureError(error)

      expect(spy).toHaveBeenCalled()
    })
  })

  describe('addBreadcrumb', () => {
    it('应该添加面包屑', () => {
      initErrorTracker({})
      const tracker = errorTracker as unknown as { breadcrumbs: any[] }
      tracker.breadcrumbs = []
      addBreadcrumb({
        category: 'navigation',
        message: '用户访问首页',
        level: 'info',
      })

      expect(tracker.breadcrumbs.length).toBe(1)
    })

    it('应该限制面包屑数量', () => {
      initErrorTracker({})

      for (let i = 0; i < 60; i++) {
        addBreadcrumb({
          category: 'test',
          message: `面包屑 ${i}`,
          level: 'info',
        })
      }

      const breadcrumbs = (errorTracker as unknown as { breadcrumbs: any[] }).breadcrumbs
      expect(breadcrumbs.length).toBeLessThanOrEqual(50)
    })
  })

  describe('captureError', () => {
    it('应该捕获错误并返回ID', () => {
      initErrorTracker({})
      const error = new Error('测试错误')
      const id = captureError(error)

      expect(id).toBeTruthy()
      expect(typeof id).toBe('string')
    })

    it('应该根据采样率跳过错误', () => {
      initErrorTracker({ sampleRate: 0.5 })
      const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.8)
      const error = new Error('测试错误')
      const id = captureError(error)

      expect(id).toBe('')
      randomSpy.mockRestore()
    })

    it('应该包含额外上下文', () => {
      initErrorTracker({})
      const error = new Error('测试错误')
      const spy = vi.spyOn(errorTracker, 'captureError')
      errorTracker.captureError(error, { action: 'submit-form' })

      expect(spy).toHaveBeenCalledWith(error, { action: 'submit-form' })
    })
  })

  describe('captureMessage', () => {
    it('应该捕获消息', () => {
      initErrorTracker({})
      const id = captureMessage('测试消息', 'info')

      expect(id).toBeTruthy()
      expect(typeof id).toBe('string')
    })

    it('应该支持不同级别', () => {
      initErrorTracker({})
      const id1 = captureMessage('错误消息', 'error')
      const id2 = captureMessage('警告消息', 'warning')
      const id3 = captureMessage('信息消息', 'info')

      expect(id1).toBeTruthy()
      expect(id2).toBeTruthy()
      expect(id3).toBeTruthy()
    })
  })

  describe('wrapFunction', () => {
    it('应该包装同步函数并捕获错误', () => {
      initErrorTracker({})
      const spy = vi.spyOn(errorTracker, 'captureError')

      const fn = () => {
        throw new Error('同步错误')
      }

      const wrappedFn = errorTracker.wrapFunction(fn)

      expect(() => wrappedFn()).toThrow('同步错误')
      expect(spy).toHaveBeenCalled()
    })

    it('应该正常执行不抛错的函数', () => {
      initErrorTracker({})
      const fn = (x: number) => x * 2
      const wrappedFn = errorTracker.wrapFunction(fn)

      expect(wrappedFn(5)).toBe(10)
    })
  })

  describe('wrapAsyncFunction', () => {
    it('应该包装异步函数并捕获错误', async () => {
      initErrorTracker({})
      const spy = vi.spyOn(errorTracker, 'captureError')

      const fn = async () => {
        throw new Error('异步错误')
      }

      const wrappedFn = errorTracker.wrapAsyncFunction(fn)

      await expect(wrappedFn()).rejects.toThrow('异步错误')
      expect(spy).toHaveBeenCalled()
    })

    it('应该正常执行不抛错的异步函数', async () => {
      initErrorTracker({})
      const fn = async (x: number) => x * 2
      const wrappedFn = errorTracker.wrapAsyncFunction(fn)

      expect(await wrappedFn(5)).toBe(10)
    })
  })
})
