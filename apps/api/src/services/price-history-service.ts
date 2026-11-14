// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 价格历史 + 限时折扣调度 + 动态调价建议服务(2026-08-01 立)。
 *
 * 职责:
 * 1. recordPriceChange: 记录调价快照(改倍率/改单价时调,只增不改)
 * 2. getPriceHistory: 查价格历史(前端趋势曲线用)
 * 3. getActiveDiscounts: 查当前生效的限时折扣(计费时叠加)
 * 4. getPricingSuggestions: 动态调价建议(按 7d 调用流水聚合利润率)
 *
 * 数据来源:
 * - model_price_history: 调价快照(只增不改,审计追溯)
 * - price_discount_schedules: 限时折扣调度(预设生效/失效)
 * - llm_call_logs: 调用流水(costCents = 用户实付,metadata.multiplier = 倍率,upstream = costCents/multiplier)
 *
 * 利润率定义:
 * - revenue = costCents(用户实付,= llm_call_logs.cost_cents)
 * - cost = costCents / multiplier(上游成本,从 metadata.multiplier 反推)
 * - marginRate = (revenue - cost) / revenue
 *
 * 调价建议策略:
 * - marginRate < 0.10 (< 10%) → 建议提价(+0.20 倍率)
 * - marginRate > 0.50 (> 50%) → 建议降价(-0.10 倍率,抢占市场)
 * - 否则 → 维持当前倍率
 */
import { eq, and, gte, lte, asc, desc, sql, isNull, or } from 'drizzle-orm'
import { db, dbRead } from '../db/index.js'
import {
  modelPriceHistory,
  priceDiscountSchedules,
  llmCallLogs,
  type PriceDiscountSchedule,
} from '@ihui/database'

// =============================================================================
// 类型定义
// =============================================================================

export interface RecordPriceChangeInput {
  modelId: string
  inputTokenPriceCents: number
  outputTokenPriceCents: number
  relayMultiplier: number
  reason?: string
  changedBy?: string
}

export interface PriceHistoryEntry {
  effectiveAt: Date
  inputTokenPriceCents: number
  outputTokenPriceCents: number
  relayMultiplier: number
  reason: string | null
}

export interface PricingSuggestion {
  modelId: string
  currentMultiplier: number
  suggestedMultiplier: number
  reason: string
  avgCostCentsPerCall: number
  avgRevenueCentsPerCall: number
  marginRate: number
}

/** 7d 聚合行(dbRead 结果;numeric 可能以字符串返回) */
export interface PricingAggregateRow {
  modelId: string
  /** 平均单次实付(分);null 表示窗口内没有任何「成功且 cost_cents 非空」的调用 */
  avgRevenueCents: number | string | null
  /** 平均倍率;NULL/非法值按 1.0 处理 */
  avgMultiplier: number | string | null
  callCount?: number | string | null
}

// =============================================================================
// 辅助函数
// =============================================================================

/**
 * 去 LiteLLM 自定义前缀(stepfun/agnes),返回 DB 中存储的原始 model_id。
 * 与 tiered-pricing-service.ts 的 stripLiteLLMPrefix 逻辑一致。
 */
function stripLiteLLMPrefix(model: string): string {
  const slashIdx = model.indexOf('/')
  if (slashIdx > 0) {
    const prefix = model.slice(0, slashIdx)
    if (prefix === 'stepfun' || prefix === 'agnes') {
      return model.slice(slashIdx + 1)
    }
  }
  return model
}

/** 解析 numeric 倍率为 number(默认 1.0) */
function parseMultiplier(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : 1
}

/**
 * 查指定模型的当前倍率(取 model_price_history 中最新一条的 relay_multiplier)。
 * 优先精确匹配,无则尝试去 LiteLLM 前缀的匹配。无历史记录返回 1.0。
 */
async function getCurrentMultiplier(rawModel: string): Promise<number> {
  const candidates = [rawModel, stripLiteLLMPrefix(rawModel)]
  for (const candidate of candidates) {
    const [row] = await dbRead
      .select({ multiplier: modelPriceHistory.relayMultiplier })
      .from(modelPriceHistory)
      .where(eq(modelPriceHistory.modelId, candidate))
      .orderBy(desc(modelPriceHistory.effectiveAt))
      .limit(1)
    if (row) {
      return parseMultiplier(row.multiplier)
    }
  }
  return 1
}

