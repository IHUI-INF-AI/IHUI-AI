import { describe, it, expect } from 'vitest'
import { normalizeApiResponse, formatApiError, isApiSuccess } from '../apiResponseFormatter'

describe('apiResponseFormatter', () => {
  describe('normalizeApiResponse', () => {
    it('应该处理code=200的成功响应', () => {
      const result = normalizeApiResponse({ code: 200, data: { id: 1 }, msg: 'ok' })
      expect(result.code).toBe(200)
      expect(result.data).toEqual({ id: 1 })
      expect(result.success).toBe(true)
    })

    it('应该处理code=0的成功响应', () => {
      const result = normalizeApiResponse({ code: 0, data: 'test', msg: 'ok' })
      expect(result.success).toBe(true)
    })

    it('应该处理success=true的成功响应', () => {
      const result = normalizeApiResponse({ success: true, data: [1, 2, 3] })
      expect(result.success).toBe(true)
      expect(result.data).toEqual([1, 2, 3])
    })

    it('应该处理失败响应', () => {
      const result = normalizeApiResponse({ code: 500, msg: '服务器错误' })
      expect(result.code).toBe(500)
      expect(result.success).toBe(false)
      expect(result.msg).toBe('服务器错误')
    })

    it('应该处理message字段', () => {
      const result = normalizeApiResponse({ code: 200, data: null, message: '成功' })
      expect(result.msg).toBe('成功')
    })

    it('应该处理null响应', () => {
      const result = normalizeApiResponse(null)
      expect(result.code).toBe(500)
    })

    it('应该处理非对象响应', () => {
      const result = normalizeApiResponse('invalid')
      expect(result.code).toBe(500)
    })

    it('应该处理undefined响应', () => {
      const result = normalizeApiResponse(undefined)
      expect(result.code).toBe(500)
    })

    it('应该处理无code字段的失败响应', () => {
      const result = normalizeApiResponse({ data: null })
      expect(result.code).toBe(500)
      expect(result.success).toBe(false)
    })
  })

  describe('formatApiError', () => {
    it('应该处理Error对象', () => {
      const error = new Error('测试错误')
      expect(formatApiError(error)).toBe('测试错误')
    })

    it('应该处理字符串错误', () => {
      expect(formatApiError('字符串错误')).toBe('字符串错误')
    })

    it('应该处理其他类型错误', () => {
      expect(formatApiError({ code: 500 })).toBe('Unknown error')
      expect(formatApiError(null)).toBe('Unknown error')
      expect(formatApiError(undefined)).toBe('Unknown error')
    })
  })

  describe('isApiSuccess', () => {
    it('应该返回true当code=200', () => {
      expect(isApiSuccess({ code: 200, data: null, success: true } as any)).toBe(true)
    })

    it('应该返回true当code=0', () => {
      expect(isApiSuccess({ code: 0, data: null, success: true } as any)).toBe(true)
    })

    it('应该返回true当success=true', () => {
      expect(isApiSuccess({ code: 500, data: null, success: true } as any)).toBe(true)
    })

    it('应该返回false当失败', () => {
      expect(isApiSuccess({ code: 500, data: null, success: false } as any)).toBe(false)
      expect(isApiSuccess({ code: 404, data: null, success: false } as any)).toBe(false)
    })
  })
})
