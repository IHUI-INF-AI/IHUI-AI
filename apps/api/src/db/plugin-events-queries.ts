import { gte, desc, sql, count } from 'drizzle-orm'
import { db } from './index.js'
import { pluginEvents, type PluginEvent } from '@ihui/database'

// =============================================================================
// 事件写入(append-only)
// =============================================================================

export type PluginEventType = 'click' | 'install' | 'uninstall' | 'pin' | 'unpin'

export interface RecordPluginEventInput {
  pluginId: string
  eventType: PluginEventType
  userId?: string | null
  ip?: string | null
}

/**
 * 记录插件事件。失败时只 log,不抛(埋点不能阻塞主业务)。
 */
export async function recordPluginEvent(
  input: RecordPluginEventInput,
): Promise<PluginEvent | undefined> {
  try {
    const rows = await db
      .insert(pluginEvents)
      .values({
        pluginId: input.pluginId,
        eventType: input.eventType,
        userId: input.userId ?? null,
        ip: input.ip ?? null,
      })
      .returning()
    return rows[0]
  } catch (err) {
    // 表未创建 / DB 不可达:埋点失败不阻塞主流程
    console.warn('[plugin-events] record failed:', err instanceof Error ? err.message : err)
    return undefined
  }
}

// =============================================================================
// Admin 统计聚合
// =============================================================================

export interface PluginStatsRow {
  pluginId: string
  installs: number
  uninstalls: number
  clicks: number
  pins: number
  unpins: number
  heat: number
}

export interface PluginStatsSummary {
  totalEvents: number
  totalInstalls: number
  totalUninstalls: number
  totalClicks: number
  totalPins: number
  totalUnpins: number
  todayInstalls: number
  todayClicks: number
}

export interface PluginTrendRow {
  date: string
  installs: number
  clicks: number
  uninstalls: number
}

/**
 * 总览:6 个核心指标 + 今日安装 / 今日点击。
 */
export async function getPluginStatsSummary(days: number): Promise<PluginStatsSummary> {
  const since = sql`now() - interval '${sql.raw(String(days))} days'`
  const [row] = await db
    .select({
      totalEvents: count(),
      totalInstalls: sql<number>`count(*) filter (where ${pluginEvents.eventType} = 'install')`,
      totalUninstalls: sql<number>`count(*) filter (where ${pluginEvents.eventType} = 'uninstall')`,
      totalClicks: sql<number>`count(*) filter (where ${pluginEvents.eventType} = 'click')`,
      totalPins: sql<number>`count(*) filter (where ${pluginEvents.eventType} = 'pin')`,
      totalUnpins: sql<number>`count(*) filter (where ${pluginEvents.eventType} = 'unpin')`,
      todayInstalls: sql<number>`count(*) filter (where ${pluginEvents.eventType} = 'install' and ${pluginEvents.createdAt} >= current_date)`,
      todayClicks: sql<number>`count(*) filter (where ${pluginEvents.eventType} = 'click' and ${pluginEvents.createdAt} >= current_date)`,
    })
    .from(pluginEvents)
    .where(gte(pluginEvents.createdAt, since))
  return (
    (row as PluginStatsSummary) ?? {
      totalEvents: 0,
      totalInstalls: 0,
      totalUninstalls: 0,
      totalClicks: 0,
      totalPins: 0,
      totalUnpins: 0,
      todayInstalls: 0,
      todayClicks: 0,
    }
  )
}

/**
 * 按插件聚合:安装 / 卸载 / 点击 / 置顶 / 取消置顶 / 热度。
 * 热度公式: heat = installs * 10 + clicks * 1 + pins * 20 - uninstalls * 5
 */
export async function getPluginStatsByPlugin(days: number, limit: number): Promise<PluginStatsRow[]> {
  const since = sql`now() - interval '${sql.raw(String(days))} days'`
  const rows = await db
    .select({
      pluginId: pluginEvents.pluginId,
      installs: sql<number>`count(*) filter (where ${pluginEvents.eventType} = 'install')`,
      uninstalls: sql<number>`count(*) filter (where ${pluginEvents.eventType} = 'uninstall')`,
      clicks: sql<number>`count(*) filter (where ${pluginEvents.eventType} = 'click')`,
      pins: sql<number>`count(*) filter (where ${pluginEvents.eventType} = 'pin')`,
      unpins: sql<number>`count(*) filter (where ${pluginEvents.eventType} = 'unpin')`,
    })
    .from(pluginEvents)
    .where(gte(pluginEvents.createdAt, since))
    .groupBy(pluginEvents.pluginId)
    .orderBy(desc(sql`installs * 10 + clicks + pins * 20 - uninstalls * 5`))
    .limit(limit)

  return rows.map((r) => ({
    pluginId: r.pluginId,
    installs: Number(r.installs ?? 0),
    uninstalls: Number(r.uninstalls ?? 0),
    clicks: Number(r.clicks ?? 0),
    pins: Number(r.pins ?? 0),
    unpins: Number(r.unpins ?? 0),
    heat: Number(r.installs ?? 0) * 10 + Number(r.clicks ?? 0) + Number(r.pins ?? 0) * 20 - Number(r.uninstalls ?? 0) * 5,
  }))
}

/**
 * 趋势:按天聚合 installs / clicks / uninstalls。
 */
export async function getPluginStatsTrend(days: number): Promise<PluginTrendRow[]> {
  const since = sql`now() - interval '${sql.raw(String(days))} days'`
  const rows = await db
    .select({
      date: sql<string>`to_char(${pluginEvents.createdAt}, 'YYYY-MM-DD')`,
      installs: sql<number>`count(*) filter (where ${pluginEvents.eventType} = 'install')`,
      clicks: sql<number>`count(*) filter (where ${pluginEvents.eventType} = 'click')`,
      uninstalls: sql<number>`count(*) filter (where ${pluginEvents.eventType} = 'uninstall')`,
    })
    .from(pluginEvents)
    .where(gte(pluginEvents.createdAt, since))
    .groupBy(sql`1`)
    .orderBy(sql`1`)
  return rows.map((r) => ({
    date: String(r.date),
    installs: Number(r.installs ?? 0),
    clicks: Number(r.clicks ?? 0),
    uninstalls: Number(r.uninstalls ?? 0),
  }))
}
