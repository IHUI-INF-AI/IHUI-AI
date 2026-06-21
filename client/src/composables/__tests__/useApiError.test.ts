import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useApiError } from '../useApiError'

vi.mock('@/utils/errorHandler', () => ({
  withRetry: vi.fn((fn) => fn()),
  ErrorType: {
    NETWORK: 'NETWORK',
    UNAUTHORIZED: 'UNAUTHORIZED',
    FORBIDDEN: 'FORBIDDEN',
    VALIDATION: 'VALIDATION',
    SERVER_ERROR: 'SERVER_ERROR',
    UNKNOWN: 'UNKNOWN',
  },
  handleApiError: vi.fn((err) => ({
    type: 'UNKNOWN',
    code: 500,
    message: err instanceof Error ? err.message : 'Unknown error',
  })),
  handleApiResponse: vi.fn((response) => {
    if (response.code === 200 || response.success) {
      return response.data
    }
    return null
  }),
}))

describe('useApiError', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('应该返回错误状态和方法', () => {
    const { error, loading, handleError, handleResponse, execute, executeWithRetry, clearError } = useApiError()
    expect(error.value).toBeNull()
    expect(loading.value).toBe(false)
    expect(typeof handleError).toBe('function')
    expect(typeof handleResponse).toBe('function')
    expect(typeof execute).toBe('function')
    expect(typeof executeWithRetry).toBe('function')
    expect(typeof clearError).toBe('function')
  })

  describe('handleError', () => {
    it('应该处理错误', () => {
      const { error, handleError } = useApiError()
      const apiError = handleError(new Error('test error'))
      expect(apiError).toBeDefined()
      expect(error.value).toBeDefined()
    })
  })

  describe('handleResponse', () => {
    it('应该处理成功响应', () => {
      const { error, handleResponse } = useApiError()
      const response = { code: 200, data: { id: 1 }, success: true }
      const result = handleResponse(response)
      expect(result).toEqual({ id: 1 })
      expect(error.value).toBeNull()
    })

    it('应该处理失败响应', () => {
      const { error, handleResponse } = useApiError()
      const response = { code: 400, message: 'Bad Request', data: null }
      const result = handleResponse(response)
      expect(result).toBeNull()
      expect(error.value).toBeDefined()
    })
  })

  describe('execute', () => {
    it('应该执行API调用并返回数据', async () => {
      const { error, loading, execute } = useApiError()
      const apiCall = vi.fn().mockResolvedValue({ code: 200, data: { id: 1 }, success: true })
      
      const result = await execute(apiCall)
      
      expect(result).toEqual({ id: 1 })
      expect(error.value).toBeNull()
      expect(loading.value).toBe(false)
    })

    it('应该处理API调用错误', async () => {
      const { error, execute } = useApiError()
      const apiCall = vi.fn().mockRejectedValue(new Error('Network error'))
      
      const result = await execute(apiCall)
      
      expect(result).toBeNull()
      expect(error.value).toBeDefined()
    })

    it('应该处理失败响应', async () => {
      const { error, execute } = useApiError()
      const apiCall = vi.fn().mockResolvedValue({ code: 400, message: 'Bad Request', data: null })
      
      const result = await execute(apiCall)
      
      expect(result).toBeNull()
      expect(error.value).toBeDefined()
    })
  })

  describe('executeWithRetry', () => {
    it('应该执行带重试的API调用', async () => {
      const { error, executeWithRetry } = useApiError()
      const apiCall = vi.fn().mockResolvedValue({ code: 200, data: { id: 1 }, success: true })
      
      const result = await executeWithRetry(apiCall)
      
      expect(result).toEqual({ id: 1 })
      expect(error.value).toBeNull()
    })

    it('应该处理重试失败', async () => {
      const { error, executeWithRetry } = useApiError()
      const apiCall = vi.fn().mockRejectedValue(new Error('Network error'))
      
      const result = await executeWithRetry(apiCall)
      
      expect(result).toBeNull()
      expect(error.value).toBeDefined()
    })
  })

  describe('clearError', () => {
    it('应该清除错误', () => {
      const { error, handleError, clearError } = useApiError()
      handleError(new Error('test error'))
      expect(error.value).toBeDefined()
      
      clearError()
      
      expect(error.value).toBeNull()
    })
  })
})
