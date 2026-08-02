/**
 * mobile-rn token 管理(接入 SecureStore,带 AsyncStorage fallback)
 *
 * 历史背景:之前 token 用 AsyncStorage 明文持久化,iOS 越狱/Android root 后可读。
 * 2026-07-20 升级:token 改用 SecureStore(iOS Keychain / Android Keystore 系统级加密),
 * 不可用时透明降级到 AsyncStorage(开发/测试环境,无 Keychain 风险低)。
 * 2026-07-27 重构:改用 @ihui/shared/auth 的 createInMemoryTokenStore 工厂统一管理内存缓存,
 * SecureStore 持久化逻辑下放到 onSetToken/onSetRefreshToken/onClearAll 回调,
 * 消除手写 cachedToken/cachedRefreshToken 模块级状态。
 *
 * 调用方:`setToken` / `setRefreshToken` / `clearToken` / `getToken` / `getRefreshToken`。
 * `getToken` / `getRefreshToken` 返回同步缓存值(避免每次 HTTP 都 await SecureStore)。
 */
import { setBaseUrl, setDeviceFingerprintProvider } from '@ihui/api-client'
import { API_BASE_URL, TOKEN_STORAGE_KEY, REFRESH_TOKEN_STORAGE_KEY } from './config'
import { mobileRnDeviceFingerprintCollector } from './device-fingerprint'
import { deleteSecureItem, getSecureItem, setSecureItem } from './auth/secure-store'
import {
  bindTokenStoreToApiClient,
  createInMemoryTokenStore,
  type TokenStore,
} from '@ihui/shared/auth'

/**
 * 内存缓存 TokenStore(工厂创建)
 *
 * 缓存由工厂统一管理,持久化通过回调下放到 SecureStore:
 * - onSetToken/onSetRefreshToken:token 非空写 SecureStore,为空删除
 * - onClearAll:并行删除两个 key
 * SecureStore 内部带 AsyncStorage fallback(见 ./auth/secure-store),存储层级保留。
 */
const memoryStore = createInMemoryTokenStore({
  onSetToken: async (token) => {
    if (token) {
      await setSecureItem(TOKEN_STORAGE_KEY, token)
    } else {
      await deleteSecureItem(TOKEN_STORAGE_KEY)
    }
  },
  onSetRefreshToken: async (token) => {
    if (token) {
      await setSecureItem(REFRESH_TOKEN_STORAGE_KEY, token)
    } else {
      await deleteSecureItem(REFRESH_TOKEN_STORAGE_KEY)
    }
  },
  onClearAll: async () => {
    await Promise.all([
      deleteSecureItem(TOKEN_STORAGE_KEY),
      deleteSecureItem(REFRESH_TOKEN_STORAGE_KEY),
    ])
  },
})

export async function initApi(): Promise<void> {
  setBaseUrl(API_BASE_URL)
  const [stored, storedRefresh] = await Promise.all([
    getSecureItem(TOKEN_STORAGE_KEY),
    getSecureItem(REFRESH_TOKEN_STORAGE_KEY),
  ])
  // Hydrate 缓存:从 SecureStore 读取后只更新内存,不回写存储(避免循环触发)
  memoryStore.setCachedWithoutPersist({
    token: typeof stored === 'string' ? stored : null,
    refreshToken: typeof storedRefresh === 'string' ? storedRefresh : null,
  })
  bindTokenStoreToApiClient(tokenStore)
  setDeviceFingerprintProvider(mobileRnDeviceFingerprintCollector)
}

export function getToken(): string | null {
  return memoryStore.getToken()
}

export function getRefreshToken(): string | null {
  return memoryStore.getRefreshToken()
}

export async function setToken(token: string | null): Promise<void> {
  await memoryStore.setToken(token)
}

export async function setRefreshToken(token: string | null): Promise<void> {
  await memoryStore.setRefreshToken(token)
}

export async function clearToken(): Promise<void> {
  await memoryStore.clearAll()
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
