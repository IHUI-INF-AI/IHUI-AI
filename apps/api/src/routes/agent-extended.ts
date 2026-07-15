import type { FastifyInstance, FastifyPluginAsync, FastifyReply } from 'fastify'
import { z } from 'zod'
import { eq, desc, sql, type SQL } from 'drizzle-orm'
import { db } from '../db/index.js'
import { success, error } from '../utils/response.js'
import { zhsAgentBuy, zhsAgentWithdrawalDetail, agentRule, agentHeatStats } from '@ihui/database'

const idParamSchema = z.object({ id: z.string().min(1) })

// =============================================================================
// 通用 raw SQL 辅助（适用于尚未迁移到 Drizzle schema 的旧表）
// =============================================================================

// 允许访问的表名白名单（防止 sql.raw 拼接 table 参数时引入注入风险）
const ALLOWED_TABLES = new Set([
  'zhs_agent_need_task',
  'agent_uploads',
  'zhs_agent_usedetail',
  'zhs_agent_buy',
  'zhs_agent_withdrawal_detail',
  'agent_rule',
  'agent_rule_param',
  'agent_heat_stats',
  'zhs_developer_link',
  'zhs_link_developer',
])

function assertTable(table: string): void {
  if (!ALLOWED_TABLES.has(table)) {
    throw new Error(`Table not in allowlist: ${table}`)
  }
}

function parsePaging(q: { page?: string; pageSize?: string }): { page: number; pageSize: number } {
  const page = Math.max(1, Math.floor(Number(q.page) || 1))
  const pageSize = Math.min(100, Math.max(1, Math.floor(Number(q.pageSize) || 20)))
  return { page, pageSize }
}

async function rawList(
  table: string,
  opts: { page: number; pageSize: number; conds?: SQL[]; orderBy?: string },
) {
  assertTable(table)
  const where =
    opts.conds && opts.conds.length > 0 ? sql`WHERE ${sql.join(opts.conds, sql` AND `)}` : sql``
  const order = opts.orderBy ?? '"id" DESC'
  const offset = (opts.page - 1) * opts.pageSize
  const rows = await db.execute(
    sql`SELECT * FROM ${sql.raw(`"${table}"`)} ${where} ORDER BY ${sql.raw(order)} LIMIT ${opts.pageSize} OFFSET ${offset}`,
  )
  const countRows = await db.execute(
    sql`SELECT count(*)::int AS count FROM ${sql.raw(`"${table}"`)} ${where}`,
  )
  const total = (countRows[0] as { count?: number } | undefined)?.count ?? 0
  return {
    list: rows as Record<string, unknown>[],
    total,
    page: opts.page,
    pageSize: opts.pageSize,
  }
}

async function rawById(table: string, id: string) {
  assertTable(table)
  const rows = await db.execute(
    sql`SELECT * FROM ${sql.raw(`"${table}"`)} WHERE "id"::text = ${id} LIMIT 1`,
  )
  return (rows as Record<string, unknown>[])[0]
}

async function rawInsert(
  table: string,
  columns: string[],
  body: Record<string, unknown>,
  reply: FastifyReply,
): Promise<Record<string, unknown> | null> {
  assertTable(table)
  const cols: string[] = []
  const vals: unknown[] = []
  for (const c of columns) {
    if (body[c] !== undefined) {
      cols.push(c)
      vals.push(body[c])
    }
  }
  if (cols.length === 0) {
    reply.status(400).send(error(400, '无可写入字段'))
    return null
  }
  const colList = sql.join(
    cols.map((c) => sql.raw(`"${c}"`)),
    sql`, `,
  )
  const valList = sql.join(
    vals.map((v) => sql`${v}`),
    sql`, `,
  )
  const rows = await db.execute(
    sql`INSERT INTO ${sql.raw(`"${table}"`)} (${colList}) VALUES (${valList}) RETURNING *`,
  )
  return (rows as Record<string, unknown>[])[0] ?? null
}

async function rawUpdate(
  table: string,
  columns: string[],
  id: string,
  body: Record<string, unknown>,
) {
  assertTable(table)
  const sets: SQL[] = []
  for (const c of columns) {
    if (body[c] !== undefined) sets.push(sql`${sql.raw(`"${c}"`)} = ${body[c]}`)
  }
  if (sets.length === 0) return undefined
  const rows = await db.execute(
    sql`UPDATE ${sql.raw(`"${table}"`)} SET ${sql.join(sets, sql`, `)} WHERE "id"::text = ${id} RETURNING *`,
  )
  return (rows as Record<string, unknown>[])[0]
}

async function rawDelete(table: string, id: string) {
  assertTable(table)
  await db.execute(sql`DELETE FROM ${sql.raw(`"${table}"`)} WHERE "id"::text = ${id}`)
}

