// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-619 回归锁(2026-11-13)。
 *
 * 病灶:全局在途闸的计数键 TTL 固定 120s,且只在 acquire 时 PEXPIRE。
 * cap=10、10 条 >120s 的长流同时开始后没有新请求 ⇒ 120s 后键被 Redis 自然清掉,
 * 计数归零,第 121s 起新请求继续放行(长流越久,超卖越多)。
 *
 * 本文件锁:
 *   ① TTL = 上游超时上限 + 缓冲(不再是不足一次长流的 120s),心跳间隔显著小于 TTL;
 *   ② handle 持有期间定时续期:注入的 interval 每次推进都把 TTL 顶回去(调用多次);
 *   ③ release 立即停表并减计数,release 之后再推进 interval 不再发 PEXPIRE;
 *   ④ release 幂等:重复调用不会二次扣减。
 *
 * 只 mock ioredis + config(内存版 Redis 替身 + 注入 interval),不触达真实 Redis。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

const KEY_GLOBAL_INFLIGHT = 'relay:pool:inflight:global'

const fake = vi.hoisted(() => {
  interface Row {
    value: string
    expiresAt: number
  }
  const state = {
    data: new Map<string, Row>(),
    calls: [] as Array<{ cmd: string; args: unknown[] }>,
    /** 续期(PEXPIRE)被调用次数:心跳真的跑没跑的唯一硬证据 */
    pexpireCount: 0,
  }
  const live = (key: string): Row | undefined => {
    const row = state.data.get(key)
    if (!row) return undefined
    if (row.expiresAt > 0 && row.expiresAt <= Date.now()) {
      state.data.delete(key)
      return undefined
    }
    return row
  }
  const incrRaw = (key: string): number => {
    const row = live(key)
    const next = row ? Number(row.value) + 1 : 1
    state.data.set(key, { value: String(next), expiresAt: row?.expiresAt ?? 0 })
    return next
  }
  const decrRaw = (key: string): number => {
    const row = live(key)
    const next = row ? Number(row.value) - 1 : -1
    state.data.set(key, { value: String(next), expiresAt: row?.expiresAt ?? 0 })
    return next
  }

  class FakeIORedis {
    status = 'ready'
    on(): void {}
    quit(): Promise<'OK'> {
      return Promise.resolve('OK')
    }

    get eval():
      ((script: string, numKeys: number, ...args: unknown[]) => Promise<number>) | undefined {
      return async (script: string, _numKeys: number, ...args: unknown[]): Promise<number> => {
        state.calls.push({ cmd: 'eval', args: [script, ...args] })
        if (script.includes("redis.call('incr'")) {
          const key = String(args[0])
          const ttlMs = Number(args[1])
          const cap = Number(args[2])
          const v = incrRaw(key)
          if (v > cap) {
            decrRaw(key)
            return 0
          }
          const row = live(key)
          if (row) row.expiresAt = Date.now() + ttlMs
          return v
        }
        if (script.includes("redis.call('decr'")) {
          const key = String(args[0])
          const v = decrRaw(key)
          if (v < 0) {
            state.data.delete(key)
            return 0
          }
          return v
        }
        return 0
      }
    }

    async incr(key: string): Promise<number> {
      state.calls.push({ cmd: 'incr', args: [key] })
      return incrRaw(key)
    }

    async decr(key: string): Promise<number> {
      state.calls.push({ cmd: 'decr', args: [key] })
      return decrRaw(key)
    }

    async del(...keys: string[]): Promise<number> {
      state.calls.push({ cmd: 'del', args: keys })
      let n = 0
      for (const k of keys) if (state.data.delete(k)) n++
      return n
    }

    async pexpire(key: string, ttlMs: number): Promise<number> {
      state.calls.push({ cmd: 'pexpire', args: [key, ttlMs] })
      state.pexpireCount += 1
      const row = live(key)
      if (!row) return 0
      row.expiresAt = Date.now() + ttlMs
      return 1
    }

    async scan(): Promise<[string, string[]]> {
      return ['0', [...state.data.keys()]]
    }
  }

  return { FakeIORedis, state }
})

vi.mock('ioredis', () => ({ default: fake.FakeIORedis }))
vi.mock('../src/config/index.js', () => ({
  config: { REDIS_URL: 'redis://127.0.0.1:1/0' },
}))

