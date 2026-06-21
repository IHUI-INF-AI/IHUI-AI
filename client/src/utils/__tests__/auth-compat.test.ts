import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  clearLoginDataCompletely,
  clearAllAuthData,
  hasLoginData,
  getStoredToken,
  setStoredToken,
  clearStoredToken,
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

  describe('hasLoginData', () => {
    it('应该返回true当有token时', () => {
      localStorageMock['token'] = 'test-token'

      expect(hasLoginData()).toBe(true)
    })

    it('应该返回true当有access_token时', () => {
      localStorageMock['access_token'] = 'test-access'

      expect(hasLoginData()).toBe(true)
    })

    it('应该返回false当没有token时', () => {
      expect(hasLoginData()).toBe(false)
    })

    it('应该在非浏览器环境返回false', () => {
      const originalWindow = global.window
      Object.defineProperty(global, 'window', { value: undefined, writable: true })

      expect(hasLoginData()).toBe(false)

      Object.defineProperty(global, 'window', { value: originalWindow, writable: true })
    })
  })

  describe('getStoredToken', () => {
    it('应该从localStorage获取token', () => {
      localStorageMock['token'] = 'test-token'

      expect(getStoredToken()).toBe('test-token')
    })

    it('应该从localStorage获取access_token', () => {
      localStorageMock['access_token'] = 'test-access'

      expect(getStoredToken()).toBe('test-access')
    })

    it('应该从sessionStorage获取token', () => {
      sessionStorageMock['token'] = 'session-token'

      expect(getStoredToken()).toBe('session-token')
    })

    it('应该返回null当没有token时', () => {
      expect(getStoredToken()).toBeNull()
    })

    it('应该在非浏览器环境返回null', () => {
      const originalWindow = global.window
      Object.defineProperty(global, 'window', { value: undefined, writable: true })

      expect(getStoredToken()).toBeNull()

      Object.defineProperty(global, 'window', { value: originalWindow, writable: true })
    })
  })

  describe('setStoredToken', () => {
    it('应该存储到localStorage当remember为true', () => {
      setStoredToken('test-token', true)

      expect(localStorageMock['token']).toBe('test-token')
    })

    it('应该存储到sessionStorage当remember为false', () => {
      setStoredToken('test-token', false)

      expect(sessionStorageMock['token']).toBe('test-token')
    })

    it('应该默认存储到sessionStorage', () => {
      setStoredToken('test-token')

      expect(sessionStorageMock['token']).toBe('test-token')
    })

    it('应该在非浏览器环境不执行', () => {
      const originalWindow = global.window
      Object.defineProperty(global, 'window', { value: undefined, writable: true })

      expect(() => setStoredToken('test-token')).not.toThrow()

      Object.defineProperty(global, 'window', { value: originalWindow, writable: true })
    })
  })

  describe('clearStoredToken', () => {
    it('应该清除所有token', () => {
      localStorageMock['token'] = 'test-token'
      localStorageMock['access_token'] = 'test-access'
      sessionStorageMock['token'] = 'session-token'

      clearStoredToken()

      expect(localStorageMock['token']).toBeUndefined()
      expect(localStorageMock['access_token']).toBeUndefined()
      expect(sessionStorageMock['token']).toBeUndefined()
    })

    it('应该在非浏览器环境不执行', () => {
      const originalWindow = global.window
      Object.defineProperty(global, 'window', { value: undefined, writable: true })

      expect(() => clearStoredToken()).not.toThrow()

      Object.defineProperty(global, 'window', { value: originalWindow, writable: true })
    })
  })
})
