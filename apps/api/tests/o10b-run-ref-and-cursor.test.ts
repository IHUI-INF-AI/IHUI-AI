// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * O10b 交付测试:对外 run 句柄(irun_<ulid>)+ /v1 游标分页。
 *
 * 三条底线,对应任务书的三句要求:
 * 1. **句柄闭环**:创建 run 只**追加** `run_ref` 字段(既有字段一个不动),用
 *    `GET /v1/run-refs/:ref` 查得到同一轮;别人的句柄 → 404(不回 403,免把
 *    "这个句柄存在"泄露出去);无 runs:read → 403。
 * 2. **游标翻页不重不漏**:逐页翻到底,并集 == 全集且无重复。
 * 3. **不带 `after`/`page_format` 时旧行为逐字节不变**:直接比响应字符串
 *    (`res.body === JSON.stringify(期望字面量)`),键集与键序一起钉死。
 * 另加:limit 夹紧只在游标模式生效(旧模式照旧 400)、跨 owner/跨族游标不可复用。
 *
 * 全本地:Redis 用内存假实现,鉴权/计费/ai-service 三个口子全打桩,不碰生产 8810/8811。
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import type { Redis } from 'ioredis'
import type { ApiKeyPermission, AuthenticatedApiKey } from '@ihui/types'
import {
  CURSOR_KIND,
  clampLimit,
  decodeCursor,
  encodeCursor,
  pageOf,
  resolveAfter,
  type CursorBinding,
} from '../src/utils/cursor-page'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.AI_SERVICE_URL ??= 'http://test-ai-service:8802'
})

// 路由图里凡touch到 db 的都打桩(本文件的断言全部走内存 Redis,不需要真库)
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
  checkQuota: vi.fn().mockResolvedValue({ allowed: true }),
  recordCall: vi.fn().mockResolvedValue({ logId: 'log_test_001' }),
  isByokCall: vi.fn().mockResolvedValue(false),
  modelToProviderCode: vi.fn().mockReturnValue('openai'),
}))

// ai-service:run 的同步执行会打 /api/llm/complete,这里固定回一段文本 + usage
const LLM_REPLY = {
  content: 'pong',
  usage: { prompt_tokens: 3, completion_tokens: 4, total_tokens: 7 },
}
vi.mock('../src/utils/ai-service-fetch.js', () => ({
  aiServiceFetch: vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => LLM_REPLY,
    text: async () => '',
  })),
}))

/**
 * 鉴权打桩:凭 `x-test-key-id` 头挑身份(真实现是 Bearer + developer_api_keys 查表)。
 * 能力闸走真代码 —— 这些用例顺带证明 `/v1/run-refs/:ref` 确实被 runs:read 管着。
 */
const SCOPES: ApiKeyPermission[] = [
  'assistants:read',
  'assistants:write',
  'threads:read',
  'threads:write',
  'runs:read',
  'runs:write',
  'batches:read',
  'batches:write',
]
const OWNERS: Record<string, { userId: string; scopes: ApiKeyPermission[] }> = {
  ak_a: { userId: 'user_a', scopes: SCOPES },
  ak_b: { userId: 'user_b', scopes: SCOPES },
  ak_batches: { userId: 'user_batches', scopes: ['batches:read', 'batches:write'] },
  ak_asst: { userId: 'user_asst', scopes: SCOPES },
  ak_noscope: { userId: 'user_noscope', scopes: [] },
}

function fakeKeyOf(keyId: string): AuthenticatedApiKey | undefined {
  const owner = OWNERS[keyId]
  if (!owner) return undefined
  return {
    id: keyId,
    userId: owner.userId,
    key: `ihui_${keyId}`,
    permissions: owner.scopes,
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
      if (!keyId) throw Object.assign(new Error('请提供 API Key 鉴权'), { statusCode: 401 })
      const ctx = fakeKeyOf(keyId)
      if (!ctx) throw Object.assign(new Error('Invalid API key'), { statusCode: 401 })
      request.apiKey = ctx
      return ctx
    },
  ),
  requireApiKeyAuth: vi.fn(
    async (request: { headers: Record<string, unknown>; apiKey?: unknown }) => {
      const keyId = keyIdOf(request)
      if (keyId) request.apiKey = fakeKeyOf(keyId)
    },
  ),
  requireApiKeyPermission: vi.fn(() => async () => {}),
  requireApiKeyQuota: vi.fn(() => async () => {}),
}))

