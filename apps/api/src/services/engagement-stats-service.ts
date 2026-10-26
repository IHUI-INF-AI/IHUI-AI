// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 行为埋点实时快照(2026-10-26 立,大屏「交互热度」面板的数据源)。
 *
 * 立因:`analytics_events` 里已有 page_view / click / page_time / route_change 等事件
 * (2026-08-10 起采集),但大屏只展示 `visit_logs` 的页面 PV/UV —— 「用户点了什么、
 * 停了多久」在监控面上不可见。本服务把 24h 窗口的事件分布、热门点击与平均停留时长
 * 聚合成一块,统一给 `/ops-wallboard/overview` 用。
 *
 * 三条口径:
 * 1. **窗口化**:固定 24h(`now() - interval`),不吃客户端传参,与访客/页面热度两块同窗。
 * 2. **失败不写 0**:任一 SQL 抛错整块上抛,由路由折成 null(大屏渲染"—")。
 * 3. **5 秒 TTL 之外另取 15 秒**:事件表没有 created_at 索引,量级增长后按 24h 聚合
 *    会变贵;15 秒足够大屏读,且把"每个观众每 5 秒打一次库"压成"全场共用一轮"。
 *    若将来 `analytics_events` 涨到百万级,正解是补索引 + 预聚合,而不是把 TTL 调回 5 秒。
 */

import { sql, and, eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { analyticsEvents } from '@ihui/database'

/** 窗口小时数(有界常量,SQL 只吃它,不吃外部字符串)。 */
const ENGAGEMENT_WINDOW_HOURS = 24
/** 进程内快照 TTL:事件表无 created_at 索引,放宽到 15 秒压库负载。 */
const ENGAGEMENT_LIVE_TTL_MS = 15_000

const EVENTS_LIMIT = 8
const CLICKS_LIMIT = 6
/** page_time 的 value 在 properties 里是字符串;非数字行不参与均值(不把脏行读成 0)。 */
const PAGE_TIME_NUMERIC = sql`case
  when ${analyticsEvents.properties}->>'value' ~ '^[0-9]+(\\.[0-9]+)?$'
  then (${analyticsEvents.properties}->>'value')::numeric
  else null
end`

export interface EngagementLiveSnapshot {
  /** 近 24h 事件类型分布(降序) */
  events: Array<{ event: string; n: number }>
  /** 近 24h 点击热度(按 label 聚合,降序) */
  clickTop: Array<{ label: string; n: number }>
  /** 近 24h 平均页面停留秒数;null = 窗口内没有合法的 page_time */
  avgPageTimeSec: number | null
  /** 近 24h 事件总数(所有类型求和) */
  totalEvents: number
  computedAtMs: number
}

/** 现算一份;任一 SQL 抛错整块上抛(调用方折 null,绝不兜成 0)。 */
async function computeEngagementLiveSnapshot(): Promise<EngagementLiveSnapshot> {
  const start = sql`now() - make_interval(hours => ${ENGAGEMENT_WINDOW_HOURS})`
  const inWindow = sql`${analyticsEvents.createdAt} >= ${start}`
  const clickLabel = sql<string>`coalesce(${analyticsEvents.properties}->>'label', '(no label)')`
  const [byEvent, clicks, pageTimeRows] = await Promise.all([
    db
      .select({ event: analyticsEvents.event, n: sql<number>`count(*)::int` })
      .from(analyticsEvents)
      .where(inWindow)
      .groupBy(analyticsEvents.event)
      .orderBy(sql`count(*) desc`)
      .limit(EVENTS_LIMIT),
    db
      .select({ label: clickLabel, n: sql<number>`count(*)::int` })
      .from(analyticsEvents)
      .where(and(inWindow, eq(analyticsEvents.event, 'click')))
      .groupBy(clickLabel)
      .orderBy(sql`count(*) desc`)
      .limit(CLICKS_LIMIT),
    db
      .select({ avgSec: sql<number | null>`avg(${PAGE_TIME_NUMERIC})` })
      .from(analyticsEvents)
      .where(and(inWindow, eq(analyticsEvents.event, 'page_time'))),
  ])
  const events = byEvent.map((r) => ({ event: r.event, n: Number(r.n ?? 0) }))
  const avgRaw = pageTimeRows[0]?.avgSec
  return {
    events,
    clickTop: clicks.map((r) => ({ label: r.label, n: Number(r.n ?? 0) })),
    avgPageTimeSec: avgRaw === null || avgRaw === undefined ? null : Number(avgRaw),
    totalEvents: events.reduce((sum, e) => sum + e.n, 0),
    computedAtMs: Date.now(),
  }
}

let cache: { atMs: number; value: EngagementLiveSnapshot } | null = null
let inflight: Promise<EngagementLiveSnapshot> | null = null

/** 取一份"最多 TTL 毫秒前"的快照;失败不入缓存,下个请求重试。 */
export async function getEngagementLiveSnapshot(
  ttlMs: number = ENGAGEMENT_LIVE_TTL_MS,
): Promise<EngagementLiveSnapshot> {
  const nowMs = Date.now()
  if (cache && nowMs - cache.atMs < ttlMs) return cache.value
  if (inflight) return inflight
  const current = (async () => {
    try {
      const value = await computeEngagementLiveSnapshot()
      cache = { atMs: value.computedAtMs, value }
      return value
    } finally {
      inflight = null
    }
  })()
  inflight = current
  return current
}

/** 仅测试用:清缓存。 */
export function __resetEngagementLiveCacheForTest(): void {
  cache = null
  inflight = null
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
