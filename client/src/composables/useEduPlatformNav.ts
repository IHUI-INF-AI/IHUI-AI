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
 */
export function useEduPlatformNav(options: UseEduPlatformNavOptions = {}) {
  const router = useRouter()
  const { t } = useI18n()
  const authStore = useAuthStore()
  const { onDone } = options

  async function goToEduPlatform(platform: EduPlatformKey): Promise<void> {
    try {
      const baseUrl = EDU_PLATFORM_URLS[platform]

      let userUuid = ''
      const storeWithUuid = authStore as unknown as { userUuid?: string }
      userUuid = storeWithUuid.userUuid || ''

      if (!userUuid) {
        const user = authStore.user as {
          uuid?: string
          id?: string
          userId?: string
          userUuid?: string
        } | null
        userUuid = user?.uuid || user?.id || user?.userId || user?.userUuid || ''
      }

      if (!userUuid && authStore.isLoggedIn && authStore.token) {
        try {
          const fetchUserInfo = (authStore as { fetchUserInfo?: () => Promise<void> }).fetchUserInfo
          if (fetchUserInfo) {
            await fetchUserInfo()
            userUuid = storeWithUuid.userUuid || ''
            if (!userUuid) {
              const user = authStore.user as {
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

      if (!authStore.isLoggedIn) {
        sessionStorage.setItem('edu_redirect_platform', platform)
        ElMessage.warning(t('auth.pleaseLoginFirst'))
        onDone?.()
        void router.push('/login')
        return
      }

      if (!userUuid) {
        logger.warn('[useEduPlatformNav] User logged in but uuid is empty', {
          isLoggedIn: authStore.isLoggedIn,
          hasToken: !!authStore.token,
          hasUser: !!authStore.user,
        })
        ElMessage.warning(t('header.userInfoIncomplete'))
        onDone?.()
        authStore.logout()
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