// =============================================================================
// 1. recordPriceChange — 记录调价快照
// =============================================================================

/**
 * 记录调价快照(改倍率/改单价时调)。
 * 只增不改:每次调用插入一条新记录,不更新历史记录。
 * effectiveAt 默认为当前时间(可由调用方指定未来时间预设调价)。
 */
export async function recordPriceChange(input: RecordPriceChangeInput): Promise<void> {
  await db.insert(modelPriceHistory).values({
    modelId: input.modelId,
    inputTokenPriceCents: input.inputTokenPriceCents,
    outputTokenPriceCents: input.outputTokenPriceCents,
    relayMultiplier: String(input.relayMultiplier),
    effectiveAt: new Date(),
    reason: input.reason ?? null,
    changedBy: input.changedBy ?? null,
  })
}

// =============================================================================
// 2. getPriceHistory — 查价格历史(趋势曲线)
// =============================================================================

/**
 * 查指定模型的价格历史(按 effectiveAt 升序,前端趋势曲线用)。
 * days 默认 30 天(只返回最近 N 天的记录);传 0 或不传查全部。
 * 优先精确匹配 modelId,无则尝试去 LiteLLM 前缀的匹配。
 */
export async function getPriceHistory(
  modelId: string,
  days?: number,
): Promise<PriceHistoryEntry[]> {
  const candidates = [modelId, stripLiteLLMPrefix(modelId)]

  for (const candidate of candidates) {
    const effectiveCutoff =
      days && days > 0 ? new Date(Date.now() - days * 24 * 60 * 60 * 1000) : null

    const conds = [eq(modelPriceHistory.modelId, candidate)]
    if (effectiveCutoff) {
      conds.push(gte(modelPriceHistory.effectiveAt, effectiveCutoff))
    }

    const rows = await dbRead
      .select({
        effectiveAt: modelPriceHistory.effectiveAt,
        inputTokenPriceCents: modelPriceHistory.inputTokenPriceCents,
        outputTokenPriceCents: modelPriceHistory.outputTokenPriceCents,
        relayMultiplier: modelPriceHistory.relayMultiplier,
        reason: modelPriceHistory.reason,
      })
      .from(modelPriceHistory)
      .where(conds.length > 1 ? and(...conds) : conds[0]!)
      .orderBy(asc(modelPriceHistory.effectiveAt))

    if (rows.length > 0) {
      return rows.map((r) => ({
        effectiveAt: r.effectiveAt,
        inputTokenPriceCents: r.inputTokenPriceCents,
        outputTokenPriceCents: r.outputTokenPriceCents,
        relayMultiplier: parseMultiplier(r.relayMultiplier),
        reason: r.reason,
      }))
    }
  }

  return []
}

// =============================================================================
// 3. getActiveDiscounts — 查当前生效的限时折扣
// =============================================================================

/**
 * 查当前生效的限时折扣(计费时叠加在 relay_multiplier 之上)。
 * 条件:enabled = true AND starts_at <= now AND ends_at > now
 */
export async function getActiveDiscounts(): Promise<PriceDiscountSchedule[]> {
  const now = new Date()
  return dbRead
    .select()
    .from(priceDiscountSchedules)
    .where(
      and(
        eq(priceDiscountSchedules.enabled, true),
        lte(priceDiscountSchedules.startsAt, now),
        gte(priceDiscountSchedules.endsAt, now),
      ),
    )
    .orderBy(asc(priceDiscountSchedules.startsAt))
}

// =============================================================================
// 4. getPricingSuggestions — 动态调价建议
// =============================================================================

/**
 * 由聚合行 + 当前倍率算出定价建议(纯函数,不触库)。
 *
 * 精度口径(F-634,2026-11-13):
 * - revenue 用**未截断**的平均值参与 marginRate 计算与阈值判断;
 * - 只在最终输出字段上 round(1e-6 / 4 位小数),聚合阶段不得取整到分。
 *   低价模型 avg(cost_cents)=0.4 分若先 ::int 变 0,会被误判成"无有效收入",
 *   永远拿不到提价/降价建议。
 * - `avgRevenueCents === null` 才是"确实没有数据";`0` 是"有数据但均值为 0"。
 */
