import type { FastifyPluginAsync } from 'fastify'
import { eq, sql, desc, and } from 'drizzle-orm'
import { dbRead } from '../db/index.js'
import { commissionFlows, withdrawalFlows, users, systemConfigs } from '@ihui/database'
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

  // GET /distribution/tree — 分销层级树(递归 3 层)
  server.get('/distribution/tree', async (request, reply) => {
    const userId = request.userId!

    // 第 1 层:直接下级
    const level1 = await dbRead
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

    // 第 2 层:下下级
    const level1Ids = level1.map((u) => u.id)
    const level2Map: Record<string, typeof level1> = {}
    if (level1Ids.length > 0) {
      const level2 = await dbRead
        .select({
          id: users.id,
          username: users.username,
          nickname: users.nickname,
          avatar: users.avatar,
          createdAt: users.createdAt,
          parentId: users.parentId,
        })
        .from(users)
        .where(
          sql`${users.parentId} = ANY(${sql.raw(`ARRAY[${level1Ids.map((id) => `'${id}'`).join(',')}]::uuid[]`)})`,
        )
        .orderBy(desc(users.createdAt))
      for (const u of level2) {
        const pid = u.parentId!
        if (!level2Map[pid]) level2Map[pid] = []
        level2Map[pid].push(u)
      }
    }

    // 第 3 层:下下下级
    const level2Ids = Object.values(level2Map)
      .flat()
      .map((u) => u.id)
    const level3Map: Record<string, typeof level1> = {}
    if (level2Ids.length > 0) {
      const level3 = await dbRead
        .select({
          id: users.id,
          username: users.username,
          nickname: users.nickname,
          avatar: users.avatar,
          createdAt: users.createdAt,
          parentId: users.parentId,
        })
        .from(users)
        .where(
          sql`${users.parentId} = ANY(${sql.raw(`ARRAY[${level2Ids.map((id) => `'${id}'`).join(',')}]::uuid[]`)})`,
        )
        .orderBy(desc(users.createdAt))
      for (const u of level3) {
        const pid = u.parentId!
        if (!level3Map[pid]) level3Map[pid] = []
        level3Map[pid].push(u)
      }
    }

    // 组装树结构
    const tree = level1.map((l1) => ({
      ...l1,
      level: 1,
      children: (level2Map[l1.id] ?? []).map((l2) => ({
        ...l2,
        level: 2,
        children: level3Map[l2.id] ?? [],
      })),
    }))

    return reply.send(success({ tree, totalLevels: 3 }))
  })

  // GET /distribution/stats — 分销统计数据
  server.get('/distribution/stats', async (request, reply) => {
    const userId = request.userId!

    // 总邀请数
    const [invitedRow] = await dbRead
      .select({ total: sql<number>`count(*)::int` })
      .from(users)
      .where(eq(users.parentId, userId))

    // 活跃数(status=1)
    const [activeRow] = await dbRead
      .select({ total: sql<number>`count(*)::int` })
      .from(users)
      .where(and(eq(users.parentId, userId), eq(users.status, 1)))

    // 佣金总额
    const [commissionRow] = await dbRead
      .select({ total: sql<number>`coalesce(sum(${commissionFlows.amount}), 0)` })
      .from(commissionFlows)
      .where(eq(commissionFlows.beneficiaryId, userId))

    // 提现总额(已完成 status=2)
    const [withdrawnRow] = await dbRead
      .select({ total: sql<number>`coalesce(sum(${withdrawalFlows.amount}), 0)` })
      .from(withdrawalFlows)
      .where(and(eq(withdrawalFlows.userId, userId), eq(withdrawalFlows.status, 2)))

    return reply.send(
      success({
        totalInvited: invitedRow?.total ?? 0,
        activeInvited: activeRow?.total ?? 0,
        totalCommission: Number(commissionRow?.total ?? 0),
        totalWithdrawn: Number(withdrawnRow?.total ?? 0),
      }),
    )
  })

  // GET /distribution/commission-rates — 佣金比例配置(从 system_configs 读取)
  server.get('/distribution/commission-rates', async (_request, reply) => {
    const rows = await dbRead
      .select()
      .from(systemConfigs)
      .where(eq(systemConfigs.category, 'distribution'))
      .orderBy(desc(systemConfigs.createdAt))

    const rates: Record<string, string> = {}
    for (const row of rows) {
      rates[row.key] = row.value
    }
    return reply.send(success({ rates, count: rows.length }))
  })

  // GET /distribution/levels — 分销等级列表
  server.get('/distribution/levels', async (_request, reply) => {
    // 从 system_configs 读取分销等级配置(category=distribution_level)
    const rows = await dbRead
      .select()
      .from(systemConfigs)
      .where(eq(systemConfigs.category, 'distribution_level'))
      .orderBy(desc(systemConfigs.createdAt))

    const levels = rows.map((row, idx) => ({
      level: idx + 1,
      name: row.key,
      threshold: row.value,
      description: row.description ?? '',
    }))

    return reply.send(success({ levels, count: levels.length }))
  })
}
