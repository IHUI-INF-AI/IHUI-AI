// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, beforeEach, vi } from 'vitest'

const { apiClientMocks, sharedMocks } = vi.hoisted(() => ({
  apiClientMocks: {
    setBaseUrl: vi.fn(),
    setUserAgent: vi.fn(),
    // 2026-10-26:端内自持凭据直连的那几条腿(RN 的 STT 上传 / 图片头)要靠这一个出口续期;
    // 判据本体在 lib/token,所以这里必须给它一个可编排的替身,而不是让 lib/token 去摸真网络。
    refreshAccessTokenOnce: vi.fn(),
    fetchApi: vi.fn(),
  },
  sharedMocks: {
    bindTokenStoreToApiClient: vi.fn(),
  },
}))

vi.mock('@ihui/api-client', () => ({
  setBaseUrl: apiClientMocks.setBaseUrl,
  setUserAgent: apiClientMocks.setUserAgent,
  setDeviceFingerprintProvider: vi.fn(),
  refreshAccessTokenOnce: apiClientMocks.refreshAccessTokenOnce,
  fetchApi: apiClientMocks.fetchApi,
  TransientRefreshError: class TransientRefreshError extends Error {},
}))

vi.mock('@ihui/shared/auth', () => {
  const createMockStore = (config?: {
    onSetToken?: (t: string | null) => Promise<void>
    onSetRefreshToken?: (t: string | null) => Promise<void>
    onClearAll?: () => Promise<void>
  }) => {
    let _token: string | null = null
    let _refreshToken: string | null = null
    return {
      getToken: () => _token,
      getRefreshToken: () => _refreshToken,
      setToken: async (t: string | null) => {
        _token = t
        await config?.onSetToken?.(t)
      },
      setRefreshToken: async (t: string | null) => {
        _refreshToken = t
        await config?.onSetRefreshToken?.(t)
      },
      clearAll: async () => {
        _token = null
        _refreshToken = null
        await config?.onClearAll?.()
      },
      setCachedWithoutPersist: (vals: { token?: string | null; refreshToken?: string | null }) => {
        if (vals.token !== undefined) _token = vals.token
        if (vals.refreshToken !== undefined) _refreshToken = vals.refreshToken
      },
      getExpiresIn: () => null,
      setExpiresIn: async () => {},
    }
  }
  return {
    bindTokenStoreToApiClient: sharedMocks.bindTokenStoreToApiClient,
    createInMemoryTokenStore: vi.fn((config?: Parameters<typeof createMockStore>[0]) =>
      createMockStore(config),
    ),
  }
})

import {
  initApi,
  getToken,
  getRefreshToken,
  setToken,
  setRefreshToken,
  clearToken,
  ensureFreshToken,
  runWithFreshToken,
  isCredentialRejected,
} from '../src/lib/token'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { getItem, resetAsyncStorageMock } from './__mocks__/async-storage'
import { _resetSecureStoreBackendForTest } from '../src/lib/auth/secure-store'
import { REFRESH_TOKEN_STALE_ERROR_CODE } from '@ihui/shared/auth/auto-login-policy'

