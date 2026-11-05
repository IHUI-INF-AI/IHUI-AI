// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 退出登录的平台动作(无渲染) — 对齐共享屏 ProfileScreen 的 logoutBtn(共享屏由宿主注入
// onLogout,本端按 pkg-user/user/settings 的同一套登出动作实现:登出 API → clearAuth → 回登录页)。
//
// 登出必须把 refreshToken 交出去:POST /api/auth/logout 的吊销腿是
// `body.refreshToken 优先,无则读 httpOnly cookie`(auth.ts 的 /logout handler),
// 小程序没有 cookie ⇒ 空 body 调用会 200 但回 `revoked:false`,本地清了凭据而服务端
// 长效令牌仍活着(可继续续签)。端内 `logout()` 封装不带参,故这里直连在册端点。
// 薄壳后按钮渲染归共享屏,此文件只保留动作。
import Taro from '@tarojs/taro'
import { useCallback } from 'react'
import { useI18n } from '@/i18n'
import { post } from '@/api'
import { clearAuth, getRefreshToken, goToLogin } from '@/utils/auth'
import { logger } from '@/utils/logger'
import { onToast } from '@/host/on-toast'

type Translate = (key: string) => string

/**
 * 无渲染的登出动作(共享屏 ProfileScreen / SettingsScreen 均由宿主注入 onLogout)。
 * settings 页的确认弹窗由共享屏 onConfirm 发起,故这里不再自带 showModal。
 */
export async function performLogout(t: Translate): Promise<void> {
  // 令牌要在 clearAuth() 之前取(clear 之后就没了)
  const refreshToken = getRefreshToken()
  try {
    const r = await post<{ revoked?: boolean }>('/auth/logout', { refreshToken })
    // 服务端没吊销成功 ⇒ 记一条(不粉饰成"已吊销"),本地登出照常执行
    if (!r?.revoked) logger.error('user/logout', '退出登录:服务端未吊销 refreshToken', null)
  } catch (e) {
    logger.error('user/logout', '退出登录', e)
  }
  // 清凭据 + 落登出标记是 clearAuth() 一件成对动作,顺序在它内部定死
  clearAuth()
  onToast(t('user.loggedOut'), { kind: 'success' })
  setTimeout(goToLogin, 800)
}

export function useProfileLogout() {
  const { t } = useI18n()
  return useCallback(() => {
    Taro.showModal({
      title: t('setting.hint'),
      content: t('setting.logoutConfirm'),
      success: async (res) => {
        if (!res.confirm) return
        await performLogout(t)
      },
    })
  }, [t])
}

export default useProfileLogout
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
