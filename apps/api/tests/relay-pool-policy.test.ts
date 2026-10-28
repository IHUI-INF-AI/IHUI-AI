// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * relay-pool-policy 镜像测试(2026-10-29 立,O93)。
 * §22c 纪律:判据一律 import 源模块 __test__,本文件零复制第二份打分/过滤实现;
 * 默认数字只引用 DEFAULT_RELAY_POOL_POLICY(源模块单源),用例自行设置的旋钮值
 * (如 perHour=0、floor=50)是夹具不是档位表副本。
 * 每项能力成对写:正向(装上生效)+ 反向(摘掉/关闭即翻回旧行为)。
 */
import { describe, it, expect } from 'vitest'
import {
  __test__ as P,
  type PoolCandidateRow,
  type RelayPoolPolicy,
} from '../src/services/relay-pool-policy.js'

const HOUR = P.HOUR_MS

function row(id: string, o: Partial<PoolCandidateRow> = {}): PoolCandidateRow {
  return {
    id,
    providerCode: 'trae',
    priority: 0,
    weight: 1,
    lastUsedAt: null,
    tokenExpiresAt: null,
    ...o,
  }
}

function policy(o: Partial<RelayPoolPolicy> = {}): RelayPoolPolicy {
  return { ...P.DEFAULT_RELAY_POOL_POLICY, ...o }
}

/** 种子随机源:按队列依次出值,耗尽后恒 0(可复现,不碰 Math.random) */
function seqRng(values: number[]): () => number {
  let i = 0
  return () => {
    const v = i < values.length ? values[i] : 0
    i += 1
    return v ?? 0
  }
}

const NOW = Date.UTC(2026, 10, 29, 12, 0, 0)

describe('旋钮单源(env 解析)', () => {
  it('正向:六钮 env 全部被读出', () => {
    const env = {
      [P.RELAY_POOL_ENV_KEYS.strategy]: 'weighted_random',
      [P.RELAY_POOL_ENV_KEYS.idleWeightPerHour]: '0.8',
      [P.RELAY_POOL_ENV_KEYS.idleWeightMax]: '7',
      [P.RELAY_POOL_ENV_KEYS.preferExpiring]: 'true',
      [P.RELAY_POOL_ENV_KEYS.expiringSoonMs]: '1000',
      [P.RELAY_POOL_ENV_KEYS.creditFloor]: '50',
      [P.RELAY_POOL_ENV_KEYS.maxInFlightGlobal]: '4',
      [P.RELAY_POOL_ENV_KEYS.crossDomainFallback]: '1',
    }
    expect(P.readRelayPoolPolicy(env)).toEqual({
      strategy: 'weighted_random',
      idleWeightPerHour: 0.8,
      idleWeightMax: 7,
      preferExpiring: true,
      expiringSoonMs: 1000,
      creditFloor: 50,
      maxInFlightGlobal: 4,
      crossDomainFallback: true,
    })
  })

  it('反向:脏值/缺省一律回落默认(失效方向 = 维持既有行为)', () => {
    expect(P.readRelayPoolPolicy({})).toEqual(P.DEFAULT_RELAY_POOL_POLICY)
    expect(P.readRelayPoolPolicy({ IHUI_RELAY_POOL_STRATEGY: 'bogus' }).strategy).toBe(
      'deterministic',
    )
    expect(P.readRelayPoolPolicy({ IHUI_RELAY_POOL_CREDIT_FLOOR: '-3' }).creditFloor).toBe(
      P.DEFAULT_RELAY_POOL_POLICY.creditFloor,
    )
    expect(P.readRelayPoolPolicy({ IHUI_RELAY_POOL_IDLE_WEIGHT_MAX: 'NaN' }).idleWeightMax).toBe(
      P.DEFAULT_RELAY_POOL_POLICY.idleWeightMax,
    )
    expect(P.readRelayPoolPolicy({ IHUI_RELAY_POOL_PREFER_EXPIRING: 'maybe' }).preferExpiring).toBe(
      false,
    )
  })

  it('默认值逐钮现读(0.5 / 5 / false / 168h / 0 / 0 / false)', () => {
    expect(P.DEFAULT_RELAY_POOL_POLICY).toEqual({
      strategy: 'deterministic',
      idleWeightPerHour: 0.5,
      idleWeightMax: 5,
      preferExpiring: false,
      expiringSoonMs: 168 * HOUR,
      creditFloor: 0,
      maxInFlightGlobal: 0,
      crossDomainFallback: false,
    })
  })
})

