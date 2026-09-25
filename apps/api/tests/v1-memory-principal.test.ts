// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// (水印载荷由 scripts/watermark.mjs 注入管理,此处占位)

/**
 * /v1/memory* 转发主体隔离测试(2026-09-25 立,v1 租户隔离收口)。
 *
 * 背景:v1-knowledge-tools.ts 的 memory 族转发此前走 aiServiceSystemFetch
 * (sub 恒为 'system-worker'),而 ai-service 侧 /api/memory* 已按
 * require_request_user_id 把记忆桶归属到令牌主体 —— 全部 v1 API-key 租户
 * 共享同一个 system-worker 桶(v1 租户互见)。收口后必须以
 * mintInternalJwt(apiKey.userId) 注入真实用户主体。
 *
 * 判据:拦截 globalThis.fetch,取真正发给 ai-service 的 Authorization Bearer,
 * 用与 ai-service 完全相同的校验规则(HS256 + issuer 'ihui-ai' +
 * audience 'ihui-ai-users')真实验签解出 payload,断言:
 *   - sub === 调用方 API-key 的 userId(不是 'system-worker');
 *   - API-key A 与 API-key B 得到不同的 sub(A/B 互见性被切断);
 *   - 出站 path 与各端点契约一致。
 * JWT 由真实 mintInternalJwt → signAccessToken 签发(零 mock);
 * 鉴权插件 mock 沿用 tests/ 既有形态(注入 apiKey 上下文,见
 * v1-message-bus-contract.test.ts,本文件不 mock 鉴权语义本身)。
 *
 * 主体豁免登记:GET /memory/working 保持 system-worker —— ai-service 侧
 * /memory/working 按 session_id 作用域(无 user_id 参数、无
 * require_request_user_id),用户主体无属主语义,用例把它钉死在现状上。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { jwtVerify } from 'jose'
import Fastify from 'fastify'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.AI_SERVICE_URL ??= 'http://test-ai-service:8802'
})

// mock db:本文件只验 HTTP 契约,任何用例都不得触库(§5 测试隔离铁律)
vi.mock('../src/db/index.js', () => ({
  db: {
    execute: vi.fn().mockResolvedValue([]),
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  dbRead: { select: vi.fn() },
}))

// mock 鉴权插件:注入 apiKey 上下文并放行配额闸。
// 用 hoisted 可变状态让用例逐条切换 API-key A / B(真实 requireCapability 读
// request.apiKey.permissions,permissions ['*'] 全能力放行)。
const authState = vi.hoisted(() => ({
  apiKey: {
    id: 'ak_mem_a',
    userId: 'user-mem-A',
    key: 'ihui_test_key',
    permissions: ['*'],
    rateLimit: 100,
  },
}))
vi.mock('../src/plugins/api-key-auth.js', () => ({
  requireApiKeyAuth: vi.fn(async (request: { apiKey?: typeof authState.apiKey }) => {
    request.apiKey = authState.apiKey
  }),
  requireApiKeyPermission: vi.fn(() => async () => {}),
  requireApiKeyQuota: vi.fn(() => async () => {}),
}))

import v1KnowledgeToolsRoutes from '../src/routes/v1-knowledge-tools'

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!)

const API_KEY_A = {
  id: 'ak_mem_a',
  userId: 'user-mem-A',
  key: 'ihui_test_key',
  permissions: ['*'],
  rateLimit: 100,
}
const API_KEY_B = {
  id: 'ak_mem_b',
  userId: 'user-mem-B',
  key: 'ihui_test_key',
  permissions: ['*'],
  rateLimit: 100,
}

/** 拦截到的出站 fetch 调用。 */
interface OutboundCall {
  url: string
  init: RequestInit
}

let outbound: OutboundCall[]
const originalFetch = globalThis.fetch

