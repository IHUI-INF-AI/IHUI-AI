// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-24:export CSV 日期筛选必须用 Asia/Shanghai 业务日界(走 utils/biz-day 唯一出口),
 * 而不是 `${d}T00:00:00Z` / `${d}T23:59:59Z` 的 UTC 日界:
 * - UTC 下界会把上海 00:00–07:59 的订单错切到前一天;
 * - `T23:59:59Z` 上界会丢 23:59:59.001–999ms。
 * bizDayBounds 是端内两处(orders.csv / relay-logs.csv)共用的日界出口。
 */
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

vi.mock('../src/db/index.js', () => ({ db: {}, dbRead: {} }))
vi.mock('../src/plugins/require-permission.js', () => ({ requireAdmin: vi.fn() }))

import { bizDayBounds } from '../src/routes/admin/export-csv.js'

describe('F-24 导出 CSV 的业务日界(Asia/Shanghai)', () => {
  it('单日区间:上海 [当日00:00, 次日00:00) ⇒ [前日16:00Z, 当日16:00Z)', () => {
    const { start, endExclusive } = bizDayBounds('2026-11-08', '2026-11-08')
    expect(start?.toISOString()).toBe('2026-11-07T16:00:00.000Z')
    expect(endExclusive?.toISOString()).toBe('2026-11-08T16:00:00.000Z')
  })

  it('上界为次日 0 点开区间:旧口径漏切的上海 00:00–07:59 与 23:59:59.999 都在区间内', () => {
    const { start, endExclusive } = bizDayBounds('2026-11-07', '2026-11-08')
    const sh = (iso: string): number => new Date(iso).getTime()
    // 上海 2026-11-08 00:30(旧 UTC 下界会把它错切到 11-08 之外的前一天凌晨之前)
    expect(sh('2026-11-07T16:30:00.000Z')).toBeGreaterThanOrEqual(start!.getTime())
    // 上海 2026-11-08 23:59:59.999(旧 `T23:59:59Z` 上界会丢这 999ms)
    expect(sh('2026-11-08T15:59:59.999Z')).toBeLessThan(endExclusive!.getTime())
    // 上海 2026-11-07 00:00 之前一分钟 ⇒ 区间外
    expect(sh('2026-11-06T15:59:59.999Z')).toBeLessThan(start!.getTime())
  })

  it('只传一端时只产生对应边界,维持原「只设一端」语义', () => {
    const onlyStart = bizDayBounds('2026-11-08')
    expect(onlyStart.start?.toISOString()).toBe('2026-11-07T16:00:00.000Z')
    expect(onlyStart.endExclusive).toBeUndefined()

    const onlyEnd = bizDayBounds(undefined, '2026-11-08')
    expect(onlyEnd.start).toBeUndefined()
    expect(onlyEnd.endExclusive?.toISOString()).toBe('2026-11-08T16:00:00.000Z')

    expect(bizDayBounds()).toEqual({ start: undefined, endExclusive: undefined })
  })

  it('源码不再有 UTC 日界拼串,orders/relay-logs 两处调用都走 bizDayBounds', () => {
    const src = readFileSync(
      fileURLToPath(new URL('../src/routes/admin/export-csv.ts', import.meta.url)),
      'utf-8',
    )
    // 剔除注释行后再断言(注释里引用旧口径做对照说明是允许的)
    const codeLines = src
      .split('\n')
      .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
      .join('\n')
    expect(codeLines).not.toContain('T00:00:00Z')
    expect(codeLines).not.toContain('T23:59:59Z')
    // 1 处定义 + orders.csv / relay-logs.csv 各 1 处调用
    expect(src.match(/bizDayBounds\(/g)!.length).toBeGreaterThanOrEqual(3)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