import {
  __test__ as sharedState,
  tryAcquireGlobalInflight,
  GLOBAL_INFLIGHT_TTL_MS,
  GLOBAL_INFLIGHT_TTL_BUFFER_MS,
  GLOBAL_INFLIGHT_HEARTBEAT_MS,
  type GlobalInflightOptions,
} from '../src/services/relay-account-shared-state.js'

/** 手动驱动的 interval 替身:不依赖真实时间,续期次数可精确断言。 */
function manualClock(): {
  opts: GlobalInflightOptions
  intervalMs: number
  cleared: unknown[]
  tick(times?: number): void
} {
  const handle = { unref: () => {} }
  let cb: (() => void) | null = null
  let intervalMs = 0
  const cleared: unknown[] = []
  return {
    opts: {
      setIntervalFn: (fn, ms) => {
        cb = fn
        intervalMs = ms
        return handle
      },
      clearIntervalFn: (h) => {
        cleared.push(h)
      },
    },
    get intervalMs(): number {
      return intervalMs
    },
    cleared,
    tick(times = 1): void {
      for (let i = 0; i < times; i++) cb?.()
    },
  }
}

beforeEach(async () => {
  fake.state.data.clear()
  await sharedState.reset()
  fake.state.calls.length = 0
  fake.state.pexpireCount = 0
})

describe('F-619 在途闸 TTL 与续期', () => {
  it('acquire 后 TTL = 上游超时上限 + 缓冲,不再短于长流时长', async () => {
    // 病灶值 120s:新 TTL 必须严格更长,且心跳显著小于 TTL(续期才来得及)
    expect(GLOBAL_INFLIGHT_TTL_MS).toBeGreaterThan(120_000)
    expect(GLOBAL_INFLIGHT_TTL_MS).toBeGreaterThan(GLOBAL_INFLIGHT_TTL_BUFFER_MS)
    expect(GLOBAL_INFLIGHT_HEARTBEAT_MS).toBeLessThan(GLOBAL_INFLIGHT_TTL_MS / 2)

    const h = await tryAcquireGlobalInflight(2)
    expect(h?.backend).toBe('redis')

    const acquireEval = fake.state.calls.find((c) => c.cmd === 'eval')
    expect(acquireEval?.args[2]).toBe(GLOBAL_INFLIGHT_TTL_MS)

    const row = fake.state.data.get(KEY_GLOBAL_INFLIGHT)
    expect(row?.value).toBe('1')
    expect(Number(row?.expiresAt) - Date.now()).toBeGreaterThan(120_000)
    await h?.release()
  })

  it('handle 持有期间定时续期:每次心跳都把 TTL 顶回去(调用多次)', async () => {
    const clock = manualClock()
    const h = await tryAcquireGlobalInflight(2, clock.opts)
    expect(h?.backend).toBe('redis')
    expect(clock.intervalMs).toBe(GLOBAL_INFLIGHT_HEARTBEAT_MS)
    // 心跳未推进前只有 acquire 写的那一次 TTL
    expect(fake.state.pexpireCount).toBe(0)

    clock.tick(3)
    expect(fake.state.pexpireCount).toBe(3)
    const row = fake.state.data.get(KEY_GLOBAL_INFLIGHT)
    expect(Number(row?.expiresAt) - Date.now()).toBeGreaterThan(GLOBAL_INFLIGHT_TTL_MS - 5_000)

    // 模拟远超旧 TTL 的长流:反复推进,计数仍在,TTL 每次都被顶回
    clock.tick(10)
    expect(fake.state.pexpireCount).toBe(13)
    expect(fake.state.data.get(KEY_GLOBAL_INFLIGHT)?.value).toBe('1')
    await h?.release()
  })

  it('release 立即停表并减计数;之后推进 interval 不再续期', async () => {
    const clock = manualClock()
    const h = await tryAcquireGlobalInflight(2, clock.opts)
    clock.tick(2)
    expect(fake.state.pexpireCount).toBe(2)

    await h?.release()
    expect(clock.cleared).toHaveLength(1)
    expect(fake.state.data.get(KEY_GLOBAL_INFLIGHT)?.value).toBe('0')

    // release 之后即便旧回调被触发也不再发 PEXPIRE(流结束即停在途计数)
    clock.tick(5)
    expect(fake.state.pexpireCount).toBe(2)

    await h?.release() // 幂等:不二次扣减、不重复停表
    expect(fake.state.data.get(KEY_GLOBAL_INFLIGHT)?.value).toBe('0')
    expect(clock.cleared).toHaveLength(1)
  })
})
