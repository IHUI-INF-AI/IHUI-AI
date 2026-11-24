// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * F-713 回归锁(2026-11-13)。
 *
 * 病灶:calendar-boundary.toDate 把无时区时间串直接交给 new Date,V8 按进程本地时区解析:
 * TZ=Asia/Shanghai 时 '2024-01-01T00:00:00' → 2023-12-31T16:00:00Z,
 * dayStart 再取 getUTCDate()=31 ⇒ 日/周/月边界整体错一天。
 *
 * 本文件锁:
 *   ① 无时区裸串按 UTC 墙钟时间解释(TZ 无关);
 *   ② 带 Z / 显式偏移的输入保持原义(有偏移输入行为不变);
 *   ③ 纯日期串仍是 UTC;
 *   ④ 日/周/月/年/季度边界在 UTC / Asia/Shanghai / America/New_York 等时区下逐字段一致。
 */
import { describe, it, expect, afterEach } from 'vitest'
import {
  toDate,
  dayStart,
  dayEnd,
  dayBoundary,
  weekBoundary,
  monthStart,
  monthBoundary,
  yearStart,
  quarterStart,
} from '../src/utils/calendar-boundary'

const ORIGINAL_TZ = process.env.TZ

afterEach(() => {
  if (ORIGINAL_TZ === undefined) {
    delete process.env.TZ
  } else {
    process.env.TZ = ORIGINAL_TZ
  }
})

describe('F-713 toDate — 无时区串按 UTC 墙钟时间', () => {
  it('无时区裸串:不再跟随本地时区', () => {
    process.env.TZ = 'Asia/Shanghai'
    // 前提自证:这正是修正前裸 new Date 的解析结果(错一天)
    expect(new Date('2024-01-01T00:00:00').toISOString()).toBe('2023-12-31T16:00:00.000Z')
    expect(toDate('2024-01-01T00:00:00').toISOString()).toBe('2024-01-01T00:00:00.000Z')
  })

  it('带 Z 保持原义', () => {
    process.env.TZ = 'Asia/Shanghai'
    expect(toDate('2024-01-01T00:00:00Z').toISOString()).toBe('2024-01-01T00:00:00.000Z')
    process.env.TZ = 'America/New_York'
    expect(toDate('2024-01-01T00:00:00Z').toISOString()).toBe('2024-01-01T00:00:00.000Z')
  })

  it('带显式偏移保持原义(不随 TZ 变化)', () => {
    for (const tz of ['UTC', 'Asia/Shanghai', 'America/New_York', 'Asia/Kathmandu']) {
      process.env.TZ = tz
      expect(toDate('2024-01-01T00:00:00+08:00').toISOString()).toBe('2023-12-31T16:00:00.000Z')
      expect(toDate('2024-01-01T00:00:00-0500').toISOString()).toBe('2024-01-01T05:00:00.000Z')
    }
  })

  it('纯日期串按 UTC', () => {
    for (const tz of ['UTC', 'Asia/Shanghai', 'America/New_York']) {
      process.env.TZ = tz
      expect(toDate('2024-01-01').toISOString()).toBe('2024-01-01T00:00:00.000Z')
    }
  })

  it('秒/毫秒精度保留', () => {
    process.env.TZ = 'Asia/Shanghai'
    expect(toDate('2024-06-15T12:30:45').toISOString()).toBe('2024-06-15T12:30:45.000Z')
    expect(toDate('2024-06-15T12:30:45.5').toISOString()).toBe('2024-06-15T12:30:45.500Z')
  })

  it('非法日期串仍抛 TypeError', () => {
    expect(() => toDate('not-a-date')).toThrow(TypeError)
    expect(() => toDate('2024-13-45T00:00:00')).toThrow(TypeError)
  })
})

