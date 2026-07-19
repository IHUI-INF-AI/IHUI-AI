import * as WebBrowser from 'expo-web-browser'
import * as Linking from 'expo-linking'
import { WEB_BASE_URL, SSO_CLIENT_ID, SSO_REDIRECT_URI, API_BASE_URL } from './config'
import type { AuthUser } from '@ihui/api-client'

/**
 * SSO 登录数据(与后端 /api/auth/sso/exchange 响应结构对齐)
 */
export interface SsoTokenData {
  accessToken: string
  refreshToken: string
  expiresIn: number
  refreshExpiresIn: number
  user: AuthUser
}

/**
 * 生成 web SSO 登录中心 URL(供 openAuthSession 打开)
 */
export function getSsoLoginUrl(): string {
  const params = new URLSearchParams({
    redirect: SSO_REDIRECT_URI,
    client_id: SSO_CLIENT_ID,
  })
  return `${WEB_BASE_URL}/sso/login?${params.toString()}`
}

/**
 * 调 SSO exchange 端点,用 code 换 token
 */
export async function exchangeSsoCode(code: string): Promise<SsoTokenData | null> {
  try {
    const resp = await fetch(`${API_BASE_URL}/api/auth/sso/exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, clientId: SSO_CLIENT_ID }),
    })
    if (!resp.ok) return null
    const data = await resp.json()
    if (data.code !== 200 || !data.data) return null
    return data.data as SsoTokenData
  } catch {
    return null
  }
}

/**
 * 打开 web SSO 登录页,等待用户登录后 deep link 回跳。
 * 返回 deep link URL(含 sso_code query),或 null(用户取消/超时)。
 */
export async function openSsoLogin(): Promise<string | null> {
  const url = getSsoLoginUrl()
  const result = await WebBrowser.openAuthSessionAsync(url, SSO_REDIRECT_URI)
  if (result.type === 'success' && result.url) {
    return result.url
  }
  return null
}

/**
 * 从 deep link URL 解析 sso_code
 */
export function extractSsoCode(url: string): string | null {
  try {
    const parsed = new URL(url)
    return parsed.searchParams.get('sso_code')
  } catch {
    return null
  }
}

/**
 * 监听 deep link(应用已启动时,系统把 ihui://sso/callback?sso_code=xxx 转给本回调)
 */
export function subscribeSsoDeepLink(callback: (ssoCode: string) => void): () => void {
  const subscription = Linking.addEventListener('url', ({ url }) => {
    const code = extractSsoCode(url)
    if (code) callback(code)
  })
  return () => subscription.remove()
}

/**
 * 应用冷启动时检查初始 deep link(若因 deep link 唤起,这里拿到 URL)
 */
export async function getInitialSsoCode(): Promise<string | null> {
  try {
    const url = await Linking.getInitialURL()
    if (!url) return null
    return extractSsoCode(url)
  } catch {
    return null
  }
}
