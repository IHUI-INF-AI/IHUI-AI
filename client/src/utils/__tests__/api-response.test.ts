import { describe, it, expect } from 'vitest'
import {
  isNetworkError,
  normalizeApiResponse,
} from '../api-response'

describe('api-response', () => {
  describe('isNetworkError', () => {
    it('应该识别NETWORK_ERROR', () => {
      const error = { code: 'NETWORK_ERROR', message: 'network error' }
      expect(isNetworkError(error)).toBe(true)
    })

    it('应该识别ECONNREFUSED', () => {
      const error = { code: 'ECONNREFUSED' }
      expect(isNetworkError(error)).toBe(true)
    })

    it('应该识别ENOTFOUND', () => {
      const error = { code: 'ENOTFOUND' }
      expect(isNetworkError(error)).toBe(true)
    })

    it('应该识别ECONNRESET', () => {
      const error = { code: 'ECONNRESET' }
      expect(isNetworkError(error)).toBe(true)
    })

    it('应该识别ETIMEDOUT', () => {
      const error = { code: 'ETIMEDOUT' }
      expect(isNetworkError(error)).toBe(true)
    })

    it('应该识别Network Error消息', () => {
      const error = { message: 'Network Error occurred' }
      expect(isNetworkError(error)).toBe(true)
    })

    it('应该识别fetch消息', () => {
      const error = { message: 'fetch failed' }
      expect(isNetworkError(error)).toBe(true)
    })

    it('应该在非网络错误时返回false', () => {
      const error = { code: 'OTHER_ERROR', message: 'other error' }
      expect(isNetworkError(error)).toBe(false)
    })

    it('应该在null/undefined时返回false', () => {
      expect(isNetworkError(null)).toBe(false)
      expect(isNetworkError(undefined)).toBe(false)
    })
  })

  describe('normalizeApiResponse', () => {
    it('应该处理axios响应格式', () => {
      const response = {
        data: {
          code: 200,
          data: { id: 1 },
          message: 'success',
        },
      }
      const result = normalizeApiResponse(response)
      expect(result.code).toBe(200)
      expect(result.data).toEqual({ id: 1 })
      expect(result.success).toBe(true)
    })

    it('应该处理字符串code', () => {
      const response = {
        data: {
          code: '200',
          data: { id: 1 },
        },
      }
      const result = normalizeApiResponse(response)
      expect(result.code).toBe(200)
    })

    it('应该处理code=10000为成功', () => {
      const response = {
        data: {
          code: 10000,
          data: { id: 1 },
        },
      }
      const result = normalizeApiResponse(response)
      expect(result.success).toBe(true)
    })

    it('应该处理code=0为成功', () => {
      const response = {
        data: {
          code: 0,
          data: { id: 1 },
        },
      }
      const result = normalizeApiResponse(response)
      expect(result.success).toBe(true)
    })

    it('应该处理非标准格式数据', () => {
      const response = {
        data: { id: 1 },
        status: 200,
      }
      const result = normalizeApiResponse(response)
      expect(result.code).toBe(200)
      expect(result.data).toEqual({ id: 1 })
      expect(result.success).toBe(true)
    })

    it('应该处理已经是标准格式的响应', () => {
      const response = {
        code: 200,
        data: { id: 1 },
        message: 'success',
      }
      const result = normalizeApiResponse(response)
      expect(result.code).toBe(200)
      expect(result.success).toBe(true)
    })

    it('应该处理原始值', () => {
      const result = normalizeApiResponse('raw data')
      expect(result.code).toBe(200)
      expect(result.data).toBe('raw data')
      expect(result.success).toBe(true)
    })

    it('应该使用msg字段作为message', () => {
      const response = {
        data: {
          code: 200,
          data: {},
          msg: '操作成功',
        },
      }
      const result = normalizeApiResponse(response)
      expect(result.message).toBe('操作成功')
    })
  })
})
