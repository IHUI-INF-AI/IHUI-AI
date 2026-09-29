// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect } from 'vitest'
import {
  MAX_CLIENT_KEY_LEN,
  MIN_CLIENT_KEY_LEN,
  canonicalJson,
  idempotencySlotKey,
  readIdempotencyKey,
  releaseIdempotencySlot,
  requestFingerprint,
  runIdempotently,
  type IdempotencyKv,
  type SlotReleaseOutcome,
} from '../src/services/run-idempotency.js'

/**
 * O10③ 通用幂等层单测 —— 零网络:注入假 KV(语义对齐真 Redis 的 SET NX PX / GET)。
 * 覆盖面是可证伪的语义:重放等值 / 换体拒绝 / 在途 409 / 失败释放槽位,以及 G-814421 的
 * 终态纪律 —— 释放**必达**(抛错、同步抛错、取消三种失败写法都落到同一个出口)且与提交
 * **互斥**(业务已成功的收尾异常一律不得 DEL)。后者断言的是"哪个终态发生了",
 * 只断言响应码看不见这一维。
 */

interface Entry {
  value: string
  expiresAt: number
}

class FakeKv implements IdempotencyKv {
  private readonly map = new Map<string, Entry>()
  down = false
  calls = 0

  private assertAlive(): void {
    if (this.down) throw new Error('redis connection lost')
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
    this.calls += 1
    this.assertAlive()
    return this.take(key)
  }
  async setIfAbsent(key: string, value: string, ttlMs: number): Promise<'OK' | null> {
    this.calls += 1
    this.assertAlive()
    if (this.take(key) !== null) return null
    this.map.set(key, { value, expiresAt: Date.now() + ttlMs })
    return 'OK'
  }
  async setWithTtl(key: string, value: string, ttlMs: number): Promise<void> {
    this.calls += 1
    this.assertAlive()
    this.map.set(key, { value, expiresAt: Date.now() + ttlMs })
  }
  async delete(key: string): Promise<void> {
    this.calls += 1
    this.assertAlive()
    this.map.delete(key)
  }
}

function inputFor<T>(
  kv: IdempotencyKv,
  over: Partial<{
    clientKey: string
    fingerprint: string
    create: () => Promise<T>
    degrade: 'closed' | 'open'
  }>,
): {
  kv: IdempotencyKv
  namespace: string
  ownerKey: string
  clientKey: string
  fingerprint: string
  ttlMs: number
  create: () => Promise<T>
  degrade?: 'closed' | 'open'
} {
  return {
    kv,
    namespace: 'unit.create',
    ownerKey: 'user:1',
    clientKey: 'key-abcdefgh',
    fingerprint: 'fp-1',
    ttlMs: 60_000,
    create: over.create ?? (async () => ({}) as T),
    ...(over.degrade === undefined ? {} : { degrade: over.degrade }),
    ...(over.clientKey === undefined ? {} : { clientKey: over.clientKey }),
    ...(over.fingerprint === undefined ? {} : { fingerprint: over.fingerprint }),
  }
}

