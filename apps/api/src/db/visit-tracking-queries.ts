// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { and, gte, lte, isNotNull, desc, sql, asc } from 'drizzle-orm'
import { bizDayKey } from '../utils/biz-day.js'
import { db } from './index.js'
import { visitLogs, type VisitLog } from '@ihui/database'
import { normalizeVisitPath } from '@ihui/shared/utils/visit-url'
import { stripUrlCredentialSegments } from '@ihui/shared/utils/sanitize-url'

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
 * referer 入库前的凭据剥离(2026-10-26 立)。
 *
 * 客户端(web `VisitTracker`)已经剥过一次 query/hash,但**服务端不能只靠客户端自律**:
 * 任一端回归、或非 web 端直接调这个公开端点,`?code=…&state=…` 这类授权凭据就会
 * 落进 `visit_logs.referer`,而它会出现在管理端「访问来源」面板上。
 * 剥的是 query/hash 段,**host 保留** ⇒「访问来源」按主机分桶的口径不受影响。
 */
function sanitizeVisitReferer(raw: string | null | undefined): string | null {
  const value = (raw ?? '').trim()
  if (!value) return null
  const stripped = stripUrlCredentialSegments(value).trim()
  return stripped ? stripped.slice(0, 512) : null
}

/**
 * 保存访问记录。visitDate 由服务端按业务日界算出(不再有入参通道:
 * 2026-10-25 摘掉 `visitDate?` 字段 —— 路由层 schema 已不收客户端自报日期,留这个字段
 * 就是给下一个"照着类型写"的人留一条把日键交回客户端的路)。
 * ip / user_agent 一律取 `observed`(服务端观测面),客户端自报值不进这一层。
 *
 * url / referer 也在这里归一(2026-10-26):客户端剥过凭据只是**第一道**,服务端这层
 * 才是真防线 —— 判据单一真相源 = `@ihui/shared/utils/visit-url`(写入面、存量清洗、
 * 只读覆盖面尺共用同一份),不在此处另写一份正则。
 * 归一不出来(静态资源 / 路由组形态)⇒ url 置 null:行仍写 ⇒ PV 不丢,但不进页面排行。
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
    url: normalizeVisitPath(input.url),
    referer: sanitizeVisitReferer(input.referer),
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
  /** 该页面归属的端(按 url 前缀现算:`/rn/` `/mp/` `/ex/`,其余 web) */
  platform: VisitPlatform
  pv: number
  uv: number
}

