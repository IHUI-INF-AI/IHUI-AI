import type { RouteLocationNormalized, NavigationGuardNext, Router } from 'vue-router'
import { StorageManager, STORAGE_KEYS } from '@/utils/storage'
import { isLoginExpired } from '@/utils/login-duration'
import { logger } from '@/utils/logger'
import {
  setRedirectFlag,
  hasAnyRedirectFlag,
  redirectFlagManager,
} from './redirectFlagManager'
import {
  logGuardStart,
  logGuardEnd,
  logRedirect,
  logRouteWarning,
  detectRedirectLoop,
} from './routeDiagnostics'
import {
  restoreAuthStateAtomically,
  isAuthStateValid,
} from './authStateRestore'
import { isThirdPartyCallbackRoute } from '../thirdPartyLoginRoutes'

export interface RouteGuardConfig {
  guardTimeout: number
  enableDiagnostics: boolean
  enableLoopDetection: boolean
  maxLoopCount: number
  loopDetectionWindow: number
}

/**
 * 默认配置
 */
const defaultConfig: RouteGuardConfig = {
  guardTimeout: 5000, // 5秒超时
  enableDiagnostics: true,
  enableLoopDetection: true,
  maxLoopCount: 2, // ⚠️ 关键修复：降低循环检测阈值，更早检测到循环
  loopDetectionWindow: 3000, // ⚠️ 关键修复：缩短检测窗口到3秒，更快检测到循环
}

/**
 * 路由守卫处理器类
 */
export class RouteGuardHandler {
  private config: RouteGuardConfig
  private router: Router
  private isProcessing = false

  constructor(router: Router, config: Partial<RouteGuardConfig> = {}) {
    this.router = router
    this.config = { ...defaultConfig, ...config }
  }

  /**
   * 处理登录页路由
   */
  async handleLoginPage(to: RouteLocationNormalized, from: RouteLocationNormalized, next: NavigationGuardNext): Promise<void> {
    logGuardStart(to, from)

    try {
      // ⚠️ 关键修复：先检查重定向标志，如果有重定向标志，说明正在重定向中，直接允许通过
      if (this.checkRedirectFlag(to)) {
        logger.debug('[RouteGuard] Detected redirect flag, allowing through login page:', to.path)
        logGuardEnd(to, from, 'next')
        next()
        return
      }

      // ⚠️ 关键修复：检查循环重定向，如果检测到循环，直接允许通过，避免无限循环
      if (this.config.enableLoopDetection && detectRedirectLoop(this.config.maxLoopCount, this.config.loopDetectionWindow)) {
        logRouteWarning('检测到循环重定向，强制允许通过登录页', {
          to: to.path,
          from: from.path,
        })
        logger.warn('[RouteGuard] Detected redirect loop, forcing through login page to avoid infinite loop')
        logGuardEnd(to, from, 'next')
        next()
        return
      }
      
      // ⚠️ 关键修复：如果 from.path 和 to.path 相同，说明是同一页面，直接允许通过
      // 这可以防止某些情况下导致的循环
      if (from.path === to.path && (to.path === '/login' || to.path === '/register')) {
        logger.debug('[RouteGuard] Navigating from same page to same page, allowing through to avoid loop', {
          path: to.path,
        })
        logGuardEnd(to, from, 'next')
        next()
        return
      }

      const { useAuthStore } = await import('@/stores/auth')
      const authStore = useAuthStore()

      const hasSourceParam = to.query.source !== undefined
      const hasBodyParam = to.query.body !== undefined

      if (hasSourceParam || hasBodyParam) {
        logGuardEnd(to, from, 'next')
        next()
        return
      }

      const hasValidAuth = isAuthStateValid()
      const hasStoreAuth = authStore.isLoggedIn && authStore.token && authStore.user

      // ⚠️ 关键修复：只有在确实已登录且不是从其他页面重定向过来时才重定向
      // 如果 from.path 是 '/' 或空，说明可能是初始加载，需要更谨慎
      if ((hasValidAuth || hasStoreAuth) && !hasSourceParam && !hasBodyParam) {
        // ⚠️ 关键修复：如果是从首页重定向过来的，说明可能存在循环，直接允许通过
        // ⚠️ 关键修复：如果 from.path 也是登录页，说明可能存在循环，直接允许通过
        if (from.path === '/' || from.path === '' || from.path === '/login' || from.path === '/register') {
          logger.warn('[RouteGuard] Accessing login page from home or login page, may have loop, allowing through', {
            from: from.path,
            to: to.path,
          })
          logGuardEnd(to, from, 'next')
          next()
          return
        }

        const redirectFlag = `__redirecting_from_login_${Date.now()}`
        setRedirectFlag(redirectFlag, 'true', 10000)

        if (hasValidAuth && !hasStoreAuth) {
          await restoreAuthStateAtomically(true)
        }

        const savedReturnPath = StorageManager.getItem<string>('auth-return-path')
        let targetPath = '/'

        if (savedReturnPath && savedReturnPath !== '/login' && savedReturnPath !== '/register') {
          StorageManager.removeItem('auth-return-path')
          targetPath = savedReturnPath
        }

        logRedirect(to.path, targetPath, '已登录用户访问登录页')
        logGuardEnd(to, from, 'redirect', targetPath)
        next({ path: targetPath })
        return
      }

      logGuardEnd(to, from, 'next')
      next()
    } catch (error) {
      logRouteError(error, { to: to.path, from: from.path })
      logGuardEnd(to, from, 'next')
      next()
    }
  }

