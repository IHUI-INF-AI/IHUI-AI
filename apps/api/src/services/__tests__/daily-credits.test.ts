// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it, vi } from 'vitest'

// 纯函数用例不碰库:把 DB 入口整体挡掉,避免 import 期建池(与 tests/setup-env 的哨兵纪律一致)。
vi.mock('../../db/gamification-queries.js', () => ({ ensureDailyCreditRow: vi.fn() }))

const { DAILY_GRANT_POINTS, dailyCreditStateOf, availableOf } = await import('../daily-credits.js')

const baseRow = {
  id: '00000000-0000-4000-8000-000000000001',
  userId: '00000000-0000-4000-8000-000000000002',
  points: 0,
  totalEarned: 0,
  totalSpent: 0,
  level: 1,
  experience: 0,
  dailyPoints: 0,
  dailyPointsDate: null,
  updatedAt: new Date(0),
}

describe('daily-credits 纯口径', () => {
  it('刚发放(剩余=100)：granted 为产品常量、used=0', () => {
    const state = dailyCreditStateOf(
      { ...baseRow, points: 0, dailyPoints: DAILY_GRANT_POINTS, dailyPointsDate: '2026-11-23' },
      new Date('2026-11-23T02:00:00Z'),
    )
    expect(state).toEqual({
      date: '2026-11-23',
      granted: DAILY_GRANT_POINTS,
      used: 0,
      remaining: DAILY_GRANT_POINTS,
    })
  })

  it('用过一部分：used = granted - remaining', () => {
    const state = dailyCreditStateOf(
      { ...baseRow, dailyPoints: 30, dailyPointsDate: '2026-11-23' },
      new Date('2026-11-23T14:00:00Z'),
    )
    expect(state.granted).toBe(DAILY_GRANT_POINTS)
    expect(state.remaining).toBe(30)
    expect(state.used).toBe(DAILY_GRANT_POINTS - 30)
  })

  it('脏数据不把 used 算成负数：remaining 反而大于常量时按 remaining 抬 granted', () => {
    const state = dailyCreditStateOf({
      ...baseRow,
      dailyPoints: 150,
      dailyPointsDate: '2026-11-23',
    })
    expect(state.granted).toBe(150)
    expect(state.used).toBe(0)
    expect(state.remaining).toBe(150)
  })

  it('负值一律夹到 0：remaining 不出现负数', () => {
    const at = new Date('2026-11-23T02:00:00Z')
    const aligned = dailyCreditStateOf(
      { ...baseRow, dailyPoints: -5, dailyPointsDate: '2026-11-23' },
      at,
    )
    expect(aligned.remaining).toBe(0)
    expect(aligned.granted).toBe(DAILY_GRANT_POINTS)
    expect(aligned.used).toBe(DAILY_GRANT_POINTS)
    // 日期未对齐 = 今天还没发/没用，used 不能推成 100
    const stale = dailyCreditStateOf({ ...baseRow, dailyPoints: -5, dailyPointsDate: null }, at)
    expect(stale.remaining).toBe(0)
    expect(stale.used).toBe(0)
  })

  it('日期缺失时按当次业务日回填（biz-day 唯一口径，Asia/Shanghai）', () => {
    // 2026-11-23T16:30:00Z = 上海 2026-11-24 00:30,日键应为 11-24
    const state = dailyCreditStateOf(
      { ...baseRow, dailyPoints: 100, dailyPointsDate: null },
      new Date('2026-11-23T16:30:00Z'),
    )
    expect(state.date).toBe('2026-11-24')
  })

  it('availableOf = 永久余额 + 今日赠送剩余，两段负值都夹到 0', () => {
    const at = new Date('2026-11-23T02:00:00Z')
    const today = '2026-11-23'
    expect(availableOf({ points: 500, dailyPoints: 100, dailyPointsDate: today }, at)).toBe(600)
    expect(availableOf({ points: 0, dailyPoints: 100, dailyPointsDate: today }, at)).toBe(100)
    expect(availableOf({ points: -20, dailyPoints: 100, dailyPointsDate: today }, at)).toBe(100)
    expect(availableOf({ points: 500, dailyPoints: -30, dailyPointsDate: today }, at)).toBe(500)
  })

  it('跨日未刷新的赠送额不计入可用余额（昨日剩余不顺延成今天可用）', () => {
    const at = new Date('2026-11-23T02:00:00Z')
    expect(availableOf({ points: 20, dailyPoints: 100, dailyPointsDate: '2026-11-22' }, at)).toBe(
      20,
    )
    const state = dailyCreditStateOf(
      { ...baseRow, dailyPoints: 100, dailyPointsDate: '2026-11-22' },
      at,
    )
    expect(state.remaining).toBe(0)
    expect(state.used).toBe(0)
    expect(state.granted).toBe(DAILY_GRANT_POINTS)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
