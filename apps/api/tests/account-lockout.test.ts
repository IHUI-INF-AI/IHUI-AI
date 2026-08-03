/**
 * 账号登录失败锁定(Redis 后端)测试。
 * 覆盖:
 * 1. 连续 N 次失败后返回 0(已锁定)
 * 2. 锁定期间 getLockRemainingMs > 0
 * 3. clearLoginFailures 清除失败计数
 * 4. Redis 不可用时降级到内存存储
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

// mock ioredis:让所有 redis 命令调用抛错,触发 account-lockout.ts 的 catch
// 分支走 fallback 内存存储。原测试未 mock ioredis,getRedis() 创建真实
// IORedis 实例连接不存在的 Redis(localhost:6379),每次 incr/ttl/del 等待
// ECONNREFUSED 超时(~9s),maxFailures=5 次累计 45s 超过 vitest 默认 15s
// 测试超时 → 4 个用例 timeout 失败。
vi.mock('ioredis', () => {
  const err = new Error('redis unavailable (mock)')
  class FakeRedis {
    on(): void {
      // no-op:吞掉 'error' 事件监听,避免 unhandled
    }
    incr(): Promise<number> {
      return Promise.reject(err)
    }
    expire(): Promise<number> {
      return Promise.reject(err)
    }
    set(): Promise<string> {
      return Promise.reject(err)
    }
    ttl(): Promise<number> {
      return Promise.reject(err)
    }
    del(): Promise<number> {
      return Promise.reject(err)
    }
    quit(): Promise<string> {
      return Promise.resolve('OK')
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

beforeAll(() => {
  _resetAccountLockoutForTests()
})

afterAll(async () => {
  _resetAccountLockoutForTests()
})

const stamp = Date.now().toString(36)
const key = (suffix: string): string => `${stamp}-${suffix}`

describe('account-lockout 内存降级路径(Redis 不可用时)', () => {
  it('首次失败返回剩余 4 次', async () => {
    _resetAccountLockoutForTests()
    const remain = await recordLoginFailure(key('user-a'), '1.1.1.1')
    expect(remain).toBe(ACCOUNT_LOCKOUT_CONFIG.maxFailures - 1)
  })

  it('连续 maxFailures 次失败后,第 N 次返回 0(已锁定)', async () => {
    _resetAccountLockoutForTests()
    let remain = -1
    for (let i = 0; i < ACCOUNT_LOCKOUT_CONFIG.maxFailures; i++) {
      remain = await recordLoginFailure(key('user-b'), '2.2.2.2')
    }
    expect(remain).toBe(0)
  })

  it('锁定后 getLockRemainingMs > 0', async () => {
    _resetAccountLockoutForTests()
    for (let i = 0; i < ACCOUNT_LOCKOUT_CONFIG.maxFailures; i++) {
      await recordLoginFailure(key('user-c'), '3.3.3.3')
    }
    const ms = await getLockRemainingMs(key('user-c'), '3.3.3.3')
    expect(ms).toBeGreaterThan(0)
    expect(ms).toBeLessThanOrEqual(ACCOUNT_LOCKOUT_CONFIG.lockDurationSec * 1000)
  })

  it('clearLoginFailures 后 getLockRemainingMs 立即为 0', async () => {
    _resetAccountLockoutForTests()
    for (let i = 0; i < ACCOUNT_LOCKOUT_CONFIG.maxFailures; i++) {
      await recordLoginFailure(key('user-d'), '4.4.4.4')
    }
    expect(await getLockRemainingMs(key('user-d'), '4.4.4.4')).toBeGreaterThan(0)
    await clearLoginFailures(key('user-d'), '4.4.4.4')
    expect(await getLockRemainingMs(key('user-d'), '4.4.4.4')).toBe(0)
  })

  it('不同账号/IP 互不影响', async () => {
    _resetAccountLockoutForTests()
    for (let i = 0; i < ACCOUNT_LOCKOUT_CONFIG.maxFailures; i++) {
      await recordLoginFailure(key('user-x'), '9.9.9.9')
    }
    expect(await getLockRemainingMs(key('user-x'), '9.9.9.9')).toBeGreaterThan(0)
    expect(await getLockRemainingMs(key('user-x'), '8.8.8.8')).toBe(0)
    expect(await getLockRemainingMs(key('user-y'), '9.9.9.9')).toBe(0)
  })
})
