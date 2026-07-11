import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, and, desc, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { signInRecords, signInRules } from '@ihui/database'
import { requireAuth, requireAdmin } from '../plugins/require-permission.js'
import { success, error, emptyToUndefined } from '../utils/response.js'

// =============================================================================
// 签到奖励：第1天10分，逐日+5，第7天起50分封顶
// =============================================================================

function calcSignInReward(consecutiveDays: number): number {
  if (consecutiveDays >= 7) return 50
  return 10 + (consecutiveDays - 1) * 5
}

/** 返回今日日期字符串 YYYY-MM-DD（UTC） */
function todayString(): string {
  return new Date().toISOString().slice(0, 10)
}

/** 日期偏移：days 为正向后，为负向前 */
function shiftDate(date: string, days: number): string {
  const d = new Date(date + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// =============================================================================
// Zod schemas
// =============================================================================

const historyQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  yearMonth: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .regex(/^\d{4}-\d{2}$/, 'yearMonth 格式应为 YYYY-MM')
      .optional(),
  ),
})

// =============================================================================
// 路由
// =============================================================================

const checkinRoutes: FastifyPluginAsync = async (server) => {
  // 统一鉴权：所有签到端点需登录
  server.addHook('preHandler', requireAuth)

  // POST / — 每日签到
  server.post('/', async (request, reply) => {
    const userId = request.userId!
    const today = todayString()

    // 检查今日是否已签到
    const [existing] = await db
      .select()
      .from(signInRecords)
      .where(and(eq(signInRecords.userId, userId), eq(signInRecords.signInDate, today)))
      .limit(1)
    if (existing) {
      return reply.status(409).send(error(409, '今日已签到'))
    }

    // 计算连续签到天数：查昨日记录
    const yesterday = shiftDate(today, -1)
    const [yesterdayRecord] = await db
      .select()
      .from(signInRecords)
      .where(and(eq(signInRecords.userId, userId), eq(signInRecords.signInDate, yesterday)))
      .limit(1)
    const consecutiveDays = (yesterdayRecord?.consecutiveDays ?? 0) + 1
    const rewardPoints = calcSignInReward(consecutiveDays)

    const [record] = await db
      .insert(signInRecords)
      .values({ userId, signInDate: today, consecutiveDays, rewardPoints })
      .returning()

    return reply.status(201).send(success({ record, rewardPoints, consecutiveDays }))
  })

  // GET /today — 今日签到状态
  server.get('/today', async (request, reply) => {
    const userId = request.userId!
    const today = todayString()
    const [record] = await db
      .select()
      .from(signInRecords)
      .where(and(eq(signInRecords.userId, userId), eq(signInRecords.signInDate, today)))
      .limit(1)

    const signedIn = !!record
    // 连续天数：已签到取记录值，否则查昨日
    let consecutiveDays = 0
    if (record) {
      consecutiveDays = record.consecutiveDays
    } else {
      const yesterday = shiftDate(today, -1)
      const [yesterdayRecord] = await db
        .select()
        .from(signInRecords)
        .where(and(eq(signInRecords.userId, userId), eq(signInRecords.signInDate, yesterday)))
        .limit(1)
      consecutiveDays = yesterdayRecord?.consecutiveDays ?? 0
    }
    const todayReward = signedIn ? record!.rewardPoints : calcSignInReward(consecutiveDays + 1)
    return reply.send(success({ signedIn, consecutiveDays, todayReward, record }))
  })

  // GET /history — 签到记录（支持分页，可按月筛选）
  server.get('/history', async (request, reply) => {
    const userId = request.userId!
    const parsed = historyQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { page, pageSize, yearMonth } = parsed.data
    const offset = (page - 1) * pageSize

    const conditions = [eq(signInRecords.userId, userId)]
    if (yearMonth) {
      // 按月筛选：sign_in_date 以 YYYY-MM 开头
      conditions.push(sql`${signInRecords.signInDate} like ${yearMonth + '-%'}`)
    }

    const list = await db
      .select()
      .from(signInRecords)
      .where(and(...conditions))
      .orderBy(desc(signInRecords.signInDate))
      .limit(pageSize)
      .offset(offset)

    const countResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(signInRecords)
      .where(and(...conditions))
    const total = countResult[0]?.count ?? 0

    return reply.send(success({ list, total, page, pageSize }))
  })

  // GET /streak — 连续签到天数
  server.get('/streak', async (request, reply) => {
    const userId = request.userId!
    const today = todayString()

    // 今日已签到则直接返回记录的连续天数
    const [todayRecord] = await db
      .select()
      .from(signInRecords)
      .where(and(eq(signInRecords.userId, userId), eq(signInRecords.signInDate, today)))
      .limit(1)
    if (todayRecord) {
      return reply.send(success({ streak: todayRecord.consecutiveDays, signedIn: true }))
    }

    // 未签到：取昨日连续天数作为当前保持的连续天数
    const yesterday = shiftDate(today, -1)
    const [yesterdayRecord] = await db
      .select()
      .from(signInRecords)
      .where(and(eq(signInRecords.userId, userId), eq(signInRecords.signInDate, yesterday)))
      .limit(1)
    const streak = yesterdayRecord?.consecutiveDays ?? 0
    return reply.send(success({ streak, signedIn: false }))
  })
}

// =============================================================================
// 管理员路由（前缀 /api/admin/checkin）
// =============================================================================

const adminListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  userId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
})

const ruleSchema = z.object({
  name: z.string().min(1).max(128),
  consecutiveDays: z.number().int().min(1),
  rewardPoints: z.number().int().min(0),
  extraReward: z.record(z.unknown()).optional(),
  status: z.number().int().min(0).max(1).optional(),
})

const ruleUpdateSchema = ruleSchema.partial()

export const adminCheckinRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)

  // GET /list — 所有用户签到记录列表（分页，可筛选 userId）
  server.get('/list', async (request, reply) => {
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

  // GET /stats — 签到统计（总签到数 / 今日签到数 / 活跃用户数）
  server.get('/stats', async (_request, reply) => {
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

  // GET /rules — 签到规则列表
  server.get('/rules', async (_request, reply) => {
    const list = await db.select().from(signInRules).orderBy(desc(signInRules.consecutiveDays))
    return reply.send(success(list))
  })

  // POST /rules — 创建签到规则
  server.post('/rules', async (request, reply) => {
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

  // PUT /rules/:id — 修改签到规则
  server.put<{ Params: { id: string } }>('/rules/:id', async (request, reply) => {
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

  // DELETE /rules/:id — 删除签到规则
  server.delete<{ Params: { id: string } }>('/rules/:id', async (request, reply) => {
    const { id } = request.params
    const [rule] = await db.delete(signInRules).where(eq(signInRules.id, id)).returning()
    if (!rule) return reply.status(404).send(error(404, '签到规则不存在'))
    return reply.send(success({ id, deleted: true }))
  })
}

export default checkinRoutes
