/**
 * SSO 共享核心(纯逻辑,零平台依赖)
 *
 * 仅依赖 fetch + URL(RN/taro/web 均有 polyfill),不 import expo/@tarojs/window。
 * 各端薄封装注入 apiBase / clientId,平台独占逻辑留在各端。
 */

export interface SsoUser {
  id: string
  phone: string
  email: string
  nickname: string
  avatar: string
  roleId: number
  status: number
}

export interface SsoTokenData {
  accessToken: string
  refreshToken: string
  expiresIn: number
  refreshExpiresIn: number
  user: SsoUser
}

export interface SsoValidateResponse {
  valid: boolean
  user: SsoUser
}

export const SSO_ENDPOINTS = {
  code: '/api/auth/sso/code',
  exchange: '/api/auth/sso/exchange',
  logout: '/api/auth/sso/logout',
  validate: '/api/auth/sso/validate',
} as const

/** 用 code 换 token(apiBase 为完整 API 基础地址,不含 /api/auth/sso 路径段) */
export async function exchangeSsoCode(
  apiBase: string,
  code: string,
  clientId: string,
): Promise<SsoTokenData | null> {
  try {
    const resp = await fetch(`${apiBase}${SSO_ENDPOINTS.exchange}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, clientId }),
    })
    if (!resp.ok) return null
    const data = (await resp.json()) as { code: number; data: SsoTokenData }
    if (data.code !== 200 || !data.data) return null
    return data.data
  } catch {
    return null
  }
}

/** 校验 token */
export async function validateToken(
  apiBase: string,
  token: string,
): Promise<SsoValidateResponse | null> {
  try {
    const resp = await fetch(`${apiBase}${SSO_ENDPOINTS.validate}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!resp.ok) return null
    const data = (await resp.json()) as { code: number; data: SsoValidateResponse }
    if (data.code !== 200 || !data.data) return null
    return data.data
  } catch {
    return null
  }
}

/** 登出 */
export async function ssoLogout(apiBase: string, token: string): Promise<boolean> {
  try {
    const resp = await fetch(`${apiBase}${SSO_ENDPOINTS.logout}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    return resp.ok
  } catch {
    return false
  }
}

/** 从 URL 提取 sso_code(RN deep link / web query 共用) */
export function extractSsoCode(url: string): string | null {
  try {
    const parsed = new URL(url)
    return parsed.searchParams.get('sso_code')
  } catch {
    return null
  }
}

/** 构建 SSO 登录中心 URL(RN/taro 共用) */
export function buildSsoLoginUrl(webBase: string, redirectUri: string, clientId: string): string {
  const params = new URLSearchParams({
    redirect: redirectUri,
    client_id: clientId,
  })
  return `${webBase}/sso/login?${params.toString()}`
}
