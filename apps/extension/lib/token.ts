import { setBaseUrl } from '@ihui/api-client'
import { type TokenPair } from '@ihui/types'
import { bindTokenStoreToApiClient, type TokenStore } from '@ihui/shared/auth'
import { createChromePlatform } from '@ihui/browser-platform'
import {
  initApiBaseUrl,
  getApiBaseUrl,
  TOKEN_STORAGE_KEY,
  REFRESH_TOKEN_STORAGE_KEY,
  EXPIRES_IN_STORAGE_KEY,
} from './config'

const platform = createChromePlatform()

let cachedToken: string | null = null
let cachedRefreshToken: string | null = null
let cachedExpiresIn: number | null = null

export async function initApi(): Promise<void> {
  await initApiBaseUrl()
  setBaseUrl(getApiBaseUrl())

  const [storedToken, storedRefresh, storedExpiresIn] = await Promise.all([
    platform.storage.localGet<string>(TOKEN_STORAGE_KEY),
    platform.storage.localGet<string>(REFRESH_TOKEN_STORAGE_KEY),
    platform.storage.localGet<number>(EXPIRES_IN_STORAGE_KEY),
  ])
  cachedToken = typeof storedToken === 'string' ? storedToken : null
  cachedRefreshToken = typeof storedRefresh === 'string' ? storedRefresh : null
  cachedExpiresIn = typeof storedExpiresIn === 'number' ? storedExpiresIn : null

  platform.storage.onStorageChanged('local', (changes) => {
    if (changes[TOKEN_STORAGE_KEY]) {
      const newValue = changes[TOKEN_STORAGE_KEY].newValue
      cachedToken = typeof newValue === 'string' ? newValue : null
    }
    if (changes[REFRESH_TOKEN_STORAGE_KEY]) {
      const newValue = changes[REFRESH_TOKEN_STORAGE_KEY].newValue
      cachedRefreshToken = typeof newValue === 'string' ? newValue : null
    }
    if (changes[EXPIRES_IN_STORAGE_KEY]) {
      const newValue = changes[EXPIRES_IN_STORAGE_KEY].newValue
      cachedExpiresIn = typeof newValue === 'number' ? newValue : null
    }
  })

  bindTokenStoreToApiClient(tokenStore)
}

export async function setToken(token: string | null): Promise<void> {
  cachedToken = token
  if (token) {
    await platform.storage.localSet(TOKEN_STORAGE_KEY, token)
  } else {
    await platform.storage.localRemove(TOKEN_STORAGE_KEY)
  }
}

/** 单独设置 refresh token(写存储 + 更新缓存),与 setToken 解耦 */
export async function setRefreshToken(token: string | null): Promise<void> {
  cachedRefreshToken = token
  if (token) {
    await platform.storage.localSet(REFRESH_TOKEN_STORAGE_KEY, token)
  } else {
    await platform.storage.localRemove(REFRESH_TOKEN_STORAGE_KEY)
  }
}

export function getToken(): string | null {
  return cachedToken
}

export function clearToken(): void {
  cachedToken = null
}

export async function setTokenPair(pair: TokenPair): Promise<void> {
  cachedToken = pair.accessToken
  cachedRefreshToken = pair.refreshToken ?? null
  if (pair.expiresIn !== undefined) cachedExpiresIn = pair.expiresIn
  await Promise.all([
    platform.storage.localSet(TOKEN_STORAGE_KEY, pair.accessToken),
    platform.storage.localSet(REFRESH_TOKEN_STORAGE_KEY, pair.refreshToken),
    ...(pair.expiresIn !== undefined
      ? [platform.storage.localSet(EXPIRES_IN_STORAGE_KEY, pair.expiresIn)]
      : []),
  ])
}

export function getRefreshToken(): string | null {
  return cachedRefreshToken
}

export function getExpiresIn(): number | null {
  return cachedExpiresIn
}

export async function clearAllTokens(): Promise<void> {
  cachedToken = null
  cachedRefreshToken = null
  cachedExpiresIn = null
  await Promise.all([
    platform.storage.localRemove(TOKEN_STORAGE_KEY),
    platform.storage.localRemove(REFRESH_TOKEN_STORAGE_KEY),
    platform.storage.localRemove(EXPIRES_IN_STORAGE_KEY),
  ])
  const { stopAutoRefresh } = await import('./token-utils')
  stopAutoRefresh()
}

/**
 * TokenStore 契约接入(类型层验证,零运行时改动)
 *
 * 编译时验证本端 token 管理实现符合 @ihui/shared/auth TokenStore 接口,
 * 为后续跨端统一调用提供类型安全网。各调用方仍可直接用具体函数,
 * 此对象供后续重构或新代码通过 TokenStore 接口调用使用。
 */
export const tokenStore: TokenStore = {
  getToken,
  getRefreshToken,
  setToken,
  setRefreshToken,
  clearAll: clearAllTokens,
}
