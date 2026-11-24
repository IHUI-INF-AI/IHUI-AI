// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 客户端签名(`utils/client-sign.ts`)专测 —— 2026-11-17 立。
 *
 * 这份签名是登录端"认自家原生客户端"的唯一依据(取代可伪造的 UA 判据),所以四件事必须钉住:
 *   ① **算法与 node:crypto 逐向量等值** —— 纯 JS 实现漂一次,全端登录 403 且日志看不出原因。
 *   ② **端与服务端同源** —— 生成(端)与验签(服务端)在同一个进程里必须互相认。
 *   ③ **失效方向恒为"多一次人机验证"** —— 过期 / 篡改 / 缺密钥 / 形态坏,一律 signed=false,
 *      绝不出现"验签失败却放行"。
 *   ④ **形态封闭** —— 段数、hex 长度、时间戳为正数;任何越界形态归 malformed,不猜。
 */
import { createHash } from 'node:crypto'

import { describe, expect, it } from 'vitest'

import {
  CLIENT_SIGN_MAX_SKEW_MS,
  CLIENT_SIGN_VERSION,
  computeClientSignature,
  formatClientSignature,
  isClientSignatureFresh,
  parseClientSignature,
  verifyClientSignature,
} from '../src/utils/client-sign'

/** 与实现内部完全一致的载荷拼法(仅用于对账;实现若改格式,这条会立刻红) */
function payloadOf(appId: string, tsMs: number, secret: string): string {
  return `${CLIENT_SIGN_VERSION}|${appId}|${tsMs}|${secret}`
}

describe('client-sign / 算法与 node:crypto 逐向量等值', () => {
  const vectors: Array<[string, string, number]> = [
    ['test-secret', 'ihui-app', 1700000000000],
    ['secret-with-|pipe', 'ihui-cli', 1700000000001],
    ['中文密钥', 'ihui-miniapp', 1700000000002],
    ['', 'x', 0],
  ]

  for (const [secret, appId, tsMs] of vectors) {
    it(`向量 secret=${JSON.stringify(secret)} appId=${appId}`, () => {
      if (!secret) {
        // 空密钥:实现必须抛错,而不是静默产出一个"看起来像签名"的空摘要
        expect(() => computeClientSignature(secret, appId, tsMs)).toThrow()
        return
      }
      const expected = createHash('sha256').update(payloadOf(appId, tsMs, secret), 'utf8').digest('hex')
      expect(computeClientSignature(secret, appId, tsMs)).toBe(expected)
    })
  }

  it('空 appId / 非有限时间戳一律抛错(不产假签名)', () => {
    expect(() => computeClientSignature('s', '', 1)).toThrow()
    expect(() => computeClientSignature('s', 'app', NaN)).toThrow()
    expect(() => computeClientSignature('s', 'app', Infinity)).toThrow()
  })
})

describe('client-sign / 生成与验签同源', () => {
  const secret = 'shared-secret-v1'
  const appId = 'ihui-app'
  const now = 1_800_000_000_000

  it('formatClientSignature 产 <appId>.<ts>.<64hex>,且能被 verify 认', () => {
    const value = formatClientSignature(secret, appId, now)
    const parts = value.split('.')
    expect(parts).toHaveLength(3)
    expect(parts[0]).toBe(appId)
    expect(parts[1]).toBe(String(now))
    expect(parts[2]).toMatch(/^[0-9a-f]{64}$/)
    expect(verifyClientSignature(value, secret, now)).toEqual({ signed: true, reason: 'ok' })
  })

  it('tsMs 省略时取当前时刻(现算而不是缓存)', () => {
    const a = formatClientSignature(secret, appId)
    const parsed = parseClientSignature(a)
    expect(parsed).not.toBeNull()
    expect(Math.abs(parsed!.tsMs - Date.now())).toBeLessThan(5_000)
  })

  it('时间窗 ±10 分钟:边界内认、边界外判 stale', () => {
    const at = (delta: number) => formatClientSignature(secret, appId, now + delta)
    expect(verifyClientSignature(at(CLIENT_SIGN_MAX_SKEW_MS), secret, now).signed).toBe(true)
    expect(verifyClientSignature(at(-CLIENT_SIGN_MAX_SKEW_MS), secret, now).signed).toBe(true)
    expect(verifyClientSignature(at(CLIENT_SIGN_MAX_SKEW_MS + 1), secret, now)).toEqual({
      signed: false,
      reason: 'stale',
    })
    expect(verifyClientSignature(at(-CLIENT_SIGN_MAX_SKEW_MS - 1), secret, now)).toEqual({
      signed: false,
      reason: 'stale',
    })
  })
})

