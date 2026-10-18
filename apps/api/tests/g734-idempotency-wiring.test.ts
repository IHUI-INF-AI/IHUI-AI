// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// G-734 余项 B/D 的接线回归 —— 与既有三张 g734 测试分工:
//
//   B(父作用域生产接线):既有 `-parent-scope.test.ts` 钉的是**内核**单射与跨**用户**的路由例;
//     本文件钉的是**接线**本身 —— 创建端点真的把客户端可持的父会话作用域(`session_id`)编进
//     幂等槽键的父段。判据是"键里真的出现了父段"(拿 `slotKeyOf` 逐字节对照),不是"碰巧没撞"。
//   D(corrupt 的 errorCode 映射):既有 `-corrupt-fact.test.ts` 钉的是内核抛错与副作用三不;
//     本文件钉的是**响应形状** —— 客户端拿到 500 + `IDEMPOTENCY_FACT_CORRUPT`,而不是一个
//     与任何其他 500 无法分辨的裸错。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Fastify, { type FastifyError, type FastifyInstance, type FastifyRequest } from 'fastify'
import {
  IDEMPOTENCY_FACT_CORRUPT_CODE,
  RUN_CREATE_NAMESPACE,
  createAgentRunRoutes,
} from '../src/routes/agent-runs.js'
import {
  idempotencySlotKey,
  requestFingerprint,
  slotKeyOf,
  type IdempotencyKv,
} from '../src/services/run-idempotency.js'

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: async (request: FastifyRequest): Promise<void> => {
    const raw = request.headers['x-test-user']
    if (typeof raw !== 'string' || raw === '') {
      const err = new Error('未登录') as Error & { statusCode: number }
      err.statusCode = 401
      throw err
    }
    const holder = request as unknown as { userId?: number }
    holder.userId = Number(raw)
  },
}))

interface Entry {
  value: string
  expiresAt: number
}

/** 语义对齐真 Redis 的 SET NX PX / GET / SET PX / DEL;`writes` 用来钉"键里真的出现了父段"。 */
class FakeKv implements IdempotencyKv {
  private readonly map = new Map<string, Entry>()
  /** 每次真实写入的键(含覆盖):B 的判据就是在这份清单里找到带父段的键。 */
  readonly writes: string[] = []

  private take(key: string): string | null {
    const hit = this.map.get(key)
    if (hit === undefined) return null
    if (hit.expiresAt <= Date.now()) {
      this.map.delete(key)
      return null
    }
    return hit.value
  }
  async get(key: string): Promise<string | null> {
    return this.take(key)
  }
  async setIfAbsent(key: string, value: string, ttlMs: number): Promise<'OK' | null> {
    if (this.take(key) !== null) return null
    this.map.set(key, { value, expiresAt: Date.now() + ttlMs })
    this.writes.push(key)
    return 'OK'
  }
  async setWithTtl(key: string, value: string, ttlMs: number): Promise<void> {
    this.map.set(key, { value, expiresAt: Date.now() + ttlMs })
    this.writes.push(key)
  }
  async delete(key: string): Promise<void> {
    this.map.delete(key)
  }
  size(): number {
    return this.map.size
  }
  /** 只读探针:D 的阳性对照要确认损坏事实原样躺在槽里,没被"顺手清理"。 */
  peek(key: string): string | null {
    return this.take(key)
  }
  seed(key: string, value: string): void {
    this.map.set(key, { value, expiresAt: Date.now() + 600_000 })
  }
}

