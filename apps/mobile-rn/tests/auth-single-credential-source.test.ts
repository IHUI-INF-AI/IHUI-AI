// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 凭据单一数据源回归(真机 VC52 定案的根治票)
//
// 立票事实:401 出口调用 logoutAuth() 后界面不翻、冷重启仍落回已登录分支,logcat
// 全程无错。本文件第 1 条用例把那格坏状态在**真实实现**上复现出来:自动续期的响应
// 晚于登出落地,把新 token 原样写回唯一凭据存储 —— 每一步 await 都成功,所以没有任何
// 错误可报。修复(lib/token.ts 的会话代次 + 写入串行化)必须让这条变绿;第 2、3 条
// 钉住修复不得把正当链路改坏(登录能持久、登出后冷启动确实为空)。
//
// 取材纪律:@ihui/shared/auth 与 @ihui/shared/stores 在本端 vitest 配置里**都已直指真实工厂**
// (auth 由 G-364 收口,stores 由票#20 收口),所以本文件不再需要"绕开别名去 import 真实
// token-store"的替身段 —— 替身的 hydrate/持久化语义与真实工厂并不逐字同形(替身 hydrate 对
// null 是"跳过",真实工厂是"覆盖"),而这份缺陷必须跑真实工厂才复现得出来,否则测的是 mock。
// 本文件仍留着一组 @ihui/shared/stores 的覆盖,那是别名指真之后不再改变语义的冗余段,
// 归属票#20 那一族清(不在本票射程,故只点名不顺手删)。
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { apiClient, capturedProvider } = vi.hoisted(() => {
  type Provider = {
    getToken: () => string | null
    refreshAccessToken?: () => Promise<string | null>
  } | null
  const capturedProvider: { value: Provider } = { value: null }
  return {
    capturedProvider,
    apiClient: {
      setBaseUrl: vi.fn(),
      setUserAgent: vi.fn(),
      setDeviceFingerprintProvider: vi.fn(),
      setTokenProvider: vi.fn((p: Provider) => {
        capturedProvider.value = p
      }),
      fetchApi: vi.fn(),
      loginByAccount: vi.fn(),
      logout: vi.fn(),
    },
  }
})

vi.mock('@ihui/api-client', () => apiClient)
vi.mock('@ihui/shared/stores', async () => {
  const real = await import('../../../packages/shared/src/stores/auth-store')
  return { createAuthStore: real.createAuthStore }
})

import AsyncStorage from '@react-native-async-storage/async-storage'
import storageMock, { resetAsyncStorageMock } from './__mocks__/async-storage'
import { _resetSecureStoreBackendForTest } from '../src/lib/auth/secure-store'
import { initApi, getToken, getRefreshToken, clearToken } from '../src/lib/token'
import { rnAuthStore, logoutAuth, hydrateAuth } from '../src/stores/auth-store'

const USER = { id: 'u1', nickname: 'tester', avatar: '' } as const
const PERSIST_KEY = 'ihui-auth-user'
const TOKEN_KEY = 'ihui_token'
const REFRESH_KEY = 'ihui_refresh_token'

interface PersistedAuthSnapshot {
  state?: { isAuthenticated?: unknown; user?: unknown }
}

function persistedSnapshot(): PersistedAuthSnapshot | null {
  const raw = storageMock.__store.get(PERSIST_KEY)
  return raw ? (JSON.parse(raw) as PersistedAuthSnapshot) : null
}

describe('RN 凭据单一数据源', () => {
  beforeEach(async () => {
    resetAsyncStorageMock()
    _resetSecureStoreBackendForTest()
    vi.clearAllMocks()
    // 真实模块的单例内存缓存跨用例存活,显式清回空态(与 setup.ts 的存储重置配对)
    await clearToken()
    resetAsyncStorageMock()
  })

  it('登出后晚到的续期响应不得把凭据写回唯一存储', async () => {
    await initApi()
    await rnAuthStore.getState().setAuth({ token: 'T', refreshToken: 'R', user: USER })
    expect(getToken()).toBe('T')

    // 模拟 401 拦截器已发起、响应尚未落地的自动续期(出口由 api-client 经 provider 调它)
    const refresh = capturedProvider.value?.refreshAccessToken
    expect(typeof refresh).toBe('function')
    let resolveRefresh: (v: unknown) => void = () => {}
    apiClient.fetchApi.mockImplementation(
      () =>
        new Promise((r) => {
          resolveRefresh = r as (v: unknown) => void
        }),
    )
    const inflight = refresh!()

    // 会话失效出口在续期落地前完成登出
    await logoutAuth()
    expect(getToken()).toBeNull()

    // 续期响应此刻才到达 —— 它属于已结束的那一轮,不得复活任何一份凭据
    resolveRefresh({ success: true, data: { accessToken: 'T2', refreshToken: 'R2' } })
    await expect(inflight).resolves.toBeNull()
    hydrateAuth()

    expect(getToken()).toBeNull()
    expect(getRefreshToken()).toBeNull()
    expect(rnAuthStore.getState().token).toBeNull()
    expect(rnAuthStore.getState().isAuthenticated).toBe(false)
    // 持久化快照也不得停留在"已登录"态(那是第二个"有没有登录态"的数据源)
    expect(persistedSnapshot()?.state?.isAuthenticated).toBe(false)
  })

  it('登录成功 → 冷启动 hydrate → token 仍在', async () => {
    await initApi()
    await rnAuthStore.getState().setAuth({ token: 'T', refreshToken: 'R', user: USER })
    // 取回上一进程落盘的凭据,清空运行态后按"冷启动"路径重新装载
    const storedToken = storageMock.__store.get(TOKEN_KEY)
    const storedRefresh = storageMock.__store.get(REFRESH_KEY)
    expect(storedToken).toBe('T')
    await clearToken()
    resetAsyncStorageMock()
    if (storedToken) await AsyncStorage.setItem(TOKEN_KEY, storedToken)
    if (storedRefresh) await AsyncStorage.setItem(REFRESH_KEY, storedRefresh)

    await initApi()
    hydrateAuth()
    expect(getToken()).toBe('T')
    expect(rnAuthStore.getState().token).toBe('T')
    expect(rnAuthStore.getState().isAuthenticated).toBe(true)
  })

  it('登出 → 冷启动 hydrate → token 为空且 isAuthenticated 为 false', async () => {
    await initApi()
    await rnAuthStore.getState().setAuth({ token: 'T', refreshToken: 'R', user: USER })
    await logoutAuth()

    // 冷启动:重读持久层并镜像进 store
    await initApi()
    hydrateAuth()
    expect(getToken()).toBeNull()
    expect(getRefreshToken()).toBeNull()
    expect(rnAuthStore.getState().token).toBeNull()
    expect(rnAuthStore.getState().isAuthenticated).toBe(false)
    expect(persistedSnapshot()?.state?.isAuthenticated).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
