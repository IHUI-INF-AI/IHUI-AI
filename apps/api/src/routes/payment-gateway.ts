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
  h5Prepay,
  nativePrepay,
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
  tradeCreate,
  verifyNotify,
  queryOrder as aliQueryOrder,
  refundOrder as aliRefundOrder,
  closeOrder as aliCloseOrder,
  downloadBillUrl as aliDownloadBillUrl,
} from '../services/alipay.js'
import { applyWithdrawal, getBalance } from '../db/commission-queries.js'
import { buildSchema, swaggerSchemas } from '../utils/swagger.js'

const notifyUrl = (type?: string): string => {
  if (type === 'course') return env.WX_PAY_COURSE_NOTIFY_URL ?? env.WX_PAY_NOTIFY_URL ?? ''
  if (type === 'android') return env.WX_ANDROID_NOTIFY_URL ?? env.WX_PAY_NOTIFY_URL ?? ''
  return env.WX_PAY_NOTIFY_URL ?? ''
}

const ADMIN_ROLE_ID = 1
// 2026-07-24 安全防护:支付金额上限(分,100 万元,防异常大额 CWE-841)
const MAX_PAYMENT_AMOUNT_CENTS = 100_000_000

// =============================================================================
// Zod schemas
// =============================================================================

const outTradeNoQuery = z.object({ outTradeNo: z.string() })
const billDateQuery = z.object({ billDate: z.string().optional() })

const wechatCreateQuery = z.object({
  amount: z.coerce.number(),
  openId: z.string(),
  orderType: z.coerce.number().optional().default(0),
  productId: z.string().optional(),
  description: z.string().optional().default('Purchase'),
})

const wechatAndroidCreateQuery = z.object({
  amount: z.coerce.number(),
  orderType: z.coerce.number().optional().default(0),
  description: z.string().optional().default('Purchase'),
})

const wechatH5CreateQuery = z.object({
  amount: z.coerce.number(),
  orderType: z.coerce.number().optional().default(0),
  description: z.string().optional().default('Purchase'),
})

const wechatNativeCreateQuery = z.object({
  amount: z.coerce.number(),
  orderType: z.coerce.number().optional().default(0),
  productId: z.string().optional(),
  description: z.string().optional().default('Purchase'),
})

const wechatCourseCreateQuery = z.object({
  amount: z.coerce.number(),
  courseId: z.string(),
})

const wechatRefundQuery = z.object({
  outTradeNo: z.string(),
  refundAmount: z.coerce.number(),
  reason: z.string().optional().default('User requested refund'),
})

const alipayCreateQuery = z.object({
  amount: z.coerce.number(),
  orderType: z.coerce.number().optional().default(0),
  subject: z.string().optional().default('订单支付'),
  productId: z.string().optional(),
})

const alipayRefundQuery = z.object({
  outTradeNo: z.string(),
  refundAmount: z.coerce.number(),
  reason: z.string().optional().default('用户申请退款'),
})

const fundCreateOrderQuery = z.object({
  amount: z.coerce.number(),
  orderType: z.coerce.number().optional().default(0),
  productId: z.string().optional(),
})

const wechatPayQuery = z.object({
  outTradeNo: z.string(),
  totalFee: z.coerce.number(),
})

const transferQuery = z.object({
  amount: z.coerce.number(),
  bankAccount: z.string(),
  bankName: z.string().optional().default(''),
})

const withdrawalQuery = z.object({
  amount: z.coerce.number(),
})

const orderNoQuery = z.object({ orderNo: z.string().optional() })

