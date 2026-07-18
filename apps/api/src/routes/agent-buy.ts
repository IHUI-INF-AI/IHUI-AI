import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { randomBytes } from 'crypto'
import { eq, and, desc, gte, lte, sql, type SQL } from 'drizzle-orm'
import { authenticate } from '../plugins/auth.js'
import { success, error } from '../utils/response.js'
import { db, dbRead } from '../db/index.js'
import { zhsAgentBuy } from '@ihui/database'

// =============================================================================
// 鉴权辅助
// =============================================================================

async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<boolean> {
  try {
    await authenticate(request)
    return true
  } catch (e) {
    const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
    const message = (e as Error).message || 'Authentication required'
    reply.status(statusCode).send(error(statusCode, message))
    return false
  }
}

function toInt(v: string | undefined): number | undefined {
  if (v === undefined || v === '') return undefined
  const n = parseInt(v, 10)
  return Number.isNaN(n) ? undefined : n
}

// =============================================================================
// 工具函数：订单号生成 / 验证 / 解析
// 格式：WXAT + YYYYMMDD + 7位序号（共 19 位字符）
// =============================================================================

const ORDER_NO_PREFIX = 'WXAT'
const ORDER_NO_REGEX = /^WXAT\d{15}$/

function pad(n: number, width: number): string {
  return n.toString().padStart(width, '0')
}

function formatDate(date: Date): string {
  const y = date.getUTCFullYear()
  const m = pad(date.getUTCMonth() + 1, 2)
  const d = pad(date.getUTCDate(), 2)
  return `${y}${m}${d}`
}

function generateOrderNumber(): string {
  const datePart = formatDate(new Date())
  // 7 位序号：从 crypto 随机源取 7 位数字
  const bytes = randomBytes(7)
  let seq = 0
  for (let i = 0; i < bytes.length; i++) {
    seq = (seq * 256 + bytes[i]!) % 10_000_000
  }
  const seqPart = pad(seq, 7)
  return `${ORDER_NO_PREFIX}${datePart}${seqPart}`
}

function validateOrderNumber(orderNo: string): boolean {
  return typeof orderNo === 'string' && ORDER_NO_REGEX.test(orderNo)
}

function parseOrderNumber(orderNo: string): {
  prefix: string
  date: string
  sequence: string
  fullDate: string | null
} | null {
  if (!validateOrderNumber(orderNo)) return null
  return {
    prefix: orderNo.slice(0, 4),
    date: orderNo.slice(4, 12),
    sequence: orderNo.slice(12, 19),
    fullDate: `${orderNo.slice(4, 8)}-${orderNo.slice(8, 10)}-${orderNo.slice(10, 12)}`,
  }
}

// =============================================================================
// Zod schemas
// =============================================================================

const createSchema = z.object({
  agentId: z.string().min(1, 'agentId 不能为空'),
  price: z.union([z.string(), z.number()]).transform((v) => String(v)),
  duration: z.number().int().min(1).max(3650),
  paymentMethod: z.string().max(32).optional(),
  paymentId: z.string().max(128).optional(),
  status: z.string().max(32).optional(),
})

const updateSchema = z.object({
  price: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => (v === undefined ? undefined : String(v))),
  duration: z.number().int().min(1).max(3650).optional(),
  status: z.string().max(32).optional(),
  paymentMethod: z.string().max(32).optional(),
  paymentId: z.string().max(128).optional(),
  expiresAt: z.string().datetime().optional(),
})

const listQuerySchema = z.object({
  page: z.string().optional(),
  pageSize: z.string().optional(),
  agentId: z.string().optional(),
  userId: z.string().optional(),
  status: z.string().optional(),
  paymentMethod: z.string().optional(),
  paymentId: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
})

const statsQuerySchema = z.object({
  agentId: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
})

const validateOrderBodySchema = z.object({
  orderNo: z.string().min(1, 'orderNo 不能为空'),
})

const recordIdParamSchema = z.object({ recordId: z.string() })

