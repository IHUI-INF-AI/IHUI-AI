// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import {
  createServer,
  type IncomingHttpHeaders,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from 'node:http'
import type { AddressInfo } from 'node:net'

/**
 * RP-19 / L08 MCP Host 回环服务。
 *
 * 判据（docs/benchmark-evidence/2026-11/wave2-ihui-landing-v2-2026-11-26.md L08）:
 *   listen(0,'127.0.0.1') + per-route token + 生命周期注销;未注册路由 404,
 *   注销后在飞请求 abort 并计数,端口不落公网。
 *
 * 本模块只做可独立验收的 Host 面:绑定、路由闭集、令牌比对、在飞中止与统计。
 * 与既有 `/v1/mcp/*` Fastify 网关的业务转发是两层,不在此重造工具调用/计费逻辑。
 *
 * 不变量:
 *   1. 绑定地址只能是 127.0.0.1,且端口由内核分配(0);bind 完复核实际地址,
 *      若系统给出非回环地址立即关闭并报错,绝不带病服务;
 *   2. 路由名是闭集且注册时一次性签发独立随机 token,未注册路径一律 404;
 *   3. token 比较用 sha256 定长缓冲 + timingSafeEqual,不做字符串短路比较;
 *   4. unregister 会 abort 该路由全部在飞请求并原子计数,close 会收掉全部在飞;
 *   5. 请求 body 有上限,超限直接 413,不把大包交给 handler。
 */

const LOOPBACK = '127.0.0.1'
const ROUTE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/
export const MCP_ROUTE_HEADER = 'x-mcp-route-token'
export const MCP_ROUTE_PREFIX = '/mcp/'
export const MAX_MCP_BODY_BYTES = 1024 * 1024

export interface McpRouteContext {
  signal: AbortSignal
  body: unknown
  headers: IncomingHttpHeaders
}

export interface McpRouteResult {
  status: number
  body: unknown
}

export type McpRouteHandler = (context: McpRouteContext) => Promise<McpRouteResult>

export interface McpRouteHandle {
  name: string
  /** 32 字节随机数,base64url 编码;只对当前路由有效。 */
  token: string
  unregister: () => number
}

export interface McpLoopbackStats {
  boundAddress: string
  boundPort: number
  registeredRoutes: number
  inFlight: number
  abortedAfterUnregister: number
  closed: boolean
}

interface RegisteredRoute {
  tokenHash: Buffer
  handler: McpRouteHandler
}

interface InFlightRecord {
  route: string
  controller: AbortController
}

export class McpRouteNameInvalidError extends Error {
  constructor(name: string) {
    super(`非法 MCP 路由名: ${JSON.stringify(name)}`)
    this.name = 'McpRouteNameInvalidError'
  }
}

export class McpHostStateError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'McpHostStateError'
  }
}

function tokenHash(token: string): Buffer {
  return createHash('sha256').update(token, 'utf8').digest()
}

function writeJson(res: ServerResponse, status: number, body: unknown): void {
  if (res.writableEnded) return
  try {
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify(body))
  } catch {
    // 客户端已断开:状态已由 abort/计数记录,不再二次写。
  }
}

export class McpLoopbackHost {
  private server: Server | null = null
  private readonly routes = new Map<string, RegisteredRoute>()
  private readonly inFlight = new Map<number, InFlightRecord>()
  private nextRequestId = 1
  private abortedAfterUnregister = 0
  private boundAddress = ''
  private boundPort = 0
  private closed = false

  get stats(): McpLoopbackStats {
    return {
      boundAddress: this.boundAddress,
      boundPort: this.boundPort,
      registeredRoutes: this.routes.size,
      inFlight: this.inFlight.size,
      abortedAfterUnregister: this.abortedAfterUnregister,
      closed: this.closed,
    }
  }

  /** 内核分配端口 + 强制本机回环;bind 后复核实际地址,非回环立即关闭。 */
  async start(): Promise<{ address: string; port: number }> {
    if (this.server || this.closed) {
      throw new McpHostStateError('MCP 回环 Host 已启动或已关闭,不可重复 start')
    }
    const server = createServer((req, res) => {
      void this.handle(req, res)
    })
    this.server = server
    try {
      await new Promise<void>((resolvePromise, rejectPromise) => {
        const onError = (error: Error) => rejectPromise(error)
        server.once('error', onError)
        server.listen(0, LOOPBACK, () => {
          server.off('error', onError)
          resolvePromise()
        })
      })
      const address = server.address()
      if (!address || typeof address === 'string' || address.address !== LOOPBACK) {
        await this.close()
        throw new McpHostStateError(
          `MCP Host 未绑定到回环地址(实际: ${typeof address === 'string' ? address : (address as AddressInfo | null)?.address ?? 'none'})`,
        )
      }
      this.boundAddress = address.address
      this.boundPort = address.port
      return { address: this.boundAddress, port: this.boundPort }
    } catch (error) {
      if (this.server === server) this.server = null
      throw error
    }
  }

