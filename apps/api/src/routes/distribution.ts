import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { randomUUID } from 'node:crypto'
import { eq, sql, desc, and, inArray } from 'drizzle-orm'
import { db, dbRead } from '../db/index.js'
import { commissionFlows, withdrawalFlows, users, systemConfigs } from '@ihui/database'
import {
  listCommissionFlows,
  listSubordinates,
  teamCenter,
  availableWithdrawal,
  listWithdrawals,
} from '../db/commission-queries.js'
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

  // GET /distribution/overview — 分销概览(超集:合并 commission-routes 的 availableCommission + distribution 的 inviteCode/level)
  server.get('/distribution/overview', async (request, reply) => {
    const userId = request.userId!
    const [userRow] = await dbRead
      .select({ inviteCode: users.inviteCode, level: users.level })
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

    // 合并 commission-routes.ts 的 availableCommission(可提现余额)
    const available = await availableWithdrawal(userId)

    return reply.send(
      success({
        totalCommission: Number(totalRow?.total ?? 0),
        availableCommission: available,
        pendingCommission: Number(pendingRow?.total ?? 0),
        withdrawnCommission: Number(withdrawnRow?.total ?? 0),
        inviteCode: userRow?.inviteCode ?? null,
        level: userRow?.level ?? 0,
      }),
    )
  })

  // GET /distribution/invited-users — 邀请用户列表(向后兼容:不传分页返回全部,传分页则分页查)
  server.get('/distribution/invited-users', async (request, reply) => {
    const userId = request.userId!
    const { page, pageSize } = z
      .object({
        page: z.coerce.number().int().min(1).optional(),
        pageSize: z.coerce.number().int().min(1).max(100).optional(),
      })
      .parse(request.query ?? {})

    // 走 listSubordinates 复用分页查询封装(与 commission-routes 一致)
    if (page && pageSize) {
      const result = await listSubordinates(userId, page, pageSize)
      return reply.send(
        success({ list: result.items, total: result.total, page, pageSize }),
      )
    }

    // 未传分页:返回全部(保持 miniapp-taro/mobile-rn 现有行为兼容)
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
        // 2026-07-21 安全审计加固:用 Drizzle 参数化 inArray 替代 sql.raw 字符串拼接,
        // 消除 SQL 注入隐患(虽然 level1Ids 来自 DB 查询,本身是 UUID,
        // 但 sql.raw 模式是反模式,若上游某天被替换为用户输入则直接 RCE)
        .where(inArray(users.parentId, level1Ids))
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
        // 2026-07-21 安全审计加固:同上,参数化 inArray
        .where(inArray(users.parentId, level2Ids))
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

  // GET /distribution/withdrawals — 当前用户提现记录列表
  server.get('/distribution/withdrawals', async (request, reply) => {
    const userId = request.userId!
    const { page, pageSize, status } = z
      .object({
        page: z.coerce.number().int().min(1).default(1),
        pageSize: z.coerce.number().int().min(1).max(100).default(20),
        status: z.preprocess(
          (v) => (v === undefined || v === '' ? undefined : Number(v)),
          z.number().int().min(0).max(3).optional(),
        ),
      })
      .parse(request.query)

    const conditions = [eq(withdrawalFlows.userId, userId)]
    if (status !== undefined) conditions.push(eq(withdrawalFlows.status, status))

    const offset = (page - 1) * pageSize
    const list = await dbRead
      .select({
        id: withdrawalFlows.id,
        amount: withdrawalFlows.amount,
        originalAmount: withdrawalFlows.originalAmount,
        fee: withdrawalFlows.fee,
        status: withdrawalFlows.status,
        method: withdrawalFlows.method,
        rejectReason: withdrawalFlows.rejectReason,
        processedAt: withdrawalFlows.processedAt,
        createdAt: withdrawalFlows.createdAt,
      })
      .from(withdrawalFlows)
      .where(and(...conditions))
      .orderBy(desc(withdrawalFlows.createdAt))
      .limit(pageSize)
      .offset(offset)

    const [countRow] = await dbRead
      .select({ total: sql<number>`count(*)::int` })
      .from(withdrawalFlows)
      .where(and(...conditions))

    return reply.send(
      success({
        list,
        total: countRow?.total ?? 0,
        page,
        pageSize,
      }),
    )
  })

  // POST /distribution/withdraw — 发起提现申请
  server.post('/distribution/withdraw', async (request, reply) => {
    const userId = request.userId!
    const body = z
      .object({
        amount: z.number().positive('提现金额必须大于 0'),
        method: z.string().max(32).optional(),
      })
      .safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    }

    // 校验可提现余额(已完成佣金 - 已成功提现)
    const [earnedRow] = await dbRead
      .select({ total: sql<number>`coalesce(sum(${commissionFlows.amount}), 0)` })
      .from(commissionFlows)
      .where(and(eq(commissionFlows.beneficiaryId, userId), eq(commissionFlows.status, 2)))
    const [withdrawnRow] = await dbRead
      .select({ total: sql<number>`coalesce(sum(${withdrawalFlows.amount}), 0)` })
      .from(withdrawalFlows)
      .where(and(eq(withdrawalFlows.userId, userId), eq(withdrawalFlows.status, 2)))
    const available = Number(earnedRow?.total ?? 0) - Number(withdrawnRow?.total ?? 0)
    if (body.data.amount > available) {
      return reply.status(400).send(error(400, '可提现余额不足'))
    }

    // 创建提现申请(status=0 待审核)
    const [withdrawal] = await db
      .insert(withdrawalFlows)
      .values({
        id: randomUUID(),
        userId,
        amount: body.data.amount,
        originalAmount: body.data.amount,
        fee: 0,
        status: 0,
        method: body.data.method ?? 'bank',
      })
      .returning()

    if (!withdrawal) {
      return reply.status(500).send(error(500, '创建提现申请失败'))
    }
    return reply.status(201).send(success({ withdrawal }))
  })

  // ============================================================================
  // 以下 4 个端点迁移自 user/commission-routes.ts(2026-07-25 P1-1 命名统一)
  // 路径 /commission/* → /distribution/*,前端零改动,后端合并到单一前缀
  // ============================================================================

  // GET /distribution/invite-info — 邀请信息(从 commission-routes 迁移)
  server.get('/distribution/invite-info', async (request, reply) => {
    const team = await teamCenter(request.userId!)
    return reply.send(
      success({
        inviteCode: null,
        inviteUrl: null,
        inviteCount: team.totalInvitees,
        vipInvitees: team.vipInvitees,
        monthNew: team.monthNew,
      }),
    )
  })

  // GET /distribution/list — 佣金流水列表(从 commission-routes 迁移)
  server.get('/distribution/list', async (request, reply) => {
    const { page, pageSize } = z
      .object({
        page: z.coerce.number().int().min(1).default(1),
        pageSize: z.coerce.number().int().min(1).max(100).default(20),
      })
      .parse(request.query ?? {})
    const result = await listCommissionFlows(request.userId!, page, pageSize)
    return reply.send(
      success({ list: result.items, total: result.total, page, pageSize }),
    )
  })

  // GET /distribution/withdraw-list — 提现记录列表(补建:原 api-client 调用 404)
  server.get('/distribution/withdraw-list', async (request, reply) => {
    const userId = request.userId!
    const { page, pageSize } = z
      .object({
        page: z.coerce.number().int().min(1).default(1),
        pageSize: z.coerce.number().int().min(1).max(100).default(20),
      })
      .parse(request.query ?? {})
    const result = await listWithdrawals(userId, page, pageSize)
    return reply.send(
      success({ list: result.items, total: result.total, page, pageSize }),
    )
  })

  // GET /distribution/ranking — 分销排行(补建:原 api-client 调用 404)
  // 按累计佣金降序取 top N(简易版,后续可扩展为按周期/等级筛选)
  server.get('/distribution/ranking', async (request, reply) => {
    const { limit } = z
      .object({
        limit: z.coerce.number().int().min(1).max(100).default(10),
      })
      .parse(request.query ?? {})
    const rows = await dbRead
      .select({
        userId: commissionFlows.beneficiaryId,
        totalCommission: sql<number>`coalesce(sum(${commissionFlows.amount}), 0)`,
      })
      .from(commissionFlows)
      .where(eq(commissionFlows.status, 1))
      .groupBy(commissionFlows.beneficiaryId)
      .orderBy(sql`sum(${commissionFlows.amount}) desc`)
      .limit(limit)

    // 补充用户信息(昵称/头像)
    const userIds = rows.map((r) => r.userId).filter((id): id is string => typeof id === 'string')
    const userRows: Array<{ id: string; nickname: string | null; avatar: string | null }> = []
    if (userIds.length > 0) {
      const found = await dbRead
        .select({ id: users.id, nickname: users.nickname, avatar: users.avatar })
        .from(users)
        .where(inArray(users.id, userIds))
      userRows.push(...found)
    }
    const userMap = new Map(userRows.map((u) => [u.id, u]))

    const ranking = rows.map((r, idx) => {
      const u = r.userId ? userMap.get(r.userId) : undefined
      return {
        rank: idx + 1,
        userId: r.userId,
        nickname: u?.nickname ?? null,
        avatar: u?.avatar ?? null,
        totalCommission: Number(r.totalCommission),
        invitedCount: 0, // 简化:不查每人的 invitedCount(避免 N+1)
      }
    })

    return reply.send(success(ranking))
  })
}