// =============================================================================
// 路由：智能体购买记录 (挂载于 /cozeZhsApi/agent-buy)
// 对应 D 盘 agent_buy.py 的 9 个端点
// =============================================================================

export const agentBuyRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(await requireAuth(request, reply))) return
  })

  // -------------------------------------------------------------------------
  // 1. POST /create - 创建购买记录
  // -------------------------------------------------------------------------
  server.post('/create', async (request, reply) => {
    const parsed = createSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { agentId, price, duration, paymentMethod, paymentId, status } = parsed.data
    const userId = request.userId
    if (!userId) {
      return reply.status(401).send(error(401, '用户未登录'))
    }
    const now = new Date()
    const expiresAt = new Date(now.getTime() + duration * 24 * 60 * 60 * 1000)
    try {
      const rows = await db
        .insert(zhsAgentBuy)
        .values({
          agentId,
          userId,
          price,
          duration,
          expiresAt,
          status: status ?? 'pending',
          paymentMethod: paymentMethod ?? null,
          paymentId: paymentId ?? null,
        })
        .returning()
      if (!rows[0]) {
        return reply.status(500).send(error(500, '创建购买记录失败'))
      }
      return reply.status(201).send(success(rows[0]))
    } catch (e) {
      return reply.status(500).send(error(500, `创建失败: ${(e as Error).message}`))
    }
  })

  // -------------------------------------------------------------------------
  // 2. GET /list - 列表（9 个 query 过滤）
  // -------------------------------------------------------------------------
  server.get('/list', async (request, reply) => {
    const parsed = listQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const q = parsed.data
    const page = toInt(q.page) ?? 1
    const pageSize = toInt(q.pageSize) ?? 20
    const conds: SQL[] = []
    if (q.agentId) conds.push(eq(zhsAgentBuy.agentId, q.agentId))
    if (q.userId) conds.push(eq(zhsAgentBuy.userId, q.userId))
    if (q.status) conds.push(eq(zhsAgentBuy.status, q.status))
    if (q.paymentMethod) conds.push(eq(zhsAgentBuy.paymentMethod, q.paymentMethod))
    if (q.paymentId) conds.push(eq(zhsAgentBuy.paymentId, q.paymentId))
    if (q.startDate) {
      const d = new Date(q.startDate)
      if (!Number.isNaN(d.getTime())) conds.push(gte(zhsAgentBuy.createdAt, d))
    }
    if (q.endDate) {
      const d = new Date(q.endDate)
      if (!Number.isNaN(d.getTime())) conds.push(lte(zhsAgentBuy.createdAt, d))
    }
    const where = conds.length ? and(...conds) : undefined
    try {
      const [list, totalRows] = await Promise.all([
        dbRead
          .select()
          .from(zhsAgentBuy)
          .where(where)
          .orderBy(desc(zhsAgentBuy.createdAt))
          .limit(pageSize)
          .offset((page - 1) * pageSize),
        dbRead
          .select({ count: sql<number>`count(*)::int` })
          .from(zhsAgentBuy)
          .where(where),
      ])
      return reply.send(
        success({
          list,
          total: totalRows[0]?.count ?? 0,
          page,
          pageSize,
        }),
      )
    } catch (e) {
      return reply.status(500).send(error(500, `查询失败: ${(e as Error).message}`))
    }
  })

  // -------------------------------------------------------------------------
  // 3. GET /:recordId - 详情
  // -------------------------------------------------------------------------
  server.get('/:recordId', async (request, reply) => {
    const { recordId } = recordIdParamSchema.parse(request.params)
    try {
      const rows = await dbRead
        .select()
        .from(zhsAgentBuy)
        .where(eq(zhsAgentBuy.id, recordId))
        .limit(1)
      if (!rows[0]) {
        return reply.status(404).send(error(404, '购买记录不存在'))
      }
      return reply.send(success(rows[0]))
    } catch (e) {
      return reply.status(500).send(error(500, `查询失败: ${(e as Error).message}`))
    }
  })

  // -------------------------------------------------------------------------
  // 4. PUT /:recordId - 更新
  // -------------------------------------------------------------------------
  server.put('/:recordId', async (request, reply) => {
    const { recordId } = recordIdParamSchema.parse(request.params)
    const parsed = updateSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const updateData: Record<string, unknown> = { updatedAt: new Date() }
    const data = parsed.data
    if (data.price !== undefined) updateData.price = data.price
    if (data.duration !== undefined) updateData.duration = data.duration
    if (data.status !== undefined) updateData.status = data.status
    if (data.paymentMethod !== undefined) updateData.paymentMethod = data.paymentMethod
    if (data.paymentId !== undefined) updateData.paymentId = data.paymentId
    if (data.expiresAt !== undefined) {
      updateData.expiresAt = new Date(data.expiresAt)
    }
    try {
      const rows = await db
        .update(zhsAgentBuy)
        .set(updateData)
        .where(eq(zhsAgentBuy.id, recordId))
        .returning()
      if (!rows[0]) {
        return reply.status(404).send(error(404, '购买记录不存在'))
      }
      return reply.send(success(rows[0]))
    } catch (e) {
      return reply.status(500).send(error(500, `更新失败: ${(e as Error).message}`))
    }
  })

  // -------------------------------------------------------------------------
  // 5. DELETE /:recordId - 删除
  // -------------------------------------------------------------------------
  server.delete('/:recordId', async (request, reply) => {
    const { recordId } = recordIdParamSchema.parse(request.params)
    try {
      const rows = await db
        .delete(zhsAgentBuy)
        .where(eq(zhsAgentBuy.id, recordId))
        .returning({ id: zhsAgentBuy.id })
      if (!rows[0]) {
        return reply.status(404).send(error(404, '购买记录不存在'))
      }
      return reply.send(success({ id: recordId, deleted: true }))
    } catch (e) {
      return reply.status(500).send(error(500, `删除失败: ${(e as Error).message}`))
    }
  })

  // -------------------------------------------------------------------------
  // 6. GET /stats/summary - 统计聚合（7 个聚合指标）
  // -------------------------------------------------------------------------
  server.get('/stats/summary', async (request, reply) => {
    const parsed = statsQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const q = parsed.data
    const conds: SQL[] = []
    if (q.agentId) conds.push(eq(zhsAgentBuy.agentId, q.agentId))
    if (q.startDate) {
      const d = new Date(q.startDate)
      if (!Number.isNaN(d.getTime())) conds.push(gte(zhsAgentBuy.createdAt, d))
    }
    if (q.endDate) {
      const d = new Date(q.endDate)
      if (!Number.isNaN(d.getTime())) conds.push(lte(zhsAgentBuy.createdAt, d))
    }
    const where = conds.length ? and(...conds) : undefined
    try {
      const aggregateRows = await dbRead
        .select({
          totalRecords: sql<number>`count(*)::int`,
          totalAmount: sql<string>`coalesce(sum(${zhsAgentBuy.price}), 0)`,
          totalDuration: sql<number>`coalesce(sum(${zhsAgentBuy.duration}), 0)::int`,
          avgAmount: sql<string>`coalesce(avg(${zhsAgentBuy.price}), 0)`,
          uniqueBuyers: sql<number>`count(distinct ${zhsAgentBuy.userId})::int`,
          uniqueAgents: sql<number>`count(distinct ${zhsAgentBuy.agentId})::int`,
        })
        .from(zhsAgentBuy)
        .where(where)
      const aggregate = aggregateRows[0] ?? {
        totalRecords: 0,
        totalAmount: '0',
        totalDuration: 0,
        avgAmount: '0',
        uniqueBuyers: 0,
        uniqueAgents: 0,
      }
      const statusRows = await dbRead
        .select({
          status: zhsAgentBuy.status,
          count: sql<number>`count(*)::int`,
        })
        .from(zhsAgentBuy)
        .where(where)
        .groupBy(zhsAgentBuy.status)
      const statusDistribution: Record<string, { count: number; percentage: number }> = {}
      const total = aggregate.totalRecords
      for (const row of statusRows) {
        const code = row.status ?? 'unknown'
        statusDistribution[code] = {
          count: row.count,
          percentage: total > 0 ? Math.round((row.count / total) * 10000) / 100 : 0,
        }
      }
      return reply.send(
        success({
          totalRecords: total,
          totalAmount: Number(aggregate.totalAmount),
          totalDuration: aggregate.totalDuration,
          uniqueBuyers: aggregate.uniqueBuyers,
          uniqueAgents: aggregate.uniqueAgents,
          averageAmount: total > 0 ? Number(aggregate.totalAmount) / total : 0,
          averageDuration: total > 0 ? aggregate.totalDuration / total : 0,
          statusDistribution,
        }),
      )
    } catch (e) {
      return reply.status(500).send(error(500, `统计查询失败: ${(e as Error).message}`))
    }
  })

  // -------------------------------------------------------------------------
  // 7. GET /order/generate - 生成订单号
  // 格式：WXAT + YYYYMMDD + 7位序号（19 位字符）
  // -------------------------------------------------------------------------
  server.get('/order/generate', async (_request, reply) => {
    try {
      const orderNo = generateOrderNumber()
      return reply.send(
        success({
          orderNo,
          format: 'WXAT + YYYYMMDD + 7位序号',
          example: 'WXAT202508110000001',
          generatedAt: new Date().toISOString(),
        }),
      )
    } catch (e) {
      return reply.status(500).send(error(500, `生成订单号失败: ${(e as Error).message}`))
    }
  })

  // -------------------------------------------------------------------------
  // 8. POST /order/validate - 验证订单号（验证 + 解析）
  // -------------------------------------------------------------------------
  server.post('/order/validate', async (request, reply) => {
    const parsed = validateOrderBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { orderNo } = parsed.data
    try {
      const isValid = validateOrderNumber(orderNo)
      const result: Record<string, unknown> = {
        orderNo,
        isValid,
        validatedAt: new Date().toISOString(),
      }
      if (isValid) {
        result.parsed = parseOrderNumber(orderNo)
      }
      return reply.send(success(result))
    } catch (e) {
      return reply.status(500).send(error(500, `验证订单号失败: ${(e as Error).message}`))
    }
  })

  // -------------------------------------------------------------------------
  // 9. POST /:recordId/recalculate-expiration - 重新计算过期
  // 公式：now() + duration * 24 * 60 * 60 * 1000
  // -------------------------------------------------------------------------
  server.post('/:recordId/recalculate-expiration', async (request, reply) => {
    const { recordId } = recordIdParamSchema.parse(request.params)
    try {
      const existing = await dbRead
        .select({ id: zhsAgentBuy.id, duration: zhsAgentBuy.duration })
        .from(zhsAgentBuy)
        .where(eq(zhsAgentBuy.id, recordId))
        .limit(1)
      if (!existing[0]) {
        return reply.status(404).send(error(404, '购买记录不存在'))
      }
      const newExpiresAt = new Date(Date.now() + existing[0].duration * 24 * 60 * 60 * 1000)
      const rows = await db
        .update(zhsAgentBuy)
        .set({ expiresAt: newExpiresAt, updatedAt: new Date() })
        .where(eq(zhsAgentBuy.id, recordId))
        .returning()
      if (!rows[0]) {
        return reply.status(500).send(error(500, '过期时间重新计算失败'))
      }
      return reply.send(
        success({
          id: rows[0].id,
          duration: rows[0].duration,
          expiresAt: rows[0].expiresAt,
          recalculatedAt: new Date().toISOString(),
        }),
      )
    } catch (e) {
      return reply.status(500).send(error(500, `重新计算失败: ${(e as Error).message}`))
    }
  })
}

export default agentBuyRoutes
