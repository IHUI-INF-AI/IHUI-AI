/**
 * 订单/发货/提现管理路由(从原 frontend-stub-admin-routes.ts 拆分)。
 * 路径前缀:/admin/orders, /admin/shop
 */
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { eduOrders, withdrawalFlows } from '@ihui/database'
import { requireAdmin } from '../../plugins/require-permission.js'
import { success, error, parseOrThrow } from '../../utils/response.js'
import { idParamSchema } from './_shared.js'

const updateOrderSchema = z
  .object({
    status: z.enum(['pending', 'paid', 'cancelled', 'refunded']).optional(),
    payType: z.string().max(50).optional(),
    remark: z.string().max(500).optional(),
    targetTitle: z.string().max(200).optional(),
  })
  .strict()

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
    return reply.send(success(row))
  })
  server.delete('/admin/orders/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = parseOrThrow(idParamSchema, request.params)
    const [row] = await db.delete(eduOrders).where(eq(eduOrders.id, id)).returning()
    if (!row) return reply.status(404).send(error(404, '订单不存在'))
    return reply.send(success({ id, deleted: true }))
  })
  server.post(
    '/admin/shop/payments/:id/ship',
    { preHandler: requireAdmin },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = parseOrThrow(idParamSchema, request.params)
      const [row] = await db
        .update(eduOrders)
        .set({ remark: `已发货 ${new Date().toISOString()}`, updatedAt: new Date() })
        .where(eq(eduOrders.id, id))
        .returning()
      if (!row) return reply.status(404).send(error(404, '订单不存在'))
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
