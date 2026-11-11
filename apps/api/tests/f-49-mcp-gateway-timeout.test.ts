// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
/**
 * F-49 回归 —— apps/api/src/routes/v1-mcp-gateway.ts 转发 ai-service 的 fetch 必须带 deadline。
 *
 * 缺陷：网关直接 `fetch(url, { method, headers, body })`,无 AbortSignal/超时;
 * ai-service 卡死/半开(不回 FIN)时连接永久占用,socket/内存随并发累积。
 *
 * 本文件钉住三件事：
 *  ① 走的是仓内既有 deadline 实现(utils/ai-service-fetch 的 aiServiceFetch →
 *     fetchWithDeadline,默认 60s + AiServiceTimeoutError),不是本文件另写的超时;
 *  ② 上游超时映射 504,且日志带 requestId(能与对端请求对上);
 *  ③ 既有的 502 / 5015 错误映射与转发协议(路径 + 内部 JWT)不被改动。
 *
 * 零连库、零真实网络:fetch 全程 mock。
 */
import Fastify, { type FastifyBaseLogger, type FastifyInstance } from 'fastify'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  apiKey: {
    id: 'key-1',
    userId: 'user-1',
    key: 'sk-test-key',
    permissions: [] as string[],
    rateLimit: 100,
    allowedModels: null as string[] | null,
  } as Record<string, unknown> | null,
  fetchMode: 'ok' as 'ok' | 'timeout' | 'neterr' | 'boom',
  captured: [] as Array<{ url: string; headers: Record<string, string>; signal?: AbortSignal | null }>,
}))

vi.mock('@ihui/auth', () => ({
  signAccessToken: async () => 'test-internal-jwt',
  // 2026-11-11:生产 authenticateInner 已改 fail-closed——getTokenBlacklist() 返回 null
  // 即判 token「已吊销」⇒ 401。测试环境 createBlacklist 内部 new IORedis 恒连不上 ⇒ null
  // ⇒ 合法 token 被 401。覆盖为内存假黑名单(has 恒 false)。不回退生产 fail-closed 语义。
  createBlacklist: vi.fn(() => ({
    async has() {
      return false
    },
    async add() {},
    async revoke() {},
  })),
}))

vi.mock('../src/plugins/api-key-auth.js', () => ({
  requireApiKeyAuth: async (request: Record<string, unknown>) => {
    if (state.apiKey) request.apiKey = state.apiKey
  },
  modelInList: () => true,
}))

vi.mock('../src/utils/capability-guard.js', () => ({
  requireCapabilityRules: () => async () => {},
}))

vi.mock('../src/services/relay-billing-service.js', () => ({
  recordCall: async () => {},
}))

const { config } = await import('../src/config/index.js')
const { default: v1McpGatewayRoutes } = await import('../src/routes/v1-mcp-gateway.js')
const { AiServiceTimeoutError, DEFAULT_AI_SERVICE_TIMEOUT_MS } = await import(
  '../src/utils/ai-service-fetch.js'
)

interface CapturedLog {
  level: string
  obj: Record<string, unknown>
  msg: string
}

/** 假 logger:只为断言超时时确实记了 requestId(不落真实 pino)。 */
function makeCaptureLogger(sink: CapturedLog[]): Record<string, unknown> {
  const emit = (level: string) => (obj: unknown, msg?: string) => {
    sink.push({ level, obj: (obj ?? {}) as Record<string, unknown>, msg: String(msg ?? '') })
  }
  const logger: Record<string, unknown> = {
    trace: emit('trace'),
    debug: emit('debug'),
    info: emit('info'),
    warn: emit('warn'),
    error: emit('error'),
    fatal: emit('fatal'),
  }
  logger.child = () => logger
  return logger
}

let app: FastifyInstance
let logs: CapturedLog[]
const originalFetch = globalThis.fetch

