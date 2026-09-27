// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { setBaseUrl, setDeviceFingerprintProvider, setUnauthorizedHandler } from '@ihui/api-client'
import { type TokenPair } from '@ihui/types'
import {
  bindTokenStoreToApiClient,
  createInMemoryTokenStore,
  type TokenStore,
} from '@ihui/shared/auth'
import { extensionDeviceFingerprintCollector } from '../src/lib/device-fingerprint'
import { createChromePlatform } from '@ihui/browser-platform'
import {
  initApiBaseUrl,
  getApiBaseUrl,
  TOKEN_STORAGE_KEY,
  REFRESH_TOKEN_STORAGE_KEY,
  EXPIRES_IN_STORAGE_KEY,
} from './config'

const platform = createChromePlatform()

/**
 * 内存缓存 TokenStore:委托 @ihui/shared/auth 工厂统一管理 cachedToken /
 * cachedRefreshToken / cachedExpiresIn,onSet* 回调下放 platform.storage 持久化。
 * setCachedWithoutPersist 供 onStorageChanged 跨标签页同步(只更新缓存不回写)。
 */
const store = createInMemoryTokenStore({
  onSetToken: async (token) => {
    if (token) {
      await platform.storage.localSet(TOKEN_STORAGE_KEY, token)
    } else {
      await platform.storage.localRemove(TOKEN_STORAGE_KEY)
    }
  },
  onSetRefreshToken: async (token) => {
    if (token) {
      await platform.storage.localSet(REFRESH_TOKEN_STORAGE_KEY, token)
    } else {
      await platform.storage.localRemove(REFRESH_TOKEN_STORAGE_KEY)
    }
  },
  onSetExpiresIn: async (expiresIn) => {
    if (expiresIn !== null) {
      await platform.storage.localSet(EXPIRES_IN_STORAGE_KEY, expiresIn)
    } else {
      await platform.storage.localRemove(EXPIRES_IN_STORAGE_KEY)
    }
  },
  onClearAll: async () => {
    await Promise.all([
      platform.storage.localRemove(TOKEN_STORAGE_KEY),
      platform.storage.localRemove(REFRESH_TOKEN_STORAGE_KEY),
      platform.storage.localRemove(EXPIRES_IN_STORAGE_KEY),
    ])
  },
})

/**
 * 会话彻底失效时派发的 DOM 事件名(2026-09-27 立)。
 * sidepanel 监听它翻回登录页 —— 与 RN 的 `navigateTo('Login')`、web 的登录弹窗同一出口的三个端形态。
 */
export const SESSION_EXPIRED_EVENT = 'ihui:session-expired'

/**
 * 401 且续期仍未拿到 token 时的统一出口。
 *
 * 刻意**不在这里判"有没有凭据"**:本端续期失败路径会 `clearAllTokens()`(见 token-utils
 * 的 doRefresh),等本函数被调用时 token 已经是 null —— 按"游客态不接管"在这里提前返回,
 * 恰好会把"会话死了"这一型误判成"本来就没登录",而这正是本出口唯一要接管的场景。
 * 判据搬到监听侧:那里读得到 `authed` 这个事实本身,不需要再造一个"何时复位"的模块级布尔量。
 * background(Service Worker)上下文没有订阅者,派发即无副作用。
 */
function onUnrecoverableUnauthorized(): void {
  // 派发目标是"本 realm 的 globalThis":sidepanel / popup 里它就是 window,Service Worker 里
  // 没有订阅者所以派发即无副作用;非 DOM 宿主(如 node 单测)拿不到 dispatchEvent,判不到即返回,
  // 不抛 —— 两条形态各由一条用例钉住(有派发目标必喊、没有必不抛)。
  const target = globalThis as unknown as EventTarget
  if (typeof target.dispatchEvent !== 'function') return
  target.dispatchEvent(new Event(SESSION_EXPIRED_EVENT))
}

/** token-utils 反向依赖本模块(clearAllTokens 里那条动态 import 是同一条环的先例),故动态取 */
async function refreshViaExtensionStore(): Promise<string | null> {
  const { doRefresh } = await import('./token-utils')
  return (await doRefresh()) ? getToken() : null
}

