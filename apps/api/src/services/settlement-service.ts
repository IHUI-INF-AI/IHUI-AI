/**
 * 结算服务 —— 将智能体购买按月度切分为结算记录。
 *
 * 迁移自旧架构 app/utils/settlement_helper.py。
 * 新架构使用 Drizzle ORM 查询 agent_settlements 表。
 *
 * 核心能力：
 * - calculateMonthlyPeriods：将一个时间区间按自然月切分为多个结算周期
 * - createSettlementRecords：为指定 agent + 周期生成结算记录（写入 agent_settlements）
 */

import { and, eq, gte, lte, sql } from 'drizzle-orm'
import { db, dbRead } from '../db/index.js'
import { agentSettlements, agents, type AgentSettlement } from '@ihui/database'

// =============================================================================
// 类型定义
// =============================================================================

/** 月度结算周期。 */
export interface MonthlyPeriod {
  /** 周期起始时间（含） */
  start: Date
  /** 周期结束时间（含） */
  end: Date
  /** 期数序号（从 1 开始） */
  issueNo: number
}

/** 结算周期生成结果。 */
export interface PeriodResult {
  /** 原始起始时间 */
  from: Date
  /** 原始结束时间 */
  to: Date
  /** 切分后的月度周期列表 */
  periods: MonthlyPeriod[]
}

/** 结算记录创建入参。 */
export interface CreateSettlementRecordInput {
  agentId: string
  /** 关联的购买记录 ID */
  buyRecordId?: string | null
  /** 关联的订单号 */
  orderNo?: string | null
  /** 结算周期 */
  period: MonthlyPeriod
  /** 结算金额（分） */
  amount?: number
  /** 佣金比例（万分比） */
  commissionRate?: number
  /** 佣金金额（分） */
  commissionAmount?: number
  /** 结算状态，默认 unsettled */
  status?: string
}

/** 结算汇总。 */
export interface SettlementSummary {
  orderNo: string
  totalPeriods: number
  settledPeriods: number
  unsettledPeriods: number
  settlementRate: number
}

// =============================================================================
// 月度切分
// =============================================================================

/**
 * 计算指定年份月份的起止时间。
 *
 * @param year 年份（如 2025）
 * @param month 月份（1-12）
 * @returns 该月第一天的 00:00:00 与下月第一天的 00:00:00（作为不含上界）
 */
export function calculateMonthBoundaries(
  year: number,
  month: number,
): {
  start: Date
  end: Date
} {
  const start = new Date(year, month - 1, 1, 0, 0, 0, 0)
  // 下月第一天 = 本月最后一天 + 1ms 的不含上界
  const end = new Date(year, month, 1, 0, 0, 0, 0)
  return { start, end }
}

/**
 * 将 [from, to] 时间区间按自然月切分为多个结算周期。
 *
 * 规则（迁移自 Python calculate_monthly_periods）：
 * - 从 from 开始，每次推进到下月第一天
 * - 若下月第一天超过 to，则以 to 作为最后一个周期的结束
 * - 每个周期的 start 为上一个周期的 end（或 from），end 为下月第一天 / to
 *
 * @param from 起始时间（含）
 * @param to 结束时间（含）
 * @returns 切分后的月度周期列表（按时间升序，issueNo 从 1 开始）
 */
export function calculateMonthlyPeriods(from: Date, to: Date): PeriodResult {
  if (from >= to) {
    return { from, to, periods: [] }
  }

  const periods: MonthlyPeriod[] = []
  let current = new Date(from)
  let issueNo = 1

  while (current < to) {
    // 下月第一天
    const nextMonth = new Date(current.getFullYear(), current.getMonth() + 1, 1, 0, 0, 0, 0)

    const periodEnd = nextMonth > to ? new Date(to) : nextMonth

    periods.push({
      start: new Date(current),
      end: periodEnd,
      issueNo,
    })

    current = nextMonth
    issueNo++
  }

  return { from, to, periods }
}

/**
 * 按 year/month 计算该月的结算周期（单月）。
 *
 * 便捷方法：等价于 calculateMonthlyPeriods(monthStart, monthEnd) 但只返回该月一个周期。
 *
 * @param year 年份
 * @param month 月份（1-12）
 */
export function calculateMonthlyPeriodsForMonth(year: number, month: number): PeriodResult {
  const { start, end } = calculateMonthBoundaries(year, month)
  // 单月场景：直接返回一个周期
  return {
    from: start,
    to: end,
    periods: [{ start, end, issueNo: 1 }],
  }
}

// =============================================================================
// 结算记录生成
// =============================================================================

/**
 * 为指定 agent + 周期创建一条结算记录。
 *
 * 写入 agent_settlements 表，状态默认 unsettled。
 *
 * @param input 结算记录入参
 * @returns 创建的结算记录
 */
