// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 访客 PV/UV 聚合服务(2026-10-23 立,backing service for `traffic-stats-hourly`)。
 *
 * 要解决的格子:`visit_logs` / `api_logs` 里其实一直有真值可算 PV/UV,但这两个数
 * **从来没被发射成指标** —— 而 UV 的定义就是"按 IP / session 去重",是开放集,
 * 按本仓指标层纪律(见 `plugins/business-metrics.ts` 那条"开放集不入标签")绝不能
 * 变成 Prometheus 标签。正解因此只有一条:**在服务端把开放集聚合成一个数**,
 * 再把"这个窗口里有多少人"发成带*有界*标签(窗口 / 来源表 / 客户端族)的单值 gauge。
 *
 * 三条刻意的取舍,后果都写在这里而不是藏在代码里:
 * 1. **不建预聚合表、不出迁移**:另一路会话在飞,建表要占 drizzle 迁移编号会撞。
 *    所以聚合结果只活在指标进程的内存里 ⇒ **重启归零**:大屏上这两族只能看
 *    "本进程起来之后"的滚动窗口,历史 PV/UV 要回 `api_logs` / `visit_logs` 查。
 *    这个代价换来的是"今天就有可看的面",不是"等一张表立项"。
 * 2. **只在小时级 job 里跑**:2026-10-23 现读 `api_logs` 近 6 天 186231 行且
 *    **一条二级索引都没有** ⇒ 任何按 created_at 的聚合都是顺序扫描。所以这条链
 *    既不在 scrape 路径上、也不在任何请求路径上,只由 scheduler 每小时派一次;
 *    每次跑总共 4 条查询 × 2 张表,输出行数由预算钉住(见 `TRAFFIC_UA_KIND_BUDGET`)。
 *    api_logs 若涨到百万级,正解是给 created_at 加索引(需要迁移,见交付报告)。
 * 3. **失败不写 0**:查询抛了就跳过这一格并计入 `failures`,gauge 保持上一次的值 ——
 *    把"没测到"写成 0 就是造假数据(§0.3「没判」不许写成「判过」)。新鲜度另有一格
 *    `ihui_traffic_aggregation_last_success_timestamp_seconds` 可以自证。
 *
 * 族归一**只用 `utils/bot-detection.ts` 的 `classifyClientFamily`**(§0.6/§22c:
 * 同类判据全仓只许一份;指标面、告警面、面板面必须是同一把尺子),本文件不再抄第二份词表。
 */

import { sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { apiLogs, visitLogs } from '@ihui/database'
import { classifyClientFamily, type ClientFamily } from '../utils/bot-detection.js'
import {
  setTrafficGaugeSample,
  TRAFFIC_SOURCES,
  TRAFFIC_WINDOWS,
  type TrafficSource,
  type TrafficWindow,
} from '../plugins/business-metrics.js'

/** 窗口 → 小时数(唯一份;SQL 侧 make_interval 只吃这个数,不吃字符串拼接)。 */
export const TRAFFIC_WINDOW_HOURS: Record<TrafficWindow, number> = {
  '1h': 1,
  '24h': 24,
}

/**
 * 族分解的 UA 种类预算(GROUP BY user_agent 的输出行数上限)。
 * UA 原文是开放集,种类数不可预测 ⇒ 用"取满预算即标记截断"把它钉住:
 * 只把 PV 最高的 `TRAFFIC_UA_KIND_BUDGET` 种折进族里,其余不计并且把
 * `ihui_traffic_family_breakdown_truncated` 置 1 —— 族值是**下界**,不假装是总数。
 * (总数那两格 PV/UV 来自不带分组的聚合,不受这个预算影响,是精确值。)
 */
export const TRAFFIC_UA_KIND_BUDGET = 400

/** GROUP BY user_agent 的一行(UA 可能为 NULL ⇒ 折进 `no-ua` 族)。 */
export interface TrafficUaKindRow {
  userAgent: string | null
  pv: number
  uv: number
}

export interface TrafficFamilyFold {
  familyPageViews: Partial<Record<ClientFamily, number>>
  familyUniqueVisitors: Partial<Record<ClientFamily, number>>
  /** true = 折族时被预算截断过 ⇒ 上面两个族表只是下界 */
  truncated: boolean
  /** SQL 实际回传了多少种 UA(含被丢掉的尾部,用于取证) */
  uaKindsObserved: number
}

/**
 * 把"按 UA 原文分组"的行折成"按客户端族分组"。
 *
 * 纯函数(不碰 db)⇒ 用例能直接喂真 UA 验判据复用;族判定逐行走
 * `classifyClientFamily`,与本文件之外没有任何第二份族表。
 * 族级 UV 是**上界口径**:同一 IP 用两把 UA 会被计两次,所以它只用于
 * "真人 vs 自动化"的趋势比,账面 UV 一律看 `ihui_traffic_unique_visitors`。
 */
export function foldUaKindsToFamily(
  rows: readonly TrafficUaKindRow[],
  budget: number = TRAFFIC_UA_KIND_BUDGET,
): TrafficFamilyFold {
  const truncated = rows.length > budget
  const kept = truncated ? rows.slice(0, budget) : rows
  const familyPageViews: Partial<Record<ClientFamily, number>> = {}
  const familyUniqueVisitors: Partial<Record<ClientFamily, number>> = {}
  for (const row of kept) {
    const family = classifyClientFamily(row.userAgent)
    const pv = Number.isFinite(row.pv) && row.pv > 0 ? Math.floor(row.pv) : 0
    const uv = Number.isFinite(row.uv) && row.uv > 0 ? Math.floor(row.uv) : 0
    familyPageViews[family] = (familyPageViews[family] ?? 0) + pv
    familyUniqueVisitors[family] = (familyUniqueVisitors[family] ?? 0) + uv
  }
  return { familyPageViews, familyUniqueVisitors, truncated, uaKindsObserved: rows.length }
}

/**
 * 每来源表的 UV 表达式(每个来源**只有一份**,两条查询共用同一枚 SQL 片段,
 * 不另写第二把尺子;口径文字说明在 `TRAFFIC_SOURCE_UV_LABEL`)。
 */
const API_UV_EXPR = sql<number>`count(distinct ${apiLogs.ip})::int`
const VISIT_UV_EXPR = sql<number>`count(distinct coalesce(${visitLogs.sessionId}, ${visitLogs.ip}))::int`
const PV_EXPR = sql<number>`count(*)::int`

/**
 * 窗口起点(限窗就是这条链唯一的价格护栏):
 * `now() - make_interval(hours => N)`,N 只取自 `TRAFFIC_WINDOW_HOURS` 这个有界常量,
 * 不吃任何外部字符串。窗口外的行不参与聚合;`api_logs` 无二级索引 ⇒ 这仍是顺序扫描,
 * 但它只发生在小时级 job 里(见文件头第 2 条)。
 */
function windowStart(window: TrafficWindow) {
  return sql`now() - make_interval(hours => ${TRAFFIC_WINDOW_HOURS[window]})`
}

/** 单值聚合(1 行输出):窗口内的 PV 与精确 UV。 */
async function queryTrafficTotals(
  source: TrafficSource,
  window: TrafficWindow,
): Promise<{ pv: number; uv: number }> {
  const start = windowStart(window)
  const rows =
    source === 'api_logs'
      ? await db
          .select({ pv: PV_EXPR, uv: API_UV_EXPR })
          .from(apiLogs)
          .where(sql`${apiLogs.createdAt} >= ${start}`)
      : await db
          .select({ pv: PV_EXPR, uv: VISIT_UV_EXPR })
          .from(visitLogs)
          .where(sql`${visitLogs.createdAt} >= ${start}`)
  const row = rows[0]
  return { pv: Number(row?.pv ?? 0), uv: Number(row?.uv ?? 0) }
}

/** 族分解用:窗口内按 UA 原文分组,PV 降序,输出行数钉死在预算 + 1(多取一枚用于判截断)。 */
export async function queryTrafficUaKinds(
  source: TrafficSource,
  window: TrafficWindow,
  budget: number = TRAFFIC_UA_KIND_BUDGET,
): Promise<TrafficUaKindRow[]> {
  const start = windowStart(window)
  const rows =
    source === 'api_logs'
      ? await db
          .select({ userAgent: apiLogs.userAgent, pv: PV_EXPR, uv: API_UV_EXPR })
          .from(apiLogs)
          .where(sql`${apiLogs.createdAt} >= ${start}`)
          .groupBy(apiLogs.userAgent)
          .orderBy(sql`count(*) desc`)
          .limit(budget + 1)
      : await db
          .select({ userAgent: visitLogs.userAgent, pv: PV_EXPR, uv: VISIT_UV_EXPR })
          .from(visitLogs)
          .where(sql`${visitLogs.createdAt} >= ${start}`)
          .groupBy(visitLogs.userAgent)
          .orderBy(sql`count(*) desc`)
          .limit(budget + 1)
  return rows.map((r) => ({
    userAgent: r.userAgent ?? null,
    pv: Number(r.pv ?? 0),
    uv: Number(r.uv ?? 0),
  }))
}

interface TrafficSnapshotReport {
  window: TrafficWindow
  source: TrafficSource
  pv: number
  uv: number
  uaKindsObserved: number
  truncated: boolean
}

export interface TrafficRefreshResult {
  /** 成功聚合并写入 gauge 的格数(窗口 × 来源) */
  refreshed: TrafficSnapshotReport[]
  /** 查询失败、因而**没有**写入 gauge 的格(留下的旧值会由新鲜度戳显式变陈) */
  failures: Array<{ window: TrafficWindow; source: TrafficSource; reason: string }>
  /** 本次一共该刷几格 = 窗口数 × 来源数(有界,现读自两份封闭枚举) */
  cells: number
}

/**
 * 跑一轮全量刷新:窗口 × 来源表 逐格聚合后写入 gauge。
 * 由 scheduler 的 `traffic-stats-hourly` 调用;单格失败只跳过该格,不带崩整轮,
 * 更不把失败读成 0。
 */
export async function refreshTrafficGauges(): Promise<TrafficRefreshResult> {
  const refreshed: TrafficSnapshotReport[] = []
  const failures: TrafficRefreshResult['failures'] = []
  const completedAtMs = Date.now()

  for (const window of TRAFFIC_WINDOWS) {
    for (const source of TRAFFIC_SOURCES) {
      try {
        const totals = await queryTrafficTotals(source, window)
        const kinds = await queryTrafficUaKinds(source, window)
        const folded = foldUaKindsToFamily(kinds)
        setTrafficGaugeSample({
          window,
          source,
          pageViews: totals.pv,
          uniqueVisitors: totals.uv,
          familyPageViews: folded.familyPageViews,
          familyUniqueVisitors: folded.familyUniqueVisitors,
          familyBreakdownTruncated: folded.truncated,
          aggregatedAtMs: completedAtMs,
        })
        refreshed.push({
          window,
          source,
          pv: totals.pv,
          uv: totals.uv,
          uaKindsObserved: folded.uaKindsObserved,
          truncated: folded.truncated,
        })
      } catch (err) {
        failures.push({ window, source, reason: err instanceof Error ? err.message : String(err) })
      }
    }
  }

  return { refreshed, failures, cells: TRAFFIC_WINDOWS.length * TRAFFIC_SOURCES.length }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
