/**
 * 教育平台跳转 Composable
 *
 * @description 统一处理「用户端」「总管理端」跳转：登录校验、SSO、新窗口打开。供 HeaderNavigation、LearnAI 等复用。
 */

import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '@/stores/auth'
import { getStoredData } from '@/utils/request'
import { logger } from '@/utils/logger'
import { ssoLoginByUuid, buildEduPlatformUrl, EduPlatformType } from '@/api/sso'

/** 教育平台跳转地址：用户端 / 总管理端 */
export const EDU_PLATFORM_URLS = {
  eduWeb: 'https://user-edu.aizhs.top',
  eduAdmin: 'https://admin-edu.aizhs.top',
} as const

export type EduPlatformKey = keyof typeof EDU_PLATFORM_URLS

export interface UseEduPlatformNavOptions {
  /** 跳转完成或需要关闭 UI 时调用（如 Header 的 closeMenus） */
  onDone?: () => void
}

/**
 * 教育平台跳转逻辑，与头部导航「用户端」「总管理端」行为一致。
 *
 * 2026-06-25 修复（与 src/composables/useAppLifecycle.ts 同形）:
 * 顶层 useAuthStore 改为 try/catch + 懒加载, 解决 Pinia 尚未激活时
 * （Vite HMR / 早期 setup 竞态）抛
 *   '[🍍]: "getActivePinia()" was called but there was no active Pinia'
 * 导致 HeaderNavigation.vue setup 整体失败、render 时访问
 *   'Cannot read properties of undefined (reading "length")'
 * 崩溃的连锁问题（见控制台 20 条日志根因 #1）。
 */
export function useEduPlatformNav(options: UseEduPlatformNavOptions = {}) {
  const router = useRouter()
  const { t } = useI18n()
  const { onDone } = options

  // 顶层懒加载 + 兜底：避免 Pinia 未就绪时整个 composable 抛错，
  // 连带导致调用方（HeaderNavigation.vue）setup 整体失败。
  let authStore: ReturnType<typeof useAuthStore> | null = null
  try {
    authStore = useAuthStore()
  } catch (e) {
    logger.debug('[useEduPlatformNav] authStore unavailable on init, will lazy load:', e)
  }

  /**
   * 在事件真正触发时（用户点击「用户端 / 总管理端」菜单）再次尝试获取 store。
   * 由于 main.ts 顺序保证了 setActivePinia(pinia) 先于 app.mount，理论上此时
   * Pinia 一定已就绪；这里的多重兜底只是为了对抗 HMR 边界情况。
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

  async function goToEduPlatform(platform: EduPlatformKey): Promise<void> {
    const auth = getAuthStore()

    // Pinia 仍未就绪：保守退化为「请先登录」流程，避免在用户态未知时继续走 SSO。
    if (!auth) {
      logger.warn('[useEduPlatformNav] authStore unavailable when navigating, fallback to login', {
        platform,
      })
      try {
        sessionStorage.setItem('edu_redirect_platform', platform)
      } catch {
        // sessionStorage 不可用时静默
      }
      ElMessage.warning(t('auth.pleaseLoginFirst'))
      onDone?.()
      void router.push('/login')
      return
    }

    try {
      const baseUrl = EDU_PLATFORM_URLS[platform]

      let userUuid = ''
      const storeWithUuid = auth as unknown as { userUuid?: string }
      userUuid = storeWithUuid.userUuid || ''

      if (!userUuid) {
        const user = auth.user as {
          uuid?: string
          id?: string
          userId?: string
          userUuid?: string
        } | null
        userUuid = user?.uuid || user?.id || user?.userId || user?.userUuid || ''
      }

      if (!userUuid && auth.isLoggedIn && auth.token) {
        try {
          const fetchUserInfo = (auth as { fetchUserInfo?: () => Promise<void> }).fetchUserInfo
          if (fetchUserInfo) {
            await fetchUserInfo()
            userUuid = storeWithUuid.userUuid || ''
            if (!userUuid) {
              const user = auth.user as {
                uuid?: string
                id?: string
                userId?: string
                userUuid?: string
              } | null
              userUuid = user?.uuid || user?.id || user?.userId || user?.userUuid || ''
            }
          }
        } catch (e) {
          logger.warn('[useEduPlatformNav] Failed to refresh user info', e)
        }
      }

      if (!userUuid) {
        const stored = getStoredData() as Record<string, unknown> | null
        userUuid = (stored?.uuid ?? stored?.id ?? stored?.userId ?? stored?.userUuid ?? '') as string
      }

      if (!auth.isLoggedIn) {
        sessionStorage.setItem('edu_redirect_platform', platform)
        ElMessage.warning(t('auth.pleaseLoginFirst'))
        onDone?.()
        void router.push('/login')
        return
      }

      if (!userUuid) {
        logger.warn('[useEduPlatformNav] User logged in but uuid is empty', {
          isLoggedIn: auth.isLoggedIn,
          hasToken: !!auth.token,
          hasUser: !!auth.user,
        })
        ElMessage.warning(t('header.userInfoIncomplete'))
        onDone?.()
        auth.logout()
        void router.push('/login')
        return
      }

      const platformType = platform === 'eduAdmin' ? EduPlatformType.ADMIN : EduPlatformType.USER
      logger.info('[useEduPlatformNav] Initiating education platform SSO login', {
        platform,
        platformType: platformType === 1 ? '管理员端' : '会员端',
      })

      const ssoResponse = await ssoLoginByUuid({
        uuid: userUuid,
        platform: platformType,
      })
      const ssoCode = (ssoResponse as { code?: number }).code
      const ssoMsg = (ssoResponse as { msg?: string }).msg ?? (ssoResponse as { message?: string }).message

      if (!ssoResponse.success || ssoCode === 555 || !ssoResponse.data) {
        ElMessage.warning(ssoMsg || '单点登录失败，请重试')
        logger.warn('[useEduPlatformNav] SSO login failed', { code: ssoCode, message: ssoMsg })
        return
      }

      const redirectUrl = buildEduPlatformUrl(baseUrl, ssoResponse.data)
      window.open(redirectUrl, '_blank')
      onDone?.()
    } catch (_error) {
      ElMessage.error(t('msg.header_navigation.跳转失败请重试') || '跳转失败，请重试')
    }
  }

  function goToEduWeb() {
    return goToEduPlatform('eduWeb')
  }

  function goToEduAdmin() {
    return goToEduPlatform('eduAdmin')
  }

  return {
    goToEduPlatform,
    goToEduWeb,
    goToEduAdmin,
  }
}
