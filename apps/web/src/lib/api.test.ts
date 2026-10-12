// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, beforeEach, vi } from 'vitest'
import type * as ApiClient from '@ihui/api-client'
import type * as Api from './api'

/**
 * fetchApi 401 懒触发策略契约测试。
 *
 * 锁定行为(2026-07-23 用户要求"刚进页面不弹出,只有需要登录的功能点击后才弹出"):
 * - GET 401 → 不弹窗(页面初始加载 / 查询不打断用户)
 * - POST/PUT/DELETE/PATCH 401 → 弹窗(用户主动操作才弹)
 * - 非 401(200 成功 / 500 等)→ 不弹窗
 *
 * 目的:固定行为契约,防止后续 agent 误改回"全 method 弹窗"。
 */

// vi.mock 工厂会被提升到文件顶部,早于任何 const 声明,因此用 vi.hoisted 创建稳定 spy,
// 供工厂与断言共享同一引用(即便 vi.resetModules 后工厂重跑,引用也不变)。
const mocks = vi.hoisted(() => ({
  fetchApiShared: vi.fn(),
  openLoginDialogOnce: vi.fn(),
  // 2026-10-09:捕获 api.ts setTokenProvider 注册的 provider —— refreshAccessToken
  // 是模块私有回调,只有这一条口能拿到它的引用去直调(分型用例的入口)。
  capturedProvider: null as unknown,
}))

vi.mock('@ihui/api-client', async () => {
  // 类型注解走文件顶部的 import type(被擦除,不触发 mock);importActual 仍取真实模块,
  // 保证 TransientRefreshError 与 api.ts 抛出的是同一个类对象。
  const actual = await vi.importActual<typeof ApiClient>('@ihui/api-client')
  return {
    fetchApi: mocks.fetchApiShared,
    setTokenProvider: vi.fn((p: unknown) => {
      mocks.capturedProvider = p
    }),
    setBaseUrl: vi.fn(),
    streamChat: vi.fn(),
    setStreamBaseUrl: vi.fn(),
    // 2026-10-12 补:69b7437f73 给 api.ts 加了 setAiServiceBase(桌面端 dev 签到页 404 根治),
    // 模块顶层无条件调用 —— mock 面缺这个导出会让本文件 12 例全数在模块求值期炸掉。
    setAiServiceBase: vi.fn(),
    setDeviceFingerprintProvider: vi.fn(),
    // 2026-09-25 接线:api.ts 无条件注册 401 处理器,mock 面必须补上同名导出,
    // 否则模块求值即抛 "No export is defined on the mock"。
    setUnauthorizedHandler: vi.fn(),
    // 2026-10-09 分型:必须给**真实**类 —— instanceof 断言要与 api.ts 抛出的同一个对象,
    // 替身类会让断言空转。
    TransientRefreshError: actual.TransientRefreshError,
  }
})

vi.mock('@/lib/login-dialog-trigger', () => ({
  openLoginDialogOnce: mocks.openLoginDialogOnce,
  isPublicPath: (p: string) => !p || !p.startsWith('/dashboard'),
}))

vi.mock('@/stores/login-dialog', () => ({
  // zustand store hook: getState() 返回 state,subscribe 是 store 顶层方法(api.ts 第 35 行直接调用)
  useLoginDialogStore: {
    getState: () => ({ open: mocks.openLoginDialogOnce }),
    // 返回 unsubscribe;不主动触发 listener,避免 api.ts 内 `const unsub = subscribe(cb)` 的 TDZ。
    // 防风暴 guard 由 vi.resetModules 逐测试重置,不影响单测试内断言。
    subscribe: vi.fn(() => () => {}),
  },
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: { getState: () => ({ token: null }) },
}))

// 固定 currentPath,验证 open('login', currentPath) 参数传递
const TEST_PATH = '/dashboard?tab=1'

