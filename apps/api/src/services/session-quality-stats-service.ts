// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 访问会话质量聚合(2026-10-26 立,监控大屏「来了之后看了几屏」那一块的数据源)。
 *
 * 立因:大屏的访客块回答的是「多少人、多少次」,不回答「这些人是第一次来还是回头客、
 * 用了多久、点了什么」—— 再往前一格还有个更基础的问题:**来了之后还继续用吗**。
 * 页面热度排行说「/chat 被打开了 N 次」,但没说打开的人里有多少顺手又翻了别的页面。
 * 这一族查询补的就是那一格。
 *
 * 会话口径 = `visit_logs.session_id`。它由 web 端 `VisitTracker` 写在 **sessionStorage**
 * (`ihui_visit_sid`)⇒ 一个浏览器标签页一个 sid,关掉标签页即失效、新开标签页即换新。
 * 所以这里的「会话」= 一次标签页停留,**不是** 30 分钟滚动窗口会话 —— 面板文案照实说,
 * 不把它包装成行业通用的"会话"定义(§0.3:口径不许冒充实测)。
 *
 * 无 `session_id` 的行不计入(生产 web 端填充率 100%,非 web 端尚未上报 sid);
 * 这类行仍进 PV/UV 总量,只是不进会话族。
 *
 * 失败不写 0:任一 SQL 抛错整块上抛,由调用方折成 null(大屏渲染"—")。
 */

import { sql } from 'drizzle-orm'
import { dbRead } from '../db/index.js'
import { visitLogs } from '@ihui/database'

/** 会话窗口:与大屏其它腿同一档(24h),同口径才可比。 */
export const SESSION_QUALITY_WINDOW_HOURS = 24

/** 落地页/退出页两榜各取前 N 条(2026-10-27 起两榜共用同一个 N)。 */
const SESSION_PAGE_TOP_N = 6

/**
 * 会话深度分档(唯一分档判据在服务端,前端只按桶渲染,不自己数档)。
 * 桶边界按生产实测分布定的:p50=1 PV、p90=3 PV、max=45 PV ⇒ 单屏占八成,
 * 所以第一档必须单独拎出来,否则 2-3 与 4-7 两档会把"进来即走"淹没在中间。
 */
export const SESSION_DEPTH_BUCKETS = ['1', '2-3', '4-7', '8+'] as const
type SessionDepthBucket = (typeof SESSION_DEPTH_BUCKETS)[number]

interface SessionDepthSlice {
  bucket: SessionDepthBucket
  /** 该档会话数 */
  sessions: number
}

interface SessionEntryPage {
  /** 落地页路径(库里已是归一后的页面路径,见 @ihui/shared/utils/visit-url) */
  url: string
  /** 以该页为落地页的会话数 */
  sessions: number
  /** 其中只停留在这一个页面的会话数(进来即走) */
  singlePageSessions: number
}

/** 退出页一行(2026-10-27 立):与落地页同一形状,判据镜像 —— 该会话**最后一条**有 url 的记录。 */
interface SessionExitPage {
  /** 退出页路径 */
  url: string
  /** 以该页收尾的会话数 */
  sessions: number
  /** 其中只停留在这一个页面的会话数(既是落地页也是退出页) */
  singlePageSessions: number
}

export interface SessionQualitySnapshot {
  /** 窗口内会话数(按 session_id 去重) */
  sessions: number
  /** 只停留在一个页面的会话数 */
  singlePageSessions: number
  /** 单页会话占比 0..1;会话数为 0 ⇒ null(「没判」不是「零」) */
  singlePageRate: number | null
  /** 平均每会话 PV;会话数为 0 ⇒ null */
  avgPvPerSession: number | null
  /** 会话深度分档(恒为四档,零会话时各档为 0) */
  depth: SessionDepthSlice[]
  /** 落地页 TOP(进来的会话最多的页面) */
  entryPages: SessionEntryPage[]
  /**
   * 退出页 TOP(2026-10-27 立,收尾的会话最多的页面)。
   * 落地页答「人从哪进」,退出页答「人从哪走」—— 两头都有才看得出路径断在哪一步;
   * 口径与落地页镜像(最后一条有 url 的记录),单页会话两榜同时计入。
   */
  exitPages: SessionExitPage[]
  /** 本轮聚合完成时刻(缓存判据;不是"数据本身的时间") */
  computedAtMs: number
}

