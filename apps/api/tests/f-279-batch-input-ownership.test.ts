// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-279 回归锁(2026-11-13)。
 *
 * 病灶:`/v1/files?purpose=batch` 的输入文件存全局 Redis 键 `batch:input:<fileId>`,
 * 创建 batch 只校验 shape 不校验归属 ⇒ Key-A 上传的 fileId 可被 Key-B 建任务读取他人
 * JSONL prompts;且上传分支每请求 `new IORedis`,异常路径才靠 finally disconnect。
 *
 * 本文件锁:
 *   ① 键形如 `batch:input:<apiKeyId>:<fileId>`,上传落点按 Key 分区;
 *   ② 同一次上传请求只取一次连接(复用 server.redis,不再 new IORedis);
 *   ③ Key-B 用 Key-A 的 fileId 建 batch → 404(与"文件不存在"同响应);
 *   ④ 同 Key 建 batch → 200,且 worker 用任务里的 _apiKeyId 能读回同一份 JSONL。
 *
 * 全本地:Redis 用 Map 假实现,API Key 鉴权 / DB / BullMQ 打桩,不触达真设施。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance, type FastifyError } from 'fastify'
import multipart from '@fastify/multipart'
import type { Redis } from 'ioredis'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
  process.env.AI_SERVICE_URL ??= 'http://test-ai-service:8802'
})

const KEY_A = 'ak_f279_a'
const KEY_B = 'ak_f279_b'

const KEYS: Record<string, { id: string; userId: string }> = {
  [KEY_A]: { id: KEY_A, userId: 'user_f279_a' },
  [KEY_B]: { id: KEY_B, userId: 'user_f279_b' },
}

/** 鉴权打桩:凭 `x-test-key-id` 头挑身份(真实现是 Bearer + developer_api_keys 查表)。 */
vi.mock('../src/plugins/api-key-auth.js', () => ({
  requireApiKeyAuth: vi.fn(async (request: { headers: Record<string, unknown> }) => {
    const raw = request.headers['x-test-key-id']
    const owner = typeof raw === 'string' ? KEYS[raw] : undefined
    if (!owner) {
      throw Object.assign(new Error('请提供 API Key 鉴权'), { statusCode: 401 })
    }
    ;(request as { apiKey?: unknown }).apiKey = {
      id: owner.id,
      userId: owner.userId,
      key: `ihui_${owner.id}`,
      // 能力闸走真代码:上传要 files:write,建 batch 要 batches:write(见 capability-guard)。
      permissions: ['files:read', 'files:write', 'batches:read', 'batches:write'],
      rateLimit: 100,
      allowedModels: null,
    }
  }),
  requireApiKeyPermission: vi.fn(() => async () => {}),
  requireApiKeyQuota: vi.fn(() => async () => {}),
  checkAllowedModels: vi.fn(() => true),
  authenticateApiKey: vi.fn(),
}))

/** DB import 安全:本用例的 batch 上传分支在落库前就返回,不执行任何查询。 */
vi.mock('../src/db/index.js', () => {
  const chain = (): Record<string, unknown> => {
    const step: Record<string, unknown> = {}
    for (const m of ['from', 'where', 'set', 'returning', 'values', 'orderBy', 'limit', 'offset']) {
      step[m] = vi.fn(() => step)
    }
    step.then = (resolve: (v: unknown) => void) => Promise.resolve([]).then(resolve)
    return step
  }
  return {
    db: { execute: vi.fn(async () => []), select: vi.fn(chain), insert: vi.fn(chain) },
    dbRead: { execute: vi.fn(async () => []), select: vi.fn(chain) },
  }
})

/** BullMQ 打桩:创建 batch 只验证入队被调用,不连真 Redis。 */
vi.mock('../src/queue/index.js', () => ({
  getBatchQueue: vi.fn(() => ({ add: vi.fn(async () => ({ id: 'job_f279' })) })),
}))

/** 连接取用计数:F-279 要求同一请求内只取一次连接(server.redis),不得每请求 new。 */
const { redisAcquire } = vi.hoisted(() => ({ redisAcquire: { count: 0 } }))

vi.mock('../src/queue/batch-queue.js', async (importOriginal) => {
  type BatchQueueActual = {
    getBatchInputRedis: (server: { redis: Redis }) => Redis
  } & Record<string, unknown>
  const actual = (await importOriginal()) as BatchQueueActual
  return {
    ...actual,
    getBatchInputRedis: vi.fn((server: { redis: Redis }) => {
      redisAcquire.count += 1
      return actual.getBatchInputRedis(server)
    }),
  }
})

import v1PublicRoutes from '../src/routes/v1-public'
import v1BatchesRoutes from '../src/routes/v1-batches'
import {
  BATCH_INPUT_KEY_PREFIX,
  BATCH_KEY_PREFIX,
  batchInputKey,
  getBatchInput,
  isBatchInputOwnedBy,
} from '../src/queue/batch-queue'

