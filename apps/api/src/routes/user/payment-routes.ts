/**
 * 支付模块 /payment/*, /refunds/*, /top-up/*(10 个端点)。
 *
 * P0 越权 + 状态机修复(2026-08-02):
 * 原实现存在多处严重安全漏洞:
 * (1) 无 ownership 校验:任何已登录用户可查看/关闭他人订单、查看他人退款;
 * (2) /refund/:refundNo/audit 与 /refund/:refundNo/process 无 admin 权限校验,
 *     用户可自行审核/处理自己的退款(直接 approved + completed 完成退款,绕过财务审核);
 * (3) /refund/:refundNo/cancel 调 processRefund('rejected') 无状态校验,
 *     可把已 approved 的退款改成 rejected(撤销已审核通过的退款)。
 * 修复:全部端点加 ownership 校验 + admin 权限校验 + 退款状态校验(仅 pending 可被用户取消)。
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { success, error } from '../../utils/response.js'
import {
  findOrderByOrderNo,
  findPaymentByOrderId,
  findRefundById,
  cancelOrder,
  applyRefund,
  processRefund,
  handleRefund,
} from '../../db/order-queries.js'

const ADMIN_ROLE_ID = 1

const orderNoParam = z.object({ orderNo: z.string() })
const refundNoParam = z.object({ refundNo: z.string() })
const orderIdParam = z.object({ orderId: z.string() })

const paymentRoutes: FastifyPluginAsync = async (server) => {
  // POST /payment/order/:orderNo/close - 关闭订单(仅 pending 可关闭,仅本人或管理员)
  server.post('/payment/order/:orderNo/close', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request, reply) => {
    const orderNo = orderNoParam.parse(request.params).orderNo
    if (!orderNo) return reply.status(400).send(error(400, '参数错误'))
    const order = await findOrderByOrderNo(orderNo)
    if (!order) return reply.status(404).send(error(404, '订单不存在'))
    // P0 越权修复:仅订单归属人 OR 管理员可关闭订单
    const roleId = request.jwtPayload?.roleId ?? 0
    if (order.userId !== request.userId && roleId < ADMIN_ROLE_ID) {
      return reply.status(403).send(error(403, '无权操作他人订单'))
    }
    const updated = await cancelOrder(order.id)
    if (!updated) return reply.status(400).send(error(400, '订单状态不允许取消'))
    return reply.send(success({ success: !!updated, order: updated }))
  })

  server.post('/payment/order/:orderNo/sync', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request, reply) => {
    const orderNo = orderNoParam.parse(request.params).orderNo
    if (!orderNo) return reply.status(400).send(error(400, '参数错误'))
    const order = await findOrderByOrderNo(orderNo)
    if (!order) return reply.status(404).send(error(404, '订单不存在'))
    // P0 越权修复:仅订单归属人 OR 管理员可同步订单状态
    const roleId = request.jwtPayload?.roleId ?? 0
    if (order.userId !== request.userId && roleId < ADMIN_ROLE_ID) {
      return reply.status(403).send(error(403, '无权查询他人订单'))
    }
    return reply.send(success({ order }))
  })

  server.post('/payment/callback/verify', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request, reply) => {
    const body = (request.body as { orderNo?: string } | null) ?? {}
    if (!body.orderNo) return reply.status(400).send(error(400, '缺少 orderNo'))
    const order = await findOrderByOrderNo(body.orderNo)
    if (!order) return reply.status(404).send(error(404, '订单不存在'))
    // P0 越权修复:仅订单归属人 OR 管理员可校验回调
    const roleId = request.jwtPayload?.roleId ?? 0
    if (order.userId !== request.userId && roleId < ADMIN_ROLE_ID) {
      return reply.status(403).send(error(403, '无权查询他人订单'))
    }
    return reply.send(success({ success: true, order }))
  })

  server.get('/payment/orders/:orderNo', async (request, reply) => {
    const orderNo = orderNoParam.parse(request.params).orderNo
    if (!orderNo) return reply.status(400).send(error(400, '参数错误'))
    const order = await findOrderByOrderNo(orderNo)
    if (!order) return reply.status(404).send(error(404, '订单不存在'))
    // P0 越权修复:仅订单归属人 OR 管理员可查看订单
    const roleId = request.jwtPayload?.roleId ?? 0
    if (order.userId !== request.userId && roleId < ADMIN_ROLE_ID) {
      return reply.status(403).send(error(403, '无权查询他人订单'))
    }
    return reply.send(success({ order }))
  })

  server.get('/payment/refund/:refundNo', async (request, reply) => {
    const refundNo = refundNoParam.parse(request.params).refundNo
    if (!refundNo) return reply.status(400).send(error(400, '参数错误'))
    const refund = await findRefundById(refundNo)
    if (!refund) return reply.status(404).send(error(404, '退款记录不存在'))
    // P0 越权修复:仅退款归属人 OR 管理员可查看退款
    const roleId = request.jwtPayload?.roleId ?? 0
    if (refund.userId !== request.userId && roleId < ADMIN_ROLE_ID) {
      return reply.status(403).send(error(403, '无权查询他人退款'))
    }
    return reply.send(success({ refund }))
  })

  // POST /payment/refund/:refundNo/cancel - 用户撤销自己的退款申请(仅 pending 可撤销)
  server.post('/payment/refund/:refundNo/cancel', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request, reply) => {
    const refundNo = refundNoParam.parse(request.params).refundNo
    if (!refundNo) return reply.status(400).send(error(400, '参数错误'))
    const existing = await findRefundById(refundNo)
    if (!existing) return reply.status(404).send(error(404, '退款记录不存在'))
    // P0 越权修复:仅退款归属人可撤销自己的退款(管理员走 admin 路由)
    if (existing.userId !== request.userId) {
      return reply.status(403).send(error(403, '无权操作他人退款'))
    }
    // P0 状态机修复:仅 pending 状态可被用户撤销;已 approved/rejected/completed 不可撤销
    if (existing.status !== 'pending') {
      return reply.status(400).send(error(400, '当前退款状态不允许撤销'))
    }
    const refund = await processRefund(refundNo, 'rejected', '用户取消')
    return reply.send(success({ success: !!refund, refund }))
  })

  server.get('/payment/refund/:refundNo/status', async (request, reply) => {
    const refundNo = refundNoParam.parse(request.params).refundNo
    if (!refundNo) return reply.status(400).send(error(400, '参数错误'))
    const refund = await findRefundById(refundNo)
    if (!refund) return reply.status(404).send(error(404, '退款记录不存在'))
    // P0 越权修复:仅退款归属人 OR 管理员可查询退款状态
    const roleId = request.jwtPayload?.roleId ?? 0
    if (refund.userId !== request.userId && roleId < ADMIN_ROLE_ID) {
      return reply.status(403).send(error(403, '无权查询他人退款'))
    }
    return reply.send(success({ status: refund.status }))
  })

  // POST /payment/refund/:refundNo/audit - 审核退款(仅管理员)
  server.post('/payment/refund/:refundNo/audit', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request, reply) => {
    // P0 越权修复:审核退款仅限管理员,用户无权自行审核自己的退款
    const roleId = request.jwtPayload?.roleId ?? 0
    if (roleId < ADMIN_ROLE_ID) {
      return reply.status(403).send(error(403, '需要管理员权限'))
    }
    const refundNo = refundNoParam.parse(request.params).refundNo
    if (!refundNo) return reply.status(400).send(error(400, '参数错误'))
    const body =
      (request.body as { action?: 'approved' | 'rejected'; reason?: string } | null) ?? {}
    const refund = await processRefund(refundNo, body.action ?? 'approved', body.reason ?? null)
    if (!refund) return reply.status(400).send(error(400, '退款记录不存在或状态不允许审核'))
    return reply.send(success({ success: !!refund, refund }))
  })

  // POST /payment/refund/:refundNo/process - 处理退款(仅管理员)
  server.post('/payment/refund/:refundNo/process', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request, reply) => {
    // P0 越权修复:处理退款仅限管理员,用户无权自行完成退款
    const roleId = request.jwtPayload?.roleId ?? 0
    if (roleId < ADMIN_ROLE_ID) {
      return reply.status(403).send(error(403, '需要管理员权限'))
    }
    const refundNo = refundNoParam.parse(request.params).refundNo
    if (!refundNo) return reply.status(400).send(error(400, '参数错误'))
    const body =
      (request.body as {
        status?: 'processing' | 'completed' | 'failed'
        message?: string
      } | null) ?? {}
    const refund = await handleRefund(refundNo, body.status ?? 'processing', body.message ?? null)
    if (!refund) return reply.status(400).send(error(400, '退款记录不存在或状态不允许处理'))
    return reply.send(success({ success: !!refund, refund }))
  })

  server.post('/refunds/apply', { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }, async (request, reply) => {
    const body =
      (request.body as { orderId?: string; reason?: string; refundType?: string } | null) ?? {}
    if (!body.orderId) return reply.status(400).send(error(400, '缺少订单 id'))
    const result = await applyRefund({
      orderId: body.orderId,
      userId: request.userId!,
      reason: body.reason,
      refundType: body.refundType,
    })
    if (result.reason)
      return reply
        .status(400)
        .send(error(400, result.reason === 'order_not_found' ? '订单不存在' : '订单未支付'))
    return reply.status(201).send(success({ success: true, refund: result.refund }))
  })

  server.get('/top_up/status/:orderId', async (request, reply) => {
    const orderId = orderIdParam.parse(request.params).orderId
    if (!orderId) return reply.status(400).send(error(400, '参数错误'))
    const payment = await findPaymentByOrderId(orderId)
    if (!payment) return reply.status(404).send(error(404, '支付记录不存在'))
    // P0 越权修复:仅支付归属人 OR 管理员可查询支付状态
    const roleId = request.jwtPayload?.roleId ?? 0
    if (payment.userId !== request.userId && roleId < ADMIN_ROLE_ID) {
      return reply.status(403).send(error(403, '无权查询他人支付记录'))
    }
    return reply.send(success({ status: payment.status, payment }))
  })
}

export default paymentRoutes
