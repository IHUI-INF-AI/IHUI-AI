// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
import { request as httpRequest } from 'node:http'
import { afterEach, describe, expect, it } from 'vitest'
import {
  MAX_MCP_BODY_BYTES,
  McpHostStateError,
  McpLoopbackHost,
  McpRouteNameInvalidError,
  createMcpLoopbackHost,
  type McpRouteHandle,
} from '../src/services/mcp-loopback-host.js'

interface HttpResponse {
  status: number
  body: string
}

function post(
  port: number,
  path: string,
  token?: string,
  body?: unknown,
  extraHeaders?: Record<string, string>,
): Promise<HttpResponse> {
  return new Promise((resolvePromise, rejectPromise) => {
    const payload = body === undefined ? '' : JSON.stringify(body)
    const req = httpRequest(
      {
        host: '127.0.0.1',
        port,
        path,
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(payload),
          ...(token ? { 'x-mcp-route-token': token } : {}),
          ...(extraHeaders ?? {}),
        },
      },
      (res) => {
        const chunks: string[] = []
        res.setEncoding('utf8')
        res.on('data', (chunk) => chunks.push(chunk))
        res.on('end', () => resolvePromise({ status: res.statusCode ?? 0, body: chunks.join('') }))
      },
    )
    req.on('error', rejectPromise)
    req.end(payload)
  })
}

function asJson(response: HttpResponse): Record<string, unknown> {
  return JSON.parse(response.body) as Record<string, unknown>
}

const okHandler = async () => ({ status: 200, body: { ok: true } })

