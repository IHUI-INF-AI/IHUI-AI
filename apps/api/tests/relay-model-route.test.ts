// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 模型路由区域判据 —— 纯判据测试(mock 零 IO;不连库、不出网)。
 *
 * 2026-11-17 立(对标 qoder2api-hub「双区 catalog + 别名与独占表」那一格)。
 * 要钉住的是四条会静默出错的判据,而不是覆盖率数字:
 *   T1 区归一:任意大小写/别名写法 → cn|global;判不了 ⇒ null(不猜)。
 *   T2 账号区:minimax/zcode 的 region/regions 取得到;workbuddy 不在本层判(防两份实现);
 *      脏 jsonb/未知值 ⇒ null ⇒ 区过滤恒放行。
 *   T3 三段前缀:`qoder/global/x` 显式区;`qoder/tokyo/x` 退化为两段(不产生半成品);
 *      非平台首段一律不认(渠道模型不被误吞)。
 *   T4 规则与歧义:内置独占表;同一 match 命中多区 ⇒ ambiguous=true 且 region=null;
 *      env 档非法条目整条丢弃并点名;显式三段永不被规则覆盖。
 */
import { describe, it, expect } from 'vitest'

import {
  normalizeRegion,
  accountRegionOfRow,
  parseProviderPrefix,
  parseModelRegionEnv,
  resolveModelRoute,
  BUILTIN_MODEL_REGION_RULES,
  ROUTE_REGIONS,
  __test__ as R,
} from '../src/services/relay-model-route.js'
import { DEFAULT_RELAY_POOL_POLICY, selectPoolOrdered } from '../src/services/relay-pool-policy.js'

const isProvider = (v: string): boolean => ['qoder', 'minimax', 'zcode', 'workbuddy'].includes(v)

// ── T1 区归一 ───────────────────────────────────────────────────────────────

describe('normalizeRegion', () => {
  it('标准键与常见别名都归到两档', () => {
    expect(normalizeRegion('cn')).toBe('cn')
    expect(normalizeRegion(' CN ')).toBe('cn')
    expect(normalizeRegion('China')).toBe('cn')
    expect(normalizeRegion('domestic')).toBe('cn')
    expect(normalizeRegion('global')).toBe('global')
    expect(normalizeRegion('INTL')).toBe('global')
    expect(normalizeRegion('international')).toBe('global')
    expect(normalizeRegion('overseas')).toBe('global')
  })

  it('判不了 ⇒ null(不猜、不默认成 cn)', () => {
    expect(normalizeRegion(undefined)).toBeNull()
    expect(normalizeRegion(null)).toBeNull()
    expect(normalizeRegion('')).toBeNull()
    expect(normalizeRegion('  ')).toBeNull()
    expect(normalizeRegion('tokyo')).toBeNull()
    expect(normalizeRegion(1)).toBeNull()
    expect(normalizeRegion({ region: 'cn' })).toBeNull()
  })

  it('枚举只有两档(新增区必须同笔改测试与归一表)', () => {
    expect(ROUTE_REGIONS).toEqual(['cn', 'global'])
  })
})

// ── T2 账号行 → 区 ─────────────────────────────────────────────────────────

