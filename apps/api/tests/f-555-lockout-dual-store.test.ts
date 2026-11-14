// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-555 回归锁(2026-11-13)。
 *
 * 病灶:account-lockout.ts 在 Redis 报错时把失败写进进程内 fallbackStore,
 * 但 Redis 恢复后 getLockRemainingMs 只读 Redis、recordLoginFailure 也只累加 Redis,
 * 于是抖动窗口内的失败次数与锁定状态在恢复瞬间清零(攻击者白拿若干次尝试)。
 *
 * 本文件锁:
 *   ① Redis 报错期间的失败必须落在 fallback,并能在故障期读出锁定剩余;
 *   ② Redis 恢复后仍能读到 fallback 的锁定剩余,并 best-effort 回填锁定键;
 *   ③ 读路径取两存储更严格值(锁剩余取 max);
 *   ④ 恢复后的下一次失败沿用 fallback 的累计计数,不重新从 1 开始。
 *
 * 只 mock ioredis(内存假实现 + 可控故障开关),不触达真实 Redis / PG。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const redisState = vi.hoisted(() => ({
  down: false,
  kv: new Map<string, string>(),
  expireAt: new Map<string, number>(),
}))

vi.mock('ioredis', () => {
  const fail = (): never => {
    throw new Error('redis unavailable (F-555 mock)')
  }
  class FakeRedis {
    on(): void {
      /* no-op:吞掉 error 事件监听 */
    }
    async incr(key: string): Promise<number> {
      if (redisState.down) fail()
      const next = Number(redisState.kv.get(key) ?? '0') + 1
      redisState.kv.set(key, String(next))
      return next
    }
    async expire(key: string, seconds: number): Promise<number> {
      if (redisState.down) fail()
      redisState.expireAt.set(key, Date.now() + seconds * 1000)
      return 1
    }
    async set(key: string, value: string, ...args: unknown[]): Promise<string> {
      if (redisState.down) fail()
      redisState.kv.set(key, String(value))
      const exIndex = args.findIndex((a) => typeof a === 'string' && a.toUpperCase() === 'EX')
      if (exIndex >= 0) {
        redisState.expireAt.set(key, Date.now() + Number(args[exIndex + 1]) * 1000)
      }
      return 'OK'
    }
    async ttl(key: string): Promise<number> {
      if (redisState.down) fail()
      if (!redisState.kv.has(key)) return -2
      const expireAt = redisState.expireAt.get(key)
      if (!expireAt) return -1
      const remain = Math.ceil((expireAt - Date.now()) / 1000)
      if (remain <= 0) {
        redisState.kv.delete(key)
        redisState.expireAt.delete(key)
        return -2
      }
      return remain
    }
    async del(...keys: string[]): Promise<number> {
      if (redisState.down) fail()
      let removed = 0
      for (const key of keys) {
        if (redisState.kv.delete(key)) removed += 1
        redisState.expireAt.delete(key)
      }
      return removed
    }
    async quit(): Promise<string> {
      return 'OK'
    }
  }
  return { default: FakeRedis }
})

import {
  recordLoginFailure,
  getLockRemainingMs,
  clearLoginFailures,
  _resetAccountLockoutForTests,
  ACCOUNT_LOCKOUT_CONFIG,
} from '../src/services/account-lockout.js'

const lockKey = (account: string): string => `lock:login:${account}`
const failKey = (account: string): string => `fail:login:${account}`

beforeEach(() => {
  redisState.down = false
  redisState.kv.clear()
  redisState.expireAt.clear()
  _resetAccountLockoutForTests()
})

afterEach(() => {
  _resetAccountLockoutForTests()
})

