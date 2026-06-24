import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useTokenStore } from '../auth/token'
import { useUserStore } from '../auth/user'
import { useWalletStore } from '../auth/wallet'
import { useVipStore } from '../auth/vip'
import { useAuthStore } from '../auth'
import {
  login as apiLogin,
  register as apiRegister,
  phoneLogin,
  completePhoneLogin,
  getUserInfo,
} from '@/api/user'
import { isLoginExpired, isExpiryTimePassed } from '@/utils/login-duration'

// 模拟存储数据（闭包方式，与 wallet.test.ts 一致）
const mockStorageData: Record<string, unknown> = {}
const mockSecureStorageData: Record<string, unknown> = {}

vi.mock('@/api/user', () => ({
  login: vi.fn(),
  logout: vi.fn(),
  register: vi.fn(),
  phoneLogin: vi.fn(),
  completePhoneLogin: vi.fn(),
  getUserInfo: vi.fn(),
  refreshToken: vi.fn(),
}))

vi.mock('@/utils/request', () => ({
  getStoredData: vi.fn(() => null),
}))

vi.mock('@/utils/storage', () => ({
  StorageManager: {
    getItem: vi.fn((key: string) => mockStorageData[key] ?? null),
    setItem: vi.fn((key: string, val: unknown) => { mockStorageData[key] = val }),
    removeItem: vi.fn((key: string) => { delete mockStorageData[key] }),
  },
  SecureStorageManager: {
    getItem: vi.fn((key: string) => mockSecureStorageData[key] ?? null),
    setItem: vi.fn((key: string, val: unknown) => { mockSecureStorageData[key] = val }),
    removeItem: vi.fn((key: string) => { delete mockSecureStorageData[key] }),
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
}))

vi.mock('@/utils/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('@/locales', () => ({
  getI18nGlobal: vi.fn(() => ({
    t: vi.fn((key: string) => key),
  })),
}))

vi.mock('@/utils/i18n', () => ({
  t: vi.fn((key: string) => key),
}))

vi.mock('@/utils/login-duration', () => ({
  LOGIN_DURATION_OPTIONS: [
    { label: '1天', value: 86400000, days: 1 },
    { label: '7天', value: 604800000, days: 7 },
  ],
  DEFAULT_LOGIN_DURATION: 604800000,
  calculateExpiryTime: vi.fn(() => Date.now() + 604800000),
  isLoginExpired: vi.fn(() => false),
  isExpiryTimePassed: vi.fn(() => false),
}))

// 模拟 login/logout 中动态导入的服务
vi.mock('@/utils/multiDeviceService', () => ({
  MultiDeviceService: {
    registerCurrentDevice: vi.fn().mockResolvedValue(undefined),
  },
}))

vi.mock('@/utils/securityLogService', () => ({
  SecurityLogService: {
    logLogin: vi.fn().mockResolvedValue(undefined),
    logLogout: vi.fn().mockResolvedValue(undefined),
    logSuspiciousLogin: vi.fn().mockResolvedValue(undefined),
  },
}))

vi.mock('@/utils/locationService', () => ({
  LocationService: {
    fetchCurrentLocation: vi.fn().mockResolvedValue(null),
    checkSuspiciousLogin: vi.fn().mockReturnValue({ isSuspicious: false }),
    saveLoginLocation: vi.fn(),
  },
}))

vi.mock('@/utils/loginBehaviorService', () => ({
  LoginBehaviorService: {
    recordLogin: vi.fn(),
  },
}))

vi.mock('@/utils/deviceService', () => ({
  DeviceService: {
    getDeviceId: vi.fn().mockReturnValue('test-device-id'),
  },
}))

vi.mock('@/utils/securityNotificationService', () => ({
  SecurityNotificationService: {
    notifySuspiciousLogin: vi.fn(),
  },
}))

vi.mock('@/utils/websocket', () => ({
  websocketService: {
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn(),
  },
}))

vi.mock('@/utils/rememberMeService', () => ({
  RememberMeService: {
    clearCredentials: vi.fn(),
    updateRefreshToken: vi.fn(),
    resetAutoLoginRecord: vi.fn(),
    recordAutoLoginFailure: vi.fn(),
  },
}))

