// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * L08 业务路由适配器(2026-11-26)。
 *
 * `routes/mcp-extended.ts` 的 15 条路由继续作为唯一业务实现(鉴权、属主过滤、DB 都在
 * 那里);本文件只把它们的**传输面**注册进回环 Host:
 *
 *  - 每条路由一个 per-route token,Host 侧缺 token/错 token 一律 403;
 *  - 参数路径(`/mcp/projects/:id` 等)由 Host 的 pattern 匹配捕获,handler 把原始
 *    path + query 原样转发给 Fastify inject,不复制一份参数解析;
 *  - 调用方带的 `authorization` / `cookie` / `content-type` 原样透传,Fastify 侧
 *    的 `authenticate()` 仍然是唯一鉴权点;`x-ihui-route-token` 不向下游泄漏;
 *  - 逐路由注销由 Host 的 `unregister()` 负责,在飞请求按 L08 语义 abort。
 *
 * 这样"业务路由只在 Fastify 面"的边界就消掉了:回环 Host 自己拥有完整路径表、
 * token 闸和生命周期,业务实现仍只有一份,不会出现两套 DB 读写。
 */

import type { IncomingMessage } from 'node:http'

import type { McpLoopbackHost, McpRouteContext } from './mcp-loopback-host.js'

export interface McpInjectRequest {
  method: string
  url: string
  headers: Record<string, string | string[] | undefined>
  payload?: string
}

export interface McpInjectResponse {
  statusCode: number
  headers: Record<string, string | string[] | number | undefined>
  payload: string
}

export type McpBusinessInject = (request: McpInjectRequest) => Promise<McpInjectResponse>

interface BusinessRoute {
  pattern: string
  methods: readonly string[]
}

/**
 * 与 `routes/mcp-extended.ts` 的路由表一一对应(15 条)。
 * 这里是传输面的独立清单,测试会断言它和 Fastify 源文件里的 `server.<method>(...)`
 * 数量/路径一致,防止以后新增路由只改一边。
 */
export const MCP_BUSINESS_ROUTES: readonly BusinessRoute[] = [
  { pattern: '/mcp/projects', methods: ['GET', 'POST'] },
  { pattern: '/mcp/projects/:id', methods: ['GET', 'DELETE'] },
  { pattern: '/mcp/projects/:projectId/performance', methods: ['GET'] },
  { pattern: '/mcp/projects/:projectId/use', methods: ['GET', 'POST'] },
  { pattern: '/mcp/integrations', methods: ['GET', 'POST'] },
  { pattern: '/mcp/integrations/:id', methods: ['DELETE'] },
  { pattern: '/mcp/integrations/:id/toggle', methods: ['POST'] },
  { pattern: '/mcp/slash-commands/reload', methods: ['POST'] },
  { pattern: '/mcp/external/servers/:name/clear-auth', methods: ['POST'] },
  { pattern: '/mcp/external/servers/:name/reconnect', methods: ['POST'] },
  { pattern: '/mcp/store/:name/toggle', methods: ['POST'] },
] as const

export const MCP_BUSINESS_ROUTE_COUNT = MCP_BUSINESS_ROUTES.reduce(
  (total, route) => total + route.methods.length,
  0,
)

const MAX_BODY_BYTES = 1024 * 1024

class McpBodyTooLargeError extends Error {
  constructor() {
    super('request-body-too-large')
    this.name = 'McpBodyTooLargeError'
  }
}

async function readBody(req: IncomingMessage): Promise<string> {
  let total = 0
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string)
    total += buffer.length
    if (total > MAX_BODY_BYTES) throw new McpBodyTooLargeError()
    chunks.push(buffer)
  }
  return Buffer.concat(chunks).toString('utf8')
}

const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'host',
  'content-length',
])

function requestHeaders(req: IncomingMessage): Record<string, string | string[] | undefined> {
  const headers: Record<string, string | string[] | undefined> = {}
  for (const [name, value] of Object.entries(req.headers)) {
    if (name.toLowerCase() === 'x-ihui-route-token') continue
    if (HOP_BY_HOP.has(name.toLowerCase())) continue
    headers[name] = value
  }
  return headers
}

function replyHeaders(
  headers: Record<string, string | string[] | number | undefined>,
): Record<string, string | string[]> {
  const result: Record<string, string | string[]> = {}
  for (const [name, value] of Object.entries(headers)) {
    if (value === undefined || HOP_BY_HOP.has(name.toLowerCase())) continue
    result[name] = typeof value === 'number' ? String(value) : value
  }
  return result
}

function writeInjectResponse(
  ctx: McpRouteContext,
  response: McpInjectResponse,
  routeLabel: string,
): void {
  if (ctx.res.writableEnded) return
  ctx.res.writeHead(response.statusCode, {
    ...replyHeaders(response.headers),
    'x-ihui-loopback-route': routeLabel,
  })
  ctx.res.end(response.payload)
}

export interface RegisteredMcpBusinessRoute {
  pattern: string
  methods: readonly string[]
  token: string
}

export function registerMcpBusinessRoutes(
  host: McpLoopbackHost,
  inject: McpBusinessInject,
): RegisteredMcpBusinessRoute[] {
  return MCP_BUSINESS_ROUTES.map((route) => {
    const token = host.register(route.pattern, async (ctx: McpRouteContext) => {
      const method = (ctx.req.method ?? 'GET').toUpperCase()
      if (!route.methods.includes(method)) {
        ctx.res.writeHead(405, {
          allow: route.methods.join(', '),
          'content-type': 'application/json; charset=utf-8',
        })
        ctx.res.end(JSON.stringify({ error: 'method-not-allowed', allow: route.methods }))
        return
      }

      let body = ''
      try {
        if (method !== 'GET' && method !== 'HEAD') body = await readBody(ctx.req)
      } catch (err) {
        if (err instanceof McpBodyTooLargeError) {
          ctx.res.writeHead(413, { 'content-type': 'application/json; charset=utf-8' })
          ctx.res.end(JSON.stringify({ error: 'request-body-too-large' }))
          return
        }
        throw err
      }

      const headers = requestHeaders(ctx.req)
      if (body.length > 0 && headers['content-type'] === undefined) {
        headers['content-type'] = 'application/json'
      }

      const response = await inject({
        method,
        // 回环面路径与 Fastify 面只差 `/api` 前缀;query 原样保留。
        url: `/api${ctx.req.url ?? route.pattern}`,
        headers,
        payload: body.length > 0 ? body : undefined,
      })
      writeInjectResponse(ctx, response, `${method} ${route.pattern}`)
    })
    return { pattern: route.pattern, methods: route.methods, token }
  })
}
