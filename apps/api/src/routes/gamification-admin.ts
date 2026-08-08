import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, desc, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { signInRecords, signInRules } from '@ihui/database'
import { requireAdmin } from '../plugins/require-permission.js'
import { success, error, emptyToUndefined } from '../utils/response.js'
import { todayString } from '../utils/checkin-helpers.js'

// =============================================================================
// Zod schemas
// =============================================================================

const adminListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  userId: z.transform(emptyToUndefined).pipe(z.uuid().optional()),
})

const ruleSchema = z.object({
  name: z.string().min(1).max(128),
  consecutiveDays: z.number().int().min(1),
  rewardPoints: z.number().int().min(0),
  extraReward: z.record(z.string(), z.unknown()).optional(),
  status: z.number().int().min(0).max(1).optional(),
})

const ruleUpdateSchema = ruleSchema.partial()

// =============================================================================
// 管理员路由（前缀 /api/admin）
// =============================================================================

export const adminGamificationRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)

  // GET /sign-in/list — 所有用户签到记录列表（分页，可筛选 userId）
  server.get('/sign-in/list', async (request, reply) => {
    const parsed = adminListQuery.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { page, pageSize, userId } = parsed.data
    const where = userId ? eq(signInRecords.userId, userId) : undefined
    const offset = (page - 1) * pageSize
    const [list, totalRows] = await Promise.all([
      db
        .select()
        .from(signInRecords)
        .where(where)
        .orderBy(desc(signInRecords.signInDate))
        .limit(pageSize)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(signInRecords)
        .where(where),
    ])
    return reply.send(success({ list, total: totalRows[0]?.count ?? 0, page, pageSize }))
  })

  // GET /sign-in/stats — 签到统计（总签到数 / 今日签到数 / 活跃用户数）
  server.get('/sign-in/stats', async (_request, reply) => {
    const today = todayString()
    const [totalRows, todayRows, activeRows] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` }).from(signInRecords),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(signInRecords)
        .where(eq(signInRecords.signInDate, today)),
      db
        .select({ count: sql<number>`count(distinct ${signInRecords.userId})::int` })
        .from(signInRecords),
    ])
    return reply.send(
      success({
        totalCheckins: totalRows[0]?.count ?? 0,
        todayCheckins: todayRows[0]?.count ?? 0,
        activeUsers: activeRows[0]?.count ?? 0,
      }),
    )
  })

  // GET /sign-in/rules — 签到规则列表
  server.get('/sign-in/rules', async (_request, reply) => {
    const list = await db.select().from(signInRules).orderBy(desc(signInRules.consecutiveDays))
    return reply.send(success(list))
  })

  // POST /sign-in/rules — 创建签到规则
  server.post('/sign-in/rules', async (request, reply) => {
    const parsed = ruleSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const [rule] = await db
      .insert(signInRules)
      .values({
        name: parsed.data.name,
        consecutiveDays: parsed.data.consecutiveDays,
        rewardPoints: parsed.data.rewardPoints,
        extraReward: parsed.data.extraReward ?? {},
        status: parsed.data.status ?? 1,
      })
      .returning()
    return reply.status(201).send(success(rule))
  })

  // PUT /sign-in/rules/:id — 修改签到规则
  server.put<{ Params: { id: string } }>('/sign-in/rules/:id', async (request, reply) => {
    const parsed = ruleUpdateSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { id } = request.params
    const [rule] = await db
      .update(signInRules)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(signInRules.id, id))
      .returning()
    if (!rule) return reply.status(404).send(error(404, '签到规则不存在'))
    return reply.send(success(rule))
  })

  // DELETE /sign-in/rules/:id — 删除签到规则
  server.delete<{ Params: { id: string } }>('/sign-in/rules/:id', async (request, reply) => {
    const { id } = request.params
    const [rule] = await db.delete(signInRules).where(eq(signInRules.id, id)).returning()
    if (!rule) return reply.status(404).send(error(404, '签到规则不存在'))
    return reply.send(success({ id, deleted: true }))
  })
}
