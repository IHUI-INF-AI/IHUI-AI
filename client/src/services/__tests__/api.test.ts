// services/api.ts 单元测试
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/utils/request', () => ({
  default: { get: vi.fn(() => Promise.resolve({ data: { code: 200, data: { rows: [], total: 0 } } })) },
}))

vi.mock('@/config/backend-paths', () => ({
  COZE_PATHS: { index: { resources: (t: string) => `/coze/index/${t}` } },
  COZE_PREFIX: '/coze',
  LOGIN_PWD_PATHS: { refreshToken: '/auth/login/pwd/refresh' },
}))

vi.mock('@/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

vi.mock('@/utils/storage', () => ({
  StorageManager: {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
  STORAGE_KEYS: { USER_DATA: 'u', USER_TOKEN: 'ut', REFRESH_TOKEN: 'rt', TOKEN: 't' },
  TokenStorage: { getToken: vi.fn(() => 'test-token'), setToken: vi.fn(), getRefreshToken: vi.fn(() => null) },
}))

vi.mock('@/config/error-codes', () => ({
  isTokenExpired: vi.fn(() => false),
}))

import { StorageManager } from '@/utils/storage'
import { isTokenExpired } from '@/config/error-codes'
import {
  getStoredData,
  request,
  getUserInfo,
  getUserList,
  login,
  phoneLogin,
  sendSmsCode,
  register,
  getXuqiuList,
  category,
  addXuqiuModel,
  getXuqiuInfoById,
  getAgentList,
  getHomePageResources,
  GUEST_AGENT_LIST_FALLBACK,
} from '../api'

describe('services/api', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // 默认 mock fetch 成功
    ;(globalThis as Record<string, unknown>).fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ code: 200, data: { rows: [], total: 0 } }),
      })
    )
  })

  it('getStoredData 默认返回空对象', () => {
    // 源码已改为不使用 mock 假数据，无存储时返回 {}
    const r = getStoredData()
    expect(r).toEqual({})
  })

  it('getStoredData 解析失败清理', () => {
    ;(StorageManager.getItem as unknown as ReturnType<typeof vi.fn>)
      .mockImplementationOnce(() => { throw new Error('parse fail') })
    const r = getStoredData()
    // 解析失败后应返回空对象，且 removeItem 被调用清理
    expect(r).toEqual({})
    expect(StorageManager.removeItem).toHaveBeenCalled()
  })

  it('getStoredData 解析失败清理失败', () => {
    ;(StorageManager.getItem as unknown as ReturnType<typeof vi.fn>)
      .mockImplementationOnce(() => { throw new Error('parse fail') })
    ;(StorageManager.removeItem as unknown as ReturnType<typeof vi.fn>).mockImplementationOnce(() => { throw new Error('clean fail') })
    const r = getStoredData()
    // 即使清理失败也应返回空对象，不抛异常
    expect(r).toEqual({})
  })

  it('request GET 正常', async () => {
    const r = await request({ url: '/test', method: 'GET' })
    expect(r).toBeDefined()
  })

  it('request POST 正常', async () => {
    const r = await request({ url: '/test', method: 'POST', data: { a: 1 } })
    expect(r).toBeDefined()
  })

  it('request 带 headers', async () => {
    const r = await request({ url: '/test', headers: { 'X-Custom': 'v' } })
    expect(r).toBeDefined()
  })

  it('request base=2/3/4', async () => {
    await request({ url: '/test', base: 2 })
    await request({ url: '/test', base: 3 })
    await request({ url: '/test', base: 4 })
  })

  it('request /users/ HTTP 错误返回 mock', async () => {
    ;(globalThis as Record<string, unknown>).fetch = vi.fn(() => Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}) }))
    const r = await request({ url: '/auth/users/list' })
    expect(r.code).toBe(200)
  })

  it('request /users/ 网络错误返回 mock', async () => {
    ;(globalThis as Record<string, unknown>).fetch = vi.fn(() => Promise.reject(new Error('net')))
    const r = await request({ url: '/auth/users/list' })
    expect(r.code).toBe(200)
  })

  it('request token 过期刷新重试', async () => {
    ;(isTokenExpired as unknown as ReturnType<typeof vi.fn>).mockReturnValue(true)
    ;(globalThis as Record<string, unknown>).fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ code: 401, data: {} }),
      })
    )
    // 第二次 fetch 走 refresh
    let i = 0
    ;(globalThis as Record<string, unknown>).fetch = vi.fn(() => {
      i++
      if (i === 1) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ code: 401, data: {} }),
        })
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ code: 200, data: { ok: true } }),
      })
    })
    try { await request({ url: '/test' }) } catch (e) {}
  })

  it('getUserInfo', async () => {
    const r = await getUserInfo('uuid')
    expect(r).toBeDefined()
  })

  it('getUserList', async () => {
    const r = await getUserList({})
    expect(r).toBeDefined()
  })

  it('getUserList 不带 data', async () => {
    const r = await getUserList()
    expect(r).toBeDefined()
  })

  it('login', async () => {
    const r = await login({ username: 'u', password: 'p' })
    expect(r).toBeDefined()
  })

  it('phoneLogin', async () => {
    const r = await phoneLogin({ phone: '138', code: '1' })
    expect(r).toBeDefined()
  })

  it('sendSmsCode', async () => {
    const r = await sendSmsCode('138')
    expect(r).toBeDefined()
  })

  it('register', async () => {
    const r = await register({ username: 'u', password: 'p', email: 'a@b.com' })
    expect(r).toBeDefined()
  })

  it('getXuqiuList 各种参数', async () => {
    await getXuqiuList({ pageNum: 1, pageSize: 10 })
    await getXuqiuList({ status: 1, search: 's' })
    await getXuqiuList({ creator: 'c' })
    await getXuqiuList({ types: ['t'] })
    await getXuqiuList({ categorys: ['c'] })
    await getXuqiuList({})
  })

  it('category', async () => {
    const r = await category('1')
    expect(r).toBeDefined()
  })

  it('category 默认参数', async () => {
    const r = await category()
    expect(r).toBeDefined()
  })

  it('addXuqiuModel', async () => {
    const r = await addXuqiuModel({ name: 'a' })
    expect(r).toBeDefined()
  })

  it('getXuqiuInfoById', async () => {
    const r = await getXuqiuInfoById('1')
    expect(r).toBeDefined()
  })

  it('getAgentList 禁用环境返回空', async () => {
    const r = await getAgentList({})
    expect(r.rows).toEqual([])
  })

  it('GUEST_AGENT_LIST_FALLBACK', () => {
    expect(GUEST_AGENT_LIST_FALLBACK.rows.length).toBe(2)
  })

  it('getHomePageResources', async () => {
    const r = await getHomePageResources(1)
    expect(r).toBeDefined()
  })
})