describe('auth stores', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    localStorage.clear()
    // 清理 mock 存储数据
    for (const k of Object.keys(mockStorageData)) delete mockStorageData[k]
    for (const k of Object.keys(mockSecureStorageData)) delete mockSecureStorageData[k]
    // 重置 isLoginExpired / isExpiryTimePassed 默认返回 false
    vi.mocked(isLoginExpired).mockReturnValue(false)
    vi.mocked(isExpiryTimePassed).mockReturnValue(false)
  })

  describe('useTokenStore', () => {
    it('应该初始化为空token', () => {
      const store = useTokenStore()
      expect(store.token).toBe('')
    })

    it('应该能够设置token', () => {
      const store = useTokenStore()
      store.setToken('test-token')
      expect(store.token).toBe('test-token')
    })

    it('应该能够清除token', () => {
      const store = useTokenStore()
      store.setToken('test-token')
      store.clearTokens()
      expect(store.token).toBe('')
    })

    it('应该正确判断是否已初始化', () => {
      const store = useTokenStore()
      expect(store.isInitialized).toBe(false)
      store.setToken('test-token')
      expect(store.isInitialized).toBe(true)
    })
  })

  describe('useUserStore', () => {
    it('应该初始化为空用户', () => {
      const store = useUserStore()
      expect(store.userUuid).toBe('')
      expect(store.nickname).toBe('')
    })

    it('应该能够设置用户信息', () => {
      const store = useUserStore()
      store.user = {
        uuid: 'test-uuid',
        nickname: 'Test User',
        avatar: 'https://example.com/avatar.png',
      } as any
      expect(store.userUuid).toBe('test-uuid')
      expect(store.nickname).toBe('Test User')
    })

    it('应该能够清除用户信息', () => {
      const store = useUserStore()
      store.user = {
        uuid: 'test-uuid',
        nickname: 'Test User',
      } as any
      store.user = null
      expect(store.userUuid).toBe('')
      expect(store.nickname).toBe('')
    })
  })

  describe('useAuthStore', () => {
    describe('computed 属性', () => {
      it('初始状态：未登录、非VIP、无用户信息', () => {
        const auth = useAuthStore()
        expect(auth.isLoggedIn).toBe(false)
        expect(auth.isVip).toBe(false)
        expect(auth.userUuid).toBe('')
        expect(auth.nickname).toBe('')
        expect(auth.avatar).toBe('')
        expect(auth.userStatus).toBe(0)
        expect(auth.inviteCode).toBe('')
        expect(auth.balance).toBe(0)
        expect(auth.frozenAmount).toBe(0)
        expect(auth.totalRecharge).toBe(0)
        expect(auth.totalConsumption).toBe(0)
        expect(auth.vipLevel).toBe('')
        expect(auth.isVipActive).toBe(false)
        expect(auth.vipEndTime).toBe('')
        expect(auth.isLoading).toBe(false)
        expect(auth.initCompleted).toBe(false)
      })

      it('设置用户后能正确返回计算属性', () => {
        const auth = useAuthStore()
        const user = useUserStore()
        const token = useTokenStore()
        const wallet = useWalletStore()
        const vip = useVipStore()

        token.setToken('test-token')
        user.user = {
          uuid: 'u1',
          nickname: '测试',
          avatar: 'avatar.png',
          status: 1,
          isVip: true,
          inviteCode: 'INV001',
        } as any
        wallet.fundInfo = {
          balance: 100,
          frozenAmount: 10,
          totalRecharge: 500,
          totalConsumption: 200,
        } as any
        vip.vipInfo = {
          vipLevelName: '黄金',
          isActive: true,
          endTime: '2025-12-31',
        } as any

        expect(auth.userUuid).toBe('u1')
        expect(auth.nickname).toBe('测试')
        expect(auth.avatar).toBe('avatar.png')
        expect(auth.userStatus).toBe(1)
        expect(auth.inviteCode).toBe('INV001')
        expect(auth.balance).toBe(100)
        expect(auth.frozenAmount).toBe(10)
        expect(auth.totalRecharge).toBe(500)
        expect(auth.totalConsumption).toBe(200)
        expect(auth.vipLevel).toBe('黄金')
        expect(auth.isVipActive).toBe(true)
        expect(auth.vipEndTime).toBe('2025-12-31')
        expect(auth.isVip).toBe(true)
      })
    })

    describe('initAuth', () => {
      it('token过期时应该直接返回不初始化', async () => {
        // 模拟 token 过期
        vi.mocked(isExpiryTimePassed).mockReturnValue(true)
        mockStorageData['login_expiry_time'] = Date.now() - 1000

        const auth = useAuthStore()
        await auth.initAuth()

        // 过期时不应设置 initCompleted
        expect(auth.initCompleted).toBe(false)
      })

      it('无存储token时应该直接返回不初始化', async () => {
        // 不设置任何 token
        const auth = useAuthStore()
        await auth.initAuth()

        expect(auth.initCompleted).toBe(false)
      })

      it('有token和用户数据时应该从存储恢复', async () => {
        // 设置 token
        mockSecureStorageData['token'] = 'stored-token'
        // 设置用户数据
        mockStorageData['user_data'] = {
          uuid: 'stored-uuid',
          username: 'stored-user',
          nickname: '存储用户',
          loginTime: '2024-01-01T00:00:00.000Z',
          lastActiveTime: '2024-01-01T00:00:00.000Z',
        }

        // mock fetchUserInfo 避免实际请求报错
        vi.mocked(getUserInfo).mockResolvedValue({
          code: 200,
          data: { uuid: 'stored-uuid', username: 'stored-user' },
        } as any)

        const auth = useAuthStore()
        await auth.initAuth()

        expect(auth.initCompleted).toBe(true)
        expect(auth.token).toBe('stored-token')
      })

      it('有token但无用户数据时应该获取用户信息', async () => {
        mockSecureStorageData['token'] = 'stored-token'
        // 不设置 user_data

        vi.mocked(getUserInfo).mockResolvedValue({
          code: 200,
          data: {
            uuid: 'fetched-uuid',
            username: 'fetched-user',
            nickname: '获取的用户',
          },
        } as any)

        const auth = useAuthStore()
        await auth.initAuth()

        expect(auth.initCompleted).toBe(true)
      })

      it('获取用户信息失败时应该清除认证状态', async () => {
        mockSecureStorageData['token'] = 'stored-token'
        // 不设置 user_data

        vi.mocked(getUserInfo).mockRejectedValue(new Error('请先登录'))

        const auth = useAuthStore()
        await auth.initAuth()

        // 失败时应清除 token
        expect(auth.token).toBe('')
      })
    })

    describe('register', () => {
      it('手机注册缺少手机号应该抛出错误', async () => {
        const auth = useAuthStore()
        await expect(auth.register({
          type: 'phone',
          phone: '',
          code: '1234',
          password: 'pass123',
        } as any)).rejects.toThrow()
      })

      it('手机注册缺少验证码应该抛出错误', async () => {
        const auth = useAuthStore()
        await expect(auth.register({
          type: 'phone',
          phone: '13800000000',
          code: '',
          password: 'pass123',
        } as any)).rejects.toThrow()
      })

      it('手机注册缺少密码应该抛出错误', async () => {
        const auth = useAuthStore()
        await expect(auth.register({
          type: 'phone',
          phone: '13800000000',
          code: '1234',
          password: '',
        } as any)).rejects.toThrow()
      })

      it('用户名注册缺少用户名应该抛出错误', async () => {
        const auth = useAuthStore()
        await expect(auth.register({
          type: 'account',
          username: '',
          password: 'pass123',
        } as any)).rejects.toThrow()
      })

      it('用户名注册缺少密码应该抛出错误', async () => {
        const auth = useAuthStore()
        await expect(auth.register({
          type: 'account',
          username: 'testuser',
          password: '',
        } as any)).rejects.toThrow()
      })

      it('手机注册成功应该设置token', async () => {
        vi.mocked(apiRegister).mockResolvedValue({
          data: {
            token: 'new-token',
            refreshToken: 'new-refresh',
            user: { uuid: 'new-uuid', username: 'newuser' },
          },
        } as any)
        vi.mocked(getUserInfo).mockResolvedValue({
          code: 200,
          data: { uuid: 'new-uuid', username: 'newuser' },
        } as any)

        const auth = useAuthStore()
        const response = await auth.register({
          type: 'phone',
          phone: '13800000000',
          code: '1234',
          password: 'pass123',
        } as any)

        expect(auth.token).toBe('new-token')
        expect(response).toBeDefined()
      })

      it('用户名注册成功应该设置token', async () => {
        vi.mocked(apiRegister).mockResolvedValue({
          data: {
            token: 'new-token',
            refreshToken: 'new-refresh',
            user: { uuid: 'new-uuid', username: 'newuser' },
          },
        } as any)
        vi.mocked(getUserInfo).mockResolvedValue({
          code: 200,
          data: { uuid: 'new-uuid', username: 'newuser' },
        } as any)

        const auth = useAuthStore()
        await auth.register({
          type: 'account',
          username: 'testuser',
          password: 'pass123',
        } as any)

        expect(auth.token).toBe('new-token')
      })

      it('注册时带邀请码应该正确处理', async () => {
        vi.mocked(apiRegister).mockResolvedValue({
          data: {
            token: 'new-token',
            refreshToken: 'new-refresh',
            user: { uuid: 'new-uuid', username: 'newuser', inviteCode: 'INV001' },
          },
        } as any)
        vi.mocked(getUserInfo).mockResolvedValue({
          code: 200,
          data: { uuid: 'new-uuid', username: 'newuser' },
        } as any)

        const auth = useAuthStore()
        await auth.register({
          type: 'account',
          username: 'testuser',
          password: 'pass123',
          inviteCode: 'INVITE123',
        } as any)

        expect(auth.token).toBe('new-token')
      })

      it('注册响应格式无效应该抛出错误', async () => {
        vi.mocked(apiRegister).mockResolvedValue({
          data: 'invalid-string',
        } as any)

        const auth = useAuthStore()
        await expect(auth.register({
          type: 'account',
          username: 'testuser',
          password: 'pass123',
        } as any)).rejects.toThrow()
      })

      it('注册API失败应该抛出错误', async () => {
        vi.mocked(apiRegister).mockRejectedValue(new Error('注册失败'))

        const auth = useAuthStore()
        await expect(auth.register({
          type: 'account',
          username: 'testuser',
          password: 'pass123',
        } as any)).rejects.toThrow('注册失败')
      })
    })

    describe('login', () => {
      it('登录信息不完整应该抛出错误', async () => {
        const auth = useAuthStore()
        await expect(auth.login({
          type: 'account',
        } as any)).rejects.toThrow()
      })

      it('用户名密码登录成功', async () => {
        vi.mocked(apiLogin).mockResolvedValue({
          data: {
            token: 'login-token',
            refreshToken: 'login-refresh',
            uuid: 'login-uuid',
            username: 'loginuser',
            nickname: '登录用户',
          },
        } as any)
        vi.mocked(getUserInfo).mockResolvedValue({
          code: 200,
          data: { uuid: 'login-uuid', username: 'loginuser' },
        } as any)

        const auth = useAuthStore()
        await auth.login({
          type: 'account',
          username: 'loginuser',
          password: 'pass123',
        } as any)

        expect(auth.token).toBe('login-token')
      })

      it('手机验证码登录成功', async () => {
        vi.mocked(phoneLogin).mockResolvedValue({
          data: 'temp-key',
        } as any)
        vi.mocked(completePhoneLogin).mockResolvedValue({
          data: {
            token: 'phone-token',
            refreshToken: 'phone-refresh',
            uuid: 'phone-uuid',
            username: 'phoneuser',
            nickname: '手机用户',
          },
        } as any)
        vi.mocked(getUserInfo).mockResolvedValue({
          code: 200,
          data: { uuid: 'phone-uuid', username: 'phoneuser' },
        } as any)

        const auth = useAuthStore()
        await auth.login({
          type: 'phone',
          phone: '13800000000',
          code: '1234',
        } as any)

        expect(auth.token).toBe('phone-token')
      })

      it('登录API失败应该抛出错误', async () => {
        vi.mocked(apiLogin).mockRejectedValue(new Error('密码错误'))

        const auth = useAuthStore()
        await expect(auth.login({
          type: 'account',
          username: 'loginuser',
          password: 'wrongpass',
        } as any)).rejects.toThrow('密码错误')
      })
    })

    describe('logout', () => {
      it('登出应该清除所有认证状态（间接测试 clearAuthState）', async () => {
        const auth = useAuthStore()
        const token = useTokenStore()
        const user = useUserStore()
        const wallet = useWalletStore()
        const vip = useVipStore()

        // 设置登录状态
        token.setToken('test-token', 'test-refresh')
        user.user = { uuid: 'u1', nickname: 'test' } as any
        wallet.fundInfo = { balance: 100 } as any
        vip.vipInfo = { vipLevelName: '黄金' } as any

        await auth.logout()

        // 验证所有状态已清除（clearAuthState 的效果）
        expect(token.token).toBe('')
        expect(user.user).toBeNull()
        expect(wallet.fundInfo).toBeNull()
        expect(vip.vipInfo).toBeNull()
      })
    })

    describe('setAuthState', () => {
      it('应该设置认证状态和存储', () => {
        const auth = useAuthStore()
        const userData = {
          id: 'u1',
          uuid: 'u1',
          username: 'testuser',
          nickname: '测试',
        } as any

        auth.setAuthState('new-token', 'new-refresh', userData)

        expect(auth.token).toBe('new-token')
        expect(auth.user?.uuid).toBe('u1')
      })

      it('skipStorage 选项应该跳过存储', () => {
        const auth = useAuthStore()
        const userData = {
          id: 'u2',
          uuid: 'u2',
          username: 'testuser2',
        } as any

        auth.setAuthState('new-token', 'new-refresh', userData, { skipStorage: true })

        expect(auth.token).toBe('new-token')
        expect(auth.user?.uuid).toBe('u2')
      })
    })

    describe('代理方法', () => {
      it('updateBalance 应该代理到 walletStore', () => {
        const auth = useAuthStore()
        const wallet = useWalletStore()
        wallet.fundInfo = { balance: 100, totalRecharge: 0, totalConsumption: 0 } as any

        auth.updateBalance(200)

        expect(wallet.balance).toBe(200)
      })

      it('consumeBalance 应该代理到 walletStore', () => {
        const auth = useAuthStore()
        const wallet = useWalletStore()
        wallet.fundInfo = { balance: 100, totalRecharge: 0, totalConsumption: 0 } as any

        expect(auth.consumeBalance(30)).toBe(true)
        expect(wallet.balance).toBe(70)
      })

      it('rechargeBalance 应该代理到 walletStore', () => {
        const auth = useAuthStore()
        const wallet = useWalletStore()
        wallet.fundInfo = { balance: 100, totalRecharge: 0, totalConsumption: 0 } as any

        auth.rechargeBalance(50)

        expect(wallet.balance).toBe(150)
        expect(wallet.totalRecharge).toBe(50)
      })

      it('updateLastActiveTime 应该更新最后活动时间', () => {
        const auth = useAuthStore()
        const token = useTokenStore()
        const before = token.lastActiveTime

        auth.updateLastActiveTime()

        expect(token.lastActiveTime).not.toBe(before)
      })

      it('checkPermission 应该代理到 permissionsStore', () => {
        const auth = useAuthStore()
        // 无用户时返回 false
        expect(auth.checkPermission('chat')).toBe(false)
      })

      it('checkFeatureAccess 应该代理到 permissionsStore', () => {
        const auth = useAuthStore()
        // 未登录时返回 false
        expect(auth.checkFeatureAccess('chat')).toBe(false)
      })

      it('setUser 应该代理到 userStore', () => {
        const auth = useAuthStore()
        const user = useUserStore()
        user.user = { uuid: 'u1', nickname: 'old' } as any

        auth.setUser({ nickname: 'new nickname' })

        expect(user.user?.nickname).toBe('new nickname')
      })

      it('setFundInfo 应该代理到 walletStore', () => {
        const auth = useAuthStore()
        const wallet = useWalletStore()
        const fundInfo = { balance: 999 } as any

        auth.setFundInfo(fundInfo)

        expect(wallet.fundInfo).toEqual(fundInfo)
      })

      it('setVipInfo 应该代理到 vipStore', () => {
        const auth = useAuthStore()
        const vip = useVipStore()
        const vipInfo = { vipLevelName: '钻石' } as any

        auth.setVipInfo(vipInfo)

        expect(vip.vipInfo).toEqual(vipInfo)
      })
    })
  })
})
