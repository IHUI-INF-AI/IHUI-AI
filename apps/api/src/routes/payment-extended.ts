/**
 * 支付扩展路由（M-56）。
 * 迁移旧架构的 3 个支付端点：提现回调、支付宝同步返回、连续订阅。
 *
 * 端点清单：
 * 1. POST /payments/withdrawal/notify  — 微信转账到账通知（提现回调）
 * 2. GET  /payments/sync-return       — 支付宝支付成功后浏览器同步跳转
 * 3. POST /payments/subscription/renew — 连续订阅自动续费
 * 4. GET  /payments/subscription/status — 查询当前 VIP 订阅状态
 */

import type { FastifyPluginAsync } from 'fastify'
import { env } from 'node:process'
import { z } from 'zod'
import { eq, and, desc, gte } from 'drizzle-orm'
import { db } from '../db/index.js'
import { success, error } from '../utils/response.js'
import { buildSchema, swaggerSchemas } from '../utils/swagger.js'
import { authenticate } from '../plugins/auth.js'
import { orders, withdrawalFlows, plans, userVips, vipLevels } from '@ihui/database'
import { placeOrder, completeOrder } from '../services/order-service.js'
import {
  verifyCallbackSignature,
  isWechatPayConfigured,
  jsapiPrepay,
  buildJsapiSign,
} from '../services/wechat-pay.js'
import { isAlipayConfigured, buildSignedUrl } from '../services/alipay.js'
import { config } from '../config/index.js'

// =============================================================================
// Zod schemas
// =============================================================================

const subscriptionRenewSchema = z.object({
  planId: z.string().uuid('无效的方案 ID'),
  paymentMethod: z.enum(['wechat', 'alipay'], {
    message: '支付方式仅支持 wechat 或 alipay',
  }),
})

// =============================================================================
// 路由
// =============================================================================