describe('fetchApi 401 懒触发策略', () => {
  let fetchApi: typeof Api.fetchApi

  beforeEach(async () => {
    vi.clearAllMocks()
    window.history.replaceState({}, '', TEST_PATH)
    if (!fetchApi) {
      vi.resetModules()
      const mod = await import('./api')
      fetchApi = mod.fetchApi
    }
    mocks.fetchApiShared.mockResolvedValue({ success: true, data: null, status: 200 })
  }, 30000)

  it('GET 请求 401 → 不调用 open(懒触发:页面初始加载不打断)', async () => {
    mocks.fetchApiShared.mockResolvedValue({ success: false, status: 401, error: 'Unauthorized' })

    await fetchApi('/api/me', { method: 'GET' })

    expect(mocks.openLoginDialogOnce).not.toHaveBeenCalled()
  })

  it('POST 请求 401 → 调用 open("login", currentPath)', async () => {
    mocks.fetchApiShared.mockResolvedValue({ success: false, status: 401, error: 'Unauthorized' })

    await fetchApi('/api/install', { method: 'POST' })

    expect(mocks.openLoginDialogOnce).toHaveBeenCalledTimes(1)
    expect(mocks.openLoginDialogOnce).toHaveBeenCalledWith(TEST_PATH)
  })

  it('PUT 请求 401 → 调用 open', async () => {
    mocks.fetchApiShared.mockResolvedValue({ success: false, status: 401, error: 'Unauthorized' })

    await fetchApi('/api/profile', { method: 'PUT' })

    expect(mocks.openLoginDialogOnce).toHaveBeenCalledTimes(1)
    expect(mocks.openLoginDialogOnce).toHaveBeenCalledWith(TEST_PATH)
  })

  it('DELETE 请求 401 → 调用 open', async () => {
    mocks.fetchApiShared.mockResolvedValue({ success: false, status: 401, error: 'Unauthorized' })

    await fetchApi('/api/item/1', { method: 'DELETE' })

    expect(mocks.openLoginDialogOnce).toHaveBeenCalledTimes(1)
    expect(mocks.openLoginDialogOnce).toHaveBeenCalledWith(TEST_PATH)
  })

  it('PATCH 请求 401 → 调用 open', async () => {
    mocks.fetchApiShared.mockResolvedValue({ success: false, status: 401, error: 'Unauthorized' })

    await fetchApi('/api/item/1', { method: 'PATCH' })

    expect(mocks.openLoginDialogOnce).toHaveBeenCalledTimes(1)
    expect(mocks.openLoginDialogOnce).toHaveBeenCalledWith(TEST_PATH)
  })

  it('POST 请求 200 成功 → 不调用 open', async () => {
    mocks.fetchApiShared.mockResolvedValue({ success: true, data: { ok: 1 }, status: 200 })

    const r = await fetchApi('/api/install', { method: 'POST' })

    expect(mocks.openLoginDialogOnce).not.toHaveBeenCalled()
    expect(r.success).toBe(true)
  })

  it('POST 请求 500 → 不调用 open(非 401 不弹)', async () => {
    mocks.fetchApiShared.mockResolvedValue({ success: false, status: 500, error: 'Server Error' })

    await fetchApi('/api/install', { method: 'POST' })

    expect(mocks.openLoginDialogOnce).not.toHaveBeenCalled()
  })

  it('未传 method(默认 GET)401 → 不调用 open', async () => {
    mocks.fetchApiShared.mockResolvedValue({ success: false, status: 401, error: 'Unauthorized' })

    await fetchApi('/api/me')

    expect(mocks.openLoginDialogOnce).not.toHaveBeenCalled()
  })

  it('小写 method "post" 401 → 调用 open(api.ts 内 toUpperCase 归一化)', async () => {
    mocks.fetchApiShared.mockResolvedValue({ success: false, status: 401, error: 'Unauthorized' })

    await fetchApi('/api/install', { method: 'post' })

    expect(mocks.openLoginDialogOnce).toHaveBeenCalledTimes(1)
    expect(mocks.openLoginDialogOnce).toHaveBeenCalledWith(TEST_PATH)
  })
})

describe('refreshAccessToken 失败分型(2026-10-09 根治「自动登录总被清掉」)', () => {
  /**
   * 判据唯一出口 = classifyRefreshFailureStatus(shared 层):401/403=rejected,
   * 其余含无 status=transient。本组锁定端内接线:
   * - transient → 抛 TransientRefreshError(refreshAccessTokenOnce catch 住进冷却,
   *   且**不得**走到 setDesktopRefreshToken(null) —— 清桌面 vault 正是被根治的病灶);
   * - rejected → 返回 null(既有契约,凭据确实死了才允许清)。
   *
   * 取材:refreshAccessToken 是 setTokenProvider 注册的模块私有回调,经 mocks.capturedProvider
   * 捕获直调;'./api' 与 '@ihui/api-client' 都从同一模块注册表取,TransientRefreshError
   * 与 api.ts 抛出的是同一个类对象(若中途 resetModules 会换代,故本组不 reset)。
   */
  async function loadRefresh() {
    const mod = await import('./api')
    const apiClient = await import('@ihui/api-client')
    const provider = mocks.capturedProvider as {
      refreshAccessToken: () => Promise<string | null>
    } | null
    expect(provider, 'setTokenProvider 未捕获 provider ⇒ 判据失明').toBeTruthy()
    return {
      refresh: provider!.refreshAccessToken,
      getLastRefreshFailure: mod.getLastRefreshFailure,
      TransientRefreshError: apiClient.TransientRefreshError as new () => Error,
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('500 → 抛 TransientRefreshError,落账 transient', async () => {
    mocks.fetchApiShared.mockResolvedValue({ success: false, status: 500, error: 'Server Error' })
    const { refresh, getLastRefreshFailure, TransientRefreshError } = await loadRefresh()

    await expect(refresh()).rejects.toBeInstanceOf(TransientRefreshError)
    expect(getLastRefreshFailure()).toBe('transient')
  })

  it('无 status(网络错误/超时的 {success:false}) → 抛 TransientRefreshError', async () => {
    mocks.fetchApiShared.mockResolvedValue({ success: false, error: 'network down' })
    const { refresh, getLastRefreshFailure, TransientRefreshError } = await loadRefresh()

    await expect(refresh()).rejects.toBeInstanceOf(TransientRefreshError)
    expect(getLastRefreshFailure()).toBe('transient')
  })

  it('401 → 返回 null 不抛,落账 rejected', async () => {
    mocks.fetchApiShared.mockResolvedValue({ success: false, status: 401, error: 'Unauthorized' })
    const { refresh, getLastRefreshFailure } = await loadRefresh()

    await expect(refresh()).resolves.toBeNull()
    expect(getLastRefreshFailure()).toBe('rejected')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
