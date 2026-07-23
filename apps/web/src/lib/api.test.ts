import { describe, it, expect, beforeEach, vi } from 'vitest'

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
  // api.ts 内的 fetchApiShared(@ihui/api-client.fetchApi)
  fetchApiShared: vi.fn(),
  // useLoginDialogStore.getState().open
  open: vi.fn(),
}))

vi.mock('@ihui/api-client', () => ({
  fetchApi: mocks.fetchApiShared,
  setTokenProvider: vi.fn(),
  setBaseUrl: vi.fn(),
  streamChat: vi.fn(),
}))

vi.mock('@/stores/login-dialog', () => ({
  // zustand store hook: getState() 返回 state,subscribe 是 store 顶层方法(api.ts 第 35 行直接调用)
  useLoginDialogStore: {
    getState: () => ({ open: mocks.open }),
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
  let fetchApi: typeof import('./api').fetchApi

  beforeEach(async () => {
    // resetModules 重建 api.ts 模块,重置模块级 loginDialogOpenGuard 防风暴标志
    vi.resetModules()
    vi.clearAllMocks()
    window.history.replaceState({}, '', TEST_PATH)
    const mod = await import('./api')
    fetchApi = mod.fetchApi
    // 默认返回成功,单测内按需覆盖
    mocks.fetchApiShared.mockResolvedValue({ success: true, data: null, status: 200 })
  })

  it('GET 请求 401 → 不调用 open(懒触发:页面初始加载不打断)', async () => {
    mocks.fetchApiShared.mockResolvedValue({ success: false, status: 401, error: 'Unauthorized' })

    await fetchApi('/api/me', { method: 'GET' })

    expect(mocks.open).not.toHaveBeenCalled()
  })

  it('POST 请求 401 → 调用 open("login", currentPath)', async () => {
    mocks.fetchApiShared.mockResolvedValue({ success: false, status: 401, error: 'Unauthorized' })

    await fetchApi('/api/install', { method: 'POST' })

    expect(mocks.open).toHaveBeenCalledTimes(1)
    expect(mocks.open).toHaveBeenCalledWith('login', TEST_PATH)
  })

  it('PUT 请求 401 → 调用 open', async () => {
    mocks.fetchApiShared.mockResolvedValue({ success: false, status: 401, error: 'Unauthorized' })

    await fetchApi('/api/profile', { method: 'PUT' })

    expect(mocks.open).toHaveBeenCalledTimes(1)
    expect(mocks.open).toHaveBeenCalledWith('login', TEST_PATH)
  })

  it('DELETE 请求 401 → 调用 open', async () => {
    mocks.fetchApiShared.mockResolvedValue({ success: false, status: 401, error: 'Unauthorized' })

    await fetchApi('/api/item/1', { method: 'DELETE' })

    expect(mocks.open).toHaveBeenCalledTimes(1)
    expect(mocks.open).toHaveBeenCalledWith('login', TEST_PATH)
  })

  it('PATCH 请求 401 → 调用 open', async () => {
    mocks.fetchApiShared.mockResolvedValue({ success: false, status: 401, error: 'Unauthorized' })

    await fetchApi('/api/item/1', { method: 'PATCH' })

    expect(mocks.open).toHaveBeenCalledTimes(1)
    expect(mocks.open).toHaveBeenCalledWith('login', TEST_PATH)
  })

  it('POST 请求 200 成功 → 不调用 open', async () => {
    mocks.fetchApiShared.mockResolvedValue({ success: true, data: { ok: 1 }, status: 200 })

    const r = await fetchApi('/api/install', { method: 'POST' })

    expect(mocks.open).not.toHaveBeenCalled()
    expect(r.success).toBe(true)
  })

  it('POST 请求 500 → 不调用 open(非 401 不弹)', async () => {
    mocks.fetchApiShared.mockResolvedValue({ success: false, status: 500, error: 'Server Error' })

    await fetchApi('/api/install', { method: 'POST' })

    expect(mocks.open).not.toHaveBeenCalled()
  })

  it('未传 method(默认 GET)401 → 不调用 open', async () => {
    mocks.fetchApiShared.mockResolvedValue({ success: false, status: 401, error: 'Unauthorized' })

    await fetchApi('/api/me')

    expect(mocks.open).not.toHaveBeenCalled()
  })

  it('小写 method "post" 401 → 调用 open(api.ts 内 toUpperCase 归一化)', async () => {
    mocks.fetchApiShared.mockResolvedValue({ success: false, status: 401, error: 'Unauthorized' })

    await fetchApi('/api/install', { method: 'post' })

    expect(mocks.open).toHaveBeenCalledTimes(1)
    expect(mocks.open).toHaveBeenCalledWith('login', TEST_PATH)
  })
})
