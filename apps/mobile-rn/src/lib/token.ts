/**
 * mobile-rn token 管理(接入 SecureStore,带 AsyncStorage fallback)
 *
 * 历史背景:之前 token 用 AsyncStorage 明文持久化,iOS 越狱/Android root 后可读。
 * 2026-07-20 升级:token 改用 SecureStore(iOS Keychain / Android Keystore 系统级加密),
 * 不可用时透明降级到 AsyncStorage(开发/测试环境,无 Keychain 风险低)。
 *
 * 调用方:`setToken` / `setRefreshToken` / `clearToken` / `getToken` / `getRefreshToken`。
 * `getToken` / `getRefreshToken` 返回同步缓存值(避免每次 HTTP 都 await SecureStore)。
 */
import { setBaseUrl, setTokenProvider } from '@ihui/api-client'
import { API_BASE_URL, TOKEN_STORAGE_KEY, REFRESH_TOKEN_STORAGE_KEY } from './config'
import { deleteSecureItem, getSecureItem, setSecureItem } from './auth/secure-store'

let cachedToken: string | null = null
let cachedRefreshToken: string | null = null

export async function initApi(): Promise<void> {
  setBaseUrl(API_BASE_URL)
  const [stored, storedRefresh] = await Promise.all([
    getSecureItem(TOKEN_STORAGE_KEY),
    getSecureItem(REFRESH_TOKEN_STORAGE_KEY),
  ])
  cachedToken = typeof stored === 'string' ? stored : null
  cachedRefreshToken = typeof storedRefresh === 'string' ? storedRefresh : null
  setTokenProvider({ getToken: () => cachedToken })
}

export function getToken(): string | null {
  return cachedToken
}

export function getRefreshToken(): string | null {
  return cachedRefreshToken
}

export async function setToken(token: string | null): Promise<void> {
  cachedToken = token
  if (token) {
    await setSecureItem(TOKEN_STORAGE_KEY, token)
  } else {
    await deleteSecureItem(TOKEN_STORAGE_KEY)
  }
}

export async function setRefreshToken(token: string | null): Promise<void> {
  cachedRefreshToken = token
  if (token) {
    await setSecureItem(REFRESH_TOKEN_STORAGE_KEY, token)
  } else {
    await deleteSecureItem(REFRESH_TOKEN_STORAGE_KEY)
  }
}

export async function clearToken(): Promise<void> {
  cachedToken = null
  cachedRefreshToken = null
  await Promise.all([deleteSecureItem(TOKEN_STORAGE_KEY), deleteSecureItem(REFRESH_TOKEN_STORAGE_KEY)])
}