export async function createSettlementRecord(
  input: CreateSettlementRecordInput,
): Promise<AgentSettlement> {
  const rows = await db
    .insert(agentSettlements)
    .values({
      agentId: input.agentId,
      buyRecordId: input.buyRecordId ?? null,
      orderNo: input.orderNo ?? null,
      amount: input.amount ?? 0,
      commissionRate: input.commissionRate ?? 0,
      commissionAmount: input.commissionAmount ?? 0,
      status: input.status ?? 'unsettled',
    })
    .returning()
  const row = rows[0]
  if (!row) {
    throw new Error(`Failed to create settlement record for agent ${input.agentId}`)
  }
  return row
}

/**
 * 为指定 agent 按结算周期批量生成结算记录。
 *
 * 迁移自 Python create_settlement_records。
 *
 * @param agentId 智能体 ID
 * @param period 单个结算周期
 * @param options 附加字段（orderNo / buyRecordId / amount / commission*）
 * @returns 创建的结算记录列表
 */
export async function createSettlementRecords(
  agentId: string,
  period: MonthlyPeriod,
  options?: Omit<CreateSettlementRecordInput, 'agentId' | 'period'>,
): Promise<AgentSettlement[]> {
  // 幂等检查：同一 agent + orderNo + issueNo 范围内已存在记录则跳过
  if (options?.orderNo) {
    const existing = await dbRead
      .select({ id: agentSettlements.id })
      .from(agentSettlements)
      .where(
        and(eq(agentSettlements.agentId, agentId), eq(agentSettlements.orderNo, options.orderNo)),
      )
      .limit(1)
    if (existing.length > 0) {
      return []
    }
  }

  const record = await createSettlementRecord({
    agentId,
    period,
    buyRecordId: options?.buyRecordId,
    orderNo: options?.orderNo,
    amount: options?.amount,
    commissionRate: options?.commissionRate,
    commissionAmount: options?.commissionAmount,
    status: options?.status,
  })

  return [record]
}

/**
 * 为指定 agent 在 [from, to] 区间内按月度切分并批量生成结算记录。
 *
 * @param agentId 智能体 ID
 * @param from 起始时间
 * @param to 结束时间
 * @param options 附加字段
 * @returns 创建的结算记录列表
 */
export async function createSettlementRecordsForRange(
  agentId: string,
  from: Date,
  to: Date,
  options?: Omit<CreateSettlementRecordInput, 'agentId' | 'period'>,
): Promise<AgentSettlement[]> {
  const { periods } = calculateMonthlyPeriods(from, to)
  const created: AgentSettlement[] = []

  for (const period of periods) {
    const records = await createSettlementRecords(agentId, period, options)
    created.push(...records)
  }

  return created
}

// =============================================================================
// 查询与汇总
// =============================================================================

/**
 * 查询指定 agent 在某时间范围内的结算记录。
 */
export async function findSettlementsByAgentAndRange(
  agentId: string,
  from: Date,
  to: Date,
): Promise<AgentSettlement[]> {
  return dbRead
    .select()
    .from(agentSettlements)
    .where(
      and(
        eq(agentSettlements.agentId, agentId),
        gte(agentSettlements.createdAt, from),
        lte(agentSettlements.createdAt, to),
      ),
    )
    .orderBy(agentSettlements.createdAt)
}

/**
 * 按订单号汇总结算进度。
 *
 * 迁移自 Python get_settlement_summary。
 */
export async function getSettlementSummary(orderNo: string): Promise<SettlementSummary> {
  const rows = await dbRead
    .select({
      total: sql<number>`count(*)::int`,
      settled: sql<number>`count(*) filter (where ${agentSettlements.status} = 'settled')::int`,
      unsettled: sql<number>`count(*) filter (where ${agentSettlements.status} = 'unsettled')::int`,
    })
    .from(agentSettlements)
    .where(eq(agentSettlements.orderNo, orderNo))

  const r = rows[0]
  const total = r?.total ?? 0
  const settled = r?.settled ?? 0
  const unsettled = r?.unsettled ?? 0

  return {
    orderNo,
    totalPeriods: total,
    settledPeriods: settled,
    unsettledPeriods: unsettled,
    settlementRate: total > 0 ? Math.round((settled / total) * 10000) / 100 : 0,
  }
}

/**
 * 检查订单是否已有结算记录（幂等判断）。
 */
export async function hasSettlementForOrder(orderNo: string): Promise<boolean> {
  const rows = await dbRead
    .select({ id: agentSettlements.id })
    .from(agentSettlements)
    .where(eq(agentSettlements.orderNo, orderNo))
    .limit(1)
  return rows.length > 0
}

/**
 * 获取 agent 名称（用于结算记录的 agent_name 冗余字段）。
 */
export async function getAgentName(agentId: string): Promise<string | null> {
  const rows = await dbRead
    .select({ name: agents.name })
    .from(agents)
    .where(eq(agents.agentId, agentId))
    .limit(1)
  return rows[0]?.name ?? null
}
