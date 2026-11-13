// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:watermarked

import { describe, expect, it } from 'vitest'

import {
  normalizeDurationToMinutes,
  normalizeLeaveStatus,
  normalizeLeaveType,
  normalizeOvertimeType,
  parseLeaveMatrix,
  parseOvertimeMatrix,
} from '../hr-import-leave.js'

/**
 * 请假/加班导入解析层单测(HR-5 第 3 期)。
 * 只测纯函数,不碰数据库。
 */

describe('normalizeLeaveType 假别归一', () => {
  it('年假/病假/事假/婚假/产假', () => {
    expect(normalizeLeaveType('年假')).toBe('annual')
    expect(normalizeLeaveType('病假')).toBe('sick')
    expect(normalizeLeaveType('事假')).toBe('personal')
    expect(normalizeLeaveType('婚假')).toBe('marriage')
    expect(normalizeLeaveType('产假')).toBe('maternity')
  })
  it('调休/其他落入 other', () => {
    expect(normalizeLeaveType('调休')).toBe('other')
    expect(normalizeLeaveType('')).toBe('other')
    expect(normalizeLeaveType(null)).toBe('other')
  })
  it('英文写法', () => {
    expect(normalizeLeaveType('Annual Leave')).toBe('annual')
    expect(normalizeLeaveType('Sick')).toBe('sick')
  })
})

describe('normalizeLeaveStatus 审批状态归一', () => {
  it('已通过/审批中/已拒绝', () => {
    expect(normalizeLeaveStatus('已通过')).toBe('approved')
    expect(normalizeLeaveStatus('审批中')).toBe('pending')
    expect(normalizeLeaveStatus('已拒绝')).toBe('rejected')
    expect(normalizeLeaveStatus('驳回')).toBe('rejected')
  })
  it('空值默认 approved(导入视为既成事实)', () => {
    expect(normalizeLeaveStatus('')).toBe('approved')
    expect(normalizeLeaveStatus(null)).toBe('approved')
  })
})

describe('normalizeOvertimeType 加班类型归一', () => {
  it('工作日/休息日/法定节假日', () => {
    expect(normalizeOvertimeType('工作日')).toBe('workday')
    expect(normalizeOvertimeType('休息日')).toBe('weekend')
    expect(normalizeOvertimeType('法定节假日')).toBe('holiday')
    expect(normalizeOvertimeType(null)).toBe('workday')
  })
})

describe('normalizeDurationToMinutes 时长归一', () => {
  it('小时/分钟/冒号/纯数字', () => {
    expect(normalizeDurationToMinutes('3小时')).toBe(180)
    expect(normalizeDurationToMinutes('90分钟')).toBe(90)
    expect(normalizeDurationToMinutes('2:30')).toBe(150)
    expect(normalizeDurationToMinutes('2.5')).toBe(150) // 纯数字按小时
    expect(normalizeDurationToMinutes('4h')).toBe(240)
  })
  it('无法识别返回 null', () => {
    expect(normalizeDurationToMinutes('未填')).toBeNull()
    expect(normalizeDurationToMinutes(null)).toBeNull()
  })
})

describe('parseLeaveMatrix 请假表解析', () => {
  it('飞书风格表头 + 说明行自动定位', () => {
    const matrix = [
      ['某某公司请假明细'],
      ['导出时间:2026-11-12'],
      ['工号', '姓名', '假别', '开始日期', '结束日期', '请假天数', '请假事由', '审批状态'],
      ['E2E001', '张三', '年假', '2026-11-10', '2026-11-11', '2', '家中有事', '已通过'],
    ]
    const { rows } = parseLeaveMatrix(matrix)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.fields.employeeNo).toBe('E2E001')
    expect(rows[0]?.normalized.startDate).toBe('2026-11-10')
    expect(rows[0]?.normalized.endDate).toBe('2026-11-11')
    expect(rows[0]?.normalized.totalDays).toBe(2)
    expect(rows[0]?.normalized.leaveType).toBe('annual')
    expect(rows[0]?.normalized.status).toBe('approved')
  })

  it('缺天数时按起止日期推算(含首尾)', () => {
    const matrix = [
      ['工号', '开始日期', '结束日期'],
      ['E2E001', '2026-11-10', '2026-11-12'],
    ]
    const { rows } = parseLeaveMatrix(matrix)
    expect(rows[0]?.normalized.totalDays).toBe(3)
  })

  it('缺结束日期时按开始日期当天', () => {
    const matrix = [
      ['工号', '开始日期', '假别'],
      ['E2E001', '2026-11-10', '事假'],
    ]
    const { rows } = parseLeaveMatrix(matrix)
    expect(rows[0]?.normalized.endDate).toBe('2026-11-10')
    expect(rows[0]?.normalized.totalDays).toBe(1)
  })

  it('跳过无日期的说明行/合计行', () => {
    const matrix = [
      ['工号', '姓名', '开始日期', '结束日期'],
      ['E2E001', '张三', '2026-11-10', '2026-11-11'],
      ['合计', '', '', ''],
    ]
    const { rows } = parseLeaveMatrix(matrix)
    expect(rows).toHaveLength(1)
  })
})

describe('parseOvertimeMatrix 加班表解析', () => {
  it('飞书风格表头', () => {
    const matrix = [
      ['工号', '姓名', '加班日期', '加班时长', '加班类型', '加班事由', '审批单号'],
      ['E2E001', '张三', '2026-11-08', '3小时', '休息日', '版本上线', 'OT-001'],
    ]
    const { rows } = parseOvertimeMatrix(matrix)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.normalized.date).toBe('2026-11-08')
    expect(rows[0]?.normalized.minutes).toBe(180)
    expect(rows[0]?.normalized.overtimeType).toBe('weekend')
    expect(rows[0]?.fields.externalId).toBe('OT-001')
  })

  it('跳过无日期行', () => {
    const matrix = [
      ['工号', '加班日期', '加班时长'],
      ['E2E001', '2026-11-08', '2小时'],
      ['合计', '', ''],
    ]
    const { rows } = parseOvertimeMatrix(matrix)
    expect(rows).toHaveLength(1)
  })

  it('表头无法识别时抛错', () => {
    const matrix = [
      ['列一', '列二'],
      ['a', 'b'],
    ]
    expect(() => parseOvertimeMatrix(matrix)).toThrow()
  })
})
