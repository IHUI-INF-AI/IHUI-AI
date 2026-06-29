/**
 * Auth 启动 Composable
 * 抽离自 App.vue 的 SSO 回调处理 + initAuth 流程
 *
 * 职责:
 *  1. 解析 URL 中的 SSO 参数(token/refreshToken/userInfo)
 *  2. 调用 authStore.thirdPartyLogin 设置登录态
 *  3. 清理 URL,显示成功提示
 *  4. 兜底恢复 localStorage 中的登录态
 */

import { useAuthStore } from '@/stores/auth'
import { logger } from '@/utils/logger'

export interface SsoCallbackResult {
  success: boolean
  hadSsoParams: boolean
  error?: unknown
}

/**
 * 处理 URL 中的 SSO 回调参数。
 * 如果没有 SSO 参数,直接返回 hadSsoParams=false。
 */
export async function handleSsoCallback(): Promise<SsoCallbackResult> {
  if (typeof window === 'undefined') {
    return { success: true, hadSsoParams: false }
  }

  try {
    const url = new URL(window.location.href)
    const urlToken = url.searchParams.get('token')
    const urlRefreshToken = url.searchParams.get('refreshToken')
    const urlUserInfo = url.searchParams.get('userInfo')

    if (!urlToken || !urlUserInfo) {
      return { success: true, hadSsoParams: false }
    }

    logger.info('[useAuthBootstrap] Detected SSO authentication parameters, starting processing')

    let userInfoObj: Record<string, unknown> = {}
    try {
      userInfoObj = JSON.parse(decodeURIComponent(urlUserInfo))
    } catch (e) {
      logger.warn('[useAuthBootstrap] Failed to parse userInfo:', e)
    }

    const authStore = useAuthStore()
    await authStore.thirdPartyLogin({
      token: urlToken,
      refreshToken: urlRefreshToken || undefined,
      user: {
        id: String(userInfoObj.userId || ''),
        uuid: String(userInfoObj.userId || ''),
        username: (userInfoObj.username as string) || '',
        nickname: (userInfoObj.username as string) || '',
        avatar: (userInfoObj.avatar as string) || '',
        phone: (userInfoObj.phone as string) || '',
        email: (userInfoObj.email as string) || '',
        gender: (userInfoObj.gender as number) || 0,
        birthday: (userInfoObj.birthday as string) || '',
        signature: (userInfoObj.signature as string) || '',
        status: (userInfoObj.status as number) || 1,
        isVip: Boolean(userInfoObj.isVip),
        inviteCode: (userInfoObj.inviteCode as string) || '',
        createTime: (userInfoObj.createTime as string) || new Date().toISOString(),
        updateTime: (userInfoObj.updateTime as string) || new Date().toISOString(),
        vipLevelVO: userInfoObj.vipLevelVO as Record<string, unknown> | undefined,
        userMargin: userInfoObj.userMargin as Record<string, unknown> | undefined,
        authInfo: userInfoObj.authInfo as Record<string, unknown> | undefined,
        identityType: (userInfoObj.identityType as number) || 0,
        needPwd: (userInfoObj.needPwd as number) || 0,
      },
      loginType: 'sso',
    })

    // 清理 URL 参数
    url.searchParams.delete('token')
    url.searchParams.delete('refreshToken')
    url.searchParams.delete('userInfo')
    window.history.replaceState({}, document.title, url.toString())

    logger.info('[useAuthBootstrap] SSO authentication callback processed successfully', {
      hasToken: !!urlToken,
      hasUser: !!userInfoObj,
      userId: userInfoObj.userId,
    })

    return { success: true, hadSsoParams: true }
  } catch (error) {
    logger.warn('[useAuthBootstrap] SSO auth callback handling failed:', error)
    return { success: false, hadSsoParams: true, error }
  }
}

/**
 * 恢复 localStorage 中的登录态。
 * 任何失败都吞掉并打 warn,不影响页面渲染。
 */
export async function restoreAuthState(): Promise<void> {
  try {
    const authStore = useAuthStore()
    await authStore.initAuth()
    logger.info('[useAuthBootstrap] Auth state initialization complete')
  } catch (error) {
    logger.warn('[useAuthBootstrap] Auth state initialization failed:', error)
  }
}
