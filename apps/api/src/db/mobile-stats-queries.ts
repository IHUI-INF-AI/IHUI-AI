/**
 * 移动端统计聚合查询(2026-08-06 立)。
 *
 * 数据源(均为项目真实表):
 * - visit_logs:页面访问日志(user_id/session_id/url/user_agent/created_at)
 * - analytics_events:行为埋点事件(user_id/created_at)
 * - llm_call_logs:LLM 调用流水(user_id/created_at)
 * - users:用户表(created_at)
 *
 * DAU/会话/趋势等口径:
 * - 活跃用户 = visit_logs + analytics_events + llm_call_logs 三者 user_id 去重
 * - 会话数 = visit_logs 当日 distinct session_id
 * - "今日"按 Asia/Shanghai 日界(与 relay-stats 一致),避免 UTC 漏算
 */
import { sql } from 'drizzle-orm'
import { dbRead } from './index.js'

/** 安全提取 db.execute 结果为数组(兼容 postgres.js 数组 / {rows} 两种形态)。 */
function toRows(raw: unknown): Record<string, unknown>[] {
  if (Array.isArray(raw)) return raw as Record<string, unknown>[]
  if (raw && typeof raw === 'object' && Array.isArray((raw as { rows?: unknown }).rows)) {
    return (raw as { rows: Record<string, unknown>[] }).rows
  }
  return []
}

function num(v: unknown): number {
  if (typeof v === 'number') return v
  if (typeof v === 'string') {
    const n = Number(v)
    return Number.isFinite(n) ? n : 0
  }
  return 0
}

// ===== 时区工具:Asia/Shanghai 日界(UTC 表示)=====
// Shanghai = UTC+8。Shanghai 当天 00:00 对应的 UTC 时间 = Date.UTC(y,m,d) - 8h。
function shanghaiDayStartUtc(daysAgo = 0): Date {
  const shanghaiNow = new Date(Date.now() + 8 * 3600 * 1000)
  return new Date(
    Date.UTC(
      shanghaiNow.getUTCFullYear(),
      shanghaiNow.getUTCMonth(),
      shanghaiNow.getUTCDate() - daysAgo,
    ) - 8 * 3600 * 1000,
  )
}

