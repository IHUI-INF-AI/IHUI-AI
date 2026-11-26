// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * L08 验收面:真起一个回环 HTTP 服务,用真请求打 —— 不 mock socket。
 *  - 端口由内核分配,地址必须是 127.0.0.1;
 *  - 缺 token/错 token 403;未注册路径 404(带别条路由 token 也 404);
 *  - 注销先 abort 在飞请求并计数,之后同路径 404。
 */

import { afterEach, describe, expect, it } from 'vitest'

import {
  MCP_LOOPBACK_HOST,
  MCP_ROUTE_TOKEN_HEADER,
  McpLoopbackHost,
  McpRouteRegistrationError,
} from '../mcp-loopback-host.js'

const hosts: McpLoopbackHost[] = []

afterEach(async () => {
  for (const h of hosts.splice(0)) await h.stop()
})

describe('L08 MCP 回环 host', () => {
  it('只绑 127.0.0.1,端口由内核分配(不是写死的)', async () => {
    const host = new McpLoopbackHost()
    hosts.push(host)
    const started = await host.start()
    expect(started.address).toBe(MCP_LOOPBACK_HOST)
    expect(started.port).toBeGreaterThan(0)
    expect(host.port).toBe(started.port)
  })

  it('注册路径必须在 /mcp/ 前缀下且不可重复', () => {
    const host = new McpLoopbackHost()
    hosts.push(host)
    expect(() => host.register('/elsewhere', () => {})).toThrow(McpRouteRegistrationError)
    host.register('/mcp/a', () => {})
    expect(() => host.register('/mcp/a', () => {})).toThrow(/duplicate-path/)
  })

  it('per-route token:正确 token 200,缺失/错误 403', async () => {
    const host = new McpLoopbackHost()
    hosts.push(host)
    const token = host.register('/mcp/echo', ({ res }) => {
      res.writeHead(200, { 'content-type': 'text/plain' })
      res.end('ok')
    })
    const { port } = await host.start()
    const url = `http://${MCP_LOOPBACK_HOST}:${port}/mcp/echo`
    await expect(
      fetch(url, { headers: { [MCP_ROUTE_TOKEN_HEADER]: token } }).then((r) => r.text()),
    ).resolves.toBe('ok')
    expect((await fetch(url)).status).toBe(403)
    expect((await fetch(url, { headers: { [MCP_ROUTE_TOKEN_HEADER]: 'wrong' } })).status).toBe(403)
    expect(host.stats()).toMatchObject({ requests: 3, forbidden: 2 })
  })

  it('未注册路径 404;带其他路由的 token 也 404', async () => {
    const host = new McpLoopbackHost()
    hosts.push(host)
    const token = host.register('/mcp/known', ({ res }) => {
      res.end('known')
    })
    const { port } = await host.start()
    const base = `http://${MCP_LOOPBACK_HOST}:${port}`
    expect(
      (await fetch(`${base}/mcp/ghost`, { headers: { [MCP_ROUTE_TOKEN_HEADER]: token } })).status,
    ).toBe(404)
    expect(host.stats().notFound).toBe(1)
  })

  it('注销:在飞请求被 abort 并计数,后续同路径 404', async () => {
    const host = new McpLoopbackHost()
    hosts.push(host)
    const token = host.register('/mcp/slow', ({ res, signal }) => {
      signal.addEventListener(
        'abort',
        () => {
          res.writeHead(503, { 'content-type': 'text/plain' })
          res.end('aborted')
        },
        { once: true },
      )
    })
    const { port } = await host.start()
    const url = `http://${MCP_LOOPBACK_HOST}:${port}/mcp/slow`
    const pending = fetch(url, { headers: { [MCP_ROUTE_TOKEN_HEADER]: token } })
    await new Promise((r) => setTimeout(r, 200))
    expect(host.unregister('/mcp/slow')).toBe(true)
    expect((await pending).status).toBe(503)
    expect(host.stats().abortedOnUnregister).toBe(1)
    expect((await fetch(url, { headers: { [MCP_ROUTE_TOKEN_HEADER]: token } })).status).toBe(404)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
