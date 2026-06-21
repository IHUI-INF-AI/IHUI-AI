import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { measurePerformance, measurePerformanceAsync, debounce, throttle } from '../performance'

vi.mock('../logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}))

describe('performance', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('measurePerformance', () => {
    it('应该测量同步函数执行时间', () => {
      const fn = () => 42
      const result = measurePerformance(fn, 'test')
      expect(result).toBe(42)
    })

    it('应该返回函数结果', () => {
      const fn = () => 'hello'
      const result = measurePerformance(fn, 'string-test')
      expect(result).toBe('hello')
    })

    it('应该处理复杂计算', () => {
      const fn = () => {
        let sum = 0
        for (let i = 0; i < 1000; i++) {
          sum += i
        }
        return sum
      }
      const result = measurePerformance(fn, 'complex-calc')
      expect(result).toBe(499500)
    })
  })

  describe('measurePerformanceAsync', () => {
    it('应该测量异步函数执行时间', async () => {
      const fn = async () => {
        await new Promise(resolve => setTimeout(resolve, 10))
        return 'async-result'
      }
      const result = await measurePerformanceAsync(fn, 'async-test')
      expect(result).toBe('async-result')
    })

    it('应该返回Promise结果', async () => {
      const fn = async () => 123
      const result = await measurePerformanceAsync(fn, 'promise-test')
      expect(result).toBe(123)
    })
  })

  describe('debounce', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('应该延迟执行函数', () => {
      const fn = vi.fn()
      const debouncedFn = debounce(fn, 100)
      
      debouncedFn()
      expect(fn).not.toHaveBeenCalled()
      
      vi.advanceTimersByTime(50)
      expect(fn).not.toHaveBeenCalled()
      
      vi.advanceTimersByTime(50)
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('应该只执行最后一次调用', () => {
      const fn = vi.fn()
      const debouncedFn = debounce(fn, 100)
      
      debouncedFn('first')
      debouncedFn('second')
      debouncedFn('third')
      
      vi.advanceTimersByTime(100)
      expect(fn).toHaveBeenCalledTimes(1)
      expect(fn).toHaveBeenCalledWith('third')
    })
  })

  describe('throttle', () => {
    it('应该限制函数执行频率', () => {
      let currentTime = 1000
      vi.spyOn(Date, 'now').mockImplementation(() => currentTime)
      
      const fn = vi.fn()
      const throttledFn = throttle(fn, 100)
      
      throttledFn()
      expect(fn).toHaveBeenCalledTimes(1)
      
      throttledFn()
      throttledFn()
      expect(fn).toHaveBeenCalledTimes(1)
      
      currentTime += 150
      throttledFn()
      expect(fn).toHaveBeenCalledTimes(2)
      
      vi.restoreAllMocks()
    })

    it('应该使用默认等待时间', () => {
      let currentTime = 1000
      vi.spyOn(Date, 'now').mockImplementation(() => currentTime)
      
      const fn = vi.fn()
      const throttledFn = throttle(fn)
      
      throttledFn()
      expect(fn).toHaveBeenCalledTimes(1)
      
      throttledFn()
      expect(fn).toHaveBeenCalledTimes(1)
      
      currentTime += 600
      throttledFn()
      expect(fn).toHaveBeenCalledTimes(2)
      
      vi.restoreAllMocks()
    })
  })
})