describe('RP-19 MCP Host 回环服务（真实绑定 + 真实 HTTP 请求）', () => {
  const hosts: McpLoopbackHost[] = []

  async function newHost(): Promise<McpLoopbackHost> {
    const host = await createMcpLoopbackHost()
    hosts.push(host)
    return host
  }

  afterEach(async () => {
    while (hosts.length) {
      const host = hosts.pop()
      if (host) await host.close()
    }
  })

  it('随机端口只绑 127.0.0.1，不落公网', async () => {
    const host = await newHost()
    const endpoint = host.stats
    expect(endpoint.boundAddress).toBe('127.0.0.1')
    expect(endpoint.boundPort).toBeGreaterThan(0)
    expect(endpoint.closed).toBe(false)
    expect(host.stats.registeredRoutes).toBe(0)
  })

  it('注册后凭 per-route token 调用成功', async () => {
    const host = await newHost()
    const route = host.registerRoute('tools.list', okHandler)
    const response = await post(host.stats.boundPort, '/mcp/tools.list', route.token, { arg: 1 })
    expect(response.status).toBe(200)
    expect(asJson(response)).toEqual({ ok: true })
  })

  it('每条路由 token 独立且不可预测', async () => {
    const host = await newHost()
    const a = host.registerRoute('a', okHandler)
    const b = host.registerRoute('b', okHandler)
    expect(a.token).not.toBe(b.token)
    expect(a.token).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(b.token).toMatch(/^[A-Za-z0-9_-]{43}$/)
    const wrong = await post(host.stats.boundPort, '/mcp/b', a.token, {})
    expect(wrong.status).toBe(401)
    expect(asJson(wrong).error).toBe('INVALID_ROUTE_TOKEN')
  })

  it('未注册路由（含命名空间外路径）一律 404', async () => {
    const host = await newHost()
    const route = host.registerRoute('known', okHandler)
    const unknown = await post(host.stats.boundPort, '/mcp/unknown', route.token, {})
    expect(unknown.status).toBe(404)
    expect(asJson(unknown).error).toBe('ROUTE_NOT_REGISTERED')
    const outside = await post(host.stats.boundPort, '/other', route.token, {})
    expect(outside.status).toBe(404)
    expect(asJson(outside).error).toBe('ROUTE_NOT_REGISTERED')
  })

  it('缺失 token 与非法 token 均被拒且 handler 不执行', async () => {
    const host = await newHost()
    let called = 0
    host.registerRoute('guarded', async () => {
      called += 1
      return { status: 200, body: {} }
    })
    const missing = await post(host.stats.boundPort, '/mcp/guarded', undefined, {})
    const forged = await post(host.stats.boundPort, '/mcp/guarded', 'not-a-real-token', {})
    expect(missing.status).toBe(401)
    expect(forged.status).toBe(401)
    expect(called).toBe(0)
  })

  it('重复注册与非法路由名 fail-closed', async () => {
    const host = await newHost()
    host.registerRoute('dup', okHandler)
    expect(() => host.registerRoute('dup', okHandler)).toThrow(McpHostStateError)
    expect(() => host.registerRoute('../escape', okHandler)).toThrow(McpRouteNameInvalidError)
    expect(() => host.registerRoute('', okHandler)).toThrow(McpRouteNameInvalidError)
    expect(host.stats.registeredRoutes).toBe(1)
  })

  it('注销后该路由 404，且原 token 不能继续使用', async () => {
    const host = await newHost()
    const handle: McpRouteHandle = host.registerRoute('temp', okHandler)
    const before = await post(host.stats.boundPort, '/mcp/temp', handle.token, {})
    expect(before.status).toBe(200)
    expect(handle.unregister()).toBe(0)
    expect(host.stats.registeredRoutes).toBe(0)
    const after = await post(host.stats.boundPort, '/mcp/temp', handle.token, {})
    expect(after.status).toBe(404)
  })

  it('注销中止在飞请求并逐条计数', async () => {
    const host = await newHost()
    let started!: () => void
    const startedOnce = new Promise<void>((resolvePromise) => {
      started = resolvePromise
    })
    let handlerSawAbort = false
    const handle = host.registerRoute('slow', async ({ signal }) => {
      started()
      await new Promise<void>((_resolvePromise, rejectPromise) => {
        signal.addEventListener(
          'abort',
          () => {
            handlerSawAbort = true
            rejectPromise(new Error('aborted by unregister'))
          },
          { once: true },
        )
      })
      return { status: 200, body: {} }
    })
    const pending = post(host.stats.boundPort, '/mcp/slow', handle.token, {})
    await startedOnce
    expect(host.stats.inFlight).toBe(1)
    expect(handle.unregister()).toBe(1)
    expect(host.stats.abortedAfterUnregister).toBe(1)
    expect(host.stats.inFlight).toBe(0)
    const response = await pending
    expect(response.status).toBe(409)
    expect(asJson(response).error).toBe('ROUTE_UNREGISTERED_WHILE_IN_FLIGHT')
    expect(handlerSawAbort).toBe(true)
  })

  it('非 POST 请求 405，非法 JSON 400，超限 body 413', async () => {
    const host = await newHost()
    const route = host.registerRoute('strict', okHandler)
    const wrongMethod = await new Promise<HttpResponse>((resolvePromise, rejectPromise) => {
      const req = httpRequest(
        {
          host: '127.0.0.1',
          port: host.stats.boundPort,
          path: '/mcp/strict',
          method: 'GET',
          headers: { 'x-mcp-route-token': route.token },
        },
        (res) => {
          const chunks: string[] = []
          res.on('data', (c) => chunks.push(String(c)))
          res.on('end', () =>
            resolvePromise({ status: res.statusCode ?? 0, body: chunks.join('') }),
          )
        },
      )
      req.on('error', rejectPromise)
      req.end()
    })
    expect(wrongMethod.status).toBe(405)

    const broken = await new Promise<HttpResponse>((resolvePromise, rejectPromise) => {
      const payload = '{oops'
      const req = httpRequest(
        {
          host: '127.0.0.1',
          port: host.stats.boundPort,
          path: '/mcp/strict',
          method: 'POST',
          headers: {
            'x-mcp-route-token': route.token,
            'content-length': Buffer.byteLength(payload),
          },
        },
        (res) => {
          const chunks: string[] = []
          res.on('data', (c) => chunks.push(String(c)))
          res.on('end', () =>
            resolvePromise({ status: res.statusCode ?? 0, body: chunks.join('') }),
          )
        },
      )
      req.on('error', rejectPromise)
      req.end(payload)
    })
    expect(broken.status).toBe(400)

    const tooLarge = await post(
      host.stats.boundPort,
      '/mcp/strict',
      route.token,
      'x'.repeat(MAX_MCP_BODY_BYTES + 1),
    )
    expect(tooLarge.status).toBe(413)
  })

  it('close 释放端口、清空路由且不可重复 start', async () => {
    const host = new McpLoopbackHost()
    const endpoint = await host.start()
    host.registerRoute('gone', okHandler)
    await host.close()
    expect(host.stats.closed).toBe(true)
    expect(host.stats.registeredRoutes).toBe(0)
    expect(host.stats.boundPort).toBe(0)
    await expect(host.start()).rejects.toThrow(McpHostStateError)
    await expect(
      post(endpoint.port, '/mcp/gone', 'anything', {}),
    ).rejects.toThrow()
  })
})