describe('F-713 日/月边界 — TZ=Asia/Shanghai 不再错一天', () => {
  it('dayStart/dayEnd/dayBoundary', () => {
    process.env.TZ = 'Asia/Shanghai'
    expect(dayStart('2024-01-01T00:00:00').toISOString()).toBe('2024-01-01T00:00:00.000Z')
    expect(dayEnd('2024-01-01T00:00:00').toISOString()).toBe('2024-01-02T00:00:00.000Z')
    const b = dayBoundary('2024-01-01T00:00:00')
    expect(b.start.toISOString()).toBe('2024-01-01T00:00:00.000Z')
    expect(b.end.toISOString()).toBe('2024-01-02T00:00:00.000Z')
    // 2024-01-01 是周一(0=周一 档)
    expect(b.weekday).toBe(0)
  })

  it('weekBoundary:2024-01-01 是周一', () => {
    process.env.TZ = 'Asia/Shanghai'
    const w = weekBoundary('2024-01-01T00:00:00', 'MONDAY')
    expect(w.start.toISOString()).toBe('2024-01-01T00:00:00.000Z')
    expect(w.end.toISOString()).toBe('2024-01-08T00:00:00.000Z')
    expect(w.isoWeek).toBe(1)
    expect(w.isoYear).toBe(2024)
  })

  it('monthBoundary:落在 2024-01 而不是 2023-12', () => {
    process.env.TZ = 'Asia/Shanghai'
    const m = monthBoundary('2024-01-01T00:00:00')
    expect(m.year).toBe(2024)
    expect(m.month).toBe(1)
    expect(m.start.toISOString()).toBe('2024-01-01T00:00:00.000Z')
    expect(m.end.toISOString()).toBe('2024-02-01T00:00:00.000Z')
    expect(monthStart('2024-01-01T00:00:00').toISOString()).toBe('2024-01-01T00:00:00.000Z')
  })
})

/** 同一批输入在不同进程时区下的完整边界快照。 */
function snapshot(tz: string) {
  process.env.TZ = tz
  return {
    naive: toDate('2024-01-01T00:00:00').toISOString(),
    withZ: toDate('2024-01-01T00:00:00Z').toISOString(),
    withOffset: toDate('2024-01-01T00:00:00+08:00').toISOString(),
    dateOnly: toDate('2024-01-01').toISOString(),
    instant: toDate('2024-06-15T12:30:45').toISOString(),
    dayStart: dayStart('2024-01-01T00:00:00').toISOString(),
    dayEnd: dayEnd('2024-01-01T00:00:00').toISOString(),
    weekday: dayBoundary('2024-01-01T00:00:00').weekday,
    weekStart: weekBoundary('2024-01-01T00:00:00').start.toISOString(),
    weekEnd: weekBoundary('2024-01-01T00:00:00').end.toISOString(),
    isoWeek: weekBoundary('2024-01-01T00:00:00').isoWeek,
    isoYear: weekBoundary('2024-01-01T00:00:00').isoYear,
    monthStart: monthStart('2024-01-01T00:00:00').toISOString(),
    monthEnd: monthBoundary('2024-01-01T00:00:00').end.toISOString(),
    yearStart: yearStart('2024-01-01T00:00:00').toISOString(),
    quarterStart: quarterStart('2024-01-01T00:00:00').toISOString(),
  }
}

describe('F-713 跨 TZ 不变性', () => {
  it('UTC / Asia/Shanghai / America/New_York / Asia/Kathmandu / Pacific/Kiritimati 结果一致', () => {
    const base = snapshot('UTC')
    expect(base.naive).toBe('2024-01-01T00:00:00.000Z')
    expect(base.dayStart).toBe('2024-01-01T00:00:00.000Z')
    expect(base.monthStart).toBe('2024-01-01T00:00:00.000Z')
    for (const tz of [
      'Asia/Shanghai',
      'America/New_York',
      'Asia/Kathmandu',
      'Pacific/Kiritimati',
      'America/St_Johns',
    ]) {
      expect(snapshot(tz), `TZ=${tz} 应与 UTC 结果一致`).toEqual(base)
    }
  })
})
