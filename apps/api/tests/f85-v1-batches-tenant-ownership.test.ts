// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-85(P1)交付测试:Batch API 单对象端点的租户归属校验(BOLA/IDOR)。
 *
 * 契约:
 * 1. A 的 key 读 / 取消 / 取 content / 取 results 他人(B)的 batch → 一律 404,
 *    且与"该 batch 不存在"回同一个响应体(不泄漏存在性);
 * 2. 归属不符时绝不执行写操作(取消不改状态、content/results 不吐任何内容);
 * 3. A 读自己的 batch → 200(归属断言不误伤属主);
 * 4. 列表端点只返回本 key 的任务。
 *
 * 全本地:Redis 用内存假实现,API Key 鉴权打桩,不碰真 DB/Redis。
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import Fastify, { type FastifyInstance, type FastifyError } from 'fastify'
import type { Redis } from 'ioredis'
import type { ApiKeyPermission, AuthenticatedApiKey } from '@ihui/types'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.AI_SERVICE_URL ??= 'http://test-ai-service:8802'
})

/**
 * 鉴权打桩:凭 `x-test-key-id` 头挑身份(真实现是 Bearer + developer_api_keys 查表)。
 * 能力闸走真代码 —— 两个 key 都带 batches:read/write,所以 404 只可能来自归属断言。
 */
const SCOPES: ApiKeyPermission[] = ['batches:read', 'batches:write']
const OWNERS: Record<string, string> = {
  ak_a: 'user_a',
  ak_b: 'user_b',
}