describe('G-734B 路由级:父会话作用域真的编进了幂等槽键', () => {
  let app: FastifyInstance
  let kv: FakeKv
  let created: number

  async function createRun(
    key: string,
    over: { user?: string; session_id?: string; input?: string } = {},
  ): Promise<{ status: number; ref: string | undefined }> {
    const res = await app.inject({
      method: 'POST',
      url: '/',
      headers: { 'idempotency-key': key, 'x-test-user': over.user ?? '7' },
      payload: {
        agent_id: 'agent-1',
        input: over.input ?? `问句 ${key}`,
        ...(over.session_id === undefined ? {} : { session_id: over.session_id }),
      },
    })
    const body = res.json() as { data?: { run_ref?: string } }
    return { status: res.statusCode, ref: body.data?.run_ref }
  }

  async function listCount(user: string): Promise<number> {
    const res = await app.inject({ method: 'GET', url: '/list', headers: { 'x-test-user': user } })
    const body = res.json() as { data?: { items?: unknown[] } }
    return Array.isArray(body.data?.items) ? body.data.items.length : 0
  }

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-18T00:00:00.000Z'))
    created = 0
    let tick = 1_760_000_000_000
    kv = new FakeKv()
    app = Fastify()
    app.setErrorHandler((error: FastifyError, _request, reply) => {
      // 形态对齐 server.ts 的 errorHandler:AppError 的 errorCode 透传到响应体。
      // 刻意不复用既有路由测试那套"只回 message"的简版 —— D 项判据就是 errorCode 本身。
      const statusCode = error.statusCode ?? 500
      const errorCode = (error as { errorCode?: string }).errorCode
      return reply
        .code(statusCode)
        .send({ code: statusCode, message: error.message, ...(errorCode ? { errorCode } : {}) })
    })
    app.register(
      createAgentRunRoutes({
        kv,
        handleSecret: 'g734-wiring-secret',
        nowMs: () => {
          tick += 1000
          return tick
        },
        newRunId: () => {
          created += 1
          return `run_g734w-${created}`
        },
      }),
    )
    await app.ready()
  })

  afterEach(async () => {
    await app.close()
    vi.useRealTimers()
  })

  it('同一用户、同一 Idempotency-Key,不同 session_id ⇒ 各建一条、各回各的(票面第三例的父会话版)', async () => {
    const a1 = await createRun('key-sess-0001', { session_id: 's-A' })
    const b1 = await createRun('key-sess-0001', { session_id: 's-B' })
    expect(a1.status).toBe(201)
    expect(b1.status).toBe(201)
    expect(a1.ref).not.toBe(b1.ref)
    expect(created).toBe(2)

    // 各自重发才拿到 replay,且拿到的仍是**自己那个会话**的 run。
    const a2 = await createRun('key-sess-0001', { session_id: 's-A' })
    const b2 = await createRun('key-sess-0001', { session_id: 's-B' })
    expect(a2.status).toBe(200)
    expect(b2.status).toBe(200)
    expect(a2.ref).toBe(a1.ref)
    expect(b2.ref).toBe(b1.ref)
    expect(created).toBe(2)
    expect(await listCount('7')).toBe(2)
  })

  it('带父段与不带父段的同 key 互不命中(升级不产生伪重放,也不互相顶掉)', async () => {
    const plain = await createRun('key-sess-0002')
    const scoped = await createRun('key-sess-0002', { session_id: 's-A' })
    expect(plain.status).toBe(201)
    expect(scoped.status).toBe(201)
    expect(scoped.ref).not.toBe(plain.ref)

    const plainAgain = await createRun('key-sess-0002')
    const scopedAgain = await createRun('key-sess-0002', { session_id: 's-A' })
    expect(plainAgain.ref).toBe(plain.ref)
    expect(scopedAgain.ref).toBe(scoped.ref)
    expect(created).toBe(2)
  })

  it('阳性对照:落盘的键就是 slotKeyOf 带父段的逐字节形态,不带 session 的键没有父段标记', async () => {
    await createRun('key-sess-0003', { session_id: 's-A' })
    const expected = slotKeyOf({
      namespace: RUN_CREATE_NAMESPACE,
      ownerKey: 'user:7',
      parentKey: 'session:s-A',
      clientKey: 'key-sess-0003',
    })
    // 接线的判据是"键里真的出现了父段",不是"两次请求碰巧没撞":逐字节对照。
    // 父段以 %p 标记起头,段内冒号转义为 %3A(连字符不动)。
    expect(expected).toContain('%psession%3As-A')
    expect(kv.writes).toContain(expected)

    await createRun('key-sess-0004')
    const parentless = idempotencySlotKey(RUN_CREATE_NAMESPACE, 'user:7', 'key-sess-0004')
    expect(parentless).not.toContain('%p')
    expect(kv.writes).toContain(parentless)
  })
})

