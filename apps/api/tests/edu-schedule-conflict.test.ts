// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 排课冲突检测测试(2026-09-29)。
 * 全程纯函数、不连库(§5 测试隔离铁律)。
 */
import { describe, expect, it, vi } from 'vitest'

vi.mock('../src/db/index.js', () => ({ db: {} }))

import { __test__ } from '../src/services/edu-schedule-conflict.js'
import type { SchedItem } from '../src/services/edu-schedule-conflict.js'

const { findScheduleConflicts, normalizeHm } = __test__

const row = (over: Partial<SchedItem>): SchedItem => ({
  weekday: 1,
  startTime: '09:00',
  endTime: '10:00',
  teacher: 'T1',
  classroom: 'R1',
  courseName: 'A',
  ...over,
})

describe('时间规范化', () => {
  it('补零归一;不合规一律 null,不猜', () => {
    expect(normalizeHm('9:00')).toBe('09:00')
    expect(normalizeHm(' 14:05 ')).toBe('14:05')
    expect(normalizeHm('9:5')).toBeNull()
    expect(normalizeHm('24:00')).toBeNull()
    expect(normalizeHm('09:60')).toBeNull()
    expect(normalizeHm('上午9点')).toBeNull()
    expect(normalizeHm(null)).toBeNull()
  })
})

describe('冲突判定', () => {
  it('同星期、真重叠、同教师 ⇒ 教师冲突', () => {
    const r = findScheduleConflicts([row({ courseName: 'A' }), row({ courseName: 'B' })])
    expect(r.malformedTimes).toBe(0)
    expect(r.conflicts.some((c) => c.includes('教师时间冲突'))).toBe(true)
  })

  it('边界相接不算冲突(10:00-11:00 与 11:00-12:00)', () => {
    const r = findScheduleConflicts([
      row({ startTime: '10:00', endTime: '11:00' }),
      row({ startTime: '11:00', endTime: '12:00', courseName: 'B' }),
    ])
    expect(r.conflicts).toEqual([])
  })

  it('不同星期不算冲突', () => {
    const r = findScheduleConflicts([row({ weekday: 1 }), row({ weekday: 2, courseName: 'B' })])
    expect(r.conflicts).toEqual([])
  })

  /**
   * 这条就是抽出这段逻辑时要钉的那个缺陷:旧实现比字符串,`'9:00' > '10:00'`,
   * 于是"9:00-10:00"与"09:30-11:00"这种明显重叠会被判成不冲突 —— 页面绿、老师被双订。
   */
  it('非补零的 9:00 也要正确判重叠(旧实现在这里漏报)', () => {
    const r = findScheduleConflicts([
      row({ startTime: '9:00', endTime: '10:00' }),
      row({ startTime: '09:30', endTime: '11:00', courseName: 'B' }),
    ])
    expect(r.conflicts.length).toBeGreaterThan(0)
    expect(r.conflicts[0]).toContain('教师时间冲突')
  })

  it('教师冲突与教室冲突各计一条(两维都撞)', () => {
    const r = findScheduleConflicts([row({}), row({ courseName: 'B' })])
    expect(r.conflicts.filter((c) => c.includes('教师')).length).toBe(1)
    expect(r.conflicts.filter((c) => c.includes('教室')).length).toBe(1)
  })

  it('teacher/classroom 为空的行不得凭空成对(空值不等于同名)', () => {
    const r = findScheduleConflicts([
      row({ teacher: null, classroom: null }),
      row({ teacher: null, classroom: null, courseName: 'B' }),
    ])
    expect(r.conflicts).toEqual([])
  })

  it('非法时间被排除出检测但必须计数,绝不静默少报', () => {
    const r = findScheduleConflicts([
      row({ startTime: '09:00', endTime: '10:00' }),
      row({ startTime: '上午9点', endTime: '10:30', courseName: 'B' }),
    ])
    expect(r.malformedTimes).toBe(1)
    expect(r.conflicts).toEqual([])
  })

  it('三行连环重叠能全配对(不只看相邻两两)', () => {
    const r = findScheduleConflicts([
      row({ courseName: 'A' }),
      row({ courseName: 'B', startTime: '09:30', endTime: '10:30' }),
      row({ courseName: 'C', startTime: '09:45', endTime: '09:50' }),
    ])
    expect(r.conflicts.filter((c) => c.includes('教师')).length).toBe(3)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