// =============================================================================
// 内存假 Redis(只实现本路径用到的命令)
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
  async exists(key: string): Promise<number> {
    return this.strs.has(key) ? 1 : 0
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
  peek(key: string): string | undefined {
    return this.strs.get(key)
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

beforeAll(async () => {
  const app = Fastify({ logger: false })
  const redis = new FakeRedis()
  app.decorate('redis', redis as unknown as Redis)
  app.decorate('redisForQueue', undefined as unknown as Redis)
  app.setErrorHandler((err: FastifyError, _request, reply) => {
    const statusCode = (err as Error & { statusCode?: number }).statusCode ?? 500
    reply.status(statusCode).send({ code: statusCode, message: err.message })
  })
  await app.register(multipart)
  await app.register(v1PublicRoutes, { prefix: '/v1' })
  await app.register(v1BatchesRoutes, { prefix: '/v1' })
  await app.ready()
  harness = { app, redis }
}, 60_000)

afterAll(async () => {
  await harness?.app.close()
})

function need(): Harness {
  if (!harness) throw new Error('harness 未初始化')
  return harness
}

beforeEach(() => {
  redisAcquire.count = 0
})

const JSONL = '{"custom_id":"r1","method":"POST","url":"/v1/chat/completions","body":{}}\n'

/** 手搓 multipart:目的字段在前,文件在后(路由靠 data.fields.purpose 判分支)。 */
function multipartUpload(keyId: string, content = JSONL) {
  const boundary = '----f279boundary'
  const body =
    `--${boundary}\r\n` +
    'Content-Disposition: form-data; name="purpose"\r\n\r\n' +
    'batch\r\n' +
    `--${boundary}\r\n` +
    'Content-Disposition: form-data; name="file"; filename="input.jsonl"\r\n' +
    'Content-Type: application/jsonl\r\n\r\n' +
    `${content}\r\n` +
    `--${boundary}--\r\n`
  return need().app.inject({
    method: 'POST',
    url: '/v1/files',
    headers: {
      'content-type': `multipart/form-data; boundary=${boundary}`,
      'x-test-key-id': keyId,
    },
    payload: Buffer.from(body, 'utf8'),
  })
}

function createBatch(keyId: string, inputFileId: string) {
  return need().app.inject({
    method: 'POST',
    url: '/v1/batch',
    headers: { 'x-test-key-id': keyId },
    payload: { input_file_id: inputFileId, endpoint: '/v1/chat/completions' },
  })
}

// =============================================================================
// 1. 键形态 + 连接取用次数
// =============================================================================

describe('F-279 上传:键按 API Key 分区,同一请求只取一次连接', () => {
  it('键形如 `batch:input:<apiKeyId>:<fileId>`,且只取一次 server.redis', async () => {
    const res = await multipartUpload(KEY_A)
    expect(res.statusCode).toBe(201)
    const fileId = (res.json() as { id: string }).id

    expect(BATCH_INPUT_KEY_PREFIX).toBe('batch:input:')
    expect(batchInputKey(KEY_A, fileId)).toBe(`batch:input:${KEY_A}:${fileId}`)
    expect(need().redis.peek(batchInputKey(KEY_A, fileId))).toBe(JSONL)
    // 不再写全局键:无 apiKeyId 维度的旧键不得存在
    expect(need().redis.peek(`batch:input:${fileId}`)).toBeUndefined()

    // 反回退:每请求 new IORedis 时该计数为 0;重复取连接时为 2。
    expect(redisAcquire.count).toBe(1)
  })
})

// =============================================================================
// 2. 归属校验(创建 batch 时读取)
// =============================================================================

describe('F-279 归属:他人 fileId 一律 404,同 Key 可读', () => {
  it('Key-B 用 Key-A 的 fileId 建 batch → 404,归属断言拒绝', async () => {
    const uploaded = await multipartUpload(KEY_A)
    const fileId = (uploaded.json() as { id: string }).id

    const stolen = await createBatch(KEY_B, fileId)
    expect(stolen.statusCode).toBe(404)
    expect((stolen.json() as { message: string }).message).toBe('Input file not found')

    // 读取侧同样按 key 分区:他人 key 读不到内容
    expect(await getBatchInput(need().redis as unknown as Redis, KEY_B, fileId)).toBeNull()
    expect(
      await isBatchInputOwnedBy(need().redis as unknown as Redis, fileId, KEY_B),
    ).toBe(false)
  })

  it('同 Key 建 batch → 200,worker 用任务 _apiKeyId 读回同一份 JSONL', async () => {
    const uploaded = await multipartUpload(KEY_A)
    const fileId = (uploaded.json() as { id: string }).id

    const created = await createBatch(KEY_A, fileId)
    expect(created.statusCode).toBe(200)
    const taskId = (created.json() as { id: string }).id

    // 写入键与读取键一致:worker 消费时从任务里取 _apiKeyId 拼同一个键
    const rawTask = need().redis.peek(`${BATCH_KEY_PREFIX}${taskId}`)
    expect(rawTask).toBeTruthy()
    const task = JSON.parse(rawTask!) as { input_file_id: string; _apiKeyId: string }
    expect(task.input_file_id).toBe(fileId)
    expect(task._apiKeyId).toBe(KEY_A)
    expect(
      await getBatchInput(need().redis as unknown as Redis, task._apiKeyId, task.input_file_id),
    ).toBe(JSONL)

    expect(await isBatchInputOwnedBy(need().redis as unknown as Redis, fileId, KEY_A)).toBe(true)
  })

  it('从未上传的 fileId → 404(不存在=不属于,与 F-85 同口径)', async () => {
    const res = await createBatch(KEY_A, 'file-never-uploaded')
    expect(res.statusCode).toBe(404)
  })
})
