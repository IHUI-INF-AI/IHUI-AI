// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 桥体检的解析与失败折返：桥没起来是常态，接口不能因此 500；
 * 但也不能把「连不上」包装成在线，状态必须一眼看穿。
 */

import { afterEach, describe, expect, it, vi } from 'vitest'

const state: { credentials: Record<string, unknown> } = { credentials: {} }

vi.mock('../wechat-hub/guards', () => ({
  assertAccountForUser: async () => ({}),
}))
// 凭据走 loadRuntime 解密；测试里直接给它结果，避免依赖真实加密载荷。
vi.mock('../wechat-hub/adapter-factory', () => ({
  loadRuntime: () => ({ credentials: state.credentials }),
}))

const { probeBridgeForAccount, readBridgeStatusPayload } = await import(
  '../wechat-hub/bridge-probe'
)

afterEach(() => {
  vi.unstubAllGlobals()
  state.credentials = {}
})

describe('readBridgeStatusPayload', () => {
  it('把桥自报字段摊平，缺的留 null', () => {
    const view = readBridgeStatusPayload({
      ok: true,
      online: true,
      status: 'db-sidecar-ready',
      mode: 'db',
      driver: 'db',
      account: 'ok502319984_e7c6',
      queued: 0,
      momentSeq: 715,
    })
    expect(view).toMatchObject({
      driver: 'db',
      online: true,
      status: 'db-sidecar-ready',
      mode: 'db',
      account: 'ok502319984_e7c6',
      queued: 0,
      momentSeq: 715,
    })
  })

  it('读不懂的载荷不猜：全 null', () => {
    expect(readBridgeStatusPayload(null)).toEqual({
      driver: null,
      online: null,
      status: null,
      mode: null,
      account: null,
      queued: null,
      momentSeq: null,
    })
    expect(readBridgeStatusPayload('ok')).toMatchObject({ driver: null, online: null })
  })
})

describe('probeBridgeForAccount', () => {
  it('没配桥地址时不发请求，直接说明原因', async () => {
    state.credentials = {}
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const view = await probeBridgeForAccount('u1', 'a1')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(view.reachable).toBe(false)
    expect(view.error).toContain('没配桥地址')
  })

  it('桥在线时带回驱动与账号，并带上鉴权头', async () => {
    state.credentials = { baseUrl: 'http://127.0.0.1:8849/', token: 's3cret', statusPath: '/status' }
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, online: true, driver: 'db', status: 'db-sidecar-ready', mode: 'db', account: 'ok502' }),
    }))
    vi.stubGlobal('fetch', fetchMock)
    const view = await probeBridgeForAccount('u1', 'a1')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('http://127.0.0.1:8849/status')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer s3cret')
    expect(view).toMatchObject({ reachable: true, httpStatus: 200, driver: 'db', online: true })
    expect(view.error).toBeNull()
    expect(view.latencyMs).toBeGreaterThanOrEqual(0)
  })

  it('桥返回 401 仍算活着，但把状态码与原因带出来', async () => {
    state.credentials = { baseUrl: 'http://127.0.0.1:8849' }
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 401, json: async () => ({ ok: false, error: 'unauthorized' }) })),
    )
    const view = await probeBridgeForAccount('u1', 'a1')
    expect(view.reachable).toBe(true)
    expect(view.httpStatus).toBe(401)
    expect(view.error).toContain('401')
  })

  it('连不上时折叠成不可达，不抛出', async () => {
    state.credentials = { baseUrl: 'http://127.0.0.1:9999' }
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('connect ECONNREFUSED 127.0.0.1:9999')
      }),
    )
    const view = await probeBridgeForAccount('u1', 'a1')
    expect(view.reachable).toBe(false)
    expect(view.httpStatus).toBeNull()
    expect(view.error).toContain('ECONNREFUSED')
  })

  it('超时给出「3 秒没响应」而不是一串底层报错', async () => {
    state.credentials = { baseUrl: 'http://127.0.0.1:8849' }
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        const error = new Error('The operation was aborted due to timeout')
        error.name = 'TimeoutError'
        throw error
      }),
    )
    const view = await probeBridgeForAccount('u1', 'a1')
    expect(view.reachable).toBe(false)
    expect(view.error).toContain('3 秒内没有响应')
  })
})
