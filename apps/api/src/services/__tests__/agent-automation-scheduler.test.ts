// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * agent-automation-scheduler parseNextRun 纯函数单测(2026-09-07 立)。
 * 不连 DB,不 mock 网络——只测 rrule MVP 解析器。
 */
import { describe, it, expect } from 'vitest'
import { parseNextRun } from '../agent-automation-scheduler'

/** 本地时间构造(解析器内部用 setHours,按本地时区比较) */
function local(y: number, m: number, d: number, h = 0, min = 0): Date {
  return new Date(y, m - 1, d, h, min, 0, 0)
}

function expectSame(a: Date | null, y: number, m: number, d: number, h: number, min: number) {
  expect(a).not.toBeNull()
  const actual = a as Date
  expect(actual.getFullYear()).toBe(y)
  expect(actual.getMonth() + 1).toBe(m)
  expect(actual.getDate()).toBe(d)
  expect(actual.getHours()).toBe(h)
  expect(actual.getMinutes()).toBe(min)
  expect(actual.getSeconds()).toBe(0)
}

describe('parseNextRun', () => {
  it('DAILY:今天时刻未到 → 今天 BYHOUR:BYMINUTE', () => {
    const from = local(2026, 9, 7, 8, 0)
    const next = parseNextRun('FREQ=DAILY;BYHOUR=9;BYMINUTE=30', from)
    expectSame(next, 2026, 9, 7, 9, 30)
  })

  it('DAILY:今天时刻已过 → 明天 BYHOUR:BYMINUTE', () => {
    const from = local(2026, 9, 7, 10, 0)
    const next = parseNextRun('FREQ=DAILY;BYHOUR=9;BYMINUTE=30', from)
    expectSame(next, 2026, 9, 8, 9, 30)
  })

  it('DAILY:缺省 BYHOUR/BYMINUTE → 明天 00:00(时刻已过边界)', () => {
    const from = local(2026, 9, 7, 0, 0) // 恰好 00:00,严格晚于 from → 明天 00:00
    const next = parseNextRun('FREQ=DAILY', from)
    expectSame(next, 2026, 9, 8, 0, 0)
  })

  it('WEEKLY:同日时刻未到 → 今天命中', () => {
    // 2026-09-07 是周一
    const from = local(2026, 9, 7, 7, 0)
    const next = parseNextRun('FREQ=WEEKLY;BYDAY=MO;BYHOUR=9;BYMINUTE=0', from)
    expectSame(next, 2026, 9, 7, 9, 0)
  })

  it('WEEKLY:跨周(周五晚 → 下周一早)', () => {
    // 2026-09-04 是周五
    const from = local(2026, 9, 4, 18, 0)
    const next = parseNextRun('FREQ=WEEKLY;BYDAY=MO,WE,FR;BYHOUR=9;BYMINUTE=0', from)
    expectSame(next, 2026, 9, 7, 9, 0)
  })

  it('WEEKLY:BYDAY 全 7 天,from 恰在时刻上 → 严格晚于(次日同时刻)', () => {
    const from = local(2026, 9, 7, 10, 0) // 周一 10:00
    const next = parseNextRun('FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR,SA,SU;BYHOUR=10;BYMINUTE=0', from)
    expectSame(next, 2026, 9, 8, 10, 0)
  })

  it('HOURLY:from + 1 小时(忽略 BYHOUR)', () => {
    const from = local(2026, 9, 7, 9, 15)
    const next = parseNextRun('FREQ=HOURLY;BYHOUR=9', from)
    expectSame(next, 2026, 9, 7, 10, 15)
  })

  it('缺 FREQ → null', () => {
    expect(parseNextRun('BYHOUR=9;BYMINUTE=0', local(2026, 9, 7))).toBeNull()
  })

  it('非法 FREQ(MONTHLY 不支持) → null', () => {
    expect(parseNextRun('FREQ=MONTHLY;BYMONTHDAY=1', local(2026, 9, 7))).toBeNull()
  })

  it('非法 BYHOUR(24) → null', () => {
    expect(parseNextRun('FREQ=DAILY;BYHOUR=24', local(2026, 9, 7))).toBeNull()
  })

  it('非法 BYMINUTE(60) → null', () => {
    expect(parseNextRun('FREQ=DAILY;BYMINUTE=60', local(2026, 9, 7))).toBeNull()
  })

  it('非法 BYDAY(XX) → null', () => {
    expect(parseNextRun('FREQ=WEEKLY;BYDAY=XX;BYHOUR=9', local(2026, 9, 7))).toBeNull()
  })

  it('WEEKLY 缺 BYDAY → null(MVP 不支持隐式星期几)', () => {
    expect(parseNextRun('FREQ=WEEKLY;BYHOUR=9', local(2026, 9, 7))).toBeNull()
  })

  it('BYHOUR 边界值 0 与 23 合法', () => {
    expectSame(parseNextRun('FREQ=DAILY;BYHOUR=0;BYMINUTE=5', local(2026, 9, 7, 1, 0)), 2026, 9, 8, 0, 5)
    expectSame(parseNextRun('FREQ=DAILY;BYHOUR=23;BYMINUTE=59', local(2026, 9, 7, 1, 0)), 2026, 9, 7, 23, 59)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
