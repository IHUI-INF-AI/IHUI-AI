// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import type { ApiKeyPermission, AuthenticatedApiKey, CapabilityEntry } from '@ihui/types'

/**
 * O5「对外开放面的限流与审计归因」— 审计归因 + 参数摘要脱敏。
 *
 * 覆盖:
 *  1. 开放面(/v1)请求**确实落审计**(此前一条都不落),且带齐 apiKeyId / capability.scope /
 *     dataClass / risk / method / url / routePattern / statusCode / durationMs;
 *  2. 参数摘要走既有脱敏(api_key / password / token 掩码),且**不落 prompt 正文、不落密钥**;
 *  3. /v1 无 API Key 但带 JWT 会话时,审计仍能归因到 userId;匿名探测也留痕;
 *  4. api-logger 覆盖开放面并把 userId 归因到 key 归属人(此前 /v1 整段不在表内)。
 *
 * 全部 mock DB 出口(service / search-queries / system-queries),不连生产 8810/8811。
 */

// ---------- mock:审计/日志落库出口(避免 import 真 db → 连生产库) ----------
const { mockRecordAuditLog, mockAddAuditLog, mockAddApiLogsBatch } = vi.hoisted(() => ({
  mockRecordAuditLog: vi.fn<(p: unknown) => Promise<string | undefined>>(),
  mockAddAuditLog: vi.fn<(p: unknown) => Promise<void>>(),
  mockAddApiLogsBatch: vi.fn<(p: unknown) => Promise<void>>(),
}))

vi.mock('../src/services/audit-log-service.js', () => ({
  recordAuditLog: mockRecordAuditLog,
}))

vi.mock('../src/db/search-queries.js', () => ({
  addAuditLog: mockAddAuditLog,
}))

vi.mock('../src/db/system-queries.js', () => ({
  addApiLogsBatch: mockAddApiLogsBatch,
}))

// ---------- mock:config(避免真实 env 校验;API_LOG_* 走可控值) ----------
vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    DATABASE_URL: 'postgres://mock:mock@localhost:5432/mock',
    REDIS_URL: 'redis://localhost:6379/0',
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
    CREDENTIALS_ENCRYPTION_KEY: 'a'.repeat(32),
    AUDIT_LOG_HMAC_SECRET: 'k'.repeat(40),
    API_LOG_ENABLED: true,
    API_LOG_SAMPLE_RATE: 1,
    // batch=1 → 每条日志立刻走一次 flush,便于断言 mock 调用
    API_LOG_BATCH_SIZE: 1,
    API_LOG_FLUSH_INTERVAL_MS: 60_000,
  },
}))

import auditLoggerPlugin from '../src/plugins/audit-logger.js'
import auditPlugin from '../src/plugins/audit.js'
import apiLoggerPlugin from '../src/plugins/api-logger.js'

// ---------- fixtures ----------
const API_KEY_ID = '7c1f2b34-0000-4000-8000-0000000000a1'
const KEY_OWNER_ID = '7c1f2b34-0000-4000-8000-0000000000b2'
const SESSION_USER_ID = '7c1f2b34-0000-4000-8000-0000000000c3'
/** 哨兵值:断言它绝不出现在审计 metadata / api_logs 里(= 不落密钥)。 */
const SECRET_KEY_VALUE = 'ihui_CONFIDENTIAL_raw_key_never_log_me'
/** 哨兵值:开放面断言它绝不出现在审计 metadata 里(= 不落 prompt 原文)。 */
const PROMPT_TEXT = '这是绝不该出现在审计里的机密提示词正文'

