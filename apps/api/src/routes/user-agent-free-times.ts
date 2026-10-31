// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { eq, and, desc, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { userAgentFreeTimes } from '@ihui/database'
import { requireAdmin, requireAuth, isSystemAdmin } from '../plugins/require-permission.js'
import { success, error } from '../utils/response.js'

const freeTimesSchema = z.object({
  userUuid: z.string().min(1).max(64),
  agentId: z.string().min(1).max(64),
  freeTimes: z.number().int().min(0).default(0),
})

/** admin 面闸门的通道声明(只认人用 JWT,internal 通道不升格为管理员)。 */
const ADMIN_POLICY = { includeInternalChannel: false } as const

const userAgentFreeTimesRoutes: FastifyPluginAsync = async (server) => {
  // 承载层(2026-10-31 收口):本插件此前**一个鉴权钩子都没有**,五个端点全部匿名可达,
  // 且归属一律取客户端自报的 userUuid/body —— 任一访客可读任意用户的免费次数、
  // 消耗别人的额度;`POST /reset` 空 body 时 conditions 为空 ⇒ where 落到整表条件,
  // 把**整张表**的已用次数清零。现:入口统一要求登录;归属只认令牌主体;
  // 发放额度与按 id 删除仅管理员(与 admin 前缀那套语义对齐)。
  server.addHook('preHandler', async (request, reply) => {
    await requireAuth(request, reply)
  })

  const isAdminOf = (request: FastifyRequest): boolean => isSystemAdmin(request, ADMIN_POLICY)

  /** 管理员闸:返回 true 表示已拒绝(且未构造任何语句)。 */
  const rejectUnlessAdmin = (request: FastifyRequest, reply: FastifyReply): boolean => {
    if (isAdminOf(request)) return false
    void reply.status(403).send(error(403, '需要管理员权限'))
    return true
  }

  // 列表(分页 + agentId 筛选)。普通主体只能看到自己那一行,`userUuid` 参数只对管理员生效。
  server.get('/', async (request, reply) => {
    const parsed = z
      .object({
        page: z.coerce.number().int().min(1).default(1),
        pageSize: z.coerce.number().int().min(1).max(100).default(20),
        userUuid: z.string().optional(),
        agentId: z.string().optional(),
      })
      .safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { page, pageSize, userUuid, agentId } = parsed.data
    // 普通主体恒按令牌主体过滤;管理员可传 userUuid 圈定,不传则看全量(既有 admin 语义)。
    const scopeUuid = isAdminOf(request) ? userUuid : request.userId!
    const conditions = scopeUuid ? [eq(userAgentFreeTimes.userUuid, scopeUuid)] : []
    if (agentId) conditions.push(eq(userAgentFreeTimes.agentId, agentId))
    const where = conditions.length ? and(...conditions) : sql`TRUE`
    const offset = (page - 1) * pageSize
    const list = await db
      .select()
      .from(userAgentFreeTimes)
      .where(where)
      .orderBy(desc(userAgentFreeTimes.createdAt))
      .limit(pageSize)
      .offset(offset)
    const total = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(userAgentFreeTimes)
      .where(where)
    return reply.send(success({ list, total: total[0]?.count ?? 0, page, pageSize }))
  })

  // 查询当前用户某 agent 的剩余免费次数(upsert 语义)。归属只认令牌主体。
  server.get('/remaining', async (request, reply) => {
    const { agentId } = z.object({ agentId: z.string() }).parse(request.query)
    const userUuid = request.userId!
    const [record] = await db
      .select()
      .from(userAgentFreeTimes)
      .where(
        and(eq(userAgentFreeTimes.userUuid, userUuid), eq(userAgentFreeTimes.agentId, agentId)),
      )
      .limit(1)
    if (!record) {
      return reply.send(success({ freeTimes: 0, usedTimes: 0, remaining: 0, lastResetAt: null }))
    }
    return reply.send(
      success({
        freeTimes: record.freeTimes,
        usedTimes: record.usedTimes,
        remaining: Math.max(0, record.freeTimes - record.usedTimes),
        lastResetAt: record.lastResetAt,
      }),
    )
  })

  // 设置/更新免费次数(upsert)—— 发放额度是管理员动作。
  server.post('/', async (request, reply) => {
    if (rejectUnlessAdmin(request, reply)) return
    const body = freeTimesSchema.safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    }
    const [existing] = await db
      .select()
      .from(userAgentFreeTimes)
      .where(
        and(
          eq(userAgentFreeTimes.userUuid, body.data.userUuid),
          eq(userAgentFreeTimes.agentId, body.data.agentId),
        ),
      )
      .limit(1)
    if (existing) {
      const [updated] = await db
        .update(userAgentFreeTimes)
        .set({ freeTimes: body.data.freeTimes, updatedAt: new Date() })
        .where(eq(userAgentFreeTimes.id, existing.id))
        .returning()
      return reply.send(success(updated))
    }
    const [created] = await db
      .insert(userAgentFreeTimes)
      .values({
        userUuid: body.data.userUuid,
        agentId: body.data.agentId,
        freeTimes: body.data.freeTimes,
      })
      .returning()
    return reply.status(201).send(success(created))
  })

  // 消耗一次免费次数(原子操作,返回剩余)。归属只认令牌主体,不吃 body 自报。
  server.post('/consume', async (request, reply) => {
    const body = z.object({ agentId: z.string() }).safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    }
    const userUuid = request.userId!
    const [record] = await db
      .select()
      .from(userAgentFreeTimes)
      .where(
        and(
          eq(userAgentFreeTimes.userUuid, userUuid),
          eq(userAgentFreeTimes.agentId, body.data.agentId),
        ),
      )
      .limit(1)
    if (!record) {
      return reply.status(404).send(error(404, '免费次数记录不存在'))
    }
    const remaining = record.freeTimes - record.usedTimes
    if (remaining <= 0) {
      return reply.status(409).send(error(409, '免费次数已用完'))
    }
    const [updated] = await db
      .update(userAgentFreeTimes)
      .set({ usedTimes: record.usedTimes + 1, updatedAt: new Date() })
      .where(eq(userAgentFreeTimes.id, record.id))
      .returning()
    if (!updated) return reply.status(500).send(error(500, '消耗次数失败'))
    return reply.send(
      success({
        consumed: true,
        remaining: Math.max(0, updated.freeTimes - updated.usedTimes),
        record: updated,
      }),
    )
  })

  // 重置已用次数。管理员可按 userUuid/agentId 圈定(都不给 = 整表,既有 admin 语义);
  // 普通主体**恒**按自己的主体过滤 —— 空 body 时绝不退化成整表。
  server.post('/reset', async (request, reply) => {
    const body = z
      .object({
        userUuid: z.string().optional(),
        agentId: z.string().optional(),
      })
      .safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    }
    const admin = isAdminOf(request)
    const conditions = []
    if (admin) {
      if (body.data.userUuid) conditions.push(eq(userAgentFreeTimes.userUuid, body.data.userUuid))
    } else {
      conditions.push(eq(userAgentFreeTimes.userUuid, request.userId!))
    }
    if (body.data.agentId) conditions.push(eq(userAgentFreeTimes.agentId, body.data.agentId))
    const where = conditions.length ? and(...conditions) : sql`TRUE`
    const result = await db
      .update(userAgentFreeTimes)
      .set({ usedTimes: 0, lastResetAt: new Date(), updatedAt: new Date() })
      .where(where)
      .returning()
    return reply.send(success({ reset: result.length, records: result }))
  })

  // 删除记录 —— 管理员动作。
  server.delete('/:id', async (request, reply) => {
    if (rejectUnlessAdmin(request, reply)) return
    const { id } = z.object({ id: z.coerce.number().int() }).parse(request.params)
    const [deleted] = await db
      .delete(userAgentFreeTimes)
      .where(eq(userAgentFreeTimes.id, id))
      .returning()
    if (!deleted) return reply.status(404).send(error(404, '记录不存在'))
    return reply.send(success({ success: true }))
  })
}

// 管理员路由
const adminUserAgentFreeTimesRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)
  server.register(userAgentFreeTimesRoutes)
}

export { userAgentFreeTimesRoutes, adminUserAgentFreeTimesRoutes }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
