import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, and, desc, sql, ilike, gte, inArray } from 'drizzle-orm'
import { requireAdmin } from '../plugins/require-permission.js'
import { success, error, emptyToUndefined } from '../utils/response.js'
import { db } from '../db/index.js'
import { eduRefunds, eduOrders, refundAuditRecords, type EduRefund } from '@ihui/database'
import { findRefundById, findRefunds, processRefund } from '../db/order-queries.js'
import { logAction } from '../services/audit-service.js'

// =============================================================================
// Zod schemas
// =============================================================================

const idParamSchema = z.object({ id: z.string().uuid('无效的 ID') })

const paginationQuery = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
}

const listRefundsQuery = z.object({
  ...paginationQuery,
  status: z.preprocess(emptyToUndefined, z.string().max(16).optional()),
  userId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
  orderId: z.preprocess(emptyToUndefined, z.string().uuid().optional()),
  orderNo: z.preprocess(emptyToUndefined, z.string().max(64).optional()),
})

const auditBodySchema = z.object({
  action: z.enum(['approve', 'reject']),
  reason: z.string().max(500).nullable().optional(),
})

const rejectBodySchema = z.object({
  reason: z.string().max(500).nullable().optional(),
})

const batchAuditSchema = z.object({
  ids: z.array(z.string().uuid()).min(1, '至少选择 1 条').max(100, '单次最多 100 条'),
  action: z.enum(['approve', 'reject']),
  reason: z.string().max(500).nullable().optional(),
})

// =============================================================================
// 审核记录写入
// =============================================================================

async function createAuditRecord(
  refund: EduRefund,
  auditorId: string,
  action: 'approve' | 'reject',
  reason?: string | null,
): Promise<void> {
  await db.insert(refundAuditRecords).values({
    orderId: refund.orderId,
    refundId: refund.id,
    auditorId,
    action,
    reason: reason ?? null,
  })
}

// =============================================================================
// 路由：退款审核管理（前缀 /api，全部需 admin）
// =============================================================================

export const refundAuditRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)

  // GET /refunds - 退款列表（分页/筛选/状态过滤）
  server.get(
    '/refunds',
    {
      schema: {
        summary: '退款列表(审核管理)',
        tags: ['refund-audit'],
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'integer', minimum: 1, default: 1 },
            pageSize: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
            status: { type: 'string' },
            userId: { type: 'string' },
            orderId: { type: 'string' },
            orderNo: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const parsed = listRefundsQuery.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { page, pageSize, status, userId, orderId, orderNo } = parsed.data

      // orderNo 模糊搜索需要 join orders，无 orderNo 时走索引查询
      if (orderNo) {
        const conds = []
        if (status) conds.push(eq(eduRefunds.status, status))
        if (userId) conds.push(eq(eduRefunds.userId, userId))
        if (orderId) conds.push(eq(eduRefunds.orderId, orderId))
        conds.push(ilike(eduRefunds.orderNo, `%${orderNo}%`))

        const list = await db
          .select()
          .from(eduRefunds)
          .where(conds.length ? and(...conds) : undefined)
          .orderBy(desc(eduRefunds.id))
          .limit(pageSize)
          .offset((page - 1) * pageSize)

        const countRows = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(eduRefunds)
          .where(conds.length ? and(...conds) : undefined)
        const total = countRows[0]?.count ?? 0
        return reply.send(success({ list, total, page, pageSize }))
      }

      const result = await findRefunds({ page, pageSize, status, userId, orderId })
      return reply.send(success(result))
    },
  )

  // POST /refunds/:id/audit - 审核通过/拒绝
  server.post(
    '/refunds/:id/audit',
    {
      schema: {
        summary: '审核退款(通过/拒绝)',
        tags: ['refund-audit'],
        body: { type: 'object', additionalProperties: true },
      },
    },
    async (request, reply) => {
      const parsed = idParamSchema.safeParse(request.params)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const body = auditBodySchema.safeParse(request.body)
      if (!body.success) {
        return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
      }

      const existing = await findRefundById(parsed.data.id)
      if (!existing) return reply.status(404).send(error(404, '退款记录不存在'))
      if (!['pending', 'approved', 'rejected'].includes(existing.status)) {
        return reply.status(400).send(error(400, '当前退款状态不允许审核'))
      }

      const newStatus = body.data.action === 'approve' ? 'approved' : 'rejected'
      const refund = await processRefund(parsed.data.id, newStatus, body.data.reason)
      if (!refund) return reply.status(500).send(error(500, '审核失败'))

      await createAuditRecord(refund, request.userId!, body.data.action, body.data.reason)
      return reply.send(success({ refund }))
    },
  )

  // POST /refunds/:id/reject - 驳回
  server.post(
    '/refunds/:id/reject',
    {
      schema: {
        summary: '驳回退款',
        tags: ['refund-audit'],
        body: { type: 'object', additionalProperties: true },
      },
    },
    async (request, reply) => {
      const parsed = idParamSchema.safeParse(request.params)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const body = rejectBodySchema.safeParse(request.body)
      if (!body.success) {
        return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
      }

      const existing = await findRefundById(parsed.data.id)
      if (!existing) return reply.status(404).send(error(404, '退款记录不存在'))
      if (!['pending', 'approved'].includes(existing.status)) {
        return reply.status(400).send(error(400, '当前退款状态不允许驳回'))
      }

      const refund = await processRefund(parsed.data.id, 'rejected', body.data.reason)
      if (!refund) return reply.status(500).send(error(500, '驳回失败'))

      await createAuditRecord(refund, request.userId!, 'reject', body.data.reason)
      return reply.send(success({ refund }))
    },
  )
}