/** 把 Date 转成 Shanghai 本地 YYYY-MM-DD(供趋势填充使用)。 */
function shanghaiDateKey(d: Date): string {
  const local = new Date(d.getTime() + 8 * 3600 * 1000)
  const y = local.getUTCFullYear()
  const m = String(local.getUTCMonth() + 1).padStart(2, '0')
  const day = String(local.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export interface DauPoint {
  date: string
  dau: number
}

export interface DeviceSlice {
  name: string
  percent: number
}

export interface TopPage {
  path: string
  visits: number
}

/** 最近 24h 活跃用户数(visit_logs/analytics_events/llm_call_logs 的 user_id 去重)。 */
export async function getActiveUsers(since: Date): Promise<number> {
  const rows = await dbRead.execute(sql`
    SELECT COUNT(*)::int AS count FROM (
      SELECT user_id FROM visit_logs WHERE user_id IS NOT NULL AND created_at >= ${since}
      UNION
      SELECT user_id FROM analytics_events WHERE user_id IS NOT NULL AND created_at >= ${since}
      UNION
      SELECT user_id FROM llm_call_logs WHERE created_at >= ${since}
    ) t
  `)
  return num(toRows(rows)[0]?.count)
}

/** 当日新增注册用户数(users.created_at 落在当日 Shanghai 日界内)。 */
export async function getNewUsers(dayStart: Date, nextDayStart: Date): Promise<number> {
  const rows = await dbRead.execute(sql`
    SELECT COUNT(*)::int AS count FROM users
    WHERE created_at >= ${dayStart} AND created_at < ${nextDayStart}
  `)
  return num(toRows(rows)[0]?.count)
}

/** 当日会话数(visit_logs 当日 distinct session_id)。 */
export async function getSessions(dayStart: Date, nextDayStart: Date): Promise<number> {
  const rows = await dbRead.execute(sql`
    SELECT COUNT(DISTINCT session_id)::int AS count FROM visit_logs
    WHERE session_id IS NOT NULL AND session_id <> ''
      AND created_at >= ${dayStart} AND created_at < ${nextDayStart}
  `)
  return num(toRows(rows)[0]?.count)
}

/** 近 N 日 DAU 趋势(按 Shanghai 日界分组去重,缺日期补 0,保证折线图连续)。 */
export async function getDauTrend(days: number): Promise<DauPoint[]> {
  const since = shanghaiDayStartUtc(days - 1)
  const rows = await dbRead.execute(sql`
    SELECT day, COUNT(DISTINCT user_id)::int AS dau FROM (
      SELECT to_char(created_at AT TIME ZONE 'Asia/Shanghai', 'YYYY-MM-DD') AS day, user_id
      FROM visit_logs WHERE user_id IS NOT NULL AND created_at >= ${since}
      UNION ALL
      SELECT to_char(created_at AT TIME ZONE 'Asia/Shanghai', 'YYYY-MM-DD') AS day, user_id
      FROM analytics_events WHERE user_id IS NOT NULL AND created_at >= ${since}
      UNION ALL
      SELECT to_char(created_at AT TIME ZONE 'Asia/Shanghai', 'YYYY-MM-DD') AS day, user_id
      FROM llm_call_logs WHERE created_at >= ${since}
    ) t
    GROUP BY day ORDER BY day
  `)

  const byDate = new Map<string, number>()
  for (const r of toRows(rows)) {
    byDate.set(String(r['day'] ?? ''), num(r['dau']))
  }

  const result: DauPoint[] = []
  for (let i = days - 1; i >= 0; i--) {
    const key = shanghaiDateKey(shanghaiDayStartUtc(i))
    result.push({ date: key, dau: byDate.get(key) ?? 0 })
  }
  return result
}

/** 设备分布(基于 visit_logs.user_agent 分桶: iOS / Android / 其他),无记录返回空数组。 */
export async function getDeviceDistribution(since: Date): Promise<DeviceSlice[]> {
  const rows = await dbRead.execute(sql`
    SELECT user_agent, COUNT(*)::int AS visits FROM visit_logs
    WHERE user_agent IS NOT NULL AND user_agent <> '' AND created_at >= ${since}
    GROUP BY user_agent
  `)
  const raw = toRows(rows)
  if (raw.length === 0) return []

  let ios = 0
  let android = 0
  let other = 0
  for (const r of raw) {
    const ua = String(r['user_agent'] ?? '')
    const lower = ua.toLowerCase()
    if (/iphone|ipad|ipod/.test(lower)) ios += num(r['visits'])
    else if (/android/.test(lower)) android += num(r['visits'])
    else other += num(r['visits'])
  }
  const total = ios + android + other
  if (total <= 0) return []
  const round = (n: number): number => Math.round((n / total) * 1000) / 10
  return [
    { name: 'iOS', percent: round(ios) },
    { name: 'Android', percent: round(android) },
    { name: 'others', percent: round(other) },
  ]
}

export interface TopPagesResult {
  pages: TopPage[]
  /** 统计窗口内全部页面访问量(供前端计算真实占比,分母)。 */
  totalVisits: number
}

/** Top 页面(基于 visit_logs.url 聚合,截取 pathname),无记录返回空数组。 */
export async function getTopPages(since: Date, limit: number): Promise<TopPagesResult> {
  const rows = await dbRead.execute(sql`
    SELECT url, COUNT(*)::int AS visits FROM visit_logs
    WHERE url IS NOT NULL AND url <> '' AND created_at >= ${since}
    GROUP BY url ORDER BY visits DESC LIMIT ${limit}
  `)
  const totalRows = await dbRead.execute(sql`
    SELECT COUNT(*)::int AS count FROM visit_logs
    WHERE url IS NOT NULL AND url <> '' AND created_at >= ${since}
  `)
  return {
    pages: toRows(rows).map((r) => ({
      path: extractPath(String(r['url'] ?? '')),
      visits: num(r['visits']),
    })),
    totalVisits: num(toRows(totalRows)[0]?.count),
  }
}

/** 从 URL 提取 pathname(非法/相对路径兜底原样返回)。 */
function extractPath(url: string): string {
  if (!url) return '-'
  try {
    const u = new URL(url)
    const path = u.pathname || '/'
    return path.length > 1 ? path.replace(/\/+$/, '') : path
  } catch {
    const idx = url.indexOf('?')
    const path = idx >= 0 ? url.slice(0, idx) : url
    return path.length > 1 ? path.replace(/\/+$/, '') : '/'
  }
}
