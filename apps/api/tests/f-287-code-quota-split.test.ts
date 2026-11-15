// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-287 回归锁(2026-11-13)。
 *
 * 病灶:取码配额键曾是联合键 `echo:q:<identifier>|<ip>`,换一个 identifier 就得到一份
 * 全新计数 —— 与代码自述的「同一 IP 反复换号这条路径上唯一的闸」互相矛盾。同一 IP
 * 10 分钟内可对约 50 个不同号码各取 5 次码,短信轰炸与成本被成倍放大。
 *
 * 本文件锁:
 *   ① 同一 IP 换 identifier:第 6 个号码被拒(IP 维度独立计数);
 *   ② 同一 identifier 换 IP:第 6 个 IP 被拒(标识维度独立计数);
 *   ③ 正常次数内(≤5)两维同时放行,且两键 TTL 均为 10 分钟;
 *   ④ 退款同步两键:一次退款让两键各减 1,不出现「只退一个键」;退到 0 也保留键与窗口起点。
 *
 * 只 mock ioredis(进程内 Map + TTL 替身),走真实的 window-counter 与 code-echo-guard,
 * 不触达真实 Redis / PG / 短信网关。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const fakeRedis = vi.hoisted(() => {
  interface Row {
    count: number
    expiresAt: number
  }
  const store = new Map<string, Row>()

  const live = (key: string): Row | null => {
    const row = store.get(key)
    if (!row) return null
    if (row.expiresAt <= Date.now()) {
      store.delete(key)
      return null
    }
    return row
  }

  const incr = (key: string, ttlMs: number): number => {
    const row = live(key)
    if (!row) {
      store.set(key, { count: 1, expiresAt: Date.now() + ttlMs })
      return 1
    }
    row.count += 1
    return row.count
  }

  /** 只解释 window-counter 实际会下发的那三支脚本,不模拟完整 Lua。 */
  class FakeRedis {
    status = 'ready'

    constructor(...args: unknown[]) {
      void args
    }

    on(): this {
      return this
    }

    async quit(): Promise<'OK'> {
      return 'OK'
    }

    async eval(script: string, numKeys: number, ...args: string[]): Promise<number> {
      const keys = args.slice(0, numKeys)
      if (script.includes("redis.call('DECR'")) {
        for (const key of keys) {
          const row = live(key)
          if (row && row.count > 0) row.count -= 1
        }
        return numKeys
      }
      if (script.includes("redis.call('INCR', KEYS[1])")) {
        return incr(args[0]!, Number(args[1]))
      }
      // tryConsumeWindows:先判后加,参数是成对的 [windowMs, max]
      const limits = args.slice(numKeys).map(Number)
      for (let i = 0; i < numKeys; i += 1) {
        const row = live(keys[i]!)
        if (row && row.count >= limits[i * 2 + 1]!) return i + 1
      }
      for (let i = 0; i < numKeys; i += 1) incr(keys[i]!, limits[i * 2]!)
      return 0
    }

    async pttl(key: string): Promise<number> {
      const row = live(key)
      if (!row) return -2
      return Math.max(0, row.expiresAt - Date.now())
    }

    async scan(_cursor: string, _match: string, pattern: string): Promise<[string, string[]]> {
      const prefix = pattern.endsWith('*') ? pattern.slice(0, -1) : pattern
      return ['0', [...store.keys()].filter((key) => key.startsWith(prefix))]
    }

    async del(...keys: string[]): Promise<number> {
      let removed = 0
      for (const key of keys) if (store.delete(key)) removed += 1
      return removed
    }
  }

  return { store, live, FakeRedis, reset: (): void => store.clear() }
})

vi.mock('ioredis', () => ({ default: fakeRedis.FakeRedis }))

import {
  consumeSendQuota,
  refundSendQuota,
  SEND_QUOTA_MAX_ATTEMPTS,
  SEND_QUOTA_WINDOW_MS,
} from '../src/utils/code-echo-guard.js'
import { windowRemainingMs } from '../src/utils/window-counter.js'

const IP = '203.0.113.7'
const IP_KEY = `echo:q:ip:${IP}`
const IDENTIFIER = '13800001234'
const ID_KEY = `echo:q:id:${IDENTIFIER}`

