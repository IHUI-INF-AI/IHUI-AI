// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// G-734③ —— 提交前(以及重放前)对事实做**全量引用局部性断言**:每条交叉引用都必须落在
// child 集合内,越界即硬错,且**既不提交也不释放**。
//
// 为什么重放那一侧才是这一条的真重量:提交时那份值是本次 `create()` 刚产出的,越界需要
// `create()` 自己写错;而重放时那份值是**上一轮写进 KV、这一轮读回来**的 —— 键一旦折槽
// (G-734① 修的正是它)或被外部写过,不查引用的内核就会把别人的资源当"你自己上次建的那条"
// 回给请求方。本仓这一型在 `agent-runs` 面有现成先例:`/resolve/:handle` 一直是查的
// (见该文件 `record.ownerUserId !== ownerUserId ⇒ 404` 那一兜),而 POST 的重放路径原来一道都不查。
//
// 违规为什么"不释放":判据 5(G-814421)—— 业务已经成功时 DEL 等于把这张槽交还给
// "同 key 再建一份",而重建正是 ②③ 共同禁止的动作。槽停在 processing 是**要的**结果。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Fastify, { type FastifyError, type FastifyInstance, type FastifyRequest } from 'fastify'
import {
  RUN_CREATE_NAMESPACE,
  createAgentRunRoutes,
  type AgentRunRecord,
} from '../src/routes/agent-runs.js'
import {
  IdempotencyFactCorruptError,
  IdempotencyLocalityViolationError,
  idempotencySlotKey,
  requestFingerprint,
  runIdempotently,
  type IdempotencyKv,
  type IdempotencySlotRef,
  type SlotLocalitySpec,
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

class FakeKv implements IdempotencyKv {
  private readonly map = new Map<string, Entry>()
  readonly deleted: string[] = []
  readonly committed: string[] = []

  seed(key: string, value: string): void {
    this.map.set(key, { value, expiresAt: Date.now() + 600_000 })
  }
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
    return 'OK'
  }
  async setWithTtl(key: string, value: string, ttlMs: number): Promise<void> {
    this.map.set(key, { value, expiresAt: Date.now() + ttlMs })
    this.committed.push(key)
  }
  async delete(key: string): Promise<void> {
    this.deleted.push(key)
    this.map.delete(key)
  }
}

const SLOT: IdempotencySlotRef = {
  namespace: 'unit.create',
  ownerKey: 'user:1',
  clientKey: 'cmd-00000001',
}
const SLOT_KEY = idempotencySlotKey(SLOT.namespace, SLOT.ownerKey, SLOT.clientKey)

interface Fact {
  id: string
  ownerRef: string
}

/** 只查归属这一维的局部性断言(与 `agent-runs` 里接线的那一条同形)。 */
const ownerLocality: SlotLocalitySpec<Fact> = {
  refsOf: (fact) => [fact.ownerRef],
}

function inputOf<T>(
  kv: IdempotencyKv,
  create: () => Promise<T>,
  over: { locality?: SlotLocalitySpec<T>; slot?: IdempotencySlotRef } = {},
) {
  return {
    kv,
    ...(over.slot ?? SLOT),
    fingerprint: 'fp-1',
    ttlMs: 60_000,
    create,
    ...(over.locality === undefined ? {} : { locality: over.locality }),
  }
}

describe('G-734③ 提交前断言:越界 ⇒ 不提交、不释放、硬错', () => {
  it('create() 产出越界事实 ⇒ 抛 IdempotencyLocalityViolationError,提交写 0 次、DEL 0 次', async () => {
    const kv = new FakeKv()
    let createRan = 0
    await expect(
      runIdempotently(
        inputOf<Fact>(
          kv,
          async () => {
            createRan += 1
            return { id: 'f-1', ownerRef: 'user:999' }
          },
          { locality: ownerLocality },
        ),
      ),
    ).rejects.toThrow(IdempotencyLocalityViolationError)
    expect(createRan).toBe(1)
    // 这两条是这一格的全部价值:越界的事实**没有**被写成可回放状态,而槽也**没有**被让回去。
    expect(kv.committed).toEqual([])
    expect(kv.deleted).toEqual([])
  })

  it('同一张盘、同一份事实,归属合法就正常提交(判据不是"逢引用即红")', async () => {
    const kv = new FakeKv()
    const res = await runIdempotently(
      inputOf<Fact>(kv, async () => ({ id: 'f-2', ownerRef: 'user:1' }), {
        locality: ownerLocality,
      }),
    )
    expect(res.ok).toBe(true)
    if (!res.ok) throw new Error('unreachable')
    expect(res.slotProtected).toBe(true)
    expect(kv.committed).toEqual([SLOT_KEY])
  })

  it('缺省 child 集合就是这条槽的归属;带 parentKey 时父段也算 child', async () => {
    const parented: IdempotencySlotRef = { ...SLOT, parentKey: 'session:A' }
    const inParent = await runIdempotently(
      inputOf<Fact>(new FakeKv(), async () => ({ id: 'f-3', ownerRef: 'session:A' }), {
        slot: parented,
        locality: ownerLocality,
      }),
    )
    expect(inParent.ok).toBe(true)
    await expect(
      runIdempotently(
        inputOf<Fact>(new FakeKv(), async () => ({ id: 'f-4', ownerRef: 'user:2' }), {
          slot: parented,
          locality: ownerLocality,
        }),
      ),
    ).rejects.toThrow(IdempotencyLocalityViolationError)
  })

  it('childSetOf 自定义生效:扩大集合后同一份事实从越界变合规', async () => {
    const wide: SlotLocalitySpec<Fact> = {
      refsOf: (fact) => [fact.ownerRef],
      childSetOf: (scope) => [scope.ownerKey, 'user:1', 'user:2'],
    }
    const res = await runIdempotently(
      inputOf<Fact>(new FakeKv(), async () => ({ id: 'f-5', ownerRef: 'user:2' }), {
        locality: wide,
      }),
    )
    expect(res.ok).toBe(true)
  })

  it('refsOf 自己读不动这份事实 ⇒ 按②判损坏,绝不因"取不出引用"就当通过', async () => {
    const blind: SlotLocalitySpec<unknown> = {
      refsOf: (value) => {
        const shape = value as { ownerRef?: string }
        if (typeof shape?.ownerRef !== 'string') throw new Error('事实形状不认识')
        return [shape.ownerRef]
      },
    }
    const kv = new FakeKv()
    await expect(
      runIdempotently(inputOf<unknown>(kv, async () => ({ nope: 1 }), { locality: blind })),
    ).rejects.toThrow(IdempotencyFactCorruptError)
    expect(kv.committed).toEqual([])
  })
})