describe('G-734D 路由级:损坏事实回给客户端的是 500 + 可分辨 errorCode,不是裸 500', () => {
  let app: FastifyInstance
  let kv: FakeKv
  let created: number

  /** 铺一张"已完成却读不出载荷"的损坏事实(可指定父作用域,覆盖带父段接线的同型)。 */
  function seedCorrupt(clientKey: string, input: string, sessionId?: string): string {
    const key = slotKeyOf({
      namespace: RUN_CREATE_NAMESPACE,
      ownerKey: 'user:7',
      ...(sessionId === undefined ? {} : { parentKey: `session:${sessionId}` }),
      clientKey,
    })
    // 指纹必须与路由内部算的逐字同式({agent_id, input}),否则探针读到的只是"没撞上槽"。
    kv.seed(
      key,
      JSON.stringify({
        status: 'completed',
        fingerprint: requestFingerprint({ agent_id: 'agent-1', input }),
        ts: 0,
      }),
    )
    return key
  }

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-18T00:00:00.000Z'))
    created = 0
    let tick = 1_760_000_000_000
    kv = new FakeKv()
    app = Fastify()
    app.setErrorHandler((error: FastifyError, _request, reply) => {
      const statusCode = error.statusCode ?? 500
      const errorCode = (error as { errorCode?: string }).errorCode
      return reply
        .code(statusCode)
        .send({ code: statusCode, message: error.message, ...(errorCode ? { errorCode } : {}) })
    })
    app.register(
      createAgentRunRoutes({
        kv,
        handleSecret: 'g734-wiring-corrupt-secret',
        nowMs: () => {
          tick += 1000
          return tick
        },
        newRunId: () => {
          created += 1
          return `run_g734wd-${created}`
        },
      }),
    )
    await app.ready()
  })

  afterEach(async () => {
    await app.close()
    vi.useRealTimers()
  })

  it('POST 撞上损坏事实 ⇒ 500 + IDEMPOTENCY_FACT_CORRUPT( errorCode 与路由导出常量逐字同值)', async () => {
    const input = '问句 corrupt-d'
    seedCorrupt('key-corrupt-d1', input)
    const res = await app.inject({
      method: 'POST',
      url: '/',
      headers: { 'idempotency-key': 'key-corrupt-d1', 'x-test-user': '7' },
      payload: { agent_id: 'agent-1', input },
    })
    expect(res.statusCode).toBe(500)
    const body = res.json() as { errorCode?: string }
    expect(body.errorCode).toBe(IDEMPOTENCY_FACT_CORRUPT_CODE)
    expect(body.errorCode).toBe('IDEMPOTENCY_FACT_CORRUPT')
    // 判据的实体:一个 run 都没被建出来,损坏档没有被"顺手清理"。
    expect(created).toBe(0)
    expect(kv.writes.filter((key) => key.startsWith('agent_run:'))).toEqual([])
  })

  it('带父作用域的同一型同样落 IDEMPOTENCY_FACT_CORRUPT(接线与映射两条增量互不遮蔽)', async () => {
    const input = '问句 corrupt-d2'
    const slotKey = seedCorrupt('key-corrupt-d2', input, 's-A')
    const res = await app.inject({
      method: 'POST',
      url: '/',
      headers: { 'idempotency-key': 'key-corrupt-d2', 'x-test-user': '7' },
      payload: { agent_id: 'agent-1', input, session_id: 's-A' },
    })
    expect(res.statusCode).toBe(500)
    expect((res.json() as { errorCode?: string }).errorCode).toBe('IDEMPOTENCY_FACT_CORRUPT')
    expect(created).toBe(0)
    // 槽里的损坏事实原样还在:既不回放、也不重建、也不删。
    expect(kv.peek(slotKey)).not.toBe(null)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
