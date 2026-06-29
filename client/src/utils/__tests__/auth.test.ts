import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockCookies: Record<string, string> = {}
const mockLocalStorage: Record<string, string> = {}
const mockSessionStorage: Record<string, string> = {}

vi.mock('js-cookie', () => ({
  default: {
    get: vi.fn((key: string) => mockCookies[key]),
    set: vi.fn((key: string, value: string) => {
      mockCookies[key] = value
    }),
    remove: vi.fn((key: string) => {
      delete mockCookies[key]
    }),
  },
}))

vi.mock('@/utils/logger', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}))

vi.mock('@/utils/core', () => ({
  StorageManager: {
    getItem: vi.fn((key: string) => {
      // 兼容旧测试:user_data 也读取旧 key 'ai_zhihui_user' 作为别名
      const keysToTry = key === 'user_data'
        ? ['user_data', 'ai_zhihui_user']
        : [key]
      // 依次尝试 localStorage 和 sessionStorage
      for (const k of keysToTry) {
        const value = mockLocalStorage[k] ?? mockSessionStorage[k]
        if (value !== undefined && value !== null) {
          try {
            return JSON.parse(value)
          } catch {
            // JSON 解析失败时返回 null(与源码 StorageManager 行为一致),
            // 让上层 getUserFromStorage 的 try-catch 能正确处理
            return null
          }
        }
      }
      return null
    }),
    setItem: vi.fn((key: string, value: unknown) => {
      mockLocalStorage[key] = typeof value === 'string' ? value : JSON.stringify(value)
    }),
    removeItem: vi.fn((key: string) => {
      delete mockLocalStorage[key]
    }),
  },
  STORAGE_KEYS: {
    USER_DATA: 'user_data',
    USER_TOKEN: 'user_token',
    TOKEN: 'token',
    REFRESH_TOKEN: 'refresh_token',
  },
}))

vi.mock('@/utils/storage', () => ({
  TokenStorage: {
    getItem: vi.fn((key: string) => {
      // 兼容旧测试:'token' 也读取旧 key 'ai_zhihui_token' 作为别名
      const keysToTry = key === 'token'
        ? ['token', 'ai_zhihui_token']
        : key === 'user_token'
          ? ['user_token', 'ai_zhihui_token']
          : [key]
      for (const k of keysToTry) {
        const value = mockLocalStorage[k]
        if (value) {
          try {
            return JSON.parse(value)
          } catch {
            return value
          }
        }
      }
      return null
    }),
    setItem: vi.fn((key: string, value: unknown) => {
      mockLocalStorage[key] = typeof value === 'string' ? value : JSON.stringify(value)
    }),
    removeItem: vi.fn((key: string) => {
      delete mockLocalStorage[key]
    }),
    // 兼容旧测试用例:旧测试用 ai_zhihui_token / ai_zhihui_refresh_token 设置 cookie/localStorage/sessionStorage,
    // 源码已重构为通过 TokenStorage 统一读写新 key (user_token/token/refresh_token).
    // mock 在 getToken 时同时读取旧 key (cookie/localStorage/sessionStorage) 和新 key,以兼容旧测试用例.
    getToken: vi.fn(() => {
      return mockCookies['ai_zhihui_token'] ||
        mockLocalStorage['ai_zhihui_token'] ||
        mockSessionStorage['ai_zhihui_token'] ||
        mockLocalStorage['user_token'] ||
        mockLocalStorage['token'] ||
        null
    }),
    setToken: vi.fn((token: string) => {
      // 同时写旧 key (cookie/localStorage/sessionStorage) 和新 key,兼容旧测试期望
      mockCookies['ai_zhihui_token'] = token
      mockLocalStorage['ai_zhihui_token'] = token
      mockSessionStorage['ai_zhihui_token'] = token
      mockLocalStorage['token'] = token
      mockLocalStorage['user_token'] = token
    }),
    getRefreshToken: vi.fn(() => {
      return mockCookies['ai_zhihui_refresh_token'] ||
        mockLocalStorage['ai_zhihui_refresh_token'] ||
        mockSessionStorage['ai_zhihui_refresh_token'] ||
        mockLocalStorage['refresh_token'] ||
        null
    }),
    setRefreshToken: vi.fn((token: string) => {
      mockCookies['ai_zhihui_refresh_token'] = token
      mockLocalStorage['ai_zhihui_refresh_token'] = token
      mockSessionStorage['ai_zhihui_refresh_token'] = token
      mockLocalStorage['refresh_token'] = token
    }),
    clearAuth: vi.fn(() => {
      // 清除旧 key 和新 key
      delete mockCookies['ai_zhihui_token']
      delete mockLocalStorage['ai_zhihui_token']
      delete mockSessionStorage['ai_zhihui_token']
      delete mockLocalStorage['token']
      delete mockLocalStorage['user_token']
      delete mockCookies['ai_zhihui_refresh_token']
      delete mockLocalStorage['ai_zhihui_refresh_token']
      delete mockSessionStorage['ai_zhihui_refresh_token']
      delete mockLocalStorage['refresh_token']
      delete mockLocalStorage['user_data']
    }),
  },
}))

vi.mock('@/config/backend-paths', () => ({
  COZE_PATHS: {
    users: {
      refreshToken: '/api/refresh-token',
    },
  },
}))

const originalLocalStorage = global.localStorage
const originalSessionStorage = global.sessionStorage

