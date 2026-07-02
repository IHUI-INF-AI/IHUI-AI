import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  clearLoginDataCompletely,
  clearAllAuthData,
} from '../auth-compat'

vi.mock('../logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() }
}))

describe('auth-compat', () => {
  let localStorageMock: Record<string, string>
  let sessionStorageMock: Record<string, string>

  beforeEach(() => {
    localStorageMock = {}
    sessionStorageMock = {}

    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: (key: string) => localStorageMock[key] || null,
        setItem: (key: string, value: string) => { localStorageMock[key] = value },
        removeItem: (key: string) => { delete localStorageMock[key] },
        clear: () => { localStorageMock = {} },
        get length() { return Object.keys(localStorageMock).length },
        key: (index: number) => Object.keys(localStorageMock)[index] || null,
      },
      writable: true,
      configurable: true,
    })

    Object.defineProperty(window, 'sessionStorage', {
      value: {
        getItem: (key: string) => sessionStorageMock[key] || null,
        setItem: (key: string, value: string) => { sessionStorageMock[key] = value },
        removeItem: (key: string) => { delete sessionStorageMock[key] },
        clear: () => { sessionStorageMock = {} },
        get length() { return Object.keys(sessionStorageMock).length },
        key: (index: number) => Object.keys(sessionStorageMock)[index] || null,
      },
      writable: true,
      configurable: true,
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('clearLoginDataCompletely', () => {
    it('应该清除所有登录数据', () => {
      localStorageMock['token'] = 'test-token'
      localStorageMock['access_token'] = 'test-access'
      localStorageMock['user_info'] = 'test-user'

      clearLoginDataCompletely()

      expect(localStorageMock['token']).toBeUndefined()
      expect(localStorageMock['access_token']).toBeUndefined()
      expect(localStorageMock['user_info']).toBeUndefined()
    })

    it('应该在非浏览器环境不执行', () => {
      const originalWindow = global.window
      Object.defineProperty(global, 'window', { value: undefined, writable: true })

      expect(() => clearLoginDataCompletely()).not.toThrow()

      Object.defineProperty(global, 'window', { value: originalWindow, writable: true })
    })
  })

  describe('clearAllAuthData', () => {
    it('应该是clearLoginDataCompletely的别名', () => {
      localStorageMock['token'] = 'test-token'

      clearAllAuthData()

      expect(localStorageMock['token']).toBeUndefined()
    })
  })
})
