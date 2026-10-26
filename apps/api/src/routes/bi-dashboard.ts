// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { FastifyPluginAsync } from 'fastify'
import { count, sql } from 'drizzle-orm'
import { dbRead } from '../db/index.js'
import { users, orders, userDevices, visitLogs, analyticsEvents } from '@ihui/database'
import { requireAdmin } from '../plugins/require-permission.js'
import { success } from '../utils/response.js'
import { computeAudience, computeBrowserUsage } from '../services/audience-stats-service.js'
// 端分桶判据的唯一真相源(前缀表 + 逐行归类 + SQL 表达式),不在路由里重抄一份
import {
  classifyVisitPlatform,
  visitPlatformCaseSql,
  visitScopeCaseSql,
  type VisitPlatform,
  type VisitScope,
} from '../db/visit-tracking-queries.js'

/** 30 天内活跃用户数:users 表无登录时间字段(2026-08-31 修复 500),
 * 改用 user_devices.last_seen_at 去重统计(Drizzle ORM 版,不依赖原生 SQL)。 */
async function countActiveUsers(): Promise<number> {
  const [row] = await dbRead
    .select({ cnt: countDistinctSafe() })
    .from(userDevices)
    .where(sql`${userDevices.lastSeenAt} > now() - interval '30 days'`)
  return row?.cnt ?? 0
}

/** count(distinct user_id) 的 Drizzle 等价写法(避免 sql 模板注入列名歧义)。 */
function countDistinctSafe() {
  return sql<number>`count(distinct ${userDevices.userId})`
}

/** 趋势/来源/页面排行的观察窗(天)。 */
const WINDOW_DAYS = 7

/** 上海日界的 YYYY-MM-DD(与 visit_logs.visit_date 同键)。 */
function shanghaiDayKey(offsetDays = 0): string {
  const at = new Date(Date.now() + offsetDays * 86_400_000)
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(at)
}

/** 最近 N 天(含今天)的日期序列,升序。 */
function recentDayKeys(days: number): string[] {
  const keys: string[] = []
  for (let i = days - 1; i >= 0; i--) keys.push(shanghaiDayKey(-i))
  return keys
}

/** `page_time` 事件里的停留秒数(非数字行不参与均值,不把脏行读成 0)。 */
const PAGE_TIME_SEC = sql`case
  when ${analyticsEvents.properties}->>'value' ~ '^[0-9]+(\\.[0-9]+)?$'
  then (${analyticsEvents.properties}->>'value')::numeric
  else null
end`

/**
 * BI 仪表板 payload(2026-10-26 重写)。
 *
 * 立因:前端从 2026-08 起就按 `{ trend, categories, sources, newUsers }` 渲染,而后端只回
 * `{ totalUsers, totalOrders, totalRevenue, activeUsers }` —— 缺的字段在渲染期直接 `.map`
 * ⇒ 页面白屏进错误边界。本次把契约补齐,并顺手把**访问埋点**接进数据大屏:
 * `visits` 块 (PV/UV + 页面排行) 与 `sources`(referer 主机)都来自 visit_logs,
 * 与 /admin/monitor/wallboard 的页面热度同源,不再只有营收/订单。
 *
 * 口径:
 * - 日界一律 Asia/Shanghai(`to_char(... at time zone ...)`),与 bizDayKey 同界。
 * - 营收只算 status='paid' 且有 paid_at 的行。
 * - 来源把完整 referer 折成**主机名**;无 referer 折成 `(direct)`(前端不做二次解析)。
 * - 空集返回空数组而不是造数(前端渲染"暂无数据")。
 */
