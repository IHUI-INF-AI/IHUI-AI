/**
 * 下载量统计服务 — 2026-08-06 新增。
 *
 * trackEvent:记录用户点击下载按钮的事件(静默失败,不阻断下载)。
 * getStats:聚合查询下载统计(管理员用,失败抛错由路由返回 500)。
 */

import { randomUUID } from 'crypto'
import { eq, and, sql, type SQL } from 'drizzle-orm'
import { db, dbRead } from '../db/index.js'
import { downloadEvents } from '@ihui/database'

/** trackEvent 入参 */
export interface TrackEventInput {
  userId: string | null
  platform: string
  assetHref: string | null
  source: string
  ip: string | null
  userAgent: string | null
}

/** getStats 入参 */
export interface StatsQuery {
  platform?: string
  startDate?: string
  endDate?: string
}

/** getStats 返回结构 */
export interface DownloadStats {
  total: number
  byPlatform: Record<string, number>
  byDate: Array<{ date: string; count: number }>
}

/**
 * 记录一次下载点击事件。
 * 静默失败:数据库写入失败时只记录日志,不抛错,始终返回 eventId。
 * 设计原因:不能因统计落库失败阻断用户的下载点击。
 */
export async function trackEvent(input: TrackEventInput): Promise<{ eventId: string }> {
  const eventId = randomUUID()
  try {
    await db.insert(downloadEvents).values({
      id: eventId,
      userId: input.userId,
      platform: input.platform,
      assetHref: input.assetHref,
      source: input.source,
      ip: input.ip,
      userAgent: input.userAgent,
    })
  } catch (e) {
    console.error('[download-stats] trackEvent insert failed:', e)
  }
  return { eventId }
}

/**
 * 聚合查询下载统计。
 * 支持 platform / startDate / endDate 可选筛选。
 * 失败时抛错,由路由层 catch 返回 500。
 */
export async function getStats(query: StatsQuery): Promise<DownloadStats> {
  const conditions: SQL[] = []
  if (query.platform) {
    conditions.push(eq(downloadEvents.platform, query.platform))
  }
  if (query.startDate) {
    conditions.push(sql`${downloadEvents.createdAt} >= ${query.startDate}::date`)
  }
  if (query.endDate) {
    // endDate 含当天:截止到次日 00:00
    conditions.push(sql`${downloadEvents.createdAt} < (${query.endDate}::date + INTERVAL '1 day')`)
  }
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  const dateExpr = sql<string>`to_char(${downloadEvents.createdAt}::date, 'YYYY-MM-DD')`

  const [totalRows, platformRows, dateRows] = await Promise.all([
    dbRead
      .select({ total: sql<number>`count(*)::int` })
      .from(downloadEvents)
      .where(whereClause),
    dbRead
      .select({ platform: downloadEvents.platform, count: sql<number>`count(*)::int` })
      .from(downloadEvents)
      .where(whereClause)
      .groupBy(downloadEvents.platform),
    dbRead
      .select({ date: dateExpr, count: sql<number>`count(*)::int` })
      .from(downloadEvents)
      .where(whereClause)
      .groupBy(dateExpr)
      .orderBy(dateExpr),
  ])

  const byPlatform: Record<string, number> = {}
  for (const row of platformRows) {
    byPlatform[row.platform] = row.count
  }

  return {
    total: totalRows[0]?.total ?? 0,
    byPlatform,
    byDate: dateRows.map((row) => ({ date: row.date, count: row.count })),
  }
}
