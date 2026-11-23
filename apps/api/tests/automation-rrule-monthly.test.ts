// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'

import { parseNextRun } from '../src/services/agent-automation-scheduler.js'

const CST = 'Asia/Shanghai'

/** 北京时间字面量 → Date */
function cst(iso: string): Date {
  return new Date(`${iso}+08:00`)
}

describe('parseNextRun:MVP rrule 子集', () => {
  it('MONTHLY 每月 15 日 09:00,从当月中出发落到本月 15 日', () => {
    const next = parseNextRun(
      'FREQ=MONTHLY;BYMONTHDAY=15;BYHOUR=9;BYMINUTE=0',
      cst('2026-03-10T08:00:00'),
      CST,
    )
    expect(next?.toISOString()).toBe(cst('2026-03-15T09:00:00').toISOString())
  })

  it('MONTHLY 已过本月 15 日则落到下月 15 日', () => {
    const next = parseNextRun(
      'FREQ=MONTHLY;BYMONTHDAY=15;BYHOUR=9;BYMINUTE=0',
      cst('2026-03-16T08:00:00'),
      CST,
    )
    expect(next?.toISOString()).toBe(cst('2026-04-15T09:00:00').toISOString())
  })

  it('MONTHLY 31 日在 2 月回退月末,不漏月', () => {
    const next = parseNextRun(
      'FREQ=MONTHLY;BYMONTHDAY=31;BYHOUR=9;BYMINUTE=0',
      cst('2026-02-01T00:00:00'),
      CST,
    )
    expect(next?.toISOString()).toBe(cst('2026-02-28T09:00:00').toISOString())
  })

  it('MONTHLY 闰年 2 月 29 日', () => {
    const next = parseNextRun(
      'FREQ=MONTHLY;BYMONTHDAY=31;BYHOUR=9;BYMINUTE=0',
      cst('2024-02-01T00:00:00'),
      CST,
    )
    expect(next?.toISOString()).toBe(cst('2024-02-29T09:00:00').toISOString())
  })

  it('MONTHLY BYMONTHDAY=-1 取月末', () => {
    const next = parseNextRun(
      'FREQ=MONTHLY;BYMONTHDAY=-1;BYHOUR=18;BYMINUTE=0',
      cst('2026-04-10T00:00:00'),
      CST,
    )
    expect(next?.toISOString()).toBe(cst('2026-04-30T18:00:00').toISOString())
  })

  it('MONTHLY 跨年推进', () => {
    const next = parseNextRun(
      'FREQ=MONTHLY;BYMONTHDAY=1;BYHOUR=9;BYMINUTE=0',
      cst('2026-12-05T00:00:00'),
      CST,
    )
    expect(next?.toISOString()).toBe(cst('2027-01-01T09:00:00').toISOString())
  })

  it('MONTHLY 缺 BYMONTHDAY 解析失败返回 null(显式优于猜测)', () => {
    expect(parseNextRun('FREQ=MONTHLY;BYHOUR=9', cst('2026-03-10T00:00:00'), CST)).toBeNull()
  })

  it('非 MONTHLY 带 BYMONTHDAY 解析失败返回 null', () => {
    expect(
      parseNextRun('FREQ=DAILY;BYMONTHDAY=15;BYHOUR=9', cst('2026-03-10T00:00:00'), CST),
    ).toBeNull()
  })

  it('BYMONTHDAY 多值拒绝(当前只支持单值)', () => {
    expect(
      parseNextRun('FREQ=MONTHLY;BYMONTHDAY=1,15;BYHOUR=9', cst('2026-03-10T00:00:00'), CST),
    ).toBeNull()
  })

  it('BYMONTHDAY 越界(0 / 32)拒绝', () => {
    expect(
      parseNextRun('FREQ=MONTHLY;BYMONTHDAY=0;BYHOUR=9', cst('2026-03-10T00:00:00'), CST),
    ).toBeNull()
    expect(
      parseNextRun('FREQ=MONTHLY;BYMONTHDAY=32;BYHOUR=9', cst('2026-03-10T00:00:00'), CST),
    ).toBeNull()
  })

  it('DAILY 保持原语义(今天未到点落到今天)', () => {
    const next = parseNextRun('FREQ=DAILY;BYHOUR=9;BYMINUTE=0', cst('2026-03-10T08:00:00'), CST)
    expect(next?.toISOString()).toBe(cst('2026-03-10T09:00:00').toISOString())
  })

  it('WEEKLY 保持原语义(周一 09:00)', () => {
    // 2026-03-10 是周二
    const next = parseNextRun(
      'FREQ=WEEKLY;BYDAY=MO;BYHOUR=9;BYMINUTE=0',
      cst('2026-03-10T08:00:00'),
      CST,
    )
    expect(next?.toISOString()).toBe(cst('2026-03-16T09:00:00').toISOString())
  })

  it('HOURLY 为绝对 +1h', () => {
    const next = parseNextRun('FREQ=HOURLY', cst('2026-03-10T08:00:00'), CST)
    expect(next?.toISOString()).toBe(cst('2026-03-10T09:00:00').toISOString())
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