async function buildBiPayload() {
  const [
    [userRow],
    [newUserRow],
    [orderRow],
    [revenueRow],
    activeUsers,
    trend,
    categories,
    sources,
    [visitTotals],
    pages,
    dailyVisitRows,
    stayRows,
    audience,
    browsers,
    platforms,
    faces,
    cities,
  ] = await Promise.all([
    dbRead.select({ total: count() }).from(users),
    dbRead
      .select({ total: count() })
      .from(users)
      .where(sql`${users.createdAt} > now() - interval '30 days'`),
    dbRead.select({ total: count() }).from(orders),
    dbRead
      .select({ total: sql<number>`coalesce(sum(${orders.amount}), 0)` })
      .from(orders)
      .where(sql`${orders.status} = 'paid'`),
    countActiveUsers(),
    dbRead
      .select({
        date: sql<string>`to_char(${orders.paidAt} at time zone 'Asia/Shanghai', 'YYYY-MM-DD')`,
        revenue: sql<number>`coalesce(sum(${orders.amount}), 0)::int`,
        orders: sql<number>`count(*)::int`,
      })
      .from(orders)
      .where(
        sql`${orders.status} = 'paid' and ${orders.paidAt} >= now() - make_interval(days => ${WINDOW_DAYS})`,
      )
      .groupBy(sql`1`)
      .orderBy(sql`1`),
    dbRead
      .select({
        name: sql<string>`'类型 ' || ${orders.orderType}::text`,
        value: sql<number>`coalesce(sum(${orders.amount}), 0)::int`,
      })
      .from(orders)
      .where(sql`${orders.status} = 'paid'`)
      .groupBy(orders.orderType)
      .orderBy(sql`2 desc`)
      .limit(8),
    dbRead
      .select({
        name: sql<string>`coalesce(nullif(split_part(${visitLogs.referer}, '/', 3), ''), '(direct)')`,
        value: sql<number>`count(*)::int`,
      })
      .from(visitLogs)
      .where(sql`${visitLogs.createdAt} >= now() - make_interval(days => ${WINDOW_DAYS})`)
      .groupBy(sql`1`)
      .orderBy(sql`2 desc`)
      .limit(6),
    dbRead
      .select({
        pv: sql<number>`count(*)::int`,
        uv: sql<number>`count(distinct coalesce(${visitLogs.sessionId}, ${visitLogs.ip}))::int`,
      })
      .from(visitLogs)
      .where(sql`${visitLogs.createdAt} >= now() - make_interval(days => ${WINDOW_DAYS})`),
    dbRead
      .select({
        url: sql<string>`coalesce(${visitLogs.url}, '(unknown)')`,
        pv: sql<number>`count(*)::int`,
        uv: sql<number>`count(distinct coalesce(${visitLogs.sessionId}, ${visitLogs.ip}))::int`,
      })
      .from(visitLogs)
      .where(
        sql`${visitLogs.createdAt} >= now() - make_interval(days => ${WINDOW_DAYS}) and ${visitLogs.url} is not null`,
      )
      .groupBy(sql`1`)
      .orderBy(sql`2 desc`)
      .limit(8),
    // 近 7 日按业务日聚合(visit_date 是服务端写的上海日键,字符串比较即可)
    dbRead
      .select({
        date: visitLogs.visitDate,
        pv: sql<number>`count(*)::int`,
        uv: sql<number>`count(distinct coalesce(${visitLogs.sessionId}, ${visitLogs.ip}))::int`,
      })
      .from(visitLogs)
      .where(sql`${visitLogs.visitDate} >= ${recentDayKeys(WINDOW_DAYS)[0]}`)
      .groupBy(visitLogs.visitDate)
      .orderBy(visitLogs.visitDate),
    // 页面停留 TOP:取 page_time 事件按页面(label=路径)求均值,样本数为 0 的页面不出现
    dbRead
      .select({
        page: sql<string>`coalesce(${analyticsEvents.properties}->>'label', '(unknown)')`,
        avgSec: sql<number>`round(avg(${PAGE_TIME_SEC}), 1)`,
        samples: sql<number>`count(*)::int`,
      })
      .from(analyticsEvents)
      .where(
        sql`${analyticsEvents.event} = 'page_time' and ${analyticsEvents.createdAt} >= now() - interval '7 days'`,
      )
      .groupBy(sql`1`)
      .having(sql`count(${PAGE_TIME_SEC}) > 0`)
      .orderBy(sql`2 desc`)
      .limit(8),
    // 访客构成(新/回访)与浏览器分布:这两条腿取不到时折成 null,不拖垮整页(其余块照常出)。
    computeAudience().catch(() => null),
    computeBrowserUsage().catch(() => null),
    // 各端使用量(近 7 日):分桶表达式与大屏 platformSplit 同一份前缀表,不另写判据
    dbRead
      .select({
        platform: visitPlatformCaseSql(),
        pv: sql<number>`count(*)::int`,
        uv: sql<number>`count(distinct coalesce(${visitLogs.sessionId}, ${visitLogs.ip}))::int`,
      })
      .from(visitLogs)
      .where(sql`${visitLogs.createdAt} >= now() - make_interval(days => ${WINDOW_DAYS})`)
      .groupBy(visitPlatformCaseSql())
      .orderBy(sql`count(*) desc`),
    // 访问面(前台/后台/登录页)占比:判据与监控大屏 scopeSplit 同一份投影
    dbRead
      .select({
        scope: visitScopeCaseSql(),
        pv: sql<number>`count(*)::int`,
        uv: sql<number>`count(distinct coalesce(${visitLogs.sessionId}, ${visitLogs.ip}))::int`,
      })
      .from(visitLogs)
      .where(sql`${visitLogs.createdAt} >= now() - make_interval(days => ${WINDOW_DAYS})`)
      .groupBy(visitScopeCaseSql())
      .orderBy(sql`count(*) desc`),
    // 地域 TOP(服务端按 IP 反查的 city):回答"这些人从哪来"
    dbRead
      .select({
        city: sql<string>`coalesce(nullif(${visitLogs.city}, ''), '(未知)')`,
        pv: sql<number>`count(*)::int`,
        uv: sql<number>`count(distinct coalesce(${visitLogs.sessionId}, ${visitLogs.ip}))::int`,
      })
      .from(visitLogs)
      .where(sql`${visitLogs.createdAt} >= now() - make_interval(days => ${WINDOW_DAYS})`)
      .groupBy(sql`1`)
      .orderBy(sql`count(*) desc`)
      .limit(6),
  ])

  return {
    totalUsers: userRow?.total ?? 0,
    newUsers: newUserRow?.total ?? 0,
    totalOrders: orderRow?.total ?? 0,
    totalRevenue: Number(revenueRow?.total ?? 0),
    activeUsers,
    trend: trend.map((r) => ({
      date: r.date,
      revenue: Number(r.revenue ?? 0),
      orders: Number(r.orders ?? 0),
    })),
    categories: categories.map((r) => ({ name: r.name, value: Number(r.value ?? 0) })),
    sources: sources.map((r) => ({ name: r.name, value: Number(r.value ?? 0) })),
    visits: {
      pv: Number(visitTotals?.pv ?? 0),
      uv: Number(visitTotals?.uv ?? 0),
      pages: pages.map((r) => ({
        url: r.url,
        platform: classifyVisitPlatform(r.url),
        pv: Number(r.pv ?? 0),
        uv: Number(r.uv ?? 0),
      })),
      // 补齐 7 天:缺数据的日期补 0(图表 x 轴连续,不把"那天没人来"读成"那天没数据")
      daily: recentDayKeys(WINDOW_DAYS).map((date) => {
        const row = dailyVisitRows.find((r) => r.date === date)
        return { date, pv: Number(row?.pv ?? 0), uv: Number(row?.uv ?? 0) }
      }),
    },
    /** 近 7 日页面停留 TOP(page_time 事件均值;样本数 = 该页停留事件条数) */
    stays: stayRows.map((r) => ({
      page: r.page,
      platform: classifyVisitPlatform(r.page),
      avgSec: Number(r.avgSec ?? 0),
      samples: Number(r.samples ?? 0),
    })),
    /** 近 7 日访客构成:新访客 / 回访访客(身份 = coalesce(session_id, ip),与 UV 同尺);null = 取不到 */
    audience:
      audience === null
        ? null
        : {
            newUv: audience.newUv,
            returningUv: audience.returningUv,
            activeUv: audience.activeUv,
            returningRate: audience.returningRate,
          },
    /** 近 7 日浏览器分布(只算 web 裸路径);null = 取不到 */
    browsers: browsers,
    /** 近 7 日各端使用量(网站/移动端/小程序/浏览器插件;分桶判据与监控大屏同源) */
    platforms: platforms.map((r) => ({
      platform: String(r.platform) as VisitPlatform,
      pv: Number(r.pv ?? 0),
      uv: Number(r.uv ?? 0),
    })),
    /** 近 7 日访问面(前台/后台/登录页):后台与登录页被用了多少次,过去只能靠前端"丢弃"来保证纯净 */
    faces: faces.map((r) => ({
      scope: String(r.scope) as VisitScope,
      pv: Number(r.pv ?? 0),
      uv: Number(r.uv ?? 0),
    })),
    /** 近 7 日地域 TOP(服务端按 IP 反查;取不到写 (未知),不猜) */
    cities: cities.map((r) => ({
      city: String(r.city),
      pv: Number(r.pv ?? 0),
      uv: Number(r.uv ?? 0),
    })),
  }
}

export const biDashboardRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)

  // 两个路径指向同一份 payload:老调用方用 /bi/dashboard,前端用 /bi-dashboard。
  // 共享一个 handler ⇒ 不会出现"别名那条少几个字段"的分叉。
  server.get('/bi/dashboard', async (_request, reply) => {
    return reply.send(success(await buildBiPayload()))
  })

  server.get('/bi-dashboard', async (_request, reply) => {
    return reply.send(success(await buildBiPayload()))
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