describe('F-555 fallback 与 Redis 双存储必须合并读取、双写记录', () => {
  it('① Redis 报错期间的失败被写入 fallback,故障期即可读到锁定', async () => {
    const account = 'f555-outage@example.com'
    redisState.down = true

    let remain = -1
    for (let i = 0; i < ACCOUNT_LOCKOUT_CONFIG.maxFailures; i++) {
      remain = await recordLoginFailure(account, '1.1.1.1')
    }
    expect(remain).toBe(0)

    const ms = await getLockRemainingMs(account, '1.1.1.1')
    expect(ms).toBeGreaterThan(0)
    expect(ms).toBeLessThanOrEqual(ACCOUNT_LOCKOUT_CONFIG.lockDurationSec * 1000)
    // 同一账号换 IP 仍在锁定窗口内(锁定按账号全局)
    expect(await getLockRemainingMs(account, '2.2.2.2')).toBeGreaterThan(0)
  })

  it('② Redis 恢复后仍能读到 fallback 的锁定剩余,并回填锁定键', async () => {
    const account = 'f555-recover@example.com'
    redisState.down = true
    for (let i = 0; i < ACCOUNT_LOCKOUT_CONFIG.maxFailures; i++) {
      await recordLoginFailure(account, '1.1.1.1')
    }

    // 故障期的锁定剩余(此时 Redis 仍不可用,读的是 fallback)
    const localMs = await getLockRemainingMs(account, '1.1.1.1')
    expect(localMs).toBeGreaterThan(0)

    // 模拟 Redis 恢复但故障期的键已丢失
    redisState.down = false
    redisState.kv.clear()
    redisState.expireAt.clear()

    // 恢复后必须仍读到 fallback 的锁定,而不是直接返回 Redis 的 0
    const merged = await getLockRemainingMs(account, '1.1.1.1')
    expect(merged).toBeGreaterThan(0)
    expect(merged).toBeGreaterThanOrEqual(localMs - 2_000)
    // best-effort 回填:Redis 侧重新出现锁定键与 TTL
    expect(redisState.kv.get(lockKey(account))).toBe('1')
    expect(redisState.expireAt.has(lockKey(account))).toBe(true)

    // 成功登录清空时两存储都要清,否则 fallback 残留锁会继续拦截
    await clearLoginFailures(account, '1.1.1.1')
    expect(await getLockRemainingMs(account, '1.1.1.1')).toBe(0)
  })

  it('③ 锁定剩余取两存储更严格(更长)的值', async () => {
    const account = 'f555-max@example.com'
    redisState.down = true
    for (let i = 0; i < ACCOUNT_LOCKOUT_CONFIG.maxFailures; i++) {
      await recordLoginFailure(account, '1.1.1.1')
    }
    const localMs = await getLockRemainingMs(account, '1.1.1.1')
    expect(localMs).toBeGreaterThan(60_000)

    // Redis 侧只有一个更短的锁(60s):结果必须取 fallback 的更长值
    redisState.down = false
    redisState.kv.clear()
    redisState.expireAt.clear()
    redisState.kv.set(lockKey(account), '1')
    redisState.expireAt.set(lockKey(account), Date.now() + 60_000)
    const merged = await getLockRemainingMs(account, '1.1.1.1')
    expect(merged).toBeGreaterThan(60_000)
    expect(merged).toBeGreaterThanOrEqual(localMs - 2_000)

    // 反向:Redis 更长时必须返回 Redis 的值,不能被 fallback 的 0 拖低
    _resetAccountLockoutForTests()
    redisState.kv.clear()
    redisState.expireAt.clear()
    const redisOnly = 'f555-redis-only@example.com'
    redisState.kv.set(lockKey(redisOnly), '1')
    redisState.expireAt.set(lockKey(redisOnly), Date.now() + 300_000)
    expect(await getLockRemainingMs(redisOnly, '1.1.1.1')).toBeGreaterThan(290_000)
  })

  it('④ Redis 恢复后的下一次失败沿用 fallback 累计计数,不清零重来', async () => {
    const account = 'f555-continue@example.com'
    redisState.down = true
    for (let i = 0; i < ACCOUNT_LOCKOUT_CONFIG.maxFailures - 1; i++) {
      await recordLoginFailure(account, '1.1.1.1')
    }

    // Redis 恢复且计数键为空:第 5 次失败应锁定,而不是从 1 重新累加
    redisState.down = false
    redisState.kv.clear()
    redisState.expireAt.clear()

    expect(await recordLoginFailure(account, '1.1.1.1')).toBe(0)
    expect(redisState.kv.get(failKey(account))).toBe(String(ACCOUNT_LOCKOUT_CONFIG.maxFailures))
    expect(redisState.kv.get(lockKey(account))).toBe('1')
    expect(await getLockRemainingMs(account, '1.1.1.1')).toBeGreaterThan(0)
  })
})