describe('runIdempotently', () => {
  it('同一 key 重放返回同一个资源,create 只跑一次(不是 409 也不是新建)', async () => {
    const kv = new FakeKv()
    let created = 0
    const make = async (): Promise<{ id: string }> => {
      created += 1
      return { id: `res_${created}` }
    }
    const first = await runIdempotently(inputFor<{ id: string }>(kv, { create: make }))
    const second = await runIdempotently(inputFor<{ id: string }>(kv, { create: make }))

    expect(first.ok).toBe(true)
    expect(second.ok).toBe(true)
    if (!first.ok || !second.ok) throw new Error('unreachable')
    expect(first.replayed).toBe(false)
    expect(first.slotProtected).toBe(true)
    expect(second.replayed).toBe(true)
    expect(second.value).toEqual(first.value)
    expect(created).toBe(1)
  })

  it('不同 key 各建一次', async () => {
    const kv = new FakeKv()
    let created = 0
    const make = async (): Promise<number> => {
      created += 1
      return created
    }
    const a = await runIdempotently(
      inputFor<number>(kv, { create: make, clientKey: 'key-aaaa1111' }),
    )
    const b = await runIdempotently(
      inputFor<number>(kv, { create: make, clientKey: 'key-bbbb2222' }),
    )
    expect(a.ok && b.ok).toBe(true)
    if (!a.ok || !b.ok) throw new Error('unreachable')
    expect(a.value).toBe(1)
    expect(b.value).toBe(2)
  })

  it('同一 key 换了请求体 → key-reused,且绝不把首次结果回给它', async () => {
    const kv = new FakeKv()
    let created = 0
    const make = async (): Promise<{ id: string }> => {
      created += 1
      return { id: `res_${created}` }
    }
    await runIdempotently(inputFor<{ id: string }>(kv, { create: make, fingerprint: 'fp-1' }))
    const reused = await runIdempotently(
      inputFor<{ id: string }>(kv, { create: make, fingerprint: 'fp-2' }),
    )
    expect(reused).toEqual({ ok: false, reason: 'key-reused' })
    expect(created).toBe(1)
  })

  it('在途重放 → in-progress,create 恰好一次(SET NX 原子,并发里只有一个赢家)', async () => {
    const kv = new FakeKv()
    let created = 0
    let release: (() => void) | undefined
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const make = async (): Promise<string> => {
      created += 1
      await gate
      return 'v'
    }
    const running = runIdempotently(inputFor<string>(kv, { create: make }))
    const racing = await runIdempotently(inputFor<string>(kv, { create: make }))
    expect(racing).toEqual({ ok: false, reason: 'in-progress' })
    release?.()
    expect((await running).ok).toBe(true)
    expect(created).toBe(1)
  })

  it('create 抛错 → 释放槽位,同 key 可以立刻重试成功', async () => {
    const kv = new FakeKv()
    let attempt = 0
    const make = async (): Promise<string> => {
      attempt += 1
      if (attempt === 1) throw new Error('boom')
      return 'ok'
    }
    await expect(runIdempotently(inputFor<string>(kv, { create: make }))).rejects.toThrow('boom')
    const retried = await runIdempotently(inputFor<string>(kv, { create: make }))
    expect(retried.ok).toBe(true)
    if (!retried.ok) throw new Error('unreachable')
    expect(retried.value).toBe('ok')
    expect(retried.replayed).toBe(false)
  })

  it('KV 不可用:默认 closed 回 store-unavailable;显式 open 才降级创建并如实报未保护', async () => {
    const closed = new FakeKv()
    closed.down = true
    await expect(
      runIdempotently(inputFor<string>(closed, { create: async () => 'x' })),
    ).resolves.toEqual({ ok: false, reason: 'store-unavailable' })

    const opened = new FakeKv()
    opened.down = true
    const res = await runIdempotently(
      inputFor<string>(opened, { create: async () => 'x', degrade: 'open' }),
    )
    expect(res.ok).toBe(true)
    if (!res.ok) throw new Error('unreachable')
    expect(res.slotProtected).toBe(false)
  })

  it('归属维度进键:两个 owner 用同一个客户端 key 互不命中', () => {
    const a = idempotencySlotKey('ns', 'user:1', 'same-key-123')
    const b = idempotencySlotKey('ns', 'user:2', 'same-key-123')
    expect(a).not.toBe(b)
    expect(a.startsWith('idem:res:ns:user:1:')).toBe(true)
  })
})

/**
 * 记录型假 KV —— 与上面 FakeKv 的分工:那张盘测"幂等语义对不对",这张盘测
 * "**哪个终态发生了**"。所以它把 DEL / 提交写逐次记账,并能分别表达两型传输故障:
 * 异步失败(reject)与**同步抛错**(坏适配器)。后者必须模拟得出,否则判据 4/5 里
 * "收尾异常不得冒充业务失败"那一格压根测不到 —— 只断言错误码看不见这一维:
 * "先 DEL 再抛 500"与"只抛 500"在响应上完全同形,而前者才是双跑。
 */
class RecordingKv implements IdempotencyKv {
  readonly store = new Map<string, string>()
  /** 真实发生过的 DEL(按序) */
  readonly deleted: string[] = []
  /** 真实发生过的提交写(按序) */
  readonly committed: string[] = []
  deleteMode: 'ok' | 'reject' | 'throw-sync' = 'ok'
  writeMode: 'ok' | 'reject' | 'throw-sync' = 'ok'

  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null
  }
  async setIfAbsent(key: string, value: string): Promise<'OK' | null> {
    if (this.store.has(key)) return null
    this.store.set(key, value)
    return 'OK'
  }
  /** 刻意**不**写成 async:async 会把同步抛错变成 rejection,那样就模拟不出坏适配器。 */
  setWithTtl(key: string, value: string): Promise<void> {
    if (this.writeMode === 'throw-sync') throw new Error('adapter misconfigured (sync)')
    if (this.writeMode === 'reject') return Promise.reject(new Error('redis connection lost'))
    this.committed.push(key)
    this.store.set(key, value)
    return Promise.resolve()
  }
  delete(key: string): Promise<void> {
    if (this.deleteMode === 'throw-sync') throw new Error('adapter misconfigured (sync)')
    if (this.deleteMode === 'reject') return Promise.reject(new Error('redis connection lost'))
    this.deleted.push(key)
    this.store.delete(key)
    return Promise.resolve()
  }
}

