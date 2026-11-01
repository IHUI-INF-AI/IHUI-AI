// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 登录"等代价校验"回归锁(2026-11-01,防账号枚举 CWE-204)。
 *
 * 堵的是哪一型:未认证登录在"账号不存在"时**短路掉 argon2id 校验**——
 * `if (!user || !user.passwordHash) → 短返回` 或 `!user || !user.passwordHash || !(await verifyPassword(...))`。
 * 文案早在 2026-07-24 就统一成"用户不存在或密码错误",但耗时没统一:argon2id 是按参数
 * 刻意做慢的,跳过它就是几十到几百毫秒的差 ⇒ 掐表就能把有效账号列出来。
 * 消息一致 ≠ 不可枚举,这是本文件存在的理由。
 *
 * 断言用注入的哨兵 verify(而不是测墙钟时间):耗时结论必须是**结构性**的
 * ("这一次校验有没有发生"),拿 setTimeout 比差值只会造出一台随负载抖的哑判据。
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { hashPassword } from '../src/utils/password-crypto.js'
import { verifyLoginPassword } from '../src/utils/login-verify.js'

const RIGHT = 'Correct-Horse-Battery-Staple-9'

describe('登录等代价校验', () => {
  it('账号不存在时也必须发生一次口令校验(这是本枚的全部意义)', async () => {
    const spy = vi.fn(async () => false)
    const ok = await verifyLoginPassword(undefined, 'whatever', spy)
    expect(ok).toBe(false)
    expect(spy).toHaveBeenCalledTimes(1)
    // 且那次校验拿到的不是空串:空 hash 会让"跳过"换了个写法继续存在
    const usedHash = String(spy.mock.calls[0]?.[1] ?? '')
    expect(usedHash.length).toBeGreaterThan(10)
    expect(usedHash.startsWith('$argon2id$')).toBe(true)
  })

  it('主体为 null / 有主体但没口令哈希:两种"不可登录"都付同样一次校验', async () => {
    for (const subject of [null, undefined, { passwordHash: '' }, { passwordHash: null }]) {
      const spy = vi.fn(async () => false)
      expect(await verifyLoginPassword(subject, 'x', spy)).toBe(false)
      expect(spy, JSON.stringify(subject)).toHaveBeenCalledTimes(1)
    }
  })

  it('正向对照:真人 + 对密码 ⇒ true,且只校验一次', async () => {
    const hash = await hashPassword(RIGHT)
    const spy = vi.fn(async (pwd: string, h: string) => h === hash && pwd === RIGHT)
    expect(await verifyLoginPassword({ passwordHash: hash }, RIGHT, spy)).toBe(true)
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('真人 + 错密码 ⇒ false(与"没这个人"同一条返回值,调用方无从分叉)', async () => {
    const hash = await hashPassword(RIGHT)
    const absentSpy = vi.fn(async () => false)
    const wrongSpy = vi.fn(async () => false)
    const a = await verifyLoginPassword(undefined, 'nope', absentSpy)
    const b = await verifyLoginPassword({ passwordHash: hash }, 'nope', wrongSpy)
    expect(a).toBe(b)
    expect(a).toBe(false)
    // 两条路径的校验次数必须相同(耗时面等价的结构性证明)
    expect(absentSpy).toHaveBeenCalledTimes(wrongSpy.mock.calls.length)
  })

  it('占位哈希进程内只算一次(惰性,不在启动路径上做口令推导)', async () => {
    const { dummyVerifyHash } = await import('../src/utils/login-verify.js')
    const first = await dummyVerifyHash()
    const second = await dummyVerifyHash()
    expect(second).toBe(first)
    expect(first.startsWith('$argon2id$')).toBe(true)
  })
})

describe('接线锁:三处未认证登录都必须走等代价出口', () => {
  const read = (rel: string) =>
    readFileSync(new URL(`../src/routes/${rel}`, import.meta.url), 'utf8')
  const sites = ['auth.ts', 'auth-extended.ts']

  it('verifyLoginPassword 在两个登录文件里被用到(>=3 处:账号/手机/用户名)', () => {
    const uses = sites.reduce(
      (n, f) => n + (read(f).match(/verifyLoginPassword\(/g) ?? []).length,
      0,
    )
    expect(uses).toBeGreaterThanOrEqual(3)
  })

  it('那条"不带剩余次数"的裸消息不得回来(它是分叉的证据:回来后调用方又能区分两种 false)', () => {
    for (const f of sites) {
      const src = read(f)
      expect(src, f).not.toContain(`error(401, '用户不存在或密码错误')`)
      expect(src, f).not.toContain('!user || !user.passwordHash || !(await verifyPassword(')
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
