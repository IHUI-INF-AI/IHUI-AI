// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-556 回归锁(2026-11-13)。
 *
 * 病灶:account-lockout.ts 用「原始账号串」做失败计数/锁定的 key,用户名/手机号/邮箱
 * 三个可互换标识各占一份 5 次配额 ⇒ 单账号 15 次/15 分钟,撞库配额被放大 3 倍。
 *
 * 本文件锁:
 *   ① username / phone / email 解析到同一用户时共享同一份失败计数,第 5 次即锁定,
 *      且三个标识都能读到同一个锁定窗口(成功登录也按同一身份键清空);
 *   ② 不同用户互不影响(各自的计数与锁定窗口独立);
 *   ③ 解析不到用户时按规范化字符串分桶:邮箱 trim + 小写、手机号去空白/连字符并统一
 *      +86 / 0086 区号前缀;
 *   ④ 解析不到用户(含解析查询失败、调用方拿不到 userId)时回退到规范化字符串,
 *      继续计数并锁定(不得因解析失败放行)。
 *
 * 只 mock ioredis(内存 key-value)+ 用户解析桩(标识 → userId 的映射,
 * 替身登录路由里的 findUserByAccount),不触达真实 Redis / PG。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

const redisState = vi.hoisted(() => ({
  kv: new Map<string, string>(),
  expireAt: new Map<string, number>(),
}))