/** 一张固定槽位的坐标(与内核拼键用的是同一个 `idempotencySlotKey`,所以断言的是真键)。 */
const SLOT = { namespace: 'unit.create', ownerKey: 'user:1', clientKey: 'key-abcdefgh' } as const
const SLOT_KEY = idempotencySlotKey(SLOT.namespace, SLOT.ownerKey, SLOT.clientKey)

function heldInput<T>(kv: IdempotencyKv, create: () => Promise<T>, over?: { now?: () => number }) {
  return {
    ...SLOT,
    kv,
    fingerprint: 'fp-1',
    ttlMs: 60_000,
    create,
    ...(over?.now === undefined ? {} : { now: over.now }),
  }
}

describe('业务失败 ⇒ 释放槽位 / 成功 ⇒ 提交(G-814421 判据 3/4/5)', () => {
  it('正例①:业务失败 → 真的经出口 DEL 了**这张**槽(断言落点,不只看"没锁住")', async () => {
    const kv = new RecordingKv()
    await expect(
      runIdempotently(heldInput<string>(kv, async () => Promise.reject(new Error('boom')))),
    ).rejects.toThrow('boom')
    expect(kv.deleted).toEqual([SLOT_KEY])
    expect(kv.committed).toEqual([])
    expect(kv.store.has(SLOT_KEY)).toBe(false)
  })

  it('正例①(续):失败后同 key 可立刻重试并真跑一遍 —— 释放是可达的,不是记账', async () => {
    const kv = new RecordingKv()
    let attempt = 0
    const make = async (): Promise<string> => {
      attempt += 1
      if (attempt === 1) throw new Error('boom')
      return 'ok'
    }
    await expect(runIdempotently(heldInput<string>(kv, make))).rejects.toThrow('boom')
    const retried = await runIdempotently(heldInput<string>(kv, make))
    expect(retried.ok).toBe(true)
    if (!retried.ok) throw new Error('unreachable')
    expect(retried).toMatchObject({ value: 'ok', replayed: false, slotProtected: true })
  })

  it('正例②:成功 → 提交 completed,同 key 重放命中幂等,且**一次 DEL 都没发生**', async () => {
    const kv = new RecordingKv()
    let created = 0
    const make = async (): Promise<{ id: string }> => {
      created += 1
      return { id: `res_${created}` }
    }
    const first = await runIdempotently(heldInput(kv, make))
    const second = await runIdempotently(heldInput(kv, make))
    expect(first.ok && second.ok).toBe(true)
    if (!first.ok || !second.ok) throw new Error('unreachable')
    expect(first.replayed).toBe(false)
    expect(first.slotProtected).toBe(true)
    expect(second.replayed).toBe(true)
    expect(second.value).toEqual(first.value)
    expect(created).toBe(1)
    // 本票新增的那半:成功路径不得有任何 DEL。把已完成槽位删掉 = 同 key 再建一份资源。
    expect(kv.deleted).toEqual([])
    expect(kv.committed).toEqual([SLOT_KEY])
  })

  it('必达:取消(create 被 AbortSignal 打回 reject)同样释放,不只在 happy path 之外侥幸被调到', async () => {
    const kv = new RecordingKv()
    const ac = new AbortController()
    // 取消发生在 create **体内**:监听器已挂上,`abort()` 同步触发 reject,
    // 等价于"客户端在业务跑到一半时撤了"。(刻意不在调用 runIdempotently 之前 abort ——
    // 那一刻 claim 还没完成、create 还没开始,监听器根本没挂,Promise 永不落定。)
    const make = (): Promise<string> =>
      new Promise<string>((_resolve, reject) => {
        ac.signal.addEventListener('abort', () => reject(new Error('cancelled by caller')), {
          once: true,
        })
        ac.abort()
      })
    await expect(runIdempotently(heldInput<string>(kv, make))).rejects.toThrow('cancelled')
    expect(kv.deleted).toEqual([SLOT_KEY])
    expect(kv.committed).toEqual([])
  })

  it('必达:create **同步**抛错(不返回 rejected promise)也走同一个出口 —— 判据不挑失败写法', async () => {
    const kv = new RecordingKv()
    const syncThrow = (): Promise<string> => {
      throw new Error('sync boom')
    }
    await expect(runIdempotently(heldInput<string>(kv, syncThrow))).rejects.toThrow('sync boom')
    expect(kv.deleted).toEqual([SLOT_KEY])
  })

  it('互斥①:资源已建出而提交写**同步**抛错 ⇒ 如实报 slotProtected:false,一次 DEL 都没有', async () => {
    const kv = new RecordingKv()
    kv.writeMode = 'throw-sync'
    const res = await runIdempotently(heldInput<string>(kv, async () => 'created'))
    expect(res.ok).toBe(true)
    if (!res.ok) throw new Error('unreachable')
    expect(res.slotProtected).toBe(false)
    // 这一格是判据 5 的正体:端口同步抛错属"传输不可用",一旦被 catch 当成业务失败去释放,
    // 账面就变成"这次没建成,可以再来一次",而资源其实已经存在了。
    expect(kv.deleted).toEqual([])
    // 提交没落成 ⇒ 槽停在 processing:同 key 此刻得 in-progress,而不是再建一份资源。
    let secondCreateRan = false
    const again = await runIdempotently(
      heldInput<string>(kv, async () => {
        secondCreateRan = true
        return 'created-again'
      }),
    )
    expect(again).toEqual({ ok: false, reason: 'in-progress' })
    expect(secondCreateRan).toBe(false)
  })

  it('互斥②:结果无法序列化(BigInt)⇒ 不冒充业务失败:不回 500、不释放、不提交', async () => {
    const kv = new RecordingKv()
    const res = await runIdempotently(heldInput<bigint>(kv, async () => 10n))
    expect(res.ok).toBe(true)
    if (!res.ok) throw new Error('unreachable')
    expect(res.slotProtected).toBe(false)
    expect(res.value).toBe(10n)
    expect(kv.deleted).toEqual([])
    expect(kv.committed).toEqual([])
  })

  it('互斥③:注入时钟在**业务成功之后**抛错 ⇒ 同一格终态处置(报未保护,不释放)', async () => {
    const kv = new RecordingKv()
    let ticks = 0
    const res = await runIdempotently(
      heldInput<string>(kv, async () => 'created', {
        now: (): number => {
          ticks += 1
          // 第 1 次是 claim(持槽之前),第 2 次才是提交载荷 —— 只有后者落在判据 5 的射程里。
          if (ticks > 1) throw new Error('clock broken after business success')
          return 0
        },
      }),
    )
    expect(ticks).toBeGreaterThanOrEqual(2)
    expect(res.ok).toBe(true)
    if (!res.ok) throw new Error('unreachable')
    expect(res.slotProtected).toBe(false)
    expect(kv.deleted).toEqual([])
  })

  it('出口永不抛错:DEL 失败只以 SlotReleaseOutcome 表达,原始业务错误不被顶掉', async () => {
    const kv = new RecordingKv()
    kv.deleteMode = 'reject'
    await expect(
      runIdempotently(heldInput<string>(kv, async () => Promise.reject(new Error('boom')))),
    ).rejects.toThrow('boom')
    const outcome: SlotReleaseOutcome = await releaseIdempotencySlot(kv, SLOT)
    expect(outcome).toBe('store-unavailable')
  })

  it('ABA 守卫:本次 create 跑过了 TTL、他人已把同键提交成 completed ⇒ 释放不得抹掉他人记录', async () => {
    const kv = new RecordingKv()
    const make = async (): Promise<string> => {
      kv.store.set(
        SLOT_KEY,
        JSON.stringify({ status: 'completed', fingerprint: 'fp-other', ts: 0, value: { id: 'x' } }),
      )
      throw new Error('boom')
    }
    await expect(runIdempotently(heldInput<string>(kv, make))).rejects.toThrow('boom')
    expect(kv.deleted).toEqual([])
    expect(kv.store.get(SLOT_KEY)).toContain('fp-other')
    // 阳性对照:同一张"他人 completed"槽,**不带**守卫时确实会被删掉。
    // 缺了这一句,上面那句 `deleted` 为空就只能证明"什么都没做",证明不了"守卫拦住了"。
    expect(await releaseIdempotencySlot(kv, SLOT)).toBe('released')
    expect(kv.deleted).toEqual([SLOT_KEY])
    expect(kv.store.has(SLOT_KEY)).toBe(false)
  })

  it('出口三态直测:只跳"他人的 completed",自己的 processing / 脏槽 / 同指纹 completed 一律照删', async () => {
    const kv = new RecordingKv()
    const guard = { onlyIfOwnedByFingerprint: 'fp-1' }
    kv.store.set(SLOT_KEY, JSON.stringify({ status: 'processing', fingerprint: 'fp-1', ts: 0 }))
    expect(await releaseIdempotencySlot(kv, SLOT, guard)).toBe('released')
    kv.store.set(SLOT_KEY, 'not-json-at-all')
    expect(await releaseIdempotencySlot(kv, SLOT, guard)).toBe('released')
    kv.store.set(
      SLOT_KEY,
      JSON.stringify({ status: 'completed', fingerprint: 'fp-1', ts: 0, value: 1 }),
    )
    expect(await releaseIdempotencySlot(kv, SLOT, guard)).toBe('released')
    kv.store.set(
      SLOT_KEY,
      JSON.stringify({ status: 'completed', fingerprint: 'fp-x', ts: 0, value: 1 }),
    )
    expect(await releaseIdempotencySlot(kv, SLOT, guard)).toBe('not-ours')
    // 不带守卫 ⇒ 无条件 DEL(与改动前逐字同形):所以"没带守卫"不等于"守卫失效"。
    expect(await releaseIdempotencySlot(kv, SLOT)).toBe('released')
    expect(kv.deleted).toHaveLength(4)
  })

  it('未持槽的失败路径绝不触发释放(claim 之前抛错 ⇒ 一个 DEL 都不该有)', async () => {
    const kv = new RecordingKv()
    await expect(
      runIdempotently(
        heldInput<string>(kv, async () => 'x', {
          now: (): number => {
            throw new Error('clock broken before claim')
          },
        }),
      ),
    ).rejects.toThrow('clock broken before claim')
    expect(kv.deleted).toEqual([])
  })
})

