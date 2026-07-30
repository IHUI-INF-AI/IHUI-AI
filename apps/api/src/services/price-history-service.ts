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
 * 动态调价建议:查最近 7d llm_call_logs,按 model 聚合利润率,给出调价建议。
 *
 * 聚合逻辑:
 * - revenue = AVG(cost_cents)(用户实付)
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
  // NULLIF 防除零;COALESCE 防 metadata 缺失 multiplier
  const rows = await dbRead
    .select({
      modelId: llmCallLogs.model,
      avgRevenueCents: sql<number>`coalesce(avg(${llmCallLogs.costCents}), 0)::numeric::int`,
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
    const revenue = Number(row.avgRevenueCents ?? 0)
    const avgMultiplier = Number(row.avgMultiplier ?? 1) || 1
    const cost = avgMultiplier > 0 ? revenue / avgMultiplier : revenue
    const marginRate = revenue > 0 ? (revenue - cost) / revenue : 0

    const currentMultiplier = await getCurrentMultiplier(row.modelId)

    let suggestedMultiplier = currentMultiplier
    let reason: string
    if (revenue <= 0) {
      reason = '近 7 天无有效收入数据,维持当前倍率'
      suggestedMultiplier = currentMultiplier
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

    suggestions.push({
      modelId: row.modelId,
      currentMultiplier,
      suggestedMultiplier,
      reason,
      avgCostCentsPerCall: Math.round(cost),
      avgRevenueCentsPerCall: Math.round(revenue),
      marginRate: Number(marginRate.toFixed(4)),
    })
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
