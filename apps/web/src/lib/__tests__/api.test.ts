import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { fetchApi } from '../api'
import { useAuthStore } from '@/stores/auth'

describe('fetchApi', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    // 2026-07-26 修复:用 setToken(null) 而非 setState({ token: null }),
    // 因为 api.ts 的 tokenProvider 是 `useAuthStore.getState().token ?? getAuthCookie()`。
    // setState 只清内存 token,不清 auth_token cookie;前一个测试 setToken('mytoken')
    // 写入的 cookie 会残留,导致"无 token"测试实际读到 cookie 里的 'mytoken'。
    // setToken(null) 内部调 setAuthCookie(null) + clearRefreshTokenCookie(),彻底清理。
    useAuthStore.getState().setToken(null)
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
      headers: new Headers(),
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
      headers: new Headers(),
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

  it('传入 AbortSignal 并中止时返回请求已取消', async () => {
    const controller = new AbortController()
    global.fetch = vi.fn().mockImplementation((_url, opts) => {
      return new Promise((_resolve, reject) => {
        const signal = (opts as RequestInit).signal as AbortSignal
        if (signal?.aborted) {
          reject(new DOMException('aborted', 'AbortError'))
          return
        }
        signal?.addEventListener('abort', () => {
          reject(new DOMException('aborted', 'AbortError'))
        })
      })
    }) as unknown as typeof fetch

    const promise = fetchApi('/api/test', { signal: controller.signal })
    // 让 fetchApi 内部的设备指纹注入 microtask 与 signal 合并 microtask 完成,
    // 再发起 abort,确保 fetch 已被调用一次(契约:AbortError 早返回,不重试)。
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
    controller.abort()
    const r = await promise
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error).toBe('请求已取消')
    // AbortError 早返回,不重试,实际调用次数为 1
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it('首次请求网络失败时重试一次', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ code: 0, message: 'ok', data: { v: 1 } }),
      })
    global.fetch = fetchMock as unknown as typeof fetch

    const r = await fetchApi('/api/test')
    expect(r.success).toBe(true)
    if (r.success) expect(r.data).toEqual({ v: 1 })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('连续两次网络失败时返回错误(重试耗尽)', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('network down'))
      .mockRejectedValueOnce(new Error('network down'))
    global.fetch = fetchMock as unknown as typeof fetch

    const r = await fetchApi('/api/test')
    expect(r.success).toBe(false)
    if (!r.success) expect(r.error).toBe('network down')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
