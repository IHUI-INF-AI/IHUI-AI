import { describe, it, expect, vi } from 'vitest'
import { retryPromise, withTimeout } from '../promise-utils'

describe('promise-utils', () => {
  describe('retryPromise', () => {
    it('应该在成功时返回结果', async () => {
      const fn = vi.fn().mockResolvedValue('success')
      const result = await retryPromise(fn, 3)
      expect(result).toBe('success')
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('应该在失败后重试', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('fail 1'))
        .mockRejectedValueOnce(new Error('fail 2'))
        .mockResolvedValue('success')
      const result = await retryPromise(fn, 3)
      expect(result).toBe('success')
      expect(fn).toHaveBeenCalledTimes(3)
    })

    it('应该在重试次数用尽后抛出错误', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('always fail'))
      await expect(retryPromise(fn, 2)).rejects.toThrow('always fail')
      expect(fn).toHaveBeenCalledTimes(3)
    })

    it('应该使用默认重试次数', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('fail'))
      await expect(retryPromise(fn)).rejects.toThrow('fail')
      expect(fn).toHaveBeenCalledTimes(4)
    })

    it('应该在重试次数为0时直接抛出错误', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('fail'))
      await expect(retryPromise(fn, 0)).rejects.toThrow('fail')
      expect(fn).toHaveBeenCalledTimes(1)
    })
  })

  describe('withTimeout', () => {
    it('应该在超时前完成', async () => {
      const promise = Promise.resolve('success')
      const result = await withTimeout(promise, 1000)
      expect(result).toBe('success')
    })

    it('应该在超时后抛出错误', async () => {
      const promise = new Promise((resolve) => setTimeout(resolve, 2000))
      await expect(withTimeout(promise, 100)).rejects.toThrow('Timeout')
    })

    it('应该传递原始错误', async () => {
      const promise = Promise.reject(new Error('original error'))
      await expect(withTimeout(promise, 1000)).rejects.toThrow('original error')
    })
  })
})
