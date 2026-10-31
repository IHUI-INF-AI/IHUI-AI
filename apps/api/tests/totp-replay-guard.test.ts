// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * TOTP 重放防护的回归锁（2026-10-31 R12）。
 *
 * 病灶：`verifyTotp` 允许 ±1 time step（90s 窗口），而登录兑付点只判"码对不对"，
 * 不记"这一步兑过没有" ⇒ 一个被旁窥/钓鱼拿到的 6 位码可在窗口内重复换取多份 token。
 *
 * 判据单源：`verifyTotpCounter` 只负责回报命中的 counter；`consumeTotpCounter` 只管
 * "同一步只兑付一次"的账。本文件不复制任何判据，只钉这三件事：
 *   ① counter 回报正确（含 ±1 漂移）；
 *   ② 同一步第二次兑付被拒、跨步放行、回退步被拒；
 *   ③ 登录兑付点真的接了这个出口（读源码结构，防"实现了但没接线"）。
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { __test__ as T, verifyTotp, verifyTotpCounter } from '../src/services/totp-service.js'
import {
  __test__ as S,
  consumeTotpCounter,
} from '../src/services/two-factor-step-up-store.js'

const secret = Buffer.from('12345678901234567890', 'utf8')
const digits = 6
const nowCounter = () => Math.floor(Date.now() / 1000 / 30)

beforeEach(() => {
  S.memLastTotpCounter.clear()
})

describe('verifyTotpCounter：回报命中的 time step', () => {
  it('当前步的码返回当前 counter（±1 内）', () => {
    const now = nowCounter()
    const code = T.computeHotp(secret, now, 'sha1', digits)
    const hit = verifyTotpCounter(code, secret)
    expect(hit).not.toBeNull()
    expect([now - 1, now, now + 1]).toContain(hit)
    expect(verifyTotp(code, secret)).toBe(true)
  })

  it('错误码 / 非 6 位 / 非数字一律 null', () => {
    expect(verifyTotpCounter('000000', secret)).toBeNull()
    expect(verifyTotpCounter('12345', secret)).toBeNull()
    expect(verifyTotpCounter('abcdef', secret)).toBeNull()
  })
})

describe('consumeTotpCounter：同一步只兑付一次', () => {
  it('同一步第二次兑付被拒（内存账）', async () => {
    const step = nowCounter()
    expect(await consumeTotpCounter('u-1', step, null)).toBe(true)
    expect(await consumeTotpCounter('u-1', step, null)).toBe(false)
  })

  it('跨步放行、回退步被拒（单调递增）', async () => {
    const step = nowCounter()
    expect(await consumeTotpCounter('u-2', step, null)).toBe(true)
    expect(await consumeTotpCounter('u-2', step + 1, null)).toBe(true)
    expect(await consumeTotpCounter('u-2', step, null)).toBe(false)
    expect(await consumeTotpCounter('u-2', step - 1, null)).toBe(false)
  })

  it('不同用户各自独立', async () => {
    const step = nowCounter()
    expect(await consumeTotpCounter('u-3', step, null)).toBe(true)
    expect(await consumeTotpCounter('u-4', step, null)).toBe(true)
  })

  it('Redis 记账失败时回落进程内账（仍拒重放）', async () => {
    const step = nowCounter()
    const broken = {
      async eval() {
        throw new Error('redis down')
      },
    } as unknown as Parameters<typeof consumeTotpCounter>[2]
    expect(await consumeTotpCounter('u-5', step, broken)).toBe(true)
    expect(await consumeTotpCounter('u-5', step, broken)).toBe(false)
  })
})

describe('接线锁：登录兑付点必须消费 counter', () => {
  const src = readFileSync(
    fileURLToPath(new URL('../src/routes/auth-extended.ts', import.meta.url)),
    'utf8',
  )

  it('challenge 兑付点用 verifyTotpCounter + consumeTotpCounter（不是裸 verifyTotp）', () => {
    const block = src.slice(src.indexOf('const totpCounter = verifyTotpCounter('), src.indexOf('const totpCounter = verifyTotpCounter(') + 600)
    expect(block).toContain('consumeTotpCounter(userId, totpCounter')
    expect(block).toContain('verified = true')
  })

  it('消费失败分支不会把 verified 置真（重放必须落 401 分支）', () => {
    const at = src.indexOf('const totpCounter = verifyTotpCounter(')
    const block = src.slice(at, at + 600)
    expect(block).toMatch(/totpCounter !== null\s*&&/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
