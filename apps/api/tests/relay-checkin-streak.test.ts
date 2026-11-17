// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 签到连续天数判据(2026-11-17)。
 *
 * 钉住四件事:
 * ① 今天没签不算断(从昨天起算),断两天才算 0;
 * ② 最长连续段与当前段是两个独立量,不能互相污染;
 * ③ 无历史 ⇒ available:false + 原因,绝不把"没记录"说成"0 天";
 * ④ 归属日口径 = UTC+8,判据本身零时区依赖。
 */
import { describe, expect, it } from 'vitest'
import {
  computeCheckinStreak,
  shiftDay,
  todayInUtc8,
} from '../src/services/relay-checkin-streak.js'

describe('连续天数判据', () => {
  it('S1 含今天的三连签 ⇒ current 3 / longest 3', () => {
    const r = computeCheckinStreak(['2026-11-15', '2026-11-16', '2026-11-17'], '2026-11-17')
    expect(r.available).toBe(true)
    expect(r.current).toBe(3)
    expect(r.longest).toBe(3)
    expect(r.last_day).toBe('2026-11-17')
    expect(r.counted_days).toEqual(['2026-11-15', '2026-11-16', '2026-11-17'])
  })

  it('S2 今天还没签 ⇒ 从昨天起算,不算断', () => {
    const r = computeCheckinStreak(['2026-11-15', '2026-11-16'], '2026-11-17')
    expect(r.current).toBe(2)
    expect(r.counted_days).toEqual(['2026-11-15', '2026-11-16'])
  })

  it('S3 今天与昨天都缺 ⇒ current 0,但历史仍在', () => {
    const r = computeCheckinStreak(['2026-11-10', '2026-11-11'], '2026-11-17')
    expect(r.available).toBe(true)
    expect(r.current).toBe(0)
    expect(r.longest).toBe(2)
    expect(r.last_day).toBe('2026-11-11')
  })

  it('S4 当前段 3 天 / 历史最长 6 天,两量独立', () => {
    const days = [
      '2026-11-01',
      '2026-11-02',
      '2026-11-03',
      '2026-11-04',
      '2026-11-05',
      '2026-11-06',
      '2026-11-15',
      '2026-11-16',
      '2026-11-17',
    ]
    const r = computeCheckinStreak(days, '2026-11-17')
    expect(r.current).toBe(3)
    expect(r.longest).toBe(6)
  })

  it('S5 无历史 ⇒ available:false + 原因,current/longest 都是 0', () => {
    const r = computeCheckinStreak([], '2026-11-17')
    expect(r.available).toBe(false)
    expect(r.current).toBe(0)
    expect(r.longest).toBe(0)
    expect(r.reason).toContain('尚无签到历史')
  })

  it('S6 重复 / 乱序 / 非法串自行清洗', () => {
    const r = computeCheckinStreak(
      ['2026-11-16', '2026-11-16', 'bad-day', '2026-11-17', '2026-11-15'],
      '2026-11-17',
    )
    expect(r.current).toBe(3)
    expect(r.last_day).toBe('2026-11-17')
  })

  it('S7 UTC+8 归属日:UTC 16:00 已是次日', () => {
    expect(todayInUtc8(new Date('2026-11-17T15:59:00Z'))).toBe('2026-11-17')
    expect(todayInUtc8(new Date('2026-11-17T16:00:00Z'))).toBe('2026-11-18')
  })

  it('S8 shiftDay 跨月/跨年正确', () => {
    expect(shiftDay('2026-11-01', -1)).toBe('2026-10-31')
    expect(shiftDay('2026-12-31', 1)).toBe('2027-01-01')
    expect(shiftDay('not-a-day', 1)).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