describe('accountRegionOfRow', () => {
  it('minimax 单值 region 取得到', () => {
    expect(accountRegionOfRow({ providerCode: 'minimax', extraMetadata: { region: 'cn' } })).toBe(
      'cn',
    )
  })

  it('regions 数组取首个有效项', () => {
    expect(
      accountRegionOfRow({ providerCode: 'zcode', extraMetadata: { regions: ['global', 'cn'] } }),
    ).toBe('global')
    expect(
      accountRegionOfRow({ providerCode: 'zcode', extraMetadata: { regions: ['bogus', 'cn'] } }),
    ).toBe('cn')
  })

  it('单值优先于数组(单一真相源的判序)', () => {
    expect(
      accountRegionOfRow({
        providerCode: 'zcode',
        extraMetadata: { region: 'cn', regions: ['global'] },
      }),
    ).toBe('cn')
  })

  it('workbuddy 不在本层判(域判定仍归 relay-pool-policy,防两份实现)', () => {
    expect(
      accountRegionOfRow({ providerCode: 'workbuddy', extraMetadata: { region: 'cn' } }),
    ).toBeNull()
  })

  it('脏输入 ⇒ null(区过滤恒放行,绝不静默排空)', () => {
    expect(accountRegionOfRow({ providerCode: 'minimax', extraMetadata: null })).toBeNull()
    expect(accountRegionOfRow({ providerCode: 'minimax', extraMetadata: '{not json' })).toBeNull()
    expect(accountRegionOfRow({ providerCode: 'minimax', extraMetadata: [1, 2] })).toBeNull()
    expect(
      accountRegionOfRow({ providerCode: 'minimax', extraMetadata: { region: 42 } }),
    ).toBeNull()
    expect(
      accountRegionOfRow({ providerCode: 'minimax', extraMetadata: { regions: 'cn' } }),
    ).toBeNull()
  })

  it('jsonb 以字符串落库时也能解(提取器/历史行形态)', () => {
    expect(
      accountRegionOfRow({ providerCode: 'minimax', extraMetadata: '{"region":"global"}' }),
    ).toBe('global')
  })
})

// ── T3 前缀解析 ────────────────────────────────────────────────────────────

describe('parseProviderPrefix', () => {
  it('两段形态:平台确定、区 null', () => {
    expect(parseProviderPrefix('qoder/Qwen3.8-Max', isProvider)).toEqual({
      providerCode: 'qoder',
      region: null,
      model: 'Qwen3.8-Max',
    })
  })

  it('三段形态:显式区', () => {
    expect(parseProviderPrefix('qoder/global/Qwen3.8-Max', isProvider)).toEqual({
      providerCode: 'qoder',
      region: 'global',
      model: 'Qwen3.8-Max',
    })
    expect(parseProviderPrefix('minimax/cn/MiniMax-M2.7', isProvider)).toEqual({
      providerCode: 'minimax',
      region: 'cn',
      model: 'MiniMax-M2.7',
    })
  })

  it('非法区段退化两段(上游允许 org/model 形态,不产生半成品)', () => {
    expect(parseProviderPrefix('qoder/tokyo/Qwen', isProvider)).toEqual({
      providerCode: 'qoder',
      region: null,
      model: 'tokyo/Qwen',
    })
  })

  it('非平台首段 / 空段 / 空模型 ⇒ null(渠道模型不被误吞)', () => {
    expect(parseProviderPrefix('openai/gpt-4o', isProvider)).toBeNull()
    expect(parseProviderPrefix('/gpt', isProvider)).toBeNull()
    expect(parseProviderPrefix('qoder/', isProvider)).toBeNull()
    expect(parseProviderPrefix('qoder', isProvider)).toBeNull()
    expect(parseProviderPrefix('qoder/global/', isProvider)).toBeNull()
  })
})

// ── T4 规则 / 歧义 / 显式优先 ──────────────────────────────────────────────

