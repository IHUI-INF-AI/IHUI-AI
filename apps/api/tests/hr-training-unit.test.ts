// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'

import {
  assertPlanOpen,
  dedupeEnrollments,
  enrollmentTransition,
  hoursToTenths,
  sumEnrolledHours,
  tenthsToHours,
} from '../src/services/hr-training.js'

/**
 * 培训纯核(2026-11-24 八波):学时换算(十分之一小时)、状态机、批量幂等去重、汇总。
 */
describe('学时换算', () => {
  it('0.5 小时粒度稳定往返', () => {
    expect(hoursToTenths('0.5')).toBe(5)
    expect(hoursToTenths(2)).toBe(20)
    expect(tenthsToHours(25)).toBe('2.5')
    expect(tenthsToHours(hoursToTenths('7.3'))).toBe('7.3')
  })

  it('负数/超限/非数字拒绝', () => {
    expect(() => hoursToTenths('-1')).toThrowError(/学时非法/)
    expect(() => hoursToTenths('abc')).toThrowError(/学时非法/)
    expect(() => hoursToTenths('10000')).toThrowError(/学时非法/)
  })
})

describe('enrollmentTransition 状态机', () => {
  it('enrolled→completed 带学时快照标记', () => {
    expect(enrollmentTransition({ status: 'enrolled' }, 'complete')).toEqual({
      status: 'completed',
      snapshotHours: true,
    })
  })

  it('completed 终态不可 drop(历史台账保真)', () => {
    expect(() => enrollmentTransition({ status: 'completed' }, 'drop')).toThrowError(/历史台账要保真/)
  })

  it('enrolled/dropped 可 drop(dropped 幂等)', () => {
    expect(enrollmentTransition({ status: 'enrolled' }, 'drop').status).toBe('dropped')
    expect(enrollmentTransition({ status: 'dropped' }, 'drop').status).toBe('dropped')
  })

  it('只有 dropped 可 reopen', () => {
    expect(enrollmentTransition({ status: 'dropped' }, 'reopen').status).toBe('enrolled')
    expect(() => enrollmentTransition({ status: 'enrolled' }, 'reopen')).toThrowError(/已放弃/)
  })

  it('非 enrolled 不可 complete', () => {
    expect(() => enrollmentTransition({ status: 'dropped' }, 'complete')).toThrowError(/不可完成/)
  })
})

describe('assertPlanOpen 报名闸', () => {
  it('只认 open;draft/closed 拒', () => {
    expect(() => assertPlanOpen('open')).not.toThrow()
    expect(() => assertPlanOpen('draft')).toThrowError(/不接受报名/)
    expect(() => assertPlanOpen('closed')).toThrowError(/不接受报名/)
  })
})

describe('dedupeEnrollments 批量幂等', () => {
  const a = { employeeId: 'E1', courseId: 'C1' }
  const b = { employeeId: 'E2', courseId: 'C1' }
  const dup = { employeeId: 'E1', courseId: 'C1' }

  it('库中已存在的点名跳过,批内重复只留第一条', () => {
    // 输入 [E1C1, E2C1(库中已有), E1C1(批内重复), E1C1(再次重复)]
    const r = dedupeEnrollments([a, b, dup, a], new Set(['E2|C1']))
    expect(Array.from(r)).toEqual([a])
    expect(r.skipped).toHaveLength(3)
    expect(r.skipped.filter((s) => s.includes('已是该课程学员'))).toHaveLength(1)
    expect(r.skipped.filter((s) => s.includes('本批内重复'))).toHaveLength(2)
  })

  it('全新批次无跳过', () => {
    const r = dedupeEnrollments([a, b], new Set())
    expect(r).toHaveLength(2)
    expect(r.skipped).toEqual([])
  })
})

describe('sumEnrolledHours 学时汇总(十分之一小时累加)', () => {
  it('null(未完成)不参与累计', () => {
    expect(sumEnrolledHours([{ hoursAtCompletion: '8.0' }, { hoursAtCompletion: null }, { hoursAtCompletion: '3.5' }])).toBe('11.5')
  })

  it('全空为 0.0(空台账如实回报)', () => {
    expect(sumEnrolledHours([{ hoursAtCompletion: null }])).toBe('0.0')
    expect(sumEnrolledHours([])).toBe('0.0')
  })

  it('0.1+0.2 类浮点在分口径下精确', () => {
    expect(sumEnrolledHours([{ hoursAtCompletion: '0.1' }, { hoursAtCompletion: '0.2' }])).toBe('0.3')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