  /**
   * 处理需要认证的页面
   */
  async handleAuthRequiredPage(to: RouteLocationNormalized, from: RouteLocationNormalized, next: NavigationGuardNext): Promise<void> {
    logGuardStart(to, from)

    try {
      const { useAuthStore } = await import('@/stores/auth')
      const authStore = useAuthStore()

      let isLoggedIn = false

      if (authStore.isLoggedIn && authStore.token) {
        const expiryTime = StorageManager.getItem<number | null>(STORAGE_KEYS.LOGIN_EXPIRY_TIME)
        if (expiryTime === null || !isLoginExpired(expiryTime)) {
          isLoggedIn = true
        }
      }

      if (!isLoggedIn) {
        const token = StorageManager.getItem<string>(STORAGE_KEYS.TOKEN) ||
                     StorageManager.getItem<string>(STORAGE_KEYS.USER_TOKEN)

        if (token) {
          const expiryTime = StorageManager.getItem<number | null>(STORAGE_KEYS.LOGIN_EXPIRY_TIME)
          if (expiryTime === null || !isLoginExpired(expiryTime)) {
            isLoggedIn = true

            const isLoginPage = to.path === '/login' || to.path === '/register'
            if (!isLoginPage) {
              if (!authStore.token) {
                authStore.token = token
              }

              if (!authStore.user) {
                const userData = StorageManager.getItem<Record<string, unknown>>(
                  STORAGE_KEYS.USER_DATA
                )
                if (userData) {
                  try {
                     
                    authStore.user = {
                      id: userData.uuid || userData.id || '',
                      uuid: userData.uuid || userData.id || '',
                      username: userData.username || '',
                      email: userData.email || '',
                      phone: userData.phone || '',
                      nickname: userData.nickname || userData.username || 'User',
                      avatar: userData.avatar || userData.avatarUrl || '',
                      gender: userData.gender || 0,
                      birthday: userData.birthday || '',
                      signature: userData.signature || '',
                      status: userData.status || 1,
                      isVip: userData.isVip || false,
                      inviteCode: userData.inviteCode || '',
                      createTime: userData.createTime || new Date().toISOString(),
                      updateTime: userData.updateTime || new Date().toISOString(),
                    } as unknown as typeof authStore.user
                  } catch (err) {
                    logger.error('[RouteGuard] Failed to restore user info:', err)
                  }
                }
              }
            }
          } else {
            StorageManager.removeItem(STORAGE_KEYS.TOKEN)
            StorageManager.removeItem(STORAGE_KEYS.USER_TOKEN)
            StorageManager.removeItem(STORAGE_KEYS.USER_DATA)
            StorageManager.removeItem(STORAGE_KEYS.LOGIN_EXPIRY_TIME)
            if (authStore.token) {
              authStore.logout()
            }
            isLoggedIn = false
          }
        }
      }

      if (!isLoggedIn) {
        try {
          StorageManager.setItem('auth-return-path', to.fullPath)
        } catch (e) {
          if (import.meta.env.DEV) {
            logger.debug('[RouteGuard] Failed to save return path:', e)
          }
        }

        logRedirect(to.path, '/login', '未登录访问需要认证的页面')
        logGuardEnd(to, from, 'redirect', '/login')
        next({ name: 'login', query: { redirect: to.fullPath } })
        return
      }

      // 检查是否需要管理员权限
      const requiresAdmin = to.meta?.requiresAdmin === true
      if (requiresAdmin) {
        // 从用户数据中检查管理员角色
        const userData = StorageManager.getItem<Record<string, unknown>>(STORAGE_KEYS.USER_DATA)
        const userRecord = (authStore.user ?? null) as Record<string, unknown> | null
        const isAdmin = userData?.role === 'admin' || 
                       userData?.isAdmin === true || 
                       userData?.userType === 'admin' ||
                       userRecord?.role === 'admin' ||
                       userRecord?.isAdmin === true
        
        if (!isAdmin) {
          logger.warn('[RouteGuard] Non-admin accessing admin page:', {
            to: to.path,
            user: userData?.username || 'unknown'
          })
          logGuardEnd(to, from, 'redirect', '/403')
          next({ path: '/403', replace: true })
          return
        }
      }

      logGuardEnd(to, from, 'next')
      next()
    } catch (error) {
      logRouteError(error, { to: to.path, from: from.path })
      logGuardEnd(to, from, 'next')
      next()
    }
  }

