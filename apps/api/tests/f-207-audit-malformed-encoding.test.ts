// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-207 回归锁(2026-11-13)。
 *
 * 病灶:plugins/audit-logger.ts 的 parseQuery 直接 decodeURIComponent(raw),
 * URL/query 含畸形 percent-encoding(如 `?q=%zz`、`%E4%B8`)时抛 URIError,
 * onResponse 在 setImmediate 之前中断 ⇒ 该请求一条审计行都不落(审计绕过)。
 *
 * 本文件锁:
 *   ① 畸形 percent-encoding 请求仍落一条审计行,且 query 字段保留原始串;
 *   ② 审计落库抛错时请求不受影响(不得因此返回 500);
 *   ③ 正常请求的审计内容不变(action / url / query / params)。
 *
 * 只 mock audit-log-service / db / config,不触达真实 PG。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

const { mockRecordAuditLog } = vi.hoisted(() => ({
  mockRecordAuditLog: vi.fn<(params: unknown) => Promise<string | undefined>>(),
}))

vi.mock('../src/services/audit-log-service.js', () => ({
  recordAuditLog: mockRecordAuditLog,
}))

vi.mock('../src/db/index.js', () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn() },
  dbRead: { select: vi.fn() },
  dbClient: {},
}))

vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    DATABASE_URL: 'postgres://mock:mock@localhost:5432/mock',
    CREDENTIALS_ENCRYPTION_KEY: 'a'.repeat(32),
  },
}))

import auditLoggerPlugin from '../src/plugins/audit-logger.js'

interface AuditCall {
  userId?: string
  action: string
  resourceType?: string
  result?: string
  metadata: Record<string, unknown>
}

/** 让插件里的 setImmediate 异步落库跑完。 */
async function drainAsync(): Promise<void> {
  for (let i = 0; i < 5; i++) await new Promise((r) => setImmediate(r))
}

function lastAuditCall(): AuditCall {
  const calls = mockRecordAuditLog.mock.calls
  const last = calls[calls.length - 1]
  if (!last) throw new Error('recordAuditLog 未被调用')
  return last[0] as AuditCall
}

describe('F-207 畸形 percent-encoding 不得丢失审计行', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    await app.register(auditLoggerPlugin)
    app.get('/api/probe', async (_req, reply) => reply.send({ ok: true }))
    app.post('/api/probe', async (_req, reply) => reply.status(201).send({ ok: true }))
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    mockRecordAuditLog.mockReset()
    mockRecordAuditLog.mockResolvedValue('audit-id')
  })

  it('① 畸形 percent-encoding 仍落审计行,query 保留原始串', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/probe?q=%zz&next=%E4%B8',
    })
    expect(res.statusCode).toBe(200)
    await drainAsync()

    expect(mockRecordAuditLog).toHaveBeenCalledTimes(1)
    const call = lastAuditCall()
    expect(call.action).toBe('data.read')
    expect(call.metadata.url).toBe('/api/probe')
    expect(call.metadata.query).toEqual({ q: '%zz', next: '%E4%B8' })
    expect(JSON.stringify(call.metadata)).toContain('%zz')
  })

  it('② 审计落库抛错时请求不受影响(不因审计失败返回 500)', async () => {
    mockRecordAuditLog.mockRejectedValueOnce(new Error('audit db down'))

    const res = await app.inject({ method: 'GET', url: '/api/probe?q=ok' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ ok: true })

    await drainAsync()
    expect(mockRecordAuditLog).toHaveBeenCalledTimes(1)
  })

  it('③ 正常请求审计内容不变', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/probe?page=2&q=hello',
      payload: { name: '张三' },
    })
    expect(res.statusCode).toBe(201)
    await drainAsync()

    const call = lastAuditCall()
    expect(call.action).toBe('data.write')
    expect(call.resourceType).toBe('probe')
    expect(call.result).toBe('success')
    expect(call.metadata.method).toBe('POST')
    expect(call.metadata.url).toBe('/api/probe')
    expect(call.metadata.statusCode).toBe(201)
    expect(call.metadata.query).toEqual({ page: '2', q: 'hello' })
    expect(call.metadata.params).toEqual({ name: '张三' })
  })
})