export function buildPricingSuggestion(
  row: PricingAggregateRow,
  currentMultiplier: number,
): PricingSuggestion {
  const parsedRevenue = Number(row.avgRevenueCents)
  const hasRevenueData =
    row.avgRevenueCents !== null &&
    row.avgRevenueCents !== undefined &&
    Number.isFinite(parsedRevenue)
  const revenue = hasRevenueData ? parsedRevenue : 0

  const parsedMultiplier = Number(row.avgMultiplier)
  const avgMultiplier =
    Number.isFinite(parsedMultiplier) && parsedMultiplier > 0 ? parsedMultiplier : 1
  const cost = revenue / avgMultiplier
  const marginRate = revenue > 0 ? (revenue - cost) / revenue : 0

  let suggestedMultiplier = currentMultiplier
  let reason: string
  if (!hasRevenueData) {
    reason = '近 7 天无有效收入数据,维持当前倍率'
  } else if (revenue <= 0) {
    reason = '近 7 天有调用但平均单次收入为 0 分,维持当前倍率'
  } else if (marginRate < 0.1) {
    // 利润率 < 10%,建议提价 +0.20
    suggestedMultiplier = Math.round((currentMultiplier + 0.2) * 100) / 100
    reason = `利润率 ${(marginRate * 100).toFixed(1)}% 偏低(< 10%),建议提价以覆盖渠道成本`
  } else if (marginRate > 0.5) {
    // 利润率 > 50%,建议降价 -0.10 抢占市场
    suggestedMultiplier = Math.max(0.01, Math.round((currentMultiplier - 0.1) * 100) / 100)
    reason = `利润率 ${(marginRate * 100).toFixed(1)}% 较高(> 50%),建议降价抢占市场`
  } else {
    reason = `利润率 ${(marginRate * 100).toFixed(1)}% 处于合理区间(10%-50%),维持当前倍率`
  }

  return {
    modelId: row.modelId,
    currentMultiplier,
    suggestedMultiplier,
    reason,
    // 保留 6 位小数:低价模型平均单次成本/收入在整数分下恒显示 0(2026-09-13)
    avgCostCentsPerCall: Math.round(cost * 1e6) / 1e6,
    avgRevenueCentsPerCall: Math.round(revenue * 1e6) / 1e6,
    marginRate: Number(marginRate.toFixed(4)),
  }
}

/**
 * 动态调价建议:查最近 7d llm_call_logs,按 model 聚合利润率,给出调价建议。
 *
 * 聚合逻辑:
 * - revenue = AVG(cost_cents)(用户实付,保留小数精度,不在 SQL 里取整)
 * - multiplier = AVG((metadata->>'multiplier')::numeric)(本次调用所用倍率,防 NULL 用 1.0)
 * - cost = revenue / multiplier(上游成本反推)
 * - marginRate = (revenue - cost) / revenue
 *
 * 建议策略:
 * - marginRate < 0.10 → 建议提价(currentMultiplier + 0.20)
 * - marginRate > 0.50 → 建议降价(currentMultiplier - 0.10)
 * - 否则 → 建议维持(currentMultiplier)
 *
 * 仅聚合 status='success' 且 cost_cents IS NOT NULL 的调用(排除错误/免费调用)。
 */