vi.mock('ioredis', () => {
  class FakeRedis {
    on(): void {
      /* no-op:吞掉 error 事件监听 */
    }
    async incr(key: string): Promise<number> {
      const next = Number(redisState.kv.get(key) ?? '0') + 1
      redisState.kv.set(key, String(next))
      return next
    }
    async expire(key: string, seconds: number): Promise<number> {
      redisState.expireAt.set(key, Date.now() + seconds * 1000)
      return 1
    }
    async set(key: string, value: string, ...args: unknown[]): Promise<string> {
      redisState.kv.set(key, String(value))
      const exIndex = args.findIndex((a) => typeof a === 'string' && a.toUpperCase() === 'EX')
      if (exIndex >= 0) {
        redisState.expireAt.set(key, Date.now() + Number(args[exIndex + 1]) * 1000)
      }
      return 'OK'
    }
    async ttl(key: string): Promise<number> {
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

/** 用户解析桩:替身登录路由在锁定判定前执行的 findUserByAccount(标识 → userId)。 */
const directory = new Map<string, string>()
function resolveUserId(account: string): string | undefined {
  return directory.get(account.trim().toLowerCase())
}

import {
  recordLoginFailure,
  getLockRemainingMs,
  clearLoginFailures,
  normalizeLockoutIdentity,
  _resetAccountLockoutForTests,
  ACCOUNT_LOCKOUT_CONFIG,
} from '../src/services/account-lockout.js'

const failKey = (identity: string): string => `fail:login:${identity}`
const lockKey = (identity: string): string => `lock:login:${identity}`

beforeEach(() => {
  redisState.kv.clear()
  redisState.expireAt.clear()
  directory.clear()
  _resetAccountLockoutForTests()
})

describe('F-556 锁定键按账号归一化身份分桶', () => {
  it('① 用户名/邮箱/手机号指向同一用户时共享计数,第 5 次锁定且三标识都能读到', async () => {
    directory.set('alice', 'u-1')
    directory.set('alice@example.com', 'u-1')
    directory.set('13800138000', 'u-1')

    expect(await recordLoginFailure('alice', '1.1.1.1', resolveUserId('alice'))).toBe(4)
    expect(
      await recordLoginFailure('Alice@Example.com', '1.1.1.1', resolveUserId('Alice@Example.com')),
    ).toBe(3)
    expect(
      await recordLoginFailure('13800138000', '2.2.2.2', resolveUserId('13800138000')),
    ).toBe(2)
    expect(await recordLoginFailure('alice', '3.3.3.3', resolveUserId('alice'))).toBe(1)
    expect(
      await recordLoginFailure('13800138000', '4.4.4.4', resolveUserId('13800138000')),
    ).toBe(0)

    // 三标识共用同一个身份键,不存在按原始串分出的平行计数
    expect(redisState.kv.get(failKey('user:u-1'))).toBe(String(ACCOUNT_LOCKOUT_CONFIG.maxFailures))
    expect(redisState.kv.get(lockKey('user:u-1'))).toBe('1')
    expect(redisState.kv.has(failKey('alice'))).toBe(false)
    expect(redisState.kv.has(failKey('alice@example.com'))).toBe(false)
    expect(redisState.kv.has(failKey('13800138000'))).toBe(false)

    // 任一标识都能读到同一个锁定窗口(且换 IP 不绕过)
    for (const account of ['alice', 'Alice@Example.com', '13800138000']) {
      const ms = await getLockRemainingMs(account, '9.9.9.9', resolveUserId(account))
      expect(ms).toBeGreaterThan(0)
      expect(ms).toBeLessThanOrEqual(ACCOUNT_LOCKOUT_CONFIG.lockDurationSec * 1000)
    }

    // 成功登录按同一身份键清空,三标识一起解锁
    await clearLoginFailures(
      'Alice@Example.com',
      '9.9.9.9',
      resolveUserId('Alice@Example.com'),
    )
    expect(await getLockRemainingMs('13800138000', '9.9.9.9', resolveUserId('13800138000'))).toBe(0)
  })

  it('② 不同用户互不影响', async () => {
    directory.set('alice', 'u-1')
    directory.set('bob', 'u-2')

    for (let i = 0; i < ACCOUNT_LOCKOUT_CONFIG.maxFailures - 1; i++) {
      await recordLoginFailure('alice', '1.1.1.1', resolveUserId('alice'))
    }
    for (let i = 0; i < ACCOUNT_LOCKOUT_CONFIG.maxFailures; i++) {
      await recordLoginFailure('bob', '1.1.1.1', resolveUserId('bob'))
    }

    expect(await getLockRemainingMs('bob', '1.1.1.1', resolveUserId('bob'))).toBeGreaterThan(0)
    expect(await getLockRemainingMs('alice', '1.1.1.1', resolveUserId('alice'))).toBe(0)
    expect(redisState.kv.get(failKey('user:u-1'))).toBe('4')
    expect(redisState.kv.get(failKey('user:u-2'))).toBe('5')
    expect(redisState.kv.has(lockKey('user:u-1'))).toBe(false)
    expect(redisState.kv.get(lockKey('user:u-2'))).toBe('1')
  })

  it('③ 解析不到用户时按规范化字符串分桶(邮箱空白/大小写、手机号空格与区号)', async () => {
    // 邮箱:大小写与首尾空白归并为同一键,5 次失败即锁定
    for (let i = 0; i < ACCOUNT_LOCKOUT_CONFIG.maxFailures - 1; i++) {
      await recordLoginFailure(
        '  Unknown@Example.com ',
        '1.1.1.1',
        resolveUserId('unknown@example.com'),
      )
    }
    expect(
      await recordLoginFailure(
        'unknown@example.com',
        '1.1.1.1',
        resolveUserId('unknown@example.com'),
      ),
    ).toBe(0)
    expect(redisState.kv.get(failKey('unknown@example.com'))).toBe('5')
    expect(redisState.kv.get(lockKey('unknown@example.com'))).toBe('1')

    // 手机号:去空白/连字符、统一 +86 / 0086 区号后归并为同一键
    const variants = ['+86 138-0013-8000', '0086 13800138000', '138 0013 8000', '13800138000']
    let remain = -1
    for (let i = 0; i < ACCOUNT_LOCKOUT_CONFIG.maxFailures; i++) {
      const variant = variants[i % variants.length] as string
      expect(normalizeLockoutIdentity(variant)).toBe('13800138000')
      remain = await recordLoginFailure(variant, '2.2.2.2', resolveUserId(variant))
    }
    expect(remain).toBe(0)
    expect(redisState.kv.get(failKey('13800138000'))).toBe('5')
    expect(
      await getLockRemainingMs('+86 138 0013 8000', '2.2.2.2', resolveUserId('+86 138 0013 8000')),
    ).toBeGreaterThan(0)
  })

  it('④ 解析不到用户(或解析查询失败)时回退规范化串并继续计数,不放行', async () => {
    let remain = -1
    for (let i = 0; i < ACCOUNT_LOCKOUT_CONFIG.maxFailures; i++) {
      // 解析桩返回 undefined = 用户不存在或解析查询失败,调用方拿不到 userId
      remain = await recordLoginFailure(
        ' Fallback@Example.com ',
        '1.1.1.1',
        resolveUserId(' Fallback@Example.com '),
      )
    }

    expect(remain).toBe(0)
    expect(redisState.kv.get(failKey('fallback@example.com'))).toBe('5')
    expect(redisState.kv.get(lockKey('fallback@example.com'))).toBe('1')
    expect(
      await getLockRemainingMs(
        'fallback@example.com',
        '1.1.1.1',
        resolveUserId('fallback@example.com'),
      ),
    ).toBeGreaterThan(0)
  })
})
