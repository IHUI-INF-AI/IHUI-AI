// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'

import {
  buildExpenseApproverChain,
  type ExpenseApproverCandidate,
} from '../src/services/hr-expense-approvers.js'

/**
 * 报销审批链纯核(2026-11-24 十一波)。
 * 钉死五条:① 财务权限者优先、管理员兜底;② 排除提交人自己(反自批);
 * ③ 同一人去重;④ 空池给机器码而不是静默造空链;⑤ 上限截断但至少 1 人。
 */
function cand(
  userId: string,
  source: 'finance' | 'admin',
  name = `name-${userId}`,
): ExpenseApproverCandidate {
  return { userId, name, source }
}

describe('buildExpenseApproverChain 报销审批链', () => {
  it('财务权限者优先,管理员兜底', () => {
    const r = buildExpenseApproverChain([cand('A', 'admin'), cand('B', 'finance')], null, 1)
    expect(r.userIds).toEqual(['B'])
    expect(r.warnings).toEqual([])
  })

  it('排除提交人自己,并留 self-excluded 码', () => {
    const r = buildExpenseApproverChain([cand('A', 'finance'), cand('B', 'finance')], 'A', 1)
    expect(r.userIds).toEqual(['B'])
    expect(r.warnings).toContain('self-excluded')
  })

  it('同一人持多权限只出现一次(去重)', () => {
    const r = buildExpenseApproverChain(
      [cand('A', 'finance'), cand('A', 'finance'), cand('B', 'finance')],
      null,
      8,
    )
    expect(r.userIds).toEqual(['A', 'B'])
  })

  it('空池 → 空链 + no-approver(不静默降级)', () => {
    const r = buildExpenseApproverChain([], null, 8)
    expect(r.userIds).toEqual([])
    expect(r.warnings).toContain('no-approver')
  })

  it('只有提交人自己 → 空链,并同时给两枚警告码', () => {
    const r = buildExpenseApproverChain([cand('A', 'finance')], 'A', 8)
    expect(r.userIds).toEqual([])
    expect(r.warnings).toContain('self-excluded')
    expect(r.warnings).toContain('no-approver')
  })

  it('上限截断:max=2 时只留前两人,顺序按财务优先', () => {
    const r = buildExpenseApproverChain(
      [cand('A', 'admin'), cand('B', 'finance'), cand('C', 'finance')],
      null,
      2,
    )
    expect(r.userIds).toEqual(['B', 'C'])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