export async function getPricingSuggestions(): Promise<PricingSuggestion[]> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  // 按模型聚合:平均实付、平均倍率(从 metadata 反推上游成本)
  // F-634:平均实付保留 numeric 小数,不得 ::int 截断(否则 avg<0.5 分的模型 revenue 变 0);
  // 不 COALESCE 成 0,让 NULL 可区分「确实没有数据」与「有数据但均值为 0」。
  // NULLIF 防除零;COALESCE 防 metadata 缺失 multiplier
  const rows = await dbRead
    .select({
      modelId: llmCallLogs.model,
      avgRevenueCents: sql<number | null>`avg(${llmCallLogs.costCents})::numeric`,
      avgMultiplier: sql<number>`coalesce(
        avg(coalesce(nullif(${llmCallLogs.metadata}->>'multiplier', '')::numeric, 1.0)),
        1.0
      )::numeric::float4`,
      callCount: sql<number>`count(*)::int`,
    })
    .from(llmCallLogs)
    .where(
      and(
        gte(llmCallLogs.createdAt, sevenDaysAgo),
        eq(llmCallLogs.status, 'success'),
        sql`${llmCallLogs.costCents} IS NOT NULL`,
      ),
    )
    .groupBy(llmCallLogs.model)
    .having(sql`count(*) >= 1`)

  const suggestions: PricingSuggestion[] = []
  for (const row of rows) {
    const currentMultiplier = await getCurrentMultiplier(row.modelId)
    suggestions.push(buildPricingSuggestion(row, currentMultiplier))
  }

  // 按利润率升序(利润率最低的排前面,最需要关注)
  suggestions.sort((a, b) => a.marginRate - b.marginRate)

  return suggestions
}

// =============================================================================
// 5. admin 辅助:折扣调度 CRUD
// =============================================================================

export interface CreateDiscountInput {
  name: string
  modelId?: string | null
  discountMultiplier: number
  startsAt: Date
  endsAt: Date
  enabled?: boolean
  createdBy?: string
}

export interface UpdateDiscountInput {
  name?: string
  modelId?: string | null
  discountMultiplier?: number
  startsAt?: Date
  endsAt?: Date
  enabled?: boolean
}

/** 查全部折扣调度(可按 enabled/modelId 筛选) */
export async function listDiscountSchedules(filter?: {
  enabled?: boolean
  modelId?: string
}): Promise<PriceDiscountSchedule[]> {
  const conds = []
  if (filter?.enabled !== undefined) {
    conds.push(eq(priceDiscountSchedules.enabled, filter.enabled))
  }
  if (filter?.modelId !== undefined) {
    // modelId = null 表示全部模型,筛选时同时匹配精确 modelId 和 NULL
    conds.push(
      or(
        eq(priceDiscountSchedules.modelId, filter.modelId),
        isNull(priceDiscountSchedules.modelId),
      )!,
    )
  }

  return dbRead
    .select()
    .from(priceDiscountSchedules)
    .where(conds.length > 0 ? and(...conds) : undefined)
    .orderBy(desc(priceDiscountSchedules.startsAt))
}

/** 创建折扣调度 */
export async function createDiscountSchedule(
  input: CreateDiscountInput,
): Promise<PriceDiscountSchedule> {
  const [row] = await db
    .insert(priceDiscountSchedules)
    .values({
      name: input.name,
      modelId: input.modelId ?? null,
      discountMultiplier: String(input.discountMultiplier),
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      enabled: input.enabled ?? true,
      createdBy: input.createdBy ?? null,
    })
    .returning()

  if (!row) {
    throw new Error('create_discount_failed')
  }
  return row
}

/** 更新折扣调度 */
export async function updateDiscountSchedule(
  id: string,
  input: UpdateDiscountInput,
): Promise<PriceDiscountSchedule | null> {
  const setClause: Record<string, unknown> = {}
  if (input.name !== undefined) setClause.name = input.name
  if (input.modelId !== undefined) setClause.modelId = input.modelId
  if (input.discountMultiplier !== undefined)
    setClause.discountMultiplier = String(input.discountMultiplier)
  if (input.startsAt !== undefined) setClause.startsAt = input.startsAt
  if (input.endsAt !== undefined) setClause.endsAt = input.endsAt
  if (input.enabled !== undefined) setClause.enabled = input.enabled

  if (Object.keys(setClause).length === 0) {
    return null
  }

  const [row] = await db
    .update(priceDiscountSchedules)
    .set(setClause)
    .where(eq(priceDiscountSchedules.id, id))
    .returning()

  return row ?? null
}

/** 删除折扣调度 */
export async function deleteDiscountSchedule(id: string): Promise<boolean> {
  const [row] = await db
    .delete(priceDiscountSchedules)
    .where(eq(priceDiscountSchedules.id, id))
    .returning({ id: priceDiscountSchedules.id })
  return !!row
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
