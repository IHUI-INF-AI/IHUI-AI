/**
 * SSO 统一登录接入（小程序端）
 *
 * 使用场景：小程序需要登录时，跳转到 Web 端 SSO 登录中心，
 * 登录成功后通过一次性 code 回跳小程序，小程序用 code 换取 token。
 */
import { getStorageSync, removeStorageSync } from '@tarojs/taro'
import { BASE_URL } from './request'

const SSO_CODE_KEY = 'ihui_sso_code'
const SSO_CLIENT_ID = 'miniapp-taro'

export interface SsoTokenData {
  accessToken: string
  refreshToken: string
  expiresIn: number
  refreshExpiresIn: number
  user: {
    id: string
    phone: string
    email: string
    nickname: string
    avatar: string
    roleId: number
    status: number
  }
}

export function getStoredSsoCode(): string {
  return getStorageSync(SSO_CODE_KEY) || ''
}

export function clearSsoCode(): void {
  removeStorageSync(SSO_CODE_KEY)
}

export function getSsoLoginUrl(redirectUri: string): string {
  const webBase = process.env.TARO_APP_WEB_URL || 'http://localhost:3000'
  const params = new URLSearchParams({
    redirect: redirectUri,
    client_id: SSO_CLIENT_ID,
  })
  return `${webBase}/sso/login?${params.toString()}`
}

export async function exchangeSsoCode(code: string): Promise<SsoTokenData | null> {
  try {
    const resp = await fetch(`${BASE_URL}/auth/sso/exchange`, {
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

export async function validateToken(token: string): Promise<boolean> {
  try {
    const resp = await fetch(`${BASE_URL}/auth/sso/validate`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!resp.ok) return false
    const data = await resp.json()
    return data.code === 200 && data.data?.valid === true
  } catch {
    return false
  }
}

export async function ssoLogout(token: string): Promise<boolean> {
  try {
    const resp = await fetch(`${BASE_URL}/auth/sso/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    return resp.ok
  } catch {
    return false
  }
}
