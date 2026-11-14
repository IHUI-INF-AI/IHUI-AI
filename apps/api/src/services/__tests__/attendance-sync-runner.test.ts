// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

import { describe, expect, it } from 'vitest'

import { buildSyncCsv } from '../attendance-sync/sync-runner.js'
import type { SyncRow } from '../attendance-sync/types.js'
import { monthRangeToYmdInt } from '../attendance-sync/feishu-provider.js'
import { monthSlices } from '../attendance-sync/dingtalk-provider.js'
import { parseMatrix } from '../hr-import.js'
import { parseLeaveMatrix } from '../hr-import-leave.js'

/**
 * 同步器命门单测:buildSyncCsv 的标准表头必须被现有 parse* 识别,
 * 且 SyncRow 值正确落到 parsed 字段。
 *
 * 这是「零复制复用判重/conflict 逻辑」成立的前提 —— 若表头对不齐别名表,
 * 同步行会被 parse* 丢弃,同步器产不出暂存行。只测纯函数,不碰数据库。
 */

function csvToMatrix(csv: string): string[][] {
  return csv.split('\n').map((line) => {
    // 简易 CSV 解析(仅覆盖本测试用的无引号/双引号单元)
    const cells: string[] = []
    let cur = ''
    let inQuote = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (inQuote) {
        if (ch === '"' && line[i + 1] === '"') {
          cur += '"'
          i++
        } else if (ch === '"') {
          inQuote = false
        } else {
          cur += ch
        }
      } else if (ch === '"') {
        inQuote = true
      } else if (ch === ',') {
        cells.push(cur)
        cur = ''
      } else {
        cur += ch
      }
    }
    cells.push(cur)
    return cells
  })
}

describe('buildSyncCsv → 现有 parse* 复用命门', () => {
  it('打卡:标准表头被 parseMatrix 识别,值落到 parsed', () => {
    const rows: SyncRow[] = [
      {
        employeeNo: 'E001',
        employeeName: '张三',
        date: '2026-11-12',
        startDate: null,
        endDate: null,
        checkInTime: '09:00',
        checkOutTime: '18:30',
        typeText: null,
        durationText: null,
        totalDays: null,
        destination: null,
        reason: null,
        statusText: '正常',
        externalId: null,
      },
    ]
    const csv = buildSyncCsv('attendance', rows)
    const { rows: parsed } = parseMatrix(csvToMatrix(csv))

    expect(parsed).toHaveLength(1)
    const p = parsed[0]!
    expect(p.parsed.employeeNo).toBe('E001')
    expect(p.parsed.employeeName).toBe('张三')
    expect(p.parsed.date).toBe('2026-11-12')
    expect(p.parsed.checkInTime).toBe('09:00')
    expect(p.parsed.checkOutTime).toBe('18:30')
    expect(p.parsed.rawStatus).toBe('正常')
  })

  it('请假:标准表头被 parseLeaveMatrix 识别,假别/起止/天数正确', () => {
    const rows: SyncRow[] = [
      {
        employeeNo: 'E002',
        employeeName: '李四',
        date: null,
        startDate: '2026-11-10',
        endDate: '2026-11-12',
        checkInTime: null,
        checkOutTime: null,
        typeText: '年假',
        durationText: null,
        totalDays: '3',
        destination: null,
        reason: '家中有事',
        statusText: '已通过',
        externalId: 'FS-1001',
      },
    ]
    const csv = buildSyncCsv('leave', rows)
    const { rows: parsed } = parseLeaveMatrix(csvToMatrix(csv))

    expect(parsed).toHaveLength(1)
    const l = parsed[0]!
    expect(l.fields.employeeNo).toBe('E002')
    expect(l.normalized.startDate).toBe('2026-11-10')
    expect(l.normalized.endDate).toBe('2026-11-12')
    expect(l.normalized.totalDays).toBe(3)
    expect(l.normalized.leaveType).toBe('annual')
    expect(l.fields.externalId).toBe('FS-1001')
  })

  it('CSV 转义:含逗号的事由被正确引号包裹并可解析回原值', () => {
    const rows: SyncRow[] = [
      {
        employeeNo: 'E003',
        employeeName: '王五',
        date: null,
        startDate: '2026-11-11',
        endDate: '2026-11-11',
        checkInTime: null,
        checkOutTime: null,
        typeText: '事假',
        durationText: null,
        totalDays: '1',
        destination: null,
        reason: '看病,复查',
        statusText: '已通过',
        externalId: null,
      },
    ]
    const csv = buildSyncCsv('leave', rows)
    // 原始 CSV 里该单元应带引号
    expect(csv).toContain('"看病,复查"')
    const { rows: parsed } = parseLeaveMatrix(csvToMatrix(csv))
    const e = parsed[0]!
    expect(e.fields.reason).toBe('看病,复查')
  })
})

describe('provider 月份窗口切片', () => {
  it('飞书 monthRangeToYmdInt:整月 yyyyMMdd,含当月最后一天(闰年)', () => {
    expect(monthRangeToYmdInt('2024-02')).toEqual({ from: 20240201, to: 20240229 })
    expect(monthRangeToYmdInt('2026-02')).toEqual({ from: 20260201, to: 20260228 })
    expect(monthRangeToYmdInt('2026-12')).toEqual({ from: 20261201, to: 20261231 })
  })

  it('钉钉 monthSlices:每片 ≤7 天,覆盖整月且不重叠', () => {
    const slices = monthSlices('2026-02')
    expect(slices.length).toBe(4)
    // 每片跨度(from→to)≤7 天
    for (const s of slices) {
      const fromDay = Number(s.from.slice(8, 10))
      const toDay = Number(s.to.slice(8, 10))
      expect(toDay - fromDay).toBeLessThanOrEqual(6)
    }
    // 首片从 1 号起,末片覆盖到当月最后一天
    expect(slices[0]!.from.startsWith('2026-02-01')).toBe(true)
    expect(slices[slices.length - 1]!.to.startsWith('2026-02-28')).toBe(true)
  })

  it('钉钉 monthSlices:31 天大月切片连续、无遗漏', () => {
    const slices = monthSlices('2026-01')
    expect(slices.length).toBe(5)
    // 第二片应紧接首片(1+7=8 号)
    expect(slices[1]!.from.startsWith('2026-01-08')).toBe(true)
    expect(slices[slices.length - 1]!.to.startsWith('2026-01-31')).toBe(true)
  })
})