function fakeKeyOf(keyId: string): AuthenticatedApiKey | undefined {
  const userId = OWNERS[keyId]
  if (!userId) return undefined
  return {
    id: keyId,
    userId,
    key: `ihui_${keyId}`,
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

function keyIdOf(request: { headers: Record<string, unknown> }): string | undefined {
  const raw = request.headers['x-test-key-id']
  return typeof raw === 'string' && raw !== '' ? raw : undefined
}

vi.mock('../src/plugins/api-key-auth.js', () => ({
  authenticateApiKey: vi.fn(
    async (request: { headers: Record<string, unknown>; apiKey?: unknown }) => {
      const keyId = keyIdOf(request)
      const ctx = keyId ? fakeKeyOf(keyId) : undefined
      if (!ctx) throw Object.assign(new Error('Invalid API key'), { statusCode: 401 })
      request.apiKey = ctx
      return ctx
    },
  ),
  requireApiKeyAuth: vi.fn(
    async (request: { headers: Record<string, unknown>; apiKey?: unknown }) => {
      const keyId = keyIdOf(request)
      const ctx = keyId ? fakeKeyOf(keyId) : undefined
      if (!ctx) throw Object.assign(new Error('请提供 API Key 鉴权'), { statusCode: 401 })
      request.apiKey = ctx
    },
  ),
  requireApiKeyPermission: vi.fn(() => async () => {}),
  requireApiKeyQuota: vi.fn(() => async () => {}),
}))

import v1Batches from '../src/routes/v1-batches'
import { BATCH_KEY_PREFIX } from '../src/queue/batch-queue'

// =============================================================================
// 内存假 Redis(只实现 batch 路由族用到的命令)
// =============================================================================

class FakeRedis {
  private readonly strs = new Map<string, string>()

  async get(key: string): Promise<string | null> {
    return this.strs.get(key) ?? null
  }
  async set(key: string, value: string, ..._args: (string | number)[]): Promise<'OK'> {
    this.strs.set(key, value)
    return 'OK'
  }
  async scan(
    _cursor: string,
    _matchKeyword: string,
    pattern: string,
    _countKeyword: string,
    _count: number,
  ): Promise<[string, string[]]> {
    const prefix = pattern.replace(/\*$/, '')
    return ['0', [...this.strs.keys()].filter((k) => k.startsWith(prefix))]
  }
  async mget(...keys: string[]): Promise<(string | null)[]> {
    return keys.map((key) => this.strs.get(key) ?? null)
  }
  seed(key: string, value: string): void {
    this.strs.set(key, value)
  }
  peek(key: string): string | undefined {
    return this.strs.get(key)
  }
}

// =============================================================================
// 夹具
// =============================================================================

function openAIBatchFixture(
  id: string,
  apiKeyId: string,
  opts: { status?: string; output?: string } = {},
): string {
  return JSON.stringify({
    id,
    object: 'batch',
    endpoint: '/v1/chat/completions',
    input_file_id: 'file_test',
    completion_window: '24h',
    status: opts.status ?? 'in_progress',
    output_file_id: null,
    error_file_id: null,
    created_at: 1_700_000_000_000,
    in_progress_at: null,
    expires_at: 1_700_000_900_000,
    finalizing_at: null,
    completed_at: null,
    failed_at: null,
    expired_at: null,
    cancelled_at: null,
    request_counts: null,
    metadata: null,
    _apiKeyId: apiKeyId,
    _userId: `owner-of-${apiKeyId}`,
    _outputContent: opts.output ?? null,
  })
}

function anthropicBatchFixture(
  id: string,
  apiKeyId: string,
  opts: { status?: string; results?: unknown[] } = {},
): string {
  return JSON.stringify({
    id,
    type: 'message_batch',
    status: opts.status ?? 'completed',
    created_at: '2026-01-01T00:00:00.000Z',
    expires_at: '2026-01-02T00:00:00.000Z',
    archived_at: null,
    cancel_initiated_at: null,
    processing_started_at: null,
    ended_at: '2026-01-01T01:00:00.000Z',
    request_counts: null,
    results: opts.results ?? [],
    _apiKeyId: apiKeyId,
    _userId: `owner-of-${apiKeyId}`,
    _requests: [],
  })
}

interface Harness {
  app: FastifyInstance
  redis: FakeRedis
}

let harness: Harness | undefined

beforeAll(async () => {
  const app = Fastify({ logger: false })
  const redis = new FakeRedis()
  app.decorate('redis', redis as unknown as Redis)
  app.decorate('redisForQueue', undefined as unknown as Redis)
  app.setErrorHandler((err: FastifyError, _request, reply) => {
    const statusCode = (err as Error & { statusCode?: number }).statusCode ?? 500
    reply.status(statusCode).send({ code: statusCode, message: err.message })
  })
  await app.register(v1Batches, { prefix: '/v1' })
  await app.ready()
  harness = { app, redis }
})

afterAll(async () => {
  await harness?.app.close()
})

function need(): Harness {
  if (!harness) throw new Error('harness 未初始化')
  return harness
}

function get(url: string, keyId = 'ak_a') {
  return need().app.inject({ method: 'GET', url, headers: { 'x-test-key-id': keyId } })
}

function post(url: string, keyId = 'ak_a') {
  return need().app.inject({ method: 'POST', url, headers: { 'x-test-key-id': keyId } })
}

/** 每个用例独立 id,避免与同文件其他用例串味。 */
function seedOpenAI(id: string, apiKeyId: string, opts?: { status?: string; output?: string }) {
  need().redis.seed(`${BATCH_KEY_PREFIX}${id}`, openAIBatchFixture(id, apiKeyId, opts))
}

function seedAnthropic(
  id: string,
  apiKeyId: string,
  opts?: { status?: string; results?: unknown[] },
) {
  need().redis.seed(`${BATCH_KEY_PREFIX}${id}`, anthropicBatchFixture(id, apiKeyId, opts))
}

// =============================================================================
// 1. OpenAI Batch 单对象端点
// =============================================================================

describe('F-85 OpenAI Batch:单对象端点租户归属', () => {
  it('A 读 B 的 batch → 404,且与"batch 不存在"回同一个响应体(不泄漏存在性)', async () => {
    seedOpenAI('batch_b_read', 'ak_b')
    const stolen = await get('/v1/batch/batch_b_read', 'ak_a')
    const unknown = await get('/v1/batch/batch_never_exists', 'ak_a')
    expect(stolen.statusCode).toBe(404)
    expect(unknown.statusCode).toBe(404)
    expect(unknown.body).toBe(stolen.body)
  })

  it('A 取消 B 的 batch → 404,且 B 的任务状态/时间戳原封不动(未执行写库)', async () => {
    seedOpenAI('batch_b_cancel', 'ak_b', { status: 'in_progress' })
    const res = await post('/v1/batch/batch_b_cancel/cancel', 'ak_a')
    expect(res.statusCode).toBe(404)
    expect(res.json().message).toBe('Batch not found')

    const stored = JSON.parse(need().redis.peek(`${BATCH_KEY_PREFIX}batch_b_cancel`)!) as {
      status: string
      cancelled_at: number | null
    }
    expect(stored.status).toBe('in_progress')
    expect(stored.cancelled_at).toBeNull()
  })

  it('A 取 B 的 content → 404,不返回任何结果内容', async () => {
    seedOpenAI('batch_b_content', 'ak_b', {
      status: 'completed',
      output: 'B_TENANT_SECRET_OUTPUT',
    })
    const res = await get('/v1/batch/batch_b_content/content', 'ak_a')
    expect(res.statusCode).toBe(404)
    expect(res.body).not.toContain('B_TENANT_SECRET_OUTPUT')
  })

  it('A 读/取消/取自己的 batch → 200(归属断言不误伤属主)', async () => {
    const ownGet = await get('/v1/batch/batch_a_own', 'ak_a')
    // 未 seed 时先给 404(下面各步自己 seed)
    expect(ownGet.statusCode).toBe(404)

    seedOpenAI('batch_a_own', 'ak_a', { status: 'in_progress' })
    const read = await get('/v1/batch/batch_a_own', 'ak_a')
    expect(read.statusCode).toBe(200)
    expect(read.json().id).toBe('batch_a_own')

    const cancel = await post('/v1/batch/batch_a_own/cancel', 'ak_a')
    expect(cancel.statusCode).toBe(200)
    expect(cancel.json().status).toBe('cancelled')

    seedOpenAI('batch_a_content', 'ak_a', { status: 'completed', output: 'A_OUTPUT' })
    const content = await get('/v1/batch/batch_a_content/content', 'ak_a')
    expect(content.statusCode).toBe(200)
    expect(content.body).toBe('A_OUTPUT')
  })
})

// =============================================================================
// 2. Anthropic Messages Batches 单对象端点
// =============================================================================

describe('F-85 Anthropic Message Batch:单对象端点租户归属', () => {
  it('A 读 B 的 message batch → 404,且与"不存在"同响应体', async () => {
    seedAnthropic('msgbatch_b_read', 'ak_b')
    const stolen = await get('/v1/messages/batches/msgbatch_b_read', 'ak_a')
    const unknown = await get('/v1/messages/batches/msgbatch_never_exists', 'ak_a')
    expect(stolen.statusCode).toBe(404)
    expect(unknown.statusCode).toBe(404)
    expect(unknown.body).toBe(stolen.body)
  })

  it('A 取 B 的 results → 404,不返回任何结果行', async () => {
    seedAnthropic('msgbatch_b_results', 'ak_b', {
      status: 'completed',
      results: [{ custom_id: 'b-only-custom-id', result: { type: 'succeeded' } }],
    })
    const res = await get('/v1/messages/batches/msgbatch_b_results/results', 'ak_a')
    expect(res.statusCode).toBe(404)
    expect(res.body).not.toContain('b-only-custom-id')
  })

  it('A 读/取自己的 message batch → 200', async () => {
    seedAnthropic('msgbatch_a_own', 'ak_a', {
      status: 'completed',
      results: [{ custom_id: 'a-only-custom-id', result: { type: 'succeeded' } }],
    })
    const read = await get('/v1/messages/batches/msgbatch_a_own', 'ak_a')
    expect(read.statusCode).toBe(200)
    expect(read.json().id).toBe('msgbatch_a_own')

    const results = await get('/v1/messages/batches/msgbatch_a_own/results', 'ak_a')
    expect(results.statusCode).toBe(200)
    expect(results.body).toContain('a-only-custom-id')
  })
})

// =============================================================================
// 3. 列表端点归属过滤(回归)
// =============================================================================

describe('F-85 列表端点只返回本 key 的任务', () => {
  it('A 的 /v1/batches 不含 B 的 batch;B 的列表也不含 A 的', async () => {
    seedOpenAI('batch_list_a_only', 'ak_a')
    seedOpenAI('batch_list_b_only', 'ak_b')

    const listA = await get('/v1/batches?limit=100', 'ak_a')
    expect(listA.statusCode).toBe(200)
    const idsA = (listA.json() as { data: Array<{ id: string }> }).data.map((t) => t.id)
    expect(idsA).toContain('batch_list_a_only')
    expect(idsA).not.toContain('batch_list_b_only')

    const listB = await get('/v1/batches?limit=100', 'ak_b')
    expect(listB.statusCode).toBe(200)
    const idsB = (listB.json() as { data: Array<{ id: string }> }).data.map((t) => t.id)
    expect(idsB).toContain('batch_list_b_only')
    expect(idsB).not.toContain('batch_list_a_only')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
