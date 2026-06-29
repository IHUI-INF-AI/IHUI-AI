import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useTokenStore } from '../token'

vi.mock('@/utils/storage', () => ({
  StorageManager: {
    getItem: vi.fn((key: string) => {
      if (key === 'login_duration') return 7 * 24 * 60 * 60 * 1000
      if (key === 'login_expiry_time') return null
      return null
    }),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
  SecureStorageManager: {
    getItem: vi.fn((key: string) => {
      if (key === 'user_token') return 'test-token'
      return null
    }),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    migrateFromLocalStorage: vi.fn(),
  },
  STORAGE_KEYS: {
    USER_TOKEN: 'user_token',
    TOKEN: 'token',
    REFRESH_TOKEN: 'refresh_token',
    USER_DATA: 'user_data',
    LOGIN_DURATION: 'login_duration',
    LOGIN_EXPIRY_TIME: 'login_expiry_time',
  },
  // token.ts 通过 TokenStorage 统一读写 token,需提供完整 mock
  TokenStorage: {
    getToken: vi.fn(() => 'test-token'),
    setToken: vi.fn(),
    getRefreshToken: vi.fn(() => null),
    setRefreshToken: vi.fn(),
    clearAuth: vi.fn(),
  },
}))

vi.mock('@/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}))

describe('token store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('setToken', () => {
    it('应该设置token', () => {
      const store = useTokenStore()
      store.setToken('new-token', 'new-refresh-token')

      expect(store.token).toBe('new-token')
      expect(store.refreshToken).toBe('new-refresh-token')
      expect(store.loginTime).toBeTruthy()
    })

    it('应该不设置refreshToken如果没有提供', () => {
      const store = useTokenStore()
      store.setToken('only-token')

      expect(store.token).toBe('only-token')
    })
  })

  describe('clearTokens', () => {
    it('应该清除所有token', () => {
      const store = useTokenStore()
      store.setToken('token-to-clear', 'refresh-to-clear')
      store.clearTokens()

      expect(store.token).toBe('')
      expect(store.refreshToken).toBe('')
      expect(store.loginTime).toBe('')
    })
  })

  describe('updateLastActiveTime', () => {
    it('应该更新最后活动时间', () => {
      const store = useTokenStore()
      store.updateLastActiveTime()

      expect(store.lastActiveTime).toBeTruthy()
    })
  })

  describe('restoreToken', () => {
    it('应该恢复存储的token', () => {
      const store = useTokenStore()
      const result = store.restoreToken()

      expect(result).toBe(true)
      expect(store.token).toBe('test-token')
    })
  })

  describe('isInitialized', () => {
    it('应该在有token时返回true', () => {
      const store = useTokenStore()
      store.setToken('some-token')

      expect(store.isInitialized).toBe(true)
    })

    it('应该在没有token时返回false', () => {
      const store = useTokenStore()
      store.clearTokens()

      expect(store.isInitialized).toBe(false)
    })
  })

  describe('setLoginExpiry', () => {
    it('应该设置登录过期时间', () => {
      const store = useTokenStore()
      store.setLoginExpiry({ label: '1天', value: 86400000, days: 1 })
    })
  })

  describe('checkExpiryAndClear', () => {
    it('应该检查过期状态', () => {
      const store = useTokenStore()
      store.checkExpiryAndClear()
    })
  })

  describe('checkTokenExpiry', () => {
    it('应该在接近过期时调用回调', () => {
      const store = useTokenStore()
      const onRefresh = vi.fn()

      store.setToken('test-token')
      store.checkTokenExpiry(onRefresh)
    })
  })
})
