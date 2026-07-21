import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { eq, and, desc, sql, type SQL } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../db/index.js'
import { signInRecords, signInRules, tCheckInRecord } from '@ihui/database'
import { authenticate, checkAuth } from '../plugins/auth.js'
import { success, error, emptyToUndefined } from '../utils/response.js'
import { calcSignInReward, todayString, shiftDate } from '../utils/checkin-helpers.js'

// =============================================================================
// 签到(legacy /auth-api/check-in + /public-api/check-in 补开发,2 个端点)
// 数据表: sign_in_records(现代版,UUID 兼容)
// 业务逻辑参考 D 盘 CheckInController + CheckInServiceImpl
// =============================================================================

/** 可选鉴权:登录用户返回 userId,未登录返回 null(对应 Java getLoginUserId 失败返回 null) */
async function optionalAuth(request: FastifyRequest): Promise<string | null> {
  try {
    await authenticate(request)
    return request.userId ?? null
  } catch {
    return null
  }
}

// =============================================================================
// Checkin(签到规则)/ CheckinRecord(签到记录) CRUD —— 对齐 api-client business.ts
// 数据表: t_check_in_record(D 盘 legacy,字段 id/memberId/type/createTime/updateTime)
//   - Checkin shape (cid/continuousNum/memberId/createTime): cid←id, continuousNum←0(表无此列,占位), memberId←String(memberId)
//   - CheckinRecord shape (rid/type/memberId/createTime): rid←id, 字段直映射
// =============================================================================

type TCheckInRow = typeof tCheckInRecord.$inferSelect

function toCheckin(row: TCheckInRow) {
  return {
    cid: row.id,
    continuousNum: 0,
    memberId: String(row.memberId),
    createTime: row.createTime ? row.createTime.toISOString() : null,
  }
}

function toCheckinRecord(row: TCheckInRow) {
  return {
    rid: row.id,
    type: row.type,
    memberId: String(row.memberId),
    createTime: row.createTime ? row.createTime.toISOString() : null,
  }
}

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

const checkinListQuerySchema = paginationSchema.extend({
  memberId: z.preprocess(emptyToUndefined, z.coerce.number().optional()),
})

const cidParamSchema = z.object({ cid: z.coerce.number().int() })

const updateCheckinSchema = z.object({
  continuousNum: z.preprocess(emptyToUndefined, z.coerce.number().int().optional()),
  memberId: z.preprocess(emptyToUndefined, z.coerce.number().optional()),
})

const checkinRecordListQuerySchema = paginationSchema.extend({
  memberId: z.preprocess(emptyToUndefined, z.coerce.number().optional()),
  type: z.preprocess(emptyToUndefined, z.string().max(20).optional()),
})

const ridParamSchema = z.object({ rid: z.coerce.number().int() })

const createCheckinRecordSchema = z.object({
  type: z.string().max(20),
  memberId: z.preprocess(emptyToUndefined, z.coerce.number().optional()),
})

const updateCheckinRecordSchema = z.object({
  type: z.preprocess(emptyToUndefined, z.string().max(20).optional()),
})

