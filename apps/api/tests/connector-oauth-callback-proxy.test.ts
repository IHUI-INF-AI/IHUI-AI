// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 连接器 OAuth 回调代理锁(2026-11-24 立)。
 *
 * 钉死三件事:
 *   ① 只透传白名单 query(code/state/error/error_description),不把额外 query 带进下游;
 *   ② 不转发任何请求头(尤其 Authorization) —— 网关不能成为鉴权旁路载体;
 *   ③ 缺参数 fail-closed 400,不空转发。
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

const h = vi.hoisted(() => ({ fetch: vi.fn() }))

import connectorOAuthCallbackProxyRoutes from '../src/routes/connector-oauth-callback-proxy.js'

let app: FastifyInstance
const originalFetch = globalThis.fetch

beforeAll(async () => {
  globalThis.fetch = h.fetch as unknown as typeof fetch
  app = Fastify({ logger: false })
  await app.register(connectorOAuthCallbackProxyRoutes)
  await app.ready()
})

afterAll(async () => {
  globalThis.fetch = originalFetch
  await app.close()
})

function mockUpstream(status = 200, body = { ok: true }) {
  h.fetch.mockReset()
  h.fetch.mockResolvedValue({
    status,
    headers: { get: () => 'application/json' },
    arrayBuffer: async () => Buffer.from(JSON.stringify(body)),
  })
}

describe('GET /api/callback/connectors/oauth', () => {
  it('白名单 query 原样转发到 ai-service 回调端点', async () => {
    mockUpstream()
    const res = await app.inject({
      method: 'GET',
      url: '/api/callback/connectors/oauth?code=CODE&state=ST%2FB&error_description=desc&extra=SHOULD_NOT_PASS',
      headers: { authorization: 'Bearer browser-jwt' },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ ok: true })
    expect(h.fetch).toHaveBeenCalledTimes(1)
    const [target, init] = h.fetch.mock.calls[0] as [string, RequestInit]
    expect(target).toMatch(/\/api\/connectors\/oauth\/callback\?/)
    const q = new URLSearchParams(target.split('?')[1] ?? '')
    expect(q.get('code')).toBe('CODE')
    expect(q.get('state')).toBe('ST/B')
    expect(q.get('error_description')).toBe('desc')
    expect(q.has('extra')).toBe(false)
    // 不转发浏览器 Authorization:本端点身份由 state HMAC 自证
    expect(init.headers).toEqual({ accept: 'application/json' })
  })

  it('缺 code 且缺 error → 400,不空转发', async () => {
    mockUpstream()
    const res = await app.inject({
      method: 'GET',
      url: '/api/callback/connectors/oauth?state=ST',
    })
    expect(res.statusCode).toBe(400)
    expect(h.fetch).not.toHaveBeenCalled()
  })

  it('上游异常 → 502,不伪造成功', async () => {
    h.fetch.mockReset()
    h.fetch.mockRejectedValue(new Error('upstream down'))
    const res = await app.inject({
      method: 'GET',
      url: '/api/callback/connectors/oauth?code=CODE&state=ST',
    })
    expect(res.statusCode).toBe(502)
  })

  it('上游状态码原样回传(如 state 校验失败 400)', async () => {
    mockUpstream(400, { error: 'state 签名校验失败' })
    const res = await app.inject({
      method: 'GET',
      url: '/api/callback/connectors/oauth?code=CODE&state=BAD',
    })
    expect(res.statusCode).toBe(400)
    expect(res.json()).toEqual({ error: 'state 签名校验失败' })
  })
})