export interface FindPageUsageOpts {
  startTime?: string
  endTime?: string
  scope?: VisitScopeQuery
  platform?: VisitPlatformQuery
  /** 排序键:'pv'=打开次数(默认),'uv'=去重访客数 */
  sort?: 'pv' | 'uv'
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
  // 排序键与聚合口径同源:按 PV 排 = count(*);按 UV 排 = 同一个 distinct 表达式
  const orderExpr =
    opts.sort === 'uv'
      ? sql`count(distinct coalesce(${visitLogs.sessionId}, ${visitLogs.ip})) desc`
      : sql`count(${visitLogs.id}) desc`
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
      .orderBy(orderExpr)
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
      platform: classifyVisitPlatform(r.url),
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
 * 导出给数据大屏复用:监控面与前台/后台/登录页分桶必须是同一份判据。
 */
export function visitScopeCaseSql() {
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
  /** 该页面归属的端(按 url 前缀现算,与访问追踪页同一把尺:见 classifyVisitPlatform) */
  platform: VisitPlatform
  pv: number
  uv: number
}

export interface ScopeUsageLiveRow {
  scope: VisitScope
  pv: number
  uv: number
}

/**
 * 近 24h 逐小时访问一行(2026-10-27 立)。
 *
 * 回答「一天里什么时段用得多」:此前大屏只有 api_logs 的今日分时**调用**曲线,
 * 页面使用(visit_logs)在时间维度上一格没有 —— PV/UV/排行都是总量,看不出使用节奏。
 * 窗口是**滚动 24h** ⇒ 每个 HH24 桶在窗口里各出现一次(跨夜两侧各半截),
 * 24 个桶画满即为「按小时看的使用分布」;空桶是该小时真没人,不是"没到"(与
 * 「今日分时调用」的截断语义不同,那条是当日累计、未来小时不得画 0 柱)。
 */
export interface PageHourlyRow {
  /** 小时桶 '00'..'23'(Asia/Shanghai,与写入侧业务日界同一时区口径) */
  hour: string
  pv: number
  uv: number
}

/**
 * 把 SQL 原始行折成 `PageHourlyRow[]`(纯函数,零连接取证用)。
 *
 * PG 的 int4 经某些驱动回传字符串(本仓实测踩过,见 session-quality 测试 A3)⇒
 * 数字一律过 Number + isFinite,取不到落 0;hour 钳成两位,升序排序由 SQL 侧保证,
 * 这里只做归一不做排序(顺序是 SQL 的承诺,不在两处各排一次)。
 */
export function foldHourlyRows(
  rows: ReadonlyArray<{
    hour?: string | null
    pv?: number | string | null
    uv?: number | string | null
  }>,
): PageHourlyRow[] {
  const num = (v: number | string | null | undefined): number => {
    const n = Number(v)
    return Number.isFinite(n) && n > 0 ? n : 0
  }
  return rows.map((r) => ({
    hour: String(r.hour ?? '')
      .padStart(2, '0')
      .slice(-2),
    pv: num(r.pv),
    uv: num(r.uv),
  }))
}

/** 端标识:网站写裸路径,RN 写 `/rn/*`,小程序写 `/mp/*`,浏览器插件写 `/ex/*`(见各端埋点模块头注)。 */
export type VisitPlatform = 'web' | 'rn' | 'mp' | 'ex'

export interface PlatformUsageLiveRow {
  platform: VisitPlatform
  /** 近 24h(大屏窗口)PV/UV */
  pv: number
  uv: number
  /** 近 90 日 PV —— 用来把"这端从没上报过"与"今天恰好没人用"分开 */
  pv90d: number
  /** 这端最后一次被记到的时刻(ISO 文本);90 日内无记录 ⇒ null */
  lastSeenAt: string | null
}

/** 端接入史的窗口天数。 */
export const PLATFORM_HISTORY_DAYS = 90

/**
 * 24h 端计数与 90 日接入史合并成大屏那一块。
 * 两腿的分组表达式同源(`visitPlatformCaseSql`),所以键一定是同一套端值。
 * 排序按 24h PV 降序,并列时按 90 日 PV 降序 —— 一条都没的端也要留在表上,
 * 否则"这端零接入"会被读成"这端不存在"。
 */
export function mergePlatformRows(
  live: Array<{ platform: VisitPlatform; pv: number | string; uv: number | string }>,
  history: Array<{ platform: VisitPlatform; pv90d: number | string; lastSeenAt: string | null }>,
): PlatformUsageLiveRow[] {
  const byEnd = new Map<VisitPlatform, PlatformUsageLiveRow>()
  const blank = (platform: VisitPlatform): PlatformUsageLiveRow => ({
    platform,
    pv: 0,
    uv: 0,
    pv90d: 0,
    lastSeenAt: null,
  })
  // 先把四端铺满:一条都没的端也要留在表上,否则"这端零接入"会被读成"这端不存在"
  for (const end of [...Object.keys(VISIT_PLATFORM_PATH_PREFIXES), 'web'] as VisitPlatform[]) {
    byEnd.set(end, blank(end))
  }
  for (const r of history) {
    const row = byEnd.get(r.platform) ?? blank(r.platform)
    row.pv90d = Number(r.pv90d ?? 0)
    row.lastSeenAt = r.lastSeenAt ?? null
    byEnd.set(r.platform, row)
  }
  for (const r of live) {
    const row = byEnd.get(r.platform) ?? blank(r.platform)
    row.pv = Number(r.pv ?? 0)
    row.uv = Number(r.uv ?? 0)
    byEnd.set(r.platform, row)
  }
  return [...byEnd.values()].sort((a, b) => b.pv - a.pv || b.pv90d - a.pv90d)
}

/** 端筛选:端值 + 'all'。 */
export type VisitPlatformQuery = VisitPlatform | 'all'
export const VISIT_PLATFORM_VALUES = ['web', 'rn', 'mp', 'ex', 'all'] as const

/**
 * 非 web 端的 url 前缀词表 —— 分桶判据的唯一真相源。
 * web 不列在这里:它按「不落在任何登记前缀里」现算(见 visitPlatformFilter / visitPlatformCaseSql),
 * 所以新增一端只改这张表,筛选面与大屏聚合面会同时跟着走,不可能出现两边口径漂移。
 */
export const VISIT_PLATFORM_PATH_PREFIXES = { rn: '/rn/', mp: '/mp/', ex: '/ex/' } as const

/** 前缀 → like 形态(`/rn/` ⇒ `/rn/%`),两处判据共用同一算式。 */
function likePattern(prefix: string): string {
  return `${prefix}%`
}

/** 任意非 web 端前缀命中条件;空表(理论态)会退化成 false,不会误把全部当成某端。 */
function anyNonWebPrefixCond() {
  const path = sql<string>`coalesce(${visitLogs.url}, '')`
  const entries = Object.values(VISIT_PLATFORM_PATH_PREFIXES)
  if (entries.length === 0) return sql`false`
  return sql`(${sql.join(
    entries.map((prefix) => sql`${path} like ${likePattern(prefix)}`),
    sql` or `,
  )})`
}

/**
 * platform → SQL 条件。与 `visitPlatformCaseSql`(大屏快照那一段)同语义:web = 不落在任何登记前缀。
 * 缺省/'all' 不加条件。
 */
export function visitPlatformFilter(platform?: VisitPlatformQuery | null) {
  if (!platform || platform === 'all') return undefined
  const path = sql<string>`coalesce(${visitLogs.url}, '')`
  const prefix = VISIT_PLATFORM_PATH_PREFIXES[platform as Exclude<VisitPlatform, 'web'>] as
    string | undefined
  if (prefix) return sql`${path} like ${likePattern(prefix)}`
  return sql`not ${anyNonWebPrefixCond()}`
}

/** 端分桶表达式:命中登记前缀归该端,其余归 web。大屏快照与数据大屏「各端使用量」共用这一份。 */
export function visitPlatformCaseSql() {
  const path = sql<string>`coalesce(${visitLogs.url}, '')`
  const whens = Object.entries(VISIT_PLATFORM_PATH_PREFIXES).map(
    ([platform, prefix]) => sql`when ${path} like ${likePattern(prefix)} then ${platform}`,
  )
  return sql<VisitPlatform>`case ${sql.join(whens, sql` `)} else 'web' end`
}

/**
 * 单条 url 的端归属(与 `visitPlatformCaseSql` 共用 `VISIT_PLATFORM_PATH_PREFIXES`)。
 * 排行列表要在每一行上标出「这条页面属于哪一端」,而 SQL 分桶只给聚合值,故需要这份逐行判据。
 */
export function classifyVisitPlatform(url: string | null | undefined): VisitPlatform {
  const path = (url ?? '').trim()
  for (const [platform, prefix] of Object.entries(VISIT_PLATFORM_PATH_PREFIXES)) {
    if (path.startsWith(prefix)) return platform as VisitPlatform
  }
  return 'web'
}

export interface PageUsageLiveSnapshot {
  /** 近 24h PV 最高的页面(降序,最多 PAGE_USAGE_TOP_N 条) */
  top: PageUsageLiveRow[]
  /** 近 24h 各访问面的 PV/UV —— 回答"后台/登录页各被用了多少次" */
  scopes: ScopeUsageLiveRow[]
  /** 近 24h 各端 PV/UV(web / RN / 小程序 / 浏览器插件);分桶靠 url 前缀,与各端埋点约定一致 */
  platforms: PlatformUsageLiveRow[]
  /** 近 5 分钟去重会话数(实时在线近似) */
  online5m: number
  /** 近 5 分钟浏览量 */
  pv5m: number
  /** 近 24h 同口径总 PV(前端算占比) */
  totalPv: number
  /** 近 24h 逐小时 PV/UV(上海小时桶,升序);回答「一天里什么时段用得多」 */
  hourly: PageHourlyRow[]
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
  const scopeExpr = visitScopeCaseSql()
  const platformExpr = visitPlatformCaseSql()
  // 分时桶:Asia/Shanghai 小时(与 ops-wallboard 的 api_logs 分时调用同一时区口径),
  // 两处共用同一形态的 to_char ⇒ 大屏两条分时曲线横轴可对读。
  const hourExpr = sql<string>`to_char(${visitLogs.createdAt} AT TIME ZONE 'Asia/Shanghai', 'HH24')`
  const [topRows, scopeRows, platformRows, platformHistoryRows, onlineRows, hourlyRows] =
    await Promise.all([
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
      // 端接入史(90 日):回答"这一端到底有没有在产数据"。零行的端与"今天没人用"在 24h 口径下
      // 逐字同形,不补这一腿就只能靠人去猜(小程序/插件/RN 接入初期尤其如此)。
      // 走 visit_date(有索引)而不是 created_at(无索引),字符串界与写入侧同用上海业务日。
      db
        .select({
          platform: platformExpr,
          pv90d: sql<number>`count(*)::int`,
          lastSeenAt: sql<string | null>`max(${visitLogs.createdAt})::text`,
        })
        .from(visitLogs)
        .where(
          sql`${visitLogs.visitDate} >= to_char(now() - make_interval(days => ${PLATFORM_HISTORY_DAYS}) at time zone 'Asia/Shanghai', 'YYYY-MM-DD')`,
        )
        .groupBy(platformExpr)
        .orderBy(sql`count(*) desc`),
      // 实时在线:近 5 分钟的去重会话(UV 口径)与浏览量 —— 大屏"此刻多少人在用"
      db
        .select({
          online: sql<number>`count(distinct coalesce(${visitLogs.sessionId}, ${visitLogs.ip}))::int`,
          pv: sql<number>`count(*)::int`,
        })
        .from(visitLogs)
        .where(sql`${visitLogs.createdAt} >= now() - make_interval(mins => 5)`),
      // 分时访问(2026-10-27):同一 24h 窗口按小时分桶 —— "什么时段用得多"。
      // 窗口内每个 HH24 桶各出现一次,空桶不补行(前端按桶渲染,缺行即该小时 0)。
      db
        .select({ hour: hourExpr, pv: pvExpr, uv: uvExpr })
        .from(visitLogs)
        .where(inWindow)
        .groupBy(hourExpr)
        .orderBy(hourExpr),
    ])
  return {
    top: topRows.map((r) => ({
      url: r.url ?? '',
      scope: classifyVisitScope(r.url),
      platform: classifyVisitPlatform(r.url),
      pv: Number(r.pv ?? 0),
      uv: Number(r.uv ?? 0),
    })),
    scopes: scopeRows.map((r) => ({
      scope: r.scope,
      pv: Number(r.pv ?? 0),
      uv: Number(r.uv ?? 0),
    })),
    platforms: mergePlatformRows(platformRows, platformHistoryRows),
    online5m: Number(onlineRows[0]?.online ?? 0),
    pv5m: Number(onlineRows[0]?.pv ?? 0),
    totalPv: scopeRows.reduce((sum, r) => sum + Number(r.pv ?? 0), 0),
    hourly: foldHourlyRows(hourlyRows),
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
