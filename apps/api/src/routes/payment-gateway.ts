import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { env } from 'node:process'
import { authenticate } from '../plugins/auth.js'
import { success, error } from '../utils/response.js'
import { queryPendingOrders } from '../db/payment-queries.js'
import {
  placeOrder,
  getOrder,
  completeOrder,
  cancelOrder,
  refundOrder,
  activateOrderSubscription,
} from '../services/order-service.js'
import { feedbackInvite } from '../services/commission-service.js'
import {
  isWechatPayConfigured,
  jsapiPrepay,
  appPrepay,
  buildJsapiSign,
  verifyCallbackSignature,
  decryptCallback,
  queryOrder as wxQueryOrder,
  closeOrder as wxCloseOrder,
  refund as wxRefund,
  downloadBill as wxDownloadBill,
} from '../services/wechat-pay.js'
import {
  isAlipayConfigured,
  buildSignedUrl,
  appPayOrder,
  verifyNotify,
  queryOrder as aliQueryOrder,
  refundOrder as aliRefundOrder,
  closeOrder as aliCloseOrder,
  downloadBillUrl as aliDownloadBillUrl,
} from '../services/alipay.js'
import { applyWithdrawal, getBalance } from '../db/commission-queries.js'

const notifyUrl = (type?: string): string => {
  if (type === 'course') return env.WX_PAY_COURSE_NOTIFY_URL ?? env.WX_PAY_NOTIFY_URL ?? ''
  if (type === 'android') return env.WX_ANDROID_NOTIFY_URL ?? env.WX_PAY_NOTIFY_URL ?? ''
  return env.WX_PAY_NOTIFY_URL ?? ''
}

const ADMIN_ROLE_ID = 1

const outTradeNoQuery = z.object({ outTradeNo: z.string() })
const billDateQuery = z.object({ billDate: z.string().optional() })