describe('client-sign / 失效方向恒为拒绝', () => {
  const secret = 'shared-secret-v1'
  const now = 1_800_000_000_000
  const good = formatClientSignature(secret, 'ihui-app', now)

  it('篡改签名体 ⇒ mismatch', () => {
    const tampered = good.slice(0, -1) + (good.endsWith('0') ? '1' : '0')
    expect(verifyClientSignature(tampered, secret, now)).toEqual({ signed: false, reason: 'mismatch' })
  })

  it('篡改 appId ⇒ mismatch(身份不许被换)', () => {
    const parts = good.split('.')
    const swapped = ['ihui-evil', parts[1], parts[2]].join('.')
    expect(verifyClientSignature(swapped, secret, now)).toEqual({ signed: false, reason: 'mismatch' })
  })

  it('换密钥 ⇒ mismatch', () => {
    expect(verifyClientSignature(good, 'other-secret', now)).toEqual({ signed: false, reason: 'mismatch' })
  })

  it('服务端未配密钥 ⇒ secret-not-configured(不是"放行",是回落到既有判据)', () => {
    expect(verifyClientSignature(good, '', now)).toEqual({ signed: false, reason: 'secret-not-configured' })
  })

  it('缺头 / 空串 ⇒ missing;形态坏 ⇒ malformed', () => {
    expect(verifyClientSignature(undefined, secret, now)).toEqual({ signed: false, reason: 'missing' })
    expect(verifyClientSignature('', secret, now)).toEqual({ signed: false, reason: 'missing' })
    expect(verifyClientSignature(123 as unknown, secret, now)).toEqual({ signed: false, reason: 'missing' })
    for (const bad of ['a.b', 'a.b.c.d', 'a.b.zz', '.1.' + '0'.repeat(64), 'a.-1.' + '0'.repeat(64), 'a.0.' + '0'.repeat(64)]) {
      expect(verifyClientSignature(bad, secret, now).signed).toBe(false)
    }
  })

  it('大写 hex 也认(HTTP 头大小写不敏感,签名体大小写只归一)', () => {
    const upper = good.toUpperCase().replace('IHUI-APP', 'ihui-app')
    expect(verifyClientSignature(upper, secret, now).signed).toBe(true)
  })
})

describe('client-sign / parse 与 fresh 的封闭形态', () => {
  it('parse 只接受恰好三段 + 64 位 hex + 正数时间戳', () => {
    const sig = 'a'.repeat(64)
    expect(parseClientSignature(`app.100.${sig}`)).toEqual({ appId: 'app', tsMs: 100, sig })
    expect(parseClientSignature(`app.100.${'A'.repeat(64)}`)).toEqual({
      appId: 'app',
      tsMs: 100,
      sig: 'a'.repeat(64),
    })
    expect(parseClientSignature(`app.100.${'a'.repeat(63)}`)).toBeNull()
    expect(parseClientSignature(`app.100.${'a'.repeat(65)}`)).toBeNull()
    expect(parseClientSignature(`app.${'not-a-number'}.${sig}`)).toBeNull()
    expect(parseClientSignature(`.100.${sig}`)).toBeNull()
    expect(parseClientSignature(null)).toBeNull()
  })

  it('fresh 判定只回答时钟窗口,不回答"是否可信"', () => {
    const base = 1_800_000_000_000
    expect(isClientSignatureFresh(base, base)).toBe(true)
    expect(isClientSignatureFresh(base - CLIENT_SIGN_MAX_SKEW_MS, base)).toBe(true)
    expect(isClientSignatureFresh(base - CLIENT_SIGN_MAX_SKEW_MS - 1, base)).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
