// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * L08 业务路由传输面验收:
 *  - 15 条业务路由全部注册进回环 Host(路径表与 mcp-extended 一致);
 *  - 参数路径由 Host 捕获并原样转发给 Fastify inject(不复制业务逻辑);
 *  - route token 只用于 Host 闸门,不向下游泄漏;
 *  - 方法不允许 405,未知路径 404,注销后 404。
 */

import { afterEach, describe, expect, it } from 'vitest'

import {
  MCP_BUSINESS_ROUTE_COUNT,
  registerMcpBusinessRoutes,
  type McpInjectRequest,
} from '../mcp-business-routes.js'
import { MCP_ROUTE_TOKEN_HEADER, McpLoopbackHost } from '../mcp-loopback-host.js'

const hosts: McpLoopbackHost[] = []

afterEach(async () => {
  for (const host of hosts.splice(0)) await host.stop()
})

const tokenFor = (routes: { pattern: string; token: string }[], pattern: string): string => {
  const route = routes.find((item) => item.pattern === pattern)
  if (!route) throw new Error(`未注册路由: ${pattern}`)
  return route.token
}

describe('L08 MCP 业务路由适配器', () => {
  it('注册 15 条业务路由,并保留每条路径的独立 token', () => {
    const host = new McpLoopbackHost()
    hosts.push(host)
    const seen: McpInjectRequest[] = []
    const routes = registerMcpBusinessRoutes(host, async (request) => {
      seen.push(request)
      return { statusCode: 200, headers: {}, payload: '{"ok":true}' }
    })
    expect(routes.reduce((total, route) => total + route.methods.length, 0)).toBe(
      MCP_BUSINESS_ROUTE_COUNT,
    )
    expect(MCP_BUSINESS_ROUTE_COUNT).toBe(15)
    expect(new Set(routes.map((route) => route.token)).size).toBe(routes.length)
  })

  it('GET 列表带 query 原样转发,route token 不向下游泄漏', async () => {
    const host = new McpLoopbackHost()
    hosts.push(host)
    const seen: McpInjectRequest[] = []
    const routes = registerMcpBusinessRoutes(host, async (request) => {
      seen.push(request)
      return {
        statusCode: 200,
        headers: { 'content-type': 'application/json' },
        payload: '{"code":0,"data":{"list":[]}}',
      }
    })
    const token = tokenFor(routes, '/mcp/projects')
    const { port } = await host.start()
    const response = await fetch(`http://127.0.0.1:${port}/mcp/projects?page=2&pageSize=10`, {
      headers: { [MCP_ROUTE_TOKEN_HEADER]: token, authorization: 'Bearer test-token' },
    })
    expect(response.status).toBe(200)
    expect(await response.text()).toBe('{"code":0,"data":{"list":[]}}')
    expect(seen).toHaveLength(1)
    expect(seen[0]?.method).toBe('GET')
    expect(seen[0]?.url).toBe('/api/mcp/projects?page=2&pageSize=10')
    expect(seen[0]?.headers.authorization).toBe('Bearer test-token')
    expect(seen[0]?.headers[MCP_ROUTE_TOKEN_HEADER]).toBeUndefined()
    expect(seen[0]?.payload).toBeUndefined()
  })

  it('参数路径被捕获为 Fastify 路由,POST body 原样转发', async () => {
    const host = new McpLoopbackHost()
    hosts.push(host)
    const seen: McpInjectRequest[] = []
    const routes = registerMcpBusinessRoutes(host, async (request) => {
      seen.push(request)
      return { statusCode: 201, headers: {}, payload: '{"code":0,"data":{"id":"p1"}}' }
    })
    const token = tokenFor(routes, '/mcp/projects/:projectId/use')
    const { port } = await host.start()
    const response = await fetch(`http://127.0.0.1:${port}/mcp/projects/p1/use`, {
      method: 'POST',
      headers: {
        [MCP_ROUTE_TOKEN_HEADER]: token,
        'content-type': 'application/json',
        authorization: 'Bearer test-token',
      },
      body: JSON.stringify({ success: true, latencyMs: 12 }),
    })
    expect(response.status).toBe(201)
    expect(seen[0]?.method).toBe('POST')
    expect(seen[0]?.url).toBe('/api/mcp/projects/p1/use')
    expect(seen[0]?.payload).toBe('{"success":true,"latencyMs":12}')
  })

  it('方法不允许 405,未知路径 404,注销后 404', async () => {
    const host = new McpLoopbackHost()
    hosts.push(host)
    const routes = registerMcpBusinessRoutes(host, async () => ({
      statusCode: 200,
      headers: {},
      payload: '{}',
    }))
    const integrationToken = tokenFor(routes, '/mcp/integrations/:id')
    const { port } = await host.start()
    const base = `http://127.0.0.1:${port}`
    expect(
      (
        await fetch(`${base}/mcp/integrations/i1`, {
          headers: { [MCP_ROUTE_TOKEN_HEADER]: integrationToken },
        })
      ).status,
    ).toBe(405)
    expect(
      (
        await fetch(`${base}/mcp/unknown`, {
          headers: { [MCP_ROUTE_TOKEN_HEADER]: integrationToken },
        })
      ).status,
    ).toBe(404)
    expect(host.unregister('/mcp/integrations/:id')).toBe(true)
    expect(
      (
        await fetch(`${base}/mcp/integrations/i1`, {
          method: 'DELETE',
          headers: { [MCP_ROUTE_TOKEN_HEADER]: integrationToken },
        })
      ).status,
    ).toBe(404)
  })
})