export async function initApi(): Promise<void> {
  await initApiBaseUrl()
  setBaseUrl(getApiBaseUrl())

  const [storedToken, storedRefresh, storedExpiresIn] = await Promise.all([
    platform.storage.localGet<string>(TOKEN_STORAGE_KEY),
    platform.storage.localGet<string>(REFRESH_TOKEN_STORAGE_KEY),
    platform.storage.localGet<number>(EXPIRES_IN_STORAGE_KEY),
  ])
  store.setCachedWithoutPersist({
    token: typeof storedToken === 'string' ? storedToken : null,
    refreshToken: typeof storedRefresh === 'string' ? storedRefresh : null,
    expiresIn: typeof storedExpiresIn === 'number' ? storedExpiresIn : null,
  })

  platform.storage.onStorageChanged('local', (changes) => {
    const updates: {
      token?: string | null
      refreshToken?: string | null
      expiresIn?: number | null
    } = {}
    if (changes[TOKEN_STORAGE_KEY]) {
      const newValue = changes[TOKEN_STORAGE_KEY].newValue
      updates.token = typeof newValue === 'string' ? newValue : null
    }
    if (changes[REFRESH_TOKEN_STORAGE_KEY]) {
      const newValue = changes[REFRESH_TOKEN_STORAGE_KEY].newValue
      updates.refreshToken = typeof newValue === 'string' ? newValue : null
    }
    if (changes[EXPIRES_IN_STORAGE_KEY]) {
      const newValue = changes[EXPIRES_IN_STORAGE_KEY].newValue
      updates.expiresIn = typeof newValue === 'number' ? newValue : null
    }
    store.setCachedWithoutPersist(updates)
  })

  // 此前本端只绑 store、不绑续期出口 ⇒ api-client 的 refreshAccessTokenOnce() 直接返回 null,
  // 任何 401 都不重试也不通知(与 web/RN 不同)。接回端内既有的 doRefresh(自带 in-flight 去重)。
  bindTokenStoreToApiClient(tokenStore, { refreshAccessToken: refreshViaExtensionStore })
  setUnauthorizedHandler(onUnrecoverableUnauthorized)
  setDeviceFingerprintProvider(extensionDeviceFingerprintCollector)
}

export async function setToken(token: string | null): Promise<void> {
  await store.setToken(token)
}

/** 单独设置 refresh token(写存储 + 更新缓存),与 setToken 解耦 */
export async function setRefreshToken(token: string | null): Promise<void> {
  await store.setRefreshToken(token)
}

export function getToken(): string | null {
  return store.getToken()
}

export function clearToken(): void {
  store.setCachedWithoutPersist({ token: null })
}

export async function setTokenPair(pair: TokenPair): Promise<void> {
  // 原子更新缓存 + 并行持久化(保留语义:expiresIn undefined 时不覆盖缓存也不写存储)
  store.setCachedWithoutPersist({
    token: pair.accessToken,
    refreshToken: pair.refreshToken ?? null,
    ...(pair.expiresIn !== undefined ? { expiresIn: pair.expiresIn } : {}),
  })
  await Promise.all([
    platform.storage.localSet(TOKEN_STORAGE_KEY, pair.accessToken),
    platform.storage.localSet(REFRESH_TOKEN_STORAGE_KEY, pair.refreshToken),
    ...(pair.expiresIn !== undefined
      ? [platform.storage.localSet(EXPIRES_IN_STORAGE_KEY, pair.expiresIn)]
      : []),
  ])
}

export function getRefreshToken(): string | null {
  return store.getRefreshToken()
}

export function getExpiresIn(): number | null {
  return store.getExpiresIn()
}

export async function clearAllTokens(): Promise<void> {
  await store.clearAll()
  const { stopAutoRefresh } = await import('./token-utils')
  stopAutoRefresh()
}

/**
 * TokenStore 契约接入(类型层验证 + 跨端统一调用入口)
 *
 * 编译时验证本端 token 管理实现符合 @ihui/shared/auth TokenStore 接口,
 * 为后续跨端统一调用提供类型安全网。各调用方仍可直接用具体函数,
 * 此对象供后续重构或新代码通过 TokenStore 接口调用使用。
 *
 * clearAll 覆盖为 clearAllTokens(额外触发 stopAutoRefresh,保留原行为);
 * 新增 getExpiresIn / setExpiresIn 通过对象扩展暴露给契约调用方。
 */
export const tokenStore: TokenStore = {
  getToken,
  getRefreshToken,
  setToken,
  setRefreshToken,
  clearAll: clearAllTokens,
  getExpiresIn,
  setExpiresIn: (expiresIn: number | null) => store.setExpiresIn(expiresIn),
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
