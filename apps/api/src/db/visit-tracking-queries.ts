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
 * `visit_logs.user_id` 外键违约(23503)判定。
 *
 * 2026-10-26 生产实测:`/admin/*` 页面访问带了一个**已不存在**的用户 id(跨环境签发的旧 token /
 * 用户被删),insert 直接撞 `visit_logs_user_id_fkey` ⇒ 500 ⇒ 整条访问丢失且前端静默。
 * 埋点是计数面,身份失效不该把「有人用了」这条事实一起丢掉;降级为匿名(user_id=null)。
 *
 * drizzle 把 PG 错误裹进 cause(postgres-js 的 code/constraint 在 cause 上),两层都读。
 */
function isVisitUserIdFkViolation(err: unknown): boolean {
  const e = err as {
    code?: string
    constraint?: string
    cause?: { code?: string; constraint?: string }
  } | null
  const code = e?.code ?? e?.cause?.code
  const constraint = e?.constraint ?? e?.cause?.constraint
  if (code !== '23503') return false
  return constraint === null || constraint === undefined || constraint === 'visit_logs_user_id_fkey'
}

/**
 * 保存访问记录。visitDate 由服务端按业务日界算出(不再有入参通道:
 * 2026-10-25 摘掉 `visitDate?` 字段 —— 路由层 schema 已不收客户端自报日期,留这个字段
 * 就是给下一个"照着类型写"的人留一条把日键交回客户端的路)。
 * ip / user_agent 一律取 `observed`(服务端观测面),客户端自报值不进这一层。
 *
 * 带用户 id 时若撞外键(用户已不存在),**降级为匿名重插一次**;其它错误照抛 ——
 * 降级只覆盖"身份失效"这一型,不掩盖真正的写库故障。
 */
