// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 按日积分消耗聚合(只读)。数据源 = point_transactions(type='spend')。
// 分桶口径:UTC 日期(与 utils/checkin-helpers.ts 的 todayString/shiftDate 同一 UTC 约定);
// 区间内无消耗的日期补零;区间上限由路由层 Zod 约束(days ≤ MAX_CREDITS_USAGE_DAYS),
// 任意值不拼接进 SQL(天数只参与 JS 侧日期偏移,查询参数全部走 drizzle 占位符)。

import { and, eq, gte, sql } from 'drizzle-orm'
import { chatConversations, pointTransactions } from '@ihui/database'
import { db } from '../db/index.js'
import { shiftDate } from '../utils/checkin-helpers.js'

/** 分桶时区(唯一口径,前端热力图 dateKey 与之逐位对应) */
const CREDITS_USAGE_TIMEZONE = 'UTC' as const
/** 查询区间天数上限 */
export const MAX_CREDITS_USAGE_DAYS = 365

export interface DailyUsageBucket {
  /** YYYY-MM-DD(UTC) */
  date: string
  /** 当日消耗笔数 */
  count: number
  /** 当日消耗积分总量(point_transactions.amount 存负数,取 ABS 求和,恒 ≥0) */
  points: number
  /**
   * 当日**新建会话数**(chat_conversations.created_at 分桶)。
   * 口径说明:它是"当天开了多少个会话",与积分消耗**无因果**——积分消耗按 token 计,
   * 而 spend 流水的 reference_id 存的是 HTTP 请求 id(proxy-llm.ts 实测),没有会话维度外键。
   * 所以"会话视图"与"热力视图"是两条独立序列,不得互相换算,也不得被读成"该会话花了多少"。
   */
  sessions: number
}

export interface CreditsDailyUsage {
  days: number
  startDate: string
  endDate: string
  timezone: typeof CREDITS_USAGE_TIMEZONE
  /** 按 date 升序、区间内逐日补零后的完整桶序列(长度 = days) */
  buckets: DailyUsageBucket[]
}

/** GROUP BY 的原始行(count/points 在 pg 驱动下可能是字符串,统一在 buildBuckets 归一) */
interface RawUsageRow {
  date: string | null
  count: number | string | null
  points: number | string | null
}

/** Date → UTC 日期键 YYYY-MM-DD(边界:23:59:59.999Z 仍属当日,00:00:00Z 属次日) */
export function utcDateKey(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** UTC 日期表达式:to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') */
function usageDateSql() {
  return sql<string>`to_char(${pointTransactions.createdAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`
}

function toFiniteNumber(v: number | string | null | undefined): number {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}

/**
 * 把 GROUP BY 原始行归并为 [startDate, endDate] 的逐日序列:
 * 缺失日期补零(count=0,points=0),区间外的原始行丢弃,结果按日期升序。
 */
export function buildBuckets(
  raw: readonly RawUsageRow[],
  startDate: string,
  endDate: string,
  sessionsByDate?: ReadonlyMap<string, number>,
): DailyUsageBucket[] {
  const byDate = new Map<string, { count: number; points: number }>()
  for (const row of raw) {
    if (!row.date) continue
    const prev = byDate.get(row.date) ?? { count: 0, points: 0 }
    prev.count += toFiniteNumber(row.count)
    prev.points += toFiniteNumber(row.points)
    byDate.set(row.date, prev)
  }
  const buckets: DailyUsageBucket[] = []
  const total = daySpan(startDate, endDate)
  for (let i = 0; i < total; i += 1) {
    const date = shiftDate(startDate, i)
    const hit = byDate.get(date)
    buckets.push({
      date,
      count: hit?.count ?? 0,
      points: hit?.points ?? 0,
      sessions: sessionsByDate?.get(date) ?? 0,
    })
  }
  return buckets
}

function daySpan(startDate: string, endDate: string): number {
  const startMs = Date.parse(`${startDate}T00:00:00.000Z`)
  const endMs = Date.parse(`${endDate}T00:00:00.000Z`)
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) return 0
  return Math.floor((endMs - startMs) / 86_400_000) + 1
}

/**
 * 查询某用户最近 `days` 天(含今日,UTC)的按日积分消耗聚合。纯只读,不写表。
 */
export async function getDailyCreditsUsage(input: {
  userId: string
  days: number
  now?: Date
}): Promise<CreditsDailyUsage> {
  const days = Math.min(Math.max(1, Math.trunc(input.days)), MAX_CREDITS_USAGE_DAYS)
  const now = input.now ?? new Date()
  const endDate = utcDateKey(now)
  const startDate = shiftDate(endDate, -(days - 1))
  const dateExpr = usageDateSql()

  const rows = await db
    .select({
      date: dateExpr,
      count: sql<number>`COUNT(*)`,
      points: sql<number>`COALESCE(SUM(ABS(${pointTransactions.amount})), 0)`,
    })
    .from(pointTransactions)
    .where(
      and(
        eq(pointTransactions.userId, input.userId),
        eq(pointTransactions.type, 'spend'),
        gte(pointTransactions.createdAt, new Date(`${startDate}T00:00:00.000Z`)),
      ),
    )
    .groupBy(dateExpr)

  const sinceDate = new Date(`${startDate}T00:00:00.000Z`)
  const convDateExpr = sql<string>`to_char(${chatConversations.createdAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`
  const convRows = await db
    .select({
      date: convDateExpr,
      sessions: sql<number>`COUNT(*)`,
    })
    .from(chatConversations)
    .where(
      and(eq(chatConversations.userId, input.userId), gte(chatConversations.createdAt, sinceDate)),
    )
    .groupBy(convDateExpr)

  const sessionsByDate = new Map<string, number>()
  for (const row of convRows) {
    if (!row.date) continue
    sessionsByDate.set(row.date, toFiniteNumber(row.sessions))
  }

  return {
    days,
    startDate,
    endDate,
    timezone: CREDITS_USAGE_TIMEZONE,
    buckets: buildBuckets(rows, startDate, endDate, sessionsByDate),
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
