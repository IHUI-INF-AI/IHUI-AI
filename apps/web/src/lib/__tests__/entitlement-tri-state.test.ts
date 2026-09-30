// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// G-650:usage/entitlement 刷新写入三态保留判定的单测。
// 三条验收正反用例:抖动后仍显示 no_plan / 显式空清掉白名单 / 换账号不复活旧连接。

import { describe, expect, it } from 'vitest'
import {
  classifyEntitlementRefresh,
  mergeUsageEntitlementRefresh,
  type UsageEntitlementSnapshot,
} from '../entitlement-tri-state'
import { createRefreshStore } from '../entitlement-refresh-store'

const ACCT_A: UsageEntitlementSnapshot = {
  identityKey: 'acct:A',
  plan: 'pro',
  whitelist: ['model-1', 'model-2'],
  connectionId: 'conn-a-9',
  usedTokens: 1500,
}

describe('classifyEntitlementRefresh(G-650 三态判定表)', () => {
  it("(a) unknown 字段(缺席/'unknown' 哨兵)判为 unknown,显式值/显式空判为 explicit", () => {
    const v = classifyEntitlementRefresh(ACCT_A, {
      identityKey: 'acct:A',
      plan: 'unknown',
      whitelist: undefined,
      connectionId: null,
      usedTokens: 0,
    })
    expect(v).toEqual({
      kind: 'per-field',
      fields: {
        identityKey: 'explicit',
        plan: 'unknown',
        whitelist: 'unknown',
        connectionId: 'explicit',
        usedTokens: 'explicit',
      },
    })
  })

  it('(c) 身份键变更判为 identity-change,压过逐字段判定', () => {
    const v = classifyEntitlementRefresh(ACCT_A, { identityKey: 'acct:B', plan: 'pro' })
    expect(v).toEqual({ kind: 'identity-change' })
  })

  it('身份键缺席/为 null 不触发 identity-change(无法确认变化时沿用,不误杀)', () => {
    for (const identityKey of [undefined, null]) {
      const v = classifyEntitlementRefresh(ACCT_A, { identityKey, plan: 'pro' })
      expect(v.kind).toBe('per-field')
    }
  })

  it('plan 的 null/空串判为 explicit(显式无套餐),仅 undefined 与 unknown 哨兵判为 unknown', () => {
    const verdictOf = (plan: string | null | undefined) => {
      const v = classifyEntitlementRefresh(ACCT_A, { identityKey: 'acct:A', plan })
      return v.kind === 'per-field' ? v.fields.plan : 'identity-change'
    }
    expect(verdictOf(null)).toBe('explicit')
    expect(verdictOf('')).toBe('explicit')
    expect(verdictOf(undefined)).toBe('unknown')
    expect(verdictOf('unknown')).toBe('unknown')
    expect(verdictOf('UNKNOWN')).toBe('unknown')
  })
})