// =============================================================================
// 路由：退款审核管理 - admin 命名空间（前缀 /api/admin）
// =============================================================================

export const adminRefundAuditRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)

  // GET /refunds/:id - 退款详情（含审核记录与订单信息）
  server.get(
    '/refunds/:id',
    { schema: { summary: '退款详情(含审核记录)', tags: ['refund-audit'] } },
    async (request, reply) => {
      const parsed = idParamSchema.safeParse(request.params)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }

      const refund = await findRefundById(parsed.data.id)
      if (!refund) return reply.status(404).send(error(404, '退款记录不存在'))

      const orderRows = await db
        .select()
        .from(eduOrders)
        .where(eq(eduOrders.id, refund.orderId))
        .limit(1)

      const auditRecords = await db
        .select()
        .from(refundAuditRecords)
        .where(eq(refundAuditRecords.refundId, parsed.data.id))
        .orderBy(desc(refundAuditRecords.createdAt))

      return reply.send(
        success({
          refund,
          order: orderRows[0] ?? null,
          auditRecords,
        }),
      )
    },
  )

  // GET /refunds/stats - 退款统计(含日/月趋势)
  server.get(
    '/refunds/stats',
    { schema: { summary: '退款统计(含日/月趋势)', tags: ['refund-audit'] } },
    async (_request, reply) => {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400_000)
      const sixMonthsAgo = new Date()
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

      const [statusCounts, dailyRows, monthlyRows] = await Promise.all([
        db
          .select({
            status: eduRefunds.status,
            count: sql<number>`count(*)::int`,
            totalAmount: sql<string>`coalesce(sum(${eduRefunds.refundAmount}), 0)`,
          })
          .from(eduRefunds)
          .groupBy(eduRefunds.status),
        db
          .select({
            date: sql<string>`to_char(${eduRefunds.createdAt}, 'YYYY-MM-DD')`,
            count: sql<number>`count(*)::int`,
            totalAmount: sql<string>`coalesce(sum(${eduRefunds.refundAmount}), 0)`,
          })
          .from(eduRefunds)
          .where(gte(eduRefunds.createdAt, thirtyDaysAgo))
          .groupBy(sql`to_char(${eduRefunds.createdAt}, 'YYYY-MM-DD')`)
          .orderBy(sql`to_char(${eduRefunds.createdAt}, 'YYYY-MM-DD')`),
        db
          .select({
            month: sql<string>`to_char(${eduRefunds.createdAt}, 'YYYY-MM')`,
            count: sql<number>`count(*)::int`,
            totalAmount: sql<string>`coalesce(sum(${eduRefunds.refundAmount}), 0)`,
          })
          .from(eduRefunds)
          .where(gte(eduRefunds.createdAt, sixMonthsAgo))
          .groupBy(sql`to_char(${eduRefunds.createdAt}, 'YYYY-MM')`)
          .orderBy(sql`to_char(${eduRefunds.createdAt}, 'YYYY-MM')`),
      ])

      const byStatus: Record<string, { count: number; totalAmount: string }> = {}
      let totalCount = 0
      let totalAmount = 0
      for (const row of statusCounts) {
        byStatus[row.status] = { count: row.count, totalAmount: row.totalAmount }
        totalCount += row.count
        totalAmount += Number(row.totalAmount)
      }

      return reply.send(
        success({
          byStatus,
          totalCount,
          totalAmount: totalAmount.toFixed(2),
          pendingCount: byStatus['pending']?.count ?? 0,
          approvedCount: byStatus['approved']?.count ?? 0,
          rejectedCount: byStatus['rejected']?.count ?? 0,
          completedCount: byStatus['completed']?.count ?? 0,
          daily: dailyRows,
          monthly: monthlyRows,
        }),
      )
    },
  )

  // POST /refunds/batch-audit — 批量审核(approve/reject,仅 pending 可审核)
  server.post(
    '/refunds/batch-audit',
    {
      schema: {
        summary: '批量审核退款',
        tags: ['refund-audit'],
        body: { type: 'object', additionalProperties: true },
      },
    },
    async (request, reply) => {
      const body = batchAuditSchema.safeParse(request.body)
      if (!body.success) {
        return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
      }
      const { ids, action, reason } = body.data
      const newStatus = action === 'approve' ? 'approved' : 'rejected'
      const fetched = await db
        .select({ id: eduRefunds.id, status: eduRefunds.status })
        .from(eduRefunds)
        .where(inArray(eduRefunds.id, ids))
      const foundMap = new Map(fetched.map((r) => [r.id, r]))
      const processed: string[] = []
      const skipped: Array<{ id: string; reason: string }> = []
      for (const id of ids) {
        const refund = foundMap.get(id)
        if (!refund) {
          skipped.push({ id, reason: '退款记录不存在' })
          continue
        }
        if (refund.status !== 'pending') {
          skipped.push({ id, reason: `状态 ${refund.status} 不可审核` })
          continue
        }
        const updated = await processRefund(id, newStatus, reason)
        if (!updated) {
          skipped.push({ id, reason: '审核失败' })
          continue
        }
        await createAuditRecord(updated, request.userId!, action, reason)
        processed.push(id)
      }
      await logAction({
        userId: request.userId,
        action: `refund.batch_${action}`,
        resourceType: 'refund',
        details: {
          requested: ids.length,
          processed: processed.length,
          skipped: skipped.length,
          reason,
        },
      })
      return reply.send(success({ processed: processed.length, skipped }))
    },
  )
}