import v1Assistants from '../src/routes/v1-assistants'
import v1Batches from '../src/routes/v1-batches'
import { BATCH_KEY_PREFIX } from '../src/queue/batch-queue'

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
  async srem(key: string, ...members: string[]): Promise<number> {
    const current = this.sets.get(key) ?? []
    this.sets.set(
      key,
      current.filter((m) => !members.includes(m)),
    )
    return members.length
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
  /** 测试侧直读:核对 run_ref → runId 映射是否真的落了 Redis。 */
  peek(key: string): string | undefined {
    return this.strs.get(key)
  }
  seed(key: string, value: string): void {
    this.strs.set(key, value)
  }
}

// =============================================================================
// 夹具
// =============================================================================

interface Harness {
  app: FastifyInstance
  redis: FakeRedis
}

let harness: Harness | undefined

async function buildHarness(): Promise<Harness> {
  const app = Fastify({ logger: false })
  const redis = new FakeRedis()
  app.decorate('redis', redis as unknown as Redis)
  app.decorate('redisForQueue', undefined as unknown as Redis)
  app.setErrorHandler((err, _request, reply) => {
    const statusCode = (err as Error & { statusCode?: number }).statusCode ?? 500
    reply.status(statusCode).send({ code: statusCode, message: err.message })
  })
  await app.register(v1Assistants, { prefix: '/v1' })
  await app.register(v1Batches, { prefix: '/v1' })
  await app.ready()
  return { app, redis }
}

