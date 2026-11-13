// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-193 回归锁(2026-11-13)。
 *
 * 病灶:POST /v1/threads/:threadId/runs 用 aiServiceFetch(request, ...) 把入站
 * Authorization(开发者 API Key,ihui_...)原样当 Bearer 转给 ai-service;ai-service
 * 的 jwt_auth 只接受 JWT ⇒ 该链路恒定 401/502,Assistants 运行整体不可用。
 *
 * 修复:改走既有服务间票据封装 aiServiceSystemFetch(注入系统 access token,sub=
 * system-worker),开发者 Key 不再出站;调用者身份仍经既有 x-user-id / x-tenant-id
 * 头透传,不丢。
 *
 * 本文件用 stub fetch 捕获**真实出站请求**,钉住:
 *   ① Authorization 是服务票据,绝不是开发者 Key,也不含 ihui_ 明文;
 *   ② 用户/租户身份经 x-user-id / x-tenant-id 头透传;
 *   ③ 请求体(指令 + 线程消息 + model)与响应结构不变。
 *
 * 隔离:只 mock 鉴权/计费/系统票据与全局 fetch,不触达真实 ai-service / PG / Redis。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance, type FastifyError } from 'fastify'
import type { Redis } from 'ioredis'
import type { ApiKeyPermission, AuthenticatedApiKey } from '@ihui/types'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.AI_SERVICE_URL ??= 'http://test-ai-service:8802'
})

const SERVICE_TICKET = 'f193-system-service-ticket'
const DEV_API_KEY = 'ihui_f193_developer_key_must_not_leave'
const USER_ID = 'user_f193'
const TENANT_ID = 'tenant_f193'

const LLM_REPLY = {
  content: 'f193-pong',
  usage: { prompt_tokens: 5, completion_tokens: 6, total_tokens: 11 },
}

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

// 计费:run 完成会 recordCall,打桩掉,别让测试去打真库
vi.mock('../src/services/relay-billing-service.js', () => ({
  recordCall: vi.fn().mockResolvedValue({ logId: 'log_f193' }),
  modelToProviderCode: vi.fn().mockReturnValue('openai'),
}))

// 服务间票据:固定值,便于断言出站形态
vi.mock('../src/utils/system-access-token.js', () => ({
  getSystemAccessToken: vi.fn(async () => SERVICE_TICKET),
}))

const SCOPES: ApiKeyPermission[] = [
  'assistants:read',
  'assistants:write',
  'threads:read',
  'threads:write',
  'runs:read',
  'runs:write',
]

function fakeKey(): AuthenticatedApiKey {
  return {
    id: 'ak_f193',
    userId: USER_ID,
    key: DEV_API_KEY,
    permissions: SCOPES,
    rateLimit: 100,
    expiresAt: null,
    allowedIps: null,
    allowedModels: null,
    maxTokensPerReq: null,
    blockedIps: null,
    rateLimit5h: null,
    rateLimit1d: null,
    rateLimit7d: null,
  }
}

vi.mock('../src/plugins/api-key-auth.js', () => ({
  authenticateApiKey: vi.fn(async (request: { apiKey?: AuthenticatedApiKey }) => {
    request.apiKey = fakeKey()
    return request.apiKey
  }),
  requireApiKeyAuth: vi.fn(async (request: { apiKey?: AuthenticatedApiKey }) => {
    request.apiKey = fakeKey()
  }),
  requireApiKeyPermission: vi.fn(() => async () => {}),
  requireApiKeyQuota: vi.fn(() => async () => {}),
}))

import v1Assistants from '../src/routes/v1-assistants'

// =============================================================================
// 内存假 Redis(只实现本文件路由族用到的命令,语义对齐真 Redis)
// =============================================================================

class FakeRedis {
  private readonly strs = new Map<string, string>()
  private readonly sets = new Map<string, string[]>()
  private readonly lists = new Map<string, string[]>()

  async get(key: string): Promise<string | null> {
    return this.strs.get(key) ?? null
  }
  async set(key: string, value: string, ..._args: (string | number)[]): Promise<'OK'> {
    this.strs.set(key, value)
    return 'OK'
  }
  async del(...keys: string[]): Promise<number> {
    let n = 0
    for (const key of keys) if (this.strs.delete(key)) n += 1
    return n
  }
  async expire(_key: string, _seconds: number): Promise<number> {
    return 1
  }
  async sadd(key: string, ...members: string[]): Promise<number> {
    const current = this.sets.get(key) ?? []
    let added = 0
    for (const member of members) {
      if (!current.includes(member)) {
        current.push(member)
        added += 1
      }
    }
    this.sets.set(key, current)
    return added
  }
  async smembers(key: string): Promise<string[]> {
    return [...(this.sets.get(key) ?? [])]
  }
  async rpush(key: string, ...values: string[]): Promise<number> {
    const current = this.lists.get(key) ?? []
    current.push(...values)
    this.lists.set(key, current)
    return current.length
  }
  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    const current = this.lists.get(key) ?? []
    if (start === 0 && stop === -1) return [...current]
    return current.slice(start, stop + 1)
  }
}

