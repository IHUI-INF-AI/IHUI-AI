// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * F-662 回归锁(2026-11-14,按 db21c929c66 落地的 relay/BYOK 分账实现)。
 *
 * 病灶:getPricingSuggestions 用 `cost = revenue / avgMultiplier` 反推上游成本。
 *   BYOK 行 multiplier 恒 1、cost_cents 只记平台抽成,真实上游成本在
 *   metadata.upstreamCostCents —— 读侧既不取该键,也不排除 BYOK 行,
 *   于是 BYOK 占比高的模型利润率被抽成口径稀释。
 *
 * 修复:聚合按 byokMode 分账:
 *   - relay 行进 avgRevenueCents / avgMultiplier(利润率口径不变);
 *   - BYOK 行单列 byokCallCount / avgByokFeeCents / avgByokUpstreamCostCents,
 *     真实上游成本读 metadata.upstreamCostCents,不混入 relay 利润率。
 *
 * 本锁为"纯函数行为锁 + 源码接线锁"混合(与 f-524/f-634 同型),不连库。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, it, expect, vi } from 'vitest'

vi.mock('../src/db/index.js', () => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn() },
  dbRead: { select: vi.fn() },
  dbClient: {},
}))

import { buildPricingSuggestion } from '../src/services/price-history-service.js'

const serviceSrc = readFileSync(
  fileURLToPath(new URL('../src/services/price-history-service.ts', import.meta.url)),
  'utf8',
)
const billingSrc = readFileSync(
  fileURLToPath(new URL('../src/services/relay-billing-service.ts', import.meta.url)),
  'utf8',
)
const routeSrc = readFileSync(
  fileURLToPath(new URL('../src/routes/admin/relay-pricing.ts', import.meta.url)),
  'utf8',
)

describe('F-662 定价建议:BYOK 与 relay 分账,不再用抽成反推成本', () => {
  it('relay 行利润率口径不变,不被 BYOK 均值稀释', () => {
    const r = buildPricingSuggestion(
      {
        modelId: 'mixed-model',
        avgRevenueCents: 10,
        avgMultiplier: 2,
        byokCallCount: 3,
        avgByokFeeCents: 0.5,
        avgByokUpstreamCostCents: 5,
      },
      1,
    )
    expect(r.avgCostCentsPerCall).toBe(5)
    expect(r.marginRate).toBe(0.5)
    expect(r.reason).toContain('合理区间')
  })

  it('BYOK 抽成与真实上游成本单列,不替换 relay 的成本反推', () => {
    const r = buildPricingSuggestion(
      {
        modelId: 'byok-model',
        avgRevenueCents: 0.5,
        avgMultiplier: 1,
        byokCallCount: '2',
        avgByokFeeCents: '0.5',
        avgByokUpstreamCostCents: '5',
      },
      1,
    )
    expect(r.byokCallCount).toBe(2)
    expect(r.avgByokFeeCentsPerCall).toBe(0.5)
    expect(r.avgByokUpstreamCostCentsPerCall).toBe(5)
    // relay 口径仍是 revenue / multiplier;B YOK 上游成本只单列展示
    expect(r.avgCostCentsPerCall).toBe(0.5)
  })

  it('无 relay 收入(null)时不冒提价建议,但 BYOK 数据照常输出', () => {
    const r = buildPricingSuggestion(
      {
        modelId: 'byok-only',
        avgRevenueCents: null,
        avgMultiplier: null,
        byokCallCount: 4,
        avgByokFeeCents: 1,
        avgByokUpstreamCostCents: 6,
      },
      1.5,
    )
    expect(r.reason).toContain('无有效收入')
    expect(r.suggestedMultiplier).toBe(1.5)
    expect(r.byokCallCount).toBe(4)
    expect(r.avgByokUpstreamCostCentsPerCall).toBe(6)
  })

  it('源锁:relay 聚合排除 BYOK,BYOK 聚合读取 upstreamCostCents', () => {
    expect(serviceSrc).toContain(
      "coalesce(${llmCallLogs.metadata}->>'byokMode', 'false') <> 'true'",
    )
    expect(serviceSrc).toContain("${llmCallLogs.metadata}->>'byokMode' = 'true'")
    expect(serviceSrc).toContain(
      "nullif(${llmCallLogs.metadata}->>'upstreamCostCents', '')::numeric",
    )
    expect(serviceSrc).toContain('byokCallCount')
    expect(serviceSrc).toContain('avgByokUpstreamCostCents')
  })

  it('接线锁:写侧落 metadata.upstreamCostCents,路由仍走 getPricingSuggestions', () => {
    expect(billingSrc).toContain('metadata.upstreamCostCents = upstreamCostCents')
    expect(routeSrc).toContain('getPricingSuggestions()')
  })
})
