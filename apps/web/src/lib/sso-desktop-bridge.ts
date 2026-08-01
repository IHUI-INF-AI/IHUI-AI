'use client'

/**
 * Desktop deep-link → SSO 闭环桥接(2026-08-01 立,AGENTS.md §9 多端同步)
 *
 * 流程:
 * 1. Desktop 启动 → 用户在外部浏览器完成 SSO 登录
 * 2. 浏览器通过 `ihui://sso?sso_code=xxx` deep-link 回调 desktop
 * 3. Rust 端 on_deeplink 捕获 → emit "desktop-deep-link" 事件给 webview
 * 4. 本模块 handleDesktopDeepLink(url) 解析 sso_code,调 /sso/exchange 换 token
 * 5. 写入 useAuthStore,完成 desktop SSO 登录
 *
 * 共享逻辑:复用 @ihui/shared auth/sso-core.ts 的 exchangeSsoCode + extractSsoCode
 * 平台特有:仅 desktop(Tauri webview)调用,浏览器端 useDesktopDeepLink hook 不注册
 */

import { exchangeSsoCode, extractSsoCode } from '@ihui/shared'
import { useAuthStore } from '@/stores/auth'
import type { AuthUser } from '@ihui/api-client'

const DESKTOP_CLIENT_ID = 'desktop'

function detectApiBaseUrl(): string {
  if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
    return 'http://127.0.0.1:8802'
  }
  return process.env.NEXT_PUBLIC_API_BASE_URL || ''
}

/**
 * 处理 desktop deep-link URL,完成 SSO 闭环。
 *
 * @param url deep-link URL,格式 `ihui://sso?sso_code=xxx` 或 `ihui://callback?sso_code=xxx`
 * @returns 成功返回 true;失败返回 false(无 sso_code / exchange 失败)
 */
export async function handleDesktopDeepLink(url: string): Promise<boolean> {
  const code = extractSsoCode(url)
  if (!code) return false

  const apiBase = detectApiBaseUrl()
  const tokenData = await exchangeSsoCode(apiBase, code, DESKTOP_CLIENT_ID)
  if (!tokenData) return false

  const { setToken, setUser } = useAuthStore.getState()
  setToken(tokenData.accessToken, tokenData.refreshToken)
  const user: AuthUser = {
    id: tokenData.user.id,
    nickname: tokenData.user.nickname,
    avatar: tokenData.user.avatar,
  }
  setUser(user)
  return true
}
