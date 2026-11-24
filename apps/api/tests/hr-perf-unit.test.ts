// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'

import {
  assertCycleCloseable,
  gradeFromScore,
  reviewTransition,
} from '../src/services/hr-perf.js'

/**
 * 绩效纯核(2026-11-24 七波):状态机身份闸、定级换算、周期 close 硬闸。
 */
const asPending = { status: 'pending', employeeId: 'E1', reviewerId: 'U9' }

describe('reviewTransition 状态机', () => {
  it('自评必须本人,他人代提 403', () => {
    expect(() =>
      reviewTransition(asPending, { kind: 'employee', employeeId: 'E2' }, 'self_submit'),
    ).toThrowError(/只能员工本人/)
    expect(reviewTransition(asPending, { kind: 'employee', employeeId: 'E1' }, 'self_submit').status).toBe('self_done')
  })

  it('评分必须是指派上级;非终态才能评', () => {
    expect(() =>
      reviewTransition({ ...asPending, status: 'self_done' }, { kind: 'manager', userId: 'U8' }, 'manager_score'),
    ).toThrowError(/只有指派的上级/)
    const r = reviewTransition({ ...asPending, status: 'self_done' }, { kind: 'manager', userId: 'U9' }, 'manager_score')
    expect(r).toMatchObject({ status: 'reviewed', lockFinal: true })
  })

  it('pending 未自评不可直接上级评分(不许跳过员工)', () => {
    expect(() =>
      reviewTransition(asPending, { kind: 'manager', userId: 'U9' }, 'manager_score'),
    ).toThrowError(/不可评分/)
  })

  it('确认/申诉只能本人,且仅 reviewed 可用', () => {
    expect(() =>
      reviewTransition({ ...asPending, status: 'reviewed' }, { kind: 'employee', employeeId: 'E2' }, 'confirm'),
    ).toThrowError(/只能员工本人/)
    expect(reviewTransition({ ...asPending, status: 'reviewed' }, { kind: 'employee', employeeId: 'E1' }, 'confirm').status).toBe('confirmed')
    expect(reviewTransition({ ...asPending, status: 'reviewed' }, { kind: 'employee', employeeId: 'E1' }, 'refuse').status).toBe('refused')
    expect(() =>
      reviewTransition({ ...asPending, status: 'confirmed' }, { kind: 'employee', employeeId: 'E1' }, 'refuse'),
    ).toThrowError(/仅已评分单/)
  })

  it('refused 后上级重评 rounds+1(轮次留痕)', () => {
    const r = reviewTransition({ ...asPending, status: 'refused' }, { kind: 'manager', userId: 'U9' }, 'manager_score')
    expect(r).toMatchObject({ status: 'reviewed', roundsDelta: 1 })
  })

  it('终态 confirmed 不再接受任何流转(自评/评分/确认全拒)', () => {
    for (const act of ['self_submit', 'manager_score', 'confirm'] as const) {
      expect(() =>
        reviewTransition({ ...asPending, status: 'confirmed' }, { kind: 'admin', userId: 'U0', employeeId: 'E1' }, act),
      ).toThrow()
    }
  })
})

describe('gradeFromScore 定级换算', () => {
  it('默认表:90→S 85→A 75→B 65→C 55→D', () => {
    expect(gradeFromScore(90)).toBe('S')
    expect(gradeFromScore(85)).toBe('A')
    expect(gradeFromScore(75)).toBe('B')
    expect(gradeFromScore(65)).toBe('C')
    expect(gradeFromScore(55)).toBe('D')
    expect(gradeFromScore(0)).toBe('D')
  })

  it('自定义阈值表(乱序传入也可)', () => {
    const tab = [
      { min: 85, grade: 'A' },
      { min: 95, grade: 'S' },
      { min: 0, grade: 'B' },
    ]
    expect(gradeFromScore(96, tab)).toBe('S')
    expect(gradeFromScore(90, tab)).toBe('A')
    expect(gradeFromScore(84, tab)).toBe('B')
  })

  it('越界分数与非整数拒绝', () => {
    expect(() => gradeFromScore(101)).toThrowError(/0~100/)
    expect(() => gradeFromScore(72.5)).toThrowError(/0~100/)
  })

  it('阈值表有缺口时拒绝定级(不静默无级)', () => {
    expect(() => gradeFromScore(10, [{ min: 50, grade: 'A' }])).toThrowError(/未覆盖/)
  })
})

describe('assertCycleCloseable close 硬闸', () => {
  it('全部 confirmed 才放行', () => {
    expect(() =>
      assertCycleCloseable([{ status: 'confirmed' }, { status: 'confirmed' }], 'C1'),
    ).not.toThrow()
  })

  it('任一未完成单 ⇒ 拒绝并点名数量(不存在 force close 形态)', () => {
    expect(() =>
      assertCycleCloseable([{ status: 'confirmed' }, { status: 'reviewed' }, { status: 'pending' }], 'C1'),
    ).toThrowError(/2 张未确认/)
  })

  it('零单周期可以 close(空真)', () => {
    expect(() => assertCycleCloseable([], 'C1')).not.toThrow()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
