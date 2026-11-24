// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * subscription-window-service 单测(2026-09-16 立,订阅日/周/月窗口额度)。
 *
 * 覆盖点(全部为纯函数,无需连库):
 * - getUtc8DayStart / getUtc8WeekStart / getUtc8MonthStart:UTC+8 窗口起点换算
 * - getWindowBounds:日/周/月窗口的 [start, end) 边界与长度
 * - limitOf:从订阅实例取各窗口限额
 *
 * 时间基准:2026-09-16 为周三,故其在 UTC+8 的本周起点为 2026-09-14(周一)。
 */
import { describe, it, expect, vi } from 'vitest'

vi.mock('../src/db/index.js', () => ({ db: {}, dbRead: {} }))
vi.mock('@ihui/database', () => ({ apiSubscriptions: {}, apiSubscriptionWindowUsage: {} }))

import {
  getUtc8DayStart,
  getUtc8WeekStart,
  getUtc8MonthStart,
  getWindowBounds,
  limitOf,
  type WindowType,
} from '../src/services/subscription-window-service.js'

/** UTC+8 周三 09:30 对应的时刻 */
const WED_0930 = new Date('2026-09-16T01:30:00.000Z')

describe('窗口起点换算(UTC+8)', () => {
  it('日窗口起点 = UTC+8 当日 00:00', () => {
    expect(getUtc8DayStart(WED_0930).toISOString()).toBe('2026-09-15T16:00:00.000Z')
  })

  it('周窗口起点 = UTC+8 本周一 00:00', () => {
    expect(getUtc8WeekStart(WED_0930).toISOString()).toBe('2026-09-13T16:00:00.000Z')
  })

  it('月窗口起点 = UTC+8 当月 1 日 00:00', () => {
    expect(getUtc8MonthStart(WED_0930).toISOString()).toBe('2026-08-31T16:00:00.000Z')
  })

  it('UTC 日界附近仍归属正确的 UTC+8 自然日', () => {
    // 2026-09-15T20:00Z → UTC+8 2026-09-16 04:00,应归属 09-16
    expect(getUtc8DayStart(new Date('2026-09-15T20:00:00.000Z')).toISOString()).toBe(
      '2026-09-15T16:00:00.000Z',
    )
    // 2026-09-15T15:00Z → UTC+8 2026-09-15 23:00,应归属 09-15
    expect(getUtc8DayStart(new Date('2026-09-15T15:00:00.000Z')).toISOString()).toBe(
      '2026-09-14T16:00:00.000Z',
    )
  })

  it('周日归属上一周的周一窗口', () => {
    // 2026-09-20 为周日,UTC+8 本周起点仍为 09-14(周一)
    const sunday = new Date('2026-09-20T03:00:00.000Z') // UTC+8 11:00 周日
    expect(getUtc8WeekStart(sunday).toISOString()).toBe('2026-09-13T16:00:00.000Z')
  })
})

describe('getWindowBounds', () => {
  it('日窗口长度为 24 小时', () => {
    const { start, end } = getWindowBounds('daily', WED_0930)
    expect(start.toISOString()).toBe('2026-09-15T16:00:00.000Z')
    expect(end.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000)
  })

  it('周窗口长度为 7 天', () => {
    const { start, end } = getWindowBounds('weekly', WED_0930)
    expect(start.toISOString()).toBe('2026-09-13T16:00:00.000Z')
    expect(end.getTime() - start.getTime()).toBe(7 * 24 * 60 * 60 * 1000)
  })

  it('月窗口跨到次月 1 日(UTC+8)', () => {
    const { start, end } = getWindowBounds('monthly', WED_0930)
    expect(start.toISOString()).toBe('2026-08-31T16:00:00.000Z')
    expect(end.toISOString()).toBe('2026-09-30T16:00:00.000Z')
  })

  it('12 月的月窗口正确跨年到次年 1 月', () => {
    const dec = new Date('2026-12-15T03:00:00.000Z')
    const { end } = getWindowBounds('monthly', dec)
    expect(end.toISOString()).toBe('2026-12-31T16:00:00.000Z')
  })

  it('给定时刻必定落在窗口内(半开区间)', () => {
    for (const w of ['daily', 'weekly', 'monthly'] as WindowType[]) {
      const { start, end } = getWindowBounds(w, WED_0930)
      expect(WED_0930.getTime()).toBeGreaterThanOrEqual(start.getTime())
      expect(WED_0930.getTime()).toBeLessThan(end.getTime())
    }
  })
})

describe('limitOf', () => {
  const sub = {
    dailyTokenLimit: 200_000,
    weeklyTokenLimit: 1_000_000,
    monthlyTokenLimit: -1,
  } as unknown as Parameters<typeof limitOf>[0]

  it('按窗口类型取对应限额', () => {
    expect(limitOf(sub, 'daily')).toBe(200_000)
    expect(limitOf(sub, 'weekly')).toBe(1_000_000)
    expect(limitOf(sub, 'monthly')).toBe(-1)
  })

  it('字段缺失时按 0(未配置)处理', () => {
    const empty = {} as unknown as Parameters<typeof limitOf>[0]
    expect(limitOf(empty, 'daily')).toBe(0)
    expect(limitOf(empty, 'weekly')).toBe(0)
    expect(limitOf(empty, 'monthly')).toBe(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
