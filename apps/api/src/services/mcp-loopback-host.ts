// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * L08 MCP Host 回环服务(2026-11-26)。
 *
 * 现状:`routes/mcp-extended.ts` 只是 Fastify 侧的一组路由,没有任何"host 自己的
 * 回环监听面"——因此既没有 per-route token,也没有生命周期注销语义(未注册的路径
 * 由 Fastify 的 404 兜底,注销后在飞请求无人管)。
 *
 * 本服务补的正是那一层,判据逐条可复核:
 *  1. **只绑回环**:`listen(0, '127.0.0.1')`,启动后从 `server.address()` 读回
 *     实际地址并断言必须是 127.0.0.1 —— 端口是 0(内核分配),不写死、不落公网;
 *  2. **per-route token**:每条注册路由自带随机 token(`x-ihui-route-token`),
 *     缺 token/错 token ⇒ 403;未注册路径 ⇒ 404(即便带了某条路由的 token 也 404,
 *     因为 token 只属于它的路径);
 *  3. **注销即撤**:`unregister(path)` 先 abort 该路由全部在飞请求(逐个计数),
 *     再从表里删;之后同路径一律 404;
 *  4. 计数器:requests / notFound / forbidden / abortedOnUnregister —— 拒绝与中止
 *     都是可读数字,不是"静默什么都不发生"。
 *
 * 业务路由:`mcp-business-routes.ts` 把 `routes/mcp-extended.ts` 的 12 条路由
 * 全部注册进本服务(支持 `/mcp/projects/:id` 这类参数路径),handler 通过注入的
 * Fastify `inject` 适配器回到既有路由,保证鉴权/DB 逻辑只有一份实现。
 */

import { randomBytes } from 'node:crypto'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { pathToFileURL } from 'node:url'

export const MCP_LOOPBACK_HOST = '127.0.0.1' as const
export const MCP_ROUTE_TOKEN_HEADER = 'x-ihui-route-token' as const
/** 回环 host 上的路径前缀;不在前缀下的注册在登记期就拒。 */
export const MCP_ROUTE_PREFIX = '/mcp/' as const

export interface McpRouteContext {
  req: IncomingMessage
  res: ServerResponse
  signal: AbortSignal
  /** `/mcp/projects/:id` 这类参数路径的捕获值。 */
  params: Readonly<Record<string, string>>
}

export type McpRouteHandler = (ctx: McpRouteContext) => Promise<void> | void

interface RouteEntry {
  pattern: string
  regex: RegExp
  paramNames: string[]
  token: string
  handler: McpRouteHandler
  inFlight: Set<AbortController>
}

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function compileRoutePattern(pattern: string): { regex: RegExp; paramNames: string[] } {
  const paramNames: string[] = []
  const source = pattern
    .split('/')
    .map((segment) => {
      if (segment.startsWith(':') && segment.length > 1) {
        paramNames.push(segment.slice(1))
        return '([^/]+)'
      }
      return escapeRegex(segment)
    })
    .join('/')
  return { regex: new RegExp(`^${source}$`), paramNames }
}

export interface McpLoopbackCounters {
  requests: number
  notFound: number
  forbidden: number
  abortedOnUnregister: number
}

export class McpRouteRegistrationError extends Error {
  readonly code: 'bad-path' | 'duplicate-path'
  constructor(code: 'bad-path' | 'duplicate-path', detail: string) {
    super(`${code}: ${detail}`)
    this.name = 'McpRouteRegistrationError'
    this.code = code
  }
}

const json = (res: ServerResponse, status: number, body: Record<string, unknown>): void => {
  if (res.writableEnded) return
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(body))
}

export class McpLoopbackHost {
  private readonly routes = new Map<string, RouteEntry>()
  private server: Server | null = null
  private boundPort: number | null = null
  private readonly counters: McpLoopbackCounters = {
    requests: 0,
    notFound: 0,
    forbidden: 0,
    abortedOnUnregister: 0,
  }