describe('G-734③ 重放前断言:读回来的事实同样要查(这一侧才是真危险)', () => {
  it('槽里躺着他人归属的 completed 事实 ⇒ 硬错,且 create() 一次都没跑', async () => {
    const kv = new FakeKv()
    kv.seed(
      SLOT_KEY,
      JSON.stringify({
        status: 'completed',
        fingerprint: 'fp-1',
        ts: 0,
        value: { id: 'f-foreign', ownerRef: 'user:999' },
      }),
    )
    let createRan = 0
    await expect(
      runIdempotently(
        inputOf<Fact>(
          kv,
          async () => {
            createRan += 1
            return { id: 'f-mine', ownerRef: 'user:1' }
          },
          { locality: ownerLocality },
        ),
      ),
    ).rejects.toThrow(IdempotencyLocalityViolationError)
    // 没有重建(那会把越界洗成"我又建了一条我的"),也没有 DEL 抹掉别人的证据(那会放行重建)。
    expect(createRan).toBe(0)
    expect(kv.deleted).toEqual([])
  })

  it('同一条事实,不声明 locality 时确实会被回放(证明上一例的红来自断言,不是别处)', async () => {
    // 这一臂是本文件的"判据有牙"证明:摘掉 `locality` 这一维,同一张盘同一份值就走回
    // `replayed:true`。没有它,上一例的红可能来自任何别的原因。
    const kv = new FakeKv()
    kv.seed(
      SLOT_KEY,
      JSON.stringify({
        status: 'completed',
        fingerprint: 'fp-1',
        ts: 0,
        value: { id: 'f-foreign', ownerRef: 'user:999' },
      }),
    )
    const res = await runIdempotently(
      inputOf<Fact>(kv, async () => ({ id: 'never', ownerRef: 'x' })),
    )
    expect(res.ok).toBe(true)
    if (!res.ok) throw new Error('unreachable')
    expect(res.replayed).toBe(true)
    expect(res.value.ownerRef).toBe('user:999')
  })
})

describe('G-734③ 路由级:越权事实不再被签成"你自己的 run"', () => {
  let app: FastifyInstance
  let kv: FakeKv
  let created: number

  const foreignRecord: AgentRunRecord = {
    id: 'run_foreign-1',
    ownerUserId: 999,
    agentId: 'agent-1',
    input: '不是你的问句',
    status: 'queued',
    createdAtMs: 1_760_000_000_000,
    updatedAtMs: 1_760_000_000_000,
    internalSessionId: null,
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
        handleSecret: 'g734-locality-secret',
        nowMs: () => {
          tick += 1000
          return tick
        },
        newRunId: () => {
          created += 1
          return `run_g734l-${created}`
        },
      }),
    )
    await app.ready()
  })

  afterEach(async () => {
    await app.close()
    vi.useRealTimers()
  })

  it('槽里是他人 run 的 completed 事实(指纹仍与请求相同)⇒ 500 硬错,而不是 200 + 一条永远解析不回的句柄', async () => {
    const clientKey = 'key-locality-1'
    const input = '问句 locality'
    kv.seed(
      idempotencySlotKey(RUN_CREATE_NAMESPACE, 'user:7', clientKey),
      JSON.stringify({
        status: 'completed',
        fingerprint: requestFingerprint({ agent_id: 'agent-1', input }),
        ts: 0,
        value: foreignRecord,
      }),
    )
    const res = await app.inject({
      method: 'POST',
      url: '/',
      headers: { 'idempotency-key': clientKey, 'x-test-user': '7' },
      payload: { agent_id: 'agent-1', input },
    })
    expect(res.statusCode).toBe(500)
    const body = res.json() as { data?: { run_ref?: string } }
    // 判据的实体:没给请求方签出任何句柄,也没为它新建 run(那两条是"越界被当成功"的表征)。
    expect(body.data?.run_ref).toBeUndefined()
    expect(created).toBe(0)
    expect(kv.committed.filter((key) => key.startsWith('agent_run:'))).toEqual([])
  })

  it('正向对照:同一请求在槽位干净时仍走 201,局部性断言没有把正常路径改成误伤', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/',
      headers: { 'idempotency-key': 'key-locality-2', 'x-test-user': '7' },
      payload: { agent_id: 'agent-1', input: '问句 locality 2' },
    })
    expect(res.statusCode).toBe(201)
    expect(created).toBe(1)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
