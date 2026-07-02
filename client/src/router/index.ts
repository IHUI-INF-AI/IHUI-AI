import { createRouter, createWebHistory, type RouteRecordRaw, type RouteLocationNormalized } from 'vue-router'

type NavigationNext = {
  (): void
  (error?: Error): void
  (location: string | { path?: string; name?: string; params?: Record<string, string | string[]>; query?: Record<string, string | string[]>; replace?: boolean }): void
  (valid: boolean): void
}

type _RouterInstance = ReturnType<typeof createRouter>

type TranslateFn = (key: string) => string

const getI18nTranslator = (i18nInstance: typeof import('@/locales').default): TranslateFn => {
  return (key: string): string => {
    try {
      const global = i18nInstance.global
      if (typeof global === 'object' && global !== null && 't' in global) {
        return (global.t as TranslateFn)(key)
      }
      return key
    } catch {
      return key
    }
  }
}
import { mergeRoutes } from './utils/routeMerger'
import './platform/index'
import { addThirdPartyLoginRoutes } from './thirdPartyLoginRoutes'

import { logger } from '../utils/logger'
import { StorageManager, STORAGE_KEYS, TokenStorage } from '@/utils/storage'
import { isLoginExpired } from '@/utils/login-duration'
import { useAuthStore } from '@/stores/auth'
import { useLoginDialog } from '@/composables/useLoginDialog'
import type { UserInfoData } from '@/api/user'
import i18n from '@/locales'
import { setupRouteLanguageLoader } from '@/locales/route-loader'
import { handleAlipayBodyCallback } from '@/utils/alipay-callback'
import { setupRouterAnalytics } from '@/plugins/routerAnalytics'

import { safeImport } from './utils/componentLoader'

export { safeImport }

import {
  baseRoutes,
  adminRoutes,
  userRoutes,
  aiRoutes,
  apiRoutes,
  communityRoutes,
  learnRoutes,
  liveRoutes,
  memberRoutes,
  publicResourceRoutes,
  indexRoutes,
  p19Routes,
  p20Routes,
  eduRoutes,
} from './modules'

const routes: Array<RouteRecordRaw> = [
  ...baseRoutes,
  ...adminRoutes,
  ...userRoutes,
  ...aiRoutes,
  ...apiRoutes,
  ...communityRoutes,
  ...learnRoutes,
  ...liveRoutes,
  ...memberRoutes,
  ...publicResourceRoutes,
  ...indexRoutes,
  ...p19Routes,
  ...p20Routes,
  ...eduRoutes,
]

addThirdPartyLoginRoutes(routes)

// 兜底：未匹配到的任何路径都落到 404 页面（不强制登录，便于调试）
// 必须放在所有路由（含第三方登录）的最末尾，否则会抢占具体路径
routes.push({
  path: '/:pathMatch(.*)*',
  name: 'notFound',
  component: safeImport(
    () => import(/* webpackChunkName: "not-found" */ '@/views/error/404.vue'),
    'NotFound'
  ),
  meta: {
    title: 'routes.notFound',
    description: 'seo.notFound.desc',
    keywords: 'seo.notFound.keywords',
  },
})

try {
  logger.debug('[Router] Route modular loading complete')
} catch (error) {
  logger.error('[Router] Failed to integrate route modules', error)
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: mergeRoutes(routes as RouteRecordRaw[]),
}) as ReturnType<typeof createRouter>

// 全局重写 push/replace，统一静默处理 NavigationDuplicated 错误
const originalPush = router.push.bind(router)
const originalReplace = router.replace.bind(router)
router.push = ((to: unknown) => {
  return originalPush(to as never).catch((err: unknown) => {
    if (err && typeof err === 'object' && 'name' in err && (err as { name?: string }).name === 'NavigationDuplicated') {
      return undefined
    }
    throw err
  })
}) as typeof router.push
router.replace = ((to: unknown) => {
  return originalReplace(to as never).catch((err: unknown) => {
    if (err && typeof err === 'object' && 'name' in err && (err as { name?: string }).name === 'NavigationDuplicated') {
      return undefined
    }
    throw err
  })
}) as typeof router.replace

// 设置路由语言模块加载器
setupRouteLanguageLoader(router)

// 设置路由埋点插件
setupRouterAnalytics(router)