export const paymentGatewayRoutes: FastifyPluginAsync = async (server) => {
  // ==========================================================================
  // 微信支付
  // ==========================================================================

  server.post('/payments/wechat/create', async (request, reply) => {
    await authenticate(request)
    const {
      amount: amountCents,
      openId,
      orderType,
      productId,
      description,
    } = z
      .object({
        amount: z.coerce.number(),
        openId: z.string(),
        orderType: z.coerce.number().optional().default(0),
        productId: z.string().optional(),
        description: z.string().optional().default('Purchase'),
      })
      .parse(request.query)
    const userId = request.userId!
    const resolvedOpenId = openId || userId
    if (!amountCents || amountCents <= 0) return reply.status(400).send(error(400, '金额必须为正'))
    const order = await placeOrder({
      userId,
      amount: amountCents,
      orderType,
      productId,
      payType: 'wechat',
      openId: resolvedOpenId,
      description,
    })
    if (!isWechatPayConfigured()) {
      return reply.send(success({ outTradeNo: order.orderNo, amount: amountCents, mock: true }))
    }
    const prepayId = await jsapiPrepay({
      outTradeNo: order.orderNo,
      amount: amountCents,
      description,
      openId: resolvedOpenId,
      notifyUrl: notifyUrl(),
    })
    const sign = buildJsapiSign(prepayId)
    return reply.send(success({ outTradeNo: order.orderNo, amount: amountCents, ...sign }))
  })

  server.post('/payments/wechat/android/create', async (request, reply) => {
    await authenticate(request)
    const {
      amount: amountCents,
      orderType,
      description,
    } = z
      .object({
        amount: z.coerce.number(),
        orderType: z.coerce.number().optional().default(0),
        description: z.string().optional().default('Purchase'),
      })
      .parse(request.query)
    const userId = request.userId!
    const order = await placeOrder({
      userId,
      amount: amountCents,
      orderType,
      payType: 'wechat_android',
      description,
    })
    if (!isWechatPayConfigured())
      return reply.send(success({ outTradeNo: order.orderNo, mock: true }))
    const prepay = await appPrepay({
      outTradeNo: order.orderNo,
      amount: amountCents,
      description,
      notifyUrl: notifyUrl('android'),
    })
    return reply.send(
      success({ outTradeNo: order.orderNo, amount: amountCents, prepayData: prepay }),
    )
  })

  server.post('/payments/wechat/course/create', async (request, reply) => {
    await authenticate(request)
    const { amount: amountCents, courseId } = z
      .object({
        amount: z.coerce.number(),
        courseId: z.string(),
      })
      .parse(request.query)
    const userId = request.userId!
    const order = await placeOrder({
      userId,
      amount: amountCents,
      orderType: 1,
      productId: courseId,
      payType: 'wechat',
    })
    if (!isWechatPayConfigured())
      return reply.send(success({ outTradeNo: order.orderNo, mock: true }))
    const prepayId = await jsapiPrepay({
      outTradeNo: order.orderNo,
      amount: amountCents,
      description: '课程购买',
      openId: '',
      notifyUrl: notifyUrl('course'),
    })
    return reply.send(success({ outTradeNo: order.orderNo, ...buildJsapiSign(prepayId) }))
  })

  server.post('/payments/wechat/notify', async (request, reply) => {
    const body = request.body as Record<string, unknown>
    const timestamp = request.headers['wechatpay-timestamp'] as string
    const nonce = request.headers['wechatpay-nonce'] as string
    const signature = request.headers['wechatpay-signature'] as string
    if (!verifyCallbackSignature(timestamp, nonce, JSON.stringify(body), signature)) {
      return reply.code(400).send({ code: 'FAIL', message: '签名验证失败' })
    }
    const resource = (
      body as { resource?: { ciphertext: string; nonce: string; associated_data: string } }
    ).resource
    if (!resource) return reply.send({ code: 'SUCCESS', message: 'No resource' })
    const decrypted = decryptCallback(
      resource.ciphertext,
      resource.nonce,
      resource.associated_data,
    ) as {
      out_trade_no: string
      trade_state: string
      transaction_id?: string
    }
    const { out_trade_no, trade_state, transaction_id } = decrypted
    if (trade_state === 'SUCCESS') {
      // 支付幂等：用 transaction_id 作幂等键，防止微信重复回调导致重复处理
      const idemKey = transaction_id ?? out_trade_no
      const idem = await server.paymentIdempotency.acquire(out_trade_no, idemKey)
      if (idem.status === 'completed') {
        return reply.send({ code: 'SUCCESS', message: 'OK (duplicate)' })
      }
      if (idem.status === 'processing') {
        // 上次回调仍在处理，ack SUCCESS 让微信停止重试
        return reply.send({ code: 'SUCCESS', message: 'OK (processing)' })
      }
      try {
        const result = await completeOrder(out_trade_no, transaction_id)
        // 支付成功后触发返佣（失败不阻塞支付完成）
        if (result.success && result.order) {
          try {
            await activateOrderSubscription(result.order)
          } catch (ae) {
            request.log.warn({ err: ae, orderNo: out_trade_no }, 'subscription activation failed')
          }
          try {
            const tokenQuantity = await getBalance(result.order.userId)
            await feedbackInvite(
              { id: result.order.userId, tokenQuantity },
              {
                id: result.order.id,
                amount: result.order.amount,
                orderType: result.order.orderType,
                productId: result.order.productId ?? null,
              },
            )
          } catch (ce) {
            request.log.warn({ err: ce, orderNo: out_trade_no }, 'commission feedback failed')
          }
        }
        await server.paymentIdempotency.complete(out_trade_no, idemKey, {
          out_trade_no,
          trade_state,
        })
      } catch (e) {
        await server.paymentIdempotency.fail(out_trade_no, idemKey, (e as Error).message)
        return reply.code(500).send({ code: 'FAIL', message: '处理失败' })
      }
    }
    return reply.send({ code: 'SUCCESS', message: 'OK' })
  })

  server.post('/payments/wechat/notify/refund', async (request, reply) => {
    const body = request.body as Record<string, unknown>
    const timestamp = request.headers['wechatpay-timestamp'] as string
    const nonce = request.headers['wechatpay-nonce'] as string
    const signature = request.headers['wechatpay-signature'] as string
    if (!verifyCallbackSignature(timestamp, nonce, JSON.stringify(body), signature)) {
      return reply.code(400).send({ code: 'FAIL', message: '签名验证失败' })
    }
    const resource = (
      body as { resource?: { ciphertext: string; nonce: string; associated_data: string } }
    ).resource
    if (resource) {
      const decrypted = decryptCallback(
        resource.ciphertext,
        resource.nonce,
        resource.associated_data,
      ) as {
        out_trade_no: string
        refund_status: string
      }
      if (['SUCCESS', 'CHANGE'].includes(decrypted.refund_status)) {
        await refundOrder(decrypted.out_trade_no)
      }
    }
    return reply.send({ code: 'SUCCESS', message: 'OK' })
  })

  server.post('/payments/wechat/query', async (request, reply) => {
    const payload = await authenticate(request)
    const { outTradeNo } = outTradeNoQuery.parse(request.query)
    const local = await getOrder(outTradeNo)
    if (!local) return reply.status(404).send(error(404, '订单不存在'))
    if (payload.roleId < ADMIN_ROLE_ID && local.userId !== request.userId) {
      return reply.status(403).send(error(403, '无权操作此订单'))
    }
    if (!isWechatPayConfigured()) return reply.send(success({ local }))
    const wechat = await wxQueryOrder(outTradeNo)
    return reply.send(success({ local, wechat }))
  })

  server.post('/payments/wechat/close', async (request, reply) => {
    const payload = await authenticate(request)
    const { outTradeNo } = outTradeNoQuery.parse(request.query)
    const order = await getOrder(outTradeNo)
    if (!order) return reply.status(404).send(error(404, '订单不存在'))
    if (payload.roleId < ADMIN_ROLE_ID && order.userId !== request.userId) {
      return reply.status(403).send(error(403, '无权操作此订单'))
    }
    if (isWechatPayConfigured()) await wxCloseOrder(outTradeNo)
    await cancelOrder(outTradeNo)
    return reply.send(success({ outTradeNo }))
  })

  server.post('/payments/wechat/refund', async (request, reply) => {
    const payload = await authenticate(request)
    const {
      outTradeNo,
      refundAmount: amount,
      reason,
    } = z
      .object({
        outTradeNo: z.string(),
        refundAmount: z.coerce.number(),
        reason: z.string().optional().default('User requested refund'),
      })
      .parse(request.query)
    const order = await getOrder(outTradeNo)
    if (!order) return reply.status(404).send(error(404, '订单不存在'))
    if (payload.roleId < ADMIN_ROLE_ID && order.userId !== request.userId) {
      return reply.status(403).send(error(403, '无权操作此订单'))
    }
    if (order.status !== 'paid') return reply.status(400).send(error(400, '订单状态不允许退款'))
    const refundNo = `refund_${outTradeNo}`
    if (isWechatPayConfigured()) {
      await wxRefund({
        outTradeNo,
        refundNo,
        refundAmount: amount,
        totalAmount: order.amount,
        reason,
        notifyUrl: env.WX_PAY_NOTIFY_URL ?? '',
      })
    }
    await refundOrder(outTradeNo)
    return reply.send(success({ outTradeNo, refundNo }))
  })

  server.get('/payments/wechat/status/:outTradeNo', async (request, reply) => {
    await authenticate(request)
    const { outTradeNo } = z.object({ outTradeNo: z.string() }).parse(request.params)
    const order = await getOrder(outTradeNo)
    if (!order) return reply.status(404).send(error(404, '订单不存在'))
    // 仅返回订单状态与归属人校验，不泄露完整订单信息
    if (order.userId && order.userId !== request.userId) {
      return reply.status(403).send(error(403, '无权查看此订单'))
    }
    return reply.send(
      success({ orderNo: order.orderNo, status: order.status, amount: order.amount }),
    )
  })

  // ==========================================================================
  // 支付宝支付
  // ==========================================================================

  server.post('/payments/alipay/create', async (request, reply) => {
    await authenticate(request)
    const {
      amount: amountYuan,
      orderType,
      subject,
    } = z
      .object({
        amount: z.coerce.number(),
        orderType: z.coerce.number().optional().default(0),
        subject: z.string().optional().default('订单支付'),
      })
      .parse(request.query)
    const userId = request.userId!
    const amountCents = Math.round(amountYuan * 100)
    const order = await placeOrder({
      userId,
      amount: amountCents,
      orderType,
      payType: 'alipay',
    })
    if (!isAlipayConfigured()) return reply.send(success({ outTradeNo: order.orderNo, mock: true }))
    const bizContent = {
      out_trade_no: order.orderNo,
      total_amount: amountYuan.toFixed(2),
      subject,
      product_code: 'FAST_INSTANT_TRADE_PAY',
    }
    const payUrl = buildSignedUrl(bizContent, 'alipay.trade.page.pay')
    return reply.send(success({ outTradeNo: order.orderNo, payUrl }))
  })

  server.post('/payments/alipay/app/create', async (request, reply) => {
    await authenticate(request)
    const {
      amount: amountYuan,
      orderType,
      subject,
    } = z
      .object({
        amount: z.coerce.number(),
        orderType: z.coerce.number().optional().default(0),
        subject: z.string().optional().default('订单支付'),
      })
      .parse(request.query)
    const userId = request.userId!
    const amountCents = Math.round(amountYuan * 100)
    const order = await placeOrder({
      userId,
      amount: amountCents,
      orderType,
      payType: 'alipay_app',
    })
    if (!isAlipayConfigured()) return reply.send(success({ outTradeNo: order.orderNo, mock: true }))
    const orderStr = appPayOrder({ outTradeNo: order.orderNo, amount: amountYuan, subject })
    return reply.send(success({ outTradeNo: order.orderNo, orderStr }))
  })

  server.post('/payments/alipay/notify', async (request, reply) => {
    const params = request.body as Record<string, string>
    if (!verifyNotify(params)) return reply.type('text/plain').send('fail')
    const tradeStatus = params.trade_status ?? ''
    const outTradeNo = params.out_trade_no ?? ''
    if (['TRADE_SUCCESS', 'TRADE_FINISHED'].includes(tradeStatus)) {
      // 支付幂等：用支付宝 trade_no 作幂等键，防止重复回调
      const idemKey = params.trade_no ?? outTradeNo
      const idem = await server.paymentIdempotency.acquire(outTradeNo, idemKey)
      if (idem.status === 'completed' || idem.status === 'processing') {
        return reply.type('text/plain').send('success')
      }
      try {
        const result = await completeOrder(outTradeNo, params.trade_no)
        // 支付成功后触发返佣（失败不阻塞支付完成）
        if (result.success && result.order) {
          try {
            await activateOrderSubscription(result.order)
          } catch (ae) {
            request.log.warn({ err: ae, orderNo: outTradeNo }, 'subscription activation failed')
          }
          try {
            const tokenQuantity = await getBalance(result.order.userId)
            await feedbackInvite(
              { id: result.order.userId, tokenQuantity },
              {
                id: result.order.id,
                amount: result.order.amount,
                orderType: result.order.orderType,
                productId: result.order.productId ?? null,
              },
            )
          } catch (ce) {
            request.log.warn({ err: ce, orderNo: outTradeNo }, 'commission feedback failed')
          }
        }
        await server.paymentIdempotency.complete(outTradeNo, idemKey, { outTradeNo, tradeStatus })
      } catch (e) {
        await server.paymentIdempotency.fail(outTradeNo, idemKey, (e as Error).message)
        return reply.type('text/plain').send('fail')
      }
    }
    return reply.type('text/plain').send('success')
  })

  server.post('/payments/alipay/query', async (request, reply) => {
    const payload = await authenticate(request)
    const { outTradeNo } = outTradeNoQuery.parse(request.query)
    const local = await getOrder(outTradeNo)
    if (!local) return reply.status(404).send(error(404, '订单不存在'))
    if (payload.roleId < ADMIN_ROLE_ID && local.userId !== request.userId) {
      return reply.status(403).send(error(403, '无权操作此订单'))
    }
    if (!isAlipayConfigured()) return reply.send(success({ local }))
    const alipay = await aliQueryOrder(outTradeNo)
    return reply.send(success({ local, alipay }))
  })

  server.post('/payments/alipay/refund', async (request, reply) => {
    const payload = await authenticate(request)
    const {
      outTradeNo,
      refundAmount: amountYuan,
      reason,
    } = z
      .object({
        outTradeNo: z.string(),
        refundAmount: z.coerce.number(),
        reason: z.string().optional().default('用户申请退款'),
      })
      .parse(request.query)
    const order = await getOrder(outTradeNo)
    if (!order) return reply.status(404).send(error(404, '订单不存在'))
    if (payload.roleId < ADMIN_ROLE_ID && order.userId !== request.userId) {
      return reply.status(403).send(error(403, '无权操作此订单'))
    }
    if (order.status !== 'paid') return reply.status(400).send(error(400, '订单状态不允许退款'))
    if (isAlipayConfigured()) {
      const result = await aliRefundOrder({ outTradeNo, refundAmount: amountYuan, reason })
      if (!result.success) return reply.status(500).send(error(500, '退款失败'))
    }
    await refundOrder(outTradeNo)
    return reply.send(success({ outTradeNo }))
  })

  // ==========================================================================
  // 基金（转账/提现）
  // ==========================================================================

  server.post('/payments/createOrder', async (request, reply) => {
    await authenticate(request)
    const {
      amount: amountYuan,
      orderType,
      productId,
    } = z
      .object({
        amount: z.coerce.number(),
        orderType: z.coerce.number().optional().default(0),
        productId: z.string().optional(),
      })
      .parse(request.query)
    const userId = request.userId!
    const amountCents = Math.round(amountYuan * 100)
    const order = await placeOrder({
      userId,
      amount: amountCents,
      orderType,
      productId,
      payType: 'fund',
    })
    return reply.send(success({ outTradeNo: order.orderNo, amount: amountCents }))
  })

  server.post('/payments/wechatPay', async (request, reply) => {
    await authenticate(request)
    const { outTradeNo, totalFee } = z
      .object({
        outTradeNo: z.string(),
        totalFee: z.coerce.number(),
      })
      .parse(request.query)
    if (!isWechatPayConfigured()) return reply.send(success({ outTradeNo, mock: true }))
    const prepayId = await jsapiPrepay({
      outTradeNo,
      amount: totalFee,
      description: '基金充值',
      openId: '',
      notifyUrl: notifyUrl(),
    })
    return reply.send(success({ outTradeNo, prepayId }))
  })

  server.post('/payments/transfer', async (request, reply) => {
    await authenticate(request)
    const { amount, bankAccount, bankName } = z
      .object({
        amount: z.coerce.number(),
        bankAccount: z.string(),
        bankName: z.string().optional().default(''),
      })
      .parse(request.query)
    const userId = request.userId!
    const flow = await applyWithdrawal({
      userId,
      amount,
      method: 'bank',
      accountInfo: { bankAccount, bankName },
    })
    return reply.send(success(flow))
  })

  server.post('/payments/withdrawal', async (request, reply) => {
    await authenticate(request)
    const { amount } = z.object({ amount: z.coerce.number() }).parse(request.query)
    const userId = request.userId!
    const flow = await applyWithdrawal({
      userId,
      amount,
      method: 'wechat',
      accountInfo: {},
    })
    return reply.send(success(flow))
  })

  server.get('/payments/success', async (request, reply) => {
    const { orderNo } = z.object({ orderNo: z.string().optional() }).parse(request.query)
    return reply.send(success({ orderNo, msg: 'Payment success' }))
  })

  server.get('/payments/fail', async (_request, reply) => {
    return reply.status(500).send(error(500, 'Payment failed, please retry'))
  })

  // 对账（用户级）
  server.get('/payments/reconciliation/pending', async (request, reply) => {
    await authenticate(request)
    const items = await queryPendingOrders()
    return reply.send(success({ count: items.length, items }))
  })

  server.post('/payments/reconciliation/close_expired', async (request, reply) => {
    await authenticate(request)
    const pending = await queryPendingOrders()
    const closed: string[] = []
    const failed: Array<{ outTradeNo: string; error: string }> = []
    for (const order of pending) {
      try {
        const payType = order.paymentMethod ?? ''
        if (payType.startsWith('alipay') && isAlipayConfigured()) {
          await aliCloseOrder(order.orderNo)
        } else if (payType.startsWith('wechat') && isWechatPayConfigured()) {
          await wxCloseOrder(order.orderNo)
        }
        await cancelOrder(order.orderNo)
        closed.push(order.orderNo)
      } catch (e) {
        failed.push({ outTradeNo: order.orderNo, error: (e as Error).message })
      }
    }
    return reply.send(success({ scanned: pending.length, closed, failed }))
  })
}

