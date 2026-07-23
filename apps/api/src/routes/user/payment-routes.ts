/**
 * 支付模块 /payment/*, /refunds/*, /top-up/*(10 个端点)。
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

const orderNoParam = z.object({ orderNo: z.string() })
const refundNoParam = z.object({ refundNo: z.string() })
const orderIdParam = z.object({ orderId: z.string() })

const paymentRoutes: FastifyPluginAsync = async (server) => {
  server.post('/payment/order/:orderNo/close', async (request, reply) => {
    const orderNo = orderNoParam.parse(request.params).orderNo
    if (!orderNo) return reply.status(400).send(error(400, '参数错误'))
    const order = await findOrderByOrderNo(orderNo)
    if (!order) return reply.status(404).send(error(404, '订单不存在'))
    const updated = await cancelOrder(order.id)
    return reply.send(success({ success: !!updated, order: updated }))
  })

  server.post('/payment/order/:orderNo/sync', async (request, reply) => {
    const orderNo = orderNoParam.parse(request.params).orderNo
    if (!orderNo) return reply.status(400).send(error(400, '参数错误'))
    const order = await findOrderByOrderNo(orderNo)
    return reply.send(success({ order }))
  })

  server.post('/payment/callback/verify', async (request, reply) => {
    const body = (request.body as { orderNo?: string } | null) ?? {}
    if (!body.orderNo) return reply.status(400).send(error(400, '缺少 orderNo'))
    const order = await findOrderByOrderNo(body.orderNo)
    if (!order) return reply.status(404).send(error(404, '订单不存在'))
    return reply.send(success({ success: true, order }))
  })

  server.get('/payment/orders/:orderNo', async (request, reply) => {
    const orderNo = orderNoParam.parse(request.params).orderNo
    if (!orderNo) return reply.status(400).send(error(400, '参数错误'))
    const order = await findOrderByOrderNo(orderNo)
    return reply.send(success({ order }))
  })

  server.get('/payment/refund/:refundNo', async (request, reply) => {
    const refundNo = refundNoParam.parse(request.params).refundNo
    if (!refundNo) return reply.status(400).send(error(400, '参数错误'))
    const refund = await findRefundById(refundNo)
    return reply.send(success({ refund }))
  })

  server.post('/payment/refund/:refundNo/cancel', async (request, reply) => {
    const refundNo = refundNoParam.parse(request.params).refundNo
    if (!refundNo) return reply.status(400).send(error(400, '参数错误'))
    const refund = await processRefund(refundNo, 'rejected', '用户取消')
    return reply.send(success({ success: !!refund, refund }))
  })

  server.get('/payment/refund/:refundNo/status', async (request, reply) => {
    const refundNo = refundNoParam.parse(request.params).refundNo
    if (!refundNo) return reply.status(400).send(error(400, '参数错误'))
    const refund = await findRefundById(refundNo)
    return reply.send(success({ status: refund?.status ?? null }))
  })

  server.post('/payment/refund/:refundNo/audit', async (request, reply) => {
    const refundNo = refundNoParam.parse(request.params).refundNo
    if (!refundNo) return reply.status(400).send(error(400, '参数错误'))
    const body =
      (request.body as { action?: 'approved' | 'rejected'; reason?: string } | null) ?? {}
    const refund = await processRefund(refundNo, body.action ?? 'approved', body.reason ?? null)
    return reply.send(success({ success: !!refund, refund }))
  })

  server.post('/payment/refund/:refundNo/process', async (request, reply) => {
    const refundNo = refundNoParam.parse(request.params).refundNo
    if (!refundNo) return reply.status(400).send(error(400, '参数错误'))
    const body =
      (request.body as {
        status?: 'processing' | 'completed' | 'failed'
        message?: string
      } | null) ?? {}
    const refund = await handleRefund(refundNo, body.status ?? 'processing', body.message ?? null)
    return reply.send(success({ success: !!refund, refund }))
  })

  server.post('/refunds/apply', async (request, reply) => {
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

  server.get('/top-up/status/:orderId', async (request, reply) => {
    const orderId = orderIdParam.parse(request.params).orderId
    if (!orderId) return reply.status(400).send(error(400, '参数错误'))
    const payment = await findPaymentByOrderId(orderId)
    return reply.send(success({ status: payment?.status ?? null, payment }))
  })
}

export default paymentRoutes
