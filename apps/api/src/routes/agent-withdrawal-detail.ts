/**
 * 智能体提现明细表 API 路由
 *
 * D 盘源: coze_zhs_py/api/agent_withdrawal_detail.py
 * 路径前缀: /cozeZhsApi/agent-withdrawal-detail
 * G 盘 schema: zhsAgentWithdrawalDetail (packages/database/src/schema/agent-commerce.ts)
 *
 * 端点 (1:1 迁移 D 盘):
 *  POST   /cozeZhsApi/agent-withdrawal-detail/create        创建提现申请
 *  GET    /cozeZhsApi/agent-withdrawal-detail/list          分页查询提现明细
 *  GET    /cozeZhsApi/agent-withdrawal-detail/:id           提现明细详情
 *  PUT    /cozeZhsApi/agent-withdrawal-detail/:id           更新提现明细
 *  DELETE /cozeZhsApi/agent-withdrawal-detail/:id           删除提现明细
 *  POST   /cozeZhsApi/agent-withdrawal-detail/:id/review    审核提现申请
 *  POST   /cozeZhsApi/agent-withdrawal-detail/:id/process   处理提现申请
 *  GET    /cozeZhsApi/agent-withdrawal-detail/stats/overview 提现统计概览
 *  POST   /cozeZhsApi/agent-withdrawal-detail/batch-delete  批量删除
 */
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { eq, and, desc, asc, gte, lte, sql, inArray } from 'drizzle-orm'
import { db, dbRead } from '../db/index.js'
import { zhsAgentWithdrawalDetail, users } from '@ihui/database'
import { success, error } from '../utils/response.js'
import { authenticate } from '../plugins/auth.js'

const PREFIX = '/cozeZhsApi/agent-withdrawal-detail'

// ==================== Zod schemas ====================

const createWithdrawalSchema = z.object({
  user_id: z.string().uuid('用户 ID 必须是 UUID'),
  amount: z.number().min(0.01, '提现金额必须 > 0'),
  type: z.number().int().min(1).max(3),
  open_id: z.string().max(128).optional(),
  order_ids: z.string().max(2000).optional(),
})

const updateWithdrawalSchema = z.object({
  type: z.number().int().min(1).max(3).optional(),
  out_bill_no: z.string().max(255).optional(),
  bank_info: z.string().max(2000).optional(),
})

const reviewSchema = z.object({
  status: z.string().refine((v) => ['0', '1', '5'].includes(v), '状态必须是 0/1/5'),
  review_user: z.string().max(128).optional(),
  review_remark: z.string().max(1000).optional(),
})

const processSchema = z.object({
  status: z.string().refine((v) => ['2', '3', '4'].includes(v), '状态必须是 2/3/4'),
  process_user: z.string().max(128).optional(),
  process_remark: z.string().max(1000).optional(),
  transaction_id: z.string().max(128).optional(),
  failure_reason: z.string().max(1000).optional(),
})

const listQuerySchema = z.object({
  user_id: z.string().min(1, 'user_id 必填'),
  type: z.string().refine((v) => ['1', '2', '3', '4'].includes(v), 'type 必须是 1/2/3/4'),
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(10),
  withdrawal_no: z.string().optional(),
  withdrawal_type: z.string().optional(),
  status: z.string().optional(),
  min_amount: z.coerce.number().optional(),
  max_amount: z.coerce.number().optional(),
  sort_by: z.string().default('initiateAt'),
  sort_order: z.enum(['asc', 'desc']).default('desc'),
})

const statsQuerySchema = z.object({
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  user_id: z.string().optional(),
})

const batchDeleteSchema = z.object({
  withdrawal_ids: z.array(z.string().uuid()).min(1).max(100),
})

// ==================== Helpers ====================

function getTimeRangeStart(type: string): Date | null {
  const now = new Date()
  if (type === '1') return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  if (type === '2') return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  if (type === '3') return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
  return null // type === '4' 全部
}

