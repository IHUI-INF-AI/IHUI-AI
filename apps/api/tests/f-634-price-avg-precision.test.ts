// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-634 回归锁(2026-11-13)。
 *
 * 病灶:getPricingSuggestions 在 SQL 聚合阶段就 `avg(cost_cents)::numeric::int`,
 * 平均单次实付 < 0.5 分的低价模型 revenue 先被四舍五入成 0,永远落进
 * 「近 7 天无有效收入数据」分支,拿不到提价/降价建议。
 *
 * 本文件锁:
 *   ① 旧口径复刻:avg=0.4 分 → ::int 变 0 → 「无有效收入」(证明病灶真实存在);
 *   ② 新口径:未截断均值参与 marginRate,avg=0.4 分 → 利润率 0% → 建议提价;
 *   ③ 输出保留小数:avgRevenueCentsPerCall=0.4,不再是 0;
 *   ④ avg IS NULL(确实没数据) 与 avg=0(有数据但均值 0)结论必须不同;
 *   ⑤ 高利润率分支仍可达(0.4 分 / 倍率 5 → 80% → 降价),阈值口径未回归;
 *   ⑥ 源锁:聚合 SQL 不得再出现 `::numeric::int`,必须走导出的纯函数算建议。
 *
 * 不连库:db 模块整体替身,只测从 service 导出的纯函数,零 SQL、零 PG。
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

const NO_DATA_REASON = '近 7 天无有效收入数据,维持当前倍率'

/**
 * 旧口径复刻(仅供对照):SQL 聚合已把均值取整到分。
 * 与修复前 getPricingSuggestions 的 revenue 计算一致。
 */
function legacySuggestion(
  avgCents: number,
  avgMultiplier: number,
  currentMultiplier: number,
): { reason: string; suggestedMultiplier: number } {
  const revenue = Math.round(avgCents) // 旧 SQL: avg(cost_cents)::numeric::int
  const cost = avgMultiplier > 0 ? revenue / avgMultiplier : revenue
  const marginRate = revenue > 0 ? (revenue - cost) / revenue : 0
  if (revenue <= 0) {
    return { reason: NO_DATA_REASON, suggestedMultiplier: currentMultiplier }
  }
  if (marginRate < 0.1) {
    return {
      reason: `利润率 ${(marginRate * 100).toFixed(1)}% 偏低(< 10%),建议提价以覆盖渠道成本`,
      suggestedMultiplier: Math.round((currentMultiplier + 0.2) * 100) / 100,
    }
  }
  if (marginRate > 0.5) {
    return {
      reason: `利润率 ${(marginRate * 100).toFixed(1)}% 较高(> 50%),建议降价抢占市场`,
      suggestedMultiplier: Math.max(0.01, Math.round((currentMultiplier - 0.1) * 100) / 100),
    }
  }
  return {
    reason: `利润率 ${(marginRate * 100).toFixed(1)}% 处于合理区间(10%-50%),维持当前倍率`,
    suggestedMultiplier: currentMultiplier,
  }
}

describe('F-634 定价建议不得在聚合阶段截断平均单次收入', () => {
  it('旧口径复现:avg=0.4 分被截成 0,落入"无有效收入"', () => {
    const legacy = legacySuggestion(0.4, 1, 1)
    expect(legacy.reason).toBe(NO_DATA_REASON)
    expect(legacy.suggestedMultiplier).toBe(1)
  })

  it('新口径:avg=0.4 分仍能算出建议(利润率 0% → 提价 +0.20)', () => {
    const s = buildPricingSuggestion(
      { modelId: 'low-price-model', avgRevenueCents: 0.4, avgMultiplier: 1 },
      1,
    )
    expect(s.reason).not.toBe(NO_DATA_REASON)
    expect(s.reason).toContain('偏低')
    expect(s.suggestedMultiplier).toBe(1.2)
    expect(s.marginRate).toBe(0)
    // 输出保留小数,不能显示 0 分
    expect(s.avgRevenueCentsPerCall).toBe(0.4)
    expect(s.avgCostCentsPerCall).toBe(0.4)
  })

  it('新口径:avg=0.4 分 + 倍率 5(利润率 80%)仍能建议降价', () => {
    const legacy = legacySuggestion(0.4, 5, 1)
    expect(legacy.reason).toBe(NO_DATA_REASON)

    const s = buildPricingSuggestion(
      { modelId: 'low-price-model', avgRevenueCents: 0.4, avgMultiplier: 5 },
      1,
    )
    expect(s.reason).toContain('较高')
    expect(s.suggestedMultiplier).toBe(0.9)
    expect(s.marginRate).toBe(0.8)
    expect(s.avgRevenueCentsPerCall).toBe(0.4)
  })

  it('avg IS NULL(确实没数据)才走"无有效收入",且不改倍率', () => {
    const s = buildPricingSuggestion(
      { modelId: 'no-data-model', avgRevenueCents: null, avgMultiplier: null },
      1.5,
    )
    expect(s.reason).toBe(NO_DATA_REASON)
    expect(s.suggestedMultiplier).toBe(1.5)
    expect(s.avgRevenueCentsPerCall).toBe(0)
    expect(s.marginRate).toBe(0)
  })

  it('avg=0 是"有数据但均值为 0",结论必须与无数据不同', () => {
    const zero = buildPricingSuggestion(
      { modelId: 'zero-revenue-model', avgRevenueCents: 0, avgMultiplier: 1 },
      1.5,
    )
    expect(zero.reason).not.toBe(NO_DATA_REASON)
    expect(zero.reason).toContain('平均单次收入为 0 分')
    expect(zero.suggestedMultiplier).toBe(1.5)
  })

  it('numeric 以字符串返回时口径不变(0.4 与 "0.4" 结果一致)', () => {
    const fromString = buildPricingSuggestion(
      { modelId: 'low-price-model', avgRevenueCents: '0.4', avgMultiplier: '1' },
      1,
    )
    const fromNumber = buildPricingSuggestion(
      { modelId: 'low-price-model', avgRevenueCents: 0.4, avgMultiplier: 1 },
      1,
    )
    expect(fromString).toEqual(fromNumber)
  })

  it('源锁:聚合 SQL 不得再 ::numeric::int,建议必须走纯函数', () => {
    const src = readFileSync(
      fileURLToPath(new URL('../src/services/price-history-service.ts', import.meta.url)),
      'utf8',
    )
    expect(src).not.toContain('coalesce(avg(${llmCallLogs.costCents}), 0)::numeric::int')
    expect(src).toContain('buildPricingSuggestion(row, currentMultiplier)')
  })
})