const countOf = (key: string): number => fakeRedis.live(key)?.count ?? 0

beforeEach(() => {
  fakeRedis.reset()
})

describe('F-287 取码配额拆成 IP / 标识两把独立计数', () => {
  it('① 同一 IP 换 identifier：第 6 个号码被拒(IP 维度独立计数)', async () => {
    for (let i = 0; i < SEND_QUOTA_MAX_ATTEMPTS; i += 1) {
      const r = await consumeSendQuota(`1380000100${i}`, IP)
      expect(r).toEqual({ allowed: true, retryAfterSec: 0 })
    }

    const blocked = await consumeSendQuota('13800001999', IP)

    expect(blocked.allowed).toBe(false)
    expect(blocked.retryAfterSec).toBeGreaterThan(0)
    expect(countOf(IP_KEY)).toBe(SEND_QUOTA_MAX_ATTEMPTS + 1)
  })

  it('② 同一 identifier 换 IP：第 6 个 IP 被拒(标识维度独立计数)', async () => {
    for (let i = 1; i <= SEND_QUOTA_MAX_ATTEMPTS; i += 1) {
      const r = await consumeSendQuota(IDENTIFIER, `198.51.100.${i}`)
      expect(r.allowed).toBe(true)
    }

    const blocked = await consumeSendQuota(IDENTIFIER, '198.51.100.6')

    expect(blocked.allowed).toBe(false)
    expect(blocked.retryAfterSec).toBeGreaterThan(0)
    expect(countOf(ID_KEY)).toBe(SEND_QUOTA_MAX_ATTEMPTS + 1)
    // 新 IP 自己的计数仍是第一次,被拒只可能来自标识维度
    expect(countOf('echo:q:ip:198.51.100.6')).toBe(1)
  })

  it('③ 正常次数内两维同时放行，两键 TTL 均为 10 分钟', async () => {
    for (let i = 0; i < SEND_QUOTA_MAX_ATTEMPTS; i += 1) {
      const r = await consumeSendQuota(IDENTIFIER, IP)
      expect(r).toEqual({ allowed: true, retryAfterSec: 0 })
    }

    expect(countOf(IP_KEY)).toBe(SEND_QUOTA_MAX_ATTEMPTS)
    expect(countOf(ID_KEY)).toBe(SEND_QUOTA_MAX_ATTEMPTS)

    const ttl = await windowRemainingMs(IP_KEY, SEND_QUOTA_WINDOW_MS)
    expect(ttl).toBeGreaterThan(SEND_QUOTA_WINDOW_MS - 5_000)
    expect(ttl).toBeLessThanOrEqual(SEND_QUOTA_WINDOW_MS)
  })

  it('④ 退款同步两键：各减 1，不存在只退一个键；退到 0 仍保留键与窗口起点', async () => {
    await consumeSendQuota(IDENTIFIER, IP)
    await consumeSendQuota(IDENTIFIER, IP)
    const windowStartIp = fakeRedis.live(IP_KEY)!.expiresAt
    const windowStartId = fakeRedis.live(ID_KEY)!.expiresAt
    expect(countOf(IP_KEY)).toBe(2)
    expect(countOf(ID_KEY)).toBe(2)

    await refundSendQuota(IDENTIFIER, IP)

    expect(countOf(IP_KEY)).toBe(1)
    expect(countOf(ID_KEY)).toBe(1)
    expect(fakeRedis.live(IP_KEY)!.expiresAt).toBe(windowStartIp)
    expect(fakeRedis.live(ID_KEY)!.expiresAt).toBe(windowStartId)

    await refundSendQuota(IDENTIFIER, IP)

    expect(countOf(IP_KEY)).toBe(0)
    expect(countOf(ID_KEY)).toBe(0)
    // DECR 到 0 保留键:窗口起点不被退款抹掉,仍按原时间自然过期
    expect(fakeRedis.store.has(IP_KEY)).toBe(true)
    expect(fakeRedis.store.has(ID_KEY)).toBe(true)
    expect(fakeRedis.live(IP_KEY)!.expiresAt).toBe(windowStartIp)
  })
})
