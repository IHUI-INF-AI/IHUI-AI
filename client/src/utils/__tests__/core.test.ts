import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TokenManager, ConfigManager, ErrorHandler, isDemoMode, normalizeApiResponse, clearAllAuthData } from '../core'

vi.mock('../logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}))

const mockLocalStorage = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      store = {}
    }),
  }
})()

const mockSessionStorage = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      store = {}
    }),
  }
})()

Object.defineProperty(global, 'localStorage', { value: mockLocalStorage })
Object.defineProperty(global, 'sessionStorage', { value: mockSessionStorage })

describe('core', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLocalStorage.clear()
    mockSessionStorage.clear()
  })

  describe('TokenManager', () => {
    it('getToken应该返回null当没有token时', () => {
      expect(TokenManager.getToken()).toBeNull()
    })

    it('setToken应该设置token', () => {
      TokenManager.setToken('test-token')
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('user_token', 'test-token')
    })

    it('setToken应该设置refreshToken', () => {
      TokenManager.setToken('test-token', 'test-refresh-token')
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('refresh_token', 'test-refresh-token')
    })

    it('getRefreshToken应该返回refreshToken', () => {
      mockLocalStorage.getItem.mockReturnValue('test-refresh-token')
      expect(TokenManager.getRefreshToken()).toBe('test-refresh-token')
    })

    it('clearTokens应该清除所有token', () => {
      TokenManager.clearTokens()
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('user_token')
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('refresh_token')
      expect(mockSessionStorage.removeItem).toHaveBeenCalledWith('user_token')
    })

    it('getUuid应该返回uuid', () => {
      mockLocalStorage.getItem.mockReturnValue('test-uuid')
      expect(TokenManager.getUuid()).toBe('test-uuid')
    })

    it('isTokenValid应该返回true当没有过期时间时', () => {
      mockLocalStorage.getItem.mockReturnValue(null)
      expect(TokenManager.isTokenValid()).toBe(true)
    })

    it('isTokenValid应该返回true当未过期时', () => {
      mockLocalStorage.getItem.mockReturnValue((Date.now() + 10000).toString())
      expect(TokenManager.isTokenValid()).toBe(true)
    })

    it('isTokenValid应该返回false当已过期时', () => {
      mockLocalStorage.getItem.mockReturnValue((Date.now() - 10000).toString())
      expect(TokenManager.isTokenValid()).toBe(false)
    })

    it('setTokenExpiry应该设置过期时间', () => {
      TokenManager.setTokenExpiry(Date.now() + 10000)
      expect(mockLocalStorage.setItem).toHaveBeenCalled()
    })
  })

  describe('ConfigManager', () => {
    it('getApiConfig应该返回API配置', () => {
      const config = ConfigManager.getApiConfig()
      expect(config.baseURL).toBeDefined()
      expect(config.retryCount).toBe(3)
      expect(config.timeout).toBe(30000)
    })

    it('setLogger应该能够设置logger', () => {
      ConfigManager.setLogger({})
    })

    it('getAll应该返回所有配置', () => {
      const config = ConfigManager.getAll()
      expect(typeof config).toBe('object')
    })

    it('set和get应该能够设置和获取配置', () => {
      ConfigManager.set('testKey', 'testValue')
      expect(ConfigManager.get('testKey')).toBe('testValue')
    })
  })

  describe('ErrorHandler', () => {
    it('handleAndShow应该处理错误', () => {
      ErrorHandler.handleAndShow(new Error('test error'))
    })
  })

  describe('isDemoMode', () => {
    it('应该返回布尔值', () => {
      const result = isDemoMode()
      expect(typeof result).toBe('boolean')
    })
  })

  describe('normalizeApiResponse', () => {
    it('应该处理null响应', () => {
      const result = normalizeApiResponse(null)
      expect(result.data).toBeNull()
      expect(result.error).toBe('Invalid response format')
    })

    it('应该处理成功响应', () => {
      const result = normalizeApiResponse({ success: true, data: 'test-data' })
      expect(result.data).toBe('test-data')
      expect(result.error).toBeNull()
    })

    it('应该处理code=200响应', () => {
      const result = normalizeApiResponse({ code: 200, data: 'test-data' })
      expect(result.data).toBe('test-data')
      expect(result.error).toBeNull()
    })

    it('应该处理失败响应', () => {
      const result = normalizeApiResponse({ success: false, message: 'error message' })
      expect(result.data).toBeNull()
      expect(result.error).toBe('error message')
    })

    it('应该处理未知错误', () => {
      const result = normalizeApiResponse({ success: false })
      expect(result.data).toBeNull()
      expect(result.error).toBe('Unknown error')
    })
  })

  describe('clearAllAuthData', () => {
    it('应该清除所有认证数据', () => {
      clearAllAuthData()
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('token')
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('refreshToken')
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('user')
      expect(mockSessionStorage.removeItem).toHaveBeenCalledWith('token')
      expect(mockSessionStorage.removeItem).toHaveBeenCalledWith('user')
    })
  })
})
