// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { FastifyPluginAsync } from 'fastify'
import { count, sql, eq } from 'drizzle-orm'
import { dbRead } from '../db/index.js'
import { users, orders, userDevices } from '@ihui/database'
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

export const biDashboardRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)

  // GET /bi/dashboard — BI 仪表盘概览（管理员）
  server.get('/bi/dashboard', async (_request, reply) => {
    const [userRow] = await dbRead.select({ total: count() }).from(users)
    const totalUsers = userRow?.total ?? 0

    const [orderRow] = await dbRead.select({ total: count() }).from(orders)
    const totalOrders = orderRow?.total ?? 0

    const [revenueRow] = await dbRead
      .select({ total: sql<number>`coalesce(sum(${orders.amount}), 0)` })
      .from(orders)
      .where(eq(orders.status, 'paid'))
    const totalRevenue = Number(revenueRow?.total ?? 0)

    const activeUsers = await countActiveUsers()

    return reply.send(success({ totalUsers, totalOrders, totalRevenue, activeUsers }))
  })

  // GET /bi-dashboard — 别名（前端调用 /api/admin/bi-dashboard）
  server.get('/bi-dashboard', async (_request, reply) => {
    const [userRow] = await dbRead.select({ total: count() }).from(users)
    const totalUsers = userRow?.total ?? 0

    const [orderRow] = await dbRead.select({ total: count() }).from(orders)
    const totalOrders = orderRow?.total ?? 0

    const [revenueRow] = await dbRead
      .select({ total: sql<number>`coalesce(sum(${orders.amount}), 0)` })
      .from(orders)
      .where(eq(orders.status, 'paid'))
    const totalRevenue = Number(revenueRow?.total ?? 0)

    const activeUsers = await countActiveUsers()

    return reply.send(success({ totalUsers, totalOrders, totalRevenue, activeUsers }))
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
