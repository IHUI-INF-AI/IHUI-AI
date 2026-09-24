// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
import { fetchApi, setBaseUrl, setDeviceFingerprintProvider, setUserAgent } from '@ihui/api-client'
import { API_BASE_URL, APP_USER_AGENT, TOKEN_STORAGE_KEY, REFRESH_TOKEN_STORAGE_KEY } from './config'
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

/**
 * 401 自动续期(2026-09-22 立,对齐 web 端 apps/web/src/lib/api.ts 同名回调):
 * access token 仅 15min 有效,此前 RN 未注入本回调 → 登录 15 分钟后全部鉴权接口失效,
 * agent-control 能力上报每 60s 刷 "Invalid or expired token" 警告。
 * 走 fetchApi 自身(/auth/refresh 属 auth 端点,401 拦截器豁免,不递归续期)。
 * 成功:轮转写入新 token + refreshToken(SecureStore 持久化),返回新 access token;
 * 失败:refreshToken 也已失效 → 返回 null,由 api-client 失败冷却兜底,调用方按登录过期处理。
 */
async function refreshAccessToken(): Promise<string | null> {
  const storedRefresh = memoryStore.getRefreshToken()
  const res = await fetchApi<{ accessToken: string; refreshToken?: string | null }>(
    '/auth/refresh',
    {
      method: 'POST',
      body: JSON.stringify(storedRefresh ? { refreshToken: storedRefresh } : {}),
    },
  )
  if (res.success && res.data?.accessToken) {
    await memoryStore.setToken(res.data.accessToken)
    if (res.data.refreshToken) await memoryStore.setRefreshToken(res.data.refreshToken)
    return res.data.accessToken
  }
  return null
}

export async function initApi(): Promise<void> {
  setBaseUrl(API_BASE_URL)
  setUserAgent(APP_USER_AGENT)
  const [stored, storedRefresh] = await Promise.all([
    getSecureItem(TOKEN_STORAGE_KEY),
    getSecureItem(REFRESH_TOKEN_STORAGE_KEY),
  ])
  // Hydrate 缓存:从 SecureStore 读取后只更新内存,不回写存储(避免循环触发)
  memoryStore.setCachedWithoutPersist({
    token: typeof stored === 'string' ? stored : null,
    refreshToken: typeof storedRefresh === 'string' ? storedRefresh : null,
  })
  bindTokenStoreToApiClient(tokenStore, { refreshAccessToken })
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
