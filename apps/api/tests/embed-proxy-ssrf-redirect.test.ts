// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 嵌入代理的 SSRF 回归锁:原实现 `redirect:'follow'` + 事后检查 upstream.url,
 * 检查时内网请求已经发出(盲 SSRF)。修复后逐跳 manual 跟随,落点请求前先判禁。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

import { embedProxyRoutes } from '../src/routes/embed-proxy.js'

const redirectTo = (location: string, status = 302): Response =>
  ({
    ok: false,
    status,
    url: '',
    headers: new Headers({ location }),
    body: null,
    text: async () => '',
  }) as unknown as Response

let app: FastifyInstance

beforeEach(async () => {
  app = Fastify()
  await app.register(embedProxyRoutes)
  await app.ready()
})

afterEach(async () => {
  await app.close()
  vi.unstubAllGlobals()
})

describe('/raw 重定向落点', () => {
  it('302 落点指向私网 ⇒ 落点绝不发出请求(首跳只发一次)', async () => {
    const fetchMock = vi.fn(async () => redirectTo('http://192.168.0.5/secret'))
    vi.stubGlobal('fetch', fetchMock)

    const res = await app.inject({
      method: 'GET',
      url: `/raw?url=${encodeURIComponent('http://8.8.8.8/')}`,
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe('http://8.8.8.8/')
    expect(fetchMock.mock.calls.map((c) => String(c[0]))).not.toContain('http://192.168.0.5/secret')
    expect(res.body).toContain('内网')
  })

  it('首跳就是私网 ⇒ 403,且一次请求都没发(对照)', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const res = await app.inject({
      method: 'GET',
      url: `/raw?url=${encodeURIComponent('http://10.1.2.3/')}`,
    })

    expect(res.statusCode).toBe(403)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
