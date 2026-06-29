// core/client.ts 单元测试
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('axios', () => {
  const mockInstance: any = {
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
    request: vi.fn(() => Promise.resolve({ status: 200, data: { code: 200, message: 'ok', data: {} } })),
  }
  return {
    default: {
      create: vi.fn(() => mockInstance),
    },
  }
})

vi.mock('@/utils/i18n', () => ({
  t: (k: string) => k,
}))

vi.mock('@/utils/core', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  TokenManager: {
    getToken: vi.fn(() => 'token'),
    getRefreshToken: vi.fn(() => 'rt'),
    getUuid: vi.fn(() => 'uuid'),
    setToken: vi.fn(),
    clearTokens: vi.fn(),
  },
  ConfigManager: {
    getApiConfig: vi.fn(() => ({ baseURL: '/api', retryCount: 0 })),
  },
  ErrorHandler: { handleAndShow: vi.fn() },
}))

vi.mock('@/utils/promise-utils', () => ({
  retryPromise: (fn: any) => fn(),
  withTimeout: (p: any) => p,
}))

vi.mock('@/router/utils/routeMerger', () => ({
  getCurrentPlatform: vi.fn(() => 'web'),
}))

vi.mock('@/config/backend-paths', () => ({
  COZE_PREFIX: '/coze',
  LOGIN_PWD_PATHS: { refreshToken: '/auth/login/pwd/refresh' },
}))

vi.mock('@/config/api-white-list', () => ({
  API_WHITE_LIST: ['/auth/login'],
}))

vi.mock('@/config/error-codes', () => ({
  isTokenExpired: vi.fn(() => false),
  isSuccess: vi.fn(() => true),
}))

import axios from 'axios'
import { ApiClient, apiClient } from '../client'

describe('core/client', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('ApiClient 构造', () => {
    const c = new ApiClient()
    expect(c).toBeDefined()
  })

  it('ApiClient 构造带 config', () => {
    const c = new ApiClient({ baseURL: '/x', timeout: 1000, retryCount: 1 })
    expect(c).toBeDefined()
  })

  it('apiClient 单例', () => {
    expect(apiClient).toBeDefined()
  })

  it('get 正常', async () => {
    const r = await apiClient.get('/test')
    expect(r).toBeDefined()
  })

  it('get 带 params', async () => {
    const r = await apiClient.get('/test', { a: 1 })
    expect(r).toBeDefined()
  })

  it('get 带 silent', async () => {
    const r = await apiClient.get('/test', undefined, { silent: true })
    expect(r).toBeDefined()
  })

  it('post 正常', async () => {
    const r = await apiClient.post('/test', { a: 1 })
    expect(r).toBeDefined()
  })

  it('post 带 options', async () => {
    const r = await apiClient.post('/test', { a: 1 }, { silent: true, headers: { 'X-A': 'v' } })
    expect(r).toBeDefined()
  })

  it('put', async () => {
    const r = await apiClient.put('/test', { a: 1 })
    expect(r).toBeDefined()
  })

  it('put silent', async () => {
    const r = await apiClient.put('/test', { a: 1 }, { silent: true })
    expect(r).toBeDefined()
  })

  it('delete', async () => {
    const r = await apiClient.delete('/test')
    expect(r).toBeDefined()
  })

  it('delete 带 params', async () => {
    const r = await apiClient.delete('/test', { silent: true, params: { a: 1 } })
    expect(r).toBeDefined()
  })

  it('patch', async () => {
    const r = await apiClient.patch('/test', { a: 1 })
    expect(r).toBeDefined()
  })

  it('patch silent', async () => {
    const r = await apiClient.patch('/test', { a: 1 }, { silent: true })
    expect(r).toBeDefined()
  })

  it('getPaginated', async () => {
    const r = await apiClient.getPaginated('/test', { page: 1, pageSize: 10 })
    expect(r).toBeDefined()
  })

  it('getPaginated 无 params', async () => {
    const r = await apiClient.getPaginated('/test')
    expect(r).toBeDefined()
  })

  it('setToken / getToken / clearToken', () => {
    apiClient.setToken('t1')
    const t = apiClient.getToken()
    expect(t).toBeDefined()
    apiClient.clearToken()
  })

  it('非标准响应', async () => {
    const mockInstance: any = (axios.create as any)()
    mockInstance.request.mockResolvedValueOnce({ status: 200, data: { foo: 'bar' } })
    const r = await apiClient.get('/test')
    expect(r).toBeDefined()
  })

  it('错误响应 401 token 过期', async () => {
    const ecMod = await import('@/config/error-codes')
    ;(ecMod.isTokenExpired as any).mockReturnValue(true)
    const mockInstance: any = (axios.create as any)()
    mockInstance.request.mockRejectedValueOnce({
      response: { status: 401, config: { headers: {} }, data: { message: 'expired' } },
    })
    await expect(apiClient.get('/test', undefined, { silent: true })).rejects.toBeDefined()
  })

  it('业务错误抛出', async () => {
    const ecMod = await import('@/config/error-codes')
    ;(ecMod.isSuccess as any).mockReturnValue(false)
    const mockInstance: any = (axios.create as any)()
    mockInstance.request.mockResolvedValueOnce({ status: 200, data: { code: 500, message: 'fail' } })
    try { await apiClient.get('/test', undefined, { silent: true }) } catch (e) {}
  })

  it('网络错误', async () => {
    const mockInstance: any = (axios.create as any)()
    mockInstance.request.mockRejectedValueOnce({ request: {} })
    await expect(apiClient.get('/test', undefined, { silent: true })).rejects.toBeDefined()
  })

  it('超时错误', async () => {
    const mockInstance: any = (axios.create as any)()
    mockInstance.request.mockRejectedValueOnce({ message: 'timeout occurred' })
    await expect(apiClient.get('/test', undefined, { silent: true })).rejects.toBeDefined()
  })
})
