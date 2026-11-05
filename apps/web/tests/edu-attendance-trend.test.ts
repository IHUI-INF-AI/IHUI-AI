// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 考勤趋势聚合纯函数的单测:判据不在测试里复算,一律 import 组件文件的实现(AGENTS §22c)。
import { describe, it, expect } from 'vitest'

import {
  buildAttendanceTrendSeries,
  TREND_STATUS_CODES,
  type AttendancePeriodRow,
} from '../app/(main)/edu/edu-management/attendance/AttendanceTrendChart'

const row = (period: string, status: string, count: number): AttendancePeriodRow => ({
  period,
  status,
  count,
})

describe('buildAttendanceTrendSeries', () => {
  it('同一时段的散行合成一个读数点,并按时间升序排', () => {
    const series = buildAttendanceTrendSeries([
      row('2026-03-02', 'late', 1),
      row('2026-03-01', 'present', 9),
      row('2026-03-01', 'late', 1),
      row('2026-03-02', 'present', 8),
    ])
    expect(series.map((p) => p.period)).toEqual(['2026-03-01', '2026-03-02'])
    expect(series[0]).toMatchObject({ present: 9, late: 1, total: 10, attendanceRate: 90 })
    expect(series[1]).toMatchObject({ present: 8, late: 1, total: 9, attendanceRate: 88.89 })
  })

  it('分母 = 该时段有记录的人次(含非正常状态),不是班级在册人数', () => {
    // 全班 40 人、当日只有 10 条记录 ⇒ 分母必须是 10
    const series = buildAttendanceTrendSeries([
      row('2026-03-01', 'present', 5),
      row('2026-03-01', 'absent', 3),
      row('2026-03-01', 'leave', 2),
    ])
    expect(series[0]!.total).toBe(10)
    expect(series[0]!.attendanceRate).toBe(50)
  })

  it('迟到逐日递增可读(机主原话那一问:这周迟到是不是一天比一天多)', () => {
    const series = buildAttendanceTrendSeries([
      row('2026-03-01', 'late', 1),
      row('2026-03-01', 'present', 39),
      row('2026-03-02', 'late', 2),
      row('2026-03-02', 'present', 38),
      row('2026-03-03', 'late', 5),
      row('2026-03-03', 'present', 35),
    ])
    expect(series.map((p) => p.late)).toEqual([1, 2, 5])
    expect(series.map((p) => p.attendanceRate)).toEqual([97.5, 95, 87.5])
  })

  it('后端新增状态码进 other 且留在分母里(出勤率不会静默虚高)', () => {
    const series = buildAttendanceTrendSeries([
      row('2026-03-01', 'present', 4),
      row('2026-03-01', 'truant', 6), // 协议外新码
    ])
    expect(series[0]!.other).toBe(6)
    expect(series[0]!.total).toBe(10)
    expect(series[0]!.attendanceRate).toBe(40)
  })

  it('六个构成段之和恒等于 total,不吞任何一条计数', () => {
    const series = buildAttendanceTrendSeries([
      row('2026-03-01', 'present', 3),
      row('2026-03-01', 'late', 2),
      row('2026-03-01', 'early', 1),
      row('2026-03-01', 'absent', 4),
      row('2026-03-01', 'leave', 5),
      row('2026-03-01', 'unknown_x', 6),
    ])
    const point = series[0]!
    const sum = TREND_STATUS_CODES.reduce((acc, code) => acc + point[code], 0) + point.other
    expect(sum).toBe(point.total)
    expect(point.total).toBe(21)
  })

  it('脏输入折 0:负数/NaN/Infinity/小数/空串时段与状态都不进读数', () => {
    const series = buildAttendanceTrendSeries([
      row('2026-03-01', 'present', -7),
      row('2026-03-01', 'late', Number.NaN),
      row('2026-03-01', 'absent', Number.POSITIVE_INFINITY),
      row('2026-03-01', 'leave', 0),
      row('   ', 'present', 9),
      row('2026-03-02', '   ', 9),
      row('2026-03-02', 'present', 2.9),
      null,
      undefined,
    ])
    expect(series).toHaveLength(1)
    expect(series[0]!.period).toBe('2026-03-02')
    expect(series[0]!.total).toBe(2)
    expect(series[0]!.attendanceRate).toBe(100)
  })

  it('无记录时段不出现(0 记录 ⇒ 不臆造 0% 读数),空数组进空数组出', () => {
    expect(buildAttendanceTrendSeries([])).toEqual([])
    expect(buildAttendanceTrendSeries([row('2026-03-01', 'present', 0)])).toEqual([])
  })

  it('周/月粒度按时段键字典序排(服务端下发 IYYY-IW / YYYY-MM,客户端不重算)', () => {
    const series = buildAttendanceTrendSeries([
      row('2026-02', 'present', 1),
      row('2026-10', 'present', 1),
      row('2025-12', 'present', 1),
    ])
    expect(series.map((p) => p.period)).toEqual(['2025-12', '2026-02', '2026-10'])
  })

  it('时段重复出现时同段同类累加、异段互不串(桶键就是时段本身)', () => {
    const series = buildAttendanceTrendSeries([
      row('2026-03-01', 'present', 1),
      row('2026-03-01', 'present', 2),
      row('2026-03-02', 'present', 4),
    ])
    expect(series).toHaveLength(2)
    expect(series[0]!.present).toBe(3)
    expect(series[1]!.present).toBe(4)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
