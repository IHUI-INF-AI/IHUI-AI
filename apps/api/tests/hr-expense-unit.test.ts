// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'

import { buildExpenseVoucherLines, decideNext } from '../src/services/hr-expense.js'

/**
 * 报销闭环纯核(2026-11-24 四波)。
 * 钉死四条纪律:① 只有当前步审批人能动;② 链尽头才 approved;
 * ③ reject 即终态;④ 入账分录借贷恒等、科目随付款方式。
 */
describe('decideNext 报销审批状态机', () => {
  const chain = { approverChain: ['A', 'B', 'C'], currentStep: 0, status: 'submitted' }

  it('当前步审批人通过则推进,链尽头才落 approved', () => {
    const s1 = decideNext(chain, 'A', 'approve')
    expect(s1).toMatchObject({ status: 'submitted', currentStep: 1, nextApprover: 'B' })
    const s2 = decideNext({ ...chain, currentStep: 1 }, 'B', 'approve')
    expect(s2.nextApprover).toBe('C')
    const s3 = decideNext({ ...chain, currentStep: 2 }, 'C', 'approve')
    expect(s3).toMatchObject({ status: 'approved', finished: true, nextApprover: null })
  })

  it('非当前步审批人一律 403(跳步审批是审批流最经典的洞)', () => {
    expect(() => decideNext(chain, 'B', 'approve')).toThrowError(/不是当前步审批人/)
    expect(() => decideNext(chain, 'C', 'reject')).toThrowError(/不是当前步审批人/)
  })

  it('reject 任何一步立即终态', () => {
    const r = decideNext({ ...chain, currentStep: 1 }, 'B', 'reject')
    expect(r).toMatchObject({ status: 'rejected', finished: true })
  })

  it('已审完/已驳回的单不可再审', () => {
    expect(() => decideNext({ ...chain, status: 'paid' }, 'A', 'approve')).toThrowError(/不可再审批/)
    expect(() => decideNext({ ...chain, status: 'rejected' }, 'A', 'approve')).toThrowError(/不可再审批/)
  })
})

describe('buildExpenseVoucherLines 入账分录', () => {
  it('银行付款:借费用科目、贷 1002,分口径借贷恒等', () => {
    const lines = buildExpenseVoucherLines({ amount: '1234.56', paymentMethod: 'bank' }, '5502')
    expect(lines).toHaveLength(2)
    expect(lines[0]).toMatchObject({ accountCode: '5502', direction: 'debit', amount: '1234.56' })
    expect(lines[1]).toMatchObject({ accountCode: '1002', direction: 'credit' })
    const d = lines.filter((l) => l.direction === 'debit').reduce((s, l) => s + Number(l.amount), 0)
    const c = lines.filter((l) => l.direction === 'credit').reduce((s, l) => s + Number(l.amount), 0)
    expect(d).toBe(c)
  })

  it('现金付款贷 1001', () => {
    const lines = buildExpenseVoucherLines({ amount: '80.00', paymentMethod: 'cash' }, '5502')
    expect(lines[1].accountCode).toBe('1001')
  })

  it('金额为 0 拒入账,不造空凭证', () => {
    expect(() => buildExpenseVoucherLines({ amount: '0.00', paymentMethod: 'bank' }, '5502')).toThrowError(
      /报销金额为 0/,
    )
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
