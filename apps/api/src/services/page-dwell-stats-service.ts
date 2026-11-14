// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 页面级平均停留时长实时快照(2026-10-27 立,大屏「页面使用排行」每页停留列的数据源)。
 *
 * 立因:`analytics_events` 里从 2026-08-10 起就已在 `useRouteAnalytics` 里采集
 * `page_time` 事件(label = 上一页路径,value = 停留秒数),`engagement-stats-service`
 * 也已经在算**全站平均**停留。但大屏「页面使用排行」面板只给每页 PV/UV/占比,
 * 不回答「这一页平均被停多久」—— 而停留时长恰恰是「页面级使用数据」的一维
 * (PV 高但秒跳 = 进来看一眼就走;PV 中但停留久 = 真在用)。本服务把 `page_time`
 * 按页面(归一后的 label)拆开算均值,直接喂给排行面板补这一列。
 *
 * 与 engagement / session-quality / audience 同一套范式:
 * 1. **窗口化**:固定 24h(`now() - interval`),不吃客户端传参,与页面热度 / 访客两块同窗。
 * 2. **失败不写 0**:任一 SQL 抛错整块上抛,由路由折成 null(大屏渲染"—")。
 * 3. **复用既有事件 schema**:事件名 `page_time`、键 `value`/`label` 全是
 *    `analytics.ts` 头注里登记过的命名,不新发明第二套;脏值(value 非数字)不参与均值。
 * 4. **页面归一单一真相源**:label 经 `normalizeVisitPath` 归一到与 `visit_logs.url`
 *    同一把尺(动态段→:id、剥 query/凭据、去尾部斜杠),这样排行面板的 PV 行和
 *    停留行才能按 url 精确对上;归不到页面的 label(静态资源 / 路由组形态)直接丢弃。
 * 5. **15 秒 TTL**:与 engagement 同因 —— `analytics_events` 无 created_at 索引,
 *    24h 聚合压库,放宽 TTL 把"每观众每 5 秒打一次库"压成"全场共用一轮"。
 */

import { sql, and, eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { analyticsEvents } from '@ihui/database'
import { normalizeVisitPath } from '@ihui/shared/utils/visit-url'

/** 窗口小时数(有界常量,SQL 只吃它,不吃外部字符串)。 */
const PAGE_DWELL_WINDOW_HOURS = 24
/** 排行最多返回多少页(与 visit_logs 排行 TOP 对齐,略放宽以便对得上)。 */
const PAGE_DWELL_TOP_N = 12
/** 进程内快照 TTL:事件表无 created_at 索引,放宽到 15 秒压库负载。 */
const PAGE_DWELL_LIVE_TTL_MS = 15_000

/** page_time 的 value 在 properties 里是字符串;非数字行不参与均值(不把脏行读成 0)。 */
const PAGE_TIME_NUMERIC = sql`case
  when ${analyticsEvents.properties}->>'value' ~ '^[0-9]+(\\.[0-9]+)?$'
  then (${analyticsEvents.properties}->>'value')::numeric
  else null
end`

/** label = 上一页路径(原始);归一交给 TS 侧的 normalizeVisitPath。 */
const LABEL_EXPR = sql<string>`coalesce(${analyticsEvents.properties}->>'label', '')`

export interface PageDwellLiveRow {
  /** 归一后的页面路径(与 visit_logs.url 同尺,可直接对排行) */
  url: string
  /** 近 24h 该页面平均停留秒数;null = 窗口内该页没有合法的 page_time */
  avgDwellSec: number | null
  /** 近 24h 该页面有效 page_time 样本数(均值分母) */
  samples: number
}

export interface PageDwellLiveSnapshot {
  rows: PageDwellLiveRow[]
  computedAtMs: number
}

/** 现算一份;任一 SQL 抛错整块上抛(调用方折 null,绝不兜成 0)。 */
async function computePageDwellLiveSnapshot(): Promise<PageDwellLiveSnapshot> {
  const start = sql`now() - make_interval(hours => ${PAGE_DWELL_WINDOW_HOURS})`
  const inWindow = sql`${analyticsEvents.createdAt} >= ${start}`
  const grouped = await db
    .select({
      label: LABEL_EXPR,
      avgSec: sql<number | null>`avg(${PAGE_TIME_NUMERIC})`,
      n: sql<number>`count(*)::int`,
    })
    .from(analyticsEvents)
    .where(
      and(
        inWindow,
        eq(analyticsEvents.event, 'page_time'),
        sql`${analyticsEvents.properties}->>'label' is not null`,
        sql`${PAGE_TIME_NUMERIC} is not null`,
      ),
    )
    .groupBy(LABEL_EXPR)
    .orderBy(sql`avg(${PAGE_TIME_NUMERIC}) desc nulls last`)
    .limit(PAGE_DWELL_TOP_N)

  const rows: PageDwellLiveRow[] = []
  for (const r of grouped) {
    const url = normalizeVisitPath(r.label)
    if (!url) continue
    const avgRaw = r.avgSec
    if (avgRaw === null || avgRaw === undefined) continue
    rows.push({ url, avgDwellSec: Number(avgRaw), samples: Number(r.n ?? 0) })
  }
  return { rows, computedAtMs: Date.now() }
}

let cache: { atMs: number; value: PageDwellLiveSnapshot } | null = null
let inflight: Promise<PageDwellLiveSnapshot> | null = null

/** 取一份"最多 TTL 毫秒前"的快照;失败不入缓存,下个请求重试。 */
export async function getPageDwellLiveSnapshot(
  ttlMs: number = PAGE_DWELL_LIVE_TTL_MS,
): Promise<PageDwellLiveSnapshot> {
  const nowMs = Date.now()
  if (cache && nowMs - cache.atMs < ttlMs) return cache.value
  if (inflight) return inflight
  const current = (async () => {
    try {
      const value = await computePageDwellLiveSnapshot()
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
export function __resetPageDwellLiveCacheForTest(): void {
  cache = null
  inflight = null
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