export const paymentExtendedRoutes: FastifyPluginAsync = async (server) => {
  // ==========================================================================
  // 1. POST /payments/withdrawal/notify - 提现回调（微信转账到账通知）
  //
  // 微信转账 V3 回调，通知资金到账结果。
  // 回调 Headers: wechatpay-serial / wechatpay-signature / wechatpay-timestamp / wechatpay-nonce
  // 回调 Body: { out_bill_no, transfer_scene_id, state, transfer_bill_no, fail_reason? }
  // state: ACCEPTED | TRANSFERING | WAIT_USER_CONFIRM | SUCCESS | FAIL
  // ==========================================================================
  server.post(
    '/payments/withdrawal/notify',
    {
      schema: buildSchema({
        summary: '微信提现回调',
        description: '微信转账到账通知(提现回调,无需登录,验签后处理)',
        tags: ['Payment'],
        auth: false,
        response: swaggerSchemas.callback,
      }),
    },
    async (request, reply) => {
      try {
        // 提取微信支付回调 Headers
        const timestamp = request.headers['wechatpay-timestamp'] as string
        const nonce = request.headers['wechatpay-nonce'] as string
        const signature = request.headers['wechatpay-signature'] as string

        const rawBody = JSON.stringify(request.body)
        const body = request.body as Record<string, unknown>
        const outBillNo = body.out_bill_no as string
        const state = body.state as string

        if (!outBillNo || !state) {
          return reply.send({ code: 'SUCCESS', message: 'OK' })
        }

        // 签名验证：verifyCallbackSignature 在无平台证书时 DEV 环境自动跳过，生产环境必须配置证书
        if (timestamp && nonce && signature) {
          const valid = verifyCallbackSignature(timestamp, nonce, rawBody, signature)
          if (!valid) {
            request.log.warn({ outBillNo }, 'withdrawal callback signature verification failed')
            return reply.code(401).send({ code: 'FAIL', message: '签名验证失败' })
          }
        } else if (env.NODE_ENV === 'production') {
          request.log.warn('withdrawal callback missing required headers in production')
          return reply.code(400).send({ code: 'FAIL', message: '缺少必要回调头' })
        }

        // 根据 out_bill_no 查询提现流水（out_bill_no 对应 partnerTradeNo）
        const [flow] = await db
          .select()
          .from(withdrawalFlows)
          .where(eq(withdrawalFlows.partnerTradeNo, outBillNo))
          .limit(1)

        if (!flow) {
          request.log.warn({ outBillNo }, 'withdrawal flow not found for callback')
          return reply.send({ code: 'SUCCESS', message: 'OK' })
        }

        // 只处理 pending(0) 或 processing(1) 状态的流水，避免重复处理
        if (flow.status !== 0 && flow.status !== 1) {
          return reply.send({ code: 'SUCCESS', message: 'OK' })
        }

        if (state === 'SUCCESS') {
          // 转账成功：更新状态为 completed(2)
          await db
            .update(withdrawalFlows)
            .set({
              status: 2,
              paymentNo: (body.transfer_bill_no as string) ?? null,
              processedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(withdrawalFlows.id, flow.id))
        } else if (state === 'FAIL') {
          // 转账失败：更新状态为 failed(3)，记录失败原因
          const failReason = (body.fail_reason as string) ?? '转账失败'
          await db
            .update(withdrawalFlows)
            .set({
              status: 3,
              rejectReason: failReason,
              processedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(withdrawalFlows.id, flow.id))
        }
        // ACCEPTED / TRANSFERING / WAIT_USER_CONFIRM 等中间状态不更新，等待最终状态回调

        return reply.send({ code: 'SUCCESS', message: 'OK' })
      } catch (e) {
        request.log.error({ err: e }, 'withdrawal notify processing failed')
        // 即使出错也返回 SUCCESS，防止微信重复回调（错误已记录日志）
        return reply.send({ code: 'SUCCESS', message: 'OK' })
      }
    },
  )

  // ==========================================================================
  // 2. GET /payments/sync-return - 支付宝同步返回页
  //
  // 支付宝支付完成后浏览器跳转回此端点。
  // Query: out_trade_no, trade_no, trade_status, total_amount
  // 验证通过后 302 重定向到前端成功/失败页。
  // ==========================================================================
  server.get(
    '/payments/sync-return',
    {
      schema: buildSchema({
        summary: '支付宝同步返回',
        description: '支付宝支付成功后浏览器同步跳转(无需登录,验证后重定向到前端成功/失败页)',
        tags: ['Payment'],
        auth: false,
        response: swaggerSchemas.public,
      }),
    },
    async (request, reply) => {
      const query = request.query as Record<string, string>
      const outTradeNo = query.out_trade_no ?? ''
      const tradeNo = query.trade_no ?? ''
      const tradeStatus = query.trade_status ?? ''

      const failUrl = `${config.CORS_ORIGIN}/payment/fail`

      if (!outTradeNo) {
        return reply.redirect(failUrl)
      }

      try {
        // 验证交易状态
        if (tradeStatus !== 'TRADE_SUCCESS') {
          return reply.redirect(failUrl)
        }

        // 查询订单确认存在
        const [order] = await db
          .select()
          .from(orders)
          .where(eq(orders.orderNo, outTradeNo))
          .limit(1)

        if (!order) {
          return reply.redirect(failUrl)
        }

        // 如果订单已支付，直接跳转成功页
        if (order.status === 'paid') {
          const successUrl = `${config.CORS_ORIGIN}/payment/success?orderNo=${outTradeNo}`
          return reply.redirect(successUrl)
        }

        // 如果订单待支付，尝试完成订单
        if (order.status === 'pending') {
          const result = await completeOrder(outTradeNo, tradeNo)
          if (result.success) {
            const successUrl = `${config.CORS_ORIGIN}/payment/success?orderNo=${outTradeNo}`
            return reply.redirect(successUrl)
          }
        }

        // 其他状态（cancelled / refunded）或完成失败，跳转失败页
        return reply.redirect(failUrl)
      } catch (e) {
        request.log.error({ err: e, outTradeNo }, 'alipay sync return processing failed')
        return reply.redirect(failUrl)
      }
    },
  )

  // ==========================================================================
  // 3. POST /payments/subscription/renew - 连续订阅自动续费
  //
  // Body: { planId, paymentMethod }
  // 鉴权后创建新订单并调用对应支付渠道预下单，返回预支付信息。
  // ==========================================================================
  server.post(
    '/payments/subscription/renew',
    {
      schema: buildSchema({
        summary: '连续订阅续费',
        description: '鉴权后创建新订单并调用对应支付渠道预下单,返回预支付信息(需有效 VIP 订阅)',
        tags: ['Payment'],
        body: subscriptionRenewSchema,
      }),
    },
    async (request, reply) => {
      await authenticate(request)
      const userId = request.userId!

      const parsed = subscriptionRenewSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { planId, paymentMethod } = parsed.data

      // 查询订阅方案
      const [plan] = await db
        .select()
        .from(plans)
        .where(and(eq(plans.id, planId), eq(plans.isActive, true)))
        .limit(1)

      if (!plan) {
        return reply.status(404).send(error(404, '订阅方案不存在或已下架'))
      }

      // 确认当前有有效 VIP 订阅（仅 VIP 用户可续费）
      const [vip] = await db
        .select()
        .from(userVips)
        .where(
          and(
            eq(userVips.userId, userId),
            eq(userVips.status, 1),
            gte(userVips.endTime, new Date()),
          ),
        )
        .limit(1)

      if (!vip) {
        return reply.status(400).send(error(400, '当前无有效 VIP 订阅，无法续费'))
      }

      // 创建新订单（status=pending）
      const order = await placeOrder({
        userId,
        amount: plan.price,
        orderType: 1, // membership
        payType: paymentMethod,
        description: `连续订阅续费 - ${plan.name}`,
      })

      // 设置订单关联的方案 ID
      await db
        .update(orders)
        .set({ planId: plan.id, updatedAt: new Date() })
        .where(eq(orders.id, order.id))

      // 根据支付方式调用预支付
      let payInfo: Record<string, unknown>

      if (paymentMethod === 'wechat') {
        if (!isWechatPayConfigured()) {
          payInfo = { mock: true }
        } else {
          const prepayId = await jsapiPrepay({
            outTradeNo: order.orderNo,
            amount: plan.price,
            description: `连续订阅续费 - ${plan.name}`,
            openId: '',
            notifyUrl: env.WX_PAY_NOTIFY_URL ?? '',
          })
          const sign = buildJsapiSign(prepayId)
          payInfo = { prepayId, ...sign }
        }
      } else {
        // alipay
        if (!isAlipayConfigured()) {
          payInfo = { mock: true }
        } else {
          const amountYuan = (plan.price / 100).toFixed(2)
          const bizContent = {
            out_trade_no: order.orderNo,
            total_amount: amountYuan,
            subject: `连续订阅续费 - ${plan.name}`,
            product_code: 'FAST_INSTANT_TRADE_PAY',
          }
          const payUrl = buildSignedUrl(bizContent, 'alipay.trade.page.pay')
          payInfo = { payUrl }
        }
      }

      return reply.send(
        success({
          orderId: order.id,
          orderNo: order.orderNo,
          payInfo,
        }),
      )
    },
  )

  // ==========================================================================
  // 4. GET /payments/subscription/status - 查询订阅状态
  //
  // 鉴权后查询当前用户的 VIP 订阅状态。
  // 返回: { isVip, vipLevel, endTime, autoRenew, planName }
  // ==========================================================================
  server.get(
    '/payments/subscription/status',
    {
      schema: buildSchema({
        summary: '查询订阅状态',
        description:
          '鉴权后查询当前用户的 VIP 订阅状态(返回 isVip/vipLevel/endTime/autoRenew/planName)',
        tags: ['Payment'],
      }),
    },
    async (request, reply) => {
      await authenticate(request)
      const userId = request.userId!

      // 查询当前有效的 VIP 订阅（关联 VIP 等级表获取等级名称）
      const [vipRow] = await db
        .select({
          userVip: userVips,
          levelName: vipLevels.levelName,
        })
        .from(userVips)
        .leftJoin(vipLevels, eq(userVips.vipLevelId, vipLevels.id))
        .where(
          and(
            eq(userVips.userId, userId),
            eq(userVips.status, 1),
            gte(userVips.endTime, new Date()),
          ),
        )
        .orderBy(desc(userVips.createdAt))
        .limit(1)

      if (!vipRow) {
        return reply.send(
          success({
            isVip: false,
            vipLevel: 0,
            endTime: null,
            autoRenew: false,
            planName: null,
          }),
        )
      }

      return reply.send(
        success({
          isVip: true,
          vipLevel: vipRow.userVip.levelValue,
          endTime: vipRow.userVip.endTime,
          autoRenew: vipRow.userVip.autoRenew === 1,
          planName: vipRow.levelName,
        }),
      )
    },
  )
}