describe('resolveModelRoute', () => {
  it('显式三段:区由用户定,永不被规则覆盖', () => {
    const route = resolveModelRoute('qoder/cn/MiniMax-M3', { isProvider })
    expect(route).toMatchObject({
      providerCode: 'qoder',
      upstreamModel: 'MiniMax-M3',
      region: 'cn',
      ambiguous: false,
      matchedBy: 'provider_region_prefix',
    })
  })

  it('两段 + 内置独占表:q37fmodel 归国内', () => {
    const route = resolveModelRoute('qoder/q37fmodel', { isProvider })
    expect(route.region).toBe('cn')
    expect(route.providerCode).toBe('qoder')
    expect(route.matchedBy).toBe('rule_exact')
    expect(route.note).toBeTruthy()
  })

  it('裸名 + 已解析平台 ⇒ 走规则(客户端不必记前缀)', () => {
    const route = resolveModelRoute('glm-5.2', { isProvider, catalogProvider: 'qoder' })
    expect(route.providerCode).toBe('qoder')
    expect(route.region).toBe('cn')
    expect(route.upstreamModel).toBe('glm-5.2')
  })

  it('裸名且平台判不了 ⇒ 不套平台限定规则(不猜)', () => {
    const route = resolveModelRoute('glm-5.2', { isProvider })
    expect(route.providerCode).toBeNull()
    expect(route.region).toBeNull()
    expect(route.matchedBy).toBeNull()
  })

  it('两段命中规则时区也补上(平台 + 区同时确定)', () => {
    const route = resolveModelRoute('qoder/MiniMax-M3', { isProvider })
    expect(route.region).toBe('global')
    expect(route.matchedBy).toBe('rule_exact')
  })

  it('页面标注「同 key 跨区不同模型」的 mmodel 不立单向规则 ⇒ 未命中,不猜区', () => {
    const route = resolveModelRoute('mmodel', { isProvider })
    expect(route.region).toBeNull()
    expect(route.ambiguous).toBe(false)
    expect(route.matchedBy).toBeNull()
  })

  it('已登记平台兜底:规则未命中时 providerCode 取 catalogProvider', () => {
    const route = resolveModelRoute('Qwen3.8-Max', {
      isProvider,
      catalogProvider: 'qoder',
    })
    expect(route).toMatchObject({
      providerCode: 'qoder',
      upstreamModel: 'Qwen3.8-Max',
      region: null,
      matchedBy: null,
    })
  })

  it('env 追加规则可覆盖未内置的模型', () => {
    const extraRules = parseModelRegionEnv(
      JSON.stringify([
        {
          match: 'DeepSeek-V4-Pro',
          region: 'global',
          providerCode: 'qoder',
          note: '运维登记:国际线独占',
        },
      ]),
    ).rules
    const route = resolveModelRoute('DeepSeek-V4-Pro', {
      isProvider,
      extraRules,
      catalogProvider: 'qoder',
    })
    expect(route.region).toBe('global')
    expect(route.note).toContain('运维登记')
  })

  it('同轮多区命中 ⇒ ambiguous=true 且 region=null(绝不挑一个冒充结论)', () => {
    const extraRules = parseModelRegionEnv(
      JSON.stringify([
        { match: 'glm-5.2', region: 'global', providerCode: 'qoder', note: '与内置表冲突' },
      ]),
    ).rules
    const route = resolveModelRoute('glm-5.2', { isProvider, extraRules, catalogProvider: 'qoder' })
    expect(route.region).toBeNull()
    expect(route.ambiguous).toBe(true)
    expect(route.note).toContain('多个区')
  })

  it('前缀规则只作用于匹配段,且平台限定生效', () => {
    const extraRules = parseModelRegionEnv(
      JSON.stringify([
        { match: 'MiniMax-', mode: 'prefix', region: 'global', note: '国际线 MiniMax 族' },
        { match: 'gpt-', mode: 'prefix', region: 'cn', providerCode: 'other', note: '别家' },
      ]),
    ).rules
    expect(
      resolveModelRoute('MiniMax-M3', { isProvider, extraRules, catalogProvider: 'qoder' }).region,
    ).toBe('global')
    // 内置精确规则优先于 env 前缀规则
    expect(
      resolveModelRoute('MiniMax-M2.7', { isProvider, extraRules, catalogProvider: 'qoder' })
        .region,
    ).toBe('cn')
    // 平台限定不匹配 ⇒ 不命中;平台判不了 ⇒ 同样不命中(不猜)
    expect(resolveModelRoute('gpt-6', { isProvider, extraRules }).region).toBeNull()
    expect(
      resolveModelRoute('gpt-6', { isProvider, extraRules, catalogProvider: 'qoder' }).region,
    ).toBeNull()
  })
})

