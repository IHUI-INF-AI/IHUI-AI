// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// G-734② —— 事实存在但它的载荷读不出 ⇒ **硬错**,绝不回放、绝不重建。
//
// 落地的判据是"**哪个终态发生了**",不是"响应码是什么":损坏事实这一格上,三条错出路在
// 响应上各有各的像样 ——
//   · 原样回放 `slot.value` ⇒ 客户端拿到 200/201,以为自己的资源建好了(把损坏洗成"看起来正常");
//   · 回 `in-progress`      ⇒ 读起来像"别人还在跑",下一次同 key 请求就会重跑 `create()`(重建);
//   · DEL 掉                 ⇒ 同上,而且抹掉的是一张谁也不认得的记录(把不可信洗成可重跑)。
// 所以本文件每条断言都在数**副作用**:创建动作跑了几次、提交写了几条、DEL 了几次。
// 只断"抛了什么错"会同时放过这三条(错误码相同、世界不同),那正是本仓记过多次的"账面绿"。
//
// 与既有判据的关系:G-814421 的判据 4/5 管的是"业务成功之后不得释放";本条管的是
// "读回来的事实不可信时不得当作成功回放"。同一张槽的两种收口,方向不同,不合并。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Fastify, { type FastifyError, type FastifyInstance, type FastifyRequest } from 'fastify'
import { RUN_CREATE_NAMESPACE, createAgentRunRoutes } from '../src/routes/agent-runs.js'
import {
  IdempotencyFactCorruptError,
  idempotencySlotKey,
  releaseIdempotencySlot,
  requestFingerprint,
  runIdempotently,
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

class FakeKv implements IdempotencyKv {
  private readonly map = new Map<string, Entry>()
  /** 真实发生过的 DEL —— "没删"必须是被判出来的,不是端口没动。 */
  readonly deleted: string[] = []
  /** 真实发生过的提交写(SET PX,不含抢锁那次 SET NX)。 */
  readonly committed: string[] = []

  /** 直接铺一张槽(绕过内核),用来构造"读回来的事实"这一侧的形态。 */
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

/** 一张**已完成**却根本没有 `value` 键的事实(正是 `value: undefined` 被 stringify 抹掉的样子)。 */
const CORRUPT_COMPLETED = JSON.stringify({ status: 'completed', fingerprint: 'fp-1', ts: 0 })

function kernelInput<T>(kv: IdempotencyKv, create: () => Promise<T>) {
  return { kv, ...SLOT, fingerprint: 'fp-1', ttlMs: 60_000, create }
}

describe('G-734② 读侧:已完成事实缺载荷 ⇒ 硬错,且不重建', () => {
  it('抛 IdempotencyFactCorruptError,且 create() 一次都没跑、既没提交也没 DEL', async () => {
    const kv = new FakeKv()
    kv.seed(SLOT_KEY, CORRUPT_COMPLETED)
    let createRan = 0
    await expect(
      runIdempotently(
        kernelInput<{ id: string }>(kv, async () => {
          createRan += 1
          return { id: 'rebuilt' }
        }),
      ),
    ).rejects.toThrow(IdempotencyFactCorruptError)
    // 这三条才是"绝不重建"的全部内容,错误类型本身不证明任何副作用没发生。
    expect(createRan).toBe(0)
    expect(kv.committed).toEqual([])
    expect(kv.deleted).toEqual([])
  })

  it('三条错出路一条都没发生:不是 200 回放、不是可重试档、也没有抹槽', async () => {
    const kv = new FakeKv()
    kv.seed(SLOT_KEY, CORRUPT_COMPLETED)
    let outcome: unknown
    try {
      outcome = await runIdempotently(kernelInput(kv, async () => ({ id: 'rebuilt' })))
    } catch (error) {
      outcome = error
    }
    // 既不是 IdempotencySuccess(ok:true ⇒ 回放或新建),也不是 ok:false(⇒ 可重试)。
    expect(outcome).toBeInstanceOf(IdempotencyFactCorruptError)
    const shape = outcome as { ok?: unknown; reason?: unknown }
    expect(shape.ok).toBeUndefined()
    expect(shape.reason).toBeUndefined()
    // 阳性对照:槽里那张损坏事实**仍然在** —— 本层没有"顺手清理一下",因为清掉就等于放行重建。
    expect(await kv.get(SLOT_KEY)).toBe(CORRUPT_COMPLETED)
  })

  it('损坏档不替 key-reused 洗责:指纹不同的损坏事实仍如实报 key-reused', async () => {
    // 越界复用同一个客户端 key 打不同请求体是**既有**语义(G-814421 判据 2),必须优先于损坏档,
    // 否则"别人的槽 + 我的指纹"这一型会被洗成一条看不出归属的损坏报告。
    const kv = new FakeKv()
    kv.seed(
      SLOT_KEY,
      JSON.stringify({ status: 'completed', fingerprint: 'fp-someone-else', ts: 0 }),
    )
    await expect(
      runIdempotently(kernelInput<{ id: string }>(kv, async () => ({ id: 'x' }))),
    ).resolves.toEqual({ ok: false, reason: 'key-reused' })
  })

  it('认不出形状的脏槽仍走 409(与"已完成但没载荷"两态不并桶)', async () => {
    // 这条是两态分开的证明:同一个键位置,一种读得出状态读不出载荷(⇒ 硬错),
    // 另一种压根读不出形状(⇒ 维持既有 in-progress,因为它可能正是别人在途的锁)。
    const kv = new FakeKv()
    kv.seed(SLOT_KEY, 'not-json-at-all')
    await expect(
      runIdempotently(kernelInput<{ id: string }>(kv, async () => ({ id: 'x' }))),
    ).resolves.toEqual({ ok: false, reason: 'in-progress' })
  })
})

describe('G-734② 写侧:永不落下读不出载荷的事实', () => {
  it('create() 解析成 undefined ⇒ 不提交、如实报没保护住,而不是写一条将来要硬错的事实', async () => {
    const kv = new FakeKv()
    const res = await runIdempotently<undefined>(kernelInput<undefined>(kv, async () => undefined))
    expect(res.ok).toBe(true)
    if (!res.ok) throw new Error('unreachable')
    expect(res.slotProtected).toBe(false)
    expect(kv.committed).toEqual([])
    // 收口在写侧之后,下一次同 key 请求拿到的是 in-progress(锁还在),不是"回放一条空事实"。
    const again = await runIdempotently<undefined>(
      kernelInput<undefined>(kv, async () => undefined),
    )
    expect(again).toEqual({ ok: false, reason: 'in-progress' })
  })

  it('正向对照:null 是调用方**选择记下**的值,不算损坏(键在,读得出)', async () => {
    // 判据是"键缺席"而不是"值假",否则会禁止一门合法调用(create 返回可空类型),
    // 而把判据做严的代价从来不是漏报,是大家学会绕开它。
    const kv = new FakeKv()
    const first = await runIdempotently<null>(kernelInput<null>(kv, async () => null))
    expect(first.ok).toBe(true)
    if (!first.ok) throw new Error('unreachable')
    expect(first.slotProtected).toBe(true)
    const replay = await runIdempotently<null>(kernelInput<null>(kv, async () => null))
    expect(replay.ok).toBe(true)
    if (!replay.ok) throw new Error('unreachable')
    expect(replay.replayed).toBe(true)
    expect(replay.value).toBe(null)
  })
})

describe('G-734② 释放出口:损坏事实不是"我的一次锁"可以打发的东西', () => {
  it('带指纹守卫时遇损坏 completed ⇒ 判 fact-corrupt 且不 DEL;无条件释放照旧删(两态都有牙)', async () => {
    const kv = new FakeKv()
    kv.seed(SLOT_KEY, CORRUPT_COMPLETED)
    const guarded = await releaseIdempotencySlot(kv, SLOT, { onlyIfOwnedByFingerprint: 'fp-1' })
    expect(guarded).toBe('fact-corrupt')
    expect(kv.deleted).toEqual([])
    // 阳性对照:同一个键、同一份内容,**不带**守卫时确实会被删掉。
    // 缺这一句,上面那个 `deleted` 为空只能证明"什么都没做",证明不了"是判据拦住了"。
    expect(await releaseIdempotencySlot(kv, SLOT)).toBe('released')
    expect(kv.deleted).toEqual([SLOT_KEY])
  })
})

describe('G-734② 路由级:损坏事实回给客户端的是硬错,不是一次悄悄的重建', () => {
  let app: FastifyInstance
  let kv: FakeKv
  let created: number

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
        handleSecret: 'g734-corrupt-secret',
        nowMs: () => {
          tick += 1000
          return tick
        },
        newRunId: () => {
          created += 1
          return `run_g734c-${created}`
        },
      }),
    )
    await app.ready()
  })

  afterEach(async () => {
    await app.close()
    vi.useRealTimers()
  })

  it('POST 撞上损坏的已完成事实 ⇒ 500 硬错,且没有新建 run、没有写任何 agent_run 键', async () => {
    const clientKey = 'key-corrupt-01'
    const input = '问句 corrupt'
    // 指纹必须与路由内部算的**逐字同式**(`{agent_id, input}`),否则探针读到的只是"没撞上槽"。
    kv.seed(
      idempotencySlotKey(RUN_CREATE_NAMESPACE, 'user:7', clientKey),
      JSON.stringify({
        status: 'completed',
        fingerprint: requestFingerprint({ agent_id: 'agent-1', input }),
        ts: 0,
      }),
    )
    const res = await app.inject({
      method: 'POST',
      url: '/',
      headers: { 'idempotency-key': clientKey, 'x-test-user': '7' },
      payload: { agent_id: 'agent-1', input },
    })
    expect(res.statusCode).toBe(500)
    // 判据的实体:一个 run 都没被建出来 —— 既没把损坏洗成 200,也没"贴心地"重建一次。
    expect(created).toBe(0)
    expect(kv.committed.filter((key) => key.startsWith('agent_run:'))).toEqual([])
    // 而且不是 201/200:客户端绝不会以为自己的资源建好了。
    expect([200, 201].includes(res.statusCode)).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
