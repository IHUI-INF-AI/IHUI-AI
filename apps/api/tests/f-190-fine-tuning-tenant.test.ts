// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-190 回归锁(2026-11-08,apps/api P1 越权组)。
 *
 * 旧行为:fine_tuning 任务在 Redis 里只有 job 本体,列表/详情/取消/事件全按 jobId 放行,
 * 上游又用平台 Key 列全账号任务 ⇒ 任意持 Key 用户可读/取消他人微调任务。
 * 判据:非属主 403,且**上游请求零新增**(证明越权者没有触达下游)。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify from 'fastify'

const U1 = '00000000-0000-4000-8000-0000000000aa'
const U2 = '00000000-0000-4000-8000-0000000000bb'

vi.mock('../src/plugins/api-key-auth.js', () => ({
  requireApiKeyAuth: async (request: { headers: Record<string, unknown>; apiKey?: unknown }) => {
    request.apiKey = {
      id: String(request.headers['x-key-id'] ?? 'key-1'),
      userId: String(request.headers['x-user'] ?? U1),
    }
  },
}))
vi.mock('../src/utils/capability-guard.js', () => ({
  requireCapabilityRules: () => async () => undefined,
}))
vi.mock('../src/services/relay-billing-service.js', () => ({
  recordCall: vi.fn(async () => ({ logId: '', costCents: 0, newTokenBalance: 0, newCostBalanceCents: 0 })),
  modelToProviderCode: vi.fn(() => 'openai'),
}))
vi.mock('../src/config/body-limits.js', () => ({ MEDIA_FILE_UPLOAD_BODY_LIMIT: 10 * 1024 * 1024 }))

process.env.UPSTREAM_FINE_TUNING_BASE = 'http://upstream.test'
process.env.UPSTREAM_FINE_TUNING_KEY = 'upstream-key'

import v1Routes from '../src/routes/v1-protocol-completeness.js'

const JOB_A = {
  id: 'ftjob-A',
  object: 'fine_tuning.job',
  created_at: 1,
  updated_at: 1,
  model: 'gpt-4o-mini',
  status: 'queued',
  training_file: 'file-1',
  validation_file: null,
  hyperparameters: { n_epochs: 'auto' },
  suffix: null,
  error: null,
  finished_at: null,
  trained_tokens: null,
  organization_id: null,
  metadata: {},
}

function makeRedis() {
  const store = new Map<string, string>()
  return {
    store,
    get: vi.fn(async (k: string) => store.get(k) ?? null),
    set: vi.fn(async (k: string, v: string) => {
      store.set(k, v)
      return 'OK'
    }),
  }
}

let fetchCalls: string[] = []
const originalFetch = globalThis.fetch

function installFetch() {
  fetchCalls = []
  globalThis.fetch = vi.fn(async (url: string) => {
    fetchCalls.push(String(url))
    const u = String(url)
    if (u.endsWith('/v1/fine_tuning/jobs') ) {
      return new Response(JSON.stringify(JOB_A), { status: 200 })
    }
    if (u.includes('/v1/fine_tuning/jobs?')) {
      return new Response(JSON.stringify({ object: 'list', data: [JOB_A], has_more: false }), {
        status: 200,
      })
    }
    return new Response(JSON.stringify(JOB_A), { status: 200 })
  }) as unknown as typeof globalThis.fetch
}

describe('F-190 fine_tuning 任务按调用者隔离', () => {
  const redis = makeRedis()
  const server = Fastify({ logger: false })

  beforeAll(async () => {
    server.decorate('redis', redis)
    await server.register(v1Routes, { prefix: '/v1' })
    await server.ready()
  })
  afterAll(async () => {
    await server.close()
    globalThis.fetch = originalFetch
  })
  beforeEach(() => {
    installFetch()
    redis.store.clear()
  })

  async function createAs(user: string) {
    return server.inject({
      method: 'POST',
      url: '/v1/fine_tuning/jobs',
      headers: { 'x-user': user },
      body: { model: 'gpt-4o-mini', training_file: 'file-1' },
    })
  }

  it('U2 读 U1 的任务详情 → 403,且不向上游发请求', async () => {
    expect((await createAs(U1)).statusCode).toBe(200)
    const callsAfterCreate = fetchCalls.length

    const res = await server.inject({
      method: 'GET',
      url: '/v1/fine_tuning/jobs/ftjob-A',
      headers: { 'x-user': U2 },
    })
    expect(res.statusCode).toBe(403)
    expect(fetchCalls.length).toBe(callsAfterCreate)
  })

  it('U2 列表看不到 U1 的任务,U1 自己能看到', async () => {
    expect((await createAs(U1)).statusCode).toBe(200)

    const u2 = await server.inject({
      method: 'GET',
      url: '/v1/fine_tuning/jobs',
      headers: { 'x-user': U2 },
    })
    expect(u2.statusCode).toBe(200)
    expect(u2.json().data).toEqual([])

    const u1 = await server.inject({
      method: 'GET',
      url: '/v1/fine_tuning/jobs',
      headers: { 'x-user': U1 },
    })
    expect(u1.statusCode).toBe(200)
    expect(u1.json().data.map((j: { id: string }) => j.id)).toEqual(['ftjob-A'])
  })

  it('U2 取消 U1 的任务 → 403,且不向上游发取消请求', async () => {
    expect((await createAs(U1)).statusCode).toBe(200)
    const callsAfterCreate = fetchCalls.length

    const res = await server.inject({
      method: 'POST',
      url: '/v1/fine_tuning/jobs/ftjob-A/cancel',
      headers: { 'x-user': U2 },
    })
    expect(res.statusCode).toBe(403)
    expect(fetchCalls.length).toBe(callsAfterCreate)
  })

  it('U2 读 U1 的任务事件 → 403,且不向上游发请求', async () => {
    expect((await createAs(U1)).statusCode).toBe(200)
    const callsAfterCreate = fetchCalls.length

    const res = await server.inject({
      method: 'GET',
      url: '/v1/fine_tuning/jobs/ftjob-A/events',
      headers: { 'x-user': U2 },
    })
    expect(res.statusCode).toBe(403)
    expect(fetchCalls.length).toBe(callsAfterCreate)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
