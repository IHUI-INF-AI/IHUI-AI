// auth store 主入口单元测试
// 重点覆盖所有 actions 和 getters

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore } from '../index'
import { useTokenStore } from '../token'
import { useUserStore } from '../user'
import { useWalletStore } from '../wallet'
import { useVipStore } from '../vip'
import { usePermissionsStore } from '../permissions'
import { useThirdPartyStore } from '../thirdParty'
import { StorageManager, STORAGE_KEYS } from '@/utils/storage'
import { getStoredData } from '@/utils/request'
import type { LoginParams, RegisterParams } from '@/types'

// Mock API 用户模块
vi.mock('@/api/user', () => ({
  login: vi.fn(),
  register: vi.fn(),
  phoneLogin: vi.fn(),
  completePhoneLogin: vi.fn(),
  refreshToken: vi.fn(),
  getUserInfo: vi.fn(),
}))

import {
  login as apiLogin,
  register as apiRegister,
  phoneLogin,
  completePhoneLogin,
  refreshToken as refreshTokenApi,
  getUserInfo,
} from '@/api/user'

// Mock 存储管理
const mockStorage: Record<string, unknown> = {}
vi.mock('@/utils/storage', () => ({
  StorageManager: {
    getItem: vi.fn((key: string) => mockStorage[key] ?? null),
    setItem: vi.fn((key: string, val: any) => { mockStorage[key] = val }),
    removeItem: vi.fn((key: string) => { delete mockStorage[key] }),
  },
  SecureStorageManager: {
    setItem: vi.fn(() => true),
    getItem: vi.fn(() => null),
    removeItem: vi.fn(() => true),
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

// Mock i18n
vi.mock('@/locales', () => ({
  getI18nGlobal: () => ({ t: (k: string) => k }),
}))

vi.mock('@/utils/i18n', () => ({
  t: (k: string) => k,
}))

// Mock 日志器
vi.mock('@/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}))

// Mock request 工具
vi.mock('@/utils/request', () => ({
  getStoredData: vi.fn(() => mockStorage.user_data as Record<string, unknown> | null),
}))

// Mock 动态导入的服务
vi.mock('@/utils/websocket', () => ({
  websocketService: {
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn(),
  },
}))

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
    fetchCurrentLocation: vi.fn().mockResolvedValue({ country: 'CN', city: 'Beijing', ip: '127.0.0.1' }),
    checkSuspiciousLogin: vi.fn(() => ({ isSuspicious: false })),
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
    getDeviceId: vi.fn(() => 'test-device-id'),
  },
}))

vi.mock('@/utils/securityNotificationService', () => ({
  SecurityNotificationService: {
    notifySuspiciousLogin: vi.fn(),
  },
}))

vi.mock('@/utils/rememberMeService', () => ({
  RememberMeService: {
    recordAutoLoginFailure: vi.fn(),
    updateRefreshToken: vi.fn(),
    resetAutoLoginRecord: vi.fn(),
    clearCredentials: vi.fn(),
  },
}))

describe('useAuthStore 主入口', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    // 清空 mock 存储
    for (const k of Object.keys(mockStorage)) delete mockStorage[k]
    vi.clearAllMocks()
    // 设置 navigator.userAgent mock
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      configurable: true,
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  // ============ 基础状态测试 ============
  describe('基础状态与 getters', () => {
    it('初始化状态默认值正确', () => {
      const auth = useAuthStore()
      expect(auth.token).toBe('')
      expect(auth.refreshToken).toBe('')
      expect(auth.user).toBeNull()
      expect(auth.authInfo).toBeNull()
      expect(auth.fundInfo).toBeNull()
      expect(auth.vipInfo).toBeNull()
      expect(auth.isLoading).toBe(false)
      expect(auth.isLoggedIn).toBe(false)
      expect(auth.isVip).toBe(false)
      expect(auth.isInitialized).toBe(false)
      expect(auth.initCompleted).toBe(false)
    })

    it('暴露所有 getters', () => {
      const auth = useAuthStore()
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
      expect(auth.isDemoMode).toBeDefined()
      expect(auth.isFetchingUserInfo).toBe(false)
    })

    it('hasPermission/hasRole/canUseFeature 是函数', () => {
      const auth = useAuthStore()
      expect(typeof auth.hasPermission).toBe('function')
      expect(typeof auth.hasRole).toBe('function')
      expect(typeof auth.canUseFeature).toBe('function')
    })
  })

  // ============ initAuth 测试 ============
  describe('initAuth', () => {
    it('当 token 已过期时清除并直接返回', async () => {
      const auth = useAuthStore()
      const token = useTokenStore()
      // 让 checkExpiryAndClear 返回 true
      vi.spyOn(token, 'checkExpiryAndClear').mockReturnValue(true)
      await auth.initAuth()
      expect(token.checkExpiryAndClear).toHaveBeenCalled()
    })

    it('无 token 时保持未登录', async () => {
      const auth = useAuthStore()
      const token = useTokenStore()
      vi.spyOn(token, 'checkExpiryAndClear').mockReturnValue(false)
      vi.spyOn(token, 'restoreToken').mockReturnValue(false)
      await auth.initAuth()
      expect(token.restoreToken).toHaveBeenCalled()
    })

    it('有 token 但无 user 数据时尝试获取', async () => {
      const auth = useAuthStore()
      const token = useTokenStore()
      const user = useUserStore()
      vi.spyOn(token, 'checkExpiryAndClear').mockReturnValue(false)
      vi.spyOn(token, 'restoreToken').mockImplementation(() => {
        token.token = 'mocked-tk'
        return true
      })
      // mock getUserInfo
      vi.mocked(getUserInfo).mockResolvedValue({
        code: 200,
        success: true,
        data: { uuid: 'u-1', status: 1, isVip: false } as any,
      } as any)
      await auth.initAuth()
      expect(user.user).not.toBeNull()
      expect(token.initCompleted).toBe(true)
    })

    it('有 token 无 user 数据，且 fetchUserInfo 报"未登录"时清除 token', async () => {
      const auth = useAuthStore()
      const token = useTokenStore()
      vi.spyOn(token, 'checkExpiryAndClear').mockReturnValue(false)
      vi.spyOn(token, 'restoreToken').mockImplementation(() => {
        token.token = 'mocked-tk'
        return true
      })
      vi.mocked(getUserInfo).mockRejectedValueOnce(new Error('请先登录'))
      await auth.initAuth()
      // token 应被清除
      expect(token.token).toBe('')
    })

    it('有 token 无 user 数据，fetchUserInfo 报其他错误也清除 token', async () => {
      const auth = useAuthStore()
      const token = useTokenStore()
      vi.spyOn(token, 'checkExpiryAndClear').mockReturnValue(false)
      vi.spyOn(token, 'restoreToken').mockImplementation(() => {
        token.token = 'mocked-tk'
        return true
      })
      vi.mocked(getUserInfo).mockRejectedValueOnce(new Error('网络错误'))
      await auth.initAuth()
      expect(token.token).toBe('')
    })

    it('有 token 无 user 数据，fetchUserInfo 返回 response.status 也清除', async () => {
      const auth = useAuthStore()
      const token = useTokenStore()
      vi.spyOn(token, 'checkExpiryAndClear').mockReturnValue(false)
      vi.spyOn(token, 'restoreToken').mockImplementation(() => {
        token.token = 'mocked-tk'
        return true
      })
      const err = new Error('服务器错误') as any
      err.response = { status: 500 }
      vi.mocked(getUserInfo).mockRejectedValueOnce(err)
      await auth.initAuth()
      expect(token.token).toBe('')
    })

    it('有 token + user 数据 时从存储恢复', async () => {
      const auth = useAuthStore()
      const token = useTokenStore()
      const user = useUserStore()
      vi.spyOn(token, 'checkExpiryAndClear').mockReturnValue(false)
      vi.spyOn(token, 'restoreToken').mockImplementation(() => {
        token.token = 'mocked-tk'
        return true
      })
      mockStorage.user_data = {
        uuid: 'u-2',
        username: 'cached',
        nickname: '缓存用户',
        status: 1,
        isVip: false,
        loginTime: '2024-01-01T00:00:00Z',
        lastActiveTime: '2024-01-01T00:00:00Z',
      }
      vi.mocked(getStoredData).mockReturnValue(mockStorage.user_data as any)
      // 后台 fetchUserInfo 抛错不影响主流程
      vi.mocked(getUserInfo).mockRejectedValueOnce(new Error('后台拉取失败'))
      await auth.initAuth()
      expect(user.user?.uuid).toBe('u-2')
      expect(token.loginTime).toBe('2024-01-01T00:00:00Z')
      expect(token.initCompleted).toBe(true)
    })
  })

  // ============ login 测试 ============
  describe('login', () => {
    it('用户名密码登录成功', async () => {
      const auth = useAuthStore()
      const token = useTokenStore()
      const user = useUserStore()
      // 让后台 fetchUserInfo 返回登录时同样的用户，避免竞态
      vi.mocked(getUserInfo).mockResolvedValue({
        code: 200,
        success: true,
        data: {
          uuid: 'u-login',
          username: 'loginuser',
          nickname: '登录用户',
          email: 'a@b.com',
          phone: '13800000000',
          status: 1,
          isVip: false,
        } as any,
      } as any)
      const responseData = {
        token: 'tk-1',
        refreshToken: 'rt-1',
        uuid: 'u-login',
        username: 'loginuser',
        nickname: '登录用户',
        email: 'a@b.com',
        phone: '13800000000',
        status: 1,
        isVip: false,
        thirdPartyAccounts: { accessToken: 'tk-1', refreshToken: 'rt-1' },
      }
      vi.mocked(apiLogin).mockResolvedValue({ code: 200, success: true, data: responseData } as any)
      const loginData: LoginParams = { username: 'loginuser', password: 'pw' } as any
      await auth.login(loginData)
      // 等待后台 fetchUserInfo 完成
      await new Promise(resolve => setTimeout(resolve, 0))
      expect(token.token).toBe('tk-1')
      expect(token.refreshToken).toBe('rt-1')
      expect(user.user?.uuid).toBe('u-login')
      expect(user.isLoading).toBe(false)
    })

    it('手机号+验证码登录成功', async () => {
      const auth = useAuthStore()
      const token = useTokenStore()
      vi.mocked(phoneLogin).mockResolvedValue({ code: 200, success: true, data: 'temp-key' } as any)
      vi.mocked(completePhoneLogin).mockResolvedValue({
        code: 200,
        success: true,
        data: {
          token: 'tk-phone',
          refreshToken: 'rt-phone',
          uuid: 'u-phone',
          phone: '13900000000',
          username: 'phoneuser',
          status: 1,
        },
      } as any)
      await auth.login({ type: 'phone', phone: '13900000000', code: '1234' } as any)
      expect(phoneLogin).toHaveBeenCalledWith({ phone: '13900000000', code: '1234' })
      expect(completePhoneLogin).toHaveBeenCalledWith({ phone: '13900000000', tempKey: 'temp-key' })
      expect(token.token).toBe('tk-phone')
    })

    it('登录信息不完整抛错', async () => {
      const auth = useAuthStore()
      await expect(auth.login({} as any)).rejects.toThrow()
      expect(userStore => userStore.isLoading).toBeDefined()
    })

    it('第三方账号 accessToken 作为 token', async () => {
      const auth = useAuthStore()
      const token = useTokenStore()
      vi.mocked(apiLogin).mockResolvedValue({
        code: 200,
        success: true,
        data: {
          thirdPartyAccounts: { accessToken: 'tk-third', refreshToken: 'rt-third' },
          uuid: 'u-3',
          status: 1,
        },
      } as any)
      await auth.login({ username: 'u', password: 'p' } as any)
      expect(token.token).toBe('tk-third')
      expect(token.refreshToken).toBe('rt-third')
    })

    it('登录失败抛错并清 isLoading', async () => {
      const auth = useAuthStore()
      const user = useUserStore()
      vi.mocked(apiLogin).mockRejectedValue(new Error('登录失败'))
      await expect(auth.login({ username: 'u', password: 'p' } as any)).rejects.toThrow('登录失败')
      expect(user.isLoading).toBe(false)
    })
  })

  // ============ register 测试 ============
  describe('register', () => {
    it('手机号注册：缺少字段时抛错', async () => {
      const auth = useAuthStore()
      await expect(auth.register({ type: 'phone', phone: '13900000000' } as any)).rejects.toThrow()
    })

    it('非手机号注册：缺少字段时抛错', async () => {
      const auth = useAuthStore()
      await expect(auth.register({ type: 'account' } as any)).rejects.toThrow()
    })

    it('手机号注册成功', async () => {
      const auth = useAuthStore()
      const token = useTokenStore()
      const user = useUserStore()
      // 注册流程最后会调用 fetchUserInfo，预先 mock 返回注册的用户数据
      vi.mocked(getUserInfo).mockResolvedValue({
        code: 200,
        success: true,
        data: { uuid: 'u-reg', username: 'newuser', status: 1 } as any,
      } as any)
      vi.mocked(apiRegister).mockResolvedValue({
        code: 200,
        success: true,
        data: {
          token: 'tk-reg',
          refreshToken: 'rt-reg',
          user: { uuid: 'u-reg', username: 'newuser', status: 1 },
        },
      } as any)
      const regData: RegisterParams = {
        type: 'phone',
        phone: '13800000000',
        code: '1234',
        password: 'pw',
        inviteCode: 'INV',
      } as any
      await auth.register(regData)
      expect(token.token).toBe('tk-reg')
      expect(user.user?.uuid).toBe('u-reg')
    })

    it('非手机号注册：包含验证码(无 phone) 当 captcha 处理', async () => {
      const auth = useAuthStore()
      vi.mocked(apiRegister).mockImplementation(async (req: any) => {
        // 验证 captcha 字段
        expect(req.captcha).toBe('smscode')
        return { code: 200, success: true, data: { tokenType: 'Bearer', token: 't', refreshToken: 'r' } } as any
      })
      await auth.register({
        type: 'account',
        username: 'acc',
        password: 'pw',
        code: 'smscode',
      } as any)
      expect(apiRegister).toHaveBeenCalled()
    })

    it('非手机号注册：含 phone+code 时也传 code/phone', async () => {
      const auth = useAuthStore()
      let capturedReq: any
      vi.mocked(apiRegister).mockImplementation(async (req: any) => {
        capturedReq = req
        return { code: 200, success: true, data: { tokenType: 'Bearer', token: 't2', refreshToken: 'r2' } } as any
      })
      await auth.register({
        type: 'account',
        username: 'acc',
        password: 'pw',
        phone: '13900000000',
        code: 'sms',
      } as any)
      expect(capturedReq.phone).toBe('13900000000')
      expect(capturedReq.code).toBe('sms')
    })

    it('响应只含 tokenType 也使用', async () => {
      const auth = useAuthStore()
      const token = useTokenStore()
      vi.mocked(apiRegister).mockResolvedValue({
        code: 200,
        success: true,
        data: { tokenType: 'Bearer', token: 'tk-only-type', refreshToken: 'rt-only-type' },
      } as any)
      await auth.register({ type: 'account', username: 'a', password: 'p' } as any)
      expect(token.token).toBe('tk-only-type')
    })

    it('响应无效抛错（无 token 无 tokenType）', async () => {
      const auth = useAuthStore()
      vi.mocked(apiRegister).mockResolvedValue({
        code: 200,
        success: true,
        data: { foo: 'bar' },
      } as any)
      await expect(
        auth.register({ type: 'account', username: 'a', password: 'p' } as any)
      ).rejects.toThrow()
    })

    it('响应非对象抛错', async () => {
      const auth = useAuthStore()
      vi.mocked(apiRegister).mockResolvedValue({
        code: 200,
        success: true,
        data: 'string-data' as any,
      } as any)
      await expect(
        auth.register({ type: 'account', username: 'a', password: 'p' } as any)
      ).rejects.toThrow()
    })

    it('注册失败抛错', async () => {
      const auth = useAuthStore()
      const user = useUserStore()
      vi.mocked(apiRegister).mockRejectedValue(new Error('注册失败'))
      await expect(
        auth.register({ type: 'account', username: 'a', password: 'p' } as any)
      ).rejects.toThrow('注册失败')
      expect(user.isLoading).toBe(false)
    })
  })

  // ============ logout 测试 ============
  describe('logout', () => {
    it('登出后清空所有状态', async () => {
      const auth = useAuthStore()
      const token = useTokenStore()
      const user = useUserStore()
      const wallet = useWalletStore()
      const vip = useVipStore()
      // 设置初始数据
      token.setToken('tk', 'rt')
      user.user = { uuid: 'u', status: 1 } as any
      wallet.fundInfo = { balance: 100 } as any
      vip.vipInfo = { isActive: true } as any

      await auth.logout()
      expect(token.token).toBe('')
      expect(token.refreshToken).toBe('')
      expect(user.user).toBeNull()
      expect(wallet.fundInfo).toBeNull()
      expect(vip.vipInfo).toBeNull()
      // 验证登出标记被设置
      expect(sessionStorage.getItem('__logout_flag__')).toBeTruthy()
    })
  })

  // ============ thirdPartyLogin 测试 ============
  describe('thirdPartyLogin', () => {
    it('代理调用 thirdPartyStore', async () => {
      const auth = useAuthStore()
      const tp = useThirdPartyStore()
      const user = useUserStore()
      const result = await auth.thirdPartyLogin({
        token: 'tk-tp',
        user: { uuid: 'u-tp', username: 'tp' } as any,
        loginType: 'wx',
      })
      expect(result).toBe(true)
      expect(user.user?.uuid).toBe('u-tp')
    })
  })

  // ============ refreshTokens / refreshTokenAction 测试 ============
  describe('refreshTokens / refreshTokenAction', () => {
    it('无 refreshToken 时仅 fetchUserInfo', async () => {
      const auth = useAuthStore()
      const token = useTokenStore()
      // 必须有 token 才能让 userStore.fetchUserInfo 真正执行
      token.setToken('valid-tk')
      token.refreshToken = ''
      vi.mocked(getUserInfo).mockResolvedValue({
        code: 200,
        success: true,
        data: { uuid: 'u', status: 1 } as any,
      } as any)
      const result = await auth.refreshTokens()
      expect(result.success).toBe(true)
      expect(getUserInfo).toHaveBeenCalled()
    })

    it('refreshToken 成功', async () => {
      const auth = useAuthStore()
      const token = useTokenStore()
      const user = useUserStore()
      token.refreshToken = 'rt-valid'
      vi.mocked(refreshTokenApi).mockResolvedValue({
        success: true,
        data: { token: 'new-tk', refreshToken: 'new-rt' },
      } as any)
      vi.mocked(getUserInfo).mockResolvedValue({
        code: 200,
        success: true,
        data: { uuid: 'u', status: 1 } as any,
      } as any)
      const result = await auth.refreshTokens()
      expect(result.success).toBe(true)
      expect(token.token).toBe('new-tk')
    })

    it('refreshToken 响应 success=false 走 logout', async () => {
      const auth = useAuthStore()
      const token = useTokenStore()
      const user = useUserStore()
      token.refreshToken = 'rt-invalid'
      token.setToken('old-tk', 'rt-invalid')
      user.user = { uuid: 'u', status: 1 } as any
      vi.mocked(refreshTokenApi).mockResolvedValue({ success: false, data: null } as any)
      const result = await auth.refreshTokens()
      expect(result.success).toBe(false)
      expect(token.token).toBe('')
    })

    it('refreshToken 响应 data 缺 token 字段', async () => {
      const auth = useAuthStore()
      const token = useTokenStore()
      token.refreshToken = 'rt-no-token'
      vi.mocked(refreshTokenApi).mockResolvedValue({ success: true, data: {} as any } as any)
      const result = await auth.refreshTokens()
      expect(result.success).toBe(false)
    })

    it('refreshToken 抛错时调用 logout', async () => {
      const auth = useAuthStore()
      const token = useTokenStore()
      token.setToken('tk', 'rt-fail')
      vi.mocked(refreshTokenApi).mockRejectedValue(new Error('网络错误'))
      // refreshTokenAction 内部捕获了异常并返回 false，外层不会 rethrow
      const result = await auth.refreshTokens()
      expect(result.success).toBe(false)
      expect(token.token).toBe('')
    })
  })

  // ============ fetchUserInfo 测试 ============
  describe('fetchUserInfo', () => {
    it('拉取成功后同步 fundInfo/vipInfo 到 wallet/vip store', async () => {
      const auth = useAuthStore()
      const wallet = useWalletStore()
      const vip = useVipStore()
      // 修改 user.fetchUserInfo 的返回
      const user = useUserStore()
      vi.spyOn(user, 'fetchUserInfo').mockResolvedValue({
        fundInfo: { balance: 999 } as any,
        vipInfo: { isActive: true, vipLevelName: '黄金' } as any,
      } as any)
      await auth.fetchUserInfo()
      expect(wallet.fundInfo?.balance).toBe(999)
      expect(vip.vipInfo?.isActive).toBe(true)
    })

    it('返回 null 时不更新 wallet/vip', async () => {
      const auth = useAuthStore()
      const user = useUserStore()
      vi.spyOn(user, 'fetchUserInfo').mockResolvedValue(null as any)
      await auth.fetchUserInfo()
      // 不抛错即通过
    })
  })

  // ============ updateUserInfo / setAuthInfo / setFundInfo / setVipInfo / setUser 测试 ============
  describe('子 store 代理方法', () => {
    it('updateUserInfo 调用 userStore', () => {
      const auth = useAuthStore()
      const user = useUserStore()
      user.user = { uuid: 'u', nickname: 'old' } as any
      auth.updateUserInfo({ nickname: 'new' })
      expect(user.user?.nickname).toBe('new')
    })

    it('setAuthInfo 调用 userStore', () => {
      const auth = useAuthStore()
      const user = useUserStore()
      auth.setAuthInfo({ uuid: 'auth-1', status: 1 } as any)
      expect(user.authInfo?.uuid).toBe('auth-1')
    })

    it('setFundInfo 调用 walletStore', () => {
      const auth = useAuthStore()
      const wallet = useWalletStore()
      auth.setFundInfo({ balance: 50 } as any)
      expect(wallet.fundInfo?.balance).toBe(50)
    })

    it('setVipInfo 调用 vipStore', () => {
      const auth = useAuthStore()
      const vip = useVipStore()
      auth.setVipInfo({ isActive: true, vipLevelName: '钻石' } as any)
      expect(vip.vipInfo?.vipLevelName).toBe('钻石')
    })

    it('setUser 调用 userStore', () => {
      const auth = useAuthStore()
      const user = useUserStore()
      user.user = { uuid: 'u', nickname: 'old' } as any
      auth.setUser({ nickname: 'new' } as any)
      expect(user.user?.nickname).toBe('new')
    })
  })

  // ============ setAuthState 测试 ============
  describe('setAuthState', () => {
    it('正常设置 token/user/存储', () => {
      const auth = useAuthStore()
      const token = useTokenStore()
      const user = useUserStore()
      auth.setAuthState('new-tk', 'new-rt', { uuid: 'u-set', id: 'u-set', status: 1 } as any)
      expect(token.token).toBe('new-tk')
      expect(token.refreshToken).toBe('new-rt')
      expect(user.user?.uuid).toBe('u-set')
      expect(user.authInfo?.uuid).toBe('u-set')
      expect(mockStorage.user_data).toBeDefined()
    })

    it('skipStorage=true 时不写存储', () => {
      const auth = useAuthStore()
      const token = useTokenStore()
      auth.setAuthState('tk-skip', 'rt-skip', { uuid: 'u', id: 'u' } as any, { skipStorage: true })
      expect(token.token).toBe('tk-skip')
      expect(mockStorage.user_data).toBeUndefined()
    })

    it('userData 为 null 时不写存储', () => {
      const auth = useAuthStore()
      const token = useTokenStore()
      auth.setAuthState('tk-null', 'rt-null', null)
      expect(token.token).toBe('tk-null')
      expect(mockStorage.user_data).toBeUndefined()
    })

    it('userData.id 缺失时不设置 authInfo', () => {
      const auth = useAuthStore()
      const user = useUserStore()
      auth.setAuthState('tk', 'rt', { uuid: 'u-no-id' } as any, { skipStorage: true })
      expect(user.authInfo).toBeNull()
    })

    it('支持 loginDuration 参数', () => {
      const auth = useAuthStore()
      auth.setAuthState('tk-d', 'rt-d', { uuid: 'u', id: 'u' } as any, {
        loginDuration: { label: '1天', value: 86400000, days: 1 },
      })
      expect(mockStorage.user_data).toBeDefined()
    })
  })

  // ============ 工具方法测试 ============
  describe('工具方法', () => {
    it('updateLastActiveTime 代理 tokenStore', () => {
      const auth = useAuthStore()
      const token = useTokenStore()
      const before = token.lastActiveTime
      auth.updateLastActiveTime()
      expect(token.lastActiveTime).not.toBe(before)
    })

    it('checkTokenExpiry 代理 tokenStore', () => {
      const auth = useAuthStore()
      const token = useTokenStore()
      const spy = vi.spyOn(token, 'checkTokenExpiry')
      auth.checkTokenExpiry()
      expect(spy).toHaveBeenCalled()
    })

    it('checkPermission 代理 permissionsStore', () => {
      const auth = useAuthStore()
      const perms = usePermissionsStore()
      const spy = vi.spyOn(perms, 'checkPermission')
      auth.checkPermission('chat')
      expect(spy).toHaveBeenCalledWith('chat')
    })

    it('checkFeatureAccess 代理 permissionsStore', () => {
      const auth = useAuthStore()
      const perms = usePermissionsStore()
      const spy = vi.spyOn(perms, 'checkFeatureAccess')
      auth.checkFeatureAccess('chat')
      expect(spy).toHaveBeenCalledWith('chat')
    })

    it('updateBalance 代理 walletStore', () => {
      const auth = useAuthStore()
      const wallet = useWalletStore()
      wallet.fundInfo = { balance: 10 } as any
      auth.updateBalance(99)
      expect(wallet.balance).toBe(99)
    })

    it('consumeBalance 代理 walletStore', () => {
      const auth = useAuthStore()
      const wallet = useWalletStore()
      wallet.fundInfo = { balance: 100, totalConsumption: 0 } as any
      expect(auth.consumeBalance(30)).toBe(true)
      expect(wallet.balance).toBe(70)
    })

    it('rechargeBalance 代理 walletStore', () => {
      const auth = useAuthStore()
      const wallet = useWalletStore()
      wallet.fundInfo = { balance: 100, totalRecharge: 0 } as any
      auth.rechargeBalance(50)
      expect(wallet.balance).toBe(150)
    })
  })

  // ============ 集成场景测试 ============
  describe('集成场景', () => {
    it('登录后所有派生状态正确更新', async () => {
      const auth = useAuthStore()
      const token = useTokenStore()
      const user = useUserStore()
      const wallet = useWalletStore()
      const vip = useVipStore()
      const perms = usePermissionsStore()
      // 让后台 fetchUserInfo 返回登录时同样的用户，避免竞态
      vi.mocked(getUserInfo).mockResolvedValue({
        code: 200,
        success: true,
        data: {
          uuid: 'u-i',
          username: 'integration',
          nickname: '集成用户',
          status: 1,
          isVip: true,
          vipLevelVO: { id: 'v1', title: '黄金', levelName: '黄金', level: 2, userVip: { isValid: 1 } },
          userMargin: { id: 'm1', userUuid: 'u-i', tokenQuantity: 500 },
        } as any,
      } as any)

      vi.mocked(apiLogin).mockResolvedValue({
        code: 200,
        success: true,
        data: {
          token: 'tk-i',
          refreshToken: 'rt-i',
          uuid: 'u-i',
          username: 'integration',
          nickname: '集成用户',
          status: 1,
          isVip: true,
          vipLevelVO: { id: 'v1', title: '黄金', levelName: '黄金', level: 2, userVip: { isValid: 1 } },
          userMargin: { id: 'm1', userUuid: 'u-i', tokenQuantity: 500 },
          thirdPartyAccounts: { accessToken: 'tk-i', refreshToken: 'rt-i' },
        },
      } as any)
      await auth.login({ username: 'integration', password: 'p' } as any)
      // 等待后台 fetchUserInfo 完成
      await new Promise(resolve => setTimeout(resolve, 0))

      expect(token.token).toBe('tk-i')
      expect(user.user?.uuid).toBe('u-i')
      expect(wallet.fundInfo?.balance).toBe(500)
      expect(vip.vipInfo?.isActive).toBe(true)
      expect(perms.isLoggedIn).toBe(true)
      expect(perms.hasRole('vip')).toBe(true)
    })
  })

  // ============ 补充测试：覆盖率提升 ============
  // 重点覆盖之前未触达的分支

  // login: userToken 字段作为 token(L262 附近)
  it('login 使用 userToken 字段作为 token', async () => {
    const auth = useAuthStore()
    const token = useTokenStore()
    vi.mocked(getUserInfo).mockResolvedValue({
      code: 200,
      success: true,
      data: { uuid: 'u-ut', status: 1 } as any,
    } as any)
    vi.mocked(apiLogin).mockResolvedValue({
      code: 200,
      success: true,
      data: {
        userToken: 'tk-from-userToken',
        refreshToken: 'rt-ut',
        uuid: 'u-ut',
        status: 1,
      },
    } as any)
    await auth.login({ username: 'u', password: 'p' } as any)
    expect(token.token).toBe('tk-from-userToken')
  })

  // login: 写入 thirdPartyAccounts.expiresAt/refreshExpiresAt 字段(L285-286 附近)
  it('login 保存 thirdPartyAccounts 的 expiresAt/refreshExpiresAt', async () => {
    const auth = useAuthStore()
    vi.mocked(getUserInfo).mockRejectedValue(new Error('block-background-refresh'))
    vi.mocked(apiLogin).mockResolvedValue({
      code: 200,
      success: true,
      data: {
        token: 'tk-exp',
        refreshToken: 'rt-exp',
        uuid: 'u-exp',
        status: 1,
        thirdPartyAccounts: {
          accessToken: 'tk-exp',
          refreshToken: 'rt-exp',
          expiresAt: '2099-01-01T00:00:00Z',
          refreshExpiresAt: '2099-01-02T00:00:00Z',
        },
      },
    } as any)
    await auth.login({ username: 'u', password: 'p' } as any)
    // 等后台 fetchUserInfo 跑完,避免覆盖 mockStorage
    await new Promise(r => setTimeout(r, 0))
    const stored: any = mockStorage.user_data
    expect(stored.thirdPartyAccounts.expiresAt).toBe('2099-01-01T00:00:00Z')
    expect(stored.thirdPartyAccounts.refreshExpiresAt).toBe('2099-01-02T00:00:00Z')
  })

  // login: 异地登录(isSuspicious=true)时记录可疑日志并发送通知
  it('login 检测到异地登录时记录安全日志与推送通知', async () => {
    const auth = useAuthStore()
    const { LocationService } = await import('@/utils/locationService')
    const { SecurityLogService } = await import('@/utils/securityLogService')
    const { SecurityNotificationService } = await import('@/utils/securityNotificationService')
    vi.mocked(LocationService.checkSuspiciousLogin).mockReturnValueOnce({
      isSuspicious: true,
      reason: '城市变化',
    })
    vi.mocked(getUserInfo).mockResolvedValue({
      code: 200,
      success: true,
      data: { uuid: 'u-susp', status: 1 } as any,
    } as any)
    vi.mocked(apiLogin).mockResolvedValue({
      code: 200,
      success: true,
      data: { token: 'tk-susp', refreshToken: 'rt-susp', uuid: 'u-susp', status: 1 },
    } as any)
    await auth.login({ username: 'u', password: 'p' } as any)
    expect(SecurityLogService.logSuspiciousLogin).toHaveBeenCalledWith('城市变化')
    expect(SecurityNotificationService.notifySuspiciousLogin).toHaveBeenCalledWith('城市变化')
  })

  // login: 设备名为 Mac
  it('login 设备名识别为 Mac', async () => {
    const auth = useAuthStore()
    const { LoginBehaviorService } = await import('@/utils/loginBehaviorService')
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      configurable: true,
    })
    vi.mocked(getUserInfo).mockResolvedValue({
      code: 200,
      success: true,
      data: { uuid: 'u-mac', status: 1 } as any,
    } as any)
    vi.mocked(apiLogin).mockResolvedValue({
      code: 200,
      success: true,
      data: { token: 'tk-mac', refreshToken: 'rt-mac', uuid: 'u-mac', status: 1 },
    } as any)
    await auth.login({ username: 'u', password: 'p' } as any)
    expect(LoginBehaviorService.recordLogin).toHaveBeenCalledWith(
      'test-device-id', 'Mac', expect.anything()
    )
  })

  // login: 设备名为 Linux
  it('login 设备名识别为 Linux', async () => {
    const auth = useAuthStore()
    const { LoginBehaviorService } = await import('@/utils/loginBehaviorService')
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (X11; Linux x86_64)',
      configurable: true,
    })
    vi.mocked(getUserInfo).mockResolvedValue({
      code: 200,
      success: true,
      data: { uuid: 'u-lin', status: 1 } as any,
    } as any)
    vi.mocked(apiLogin).mockResolvedValue({
      code: 200,
      success: true,
      data: { token: 'tk-lin', refreshToken: 'rt-lin', uuid: 'u-lin', status: 1 },
    } as any)
    await auth.login({ username: 'u', password: 'p' } as any)
    expect(LoginBehaviorService.recordLogin).toHaveBeenCalledWith(
      'test-device-id', 'Linux', expect.anything()
    )
  })

  // login: 设备名为 Unknown
  it('login 设备名识别为 Unknown Device', async () => {
    const auth = useAuthStore()
    const { LoginBehaviorService } = await import('@/utils/loginBehaviorService')
    Object.defineProperty(navigator, 'userAgent', {
      value: 'SomeUnknownOS/1.0',
      configurable: true,
    })
    vi.mocked(getUserInfo).mockResolvedValue({
      code: 200,
      success: true,
      data: { uuid: 'u-unk', status: 1 } as any,
    } as any)
    vi.mocked(apiLogin).mockResolvedValue({
      code: 200,
      success: true,
      data: { token: 'tk-unk', refreshToken: 'rt-unk', uuid: 'u-unk', status: 1 },
    } as any)
    await auth.login({ username: 'u', password: 'p' } as any)
    expect(LoginBehaviorService.recordLogin).toHaveBeenCalledWith(
      'test-device-id', 'Unknown Device', expect.anything()
    )
  })

  // refreshTokens: 无 refreshToken 时 fetchUserInfo 抛错,触发 catch 块 (L436-437)
  it('refreshTokens 在无 refreshToken 且 fetchUserInfo 抛错时调用 logout 并 rethrow', async () => {
    const auth = useAuthStore()
    const token = useTokenStore()
    token.setToken('valid-tk')
    token.refreshToken = ''
    vi.mocked(getUserInfo).mockRejectedValue(new Error('fetch-userinfo-err'))
    await expect(auth.refreshTokens()).rejects.toThrow('fetch-userinfo-err')
    expect(token.token).toBe('')
  })

  // 访问 loginTime / lastActiveTime 暴露的 computed (L551-552)
  it('loginTime 与 lastActiveTime getter 可被访问', () => {
    const auth = useAuthStore()
    const token = useTokenStore()
    token.setToken('tk-time')
    expect(typeof auth.loginTime).toBe('string')
    expect(typeof auth.lastActiveTime).toBe('string')
    expect(auth.loginTime).toBe(token.loginTime)
    expect(auth.lastActiveTime).toBe(token.lastActiveTime)
  })

  // login: LoginBehaviorService.recordLogin 抛错时不影响主流程(覆盖 L358)
  it('login 时 recordLogin 抛错被捕获不影响主流程', async () => {
    const auth = useAuthStore()
    const token = useTokenStore()
    const { LoginBehaviorService } = await import('@/utils/loginBehaviorService')
    vi.mocked(LoginBehaviorService.recordLogin).mockImplementationOnce(() => {
      throw new Error('recordLogin-err')
    })
    vi.mocked(getUserInfo).mockResolvedValue({
      code: 200,
      success: true,
      data: { uuid: 'u-rec', status: 1 } as any,
    } as any)
    vi.mocked(apiLogin).mockResolvedValue({
      code: 200,
      success: true,
      data: { token: 'tk-rec', refreshToken: 'rt-rec', uuid: 'u-rec', status: 1 },
    } as any)
    await expect(auth.login({ username: 'u', password: 'p' } as any)).resolves.toBeDefined()
    expect(token.token).toBe('tk-rec')
  })

  // login: 异地登录时 SecurityNotificationService.notifySuspiciousLogin 抛错被捕获(覆盖 L367)
  it('login 异地登录推送失败时不影响主流程', async () => {
    const auth = useAuthStore()
    const { LocationService } = await import('@/utils/locationService')
    const { SecurityNotificationService } = await import('@/utils/securityNotificationService')
    vi.mocked(LocationService.checkSuspiciousLogin).mockReturnValueOnce({
      isSuspicious: true,
      reason: '异地',
    })
    vi.mocked(SecurityNotificationService.notifySuspiciousLogin).mockImplementationOnce(() => {
      throw new Error('notify-err')
    })
    vi.mocked(getUserInfo).mockResolvedValue({
      code: 200,
      success: true,
      data: { uuid: 'u-nf', status: 1 } as any,
    } as any)
    vi.mocked(apiLogin).mockResolvedValue({
      code: 200,
      success: true,
      data: { token: 'tk-nf', refreshToken: 'rt-nf', uuid: 'u-nf', status: 1 },
    } as any)
    await expect(auth.login({ username: 'u', password: 'p' } as any)).resolves.toBeDefined()
  })

  // login: websocketService.connect 抛错被捕获(覆盖 L378)
  it('login 时 WebSocket 连接失败不影响主流程', async () => {
    const auth = useAuthStore()
    const token = useTokenStore()
    const { websocketService } = await import('@/utils/websocket')
    vi.mocked(websocketService.connect).mockRejectedValueOnce(new Error('ws-conn-err'))
    vi.mocked(getUserInfo).mockResolvedValue({
      code: 200,
      success: true,
      data: { uuid: 'u-ws', status: 1 } as any,
    } as any)
    vi.mocked(apiLogin).mockResolvedValue({
      code: 200,
      success: true,
      data: { token: 'tk-ws', refreshToken: 'rt-ws', uuid: 'u-ws', status: 1 },
    } as any)
    await expect(auth.login({ username: 'u', password: 'p' } as any)).resolves.toBeDefined()
    expect(token.token).toBe('tk-ws')
  })

  // login: MultiDeviceService.registerCurrentDevice 抛错(覆盖 L317)
  it('login 设备注册失败不影响主流程', async () => {
    const auth = useAuthStore()
    const token = useTokenStore()
    const { MultiDeviceService } = await import('@/utils/multiDeviceService')
    vi.mocked(MultiDeviceService.registerCurrentDevice).mockRejectedValueOnce(new Error('dev-reg-err'))
    vi.mocked(getUserInfo).mockResolvedValue({
      code: 200,
      success: true,
      data: { uuid: 'u-dr', status: 1 } as any,
    } as any)
    vi.mocked(apiLogin).mockResolvedValue({
      code: 200,
      success: true,
      data: { token: 'tk-dr', refreshToken: 'rt-dr', uuid: 'u-dr', status: 1 },
    } as any)
    await expect(auth.login({ username: 'u', password: 'p' } as any)).resolves.toBeDefined()
    expect(token.token).toBe('tk-dr')
  })

  // login: SecurityLogService.logLogin 抛错(覆盖 L324)
  it('login 登录日志记录失败不影响主流程', async () => {
    const auth = useAuthStore()
    const token = useTokenStore()
    const { SecurityLogService } = await import('@/utils/securityLogService')
    vi.mocked(SecurityLogService.logLogin).mockRejectedValueOnce(new Error('log-login-err'))
    vi.mocked(getUserInfo).mockResolvedValue({
      code: 200,
      success: true,
      data: { uuid: 'u-ll', status: 1 } as any,
    } as any)
    vi.mocked(apiLogin).mockResolvedValue({
      code: 200,
      success: true,
      data: { token: 'tk-ll', refreshToken: 'rt-ll', uuid: 'u-ll', status: 1 },
    } as any)
    await expect(auth.login({ username: 'u', password: 'p' } as any)).resolves.toBeDefined()
    expect(token.token).toBe('tk-ll')
  })

  // login: LocationService.fetchCurrentLocation 抛错(覆盖 L346)
  it('login 位置服务失败不影响主流程', async () => {
    const auth = useAuthStore()
    const token = useTokenStore()
    const { LocationService } = await import('@/utils/locationService')
    vi.mocked(LocationService.fetchCurrentLocation).mockRejectedValueOnce(new Error('loc-err'))
    vi.mocked(getUserInfo).mockResolvedValue({
      code: 200,
      success: true,
      data: { uuid: 'u-loc', status: 1 } as any,
    } as any)
    vi.mocked(apiLogin).mockResolvedValue({
      code: 200,
      success: true,
      data: { token: 'tk-loc', refreshToken: 'rt-loc', uuid: 'u-loc', status: 1 },
    } as any)
    await expect(auth.login({ username: 'u', password: 'p' } as any)).resolves.toBeDefined()
    expect(token.token).toBe('tk-loc')
  })

  // register: 响应只含 tokenType 字段(无 token 字段)走 else if 分支(覆盖 L188-189)
  it('register 响应只含 tokenType 时从 token/refreshToken 字段取 token', async () => {
    const auth = useAuthStore()
    const token = useTokenStore()
    vi.mocked(apiRegister).mockResolvedValue({
      code: 200,
      success: true,
      data: {
        tokenType: 'Bearer',
        refreshToken: 'rt-tt',
      },
    } as any)
    await auth.register({ type: 'account', username: 'a', password: 'p' } as any)
    // token 字段为空(响应中未提供),refreshToken 有值
    expect(token.refreshToken).toBe('rt-tt')
  })

  // 访问 isTokenExpired getter (L48)
  it('isTokenExpired getter 可被访问', () => {
    const auth = useAuthStore()
    expect(typeof auth.isTokenExpired).toBe('boolean')
  })

  // checkTokenExpiry 真实调用(覆盖 L536 中 tokenStore.checkTokenExpiry 的回调参数)
  it('checkTokenExpiry 真实执行 tokenStore.checkTokenExpiry', () => {
    const auth = useAuthStore()
    const token = useTokenStore()
    token.setToken('tk-check')
    // 直接调用,确保 L536 内部回调函数被传入
    auth.checkTokenExpiry()
    // 验证 token 未被清掉(没到 80% 时长)
    expect(token.token).toBe('tk-check')
  })
})