  /**
   * 处理公开页面
   */
  async handlePublicPage(to: RouteLocationNormalized, from: RouteLocationNormalized, next: NavigationGuardNext): Promise<void> {
    logGuardStart(to, from)

    try {
      if (this.config.enableLoopDetection && detectRedirectLoop(this.config.maxLoopCount, this.config.loopDetectionWindow)) {
        logRouteWarning('检测到循环重定向，强制允许通过', {
          to: to.path,
          from: from.path,
        })
      }

      logGuardEnd(to, from, 'next')
      next()
    } catch (error) {
      logRouteError(error, { to: to.path, from: from.path })
      logGuardEnd(to, from, 'next')
      next()
    }
  }

  /**
   * 检查重定向标志
   * ⚠️ 关键修复：在登录页也检查重定向标志，如果有重定向标志，说明正在重定向中，直接允许通过
   */
  checkRedirectFlag(to: RouteLocationNormalized): boolean {
    if (hasAnyRedirectFlag('__redirecting_')) {
      const isLoginPage = to.path === '/login' || to.path === '/register'
      
      // ⚠️ 关键修复：如果有重定向标志，无论是登录页还是目标页，都允许通过
      // 这样可以防止在重定向过程中再次触发重定向检查
      logger.debug('[RouteGuard] Detected valid redirect flag, allowing through:', to.path, {
        isLoginPage,
      })
      return true
    }

    return false
  }

  /**
   * 清理过期的重定向标志
   * ⚠️ 关键修复：使用重定向标志管理器清理，而不是直接操作sessionStorage
   */
  cleanupExpiredFlags(): void {
    // 使用重定向标志管理器清理过期标志
    try {
      redirectFlagManager.clearExpiredFlags()
    } catch (e) {
      logger.warn('[RouteGuard] Failed to clear expired flags:', e)
    }
    
    // 保留对sessionStorage的兼容性清理（如果还有遗留的标志）
    // 只清理过期的，不清理所有
    try {
      const allKeys = Object.keys(sessionStorage)
      const redirectFlagKeys = allKeys.filter(key => key.startsWith('__redirecting_from_login_'))
      const now = Date.now()

      redirectFlagKeys.forEach(key => {
        const timestamp = parseInt(key.replace('__redirecting_from_login_', ''))
        if (!isNaN(timestamp) && now - timestamp > 10000) {
          try {
            sessionStorage.removeItem(key)
          } catch {
            // 静默处理
          }
        }
      })
    } catch {
      // 静默处理清理错误
    }
  }

