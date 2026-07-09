import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { fetchApi } from '../api'
import { useAuthStore } from '@/stores/auth'

describe('fetchApi', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    useAuthStore.setState({ token: null })
  })

  afterEach(() => {
    global.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('成功请求返回 { success: true, data }', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ code: 0, message: 'ok', data: { id: 1 } }),
    }) as unknown as typeof fetch

    const r = await fetchApi('/api/test')
    expect(r.success).toBe(true)
    if (r.success) expect(r.data).toEqual({ id: 1 })
  })

  it('code !== 0 返回失败', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ code: 1001, message: '参数错误', data: null }),
    }) as unknown as typeof fetch

    const r = await fetchApi('/api/test')
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error).toBe('参数错误')
  })

  it('HTTP 非 2xx 返回失败', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => '服务器错误',
    }) as unknown as typeof fetch

    const r = await fetchApi('/api/test')
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error).toBe('服务器错误')
  })

  it('HTTP 非 2xx 且 text 失败时回退状态码', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => {
        throw new Error('read fail')
      },
    }) as unknown as typeof fetch

    const r = await fetchApi('/api/test')
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error).toContain('404')
  })

  it('网络异常返回失败', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('network down'))

    const r = await fetchApi('/api/test')
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error).toBe('network down')
  })

  it('网络异常(非 Error)返回通用错误', async () => {
    global.fetch = vi.fn().mockRejectedValue('unknown')

    const r = await fetchApi('/api/test')
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error).toBe('网络异常')
  })

  it('携带 token 时添加 Authorization header', async () => {
    useAuthStore.getState().setToken('mytoken')
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ code: 0, message: 'ok', data: null }),
    })
    global.fetch = fetchMock as unknown as typeof fetch

    await fetchApi('/api/test')
    const opts = fetchMock.mock.calls[0]?.[1] as RequestInit
    const headers = opts.headers as Record<string, string>
    expect(headers['Authorization']).toBe('Bearer mytoken')
  })

  it('无 token 时不添加 Authorization header', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ code: 0, message: 'ok', data: null }),
    })
    global.fetch = fetchMock as unknown as typeof fetch

    await fetchApi('/api/test')
    const opts = fetchMock.mock.calls[0]?.[1] as RequestInit
    const headers = opts.headers as Record<string, string>
    expect(headers['Authorization']).toBeUndefined()
  })

  it('默认 Content-Type 为 application/json', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ code: 0, message: 'ok', data: null }),
    })
    global.fetch = fetchMock as unknown as typeof fetch

    await fetchApi('/api/test', { method: 'POST', body: '{}' })
    const opts = fetchMock.mock.calls[0]![1] as RequestInit
    const headers = opts.headers as Record<string, string>
    expect(headers['Content-Type']).toBe('application/json')
  })

  it('FormData 不设置 Content-Type(浏览器自动 multipart)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ code: 0, message: 'ok', data: null }),
    })
    global.fetch = fetchMock as unknown as typeof fetch

    const form = new FormData()
    form.append('a', '1')
    await fetchApi('/api/test', { method: 'POST', body: form })
    const opts = fetchMock.mock.calls[0]![1] as RequestInit
    const headers = opts.headers as Record<string, string>
    expect(headers['Content-Type']).toBeUndefined()
  })
})
