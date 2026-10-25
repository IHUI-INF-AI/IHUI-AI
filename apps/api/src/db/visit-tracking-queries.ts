// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { and, gte, lte, isNotNull, desc, sql, asc } from 'drizzle-orm'
import { bizDayKey } from '../utils/biz-day.js'
import { db } from './index.js'
import { visitLogs, type VisitLog } from '@ihui/database'

// =============================================================================
// 访问记录写入
// =============================================================================

/**
 * 服务端观测面(2026-10-23 真值化立)。
 *
 * `ip` / `userAgent` **只能**从这里进库:此前 `saveVisitLog` 照单接收客户端自报的同名
 * 字段,结果 visit_logs 2555 行里 2550 行 user_agent 为空、IP 维度读不出任何东西
 * (上报方 `VisitTracker.tsx` 压根不带这两个字段,而带得起来的都是可整写的客户端)。
 * AGENTS §5「身份不得住客户端可整写字段」⇒ 入参形状上就不给客户端留通道:
 * 本接口里没有 ip/userAgent 这两个键,调用方要传编译期就报错。
 */
export interface ObservedVisitorFields {
  /** 服务端取到的来源 IP(XFF 首段 ?? request.ip) */
  ip: string | null
  /** 服务端取到的 User-Agent 原文(已按列长钳制) */
  userAgent: string | null
}

export interface SaveVisitLogInput {
  userId?: string
  city?: string
  url?: string
  referer?: string
  sessionId?: string
  observed: ObservedVisitorFields
}

/**
 * 保存访问记录。visitDate 由服务端按业务日界算出(不再有入参通道:
 * 2026-10-25 摘掉 `visitDate?` 字段 —— 路由层 schema 已不收客户端自报日期,留这个字段
 * 就是给下一个"照着类型写"的人留一条把日键交回客户端的路)。
 * ip / user_agent 一律取 `observed`(服务端观测面),客户端自报值不进这一层。
 */
export async function saveVisitLog(input: SaveVisitLogInput): Promise<VisitLog> {
  // 访客日键一律服务端算,且必须是业务日界(上海);以前是 UTC ⇒ 早八点前 PV/UV 落错一天
  const visitDate = bizDayKey()
  const rows = await db
    .insert(visitLogs)
    .values({
      userId: input.userId,
      ip: input.observed.ip,
      city: input.city,
      url: input.url,
      referer: input.referer,
      userAgent: input.observed.userAgent,
      sessionId: input.sessionId,
      visitDate,
    })
    .returning()
  const row = rows[0]
  if (!row) throw new Error('保存访问记录失败')
  return row
}

// =============================================================================
// 访问统计
// =============================================================================

// =============================================================================
// 访问面分桶(单一真相源,2026-10-25 立)
// =============================================================================

/**
 * 访问面:前台用户 / 后台管理端 / 登录认证页。
 *
 * 2026-10-25 之前 `VisitTracker` 直接把 /admin、/login、/register 丢掉,结果是这些
 * 页面「用了多少次」结构上永远算不出来。现在采集面覆盖全站,口径改由本文件的
 * `classifyVisitScope` / `visitScopeFilter` 一处判定:统计默认只算 `public`,
 * 后台使用量单独可查,既不丢数据也不污染前台 PV/UV。
 */
export type VisitScope = 'public' | 'admin' | 'auth'

/** 允许的 scope 入参;`all` 表示不分桶(明细取证面用)。 */
export const VISIT_SCOPE_VALUES = ['public', 'admin', 'auth', 'all'] as const
export type VisitScopeQuery = VisitScope | 'all'

const ADMIN_PATH_PREFIX = '/admin'
const AUTH_PATH_PREFIXES = ['/login', '/register', '/sso'] as const

/** URL(含 query 形态) → 访问面。前缀判定,与下方 SQL 片段逐字同语义。 */
export function classifyVisitScope(url: string | null | undefined): VisitScope {
  if (!url) return 'public'
  if (url.startsWith(ADMIN_PATH_PREFIX)) return 'admin'
  if (AUTH_PATH_PREFIXES.some((prefix) => url.startsWith(prefix))) return 'auth'
  return 'public'
}