describe('② 闲置加权', () => {
  it('正向:从未用过的低权号赢过刚用过的高权号(默认 perHour=0.5)', () => {
    const freshHigh = row('fresh-high', { weight: 5, lastUsedAt: new Date(NOW) })
    const idleLow = row('idle-low', { weight: 1, lastUsedAt: null })
    const ordered = P.orderDeterministic([freshHigh, idleLow], NOW, policy())
    expect(ordered.map((r) => r.id)).toEqual(['idle-low', 'fresh-high'])
  })

  it('反向:perHour=0 摘掉加权 → 还原改造前 weight desc', () => {
    const freshHigh = row('fresh-high', { weight: 5, lastUsedAt: new Date(NOW) })
    const idleLow = row('idle-low', { weight: 1, lastUsedAt: null })
    const ordered = P.orderDeterministic(
      [freshHigh, idleLow],
      NOW,
      policy({ idleWeightPerHour: 0 }),
    )
    expect(ordered.map((r) => r.id)).toEqual(['fresh-high', 'idle-low'])
  })

  it('封顶:idle 200h 与 20h 的加分都恒等于 idleWeightMax(不随小时数无限抬)', () => {
    const a = row('a', { lastUsedAt: new Date(NOW - 20 * HOUR) })
    const b = row('b', { lastUsedAt: new Date(NOW - 200 * HOUR) })
    const pol = policy()
    expect(P.idleBonusOf(a, NOW, pol)).toBe(pol.idleWeightMax)
    expect(P.idleBonusOf(b, NOW, pol)).toBe(pol.idleWeightMax)
    // 线性段:2h × 0.5 = 1(未触顶)
    const c = row('c', { lastUsedAt: new Date(NOW - 2 * HOUR) })
    expect(P.idleBonusOf(c, NOW, pol)).toBeCloseTo(1)
  })
})

describe('③ 临期优先(preferExpiring)', () => {
  const expiring = row('soon', { weight: 1, tokenExpiresAt: new Date(NOW + 1 * HOUR) })
  const durable = row('later', { weight: 9, tokenExpiresAt: new Date(NOW + 720 * HOUR) })

  it('正向:flag 开 ⇒ 窗口内将到期的号(哪怕权重低)排前', () => {
    const ordered = P.orderDeterministic([durable, expiring], NOW, policy({ preferExpiring: true }))
    expect(ordered.map((r) => r.id)).toEqual(['soon', 'later'])
  })

  it('反向:flag 关 ⇒ 高权号在前(临期不参与排序)', () => {
    const ordered = P.orderDeterministic([durable, expiring], NOW, policy())
    expect(ordered.map((r) => r.id)).toEqual(['later', 'soon'])
  })

  it('判不了不算临期:tokenExpiresAt=null 不抢位;窗口边界 <= 生效', () => {
    const pol = policy({ preferExpiring: true, expiringSoonMs: 1000 })
    expect(P.isExpiringSoon(row('no-exp'), NOW, pol)).toBe(false)
    expect(P.isExpiringSoon(row('edge', { tokenExpiresAt: new Date(NOW + 1000) }), NOW, pol)).toBe(
      true,
    )
    expect(P.isExpiringSoon(row('over', { tokenExpiresAt: new Date(NOW + 1001) }), NOW, pol)).toBe(
      false,
    )
  })
})