function mockFetchOnce(): void {
  outbound = []
  globalThis.fetch = vi.fn().mockImplementation(async (url: string, init: RequestInit) => {
    outbound.push({ url: String(url), init })
    return {
      ok: true,
      status: 200,
      json: async () => ({ code: 0, message: 'ok', data: { items: [], data: [], memories: [] } }),
      text: async () => '',
    } as unknown as Response
  }) as unknown as typeof globalThis.fetch
}

/**
 * 从出站 Authorization 解出 JWT payload —— 与 ai-service jwt_auth 中间件同规则:
 * HS256 + issuer 'ihui-ai' + audience 'ihui-ai-users'(拒绝 refresh 型 type)。
 */
async function decodeOutboundSubject(): Promise<string> {
  expect(outbound.length).toBe(1)
  const headers = new Headers(outbound[0].init.headers)
  const auth = headers.get('Authorization') ?? ''
  expect(auth.startsWith('Bearer ')).toBe(true)
  const { payload } = await jwtVerify(auth.slice(7), JWT_SECRET, {
    issuer: 'ihui-ai',
    audience: 'ihui-ai-users',
  })
  return String(payload.sub)
}

function expectOutboundPath(path: string): void {
  expect(outbound[0].url).toBe(`${process.env.AI_SERVICE_URL}${path}`)
}

async function buildServer(): Promise<ReturnType<typeof Fastify>> {
  const server = Fastify({ logger: false })
  server.setErrorHandler((err, _req, reply) => {
    const statusCode = (err as Error & { statusCode?: number }).statusCode ?? 500
    reply.status(statusCode).send({ code: statusCode, message: err.message })
  })
  await server.register(v1KnowledgeToolsRoutes, { prefix: '/v1' })
  await server.ready()
  return server
}

beforeEach(() => {
  mockFetchOnce()
})

afterEach(async () => {
  globalThis.fetch = originalFetch
  vi.clearAllMocks()
})

// =============================================================================
// 1. 写路径:POST /memory(save)—— API-key A/B 分别得到各自 sub
// =============================================================================

describe('POST /v1/memory 保存记忆 — 出站主体 = API-key 的 userId', () => {
  it('API-key A:ai-service 收到的 sub = A 的 userId,不是 system-worker', async () => {
    authState.apiKey = API_KEY_A
    const server = await buildServer()
    const res = await server.inject({
      method: 'POST',
      url: '/v1/memory',
      headers: { 'x-api-key': 'ihui_test_key' },
      payload: { content: 'A 的记忆' },
    })
    expect(res.statusCode).toBe(200)
    expectOutboundPath('/api/memory/save')
    expect(await decodeOutboundSubject()).toBe('user-mem-A')
    await server.close()
  })

  it('API-key B:sub = B 的 userId(与 A 不同,租户桶隔离)', async () => {
    authState.apiKey = API_KEY_B
    const server = await buildServer()
    const res = await server.inject({
      method: 'POST',
      url: '/v1/memory',
      headers: { 'x-api-key': 'ihui_test_key' },
      payload: { content: 'B 的记忆' },
    })
    expect(res.statusCode).toBe(200)
    expect(await decodeOutboundSubject()).toBe('user-mem-B')
    await server.close()
  })

  it('缺 content 返回 400 且不出站', async () => {
    authState.apiKey = API_KEY_A
    const server = await buildServer()
    const res = await server.inject({
      method: 'POST',
      url: '/v1/memory',
      headers: { 'x-api-key': 'ihui_test_key' },
      payload: {},
    })
    expect(res.statusCode).toBe(400)
    expect(outbound.length).toBe(0)
    await server.close()
  })
})

// =============================================================================
// 2. 读/检索/删除路径 —— 逐端点断言出站 path 与 sub
// =============================================================================

describe('GET /v1/memory 召回记忆 — 用户主体', () => {
  it('sub = userId,path = /api/memory/recall', async () => {
    authState.apiKey = API_KEY_A
    const server = await buildServer()
    const res = await server.inject({
      method: 'GET',
      url: '/v1/memory?type=working',
      headers: { 'x-api-key': 'ihui_test_key' },
    })
    expect(res.statusCode).toBe(200)
    expectOutboundPath('/api/memory/recall?type=working')
    expect(await decodeOutboundSubject()).toBe('user-mem-A')
    await server.close()
  })
})

