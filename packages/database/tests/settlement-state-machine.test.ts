// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE).
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect } from 'vitest'
import {
  SETTLEMENT_STATES,
  SETTLEMENT_TRANSITIONS,
  nextStates,
  canTransition,
  computeBackoffDelay,
  computeNextRunAt,
  deriveSettlementStatus,
} from '../src/settlement-state-machine.js'

describe('G-241 结算状态机·状态枚举', () => {
  it('封闭集恰好四个状态', () => {
    expect(SETTLEMENT_STATES).toEqual(['pending_claim', 'processing', 'backing_off', 'terminal'])
    expect(SETTLEMENT_STATES).toHaveLength(4)
  })
})

describe('G-241 结算状态机·合法转移', () => {
  it('pending_claim 可进入 processing 或 terminal', () => {
    expect(canTransition('pending_claim', 'processing')).toBe(true)
    expect(canTransition('pending_claim', 'terminal')).toBe(true)
  })

  it('processing 只能进入 backing_off 或 terminal', () => {
    expect(canTransition('processing', 'backing_off')).toBe(true)
    expect(canTransition('processing', 'terminal')).toBe(true)
    expect(canTransition('processing', 'pending_claim')).toBe(false)
  })

  it('backing_off 只能进入 processing 或 terminal', () => {
    expect(canTransition('backing_off', 'processing')).toBe(true)
    expect(canTransition('backing_off', 'terminal')).toBe(true)
    expect(canTransition('backing_off', 'pending_claim')).toBe(false)
  })

  it('terminal 是吸收态,无任何合法出边', () => {
    expect(nextStates('terminal')).toEqual([])
    for (const s of SETTLEMENT_STATES) {
      expect(canTransition('terminal', s)).toBe(false)
    }
  })

  it('非法状态名 / 自转移到非法组合被拒', () => {
    // @ts-expect-error 测试非法字面量
    expect(canTransition('bogus', 'terminal')).toBe(false)
    expect(canTransition('pending_claim', 'pending_claim')).toBe(false)
    expect(canTransition('processing', 'processing')).toBe(false)
  })

  it('转移表与 nextStates 一致', () => {
    for (const s of SETTLEMENT_STATES) {
      expect(SETTLEMENT_TRANSITIONS[s]).toEqual(nextStates(s))
    }
  })
})

describe('G-241 结算状态机·退避计算(指数)', () => {
  it('attempt<=0 不延时', () => {
    expect(computeBackoffDelay(0)).toBe(0)
    expect(computeBackoffDelay(-3)).toBe(0)
  })

  it('首次退避等于 base(默认 30s)', () => {
    expect(computeBackoffDelay(1)).toBe(30_000)
  })

  it('指数增长:1/2/3 次 = 30s / 60s / 120s', () => {
    expect(computeBackoffDelay(1)).toBe(30_000)
    expect(computeBackoffDelay(2)).toBe(60_000)
    expect(computeBackoffDelay(3)).toBe(120_000)
  })

  it('受 maxMs 截断,不会无限膨胀', () => {
    // 30s * 2^19 远大于 1h,必须被截断到 3_600_000
    expect(computeBackoffDelay(20)).toBe(3_600_000)
    expect(computeBackoffDelay(1000)).toBe(3_600_000)
  })

  it('自定义 base/factor/max 生效', () => {
    expect(computeBackoffDelay(1, { baseMs: 1000, factor: 3, maxMs: 10_000 })).toBe(1000)
    expect(computeBackoffDelay(2, { baseMs: 1000, factor: 3, maxMs: 10_000 })).toBe(3000)
    expect(computeBackoffDelay(5, { baseMs: 1000, factor: 3, maxMs: 10_000 })).toBe(10_000)
  })
})

describe('G-241 结算状态机·退避计算(固定)', () => {
  it('fixed 每次恒定 base(被 max 截断)', () => {
    expect(computeBackoffDelay(1, { strategy: 'fixed' })).toBe(30_000)
    expect(computeBackoffDelay(7, { strategy: 'fixed' })).toBe(30_000)
    expect(computeBackoffDelay(0, { strategy: 'fixed' })).toBe(0)
    expect(computeBackoffDelay(3, { strategy: 'fixed', baseMs: 5000, maxMs: 2000 })).toBe(2000)
  })
})

describe('G-241 结算状态机·computeNextRunAt', () => {
  const now = new Date('2026-10-27T00:00:00.000Z')
  it('attempt=0 不延时,返回 now 本身', () => {
    expect(computeNextRunAt(0, now).getTime()).toBe(now.getTime())
  })
  it('attempt=2 指数退避后 = now + 60s', () => {
    expect(computeNextRunAt(2, now).getTime()).toBe(now.getTime() + 60_000)
  })
})

describe('G-241 结算状态机·deriveSettlementStatus 派生', () => {
  const base = { claimToken: null, attempt: 0, terminalReason: null }

  it('终态成因非空 → terminal(最高优先级)', () => {
    expect(deriveSettlementStatus({ ...base, terminalReason: 'completed' })).toBe('terminal')
    expect(
      deriveSettlementStatus({
        ...base,
        terminalReason: 'failed_permanent',
        claimToken: 'x',
        attempt: 3,
      }),
    ).toBe('terminal')
  })

  it('被认领(claim_token 非空) → processing', () => {
    expect(deriveSettlementStatus({ ...base, claimToken: 'tok-abc' })).toBe('processing')
  })

  it('退避计数>0 且未认领 → backing_off', () => {
    expect(deriveSettlementStatus({ ...base, attempt: 2 })).toBe('backing_off')
  })

  it('其余 → pending_claim', () => {
    expect(deriveSettlementStatus(base)).toBe('pending_claim')
  })

  it('空串与 null 同义', () => {
    expect(deriveSettlementStatus({ claimToken: '', attempt: 0, terminalReason: '' })).toBe(
      'pending_claim',
    )
  })
})