describe('④ 积分地板(credit_floor)', () => {
  it('正向:低于地板的号被滤掉;无积分信息的号保留(判不了 ⇒ 留)', () => {
    const low = row('low', { extraMetadata: { creditRemaining: 10 } })
    const high = row('high', { extraMetadata: { creditRemaining: 100 } })
    const unknown = row('unknown')
    const broken = row('broken', { extraMetadata: 'not-json{' })
    const out = P.filterCreditFloor([low, high, unknown, broken], 50)
    expect(out.rows.map((r) => r.id)).toEqual(['high', 'unknown', 'broken'])
    expect(out.fallbackApplied).toBe(false)
  })

  it('永不排空(正控):全池都低于地板 ⇒ 回落未过滤集 + fallbackApplied', () => {
    const a = row('a', { extraMetadata: { credit: 1 } })
    const b = row('b', { extraMetadata: { balanceCents: '2' } })
    const out = P.filterCreditFloor([a, b], 50)
    expect(out.rows.map((r) => r.id)).toEqual(['a', 'b'])
    expect(out.fallbackApplied).toBe(true)
    const sel = P.selectPoolOrdered([a, b], { policy: policy({ creditFloor: 50 }) })
    expect(sel.rows.length).toBe(2)
    expect(sel.fallbacks).toEqual(['credit_floor_fallback'])
  })

  it('反向:floor=0(默认)完全不滤;取值键序 creditRemaining > credit > balanceCents', () => {
    const low = row('low', { extraMetadata: { creditRemaining: 10 } })
    expect(P.filterCreditFloor([low], 0)).toEqual({ rows: [low], fallbackApplied: false })
    expect(
      P.creditOfRow(
        row('k', { extraMetadata: { credit: 3, creditRemaining: 7, balanceCents: 9 } }),
      ),
    ).toBe(7)
    expect(P.creditOfRow(row('k2', { extraMetadata: { credit: 3, balanceCents: 9 } }))).toBe(3)
    expect(P.creditOfRow(row('k3', { extraMetadata: { unrelated: 1 } }))).toBeNull()
  })
})

describe('⑥ 跨域互兜(cross_domain_fallback)', () => {
  const g = row('g', { providerCode: 'workbuddy', extraMetadata: { domain: 'workbuddy.ai' } })
  const c = row('c', { providerCode: 'workbuddy', extraMetadata: { domain: 'workbuddy.cn' } })
  const cDefault = row('c-default', { providerCode: 'workbuddy', extraMetadata: {} })
  const t = row('t', { providerCode: 'trae' })

  it('域取材:workbuddy 行按 extraMetadata.domain 经 resolveRealm 单源;缺省落 cn;非 workbuddy 无域', () => {
    expect(P.domainKeyOfRow(g)).toBe('global')
    expect(P.domainKeyOfRow(c)).toBe('cn')
    expect(P.domainKeyOfRow(cDefault)).toBe('cn')
    expect(P.domainKeyOfRow(t)).toBeNull()
  })

  it('正向:请求域外的 workbuddy 号被滤掉;无域概念的号恒放行', () => {
    const out = P.filterByDomain([g, c, t], 'global')
    expect(out.rows.map((r) => r.id)).toEqual(['g', 't'])
    expect(out.fallbackApplied).toBe(false)
  })

  it('永不排空(正控):请求域内一枚都不剩 ⇒ 回落全域 + 标签', () => {
    const out = P.filterByDomain([c], 'global')
    expect(out.rows.map((r) => r.id)).toEqual(['c'])
    expect(out.fallbackApplied).toBe(true)
    const sel = P.selectPoolOrdered([c], {
      policy: policy({ crossDomainFallback: true }),
      requestedDomain: 'global',
    })
    expect(sel.fallbacks).toEqual(['cross_domain_fallback'])
  })

  it('反向:flag 关 ⇒ 即便给了请求域也不滤(保持单查询现状)', () => {
    const sel = P.selectPoolOrdered([g, c], { policy: policy(), requestedDomain: 'global' })
    expect(sel.rows.map((r) => r.id)).toContain('c')
    expect(sel.fallbacks).toEqual([])
  })
})

