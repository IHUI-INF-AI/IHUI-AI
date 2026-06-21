import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  requestCancelManager,
  createCancelableRequest,
  withCancel,
  useRequestCancel,
} from '../requestCancel'

describe('requestCancel', () => {
  beforeEach(() => {
    requestCancelManager.cancelAll()
  })

  describe('requestCancelManager', () => {
    describe('generateId', () => {
      it('应该生成唯一ID', () => {
        const id1 = requestCancelManager.generateId()
        const id2 = requestCancelManager.generateId()
        expect(id1).not.toBe(id2)
        expect(id1).toMatch(/^req_\d+_\d+$/)
      })
    })

    describe('createController', () => {
      it('应该创建AbortController', () => {
        const { id, controller } = requestCancelManager.createController('/api/test')
        expect(id).toBeDefined()
        expect(controller).toBeInstanceOf(AbortController)
        expect(controller.signal).toBeDefined()
      })

      it('应该存储请求信息', () => {
        const { id } = requestCancelManager.createController('/api/test')
        const request = requestCancelManager.getRequest(id)
        expect(request?.url).toBe('/api/test')
        expect(request?.timestamp).toBeDefined()
      })
    })

    describe('cancel', () => {
      it('应该取消请求', () => {
        const { id, controller } = requestCancelManager.createController('/api/test')
        const result = requestCancelManager.cancel(id)
        expect(result).toBe(true)
        expect(controller.signal.aborted).toBe(true)
      })

      it('应该返回false当请求不存在', () => {
        const result = requestCancelManager.cancel('nonexistent')
        expect(result).toBe(false)
      })

      it('应该从列表中删除请求', () => {
        const { id } = requestCancelManager.createController('/api/test')
        requestCancelManager.cancel(id)
        expect(requestCancelManager.getRequest(id)).toBeUndefined()
      })
    })

    describe('cancelByUrl', () => {
      it('应该按URL字符串取消请求', () => {
        requestCancelManager.createController('/api/users')
        requestCancelManager.createController('/api/posts')
        requestCancelManager.createController('/api/users/1')

        const cancelled = requestCancelManager.cancelByUrl('/users')
        expect(cancelled).toBe(2)
      })

      it('应该按正则表达式取消请求', () => {
        requestCancelManager.createController('/api/users/1')
        requestCancelManager.createController('/api/posts/2')
        requestCancelManager.createController('/api/users/3')

        const cancelled = requestCancelManager.cancelByUrl(/\/users\/\d+/)
        expect(cancelled).toBe(2)
      })
    })

    describe('cancelAll', () => {
      it('应该取消所有请求', () => {
        requestCancelManager.createController('/api/test1')
        requestCancelManager.createController('/api/test2')
        requestCancelManager.createController('/api/test3')

        const cancelled = requestCancelManager.cancelAll()
        expect(cancelled).toBe(3)
        expect(requestCancelManager.getActiveRequests()).toHaveLength(0)
      })
    })

    describe('getActiveRequests', () => {
      it('应该返回所有活动请求', () => {
        requestCancelManager.createController('/api/test1')
        requestCancelManager.createController('/api/test2')

        const requests = requestCancelManager.getActiveRequests()
        expect(requests).toHaveLength(2)
      })
    })

    describe('getRequest', () => {
      it('应该返回指定请求', () => {
        const { id } = requestCancelManager.createController('/api/test')
        const request = requestCancelManager.getRequest(id)
        expect(request?.url).toBe('/api/test')
      })

      it('应该返回undefined当请求不存在', () => {
        expect(requestCancelManager.getRequest('nonexistent')).toBeUndefined()
      })
    })

    describe('remove', () => {
      it('应该删除请求', () => {
        const { id } = requestCancelManager.createController('/api/test')
        const result = requestCancelManager.remove(id)
        expect(result).toBe(true)
        expect(requestCancelManager.getRequest(id)).toBeUndefined()
      })

      it('应该返回false当请求不存在', () => {
        expect(requestCancelManager.remove('nonexistent')).toBe(false)
      })
    })

    describe('cleanup', () => {
      it('应该清理过期请求', () => {
        vi.useFakeTimers()
        const { id: oldId } = requestCancelManager.createController('/api/old')
        vi.advanceTimersByTime(10 * 60 * 1000)
        requestCancelManager.createController('/api/new')

        const cleaned = requestCancelManager.cleanup(5 * 60 * 1000)
        expect(cleaned).toBe(1)
        expect(requestCancelManager.getRequest(oldId)).toBeUndefined()
        vi.useRealTimers()
      })
    })

    describe('getSignal', () => {
      it('应该返回AbortSignal', () => {
        const { id } = requestCancelManager.createController('/api/test')
        const signal = requestCancelManager.getSignal(id)
        expect(signal).toBeDefined()
        expect(signal?.aborted).toBe(false)
      })

      it('应该返回undefined当请求不存在', () => {
        expect(requestCancelManager.getSignal('nonexistent')).toBeUndefined()
      })
    })
  })

  describe('createCancelableRequest', () => {
    it('应该创建可取消的请求', async () => {
      const fetcher = vi.fn().mockResolvedValue('result')
      const { id, promise, cancel } = createCancelableRequest('/api/test', fetcher)

      expect(id).toBeDefined()
      expect(promise).toBeInstanceOf(Promise)
      expect(typeof cancel).toBe('function')

      const result = await promise
      expect(result).toBe('result')
    })

    it('应该能够取消请求', () => {
      const fetcher = vi.fn().mockImplementation((signal) => {
        return new Promise((_, reject) => {
          signal.addEventListener('abort', () => {
            reject(new Error('Aborted'))
          })
        })
      })

      const { promise, cancel } = createCancelableRequest('/api/test', fetcher)
      cancel()

      return expect(promise).rejects.toThrow()
    })
  })

  describe('withCancel', () => {
    it('应该执行请求并返回结果', async () => {
      const fetcher = vi.fn().mockResolvedValue('result')
      const result = await withCancel('/api/test', fetcher)
      expect(result).toBe('result')
    })
  })

  describe('useRequestCancel', () => {
    it('应该返回所有取消方法', () => {
      const utils = useRequestCancel()
      expect(typeof utils.createController).toBe('function')
      expect(typeof utils.cancel).toBe('function')
      expect(typeof utils.cancelByUrl).toBe('function')
      expect(typeof utils.cancelAll).toBe('function')
      expect(typeof utils.getActiveRequests).toBe('function')
      expect(typeof utils.cleanup).toBe('function')
    })
  })
})
