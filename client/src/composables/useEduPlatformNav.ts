/**
 * 教育平台跳转 Composable
 *
 * @description 统一处理「用户端」「总管理端」跳转。
 * 2026-06-26 重构: 教育平台源码已迁移到项目内, 不再走外部域名 + SSO,
 * 改为项目内路由跳转 (/edu 用户端, /admin/edu 管理端)。
 * 登录态由路由守卫 (requiresAuth / requiresAdmin) 统一处理;
 * 此处仅在未登录时给出友好提示并跳 /login?redirect=...。
 */

import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '@/stores/auth'
import { useLoginDialog } from '@/composables/useLoginDialog'
import { logger } from '@/utils/logger'
import { getI18nGlobal } from '@/locales'

/** 教育平台项目内路由路径 */
export const EDU_PLATFORM_ROUTES = {
  eduWeb: '/edu',
  eduAdmin: '/admin/edu',
} as const

export type EduPlatformKey = keyof typeof EDU_PLATFORM_ROUTES

export interface UseEduPlatformNavOptions {
  /** 跳转完成或需要关闭 UI 时调用（如 Header 的 closeMenus） */
  onDone?: () => void
}

/**
 * 教育平台跳转逻辑，与头部导航「用户端」「总管理端」行为一致。
 *
 * 2026-06-27 修复白屏（与 HeaderNavigation.vue 同形）:
 * 顶层 useRouter / useI18n / useAuthStore 全部改为 try/catch + 懒加载,
 * 解决 App.vue 中 `<Teleport to="body">` 渲染 Header 时,
 * HeaderNavigation.vue 脱离 RouterView 的 provide/inject 上下文,
 * useRouter() 抛 'injection "Symbol(router)" not found'
 * 导致整个 HeaderNavigation.vue setup 失败 -> 整页白屏的连锁问题.
 *
 * App.vue 注释明确指出:
 *   "<Teleport to="body"> 的 Header 及其子组件无法使用 useRoute/useRouter
 *    (脱离了 RouterView 的 provide/inject 上下文), 这是已知限制."
 *
 * 修复策略: 顶层只做 try/catch 容错, 真正的 router/t/store 在事件触发时
 * 通过 getRouter / getT / getAuthStore 懒加载获取, 此时 main.ts 已执行
 * app.use(router) + app.use(i18n), 全局实例一定就绪.
 */
export function useEduPlatformNav(options: UseEduPlatformNavOptions = {}) {
  const { onDone } = options

  // 顶层懒加载 + 兜底：Teleport 上下文 / HMR 抖动 / Pinia 未激活时
  // 任何一个 composable 抛错都会让调用方 setup 整体失败，必须全部 try/catch.
  let router: ReturnType<typeof useRouter> | null = null
  try {
    router = useRouter()
  } catch (e) {
    logger.debug('[useEduPlatformNav] router unavailable on init, will lazy load:', e)
  }

  let tFn: ((key: string) => string) | null = null
  try {
    tFn = useI18n().t as (key: string) => string
  } catch (e) {
    logger.debug('[useEduPlatformNav] i18n unavailable on init, will lazy load:', e)
  }

  let authStore: ReturnType<typeof useAuthStore> | null = null
  try {
    authStore = useAuthStore()
  } catch (e) {
    logger.debug('[useEduPlatformNav] authStore unavailable on init, will lazy load:', e)
  }

  /**
   * 在事件真正触发时（用户点击「用户端 / 总管理端」菜单）再次尝试获取 router。
   * 由于 main.ts 顺序保证了 app.use(router) 先于 app.mount，理论上此时
   * router 一定已就绪；这里的多重兜底只是为了对抗 Teleport / HMR 边界情况。
   */
  const getRouter = (): ReturnType<typeof useRouter> | null => {
    if (router) return router
    try {
      router = useRouter()
      return router
    } catch (e) {
      logger.debug('[useEduPlatformNav] router lazy load failed:', e)
      return null
    }
  }

  /**
   * 懒加载 i18n t 函数。优先用 useI18n() 注入的 t；
   * 失败时回退到全局 i18n.global.t（i18n 已在 main.ts 中 app.use(i18n)）。
   */
  const getT = (): ((key: string) => string) => {
    if (tFn) return tFn
    try {
      tFn = useI18n().t as (key: string) => string
      return tFn
    } catch (e) {
      logger.debug('[useEduPlatformNav] i18n lazy load failed, fallback to global:', e)
    }
    try {
      const global = getI18nGlobal()
      const gt = (global as unknown as { t: (key: string) => string }).t
      if (typeof gt === 'function') return gt
    } catch (e) {
      logger.debug('[useEduPlatformNav] global i18n fallback failed:', e)
    }
    // 终极兜底：返回 key 本身，避免 t(...) 抛错连锁
    return (key: string) => key
  }

  /**
   * 在事件真正触发时（用户点击「用户端 / 总管理端」菜单）再次尝试获取 store。
   */
  const getAuthStore = (): ReturnType<typeof useAuthStore> | null => {
    if (authStore) return authStore
    try {
      authStore = useAuthStore()
      return authStore
    } catch (e) {
      logger.debug('[useEduPlatformNav] authStore lazy load failed:', e)
      return null
    }
  }

  /**
   * 跳转到教育平台（项目内路由）。
   * - 未登录: 提示并跳 /login?redirect=<目标路径>, 登录后回到目标页
   * - 已登录: 直接 router.push 到目标路由, 由路由守卫校验权限 (管理端需 requiresAdmin)
   *
   * 2026-06-27: 全部通过 getRouter / getT 懒加载获取, 任何一项失败都降级为
   * window.location.href 整页跳转, 绝不让调用方因 composable 抛错而白屏.
   */
  function goToEduPlatform(platform: EduPlatformKey): void {
    const targetPath = EDU_PLATFORM_ROUTES[platform]
    const r = getRouter()
    const t = getT()

    // router 不可用: 降级为整页跳转, 保证用户能到达目标页
    // 弹窗模式: 跳首页 + 写入回跳路径, Login.vue 占位组件会自动弹窗
    if (!r) {
      logger.warn('[useEduPlatformNav] router unavailable, fallback to window.location', {
        platform,
        targetPath,
      })
      ElMessage.warning(t('auth.pleaseLoginFirst'))
      onDone?.()
      try {
        localStorage.setItem('auth-return-path', targetPath)
      } catch {
        // ignore storage error
      }
      window.location.href = '/'
      return
    }

    const auth = getAuthStore()

    // Pinia 仍未就绪: 退化为「请先登录」流程，直接弹窗（useLoginDialog 不依赖 Pinia）
    if (!auth) {
      logger.warn('[useEduPlatformNav] authStore unavailable when navigating, fallback to login', {
        platform,
      })
      ElMessage.warning(t('auth.pleaseLoginFirst'))
      onDone?.()
      useLoginDialog().open('login', targetPath)
      return
    }

    if (!auth.isLoggedIn) {
      ElMessage.warning(t('auth.pleaseLoginFirst'))
      onDone?.()
      // 弹窗形式：直接打开登录弹窗并携带回跳路径，不跳转路由
      useLoginDialog().open('login', targetPath)
      return
    }

    logger.info('[useEduPlatformNav] Navigating to edu platform (in-app route)', {
      platform,
      targetPath,
    })
    void r.push(targetPath)
    onDone?.()
  }

  function goToEduWeb() {
    goToEduPlatform('eduWeb')
  }

  function goToEduAdmin() {
    goToEduPlatform('eduAdmin')
  }

  return {
    goToEduPlatform,
    goToEduWeb,
    goToEduAdmin,
  }
}