router.beforeEach(async (to: RouteLocationNormalized, _from: RouteLocationNormalized, next: NavigationNext) => {
  try {
    const rawBody = to.query?.body
    const bodyParam =
      typeof rawBody === 'string' ? rawBody : Array.isArray(rawBody) ? rawBody[0] : undefined
    if (to.path === '/' && bodyParam && typeof bodyParam === 'string') {
      try {
        await handleAlipayBodyCallback()
        next({ path: '/', query: {}, replace: true })
        return
      } catch (err) {
        logger.warn('[Router] Alipay/third-party body callback handling failed，clearing URL and continue navigation', err)
        next({ path: '/', query: {}, replace: true })
        return
      }
    }

    const isDev = (import.meta as { env?: { DEV?: boolean } }).env?.DEV
    if (isDev) {
      const callbackNames = new Set([
        'callback',
        'Callback',
        'GoogleCallback',
        'AppleCallback',
      ])
      const isCallbackRoute = callbackNames.has(String(to.name || ''))
      if (!isCallbackRoute) {
        const q: Record<string, unknown> = (to.query as Record<string, unknown>) || {}
        const hasOAuthParams =
          q.code !== undefined || q.state !== undefined || q.oauth_code !== undefined
        if (hasOAuthParams) {
          const cleaned = Object.fromEntries(
            Object.entries(q).filter(
              ([k]) =>
                ![
                  'code',
                  'state',
                  'oauth_code',
                  'scope',
                  'prompt',
                  'authuser',
                  'hd',
                  'session_state',
                ].includes(k)
            )
          ) as Record<string, string | string[]>
          if (Object.keys(cleaned).length !== Object.keys(q).length) {
            next({ path: to.path, query: cleaned })
            return
          }
        }
      }
    }

    if (
    to.path === '/login' ||
    to.path === '/register' ||
    to.name === 'login' ||
    to.name === 'register'
  ) {
    // 拦截直接访问 /login：
    // - 无跨项目 ?source / 支付宝 ?body 参数时，URL 不再保留 /login
    // - 已登录 → 跳 savedReturnPath 或首页（不弹窗）
    // - 未登录 → 跳首页 + 弹出登录弹窗（携带 redirect/returnUrl 回跳路径）
    // - 保留 ?source / ?body 场景走原逻辑（跨项目登录、支付回调需 /login 占位）
    if (to.path === '/login' || to.name === 'login') {
      const q = (to.query || {}) as Record<string, unknown>
      const hasSourceParam = q.source !== undefined
      const hasBodyParam = q.body !== undefined

      if (!hasSourceParam && !hasBodyParam) {
        // 清除登出标记（拦截后 Login.vue 中的清除逻辑不再触发，避免残留）
        try {
          sessionStorage.removeItem('__logout_flag__')
        } catch {
          // ignore
        }

        const token = TokenStorage.getToken()
        const expiryTime = StorageManager.getItem<number | null>(STORAGE_KEYS.LOGIN_EXPIRY_TIME)
        const isExpired = expiryTime !== null && isLoginExpired(expiryTime)
        const userData = StorageManager.getItem<Record<string, unknown>>(STORAGE_KEYS.USER_DATA)

        // 已登录且未过期 → 跳 savedReturnPath 或首页（不弹窗）
        if (token && userData && !isExpired) {
          let savedReturnPath: string | null = null
          try {
            savedReturnPath = localStorage.getItem('auth-return-path')
          } catch {
            // ignore
          }
          if (savedReturnPath && savedReturnPath !== '/login' && savedReturnPath !== '/register') {
            try {
              localStorage.removeItem('auth-return-path')
            } catch {
              // ignore
            }
            next({ path: savedReturnPath, replace: true })
          } else {
            next({ path: '/', replace: true })
          }
          return
        }

        // 未登录 → 跳首页 + 弹窗（携带 redirect/returnUrl 回跳）
        const returnPath =
          typeof q.redirect === 'string' && q.redirect
            ? q.redirect
            : typeof q.returnUrl === 'string' && q.returnUrl
            ? q.returnUrl
            : null
        next({ path: '/', replace: true })
        setTimeout(() => {
          useLoginDialog().open('login', returnPath)
        }, 0)
        return
      }
    }

    const authStore = useAuthStore()

      const token = TokenStorage.getToken()

      const expiryTime = StorageManager.getItem<number | null>(STORAGE_KEYS.LOGIN_EXPIRY_TIME)
      const isExpired = expiryTime !== null && isLoginExpired(expiryTime)

      const userData = StorageManager.getItem<Record<string, unknown>>(STORAGE_KEYS.USER_DATA)

      const isStoreLoggedIn = authStore.isLoggedIn
      const isFromLoginPage = _from.path === '/login' || _from.path === '/register'

      if (isExpired || !userData) {
        StorageManager.removeItem(STORAGE_KEYS.TOKEN)
        StorageManager.removeItem(STORAGE_KEYS.USER_TOKEN)
        StorageManager.removeItem(STORAGE_KEYS.USER_DATA)
        StorageManager.removeItem(STORAGE_KEYS.LOGIN_EXPIRY_TIME)
        if (authStore.token) {
          await authStore.logout()
        }
        next()
        return
      }

      const logoutFlag = sessionStorage.getItem('__logout_flag__')
      if (logoutFlag) {
        StorageManager.removeItem(STORAGE_KEYS.TOKEN)
        StorageManager.removeItem(STORAGE_KEYS.USER_TOKEN)
        StorageManager.removeItem(STORAGE_KEYS.USER_DATA)
        StorageManager.removeItem(STORAGE_KEYS.LOGIN_EXPIRY_TIME)
        if (to.path === '/login' || to.name === 'login') {
          sessionStorage.removeItem('__logout_flag__')
        }
        next()
        return
      }

      if (token && userData && !isExpired) {
        if (!authStore.token) {
          authStore.token = token
        }
        if (!authStore.user && userData) {
          try {
            authStore.user = {
              id: userData.uuid || userData.id || '',
              uuid: userData.uuid || userData.id || '',
              username: userData.username || '',
              email: userData.email || '',
              phone: userData.phone || '',
              nickname: userData.nickname || userData.username || '用户',
              avatar: userData.avatar || userData.avatarUrl || '',
              gender: userData.gender || 0,
              birthday: userData.birthday || '',
              signature: userData.signature || '',
              status: userData.status || 1,
              isVip: userData.isVip || false,
              inviteCode: userData.inviteCode || '',
              createTime: userData.createTime || new Date().toISOString(),
              updateTime: userData.updateTime || new Date().toISOString(),
            } as UserInfoData
          } catch (err) {
            logger.error('[Router] Failed to restore user info:', err)
          }
        }
        const storeWithTime = authStore as { loginTime?: string; lastActiveTime?: string }
        const userLoginTime = (userData as Record<string, unknown>).loginTime as string | undefined
        const userLastActiveTime = (userData as Record<string, unknown>).lastActiveTime as string | undefined
        if (userLoginTime && !storeWithTime.loginTime) {
          storeWithTime.loginTime = userLoginTime
        }
        if (userLastActiveTime && !storeWithTime.lastActiveTime) {
          storeWithTime.lastActiveTime = userLastActiveTime
        }
      }

      if (isFromLoginPage && token && userData && !isExpired) {
        next()
        return
      }

      if (!isStoreLoggedIn || !authStore.token || !authStore.user) {
        if (!token || isExpired || !userData) {
          StorageManager.removeItem(STORAGE_KEYS.TOKEN)
          StorageManager.removeItem(STORAGE_KEYS.USER_TOKEN)
          StorageManager.removeItem(STORAGE_KEYS.USER_DATA)
          StorageManager.removeItem(STORAGE_KEYS.LOGIN_EXPIRY_TIME)
        }
        next()
        return
      }

      const hasSourceParam = to.query.source !== undefined
        const hasBodyParam = to.query.body !== undefined

        if (isStoreLoggedIn && authStore.token && authStore.user) {
          if (hasSourceParam || hasBodyParam) {
            next()
            return
          }

          let savedReturnPath: string | null = null
          try {
            savedReturnPath = localStorage.getItem('auth-return-path')
          } catch (e) {
            logger.warn('[Router] Failed to read auth-return-path:', e)
          }
          if (savedReturnPath && savedReturnPath !== '/login' && savedReturnPath !== '/register') {
            try {
              localStorage.removeItem('auth-return-path')
            } catch (e) {
              logger.warn('[Router] Failed to clear auth-return-path:', e)
            }
            next(savedReturnPath)
          } else {
            next('/')
          }
          return
        }

      next()
      return
    }

    // vue-router 4: to.meta 自动合并所有 matched 路由的 meta (父路由 + 子路由)
    // 这意味着 /admin 父路由的 requiresAuth: true 会自动传到所有 children
    // 如果某个 child 不需要 auth (如登录回调), 必须放在顶级路由而非 /admin children
    const requiresAuth = to.meta?.requiresAuth ?? false

    // admin-classic 后台路径强制需要登录（路由可能由 catch-all 匹配，meta 缺失）
    const isAdminClassicPath = to.path.startsWith('/admin-classic')
    const effectiveRequiresAuth = requiresAuth || isAdminClassicPath

    if (!effectiveRequiresAuth) {
      next()
      return
    }

    let isLoggedIn = false
    try {
      const authStore = useAuthStore()

      if (authStore.isLoggedIn && authStore.token) {
        const expiryTime = StorageManager.getItem<number | null>(STORAGE_KEYS.LOGIN_EXPIRY_TIME)
        if (expiryTime === null || !isLoginExpired(expiryTime)) {
          isLoggedIn = true
        }
      }

      if (!isLoggedIn) {
        const token =
          StorageManager.getItem<string>(STORAGE_KEYS.TOKEN) ||
          StorageManager.getItem<string>(STORAGE_KEYS.USER_TOKEN)
        if (token) {
          const expiryTime = StorageManager.getItem<number | null>(STORAGE_KEYS.LOGIN_EXPIRY_TIME)
          if (expiryTime === null || !isLoginExpired(expiryTime)) {
            isLoggedIn = true
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
                    nickname: userData.nickname || userData.username || '用户',
                    avatar: userData.avatar || userData.avatarUrl || '',
                    gender: userData.gender || 0,
                    birthday: userData.birthday || '',
                    signature: userData.signature || '',
                    status: userData.status || 1,
                    isVip: userData.isVip || false,
                    inviteCode: userData.inviteCode || '',
                    createTime: userData.createTime || new Date().toISOString(),
                    updateTime: userData.updateTime || new Date().toISOString(),
                    roles: Array.isArray(userData.roles) ? (userData.roles as string[]) : undefined,
                  } as UserInfoData
                } catch (err) {
                  logger.error('[Router] Failed to restore user info:', err)
                }
              }
            }
          } else {
            StorageManager.removeItem(STORAGE_KEYS.TOKEN)
            StorageManager.removeItem(STORAGE_KEYS.USER_TOKEN)
            StorageManager.removeItem(STORAGE_KEYS.USER_DATA)
            StorageManager.removeItem(STORAGE_KEYS.LOGIN_EXPIRY_TIME)
            if (authStore.token) {
              await authStore.logout()
            }
            isLoggedIn = false
          }
        } else {
          const userData = StorageManager.getItem<Record<string, unknown>>(STORAGE_KEYS.USER_DATA)
          const thirdPartyAccounts = userData?.thirdPartyAccounts as
            | { accessToken?: string }
            | undefined
          if (thirdPartyAccounts?.accessToken) {
            const expiryTime = StorageManager.getItem<number | null>(STORAGE_KEYS.LOGIN_EXPIRY_TIME)
            if (expiryTime === null || !isLoginExpired(expiryTime)) {
              isLoggedIn = true
              if (!authStore.token) {
                authStore.token = thirdPartyAccounts.accessToken
              }
            } else {
              StorageManager.removeItem(STORAGE_KEYS.USER_DATA)
              StorageManager.removeItem(STORAGE_KEYS.LOGIN_EXPIRY_TIME)
              if (authStore.token) {
                await authStore.logout()
              }
              isLoggedIn = false
            }
          }
        }
      }
    } catch (error) {
      logger.error('[Router] Failed to check login status:', error)
      isLoggedIn = false
    }

    if (effectiveRequiresAuth && !isLoggedIn) {
      try {
        localStorage.setItem('auth-return-path', to.fullPath)
      } catch (e) {
        if (import.meta.env.DEV) {
          logger.debug('[Router] Failed to save return path:', e)
        }
      }
      // 优化：直接跳转首页 + 弹出登录弹窗，避免 /login 中间跳转
      next({ path: '/' })
      setTimeout(() => {
        useLoginDialog().open('login', to.fullPath)
      }, 0)
      return
    }

    const requiresAdmin = to.meta?.requiresAdmin === true
    if (requiresAdmin) {
      const authStore = useAuthStore()
      const userData = StorageManager.getItem<Record<string, unknown>>(STORAGE_KEYS.USER_DATA)
      const userRecord = (authStore.user ?? userData) as Record<string, unknown> | null
      
      // 强化管理员权限检查
      // 1. 检查单字段管理员标志
      const hasAdminFlag = 
        userRecord?.role === 'admin' ||
        userRecord?.isAdmin === true ||
        userRecord?.userType === 'admin'
      
      // 2. 检查 roles 数组是否包含管理员角色
      const userRoles = userRecord?.roles as string[] | undefined
      const hasAdminRole = Array.isArray(userRoles) && 
        userRoles.some(role => 
          ['admin', 'ADMIN', 'ROLE_ADMIN', 'role_admin', '超级管理员'].includes(role)
        )
      
      // 3. 检查 permissions 数组（如果存在）
      const userPermissions = userRecord?.permissions as string[] | undefined
      const hasAdminPermission = Array.isArray(userPermissions) && 
        userPermissions.some(perm => 
          perm === '*' || 
          perm === 'admin:*' || 
          perm.startsWith('admin:')
        )
      
      const isAdmin = hasAdminFlag || hasAdminRole || hasAdminPermission
      
      if (!isAdmin) {
        logger.warn('[Router] Non-admin accessing admin page, blocked:', {
          path: to.path,
          role: userRecord?.role,
          isAdmin: userRecord?.isAdmin,
          userType: userRecord?.userType,
          roles: userRoles,
          permissions: userPermissions,
        })
        next({ path: '/403', replace: true })
        return
      }
    }

    next()
  } catch (error) {
    logger.error('[Router] Route guard execution error, blocking access:', error)
    next({ name: 'login' })
  }
})

