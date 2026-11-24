// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'

import { activeAt, validateGrant } from '../src/services/hr-grade.js'

/**
 * 职级时间线纯核(2026-11-24 六波)。钉:"某日是什么级"可回放、同日双轨拒绝。
 */
describe('activeAt 时间线回放', () => {
  const history = [
    { gradeId: 'g1', gradeCode: 'P4', effectiveFrom: '2024-01-01', endedAt: null },
    { gradeId: 'g2', gradeCode: 'P5', effectiveFrom: '2025-04-01', endedAt: new Date('2025-11-30T10:00:00Z') },
    { gradeId: 'g3', gradeCode: 'P6', effectiveFrom: '2025-12-01', endedAt: null },
  ]
  // 注意:传参按 effectiveFrom 升序约定(服务函数不排序,路由/DB 保证)
  const sorted = [...history].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom))

  it('新入职日命中第一条', () => {
    expect(activeAt(sorted, '2024-06-01')?.gradeCode).toBe('P4')
  })

  it('升 P5 当天即新级(生效日含当日)', () => {
    expect(activeAt(sorted, '2025-04-01')?.gradeCode).toBe('P5')
  })

  it('闭旧日当天仍算在任(按天含端点),次日命中后继', () => {
    expect(activeAt(sorted, '2025-11-30')?.gradeCode).toBe('P5')
    expect(activeAt(sorted, '2025-12-01')?.gradeCode).toBe('P6')
  })

  it('早于全部记录返回 null(不拿未来职级冒充过去)', () => {
    expect(activeAt(sorted, '2023-12-31')).toBeNull()
  })

  it('无生效记录空史表返回 null', () => {
    expect(activeAt([], '2025-01-01')).toBeNull()
  })
})

describe('validateGrant 同日双轨拒绝', () => {
  it('无开放记录直接放行(首授)', () => {
    expect(() => validateGrant(null, '2026-01-01')).not.toThrow()
  })

  it('新生效日晚于当前记录 ⇒ 放行(正常晋升)', () => {
    expect(() => validateGrant({ effectiveFrom: '2025-12-01' }, '2026-01-15')).not.toThrow()
  })

  it('同日双轨拒绝', () => {
    expect(() => validateGrant({ effectiveFrom: '2026-01-15' }, '2026-01-15')).toThrowError(/同日双轨/)
  })

  it('早于当前记录拒绝(不许向历史插队)', () => {
    expect(() => validateGrant({ effectiveFrom: '2026-01-15' }, '2025-06-01')).toThrowError(/必须晚于/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
