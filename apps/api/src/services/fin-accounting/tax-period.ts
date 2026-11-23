// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 申报期间与截止日 —— 纯函数,零 IO,可单测。
 *
 * 为什么单独成文件:期间展开与截止日推算是"申报日历是否漏报"的唯一判据,
 * 过去它埋在有数据库依赖的服务文件里,只能靠 e2e 覆盖。抽出来后:
 *   · 服务层(tax-service)从这里取,不再有第二份实现;
 *   · 单测直接 import 本文件,不触发任何连库。
 *
 * 期间形态:
 *   monthly   → YYYY-MM
 *   quarterly → YYYY-Q1..Q4
 *   annual    → YYYY
 */

import { assertPeriod, lastDayOf, nextPeriod } from './period.js'

export type FilingCycle = 'monthly' | 'quarterly' | 'annual'

export const FILING_CYCLES: FilingCycle[] = ['monthly', 'quarterly', 'annual']

/** 月粒度区间 → 该周期下的期间列表(升序);to < from 返回空 */
export function periodsBetween(cycle: FilingCycle, fromMonth: string, toMonth: string): string[] {
  assertPeriod(fromMonth, 'from')
  assertPeriod(toMonth, 'to')
  if (toMonth < fromMonth) return []
  const out: string[] = []
  if (cycle === 'annual') {
    for (let y = Number(fromMonth.slice(0, 4)); y <= Number(toMonth.slice(0, 4)); y += 1) {
      out.push(String(y))
    }
    return out
  }
  if (cycle === 'quarterly') {
    const startQ = Math.floor((Number(fromMonth.slice(5, 7)) - 1) / 3) + 1
    const endQ = Math.floor((Number(toMonth.slice(5, 7)) - 1) / 3) + 1
    for (let y = Number(fromMonth.slice(0, 4)); y <= Number(toMonth.slice(0, 4)); y += 1) {
      const qFrom = y === Number(fromMonth.slice(0, 4)) ? startQ : 1
      const qTo = y === Number(toMonth.slice(0, 4)) ? endQ : 4
      for (let q = qFrom; q <= qTo; q += 1) out.push(`${y}-Q${q}`)
    }
    return out
  }
  let cur = fromMonth
  while (cur <= toMonth) {
    out.push(cur)
    cur = nextPeriod(cur)
  }
  return out
}

/**
 * 申报截止日 = 期间结束后的第 dueMonthOffset 个月的第 dueDay 号。
 *
 * 例:增值税月度 (offset=1, day=15) 2026-03 → 2026-04-15;
 *     企业所得税年度汇算 (offset=5, day=31) 2026 → 2027-05-31。
 * dueDay 超过该月天数时回退月末(2 月不会因为"31 号"而落空)。
 */
export function dueDateOf(period: string, dueDay: number, dueMonthOffset = 1): string {
  const baseMonth = monthAfterPeriod(period)
  const month = addMonths(baseMonth, dueMonthOffset - 1)
  const last = Number(lastDayOf(month))
  const day = Math.min(dueDay, last)
  return `${month}-${String(day).padStart(2, '0')}`
}

/** 期间的下一个月的第一天所属月(申报所在月) */
export function monthAfterPeriod(period: string): string {
  if (/^\d{4}$/.test(period)) return `${Number(period) + 1}-01`
  const qm = /^\d{4}-Q([1-4])$/.exec(period)
  if (qm) {
    const year = Number(period.slice(0, 4))
    const q = Number(qm[1])
    return q === 4 ? `${year + 1}-01` : `${year}-${String(q * 3 + 1).padStart(2, '0')}`
  }
  return nextPeriod(period)
}

export function addMonths(month: string, n: number): string {
  const year = Number(month.slice(0, 4))
  const m = Number(month.slice(5, 7))
  const idx = year * 12 + (m - 1) + n
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, '0')}`
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
