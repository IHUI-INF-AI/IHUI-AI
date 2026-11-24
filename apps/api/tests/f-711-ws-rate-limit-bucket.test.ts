// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-711 回归锁（2026-11-11）。
 *
 * 病灶：`ws-rate-limit` 曾用两档阈值顺序判断 `count <= 30` / `count <= 50`，
 * 且 BURST(50) > MAX_PER_WINDOW(30)，等价单一 `count <= 50`，稳态被抬到 50/s。
 * HEAD 已由 F-290（5828640196）删除 BURST 死分支，本文件补回归锁，钉住：
 * 同一瞬间第 31 条即拒（不接受 50 突发）、静置 1 秒恢复 30 条、
 * 10 秒稳态放行 300 条而非 500 条、键/窗口隔离与 TTL 清理不回归。
 *
 * 时钟通过 checkWsRateLimit 的可选 nowMs 注入；Redis 用内存 ZSET 替身，
 * 按真实命令语义（zremrangebyscore/zadd/zcard/pexpire + pipeline）执行。
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const fake = vi.hoisted(() => {
  type Entry = { member: string; score: number }
  const store = new Map<string, Entry[]>()
  const pexpireCalls: number[] = []

  class FakePipeline {
    private readonly ops: Array<() => unknown> = []

    zremrangebyscore(key: string, min: number, max: number): this {
      this.ops.push(() => {
        const list = store.get(key) ?? []
        const kept = list.filter((e) => e.score < min || e.score > max)
        store.set(key, kept)
        return list.length - kept.length
      })
      return this
    }

    zadd(key: string, score: number, member: string): this {
      this.ops.push(() => {
        const list = store.get(key) ?? []
        list.push({ member, score: Number(score) })
        store.set(key, list)
        return 1
      })
      return this
    }

    zcard(key: string): this {
      this.ops.push(() => (store.get(key) ?? []).length)
      return this
    }

    pexpire(_key: string, ms: number): this {
      this.ops.push(() => {
        pexpireCalls.push(Number(ms))
        return 1
      })
      return this
    }

    exec(): Promise<Array<[Error | null, unknown]>> {
      return Promise.resolve(this.ops.map((op) => [null, op()]))
    }
  }

  class FakeRedis {
    on(): this {
      return this
    }
    once(): this {
      return this
    }
    quit(): Promise<'OK'> {
      return Promise.resolve('OK')
    }
    pipeline(): FakePipeline {
      return new FakePipeline()
    }
  }

  return { FakeRedis, store, pexpireCalls }
})

vi.mock('ioredis', () => ({ default: fake.FakeRedis }))

vi.mock('../src/config/index.js', () => ({
  config: { REDIS_URL: 'redis://127.0.0.1:6399' },
}))

vi.mock('../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}))

import { _resetRateLimitClient, checkWsRateLimit } from '../src/utils/ws-rate-limit.js'

const T0 = 1_800_000_000_000
const MAX_PER_WINDOW = 30
const KEY_TTL_MS = 10_000

/** 同一时刻连续尝试 n 条，返回逐条放行结果。 */
async function attemptAt(
  userId: string,
  roomId: string,
  now: number,
  n: number,
): Promise<boolean[]> {
  const results: boolean[] = []
  for (let i = 0; i < n; i++) {
    results.push(await checkWsRateLimit(userId, roomId, now))
  }
  return results
}

beforeAll(() => {
  _resetRateLimitClient()
})

beforeEach(() => {
  fake.store.clear()
  fake.pexpireCalls.length = 0
})

describe('F-711 WS 跨实例限流：单阈值 30/s，无 50 突发', () => {
  it('同一瞬间放行 30 条，第 31 条起拒绝（旧实现会放行到 50）', async () => {
    const results = await attemptAt('u1', 'r1', T0, 50)

    expect(results.slice(0, MAX_PER_WINDOW).every(Boolean)).toBe(true)
    expect(results.slice(MAX_PER_WINDOW)).toEqual(
      Array.from({ length: 50 - MAX_PER_WINDOW }, () => false),
    )
    // 明确钉住票面旧行为：第 31~50 条不得再放行
    expect(results[30]).toBe(false)
    expect(results[49]).toBe(false)
  })

  it('静置 1 秒后窗口清空，再放行 30 条（第 31 条仍拒）', async () => {
    const first = await attemptAt('u1', 'r1', T0, 31)
    expect(first.filter(Boolean)).toHaveLength(MAX_PER_WINDOW)

    const second = await attemptAt('u1', 'r1', T0 + 1000, 31)
    expect(second.slice(0, MAX_PER_WINDOW).every(Boolean)).toBe(true)
    expect(second[MAX_PER_WINDOW]).toBe(false)
  })

  it('10 秒稳态每秒 50 条尝试：共放行 300 条（30/s），不是 500 条（50/s）', async () => {
    const perSecondAllowed: number[] = []
    let allowed = 0
    let denied = 0

    for (let second = 0; second < 10; second++) {
      const results = await attemptAt('u1', 'r1', T0 + second * 1000, 50)
      const ok = results.filter(Boolean).length
      perSecondAllowed.push(ok)
      allowed += ok
      denied += results.length - ok
    }

    expect(perSecondAllowed).toEqual(Array.from({ length: 10 }, () => MAX_PER_WINDOW))
    expect(allowed).toBe(MAX_PER_WINDOW * 10)
    expect(denied).toBe((50 - MAX_PER_WINDOW) * 10)
  })

  it('键隔离：不同用户/房间独立计数，互不占用配额', async () => {
    const filled = await attemptAt('u1', 'r1', T0, MAX_PER_WINDOW + 1)
    expect(filled[0]).toBe(true)
    expect(filled[MAX_PER_WINDOW]).toBe(false)

    expect(await checkWsRateLimit('u2', 'r1', T0)).toBe(true)
    expect(await checkWsRateLimit('u1', 'r2', T0)).toBe(true)
    expect(await checkWsRateLimit('u1', 'r1', T0)).toBe(false)
  })

  it('窗口清理与 key TTL 不回归：旧记录静置 10 秒后不再占额度', async () => {
    const filled = await attemptAt('u1', 'r1', T0, MAX_PER_WINDOW)
    expect(filled.every(Boolean)).toBe(true)
    expect(fake.pexpireCalls.length).toBeGreaterThan(0)
    expect(new Set(fake.pexpireCalls)).toEqual(new Set([KEY_TTL_MS]))

    const after = await attemptAt('u1', 'r1', T0 + 10_000, MAX_PER_WINDOW)
    expect(after.every(Boolean)).toBe(true)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