describe('readIdempotencyKey / fingerprint', () => {
  it('缺失、非字符串、过短都算没带;首尾空白被去掉;超长截到 200', () => {
    expect(readIdempotencyKey({})).toBeNull()
    expect(readIdempotencyKey({ 'idempotency-key': 'short' })).toBeNull()
    // 数组头不是"非字符串":HTTP 多值头由 normalizeHeader 取首值,这是本仓既有约定,
    // 所以这里断言的是"取首值"而不是"算没带"(真·无效形态是下一行的非字符串)。
    expect(readIdempotencyKey({ 'idempotency-key': ['a'.repeat(12)] })).toBe('aaaaaaaaaaaa')
    expect(readIdempotencyKey({ 'idempotency-key': 42 as unknown as string })).toBeNull()
    expect(readIdempotencyKey({ 'idempotency-key': '  key-abcdefgh  ' })).toBe('key-abcdefgh')
    expect(readIdempotencyKey({ 'idempotency-key': 'z'.repeat(500) })).toHaveLength(
      MAX_CLIENT_KEY_LEN,
    )
    expect(MIN_CLIENT_KEY_LEN).toBeLessThan(MAX_CLIENT_KEY_LEN)
  })

  it('键序不同的等价请求体 → 同一指纹;内容不同 → 不同指纹', () => {
    expect(requestFingerprint({ a: 1, b: { c: 2, d: 3 } })).toBe(
      requestFingerprint({ b: { d: 3, c: 2 }, a: 1 }),
    )
    expect(requestFingerprint({ a: 1 })).not.toBe(requestFingerprint({ a: 2 }))
    // 只排序**对象键**,数组顺序必须原样保留 —— 数组一旦排序,`[A,B]` 与 `[B,A]` 会被判成
    // 同一个请求体,幂等层就会把首次结果回给语义不同的重放(那是数据错乱,不是格式化差异)。
    expect(canonicalJson({ b: [1, { d: 1, c: 2 }], a: 0 })).toBe('{"a":0,"b":[1,{"c":2,"d":1}]}')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
