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
import { setBaseUrl } from '@ihui/api-client'
import { API_BASE_URL, TOKEN_STORAGE_KEY, REFRESH_TOKEN_STORAGE_KEY } from './config'
import { deleteSecureItem, getSecureItem, setSecureItem } from './auth/secure-store'
import { bindTokenStoreToApiClient, type TokenStore } from '@ihui/shared/auth'

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
  bindTokenStoreToApiClient(tokenStore)
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
  await Promise.all([
    deleteSecureItem(TOKEN_STORAGE_KEY),
    deleteSecureItem(REFRESH_TOKEN_STORAGE_KEY),
  ])
}

/**
 * TokenStore 契约接入(类型层验证,零运行时改动)
 *
 * 编译时验证本端 token 管理实现符合 @ihui/shared/auth TokenStore 接口,
 * 为后续跨端统一调用提供类型安全网。各调用方仍可直接用具体函数,
 * 此对象供后续重构或新代码通过 TokenStore 接口调用使用。
 *
 * 注意:clearToken 同时清除 token + refreshToken,映射到 TokenStore.clearAll。
 */
export const tokenStore: TokenStore = {
  getToken,
  getRefreshToken,
  setToken,
  setRefreshToken,
  clearAll: clearToken,
}

// Re-export 给 mobile-rn 端使用(从 lib/token-store.ts 迁移,避免维护两个文件)
export { bindTokenStoreToApiClient } from '@ihui/shared/auth'
export type { TokenStore, TokenStoreWithUserInfo } from '@ihui/shared/auth'
