// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:watermarked

import { describe, expect, it } from 'vitest'

import {
  minutesBetween,
  normalizeTimeOfDay,
  parseOutgoingMatrix,
} from '../hr-import-leave.js'

/** 外出导入解析层单测(HR-5 第 3 期)。只测纯函数。 */

describe('normalizeTimeOfDay 时刻归一', () => {
  it('补零 HH:mm:ss', () => {
    expect(normalizeTimeOfDay('9:05')).toBe('09:05:00')
    expect(normalizeTimeOfDay('09:05:30')).toBe('09:05:30')
  })
  it('非法时刻返回 null', () => {
    expect(normalizeTimeOfDay('25:00')).toBeNull()
    expect(normalizeTimeOfDay('09:70')).toBeNull()
    expect(normalizeTimeOfDay('')).toBeNull()
    expect(normalizeTimeOfDay(null)).toBeNull()
  })
})

describe('minutesBetween 时长计算', () => {
  it('同日区间', () => {
    expect(minutesBetween('09:00:00', '12:00:00')).toBe(180)
  })
  it('跨天按次日处理', () => {
    expect(minutesBetween('22:00:00', '02:00:00')).toBe(240)
  })
  it('缺任一端返回 null', () => {
    expect(minutesBetween(null, '12:00:00')).toBeNull()
    expect(minutesBetween('09:00:00', null)).toBeNull()
  })
})

describe('parseOutgoingMatrix 外出表解析', () => {
  it('飞书风格表头 + 说明行定位', () => {
    const matrix = [
      ['某某公司外出明细'],
      ['导出时间:2026-11-12'],
      ['工号', '姓名', '开始日期', '结束日期', '开始时间', '结束时间', '外出地点', '外出事由', '审批状态'],
      ['E2E001', '张三', '2026-11-15', '2026-11-15', '09:00', '12:00', '客户现场A', '上门实施', '已通过'],
    ]
    const { rows } = parseOutgoingMatrix(matrix)
    expect(rows).toHaveLength(1)
    const r = rows[0]!
    expect(r.fields.employeeNo).toBe('E2E001')
    expect(r.normalized.startDate).toBe('2026-11-15')
    expect(r.normalized.endDate).toBe('2026-11-15')
    expect(r.normalized.startTime).toBe('09:00:00')
    expect(r.normalized.endTime).toBe('12:00:00')
    expect(r.normalized.minutes).toBe(180)
    expect(r.normalized.status).toBe('approved')
  })

  it('缺时刻的两天外出按整天推算', () => {
    const matrix = [
      ['工号', '开始日期', '结束日期'],
      ['E2E001', '2026-11-16', '2026-11-17'],
    ]
    const { rows } = parseOutgoingMatrix(matrix)
    expect(rows[0]?.normalized.minutes).toBe(960) // 2 天 × 480
  })

  it('缺结束日期按开始日当天', () => {
    const matrix = [
      ['工号', '开始日期', '外出时长'],
      ['E2E001', '2026-11-15', '2小时'],
    ]
    const { rows } = parseOutgoingMatrix(matrix)
    expect(rows[0]?.normalized.endDate).toBe('2026-11-15')
    expect(rows[0]?.normalized.minutes).toBe(120) // 显式时长优先
  })

  it('显式时长优先于起止时刻', () => {
    const matrix = [
      ['工号', '开始日期', '开始时间', '结束时间', '外出时长'],
      ['E2E001', '2026-11-15', '09:00', '18:00', '4小时'],
    ]
    const { rows } = parseOutgoingMatrix(matrix)
    expect(rows[0]?.normalized.minutes).toBe(240)
  })

  it('跳过无日期行(说明/合计)', () => {
    const matrix = [
      ['工号', '开始日期', '结束日期'],
      ['E2E001', '2026-11-15', '2026-11-15'],
      ['合计', '', ''],
    ]
    const { rows } = parseOutgoingMatrix(matrix)
    expect(rows).toHaveLength(1)
  })

  it('表头无法识别时抛错', () => {
    expect(() => parseOutgoingMatrix([['列一', '列二'], ['a', 'b']])).toThrow()
  })
})
