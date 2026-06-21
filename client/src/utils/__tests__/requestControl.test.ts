import { describe, it, expect, vi, beforeEach } from 'vitest'
import { RateLimiter, RequestQueue, throttle, debounce } from '../requestControl'

describe('requestControl', () => {
  describe('throttle', () => {
    it('应该节流函数调用', async () => {
      vi.useFakeTimers()
      const fn = vi.fn()
      const throttled = throttle(fn, { interval: 100, leading: true })

      throttled()
      throttled()
      throttled()

      expect(fn).toHaveBeenCalledTimes(1)

      vi.advanceTimersByTime(150)
      throttled()
      expect(fn).toHaveBeenCalledTimes(2)

      vi.useRealTimers()
    })

    it('应该支持cancel', () => {
      vi.useFakeTimers()
      const fn = vi.fn()
      const throttled = throttle(fn, { interval: 100, trailing: true })

      throttled()
      throttled.cancel()

      vi.advanceTimersByTime(150)
      expect(fn).toHaveBeenCalledTimes(1)

      vi.useRealTimers()
    })

    it('应该支持flush', () => {
      const fn = vi.fn()
      const throttled = throttle(fn, { interval: 100, trailing: true })

      throttled('arg1')
      throttled.flush()

      expect(fn).toHaveBeenCalled()
    })
  })

  describe('debounce', () => {
    it('应该防抖函数调用', async () => {
      vi.useFakeTimers()
      const fn = vi.fn()
      const debounced = debounce(fn, { wait: 100 })

      debounced()
      debounced()
      debounced()

      expect(fn).toHaveBeenCalledTimes(0)

      vi.advanceTimersByTime(150)
      expect(fn).toHaveBeenCalledTimes(1)

      vi.useRealTimers()
    })

    it('应该支持leading选项', () => {
      vi.useFakeTimers()
      const fn = vi.fn()
      const debounced = debounce(fn, { wait: 100, leading: true })

      debounced()
      expect(fn).toHaveBeenCalledTimes(1)

      vi.useRealTimers()
    })

    it('应该支持cancel', () => {
      vi.useFakeTimers()
      const fn = vi.fn()
      const debounced = debounce(fn, { wait: 100 })

      debounced()
      debounced.cancel()

      vi.advanceTimersByTime(150)
      expect(fn).toHaveBeenCalledTimes(0)

      vi.useRealTimers()
    })

    it('应该支持flush', () => {
      const fn = vi.fn()
      const debounced = debounce(fn, { wait: 100 })

      debounced('arg1')
      debounced.flush()

      expect(fn).toHaveBeenCalled()
    })
  })

  describe('RateLimiter', () => {
    let limiter: RateLimiter

    beforeEach(() => {
      limiter = new RateLimiter({ maxRequests: 2, windowMs: 1000 })
    })

    it('应该允许在限制内的请求', () => {
      expect(limiter.tryRequest()).toBe(true)
      expect(limiter.tryRequest()).toBe(true)
    })

    it('应该阻止超过限制的请求', () => {
      limiter.tryRequest()
      limiter.tryRequest()
      expect(limiter.tryRequest()).toBe(false)
    })

    it('应该返回剩余请求数', () => {
      expect(limiter.getRemainingRequests()).toBe(2)
      limiter.tryRequest()
      expect(limiter.getRemainingRequests()).toBe(1)
    })

    it('应该能够重置', () => {
      limiter.tryRequest()
      limiter.tryRequest()
      limiter.reset()
      expect(limiter.getRemainingRequests()).toBe(2)
    })

    it('应该返回重置时间', () => {
      limiter.tryRequest()
      expect(limiter.getResetTime()).toBeGreaterThan(0)
    })

    it('应该在空队列时返回0重置时间', () => {
      expect(limiter.getResetTime()).toBe(0)
    })

    it('应该调用onLimitReached回调', () => {
      const onLimitReached = vi.fn()
      const limiterWithCallback = new RateLimiter({
        maxRequests: 1,
        windowMs: 1000,
        onLimitReached,
      })

      limiterWithCallback.tryRequest()
      limiterWithCallback.tryRequest()

      expect(onLimitReached).toHaveBeenCalled()
    })
  })

  describe('RequestQueue', () => {
    it('应该创建队列', () => {
      const queue = new RequestQueue(2)
      expect(queue).toBeDefined()
    })

    it('应该添加请求到队列', async () => {
      const queue = new RequestQueue(1)
      const fn = vi.fn().mockResolvedValue('result')

      const result = await queue.add(fn)

      expect(result).toBe('result')
      expect(fn).toHaveBeenCalled()
    })

    it('应该检查队列是否正在运行', async () => {
      const queue = new RequestQueue(1)
      const slowFn = () => new Promise(resolve => setTimeout(resolve, 100))

      queue.add(slowFn)

      expect(queue.isRunning()).toBe(true)

      await new Promise(resolve => setTimeout(resolve, 150))
      expect(queue.isRunning()).toBe(false)
    })

    it('应该返回队列大小', () => {
      const queue = new RequestQueue(1)
      expect(queue.size()).toBe(0)
    })

    it('应该能够清空队列', () => {
      const queue = new RequestQueue(1)
      queue.clear()
      expect(queue.size()).toBe(0)
    })
  })
})