describe('mergeUsageEntitlementRefresh(G-650 三条验收用例)', () => {
  it('用例1(正):上游抖动(unknown)后仍显示 no_plan,其余字段沿用不闪断', () => {
    // 上一轮:no_plan(plan=null) + 白名单 + 连接;本轮上游抖动,全字段 unknown
    const previous = mergeUsageEntitlementRefresh(null, {
      identityKey: 'acct:A',
      plan: null,
      whitelist: ['model-1'],
      connectionId: 'conn-a-9',
      usedTokens: 1500,
    })
    expect(previous.plan).toBeNull()
    const jittered = mergeUsageEntitlementRefresh(previous, {
      identityKey: 'acct:A',
      plan: 'unknown',
      whitelist: undefined,
      connectionId: undefined,
      usedTokens: undefined,
    })
    // no_plan 显示保持;白名单/连接/用量沿用上一轮,不被抖动冲掉
    expect(jittered.plan).toBeNull()
    expect(jittered.whitelist).toEqual(['model-1'])
    expect(jittered.connectionId).toBe('conn-a-9')
    expect(jittered.usedTokens).toBe(1500)
  })

  it('用例1(反):unknown 哨兵不得被当成权威套餐值覆盖 no_plan', () => {
    const previous = mergeUsageEntitlementRefresh(null, { identityKey: 'acct:A', plan: null })
    const merged = mergeUsageEntitlementRefresh(previous, {
      identityKey: 'acct:A',
      plan: 'unknown',
    })
    expect(merged.plan).toBeNull()
  })

  it('用例2(正):上游显式空(null/[])为本轮权威,清掉旧值(含白名单)', () => {
    const merged = mergeUsageEntitlementRefresh(ACCT_A, {
      identityKey: 'acct:A',
      plan: null,
      whitelist: [],
      usedTokens: 0,
    })
    expect(merged.plan).toBeNull()
    expect(merged.whitelist).toEqual([])
    expect(merged.usedTokens).toBe(0)
    // connectionId 本轮缺席 = unknown,沿用上一轮(只清上游明确说空的)
    expect(merged.connectionId).toBe('conn-a-9')
  })

  it('用例2(反):显式非空值本轮权威,覆盖旧值', () => {
    const merged = mergeUsageEntitlementRefresh(ACCT_A, {
      identityKey: 'acct:A',
      plan: 'max',
      whitelist: ['model-3'],
    })
    expect(merged.plan).toBe('max')
    expect(merged.whitelist).toEqual(['model-3'])
  })

  it('用例3(正):换账号不复活旧连接 —— 旧值全部作废,unknown 字段落空态', () => {
    const merged = mergeUsageEntitlementRefresh(ACCT_A, {
      identityKey: 'acct:B',
      plan: 'unknown',
      whitelist: undefined,
      connectionId: undefined,
      usedTokens: undefined,
    })
    expect(merged.identityKey).toBe('acct:B')
    // 上一账号的连接/白名单/套餐/用量一律不复活
    expect(merged.connectionId).not.toBe('conn-a-9')
    expect(merged.connectionId).toBeNull()
    expect(merged.whitelist).toEqual([])
    expect(merged.plan).toBeNull()
    expect(merged.usedTokens).toBe(0)
    // 新账号本轮显式给出的值照常采信
    const withFresh = mergeUsageEntitlementRefresh(ACCT_A, {
      identityKey: 'acct:B',
      connectionId: 'conn-b-1',
      plan: 'free',
    })
    expect(withFresh.connectionId).toBe('conn-b-1')
    expect(withFresh.plan).toBe('free')
  })

  it('用例3(反):身份变更后即使上游再次抖动,也不得回填上一账号的连接', () => {
    const switched = mergeUsageEntitlementRefresh(ACCT_A, { identityKey: 'acct:B' })
    const jittered = mergeUsageEntitlementRefresh(switched, {
      identityKey: 'acct:B',
      connectionId: undefined,
      plan: 'unknown',
    })
    expect(jittered.connectionId).toBeNull()
    expect(jittered.plan).toBeNull()
  })

  it('首轮无上一轮值:unknown 字段落空态而非报错', () => {
    const merged = mergeUsageEntitlementRefresh(null, { identityKey: 'acct:A', plan: 'unknown' })
    expect(merged).toEqual({
      identityKey: 'acct:A',
      plan: null,
      whitelist: [],
      connectionId: null,
      usedTokens: 0,
    })
  })
})

describe('刷新写入出口接入三态判定(entitlement-refresh-store × merge)', () => {
  interface StoreSnapshot extends UsageEntitlementSnapshot {
    identityKey: string
    plan: string | null
    whitelist: string[]
    connectionId: string | null
    usedTokens: number
  }

  function createStore() {
    let nowMs = 0
    const seen: Array<StoreSnapshot | null> = []
    const queue: UsageEntitlementSnapshot[] = []
    const store = createRefreshStore<StoreSnapshot, Record<string, never>>({
      fetcher: () => Promise.resolve(queue.shift() as StoreSnapshot),
      merge: (previous, incoming) =>
        mergeUsageEntitlementRefresh(previous, incoming) as StoreSnapshot,
      now: () => nowMs,
    })
    return {
      store,
      seen,
      push(payload: UsageEntitlementSnapshot) {
        queue.push(payload as StoreSnapshot)
        return store.refresh('acct-key', Object.freeze({}) as Record<string, never>)
      },
      advance(ms: number) {
        nowMs += ms
      },
    }
  }

  it('抖动回包经 merge 写入:no_plan 与白名单在快照/广播中保持', async () => {
    const h = createStore()
    h.store.subscribe('acct-key', (s) => h.seen.push(s))
    await h.push({
      identityKey: 'acct:A',
      plan: null,
      whitelist: ['model-1'],
      connectionId: 'conn-a-9',
      usedTokens: 100,
    })
    await h.push({ identityKey: 'acct:A', plan: 'unknown' })
    const snap = h.store.getSnapshot('acct-key')
    expect(snap?.plan).toBeNull()
    expect(snap?.whitelist).toEqual(['model-1'])
    expect(snap?.connectionId).toBe('conn-a-9')
    expect(h.seen.at(-1)?.plan).toBeNull()
  })

  it('显式空回包经 merge 写入:白名单被清掉;换账号回包不复活旧连接', async () => {
    const h = createStore()
    await h.push({
      identityKey: 'acct:A',
      plan: 'pro',
      whitelist: ['model-1', 'model-2'],
      connectionId: 'conn-a-9',
      usedTokens: 100,
    })
    await h.push({ identityKey: 'acct:A', whitelist: [], usedTokens: 0 })
    expect(h.store.getSnapshot('acct-key')?.whitelist).toEqual([])
    expect(h.store.getSnapshot('acct-key')?.plan).toBe('pro')
    // 换账号:旧连接不复活
    await h.push({ identityKey: 'acct:B', plan: 'unknown' })
    const snap = h.store.getSnapshot('acct-key')
    expect(snap?.identityKey).toBe('acct:B')
    expect(snap?.connectionId).toBeNull()
    expect(snap?.whitelist).toEqual([])
    expect(snap?.plan).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
