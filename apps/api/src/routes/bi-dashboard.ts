// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { FastifyPluginAsync } from 'fastify'
import { count, sql } from 'drizzle-orm'
import { dbRead } from '../db/index.js'
import { users, orders, userDevices, visitLogs } from '@ihui/database'
import { requireAdmin } from '../plugins/require-permission.js'
import { success } from '../utils/response.js'

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
        pv: Number(r.pv ?? 0),
        uv: Number(r.uv ?? 0),
      })),
    },
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