function makeApiKey(scope: ApiKeyPermission): AuthenticatedApiKey {
  return {
    id: API_KEY_ID,
    userId: KEY_OWNER_ID,
    key: SECRET_KEY_VALUE,
    permissions: [scope],
    rateLimit: 60,
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

/** 与 packages/types/src/capability-catalog.ts 的 chat:write 条目同值。 */
function makeCapability(over: Partial<CapabilityEntry> = {}): CapabilityEntry {
  const base: CapabilityEntry = {
    scope: 'chat:write',
    domain: 'chat',
    dataClass: 'compute',
    risk: 'high',
    billable: true,
    thirdPartyEligible: true,
    idempotencyRequired: true,
    description: '对话补全(直接产生模型费用)',
    routes: ['POST /v1/chat/completions'],
  }
  return { ...base, ...over }
}

/** 让插件里的 setImmediate 异步落库跑完。 */
async function drainAsync(): Promise<void> {
  for (let i = 0; i < 5; i++) await new Promise((r) => setImmediate(r))
}

interface AuditCall {
  userId?: string
  action: string
  resourceType?: string
  result?: string
  ip?: string
  metadata: Record<string, unknown>
}

function lastAuditCall(): AuditCall {
  const calls = mockRecordAuditLog.mock.calls
  const last = calls[calls.length - 1]
  if (!last) throw new Error('recordAuditLog 未被调用')
  return last[0] as AuditCall
}

describe('O5 开放面审计归因(plugins/audit-logger + audit + api-logger)', () => {
  let server: FastifyInstance

  beforeAll(async () => {
    server = Fastify({ logger: false })
    await server.register(auditLoggerPlugin)
    await server.register(auditPlugin)
    await server.register(apiLoggerPlugin)

    // 开放面:带 key(模拟 api-key-auth + capability-guard 的注入结果)
    server.post(
      '/v1/chat/completions',
      {
        preHandler: async (req) => {
          req.apiKey = makeApiKey('chat:write')
          req.capability = makeCapability()
        },
      },
      async (_req, reply) => reply.send({ id: 'ok' }),
    )

    // 开放面:无 key、但有 JWT 会话
    server.get(
      '/v1/models',
      {
        preHandler: async (req) => {
          req.userId = SESSION_USER_ID
        },
      },
      async (_req, reply) => reply.send({ data: [] }),
    )

    // 开放面:完全匿名(探测流量)
    server.post('/v1/embeddings', async (_req, reply) =>
      reply.status(401).send({ code: 401, message: 'no key' }),
    )

    // 站内会话链路(脱敏后的原值仍入 metadata,兼容既有读端)
    server.post(
      '/api/users',
      {
        preHandler: async (req) => {
          req.userId = SESSION_USER_ID
        },
      },
      async (_req, reply) => reply.status(201).send({ code: 0 }),
    )

    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockRecordAuditLog.mockResolvedValue('audit-id')
    mockAddAuditLog.mockResolvedValue(undefined)
    mockAddApiLogsBatch.mockResolvedValue(undefined)
  })

  it('开放面 POST /v1/chat/completions 落审计并带齐归因字段', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/v1/chat/completions',
      payload: { model: 'gpt-4o', messages: [{ role: 'user', content: PROMPT_TEXT }] },
    })
    expect(res.statusCode).toBe(200)
    await drainAsync()

    const call = lastAuditCall()
    expect(call.action).toBe('gateway.invoke')
    expect(call.resourceType).toBe('chat')
    expect(call.result).toBe('success')
    const md = call.metadata
    expect(md.apiKeyId).toBe(API_KEY_ID)
    expect(md.apiKeyOwnerId).toBe(KEY_OWNER_ID)
    expect(md.capabilityScope).toBe('chat:write')
    expect(md.capabilityDataClass).toBe('compute')
    expect(md.capabilityRisk).toBe('high')
    expect(md.capabilityBillable).toBe(true)
    expect(md.openSurface).toBe(true)
    expect(md.method).toBe('POST')
    expect(md.url).toBe('/v1/chat/completions')
    expect(md.routePattern).toBe('/v1/chat/completions')
    expect(md.statusCode).toBe(200)
    expect(typeof md.durationMs).toBe('number')
    expect(md.durationMs as number).toBeGreaterThanOrEqual(0)
  })

  it('参数摘要走既有脱敏:敏感字段 masked,正文只留形状', async () => {
    await server.inject({
      method: 'POST',
      url: '/v1/chat/completions',
      payload: {
        model: 'gpt-4o',
        api_key: SECRET_KEY_VALUE,
        password: 'P@ssw0rd!',
        nested: { access_token: 'tok-abc', keep: 'x' },
        messages: [{ role: 'user', content: PROMPT_TEXT }],
      },
    })
    await drainAsync()

    const md = lastAuditCall().metadata
    const params = md.params as Record<string, unknown>
    // 命中敏感规则的键:既不落值也不落长度
    expect(params.api_key).toBe('masked')
    expect(params.password).toBe('masked')
    const nested = params.nested as Record<string, string>
    expect(nested.access_token).toBe('masked')
    expect(nested.keep).toBe('str(len=1)')
    // 正文:只留条数与形状,不留内容
    const messages = params.messages as string
    expect(messages).toContain('arr(len=1')
    expect(messages).toContain(`str(len=${PROMPT_TEXT.length})`)
    expect(params.model).toBe('str(len=6)')

    const serialized = JSON.stringify(md)
    expect(serialized).not.toContain(PROMPT_TEXT)
    expect(serialized).not.toContain(SECRET_KEY_VALUE)
    expect(serialized).not.toContain('P@ssw0rd!')
    expect(serialized).not.toContain('tok-abc')
  })

  it('开放面深层嵌套正文一律降维,超出深度直接折叠(不留原文)', async () => {
    await server.inject({
      method: 'POST',
      url: '/v1/chat/completions',
      payload: {
        model: 'gpt-4o',
        // 6 层嵌套 + 数组,超过 SUMMARY_MAX_DEPTH:最深一层应折叠,不得带出原文
        a: { b: { c: { d: { e: { f: PROMPT_TEXT } } } } },
        messages: Array.from({ length: 5 }, (_, i) => ({ role: 'user', content: `${PROMPT_TEXT}${i}` })),
      },
    })
    await drainAsync()

    const serialized = JSON.stringify(lastAuditCall().metadata)
    expect(serialized).not.toContain(PROMPT_TEXT)
    expect(serialized).toContain('nested(...)')
    // 数组摘要取的是首元素形状 + 总条数,5 条正文都不可见
    expect(serialized).toContain('arr(len=5')
  })

  it('站内 /api 写请求:审计走同一套脱敏(值为 *** 掩码,非原文)', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/users',
      payload: { name: '张三', password: 'P@ssw0rd!', api_key: SECRET_KEY_VALUE },
    })
    expect(res.statusCode).toBe(201)
    await drainAsync()

    const call = lastAuditCall()
    expect(call.userId).toBe(SESSION_USER_ID)
    expect(call.action).toBe('user.create')
    const md = call.metadata
    expect(md.apiKeyId).toBeNull()
    const params = md.params as Record<string, string>
    expect(params.name).toBe('张三')
    expect(params.password).toBe('***')
    expect(params.api_key).toBe('***')
    expect(JSON.stringify(md)).not.toContain(SECRET_KEY_VALUE)
    expect(JSON.stringify(md)).not.toContain('P@ssw0rd!')
  })

  it('/v1 无 API Key 时审计仍可归因到 userId(JWT 会话)', async () => {
    const res = await server.inject({ method: 'GET', url: '/v1/models' })
    expect(res.statusCode).toBe(200)
    await drainAsync()

    const call = lastAuditCall()
    const md = call.metadata
    expect(call.userId).toBe(SESSION_USER_ID)
    expect(md.apiKeyId).toBeNull()
    expect(md.method).toBe('GET')
    expect(md.url).toBe('/v1/models')
    expect(md.openSurface).toBe(true)
    expect(call.action).toBe('gateway.read')
  })

  it('完全匿名的开放面请求也留痕(apiKeyId/userId 皆空,仍记 ip+path+status)', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/v1/embeddings',
      payload: { input: 'hi' },
    })
    expect(res.statusCode).toBe(401)
    await drainAsync()

    const call = lastAuditCall()
    const md = call.metadata
    expect(call.userId).toBeUndefined()
    expect(md.apiKeyId).toBeNull()
    expect(md.statusCode).toBe(401)
    expect(md.url).toBe('/v1/embeddings')
    expect(typeof call.ip).toBe('string')
    expect(call.result).toBe('failure')
  })

  it('plugins/audit.ts(audit_logs)同样带上归因字段,且不含原文/密钥', async () => {
    await server.inject({
      method: 'POST',
      url: '/v1/chat/completions',
      payload: { model: 'gpt-4o', messages: [{ role: 'user', content: PROMPT_TEXT }] },
    })
    await drainAsync()

    const calls = mockAddAuditLog.mock.calls
    const last = calls[calls.length - 1]
    expect(last).toBeDefined()
    const input = last?.[0] as { userId?: string; action: string; details: Record<string, unknown> }
    expect(input.action).toBe('POST')
    const details = input.details
    expect(details.apiKeyId).toBe(API_KEY_ID)
    expect(details.capabilityScope).toBe('chat:write')
    expect(details.capabilityDataClass).toBe('compute')
    expect(details.statusCode).toBe(200)
    expect(details.routePattern).toBe('/v1/chat/completions')
    expect(typeof details.durationMs).toBe('number')
    const serialized = JSON.stringify(details)
    expect(serialized).not.toContain(PROMPT_TEXT)
    expect(serialized).not.toContain(SECRET_KEY_VALUE)
  })

  it('api-logger 覆盖开放面,并把 userId 归因到 key 归属人', async () => {
    await server.inject({
      method: 'POST',
      url: '/v1/chat/completions',
      payload: { model: 'gpt-4o', messages: [] },
    })
    await drainAsync()

    const calls = mockAddApiLogsBatch.mock.calls
    expect(calls.length).toBeGreaterThan(0)
    const last = calls[calls.length - 1]
    const rows = last?.[0] as Array<{
      userId?: string
      path: string
      statusCode: number
      duration: number
    }>
    const row = rows.find((r) => r.path === '/v1/chat/completions')
    expect(row).toBeDefined()
    expect(row?.userId).toBe(KEY_OWNER_ID)
    expect(row?.statusCode).toBe(200)
    expect(typeof row?.duration).toBe('number')
  })

  it('健康检查不落审计(噪音控制不变)', async () => {
    const s = Fastify({ logger: false })
    await s.register(auditLoggerPlugin)
    s.get('/api/health', async (_req, reply) => reply.send({ ok: true }))
    await s.ready()
    mockRecordAuditLog.mockClear()
    await s.inject({ method: 'GET', url: '/api/health' })
    await drainAsync()
    expect(mockRecordAuditLog).not.toHaveBeenCalled()
    await s.close()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
