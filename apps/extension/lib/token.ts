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

  bindTokenStoreToApiClient(tokenStore