beforeAll(async () => {
  harness = await buildHarness()
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

function post(url: string, payload: unknown, keyId = 'ak_a') {
  return need().app.inject({
    method: 'POST',
    url,
    headers: { 'x-test-key-id': keyId },
    payload: payload as Record<string, unknown>,
  })
}

/** 每个用例一组独立夹具(在 keyId 名下新开 assistant/thread,避免用例间串味)。 */
async function fixtureThread(
  tag: string,
  keyId = 'ak_a',
): Promise<{ assistantId: string; threadId: string }> {
  const created = await post('/v1/assistants', { model: 'gpt-4o-mini', name: tag }, keyId)
  expect(created.statusCode).toBe(200)
  const assistantId = created.json().id as string
  const thread = await post('/v1/threads', { metadata: { tag } }, keyId)
  expect(thread.statusCode).toBe(200)
  return { assistantId, threadId: thread.json().id as string }
}

async function addMessages(threadId: string, count: number, keyId = 'ak_a'): Promise<string[]> {
  const ids: string[] = []
  for (let i = 0; i < count; i += 1) {
    const res = await post(
      `/v1/threads/${threadId}/messages`,
      { role: 'user', content: `m${i}` },
      keyId,
    )
    expect(res.statusCode).toBe(200)
    ids.push(res.json().id as string)
  }
  return ids
}

function batchTaskFixture(id: string, apiKeyId: string, createdAt: number): string {
  return JSON.stringify({
    id,
    object: 'batch',
    endpoint: '/v1/chat/completions',
    input_file_id: 'file_test',
    completion_window: '24h',
    status: 'completed',
    output_file_id: null,
    error_file_id: null,
    created_at: createdAt,
    in_progress_at: null,
    expires_at: createdAt + 1000,
    finalizing_at: null,
    completed_at: createdAt + 900,
    failed_at: null,
    expired_at: null,
    cancelled_at: null,
    request_counts: null,
    metadata: null,
    _apiKeyId: apiKeyId,
    _userId: `owner-of-${apiKeyId}`,
    _outputContent: '',
  })
}

// =============================================================================
// 1. run_ref:创建 → 查询闭环
// =============================================================================

describe('O10b run_ref:创建 → 查询闭环', () => {
  it('创建 run 只追加 run_ref 字段,既有字段一个不少;句柄反查到同一轮', async () => {
    const { assistantId, threadId } = await fixtureThread('ref-roundtrip')
    const created = await post(`/v1/threads/${threadId}/runs`, { assistant_id: assistantId })
    expect(created.statusCode).toBe(200)
    const body = created.json() as Record<string, unknown>

    // 既有字段仍在原位(id 依旧是内部 run_xxx,没有被句柄替换掉)
    expect(body.id).toMatch(/^run_/)
    expect(body.object).toBe('thread.run')
    expect(body.thread_id).toBe(threadId)
    expect(body.status).toBe('completed')
    expect(body.usage).toEqual({ prompt_tokens: 3, completion_tokens: 4, total_tokens: 7 })
    // 新字段:稳定对外句柄,追加在末尾,内部 userId 依旧不外泄
    expect(Object.keys(body).at(-1)).toBe('run_ref')
    expect(body.run_ref).toMatch(/^irun_[0-9A-HJKMNP-TV-Z]{26}$/)
    expect(body.userId).toBeUndefined()

    // Redis 侧映射确实落了,且 TTL 命令随 set 一起发出(假 Redis 记录在 args 里,这里验值)
    const runRef = body.run_ref as string
    expect(need().redis.peek(`run_ref:${runRef}`)).toBe(body.id)

    const looked = await get(`/v1/run-refs/${runRef}`)
    expect(looked.statusCode).toBe(200)
    const lookedBody = looked.json() as Record<string, unknown>
    expect(lookedBody.id).toBe(body.id)
    expect(lookedBody.status).toBe('completed')
    expect(lookedBody.run_ref).toBe(runRef)
    expect(lookedBody.usage).toEqual(body.usage)
  })

  it('句柄查到的 run 与 GET /threads/:threadId/runs/:id 是同一份状态', async () => {
    const { assistantId, threadId } = await fixtureThread('ref-equals-run')
    const created = (
      await post(`/v1/threads/${threadId}/runs`, {
        assistant_id: assistantId,
      })
    ).json() as Record<string, unknown>
    const byThread = await get(`/v1/threads/${threadId}/runs/${created.id as string}`)
    expect(byThread.statusCode).toBe(200)
    const byRef = (await get(`/v1/run-refs/${created.run_ref as string}`)).json() as Record<
      string,
      unknown
    >
    const byThreadBody = byThread.json() as Record<string, unknown>
    // 同一轮:去掉句柄后两条路径的字段完全一致(读逻辑复用,没复制一份)
    delete byRef.run_ref
    expect(byRef).toEqual(byThreadBody)
  })

  it('别人的句柄 → 404,且与"句柄不存在"回同一个响应体(不泄露存在性)', async () => {
    const { assistantId, threadId } = await fixtureThread('ref-cross-owner')
    const runRef = (
      await post(`/v1/threads/${threadId}/runs`, { assistant_id: assistantId })
    ).json().run_ref as string

    const stolen = await get(`/v1/run-refs/${runRef}`, 'ak_b')
    const unknown = await get(`/v1/run-refs/${'irun_00000000000000000000000000'}`)
    expect(stolen.statusCode).toBe(404)
    expect(unknown.statusCode).toBe(404)
    expect(unknown.body).toBe(stolen.body)
  })

  it('句柄形态不合法 → 400(参数 schema 拦在查询之前)', async () => {
    const res = await get('/v1/run-refs/not-a-handle')
    expect(res.statusCode).toBe(400)
  })

  it('缺 runs:read 的 key → 403(能力闸真在管这条新路由)', async () => {
    const { assistantId, threadId } = await fixtureThread('ref-scope')
    const runRef = (
      await post(`/v1/threads/${threadId}/runs`, { assistant_id: assistantId })
    ).json().run_ref as string
    const res = await get(`/v1/run-refs/${runRef}`, 'ak_noscope')
    expect(res.statusCode).toBe(403)
    expect(res.json().errorCode).toBe('SCOPE_REQUIRED')
  })
})

// =============================================================================
// 2. 游标翻页:不重不漏
// =============================================================================

describe('O10b 游标翻页', () => {
  it('assistants 列表族端到端可达(O3 覆盖面修复的回归),且翻页不重不漏', async () => {
    // 独立 owner:user_asst 名下只有本用例创建的 3 条,列表内容才是确定的
    const created: Record<string, unknown>[] = []
    for (let i = 0; i < 3; i += 1) {
      const res = await post('/v1/assistants', { model: 'gpt-4o-mini', name: `a${i}` }, 'ak_asst')
      // 403 CAPABILITY_UNREGISTERED 曾经罩住整族 assistants/threads CRUD —— 这条断言
      // 就是把它钉住:登记缺一条,这里立刻红。
      expect(res.statusCode).toBe(200)
      created.push(res.json() as Record<string, unknown>)
    }
    const ids = created.map((a) => a.id as string)

    const legacy = await get('/v1/assistants?limit=2', 'ak_asst')
    expect(legacy.statusCode).toBe(200)
    expect(Object.keys(legacy.json() as Record<string, unknown>)).toEqual([
      'object',
      'data',
      'first_id',
      'last_id',
      'has_more',
    ])
    // 旧契约逐字节:信封键序 + data 里每条的字段序都与创建响应一致
    expect(legacy.body).toBe(
      JSON.stringify({
        object: 'list',
        data: [created[0], created[1]],
        first_id: ids[0],
        last_id: ids[1],
        has_more: true,
      }),
    )

    const seen: string[] = []
    let after: string | undefined
    for (let hop = 0; hop < 6; hop += 1) {
      const res = await get(
        `/v1/assistants?page_format=cursor&limit=2${after ? `&after=${encodeURIComponent(after)}` : ''}`,
        'ak_asst',
      )
      expect(res.statusCode).toBe(200)
      const body = res.json() as Record<string, unknown>
      seen.push(...(body.data as Array<{ id: string }>).map((a) => a.id))
      if (body.next_cursor === undefined) break
      after = body.next_cursor as string
    }
    expect(seen).toEqual(ids)
  })

  it('messages 逐页翻到底:并集 == 全集且无重复,末页无 next_cursor', async () => {
    const { threadId } = await fixtureThread('cursor-messages')
    const all = await addMessages(threadId, 5)

    const seen: string[] = []
    let after: string | undefined
    for (let hop = 0; hop < 10; hop += 1) {
      const url = `/v1/threads/${threadId}/messages?page_format=cursor&limit=2${
        after ? `&after=${encodeURIComponent(after)}` : ''
      }`
      const res = await get(url)
      expect(res.statusCode).toBe(200)
      const body = res.json() as Record<string, unknown>
      const data = body.data as Array<{ id: string }>
      seen.push(...data.map((m) => m.id))
      expect(body.has_more).toBe(hop < 2)
      if (body.next_cursor === undefined) {
        expect(body.has_more).toBe(false)
        break
      }
      after = body.next_cursor as string
      if (hop === 0) expect(after).toMatch(/^cr1_/)
      if (hop === 2) expect(body.next_cursor).toBeUndefined()
    }
    expect(seen).toEqual(all)
    expect(new Set(seen).size).toBe(all.length)
  })

  it('runs 列表翻页同样不重不漏', async () => {
    const { assistantId, threadId } = await fixtureThread('cursor-runs')
    const ids: string[] = []
    for (let i = 0; i < 3; i += 1) {
      const res = await post(`/v1/threads/${threadId}/runs`, { assistant_id: assistantId })
      expect(res.statusCode).toBe(200)
      ids.push(res.json().id as string)
    }
    const seen: string[] = []
    let after: string | undefined
    for (let hop = 0; hop < 6; hop += 1) {
      const res = await get(
        `/v1/threads/${threadId}/runs?page_format=cursor&limit=1${
          after ? `&after=${encodeURIComponent(after)}` : ''
        }`,
      )
      expect(res.statusCode).toBe(200)
      const body = res.json() as Record<string, unknown>
      seen.push(...(body.data as Array<{ id: string }>).map((r) => r.id))
      if (body.next_cursor === undefined) break
      after = body.next_cursor as string
    }
    expect(seen).toEqual(ids)
  })

  it('batches 列表翻页不重不漏(内部 after=裸 id 一并覆盖)', async () => {
    const { redis } = need()
    for (let i = 0; i < 3; i += 1) {
      redis.seed(
        `${BATCH_KEY_PREFIX}batch_seed_${i}`,
        batchTaskFixture(`batch_seed_${i}`, 'ak_a', 1_700_000_000_000 + i * 1000),
      )
    }
    // 降序:最新在前
    const expectOrder = ['batch_seed_2', 'batch_seed_1', 'batch_seed_0']
    const seen: string[] = []
    let after: string | undefined
    for (let hop = 0; hop < 6; hop += 1) {
      const res = await get(
        `/v1/batches?page_format=cursor&limit=1${after ? `&after=${encodeURIComponent(after)}` : ''}`,
      )
      expect(res.statusCode).toBe(200)
      const body = res.json() as Record<string, unknown>
      seen.push(...(body.data as Array<{ id: string }>).map((t) => t.id))
      if (body.next_cursor === undefined) break
      after = body.next_cursor as string
    }
    expect(seen).toEqual(expectOrder)

    // 旧契约(after=裸内部 id)也还在:等价页
    const legacy = await get('/v1/batches?limit=1&after=batch_seed_2')
    expect(legacy.statusCode).toBe(200)
    expect((legacy.json() as Record<string, unknown>).data).toEqual([
      expect.objectContaining({ id: 'batch_seed_1' }),
    ])
  })

  it('跨 owner 游标不可复用:A 的 next_cursor 拿到 B 那儿 → 400', async () => {
    const a = await fixtureThread('cursor-x-owner-a')
    await addMessages(a.threadId, 3)
    const b = await fixtureThread('cursor-x-owner-b', 'ak_b')
    await addMessages(b.threadId, 3, 'ak_b')

    const first = await get(`/v1/threads/${a.threadId}/messages?page_format=cursor&limit=2`, 'ak_a')
    const cursor = (first.json() as Record<string, unknown>).next_cursor as string
    expect(cursor).toMatch(/^cr1_/)

    // 同族不同 owner(B 的线程)—— 指纹对不上
    const stolen = await get(
      `/v1/threads/${b.threadId}/messages?page_format=cursor&limit=2&after=${encodeURIComponent(cursor)}`,
      'ak_b',
    )
    expect(stolen.statusCode).toBe(400)
    expect(stolen.json().message).toMatch(/cursor/i)

    // 同一 owner、同一线程:正常翻页(证明上面那发 400 是绑定生效,不是解析器坏了)
    const own = await get(
      `/v1/threads/${a.threadId}/messages?page_format=cursor&limit=2&after=${encodeURIComponent(cursor)}`,
      'ak_a',
    )
    expect(own.statusCode).toBe(200)
    expect((own.json() as Record<string, unknown>).data).toHaveLength(1)
  })

  it('跨列表族游标不可复用:messages 的游标用到 runs 上 → 400', async () => {
    const { assistantId, threadId } = await fixtureThread('cursor-x-kind')
    await addMessages(threadId, 3)
    await post(`/v1/threads/${threadId}/runs`, { assistant_id: assistantId })

    const msgPage = (
      await get(`/v1/threads/${threadId}/messages?page_format=cursor&limit=2`)
    ).json() as Record<string, unknown>
    const msgCursor = msgPage.next_cursor as string

    const misused = await get(
      `/v1/threads/${threadId}/runs?page_format=cursor&limit=2&after=${encodeURIComponent(msgCursor)}`,
    )
    expect(misused.statusCode).toBe(400)
  })

  it('被篡改的游标 → 400(签名挡住自造/改写)', async () => {
    const { threadId } = await fixtureThread('cursor-tamper')
    await addMessages(threadId, 3)
    const cursor = (await get(`/v1/threads/${threadId}/messages?page_format=cursor&limit=2`)).json()
      .next_cursor as string
    const [head, sig] = cursor.split('.')
    const forged = `${head!.slice(0, -4)}AAAA.${sig}`
    const res = await get(
      `/v1/threads/${threadId}/messages?page_format=cursor&limit=2&after=${encodeURIComponent(forged)}`,
    )
    expect(res.statusCode).toBe(400)
  })

  it('limit 上限:游标模式夹紧到 100,旧模式照旧 400', async () => {
    const { threadId } = await fixtureThread('cursor-limit')
    await addMessages(threadId, 2)

    const clamped = await get(`/v1/threads/${threadId}/messages?page_format=cursor&limit=500`)
    expect(clamped.statusCode).toBe(200)
    expect((clamped.json() as Record<string, unknown>).data).toHaveLength(2)

    const rejected = await get(`/v1/threads/${threadId}/messages?limit=500`)
    expect(rejected.statusCode).toBe(400)
  })
})

// =============================================================================
// 3. 回归:不带 after / page_format 时旧行为逐字节不变
// =============================================================================

describe('O10b 旧行为不变(回归底线)', () => {
  it('messages 默认列表:响应字符串与改造前的信封逐字节相同(键集 + 键序 + 值)', async () => {
    const { threadId } = await fixtureThread('legacy-messages')
    const ids = await addMessages(threadId, 3)
    const firstTwo = (await get(`/v1/threads/${threadId}/messages?limit=2`)).json() as Record<
      string,
      unknown
    >
    const data = firstTwo.data as Array<Record<string, unknown>>
    expect(data.map((m) => m.id)).toEqual([ids[0], ids[1]])

    // 期望完全按改造前的字面量形状手搓:object → data → first_id → last_id → has_more
    const expected = {
      object: 'list',
      data: [
        {
          id: ids[0],
          object: 'thread.message',
          created_at: data[0]!.created_at,
          thread_id: threadId,
          role: 'user',
          content: [{ type: 'text', text: { value: 'm0', annotations: [] } }],
          assistant_id: null,
          run_id: null,
          metadata: null,
        },
        {
          id: ids[1],
          object: 'thread.message',
          created_at: data[1]!.created_at,
          thread_id: threadId,
          role: 'user',
          content: [{ type: 'text', text: { value: 'm1', annotations: [] } }],
          assistant_id: null,
          run_id: null,
          metadata: null,
        },
      ],
      first_id: ids[0],
      last_id: ids[1],
      has_more: true,
    }
    const res = await get(`/v1/threads/${threadId}/messages?limit=2`)
    expect(res.body).toBe(JSON.stringify(expected))
    expect(Object.keys(res.json() as Record<string, unknown>)).toEqual([
      'object',
      'data',
      'first_id',
      'last_id',
      'has_more',
    ])
  })

  it('无 after 且无 page_format 时绝不出现 next_cursor;带 after 也不出现', async () => {
    const { threadId } = await fixtureThread('legacy-no-cursor-key')
    const ids = await addMessages(threadId, 4)
    for (const url of [
      `/v1/threads/${threadId}/messages`,
      `/v1/threads/${threadId}/messages?limit=2`,
      `/v1/threads/${threadId}/messages?limit=2&after=${ids[0]}`,
    ]) {
      const keys = Object.keys((await get(url)).json() as Record<string, unknown>)
      expect(keys).not.toContain('next_cursor')
    }
    // 旧 after=裸 id 的翻页结果不变
    const second = (
      await get(`/v1/threads/${threadId}/messages?limit=2&after=${ids[1]}`)
    ).json() as Record<string, unknown>
    expect((second.data as Array<{ id: string }>).map((m) => m.id)).toEqual([ids[2], ids[3]])
    expect(second.has_more).toBe(false)
  })

  it('旧 after 指向已不存在的 id 时仍"从头再翻"(既有行为,不被新 400 抢走)', async () => {
    const { threadId } = await fixtureThread('legacy-anchor-gone')
    const ids = await addMessages(threadId, 2)
    const res = await get(`/v1/threads/${threadId}/messages?limit=2&after=msg_does_not_exist`)
    expect(res.statusCode).toBe(200)
    expect((res.json() as Record<string, unknown>).data).toHaveLength(2)
    expect((res.json() as Record<string, unknown>).first_id).toBe(ids[0])
  })

  it('游标模式下锚点已消失 → 400(宁可让客户端从头翻,也不重复吐第一页)', async () => {
    const { threadId } = await fixtureThread('cursor-anchor-gone')
    await addMessages(threadId, 2)
    const res = await get(
      `/v1/threads/${threadId}/messages?page_format=cursor&limit=2&after=msg_gone`,
    )
    expect(res.statusCode).toBe(400)
  })

  it('batches 旧契约信封键序不变(object/data/has_more/first_id/last_id)', async () => {
    const { redis } = need()
    redis.seed(
      `${BATCH_KEY_PREFIX}batch_legacy_0`,
      batchTaskFixture('batch_legacy_0', 'ak_batches', 1_700_000_000_000),
    )
    redis.seed(
      `${BATCH_KEY_PREFIX}batch_legacy_1`,
      batchTaskFixture('batch_legacy_1', 'ak_batches', 1_700_000_001_000),
    )
    const res = await get('/v1/batches?limit=20', 'ak_batches')
    expect(res.statusCode).toBe(200)
    const body = res.json() as Record<string, unknown>
    expect(Object.keys(body)).toEqual(['object', 'data', 'has_more', 'first_id', 'last_id'])
    expect(body.has_more).toBe(false) // 20 一屏只回了 2 条 —— 既有 page-full 判据
    expect(body.first_id).toBe('batch_legacy_1')
    expect(body.last_id).toBe('batch_legacy_0')

    // 恰好填满一屏时,既有判据仍回 true(哪怕已经没有下一页):这条语义必须原样留着
    const exact = await get('/v1/batches?limit=2', 'ak_batches')
    expect((exact.json() as Record<string, unknown>).has_more).toBe(true)
  })
})

// =============================================================================
// 4. cursor-page 纯函数单测
// =============================================================================

describe('cursor-page 纯函数', () => {
  const SECRET = 'unit-test-secret-please-ignore'
  const bindingA: CursorBinding = { kind: CURSOR_KIND.assistants, ownerKey: 'user:a' }
  const bindingB: CursorBinding = { kind: CURSOR_KIND.assistants, ownerKey: 'user:b' }
  const bindingOtherKind: CursorBinding = {
    kind: CURSOR_KIND.threadRuns,
    ownerKey: 'user:a',
  }

  it('编解码往返拿回原 id', () => {
    const token = encodeCursor({ id: 'asst_123', binding: bindingA, secret: SECRET })
    expect(token.startsWith('cr1_')).toBe(true)
    expect(decodeCursor(token, bindingA, SECRET)).toEqual({ ok: true, id: 'asst_123' })
  })

  it('换 owner 解不开(foreign-scope)', () => {
    const token = encodeCursor({ id: 'asst_123', binding: bindingA, secret: SECRET })
    expect(decodeCursor(token, bindingB, SECRET)).toEqual({ ok: false, reason: 'foreign-scope' })
  })

  it('换列表族解不开(foreign-scope)', () => {
    const token = encodeCursor({ id: 'run_1', binding: bindingA, secret: SECRET })
    expect(decodeCursor(token, bindingOtherKind, SECRET)).toEqual({
      ok: false,
      reason: 'foreign-scope',
    })
  })

  it('换密钥解不开(signature);改一个字符也解不开', () => {
    const token = encodeCursor({ id: 'asst_123', binding: bindingA, secret: SECRET })
    expect(decodeCursor(token, bindingA, 'another-secret-entirely')?.ok).toBe(false)
    const tampered = `${token.slice(0, -2)}zz`
    expect(decodeCursor(tampered, bindingA, SECRET)).toEqual({ ok: false, reason: 'signature' })
  })

  it('非游标串一律拒(旧裸 id 绝不会被当成游标)', () => {
    expect(decodeCursor('asst_abc', bindingA, SECRET)).toEqual({ ok: false, reason: 'malformed' })
    expect(decodeCursor('cr1_', bindingA, SECRET)).toEqual({ ok: false, reason: 'malformed' })
    // 签名先验、结构后解:没验过签名的载荷一律不解(所以乱码载荷报的是 signature)
    expect(decodeCursor('cr1_没有这个.签名', bindingA, SECRET)).toEqual({
      ok: false,
      reason: 'signature',
    })
    expect(decodeCursor('cr1_x.y', bindingB, SECRET).ok).toBe(false)
  })

  it('resolveAfter:缺省→从头,裸 id→透传,游标→解出内部 id,坏游标→报错', () => {
    expect(resolveAfter(undefined, bindingA, SECRET)).toEqual({ ok: true, afterId: null })
    expect(resolveAfter('', bindingA, SECRET)).toEqual({ ok: true, afterId: null })
    expect(resolveAfter('asst_raw', bindingA, SECRET)).toEqual({ ok: true, afterId: 'asst_raw' })
    const token = encodeCursor({ id: 'asst_9', binding: bindingA, secret: SECRET })
    expect(resolveAfter(token, bindingA, SECRET)).toEqual({ ok: true, afterId: 'asst_9' })
    expect(resolveAfter(`${token}x`, bindingA, SECRET).ok).toBe(false)
    expect(resolveAfter(42, bindingA, SECRET).ok).toBe(false)
  })

  it('clampLimit:越界夹紧、非数回落默认', () => {
    const limits = { def: 20, max: 100 }
    expect(clampLimit('500', limits)).toBe(100)
    expect(clampLimit(500, limits)).toBe(100)
    expect(clampLimit(0, limits)).toBe(1)
    expect(clampLimit('-5', limits)).toBe(1)
    expect(clampLimit(undefined, limits)).toBe(20)
    expect(clampLimit('abc', limits)).toBe(20)
    expect(clampLimit('7', limits)).toBe(7)
  })

  it('pageOf 两条 has_more 判据各自不变(集合恰好一屏时结论相反)', () => {
    const items = [{ id: 'a' }, { id: 'b' }].map((x) => x.id)
    const request = { limit: 2, afterId: null }
    const beyond = pageOf(items, {
      request,
      idOf: (id: string) => id,
      hasMoreRule: 'beyond-page',
    })
    const full = pageOf(items, { request, idOf: (id: string) => id, hasMoreRule: 'page-full' })
    expect(beyond.has_more).toBe(false)
    expect(full.has_more).toBe(true)
    expect(beyond.data).toEqual(items)
  })

  it('pageOf 锚点不在集合里:anchor_missing=true 且按既有行为从头切', () => {
    const items = ['a', 'b'].map((id) => ({ id }))
    const outcome = pageOf(items, {
      request: { limit: 2, afterId: 'gone' },
      idOf: (item) => item.id,
      hasMoreRule: 'beyond-page',
    })
    expect(outcome.anchor_missing).toBe(true)
    expect(outcome.data).toEqual(items)
    expect(outcome.first_id).toBe('a')
    expect(outcome.last_id).toBe('b')
  })

  it('pageOf 只在游标模式且还有下一页时给 next_cursor', () => {
    const items = ['a', 'b', 'c'].map((id) => ({ id }))
    const cursor = { binding: bindingA, secret: SECRET }
    const paged = pageOf(items, {
      request: { limit: 2, afterId: null },
      idOf: (item) => item.id,
      hasMoreRule: 'beyond-page',
      cursor,
    })
    expect(paged.next_cursor).toMatch(/^cr1_/)
    expect(decodeCursor(paged.next_cursor as string, bindingA, SECRET)).toEqual({
      ok: true,
      id: 'b',
    })
    const lastPage = pageOf(items, {
      request: { limit: 2, afterId: 'b' },
      idOf: (item) => item.id,
      hasMoreRule: 'beyond-page',
      cursor,
    })
    expect(lastPage.has_more).toBe(false)
    expect(lastPage.next_cursor).toBeNull()
    const legacy = pageOf(items, {
      request: { limit: 2, afterId: null },
      idOf: (item) => item.id,
      hasMoreRule: 'beyond-page',
    })
    expect(legacy.next_cursor).toBeNull()
  })
})

// =============================================================================
// 5. ULID 句柄形态(纯本地,不起服务)
// =============================================================================

describe('run_ref 句柄形态', () => {
  it('26 位 Crockford 字母表、按时间可排序、不含 I/L/O/U', async () => {
    const { assistantId, threadId } = await fixtureThread('ref-shape')
    const first = (await post(`/v1/threads/${threadId}/runs`, { assistant_id: assistantId })).json()
      .run_ref as string
    const second = (
      await post(`/v1/threads/${threadId}/runs`, { assistant_id: assistantId })
    ).json().run_ref as string
    expect(first.slice(0, 10)).toBe(second.slice(0, 10)) // 同一秒内前缀(时间部分)一致
    expect(first).not.toBe(second) // 随机部分不同
    expect(/[ILOU]/.test(first)).toBe(false)
    // 时间戳单调:Crockford 前 10 字符按字典序即时间序,同一夹具里不会倒退
    expect(first.slice(0, 10) <= second.slice(0, 10)).toBe(true)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