  register(path: string, handler: McpRouteHandler): string {
    if (!path.startsWith(MCP_ROUTE_PREFIX)) {
      throw new McpRouteRegistrationError('bad-path', `路径必须以 ${MCP_ROUTE_PREFIX} 开头`)
    }
    if (this.routes.has(path)) {
      throw new McpRouteRegistrationError('duplicate-path', path)
    }
    const { regex, paramNames } = compileRoutePattern(path)
    const token = randomBytes(24).toString('base64url')
    this.routes.set(path, { pattern: path, regex, paramNames, token, handler, inFlight: new Set() })
    return token
  }

  unregister(path: string): boolean {
    const entry = this.routes.get(path)
    if (!entry) return false
    for (const controller of entry.inFlight) {
      this.counters.abortedOnUnregister += 1
      controller.abort()
    }
    entry.inFlight.clear()
    this.routes.delete(path)
    return true
  }

  stats(): Readonly<McpLoopbackCounters> {
    return { ...this.counters }
  }

  get port(): number | null {
    return this.boundPort
  }

  private match(path: string): { entry: RouteEntry; params: Record<string, string> } | null {
    const exact = this.routes.get(path)
    if (exact) return { entry: exact, params: {} }
    for (const entry of this.routes.values()) {
      if (!entry.pattern.includes(':')) continue
      const matched = entry.regex.exec(path)
      if (!matched) continue
      const params: Record<string, string> = {}
      entry.paramNames.forEach((name, index) => {
        params[name] = decodeURIComponent(matched[index + 1] ?? '')
      })
      return { entry, params }
    }
    return null
  }

  private async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    this.counters.requests += 1
    const path = (req.url ?? '').split('?')[0] ?? ''
    const matched = this.match(path)
    if (!matched) {
      this.counters.notFound += 1
      json(res, 404, { error: 'route-not-registered' })
      return
    }
    const { entry, params } = matched
    const token = req.headers[MCP_ROUTE_TOKEN_HEADER]
    if (typeof token !== 'string' || token !== entry.token) {
      this.counters.forbidden += 1
      json(res, 403, { error: 'route-token-mismatch' })
      return
    }
    const controller = new AbortController()
    entry.inFlight.add(controller)
    res.on('close', () => entry.inFlight.delete(controller))
    try {
      await entry.handler({ req, res, signal: controller.signal, params })
    } catch (err) {
      if (!controller.signal.aborted) {
        json(res, 500, { error: 'route-handler-failed', detail: String(err) })
      }
    }
  }

  async start(): Promise<{ port: number; address: string }> {
    if (this.server) return { port: this.boundPort as number, address: MCP_LOOPBACK_HOST }
    const server = createServer((req, res) => {
      void this.handle(req, res)
    })
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject)
      // 端口 0 = 内核分配;host 固定回环,绝不允许通过 env 改成 0.0.0.0。
      server.listen(0, MCP_LOOPBACK_HOST, () => {
        server.off('error', reject)
        resolve()
      })
    })
    const address = server.address()
    if (!address || typeof address === 'string' || address.address !== MCP_LOOPBACK_HOST) {
      server.close()
      throw new Error(`MCP host 监听地址异常: ${JSON.stringify(address)}`)
    }
    this.server = server
    this.boundPort = address.port
    return { port: address.port, address: address.address }
  }

  async stop(): Promise<void> {
    for (const path of [...this.routes.keys()]) this.unregister(path)
    const server = this.server
    this.server = null
    this.boundPort = null
    if (!server) return
    await new Promise<void>((resolve) => server.close(() => resolve()))
  }
}

const isDirectRun =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  // 手动冒烟:`node .../mcp-loopback-host.js` 打印实际回环端口后退出。
  const host = new McpLoopbackHost()
  void host
    .start()
    .then(async ({ port, address }) => {
      process.stdout.write(`mcp-loopback-host ${address}:${port}\n`)
      await host.stop()
    })
    .catch((err) => {
      process.stderr.write(`mcp-loopback-host failed: ${String(err)}\n`)
      process.exitCode = 1
    })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
