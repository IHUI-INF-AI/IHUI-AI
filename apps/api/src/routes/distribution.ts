import type { FastifyPluginAsync } from 'fastify'
import { eq, sql, desc } from 'drizzle-orm'
import { dbRead } from '../db/index.js'
import { commissionFlows, withdrawalFlows, users } from '@ihui/database'
import { authenticate } from '../plugins/auth.js'
import { success, error } from '../utils/response.js'

export const distributionRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', async (request, reply) => {
    try {
      await authenticate(request)
    } catch (e) {
      const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
      return reply
        .status(statusCode)
        .send(error(statusCode, (e as Error).message || 'Authentication required'))
    }
  })

  // GET /distribution/overview — 分销概览
  server.get('/distribution/overview', async (request, reply) => {
    const userId = request.userId!
    const [userRow] = await dbRead
      .select({ inviteCode: users.inviteCode })
      .from(users)
      .where(eq(users.id, userId))

    const [totalRow] = await dbRead
      .select({ total: sql<number>`coalesce(sum(${commissionFlows.amount}), 0)` })
      .from(commissionFlows)
      .where(eq(commissionFlows.beneficiaryId, userId))

    const [pendingRow] = await dbRead
      .select({ total: sql<number>`coalesce(sum(${commissionFlows.amount}), 0)` })
      .from(commissionFlows)
      .where(sql`${commissionFlows.beneficiaryId} = ${userId} AND ${commissionFlows.status} = 1`)

    const [withdrawnRow] = await dbRead
      .select({ total: sql<number>`coalesce(sum(${withdrawalFlows.amount}), 0)` })
      .from(withdrawalFlows)
      .where(sql`${withdrawalFlows.userId} = ${userId} AND ${withdrawalFlows.status} = 2`)

    return reply.send(
      success({
        totalCommission: Number(totalRow?.total ?? 0),
        pendingCommission: Number(pendingRow?.total ?? 0),
        withdrawnCommission: Number(withdrawnRow?.total ?? 0),
        inviteCode: userRow?.inviteCode ?? null,
      }),
    )
  })

  // GET /distribution/invited-users — 邀请用户列表
  server.get('/distribution/invited-users', async (request, reply) => {
    const userId = request.userId!
    const list = await dbRead
      .select({
        id: users.id,
        username: users.username,
        nickname: users.nickname,
        avatar: users.avatar,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.parentId, userId))
      .orderBy(desc(users.createdAt))

    return reply.send(success({ list, total: list.length }))
  })
}