export const adminPaymentGatewayRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', async (request) => {
    const payload = await authenticate(request)
    if (payload.roleId < ADMIN_ROLE_ID) {
      const err = new Error('需要管理员权限')
      ;(err as Error & { statusCode: number }).statusCode = 403
      throw err
    }
  })

  server.get('/payments/reconciliation/alipay', async (request, reply) => {
    const { billDate } = billDateQuery.parse(request.query)
    const date = billDate ?? new Date(Date.now() - 86400_000).toISOString().slice(0, 10)
    if (!isAlipayConfigured()) return reply.send(success({ billDate: date, mock: true }))
    const billUrl = await aliDownloadBillUrl(date, 'trade')
    return reply.send(success({ billDate: date, billUrl }))
  })

  server.get('/payments/reconciliation/wechat', async (request, reply) => {
    const { billDate } = billDateQuery.parse(request.query)
    const date = billDate ?? new Date(Date.now() - 86400_000).toISOString().slice(0, 10)
    if (!isWechatPayConfigured()) return reply.send(success({ billDate: date, mock: true }))
    const csv = await wxDownloadBill(date, 'ALL')
    return reply.send(success({ billDate: date, csv }))
  })

  server.get('/payments/reconciliation/all', async (request, reply) => {
    const { billDate } = billDateQuery.parse(request.query)
    const date = billDate ?? new Date(Date.now() - 86400_000).toISOString().slice(0, 10)
    const result: Record<string, unknown> = { billDate: date }
    if (isAlipayConfigured()) {
      try {
        result.alipay = await aliDownloadBillUrl(date, 'trade')
      } catch (e) {
        result.alipayError = (e as Error).message
      }
    }
    if (isWechatPayConfigured()) {
      try {
        result.wechat = await wxDownloadBill(date, 'ALL')
      } catch (e) {
        result.wechatError = (e as Error).message
      }
    }
    return reply.send(success(result))
  })
}
