import { isTokenExpiredError as isSharedApiTokenExpiredError } from '@aizhs/shared-api'

interface TokenLike {
  token?: unknown
  accessToken?: unknown
  access_token?: unknown
  refreshToken?: unknown
  refresh_token?: unknown
  thirdPartyAccounts?: TokenLike
}

export function getAccessToken(data?: TokenLike | null): string | null {
  if (!data) return null
  const token =
    data.accessToken ??
    data.access_token ??
    data.token ??
    data.thirdPartyAccounts?.accessToken ??
    data.thirdPartyAccounts?.access_token ??
    data.thirdPartyAccounts?.token

  return typeof token === 'string' && token.length > 0 ? token : null
}

export function getRefreshToken(data?: TokenLike | null): string | null {
  if (!data) return null
  const token =
    data.refreshToken ??
    data.refresh_token ??
    data.thirdPartyAccounts?.refreshToken ??
    data.thirdPartyAccounts?.refresh_token

  return typeof token === 'string' && token.length > 0 ? token : null
}

export function hasValidToken(data?: TokenLike | null): boolean {
  return !!getAccessToken(data)
}

export function isTokenExpiredError(code: number | string | undefined | null): boolean {
  const normalized = typeof code === 'string' ? Number.parseInt(code, 10) : code
  return typeof normalized === 'number' && isSharedApiTokenExpiredError(normalized)
}