router.afterEach(async (to: RouteLocationNormalized, _from: RouteLocationNormalized) => {
  if (to.path === '/docs') {
    setTimeout(() => {
      document.querySelectorAll('.el-overlay').forEach((el) => {
        if (el.querySelector('.upload-dialog')) {
          return
        }
        ;(el as HTMLElement).remove()
      })
    }, 50)
  }

  try {
    const { useLoadingStore } = await import('@/stores/loading')
    const loadingStore = useLoadingStore()
    setTimeout(() => {
      if (loadingStore.globalLoading) {
        logger.debug('[Router] Route navigation complete, clearing global loading state')
        loadingStore.stopGlobalLoading()
      }
    }, 100)
  } catch (e) {
    if (import.meta.env.DEV) {
      logger.debug('[Router] Failed to clear global loading state:', e)
    }
  }

  const getCurrentLanguage = (): 'zh' | 'en' => {
    try {
      const storedLang = StorageManager.getItem<string>(STORAGE_KEYS.LANGUAGE)
      if (storedLang === 'en' || storedLang === 'zh') {
        return storedLang
      }
      const browserLang = navigator.language || navigator.languages?.[0] || 'zh'
      return browserLang.startsWith('zh') ? 'zh' : 'en'
    } catch (e) {
      if (import.meta.env.DEV) {
        logger.debug('[Router] Failed to get current language, using default:', e)
      }
      return 'zh'
    }
  }

  const currentLang = getCurrentLanguage()
  const baseTitleZh = '智汇AI社区'
  const baseTitleEn = 'iHui AI'
  const baseTitle = currentLang === 'zh' ? baseTitleZh : baseTitleEn

  import('@/utils/seo')
    .then(({ updateMetaTags }) => {
      const tFn = getI18nTranslator(i18n)
      const titleKey = (to.meta.title as string) || ''
      const translatedTitle =
        titleKey && titleKey.includes('.')
          ? tFn(titleKey)
          : titleKey || (currentLang === 'zh' ? '首页' : 'Home')
      // 同步设过 document.title 的会被 async 回调覆盖，
      // 因此传入 baseTitle 让 updateMetaTags 自行拼成 "智汇AI社区-首页"
      const finalTitle = translatedTitle
        ? `${baseTitle}-${translatedTitle}`
        : baseTitle
      const descRaw = (to.meta.description as string) || ''
      const keywordsRaw = (to.meta.keywords as string) || ''
      const translatedDesc =
        descRaw && descRaw.includes('.')
          ? tFn(descRaw)
          : descRaw ||
            (currentLang === 'zh'
              ? '专业的AI工具集成平台，提供AI对话、图像生成、视频制作等多种AI服务'
              : 'A professional AI integration platform providing chat, image generation, video creation and more')
      const translatedKeywords =
        keywordsRaw && keywordsRaw.includes('.')
          ? tFn(keywordsRaw)
          : keywordsRaw ||
            (currentLang === 'zh'
              ? 'AI工具,人工智能,AI对话,图像生成,视频制作'
              : 'AI tools, artificial intelligence, AI chat, image generation, video creation')
      updateMetaTags({
        title: finalTitle,
        description: translatedDesc,
        keywords: translatedKeywords,
        url: window.location.href,
        type: 'website',
      })
    })
    .catch((e) => {
      if (import.meta.env.DEV) {
        logger.debug('[Router] SEO tool load failed, using basic title:', e)
      }
    })

  try {
    const tFn = getI18nTranslator(i18n)
    const titleKey = (to.meta.title as string) || ''
    const translated = titleKey && titleKey.includes('.') ? tFn(titleKey) : titleKey
    document.title = translated ? `${baseTitle}-${translated}` : baseTitle
  } catch (e) {
    if (import.meta.env.DEV) {
      logger.debug('[Router] Failed to set page title, using basic title:', e)
    }
    document.title = baseTitle
  }

  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    (window as Window & { requestIdleCallback: (cb: () => void, options?: { timeout?: number }) => number }).requestIdleCallback(
      () => {
        const preloadRoutes = getPreloadRoutes((to.name as string) || '')
        preloadRoutes.forEach(routeName => {
          try {
            const route = router.resolve({ name: routeName })
            if (route.matched.length > 0) {
              const component = route.matched[route.matched.length - 1].components?.default
              if (typeof component === 'function') {
                component().catch((_error: unknown) => {
                  if (import.meta.env.DEV) {
                    logger.debug(`[Router] Preload route failed, ignored）`)
                  }
                })
              }
            }
          } catch (_error: unknown) {
            if (import.meta.env.DEV) {
              logger.debug(`[Router] Parse Preload route failed, ignored)`)
            }
          }
        })
      },
      { timeout: 2000 }
    )
  }
})

