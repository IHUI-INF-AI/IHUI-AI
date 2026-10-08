// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// G-734① —— 父作用域必须是全局主键里**独立且不可伪造**的一段。
//
// 票面唯一判据:「跨会话同 commandId 互不干扰 —— 第三例是本票唯一判据,缺它=①没落地」。
// 这张测试文件就是那一例的载体,分两层跑:
//
//   内核层(`runIdempotently` + `slotKeyOf`):上游 `v4_command_fact` 的主键是
//     `child:<parentSessionId>:<sourceCommandId>`,父段与子 id 各占一段。我方原来只有
//     `idem:res:<ns>:<owner>:<clientKey>` —— 归属在键里,**父作用域压根没有那一段**。
//   路由层(真 Fastify + inject):同一 Idempotency-Key 跨归属互不命中,并把票面前两例
//     (同 key 连发两次 ⇒ 同一个 run ∧ 只落一条)与第三例并置在同一个文件里对照跑,
//     免得"跨作用域"那一例被读成另一张盘上的抽象结论。
//
// 只测单射还不够:"加了父段却谁都折不到它"与"没加父段"在返回值上完全同形。所以本文件
// 一半的力气花在**折叠攻击**上 —— 拿客户端可控的两个段(父段、命令 id)互相冒充。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Fastify, { type FastifyError, type FastifyInstance, type FastifyRequest } from 'fastify'
import { RUN_CREATE_NAMESPACE, createAgentRunRoutes } from '../src/routes/agent-runs.js'
import {
  SlotScopeError,
  idempotencySlotKey,
  runIdempotently,
  slotKeyOf,
  type IdempotencyKv,
  type IdempotencySlotRef,
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

/** 语义对齐真 Redis 的 SET NX PX / GET / SET PX / DEL;`writes` 用来数"库内行数"。 */
class FakeKv implements IdempotencyKv {
  private readonly map = new Map<string, Entry>()
  /** 每次真实写入的键(含覆盖),用来证明"第二条会话并没有去动第一条的键"。 */
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
  /** 只读快照:这张盘上此刻还有几个键(证明"没有互相覆盖")。 */
  size(): number {
    return this.map.size
  }
}

function refOf(over: Partial<IdempotencySlotRef> = {}): IdempotencySlotRef {
  return {
    namespace: 'unit.create',
    ownerKey: 'user:1',
    clientKey: 'cmd-00000001',
    ...over,
  }
}

describe('G-734① 键构造:父作用域是独立一段,且不可被其他段冒充', () => {
  it('同 ns/owner/client,不同 parent ⇒ 键不同(票面"两个会话复用同一 commandId"的机械形态)', () => {
    const a = slotKeyOf(refOf({ parentKey: 'session:A' }))
    const b = slotKeyOf(refOf({ parentKey: 'session:B' }))
    const noParent = slotKeyOf(refOf())
    expect(a).not.toBe(b)
    // 有父段与无父段也必须分得开 —— 否则"没带 parent"的一次请求就能把带 parent 的事实顶掉。
    expect(a).not.toBe(noParent)
  })

  it('折叠攻击:客户端键里塞冒号,折不出别人的"父段:键"组合', () => {
    const pairs: ReadonlyArray<readonly [IdempotencySlotRef, IdempotencySlotRef, string]> = [
      [
        refOf({ parentKey: 'a', clientKey: 'b' }),
        refOf({ clientKey: 'a:b' }),
        '不带父段时把 "父段:键" 整串塞进客户端键',
      ],
      [
        refOf({ parentKey: 'a:b', clientKey: 'c' }),
        refOf({ parentKey: 'a', clientKey: 'b:c' }),
        '父段与键段各自带冒号时不得互相移位',
      ],
      [refOf({ parentKey: 'px' }), refOf({ clientKey: '%ppx' }), '客户端键以 %p 起头冒充父段标记'],
      [
        refOf({ ownerKey: 'user:1:2', clientKey: 'c' }),
        refOf({ ownerKey: 'user:1', parentKey: '2', clientKey: 'c' }),
        '归属段多吃一段冒号,冒充"归属 + 父段"',
      ],
    ]
    for (const [left, right, why] of pairs) {
      // 单射是"每一对都不同",不是"这一族里挑几对不同" —— 逐对点名,红的时候知道是哪一型。
      expect(slotKeyOf(left), why).not.toBe(slotKeyOf(right))
    }
  })

  it('不带 parent 的键与改动前逐字节同形(上线不产生任何伪重放)', () => {
    // 这条是"改动安全"的证据,不是美观问题:既有槽位里躺着别人在途的锁与已完成事实,
    // 键形态一变,同一个 Idempotency-Key 就会绕开旧槽重跑一次创建。
    const legacy = idempotencySlotKey('ns', 'user:1', 'same-key-123')
    expect(legacy).toBe('idem:res:ns:user:1:same-key-123')
    expect(slotKeyOf(refOf())).toBe('idem:res:unit.create:user:1:cmd-00000001')
    // 阳性对照:键里真出现父段时,字节形态**确实**不同 —— 少了这一句,上面两条只证明"没变",
    // 证明不了"父段真的进了键"。
    expect(slotKeyOf(refOf({ parentKey: 'session:A' }))).toBe(
      'idem:res:unit.create:user:1:%psession%3AA:cmd-00000001',
    )
  })

  it('服务端段越界即炸在拼键那一刻,而不是留下一个会折叠的键让别人踩', () => {
    // 这四型全是**调用方代码**写错,不是客户端输入:客户端能控制的段一律走转义,越不了界。
    expect(() => slotKeyOf(refOf({ namespace: 'has:colon' }))).toThrow(SlotScopeError)
    expect(() => slotKeyOf(refOf({ namespace: 'has%percent' }))).toThrow(SlotScopeError)
    expect(() => slotKeyOf(refOf({ ownerKey: 'user:%p1' }))).toThrow(SlotScopeError)
    expect(() => slotKeyOf(refOf({ ownerKey: 'user::1' }))).toThrow(SlotScopeError)
    expect(() => slotKeyOf(refOf({ clientKey: '' }))).toThrow(SlotScopeError)
    // 反向对照:合法形态(带点号的命名空间 + 前缀式归属)绝不该被拦 ——
    // 判据过严的代价是每一个正常调用点都被逼去写豁免。
    expect(() => slotKeyOf(refOf({ namespace: RUN_CREATE_NAMESPACE }))).not.toThrow()
    expect(slotKeyOf(refOf({ ownerKey: 'key:abc123' }))).toContain('key:abc123')
  })
})

describe('G-734① 内核:两个会话复用同一个 commandId 互不干扰(票面唯一判据)', () => {
  it('同 clientKey、不同 parentKey ⇒ 各建一次、各回各的,谁也没把谁的事实顶掉', async () => {
    const kv = new FakeKv()
    let created = 0
    const make = async (): Promise<{ id: string }> => {
      created += 1
      return { id: `res-${created}` }
    }
    const inSession = (parentKey: string) =>
      runIdempotently<{ id: string }>({
        kv,
        ...refOf({ parentKey }),
        fingerprint: 'fp-1',
        ttlMs: 60_000,
        create: make,
      })

    const a1 = await inSession('session:A')
    const b1 = await inSession('session:B')
    expect(a1.ok && b1.ok).toBe(true)
    if (!a1.ok || !b1.ok) throw new Error('unreachable')
    // 两条会话各自**真建**了一次:共享一条事实就是 ① 的失效形态。
    expect(a1.replayed).toBe(false)
    expect(b1.replayed).toBe(false)
    expect(a1.value.id).not.toBe(b1.value.id)
    expect(created).toBe(2)

    // 各自重发才该拿到 replayed,且拿到的仍是**自己那一父作用域**的结果。
    const a2 = await inSession('session:A')
    const b2 = await inSession('session:B')
    expect(a2.ok && b2.ok).toBe(true)
    if (!a2.ok || !b2.ok) throw new Error('unreachable')
    expect(a2.replayed).toBe(true)
    expect(b2.replayed).toBe(true)
    expect(a2.value.id).toBe(a1.value.id)
    expect(b2.value.id).toBe(b1.value.id)
    // 唯一判据的收口:八次动作里创建只发生了两次,而盘上恰好两条记录 —— 没有互相覆盖,
    // 也没有"第二个会话进来把第一个的键改写成自己的事实"。
    expect(created).toBe(2)
    expect(new Set(kv.writes).size).toBe(2)
    expect(kv.size()).toBe(2)
  })

  it('阳性对照:去掉父段这一维,两个会话的同一个 commandId 就会撞进同一条事实', async () => {
    // 这条不是装饰:它证明上面那例测的是**父段**而不是"随手多传了一个可选字段"。
    // 把 parentKey 摘掉,同一 clientKey 的两次调用必须塌回同一条槽(第二次是 replayed),
    // 也就是 ① 落地前我方真实的形态。
    const kv = new FakeKv()
    let created = 0
    const make = async (): Promise<{ id: string }> => {
      created += 1
      return { id: `res-${created}` }
    }
    const call = () =>
      runIdempotently<{ id: string }>({
        kv,
        ...refOf(),
        fingerprint: 'fp-1',
        ttlMs: 60_000,
        create: make,
      })
    const first = await call()
    const second = await call()
    expect(first.ok && second.ok).toBe(true)
    if (!first.ok || !second.ok) throw new Error('unreachable')
    expect(second.replayed).toBe(true)
    expect(created).toBe(1)
    expect(kv.size()).toBe(1)
  })
})

describe('G-734① 路由级:跨归属共用同一个 Idempotency-Key 互不命中', () => {
  let app: FastifyInstance
  let kv: FakeKv
  let created: number

  async function createRun(
    key: string,
    over: { user?: string; input?: string } = {},
  ): Promise<{ status: number; ref: string | undefined }> {
    const res = await app.inject({
      method: 'POST',
      url: '/',
      headers: { 'idempotency-key': key, 'x-test-user': over.user ?? '7' },
      payload: { agent_id: 'agent-1', input: over.input ?? `问句 ${key}` },
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
    vi.setSystemTime(new Date('2026-10-08T00:00:00.000Z'))
    created = 0
    let tick = 1_760_000_000_000
    kv = new FakeKv()
    app = Fastify()
    app.setErrorHandler((error: FastifyError, _request, reply) => {
      // 形参标注清楚:既有那套路由测试同款写法把 unknown 直接取 `.message`,在
      // `tsconfig.tests.json` 面上是一条常驻红(TS18046)。不复用它,新文件不新增这一型。
      const statusCode = error.statusCode ?? 500
      return reply.code(statusCode).send({ code: statusCode, message: error.message })
    })
    app.register(
      createAgentRunRoutes({
        kv,
        handleSecret: 'g734-route-secret',
        nowMs: () => {
          tick += 1000
          return tick
        },
        newRunId: () => {
          created += 1
          return `run_g734-${created}`
        },
      }),
    )
    await app.ready()
  })

  afterEach(async () => {
    await app.close()
    vi.useRealTimers()
  })

  it('票面前两例并置:同 key 连发两次 ⇒ 第二次同一 run,而库内只有一条', async () => {
    const first = await createRun('key-shared-0001')
    const again = await createRun('key-shared-0001')
    expect(first.status).toBe(201)
    expect(again.status).toBe(200)
    expect(again.ref).toBe(first.ref)
    expect(created).toBe(1)
    expect(await listCount('7')).toBe(1)
  })

  it('第三例(唯一判据)的路由形态:两个用户用同一个 Idempotency-Key ⇒ 各自一条、互不回放', async () => {
    const u7 = await createRun('key-shared-0002', { user: '7' })
    const u8 = await createRun('key-shared-0002', { user: '8' })
    expect([u7.status, u8.status]).toEqual([201, 201])
    // 归属段进键 ⇒ 8 号绝不会拿到 7 号那条 run(那正是"两个会话互相覆盖事实"的跨租户版)。
    expect(u8.ref).not.toBe(u7.ref)
    expect(created).toBe(2)
    expect(await listCount('7')).toBe(1)
    expect(await listCount('8')).toBe(1)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
