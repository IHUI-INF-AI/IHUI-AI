import { describe, it, expect, beforeEach, vi } from 'vitest'

const { apiClientMocks, sharedMocks } = vi.hoisted(() => ({
  apiClientMocks: {
    setBaseUrl: vi.fn(),
  },
  sharedMocks: {
    bindTokenStoreToApiClient: vi.fn(),
  },
}))

vi.mock('@ihui/api-client', () => ({
  setBaseUrl: apiClientMocks.setBaseUrl,
}))

vi.mock('@ihui/shared/auth', () => ({
  bindTokenStoreToApiClient: sharedMocks.bindTokenStoreToApiClient,
}))

import {
  initApi,
  getToken,
  getRefreshToken,
  setToken,
  setRefreshToken,
  clearToken,
} from '../src/lib/token'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { resetAsyncStorageMock } from './__mocks__/async-storage'

describe('lib/token', () => {
  beforeEach(() => {
    resetAsyncStorageMock()
    apiClientMocks.setBaseUrl.mockClear()
    sharedMocks.bindTokenStoreToApiClient.mockClear()
  })

  it('initApi 调用 setBaseUrl 设置 API_BASE_URL', async () => {
    await initApi()
    expect(apiClientMocks.setBaseUrl).toHaveBeenCalledWith('http://localhost:8801')
  })

  it('initApi 调用 bindTokenStoreToApiClient 注册 token 提供器', async () => {
    await initApi()
    expect(sharedMocks.bindTokenStoreToApiClient).toHaveBeenCalledTimes(1)
    const store = sharedMocks.bindTokenStoreToApiClient.mock.calls[0]![0]! as {
      getToken: () => string | null
    }
    expect(typeof store.getToken).toBe('function')
  })

  it('initApi 从 AsyncStorage 读取已存在的 token 并缓存', async () => {
    await AsyncStorage.setItem('ihui_token', 'stored-access')
    await AsyncStorage.setItem('ihui_refresh_token', 'stored-refresh')
    await initApi()
    expect(getToken()).toBe('stored-access')
    expect(getRefreshToken()).toBe('stored-refresh')
  })

  it('initApi 在无 token 时缓存返回 null', async () => {
    await initApi()
    expect(getToken()).toBeNull()
    expect(getRefreshToken()).toBeNull()
  })

  it('initApi 注册的 tokenStore.getToken 返回当前缓存 token', async () => {
    await AsyncStorage.setItem('ihui_token', 'abc123')
    await initApi()
    const store = sharedMocks.bindTokenStoreToApiClient.mock.calls[0]![0]! as {
      getToken: () => string | null
    }
    expect(store.getToken()).toBe('abc123')
  })

  it('setToken 写入缓存和 AsyncStorage', async () => {
    await setToken('new-token')
    expect(getToken()).toBe('new-token')
    expect(await AsyncStorage.getItem('ihui_token')).toBe('new-token')
  })

  it('setToken(null) 从缓存和 AsyncStorage 移除', async () => {
    await setToken('temp')
    await setToken(null)
    expect(getToken()).toBeNull()
    expect(await AsyncStorage.getItem('ihui_token')).toBeNull()
  })

  it('setRefreshToken 写入缓存和 AsyncStorage', async () => {
    await setRefreshToken('rft')
    expect(getRefreshToken()).toBe('rft')
    expect(await AsyncStorage.getItem('ihui_refresh_token')).toBe('rft')
  })

  it('clearToken 清除所有缓存和 AsyncStorage', async () => {
    await setToken('t1')
    await setRefreshToken('r1')
    await clearToken()
    expect(getToken()).toBeNull()
    expect(getRefreshToken()).toBeNull()
    expect(await AsyncStorage.getItem('ihui_token')).toBeNull()
    expect(await AsyncStorage.getItem('ihui_refresh_token')).toBeNull()
  })

  it('clearToken 在无 token 时也安全调用', async () => {
    await expect(clearToken()).resolves.not.toThrow()
    expect(getToken()).toBeNull()
  })
})