  /** 注册一条命名路由;token 一次签发,不随注册重复发放。 */
  registerRoute(name: string, handler: McpRouteHandler): McpRouteHandle {
    if (!ROUTE_NAME.test(name)) throw new McpRouteNameInvalidError(name)
    if (this.closed) throw new McpHostStateError('MCP 回环 Host 已关闭')
    if (this.routes.has(name)) throw new McpHostStateError(`MCP 路由已注册: ${name}`)
    const token = randomBytes(32).toString('base64url')
    this.routes.set(name, { tokenHash: tokenHash(token), handler })
    return {
      name,
      token,
      unregister: () => this.unregisterRoute(name),
    }
  }

  /** 注销路由:先摘牌(后续请求拿不到 handler),再 abort 全部在飞并计数。 */
  unregisterRoute(name: string): number {
    this.routes.delete(name)
    let aborted = 0
    for (const [id, record] of this.inFlight) {
      if (record.route !== name) continue
      record.controller.abort()
      this.inFlight.delete(id)
      aborted += 1
    }
    this.abortedAfterUnregister += aborted
    // 在飞中止数独立返回:即使路由已不在册(极端竞态),仍要把中止数报给调用方。
    return aborted
  }

  /** 关闭 Host:abort 全部在飞、清空路由、释放端口。 */
  async close(): Promise<void> {
    if (this.closed) return
    this.closed = true
    for (const [id, record] of this.inFlight) {
      record.controller.abort()
      this.inFlight.delete(id)
    }
    this.routes.clear()
    const server = this.server
    this.server = null
    if (!server) return
    await new Promise<void>((resolvePromise) => {
      server.close(() => resolvePromise())
      server.closeAllConnections?.()
    })
    this.boundPort = 0
  }

  private async handle(
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<void> {
    const path = (req.url ?? '').split('?')[0] ?? ''
    if (!path.startsWith(MCP_ROUTE_PREFIX)) {
      writeJson(res, 404, { error: 'ROUTE_NOT_REGISTERED' })
      return
    }
    const name = path.slice(MCP_ROUTE_PREFIX.length)
    const route = this.routes.get(name)
    if (!route) {
      writeJson(res, 404, { error: 'ROUTE_NOT_REGISTERED' })
      return
    }
    if (req.method !== 'POST') {
      writeJson(res, 405, { error: 'METHOD_NOT_ALLOWED' })
      return
    }
    const supplied = req.headers[MCP_ROUTE_HEADER]
    const suppliedToken = Array.isArray(supplied) ? supplied[0] : supplied
    const actual = suppliedToken ? tokenHash(suppliedToken) : Buffer.alloc(0)
    if (actual.length !== route.tokenHash.length || !timingSafeEqual(actual, route.tokenHash)) {
      writeJson(res, 401, { error: 'INVALID_ROUTE_TOKEN' })
      return
    }

    let raw: string
    try {
      raw = await this.readBody(req, res)
    } catch {
      return
    }
    let body: unknown
    try {
      body = raw ? JSON.parse(raw) : null
    } catch {
      writeJson(res, 400, { error: 'INVALID_JSON_BODY' })
      return
    }

    const id = this.nextRequestId++
    const controller = new AbortController()
    this.inFlight.set(id, { route: name, controller })
    res.once('close', () => {
      // 客户端提前断连:释放槽位,但不计入"注销导致的中止"。
      if (!res.writableEnded) controller.abort()
      this.inFlight.delete(id)
    })
    try {
      const result = await route.handler({ signal: controller.signal, body, headers: req.headers })
      if (controller.signal.aborted) {
        writeJson(res, 409, { error: 'ROUTE_UNREGISTERED_WHILE_IN_FLIGHT' })
        return
      }
      writeJson(res, result.status, result.body)
    } catch (error) {
      if (controller.signal.aborted) {
        writeJson(res, 409, { error: 'ROUTE_UNREGISTERED_WHILE_IN_FLIGHT' })
      } else {
        writeJson(res, 500, {
          error: 'ROUTE_HANDLER_FAILED',
          message: error instanceof Error ? error.message : String(error),
        })
      }
    } finally {
      this.inFlight.delete(id)
    }
  }

  private async readBody(
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<string> {
    const chunks: Buffer[] = []
    let size = 0
    for await (const chunk of req) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      size += buffer.length
      if (size > MAX_MCP_BODY_BYTES) {
        writeJson(res, 413, { error: 'BODY_TOO_LARGE' })
        throw new McpHostStateError('MCP 请求体超限')
      }
      chunks.push(buffer)
    }
    return Buffer.concat(chunks).toString('utf8')
  }
}

/** 一次性便捷构造:start 失败也不会留下半开监听。 */
export async function createMcpLoopbackHost(): Promise<McpLoopbackHost> {
  const host = new McpLoopbackHost()
  await host.start()
  return host
}
