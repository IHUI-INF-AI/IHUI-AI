import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { StorageManager, STORAGE_KEYS } from '@/utils/storage'
import { isLoginExpired } from '@/utils/login-duration'

// Mock 存储工具
vi.mock('@/utils/storage', () => ({
  StorageManager: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
    hasItem: vi.fn(),
  },
  STORAGE_KEYS: {
    TOKEN: 'token',
    USER_TOKEN: 'user_token',
    USER_DATA: 'user_data',
    LOGIN_EXPIRY_TIME: 'login_expiry_time',
    REFRESH_TOKEN: 'refresh_token',
  },
}))

// Mock 登录时长工具
vi.mock('@/utils/login-duration', () => ({
  isLoginExpired: vi.fn(() => false),
}))

// Mock 日志工具
vi.mock('@/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

// Mock 对象工具
vi.mock('@/utils/object-utils', () => ({
  deepEqual: vi.fn((a, b) => JSON.stringify(a) === JSON.stringify(b)),
}))

// Mock auth store，使用可变对象便于每个用例定制
const mockAuthStore = {
  token: '' as string,
  user: null as any,
  isLoggedIn: false,
  loginTime: undefined as string | undefined,
  lastActiveTime: undefined as string | undefined,
  refreshToken: '',
  fundInfo: null,
  vipInfo: null,
  authInfo: null,
  fetchUserInfo: vi.fn(),
}

vi.mock('@/stores/auth', () => ({
  useAuthStore: vi.fn(() => mockAuthStore),
}))

describe('authStateRestore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // 重置 mockAuthStore 状态
    mockAuthStore.token = ''
    mockAuthStore.user = null
    mockAuthStore.isLoggedIn = false
    mockAuthStore.loginTime = undefined
    mockAuthStore.lastActiveTime = undefined
    mockAuthStore.refreshToken = ''
    mockAuthStore.fundInfo = null
    mockAuthStore.vipInfo = null
    mockAuthStore.authInfo = null
    mockAuthStore.fetchUserInfo = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('createAuthStateSnapshot', () => {
    it('应该创建空状态快照', async () => {
      const { createAuthStateSnapshot } = await import('../authStateRestore')
      const snapshot = await createAuthStateSnapshot()
      // 源码使用 `authStore.token || null`，空字符串会被转为 null
      expect(snapshot.token).toBeNull()
      expect(snapshot.user).toBeNull()
      expect(snapshot.loginTime).toBeNull()
      expect(snapshot.lastActiveTime).toBeNull()
      expect(snapshot.isLoggedIn).toBe(false)
    })

    it('应该创建包含认证信息的快照', async () => {
      mockAuthStore.token = 'test-token'
      mockAuthStore.user = { id: '1' } as any
      mockAuthStore.isLoggedIn = true
      mockAuthStore.loginTime = '2024-01-01'
      mockAuthStore.lastActiveTime = '2024-01-02'

      const { createAuthStateSnapshot } = await import('../authStateRestore')
      const snapshot = await createAuthStateSnapshot()
      expect(snapshot.token).toBe('test-token')
      expect(snapshot.user).toEqual({ id: '1' })
      expect(snapshot.loginTime).toBe('2024-01-01')
      expect(snapshot.lastActiveTime).toBe('2024-01-02')
      expect(snapshot.isLoggedIn).toBe(true)
    })
  })

  describe('restoreAuthStateAtomically', () => {
    it('无 token 时应清除状态并返回失败', async () => {
      vi.mocked(StorageManager.getItem).mockReturnValue(null)
      const { restoreAuthStateAtomically } = await import('../authStateRestore')
      const result = await restoreAuthStateAtomically()
      expect(result.success).toBe(false)
      expect(result.hasToken).toBe(false)
      expect(result.error).toBe('No token found')
    })

    it('无 userData 时应清除状态并返回失败', async () => {
      // 第一次返回 token，其他返回 null
      vi.mocked(StorageManager.getItem).mockImplementation((key) => {
        if (key === STORAGE_KEYS.TOKEN || key === STORAGE_KEYS.USER_TOKEN) return 'token'
        return null
      })
      const { restoreAuthStateAtomically } = await import('../authStateRestore')
      const result = await restoreAuthStateAtomically()
      expect(result.success).toBe(false)
      expect(result.hasToken).toBe(true)
      expect(result.hasUserData).toBe(false)
      expect(result.error).toBe('No user data found')
    })

    it('登录过期时应清除状态并返回失败', async () => {
      vi.mocked(StorageManager.getItem).mockImplementation((key) => {
        if (key === STORAGE_KEYS.TOKEN) return 'token'
        if (key === STORAGE_KEYS.USER_DATA) return { uuid: 'u1' }
        if (key === STORAGE_KEYS.LOGIN_EXPIRY_TIME) return 12345
        return null
      })
      vi.mocked(isLoginExpired).mockReturnValue(true)

      const { restoreAuthStateAtomically } = await import('../authStateRestore')
      const result = await restoreAuthStateAtomically()
      expect(result.success).toBe(false)
      expect(result.isExpired).toBe(true)
      expect(result.error).toBe('Login expired')
    })

    it('成功恢复认证状态并设置 loginTime/lastActiveTime', async () => {
      const userData = {
        uuid: 'u1',
        username: 'tester',
        loginTime: '2024-01-01',
        lastActiveTime: '2024-01-02',
      }
      vi.mocked(StorageManager.getItem).mockImplementation((key) => {
        if (key === STORAGE_KEYS.TOKEN) return 'token'
        if (key === STORAGE_KEYS.USER_DATA) return userData
        if (key === STORAGE_KEYS.LOGIN_EXPIRY_TIME) return null
        return null
      })

      const { restoreAuthStateAtomically } = await import('../authStateRestore')
      const result = await restoreAuthStateAtomically(true)
      expect(result.success).toBe(true)
      expect(mockAuthStore.token).toBe('token')
      expect(mockAuthStore.user).toBeTruthy()
      expect(mockAuthStore.loginTime).toBe('2024-01-01')
      expect(mockAuthStore.lastActiveTime).toBe('2024-01-02')
    })

    it('skipFetchUserInfo=false 时应调用 fetchUserInfo', async () => {
      vi.mocked(StorageManager.getItem).mockImplementation((key) => {
        if (key === STORAGE_KEYS.TOKEN) return 'token'
        if (key === STORAGE_KEYS.USER_DATA) return { uuid: 'u1' }
        return null
      })
      mockAuthStore.fetchUserInfo = vi.fn().mockResolvedValue(undefined)

      const { restoreAuthStateAtomically } = await import('../authStateRestore')
      const result = await restoreAuthStateAtomically(false)
      expect(result.success).toBe(true)
      expect(mockAuthStore.fetchUserInfo).toHaveBeenCalled()
    })

    it('fetchUserInfo 失败时应继续使用本地数据', async () => {
      vi.mocked(StorageManager.getItem).mockImplementation((key) => {
        if (key === STORAGE_KEYS.TOKEN) return 'token'
        if (key === STORAGE_KEYS.USER_DATA) return { uuid: 'u1' }
        return null
      })
      mockAuthStore.fetchUserInfo = vi.fn().mockRejectedValue(new Error('网络错误'))

      const { restoreAuthStateAtomically } = await import('../authStateRestore')
      const result = await restoreAuthStateAtomically(false)
      expect(result.success).toBe(true)
      expect(mockAuthStore.fetchUserInfo).toHaveBeenCalled()
    })

    it('发生异常时应返回错误信息', async () => {
      vi.mocked(StorageManager.getItem).mockImplementation(() => {
        throw new Error('存储异常')
      })
      const { restoreAuthStateAtomically } = await import('../authStateRestore')
      const result = await restoreAuthStateAtomically()
      expect(result.success).toBe(false)
      expect(result.error).toBe('存储异常')
    })

    it('非 Error 异常应返回字符串形式', async () => {
      vi.mocked(StorageManager.getItem).mockImplementation(() => {
        throw '字符串错误'
      })
      const { restoreAuthStateAtomically } = await import('../authStateRestore')
      const result = await restoreAuthStateAtomically()
      expect(result.success).toBe(false)
      expect(result.error).toBe('字符串错误')
    })

    it('应正确转换包含 vipLevelVO 和 identityType 的用户数据', async () => {
      const userData = {
        uuid: 'u1',
        username: 'tester',
        isVip: 1,
        identityTypy: 2, // 拼写错误兼容
        vipLevelVO: { title: 'VIP1', level: 1 },
        authInfo: { email: 'a@b.com' },
      }
      vi.mocked(StorageManager.getItem).mockImplementation((key) => {
        if (key === STORAGE_KEYS.TOKEN) return 'token'
        if (key === STORAGE_KEYS.USER_DATA) return userData
        return null
      })

      const { restoreAuthStateAtomically } = await import('../authStateRestore')
      const result = await restoreAuthStateAtomically(true)
      expect(result.success).toBe(true)
      expect(mockAuthStore.user.isVip).toBe(true)
      expect(mockAuthStore.user.identityType).toBe(2)
      expect(mockAuthStore.user.vipLevelVO).toBeTruthy()
      expect(mockAuthStore.user.email).toBe('a@b.com')
    })
  })

  describe('clearAuthState', () => {
    it('应清除 store 和 storage 中的所有认证状态', async () => {
      mockAuthStore.token = 'token'
      mockAuthStore.user = { id: '1' } as any
      mockAuthStore.loginTime = '2024-01-01'
      mockAuthStore.lastActiveTime = '2024-01-02'

      const { clearAuthState } = await import('../authStateRestore')
      await clearAuthState()

      expect(mockAuthStore.token).toBe('')
      expect(mockAuthStore.user).toBeNull()
      expect(mockAuthStore.loginTime).toBeNull()
      expect(mockAuthStore.lastActiveTime).toBeNull()
      expect(mockAuthStore.refreshToken).toBe('')
      expect(mockAuthStore.fundInfo).toBeNull()
      expect(mockAuthStore.vipInfo).toBeNull()
      expect(mockAuthStore.authInfo).toBeNull()

      // 验证清除了所有 storage key
      expect(StorageManager.removeItem).toHaveBeenCalledWith(STORAGE_KEYS.TOKEN)
      expect(StorageManager.removeItem).toHaveBeenCalledWith(STORAGE_KEYS.USER_TOKEN)
      expect(StorageManager.removeItem).toHaveBeenCalledWith(STORAGE_KEYS.USER_DATA)
      expect(StorageManager.removeItem).toHaveBeenCalledWith(STORAGE_KEYS.LOGIN_EXPIRY_TIME)
      expect(StorageManager.removeItem).toHaveBeenCalledWith(STORAGE_KEYS.REFRESH_TOKEN)
    })
  })

  describe('isAuthStateValid', () => {
    it('有 token、userData 且未过期时应返回 true', async () => {
      vi.mocked(StorageManager.getItem).mockImplementation((key) => {
        if (key === STORAGE_KEYS.TOKEN) return 'token'
        if (key === STORAGE_KEYS.USER_DATA) return { uuid: 'u1' }
        if (key === STORAGE_KEYS.LOGIN_EXPIRY_TIME) return null
        return null
      })
      vi.mocked(isLoginExpired).mockReturnValue(false)

      const { isAuthStateValid } = await import('../authStateRestore')
      expect(isAuthStateValid()).toBe(true)
    })

    it('无 token 时应返回 false', async () => {
      vi.mocked(StorageManager.getItem).mockReturnValue(null)
      const { isAuthStateValid } = await import('../authStateRestore')
      expect(isAuthStateValid()).toBe(false)
    })

    it('登录过期时应返回 false', async () => {
      vi.mocked(StorageManager.getItem).mockImplementation((key) => {
        if (key === STORAGE_KEYS.TOKEN) return 'token'
        if (key === STORAGE_KEYS.USER_DATA) return { uuid: 'u1' }
        if (key === STORAGE_KEYS.LOGIN_EXPIRY_TIME) return 12345
        return null
      })
      vi.mocked(isLoginExpired).mockReturnValue(true)

      const { isAuthStateValid } = await import('../authStateRestore')
      expect(isAuthStateValid()).toBe(false)
    })
  })

  describe('getAuthStateSnapshot', () => {
    it('应返回与 createAuthStateSnapshot 相同的快照', async () => {
      mockAuthStore.token = 'token'
      mockAuthStore.isLoggedIn = true
      const { getAuthStateSnapshot } = await import('../authStateRestore')
      const snapshot = await getAuthStateSnapshot()
      expect(snapshot.token).toBe('token')
      expect(snapshot.isLoggedIn).toBe(true)
    })
  })

  describe('compareAuthSnapshots', () => {
    it('应正确识别 token 变化', async () => {
      const { compareAuthSnapshots } = await import('../authStateRestore')
      const before = { token: 'a', user: null, loginTime: null, lastActiveTime: null, isLoggedIn: false }
      const after = { token: 'b', user: null, loginTime: null, lastActiveTime: null, isLoggedIn: false }
      const result = compareAuthSnapshots(before, after)
      expect(result.tokenChanged).toBe(true)
      expect(result.userChanged).toBe(false)
      expect(result.loginTimeChanged).toBe(false)
      expect(result.isLoggedInChanged).toBe(false)
    })

    it('应正确识别 user 变化', async () => {
      const { compareAuthSnapshots } = await import('../authStateRestore')
      const before = { token: 'a', user: { id: '1' }, loginTime: null, lastActiveTime: null, isLoggedIn: false }
      const after = { token: 'a', user: { id: '2' }, loginTime: null, lastActiveTime: null, isLoggedIn: false }
      const result = compareAuthSnapshots(before, after)
      expect(result.userChanged).toBe(true)
    })

    it('应正确识别 loginTime 和 isLoggedIn 变化', async () => {
      const { compareAuthSnapshots } = await import('../authStateRestore')
      const before = { token: 'a', user: null, loginTime: 't1', lastActiveTime: null, isLoggedIn: false }
      const after = { token: 'a', user: null, loginTime: 't2', lastActiveTime: null, isLoggedIn: true }
      const result = compareAuthSnapshots(before, after)
      expect(result.loginTimeChanged).toBe(true)
      expect(result.isLoggedInChanged).toBe(true)
    })
  })

  describe('validateAuthStateConsistency', () => {
    it('store 与 storage 一致时应返回 isConsistent=true', async () => {
      mockAuthStore.token = 'token'
      mockAuthStore.user = { id: '1' } as any
      mockAuthStore.isLoggedIn = true
      vi.mocked(StorageManager.getItem).mockImplementation((key) => {
        if (key === STORAGE_KEYS.TOKEN) return 'token'
        if (key === STORAGE_KEYS.USER_DATA) return { id: '1' }
        return null
      })

      const { validateAuthStateConsistency } = await import('../authStateRestore')
      const result = await validateAuthStateConsistency()
      expect(result.isConsistent).toBe(true)
      expect(result.issues).toHaveLength(0)
    })

    it('store 有 token 但 storage 无 token 时应报告问题', async () => {
      mockAuthStore.token = 'token'
      mockAuthStore.user = null
      mockAuthStore.isLoggedIn = false
      vi.mocked(StorageManager.getItem).mockReturnValue(null)

      const { validateAuthStateConsistency } = await import('../authStateRestore')
      const result = await validateAuthStateConsistency()
      expect(result.isConsistent).toBe(false)
      expect(result.issues.length).toBeGreaterThan(0)
    })

    it('storage 有 token 但 store 无 token 时应报告问题', async () => {
      mockAuthStore.token = ''
      mockAuthStore.user = null
      mockAuthStore.isLoggedIn = false
      vi.mocked(StorageManager.getItem).mockImplementation((key) => {
        if (key === STORAGE_KEYS.TOKEN) return 'token'
        if (key === STORAGE_KEYS.USER_DATA) return { id: '1' }
        return null
      })

      const { validateAuthStateConsistency } = await import('../authStateRestore')
      const result = await validateAuthStateConsistency()
      expect(result.isConsistent).toBe(false)
      expect(result.issues.length).toBeGreaterThan(0)
    })

    it('store 有 user 但 storage 无 userData 时应报告问题', async () => {
      mockAuthStore.token = ''
      mockAuthStore.user = { id: '1' } as any
      mockAuthStore.isLoggedIn = false
      vi.mocked(StorageManager.getItem).mockReturnValue(null)

      const { validateAuthStateConsistency } = await import('../authStateRestore')
      const result = await validateAuthStateConsistency()
      expect(result.isConsistent).toBe(false)
      expect(result.issues.some(i => i.includes('authStore.user'))).toBe(true)
    })

    it('isLoggedIn 计算错误时应报告问题', async () => {
      mockAuthStore.token = 'token'
      mockAuthStore.user = { id: '1' } as any
      mockAuthStore.isLoggedIn = false // 故意设置错误
      vi.mocked(StorageManager.getItem).mockImplementation((key) => {
        if (key === STORAGE_KEYS.TOKEN) return 'token'
        if (key === STORAGE_KEYS.USER_DATA) return { id: '1' }
        return null
      })

      const { validateAuthStateConsistency } = await import('../authStateRestore')
      const result = await validateAuthStateConsistency()
      expect(result.isConsistent).toBe(false)
      expect(result.issues.some(i => i.includes('isLoggedIn'))).toBe(true)
    })
  })

  describe('syncAuthStateToStorage', () => {
    it('store 有 token 和 user 时应同步到 storage', async () => {
      mockAuthStore.token = 'token'
      mockAuthStore.user = { id: '1', name: 'test' } as any
      mockAuthStore.loginTime = '2024-01-01'
      mockAuthStore.lastActiveTime = '2024-01-02'
      vi.mocked(StorageManager.getItem).mockReturnValue({ old: 'data' })

      const { syncAuthStateToStorage } = await import('../authStateRestore')
      await syncAuthStateToStorage()

      expect(StorageManager.setItem).toHaveBeenCalledWith(STORAGE_KEYS.TOKEN, 'token')
      expect(StorageManager.setItem).toHaveBeenCalledWith(STORAGE_KEYS.USER_TOKEN, 'token')
      // 验证 userData 合并了旧数据
      const userDataCall = vi.mocked(StorageManager.setItem).mock.calls.find(
        call => call[0] === STORAGE_KEYS.USER_DATA
      )
      expect(userDataCall).toBeTruthy()
      expect(userDataCall![1]).toMatchObject({
        old: 'data',
        id: '1',
        name: 'test',
        loginTime: '2024-01-01',
        lastActiveTime: '2024-01-02',
      })
    })

    it('store 无 token 时不应同步 token', async () => {
      mockAuthStore.token = ''
      mockAuthStore.user = null
      const { syncAuthStateToStorage } = await import('../authStateRestore')
      await syncAuthStateToStorage()
      expect(StorageManager.setItem).not.toHaveBeenCalledWith(STORAGE_KEYS.TOKEN, expect.anything())
    })
  })

  describe('restoreAndValidateAuthState', () => {
    it('应同时执行恢复和验证', async () => {
      vi.mocked(StorageManager.getItem).mockImplementation((key) => {
        if (key === STORAGE_KEYS.TOKEN) return 'token'
        if (key === STORAGE_KEYS.USER_DATA) return { uuid: 'u1' }
        return null
      })

      const { restoreAndValidateAuthState } = await import('../authStateRestore')
      const result = await restoreAndValidateAuthState()
      expect(result.restoreResult).toBeDefined()
      expect(result.validationResult).toBeDefined()
      expect(result.restoreResult.success).toBe(true)
    })

    it('恢复失败时也应返回验证结果', async () => {
      vi.mocked(StorageManager.getItem).mockReturnValue(null)
      const { restoreAndValidateAuthState } = await import('../authStateRestore')
      const result = await restoreAndValidateAuthState()
      expect(result.restoreResult.success).toBe(false)
      expect(result.validationResult).toBeDefined()
    })
  })

  describe('transformUserData（间接测试）', () => {
    it('应处理 isVip 为布尔值的情况', async () => {
      vi.mocked(StorageManager.getItem).mockImplementation((key) => {
        if (key === STORAGE_KEYS.TOKEN) return 'token'
        if (key === STORAGE_KEYS.USER_DATA) return { uuid: 'u1', isVip: true }
        return null
      })
      const { restoreAuthStateAtomically } = await import('../authStateRestore')
      await restoreAuthStateAtomically(true)
      expect(mockAuthStore.user.isVip).toBe(true)
    })

    it('应处理 avatarUrl 作为 avatar 备选', async () => {
      vi.mocked(StorageManager.getItem).mockImplementation((key) => {
        if (key === STORAGE_KEYS.TOKEN) return 'token'
        if (key === STORAGE_KEYS.USER_DATA) return { uuid: 'u1', avatarUrl: 'http://img' }
        return null
      })
      const { restoreAuthStateAtomically } = await import('../authStateRestore')
      await restoreAuthStateAtomically(true)
      expect(mockAuthStore.user.avatar).toBe('http://img')
    })

    it('应使用 USER_TOKEN 作为 token 备选', async () => {
      vi.mocked(StorageManager.getItem).mockImplementation((key) => {
        if (key === STORAGE_KEYS.USER_TOKEN) return 'user-token'
        if (key === STORAGE_KEYS.USER_DATA) return { uuid: 'u1' }
        return null
      })
      const { restoreAuthStateAtomically } = await import('../authStateRestore')
      const result = await restoreAuthStateAtomically(true)
      expect(result.success).toBe(true)
      expect(mockAuthStore.token).toBe('user-token')
    })
  })
})