const plugin: FastifyPluginAsync = async (server: FastifyInstance) => {
  const buyListQuery = z.object({
    userId: z.string().optional(),
    agentId: z.string().optional(),
    page: z.coerce.number().optional().default(1),
    pageSize: z.coerce.number().optional().default(20),
  })
  const renewBody = z.object({
    agentId: z.string(),
    userId: z.string(),
    duration: z.number(),
  })
  const withdrawalListQuery = z.object({
    userId: z.string().optional(),
    page: z.coerce.number().optional().default(1),
    pageSize: z.coerce.number().optional().default(20),
  })
  const optionalUserIdQuery = z.object({ userId: z.string().optional() })
  const optionalUserIdAgentIdQuery = z.object({
    userId: z.string().optional(),
    agentId: z.string().optional(),
  })
  const optionalAgentIdUserIdQuery = z.object({
    agentId: z.string().optional(),
    userId: z.string().optional(),
  })
  const validateOrderBody = z.object({
    orderNo: z.string().optional(),
    id: z.string().optional(),
  })
  // -------------------------------------------------------------------------
  // agent_need_task — Agent 需求任务市场（表 zhs_agent_need_task，尚未迁移为 Drizzle schema）
  // -------------------------------------------------------------------------
  const needTaskCols = [
    'user_id',
    'user_name',
    'agent_id',
    'agent_name',
    'title',
    'description',
    'type',
    'priority',
    'budget',
    'deadline',
    'status',
    'developer_id',
    'developer_name',
    'accept_time',
    'complete_time',
    'deliverable',
    'remark',
  ]
  server.get('/need-task/list', async (req, reply) => {
    const q = req.query as {
      page?: string
      pageSize?: string
      status?: string
      type?: string
      user_id?: string
      developer_id?: string
      keyword?: string
    }
    const { page, pageSize } = parsePaging(q)
    const conds: SQL[] = []
    if (q.status !== undefined) conds.push(sql`"status" = ${Number(q.status)}`)
    if (q.type) conds.push(sql`"type" = ${q.type}`)
    if (q.user_id) conds.push(sql`"user_id" = ${q.user_id}`)
    if (q.developer_id) conds.push(sql`"developer_id" = ${q.developer_id}`)
    if (q.keyword) conds.push(sql`"title" ILIKE ${`%${q.keyword}%`}`)
    try {
      const result = await rawList('zhs_agent_need_task', {
        page,
        pageSize,
        conds,
        orderBy: '"priority" DESC, "id" DESC',
      })
      return reply.send(success(result))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '查询需求任务失败'))
    }
  })
  server.get('/need-task/:id', async (req, reply) => {
    const parsed = idParamSchema.safeParse(req.params)
    if (!parsed.success) return reply.status(400).send(error(400, '无效的 ID'))
    try {
      const row = await rawById('zhs_agent_need_task', parsed.data.id)
      if (!row) return reply.status(404).send(error(404, '需求任务不存在'))
      return reply.send(success(row))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '查询需求任务失败'))
    }
  })
  server.post('/need-task', async (req, reply) => {
    try {
      const body = req.body as Record<string, unknown>
      if (body.status === undefined) body.status = 0
      const row = await rawInsert('zhs_agent_need_task', needTaskCols, body, reply)
      if (!row) return
      return reply.status(201).send(success(row))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '创建需求任务失败'))
    }
  })
  server.put('/need-task/:id', async (req, reply) => {
    const parsed = idParamSchema.safeParse(req.params)
    if (!parsed.success) return reply.status(400).send(error(400, '无效的 ID'))
    try {
      const row = await rawUpdate(
        'zhs_agent_need_task',
        needTaskCols,
        parsed.data.id,
        req.body as Record<string, unknown>,
      )
      return reply.send(success(row ?? { id: parsed.data.id, updated: true }))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '更新需求任务失败'))
    }
  })
  server.delete('/need-task/:id', async (req, reply) => {
    const parsed = idParamSchema.safeParse(req.params)
    if (!parsed.success) return reply.status(400).send(error(400, '无效的 ID'))
    try {
      await rawDelete('zhs_agent_need_task', parsed.data.id)
      return reply.send(success({ id: parsed.data.id, deleted: true }))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '删除需求任务失败'))
    }
  })

  // -------------------------------------------------------------------------
  // agent_upload — Agent 资源上传管理（表 agent_upload，尚未迁移为 Drizzle schema）
  // 旧逻辑：删除为软删除（status=0），列表仅返回 status=1
  // -------------------------------------------------------------------------
  const uploadCols = [
    'user_id',
    'user_name',
    'agent_id',
    'agent_name',
    'file_name',
    'file_url',
    'file_type',
    'file_size',
    'mime_type',
    'ext',
    'biz_type',
    'status',
  ]
  server.get('/upload/list', async (req, reply) => {
    const q = req.query as {
      page?: string
      pageSize?: string
      agent_id?: string
      biz_type?: string
      file_type?: string
      user_id?: string
    }
    const { page, pageSize } = parsePaging(q)
    const conds: SQL[] = [sql`"status" = 1`]
    if (q.agent_id) conds.push(sql`"agent_id" = ${q.agent_id}`)
    if (q.biz_type) conds.push(sql`"biz_type" = ${q.biz_type}`)
    if (q.file_type) conds.push(sql`"file_type" = ${q.file_type}`)
    if (q.user_id) conds.push(sql`"user_id" = ${q.user_id}`)
    try {
      const result = await rawList('agent_upload', { page, pageSize, conds })
      return reply.send(success(result))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '查询上传记录失败'))
    }
  })
  server.get('/upload/:id', async (req, reply) => {
    const parsed = idParamSchema.safeParse(req.params)
    if (!parsed.success) return reply.status(400).send(error(400, '无效的 ID'))
    try {
      const row = await rawById('agent_uploads', parsed.data.id)
      if (!row) return reply.status(404).send(error(404, '上传记录不存在'))
      return reply.send(success(row))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '查询上传记录失败'))
    }
  })
  server.post('/upload', async (req, reply) => {
    try {
      const body = req.body as Record<string, unknown>
      if (body.status === undefined) body.status = 1
      const row = await rawInsert('agent_uploads', uploadCols, body, reply)
      if (!row) return
      return reply.status(201).send(success(row))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '创建上传记录失败'))
    }
  })
  server.put('/upload/:id', async (req, reply) => {
    const parsed = idParamSchema.safeParse(req.params)
    if (!parsed.success) return reply.status(400).send(error(400, '无效的 ID'))
    try {
      const row = await rawUpdate(
        'agent_upload',
        uploadCols,
        parsed.data.id,
        req.body as Record<string, unknown>,
      )
      return reply.send(success(row ?? { id: parsed.data.id, updated: true }))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '更新上传记录失败'))
    }
  })
  server.delete('/upload/:id', async (req, reply) => {
    const parsed = idParamSchema.safeParse(req.params)
    if (!parsed.success) return reply.status(400).send(error(400, '无效的 ID'))
    try {
      // 软删除：status=0（与旧架构一致）
      await db.execute(
        sql`UPDATE ${sql.raw('"agent_uploads"')} SET "status" = 0 WHERE "id"::text = ${parsed.data.id}`,
      )
      return reply.send(success({ id: parsed.data.id, deleted: true }))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '删除上传记录失败'))
    }
  })

  // -------------------------------------------------------------------------
  // agent_usedetail — 代理商使用明细（表 zhs_agent_usedetail，尚未迁移为 Drizzle schema）
  // -------------------------------------------------------------------------
  const usedetailCols = [
    'agent_id',
    'agent_name',
    'user_id',
    'user_name',
    'type',
    'model',
    'tokens',
    'amount',
    'cost',
    'profit',
    'request_id',
    'status',
    'remark',
  ]
  server.get('/usedetail/list', async (req, reply) => {
    const q = req.query as {
      page?: string
      pageSize?: string
      agent_id?: string
      user_id?: string
      type?: string
      start_date?: string
      end_date?: string
    }
    const { page, pageSize } = parsePaging(q)
    const conds: SQL[] = []
    if (q.agent_id) conds.push(sql`"agent_id" = ${q.agent_id}`)
    if (q.user_id) conds.push(sql`"user_id" = ${q.user_id}`)
    if (q.type) conds.push(sql`"type" = ${q.type}`)
    if (q.start_date) conds.push(sql`"created_at" >= ${q.start_date}::timestamp`)
    if (q.end_date) conds.push(sql`"created_at" <= ${`${q.end_date} 23:59:59`}::timestamp`)
    try {
      const result = await rawList('zhs_agent_usedetail', { page, pageSize, conds })
      return reply.send(success(result))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '查询使用明细失败'))
    }
  })
  server.get('/usedetail/:id', async (req, reply) => {
    const parsed = idParamSchema.safeParse(req.params)
    if (!parsed.success) return reply.status(400).send(error(400, '无效的 ID'))
    try {
      const row = await rawById('zhs_agent_usedetail', parsed.data.id)
      if (!row) return reply.status(404).send(error(404, '使用明细不存在'))
      return reply.send(success(row))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '查询使用明细失败'))
    }
  })
  server.post('/usedetail', async (req, reply) => {
    try {
      const body = req.body as Record<string, unknown>
      if (body.status === undefined) body.status = 1
      const row = await rawInsert('zhs_agent_usedetail', usedetailCols, body, reply)
      if (!row) return
      return reply.status(201).send(success(row))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '创建使用明细失败'))
    }
  })
  server.put('/usedetail/:id', async (req, reply) => {
    const parsed = idParamSchema.safeParse(req.params)
    if (!parsed.success) return reply.status(400).send(error(400, '无效的 ID'))
    try {
      const row = await rawUpdate(
        'zhs_agent_usedetail',
        usedetailCols,
        parsed.data.id,
        req.body as Record<string, unknown>,
      )
      return reply.send(success(row ?? { id: parsed.data.id, updated: true }))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '更新使用明细失败'))
    }
  })
  server.delete('/usedetail/:id', async (req, reply) => {
    const parsed = idParamSchema.safeParse(req.params)
    if (!parsed.success) return reply.status(400).send(error(400, '无效的 ID'))
    try {
      await rawDelete('zhs_agent_usedetail', parsed.data.id)
      return reply.send(success({ id: parsed.data.id, deleted: true }))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '删除使用明细失败'))
    }
  })
  // -------------------------------------------------------------------------
  // 智能体商业化（购买/续费/提现）
  // -------------------------------------------------------------------------

  const agentBuySchema = z.object({
    agentId: z.string().uuid(),
    userId: z.string().uuid(),
    price: z.number().min(0),
    duration: z.number().int().min(1), // 购买时长（天）
    paymentMethod: z.string().max(32).optional(),
  })

  // 创建购买订单
  server.post('/buy/create', async (request, reply) => {
    const body = agentBuySchema.parse(request.body)
    const expiresAt = new Date(Date.now() + body.duration * 86400000)
    const [order] = await db
      .insert(zhsAgentBuy)
      .values({
        agentId: body.agentId,
        userId: body.userId,
        price: body.price.toString(),
        duration: body.duration,
        expiresAt,
        status: 'pending',
      })
      .returning()
    return reply.code(201).send(order)
  })

  // 购买记录列表
  server.get('/buy/list', async (request) => {
    const { userId, agentId, page, pageSize } = buyListQuery.parse(request.query)
    const offset = (page - 1) * pageSize
    const conditions: SQL[] = []
    if (userId) conditions.push(eq(zhsAgentBuy.userId, userId))
    if (agentId) conditions.push(eq(zhsAgentBuy.agentId, agentId))
    const where = conditions.length ? sql.join(conditions, sql` AND `) : sql`TRUE`
    const list = await db.select().from(zhsAgentBuy).where(where).limit(pageSize).offset(offset)
    const total = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(zhsAgentBuy)
      .where(where)
    return { list, total: total[0]?.count ?? 0, page, pageSize }
  })

  // 购买记录详情
  server.get('/buy/:id', async (request, reply) => {
    const { id } = idParamSchema.parse(request.params)
    const result = await db.select().from(zhsAgentBuy).where(eq(zhsAgentBuy.id, id)).limit(1)
    if (!result[0]) return reply.code(404).send({ error: '购买记录不存在' })
    return result[0]
  })

  // 续费
  server.post('/developer/renew', async (request, reply) => {
    const { agentId, userId, duration } = renewBody.parse(request.body)
    const existing = await db
      .select()
      .from(zhsAgentBuy)
      .where(
        sql`${zhsAgentBuy.agentId} = ${agentId} AND ${zhsAgentBuy.userId} = ${userId} AND ${zhsAgentBuy.status} = 'active'`,
      )
      .limit(1)
    const existingRow = existing[0]
    if (!existingRow) return reply.code(404).send({ error: '无有效订阅记录' })
    const newExpires = new Date(
      Math.max(existingRow.expiresAt.getTime(), Date.now()) + duration * 86400000,
    )
    const [updated] = await db
      .update(zhsAgentBuy)
      .set({
        expiresAt: newExpires,
        duration: existingRow.duration + duration,
        updatedAt: new Date(),
      })
      .where(eq(zhsAgentBuy.id, existingRow.id))
      .returning()
    return updated
  })

  // 提现明细列表
  server.get('/withdrawal/list', async (request) => {
    const { userId, page, pageSize } = withdrawalListQuery.parse(request.query)
    const offset = (page - 1) * pageSize
    const conditions: SQL[] = []
    if (userId) conditions.push(eq(zhsAgentWithdrawalDetail.userId, userId))
    const where = conditions.length ? sql.join(conditions, sql` AND `) : sql`TRUE`
    const list = await db
      .select()
      .from(zhsAgentWithdrawalDetail)
      .where(where)
      .limit(pageSize)
      .offset(offset)
    const total = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(zhsAgentWithdrawalDetail)
      .where(where)
    return { list, total: total[0]?.count ?? 0, page, pageSize }
  })

  // 提现明细统计
  server.get('/withdrawal/summary', async (request) => {
    const { userId } = optionalUserIdQuery.parse(request.query)
    const result = await db
      .select({
        totalAmount: sql<number>`COALESCE(SUM(${zhsAgentWithdrawalDetail.amount}::numeric), 0)::float8`,
        totalCount: sql<number>`count(*)::int`,
        pendingCount: sql<number>`count(*) FILTER (WHERE ${zhsAgentWithdrawalDetail.status} = 'pending')::int`,
        completedCount: sql<number>`count(*) FILTER (WHERE ${zhsAgentWithdrawalDetail.status} = 'completed')::int`,
      })
      .from(zhsAgentWithdrawalDetail)
      .where(userId ? eq(zhsAgentWithdrawalDetail.userId, userId) : sql`TRUE`)
    return result[0] ?? { totalAmount: 0, totalCount: 0, pendingCount: 0, completedCount: 0 }
  })

  // -------------------------------------------------------------------------
  // agent_buy 扩展端点（raw SQL 操作 zhs_agent_buy 表）
  // -------------------------------------------------------------------------
  const buyCols = [
    'agent_id',
    'user_id',
    'price',
    'duration',
    'expires_at',
    'status',
    'payment_method',
    'payment_id',
  ]

  /**
   * 购买统计摘要。
   * @query userId, agentId 可选过滤条件
   * @returns { total_count, total_amount, active_count, pending_count, expired_count, cancelled_count }
   */
  server.get('/buy/stats/summary', async (request, reply) => {
    const { userId, agentId } = optionalUserIdAgentIdQuery.parse(request.query)
    try {
      const conds: SQL[] = []
      if (userId) conds.push(sql`"user_id" = ${userId}`)
      if (agentId) conds.push(sql`"agent_id" = ${agentId}`)
      const where = conds.length > 0 ? sql`WHERE ${sql.join(conds, sql` AND `)}` : sql``
      const rows = await db.execute(
        sql`SELECT
          count(*)::int AS total_count,
          COALESCE(SUM("price"::numeric), 0)::float8 AS total_amount,
          count(*) FILTER (WHERE "status" = 'active')::int AS active_count,
          count(*) FILTER (WHERE "status" = 'pending')::int AS pending_count,
          count(*) FILTER (WHERE "status" = 'expired')::int AS expired_count,
          count(*) FILTER (WHERE "status" = 'cancelled')::int AS cancelled_count
        FROM ${sql.raw('"zhs_agent_buy"')} ${where}`,
      )
      const row = (rows as Record<string, unknown>[])[0]
      return reply.send(success(row ?? {}))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '查询购买统计失败'))
    }
  })

  /**
   * 生成订单号。
   * @query agentId, userId 可选关联信息
   * @returns { orderNo, generatedAt }
   */
  server.get('/buy/order/generate', async (request, reply) => {
    const { agentId, userId } = optionalAgentIdUserIdQuery.parse(request.query)
    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    const ts =
      `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
      `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
    const random = Math.floor(Math.random() * 1000000)
      .toString()
      .padStart(6, '0')
    const orderNo = `BUY${ts}${random}`
    return reply.send(success({ orderNo, generatedAt: now, agentId, userId }))
  })

  /**
   * 校验订单。
   * @body { orderNo?, id? } 至少提供一个
   * @returns { valid, order }
   */
  server.post('/buy/order/validate', async (request, reply) => {
    const { orderNo, id } = validateOrderBody.parse(request.body)
    if (!orderNo && !id) return reply.status(400).send(error(400, '需要提供 orderNo 或 id'))
    try {
      let row: Record<string, unknown> | undefined
      if (id) {
        row = await rawById('zhs_agent_buy', id)
      }
      if (!row && orderNo) {
        const rows = await db.execute(
          sql`SELECT * FROM ${sql.raw('"zhs_agent_buy"')} WHERE "payment_id" = ${orderNo} LIMIT 1`,
        )
        row = (rows as Record<string, unknown>[])[0]
      }
      if (!row) return reply.status(404).send(error(404, '订单不存在'))
      const status = row['status'] as string | undefined
      const valid = status === 'active' || status === 'pending'
      return reply.send(success({ valid, order: row }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '校验订单失败'))
    }
  })

  /**
   * 更新购买记录。
   * @params id 购买记录 ID
   * @body 可更新字段: agent_id, user_id, price, duration, expires_at, status, payment_method, payment_id
   * @returns 更新后的记录
   */
  server.put('/buy/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) return reply.status(400).send(error(400, '无效的 ID'))
    try {
      const row = await rawUpdate(
        'zhs_agent_buy',
        buyCols,
        parsed.data.id,
        request.body as Record<string, unknown>,
      )
      if (!row) return reply.status(404).send(error(404, '购买记录不存在或无可更新字段'))
      return reply.send(success(row))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '更新购买记录失败'))
    }
  })

  /**
   * 删除购买记录。
   * @params id 购买记录 ID
   * @returns { id, deleted }
   */
  server.delete('/buy/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) return reply.status(400).send(error(400, '无效的 ID'))
    try {
      const existing = await rawById('zhs_agent_buy', parsed.data.id)
      if (!existing) return reply.status(404).send(error(404, '购买记录不存在'))
      await rawDelete('zhs_agent_buy', parsed.data.id)
      return reply.send(success({ id: parsed.data.id, deleted: true }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '删除购买记录失败'))
    }
  })

  /**
   * 重新计算到期时间。
   * 基于 created_at + duration（天）重新计算 expires_at。
   * @params id 购买记录 ID
   * @returns { recalculated, expiresAt, order }
   */
  server.post('/buy/:id/recalculate-expiration', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) return reply.status(400).send(error(400, '无效的 ID'))
    try {
      const row = await rawById('zhs_agent_buy', parsed.data.id)
      if (!row) return reply.status(404).send(error(404, '购买记录不存在'))
      const duration = Number(row['duration']) || 0
      const createdAtRaw = row['created_at']
      const createdAt = createdAtRaw instanceof Date ? createdAtRaw : new Date(String(createdAtRaw))
      const newExpiresAt = new Date(createdAt.getTime() + duration * 86400000)
      const rows = await db.execute(
        sql`UPDATE ${sql.raw('"zhs_agent_buy"')} SET "expires_at" = ${newExpiresAt}, "updated_at" = NOW() WHERE "id"::text = ${parsed.data.id} RETURNING *`,
      )
      const updated = (rows as Record<string, unknown>[])[0]
      return reply.send(success({ recalculated: true, expiresAt: newExpiresAt, order: updated }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '重新计算到期时间失败'))
    }
  })

  // -------------------------------------------------------------------------
  // Agent 规则 CRUD (Drizzle schema agent_rule)
  // -------------------------------------------------------------------------
  server.get('/rules/list', async (req, reply) => {
    const q = req.query as {
      page?: string
      pageSize?: string
      agentId?: string
      status?: string
      keyword?: string
    }
    const { page, pageSize } = parsePaging(q)
    const offset = (page - 1) * pageSize
    const conditions: SQL[] = []
    if (q.agentId) conditions.push(eq(agentRule.agentId, q.agentId))
    if (q.status !== undefined) conditions.push(eq(agentRule.status, Number(q.status)))
    if (q.keyword) conditions.push(sql`${agentRule.ruleName} ILIKE ${`%${q.keyword}%`}`)
    const where = conditions.length ? sql.join(conditions, sql` AND `) : sql`TRUE`
    try {
      const list = await db
        .select()
        .from(agentRule)
        .where(where)
        .orderBy(desc(agentRule.priority), desc(agentRule.createdAt))
        .limit(pageSize)
        .offset(offset)
      const totalRows = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(agentRule)
        .where(where)
      return reply.send(success({ list, total: totalRows[0]?.count ?? 0, page, pageSize }))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '查询规则列表失败'))
    }
  })

  server.get('/rules/:id', async (req, reply) => {
    const parsed = idParamSchema.safeParse(req.params)
    if (!parsed.success) return reply.status(400).send(error(400, '无效的 ID'))
    try {
      const rows = await db
        .select()
        .from(agentRule)
        .where(eq(agentRule.id, parsed.data.id))
        .limit(1)
      if (!rows[0]) return reply.status(404).send(error(404, '规则不存在'))
      return reply.send(success(rows[0]))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '查询规则失败'))
    }
  })

  server.post('/rules', async (req, reply) => {
    try {
      const body = req.body as {
        agentId: string
        ruleName: string
        ruleCode: string
        ruleType?: string
        priority?: number
        description?: string
      }
      if (!body.agentId || !body.ruleName || !body.ruleCode) {
        return reply.status(400).send(error(400, '缺少必要字段: agentId, ruleName, ruleCode'))
      }
      const [row] = await db
        .insert(agentRule)
        .values({
          agentId: body.agentId,
          ruleName: body.ruleName,
          ruleCode: body.ruleCode,
          ruleType: body.ruleType ?? 'text',
          priority: body.priority ?? 0,
          description: body.description ?? '',
          status: 1,
        })
        .returning()
      return reply.status(201).send(success(row))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '创建规则失败'))
    }
  })

  server.put('/rules/:id', async (req, reply) => {
    const parsed = idParamSchema.safeParse(req.params)
    if (!parsed.success) return reply.status(400).send(error(400, '无效的 ID'))
    try {
      const body = req.body as Record<string, unknown>
      const sets: Record<string, unknown> = { updatedAt: new Date() }
      if (body.agentId !== undefined) sets.agentId = body.agentId
      if (body.ruleName !== undefined) sets.ruleName = body.ruleName
      if (body.ruleCode !== undefined) sets.ruleCode = body.ruleCode
      if (body.ruleType !== undefined) sets.ruleType = body.ruleType
      if (body.priority !== undefined) sets.priority = body.priority
      if (body.status !== undefined) sets.status = body.status
      if (body.description !== undefined) sets.description = body.description
      const [row] = await db
        .update(agentRule)
        .set(sets)
        .where(eq(agentRule.id, parsed.data.id))
        .returning()
      if (!row) return reply.status(404).send(error(404, '规则不存在'))
      return reply.send(success(row))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '更新规则失败'))
    }
  })

  server.delete('/rules/:id', async (req, reply) => {
    const parsed = idParamSchema.safeParse(req.params)
    if (!parsed.success) return reply.status(400).send(error(400, '无效的 ID'))
    try {
      await db.delete(agentRule).where(eq(agentRule.id, parsed.data.id))
      return reply.send(success({ id: parsed.data.id, deleted: true }))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '删除规则失败'))
    }
  })

  // -------------------------------------------------------------------------
  // Agent 规则参数 CRUD (raw SQL, legacy 表 agent_rule_param)
  // -------------------------------------------------------------------------
  const ruleParamCols = [
    'agent_rule_id',
    'param_name',
    'param_code',
    'param_type',
    'param_value',
    'description',
    'status',
  ]
  server.get('/rule-params/list', async (req, reply) => {
    const q = req.query as {
      page?: string
      pageSize?: string
      agent_rule_id?: string
      status?: string
    }
    const { page, pageSize } = parsePaging(q)
    const conds: SQL[] = []
    if (q.agent_rule_id) conds.push(sql`"agent_rule_id" = ${q.agent_rule_id}`)
    if (q.status !== undefined) conds.push(sql`"status" = ${Number(q.status)}`)
    try {
      const result = await rawList('agent_rule_param', { page, pageSize, conds })
      return reply.send(success(result))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '查询规则参数失败'))
    }
  })
  server.get('/rule-params/:id', async (req, reply) => {
    const parsed = idParamSchema.safeParse(req.params)
    if (!parsed.success) return reply.status(400).send(error(400, '无效的 ID'))
    try {
      const row = await rawById('agent_rule_param', parsed.data.id)
      if (!row) return reply.status(404).send(error(404, '规则参数不存在'))
      return reply.send(success(row))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '查询规则参数失败'))
    }
  })
  server.post('/rule-params', async (req, reply) => {
    try {
      const body = req.body as Record<string, unknown>
      if (body.status === undefined) body.status = 1
      const row = await rawInsert('agent_rule_param', ruleParamCols, body, reply)
      if (!row) return
      return reply.status(201).send(success(row))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '创建规则参数失败'))
    }
  })
  server.put('/rule-params/:id', async (req, reply) => {
    const parsed = idParamSchema.safeParse(req.params)
    if (!parsed.success) return reply.status(400).send(error(400, '无效的 ID'))
    try {
      const row = await rawUpdate(
        'agent_rule_param',
        ruleParamCols,
        parsed.data.id,
        req.body as Record<string, unknown>,
      )
      return reply.send(success(row ?? { id: parsed.data.id, updated: true }))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '更新规则参数失败'))
    }
  })
  server.delete('/rule-params/:id', async (req, reply) => {
    const parsed = idParamSchema.safeParse(req.params)
    if (!parsed.success) return reply.status(400).send(error(400, '无效的 ID'))
    try {
      await rawDelete('agent_rule_param', parsed.data.id)
      return reply.send(success({ id: parsed.data.id, deleted: true }))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '删除规则参数失败'))
    }
  })

  // -------------------------------------------------------------------------
  // Agent 热度统计 (Drizzle schema agent_heat_stats)
  // -------------------------------------------------------------------------
  server.get('/heat/list', async (req, reply) => {
    const q = req.query as {
      page?: string
      pageSize?: string
      agentId?: string
      dateStr?: string
    }
    const { page, pageSize } = parsePaging(q)
    const offset = (page - 1) * pageSize
    const conditions: SQL[] = []
    if (q.agentId) conditions.push(eq(agentHeatStats.agentId, q.agentId))
    if (q.dateStr) conditions.push(eq(agentHeatStats.dateStr, q.dateStr))
    const where = conditions.length ? sql.join(conditions, sql` AND `) : sql`TRUE`
    try {
      const list = await db
        .select()
        .from(agentHeatStats)
        .where(where)
        .orderBy(desc(agentHeatStats.createdAt))
        .limit(pageSize)
        .offset(offset)
      const totalRows = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(agentHeatStats)
        .where(where)
      return reply.send(success({ list, total: totalRows[0]?.count ?? 0, page, pageSize }))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '查询热度统计失败'))
    }
  })

  server.get('/heat/summary', async (req, reply) => {
    const { agentId } = req.query as { agentId: string }
    if (!agentId) return reply.status(400).send(error(400, '缺少 agentId 参数'))
    try {
      const totalRows = await db
        .select({ totalHits: sql<number>`COALESCE(SUM(${agentHeatStats.hitCount}), 0)::int` })
        .from(agentHeatStats)
        .where(eq(agentHeatStats.agentId, agentId))
      const now = new Date()
      const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000)
      const pad = (n: number) => String(n).padStart(2, '0')
      const startDate = `${sevenDaysAgo.getFullYear()}-${pad(sevenDaysAgo.getMonth() + 1)}-${pad(sevenDaysAgo.getDate())}`
      const trendRows = await db
        .select({
          dateStr: agentHeatStats.dateStr,
          hitCount: sql<number>`COALESCE(SUM(${agentHeatStats.hitCount}), 0)::int`,
        })
        .from(agentHeatStats)
        .where(
          sql`${agentHeatStats.agentId} = ${agentId} AND ${agentHeatStats.dateStr} >= ${startDate}`,
        )
        .groupBy(agentHeatStats.dateStr)
        .orderBy(agentHeatStats.dateStr)
      return reply.send(
        success({
          agentId,
          totalHits: totalRows[0]?.totalHits ?? 0,
          trend: trendRows,
        }),
      )
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '查询热度汇总失败'))
    }
  })

  server.get('/heat/top', async (req, reply) => {
    try {
      const rows = await db
        .select({
          agentId: agentHeatStats.agentId,
          totalHits: sql<number>`COALESCE(SUM(${agentHeatStats.hitCount}), 0)::int`,
        })
        .from(agentHeatStats)
        .groupBy(agentHeatStats.agentId)
        .orderBy(sql`SUM(${agentHeatStats.hitCount}) DESC`)
        .limit(10)
      return reply.send(success(rows))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '查询热度排行失败'))
    }
  })

  // -------------------------------------------------------------------------
  // 开发者链接管理 (raw SQL, legacy 表 zhs_developer_link)
  // -------------------------------------------------------------------------
  const developerLinkCols = [
    'user_id',
    'user_name',
    'creator_id',
    'creator_name',
    'type',
    'count',
    'order_no',
    'expires_at',
    'status',
  ]
  server.get('/developer/list', async (req, reply) => {
    const q = req.query as {
      page?: string
      pageSize?: string
      user_id?: string
      status?: string
    }
    const { page, pageSize } = parsePaging(q)
    const conds: SQL[] = []
    if (q.user_id) conds.push(sql`"user_id" = ${q.user_id}`)
    if (q.status !== undefined) conds.push(sql`"status" = ${Number(q.status)}`)
    try {
      const result = await rawList('zhs_developer_link', { page, pageSize, conds })
      return reply.send(success(result))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '查询开发者链接失败'))
    }
  })
  server.get('/developer/:id', async (req, reply) => {
    const parsed = idParamSchema.safeParse(req.params)
    if (!parsed.success) return reply.status(400).send(error(400, '无效的 ID'))
    try {
      const row = await rawById('zhs_developer_link', parsed.data.id)
      if (!row) return reply.status(404).send(error(404, '开发者链接不存在'))
      return reply.send(success(row))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '查询开发者链接失败'))
    }
  })
  server.get('/developer/order/:orderNo', async (req, reply) => {
    const { orderNo } = req.params as { orderNo: string }
    try {
      const rows = await db.execute(
        sql`SELECT * FROM ${sql.raw('"zhs_developer_link"')} WHERE "order_no" = ${orderNo} LIMIT 1`,
      )
      const row = (rows as Record<string, unknown>[])[0]
      if (!row) return reply.status(404).send(error(404, '开发者链接不存在'))
      return reply.send(success(row))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '查询开发者链接失败'))
    }
  })
  server.post('/developer', async (req, reply) => {
    try {
      const body = req.body as Record<string, unknown>
      const type = Number(body.type ?? 0)
      const count = Math.max(1, Number(body.count ?? 1))
      const now = new Date()
      const expiresAt = new Date(now)
      if (type === 1) {
        expiresAt.setFullYear(now.getFullYear() + count)
      } else {
        expiresAt.setMonth(now.getMonth() + count)
      }
      body.expires_at = expiresAt
      if (body.status === undefined) body.status = 1
      if (!body.order_no) {
        const pad = (n: number) => String(n).padStart(2, '0')
        const ts =
          `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
          `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
        const random = Math.floor(Math.random() * 1000000)
          .toString()
          .padStart(6, '0')
        body.order_no = `DEV${ts}${random}`
      }
      const row = await rawInsert('zhs_developer_link', developerLinkCols, body, reply)
      if (!row) return
      return reply.status(201).send(success(row))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '创建开发者链接失败'))
    }
  })
  server.post('/developer/generate-order-no', async (_req, reply) => {
    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    const ts =
      `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
      `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
    const random = Math.floor(Math.random() * 1000000)
      .toString()
      .padStart(6, '0')
    const orderNo = `DEV${ts}${random}`
    return reply.send(success({ orderNo, generatedAt: now }))
  })

  // -------------------------------------------------------------------------
  // 代理人设管理 (raw SQL, agents 表 agent_prompt 字段)
  // -------------------------------------------------------------------------
  server.get('/personality/:agentId', async (req, reply) => {
    const { agentId } = req.params as { agentId: string }
    try {
      const rows = await db.execute(
        sql`SELECT "agent_id", "agent_prompt" FROM ${sql.raw('"agents"')} WHERE "agent_id"::text = ${agentId} LIMIT 1`,
      )
      const row = (rows as Record<string, unknown>[])[0]
      if (!row) return reply.status(404).send(error(404, '智能体不存在'))
      return reply.send(success({ agentId: row['agent_id'], personality: row['agent_prompt'] }))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '查询人设失败'))
    }
  })
  server.put('/personality/:agentId', async (req, reply) => {
    const { agentId } = req.params as { agentId: string }
    const { personality } = req.body as { personality: string }
    if (personality === undefined) {
      return reply.status(400).send(error(400, '缺少 personality 字段'))
    }
    try {
      const rows = await db.execute(
        sql`UPDATE ${sql.raw('"agents"')} SET "agent_prompt" = ${personality}, "updated_at" = NOW() WHERE "agent_id"::text = ${agentId} RETURNING "agent_id", "agent_prompt"`,
      )
      const row = (rows as Record<string, unknown>[])[0]
      if (!row) return reply.status(404).send(error(404, '智能体不存在'))
      return reply.send(success({ agentId: row['agent_id'], personality: row['agent_prompt'] }))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '更新人设失败'))
    }
  })
}

export default plugin
