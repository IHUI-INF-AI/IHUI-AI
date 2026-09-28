// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
import { isUuidString } from '../../utils/uuid.js'

const updateOrderSchema = z.strictObject({
  status: z.enum(['pending', 'paid', 'cancelled', 'refunded']).optional(),
  payType: z.string().max(50).optional(),
  remark: z.string().max(500).optional(),
  targetTitle: z.string().max(200).optional(),
})

export const orderRoutes: FastifyPluginAsync = async (server) => {
  server.put('/admin/orders/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = parseOrThrow(idParamSchema, request.params)
    if (!isUuidString(id)) return reply.status(400).send(error(400, 'id 格式不正确'))
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
    // 形状闸(2026-09-28 普查收口):下面这些 :id 最终会被喂进 uuid 列,非 uuid 字面量让 Postgres
    // 抛 22P02 invalid input syntax for type uuid,而未被兜住就是 500 —— 于是"这条不存在"与
    // "服务坏了"在响应上完全同形。判据只有一份(utils/uuid.ts 的 isUuidString),闸必须在进 SQL 之前。
    if (!isUuidString(id)) return reply.status(400).send(error(400, 'id 格式不正确'))
    const [row] = await db.delete(eduOrders).where(eq(eduOrders.id, id)).returning()
    if (!row) return reply.status(404).send(error(404, '订单不存在'))
    // Phase 3: 同步删除统一 orders 表
    await db.delete(orders).where(eq(orders.id, id))
    return reply.send(success({ id, deleted: Boolean(row) }))
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
      await db.update(orders).set({ remark: shipRemark, updatedAt: now }).where(eq(orders.id, id))
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
