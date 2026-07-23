/**
 * Web 端 SSO 接入:核心逻辑复用 @ihui/shared/auth/sso-core,仅保留 web 独占
 * (getRedirectUrl / getSsoCode 依赖 window.location)。
 */
export {
  exchangeSsoCode,
  validateToken,
  ssoLogout,
  extractSsoCode,
  buildSsoLoginUrl as getSsoLoginUrl,
  SSO_ENDPOINTS,
} from '@ihui/shared/auth/sso-core'
export type { SsoTokenData, SsoValidateResponse, SsoUser } from '@ihui/shared/auth/sso-core'

// 兼容旧类型名(web 原用 SsoTokenResponse)
export type { SsoTokenData as SsoTokenResponse } from '@ihui/shared/auth/sso-core'

/** web 独占:从当前 location 读取 redirect 参数 */
export function getRedirectUrl(): string {
  if (typeof window === 'undefined') return '/'
  return new URLSearchParams(window.location.search).get('redirect') || '/'
}

/** web 独占:从当前 location 读取 sso_code */
export function getSsoCode(): string | null {
  if (typeof window === 'undefined') return null
  return new URLSearchParams(window.location.search).get('sso_code')
}
