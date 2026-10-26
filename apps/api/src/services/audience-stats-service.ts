// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 访客构成与浏览器分布聚合(2026-10-26 立,数据大屏「谁在用」那一块的数据源)。
 *
 * 立因:大屏的访客块只回答「多少人、多少次」,不回答「这些人是第一次来还是回头客、
 * 用什么在用」—— 而「新访客占比」是判断拉新有没有生效的第一指标。
 *
 * 三条口径:
 * 1. **身份 = `coalesce(session_id, ip)`**:与 UV / 实时在线同一把尺子
 *    (见 visit-tracking-queries),这里不得另发明一个"访客"定义,否则两块数字永远对不上。
 * 2. **"新"按首现时刻判**,不按注册状态:埋点是匿名面,首次被看见即算新访客。
 * 3. **失败不写 0**:任一 SQL 抛错整块上抛,由调用方折成 null(前端渲染"—")。
 */

import { sql } from 'drizzle-orm'
import { dbRead } from '../db/index.js'
import { visitLogs } from '@ihui/database'

/** 窗口天数(有界常量,SQL 只吃它,不吃外部字符串)。 */
export const AUDIENCE_WINDOW_DAYS = 7

/** 侧栏/插件等非浏览器入口的 url 前缀;浏览器分布只统计裸路径(web 端)。 */
export const NON_BROWSER_PATH_PREFIXES = ['/rn/', '/mp/', '/ex/'] as const

/** 访客身份:与 UV 口径同源(session_id 缺省时退到 ip)。 */
const identity = sql<string>`coalesce(${visitLogs.sessionId}, ${visitLogs.ip})`

/** 窗口起点:小时数是有界数值,直接进 make_interval,不吃任何外部字符串。 */
function windowStart(hours: number) {
  return sql`now() - make_interval(hours => ${hours})`
}

/**
 * UA 家族判序:Edge/Opera/微信的 UA 串里同时含 Chrome 与 Safari,必须先判它们,
 * 否则 Edge 会被读成 Chrome(实测 Edge 的 UA 尾串就是 "...Chrome/... Safari/537.36")。
 */
export const UA_FAMILY_CASE = sql<string>`case
  when coalesce(${visitLogs.userAgent}, '') ilike '%MicroMessenger%' then 'wechat'
  when coalesce(${visitLogs.userAgent}, '') ilike '%Edg%' then 'edge'
  when coalesce(${visitLogs.userAgent}, '') ilike '%OPR%' then 'opera'
  when coalesce(${visitLogs.userAgent}, '') ilike '%Firefox%' then 'firefox'
  when coalesce(${visitLogs.userAgent}, '') ilike '%Chrome%' then 'chrome'
  when coalesce(${visitLogs.userAgent}, '') ilike '%Safari%' then 'safari'
  when coalesce(${visitLogs.userAgent}, '') = '' then 'unknown'
  else 'other'
  end`

export interface AudienceSnapshot {
  /** 窗口内首次被看见的身份数(新访客) */
  newUv: number
  /** 窗口内活跃、但首现早于窗口的身份数(回访访客) */
  returningUv: number
  /** 窗口内活跃访客总数 = newUv + returningUv */
  activeUv: number
  /** 回访占比 0..1;窗口内一个访客都没有 ⇒ null(不把"没数据"读成"0% 回访") */
  returningRate: number | null
  /** 本轮聚合完成时刻(缓存判据;不是"数据本身的时间") */
  computedAtMs: number
}

export interface BrowserUsageRow {
  family: string
  pv: number
  uv: number
}

/**
 * 新访客 / 回访:先按身份聚出「首现时刻 + 窗口内是否活跃」,再在外层条件计数。
 * 首现那一层不能受窗口过滤 —— 那正是"回访"判不出来的常见错法。
 */
export async function computeAudience(
  hours: number = AUDIENCE_WINDOW_DAYS * 24,
): Promise<AudienceSnapshot> {
  const start = windowStart(hours)
  const perSid = dbRead
    .select({
      firstAt: sql<Date>`min(${visitLogs.createdAt})`.as('first_at'),
      active: sql<boolean>`bool_or(${visitLogs.createdAt} >= ${start})`.as('active'),
    })
    .from(visitLogs)
    .groupBy(identity)
    .as('per_sid')

  const [row] = await dbRead
    .select({
      newUv: sql<number>`count(*) filter (where ${perSid.active} and ${perSid.firstAt} >= ${start})::int`,
      returningUv: sql<number>`count(*) filter (where ${perSid.active} and ${perSid.firstAt} < ${start})::int`,
    })
    .from(perSid)

  const newUv = Number(row?.newUv ?? 0)
  const returningUv = Number(row?.returningUv ?? 0)
  const activeUv = newUv + returningUv
  return {
    newUv,
    returningUv,
    activeUv,
    returningRate: activeUv > 0 ? returningUv / activeUv : null,
    computedAtMs: Date.now(),
  }
}

/**
 * 浏览器分布(仅 web 裸路径):RN / 小程序 / 插件的"浏览器"不是用户的选择,
 * 混进来只会把这一维读歪(那些端各自已有「各端使用量」那一维)。
 */
export async function computeBrowserUsage(
  limit = 6,
  hours: number = AUDIENCE_WINDOW_DAYS * 24,
): Promise<BrowserUsageRow[]> {
  const path = sql<string>`coalesce(${visitLogs.url}, '')`
  const notNativeApp = sql`not (${sql.join(
    NON_BROWSER_PATH_PREFIXES.map((prefix) => sql`${path} like ${`${prefix}%`}`),
    sql` or `,
  )})`
  const rows = await dbRead
    .select({
      family: UA_FAMILY_CASE,
      pv: sql<number>`count(*)::int`,
      uv: sql<number>`count(distinct ${identity})::int`,
    })
    .from(visitLogs)
    .where(sql`${visitLogs.createdAt} >= ${windowStart(hours)} and ${notNativeApp}`)
    .groupBy(UA_FAMILY_CASE)
    .orderBy(sql`count(*) desc`)
    .limit(limit)
  return rows.map((r) => ({
    family: String(r.family),
    pv: Number(r.pv ?? 0),
    uv: Number(r.uv ?? 0),
  }))
}

/**
 * 大屏实时档(24h 窗口 + 60 秒 TTL)的挂载点在下一批:那块要一次接齐"路由腿 + 面板读数 +
 * 五语言标签",单独留一个没人消费的 getter 只会变成悬空声明。
 */ // ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
