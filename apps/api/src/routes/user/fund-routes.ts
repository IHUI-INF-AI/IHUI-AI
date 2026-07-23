/**
 * 基金模块 /fund/*(6 个端点:支付宝创建 + 回调 + 基金列表/详情/历史/净值)。
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { success, error } from '../../utils/response.js'
import { findFunds, findFundByCode, findFundNetValues } from '../../db/fund-queries.js'
import { findOrderByOrderNo } from '../../db/order-queries.js'
import { isAlipayConfigured, buildSignedUrl } from '../../services/alipay.js'
import { createOrder } from '../../db/payment-queries.js'
import { parsePagination } from './_shared.js'

const codeParam = z.object({ code: z.string() })

const fundRoutes: FastifyPluginAsync = async (server) => {
  server.post('/fund/ali/pay/create', async (request, reply) => {
    const body =
      (request.body as { amount?: number; description?: string; productId?: string } | null) ?? {}
    if (!body.amount || body.amount <= 0) {
      return reply.status(400).send(error(400, '缺少 amount 或 amount <= 0'))
    }
    const order = await createOrder(
      {
        userId: request.userId!,
        amount: Math.round(body.amount * 100),
        orderType: 0,
        productId: body.productId,
        payType: 'alipay',
        description: body.description,
      },
      request.userId ?? null,
    )
    if (!isAlipayConfigured()) {
      return reply.send(
        success({ payUrl: null, orderId: order.id, orderNo: order.orderNo, mock: true }),
      )
    }
    const bizContent = {
      out_trade_no: order.orderNo,
      total_amount: body.amount.toFixed(2),
      subject: body.description ?? '订单支付',
      product_code: 'FAST_INSTANT_TRADE_PAY',
    }
    const payUrl = buildSignedUrl(bizContent, 'alipay.trade.page.pay')
    return reply.send(success({ payUrl, orderId: order.id, orderNo: order.orderNo }))
  })

  server.post('/fund/ali/pay/create2', async (request, reply) => {
    const body =
      (request.body as { amount?: number; description?: string; productId?: string } | null) ?? {}
    if (!body.amount || body.amount <= 0) {
      return reply.status(400).send(error(400, '缺少 amount 或 amount <= 0'))
    }
    const order = await createOrder(
      {
        userId: request.userId!,
        amount: Math.round(body.amount * 100),
        orderType: 0,
        productId: body.productId,
        payType: 'alipay',
        description: body.description,
      },
      request.userId ?? null,
    )
    if (!isAlipayConfigured()) {
      return reply.send(
        success({ payUrl: null, orderId: order.id, orderNo: order.orderNo, mock: true }),
      )
    }
    const bizContent = {
      out_trade_no: order.orderNo,
      total_amount: body.amount.toFixed(2),
      subject: body.description ?? '订单支付',
      product_code: 'FAST_INSTANT_TRADE_PAY',
    }
    const payUrl = buildSignedUrl(bizContent, 'alipay.trade.page.pay')
    return reply.send(success({ payUrl, orderId: order.id, orderNo: order.orderNo }))
  })

  server.get('/fund/ali/pay/alipay/return', async (request, reply) => {
    const query =
      (request.query as { orderNo?: string; out_trade_no?: string; trade_no?: string } | null) ?? {}
    const orderNo = query.orderNo ?? query.out_trade_no
    if (!orderNo) {
      return reply.status(400).send(error(400, '缺少 orderNo'))
    }
    const order = await findOrderByOrderNo(orderNo)
    if (!order) {
      return reply.status(404).send(error(404, '订单不存在'))
    }
    return reply.send(
      success({
        success: true,
        orderNo: order.orderNo,
        status: order.status,
        tradeNo: query.trade_no ?? null,
      }),
    )
  })

  server.get('/fund', async (request, reply) => {
    const q = parsePagination(request, reply)
    if (!q) return
    const result = await findFunds({ page: q.page, pageSize: q.pageSize, search: q.search })
    return reply.send(
      success({ list: result.list, total: result.total, page: q.page, pageSize: q.pageSize }),
    )
  })

  server.get('/fund/:code', async (request, reply) => {
    const code = codeParam.parse(request.params).code
    if (!code) return reply.status(400).send(error(400, '参数错误'))
    const fund = await findFundByCode(code)
    if (!fund) return reply.status(404).send(error(404, '基金不存在'))
    return reply.send(success({ fund }))
  })

  server.get('/fund/:code/history', async (request, reply) => {
    const code = codeParam.parse(request.params).code
    if (!code) return reply.status(400).send(error(400, '参数错误'))
    const fund = await findFundByCode(code)
    if (!fund) return reply.status(404).send(error(404, '基金不存在'))
    const q = parsePagination(request, reply)
    if (!q) return
    const result = await findFundNetValues(fund.id, { page: q.page, pageSize: q.pageSize })
    return reply.send(
      success({ list: result.list, total: result.total, page: q.page, pageSize: q.pageSize }),
    )
  })

  server.get('/fund/:code/net-values', async (request, reply) => {
    const code = codeParam.parse(request.params).code
    if (!code) return reply.status(400).send(error(400, '参数错误'))
    const fund = await findFundByCode(code)
    if (!fund) return reply.status(404).send(error(404, '基金不存在'))
    const q = parsePagination(request, reply)
    if (!q) return
    const result = await findFundNetValues(fund.id, { page: q.page, pageSize: q.pageSize })
    return reply.send(
      success({ list: result.list, total: result.total, page: q.page, pageSize: q.pageSize }),
    )
  })
}

export default fundRoutes
