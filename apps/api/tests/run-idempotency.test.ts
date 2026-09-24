import { describe, it, expect } from 'vitest'
import {
  MAX_CLIENT_KEY_LEN,
  MIN_CLIENT_KEY_LEN,
  canonicalJson,
  idempotencySlotKey,
  readIdempotencyKey,
  requestFingerprint,
  runIdempotently,
  type IdempotencyKv,
} from '../src/services/run-idempotency.js'

/**
 * O10③ 通用幂等层单测 —— 零网络:注入假 KV(语义对齐真 Redis 的 SET NX PX / GET)。
 * 覆盖面是四条可证伪的语义:重放等值 / 换体拒绝 / 在途 409 / 失败释放槽位。
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
  over: Partial<{ clientKey: string; fingerprint: string; create: () => Promise<T>; degrade: 'closed' | 'open' }>,
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
    create: over.create ?? (async () => ({} as T)),
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
    const a = await runIdempotently(inputFor<number>(kv, { create: make, clientKey: 'key-aaaa1111' }))
    const b = await runIdempotently(inputFor<number>(kv, { create: make, clientKey: 'key-bbbb2222' }))
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
    const reused = await runIdempotently(inputFor<{ id: string }>(kv, { create: make, fingerprint: 'fp-2' }))
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

describe('readIdempotencyKey / fingerprint', () => {
  it('缺失、非字符串、过短都算没带;首尾空白被去掉;超长截到 200', () => {
    expect(readIdempotencyKey({})).toBeNull()
    expect(readIdempotencyKey({ 'idempotency-key': 'short' })).toBeNull()
    expect(readIdempotencyKey({ 'idempotency-key': ['a'.repeat(12)] })).toBeNull()
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
    expect(canonicalJson({ b: [1, { d: 1, c: 2 }], a: 0 })).toBe(
      '{"a":0,"b":[{"c":2,"d":1},1]}',
    )
  })
})
