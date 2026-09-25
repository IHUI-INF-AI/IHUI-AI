// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { fetchApi } from '../api'
import { useAuthStore } from '@/stores/auth'

/**
 * 登录弹窗 store 的**忠实**替身(2026-09-25 加,配 401 接线票)。
 *
 * 为什么必须真做 store 而不能直接 mock `openLoginDialogOnce`:
 * 本票要验的正是"两条触发路径(共享包 401 处理器 + 本端包装层)同 tick 先后命中时,
 * 用户只看到**一个**弹窗"。那个收敛发生在真实 trigger 的模块级 openGuard 里 ——
 * 一旦把 trigger mock 掉,就只剩"我调了几次"而测不到"最终开了几次",验收项形同虚设。
 * 所以这里只替换 store,保留 trigger 原实现。
 */
const { dialogMock } = vi.hoisted(() => {
  /** 以原始 listener 为键,unsubscribe 才能真摘掉(否则用例间会互相串扰) */
  const subs = new Map<(s: unknown) => void, () => void>()
  const state = {
    isOpen: false,
    openCount: 0,
    open: (_mode?: string, _redirect?: string) => {
      state.isOpen = true
      state.openCount += 1
      notify()
    },
    close: () => {
      state.isOpen = false
      notify()
    },
  }
  function notify() {
    // zustand 的 subscribe 回调收的是 state 本身,不能传 undefined
    for (const call of [...subs.values()]) call()
  }
  return { dialogMock: { state, subs } }
})

vi.mock('@/stores/login-dialog', () => ({
  useLoginDialogStore: {
    getState: () => dialogMock.state,
    subscribe: (listener: (s: unknown) => void) => {
      dialogMock.subs.set(listener, () => listener(dialogMock.state))
      return () => {
        dialogMock.subs.delete(listener)
      }
    },
  },
}))

const unauthorizedResponses = () =>
  vi.fn().mockImplementation(async () => ({
    // 业务请求与静默续期都回 401 ⇒ refreshAccessToken 拿不到 token ⇒ 属"确实无有效凭据"
    ok: false,
    status: 401,
    headers: new Headers(),
    text: async () => JSON.stringify({ code: 40101, message: '登录已过期' }),
    json: async () => ({ code: 40101, message: '登录已过期' }),
  }))

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

/**
 * 2026-09-25 `setUnauthorizedHandler` 接线验证(补能力票的 web 侧)。
 *
 * 三条各堵一个不同的回归:
 * - 经包装层的非 GET 401 **仍**弹窗,且"共享包处理器 + 包装层"两条路径同 tick 命中时
 *   只开**一个**弹窗(接线最容易糊过去的那一点)
 * - 经端点函数(不经过本包装层)的非 GET 401 现在也弹窗 —— 这就是本票要补的能力
 * - GET 401 与"刷新中(isAuthenticated 但 token 为空)"仍不弹,懒触发策略原样保住
 */
describe('401 → 登录弹窗接线', () => {
  const originalFetchForWiring = global.fetch

  beforeEach(() => {
    dialogMock.state.openCount = 0
    dialogMock.state.close()
    useAuthStore.getState().setToken(null)
  })

  afterEach(() => {
    // 关掉弹窗以复位 trigger 的模块级 openGuard,否则用例之间互相吞掉弹窗
    dialogMock.state.close()
    global.fetch = originalFetchForWiring
  })

  it('经 web 包装层的非 GET 401:开且仅开一个弹窗(两条触发路径不叠加)', async () => {
    global.fetch = unauthorizedResponses() as unknown as typeof fetch

    const r = await fetchApi('/api/test', { method: 'POST', body: '{}' })

    // 前提自证:共享包的处理器确实已注册(否则"仅一个"会因为只剩包装层一条路径而恒真)
    const { getUnauthorizedHandler } = await import('@ihui/api-client')
    expect(getUnauthorizedHandler()).not.toBeNull()
    expect(r.success).toBe(false)
    expect(dialogMock.state.openCount).toBe(1)
  })

  it('经端点函数路径(直连共享 fetchApi,绕过包装层)的非 GET 401:同样弹窗', async () => {
    // 迁移前这一格是 0 —— 用户点了没反应;本票就是为了把它变成 1
    const { fetchApi: fetchApiShared } = await import('@ihui/api-client')
    global.fetch = unauthorizedResponses() as unknown as typeof fetch

    const r = await fetchApiShared('/api/test', { method: 'DELETE' })

    expect(r.success).toBe(false)
    expect(dialogMock.state.openCount).toBe(1)
  })

  it('GET 的 401 不弹窗(懒触发策略不因接线而放宽)', async () => {
    const { fetchApi: fetchApiShared } = await import('@ihui/api-client')
    global.fetch = unauthorizedResponses() as unknown as typeof fetch

    await fetchApiShared('/api/test')

    expect(dialogMock.state.openCount).toBe(0)
  })

  it('刷新中(isAuthenticated=true 且 token=null)不弹窗', async () => {
    global.fetch = unauthorizedResponses() as unknown as typeof fetch
    useAuthStore.setState({ isAuthenticated: true, token: null })

    await fetchApi('/api/test', { method: 'POST', body: '{}' })

    expect(dialogMock.state.openCount).toBe(0)
    useAuthStore.setState({ isAuthenticated: false })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