export const paymentGatewayRoutes: FastifyPluginAsync = async (server) => {
  // ==========================================================================
  // 微信支付
  // ==========================================================================

  server.post(
    '/payments/wechat/create',
    {
      schema: buildSchema({
        summary: '微信 JSAPI 支付下单',
        description: '创建微信 JSAPI 支付订单(需 openId)',
        tags: ['Payment'],
      }),
    },
    async (request, reply) => {
      await authenticate(request)
      const {
        amount: amountCents,
        openId,
        orderType,
        productId,
        description,
      } = wechatCreateQuery.parse(request.query)
      const userId = request.userId!
      const resolvedOpenId = openId || userId
      if (!amountCents || amountCents <= 0)
        return reply.status(400).send(error(400, '金额必须为正'))
      if (amountCents > MAX_PAYMENT_AMOUNT_CENTS)
        return reply.status(400).send(error(400, '金额超过上限'))
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
    },
  )

  server.post(
    '/payments/wechat/android/create',
    {
      schema: buildSchema({
        summary: '微信 Android APP 支付下单',
        description: '创建微信 Android APP 支付订单',
        tags: ['Payment'],
      }),
    },
    async (request, reply) => {
      await authenticate(request)
      const {
        amount: amountCents,
        orderType,
        description,
      } = wechatAndroidCreateQuery.parse(request.query)
      const userId = request.userId!
      if (!amountCents || amountCents <= 0)
        return reply.status(400).send(error(400, '金额必须为正'))
      if (amountCents > MAX_PAYMENT_AMOUNT_CENTS)
        return reply.status(400).send(error(400, '金额超过上限'))
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
    },
  )

  server.post(
    '/payments/wechat/h5',
    {
      schema: buildSchema({
        summary: '微信 H5 支付下单',
        description: '创建微信 H5 支付订单(返回 h5_url 跳转链接,移动端浏览器使用)',
        tags: ['Payment'],
      }),
    },
    async (request, reply) => {
      await authenticate(request)
      const {
        amount: amountCents,
        orderType,
        description,
      } = wechatH5CreateQuery.parse(request.query)
      const userId = request.userId!
      if (!amountCents || amountCents <= 0)
        return reply.status(400).send(error(400, '金额必须为正'))
      if (amountCents > MAX_PAYMENT_AMOUNT_CENTS)
        return reply.status(400).send(error(400, '金额超过上限'))
      const order = await placeOrder({
        userId,
        amount: amountCents,
        orderType,
        payType: 'wechat_h5',
        description,
      })
      if (!isWechatPayConfigured()) {
        return reply.send(success({ outTradeNo: order.orderNo, amount: amountCents, mock: true }))
      }
      const h5Url = await h5Prepay({
        outTradeNo: order.orderNo,
        amount: amountCents,
        description,
        notifyUrl: notifyUrl(),
        payerClientIp: request.ip,
      })
      return reply.send(success({ outTradeNo: order.orderNo, amount: amountCents, h5Url }))
    },
  )

  server.post(
    '/payments/wechat/native',
    {
      schema: buildSchema({
        summary: '微信 Native 支付下单',
        description: '创建微信 Native 支付订单(返回 code_url 用于生成二维码)',
        tags: ['Payment'],
      }),
    },
    async (request, reply) => {
      await authenticate(request)
      const {
        amount: amountCents,
        orderType,
        productId,
        description,
      } = wechatNativeCreateQuery.parse(request.query)
      const userId = request.userId!
      if (!amountCents || amountCents <= 0)
        return reply.status(400).send(error(400, '金额必须为正'))
      if (amountCents > MAX_PAYMENT_AMOUNT_CENTS)
        return reply.status(400).send(error(400, '金额超过上限'))
      const order = await placeOrder({
        userId,
        amount: amountCents,
        orderType,
        productId,
        payType: 'wechat_native',
        description,
      })
      if (!isWechatPayConfigured()) {
        return reply.send(success({ outTradeNo: order.orderNo, amount: amountCents, mock: true }))
      }
      const codeUrl = await nativePrepay({
        outTradeNo: order.orderNo,
        amount: amountCents,
        description,
        notifyUrl: notifyUrl(),
      })
      return reply.send(success({ outTradeNo: order.orderNo, amount: amountCents, codeUrl }))
    },
  )

  server.post(
    '/payments/wechat/course/create',
    {
      schema: buildSchema({
        summary: '微信课程支付下单',
        description: '创建微信课程购买支付订单',
        tags: ['Payment'],
      }),
    },
    async (request, reply) => {
      await authenticate(request)
      const { amount: amountCents, courseId } = wechatCourseCreateQuery.parse(request.query)
      const userId = request.userId!
      if (!amountCents || amountCents <= 0)
        return reply.status(400).send(error(400, '金额必须为正'))
      if (amountCents > MAX_PAYMENT_AMOUNT_CENTS)
        return reply.status(400).send(error(400, '金额超过上限'))
      // TODO: 生产环境必须根据 courseId 查询课程真实价格,忽略客户端传入的 amount
      request.log.warn(
        { courseId, amountCents, userId },
        '课程支付使用客户端金额,需人工审计异常订单',
      )
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
    },
  )

  server.post(
    '/payments/wechat/notify',
    {
      schema: buildSchema({
        summary: '微信支付回调',
        description: '微信支付异步通知回调(无需登录,验签后处理)',
        tags: ['Payment'],
        auth: false,
        response: swaggerSchemas.callback,
      }),
    },
    async (request, reply) => {
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
        amount?: { total?: number }
      }
      const { out_trade_no, trade_state, transaction_id } = decrypted
      if (trade_state === 'SUCCESS') {
        // 2026-07-24 安全防护:校验回调金额与订单金额一致(防金额篡改)
        const localOrder = await getOrder(out_trade_no)
        if (!localOrder) {
          return reply.code(400).send({ code: 'FAIL', message: '订单不存在' })
        }
        const callbackAmount = decrypted.amount?.total
        if (callbackAmount !== undefined && callbackAmount !== localOrder.amount) {
          request.log.error(
            { orderNo: out_trade_no, callbackAmount, orderAmount: localOrder.amount },
            '回调金额与订单金额不一致',
          )
          return reply.code(400).send({ code: 'FAIL', message: '金额不匹配' })
        }
        // 2026-07-24 安全加固:必须用 transaction_id 作幂等键,缺失则拒绝(防重复支付)
        if (!transaction_id) {
          request.log.warn({ orderNo: out_trade_no }, 'wechat callback missing transaction_id')
          return reply.code(400).send({ code: 'FAIL', message: 'missing transaction_id' })
        }
        const idemKey = transaction_id
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
              if (!result.order.userId) throw new Error('order has no userId')
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
          return reply.code(400).send({ code: 'FAIL', message: '处理失败' })
        }
      }
      return reply.send({ code: 'SUCCESS', message: 'OK' })
    },
  )

  server.post(
    '/payments/wechat/notify/refund',
    {
      schema: buildSchema({
        summary: '微信退款回调',
        description: '微信退款异步通知回调(无需登录,验签后处理)',
        tags: ['Payment'],
        auth: false,
        response: swaggerSchemas.callback,
      }),
    },
    async (request, reply) => {
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
    },
  )

  server.post(
    '/payments/wechat/query',
    {
      schema: buildSchema({
        summary: '查询微信订单',
        description: '查询本地 + 微信侧订单状态(管理员或订单归属人可查)',
        tags: ['Payment'],
      }),
    },
    async (request, reply) => {
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
    },
  )

  server.post(
    '/payments/wechat/close',
    {
      schema: buildSchema({
        summary: '关闭微信订单',
        description: '关闭微信侧订单并本地取消(管理员或订单归属人可操作)',
        tags: ['Payment'],
      }),
    },
    async (request, reply) => {
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
    },
  )

  server.post(
    '/payments/wechat/refund',
    {
      schema: buildSchema({
        summary: '微信退款',
        description: '发起微信退款并本地退款(订单需为 paid 状态,管理员或归属人可操作)',
        tags: ['Payment'],
      }),
    },
    async (request, reply) => {
      const payload = await authenticate(request)
      const { outTradeNo, refundAmount: amount, reason } = wechatRefundQuery.parse(request.query)
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
    },
  )

  server.get(
    '/payments/wechat/status/:outTradeNo',
    {
      schema: buildSchema({
        summary: '查询微信订单状态(轻量)',
        description: '按 outTradeNo 返回订单状态与金额(不泄露完整订单信息)',
        tags: ['Payment'],
        params: outTradeNoQuery,
      }),
    },
    async (request, reply) => {
      await authenticate(request)
      const { outTradeNo } = outTradeNoQuery.parse(request.params)
      const order = await getOrder(outTradeNo)
      if (!order) return reply.status(404).send(error(404, '订单不存在'))
      // 仅返回订单状态与归属人校验，不泄露完整订单信息
      if (order.userId && order.userId !== request.userId) {
        return reply.status(403).send(error(403, '无权查看此订单'))
      }
      return reply.send(
        success({ orderNo: order.orderNo, status: order.status, amount: order.amount }),
      )
    },
  )

  // ==========================================================================
  // 支付宝支付
  // ==========================================================================

  server.post(
    '/payments/alipay/create',
    {
      schema: buildSchema({
        summary: '支付宝网页支付下单',
        description: '创建支付宝 PC 网页支付订单,返回支付链接(金额单位:元)',
        tags: ['Payment'],
      }),
    },
    async (request, reply) => {
      await authenticate(request)
      const { amount: amountYuan, orderType, subject, productId } = alipayCreateQuery.parse(request.query)
      const userId = request.userId!
      const amountCents = Math.round(amountYuan * 100)
      if (!amountCents || amountCents <= 0)
        return reply.status(400).send(error(400, '金额必须为正'))
      if (amountCents > MAX_PAYMENT_AMOUNT_CENTS)
        return reply.status(400).send(error(400, '金额超过上限'))
      const order = await placeOrder({
        userId,
        amount: amountCents,
        orderType,
        payType: 'alipay',
        productId,
      })
      if (!isAlipayConfigured())
        return reply.send(success({ outTradeNo: order.orderNo, mock: true }))
      const bizContent: Record<string, unknown> = {
        out_trade_no: order.orderNo,
        total_amount: amountYuan.toFixed(2),
        subject,
        product_code: 'FAST_INSTANT_TRADE_PAY',
      }
      if (env.ALIPAY_NOTIFY_URL) bizContent.notify_url = env.ALIPAY_NOTIFY_URL
      const payUrl = buildSignedUrl(bizContent, 'alipay.trade.page.pay')
      return reply.send(success({ outTradeNo: order.orderNo, payUrl }))
    },
  )

  server.post(
    '/payments/alipay/app/create',
    {
      schema: buildSchema({
        summary: '支付宝 APP 支付下单',
        description: '创建支付宝 APP 支付订单,返回 orderStr(金额单位:元)',
        tags: ['Payment'],
      }),
    },
    async (request, reply) => {
      await authenticate(request)
      const { amount: amountYuan, orderType, subject } = alipayCreateQuery.parse(request.query)
      const userId = request.userId!
      const amountCents = Math.round(amountYuan * 100)
      if (!amountCents || amountCents <= 0)
        return reply.status(400).send(error(400, '金额必须为正'))
      if (amountCents > MAX_PAYMENT_AMOUNT_CENTS)
        return reply.status(400).send(error(400, '金额超过上限'))
      const order = await placeOrder({
        userId,
        amount: amountCents,
        orderType,
        payType: 'alipay_app',
      })
      if (!isAlipayConfigured())
        return reply.send(success({ outTradeNo: order.orderNo, mock: true }))
      const orderStr = appPayOrder({ outTradeNo: order.orderNo, amount: amountYuan, subject })
      return reply.send(success({ outTradeNo: order.orderNo, orderStr }))
    },
  )

  server.post(
    '/payments/alipay/miniapp/create',
    {
      schema: buildSchema({
        summary: '支付宝小程序支付下单',
        description: '创建支付宝小程序支付订单,返回 tradeNO 给前端调起支付(金额单位:元)',
        tags: ['Payment'],
      }),
    },
    async (request, reply) => {
      await authenticate(request)
      const { amount: amountYuan, orderType, subject, productId } = alipayCreateQuery.parse(request.query)
      const userId = request.userId!
      const amountCents = Math.round(amountYuan * 100)
      if (!amountCents || amountCents <= 0)
        return reply.status(400).send(error(400, '金额必须为正'))
      if (amountCents > MAX_PAYMENT_AMOUNT_CENTS)
        return reply.status(400).send(error(400, '金额超过上限'))
      const order = await placeOrder({
        userId,
        amount: amountCents,
        orderType,
        payType: 'alipay_miniapp',
        productId,
      })
      if (!isAlipayConfigured())
        return reply.send(success({ outTradeNo: order.orderNo, mock: true }))
      try {
        const { tradeNo } = await tradeCreate({ outTradeNo: order.orderNo, amount: amountYuan, subject })
        return reply.send(success({ outTradeNo: order.orderNo, tradeNo }))
      } catch (err) {
        request.log.error({ err, orderNo: order.orderNo }, 'alipay miniapp tradeCreate failed')
        return reply.status(400).send(error(400, `支付宝小程序支付下单失败: ${(err as Error).message}`))
      }
    },
  )

  server.post(
    '/payments/alipay/notify',
    {
      schema: buildSchema({
        summary: '支付宝异步回调',
        description: '支付宝支付异步通知回调(无需登录,验签后处理,返回 success/fail 文本)',
        tags: ['Payment'],
        auth: false,
        response: swaggerSchemas.public,
      }),
    },
    async (request, reply) => {
      const params = (request.body ?? {}) as Record<string, string>
      if (!params.sign || !verifyNotify(params)) return reply.type('text/plain').send('fail')
      const tradeStatus = params.trade_status ?? ''
      const outTradeNo = params.out_trade_no ?? ''
      if (['TRADE_SUCCESS', 'TRADE_FINISHED'].includes(tradeStatus)) {
        // 2026-07-24 安全防护:校验回调金额与订单金额一致(防金额篡改)
        const localOrder = await getOrder(outTradeNo)
        if (!localOrder) {
          return reply.type('text/plain').send('fail')
        }
        const callbackAmountYuan = parseFloat(params.total_amount ?? '0')
        if (
          !Number.isNaN(callbackAmountYuan) &&
          Math.round(callbackAmountYuan * 100) !== localOrder.amount
        ) {
          request.log.error(
            { orderNo: outTradeNo, callbackAmountYuan, orderAmountCents: localOrder.amount },
            '回调金额与订单金额不一致',
          )
          return reply.type('text/plain').send('fail')
        }
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
              if (!result.order.userId) throw new Error('order has no userId')
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
    },
  )

  server.post(
    '/payments/alipay/query',
    {
      schema: buildSchema({
        summary: '查询支付宝订单',
        description: '查询本地 + 支付宝侧订单状态(管理员或订单归属人可查)',
        tags: ['Payment'],
      }),
    },
    async (request, reply) => {
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
    },
  )

  server.post(
    '/payments/alipay/refund',
    {
      schema: buildSchema({
        summary: '支付宝退款',
        description: '发起支付宝退款并本地退款(订单需为 paid 状态,金额单位:元)',
        tags: ['Payment'],
      }),
    },
    async (request, reply) => {
      const payload = await authenticate(request)
      const {
        outTradeNo,
        refundAmount: amountYuan,
        reason,
      } = alipayRefundQuery.parse(request.query)
      const order = await getOrder(outTradeNo)
      if (!order) return reply.status(404).send(error(404, '订单不存在'))
      if (payload.roleId < ADMIN_ROLE_ID && order.userId !== request.userId) {
        return reply.status(403).send(error(403, '无权操作此订单'))
      }
      if (order.status !== 'paid') return reply.status(400).send(error(400, '订单状态不允许退款'))
      // 2026-07-24 安全防护:退款金额不能超过订单金额(单位:元)
      if (amountYuan * 100 > order.amount)
        return reply.status(400).send(error(400, '退款金额不能超过订单金额'))
      if (isAlipayConfigured()) {
        const result = await aliRefundOrder({ outTradeNo, refundAmount: amountYuan, reason })
        if (!result.success) return reply.status(500).send(error(500, '退款失败'))
      }
      await refundOrder(outTradeNo)
      return reply.send(success({ outTradeNo }))
    },
  )

  // ==========================================================================
  // 基金（转账/提现）
  // ==========================================================================

  server.post(
    '/payments/createOrder',
    {
      schema: buildSchema({
        summary: '基金下单',
        description: '创建基金订单(金额单位:元,自动转分)',
        tags: ['Payment'],
      }),
    },
    async (request, reply) => {
      await authenticate(request)
      const { amount: amountYuan, orderType, productId } = fundCreateOrderQuery.parse(request.query)
      const userId = request.userId!
      const amountCents = Math.round(amountYuan * 100)
      if (!amountCents || amountCents <= 0)
        return reply.status(400).send(error(400, '金额必须为正'))
      if (amountCents > MAX_PAYMENT_AMOUNT_CENTS)
        return reply.status(400).send(error(400, '金额超过上限'))
      const order = await placeOrder({
        userId,
        amount: amountCents,
        orderType,
        productId,
        payType: 'fund',
      })
      return reply.send(success({ outTradeNo: order.orderNo, amount: amountCents }))
    },
  )

  server.post(
    '/payments/wechatPay',
    {
      schema: buildSchema({
        summary: '基金微信支付',
        description: '使用微信 JSAPI 支付基金订单(返回 prepayId 用于拉起支付)',
        tags: ['Payment'],
      }),
    },
    async (request, reply) => {
      await authenticate(request)
      const { outTradeNo, totalFee } = wechatPayQuery.parse(request.query)
      if (!isWechatPayConfigured()) return reply.send(success({ outTradeNo, mock: true }))
      const prepayId = await jsapiPrepay({
        outTradeNo,
        amount: totalFee,
        description: '基金充值',
        openId: '',
        notifyUrl: notifyUrl(),
      })
      return reply.send(success({ outTradeNo, prepayId }))
    },
  )

  server.post(
    '/payments/transfer',
    {
      schema: buildSchema({
        summary: '银行卡提现',
        description: '申请银行卡提现(创建提现流水,异步处理)',
        tags: ['Payment'],
      }),
    },
    async (request, reply) => {
      await authenticate(request)
      const { amount, bankAccount, bankName } = transferQuery.parse(request.query)
      const userId = request.userId!
      // 2026-07-24 安全防护:提现金额不能超过用户余额(CWE-841)
      const balance = await getBalance(userId)
      if (amount > balance)
        return reply.status(400).send(error(400, '提现金额不能超过可用余额'))
      const flow = await applyWithdrawal({
        userId,
        amount,
        method: 'bank',
        accountInfo: { bankAccount, bankName },
      }, userId)
      return reply.send(success(flow))
    },
  )

  server.post(
    '/payments/withdrawal',
    {
      schema: buildSchema({
        summary: '微信提现',
        description: '申请微信提现(创建提现流水,异步处理)',
        tags: ['Payment'],
      }),
    },
    async (request, reply) => {
      await authenticate(request)
      const { amount } = withdrawalQuery.parse(request.query)
      const userId = request.userId!
      // 2026-07-24 安全防护:提现金额不能超过用户余额(CWE-841)
      const balance = await getBalance(userId)
      if (amount > balance)
        return reply.status(400).send(error(400, '提现金额不能超过可用余额'))
      const flow = await applyWithdrawal({
        userId,
        amount,
        method: 'wechat',
        accountInfo: {},
      }, request.userId ?? null)
      return reply.send(success(flow))
    },
  )

  server.get(
    '/payments/success',
    {
      schema: buildSchema({
        summary: '支付成功页',
        description: '支付成功后的回调着陆页(返回 orderNo)',
        tags: ['Payment'],
        auth: false,
      }),
    },
    async (request, reply) => {
      const { orderNo } = orderNoQuery.parse(request.query)
      return reply.send(success({ orderNo, msg: 'Payment success' }))
    },
  )

  server.get(
    '/payments/fail',
    {
      schema: buildSchema({
        summary: '支付失败页',
        description: '支付失败时的回调着陆页(返回 500)',
        tags: ['Payment'],
        auth: false,
      }),
    },
    async (_request, reply) => {
      return reply.status(500).send(error(500, 'Payment failed, please retry'))
    },
  )

  // 对账（用户级）
  server.get(
    '/payments/reconciliation/pending',
    {
      schema: buildSchema({
        summary: '待处理订单列表',
        description: '返回当前所有待处理(pending)订单列表',
        tags: ['Payment'],
      }),
    },
    async (request, reply) => {
      await authenticate(request)
      const items = await queryPendingOrders()
      return reply.send(success({ count: items.length, items }))
    },
  )

  server.post(
    '/payments/reconciliation/close_expired',
    {
      schema: buildSchema({
        summary: '关闭过期订单',
        description: '扫描所有待处理订单并关闭已过期的(返回成功/失败清单)',
        tags: ['Payment'],
      }),
    },
    async (request, reply) => {
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
    },
  )
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

  server.get(
    '/payments/reconciliation/alipay',
    {
      schema: buildSchema({
        summary: '支付宝对账单',
        description: '下载支付宝指定日期对账单(管理员,默认前一天)',
        tags: ['Admin', 'Payment'],
      }),
    },
    async (request, reply) => {
      const { billDate } = billDateQuery.parse(request.query)
      const date = billDate ?? new Date(Date.now() - 86400_000).toISOString().slice(0, 10)
      if (!isAlipayConfigured()) return reply.send(success({ billDate: date, mock: true }))
      const billUrl = await aliDownloadBillUrl(date, 'trade')
      return reply.send(success({ billDate: date, billUrl }))
    },
  )

  server.get(
    '/payments/reconciliation/wechat',
    {
      schema: buildSchema({
        summary: '微信对账单',
        description: '下载微信指定日期对账单 CSV(管理员,默认前一天)',
        tags: ['Admin', 'Payment'],
      }),
    },
    async (request, reply) => {
      const { billDate } = billDateQuery.parse(request.query)
      const date = billDate ?? new Date(Date.now() - 86400_000).toISOString().slice(0, 10)
      if (!isWechatPayConfigured()) return reply.send(success({ billDate: date, mock: true }))
      const csv = await wxDownloadBill(date, 'ALL')
      return reply.send(success({ billDate: date, csv }))
    },
  )

  server.get(
    '/payments/reconciliation/all',
    {
      schema: buildSchema({
        summary: '全平台对账单',
        description: '同时下载支付宝 + 微信指定日期对账单(管理员,默认前一天)',
        tags: ['Admin', 'Payment'],
      }),
    },
    async (request, reply) => {
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
    },
  )
}
