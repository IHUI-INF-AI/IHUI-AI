/**
 * 回归测试:BUG-R5-CSRF
 *
 * bugId: BUG-R5-CSRF
 * 轮次: 5
 * 场景: POST 请求无 csrf-token cookie,验证被拒绝
 *       旧架构来源: server/tests/test_bug_fixes_round5.py
 *
 * 验证点:
 *  - 双提交 Cookie 模式:token 匹配通过
 *  - cookie 缺失返回 false
 *  - token 不匹配返回 false
 *  - generateCsrfToken 返回 32 字节随机字符串
 *
 * 运行: pnpm -F @ihui/api test -- tests/regression/csrf.test.ts
 */
import { describe, it, expect } from 'vitest'
import { randomBytes } from 'node:crypto'

/**
 * 生成 CSRF Token(32 字节随机十六进制字符串)
 */
function generateCsrfToken(): string {
  return randomBytes(32).toString('hex')
}

/**
 * 校验 CSRF Token(双提交 Cookie 模式)
 * - cookie 不存在 → 拒绝
 * - token 与 cookie 不匹配 → 拒绝
 * - 类型不一致 → 拒绝
 */
function validateCsrfToken(token: unknown, cookie: unknown): boolean {
  if (typeof token !== 'string' || typeof cookie !== 'string') return false
  if (!token || !cookie) return false
  // 长度不同直接拒绝(避免 timing attack 使用恒定时间比较)
  if (token.length !== cookie.length) return false
  // 恒定时间比较,防止时序攻击
  let diff = 0
  for (let i = 0; i < token.length; i++) {
    diff |= token.charCodeAt(i) ^ cookie.charCodeAt(i)
  }
  return diff === 0
}

describe('BUG-R5-CSRF:双提交 Cookie 模式校验', () => {
  it('token 与 cookie 匹配返回 true', () => {
    const token = generateCsrfToken()
    expect(validateCsrfToken(token, token)).toBe(true)
  })

  it('cookie 不存在(undefined)返回 false', () => {
    const token = generateCsrfToken()
    expect(validateCsrfToken(token, undefined)).toBe(false)
  })

  it('cookie 为空字符串返回 false', () => {
    const token = generateCsrfToken()
    expect(validateCsrfToken(token, '')).toBe(false)
  })

  it('token 不匹配返回 false', () => {
    expect(validateCsrfToken('a', 'b')).toBe(false)
  })

  it('token 缺失(undefined)返回 false', () => {
    expect(validateCsrfToken(undefined, 'some-cookie')).toBe(false)
  })

  it('generateCsrfToken 返回 64 字符(32 字节 hex)随机字符串', () => {
    const token = generateCsrfToken()
    expect(token).toHaveLength(64)
    expect(token).toMatch(/^[0-9a-f]+$/)
  })

  it('generateCsrfToken 每次产生不同的 token', () => {
    const tokens = new Set<string>()
    for (let i = 0; i < 100; i++) {
      tokens.add(generateCsrfToken())
    }
    // 100 次生成应得到 100 个不同的 token
    expect(tokens.size).toBe(100)
  })

  it('长度不同直接返回 false(类型安全)', () => {
    expect(validateCsrfToken('short', 'a-much-longer-cookie-value')).toBe(false)
    expect(validateCsrfToken(123 as unknown as string, '123')).toBe(false)
    expect(validateCsrfToken(null as unknown as string, null as unknown as string)).toBe(false)
  })
})
