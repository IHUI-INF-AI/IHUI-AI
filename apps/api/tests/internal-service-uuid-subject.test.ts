// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 内部服务通道的**主体形状闸**(2026-10-28 立)。
 *
 * 一手现场:生产 `api_logs` 近 24h 有 18 次 `GET /api/memory -> 500`,
 * `user_agent=python-httpx/0.28.1`(即 ai-service 自己经 `app/services/memory_service.py`
 * 的出站腿打回来的)、`user_id` 列为空、`duration` 6–11ms(快速失败)。
 * 本机 8802 用**同一形出站请求**(ai-service 自己的 `internal_service_headers` 出口)复现:
 *   - 主体 `system-worker` / `1` ⇒ **HTTP 500**,真异常是
 *     `DrizzleQueryError` ← Postgres `22P02 invalid input syntax for type uuid`
 *     (`users.id` 是 uuid 列,`eq(users.id, 'system-worker')` 直接炸在鉴权层内部);
 *   - 合法 uuid 形态但库里没有 ⇒ 401 User not found(查询确实跑了一次)。
 * 也就是说:"结构上不可能存在的主体"与"服务坏了"在响应上完全同形(§utils/uuid.ts 头注
 * 记过的那一型),监控里只剩一枚无法追责的 5xx。
 *
 * 本文件钉三件事,缺一不可:
 *  ① 脏主体归位 **401 且零查询**(`mockSelect` 未被调用 = 副作用未发生)——两条通道都要,
 *     因为票档的 `sub` 同样是签名载荷里的自由字符串,只堵老通道那条正则等于没堵;
 *  ② 正向对照:合法 uuid 主体必须**照常通过**(闸不是一刀切,否则就是恒红门);
 *  ③ 路由级:`GET /api/memory` 这一形态**不再是 500**,且处理函数一步都没进
 *     (假 redis 的 `get` 未被调用)。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  // 与 tests/v1-memory-principal.test.ts 同口径:任何用例都不得触真库/真 Redis(§5 测试隔离铁律)
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.AI_SERVICE_URL ??= 'http://test-ai-service:8803'
})

const TEST_JWT_SECRET = 'unit-test-only-internal-ticket-secret-0123456789abcdef'
const TEST_AI_CALLBACK_SECRET = 'internal-secret-value-for-tests-0123456789'
const ORIGINAL_JWT_SECRET = process.env.JWT_SECRET
process.env.JWT_SECRET = TEST_JWT_SECRET

const { mockSelect } = vi.hoisted(() => ({ mockSelect: vi.fn() }))

vi.mock('../src/db/index.js', () => {
  const chain = {
    select: () => ({
      from: () => ({ where: () => ({ limit: () => mockSelect() }) }),
    }),
  }
  const stub = {
    ...chain,
    execute: vi.fn().mockResolvedValue([]),
    insert: vi.fn(),
    update: vi.fn(),
  }
  return { db: stub, dbRead: stub, dbWriter: stub, dbClient: { end: vi.fn() } }
})

vi.mock('../src/config/index.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  const base = (actual as { config?: Record<string, unknown> }).config ?? {}
  return {
    ...actual,
    config: {
      ...base,
      AI_CALLBACK_SECRET: TEST_AI_CALLBACK_SECRET,
      INTERNAL_SERVICE_AUTH_MODE: 'dual',
    },
  }
})

const { checkInternalServiceToken } = await import('../src/plugins/internal-service-token')
const { mintInternalServiceTicket } = await import('../src/plugins/internal-service-ticket')
const { INTERNAL_TICKET_HEADER } = await import('../src/plugins/internal-service-ticket')
const { memoryRoutes } = await import('../src/routes/memory.js')

const UUID_PRINCIPAL = '6b8cd0f6-546f-44c8-853a-5f96edbe08be'
/** 生产里真实出现过的那一枚伪身份(apps/api/src/utils/system-access-token.ts 的 SUBJECT)。 */
const PSEUDO_PRINCIPALS = ['system-worker', '1', 'abc'] as const

/** 只认 set/get 的最小 Redis 替身:既能当票的一次性登记表,也当 memory 路由的读侧探针。 */
function fakeRedis() {
  const getCalls: string[] = []
  return {
    getCalls,
    client: {
      async set(_key: string, _value: string, ..._rest: unknown[]) {
        return 'OK'
      },
      async get(key: string) {
        getCalls.push(key)
        return null
      },
    },
  }
}