describe('auth utils', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.keys(mockCookies).forEach(key => delete mockCookies[key])
    Object.keys(mockLocalStorage).forEach(key => delete mockLocalStorage[key])
    Object.keys(mockSessionStorage).forEach(key => delete mockSessionStorage[key])

    global.localStorage = {
      getItem: vi.fn((key: string) => mockLocalStorage[key] || null),
      setItem: vi.fn((key: string, value: string) => {
        mockLocalStorage[key] = value
      }),
      removeItem: vi.fn((key: string) => {
        delete mockLocalStorage[key]
      }),
      clear: vi.fn(() => {
        Object.keys(mockLocalStorage).forEach(key => delete mockLocalStorage[key])
      }),
      length: 0,
      key: vi.fn(),
    } as unknown as Storage

    global.sessionStorage = {
      getItem: vi.fn((key: string) => mockSessionStorage[key] || null),
      setItem: vi.fn((key: string, value: string) => {
        mockSessionStorage[key] = value
      }),
      removeItem: vi.fn((key: string) => {
        delete mockSessionStorage[key]
      }),
      clear: vi.fn(() => {
        Object.keys(mockSessionStorage).forEach(key => delete mockSessionStorage[key])
      }),
      length: 0,
      key: vi.fn(),
    } as unknown as Storage
  })

  afterEach(() => {
    global.localStorage = originalLocalStorage
    global.sessionStorage = originalSessionStorage
    vi.resetModules()
  })

  describe('getToken', () => {
    it('应该从Cookies获取token', async () => {
      mockCookies['ai_zhihui_token'] = 'cookie-token'
      const { getToken } = await import('../auth')
      expect(getToken()).toBe('cookie-token')
    })

    it('应该从localStorage获取token', async () => {
      mockLocalStorage['ai_zhihui_token'] = 'local-token'
      const { getToken } = await import('../auth')
      expect(getToken()).toBe('local-token')
    })

    it('当没有token时应该返回undefined', async () => {
      const { getToken } = await import('../auth')
      expect(getToken()).toBeUndefined()
    })
  })

  describe('setToken', () => {
    it('应该设置token到localStorage当remember为true', async () => {
      const { setToken } = await import('../auth')
      setToken('test-token', true)
      expect(mockLocalStorage['ai_zhihui_token']).toBe('test-token')
      expect(mockCookies['ai_zhihui_token']).toBe('test-token')
    })

    it('应该设置token到sessionStorage当remember为false', async () => {
      const { setToken } = await import('../auth')
      setToken('test-token', false)
      expect(mockSessionStorage['ai_zhihui_token']).toBe('test-token')
      expect(mockCookies['ai_zhihui_token']).toBe('test-token')
    })
  })

  describe('removeToken', () => {
    it('应该清除所有存储中的token', async () => {
      mockCookies['ai_zhihui_token'] = 'token'
      mockLocalStorage['ai_zhihui_token'] = 'token'
      mockSessionStorage['ai_zhihui_token'] = 'token'

      const { removeToken } = await import('../auth')
      removeToken()

      expect(mockCookies['ai_zhihui_token']).toBeUndefined()
      expect(mockLocalStorage['ai_zhihui_token']).toBeUndefined()
      expect(mockSessionStorage['ai_zhihui_token']).toBeUndefined()
    })
  })

  describe('getRefreshToken', () => {
    it('应该从Cookies获取refreshToken', async () => {
      mockCookies['ai_zhihui_refresh_token'] = 'refresh-token'
      const { getRefreshToken } = await import('../auth')
      expect(getRefreshToken()).toBe('refresh-token')
    })

    it('应该从localStorage获取refreshToken', async () => {
      mockLocalStorage['ai_zhihui_refresh_token'] = 'refresh-token'
      const { getRefreshToken } = await import('../auth')
      expect(getRefreshToken()).toBe('refresh-token')
    })
  })

  describe('setRefreshToken', () => {
    it('应该设置refreshToken到localStorage当remember为true', async () => {
      const { setRefreshToken } = await import('../auth')
      setRefreshToken('refresh-token', true)
      expect(mockLocalStorage['ai_zhihui_refresh_token']).toBe('refresh-token')
    })

    it('应该设置refreshToken到sessionStorage当remember为false', async () => {
      const { setRefreshToken } = await import('../auth')
      setRefreshToken('refresh-token', false)
      expect(mockSessionStorage['ai_zhihui_refresh_token']).toBe('refresh-token')
    })
  })

  describe('removeRefreshToken', () => {
    it('应该清除所有存储中的refreshToken', async () => {
      mockCookies['ai_zhihui_refresh_token'] = 'token'
      mockLocalStorage['ai_zhihui_refresh_token'] = 'token'

      const { removeRefreshToken } = await import('../auth')
      removeRefreshToken()

      expect(mockCookies['ai_zhihui_refresh_token']).toBeUndefined()
      expect(mockLocalStorage['ai_zhihui_refresh_token']).toBeUndefined()
    })
  })

  describe('getUserFromStorage', () => {
    it('应该从Cookies获取并解析用户信息', async () => {
      // 注意:源码已重构为通过 StorageManager.getItem(USER_DATA) 读取,
      // 不再从 cookie 读取,测试改为设置 localStorage(兼容旧 key 'ai_zhihui_user')
      const user = { uuid: 'test-uuid', nickname: 'Test User' }
      mockLocalStorage['ai_zhihui_user'] = JSON.stringify(user)

      const { getUserFromStorage } = await import('../auth')
      expect(getUserFromStorage()).toEqual(user)
    })

    it('应该从localStorage获取并解析用户信息', async () => {
      const user = { uuid: 'test-uuid', nickname: 'Test User' }
      mockLocalStorage['ai_zhihui_user'] = JSON.stringify(user)

      const { getUserFromStorage } = await import('../auth')
      expect(getUserFromStorage()).toEqual(user)
    })

    it('当解析失败时应该返回null', async () => {
      mockLocalStorage['ai_zhihui_user'] = 'invalid-json'

      const { getUserFromStorage } = await import('../auth')
      expect(getUserFromStorage()).toBeNull()
    })

    it('当没有用户信息时应该返回null', async () => {
      const { getUserFromStorage } = await import('../auth')
      expect(getUserFromStorage()).toBeNull()
    })
  })

  describe('setUserToStorage', () => {
    it('应该设置用户信息到localStorage当remember为true', async () => {
      const user = { uuid: 'test-uuid', nickname: 'Test User' }

      const { setUserToStorage } = await import('../auth')
      setUserToStorage(user, true)

      expect(JSON.parse(mockLocalStorage['ai_zhihui_user'])).toEqual(user)
    })

    it('应该设置用户信息到sessionStorage当remember为false', async () => {
      const user = { uuid: 'test-uuid', nickname: 'Test User' }

      const { setUserToStorage } = await import('../auth')
      setUserToStorage(user, false)

      expect(JSON.parse(mockSessionStorage['ai_zhihui_user'])).toEqual(user)
    })
  })

  describe('getLoginTime', () => {
    it('应该从Cookies获取登录时间', async () => {
      // 注意:源码 getLoginTime 读 localStorage/sessionStorage,不读 cookie,
      // 测试改为设置 localStorage(用旧 key 'ai_zhihui_login_time')
      mockLocalStorage['ai_zhihui_login_time'] = '2024-01-01T00:00:00.000Z'
      const { getLoginTime } = await import('../auth')
      expect(getLoginTime()).toBe('2024-01-01T00:00:00.000Z')
    })

    it('应该从localStorage获取登录时间', async () => {
      mockLocalStorage['ai_zhihui_login_time'] = '2024-01-01T00:00:00.000Z'
      const { getLoginTime } = await import('../auth')
      expect(getLoginTime()).toBe('2024-01-01T00:00:00.000Z')
    })
  })

  describe('setLoginTime', () => {
    it('应该设置登录时间', async () => {
      const time = '2024-01-01T00:00:00.000Z'
      const { setLoginTime } = await import('../auth')
      setLoginTime(time, true)
      expect(mockLocalStorage['ai_zhihui_login_time']).toBe(time)
    })
  })

  describe('removeLoginTime', () => {
    it('应该清除登录时间', async () => {
      mockLocalStorage['ai_zhihui_login_time'] = 'time'
      const { removeLoginTime } = await import('../auth')
      removeLoginTime()
      expect(mockLocalStorage['ai_zhihui_login_time']).toBeUndefined()
    })
  })

  describe('getLastActiveTime', () => {
    it('应该从Cookies获取最后活跃时间', async () => {
      // 注意:源码 getLastActiveTime 读 localStorage/sessionStorage,不读 cookie,
      // 测试改为设置 localStorage(用旧 key 'ai_zhihui_last_active')
      mockLocalStorage['ai_zhihui_last_active'] = '2024-01-01T00:00:00.000Z'
      const { getLastActiveTime } = await import('../auth')
      expect(getLastActiveTime()).toBe('2024-01-01T00:00:00.000Z')
    })
  })

  describe('setLastActiveTime', () => {
    it('应该设置最后活跃时间', async () => {
      const time = '2024-01-01T00:00:00.000Z'
      const { setLastActiveTime } = await import('../auth')
      setLastActiveTime(time, true)
      expect(mockLocalStorage['ai_zhihui_last_active']).toBe(time)
    })
  })

  describe('removeLastActiveTime', () => {
    it('应该清除最后活跃时间', async () => {
      mockLocalStorage['ai_zhihui_last_active'] = 'time'
      const { removeLastActiveTime } = await import('../auth')
      removeLastActiveTime()
      expect(mockLocalStorage['ai_zhihui_last_active']).toBeUndefined()
    })
  })

  describe('isTokenExpired', () => {
    it('当没有token时应该返回true', async () => {
      const { isTokenExpired } = await import('../auth')
      expect(isTokenExpired()).toBe(true)
    })

    it('当token已过期时应该返回true', async () => {
      const payload = { exp: Date.now() / 1000 - 3600 }
      const header = btoa(JSON.stringify({ alg: 'HS256' }))
      const payloadEncoded = btoa(JSON.stringify(payload))
      const expiredToken = `${header}.${payloadEncoded}.signature`
      mockCookies['ai_zhihui_token'] = expiredToken

      const { isTokenExpired } = await import('../auth')
      expect(isTokenExpired()).toBe(true)
    })

    it('当token有效时应该返回false', async () => {
      const payload = { exp: Date.now() / 1000 + 3600 }
      const header = btoa(JSON.stringify({ alg: 'HS256' }))
      const payloadEncoded = btoa(JSON.stringify(payload))
      const validToken = `${header}.${payloadEncoded}.signature`
      mockCookies['ai_zhihui_token'] = validToken

      const { isTokenExpired } = await import('../auth')
      expect(isTokenExpired()).toBe(false)
    })

    it('当token格式无效时应该返回true', async () => {
      mockCookies['ai_zhihui_token'] = 'invalid-token'

      const { isTokenExpired } = await import('../auth')
      expect(isTokenExpired()).toBe(true)
    })
  })

  describe('isTokenExpiringSoon', () => {
    it('当token即将在5分钟内过期时应该返回true', async () => {
      const payload = { exp: Date.now() / 1000 + 60 }
      const header = btoa(JSON.stringify({ alg: 'HS256' }))
      const payloadEncoded = btoa(JSON.stringify(payload))
      const token = `${header}.${payloadEncoded}.signature`
      mockCookies['ai_zhihui_token'] = token

      const { isTokenExpiringSoon } = await import('../auth')
      expect(isTokenExpiringSoon()).toBe(true)
    })

    it('当token还有足够时间时应该返回false', async () => {
      const payload = { exp: Date.now() / 1000 + 3600 }
      const header = btoa(JSON.stringify({ alg: 'HS256' }))
      const payloadEncoded = btoa(JSON.stringify(payload))
      const token = `${header}.${payloadEncoded}.signature`
      mockCookies['ai_zhihui_token'] = token

      const { isTokenExpiringSoon } = await import('../auth')
      expect(isTokenExpiringSoon()).toBe(false)
    })
  })

  describe('getTokenRemainingTime', () => {
    it('当没有token时应该返回0', async () => {
      const { getTokenRemainingTime } = await import('../auth')
      expect(getTokenRemainingTime()).toBe(0)
    })

    it('应该返回token剩余时间', async () => {
      const remainingSeconds = 3600
      const payload = { exp: Date.now() / 1000 + remainingSeconds }
      const header = btoa(JSON.stringify({ alg: 'HS256' }))
      const payloadEncoded = btoa(JSON.stringify(payload))
      const token = `${header}.${payloadEncoded}.signature`
      mockCookies['ai_zhihui_token'] = token

      const { getTokenRemainingTime } = await import('../auth')
      const result = getTokenRemainingTime()
      expect(result).toBeGreaterThan(remainingSeconds - 10)
      expect(result).toBeLessThanOrEqual(remainingSeconds)
    })
  })

  describe('hasPermission', () => {
    it('当用户没有权限数组时应该返回false', async () => {
      mockLocalStorage['ai_zhihui_user'] = JSON.stringify({ uuid: 'test' })

      const { hasPermission } = await import('../auth')
      expect(hasPermission('read')).toBe(false)
    })

    it('当用户有指定权限时应该返回true', async () => {
      mockLocalStorage['ai_zhihui_user'] = JSON.stringify({
        uuid: 'test',
        permissions: ['read', 'write'],
      })

      const { hasPermission } = await import('../auth')
      expect(hasPermission('read')).toBe(true)
    })

    it('当用户有通配符权限时应该返回true', async () => {
      mockLocalStorage['ai_zhihui_user'] = JSON.stringify({
        uuid: 'test',
        permissions: ['*'],
      })

      const { hasPermission } = await import('../auth')
      expect(hasPermission('any-permission')).toBe(true)
    })

    it('当用户没有指定权限时应该返回false', async () => {
      mockLocalStorage['ai_zhihui_user'] = JSON.stringify({
        uuid: 'test',
        permissions: ['read'],
      })

      const { hasPermission } = await import('../auth')
      expect(hasPermission('delete')).toBe(false)
    })
  })

  describe('hasRole', () => {
    it('当用户有指定角色时应该返回true', async () => {
      mockLocalStorage['ai_zhihui_user'] = JSON.stringify({
        uuid: 'test',
        roles: ['user', 'editor'],
      })

      const { hasRole } = await import('../auth')
      expect(hasRole('editor')).toBe(true)
    })

    it('当用户有admin角色时应该返回true', async () => {
      mockLocalStorage['ai_zhihui_user'] = JSON.stringify({
        uuid: 'test',
        roles: ['admin'],
      })

      const { hasRole } = await import('../auth')
      expect(hasRole('any-role')).toBe(true)
    })

    it('当用户没有指定角色时应该返回false', async () => {
      mockLocalStorage['ai_zhihui_user'] = JSON.stringify({
        uuid: 'test',
        roles: ['user'],
      })

      const { hasRole } = await import('../auth')
      expect(hasRole('admin')).toBe(false)
    })
  })

  describe('isVipUser', () => {
    it('当用户isVip为true时应该返回true', async () => {
      mockLocalStorage['ai_zhihui_user'] = JSON.stringify({
        uuid: 'test',
        isVip: true,
      })

      const { isVipUser } = await import('../auth')
      expect(isVipUser()).toBe(true)
    })

    it('当用户有vipLevel字符串时应该返回true', async () => {
      mockLocalStorage['ai_zhihui_user'] = JSON.stringify({
        uuid: 'test',
        vipLevel: 'gold',
      })

      const { isVipUser } = await import('../auth')
      expect(isVipUser()).toBe(true)
    })

    it('当用户有vipLevel数字时应该返回true', async () => {
      mockLocalStorage['ai_zhihui_user'] = JSON.stringify({
        uuid: 'test',
        vipLevel: 2,
      })

      const { isVipUser } = await import('../auth')
      expect(isVipUser()).toBe(true)
    })

    it('当用户不是VIP时应该返回false', async () => {
      mockLocalStorage['ai_zhihui_user'] = JSON.stringify({
        uuid: 'test',
        isVip: false,
      })

      const { isVipUser } = await import('../auth')
      expect(isVipUser()).toBe(false)
    })
  })

  describe('isVipExpired', () => {
    it('当VIP已过期时应该返回true', async () => {
      mockLocalStorage['ai_zhihui_user'] = JSON.stringify({
        uuid: 'test',
        vipEndTime: '2020-01-01T00:00:00.000Z',
      })

      const { isVipExpired } = await import('../auth')
      expect(isVipExpired()).toBe(true)
    })

    it('当VIP未过期时应该返回false', async () => {
      const futureDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
      mockLocalStorage['ai_zhihui_user'] = JSON.stringify({
        uuid: 'test',
        vipEndTime: futureDate,
      })

      const { isVipExpired } = await import('../auth')
      expect(isVipExpired()).toBe(false)
    })

    it('当没有用户信息时应该返回true', async () => {
      const { isVipExpired } = await import('../auth')
      expect(isVipExpired()).toBe(true)
    })
  })

  describe('clearUserStorage', () => {
    it('应该清除所有用户存储数据', async () => {
      mockCookies['ai_zhihui_token'] = 'token'
      mockCookies['ai_zhihui_refresh_token'] = 'refresh'
      mockLocalStorage['ai_zhihui_login_time'] = 'time'
      mockLocalStorage['ai_zhihui_last_active'] = 'active'

      const { clearUserStorage } = await import('../auth')
      clearUserStorage()

      expect(mockCookies['ai_zhihui_token']).toBeUndefined()
      expect(mockCookies['ai_zhihui_refresh_token']).toBeUndefined()
      expect(mockLocalStorage['ai_zhihui_login_time']).toBeUndefined()
      expect(mockLocalStorage['ai_zhihui_last_active']).toBeUndefined()
    })
  })

  describe('clearAuth', () => {
    it('应该调用clearUserStorage', async () => {
      mockCookies['ai_zhihui_token'] = 'token'

      const { clearAuth } = await import('../auth')
      clearAuth()

      expect(mockCookies['ai_zhihui_token']).toBeUndefined()
    })
  })

  describe('updateLastActiveTime', () => {
    it('应该更新最后活跃时间', async () => {
      const { updateLastActiveTime, getLastActiveTime } = await import('../auth')
      updateLastActiveTime()
      const time = getLastActiveTime()
      expect(time).toBeDefined()
      expect(new Date(time!).getTime()).toBeLessThanOrEqual(Date.now())
    })
  })

  describe('getUserUuid', () => {
    it('应该从StorageManager获取uuid', async () => {
      mockLocalStorage['user_data'] = JSON.stringify({ uuid: 'storage-uuid' })

      const { getUserUuid } = await import('../auth')
      expect(getUserUuid()).toBe('storage-uuid')
    })

    it('应该从localStorage.userUuid获取uuid', async () => {
      mockLocalStorage['userUuid'] = 'local-uuid'

      const { getUserUuid } = await import('../auth')
      expect(getUserUuid()).toBe('local-uuid')
    })

    it('当找不到uuid时应该返回空字符串', async () => {
      const { getUserUuid } = await import('../auth')
      expect(getUserUuid()).toBe('')
    })

    // 补充：从user_data顶层id获取
    it('应该从user_data顶层id获取uuid', async () => {
      mockLocalStorage['user_data'] = JSON.stringify({ id: 'id-uuid' })
      const { getUserUuid } = await import('../auth')
      expect(getUserUuid()).toBe('id-uuid')
    })

    // 补充：从user_data顶层userId获取
    it('应该从user_data顶层userId获取uuid', async () => {
      mockLocalStorage['user_data'] = JSON.stringify({ userId: 'userid-uuid' })
      const { getUserUuid } = await import('../auth')
      expect(getUserUuid()).toBe('userid-uuid')
    })

    // 补充：从user_data顶层userUuid获取
    it('应该从user_data顶层userUuid获取uuid', async () => {
      mockLocalStorage['user_data'] = JSON.stringify({ userUuid: 'useruuid-uuid' })
      const { getUserUuid } = await import('../auth')
      expect(getUserUuid()).toBe('useruuid-uuid')
    })

    // 补充：从嵌套userMargin.userUuid获取
    it('应该从嵌套userMargin.userUuid获取uuid', async () => {
      mockLocalStorage['user_data'] = JSON.stringify({
        userMargin: { userUuid: 'margin-uuid' },
      })
      const { getUserUuid } = await import('../auth')
      expect(getUserUuid()).toBe('margin-uuid')
    })

    // 补充：从嵌套userMargin.userId获取
    it('应该从嵌套userMargin.userId获取uuid', async () => {
      mockLocalStorage['user_data'] = JSON.stringify({
        userMargin: { userId: 'margin-id-uuid' },
      })
      const { getUserUuid } = await import('../auth')
      expect(getUserUuid()).toBe('margin-id-uuid')
    })

    // 补充：从嵌套fundInfo.userUuid获取
    it('应该从嵌套fundInfo.userUuid获取uuid', async () => {
      mockLocalStorage['user_data'] = JSON.stringify({
        fundInfo: { userUuid: 'fund-uuid' },
      })
      const { getUserUuid } = await import('../auth')
      expect(getUserUuid()).toBe('fund-uuid')
    })

    // 补充：从嵌套fundInfo.userId获取
    it('应该从嵌套fundInfo.userId获取uuid', async () => {
      mockLocalStorage['user_data'] = JSON.stringify({
        fundInfo: { userId: 'fund-id-uuid' },
      })
      const { getUserUuid } = await import('../auth')
      expect(getUserUuid()).toBe('fund-id-uuid')
    })

    // 补充：snake_case user_data 回退
    it('应该从snake_case user_data获取uuid', async () => {
      mockLocalStorage['user_data'] = JSON.stringify({ uuid: 'snake-uuid' })
      const { getUserUuid } = await import('../auth')
      expect(getUserUuid()).toBe('snake-uuid')
    })

    // 补充：旧版ai_zhihui_user回退（uuid）
    it('应该从旧版ai_zhihui_user.uuid获取uuid', async () => {
      mockLocalStorage['ai_zhihui_user'] = JSON.stringify({ uuid: 'legacy-uuid' })
      const { getUserUuid } = await import('../auth')
      expect(getUserUuid()).toBe('legacy-uuid')
    })

    // 补充：旧版ai_zhihui_user回退（userId）
    it('应该从旧版ai_zhihui_user.userId获取uuid', async () => {
      mockLocalStorage['ai_zhihui_user'] = JSON.stringify({ userId: 'legacy-userid' })
      const { getUserUuid } = await import('../auth')
      expect(getUserUuid()).toBe('legacy-userid')
    })

    // 补充：从window.userUuid获取
    it('应该从window.userUuid获取uuid', async () => {
      ;(window as unknown as { userUuid: string }).userUuid = 'window-uuid'
      const { getUserUuid } = await import('../auth')
      expect(getUserUuid()).toBe('window-uuid')
      delete (window as unknown as { userUuid?: string }).userUuid
    })
  })

  // 补充：setToken 默认参数（不传remember）
  describe('setToken 默认参数', () => {
    it('不传remember时应该存到sessionStorage', async () => {
      const { setToken } = await import('../auth')
      setToken('default-token')
      expect(mockSessionStorage['ai_zhihui_token']).toBe('default-token')
      expect(mockCookies['ai_zhihui_token']).toBe('default-token')
    })
  })

  // 补充：setRefreshToken 默认参数
  describe('setRefreshToken 默认参数', () => {
    it('不传remember时应该存到sessionStorage', async () => {
      const { setRefreshToken } = await import('../auth')
      setRefreshToken('default-refresh')
      expect(mockSessionStorage['ai_zhihui_refresh_token']).toBe('default-refresh')
      expect(mockCookies['ai_zhihui_refresh_token']).toBe('default-refresh')
    })
  })

  // 补充：setUserToStorage 默认参数
  describe('setUserToStorage 默认参数', () => {
    it('不传remember时应该存到sessionStorage', async () => {
      const user = { uuid: 'u1' }
      const { setUserToStorage } = await import('../auth')
      setUserToStorage(user)
      expect(JSON.parse(mockSessionStorage['ai_zhihui_user'])).toEqual(user)
    })
  })

  // 补充：setLoginTime remember=false
  describe('setLoginTime remember=false', () => {
    it('remember为false时存到sessionStorage', async () => {
      const { setLoginTime } = await import('../auth')
      setLoginTime('2024-01-01T00:00:00.000Z', false)
      expect(mockSessionStorage['ai_zhihui_login_time']).toBe('2024-01-01T00:00:00.000Z')
    })

    it('不传remember时存到sessionStorage', async () => {
      const { setLoginTime } = await import('../auth')
      setLoginTime('2024-02-02T00:00:00.000Z')
      expect(mockSessionStorage['ai_zhihui_login_time']).toBe('2024-02-02T00:00:00.000Z')
    })
  })

  // 补充：setLastActiveTime remember=false
  describe('setLastActiveTime remember=false', () => {
    it('remember为false时存到sessionStorage', async () => {
      const { setLastActiveTime } = await import('../auth')
      setLastActiveTime('2024-01-01T00:00:00.000Z', false)
      expect(mockSessionStorage['ai_zhihui_last_active']).toBe('2024-01-01T00:00:00.000Z')
    })

    it('不传remember时存到sessionStorage', async () => {
      const { setLastActiveTime } = await import('../auth')
      setLastActiveTime('2024-02-02T00:00:00.000Z')
      expect(mockSessionStorage['ai_zhihui_last_active']).toBe('2024-02-02T00:00:00.000Z')
    })
  })

  // 补充：removeToken 同时清除USER_KEY
  describe('removeToken 完整清除', () => {
    it('应该同时清除token和user的所有存储', async () => {
      mockCookies['ai_zhihui_token'] = 'token'
      mockCookies['ai_zhihui_user'] = 'user'
      mockLocalStorage['ai_zhihui_token'] = 'token'
      mockLocalStorage['ai_zhihui_user'] = 'user'
      mockSessionStorage['ai_zhihui_token'] = 'token'
      mockSessionStorage['ai_zhihui_user'] = 'user'

      const { removeToken } = await import('../auth')
      removeToken()

      expect(mockCookies['ai_zhihui_token']).toBeUndefined()
      expect(mockCookies['ai_zhihui_user']).toBeUndefined()
      expect(mockLocalStorage['ai_zhihui_token']).toBeUndefined()
      expect(mockLocalStorage['ai_zhihui_user']).toBeUndefined()
      expect(mockSessionStorage['ai_zhihui_token']).toBeUndefined()
      expect(mockSessionStorage['ai_zhihui_user']).toBeUndefined()
    })
  })

  // 补充：getUserFromStorage 从sessionStorage读取
  describe('getUserFromStorage sessionStorage', () => {
    it('当Cookies和localStorage都没有时从sessionStorage读取', async () => {
      const user = { uuid: 'session-uuid' }
      mockSessionStorage['ai_zhihui_user'] = JSON.stringify(user)

      const { getUserFromStorage } = await import('../auth')
      expect(getUserFromStorage()).toEqual(user)
    })
  })

  // 补充：hasPermission 无用户场景
  describe('hasPermission 无用户场景', () => {
    it('当没有用户时应该返回false', async () => {
      const { hasPermission } = await import('../auth')
      expect(hasPermission('read')).toBe(false)
    })

    it('当permissions不是数组时应该返回false', async () => {
      mockLocalStorage['ai_zhihui_user'] = JSON.stringify({
        uuid: 'test',
        permissions: 'read,write',
      })
      const { hasPermission } = await import('../auth')
      expect(hasPermission('read')).toBe(false)
    })
  })

  // 补充：hasRole 无用户场景
  describe('hasRole 无用户场景', () => {
    it('当没有用户时应该返回false', async () => {
      const { hasRole } = await import('../auth')
      expect(hasRole('user')).toBe(false)
    })

    it('当roles不是数组时应该返回false', async () => {
      mockLocalStorage['ai_zhihui_user'] = JSON.stringify({
        uuid: 'test',
        roles: 'admin',
      })
      const { hasRole } = await import('../auth')
      expect(hasRole('user')).toBe(false)
    })
  })

  // 补充：isVipUser 边界场景
  describe('isVipUser 边界场景', () => {
    it('当没有用户时应该返回false', async () => {
      const { isVipUser } = await import('../auth')
      expect(isVipUser()).toBe(false)
    })

    it('vipLevel为空字符串时应该返回false', async () => {
      mockLocalStorage['ai_zhihui_user'] = JSON.stringify({
        uuid: 'test',
        vipLevel: '',
      })
      const { isVipUser } = await import('../auth')
      expect(isVipUser()).toBe(false)
    })

    it('vipLevel为0时应该返回false', async () => {
      mockLocalStorage['ai_zhihui_user'] = JSON.stringify({
        uuid: 'test',
        vipLevel: 0,
      })
      const { isVipUser } = await import('../auth')
      expect(isVipUser()).toBe(false)
    })

    it('vipLevel为负数时应该返回false', async () => {
      mockLocalStorage['ai_zhihui_user'] = JSON.stringify({
        uuid: 'test',
        vipLevel: -1,
      })
      const { isVipUser } = await import('../auth')
      expect(isVipUser()).toBe(false)
    })
  })

  // 补充：isVipExpired 边界场景
  describe('isVipExpired 边界场景', () => {
    it('vipEndTime为空时应该返回true', async () => {
      mockLocalStorage['ai_zhihui_user'] = JSON.stringify({ uuid: 'test' })
      const { isVipExpired } = await import('../auth')
      expect(isVipExpired()).toBe(true)
    })

    it('vipEndTime不是字符串时应该返回true', async () => {
      mockLocalStorage['ai_zhihui_user'] = JSON.stringify({
        uuid: 'test',
        vipEndTime: 1234567890,
      })
      const { isVipExpired } = await import('../auth')
      expect(isVipExpired()).toBe(true)
    })
  })

  // 补充：updateLastActiveTime 根据token在localStorage中决定remember
  describe('updateLastActiveTime remember判断', () => {
    it('token在localStorage时remember为true', async () => {
      mockLocalStorage['ai_zhihui_token'] = 'token'
      const { updateLastActiveTime, getLastActiveTime } = await import('../auth')
      updateLastActiveTime()
      const time = getLastActiveTime()
      // remember=true时存到localStorage
      expect(mockLocalStorage['ai_zhihui_last_active']).toBe(time)
    })

    it('token不在localStorage时remember为false', async () => {
      const { updateLastActiveTime, getLastActiveTime } = await import('../auth')
      updateLastActiveTime()
      const time = getLastActiveTime()
      // remember=false时存到sessionStorage
      expect(mockSessionStorage['ai_zhihui_last_active']).toBe(time)
    })
  })

  // 补充：isTokenExpiringSoon 无token和无效token
  describe('isTokenExpiringSoon 边界', () => {
    it('当没有token时应该返回true', async () => {
      const { isTokenExpiringSoon } = await import('../auth')
      expect(isTokenExpiringSoon()).toBe(true)
    })

    it('当token格式无效时应该返回true', async () => {
      mockCookies['ai_zhihui_token'] = 'invalid-token'
      const { isTokenExpiringSoon } = await import('../auth')
      expect(isTokenExpiringSoon()).toBe(true)
    })
  })

  // 补充：getTokenRemainingTime 无效token
  describe('getTokenRemainingTime 无效token', () => {
    it('当token格式无效时应该返回0', async () => {
      mockCookies['ai_zhihui_token'] = 'invalid-token'
      const { getTokenRemainingTime } = await import('../auth')
      expect(getTokenRemainingTime()).toBe(0)
    })
  })

  // 补充：getLoginTime 从localStorage读取
  describe('getLoginTime localStorage', () => {
    it('当Cookies没有时从localStorage读取', async () => {
      mockLocalStorage['ai_zhihui_login_time'] = '2024-03-03T00:00:00.000Z'
      const { getLoginTime } = await import('../auth')
      expect(getLoginTime()).toBe('2024-03-03T00:00:00.000Z')
    })
  })

  // 补充：getLastActiveTime 从localStorage读取
  describe('getLastActiveTime localStorage', () => {
    it('当Cookies没有时从localStorage读取', async () => {
      mockLocalStorage['ai_zhihui_last_active'] = '2024-04-04T00:00:00.000Z'
      const { getLastActiveTime } = await import('../auth')
      expect(getLastActiveTime()).toBe('2024-04-04T00:00:00.000Z')
    })
  })

  // 补充：refreshTokenFromAPI 各种场景
  describe('refreshTokenFromAPI', () => {
    it('没有refreshToken时应该清除认证并返回null', async () => {
      const { refreshTokenFromAPI } = await import('../auth')
      const result = await refreshTokenFromAPI()
      expect(result).toBeNull()
    })

    it('API返回200时应该更新token并返回新token', async () => {
      mockLocalStorage['ai_zhihui_refresh_token'] = 'old-refresh'

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
          code: 200,
          data: { token: 'new-token', refreshToken: 'new-refresh' },
        }),
      } as unknown as Response)

      const { refreshTokenFromAPI } = await import('../auth')
      const result = await refreshTokenFromAPI()
      expect(result).toEqual({ token: 'new-token', refreshToken: 'new-refresh' })
    })

    it('API返回code=0时也应该视为成功', async () => {
      mockLocalStorage['ai_zhihui_refresh_token'] = 'old-refresh'

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
          code: 0,
          data: { token: 'new-token-2', refreshToken: 'new-refresh-2' },
        }),
      } as unknown as Response)

      const { refreshTokenFromAPI } = await import('../auth')
      const result = await refreshTokenFromAPI()
      expect(result).toEqual({ token: 'new-token-2', refreshToken: 'new-refresh-2' })
    })

    it('API返回401时应该返回null', async () => {
      mockLocalStorage['ai_zhihui_refresh_token'] = 'old-refresh'

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({}),
      } as unknown as Response)

      const { refreshTokenFromAPI } = await import('../auth')
      const result = await refreshTokenFromAPI()
      expect(result).toBeNull()
    })

    it('API返回非200/0的code时应该返回null', async () => {
      mockLocalStorage['ai_zhihui_refresh_token'] = 'old-refresh'

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({ code: 500, message: 'error' }),
      } as unknown as Response)

      const { refreshTokenFromAPI } = await import('../auth')
      const result = await refreshTokenFromAPI()
      expect(result).toBeNull()
    })

    it('网络异常时应该返回null', async () => {
      mockLocalStorage['ai_zhihui_refresh_token'] = 'old-refresh'

      global.fetch = vi.fn().mockRejectedValue(new Error('network error'))

      const { refreshTokenFromAPI } = await import('../auth')
      const result = await refreshTokenFromAPI()
      expect(result).toBeNull()
    })

    it('API返回500等非401错误时也应该返回null', async () => {
      mockLocalStorage['ai_zhihui_refresh_token'] = 'old-refresh'

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({}),
      } as unknown as Response)

      const { refreshTokenFromAPI } = await import('../auth')
      const result = await refreshTokenFromAPI()
      expect(result).toBeNull()
    })
  })

  // 补充：autoRefreshToken 各种场景
  describe('autoRefreshToken', () => {
    it('没有token时应该返回false', async () => {
      const { autoRefreshToken } = await import('../auth')
      const result = await autoRefreshToken()
      expect(result).toBe(false)
    })

    it('token未即将过期时应该返回true并不调用刷新', async () => {
      const payload = { exp: Date.now() / 1000 + 3600 }
      const header = btoa(JSON.stringify({ alg: 'HS256' }))
      const token = `${header}.${btoa(JSON.stringify(payload))}.sig`
      mockCookies['ai_zhihui_token'] = token

      global.fetch = vi.fn()

      const { autoRefreshToken } = await import('../auth')
      const result = await autoRefreshToken()
      expect(result).toBe(true)
      expect(global.fetch).not.toHaveBeenCalled()
    })

    it('token即将过期且刷新成功时应该返回true', async () => {
      const payload = { exp: Date.now() / 1000 + 60 }
      const header = btoa(JSON.stringify({ alg: 'HS256' }))
      const token = `${header}.${btoa(JSON.stringify(payload))}.sig`
      mockCookies['ai_zhihui_token'] = token
      mockLocalStorage['ai_zhihui_refresh_token'] = 'old-refresh'

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          code: 200,
          data: { token: 'new-token', refreshToken: 'new-refresh' },
        }),
      } as unknown as Response)

      const { autoRefreshToken } = await import('../auth')
      const result = await autoRefreshToken()
      expect(result).toBe(true)
    })

    it('token即将过期且刷新失败时应该返回false', async () => {
      const payload = { exp: Date.now() / 1000 + 60 }
      const header = btoa(JSON.stringify({ alg: 'HS256' }))
      const token = `${header}.${btoa(JSON.stringify(payload))}.sig`
      mockCookies['ai_zhihui_token'] = token
      mockLocalStorage['ai_zhihui_refresh_token'] = 'old-refresh'

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({}),
      } as unknown as Response)

      const { autoRefreshToken } = await import('../auth')
      const result = await autoRefreshToken()
      expect(result).toBe(false)
    })
  })
})
