import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  normalizeApiResponse,
  isApiSuccess,
  extractApiData,
  extractApiError,
  normalizePaginationResponse,
  createErrorResponse,
  withApiResponseHandler,
  handleConcurrentRequests,
  ApiCache,
  withCache,
  debounceApi,
  throttleApi,
  ApiBatcher,
  RetryStrategy,
  withRetry,
} from '../apiResponseHandler'

vi.mock('@/utils/i18n', () => ({
  t: (key: string) => {
    const map: Record<string, string> = {
      'text.api_response_handler.未知错误': '未知错误',
    }
    return map[key] || key
  },
}))

describe('apiResponseHandler', () => {
  describe('normalizeApiResponse', () => {
    it('应该处理带有msg字段的格式', () => {
      const response = { code: 200, msg: '成功', data: { id: 1 } }
      const result = normalizeApiResponse(response)
      expect(result.code).toBe(200)
      expect(result.message).toBe('成功')
      expect(result.data).toEqual({ id: 1 })
      expect(result.success).toBe(true)
    })

    it('应该处理code=0为成功', () => {
      const response = { code: 0, msg: '成功', data: null }
      const result = normalizeApiResponse(response)
      expect(result.success).toBe(true)
    })

    it('应该处理code=10000为成功', () => {
      const response = { code: 10000, msg: '成功', data: null }
      const result = normalizeApiResponse(response)
      expect(result.success).toBe(true)
    })

    it('应该处理code=401为失败', () => {
      const response = { code: 401, msg: '未授权', data: null }
      const result = normalizeApiResponse(response)
      expect(result.success).toBe(false)
    })

    it('应该保留已有的标准格式', () => {
      const response = { code: 200, message: '成功', data: { id: 1 }, success: true, timestamp: 123456 }
      const result = normalizeApiResponse(response)
      expect(result).toEqual(response)
    })

    it('应该处理标准格式但没有success字段', () => {
      const response = { code: 200, message: '成功', data: { id: 1 } }
      const result = normalizeApiResponse(response)
      expect(result.success).toBe(true)
    })

    it('应该处理直接返回数据的情况', () => {
      const response = { id: 1, name: 'test' }
      const result = normalizeApiResponse(response)
      expect(result.code).toBe(200)
      expect(result.success).toBe(true)
      expect(result.data).toEqual(response)
    })

    it('应该处理null响应', () => {
      const result = normalizeApiResponse(null)
      expect(result.code).toBe(200)
      expect(result.success).toBe(true)
    })

    it('应该处理undefined响应', () => {
      const result = normalizeApiResponse(undefined)
      expect(result.code).toBe(200)
      expect(result.success).toBe(true)
    })

    it('应该处理原始类型响应', () => {
      const result = normalizeApiResponse('test')
      expect(result.code).toBe(200)
      expect(result.data).toBe('test')
    })
  })

  describe('isApiSuccess', () => {
    it('应该返回true当code=200', () => {
      expect(isApiSuccess({ code: 200 })).toBe(true)
    })

    it('应该返回true当code=0', () => {
      expect(isApiSuccess({ code: 0 })).toBe(true)
    })

    it('应该返回false当code为其他值', () => {
      expect(isApiSuccess({ code: 401 })).toBe(false)
      expect(isApiSuccess({ code: 500 })).toBe(false)
    })

    it('应该检查HTTP状态码', () => {
      expect(isApiSuccess({ status: 200 })).toBe(true)
      expect(isApiSuccess({ status: 201 })).toBe(true)
      expect(isApiSuccess({ status: 300 })).toBe(false)
      expect(isApiSuccess({ status: 404 })).toBe(false)
    })

    it('应该返回false当响应为空', () => {
      expect(isApiSuccess(null)).toBe(false)
      expect(isApiSuccess(undefined)).toBe(false)
    })

    it('应该默认返回true', () => {
      expect(isApiSuccess({})).toBe(true)
      expect(isApiSuccess('test')).toBe(true)
    })
  })

  describe('extractApiData', () => {
    it('应该提取data字段', () => {
      const response = { code: 200, data: { id: 1 } }
      expect(extractApiData(response)).toEqual({ id: 1 })
    })

    it('应该直接返回没有data的响应', () => {
      const response = { id: 1, name: 'test' }
      expect(extractApiData(response)).toEqual(response)
    })

    it('应该返回null当响应为空', () => {
      expect(extractApiData(null)).toBeNull()
      expect(extractApiData(undefined)).toBeNull()
    })

    it('应该返回原始值当响应是原始类型', () => {
      expect(extractApiData('test')).toBe('test')
      expect(extractApiData(123)).toBe(123)
    })
  })

  describe('extractApiError', () => {
    it('应该提取message字段', () => {
      const response = { message: '错误信息' }
      expect(extractApiError(response)).toBe('错误信息')
    })

    it('应该提取msg字段', () => {
      const response = { msg: '错误信息' }
      expect(extractApiError(response)).toBe('错误信息')
    })

    it('应该提取error字段', () => {
      const response = { error: '错误信息' }
      expect(extractApiError(response)).toBe('错误信息')
    })

    it('应该处理axios错误对象', () => {
      const response = {
        response: {
          data: { message: '请求失败' }
        }
      }
      expect(extractApiError(response)).toBe('请求失败')
    })

    it('应该处理axios错误对象中的msg字段', () => {
      const response = {
        response: {
          data: { msg: '请求失败' }
        }
      }
      expect(extractApiError(response)).toBe('请求失败')
    })

    it('应该处理axios错误对象中的字符串data', () => {
      const response = {
        response: {
          data: '请求失败'
        }
      }
      expect(extractApiError(response)).toBe('请求失败')
    })

    it('应该处理Error对象', () => {
      const error = new Error('测试错误')
      expect(extractApiError(error)).toBe('测试错误')
    })

    it('应该返回默认错误信息当响应为空', () => {
      expect(extractApiError(null)).toBe('未知错误')
      expect(extractApiError(undefined)).toBe('未知错误')
    })

    it('应该返回默认错误信息当没有错误字段', () => {
      expect(extractApiError({})).toBe('请求失败')
    })

    it('应该处理字符串响应', () => {
      expect(extractApiError('错误')).toBe('错误')
    })
  })

  describe('normalizePaginationResponse', () => {
    it('应该返回标准分页格式', () => {
      const response = {
        data: {
          list: [{ id: 1 }, { id: 2 }],
          pagination: { page: 1, pageSize: 10, total: 2, totalPages: 1 }
        }
      }
      const result = normalizePaginationResponse(response)
      expect(result.list).toHaveLength(2)
      expect(result.pagination.page).toBe(1)
    })

    it('应该处理数组格式', () => {
      const response = {
        data: [{ id: 1 }, { id: 2 }, { id: 3 }]
      }
      const result = normalizePaginationResponse(response)
      expect(result.list).toHaveLength(3)
      expect(result.pagination.total).toBe(3)
    })

    it('应该处理items字段', () => {
      const response = {
        data: {
          items: [{ id: 1 }],
          total: 10
        }
      }
      const result = normalizePaginationResponse(response)
      expect(result.list).toHaveLength(1)
      expect(result.pagination.total).toBe(10)
    })

    it('应该处理records字段', () => {
      const response = {
        data: {
          records: [{ id: 1 }, { id: 2 }],
          total: 5,
          current: 2,
          size: 2
        }
      }
      const result = normalizePaginationResponse(response)
      expect(result.list).toHaveLength(2)
      expect(result.pagination.page).toBe(2)
      expect(result.pagination.pageSize).toBe(2)
    })

    it('应该处理空数组', () => {
      const response = { data: [] }
      const result = normalizePaginationResponse(response)
      expect(result.list).toHaveLength(0)
      expect(result.pagination.total).toBe(0)
    })

    it('应该处理空对象', () => {
      const response = { data: {} }
      const result = normalizePaginationResponse(response)
      expect(result.list).toHaveLength(0)
    })

    it('应该处理null响应', () => {
      const result = normalizePaginationResponse(null)
      expect(result.list).toHaveLength(0)
    })

    it('应该处理pageNum字段', () => {
      const response = {
        data: {
          list: [{ id: 1 }],
          pageNum: 3,
          pageSize: 10
        }
      }
      const result = normalizePaginationResponse(response)
      expect(result.pagination.page).toBe(3)
    })

    it('应该处理limit字段作为pageSize', () => {
      const response = {
        data: {
          list: [{ id: 1 }],
          limit: 20
        }
      }
      const result = normalizePaginationResponse(response)
      expect(result.pagination.pageSize).toBe(20)
    })

    it('应该处理count字段作为total', () => {
      const response = {
        data: {
          list: [{ id: 1 }],
          count: 100
        }
      }
      const result = normalizePaginationResponse(response)
      expect(result.pagination.total).toBe(100)
    })
  })

  describe('createErrorResponse', () => {
    it('应该创建默认错误响应', () => {
      const result = createErrorResponse()
      expect(result.code).toBe(500)
      expect(result.message).toBe('请求失败')
      expect(result.success).toBe(false)
      expect(result.data).toBeNull()
    })

    it('应该创建自定义错误响应', () => {
      const result = createErrorResponse(404, '未找到')
      expect(result.code).toBe(404)
      expect(result.message).toBe('未找到')
      expect(result.success).toBe(false)
    })

    it('应该包含时间戳', () => {
      const result = createErrorResponse()
      expect(result.timestamp).toBeDefined()
      expect(typeof result.timestamp).toBe('number')
    })
  })

  describe('withApiResponseHandler', () => {
    it('应该成功处理正常响应', async () => {
      const mockFn = vi.fn().mockResolvedValue({ code: 200, data: { id: 1 }, msg: '成功' })
      const wrappedFn = withApiResponseHandler(mockFn)
      const result = await wrappedFn()
      expect(result.success).toBe(true)
      expect(result.data).toEqual({ id: 1 })
    })

    it('应该处理错误响应', async () => {
      const mockFn = vi.fn().mockRejectedValue(new Error('网络错误'))
      const wrappedFn = withApiResponseHandler(mockFn, { silent: true })
      const result = await wrappedFn()
      expect(result.success).toBe(false)
      expect(result.code).toBe(500)
    })

    it('应该支持重试', async () => {
      const mockFn = vi.fn()
        .mockRejectedValueOnce(new Error('第一次失败'))
        .mockResolvedValueOnce({ code: 200, data: 'success' })
      const wrappedFn = withApiResponseHandler(mockFn, { retryTimes: 1, retryDelay: 10 })
      const result = await wrappedFn()
      expect(mockFn).toHaveBeenCalledTimes(2)
      expect(result.success).toBe(true)
    })
  })

  describe('handleConcurrentRequests', () => {
    it('应该处理多个并发请求', async () => {
      const requests = [
        () => Promise.resolve({ code: 200, data: 1, success: true, message: '', timestamp: 0 }),
        () => Promise.resolve({ code: 200, data: 2, success: true, message: '', timestamp: 0 }),
        () => Promise.resolve({ code: 200, data: 3, success: true, message: '', timestamp: 0 }),
      ]
      const results = await handleConcurrentRequests(requests)
      expect(results).toHaveLength(3)
      expect(results[0].data).toBe(1)
      expect(results[1].data).toBe(2)
      expect(results[2].data).toBe(3)
    })

    it('应该处理请求错误', async () => {
      const requests = [
        () => Promise.resolve({ code: 200, data: 1, success: true, message: '', timestamp: 0 }),
        () => Promise.reject(new Error('请求失败')),
      ]
      const results = await handleConcurrentRequests(requests)
      expect(results).toHaveLength(2)
      expect(results[0].success).toBe(true)
      expect(results[1].success).toBe(false)
    })
  })

  describe('ApiCache', () => {
    let cache: ApiCache

    beforeEach(() => {
      cache = new ApiCache(1000)
    })

    it('应该设置和获取缓存', () => {
      cache.set('key1', { data: 'test' })
      const result = cache.get('key1')
      expect(result).toEqual({ data: 'test' })
    })

    it('应该返回undefined当缓存不存在', () => {
      const result = cache.get('nonexistent')
      expect(result).toBeUndefined()
    })

    it('应该删除缓存', () => {
      cache.set('key1', 'value')
      cache.delete('key1')
      expect(cache.get('key1')).toBeUndefined()
    })

    it('应该清空所有缓存', () => {
      cache.set('key1', 'value1')
      cache.set('key2', 'value2')
      cache.clear()
      expect(cache.get('key1')).toBeUndefined()
      expect(cache.get('key2')).toBeUndefined()
    })

    it('应该检查缓存是否有效', () => {
      cache.set('key1', 'value')
      expect(cache.hasValid('key1')).toBe(true)
      expect(cache.hasValid('nonexistent')).toBe(false)
    })

    it('应该处理过期缓存', async () => {
      const shortCache = new ApiCache(10)
      shortCache.set('key1', 'value')
      await new Promise(resolve => setTimeout(resolve, 20))
      expect(shortCache.get('key1')).toBeUndefined()
    })
  })

  describe('withCache', () => {
    it('应该缓存成功响应', async () => {
      const cache = new ApiCache()
      let callCount = 0
      const mockFn = async () => {
        callCount++
        return { code: 200, data: callCount, success: true, message: '' }
      }
      const cachedFn = withCache(mockFn, cache)

      const result1 = await cachedFn()
      const result2 = await cachedFn()

      expect(callCount).toBe(1)
      expect(result1.data).toBe(1)
      expect(result2.data).toBe(1)
    })

    it('不应该缓存失败响应', async () => {
      const cache = new ApiCache()
      let callCount = 0
      const mockFn = async () => {
        callCount++
        return { code: 500, data: null, success: false, message: 'error' }
      }
      const cachedFn = withCache(mockFn, cache)

      await cachedFn()
      await cachedFn()

      expect(callCount).toBe(2)
    })
  })

  describe('debounceApi', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('应该延迟执行API调用', async () => {
      const mockFn = vi.fn().mockResolvedValue({ code: 200, data: 'result', success: true, message: '' })
      const debouncedFn = debounceApi(mockFn, 300)

      const promise = debouncedFn('arg')
      vi.advanceTimersByTime(300)
      const result = await promise

      expect(mockFn).toHaveBeenCalledWith('arg')
      expect(result.data).toBe('result')
    })

    it('应该取消之前的调用', async () => {
      const mockFn = vi.fn().mockResolvedValue({ code: 200, data: 'result', success: true, message: '' })
      const debouncedFn = debounceApi(mockFn, 300)

      debouncedFn('arg1')
      const promise = debouncedFn('arg2')
      vi.advanceTimersByTime(300)
      await promise

      expect(mockFn).toHaveBeenCalledTimes(1)
      expect(mockFn).toHaveBeenCalledWith('arg2')
    })
  })

  describe('throttleApi', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('应该限制调用频率', async () => {
      const mockFn = vi.fn().mockResolvedValue({ code: 200, data: 'result', success: true, message: '' })
      const throttledFn = throttleApi(mockFn, 500)

      const promise1 = throttledFn('arg1')
      const promise2 = throttledFn('arg2')

      vi.advanceTimersByTime(100)

      expect(mockFn).toHaveBeenCalledTimes(1)
      const results = await Promise.all([promise1, promise2])
      expect(results[0]).toEqual(results[1])
    })
  })

  describe('ApiBatcher', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('应该批量处理项目', async () => {
      const processBatch = vi.fn().mockResolvedValue(['result1', 'result2'])
      const batcher = new ApiBatcher(processBatch, { batchSize: 2, delay: 100 })

      const promise1 = batcher.add('item1')
      const promise2 = batcher.add('item2')

      vi.advanceTimersByTime(100)
      const results = await Promise.all([promise1, promise2])

      expect(processBatch).toHaveBeenCalledWith(['item1', 'item2'])
      expect(results).toEqual(['result1', 'result2'])
    })

    it('应该处理批量错误', async () => {
      const processBatch = vi.fn().mockRejectedValue(new Error('批量处理失败'))
      const batcher = new ApiBatcher(processBatch, { batchSize: 1, delay: 10 })

      const promise = batcher.add('item1')
      vi.advanceTimersByTime(100)

      // 等待微任务和动态import完成
      await vi.waitFor(() => expect(promise).rejects.toThrow('批量处理失败'))
    })
  })

  describe('RetryStrategy', () => {
    it('应该定义正确的枚举值', () => {
      expect(RetryStrategy.FIXED).toBe('fixed')
      expect(RetryStrategy.EXPONENTIAL).toBe('exponential')
      expect(RetryStrategy.LINEAR).toBe('linear')
    })
  })

  describe('withRetry', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('应该成功处理正常响应', async () => {
      const mockFn = vi.fn().mockResolvedValue({ code: 200, data: 'success', success: true, message: '' })
      const retryFn = withRetry(mockFn)
      const result = await retryFn()
      expect(result.success).toBe(true)
      expect(mockFn).toHaveBeenCalledTimes(1)
    })

    it('应该重试失败的请求', async () => {
      const mockFn = vi.fn()
        .mockRejectedValueOnce(new Error('第一次失败'))
        .mockRejectedValueOnce(new Error('第二次失败'))
        .mockResolvedValueOnce({ code: 200, data: 'success', success: true, message: '' })
      const retryFn = withRetry(mockFn, { retryTimes: 3, initialDelay: 100 })

      const promise = retryFn()
      await vi.runAllTimersAsync()
      const result = await promise

      expect(mockFn).toHaveBeenCalledTimes(3)
      expect(result.success).toBe(true)
    })

    it('应该在达到最大重试次数后返回错误', async () => {
      const mockFn = vi.fn().mockRejectedValue(new Error('持续失败'))
      const retryFn = withRetry(mockFn, { retryTimes: 2, initialDelay: 10 })

      const promise = retryFn()
      await vi.runAllTimersAsync()
      const result = await promise

      expect(mockFn).toHaveBeenCalledTimes(3)
      expect(result.success).toBe(false)
    })

    it('应该使用固定重试策略', async () => {
      const mockFn = vi.fn()
        .mockRejectedValueOnce(new Error('失败'))
        .mockResolvedValueOnce({ code: 200, data: 'success', success: true, message: '' })
      const retryFn = withRetry(mockFn, { retryTimes: 1, initialDelay: 100, strategy: RetryStrategy.FIXED })

      const promise = retryFn()
      await vi.runAllTimersAsync()
      const result = await promise

      expect(result.success).toBe(true)
    })

    it('应该使用线性重试策略', async () => {
      const mockFn = vi.fn()
        .mockRejectedValueOnce(new Error('失败'))
        .mockResolvedValueOnce({ code: 200, data: 'success', success: true, message: '' })
      const retryFn = withRetry(mockFn, { retryTimes: 1, initialDelay: 100, strategy: RetryStrategy.LINEAR })

      const promise = retryFn()
      await vi.runAllTimersAsync()
      const result = await promise

      expect(result.success).toBe(true)
    })

    it('应该支持自定义shouldRetry', async () => {
      const mockFn = vi.fn().mockRejectedValue({ response: { status: 404 } })
      const retryFn = withRetry(mockFn, {
        retryTimes: 3,
        shouldRetry: (error) => (error as { response?: { status?: number } }).response?.status !== 404
      })

      const promise = retryFn()
      await vi.runAllTimersAsync()
      const result = await promise

      expect(mockFn).toHaveBeenCalledTimes(1)
      expect(result.success).toBe(false)
    })
  })
})
