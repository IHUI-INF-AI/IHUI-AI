/**
 * 订单/发货/提现管理路由(从原 frontend-stub-admin-routes.ts 拆分)。
 * 路径前缀:/admin/orders, /admin/shop
 */
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { eduOrders, orders, withdrawalFlows } from '@ihui/database'
import { requireAdmin } from '../../plugins/require-permission.js'
import { success, error, parseOrThrow } from '../../utils/response.js'
import { idParamSchema } from './_shared.js'

const updateOrderSchema = z.strictObject({
  status: z.enum(['pending', 'paid', 'cancelled', 'refunded']).optional(),
  payType: z.string().max(50).optional(),
  remark: z.string().max(500).optional(),
  targetTitle: z.string().max(200).optional(),
})

export const orderRoutes: FastifyPluginAsync = async (server) => {
  server.put('/admin/orders/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = parseOrThrow(idParamSchema, request.params)
    const body = parseOrThrow(updateOrderSchema, request.body)
    const [row] = await db
      .update(eduOrders)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(eduOrders.id, id))
      .returning()
    if (!row) return reply.status(404).send(error(404, '订单不存在'))
    // Phase 3: 同步到统一 orders 表（payType → paymentMethod）
    const ordersSet: Record<string, unknown> = { updatedAt: new Date() }
    if (body.status !== undefined) ordersSet.status = body.status
    if (body.payType !== undefined) ordersSet.paymentMethod = body.payType
    if (body.remark !== undefined) ordersSet.remark = body.remark
    if (body.targetTitle !== undefined) ordersSet.targetTitle = body.targetTitle
    await db.update(orders).set(ordersSet).where(eq(orders.id, id))
    return reply.send(success(row))
  })
  server.delete('/admin/orders/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = parseOrThrow(idParamSchema, request.params)
    const [row] = await db.delete(eduOrders).where(eq(eduOrders.id, id)).returning()
    if (!row) return reply.status(404).send(error(404, '订单不存在'))
    // Phase 3: 同步删除统一 orders 表
    await db.delete(orders).where(eq(orders.id, id))
    return reply.send(success({ id, deleted: true }))
  })
  server.post(
    '/admin/shop/payments/:id/ship',
    { preHandler: requireAdmin },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = parseOrThrow(idParamSchema, request.params)
      const now = new Date()
      const shipRemark = `已发货 ${now.toISOString()}`
      const [row] = await db
        .update(eduOrders)
        .set({ remark: shipRemark, updatedAt: now })
        .where(eq(eduOrders.id, id))
        .returning()
      if (!row) return reply.status(404).send(error(404, '订单不存在'))
      // Phase 3: 同步发货备注到统一 orders 表
      await db
        .update(orders)
        .set({ remark: shipRemark, updatedAt: now })
        .where(eq(orders.id, id))
      return reply.send(success(row))
    },
  )
  server.post(
    '/admin/shop/withdrawals/:id/:action',
    { preHandler: requireAdmin },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id, action } = parseOrThrow(
        z.object({ id: z.string().min(1), action: z.enum(['approve', 'reject']) }),
        request.params,
      )
      const status = action === 'approve' ? 2 : 3
      const [row] = await db
        .update(withdrawalFlows)
        .set({ status, processedAt: new Date() })
        .where(eq(withdrawalFlows.id, id))
        .returning()
      if (!row) return reply.status(404).send(error(404, '提现记录不存在'))
      return reply.send(success(row))
    },
  )
}
