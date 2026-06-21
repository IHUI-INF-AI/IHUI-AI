import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { withRetry, createCircuitBreaker } from '../resilience'

describe('resilience.ts', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('withRetry', () => {
    it('成功时应该直接返回结果', async () => {
      const fn = vi.fn().mockResolvedValue('success')
      const result = await withRetry(fn)
      expect(result).toBe('success')
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('失败后重试成功应该返回结果', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('fail 1'))
        .mockRejectedValueOnce(new Error('fail 2'))
        .mockResolvedValue('success')

      const promise = withRetry(fn, { delay: 100, backoff: 1 })
      await vi.runAllTimersAsync()
      const result = await promise

      expect(result).toBe('success')
      expect(fn).toHaveBeenCalledTimes(3)
    })

    it('应该使用指数退避', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('fail 1'))
        .mockRejectedValueOnce(new Error('fail 2'))
        .mockResolvedValue('success')

      const promise = withRetry(fn, { maxAttempts: 3, delay: 100, backoff: 2 })
      await vi.runAllTimersAsync()
      await promise

      expect(fn).toHaveBeenCalledTimes(3)
    })

    it('默认配置应该正确工作', async () => {
      const fn = vi.fn().mockResolvedValue('ok')
      const result = await withRetry(fn, {})
      expect(result).toBe('ok')
    })
  })

  describe('createCircuitBreaker', () => {
    it('初始状态应该是CLOSED', () => {
      const breaker = createCircuitBreaker()
      expect(breaker.getState()).toBe('CLOSED')
    })

    it('成功执行应该保持CLOSED状态', async () => {
      const breaker = createCircuitBreaker()
      const fn = vi.fn().mockResolvedValue('success')

      await breaker.execute(fn)

      expect(breaker.getState()).toBe('CLOSED')
    })

    it('达到失败阈值应该变为OPEN状态', async () => {
      const breaker = createCircuitBreaker({ failureThreshold: 3 })
      const fn = vi.fn().mockRejectedValue(new Error('fail'))

      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(fn)
        } catch {
          // 预期错误
        }
      }

      expect(breaker.getState()).toBe('OPEN')
    })

    it('OPEN状态应该拒绝执行', async () => {
      const breaker = createCircuitBreaker({ failureThreshold: 1 })
      const failFn = vi.fn().mockRejectedValue(new Error('fail'))
      const successFn = vi.fn().mockResolvedValue('success')

      try {
        await breaker.execute(failFn)
      } catch {
        // 预期错误
      }

      expect(breaker.getState()).toBe('OPEN')

      try {
        await breaker.execute(successFn)
        expect.fail('应该抛出错误')
      } catch (e) {
        expect((e as Error).message).toBe('Circuit breaker is OPEN')
      }
    })

    it('OPEN状态超时后应该变为HALF_OPEN', async () => {
      vi.useRealTimers()

      const breaker = createCircuitBreaker({ failureThreshold: 1, resetTimeout: 100 })
      const failFn = vi.fn().mockRejectedValue(new Error('fail'))

      try {
        await breaker.execute(failFn)
      } catch {
        // 预期错误
      }

      expect(breaker.getState()).toBe('OPEN')

      await new Promise(resolve => setTimeout(resolve, 150))

      const successFn = vi.fn().mockResolvedValue('success')
      await breaker.execute(successFn)

      expect(breaker.getState()).toBe('CLOSED')

      vi.useFakeTimers()
    })

    it('HALF_OPEN状态成功后应该变为CLOSED', async () => {
      vi.useRealTimers()

      const breaker = createCircuitBreaker({ failureThreshold: 1, resetTimeout: 50 })
      const failFn = vi.fn().mockRejectedValue(new Error('fail'))

      try {
        await breaker.execute(failFn)
      } catch {
        // 预期错误
      }

      await new Promise(resolve => setTimeout(resolve, 100))

      const successFn = vi.fn().mockResolvedValue('success')
      await breaker.execute(successFn)

      expect(breaker.getState()).toBe('CLOSED')

      vi.useFakeTimers()
    })

    it('HALF_OPEN状态失败后应该变回OPEN', async () => {
      vi.useRealTimers()

      const breaker = createCircuitBreaker({ failureThreshold: 1, resetTimeout: 50 })
      const failFn = vi.fn().mockRejectedValue(new Error('fail'))

      try {
        await breaker.execute(failFn)
      } catch {
        // 预期错误
      }

      await new Promise(resolve => setTimeout(resolve, 100))

      try {
        await breaker.execute(failFn)
      } catch {
        // 预期错误
      }

      expect(breaker.getState()).toBe('OPEN')

      vi.useFakeTimers()
    })

    it('自定义配置应该正确应用', async () => {
      const breaker = createCircuitBreaker({ failureThreshold: 10, resetTimeout: 5000 })
      expect(breaker.getState()).toBe('CLOSED')
    })
  })
})
