// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-631 回归锁(2026-11-13)。
 *
 * 病灶:GET /api/developer/billing 的 period 用 `(paidAt ?? createdAt).toISOString().slice(0,7)`,
 * 按 UTC 归月 ⇒ 每月 1 日 00:00–08:00(北京)的支付被归入上月,账单月份与对账/发票口径错位。
 * 修法:改走 bizDayKey(上海日).slice(0,7),与全仓业务日唯一出口同源。
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'
import { bizDayKey } from '../src/utils/biz-day.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROUTE = resolve(HERE, '../src/routes/developer.ts')

/** 与 routes/developer.ts 中 period 字段完全一致的归月表达式。 */
const bizMonthOf = (at: Date): string => bizDayKey(at).slice(0, 7)

describe('F-631 开发者账单归月(上海日)', () => {
  it('2026-11-01T00:30:00+08:00 归入 202611(UTC 会误算 202610)', () => {
    expect(bizMonthOf(new Date('2026-11-01T00:30:00+08:00'))).toBe('2026-11')
  })

  it('2026-11-01T07:59:00+08:00 归入 202611(仍在上月零点的 UTC 区间内)', () => {
    expect(bizMonthOf(new Date('2026-11-01T07:59:00+08:00'))).toBe('2026-11')
  })

  it('2026-10-31T23:59:00+08:00 归入 202610', () => {
    expect(bizMonthOf(new Date('2026-10-31T23:59:00+08:00'))).toBe('2026-10')
  })

  it('billing 路由不再用 UTC toISOString().slice(0,7) 归月', () => {
    const src = readFileSync(ROUTE, 'utf-8')
    expect(src).not.toContain('.toISOString().slice(0, 7)')
    expect(src).toContain('bizDayKey(o.paidAt ?? o.createdAt).slice(0, 7)')
  })
})