// =============================================================================
// 夹具
// =============================================================================

let app: FastifyInstance
const mockFetch = vi.fn()

function post(url: string, payload: unknown) {
  return app.inject({
    method: 'POST',
    url,
    headers: {
      'x-test-key-id': 'ak_f193',
      // 入站凭证是开发者 API Key —— F-193 前会被原样当 Bearer 转给 ai-service
      authorization: `Bearer ${DEV_API_KEY}`,
      'x-test-tenant-id': TENANT_ID,
    },
    payload: payload as Record<string, unknown>,
  })
}

/** 捕获的真实出站请求头 */
function outboundHeaders(): Headers {
  const init = mockFetch.mock.calls[0]?.[1] as RequestInit | undefined
  return new Headers((init?.headers ?? {}) as HeadersInit)
}

async function fixtureRun(): Promise<{ assistantId: string; threadId: string }> {
  const created = await post('/v1/assistants', {
    model: 'gpt-4o-mini',
    name: 'f193',
    instructions: '你是 F-193 助手',
  })
  expect(created.statusCode).toBe(200)
  const assistantId = created.json().id as string

  const thread = await post('/v1/threads', {
    messages: [{ role: 'user', content: 'hi' }],
  })
  expect(thread.statusCode).toBe(200)
  return { assistantId, threadId: thread.json().id as string }
}

beforeAll(async () => {
  app = Fastify({ logger: false })
  app.decorate('redis', new FakeRedis() as unknown as Redis)
  app.decorate('redisForQueue', undefined as unknown as Redis)
  app.addHook('onRequest', async (request) => {
    const tenant = request.headers['x-test-tenant-id']
    if (typeof tenant === 'string' && tenant) request.tenantId = tenant
  })
  app.setErrorHandler((err: FastifyError, _request, reply) => {
    const statusCode = (err as Error & { statusCode?: number }).statusCode ?? 500
    reply.status(statusCode).send({ code: statusCode, message: err.message })
  })
  await app.register(v1Assistants, { prefix: '/v1' })
  await app.ready()
})

afterAll(async () => {
  await app.close()
})

beforeEach(() => {
  mockFetch.mockReset()
  mockFetch.mockImplementation(
    async () =>
      ({
        ok: true,
        status: 200,
        json: async () => LLM_REPLY,
        text: async () => '',
      }) as unknown as Response,
  )
  vi.stubGlobal('fetch', mockFetch)
})

describe('POST /v1/threads/:threadId/runs 用服务票据调用 ai-service — F-193', () => {
  it('① 出站 Authorization 是服务票据,不是开发者 API Key', async () => {
    const { assistantId, threadId } = await fixtureRun()
    const res = await post(`/v1/threads/${threadId}/runs`, { assistant_id: assistantId })
    expect(res.statusCode).toBe(200)

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const url = String(mockFetch.mock.calls[0]?.[0])
    expect(url).toContain('/api/llm/complete')
    expect(url.startsWith(process.env.AI_SERVICE_URL as string)).toBe(true)

    const auth = outboundHeaders().get('authorization') ?? ''
    expect(auth).toBe(`Bearer ${SERVICE_TICKET}`)
    expect(auth).not.toBe(`Bearer ${DEV_API_KEY}`)
    expect(auth).not.toContain('ihui_')
    expect(auth).not.toContain(DEV_API_KEY)
  })

  it('② 用户/租户身份仍经既有 x-user-id / x-tenant-id 头透传', async () => {
    const { assistantId, threadId } = await fixtureRun()
    const res = await post(`/v1/threads/${threadId}/runs`, { assistant_id: assistantId })
    expect(res.statusCode).toBe(200)

    const headers = outboundHeaders()
    expect(headers.get('x-user-id')).toBe(USER_ID)
    expect(headers.get('x-tenant-id')).toBe(TENANT_ID)

    // 请求体形态不变:assistant 指令 + 线程消息 + model
    const init = mockFetch.mock.calls[0]?.[1] as RequestInit
    const body = JSON.parse(String(init.body)) as {
      messages: Array<{ role: string; content: string }>
      model: string
    }
    expect(body.model).toBe('gpt-4o-mini')
    expect(body.messages).toEqual([
      { role: 'system', content: '你是 F-193 助手' },
      { role: 'user', content: 'hi' },
    ])
  })

  it('③ 响应结构不变:run 对象 + run_ref,内部 userId 不外泄', async () => {
    const { assistantId, threadId } = await fixtureRun()
    const res = await post(`/v1/threads/${threadId}/runs`, { assistant_id: assistantId })
    expect(res.statusCode).toBe(200)
    const body = res.json() as Record<string, unknown>
    expect(body.object).toBe('thread.run')
    expect(body.status).toBe('completed')
    expect(body.usage).toEqual(LLM_REPLY.usage)
    expect(body.run_ref).toMatch(/^irun_/)
    expect(body.userId).toBeUndefined()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