  /**
   * 创建带超时保护的路由守卫
   * ⚠️ 关键修复：添加重复导航检测，防止同一路由的重复导航
   */
  createGuardWithTimeout(handler: (to: RouteLocationNormalized, from: RouteLocationNormalized, next: NavigationGuardNext) => Promise<void>): (to: RouteLocationNormalized, from: RouteLocationNormalized, next: NavigationGuardNext) => void {
    // 记录最近的导航，用于检测重复导航
    const recentNavigations = new Map<string, number>()
    const NAVIGATION_DEBOUNCE = 50 // ⚠️ 关键修复：降低到50ms，更严格地检测重复导航

    return (to, from, next) => {
      // ⚠️ 关键修复：检测重复导航（相同路径，短时间内）
      // 特别处理登录页的重复导航
      const navKey = `${from.path}->${to.path}`
      const now = Date.now()
      const lastNavTime = recentNavigations.get(navKey)
      
      // ⚠️ 关键修复：对于登录页，更严格地检测重复导航
      const isLoginPage = to.path === '/login' || to.path === '/register'
      const isSamePage = from.path === to.path
      
      if (isSamePage && isLoginPage && lastNavTime && (now - lastNavTime) < NAVIGATION_DEBOUNCE) {
        logger.debug('[RouteGuard] Detected duplicate navigation to login page, skipping:', {
          from: from.path,
          to: to.path,
          interval: now - lastNavTime,
        })
        // 调用 next(false) 取消导航，避免路由阻塞
        return next(false)
      }
      
      // 对于其他情况，也检测重复导航
      if (!isSamePage && lastNavTime && (now - lastNavTime) < NAVIGATION_DEBOUNCE) {
        logger.debug('[RouteGuard] Detected duplicate navigation, skipping:', {
          from: from.path,
          to: to.path,
          interval: now - lastNavTime,
        })
        // 调用 next(false) 取消导航，避免路由阻塞
        return next(false)
      }
      
      // 记录本次导航
      recentNavigations.set(navKey, now)
      // 清理过期的导航记录（保留最近10秒的记录）
      for (const [key, time] of recentNavigations.entries()) {
        if (now - time > 10000) {
          recentNavigations.delete(key)
        }
      }

      if (this.isProcessing) {
        logger.warn('[RouteGuard] Route guard is processing, skipping this call')
        next()
        return
      }

      this.isProcessing = true
      const guardStartTime = Date.now()

      const timeoutId = setTimeout(() => {
        logger.error('[RouteGuard] Route guard execution timeout, forcing through:', to.path)
        this.isProcessing = false
        next()
      }, this.config.guardTimeout)

      const safeNext: NavigationGuardNext = ((arg?: any) => {
        if (!this.isProcessing) {
          return
        }
        this.isProcessing = false
        clearTimeout(timeoutId)

        const duration = Date.now() - guardStartTime
        if (duration > 1000) {
          logger.warn('[RouteGuard] Route guard execution time long:', duration + 'ms', to.path)
        }

        if (arg === undefined) {
          next()
        } else {
          (next as (arg: any) => void)(arg)
        }
      }) as NavigationGuardNext

      this.cleanupExpiredFlags()

      if (this.checkRedirectFlag(to)) {
        safeNext(true)
        return
      }

      handler(to, from, safeNext)
        .catch(error => {
          logRouteError(error, { to: to.path, from: from.path })
          safeNext(true)
        })
    }
  }

  /**
   * 主路由守卫
   */
  mainGuard = (to: RouteLocationNormalized, from: RouteLocationNormalized, next: NavigationGuardNext): void => {
    const isLoginPage = to.path === '/login' || to.path === '/register' || to.name === 'login' || to.name === 'register'
    const requiresAuth = (to.meta?.requiresAuth as boolean | undefined) ?? false
    const isThirdPartyCallback = isThirdPartyCallbackRoute(to.name)

    if (isThirdPartyCallback) {
      this.createGuardWithTimeout(this.handlePublicPage.bind(this))(to, from, next)
    } else if (isLoginPage) {
      this.createGuardWithTimeout(this.handleLoginPage.bind(this))(to, from, next)
    } else if (requiresAuth) {
      this.createGuardWithTimeout(this.handleAuthRequiredPage.bind(this))(to, from, next)
    } else {
      this.createGuardWithTimeout(this.handlePublicPage.bind(this))(to, from, next)
    }
  }
}

/**
 * 记录路由错误
 */
function logRouteError(error: any, context: Record<string, unknown>): void {
  const errorMessage = error instanceof Error ? error.message : String(error)
  const errorStack = error instanceof Error ? error.stack : undefined

  logger.error('[RouteGuard] Route guard execution error:', {
    error: errorMessage,
    stack: errorStack,
    ...context,
  })
}

/**
 * 创建路由守卫处理器
 */
export function createRouteGuardHandler(router: Router, config?: Partial<RouteGuardConfig>): RouteGuardHandler {
  return new RouteGuardHandler(router, config)
}

export function createMainGuard(router: Router, config?: Partial<RouteGuardConfig>): (to: RouteLocationNormalized, from: RouteLocationNormalized, next: NavigationGuardNext) => void {
  const handler = createRouteGuardHandler(router, config)
  return handler.mainGuard
}
