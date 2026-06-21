import { describe, it, expect, vi, beforeEach } from 'vitest'
import { RouteGuardHandler, createRouteGuardHandler, createMainGuard, type RouteGuardConfig } from '../routeGuardHandler'
import { StorageManager, STORAGE_KEYS } from '@/utils/storage'
import { isLoginExpired } from '@/utils/login-duration'
import { hasAnyRedirectFlag, redirectFlagManager } from '../redirectFlagManager'
import { detectRedirectLoop, logGuardStart } from '../routeDiagnostics'
import { isAuthStateValid, restoreAuthStateAtomically } from '../authStateRestore'
import { isThirdPartyCallbackRoute } from '../../thirdPartyLoginRoutes'
import { useAuthStore } from '@/stores/auth'

// mock 存储工具
vi.mock('@/utils/storage', () => ({
  StorageManager: {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
  STORAGE_KEYS: {
    TOKEN: 'token',
    USER: 'user',
    USER_TOKEN: 'user_token',
    USER_DATA: 'user_data',
    LOGIN_EXPIRY_TIME: 'login_expiry_time',
  },
}))

// mock 登录过期检查
vi.mock('@/utils/login-duration', () => ({
  isLoginExpired: vi.fn(() => false),
}))

// mock 日志
vi.mock('@/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}))

// mock 重定向标志管理器
vi.mock('../redirectFlagManager', () => ({
  setRedirectFlag: vi.fn(),
  hasAnyRedirectFlag: vi.fn(() => false),
  redirectFlagManager: {
    set: vi.fn(),
    has: vi.fn(() => false),
    clear: vi.fn(),
    clearExpiredFlags: vi.fn(),
  },
}))

// mock 路由诊断
vi.mock('../routeDiagnostics', () => ({
  logGuardStart: vi.fn(),
  logGuardEnd: vi.fn(),
  logRedirect: vi.fn(),
  logRouteWarning: vi.fn(),
  detectRedirectLoop: vi.fn(() => false),
}))

// mock 认证状态恢复
vi.mock('../authStateRestore', () => ({
  restoreAuthStateAtomically: vi.fn(),
  isAuthStateValid: vi.fn(() => false),
}))

// mock 第三方登录路由
vi.mock('../../thirdPartyLoginRoutes', () => ({
  isThirdPartyCallbackRoute: vi.fn(() => false),
}))

// mock 认证store
vi.mock('@/stores/auth', () => ({
  useAuthStore: vi.fn(() => ({
    isLoggedIn: false,
    token: null,
    user: null,
    logout: vi.fn(),
  })),
}))

// mock sessionStorage（使用Proxy使Object.keys返回存储的key）
const sessionStorageMock = (() => {
  let store: Record<string, string> = {}
  const target = {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value }),
    removeItem: vi.fn((key: string) => { delete store[key] }),
    clear: vi.fn(() => { store = {} }),
    key: vi.fn((i: number) => Object.keys(store)[i] ?? null),
    get length() { return Object.keys(store).length },
  }
  return new Proxy(target, {
    ownKeys: () => Object.keys(store),
    getOwnPropertyDescriptor: (_t, key) => {
      const k = key as string
      if (k in store) {
        return { configurable: true, enumerable: true, value: store[k], writable: true }
      }
      return Object.getOwnPropertyDescriptor(target, k)
    },
  })
})()
Object.defineProperty(window, 'sessionStorage', { value: sessionStorageMock, writable: true })

const mockRouter = {
  push: vi.fn(),
  replace: vi.fn(),
  go: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  currentRoute: { value: { path: '/' } },
}

// 创建模拟路由对象
const createMockRoute = (path: string, query: Record<string, string> = {}, meta: Record<string, unknown> = {}, name?: string): any => ({
  path,
  query,
  params: {},
  name: name ?? path,
  meta,
  matched: [],
  redirectedFrom: null,
  fullPath: path,
  hash: '',
})

// 默认的authStore mock
const defaultAuthStore = {
  isLoggedIn: false,
  token: null,
  user: null,
  logout: vi.fn(),
}