router.onError((err: Error) => {
  try {
    const msg = (err && (err as { message?: string }).message) || ''
    logger.error('[Router] Route error:', msg, err)

    try {
      if (
        msg.includes('Failed to fetch dynamically imported module') ||
        msg.includes('ChunkLoadError') ||
        msg.includes('Loading chunk')
      ) {
        // 开发环境: HMR 会自行重载模块, 禁用自动 reload 避免与 HMR 冲突导致循环刷新
        const isDev = (import.meta as { env?: { DEV?: boolean } }).env?.DEV
        if (isDev) {
          logger.warn('[Router] Chunk load failed in dev, skipping auto-reload (HMR will handle it)', { msg })
        } else {
          // 生产环境: 用时间窗口防死循环 (5 分钟内只 reload 一次)
          // 原实现缺陷: 失败一次后清除标记 → 后续任何路由错误又会重新触发 reload → 死循环
          const RELOAD_COOLDOWN_MS = 5 * 60 * 1000
          const RELOAD_FLAG = '__chunk_reload_flag'
          const reloadFlag = sessionStorage.getItem(RELOAD_FLAG)
          const now = Date.now()
          const lastReload = reloadFlag ? parseInt(reloadFlag, 10) : NaN

          if (!reloadFlag || isNaN(lastReload) || (now - lastReload) > RELOAD_COOLDOWN_MS) {
            sessionStorage.setItem(RELOAD_FLAG, String(now))
            logger.warn('[Router] Chunk load failed, auto-reloading page...', {
              elapsedMs: isNaN(lastReload) ? null : now - lastReload,
            })
            window.location.reload()
            return
          }

          // 冷却窗口内不再 reload, 避免反复刷新
          logger.warn('[Router] Chunk load failed within cooldown, skipping auto-reload', {
            elapsedMs: now - lastReload,
            cooldownMs: RELOAD_COOLDOWN_MS,
          })
        }
      }
    } catch (e) {
      logger.error('[Router] Error handling component load failure:', e)
    }

    try {
      const ev = new ErrorEvent('error', { error: err as Error, message: msg })
      window.dispatchEvent(ev)
    } catch (error) {
      if (import.meta.env.DEV) {
        logger.debug('[Router] ErrorEvent dispatch failed:', error)
      }
    }
  } catch (e) {
    logger.error('[Router] onError handling failed:', e)
  }
})

function getPreloadRoutes(currentRouteName: string | symbol | undefined): string[] {
  if (!currentRouteName || typeof currentRouteName !== 'string') {
    return []
  }

  const preloadMap: Record<string, string[]> = {
    home: ['xuqiu', 'plaza', 'agents'],
    xuqiu: ['home', 'agents'],
    plaza: ['home', 'agents'],
    user: ['profile', 'settings', 'orders', 'statistics'],
    profile: ['user', 'settings'],
    settings: ['user', 'profile', 'orders'],
    orders: ['user', 'orderDetail'],
    agents: ['home', 'xuqiu', 'plaza'],
    login: ['register'],
    register: ['login'],
    openPlatform: [],
  }

  return preloadMap[currentRouteName] || []
}

export default router
