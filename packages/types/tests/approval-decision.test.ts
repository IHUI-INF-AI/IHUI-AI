// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 统一审批决策出口:四态归一 + 两端映射反向用例。
 * 关键锁:无应答/未判定/畸形一律不默认允许 —— 这是 Codex execpolicy 与
 * IHUI danger-gate 共同的 fail-closed 底线。
 */
import { describe, expect, it } from 'vitest'
import {
  decisionsAgree,
  fromDangerGateRoute,
  fromManagedSolveState,
  isDecisionAllowing,
  normalizeDecisionState,
  type UnifiedApprovalDecision,
} from '../src/approval-decision'

const decision = (
  requestId: string,
  source: UnifiedApprovalDecision['source'],
  state: UnifiedApprovalDecision['state'],
): UnifiedApprovalDecision => ({
  requestId,
  source,
  state,
  reason: 'test',
  decidedAt: '2026-11-24T00:00:00.000Z',
})

describe('归一判据 fail-closed', () => {
  it('四态原样保留', () => {
    for (const s of ['allowed', 'denied', 'undetermined', 'unmanaged'] as const) {
      expect(normalizeDecisionState(s)).toBe(s)
    }
  })

  it('畸形/未知/空值一律 undetermined,绝不冒充 allowed', () => {
    for (const raw of [null, undefined, 'granted', 'ALLOWED', 1, {}, [], '', 'allowed ']) {
      expect(normalizeDecisionState(raw)).toBe('undetermined')
    }
  })

  it('只有显式 allowed 才放行', () => {
    expect(isDecisionAllowing(decision('r', 'cli-danger-gate', 'allowed'))).toBe(true)
    for (const s of ['denied', 'undetermined', 'unmanaged'] as const) {
      expect(isDecisionAllowing(decision('r', 'cli-danger-gate', s))).toBe(false)
    }
    expect(isDecisionAllowing(null)).toBe(false)
    expect(isDecisionAllowing(undefined)).toBe(false)
  })
})

describe('CLI danger-gate route 映射', () => {
  it('flag/approved 允许,denied 拒绝', () => {
    expect(fromDangerGateRoute('flag')).toBe('allowed')
    expect(fromDangerGateRoute('approved')).toBe('allowed')
    expect(fromDangerGateRoute('denied')).toBe('denied')
  })

  it('无应答(undefined/null)与未知 route ⇒ undetermined,不默认允许', () => {
    for (const raw of [undefined, null, '', 'yes', 'granted', 'APPROVED', 1]) {
      expect(fromDangerGateRoute(raw)).toBe('undetermined')
      expect(isDecisionAllowing(decision('r', 'cli-danger-gate', fromDangerGateRoute(raw)))).toBe(false)
    }
  })
})

describe('ai-service managed permissions 映射', () => {
  it('solved 允许,unsatisfiable 拒绝,unmanaged 不介入(非允许)', () => {
    expect(fromManagedSolveState('solved')).toBe('allowed')
    expect(fromManagedSolveState('unsatisfiable')).toBe('denied')
    expect(fromManagedSolveState('unmanaged')).toBe('unmanaged')
    expect(isDecisionAllowing(decision('r', 'ai-service-managed-permissions', fromManagedSolveState('unmanaged')))).toBe(false)
  })

  it('undetermined 与未知态 ⇒ undetermined,不默认允许', () => {
    for (const raw of [undefined, null, 'undetermined', 'solved-ish', 'SOLVED', 1]) {
      expect(fromManagedSolveState(raw)).toBe('undetermined')
    }
  })
})

describe('两端对账', () => {
  it('同请求双允许 ⇒ 一致', () => {
    expect(
      decisionsAgree(
        decision('r1', 'cli-danger-gate', 'allowed'),
        decision('r1', 'ai-service-managed-permissions', 'allowed'),
      ),
    ).toBe(true)
  })

  it('不同请求 id ⇒ 不一致', () => {
    expect(
      decisionsAgree(
        decision('r1', 'cli-danger-gate', 'allowed'),
        decision('r2', 'ai-service-managed-permissions', 'allowed'),
      ),
    ).toBe(false)
  })

  it('一端非允许 ⇒ 不一致(拒绝不会被另一端 allowed 覆盖)', () => {
    for (const s of ['denied', 'undetermined', 'unmanaged'] as const) {
      expect(
        decisionsAgree(
          decision('r1', 'cli-danger-gate', s),
          decision('r1', 'ai-service-managed-permissions', 'allowed'),
        ),
      ).toBe(false)
    }
  })

  it('缺任一端 ⇒ 不一致(没有单方放行)', () => {
    expect(decisionsAgree(null, decision('r1', 'cli-danger-gate', 'allowed'))).toBe(false)
    expect(decisionsAgree(decision('r1', 'cli-danger-gate', 'allowed'), undefined)).toBe(false)
  })

  it('双方都拒绝(统一后同为 denied)⇒ 一致', () => {
    expect(
      decisionsAgree(
        decision('r1', 'cli-danger-gate', fromDangerGateRoute('denied')),
        decision('r1', 'ai-service-managed-permissions', fromManagedSolveState('unsatisfiable')),
      ),
    ).toBe(true)
  })
})
