// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * relay-pool-policy 的积分紧迫旋钮(`preferLowCredit`,2026-10-31 立)判据钉死。
 *
 * 纯函数直测 `__test__` 之外的公开导出(orderDeterministic / creditOfRow /
 * readRelayPoolPolicy / DEFAULT_RELAY_POOL_POLICY),零反弹、零时钟、零网络。
 * 这里不复制任何判据常量(§22c),全部取自被测算子本身。
 */
import { describe, expect, it } from 'vitest'

import {
  DEFAULT_RELAY_POOL_POLICY,
  creditOfRow,
  orderDeterministic,
  readRelayPoolPolicy,
  type PoolCandidateRow,
  type RelayPoolPolicy,
} from '../relay-pool-policy.js'

/** 固定时钟:排序只依赖行字段,注入固定 nowMs 使 idleBonus 可复现。 */
const NOW = 1_700_000_000_000

function row(over: Partial<PoolCandidateRow> & { id: string }): PoolCandidateRow {
  return {
    providerCode: 'workbuddy',
    priority: 0,
    weight: 1,
    lastUsedAt: null,
    tokenExpiresAt: null,
    ...over,
  }
}

function lowCreditPolicy(): RelayPoolPolicy {
  return { ...DEFAULT_RELAY_POOL_POLICY, preferLowCredit: true }
}

describe('orderDeterministic + preferLowCredit', () => {
  it('同优先级内积分更低的号排前(低分号先消耗)', () => {
    const high = row({ id: 'high', extraMetadata: { creditRemaining: 100 } })
    const low = row({ id: 'low', extraMetadata: { creditRemaining: 3 } })
    const ordered = orderDeterministic([high, low], NOW, lowCreditPolicy()).map((r) => r.id)
    expect(ordered).toEqual(['low', 'high'])
  })

  it('读不到积分的号排在已知低积分之后(不偏爱也不饿死,§0.3)', () => {
    const known = row({ id: 'known', extraMetadata: { creditRemaining: 5 } })
    const unknown = row({ id: 'unknown' }) // 无 extraMetadata ⇒ creditOfRow 返回 null
    expect(creditOfRow(unknown)).toBeNull()
    const ordered = orderDeterministic([unknown, known], NOW, lowCreditPolicy()).map((r) => r.id)
    expect(ordered).toEqual(['known', 'unknown'])
  })

  it('关闭 preferLowCredit(默认)时积分不参与排序,还原既有序', () => {
    const a = row({ id: 'a', weight: 2, extraMetadata: { creditRemaining: 100 } })
    const b = row({ id: 'b', weight: 5, extraMetadata: { creditRemaining: 1 } })
    expect(DEFAULT_RELAY_POOL_POLICY.preferLowCredit).toBe(false)
    // 默认序 = 有效权重 desc ⇒ b(weight 5)先于 a(weight 2),与积分无关。
    const ordered = orderDeterministic([a, b], NOW, DEFAULT_RELAY_POOL_POLICY).map((r) => r.id)
    expect(ordered).toEqual(['b', 'a'])
  })

  it('priority 优先于积分:数字更大的优先级即便积分更低也排后', () => {
    const p0 = row({ id: 'p0', priority: 0, extraMetadata: { creditRemaining: 100 } })
    const p1 = row({ id: 'p1', priority: 1, extraMetadata: { creditRemaining: 1 } })
    const ordered = orderDeterministic([p1, p0], NOW, lowCreditPolicy()).map((r) => r.id)
    expect(ordered).toEqual(['p0', 'p1'])
  })
})

describe('readRelayPoolPolicy + preferLowCredit env', () => {
  it('env true 生效', () => {
    expect(readRelayPoolPolicy({ IHUI_RELAY_POOL_PREFER_LOW_CREDIT: 'true' }).preferLowCredit).toBe(
      true,
    )
    expect(readRelayPoolPolicy({ IHUI_RELAY_POOL_PREFER_LOW_CREDIT: '1' }).preferLowCredit).toBe(
      true,
    )
  })

  it('非法值回落默认 false', () => {
    expect(
      readRelayPoolPolicy({ IHUI_RELAY_POOL_PREFER_LOW_CREDIT: 'maybe' }).preferLowCredit,
    ).toBe(false)
  })

  it('缺省不设键时默认 false(零行为变化)', () => {
    expect(readRelayPoolPolicy({}).preferLowCredit).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
