import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, and, desc, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { userAgentFreeTimes } from '@ihui/database'
import { requireAdmin } from '../plugins/require-permission.js'
import { success, error } from '../utils/response.js'

const freeTimesSchema = z.object({
  userUuid: z.string().min(1).max(64),
  agentId: z.string().min(1).max(64),
  freeTimes: z.number().int().min(0).default(0),
})

const userAgentFreeTimesRoutes: FastifyPluginAsync = async (server) => {
  // 列表(分页 + userUuid/agentId 筛选)
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
    const conditions = []
    if (userUuid) conditions.push(eq(userAgentFreeTimes.userUuid, userUuid))
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

  // 查询当前用户某 agent 的剩余免费次数(upsert 语义)
  server.get('/remaining', async (request, reply) => {
    const { userUuid, agentId } = z
      .object({ userUuid: z.string(), agentId: z.string() })
      .parse(request.query)
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

  // 设置/更新免费次数(upsert)
  server.post('/', async (request, reply) => {
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

  // 消耗一次免费次数(原子操作,返回剩余)
  server.post('/consume', async (request, reply) => {
    const body = z.object({ userUuid: z.string(), agentId: z.string() }).safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    }
    const [record] = await db
      .select()
      .from(userAgentFreeTimes)
      .where(
        and(
          eq(userAgentFreeTimes.userUuid, body.data.userUuid),
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

  // 重置已用次数(管理员/定时任务调用)
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
    const conditions = []
    if (body.data.userUuid) conditions.push(eq(userAgentFreeTimes.userUuid, body.data.userUuid))
    if (body.data.agentId) conditions.push(eq(userAgentFreeTimes.agentId, body.data.agentId))
    const where = conditions.length ? and(...conditions) : sql`TRUE`
    const result = await db
      .update(userAgentFreeTimes)
      .set({ usedTimes: 0, lastResetAt: new Date(), updatedAt: new Date() })
      .where(where)
      .returning()
    return reply.send(success({ reset: result.length, records: result }))
  })

  // 删除记录
  server.delete('/:id', async (request, reply) => {
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
