import { setBaseUrl } from '@ihui/api-client'
import { type TokenPair } from '@ihui/types'
import {
  bindTokenStoreToApiClient,
  createInMemoryTokenStore,
  type TokenStore,
} from '@ihui/shared/auth'
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

  bindTokenStoreToApiClient(tokenStore)
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
