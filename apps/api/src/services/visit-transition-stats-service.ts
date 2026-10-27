// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 页面流转分析(2026-10-26 立,监控大屏「用户从哪走到哪」那一块的数据源)。
 *
 * 立因:页面热度排行只说"哪个页面被用得多",会话质量只说"看了几屏"——
 * 两格都答不出「人进来之后走到了哪一步」。流转给出的是**相邻页对**:
 * 入口页把人带到哪儿、哪一步是死胡同(有去无回)。
 *
 * 口径:
 *  - 相邻 = 同一 `session_id` 内按 `created_at`、`id` 排序的**前后两条**记录;
 *    会话 = 标签页级(web 端写在 sessionStorage),见 `session-quality-stats-service.ts` 头注。
 *  - **排除自环**(`/chat → /chat`):那是刷新,不是"走到了下一页"。
 *    刷新量大且信息量低,混进来会把真正的流转挤掉。
 *  - 只给次数(PV 口径);不折算成"转化率" —— 分子分母都取自同一张表的自造口径,
 *    报一个"转化率"只会让人以为这是行业通用定义。
 *  - 失败不写 0:任一 SQL 抛错整块上抛,由调用方折成 null(大屏渲染「—」)。
 */

import { sql } from 'drizzle-orm'
import { dbRead } from '../db/index.js'
import { visitLogs } from '@ihui/database'

/** 流转窗口:与大屏其它腿同一档(24h)。 */
export const VISIT_TRANSITION_WINDOW_HOURS = 24

/** 页对榜取前 N 条。 */
const TRANSITION_TOP_N = 8

interface VisitTransitionRow {
  /** 上一个页面(已归一的页面路径) */
  fromUrl: string
  /** 下一个页面 */
  toUrl: string
  /** 该流转发生次数 */
  n: number
}

export interface VisitTransitionSnapshot {
  /** 窗口内发生的相邻页对**总次数**(去自环) */
  totalMoves: number
  /** 发生过的不同页对数 */
  distinctPairs: number
  /** 页对 TOP */
  top: VisitTransitionRow[]
  computedAtMs: number
}

/**
 * 「上一个页面」的窗口函数表达式(导出供测试钉形状)。
 *
 * `lag(url) over (partition by session_id order by created_at, id)`:
 * `id` 参与排序是为了同刻写入的行也有确定顺序(否则并列时页对统计会漂)。
 */
export const TRANSITION_PREV_URL_SQL = sql<
  string | null
>`lag(${visitLogs.url}) over (partition by ${visitLogs.sessionId} order by ${visitLogs.createdAt} asc, ${visitLogs.id} asc)`.as(
  'prev_url',
)

/**
 * 每会话内带「上一个页面」的子查询。
 */
function orderedPages(hours: number) {
  return dbRead
    .select({
      sessionId: visitLogs.sessionId,
      url: visitLogs.url,
      prevUrl: TRANSITION_PREV_URL_SQL,
    })
    .from(visitLogs)
    .where(
      sql`${visitLogs.createdAt} >= now() - make_interval(hours => ${hours}) and ${visitLogs.sessionId} is not null and ${visitLogs.url} is not null`,
    )
    .as('ordered_pages')
}

function num(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

/** SQL 侧回来的一行页对(主机名/路径原样)。 */
export interface TransitionPairRow {
  fromUrl: string | null
  toUrl: string | null
  n: number
}

/**
 * 页对行 → 流转快照(纯函数,便于零连接取证)。
 *
 * 业务判断只在这一处:
 *  - `fromUrl` 为空 ⇒ 该行没有"上一个页面"(会话的第一次访问),不是流转;
 *  - **自环**(`/chat → /chat`)剔除 —— 那是刷新,不是"走到了下一页";
 *    刷新量大且信息量低,混进来会把真正的流转挤掉。
 *  - `totalMoves` 是**全量**页对次数之和(不是只有 TOP N 的和)——
 *    只把 TOP N 加起来却叫"总次数",读数会偏小。
 */
export function buildVisitTransition(
  rows: TransitionPairRow[],
  topN: number = TRANSITION_TOP_N,
): Omit<VisitTransitionSnapshot, 'computedAtMs'> {
  const pairs = rows
    .map((r) => ({
      fromUrl: String(r.fromUrl ?? ''),
      toUrl: String(r.toUrl ?? ''),
      n: num(r.n),
    }))
    .filter((r) => r.fromUrl.length > 0 && r.toUrl.length > 0 && r.fromUrl !== r.toUrl)
    .sort(
      (a, b) => b.n - a.n || a.fromUrl.localeCompare(b.fromUrl) || a.toUrl.localeCompare(b.toUrl),
    )
  return {
    totalMoves: pairs.reduce((sum, p) => sum + p.n, 0),
    distinctPairs: pairs.length,
    top: pairs.slice(0, topN),
  }
}

/** 现算一份流转快照;任一 SQL 抛错就整块上抛,由调用方折成 null(渲染「—」),绝不兜成 0。 */
async function computeVisitTransition(
  hours: number = VISIT_TRANSITION_WINDOW_HOURS,
): Promise<VisitTransitionSnapshot> {
  const ordered = orderedPages(hours)
  const rows = await dbRead
    .select({
      fromUrl: ordered.prevUrl,
      toUrl: ordered.url,
      n: sql<number>`count(*)::int`,
    })
    .from(ordered)
    .where(sql`${ordered.prevUrl} is not null`)
    .groupBy(ordered.prevUrl, ordered.url)
    .orderBy(sql`count(*) desc`)

  return {
    ...buildVisitTransition(rows as unknown as TransitionPairRow[]),
    computedAtMs: Date.now(),
  }
}

/**
 * 大屏实时档(24h 窗口 + 60 秒 TTL):流转要按 session_id 分组扫表,
 * 60 秒对"最近大家怎么走"这个读数足够新。
 */
const VISIT_TRANSITION_TTL_MS = 60_000

let liveCache: { atMs: number; value: VisitTransitionSnapshot } | null = null
let liveInflight: Promise<VisitTransitionSnapshot> | null = null

export async function getVisitTransitionLiveSnapshot(
  ttlMs: number = VISIT_TRANSITION_TTL_MS,
): Promise<VisitTransitionSnapshot> {
  const nowMs = Date.now()
  if (liveCache && nowMs - liveCache.atMs < ttlMs) return liveCache.value
  if (liveInflight) return liveInflight
  const current = (async () => {
    try {
      const value = await computeVisitTransition()
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
