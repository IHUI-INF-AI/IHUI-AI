// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'

import {
  buildExpenseApproverChain,
  excludeSelfFromPool,
  sortCandidatesFinanceFirst,
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

/**
 * 2026-11-24 真库验证暴露的两处缺口,已前移为纯核并在此钉死:
 * ⑥ 候选池展示顺序必须与默认链同序(否则默认选中的人排在末尾);
 * ⑦ 反自批要发生在候选池(否则页面上"自己"可点、提交后才 400)。
 */
describe('sortCandidatesFinanceFirst 候选池展示顺序', () => {
  it('财务权限者排前,管理员在后', () => {
    const list = [cand('A', 'admin'), cand('B', 'finance'), cand('C', 'admin')]
    expect(sortCandidatesFinanceFirst(list).map((c) => c.userId)).toEqual(['B', 'A', 'C'])
  })

  it('同级保持库返回顺序(稳定),不改入参', () => {
    const list = [cand('A', 'admin'), cand('B', 'finance'), cand('C', 'finance')]
    const snapshot = list.map((c) => c.userId)
    const out = sortCandidatesFinanceFirst(list)
    expect(out.map((c) => c.userId)).toEqual(['B', 'C', 'A'])
    expect(list.map((c) => c.userId)).toEqual(snapshot)
  })

  it('排序后接默认链,首人即页面默认选中人', () => {
    const list = sortCandidatesFinanceFirst([
      cand('admin-1', 'admin'),
      cand('fin-1', 'finance'),
      cand('admin-2', 'admin'),
    ])
    const chain = buildExpenseApproverChain(list, null, 1)
    expect(chain.userIds).toEqual(['fin-1'])
  })
})

describe('excludeSelfFromPool 反自批前移', () => {
  it('本人进池 ⇒ 从池里剔掉并留 self-excluded 码', () => {
    const rows = [{ id: 'me' }, { id: 'A' }]
    const r = excludeSelfFromPool(rows, 'me')
    expect(r.pool.map((x) => x.id)).toEqual(['A'])
    expect(r.warnings).toEqual(['self-excluded'])
  })

  it('本人不在池里 ⇒ 不记码,池原样返回', () => {
    const r = excludeSelfFromPool([{ id: 'A' }, { id: 'B' }], 'me')
    expect(r.pool.map((x) => x.id)).toEqual(['A', 'B'])
    expect(r.warnings).toEqual([])
  })

  it('selfUserId 为空(系统调用)⇒ 不剔任何人、不记码', () => {
    const r = excludeSelfFromPool([{ id: 'A' }], null)
    expect(r.pool.map((x) => x.id)).toEqual(['A'])
    expect(r.warnings).toEqual([])
  })

  it('池里只有本人 ⇒ 空池 + self-excluded(交给调用方补 no-approver)', () => {
    const r = excludeSelfFromPool([{ id: 'me' }], 'me')
    expect(r.pool).toEqual([])
    expect(r.warnings).toEqual(['self-excluded'])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