describe('POST /v1/memory/search 语义搜索 — 用户主体', () => {
  it('sub = userId,path = /api/agents/memory/search', async () => {
    authState.apiKey = API_KEY_B
    const server = await buildServer()
    const res = await server.inject({
      method: 'POST',
      url: '/v1/memory/search',
      headers: { 'x-api-key': 'ihui_test_key' },
      payload: { query: '关键词', topK: 5 },
    })
    expect(res.statusCode).toBe(200)
    expectOutboundPath('/api/agents/memory/search')
    expect(await decodeOutboundSubject()).toBe('user-mem-B')
    await server.close()
  })
})

describe('POST /v1/memory/dream Dream 梦境 — 用户主体', () => {
  it('sub = userId,path = /api/memory/dream', async () => {
    authState.apiKey = API_KEY_A
    const server = await buildServer()
    const res = await server.inject({
      method: 'POST',
      url: '/v1/memory/dream',
      headers: { 'x-api-key': 'ihui_test_key' },
      payload: { mode: 'consolidate' },
    })
    expect(res.statusCode).toBe(200)
    expectOutboundPath('/api/memory/dream')
    expect(await decodeOutboundSubject()).toBe('user-mem-A')
    await server.close()
  })
})

describe('DELETE /v1/memory 遗忘记忆 — 用户主体', () => {
  it('sub = userId,path = /api/memory/forget', async () => {
    authState.apiKey = API_KEY_B
    const server = await buildServer()
    const res = await server.inject({
      method: 'DELETE',
      url: '/v1/memory',
      headers: { 'x-api-key': 'ihui_test_key' },
      payload: { memoryId: 'mem-001' },
    })
    expect(res.statusCode).toBe(200)
    expectOutboundPath('/api/memory/forget')
    expect(await decodeOutboundSubject()).toBe('user-mem-B')
    await server.close()
  })
})

describe('GET /v1/memory/episodic 情景记忆 — 用户主体', () => {
  it('sub = userId,path = /api/memory/episodic', async () => {
    authState.apiKey = API_KEY_A
    const server = await buildServer()
    const res = await server.inject({
      method: 'GET',
      url: '/v1/memory/episodic',
      headers: { 'x-api-key': 'ihui_test_key' },
    })
    expect(res.statusCode).toBe(200)
    expectOutboundPath('/api/memory/episodic')
    expect(await decodeOutboundSubject()).toBe('user-mem-A')
    await server.close()
  })
})

describe('GET /v1/memory/procedural 程序记忆 — 用户主体', () => {
  it('sub = userId,path = /api/memory/procedural', async () => {
    authState.apiKey = API_KEY_B
    const server = await buildServer()
    const res = await server.inject({
      method: 'GET',
      url: '/v1/memory/procedural',
      headers: { 'x-api-key': 'ihui_test_key' },
    })
    expect(res.statusCode).toBe(200)
    expectOutboundPath('/api/memory/procedural')
    expect(await decodeOutboundSubject()).toBe('user-mem-B')
    await server.close()
  })
})

// =============================================================================
// 3. 豁免登记:GET /memory/working 保持 system-worker(session 作用域,无属主语义)
// =============================================================================

describe('GET /v1/memory/working 工作记忆 — 主体豁免(session 作用域)', () => {
  it('保持系统通道 sub = system-worker(豁免理由见路由处注释)', async () => {
    authState.apiKey = API_KEY_A
    const server = await buildServer()
    const res = await server.inject({
      method: 'GET',
      url: '/v1/memory/working',
      headers: { 'x-api-key': 'ihui_test_key' },
    })
    expect(res.statusCode).toBe(200)
    expectOutboundPath('/api/memory/working')
    expect(await decodeOutboundSubject()).toBe('system-worker')
    await server.close()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