/**
 * 每会话聚合的列定义(导出供测试钉形状)。
 *
 * `entry_url` 取该会话**最早一条有 url 的记录**;`exit_url`(2026-10-27)取**最后一条**:
 * 两边同一个 `filter (where url is not null)` 理由 —— 库里 url 为 null 的行是"归一不出页面"
 * 的噪声行(见写入面 `saveVisitLog`),让它们占住落地/退出页会把两头读数都带偏。
 * 去掉这两个 filter,榜一会被噪声行顶掉(承重语句,测试 A/B 两侧都钉)。
 */
export const SESSION_ROWS_COLUMNS = {
  pvCnt: sql<number>`count(*)::int`.as('pv_cnt'),
  pageCnt: sql<number>`count(distinct ${visitLogs.url})::int`.as('page_cnt'),
  entryUrl: sql<
    string | null
  >`(array_agg(${visitLogs.url} order by ${visitLogs.createdAt} asc, ${visitLogs.id} asc) filter (where ${visitLogs.url} is not null))[1]`.as(
    'entry_url',
  ),
  exitUrl: sql<
    string | null
  >`(array_agg(${visitLogs.url} order by ${visitLogs.createdAt} desc, ${visitLogs.id} desc) filter (where ${visitLogs.url} is not null))[1]`.as(
    'exit_url',
  ),
}

/**
 * 每会话一行的子查询 —— 总量与落地页两腿共用同一份定义(同一段代码生成两次)。
 * 写成一份是因为两腿口径必须逐字同源,各写一遍早晚会漂。
 */
function perSession(hours: number) {
  return dbRead
    .select(SESSION_ROWS_COLUMNS)
    .from(visitLogs)
    .where(
      sql`${visitLogs.createdAt} >= now() - make_interval(hours => ${hours}) and ${visitLogs.sessionId} is not null`,
    )
    .groupBy(visitLogs.sessionId)
    .as('per_session')
}

