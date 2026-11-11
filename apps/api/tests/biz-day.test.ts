// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 业务日界唯一出口的行为锁(纯函数,不连库)。
// 立它的理由:这个族的失效是"每天上海 00:00–08:00 那八小时"型的 —— 平时全绿,
// 只在窗口内把签到/访客/报表记到前一天。没有跨日界的夹具,这种 bug 就只能在生产里被发现。
import { describe, expect, it } from 'vitest'

import { shiftDate, todayString } from '../src/utils/checkin-helpers.js'
import { bizDayKey, bizDayStartUtc, shiftBizDayKey } from '../src/utils/biz-day.js'

describe('biz-day:上海日界', () => {
  it('上海 01:00(UTC 前一天 17:00)算新的一天 —— 旧实现正是在这里错一天', () => {
    expect(bizDayKey(new Date('2026-10-24T17:00:00Z'))).toBe('2026-10-25')
  })
  it('上海 23:30(UTC 15:30)仍算同一天', () => {
    expect(bizDayKey(new Date('2026-10-24T15:30:00Z'))).toBe('2026-10-24')
  })
  it('UTC 16:00 整点即换日(边界取值归新的一天,不留半格模糊)', () => {
    expect(bizDayKey(new Date('2026-10-24T15:59:59Z'))).toBe('2026-10-24')
    expect(bizDayKey(new Date('2026-10-24T16:00:00Z'))).toBe('2026-10-25')
  })
  it('区间下界 = 上海当天 0 点对应的 UTC 时刻(可直接喂 gte(createdAt, …))', () => {
    const start = bizDayStartUtc(0)
    const key = bizDayKey(start)
    expect(start.getTime()).toBe(new Date(`${key}T00:00:00+08:00`).getTime())
    expect(bizDayKey(new Date(start.getTime() - 1))).not.toBe(key)
  })
  it('daysAgo 往前推的是"上海的自然日",不是 24h 的整数倍近似', () => {
    expect(bizDayStartUtc(1).getTime()).toBe(bizDayStartUtc(0).getTime() - 24 * 3600 * 1000)
  })
  it('shiftBizDayKey 跨月不串日', () => {
    expect(shiftBizDayKey('2026-03-01', -1)).toBe('2026-02-28')
    expect(shiftBizDayKey('2026-10-25', -6)).toBe('2026-10-19')
  })
})

describe('checkin-helpers:扇出的 6 个调用点与唯一出口同口径', () => {
  it('todayString 就是 bizDayKey(不再自行算 UTC)', () => {
    expect(todayString()).toBe(bizDayKey())
  })
  it('shiftDate 与 shiftBizDayKey 逐字同值', () => {
    const key = bizDayKey()
    expect(shiftDate(key, -6)).toBe(shiftBizDayKey(key, -6))
  })
  it('反向锁:把 todayString 退回旧实现(UTC)会在上海早八前与出口分叉', () => {
    const naiveUtc = (at: Date) => at.toISOString().slice(0, 10)
    const shanghai0100 = new Date('2026-10-24T17:00:00Z')
    expect(naiveUtc(shanghai0100)).not.toBe(bizDayKey(shanghai0100))
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
