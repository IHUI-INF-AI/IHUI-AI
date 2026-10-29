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
 *    所以 gauge 里的聚合结果只活在指标进程的内存里 ⇒ **重启归零**。为了不让
 *    重启把大屏打回一片"—",大屏**不再读 gauge**,改读本文件的实时快照
 *    `getTrafficLiveSnapshot()`(同两条 SQL,带 5 秒进程内缓存);gauge 只留给
 *    Grafana 看时序曲线。
 * 2. **2026-10-23 复测后已推翻"只能小时级"**:原判据是"`api_logs` 一条二级索引
 *    都没有 ⇒ 按 created_at 聚合必顺序扫描"。实测该判据**已过期**:
 *    `api_logs_created_at_idx` 存在,`Index Scan using api_logs_created_at_idx`,
 *    24h 总计 13.3 ms / 1h 总计 0.46 ms / 24h 按 UA 分组(401 行)32.4 ms。
 *    因此本链不再受"每小时一次"约束:gauge 侧改 60 秒一轮(scheduler
 *    `traffic-stats-hourly` 名字保留、节奏已改),大屏侧走 5 秒缓存的实时快照。
 *    若 `api_logs` 涨到千万级,这条索引扫描会重新变贵,那时正解是预聚合表 +
 *    迁移,而不是把节奏调回去。
 * 3. **失败不写 0**:查询抛了就跳过这一格并计入 `failures`,gauge 保持上一次的值 ——
 *    把"没测到"写成 0 就是造假数据(§0.3「没判」不许写成「判过」)。实时快照
 *    同理:任一条 SQL 抛错就整块上抛,由路由把该块折成 null(大屏渲染"—"),
 *    **绝不把失败兜成 0 人访问**。新鲜度另有 `computedAtMs` 可以自证。
 *
 * 族归一**只用 `utils/bot-detection.ts` 的 `classifyClientFamily`**,真人口径
 * **只用同文件的 `HUMAN_CLIENT_FAMILIES`**(§0.6/§22c:同类判据全仓只许一份;
 * 指标面、告警面、面板面必须是同一把尺子),本文件不再抄第二份词表。
 */

import { sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { apiLogs, visitLogs } from '@ihui/database'
import {
  classifyClientFamily,
  HUMAN_CLIENT_FAMILIES,
  type ClientFamily,
} from '../utils/bot-detection.js'
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
 * 不吃任何外部字符串。窗口外的行不参与聚合。
 * 2026-10-23 复测:`api_logs_created_at_idx` 存在,限窗聚合走索引扫描(24h 13.3 ms),
 * 不再是"无索引顺序扫描"——这也是本条链能被提到分钟级/请求级的前提。
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

// ============================================================================
// 实时快照(2026-10-23 追加:机主要"实时",不要小时级)
// ============================================================================

/** 大屏「访客与机器人」面板要的全部数字(一条 SQL 口径,不含 gauge)。 */
export interface TrafficLiveSnapshot {
  /** 近 24h 页面/请求量(api_logs,精确值) */
  pv24h: number
  /** 近 24h 去重访客(按 ip,精确值) */
  uv24h: number
  pv1h: number
  uv1h: number
  /** 近 24h 真人族 PV(首方 + 人浏览器形态) */
  humanPv24h: number
  /** 近 24h 自动化族 PV */
  botPv24h: number
  /** 各族近 24h PV(降序,已滤掉 0) */
  families: Array<{ family: string; pv: number }>
  /** true = 族分解被 UA 种类预算截断 ⇒ `families` / 真人 / 机器人三处都只是下界 */
  truncated: boolean
  /** 本次聚合完成的时刻(ms) —— 大屏"新鲜度"就报 `now - computedAtMs` */
  computedAtMs: number
}

/**
 * 现算一份实时快照。**不 catch**:任一条 SQL 抛错就整块上抛,由调用方折成 null
 * (大屏渲染"—"),绝不兜成 0(§0.3)。
 *
 * 三条查询并行(24h 总计 / 1h 总计 / 24h 按 UA 分组),实测合计 ≈ 46 ms
 * (24h 13.3 ms + 1h 0.46 ms + UA 分组 32.4 ms,均走 `api_logs_created_at_idx`)。
 */
export async function computeTrafficLiveSnapshot(
  source: TrafficSource = 'api_logs',
): Promise<TrafficLiveSnapshot> {
  const [totals24, totals1h, kinds24] = await Promise.all([
    queryTrafficTotals(source, '24h'),
    queryTrafficTotals(source, '1h'),
    queryTrafficUaKinds(source, '24h'),
  ])
  const folded = foldUaKindsToFamily(kinds24)
  const families = Object.entries(folded.familyPageViews)
    .map(([family, pv]) => ({ family, pv: Number(pv ?? 0) }))
    .filter((f) => f.pv > 0)
    .sort((a, b) => b.pv - a.pv)
  let human = 0
  let bot = 0
  for (const f of families) {
    if (HUMAN_CLIENT_FAMILIES.has(f.family as ClientFamily)) human += f.pv
    else bot += f.pv
  }
  return {
    pv24h: totals24.pv,
    uv24h: totals24.uv,
    pv1h: totals1h.pv,
    uv1h: totals1h.uv,
    humanPv24h: human,
    botPv24h: bot,
    families,
    truncated: folded.truncated,
    computedAtMs: Date.now(),
  }
}

/**
 * 实时快照的进程内缓存 TTL。大屏 overview 5 秒轮询一次,这里取同一个 5 秒:
 * 每个观众最多每 5 秒触发一轮 46 ms 的聚合,多个观众并发时用 in-flight 去重
 * 合成同一轮 —— 既保住"5 秒内必是新的",又不让观众数变成 DB 负载乘数。
 */
const TRAFFIC_LIVE_TTL_MS = 5_000

let liveCache: { atMs: number; value: TrafficLiveSnapshot } | null = null
let liveInflight: Promise<TrafficLiveSnapshot> | null = null

/**
 * 取一份"最多 TTL 毫秒前"的实时快照。**永不返回 0 冒充数据**:底层失败照样上抛,
 * 只是同一轮失败不会被 N 个观众各打一次 DB(失败不入缓存,下个请求重试)。
 */
export async function getTrafficLiveSnapshot(
  source: TrafficSource = 'api_logs',
  ttlMs: number = TRAFFIC_LIVE_TTL_MS,
): Promise<TrafficLiveSnapshot> {
  const nowMs = Date.now()
  if (liveCache && nowMs - liveCache.atMs < ttlMs) return liveCache.value
  if (liveInflight) return liveInflight
  const inflight = (async () => {
    try {
      const value = await computeTrafficLiveSnapshot(source)
      liveCache = { atMs: value.computedAtMs, value }
      return value
    } finally {
      liveInflight = null
    }
  })()
  liveInflight = inflight
  return inflight
}

/** 仅测试用:清掉缓存,避免用例之间互相污染。 */
export function __resetTrafficLiveCacheForTest(): void {
  liveCache = null
  liveInflight = null
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
