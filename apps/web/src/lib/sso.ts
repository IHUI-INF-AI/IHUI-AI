export interface SsoTokenResponse {
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

export interface SsoValidateResponse {
  valid: boolean
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

export const SSO_ENDPOINTS = {
  code: '/api/auth/sso/code',
  exchange: '/api/auth/sso/exchange',
  logout: '/api/auth/sso/logout',
  validate: '/api/auth/sso/validate',
} as const

export function getRedirectUrl(): string {
  if (typeof window === 'undefined') return '/'
  return new URLSearchParams(window.location.search).get('redirect') || '/'
}

export function getSsoCode(): string | null {
  if (typeof window === 'undefined') return null
  return new URLSearchParams(window.location.search).get('sso_code')
}

export async function exchangeSsoCode(
  apiBase: string,
  code: string,
  clientId: string,
): Promise<SsoTokenResponse | null> {
  const resp = await fetch(`${apiBase}${SSO_ENDPOINTS.exchange}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, clientId }),
  })
  if (!resp.ok) return null
  const data = await resp.json()
  if (data.code !== 200 || !data.data) return null
  return data.data as SsoTokenResponse
}

export async function validateToken(
  apiBase: string,
  token: string,
): Promise<SsoValidateResponse | null> {
  const resp = await fetch(`${apiBase}${SSO_ENDPOINTS.validate}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!resp.ok) return null
  const data = await resp.json()
  if (data.code !== 200 || !data.data) return null
  return data.data as SsoValidateResponse
}

export async function ssoLogout(apiBase: string, token: string): Promise<boolean> {
  const resp = await fetch(`${apiBase}${SSO_ENDPOINTS.logout}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
  return resp.ok
}