describe('① 加权随机(weighted_random)', () => {
  // 两号都"刚用过"(加分 0),让权重账目就是 3 : 1
  const heavy = row('heavy', { weight: 3, lastUsedAt: new Date(NOW) })
  const light = row('light', { weight: 1, lastUsedAt: new Date(NOW) })

  it('正向:种子 rng 低值先中高权、高值先中低权(分布合理且可复现)', () => {
    const pol = policy({ strategy: 'weighted_random' })
    // roll=0.74 × 总权4 = 2.96 < 3 ⇒ heavy 先;剩 light 独苗
    expect(P.orderWeighted([heavy, light], NOW, pol, seqRng([0.74])).map((r) => r.id)).toEqual([
      'heavy',
      'light',
    ])
    // roll=0.99 × 4 = 3.96 ≥ 3 ⇒ 扣掉 heavy 落进 light 区间
    expect(P.orderWeighted([heavy, light], NOW, pol, seqRng([0.99])).map((r) => r.id)).toEqual([
      'light',
      'heavy',
    ])
  })

  it('反向:deterministic 档根本不消费 rng(摘掉注入即回到确定序)', () => {
    const sel = P.selectPoolOrdered([heavy, light], {
      policy: policy(),
      nowMs: NOW,
      rng: seqRng([0.99]),
    })
    expect(sel.rows.map((r) => r.id)).toEqual(['heavy', 'light'])
    expect(sel.strategy).toBe('deterministic')
  })

  it('永不排空:总权重为 0(全零权 + 加权关)⇒ 回落确定序,一枚不丢', () => {
    const zero = [row('z1', { weight: 0 }), row('z2', { weight: 0 })]
    const pol = policy({ strategy: 'weighted_random', idleWeightPerHour: 0 })
    expect(P.orderWeighted(zero, NOW, pol, seqRng([0.5])).map((r) => r.id)).toEqual(['z1', 'z2'])
    // rng 脏值 ⇒ 按 0 处理(仍产出全序,绝不空手)
    const sel = P.selectPoolOrdered([heavy, light], {
      policy: pol2(),
      nowMs: NOW,
      rng: () => Number.NaN,
    })
    expect(sel.rows.length).toBe(2)
  })

  it('闲置加分进有效权重:同权号里更闲的一枚在抽样里份额更大(边界 roll 3.01 落在闲号区间)', () => {
    const fresh = row('fresh', { weight: 1, lastUsedAt: new Date(NOW) })
    const idle = row('idle', { weight: 1, lastUsedAt: null }) // 加分封顶 5 ⇒ 有效 6
    const pol = policy({ strategy: 'weighted_random' })
    // 总权 = 1(fresh, 刚用) + 6(idle) = 7;输入序 [fresh, idle]
    // roll=0.1×7=0.7 < 1 ⇒ fresh 先;roll=0.5×7=3.5 ≥ 1 ⇒ idle 先
    expect(P.orderWeighted([fresh, idle], NOW, pol, seqRng([0.1])).map((r) => r.id)).toEqual([
      'fresh',
      'idle',
    ])
    expect(P.orderWeighted([fresh, idle], NOW, pol, seqRng([0.5])).map((r) => r.id)).toEqual([
      'idle',
      'fresh',
    ])
  })
})

/** 全钮打开的合成策略(管线级用例用) */
function pol2(): RelayPoolPolicy {
  return policy({
    strategy: 'weighted_random',
    creditFloor: 1,
    crossDomainFallback: true,
    preferExpiring: true,
  })
}

describe('管线合成(过滤顺序与标签收集)', () => {
  it('credit_floor 先于域过滤;两级回空标签都能收进 fallbacks', () => {
    const lowGlobal = row('low-global', {
      providerCode: 'workbuddy',
      extraMetadata: { domain: 'workbuddy.ai', creditRemaining: 1 },
    })
    const lowCn = row('low-cn', {
      providerCode: 'workbuddy',
      extraMetadata: { domain: 'workbuddy.cn', creditRemaining: 1 },
    })
    // floor=10 全低于 ⇒ credit 回落(两枚都在)
    // requestedDomain 'global' ⇒ cn 被滤,剩 low-global ⇒ 不回空 ⇒ 只有 credit 标签
    const sel = P.selectPoolOrdered([lowGlobal, lowCn], {
      policy: policy({ creditFloor: 10, crossDomainFallback: true }),
      requestedDomain: 'global',
    })
    expect(sel.fallbacks).toEqual(['credit_floor_fallback'])
    expect(sel.rows.map((r) => r.id)).toEqual(['low-global'])
    // 再叠一级:请求域 'global' 而池里只剩 cn ⇒ 两级都回空 ⇒ 两个标签
    const sel2 = P.selectPoolOrdered([lowCn], {
      policy: policy({ creditFloor: 10, crossDomainFallback: true }),
      requestedDomain: 'global',
    })
    expect(sel2.fallbacks).toEqual(['credit_floor_fallback', 'cross_domain_fallback'])
    expect(sel2.rows.length).toBe(1)
  })

  it('反向:旋钮全默认 ⇒ 管线等价于改造前(不过滤、确定序、无标签)', () => {
    const a = row('a', { weight: 2 })
    const b = row('b', { weight: 9 })
    const sel = P.selectPoolOrdered([a, b], { policy: policy(), nowMs: NOW })
    expect(sel.rows.map((r) => r.id)).toEqual(['b', 'a'])
    expect(sel.fallbacks).toEqual([])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
