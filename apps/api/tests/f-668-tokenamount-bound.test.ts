// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-668 回归锁(2026-11-13):兑换码 tokenAmount 无上限 + `sum(token_amount)::bigint::int`
 * 把聚合截回 int4 ⇒ 一张 3_000_000_000 的码即可让统计接口 22003 → 500。
 *
 * 止血两腿:
 *  ① 写侧:单张 tokenAmount 上限 MAX_REDEMPTION_TOKEN_AMOUNT(路由 zod 与 service 共用同一常量);
 *  ② 读侧:getStats 的 tokenSum 去掉末端 ::int,聚合只到 ::bigint,再由 JS 侧 Number() 收口。
 *
 * 本用例不连真实 DB:源码形状锁(对齐 f-22「源码形状」范式)+ 上限/收口语义断言。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'

function readSource(relPath: string): string {
  return readFileSync(fileURLToPath(new URL(relPath, import.meta.url)), 'utf8')
}

const serviceSource = readSource('../src/services/redemption-code-service.ts')
const routeSource = readSource('../src/routes/admin/redemption-codes.ts')

describe('F-668 写侧 — tokenAmount 上限', () => {
  it('service 导出单一上限常量,值 ≤ int4 上限(防单张离谱值顶爆 sum)', () => {
    const m = serviceSource.match(/export const MAX_REDEMPTION_TOKEN_AMOUNT = ([\d_]+)/)
    expect(m).not.toBeNull()
    const bound = Number(m![1]!.replace(/_/g, ''))
    expect(Number.isInteger(bound)).toBe(true)
    expect(bound).toBeGreaterThan(0)
    expect(bound).toBeLessThanOrEqual(2_147_483_647)
  })

  it('路由 zod schema 用 .max(同一常量),不硬编码第二个上限', () => {
    expect(routeSource).toContain('MAX_REDEMPTION_TOKEN_AMOUNT')
    expect(routeSource).toMatch(
      /tokenAmount:\s*z\.number\(\)\.int\(\)\.positive\(\)\.max\(MAX_REDEMPTION_TOKEN_AMOUNT\)/,
    )
  })

  it('service batchGenerateCodes 同样校验上限(不依赖路由单独挡)', () => {
    expect(serviceSource).toMatch(/tokenAmount > MAX_REDEMPTION_TOKEN_AMOUNT/)
  })
})

describe('F-668 读侧 — 聚合不再 ::int', () => {
  it('getStats 的 tokenSum 不再 ::bigint::int', () => {
    expect(serviceSource).not.toMatch(
      /coalesce\(sum\(\$\{redemptionCodes\.tokenAmount\}\), 0\)::bigint::int/,
    )
  })

  it('getStats 的 tokenSum 改为 ::bigint 并由 Number() 收口成 number', () => {
    expect(serviceSource).toMatch(
      /coalesce\(sum\(\$\{redemptionCodes\.tokenAmount\}\), 0\)::bigint`/,
    )
    expect(serviceSource).toMatch(/stats\.totalTokenAmount \+= Number\(row\.tokenSum\)/)
  })

  // 绑生产类型的反向用例:模拟 postgres.js 对 ::bigint 返回字符串的情形
  it('Number() 收口把 bigint 字符串累加成 number(不串成字符串 / 不 NaN)', () => {
    const rows = [
      { tokenSum: '3000000000' as unknown as number },
      { tokenSum: '2000000000' as unknown as number },
    ]
    let total = 0
    for (const r of rows) total += Number(r.tokenSum)
    expect(total).toBe(5_000_000_000)
    expect(typeof total).toBe('number')
    expect(Number.isFinite(total)).toBe(true)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
