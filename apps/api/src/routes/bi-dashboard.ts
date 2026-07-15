import type { FastifyPluginAsync } from 'fastify'
import { count, sql, eq } from 'drizzle-orm'
import { dbRead } from '../db/index.js'
import { users, orders } from '@ihui/database'
import { requireAdmin } from '../plugins/require-permission.js'
import { success } from '../utils/response.js'

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

    const activeResult = await dbRead.execute(sql`
      SELECT count(*)::int AS cnt FROM users WHERE last_login_at > now() - interval '30 days'
    `)
    const activeUsers = (activeResult[0] as { cnt: number } | undefined)?.cnt ?? 0

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

    const activeResult = await dbRead.execute(sql`
      SELECT count(*)::int AS cnt FROM users WHERE last_login_at > now() - interval '30 days'
    `)
    const activeUsers = (activeResult[0] as { cnt: number } | undefined)?.cnt ?? 0

    return reply.send(success({ totalUsers, totalOrders, totalRevenue, activeUsers }))
  })
}