/**
 * scope → SQL 条件。`all`/缺省不返回值(不加条件)。
 * 统计入口默认传 `public`(见 `dateRangeFilter`),不要在各调用点自行改默认值。
 */
export function visitScopeFilter(scope: VisitScopeQuery | null | undefined) {
  if (!scope || scope === 'all') return undefined
  const path = sql<string>`coalesce(${visitLogs.url}, '')`
  const adminLike = sql`${path} like '/admin%'`
  const authLike = sql`(${path} like '/login%' or ${path} like '/register%' or ${path} like '/sso%')`
  if (scope === 'admin') return adminLike
  if (scope === 'auth') return authLike
  return sql`not (${adminLike} or ${authLike})`
}

function dateRangeFilter(start?: string, end?: string, scope?: VisitScopeQuery) {
  const conds = []
  if (start) conds.push(gte(visitLogs.visitDate, start.slice(0, 10)))
  if (end) conds.push(lte(visitLogs.visitDate, end.slice(0, 10)))
  const scopeCond = visitScopeFilter(scope ?? 'public')
  if (scopeCond) conds.push(scopeCond)
  return conds.length > 0 ? and(...conds) : undefined
}

export interface VisitSummary {
  pv: number
  uv: number
  ipCount: number
  memberCount: number
  startTime?: string
  endTime?: string
}

/**
 * 访问概览 - PV/UV/IP数/会员数。UV 优先按 session_id 去重, 回退到 ip。
 */
export async function getVisitSummary(
  startTime?: string,
  endTime?: string,
  scope?: VisitScopeQuery,
): Promise<VisitSummary> {
  const where = dateRangeFilter(startTime, endTime, scope)
  const [pvRows, uvRows, ipRows, memberRows] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(visitLogs)
      .where(where),
    db
      .select({
        count: sql<number>`count(distinct coalesce(${visitLogs.sessionId}, ${visitLogs.ip}))::int`,
      })
      .from(visitLogs)
      .where(where),
    db
      .select({ count: sql<number>`count(distinct ${visitLogs.ip})::int` })
      .from(visitLogs)
      .where(where),
    db
      .select({ count: sql<number>`count(distinct ${visitLogs.userId})::int` })
      .from(visitLogs)
      .where(and(where ?? sql`true`, isNotNull(visitLogs.userId))),
  ])
  return {
    pv: pvRows[0]?.count ?? 0,
    uv: uvRows[0]?.count ?? 0,
    ipCount: ipRows[0]?.count ?? 0,
    memberCount: memberRows[0]?.count ?? 0,
    startTime,
    endTime,
  }
}

export interface DayPvItem {
  visitDate: string
  pv: number
}

/**
 * 每日 PV 列表, 按 visit_date 升序。
 */
export async function getDayPvList(
  startTime?: string,
  endTime?: string,
  scope?: VisitScopeQuery,
): Promise<DayPvItem[]> {
  const where = and(dateRangeFilter(startTime, endTime, scope), isNotNull(visitLogs.visitDate))
  const rows = await db
    .select({
      visitDate: visitLogs.visitDate,
      pv: sql<number>`count(${visitLogs.id})::int`,
    })
    .from(visitLogs)
    .where(where)
    .groupBy(visitLogs.visitDate)
    .orderBy(asc(visitLogs.visitDate))
  return rows.map((r) => ({ visitDate: r.visitDate ?? '', pv: r.pv }))
}

export interface DayUvItem {
  visitDate: string
  uv: number
}

/**
 * 每日 UV 列表, 按 visit_date 升序。UV 按 coalesce(session_id, ip) 去重。
 */
export async function getDayUvList(
  startTime?: string,
  endTime?: string,
  scope?: VisitScopeQuery,
): Promise<DayUvItem[]> {
  const where = and(dateRangeFilter(startTime, endTime, scope), isNotNull(visitLogs.visitDate))
  const rows = await db
    .select({
      visitDate: visitLogs.visitDate,
      uv: sql<number>`count(distinct coalesce(${visitLogs.sessionId}, ${visitLogs.ip}))::int`,
    })
    .from(visitLogs)
    .where(where)
    .groupBy(visitLogs.visitDate)
    .orderBy(asc(visitLogs.visitDate))
  return rows.map((r) => ({ visitDate: r.visitDate ?? '', uv: r.uv }))
}

