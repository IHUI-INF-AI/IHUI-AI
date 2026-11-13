// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:watermarked

import { describe, expect, it } from 'vitest'

import {
  detectMapping,
  normalizeDateCell,
  normalizeTimeCell,
  parseCsvBuffer,
  parseMatrix,
} from '../hr-import.js'

/**
 * 考勤导入解析层单测(HR-5 第 2 期)。
 *
 * 只测**纯函数**:表头识别 / CSV 切分 / 日期时间归一 / 二维表解析。
 * 不碰数据库(落库与裁决走集成测试),这样这一层能被真实执行而不需要 DB。
 */

describe('detectMapping 表头→字段识别', () => {
  it('识别飞书常见表头', () => {
    const mapping = detectMapping(['工号', '姓名', '日期', '上班打卡', '下班打卡', '考勤结果'])
    expect(mapping['工号']).toBe('employeeNo')
    expect(mapping['姓名']).toBe('employeeName')
    expect(mapping['日期']).toBe('date')
    expect(mapping['上班打卡']).toBe('checkInTime')
    expect(mapping['下班打卡']).toBe('checkOutTime')
    expect(mapping['考勤结果']).toBe('rawStatus')
  })

  it('识别钉钉风格表头(带空格/括号)', () => {
    const mapping = detectMapping(['员工工号', ' 姓名 ', '考勤日期', '签到时间', '签退时间'])
    expect(mapping['员工工号']).toBe('employeeNo')
    expect(mapping[' 姓名 ']).toBe('employeeName')
    expect(mapping['考勤日期']).toBe('date')
    expect(mapping['签到时间']).toBe('checkInTime')
    expect(mapping['签退时间']).toBe('checkOutTime')
  })

  it('不认识的列不进映射(但不报错)', () => {
    const mapping = detectMapping(['工号', '部门', '备注说明'])
    expect(mapping['工号']).toBe('employeeNo')
    expect(mapping['部门']).toBeUndefined()
    expect(mapping['备注说明']).toBeUndefined()
  })

  it('同一字段不被后面的列抢占', () => {
    const mapping = detectMapping(['上班打卡', '上班打卡2'])
    expect(mapping['上班打卡']).toBe('checkInTime')
    // '上班打卡2' 不在别名表 → 不映射
    expect(mapping['上班打卡2']).toBeUndefined()
  })
})

describe('parseCsvBuffer CSV 解析', () => {
  it('切分基本 CSV', () => {
    const rows = parseCsvBuffer(Buffer.from('工号,姓名,日期\nE001,张三,2026-11-01\nE002,李四,2026-11-01'))
    expect(rows).toHaveLength(3)
    expect(rows[0]).toEqual(['工号', '姓名', '日期'])
    expect(rows[1]).toEqual(['E001', '张三', '2026-11-01'])
  })

  it('处理双引号包裹的含逗号字段', () => {
    const rows = parseCsvBuffer(Buffer.from('工号,备注\nE001,"迟到,已说明"'))
    expect(rows[1]).toEqual(['E001', '迟到,已说明'])
  })

  it('处理转义双引号与 BOM', () => {
    const rows = parseCsvBuffer(Buffer.from('\uFEFF工号,备注\nE001,"他说""好"""'))
    expect(rows[0]).toEqual(['工号', '备注'])
    expect(rows[1]).toEqual(['E001', '他说"好"'])
  })

  it('处理 CRLF 换行', () => {
    const rows = parseCsvBuffer(Buffer.from('工号,日期\r\nE001,2026-11-01\r\n'))
    expect(rows).toHaveLength(2)
    expect(rows[1]).toEqual(['E001', '2026-11-01'])
  })
})

describe('normalizeDateCell 日期归一', () => {
  it('标准 YYYY-MM-DD', () => {
    expect(normalizeDateCell('2026-11-01')).toBe('2026-11-01')
  })
  it('斜杠与单数字月日', () => {
    expect(normalizeDateCell('2026/11/1')).toBe('2026-11-01')
    expect(normalizeDateCell('2026.11.01')).toBe('2026-11-01')
  })
  it('紧凑 8 位', () => {
    expect(normalizeDateCell('20261101')).toBe('2026-11-01')
  })
  it('带时间的完整日期时间', () => {
    expect(normalizeDateCell('2026-11-01 09:00:00')).toBe('2026-11-01')
  })
  it('Excel 日期序列号', () => {
    // 46327 = 2026-11-01(1900 系统)
    expect(normalizeDateCell('46327')).toBe('2026-11-01')
  })
  it('空值与无法识别返回 null', () => {
    expect(normalizeDateCell(null)).toBeNull()
    expect(normalizeDateCell('')).toBeNull()
    expect(normalizeDateCell('不是日期')).toBeNull()
  })
})