const checkInRoutes: FastifyPluginAsync = async (server) => {
  // POST / — 每日签到(Java: POST /auth-api/check-in,需登录)
  server.post('/', async (request, reply) => {
    let userId: string
    try {
      const payload = await authenticate(request)
      userId = payload.userId
    } catch {
      return reply.status(401).send(error(401, '未授权'))
    }
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

    // 计算连续签到天数: 查昨日记录
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

    if (!record) return reply.status(500).send(error(500, '签到失败'))
    return reply.status(201).send(success({ record, rewardPoints, consecutiveDays }))
  })

  // GET / — 今日是否签到(Java: GET /public-api/check-in,可选鉴权)
  // Java 行为: 未登录返回 null,登录返回 CheckInResponse
  server.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = await optionalAuth(request)
    if (!userId) {
      // 未登录返回 null(对齐 Java getCheckIn 返回 null 语义)
      return reply.send(success(null))
    }
    const today = todayString()
    const [record] = await db
      .select()
      .from(signInRecords)
      .where(and(eq(signInRecords.userId, userId), eq(signInRecords.signInDate, today)))
      .limit(1)

    const signedIn = !!record
    // 连续天数: 已签到取记录值,否则查昨日
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

  // GET /rules — 签到规则(辅助端点,提供前端查询连续签到奖励规则)
  server.get('/rules', async (_request, reply) => {
    const list = await db.select().from(signInRules).orderBy(desc(signInRules.consecutiveDays))
    return reply.send(success(list))
  })

  // GET /stats — 签到统计(总签到数 / 今日签到数 / 活跃用户数)
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

  // ===========================================================================
  // Checkin(签到规则)CRUD —— 对齐 api-client getCheckinList/getCheckinDetail/updateCheckin/deleteCheckin
  // 路径: GET /list, GET /:cid, PUT /:cid, DELETE /:cid
  // ===========================================================================

  // GET /list — 签到规则列表(分页 + memberId 过滤)
  server.get('/list', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const q = checkinListQuerySchema.safeParse(request.query)
    if (!q.success) return reply.status(400).send(error(400, '参数错误'))
    const { page, pageSize, memberId } = q.data
    const where: SQL | undefined =
      memberId !== undefined ? eq(tCheckInRecord.memberId, memberId) : undefined
    const [rows, totalRows] = await Promise.all([
      db
        .select()
        .from(tCheckInRecord)
        .where(where)
        .orderBy(desc(tCheckInRecord.id))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      db.select({ c: sql<number>`count(*)::int` }).from(tCheckInRecord).where(where),
    ])
    return reply.send(
      success({
        list: rows.map(toCheckin),
        total: totalRows[0]?.c ?? 0,
        page,
        pageSize,
      }),
    )
  })

  // GET /:cid — 签到规则详情
  server.get('/:cid', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const p = cidParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const [row] = await db
      .select()
      .from(tCheckInRecord)
      .where(eq(tCheckInRecord.id, p.data.cid))
      .limit(1)
    if (!row) return reply.status(404).send(error(404, '签到规则不存在'))
    return reply.send(success(toCheckin(row)))
  })

  // PUT /:cid — 修改签到规则(api-client updateCheckin 发送 { continuousNum?, memberId? })
  // 注: tCheckInRecord 无 continuousNum 列,该字段忽略;memberId 可更新
  server.put('/:cid', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const p = cidParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const b = updateCheckinSchema.safeParse(request.body ?? {})
    if (!b.success) return reply.status(400).send(error(400, '参数错误'))
    const update: Partial<{ memberId: number }> = {}
    if (b.data.memberId !== undefined) update.memberId = b.data.memberId
    const [row] = await db
      .update(tCheckInRecord)
      .set({ ...update, updateTime: new Date() })
      .where(eq(tCheckInRecord.id, p.data.cid))
      .returning()
    if (!row) return reply.status(404).send(error(404, '签到规则不存在'))
    return reply.send(success(toCheckin(row)))
  })

  // DELETE /:cid — 删除签到规则
  server.delete('/:cid', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const p = cidParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const [row] = await db
      .delete(tCheckInRecord)
      .where(eq(tCheckInRecord.id, p.data.cid))
      .returning()
    if (!row) return reply.status(404).send(error(404, '签到规则不存在'))
    return reply.send(success({ success: true }))
  })

  // ===========================================================================
  // CheckinRecord(签到记录)CRUD —— 对齐 api-client getCheckinRecords/getCheckinRecordDetail/createCheckinRecord/updateCheckinRecord/deleteCheckinRecord
  // 路径: GET /record/list (api-client 实际调用), GET /record (任务描述兼容), POST /record, GET/PUT/DELETE /record/:rid
  // ===========================================================================

  // GET /record/list + GET /record — 签到记录列表(分页 + memberId + type 过滤)
  const recordListHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(await checkAuth(request, reply))) return
    const q = checkinRecordListQuerySchema.safeParse(request.query)
    if (!q.success) return reply.status(400).send(error(400, '参数错误'))
    const { page, pageSize, memberId, type } = q.data
    const conds: SQL[] = []
    if (memberId !== undefined) conds.push(eq(tCheckInRecord.memberId, memberId))
    if (type !== undefined) conds.push(eq(tCheckInRecord.type, type))
    const where: SQL | undefined = conds.length > 0 ? and(...conds) : undefined
    const [rows, totalRows] = await Promise.all([
      db
        .select()
        .from(tCheckInRecord)
        .where(where)
        .orderBy(desc(tCheckInRecord.id))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      db.select({ c: sql<number>`count(*)::int` }).from(tCheckInRecord).where(where),
    ])
    return reply.send(
      success({
        list: rows.map(toCheckinRecord),
        total: totalRows[0]?.c ?? 0,
        page,
        pageSize,
      }),
    )
  }
  server.get('/record/list', recordListHandler)
  server.get('/record', recordListHandler)

  // POST /record — 创建签到记录(api-client createCheckinRecord 发送 { type, memberId? })
  server.post('/record', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const b = createCheckinRecordSchema.safeParse(request.body ?? {})
    if (!b.success) return reply.status(400).send(error(400, '参数错误'))
    const [row] = await db
      .insert(tCheckInRecord)
      .values({
        type: b.data.type,
        memberId: b.data.memberId ?? 0,
      })
      .returning()
    if (!row) return reply.status(500).send(error(500, '创建失败'))
    return reply.status(201).send(success(toCheckinRecord(row)))
  })

  // GET /record/:rid — 签到记录详情
  server.get('/record/:rid', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const p = ridParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const [row] = await db
      .select()
      .from(tCheckInRecord)
      .where(eq(tCheckInRecord.id, p.data.rid))
      .limit(1)
    if (!row) return reply.status(404).send(error(404, '签到记录不存在'))
    return reply.send(success(toCheckinRecord(row)))
  })

  // PUT /record/:rid — 修改签到记录(api-client updateCheckinRecord 发送 { type? })
  server.put('/record/:rid', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const p = ridParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const b = updateCheckinRecordSchema.safeParse(request.body ?? {})
    if (!b.success) return reply.status(400).send(error(400, '参数错误'))
    const update: Partial<{ type: string }> = {}
    if (b.data.type !== undefined) update.type = b.data.type
    const [row] = await db
      .update(tCheckInRecord)
      .set({ ...update, updateTime: new Date() })
      .where(eq(tCheckInRecord.id, p.data.rid))
      .returning()
    if (!row) return reply.status(404).send(error(404, '签到记录不存在'))
    return reply.send(success(toCheckinRecord(row)))
  })

  // DELETE /record/:rid — 删除签到记录
  server.delete('/record/:rid', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const p = ridParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const [row] = await db
      .delete(tCheckInRecord)
      .where(eq(tCheckInRecord.id, p.data.rid))
      .returning()
    if (!row) return reply.status(404).send(error(404, '签到记录不存在'))
    return reply.send(success({ success: true }))
  })
}

export default checkInRoutes