describe('parseModelRegionEnv', () => {
  it('非法条目整条丢弃并逐条点名', () => {
    const out = parseModelRegionEnv(
      JSON.stringify([
        { match: '', region: 'cn', note: 'x' },
        { match: 'a', region: 'tokyo', note: 'x' },
        { match: 'b', region: 'cn', note: '' },
        { match: 'c', region: 'cn', note: 'ok', mode: 'regex' },
        'not-an-object',
        { match: 'd', region: 'CN', note: '合法' },
      ]),
    )
    expect(out.rules).toHaveLength(1)
    expect(out.rules[0]?.match).toBe('d')
    expect(out.rejected).toHaveLength(5)
    expect(out.rejected.map((r) => r.index)).toEqual([0, 1, 2, 3, 4])
  })

  it('JSON 坏 / 空 / 缺 rules ⇒ 零规则且点名(不静默)', () => {
    expect(parseModelRegionEnv('{oops').rules).toHaveLength(0)
    expect(parseModelRegionEnv('{oops').rejected[0]?.reason).toContain('JSON')
    expect(parseModelRegionEnv('').rejected).toHaveLength(0)
    expect(parseModelRegionEnv('{"foo":[]}').rejected).toHaveLength(1)
  })

  it('内置表每条都有 note 与合法区(防「无理由规则」混进来)', () => {
    for (const rule of BUILTIN_MODEL_REGION_RULES) {
      expect(rule.note.length).toBeGreaterThan(8)
      expect(['cn', 'global']).toContain(rule.region)
    }
  })
})

// ── T5 选号管线:显式区的强制档 ────────────────────────────────────────────

describe('selectPoolOrdered 的显式区', () => {
  const rows = [
    {
      id: 'cn-1',
      providerCode: 'minimax',
      priority: 0,
      weight: 1,
      lastUsedAt: null,
      tokenExpiresAt: null,
      extraMetadata: { region: 'cn' },
    },
    {
      id: 'gl-1',
      providerCode: 'minimax',
      priority: 0,
      weight: 1,
      lastUsedAt: null,
      tokenExpiresAt: null,
      extraMetadata: { region: 'global' },
    },
    {
      id: 'unknown-1',
      providerCode: 'minimax',
      priority: 0,
      weight: 1,
      lastUsedAt: null,
      tokenExpiresAt: null,
      extraMetadata: {},
    },
  ]

  it('开关关 + 无显式区 ⇒ 不过滤(默认行为零变化)', () => {
    const out = selectPoolOrdered(rows, { policy: { ...DEFAULT_RELAY_POOL_POLICY } })
    expect(out.rows).toHaveLength(3)
    expect(out.fallbacks).toEqual([])
  })

  it('开关关 + 显式区 ⇒ 仍过滤(显式意图不被开关吞掉)', () => {
    const out = selectPoolOrdered(rows, {
      policy: { ...DEFAULT_RELAY_POOL_POLICY },
      explicitRegion: 'global',
    })
    // 判不了区的行恒保留(§0.3 永不排空纪律)
    expect(out.rows.map((r) => r.id).sort()).toEqual(['gl-1', 'unknown-1'])
    expect(out.fallbacks).toEqual([])
  })

  it('显式区会滤空 ⇒ 回落全集并带标签(绝不静默清零)', () => {
    // 只给一条「有区且与请求区不同」的行:过滤后 kept=0 ⇒ 必须回落全集
    const onlyCn = [rows[0] as (typeof rows)[number]]
    const out = selectPoolOrdered(onlyCn, {
      policy: { ...DEFAULT_RELAY_POOL_POLICY },
      explicitRegion: 'global',
    })
    expect(out.rows).toHaveLength(1)
    expect(out.rows[0]?.id).toBe('cn-1')
    expect(out.fallbacks).toContain('cross_domain_fallback')
  })

  it('显式区优先于亲和域', () => {
    const out = selectPoolOrdered(rows, {
      policy: { ...DEFAULT_RELAY_POOL_POLICY, crossDomainFallback: true },
      requestedDomain: 'cn',
      explicitRegion: 'global',
    })
    expect(out.rows.map((r) => r.id).sort()).toEqual(['gl-1', 'unknown-1'])
  })
})

// ── 测试出口形状锁 ─────────────────────────────────────────────────────────

describe('__test__ 出口', () => {
  it('只暴露判据,不暴露 IO', () => {
    expect(Object.keys(R)).toEqual(
      expect.arrayContaining(['normalizeRegion', 'accountRegionOfRow', 'resolveModelRoute']),
    )
    expect(R.REGION_ALIASES['cn']).toBe('cn')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
