// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 权益活动领取判据的行为锁(2026-11-18 立)。
 *
 * 钉住四件事:
 *   W1 未实证拒发起  端点没取证 ⇒ refused,actions 必须为空(一枚都不拨)。
 *   W2 状态不猜      认不出的状态 ⇒ skip 且带原因,绝不默认成"可领"。
 *   W3 两步流程      pro_upgrade 必须 eligibility_then_claim;credits 单步。
 *   W4 幂等          replayed 归一成"已领成功",不是失败(否则会无限重试)。
 */
import { describe, it, expect } from 'vitest'
import {
  planWelfareClaim,
  normalizeWelfareKind,
  normalizeWelfareState,
  normalizeClaimOutcome,
  WELFARE_KINDS,
  WELFARE_STATES,
} from '../src/services/relay-welfare-claim.js'

describe('relay-welfare-claim', () => {
  it('W1 未实证 ⇒ refused 且 actions 为空', () => {
    const plan = planWelfareClaim({
      campaigns: [{ id: 'c1', kind: 'credits', state: 'CLAIMABLE' }],
      providerVerified: false,
    })
    expect(plan.refused).toBe(true)
    expect(plan.actions).toEqual([])
    expect(plan.refusal?.code).toBe('endpoint-unverified')
    expect(plan.refusal?.reason).toContain('§0.3')
  })

  it('W1b 无活动 ⇒ refused(code=no-campaigns),不是"领了 0 个"', () => {
    const plan = planWelfareClaim({ campaigns: [], providerVerified: true })
    expect(plan.refused).toBe(true)
    expect(plan.refusal?.code).toBe('no-campaigns')
  })

  it('W3 credits 可领 ⇒ 单步 claim', () => {
    const plan = planWelfareClaim({
      campaigns: [{ id: 'c1', kind: 'credits', state: 'claimable' }],
      providerVerified: true,
    })
    expect(plan.refused).toBe(false)
    expect(plan.actions).toHaveLength(1)
    const a = plan.actions[0]
    expect(a.action).toBe('claim')
    if (a.action !== 'claim') return
    expect(a.step).toBe('claim')
  })

  it('W3b pro_upgrade 可领 ⇒ 两步 eligibility_then_claim', () => {
    const plan = planWelfareClaim({
      campaigns: [{ id: 'c2', kind: 'pro_upgrade', state: 'CLAIMABLE' }],
      providerVerified: true,
    })
    const a = plan.actions[0]
    expect(a.action).toBe('claim')
    if (a.action !== 'claim') return
    expect(a.step).toBe('eligibility_then_claim')
    expect(a.why).toContain('资格')
  })

  it('W2 认不出的状态 ⇒ skip 且原因点名原值(不猜成可领)', () => {
    const plan = planWelfareClaim({
      campaigns: [{ id: 'c3', state: 'PENDING_REVIEW_LEGACY' }],
      providerVerified: true,
    })
    const a = plan.actions[0]
    expect(a.action).toBe('skip')
    expect(a.why).toContain('PENDING_REVIEW_LEGACY')
  })

  it('W2b 已领/已结束/不符合 ⇒ 各自 skip,不发起', () => {
    for (const state of ['claimed', 'closed', 'not_eligible'] as const) {
      const plan = planWelfareClaim({
        campaigns: [{ id: `x-${state}`, state }],
        providerVerified: true,
      })
      expect(plan.actions[0].action).toBe('skip')
    }
  })

  it('本地台账命中 ⇒ skip(避免每轮重试)', () => {
    const plan = planWelfareClaim({
      campaigns: [{ id: 'c4', state: 'claimable' }],
      providerVerified: true,
      alreadyClaimedIds: ['c4'],
    })
    expect(plan.actions[0].action).toBe('skip')
    expect(plan.actions[0].why).toContain('本地台账')
  })

  it('缺 id 的活动 ⇒ skip 且说明无法对账', () => {
    const plan = planWelfareClaim({
      campaigns: [{ state: 'claimable' }],
      providerVerified: true,
    })
    expect(plan.actions[0].action).toBe('skip')
    expect(plan.actions[0].why).toContain('缺 id')
  })

  it('W4 幂等:replayed 归一成 replayed(不是 failed)', () => {
    expect(normalizeClaimOutcome({ replayed: true })).toBe('replayed')
    expect(normalizeClaimOutcome({ claimed: true })).toBe('claimed')
    expect(normalizeClaimOutcome({ ok: true })).toBe('claimed')
    expect(normalizeClaimOutcome({})).toBe('failed')
    expect(normalizeClaimOutcome({ replayed: false })).toBe('failed')
  })

  it('归一表:中文与大小写都能认', () => {
    expect(normalizeWelfareKind('积分')).toBe('credits')
    expect(normalizeWelfareKind('PRO_UPGRADE')).toBe('pro_upgrade')
    expect(normalizeWelfareKind(null)).toBe('other')
    expect(normalizeWelfareState(' 可用 ')).toBe('unknown')
    expect(normalizeWelfareState('可领取')).toBe('claimable')
    expect(normalizeWelfareState(undefined)).toBe('unknown')
  })

  it('summary 与 actions 对账一致', () => {
    const plan = planWelfareClaim({
      campaigns: [
        { id: 'a', state: 'claimable', kind: 'credits' },
        { id: 'b', state: 'claimed' },
        { id: 'c', state: 'weird' },
      ],
      providerVerified: true,
    })
    expect(plan.summary.claim).toBe(1)
    expect(plan.summary.skip).toBe(2)
    expect(plan.summary.claim + plan.summary.skip).toBe(plan.actions.length)
  })

  it('枚举清单是最终形态', () => {
    expect([...WELFARE_KINDS]).toEqual(['credits', 'pro_upgrade', 'other'])
    expect([...WELFARE_STATES]).toEqual(['claimable', 'claimed', 'closed', 'not_eligible', 'unknown'])
  })

  it('纯函数:同输入恒等', () => {
    const input = {
      campaigns: [{ id: 'z', state: 'claimable', kind: 'credits' }],
      providerVerified: true,
      alreadyClaimedIds: [],
    }
    expect(planWelfareClaim(input)).toEqual(planWelfareClaim(input))
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
