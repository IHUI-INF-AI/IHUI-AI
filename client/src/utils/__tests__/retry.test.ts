import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/utils/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}))

describe('retry.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetModules()
  })

  describe('calculateDelay', () => {
    it('应该计算指数退避延迟', async () => {
      const { calculateDelay } = await import('../retry')
      const delay = calculateDelay(0, 1000, 30000)
      expect(delay).toBeGreaterThanOrEqual(1000)
      expect(delay).toBeLessThanOrEqual(3100)
    })

    it('应该限制最大延迟', async () => {
      const { calculateDelay } = await import('../retry')
      const delay = calculateDelay(10, 1000, 5000)
      expect(delay).toBeLessThanOrEqual(5100)
    })
  })

  describe('sleep', () => {
    it('应该返回Promise', async () => {
      const { sleep } = await import('../retry')
      const promise = sleep(10)
      expect(promise).toBeInstanceOf(Promise)
      await promise
    })
  })

  describe('withRetry', () => {
    it('应该在成功时返回结果', async () => {
      const { withRetry } = await import('../retry')
      const fn = vi.fn().mockResolvedValue('success')
      const result = await withRetry(fn, { baseDelay: 1, maxDelay: 10 })
      expect(result).toBe('success')
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('应该在retryCondition返回false时立即抛出错误', async () => {
      const { withRetry } = await import('../retry')
      const error = new Error('non-retryable')
      const fn = vi.fn().mockRejectedValue(error)
      const retryCondition = vi.fn().mockReturnValue(false)

      await expect(withRetry(fn, { retryCondition, maxRetries: 0, baseDelay: 1, maxDelay: 10 })).rejects.toThrow('non-retryable')
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('应该在失败后重试', async () => {
      const { withRetry } = await import('../retry')
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('network fail 1'))
        .mockResolvedValue('success')
      
      const result = await withRetry(fn, { maxRetries: 3, baseDelay: 1, maxDelay: 10 })
      expect(result).toBe('success')
      expect(fn).toHaveBeenCalledTimes(2)
    })

    it('应该在达到最大重试次数后抛出错误', async () => {
      const { withRetry } = await import('../retry')
      const fn = vi.fn().mockRejectedValue(new Error('network fail'))
      
      await expect(withRetry(fn, { maxRetries: 1, baseDelay: 1, maxDelay: 10 })).rejects.toThrow('network fail')
      expect(fn).toHaveBeenCalledTimes(2)
    })
  })

  describe('createRetryable', () => {
    it('应该创建可重试请求', async () => {
      const { createRetryable } = await import('../retry')
      const fn = vi.fn().mockResolvedValue('success')
      const retryable = createRetryable(fn, { baseDelay: 1, maxDelay: 10 })
      const result = await retryable.execute()
      expect(result).toBe('success')
    })
  })

  describe('CircuitBreaker', () => {
    it('应该创建熔断器', async () => {
      const { CircuitBreaker } = await import('../retry')
      const breaker = new CircuitBreaker({ failureThreshold: 3, resetTimeout: 1000 })
      expect(breaker.getState()).toBe('closed')
    })

    it('应该在失败次数达到阈值后打开', async () => {
      const { CircuitBreaker } = await import('../retry')
      const breaker = new CircuitBreaker({ failureThreshold: 2, resetTimeout: 1000 })
      
      breaker.recordFailure()
      expect(breaker.getState()).toBe('closed')
      
      breaker.recordFailure()
      expect(breaker.getState()).toBe('open')
    })

    it('应该在成功后重置', async () => {
      const { CircuitBreaker } = await import('../retry')
      const breaker = new CircuitBreaker({ failureThreshold: 1, resetTimeout: 1000 })
      
      breaker.recordFailure()
      expect(breaker.getState()).toBe('open')
      
      breaker.reset()
      expect(breaker.getState()).toBe('closed')
    })
  })

  describe('useRetry', () => {
    it('应该返回重试函数', async () => {
      const { useRetry } = await import('../retry')
      const { withRetry } = useRetry()
      const fn = vi.fn().mockResolvedValue('success')
      const result = await withRetry(fn, { baseDelay: 1, maxDelay: 10 })
      expect(result).toBe('success')
    })
  })
})