function toIsoOrNull(v: Date | string | null | undefined): string | null {
  if (!v) return null
  const d = v instanceof Date ? v : new Date(v)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

// ==================== Routes ====================

export const agentWithdrawalDetailRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await authenticate(request)
    } catch (e) {
      const sc = (e as Error & { statusCode?: number }).statusCode ?? 401
      return reply.status(sc).send(error(sc, (e as Error).message || 'Authentication required'))
    }
  })

  // 1. POST /cozeZhsApi/agent-withdrawal-detail/create
  server.post(`${PREFIX}/create`, async (request, reply) => {
    try {
      const parsed = createWithdrawalSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { user_id, amount, type, order_ids } = parsed.data

      // 验证 user 存在
      const [u] = await dbRead
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, user_id))
        .limit(1)
      if (!u) return reply.status(400).send(error(400, '用户不存在'))

      // amount 在 G 盘 schema 中为 numeric(10,2) 元; D 盘存分,这里直接存元(对齐 schema)
      const [created] = await db
        .insert(zhsAgentWithdrawalDetail)
        .values({
          userId: user_id,
          amount: String(amount),
          type,
          outBillNo: null,
          orderIds: order_ids ?? null,
          status: 'pending',
          initiateAt: new Date(),
        })
        .returning()
      if (!created) return reply.status(500).send(error(500, '创建提现记录失败'))

      return reply.send(
        success({
          id: created.id,
          user_id: created.userId,
          amount: created.amount,
          status: created.status,
        }),
      )
    } catch (e) {
      return reply.status(500).send(error(500, (e as Error).message))
    }
  })

  // 2. GET /cozeZhsApi/agent-withdrawal-detail/list
  server.get(`${PREFIX}/list`, async (request, reply) => {
    try {
      const parsed = listQuerySchema.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const q = parsed.data
      const conds: ReturnType<typeof eq>[] = [eq(zhsAgentWithdrawalDetail.userId, q.user_id)]

      const startTime = getTimeRangeStart(q.type)
      if (startTime) conds.push(gte(zhsAgentWithdrawalDetail.initiateAt, startTime))

      if (q.withdrawal_no) conds.push(eq(zhsAgentWithdrawalDetail.outBillNo, q.withdrawal_no))
      if (q.withdrawal_type)
        conds.push(eq(zhsAgentWithdrawalDetail.type, Number(q.withdrawal_type)))
      if (q.status) conds.push(eq(zhsAgentWithdrawalDetail.status, q.status))
      if (q.min_amount !== undefined)
        conds.push(gte(zhsAgentWithdrawalDetail.amount, String(q.min_amount)))
      if (q.max_amount !== undefined)
        conds.push(lte(zhsAgentWithdrawalDetail.amount, String(q.max_amount)))

      const where = and(...conds)
      const orderCol = (zhsAgentWithdrawalDetail as unknown as Record<string, unknown>)[
        q.sort_by
      ] as Parameters<typeof asc>[0] | undefined
      const orderFn = q.sort_order === 'asc' ? asc : desc
      const orderBy = orderCol ? orderFn(orderCol) : desc(zhsAgentWithdrawalDetail.initiateAt)

      const countRows = (await dbRead
        .select({ count: sql<number>`count(*)::int` })
        .from(zhsAgentWithdrawalDetail)
        .where(where)) as Array<{ count: number }>
      const count = countRows[0]?.count ?? 0

      const rows = await dbRead
        .select()
        .from(zhsAgentWithdrawalDetail)
        .where(where)
        .orderBy(orderBy)
        .limit(q.page_size)
        .offset((q.page - 1) * q.page_size)

      return reply.send(
        success({
          list: rows.map((r) => ({
            id: r.id,
            user_id: r.userId,
            amount: r.amount,
            type: r.type,
            status: r.status,
            out_bill_no: r.outBillNo,
            order_ids: r.orderIds,
            initiate_at: toIsoOrNull(r.initiateAt),
            created_at: toIsoOrNull(r.createdAt),
          })),
          total: Number(count),
          page: q.page,
          page_size: q.page_size,
          total_pages: Math.ceil(Number(count) / q.page_size),
          user_id: q.user_id,
          time_range_type: q.type,
        }),
      )
    } catch (e) {
      return reply.status(500).send(error(500, (e as Error).message))
    }
  })

  // 3. GET /cozeZhsApi/agent-withdrawal-detail/:id
  server.get(`${PREFIX}/:id`, async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const [row] = await dbRead
        .select()
        .from(zhsAgentWithdrawalDetail)
        .where(eq(zhsAgentWithdrawalDetail.id, id))
        .limit(1)
      if (!row) return reply.status(404).send(error(404, '提现记录不存在'))
      return reply.send(success(row))
    } catch (e) {
      return reply.status(500).send(error(500, (e as Error).message))
    }
  })

  // 4. PUT /cozeZhsApi/agent-withdrawal-detail/:id
  server.put(`${PREFIX}/:id`, async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const parsed = updateWithdrawalSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const updateData: Record<string, unknown> = { updatedAt: new Date() }
      if (parsed.data.type !== undefined) updateData.type = parsed.data.type
      if (parsed.data.out_bill_no !== undefined) updateData.outBillNo = parsed.data.out_bill_no
      if (parsed.data.bank_info !== undefined) updateData.bankInfo = parsed.data.bank_info

      const [updated] = await db
        .update(zhsAgentWithdrawalDetail)
        .set(updateData)
        .where(eq(zhsAgentWithdrawalDetail.id, id))
        .returning()
      if (!updated) return reply.status(404).send(error(404, '提现记录不存在'))
      return reply.send(success(updated))
    } catch (e) {
      return reply.status(500).send(error(500, (e as Error).message))
    }
  })

  // 5. DELETE /cozeZhsApi/agent-withdrawal-detail/:id
  server.delete(`${PREFIX}/:id`, async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const [existing] = await dbRead
        .select()
        .from(zhsAgentWithdrawalDetail)
        .where(eq(zhsAgentWithdrawalDetail.id, id))
        .limit(1)
      if (!existing) return reply.status(404).send(error(404, '提现记录不存在'))
      // 只有 pending 状态才允许删除
      if (existing.status !== 'pending') {
        return reply.status(400).send(error(400, '只有待审核状态的提现申请才能删除'))
      }
      await db.delete(zhsAgentWithdrawalDetail).where(eq(zhsAgentWithdrawalDetail.id, id))
      return reply.send(success({ id, message: '提现明细删除成功' }))
    } catch (e) {
      return reply.status(500).send(error(500, (e as Error).message))
    }
  })

  // 6. POST /cozeZhsApi/agent-withdrawal-detail/:id/review
  server.post(`${PREFIX}/:id/review`, async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const parsed = reviewSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const [existing] = await dbRead
        .select()
        .from(zhsAgentWithdrawalDetail)
        .where(eq(zhsAgentWithdrawalDetail.id, id))
        .limit(1)
      if (!existing) return reply.status(404).send(error(404, '提现记录不存在'))
      if (existing.status !== 'pending') {
        return reply.status(400).send(error(400, '只有待审核状态的申请才能进行审核'))
      }
      const statusMap: Record<string, string> = { '0': 'pending', '1': 'approved', '5': 'rejected' }
      const newStatus = statusMap[parsed.data.status] ?? 'pending'
      const [updated] = await db
        .update(zhsAgentWithdrawalDetail)
        .set({
          status: newStatus,
          reviewer: parsed.data.review_user ?? null,
          reviewedAt: new Date(),
          rejectReason: parsed.data.status === '5' ? (parsed.data.review_remark ?? null) : null,
          updatedAt: new Date(),
        })
        .where(eq(zhsAgentWithdrawalDetail.id, id))
        .returning()
      if (!updated) return reply.status(500).send(error(500, '审核提现申请失败'))
      return reply.send(
        success({
          id,
          status: updated.status,
          review_result: parsed.data.status === '1' ? '审核通过' : '已拒绝',
        }),
      )
    } catch (e) {
      return reply.status(500).send(error(500, (e as Error).message))
    }
  })

  // 7. POST /cozeZhsApi/agent-withdrawal-detail/:id/process
  server.post(`${PREFIX}/:id/process`, async (request, reply) => {
    try {
      const { id } = request.params as { id: string }
      const parsed = processSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const [existing] = await dbRead
        .select()
        .from(zhsAgentWithdrawalDetail)
        .where(eq(zhsAgentWithdrawalDetail.id, id))
        .limit(1)
      if (!existing) return reply.status(404).send(error(404, '提现记录不存在'))
      if (!['approved', 'processing'].includes(existing.status)) {
        return reply.status(400).send(error(400, '只有审核通过或提现中状态的申请才能进行处理'))
      }
      const statusMap: Record<string, string> = {
        '2': 'processing',
        '3': 'completed',
        '4': 'failed',
      }
      const newStatus = statusMap[parsed.data.status] ?? existing.status
      const setData: Record<string, unknown> = {
        status: newStatus,
        updatedAt: new Date(),
        processedAt: new Date(),
      }
      if (parsed.data.status === '3') {
        setData.bankInfo = parsed.data.transaction_id ?? null
      } else if (parsed.data.status === '4') {
        setData.rejectReason = parsed.data.failure_reason ?? null
      }
      const [updated] = await db
        .update(zhsAgentWithdrawalDetail)
        .set(setData)
        .where(eq(zhsAgentWithdrawalDetail.id, id))
        .returning()
      if (!updated) return reply.status(500).send(error(500, '处理提现申请失败'))
      const textMap: Record<string, string> = { '2': '提现中', '3': '提现成功', '4': '提现失败' }
      return reply.send(
        success({
          id,
          status: updated.status,
          process_result: textMap[parsed.data.status] ?? '未知状态',
        }),
      )
    } catch (e) {
      return reply.status(500).send(error(500, (e as Error).message))
    }
  })

  // 8. GET /cozeZhsApi/agent-withdrawal-detail/stats/overview
  server.get(`${PREFIX}/stats/overview`, async (request, reply) => {
    try {
      const parsed = statsQuerySchema.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const conds: ReturnType<typeof eq>[] = []
      if (parsed.data.user_id) conds.push(eq(zhsAgentWithdrawalDetail.userId, parsed.data.user_id))
      if (parsed.data.start_date) {
        const d = new Date(parsed.data.start_date)
        if (Number.isNaN(d.getTime())) return reply.status(400).send(error(400, '开始时间格式错误'))
        conds.push(gte(zhsAgentWithdrawalDetail.initiateAt, d))
      }
      if (parsed.data.end_date) {
        const d = new Date(`${parsed.data.end_date} 23:59:59`)
        if (Number.isNaN(d.getTime())) return reply.status(400).send(error(400, '结束时间格式错误'))
        conds.push(lte(zhsAgentWithdrawalDetail.initiateAt, d))
      }
      const where = conds.length > 0 ? and(...conds) : undefined

      const totalRows = (await dbRead
        .select({ total: sql<number>`count(*)::int` })
        .from(zhsAgentWithdrawalDetail)
        .where(where)) as Array<{ total: number }>
      const total = totalRows[0]?.total ?? 0

      const [sum] = (await dbRead
        .select({
          total_amount: sql<string>`coalesce(sum(${zhsAgentWithdrawalDetail.amount}), 0)::text`,
        })
        .from(zhsAgentWithdrawalDetail)
        .where(where)) as Array<{ total_amount: string }>

      return reply.send(
        success({
          total_count: Number(total),
          total_amount: sum?.total_amount ?? '0',
          currency: 'CNY',
          filter: parsed.data,
        }),
      )
    } catch (e) {
      return reply.status(500).send(error(500, (e as Error).message))
    }
  })

  // 9. POST /cozeZhsApi/agent-withdrawal-detail/batch-delete
  server.post(`${PREFIX}/batch-delete`, async (request, reply) => {
    try {
      const parsed = batchDeleteSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const existing = await dbRead
        .select()
        .from(zhsAgentWithdrawalDetail)
        .where(inArray(zhsAgentWithdrawalDetail.id, parsed.data.withdrawal_ids))
      if (existing.length === 0) {
        return reply.status(404).send(error(404, '没有找到要删除的记录'))
      }
      const invalid = existing.filter((r) => r.status !== 'pending')
      if (invalid.length > 0) {
        return reply
          .status(400)
          .send(
            error(400, `以下记录不是待审核状态,无法删除: ${invalid.map((r) => r.id).join(', ')}`),
          )
      }
      await db
        .delete(zhsAgentWithdrawalDetail)
        .where(inArray(zhsAgentWithdrawalDetail.id, parsed.data.withdrawal_ids))
      return reply.send(
        success({
          deleted_count: existing.length,
          message: `批量删除成功,共删除 ${existing.length} 条记录`,
        }),
      )
    } catch (e) {
      return reply.status(500).send(error(500, (e as Error).message))
    }
  })
}

export default agentWithdrawalDetailRoutes