function num(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

/**
 * 总量腿的原始行形状。
 *
 * 键名 = **drizzle 的 select 别名**(camelCase),不是 SQL 列名(snake_case):
 * 这一族聚合用 `sql` 片段写列,别名由 select 侧给,drizzle 回传的行对象就用这个别名做键。
 * (实测踩过:按 snake_case 读 ⇒ 只有 `sessions` 命中、其余读数全 0。)
 */
export interface SessionQualityAggRow {
  sessions?: number | string | null
  singlePageSessions?: number | string | null
  totalPv?: number | string | null
  depth1?: number | string | null
  depth2to3?: number | string | null
  depth4to7?: number | string | null
  depth8plus?: number | string | null
}

/** 落地页腿的原始行形状(键名同上)。 */
export interface SessionEntryRow {
  entryUrl?: string | null
  sessions?: number | string | null
  singlePageSessions?: number | string | null
}

/** 退出页腿的原始行形状(键名同上;与落地页镜像,2026-10-27 立)。 */
export interface SessionExitRow {
  exitUrl?: string | null
  sessions?: number | string | null
  singlePageSessions?: number | string | null
}

/**
 * 把三腿的原始行折成一份会话质量快照(纯函数,便于零连接取证)。
 *
 * 口径细则:
 * - `singlePageSessions` = `page_cnt = 1` 的会话(只停留在一个**页面**;
 *   同一页刷新 3 次仍是一个页面 ⇒ 算 1 屏,不是 3 屏)。
 * - 深度分档按**PV 数**分档(用户看到的屏数,含重复刷新)⇒ 与「深度」的物理含义一致:
 *   一个只停留 1 个页面但刷新 3 次的会话落在 "2-3" 档。
 * - 会话数为 0 时,占比与人均一律 null(不是 0):窗口内没有会话是**判过的**结果,
 *   但"占比 0%"会被读成"来的人都不翻页",那是把空集说成结论。
 * - 落地页/退出页(2026-10-27):单页会话两榜同时计入(那一页既是入口也是出口),
 *   不做互斥剔除 —— 剔除后两榜之和对不上会话数,反而读不出"进来即走"堆在哪一页。
 */
export function buildSessionQuality(
  aggRow: SessionQualityAggRow | undefined,
  entryRows: SessionEntryRow[],
  exitRows: SessionExitRow[],
): Omit<SessionQualitySnapshot, 'computedAtMs'> {
  const sessions = num(aggRow?.sessions)
  const singlePageSessions = num(aggRow?.singlePageSessions)
  const totalPv = num(aggRow?.totalPv)
  const depth: SessionDepthSlice[] = [
    { bucket: '1', sessions: num(aggRow?.depth1) },
    { bucket: '2-3', sessions: num(aggRow?.depth2to3) },
    { bucket: '4-7', sessions: num(aggRow?.depth4to7) },
    { bucket: '8+', sessions: num(aggRow?.depth8plus) },
  ]
  const entryPages: SessionEntryPage[] = entryRows
    .map((r) => ({
      url: String(r.entryUrl ?? ''),
      sessions: num(r.sessions),
      singlePageSessions: num(r.singlePageSessions),
    }))
    .filter((r) => r.url.length > 0)
  const exitPages: SessionExitPage[] = exitRows
    .map((r) => ({
      url: String(r.exitUrl ?? ''),
      sessions: num(r.sessions),
      singlePageSessions: num(r.singlePageSessions),
    }))
    .filter((r) => r.url.length > 0)
  return {
    sessions,
    singlePageSessions,
    singlePageRate: sessions > 0 ? singlePageSessions / sessions : null,
    avgPvPerSession: sessions > 0 ? totalPv / sessions : null,
    depth,
    entryPages,
    exitPages,
  }
}

/** 现算一份会话质量快照;任一 SQL 抛错就整块上抛,由调用方折成 null(渲染"—"),绝不兜成 0。 */
async function computeSessionQuality(
  hours: number = SESSION_QUALITY_WINDOW_HOURS,
): Promise<SessionQualitySnapshot> {
  // 子查询只建一次再复用:每次调用 perSession() 都会生成一个同名别名 `per_session`,
  // 在一条 SQL 里出现两次 ⇒ 别名冲突。总量/落地页/退出页三腿共用这一个对象(口径同源)。
  const per = perSession(hours)

  const [row] = await dbRead
    .select({
      sessions: sql<number>`count(*)::int`,
      singlePageSessions: sql<number>`count(*) filter (where ${per.pageCnt} = 1)::int`,
      totalPv: sql<number>`coalesce(sum(${per.pvCnt}), 0)::int`,
      depth1: sql<number>`count(*) filter (where ${per.pvCnt} = 1)::int`,
      depth2to3: sql<number>`count(*) filter (where ${per.pvCnt} between 2 and 3)::int`,
      depth4to7: sql<number>`count(*) filter (where ${per.pvCnt} between 4 and 7)::int`,
      depth8plus: sql<number>`count(*) filter (where ${per.pvCnt} >= 8)::int`,
    })
    .from(per)

  const entryRows = await dbRead
    .select({
      entryUrl: per.entryUrl,
      sessions: sql<number>`count(*)::int`,
      singlePageSessions: sql<number>`count(*) filter (where ${per.pageCnt} = 1)::int`,
    })
    .from(per)
    .where(sql`${per.entryUrl} is not null`)
    .groupBy(per.entryUrl)
    .orderBy(sql`count(*) desc, ${per.entryUrl} asc`)
    .limit(SESSION_PAGE_TOP_N)

  // 退出页腿(2026-10-27):与落地页同一子查询、镜像判据(exit_url 已在列定义里),
  // 回答「人从哪走」—— 两头都有才看得出路径断在哪一步。
  const exitRows = await dbRead
    .select({
      exitUrl: per.exitUrl,
      sessions: sql<number>`count(*)::int`,
      singlePageSessions: sql<number>`count(*) filter (where ${per.pageCnt} = 1)::int`,
    })
    .from(per)
    .where(sql`${per.exitUrl} is not null`)
    .groupBy(per.exitUrl)
    .orderBy(sql`count(*) desc, ${per.exitUrl} asc`)
    .limit(SESSION_PAGE_TOP_N)

  const agg = row as unknown as SessionQualityAggRow | undefined
  const entries = (entryRows as unknown as SessionEntryRow[]) ?? []
  const exits = (exitRows as unknown as SessionExitRow[]) ?? []
  return { ...buildSessionQuality(agg, entries, exits), computedAtMs: Date.now() }
}

/**
 * 大屏实时档(24h 窗口 + 5 秒 TTL):会话族聚合要按 session_id 分组扫 visit_logs,
 * 与页面热度同一档节拍(多个观众共享一轮聚合)。取不到时上抛,由调用方折成 null。
 */
const SESSION_QUALITY_TTL_MS = 5_000

let liveCache: { atMs: number; value: SessionQualitySnapshot } | null = null
let liveInflight: Promise<SessionQualitySnapshot> | null = null

export async function getSessionQualityLiveSnapshot(
  ttlMs: number = SESSION_QUALITY_TTL_MS,
): Promise<SessionQualitySnapshot> {
  const nowMs = Date.now()
  if (liveCache && nowMs - liveCache.atMs < ttlMs) return liveCache.value
  if (liveInflight) return liveInflight
  const current = (async () => {
    try {
      const value = await computeSessionQuality()
      liveCache = { atMs: value.computedAtMs, value }
      return value
    } finally {
      liveInflight = null
    }
  })()
  liveInflight = current
  return current
}

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