beforeEach(async () => {
  state.apiKey = {
    id: 'key-1',
    userId: 'user-1',
    key: 'sk-test-key',
    permissions: [],
    rateLimit: 100,
    allowedModels: null,
  }
  state.fetchMode = 'ok'
  state.captured = []
  logs = []

  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    state.captured.push({
      url: String(input),
      headers: (init?.headers ?? {}) as Record<string, string>,
      signal: init?.signal,
    })
    if (state.fetchMode === 'timeout') {
      // 与 fetchWithDeadline 到点 abort 后的抛出形态一致(AiServiceTimeoutError)
      throw new AiServiceTimeoutError('/api/mcp/tools', DEFAULT_AI_SERVICE_TIMEOUT_MS)
    }
    if (state.fetchMode === 'neterr') throw new TypeError('fetch failed')
    if (state.fetchMode === 'boom') return new Response('boom', { status: 500 })
    return new Response(JSON.stringify({ tools: [], count: 0 }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }) as typeof fetch

  // loggerInstance:Fastify v5 收自定义 logger 实例的通道
  app = Fastify({ loggerInstance: makeCaptureLogger(logs) as unknown as FastifyBaseLogger })
  await app.register(v1McpGatewayRoutes)
  await app.ready()
})

afterEach(async () => {
  globalThis.fetch = originalFetch
  await app.close()
})

describe('F-49 转发走的是带 deadline 的实现', () => {
  it('源码复用 aiServiceFetch(fetchWithDeadline),且不再有裸 fetch / 自建 AbortSignal.timeout', async () => {
    const { readFileSync } = await import('node:fs')
    const { fileURLToPath } = await import('node:url')
    const src = readFileSync(
      fileURLToPath(new URL('../src/routes/v1-mcp-gateway.ts', import.meta.url)),
      'utf8',
    )
    expect(src).toContain('aiServiceFetch')
    expect(src).toContain('ai-service-fetch')
    expect(src).toContain('AiServiceTimeoutError')
    expect(src).not.toContain('AbortSignal.timeout')
    expect(src).not.toMatch(/await\s+fetch\(/)
  })

  it('运行期:出站 fetch 收到 AbortSignal(deadline 生效),路径与内部 JWT 不变', async () => {
    const res = await app.inject({ method: 'GET', url: '/v1/mcp/tools' })
    expect(res.statusCode).toBe(200)
    const call = state.captured[0]
    expect(call?.url).toBe(`${config.AI_SERVICE_URL}/api/mcp/tools`)
    expect(call?.headers.Authorization).toBe('Bearer test-internal-jwt')
    expect(call?.signal).toBeInstanceOf(AbortSignal)
    expect(call?.signal?.aborted).toBe(false)
  })
})

describe('F-49 超时映射与 requestId', () => {
  it('上游超时(deadline 到点)→ 504 + code 504,消息含超时', async () => {
    state.fetchMode = 'timeout'
    const res = await app.inject({ method: 'GET', url: '/v1/mcp/tools' })
    expect(res.statusCode).toBe(504)
    expect(res.json()).toMatchObject({ code: 504 })
    expect((res.json() as { message: string }).message).toContain('超时')
  })

  it('超时日志带 requestId(网关日志能与对端请求对上)', async () => {
    state.fetchMode = 'timeout'
    const res = await app.inject({ method: 'GET', url: '/v1/mcp/tools' })
    expect(res.statusCode).toBe(504)
    const warn = logs.find((l) => l.level === 'warn' && l.msg.includes('超时'))
    expect(warn).toBeDefined()
    expect(typeof warn?.obj.requestId).toBe('string')
    expect((warn?.obj.requestId as string).length).toBeGreaterThan(0)
    expect(warn?.obj.requestId).not.toBe('undefined')
    expect(warn?.obj.code).toBe(504)
  })

  it('网络错误仍是 503 + 5015(与超时区分,不被吞成 504)', async () => {
    state.fetchMode = 'neterr'
    const res = await app.inject({ method: 'GET', url: '/v1/mcp/tools' })
    expect(res.statusCode).toBe(503)
    expect(res.json()).toMatchObject({ code: 5015 })
  })

  it('上游 5xx → 502 + code 502(既有 error 形状不变)', async () => {
    state.fetchMode = 'boom'
    const res = await app.inject({ method: 'GET', url: '/v1/mcp/tools' })
    expect(res.statusCode).toBe(502)
    expect(res.json()).toMatchObject({ code: 502 })
  })
})
