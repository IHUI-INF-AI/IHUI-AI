// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 中转成本口径唯一出口(F-628,2026-11-11)。
 *
 * 写侧事实:`services/relay-billing-service.ts` 的 `recordCallInternal()` 自 2026-08-01 起
 * 把成本写进**顶层列** `llm_call_logs.cost_cents`(numeric(18,6),单位:分),
 * 见 `costCents: isCacheHit ? 0 : (input.costCents ?? costCentsToDeduct)`。
 * `metadata` 里没有整单成本键 —— 只有 multiplier / pricingSource / billingMode 等审计键,
 * BYOK 行的 `metadata.upstreamCostCents`、`metadata.platformFeeCents` 是上游成本与平台抽成,
 * 都不是"本次调用对客成本"。因此任何 `metadata->>'costCents'` 的读取都恒为 NULL(汇总恒 0)。
 *
 * 约定:
 * - 线上聚合一律 `sum(cost_cents)` 下推到 DB,再做 `::bigint`(防 int32 溢出),
 *   由调用方 `Number()` 收口;
 * - `extractCostCents()` 只服务"行已在 JS 里"的历史/导入数据兜底,
 *   不是线上聚合的数据来源。
 */
import { sql, type SQL } from 'drizzle-orm'

/** 已是"分"的历史键(写侧迁移前可能出现在外部导入/历史快照里)。 */
const CENTS_KEYS = ['costCents', 'cost_cents'] as const
/** 以"元"计价的历史键,归一化时 ×100。 */
const YUAN_KEYS = ['cost', 'costYuan', 'cost_yuan'] as const

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed === '') return null
    const parsed = Number(trimmed)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

/** 负值/NaN/Infinity 一律按 0,避免把异常数据带进财务汇总。 */
function normalizeCents(value: number): number {
  const rounded = Math.round(value)
  return rounded > 0 ? rounded : 0
}

/**
 * 从 metadata 形状的对象里归一化出整数"分"。
 *
 * 口径:`costCents` / `cost_cents` 视为分;`cost` / `costYuan` / `cost_yuan` 视为元。
 * 缺失、非数字、负数、NaN、Infinity → 0;数字字符串按数字处理。
 */
export function extractCostCents(metadata: unknown): number {
  if (metadata === null || typeof metadata !== 'object' || Array.isArray(metadata)) return 0
  const m = metadata as Record<string, unknown>

  for (const key of CENTS_KEYS) {
    const cents = toFiniteNumber(m[key])
    if (cents !== null) return normalizeCents(cents)
  }
  for (const key of YUAN_KEYS) {
    const yuan = toFiniteNumber(m[key])
    if (yuan !== null) return normalizeCents(yuan * 100)
  }
  return 0
}

/**
 * 成本合计(分),SQL 聚合下推。
 *
 * 直接引用真实列 `llm_call_logs.cost_cents`,不再读 metadata JSON 键;
 * `::bigint` 避免 `sum` 结果超出 int32 后在 DB 侧报错/截断。
 */
export function sumRelayCostCentsSql(): SQL<number> {
  return sql<number>`coalesce(sum(cost_cents), 0)::bigint`
}

/** 单行成本列引用(供 CASE / HAVING 等需要逐行值的原生 SQL 片段复用)。 */
export function relayCostCentsColumnSql(): SQL<number> {
  return sql<number>`cost_cents`
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