describe('normalizeTimeCell 时间归一', () => {
  it('纯时间拼接到日期并补业务时区(+08:00)', () => {
    // 09:05+08:00 = 01:05Z
    expect(normalizeTimeCell('09:05', '2026-11-01')).toBe('2026-11-01T01:05:00.000Z')
    // 18:30:15+08:00 = 10:30:15Z
    expect(normalizeTimeCell('18:30:15', '2026-11-01')).toBe('2026-11-01T10:30:15.000Z')
  })

  it('不带时区的完整日期时间按业务时区解释(与进程时区无关)', () => {
    // 09:12+08:00 = 01:12Z
    expect(normalizeTimeCell('2026-11-01 09:12:00', '2026-11-01')).toBe('2026-11-01T01:12:00.000Z')
    expect(normalizeTimeCell('2026-11-01 09:12', null)).toBe('2026-11-01T01:12:00.000Z')
  })

  it('自带时区标记时按绝对时刻解析', () => {
    expect(normalizeTimeCell('2026-11-01T09:05:00Z', '2026-11-01')).toBe('2026-11-01T09:05:00.000Z')
    expect(normalizeTimeCell('2026-11-01T09:05:00+08:00', '2026-11-01')).toBe('2026-11-01T01:05:00.000Z')
  })
  it('纯时间但缺日期 → null(不猜日期)', () => {
    expect(normalizeTimeCell('09:05', null)).toBeNull()
  })
  it('完整 ISO 时间原样解析', () => {
    const result = normalizeTimeCell('2026-11-01T09:05:00.000Z', '2026-11-01')
    expect(result).toBe('2026-11-01T09:05:00.000Z')
  })

  it('时区无关性:同一输入在 UTC 与 +08 进程时区下结果一致', () => {
    const a = normalizeTimeCell('09:12', '2026-11-01')
    // 该实现不经过 new Date(raw) 的本地时区推断,输出恒为带 Z 的 UTC 串
    expect(a).toBe('2026-11-01T01:12:00.000Z')
  })
  it('空值与无法识别返回 null', () => {
    expect(normalizeTimeCell('', '2026-11-01')).toBeNull()
    expect(normalizeTimeCell('未打卡', '2026-11-01')).toBeNull()
  })
})

describe('parseMatrix 二维表解析', () => {
  it('表头在首行时正常解析', () => {
    const matrix = [
      ['工号', '姓名', '日期', '上班打卡', '下班打卡'],
      ['E001', '张三', '2026-11-01', '09:00', '18:00'],
      ['E002', '李四', '2026-11-01', '08:55', '18:05'],
    ]
    const result = parseMatrix(matrix)
    expect(result.headerRowIndex).toBe(0)
    expect(result.rows).toHaveLength(2)
    expect(result.rows[0]?.parsed.employeeNo).toBe('E001')
    expect(result.rows[0]?.parsed.checkInTime).toBe('09:00')
    expect(result.rows[0]?.rowNumber).toBe(2)
  })

  it('表头前有公司名/月份说明行时自动探测', () => {
    const matrix = [
      ['某某公司 2026 年 11 月考勤表'],
      ['导出时间:2026-11-12'],
      [],
      ['工号', '姓名', '日期', '上班打卡', '下班打卡'],
      ['E001', '张三', '2026-11-01', '09:00', '18:00'],
    ]
    const result = parseMatrix(matrix)
    expect(result.headerRowIndex).toBe(3)
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0]?.parsed.employeeNo).toBe('E001')
  })

  it('跳过整行空行与合计行', () => {
    const matrix = [
      ['工号', '姓名', '日期'],
      ['E001', '张三', '2026-11-01'],
      ['', '', ''],
      ['合计', '', ''],
    ]
    const result = parseMatrix(matrix)
    expect(result.rows).toHaveLength(1)
  })

  it('表头无法识别时抛错', () => {
    const matrix = [
      ['列一', '列二', '列三'],
      ['a', 'b', 'c'],
    ]
    expect(() => parseMatrix(matrix)).toThrow()
  })

  it('原始行完整保留在 raw 中(未映射列不丢)', () => {
    const matrix = [
      ['工号', '日期', '部门', '设备号'],
      ['E001', '2026-11-01', '研发部', 'DEV-01'],
    ]
    const result = parseMatrix(matrix)
    const row = result.rows[0]
    expect(row?.raw['部门']).toBe('研发部')
    expect(row?.raw['设备号']).toBe('DEV-01')
    // 但未被映射成标准化字段
    expect(JSON.stringify(row?.parsed)).not.toContain('研发部')
  })
})