async function buildProbe(opts?: {
  route?: boolean
  redis?: ReturnType<typeof fakeRedis>
}): Promise<FastifyInstance> {
  // 刻意不 app.ready():Fastify 5 在 ready() 后再挂路由会被 avvio 拒(FST_ERR_PLUGIN_ALREADY_BOOTED)
  const app = Fastify({ logger: false })
  if (opts?.redis) app.decorate('redis' as never, opts.redis.client as never)
  if (opts?.route) {
    await app.register(memoryRoutes, { prefix: '/api' })
  } else {
    app.get('/probe', async (request, reply) => {
      const ok = await checkInternalServiceToken(request, reply)
      if (ok) return { ok: true }
      return reply
    })
  }
  return app
}

async function call(
  app: FastifyInstance,
  url: string,
  headers: Record<string, string>,
): Promise<{ status: number; body: string }> {
  const res = await app.inject({ method: 'GET', url, headers })
  return { status: res.statusCode, body: res.body }
}

// 顶层复位:两个 describe 都按"本用例内是否发过 SQL"下断言,
// 残留上一枚用例的调用会把零查询断言读成假红(§0.3 取不到输入不得冒红同型)。
beforeEach(() => {
  mockSelect.mockReset()
})

describe('内部服务通道:非 uuid 主体一律归位 401 且零查询', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    app = await buildProbe({ redis: fakeRedis() })
  })
  afterEach(async () => {
    await app.close()
    process.env.JWT_SECRET = ORIGINAL_JWT_SECRET
  })

  for (const subject of PSEUDO_PRINCIPALS) {
    it(`老通道(常驻密钥)+ 主体 ${JSON.stringify(subject)} ⇒ 401,且一条 SQL 都没发`, async () => {
      mockSelect.mockResolvedValue([{ id: subject, status: 1, roleId: 0 }])
      const r = await call(app, '/probe', {
        'x-internal-service-token': TEST_AI_CALLBACK_SECRET,
        'x-user-id': subject,
      })
      expect(r.status).toBe(401)
      expect(r.body).toContain('UUID')
      // 副作用未发生:脏主体绝不能外溢成 uuid 列的查询
      expect(mockSelect).not.toHaveBeenCalled()
    })
  }

  it('票档(合法票,sub 为非 uuid)⇒ 同样 401 且零查询 —— 只堵老通道等于没堵', async () => {
    mockSelect.mockResolvedValue([{ id: 'system-worker', status: 1, roleId: 0 }])
    const ticket = await mintInternalServiceTicket({
      userId: 'system-worker',
      scope: 'memory',
      jti: 'jti-uuid-gate-1',
    })
    const r = await call(app, '/probe', { [INTERNAL_TICKET_HEADER]: ticket })
    expect(r.status).toBe(401)
    expect(r.body).toContain('UUID')
    expect(mockSelect).not.toHaveBeenCalled()
  })

  it('正向对照:uuid 主体 + 活跃用户 ⇒ 200,且恰好查一次库(闸不是一刀切)', async () => {
    mockSelect.mockResolvedValue([{ id: UUID_PRINCIPAL, status: 1, roleId: 0 }])
    const r = await call(app, '/probe', {
      'x-internal-service-token': TEST_AI_CALLBACK_SECRET,
      'x-user-id': UUID_PRINCIPAL,
    })
    expect(r.status).toBe(200)
    expect(mockSelect).toHaveBeenCalledTimes(1)
  })
})

describe('路由级回归:GET /api/memory 该形态不再 500', () => {
  it('system-worker 票打 GET /api/memory ⇒ 401(不是 500),处理函数一步未进', async () => {
    const redis = fakeRedis()
    const app = await buildProbe({ route: true, redis })
    mockSelect.mockResolvedValue([{ id: 'system-worker', status: 1, roleId: 0 }])
    const ticket = await mintInternalServiceTicket({
      userId: 'system-worker',
      scope: 'memory',
      jti: 'jti-uuid-gate-2',
    })
    const r = await call(app, '/api/memory?scope=user', { [INTERNAL_TICKET_HEADER]: ticket })
    expect(r.status).toBe(401)
    expect(r.status).not.toBe(500)
    // 读侧副作用未发生:记忆桶一次都没被读
    expect(redis.getCalls).toEqual([])
    expect(mockSelect).not.toHaveBeenCalled()
    await app.close()
  })

  it('正向对照:uuid 主体打同一路由 ⇒ 200 且真的读了桶', async () => {
    const redis = fakeRedis()
    const app = await buildProbe({ route: true, redis })
    mockSelect.mockResolvedValue([{ id: UUID_PRINCIPAL, status: 1, roleId: 0 }])
    const r = await call(app, '/api/memory?scope=user', {
      'x-internal-service-token': TEST_AI_CALLBACK_SECRET,
      'x-user-id': UUID_PRINCIPAL,
    })
    expect(r.status).toBe(200)
    expect(JSON.parse(r.body).data).toMatchObject({ entries: [], total: 0 })
    expect(redis.getCalls.length).toBeGreaterThan(0)
    await app.close()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