export interface IpCityItem {
  ip: string | null
  city: string | null
  pv: number
  uv: number
}

export interface FindIpCityOpts {
  startTime?: string
  endTime?: string
  page: number
  pageSize: number
  scope?: VisitScopeQuery
}

/**
 * IP 城市统计列表(分页), 按 PV 降序。
 */
export async function findIpCityList(
  opts: FindIpCityOpts,
): Promise<{ list: IpCityItem[]; total: number; page: number; pageSize: number }> {
  const where = dateRangeFilter(opts.startTime, opts.endTime, opts.scope)
  const [list, totalRows] = await Promise.all([
    db
      .select({
        ip: visitLogs.ip,
        city: visitLogs.city,
        pv: sql<number>`count(${visitLogs.id})::int`,
        uv: sql<number>`count(distinct coalesce(${visitLogs.sessionId}, ${visitLogs.ip}))::int`,
      })
      .from(visitLogs)
      .where(where)
      .groupBy(visitLogs.ip, visitLogs.city)
      .orderBy(desc(sql`count(${visitLogs.id})`))
      .limit(opts.pageSize)
      .offset((opts.page - 1) * opts.pageSize),
    db
      .select({
        count: sql<number>`count(distinct (${visitLogs.ip} || '_' || coalesce(${visitLogs.city}, '')))::int`,
      })
      .from(visitLogs)
      .where(where),
  ])
  return {
    list: list.map((r) => ({ ip: r.ip, city: r.city, pv: r.pv, uv: r.uv })),
    total: totalRows[0]?.count ?? 0,
    page: opts.page,
    pageSize: opts.pageSize,
  }
}

// =============================================================================
// 页面使用排行(2026-10-25 立)
// =============================================================================

export interface PageUsageItem {
  url: string
  /** 该页面归属的访问面(按 url 前缀现算,不是存储列) */
  scope: VisitScope
  pv: number
  uv: number
}

export interface FindPageUsageOpts {
  startTime?: string
  endTime?: string
  scope?: VisitScopeQuery
  page: number
  pageSize: number
}

export interface PageUsageResult {
  list: PageUsageItem[]
  /** 区间内出现过的不同页面数 */
  total: number
  /** 区间内同口径的总 PV,用于前端算「占全部访问的比例」 */
  totalPv: number
  page: number
  pageSize: number
}

/**
 * 按页面聚合 PV/UV(降序), 回答「每个页面被用了多少次」。
 * 与 summary 共用 `dateRangeFilter`(同一 scope 判据), 不另写一份前缀词表。
 */
export async function getPageUsageList(opts: FindPageUsageOpts): Promise<PageUsageResult> {
  const where = and(
    dateRangeFilter(opts.startTime, opts.endTime, opts.scope),
    isNotNull(visitLogs.url),
  )
  const uvExpr = sql<number>`count(distinct coalesce(${visitLogs.sessionId}, ${visitLogs.ip}))::int`
  const [rows, totalRows, totalPvRows] = await Promise.all([
    db
      .select({
        url: visitLogs.url,
        pv: sql<number>`count(${visitLogs.id})::int`,
        uv: uvExpr,
      })
      .from(visitLogs)
      .where(where)
      .groupBy(visitLogs.url)
      .orderBy(desc(sql`count(${visitLogs.id})`))
      .limit(opts.pageSize)
      .offset((opts.page - 1) * opts.pageSize),
    db
      .select({ count: sql<number>`count(distinct ${visitLogs.url})::int` })
      .from(visitLogs)
      .where(where),
    db
      .select({ count: sql<number>`count(${visitLogs.id})::int` })
      .from(visitLogs)
      .where(where),
  ])
  return {
    list: rows.map((r) => ({
      url: r.url ?? '',
      scope: classifyVisitScope(r.url),
      pv: Number(r.pv ?? 0),
      uv: Number(r.uv ?? 0),
    })),
    total: totalRows[0]?.count ?? 0,
    totalPv: totalPvRows[0]?.count ?? 0,
    page: opts.page,
    pageSize: opts.pageSize,
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