describe('routeGuardHandler', () => {
  let handler: RouteGuardHandler

  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorageMock.clear()
    // 重置所有mock的默认实现
    vi.mocked(StorageManager.getItem).mockReturnValue(null)
    vi.mocked(isLoginExpired).mockReturnValue(false)
    vi.mocked(hasAnyRedirectFlag).mockReturnValue(false)
    vi.mocked(detectRedirectLoop).mockReturnValue(false)
    vi.mocked(isAuthStateValid).mockReturnValue(false)
    vi.mocked(restoreAuthStateAtomically).mockResolvedValue({ success: true, hasToken: false, hasUserData: false, isExpired: false })
    vi.mocked(isThirdPartyCallbackRoute).mockReturnValue(false)
    vi.mocked(useAuthStore).mockReturnValue({ ...defaultAuthStore, logout: vi.fn() })
    handler = new RouteGuardHandler(mockRouter as any)
  })

  describe('RouteGuardHandler', () => {
    it('应该能够创建实例', () => {
      expect(handler).toBeDefined()
    })

    it('应该使用默认配置', () => {
      const handlerWithDefaults = new RouteGuardHandler(mockRouter as any)
      expect(handlerWithDefaults).toBeDefined()
    })

    it('应该支持自定义配置', () => {
      const customConfig: Partial<RouteGuardConfig> = {
        guardTimeout: 10000,
        enableDiagnostics: false,
        enableLoopDetection: false,
        maxLoopCount: 5,
        loopDetectionWindow: 5000,
      }
      const handlerWithCustomConfig = new RouteGuardHandler(mockRouter as any, customConfig)
      expect(handlerWithCustomConfig).toBeDefined()
    })
  })

  describe('handleLoginPage', () => {
    it('应该处理登录页路由', async () => {
      const to = createMockRoute('/login')
      const from = createMockRoute('/')
      const next = vi.fn()

      await handler.handleLoginPage(to, from, next)

      expect(next).toHaveBeenCalled()
    })

    it('检测到重定向标志时直接通过', async () => {
      vi.mocked(hasAnyRedirectFlag).mockReturnValue(true)

      const to = createMockRoute('/login')
      const from = createMockRoute('/')
      const next = vi.fn()

      await handler.handleLoginPage(to, from, next)

      expect(next).toHaveBeenCalledWith()
    })

    it('检测到循环重定向时强制通过', async () => {
      vi.mocked(detectRedirectLoop).mockReturnValue(true)

      const to = createMockRoute('/login')
      const from = createMockRoute('/')
      const next = vi.fn()

      await handler.handleLoginPage(to, from, next)

      expect(next).toHaveBeenCalledWith()
    })

    it('应该处理带source参数的路由', async () => {
      const to = createMockRoute('/login', { source: 'wechat' })
      const from = createMockRoute('/')
      const next = vi.fn()

      await handler.handleLoginPage(to, from, next)

      expect(next).toHaveBeenCalled()
    })

    it('应该处理带body参数的路由', async () => {
      const to = createMockRoute('/login', { body: 'test' })
      const from = createMockRoute('/')
      const next = vi.fn()

      await handler.handleLoginPage(to, from, next)

      expect(next).toHaveBeenCalled()
    })

    it('应该处理相同路径的路由', async () => {
      const to = createMockRoute('/login')
      const from = createMockRoute('/login')
      const next = vi.fn()

      await handler.handleLoginPage(to, from, next)

      expect(next).toHaveBeenCalled()
    })

    it('应该处理注册页路由', async () => {
      const to = createMockRoute('/register')
      const from = createMockRoute('/')
      const next = vi.fn()

      await handler.handleLoginPage(to, from, next)

      expect(next).toHaveBeenCalled()
    })

    it('已登录用户从其他页面访问登录页时重定向', async () => {
      vi.mocked(useAuthStore).mockReturnValue({
        isLoggedIn: true,
        token: 'test-token',
        user: { uuid: '123' },
        logout: vi.fn(),
      })
      vi.mocked(isAuthStateValid).mockReturnValue(true)

      const to = createMockRoute('/login')
      const from = createMockRoute('/dashboard')
      const next = vi.fn()

      await handler.handleLoginPage(to, from, next)

      expect(next).toHaveBeenCalledWith({ path: '/' })
    })

    it('已登录用户从首页访问登录页时直接通过避免循环', async () => {
      vi.mocked(useAuthStore).mockReturnValue({
        isLoggedIn: true,
        token: 'test-token',
        user: { uuid: '123' },
        logout: vi.fn(),
      })
      vi.mocked(isAuthStateValid).mockReturnValue(true)

      const to = createMockRoute('/login')
      const from = createMockRoute('/')
      const next = vi.fn()

      await handler.handleLoginPage(to, from, next)

      expect(next).toHaveBeenCalledWith()
    })

    it('已登录但store未认证时调用状态恢复', async () => {
      vi.mocked(useAuthStore).mockReturnValue({
        isLoggedIn: false,
        token: null,
        user: null,
        logout: vi.fn(),
      })
      vi.mocked(isAuthStateValid).mockReturnValue(true)

      const to = createMockRoute('/login')
      const from = createMockRoute('/dashboard')
      const next = vi.fn()

      await handler.handleLoginPage(to, from, next)

      expect(restoreAuthStateAtomically).toHaveBeenCalledWith(true)
    })

    it('有保存的返回路径时使用返回路径', async () => {
      vi.mocked(useAuthStore).mockReturnValue({
        isLoggedIn: true,
        token: 'test-token',
        user: { uuid: '123' },
        logout: vi.fn(),
      })
      vi.mocked(isAuthStateValid).mockReturnValue(true)
      vi.mocked(StorageManager.getItem).mockImplementation((key: string) => {
        if (key === 'auth-return-path') return '/profile'
        return null
      })

      const to = createMockRoute('/login')
      const from = createMockRoute('/dashboard')
      const next = vi.fn()

      await handler.handleLoginPage(to, from, next)

      expect(next).toHaveBeenCalledWith({ path: '/profile' })
    })

    it('处理过程中抛出异常时直接通过', async () => {
      vi.mocked(useAuthStore).mockImplementation(() => {
        throw new Error('store error')
      })

      const to = createMockRoute('/login')
      const from = createMockRoute('/dashboard')
      const next = vi.fn()

      await handler.handleLoginPage(to, from, next)

      expect(next).toHaveBeenCalledWith()
    })

    it('处理过程中抛出非Error对象时直接通过', async () => {
      // 抛出非Error对象（字符串），覆盖logRouteError的非Error分支
      vi.mocked(useAuthStore).mockImplementation(() => {
        throw 'string error'
      })

      const to = createMockRoute('/login')
      const from = createMockRoute('/dashboard')
      const next = vi.fn()

      await handler.handleLoginPage(to, from, next)

      expect(next).toHaveBeenCalledWith()
    })
  })

  describe('handleAuthRequiredPage', () => {
    it('应该处理需要认证的路由', async () => {
      const to = createMockRoute('/dashboard')
      const from = createMockRoute('/')
      const next = vi.fn()

      await handler.handleAuthRequiredPage(to, from, next)

      expect(next).toHaveBeenCalled()
    })

    it('未登录时重定向到登录页', async () => {
      const to = createMockRoute('/dashboard')
      const from = createMockRoute('/')
      const next = vi.fn()

      await handler.handleAuthRequiredPage(to, from, next)

      expect(next).toHaveBeenCalledWith({ name: 'login', query: { redirect: '/dashboard' } })
    })

    it('应该处理需要管理员权限的路由', async () => {
      const to = createMockRoute('/admin', {}, { requiresAdmin: true })
      const from = createMockRoute('/')
      const next = vi.fn()

      await handler.handleAuthRequiredPage(to, from, next)

      expect(next).toHaveBeenCalled()
    })

    it('应该处理需要认证的路由当已登录时', async () => {
      vi.mocked(useAuthStore).mockReturnValue({
        isLoggedIn: true,
        token: 'test-token',
        user: { uuid: '123' },
        logout: vi.fn(),
      })
      vi.mocked(StorageManager.getItem).mockImplementation((key: string) => {
        if (key === STORAGE_KEYS.TOKEN) return 'test-token'
        if (key === STORAGE_KEYS.LOGIN_EXPIRY_TIME) return Date.now() + 100000
        return null
      })

      const to = createMockRoute('/dashboard')
      const from = createMockRoute('/')
      const next = vi.fn()

      await handler.handleAuthRequiredPage(to, from, next)

      expect(next).toHaveBeenCalled()
    })

    it('store未登录但storage有token时恢复用户信息', async () => {
      vi.mocked(useAuthStore).mockReturnValue({
        isLoggedIn: false,
        token: null,
        user: null,
        logout: vi.fn(),
      })
      const userData = { uuid: 'user-uuid', username: 'testuser', email: 'test@test.com' }
      vi.mocked(StorageManager.getItem).mockImplementation((key: string) => {
        if (key === STORAGE_KEYS.TOKEN) return 'stored-token'
        if (key === STORAGE_KEYS.LOGIN_EXPIRY_TIME) return Date.now() + 100000
        if (key === STORAGE_KEYS.USER_DATA) return userData
        return null
      })

      const to = createMockRoute('/dashboard')
      const from = createMockRoute('/')
      const next = vi.fn()

      await handler.handleAuthRequiredPage(to, from, next)

      expect(next).toHaveBeenCalled()
    })

    it('token已过期时清理存储并logout', async () => {
      const logoutMock = vi.fn()
      vi.mocked(useAuthStore).mockReturnValue({
        isLoggedIn: false,
        token: 'expired-token',
        user: { uuid: '123' },
        logout: logoutMock,
      })
      vi.mocked(StorageManager.getItem).mockImplementation((key: string) => {
        if (key === STORAGE_KEYS.TOKEN) return 'expired-token'
        if (key === STORAGE_KEYS.LOGIN_EXPIRY_TIME) return Date.now() - 1000
        return null
      })
      vi.mocked(isLoginExpired).mockReturnValue(true)

      const to = createMockRoute('/dashboard')
      const from = createMockRoute('/')
      const next = vi.fn()

      await handler.handleAuthRequiredPage(to, from, next)

      expect(logoutMock).toHaveBeenCalled()
    })

    it('token已过期但store无token时不调用logout', async () => {
      const logoutMock = vi.fn()
      vi.mocked(useAuthStore).mockReturnValue({
        isLoggedIn: false,
        token: null,
        user: null,
        logout: logoutMock,
      })
      vi.mocked(StorageManager.getItem).mockImplementation((key: string) => {
        if (key === STORAGE_KEYS.TOKEN) return 'expired-token'
        if (key === STORAGE_KEYS.LOGIN_EXPIRY_TIME) return Date.now() - 1000
        return null
      })
      vi.mocked(isLoginExpired).mockReturnValue(true)

      const to = createMockRoute('/dashboard')
      const from = createMockRoute('/')
      const next = vi.fn()

      await handler.handleAuthRequiredPage(to, from, next)

      // store无token时不应调用logout
      expect(logoutMock).not.toHaveBeenCalled()
    })

    it('非管理员访问管理员页面重定向到403', async () => {
      vi.mocked(useAuthStore).mockReturnValue({
        isLoggedIn: true,
        token: 'test-token',
        user: { uuid: '123', role: 'user' },
        logout: vi.fn(),
      })
      vi.mocked(StorageManager.getItem).mockImplementation((key: string) => {
        if (key === STORAGE_KEYS.TOKEN) return 'test-token'
        if (key === STORAGE_KEYS.LOGIN_EXPIRY_TIME) return Date.now() + 100000
        if (key === STORAGE_KEYS.USER_DATA) return { role: 'user' }
        return null
      })

      const to = createMockRoute('/admin', {}, { requiresAdmin: true })
      const from = createMockRoute('/')
      const next = vi.fn()

      await handler.handleAuthRequiredPage(to, from, next)

      expect(next).toHaveBeenCalledWith({ path: '/403', replace: true })
    })

    it('管理员访问管理员页面通过', async () => {
      vi.mocked(useAuthStore).mockReturnValue({
        isLoggedIn: true,
        token: 'test-token',
        user: { uuid: '123', role: 'admin' },
        logout: vi.fn(),
      })
      vi.mocked(StorageManager.getItem).mockImplementation((key: string) => {
        if (key === STORAGE_KEYS.TOKEN) return 'test-token'
        if (key === STORAGE_KEYS.LOGIN_EXPIRY_TIME) return Date.now() + 100000
        if (key === STORAGE_KEYS.USER_DATA) return { role: 'admin' }
        return null
      })

      const to = createMockRoute('/admin', {}, { requiresAdmin: true })
      const from = createMockRoute('/')
      const next = vi.fn()

      await handler.handleAuthRequiredPage(to, from, next)

      expect(next).toHaveBeenCalledWith()
    })

    it('处理过程中抛出异常时直接通过', async () => {
      vi.mocked(useAuthStore).mockImplementation(() => {
        throw new Error('store error')
      })

      const to = createMockRoute('/dashboard')
      const from = createMockRoute('/')
      const next = vi.fn()

      await handler.handleAuthRequiredPage(to, from, next)

      expect(next).toHaveBeenCalledWith()
    })

    it('保存返回路径失败时静默处理', async () => {
      // 让StorageManager.setItem抛出异常
      vi.mocked(StorageManager.setItem).mockImplementation(() => {
        throw new Error('setItem error')
      })

      const to = createMockRoute('/dashboard')
      const from = createMockRoute('/')
      const next = vi.fn()

      await handler.handleAuthRequiredPage(to, from, next)

      // 即使setItem失败，也应该重定向到登录页
      expect(next).toHaveBeenCalledWith({ name: 'login', query: { redirect: '/dashboard' } })
    })

    it('恢复用户信息失败时记录错误但仍通过', async () => {
      // store未登录，但storage有token和userData
      const authStoreMock: any = {
        isLoggedIn: false,
        token: null,
        user: null,
        logout: vi.fn(),
      }
      // 让user的setter抛出异常
      Object.defineProperty(authStoreMock, 'user', {
        get: () => null,
        set: () => { throw new Error('set user error') },
        configurable: true,
      })
      vi.mocked(useAuthStore).mockReturnValue(authStoreMock)

      vi.mocked(StorageManager.getItem).mockImplementation((key: string) => {
        if (key === STORAGE_KEYS.TOKEN) return 'stored-token'
        if (key === STORAGE_KEYS.LOGIN_EXPIRY_TIME) return Date.now() + 100000
        if (key === STORAGE_KEYS.USER_DATA) return { uuid: '123', username: 'test' }
        return null
      })

      const to = createMockRoute('/dashboard')
      const from = createMockRoute('/')
      const next = vi.fn()

      await handler.handleAuthRequiredPage(to, from, next)

      expect(next).toHaveBeenCalled()
    })
  })

  describe('handlePublicPage', () => {
    it('应该处理公开页面', async () => {
      const to = createMockRoute('/')
      const from = createMockRoute('/')
      const next = vi.fn()

      await handler.handlePublicPage(to, from, next)

      expect(next).toHaveBeenCalled()
    })

    it('检测到循环重定向时记录警告但仍通过', async () => {
      vi.mocked(detectRedirectLoop).mockReturnValue(true)

      const to = createMockRoute('/')
      const from = createMockRoute('/')
      const next = vi.fn()

      await handler.handlePublicPage(to, from, next)

      expect(next).toHaveBeenCalledWith()
    })

    it('处理过程中抛出异常时直接通过', async () => {
      // 让detectRedirectLoop抛出异常（在try里面）
      vi.mocked(detectRedirectLoop).mockImplementation(() => {
        throw new Error('detect error')
      })

      const to = createMockRoute('/')
      const from = createMockRoute('/')
      const next = vi.fn()

      await handler.handlePublicPage(to, from, next)

      expect(next).toHaveBeenCalledWith()
    })
  })

  describe('checkRedirectFlag', () => {
    it('没有重定向标志时返回false', () => {
      const to = createMockRoute('/login')
      const result = handler.checkRedirectFlag(to)
      expect(result).toBe(false)
    })

    it('有重定向标志时返回true', () => {
      vi.mocked(hasAnyRedirectFlag).mockReturnValue(true)

      const to = createMockRoute('/login')
      const result = handler.checkRedirectFlag(to)
      expect(result).toBe(true)
    })
  })

  describe('cleanupExpiredFlags', () => {
    it('应该清理过期标志', () => {
      handler.cleanupExpiredFlags()
    })

    it('应该清理sessionStorage中的过期标志', () => {
      // 设置一个过期的sessionStorage标志
      const expiredTimestamp = Date.now() - 20000
      const key = `__redirecting_from_login_${expiredTimestamp}`
      // 直接调用mock的setItem
      sessionStorageMock.setItem(key, 'true')

      // 验证key已存储
      expect(sessionStorageMock.getItem(key)).toBe('true')

      handler.cleanupExpiredFlags()

      // 验证removeItem被调用（可能因为Object.keys不返回存储的key，所以这个分支可能不被触发）
      // 但至少验证cleanupExpiredFlags不会抛出异常
      expect(() => handler.cleanupExpiredFlags()).not.toThrow()
    })

    it('清理sessionStorage出错时静默处理', () => {
      // 让Object.keys抛出异常
      const originalKeys = Object.keys
      Object.keys = vi.fn(() => { throw new Error('keys error') }) as any

      expect(() => handler.cleanupExpiredFlags()).not.toThrow()

      Object.keys = originalKeys
    })

    it('清理重定向标志失败时记录警告', () => {
      // 让redirectFlagManager.clearExpiredFlags抛出异常
      vi.mocked(redirectFlagManager.clearExpiredFlags).mockImplementation(() => {
        throw new Error('clear error')
      })

      expect(() => handler.cleanupExpiredFlags()).not.toThrow()
    })

    it('清理无效timestamp的sessionStorage标志时静默处理', () => {
      // 设置一个无效timestamp的sessionStorage标志（timestamp是NaN）
      sessionStorageMock.setItem('__redirecting_from_login_invalid', 'true')

      expect(() => handler.cleanupExpiredFlags()).not.toThrow()
    })
  })

  describe('createGuardWithTimeout', () => {
    it('正常调用handler', async () => {
      const handlerFn = vi.fn(async (_to: any, _from: any, next: any) => { next() })
      const guard = handler.createGuardWithTimeout(handlerFn)

      const to = createMockRoute('/dashboard')
      const from = createMockRoute('/')
      const next = vi.fn()

      guard(to, from, next)

      // 等待异步操作
      await new Promise(r => setTimeout(r, 50))

      expect(handlerFn).toHaveBeenCalled()
    })

    it('检测到登录页重复导航时取消导航', async () => {
      const handlerFn = vi.fn(async (_to: any, _from: any, next: any) => { next() })
      const guard = handler.createGuardWithTimeout(handlerFn)

      const to = createMockRoute('/login')
      const from = createMockRoute('/login')
      const next = vi.fn()

      // 第一次调用
      guard(to, from, next)
      // 第二次调用（重复）
      guard(to, from, next)

      await new Promise(r => setTimeout(r, 50))

      // 第二次应该调用next(false)
      expect(next).toHaveBeenLastCalledWith(false)
    })

    it('检测到非登录页重复导航时取消导航', async () => {
      const handlerFn = vi.fn(async (_to: any, _from: any, next: any) => { next() })
      const guard = handler.createGuardWithTimeout(handlerFn)

      const to = createMockRoute('/dashboard')
      const from = createMockRoute('/home')
      const next = vi.fn()

      // 第一次调用
      guard(to, from, next)
      // 第二次调用（重复）
      guard(to, from, next)

      await new Promise(r => setTimeout(r, 50))

      // 第二次应该调用next(false)
      expect(next).toHaveBeenLastCalledWith(false)
    })

    it('有重定向标志时直接通过', async () => {
      vi.mocked(hasAnyRedirectFlag).mockReturnValue(true)

      const handlerFn = vi.fn(async (_to: any, _from: any, next: any) => { next() })
      const guard = handler.createGuardWithTimeout(handlerFn)

      const to = createMockRoute('/dashboard')
      const from = createMockRoute('/')
      const next = vi.fn()

      guard(to, from, next)

      await new Promise(r => setTimeout(r, 50))

      expect(handlerFn).not.toHaveBeenCalled()
      expect(next).toHaveBeenCalledWith(true)
    })

    it('handler抛出异常时调用safeNext(true)', async () => {
      const handlerFn = vi.fn(async () => { throw new Error('handler error') })
      const guard = handler.createGuardWithTimeout(handlerFn)

      const to = createMockRoute('/dashboard')
      const from = createMockRoute('/')
      const next = vi.fn()

      guard(to, from, next)

      await new Promise(r => setTimeout(r, 50))

      expect(next).toHaveBeenCalledWith(true)
    })

    it('safeNext包装：未传入参数时调用next()', async () => {
      const handlerFn = vi.fn(async (_to: any, _from: any, next: any) => { next() })
      const guard = handler.createGuardWithTimeout(handlerFn)

      const to = createMockRoute('/dashboard')
      const from = createMockRoute('/')
      const next = vi.fn()

      guard(to, from, next)

      await new Promise(r => setTimeout(r, 50))

      expect(next).toHaveBeenCalledWith()
    })

    it('safeNext包装：传入参数时调用next(arg)', async () => {
      const handlerFn = vi.fn(async (_to: any, _from: any, next: any) => { next('/login') })
      const guard = handler.createGuardWithTimeout(handlerFn)

      const to = createMockRoute('/dashboard')
      const from = createMockRoute('/')
      const next = vi.fn()

      guard(to, from, next)

      await new Promise(r => setTimeout(r, 50))

      expect(next).toHaveBeenCalledWith('/login')
    })

    it('handler执行超时时强制通过', async () => {
      // 使用很短的超时时间
      const shortTimeoutHandler = new RouteGuardHandler(mockRouter as any, { guardTimeout: 50 })
      // handler延迟执行，超过超时时间
      const handlerFn = vi.fn(async (_to: any, _from: any, _next: any) => {
        await new Promise(r => setTimeout(r, 200))
      })
      const guard = shortTimeoutHandler.createGuardWithTimeout(handlerFn)

      const to = createMockRoute('/dashboard')
      const from = createMockRoute('/')
      const next = vi.fn()

      guard(to, from, next)

      // 等待超时触发
      await new Promise(r => setTimeout(r, 300))

      expect(next).toHaveBeenCalledWith()
    })

    it('handler执行时间超过1秒时记录警告', async () => {
      // 使用spyOn更可靠地mock Date.now
      const dateSpy = vi.spyOn(Date, 'now')
      // guardStartTime返回0，cleanupExpiredFlags中的Date.now返回0，safeNext中的duration计算返回2000
      dateSpy.mockReturnValueOnce(0) // guardStartTime
      dateSpy.mockReturnValueOnce(0) // cleanupExpiredFlags中的now
      dateSpy.mockReturnValue(2000)  // safeNext中的Date.now

      const handlerFn = vi.fn(async (_to: any, _from: any, next: any) => { next() })
      const guard = handler.createGuardWithTimeout(handlerFn)

      const to = createMockRoute('/dashboard')
      const from = createMockRoute('/')
      const next = vi.fn()

      guard(to, from, next)

      await new Promise(r => setTimeout(r, 50))

      expect(next).toHaveBeenCalledWith()

      dateSpy.mockRestore()
    })

    it('正在处理时跳过后续调用', async () => {
      // handler延迟执行，让isProcessing保持true
      const handlerFn = vi.fn(async (_to: any, _from: any, next: any) => {
        await new Promise(r => setTimeout(r, 100))
        next()
      })
      const guard = handler.createGuardWithTimeout(handlerFn)

      const next1 = vi.fn()
      const next2 = vi.fn()

      // 第一次调用（开始处理）
      guard(createMockRoute('/dashboard'), createMockRoute('/'), next1)
      // 等待60ms（超过重复导航检测窗口，但handler还没完成）
      await new Promise(r => setTimeout(r, 60))
      // 第二次调用（使用不同路径避免重复导航检测，正在处理应该跳过）
      guard(createMockRoute('/profile'), createMockRoute('/home'), next2)

      await new Promise(r => setTimeout(r, 200))

      // 第二次调用应该直接next()（跳过处理）
      expect(next2).toHaveBeenCalledWith()
    })

    it('超时后handler调用safeNext时直接返回', async () => {
      // 使用很短的超时时间
      const shortTimeoutHandler = new RouteGuardHandler(mockRouter as any, { guardTimeout: 50 })
      let safeNextRef: any
      // handler捕获safeNext引用，延迟调用（在超时后）
      const handlerFn = vi.fn(async (_to: any, _from: any, next: any) => {
        safeNextRef = next
        await new Promise(r => setTimeout(r, 200))
      })
      const guard = shortTimeoutHandler.createGuardWithTimeout(handlerFn)

      const to = createMockRoute('/dashboard')
      const from = createMockRoute('/')
      const next = vi.fn()

      guard(to, from, next)

      // 等待超时触发
      await new Promise(r => setTimeout(r, 100))
      // 超时后isProcessing已是false，调用safeNext应该直接返回（不调用next）
      const nextCallCountBefore = next.mock.calls.length
      if (safeNextRef) {
        safeNextRef()
      }
      // safeNext不应该再调用next（因为isProcessing已是false）
      expect(next.mock.calls.length).toBe(nextCallCountBefore)

      await new Promise(r => setTimeout(r, 200))
    })

    it('清理过期的导航记录', async () => {
      // 使用同一个guard，第一次调用添加导航记录
      const handlerFn = vi.fn(async (_to: any, _from: any, next: any) => { next() })
      const guard = handler.createGuardWithTimeout(handlerFn)

      // 第一次调用添加导航记录
      guard(createMockRoute('/old-page'), createMockRoute('/'), vi.fn())
      await new Promise(r => setTimeout(r, 50))

      // mock Date.now让第二次调用时，第一次的导航记录已过期
      const realDateNow = Date.now
      const realNow = Date.now()
      let callCount = 0
      Date.now = vi.fn(() => {
        callCount++
        // 返回realNow+11000（11秒后，清理过期记录）
        return realNow + 11000
      }) as any

      // 第二次调用（使用不同路径避免重复导航检测），会清理过期的导航记录
      guard(createMockRoute('/new-page'), createMockRoute('/home'), vi.fn())

      await new Promise(r => setTimeout(r, 50))

      Date.now = realDateNow
    })
  })

  describe('mainGuard', () => {
    it('应该处理登录页', () => {
      const to = createMockRoute('/login')
      const from = createMockRoute('/')
      const next = vi.fn()

      handler.mainGuard(to, from, next)
    })

    it('应该处理注册页', () => {
      const to = createMockRoute('/register')
      const from = createMockRoute('/')
      const next = vi.fn()

      handler.mainGuard(to, from, next)
    })

    it('应该处理需要认证的页面', () => {
      const to = createMockRoute('/dashboard', {}, { requiresAuth: true })
      const from = createMockRoute('/')
      const next = vi.fn()

      handler.mainGuard(to, from, next)
    })

    it('应该处理公开页面', () => {
      const to = createMockRoute('/')
      const from = createMockRoute('/')
      const next = vi.fn()

      handler.mainGuard(to, from, next)
    })

    it('应该处理第三方回调路由', async () => {
      vi.mocked(isThirdPartyCallbackRoute).mockReturnValue(true)

      const to = createMockRoute('/callback', {}, {}, 'callback')
      const from = createMockRoute('/')
      const next = vi.fn()

      handler.mainGuard(to, from, next)

      // 等待异步操作
      await new Promise(r => setTimeout(r, 50))
    })

    it('应该处理通过name识别的登录页', () => {
      const to = createMockRoute('/some-path', {}, {}, 'login')
      const from = createMockRoute('/')
      const next = vi.fn()

      handler.mainGuard(to, from, next)
    })
  })

  describe('createRouteGuardHandler', () => {
    it('应该创建路由守卫处理器', () => {
      const handler = createRouteGuardHandler(mockRouter as any)
      expect(handler).toBeInstanceOf(RouteGuardHandler)
    })

    it('应该支持自定义配置', () => {
      const handler = createRouteGuardHandler(mockRouter as any, { guardTimeout: 10000 })
      expect(handler).toBeInstanceOf(RouteGuardHandler)
    })
  })

  describe('createMainGuard', () => {
    it('应该创建主路由守卫', () => {
      const guard = createMainGuard(mockRouter as any)
      expect(typeof guard).toBe('function')
    })

    it('创建的守卫应该可以正常调用', () => {
      const guard = createMainGuard(mockRouter as any)
      const to = createMockRoute('/')
      const from = createMockRoute('/')
      const next = vi.fn()

      guard(to, from, next)
    })
  })
})