export async function saveVisitLog(input: SaveVisitLogInput): Promise<VisitLog> {
  // 访客日键一律服务端算,且必须是业务日界(上海);以前是 UTC ⇒ 早八点前 PV/UV 落错一天
  const visitDate = bizDayKey()
  const base = {
    ip: input.observed.ip,
    city: input.city,
    url: input.url,
    referer: input.referer,
    userAgent: input.observed.userAgent,
    sessionId: input.sessionId,
    visitDate,
  }
  const insert = async (userId: string | null | undefined) => {
    const rows = await db
      .insert(visitLogs)
      .values({ ...base, userId })
      .returning()
    const row = rows[0]
    if (!row) throw new Error('保存访问记录失败')
    return row
  }
  try {
    return await insert(input.userId)
  } catch (err) {
    if (!input.userId || !isVisitUserIdFkViolation(err)) throw err
    return insert(null)
  }
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
  platform?: VisitPlatformQuery
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
    visitPlatformFilter(opts.platform),
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

// =============================================================================
// 大屏实时页面热度(2026-10-26 立)
// =============================================================================

/** 窗口固定 24h;大屏要"现在有多少人在用哪些页面",不是按业务日切。 */
const PAGE_USAGE_WINDOW_HOURS = 24
const PAGE_USAGE_TOP_N = 8

/**
 * scope 的 SQL 投影:与 `classifyVisitScope` 共用同一组前缀常量。
 * 前缀词表只在文件顶部定义一次,这里不重抄(§0.6 单一真相源)。
 */
function scopeCaseSql() {
  const path = sql<string>`coalesce(${visitLogs.url}, '')`
  const admin = sql`${path} like ${`${ADMIN_PATH_PREFIX}%`}`
  const auth = sql`(${sql.join(
    AUTH_PATH_PREFIXES.map((prefix) => sql`${path} like ${`${prefix}%`}`),
    sql` or `,
  )})`
  return sql<VisitScope>`case when ${admin} then 'admin' when ${auth} then 'auth' else 'public' end`
}

export interface PageUsageLiveRow {
  url: string
  scope: VisitScope
  pv: number
  uv: number
}

export interface ScopeUsageLiveRow {
  scope: VisitScope
  pv: number
  uv: number
}

/** 端标识:web 端写裸路径,RN 写 `/rn/*`,小程序写 `/mp/*`(见各端埋点模块头注)。 */
export type VisitPlatform = 'web' | 'rn' | 'mp'

export interface PlatformUsageLiveRow {
  platform: VisitPlatform
  pv: number
  uv: number
}

/** 端筛选:端值 + 'all'。 */
export type VisitPlatformQuery = VisitPlatform | 'all'
export const VISIT_PLATFORM_VALUES = ['web', 'rn', 'mp', 'all'] as const

/**
 * platform → SQL 条件。与 `platformExpr`(大屏快照那一段)同语义:web = 非 `/rn/` 非 `/mp/`。
 * 缺省/'all' 不加条件。
 */
export function visitPlatformFilter(platform?: VisitPlatformQuery | null) {
  if (!platform || platform === 'all') return undefined
  const path = sql<string>`coalesce(${visitLogs.url}, '')`
  if (platform === 'rn') return sql`${path} like '/rn/%'`
  if (platform === 'mp') return sql`${path} like '/mp/%'`
  return sql`not (${path} like '/rn/%' or ${path} like '/mp/%')`
}

export interface PageUsageLiveSnapshot {
  /** 近 24h PV 最高的页面(降序,最多 PAGE_USAGE_TOP_N 条) */
  top: PageUsageLiveRow[]
  /** 近 24h 各访问面的 PV/UV —— 回答"后台/登录页各被用了多少次" */
  scopes: ScopeUsageLiveRow[]
  /** 近 24h 各端 PV/UV(web / RN / 小程序);分桶靠 url 前缀,与各端埋点约定一致 */
  platforms: PlatformUsageLiveRow[]
  /** 近 24h 同口径总 PV(前端算占比) */
  totalPv: number
  computedAtMs: number
}

/** 与访客快照同一个 5 秒 TTL:大屏 5s 轮询,多个观众共享一轮聚合。 */
export const PAGE_USAGE_LIVE_TTL_MS = 5_000

let pageUsageCache: { atMs: number; value: PageUsageLiveSnapshot } | null = null
let pageUsageInflight: Promise<PageUsageLiveSnapshot> | null = null

/** 现算一份;任一 SQL 抛错就整块上抛,由调用方折成 null(渲染"—"),绝不兜成 0。 */
export async function computePageUsageLiveSnapshot(): Promise<PageUsageLiveSnapshot> {
  const start = sql`now() - make_interval(hours => ${PAGE_USAGE_WINDOW_HOURS})`
  const inWindow = sql`${visitLogs.createdAt} >= ${start}`
  const pvExpr = sql<number>`count(*)::int`
  const uvExpr = sql<number>`count(distinct coalesce(${visitLogs.sessionId}, ${visitLogs.ip}))::int`
  const scopeExpr = scopeCaseSql()
  const pathCol = sql<string>`coalesce(${visitLogs.url}, '')`
  const platformExpr = sql<VisitPlatform>`case
    when ${pathCol} like '/mp/%' then 'mp'
    when ${pathCol} like '/rn/%' then 'rn'
    else 'web' end`
  const [topRows, scopeRows, platformRows] = await Promise.all([
    db
      .select({ url: visitLogs.url, pv: pvExpr, uv: uvExpr })
      .from(visitLogs)
      .where(and(inWindow, isNotNull(visitLogs.url)))
      .groupBy(visitLogs.url)
      .orderBy(sql`count(*) desc`)
      .limit(PAGE_USAGE_TOP_N),
    db
      .select({ scope: scopeExpr, pv: pvExpr, uv: uvExpr })
      .from(visitLogs)
      .where(inWindow)
      .groupBy(scopeExpr)
      .orderBy(sql`count(*) desc`),
    db
      .select({ platform: platformExpr, pv: pvExpr, uv: uvExpr })
      .from(visitLogs)
      .where(inWindow)
      .groupBy(platformExpr)
      .orderBy(sql`count(*) desc`),
  ])
  return {
    top: topRows.map((r) => ({
      url: r.url ?? '',
      scope: classifyVisitScope(r.url),
      pv: Number(r.pv ?? 0),
      uv: Number(r.uv ?? 0),
    })),
    scopes: scopeRows.map((r) => ({
      scope: r.scope,
      pv: Number(r.pv ?? 0),
      uv: Number(r.uv ?? 0),
    })),
    platforms: platformRows.map((r) => ({
      platform: r.platform,
      pv: Number(r.pv ?? 0),
      uv: Number(r.uv ?? 0),
    })),
    totalPv: scopeRows.reduce((sum, r) => sum + Number(r.pv ?? 0), 0),
    computedAtMs: Date.now(),
  }
}

/** 取一份"最多 TTL 毫秒前"的快照;失败不入缓存,下个请求重试。 */
export async function getPageUsageLiveSnapshot(
  ttlMs: number = PAGE_USAGE_LIVE_TTL_MS,
): Promise<PageUsageLiveSnapshot> {
  const nowMs = Date.now()
  if (pageUsageCache && nowMs - pageUsageCache.atMs < ttlMs) return pageUsageCache.value
  if (pageUsageInflight) return pageUsageInflight
  const inflight = (async () => {
    try {
      const value = await computePageUsageLiveSnapshot()
      pageUsageCache = { atMs: value.computedAtMs, value }
      return value
    } finally {
      pageUsageInflight = null
    }
  })()
  pageUsageInflight = inflight
  return inflight
}

/** 仅测试用:清缓存。 */
export function __resetPageUsageLiveCacheForTest(): void {
  pageUsageCache = null
  pageUsageInflight = null
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