describe('lib/token', () => {
  beforeEach(() => {
    resetAsyncStorageMock()
    _resetSecureStoreBackendForTest()
    apiClientMocks.setBaseUrl.mockClear()
    apiClientMocks.setUserAgent.mockClear()
    sharedMocks.bindTokenStoreToApiClient.mockClear()
  })

  it('initApi 调用 setBaseUrl 设置 API_BASE_URL', async () => {
    await initApi()
    expect(apiClientMocks.setBaseUrl).toHaveBeenCalledWith('http://localhost:8802')
  })

  // 首方 UA:RN 的 fetch 由 okhttp 实现,而后端 bot-detection 把 'okhttp' 列为
  // curl-like。不显式声明 UA,App 的每个请求都会被当成爬虫(429 要求无法完成的
  // CAPTCHA + 每请求拉低出口 IP 信誉)。这里钉住"发出去的不是 okhttp 默认串"。
  it('initApi 注入首方 User-Agent,且不含 okhttp / 空串', async () => {
    await initApi()
    expect(apiClientMocks.setUserAgent).toHaveBeenCalledTimes(1)
    const ua = apiClientMocks.setUserAgent.mock.calls[0]![0] as string
    expect(ua.length).toBeGreaterThanOrEqual(10)
    expect(ua).toMatch(/^IHUIAI-App\/\d+\.\d+\.\d+ /)
    expect(ua.toLowerCase()).not.toContain('okhttp')
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

/** 造一枚只带 exp 的假 JWT(readExp 只解 payload 段,不验签) */
function jwtWithExp(expSeconds: number): string {
  const b64url = (s: string): string =>
    typeof globalThis.btoa === 'function'
      ? globalThis.btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
      : Buffer.from(s, 'utf8').toString('base64url')
  return `header.${b64url(JSON.stringify({ exp: expSeconds }))}.sig`
}

const FRESH = () => jwtWithExp(Math.floor(Date.now() / 1000) + 60 * 60)
const NEAR_EXPIRY = () => jwtWithExp(Math.floor(Date.now() / 1000) + 60)

/**
 * 2026-10-26 审计第 4 条(P1):initApi 原先无 try/catch,而 `AuthContext` 那条
 * `initApi().then(() => setReady(true))` 也没有 catch —— Keychain/Keystore 读失败
 * 就是一次 unhandled rejection + 永远停在启动页。
 */
describe('lib/token — initApi 的存储失效兜底(绝不卡启动页、绝不动凭据)', () => {
  beforeEach(() => {
    resetAsyncStorageMock()
    _resetSecureStoreBackendForTest()
    apiClientMocks.setBaseUrl.mockClear()
    apiClientMocks.setUserAgent.mockClear()
    apiClientMocks.refreshAccessTokenOnce.mockReset()
    sharedMocks.bindTokenStoreToApiClient.mockClear()
  })

  it('凭据存储读不出时 initApi 仍然 resolve(不抛 = 不卡启动页)', async () => {
    getItem.mockRejectedValueOnce(new Error('Keychain errSecAuthFailed')).mockRejectedValueOnce(
      new Error('Keychain errSecAuthFailed'),
    )
    await expect(initApi()).resolves.toBeUndefined()
    // 按「无凭据」分支继续:内存缓存是空,而不是残留别人的旧值
    expect(getToken()).toBeNull()
    expect(getRefreshToken()).toBeNull()
  })

  it('读失败必须被喊出来(console.error 点名原因),不静默降级', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    getItem.mockRejectedValueOnce(new Error('Keychain unavailable')).mockRejectedValueOnce(
      new Error('Keychain unavailable'),
    )
    await initApi()
    const line = err.mock.calls.map((c) => String(c[0])).join('\n')
    expect(line).toContain('credential storage is unreadable')
    expect(line).toContain('Keychain unavailable')
    err.mockRestore()
  })

  it('读失败不销毁盘上凭据:initApi 的兜底分支零写盘(红线)', async () => {
    resetAsyncStorageMock()
    _resetSecureStoreBackendForTest()
    const removeSpy = vi.spyOn(AsyncStorage, 'removeItem')
    const setSpy = vi.spyOn(AsyncStorage, 'setItem')
    await AsyncStorage.setItem('ihui_token', 'still-on-disk')
    // 记账从"本轮动作"开始数:上面那笔是我造的盘上现场,不是 initApi 写的
    removeSpy.mockClear()
    setSpy.mockClear()
    getItem.mockRejectedValueOnce(new Error('read boom')).mockRejectedValueOnce(
      new Error('read boom'),
    )
    await initApi()
    // 读不出 ≠ 凭据失效:兜底只改内存,不代用户删任何东西(删了就把 30 天 refresh 一起废掉)
    expect(removeSpy).not.toHaveBeenCalled()
    expect(setSpy).not.toHaveBeenCalled()
    removeSpy.mockRestore()
    setSpy.mockRestore()
  })

  it('绑定段抛错同样不许把启动卡死(resolve + 喊出来)', async () => {
    sharedMocks.bindTokenStoreToApiClient.mockImplementationOnce(() => {
      throw new Error('binding boom')
    })
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(initApi()).resolves.toBeUndefined()
    expect(
      err.mock.calls.map((c) => String(c[0])).join('\n'),
    ).toContain('api-client binding failed')
    err.mockRestore()
  })
})

/**
 * 2026-10-26 审计第 2/3 条的判据本体:端内「自己拿 token 直连」的腿(RN 的 STT 上传、
 * 二维码 <Image headers>、WS 建连)绕过 api-client 的 401 重放,过期即永久坏。
 * 兜带三条出口都在这里测 —— 调用点只测"走没走兜带"。
 */
describe('lib/token — ensureFreshToken(剩余 ≤5 分钟先续期,失败也不清凭据)', () => {
  beforeEach(() => {
    resetAsyncStorageMock()
    _resetSecureStoreBackendForTest()
    apiClientMocks.refreshAccessTokenOnce.mockReset()
    sharedMocks.bindTokenStoreToApiClient.mockClear()
  })

  it('没有凭据 ⇒ null,且一次都不刷', async () => {
    await setToken(null)
    await expect(ensureFreshToken()).resolves.toBeNull()
    expect(apiClientMocks.refreshAccessTokenOnce).not.toHaveBeenCalled()
  })

  it('凭据还有 1 小时 ⇒ 原样返回,不打 /auth/refresh(不许变成"每次都问一遍")', async () => {
    const t = FRESH()
    await setToken(t)
    await expect(ensureFreshToken()).resolves.toBe(t)
    expect(apiClientMocks.refreshAccessTokenOnce).not.toHaveBeenCalled()
  })

  it('剩余 1 分钟 ⇒ 续期一次并给出新票', async () => {
    await setToken(NEAR_EXPIRY())
    const rotated = FRESH()
    apiClientMocks.refreshAccessTokenOnce.mockResolvedValue(rotated)
    await expect(ensureFreshToken()).resolves.toBe(rotated)
    expect(apiClientMocks.refreshAccessTokenOnce).toHaveBeenCalledTimes(1)
  })

  it('续期返回 null(被拒/瞬时/冷却)⇒ 仍交回当前那张票,且盘上凭据一条不少(红线)', async () => {
    const stale = NEAR_EXPIRY()
    resetAsyncStorageMock()
    await setToken(stale)
    _resetSecureStoreBackendForTest()
    const removeSpy = vi.spyOn(AsyncStorage, 'removeItem')
    removeSpy.mockClear() // 上面 setToken 自己那笔擦标记的动作不算在本轮
    apiClientMocks.refreshAccessTokenOnce.mockResolvedValue(null)
    await expect(ensureFreshToken()).resolves.toBe(stale)
    expect(removeSpy).not.toHaveBeenCalled()
    removeSpy.mockRestore()
  })

  it('续期抛错 ⇒ 喊出来 + 交回当前票,不外溢给调用方', async () => {
    const stale = NEAR_EXPIRY()
    await setToken(stale)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    apiClientMocks.refreshAccessTokenOnce.mockRejectedValue(new Error('offline'))
    await expect(ensureFreshToken()).resolves.toBe(stale)
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })
})

describe('lib/token — runWithFreshToken(401 只重试一次)与 isCredentialRejected', () => {
  beforeEach(() => {
    resetAsyncStorageMock()
    _resetSecureStoreBackendForTest()
    apiClientMocks.refreshAccessTokenOnce.mockReset()
  })

  it('一发成功 ⇒ 只调用一次 run,不刷凭据', async () => {
    await setToken(FRESH())
    const run = vi.fn(async (token: string | null) => `ok:${token}`)
    await expect(runWithFreshToken(run)).resolves.toMatch(/^ok:/)
    expect(run).toHaveBeenCalledTimes(1)
    expect(apiClientMocks.refreshAccessTokenOnce).not.toHaveBeenCalled()
  })

  it('第一发 401 ⇒ 续期后重试一次,第二发成功就返回成功', async () => {
    await setToken(FRESH())
    const rotated = jwtWithExp(Math.floor(Date.now() / 1000) + 7200)
    apiClientMocks.refreshAccessTokenOnce.mockResolvedValue(rotated)
    const seen: Array<string | null> = []
    const run = vi.fn(async (token: string | null) => {
      seen.push(token)
      if (seen.length === 1) throw Object.assign(new Error('401'), { status: 401 })
      return 'second-wins'
    })
    await expect(runWithFreshToken(run)).resolves.toBe('second-wins')
    expect(run).toHaveBeenCalledTimes(2)
    expect(seen[1]).toBe(rotated)
    expect(apiClientMocks.refreshAccessTokenOnce).toHaveBeenCalledTimes(1)
  })

  it('重试仍 401 ⇒ 原样抛出(不静默成功),且总共只有两发', async () => {
    await setToken(FRESH())
    apiClientMocks.refreshAccessTokenOnce.mockResolvedValue(null)
    const run = vi.fn(async () => {
      throw Object.assign(new Error('401 again'), { status: 401 })
    })
    await expect(runWithFreshToken(run)).rejects.toThrow('401 again')
    expect(run).toHaveBeenCalledTimes(2)
  })

  it('网络失败/5xx(不是凭据问题)⇒ 一发都不重试,也不去刷 /auth/refresh', async () => {
    await setToken(FRESH())
    const run = vi.fn(async () => {
      throw new Error('fetch failed')
    })
    await expect(runWithFreshToken(run)).rejects.toThrow('fetch failed')
    expect(run).toHaveBeenCalledTimes(1)
    expect(apiClientMocks.refreshAccessTokenOnce).not.toHaveBeenCalled()

    const run500 = vi.fn(async () => {
      throw Object.assign(new Error('server'), { status: 500 })
    })
    await expect(runWithFreshToken(run500)).rejects.toThrow('server')
    expect(run500).toHaveBeenCalledTimes(1)
  })

  it('isCredentialRejected 只认共享层那把尺:401/403 ⇒ true,REFRESH_TOKEN_STALE 虽带 401 仍算瞬时', () => {
    expect(isCredentialRejected(Object.assign(new Error('x'), { status: 401 }))).toBe(true)
    expect(isCredentialRejected(Object.assign(new Error('x'), { statusCode: 403 }))).toBe(true)
    expect(
      isCredentialRejected(
        Object.assign(new Error('x'), { status: 401, errorCode: REFRESH_TOKEN_STALE_ERROR_CODE }),
      ),
    ).toBe(false)
    expect(isCredentialRejected(new Error('offline'))).toBe(false)
    expect(isCredentialRejected(undefined)).toBe(false)
    expect(isCredentialRejected('not-an-error')).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
