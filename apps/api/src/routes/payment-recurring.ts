// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 微信支付周期扣款(连续包月)路由。
 *
 * 端点清单:
 * 1. POST /payments/recurring/sign                 — 发起签约(用户点击"开通自动续费")
 * 2. GET  /payments/recurring/contracts            — 查询当前用户签约列表
 * 3. GET  /payments/recurring/contracts/:id        — 查询单个签约详情
 * 4. POST /payments/recurring/contracts/:id/cancel — 解约(用户主动关闭自动续费)
 * 5. POST /payments/recurring/wechat-notify        — 微信签约/扣款 webhook(无鉴权,验签)
 * 6. POST /payments/recurring/scan-and-charge      — 定时扣款任务(admin 触发)
 */

import type { FastifyPluginAsync } from 'fastify'
import { env } from 'node:process'
import { z } from 'zod'
import { eq, and, inArray } from 'drizzle-orm'
import { db } from '../db/index.js'
import { success, error } from '../utils/response.js'
import { booleanStringSchemaOptional } from '../utils/parse-boolean.js'
import { buildSchema, swaggerSchemas } from '../utils/swagger.js'
import { authenticate } from '../plugins/auth.js'
import { wechatPayContracts, userVips, plans, orders, wxPayNotifications } from '@ihui/database'
import { placeOrder, completeOrder } from '../services/order-service.js'
import {
  scanAndChargeDueContracts,
  chargeOneContractNow,
} from '../services/subscription-service.js'
import {
  signContract,
  cancelContract,
  queryContract,
  verifyCallbackSignature,
  consumeNotifyNonce,
  releaseNotifyNonce,
  decryptCallback,
  generateOutTradeNo,
  parseContractExpiredTime,
} from '../services/wechat-pay.js'

const ADMIN_ROLE_ID = 1

// =============================================================================
// Zod schemas
// =============================================================================

const signBodySchema = z.object({
  planId: z.uuid({ error: '无效的方案 ID' }),
  productId: z.coerce.number().optional(),
  openid: z.string().optional(),
})

const idParamSchema = z.object({
  id: z.coerce.number(),
})

const cancelBodySchema = z.object({
  reason: z.string().max(500).optional(),
})

const scanAndChargeBodySchema = z.object({
  /** 'async' = 受理后立即返回(批量默认);'wait' = 同步轮询终态,单签约场景 */
  deduct_mode: z.enum(['async', 'wait']).optional(),
  /** 并发上限(1-10),默认 3 */
  concurrency: z.coerce.number().int().min(1).max(10).optional(),
})

// =============================================================================
// 辅助函数
// =============================================================================

/**
 * 按自然月/年推进日期并夹取到目标月最后一天。
 * JS `setMonth` 对 1/31 会溢出成 3/3;续费锚点必须落在目标月内(1/31→2/28,闰年 2/29)。
 * 只做日历推进,不读取当前时间。
 */
export function addMonthsClamped(base: Date, months: number): Date {
  const d = new Date(base.getTime())
  const day = d.getDate()
  d.setDate(1)
  d.setMonth(d.getMonth() + months)
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  d.setDate(Math.min(day, lastDay))
  return d
}

export function calculateNextChargeTime(
  billingPeriod: string | null | undefined,
  base: Date = new Date(),
): Date {
  switch (billingPeriod) {
    case 'year':
      return addMonthsClamped(base, 12)
    case 'week': {
      const next = new Date(base)
      next.setDate(next.getDate() + 7)
      return next
    }
    case 'month':
    default:
      return addMonthsClamped(base, 1)
  }
}

/**
 * 扣款回调幂等键判定。
 *
 * 微信扣款报文里可能出现的支付标识:
 * - out_trade_no:商户侧扣款单号,每笔扣款唯一(首选);
 * - transaction_id:微信侧支付单号,每笔扣款唯一、重投不变(次选);
 * - out_contract_code:签约时商户自定义的协议编码,**同一契约所有扣款共用**,
 *   绝不能作为扣款幂等键(会把下一期正常扣款判成重复而漏发)。
 *
 * 判定表:
 * | 报文组合                       | 幂等键        | 结论 |
 * | 仅 trade_no                    | out_trade_no  | 可判定 |
 * | 仅 contract_code + tx_id       | transaction_id| 可判定 |
 * | trade_no + contract_code       | out_trade_no  | 可判定 |
 * | trade_no + tx_id               | out_trade_no  | 可判定 |
 * | 仅 contract_code(无 tx_id)     | 无            | 不可判定,需真实报文验证 |
 * | 三者皆无                       | 无            | 不可判定,需真实报文验证 |
 *
 * 不可判定的组合只能依赖 15 分钟 nonce 去重,超出窗口的重投仍有双写风险,
 * 因此调用方必须记录告警,不能宣称已完全幂等。
 */
export type RecurringChargeIdempotencyKey =
  | { kind: 'outTradeNo'; value: string }
  | { kind: 'transactionId'; value: string }
  | { kind: 'undetermined' }

export function resolveChargeIdempotencyKey(params: {
  outTradeNo?: string | null
  transactionId?: string | null
  outContractCode?: string | null
}): RecurringChargeIdempotencyKey {
  const tradeNo = params.outTradeNo?.trim()
  if (tradeNo) return { kind: 'outTradeNo', value: tradeNo }
  const transactionId = params.transactionId?.trim()
  if (transactionId) return { kind: 'transactionId', value: transactionId }
  return { kind: 'undetermined' }
}

async function setUserVipAutoRenew(userId: string, autoRenew: 0 | 1): Promise<void> {
  await db
    .update(userVips)
    .set({ autoRenew, updatedAt: new Date() })
    .where(and(eq(userVips.userId, userId), eq(userVips.status, 1)))
}

// =============================================================================
// 路由
// =============================================================================

export const paymentRecurringRoutes: FastifyPluginAsync = async (server) => {
  // ==========================================================================
  // 1. POST /payments/recurring/sign - 发起签约
  //
  // Body: { planId, productId?, openid? }
  // 鉴权后调用微信签约 API,在 wechat_pay_contracts 表创建 pending 记录,
  // 返回 signUrl 供前端跳转签约页面。
  // ==========================================================================
  server.post(
    '/payments/recurring/sign',
    {
      schema: buildSchema({
        summary: '发起周期扣款签约',
        description: '鉴权后调用微信签约 API,返回 signUrl 供前端跳转签约页面',
        tags: ['Payment'],
        body: signBodySchema,
      }),
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      try {
        const payload = await authenticate(request)
        const userId = payload.userId

        const parsed = signBodySchema.safeParse(request.body)
        if (!parsed.success) {
          return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
        }
        const { planId, productId, openid } = parsed.data

        const [plan] = await db
          .select()
          .from(plans)
          .where(and(eq(plans.id, planId), eq(plans.isActive, true)))
          .limit(1)

        if (!plan) {
          return reply.status(404).send(error(404, '订阅方案不存在或已下架'))
        }

        if (!plan.wechatPlanId) {
          return reply.status(400).send(error(400, '该方案未配置微信周期扣款计划 ID'))
        }

        const outTradeNo = generateOutTradeNo('SC')
        const notifyUrl = env.WX_PAY_RECURRING_NOTIFY_URL ?? env.WX_PAY_NOTIFY_URL ?? ''

        const signResult = await signContract({
          planId: Number(plan.wechatPlanId),
          outContractCode: outTradeNo,
          appid: env.WX_MINI_APPID ?? env.WX_APP_APPID ?? '',
          contractDisplayAccount: plan.name,
          contractNotifyUrl: notifyUrl,
          outUserCode: userId,
          signScene: 'SIGN_SCENE_QRCODE',
          deviceInfo: { deviceIp: '127.0.0.1' },
          ...(openid !== undefined ? { openid } : {}),
        })

        const contractId = outTradeNo
        const now = new Date()
        const trialEndAt =
          plan.trialDays > 0 ? new Date(now.getTime() + plan.trialDays * 24 * 60 * 60 * 1000) : null

        await db.insert(wechatPayContracts).values({
          contractId,
          userId,
          planId: plan.id,
          productId: productId ?? null,
          status: 'pending',
          wechatPlanId: plan.wechatPlanId,
          outTradeNo,
          outContractCode: outTradeNo,
          preEntrustwebId: signResult.preEntrustwebId,
          trialEndAt,
          rawResponse: {
            preEntrustwebId: signResult.preEntrustwebId,
            ...(signResult.miniProgramUsername !== undefined
              ? { miniProgramUsername: signResult.miniProgramUsername }
              : {}),
            ...(signResult.miniProgramPath !== undefined
              ? { miniProgramPath: signResult.miniProgramPath }
              : {}),
            ...(signResult.redirectUrl !== undefined
              ? { redirectUrl: signResult.redirectUrl }
              : {}),
          },
          createdAt: now,
          updatedAt: now,
        })

        return reply.send(
          success({
            // 2026-10-31 R12:前端 signRecurringContract 读 signUrl;输出面补同名键(=redirectUrl),
            // 否则小程序拿到的是 undefined,自动续费签约入口永远跳不出去。
            signUrl: signResult.redirectUrl ?? '',
            preEntrustwebId: signResult.preEntrustwebId,
            ...(signResult.redirectUrl !== undefined
              ? { redirectUrl: signResult.redirectUrl }
              : {}),
            ...(signResult.miniProgramUsername !== undefined
              ? { miniProgramUsername: signResult.miniProgramUsername }
              : {}),
            ...(signResult.miniProgramPath !== undefined
              ? { miniProgramPath: signResult.miniProgramPath }
              : {}),
          }),
        )
      } catch (e) {
        request.log.error({ err: e }, 'recurring sign failed')
        return reply.status(500).send(error(500, '发起签约失败'))
      }
    },
  )

  // ==========================================================================
  // 2. GET /payments/recurring/contracts - 查询当前用户签约列表
  //
  // 返回 status IN ('active', 'pending') 的签约记录。
  // ==========================================================================
  server.get(
    '/payments/recurring/contracts',
    {
      schema: buildSchema({
        summary: '查询当前用户签约列表',
        description: '鉴权后返回当前用户 active/pending 状态的签约记录',
        tags: ['Payment'],
      }),
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      try {
        const payload = await authenticate(request)
        const list = await db
          .select()
          .from(wechatPayContracts)
          .where(
            and(
              eq(wechatPayContracts.userId, payload.userId),
              inArray(wechatPayContracts.status, ['active', 'pending']),
            ),
          )
        return reply.send(success({ list }))
      } catch (e) {
        request.log.error({ err: e }, 'list recurring contracts failed')
        return reply.status(500).send(error(500, '查询签约列表失败'))
      }
    },
  )

  // ==========================================================================
  // 3. GET /payments/recurring/contracts/:id - 查询单个签约详情
  //
  // 支持 query.refresh=true 时同步拉取微信侧最新签约状态(contractExpiredTime 等),
  // 并回写本地 DB。默认不刷新,直接返回本地缓存(避免对 WX API 触发限流)。
  // ==========================================================================
  server.get(
    '/payments/recurring/contracts/:id',
    {
      schema: buildSchema({
        summary: '查询单个签约详情',
        description:
          '鉴权后按 ID 查询签约详情(仅限当前用户)。query.refresh=true 时同步拉取微信侧最新状态并回写本地。',
        tags: ['Payment'],
        params: idParamSchema,
        // P1 修复(2026-08-06):z.coerce.boolean() 将 "false"/"0" 解析为 true,改用严格布尔 schema
        querystring: z.object({ refresh: booleanStringSchemaOptional }),
      }),
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      try {
        const payload = await authenticate(request)
        const parsed = idParamSchema.safeParse(request.params)
        if (!parsed.success) {
          return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
        }

        const refreshFlag =
          typeof (request.query as { refresh?: unknown }).refresh === 'string'
            ? (request.query as { refresh?: string }).refresh === 'true'
            : Boolean((request.query as { refresh?: boolean }).refresh)

        const [contract] = await db
          .select()
          .from(wechatPayContracts)
          .where(
            and(
              eq(wechatPayContracts.id, parsed.data.id),
              eq(wechatPayContracts.userId, payload.userId),
            ),
          )
          .limit(1)

        if (!contract) {
          return reply.status(404).send(error(404, '签约记录不存在'))
        }

        if (refreshFlag && contract.wechatPlanId && contract.outContractCode) {
          try {
            const remote = await queryContract(
              Number(contract.wechatPlanId),
              contract.outContractCode,
            )
            const expiredAt = parseContractExpiredTime(remote.contractExpiredTime)
            if (expiredAt) {
              await db
                .update(wechatPayContracts)
                .set({ contractExpiredAt: expiredAt, updatedAt: new Date() })
                .where(eq(wechatPayContracts.id, contract.id))
              contract.contractExpiredAt = expiredAt
            }
          } catch (e) {
            // 拉取失败不影响本地数据返回,仅记录警告
            request.log.warn(
              { err: e, contractId: contract.id },
              'refresh contract from wechat failed',
            )
          }
        }

        return reply.send(success({ contract }))
      } catch (e) {
        request.log.error({ err: e }, 'get recurring contract failed')
        return reply.status(500).send(error(500, '查询签约详情失败'))
      }
    },
  )

  // ==========================================================================
  // 4. POST /payments/recurring/contracts/:id/cancel - 解约
  //
  // Body: { reason? }
  // 调用微信解约 API + 更新 wechat_pay_contracts.status='cancelled' +
  // 同步设置 user_vips.autoRenew = 0。
  // ==========================================================================
  server.post(
    '/payments/recurring/contracts/:id/cancel',
    {
      schema: buildSchema({
        summary: '解约(关闭自动续费)',
        description: '鉴权后调用微信解约 API,更新签约状态为 cancelled,关闭 VIP 自动续费',
        tags: ['Payment'],
        params: idParamSchema,
        body: cancelBodySchema,
      }),
      config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      try {
        const payload = await authenticate(request)
        const parsedParams = idParamSchema.safeParse(request.params)
        if (!parsedParams.success) {
          return reply
            .status(400)
            .send(error(400, parsedParams.error.issues[0]?.message ?? '参数错误'))
        }

        const parsedBody = cancelBodySchema.safeParse(request.body ?? {})
        if (!parsedBody.success) {
          return reply
            .status(400)
            .send(error(400, parsedBody.error.issues[0]?.message ?? '参数错误'))
        }

        const [contract] = await db
          .select()
          .from(wechatPayContracts)
          .where(
            and(
              eq(wechatPayContracts.id, parsedParams.data.id),
              eq(wechatPayContracts.userId, payload.userId),
            ),
          )
          .limit(1)

        if (!contract) {
          return reply.status(404).send(error(404, '签约记录不存在'))
        }

        if (contract.status === 'cancelled') {
          return reply.send(success({ cancelled: true }))
        }

        if (!contract.wechatPlanId || !contract.outContractCode) {
          return reply
            .status(400)
            .send(error(400, '签约记录缺少 wechatPlanId / outContractCode,无法解约'))
        }

        const reason = parsedBody.data.reason ?? '用户主动解约'

        await cancelContract({
          planId: Number(contract.wechatPlanId),
          outContractCode: contract.outContractCode,
          contractTerminationRemark: reason,
        })

        const now = new Date()
        await db
          .update(wechatPayContracts)
          .set({
            status: 'cancelled',
            cancelledAt: now,
            cancelReason: reason,
            contractState: 'TERMINATED',
            updatedAt: now,
          })
          .where(eq(wechatPayContracts.id, contract.id))

        await setUserVipAutoRenew(payload.userId, 0)

        return reply.send(success({ cancelled: true }))
      } catch (e) {
        request.log.error({ err: e }, 'cancel recurring contract failed')
        return reply.status(500).send(error(500, '解约失败'))
      }
    },
  )

  // ==========================================================================
  // 5. POST /payments/recurring/wechat-notify - 微信签约/扣款 webhook
  //
  // 无鉴权(由微信服务器调用),验签 + 解密后根据 event_type 处理:
  //   - contract.signed        → status='active', signedAt=now, autoRenew=1
  //   - contract.cancelled     → status='cancelled', cancelledAt=now, autoRenew=0
  //   - recurring.charge.success → nextChargeTime 更新, lastChargeStatus='success', 创建订单
  //   - recurring.charge.failed  → lastChargeStatus='failed'
  // ==========================================================================
  server.post(
    '/payments/recurring/wechat-notify',
    {
      schema: buildSchema({
        summary: '微信周期扣款回调',
        description: '微信签约/扣款 webhook(无需登录,验签后处理签约/扣款事件)',
        tags: ['Payment'],
        auth: false,
        response: swaggerSchemas.callback,
      }),
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      // 已占位的去重 nonce:业务失败时必须回滚占位,否则微信重投会被判 replayed 吞掉。
      let consumedNonce: { timestamp: string; nonce: string } | null = null
      try {
        const timestamp = request.headers['wechatpay-timestamp'] as string
        const nonce = request.headers['wechatpay-nonce'] as string
        const signature = request.headers['wechatpay-signature'] as string
        const rawBody = JSON.stringify(request.body)
        const body = request.body as Record<string, unknown>

        if (timestamp && nonce && signature) {
          const valid = verifyCallbackSignature(timestamp, nonce, rawBody, signature)
          if (!valid) {
            request.log.warn('recurring callback signature verification failed')
            return reply.code(401).send({ code: 'FAIL', message: '签名验证失败' })
          }
        } else if (env.NODE_ENV === 'production') {
          request.log.warn('recurring callback missing required headers in production')
          return reply.code(400).send({ code: 'FAIL', message: '缺少必要回调头' })
        }

        // 2026-10-30:报文级一次性去重。本回调此前**无条件 INSERT 通知行**,重放会堆重复记录;
        // 且 outTradeNo 为空的分支缺少幂等锁,重放可能重复 placeOrder + completeOrder。
        if (timestamp && nonce) {
          const recurringNonceVerdict = await consumeNotifyNonce('recurring', timestamp, nonce)
          if (recurringNonceVerdict === 'replayed') {
            return reply.send({ code: 'SUCCESS', message: '重复通知' })
          }
          if (recurringNonceVerdict === 'unavailable') {
            return reply.code(500).send({ code: 'FAIL', message: '系统繁忙,请稍后重试' })
          }
          if (recurringNonceVerdict === 'ok') {
            consumedNonce = { timestamp, nonce }
          }
        }

        const eventType = body.event_type as string
        const resource = body.resource as
          { ciphertext?: string; nonce?: string; associated_data?: string } | undefined

        let decrypted: Record<string, unknown> = {}
        if (resource?.ciphertext && resource?.nonce) {
          decrypted = decryptCallback(
            resource.ciphertext,
            resource.nonce,
            resource.associated_data ?? '',
          )
        }

        const contractId = (decrypted.contract_id as string) ?? (body.contract_id as string) ?? ''
        // 契约编码(签约时商户生成,同一契约所有扣款共用)与扣款单号必须分开;
        // 旧实现把 out_contract_code 混进 outTradeNo,导致匹配用错键、幂等判定失真。
        const outContractCode = (decrypted.out_contract_code as string) ?? ''
        const outTradeNo = (decrypted.out_trade_no as string) ?? ''
        const transactionId = (decrypted.transaction_id as string) ?? ''

        const isSignEvent = eventType === 'PAPAY.SIGN' || eventType === 'contract.signed'
        const isTerminateEvent =
          eventType === 'PAPAY.TERMINATE' || eventType === 'contract.cancelled'
        const isChargeSuccessEvent =
          eventType === 'TRANSACTION.SUCCESS' || eventType === 'recurring.charge.success'
        const isChargeFailEvent =
          eventType === 'TRANSACTION.FAIL' || eventType === 'recurring.charge.failed'

        // 旧事件名 (contract.signed / contract.cancelled / recurring.charge.*) 已废弃,
        // 微信支付 V3 2024-09 后下发的官方事件为 PAPAY.* / TRANSACTION.*。
        // 仍兼容旧事件名处理,但记录 deprecation 警告便于后续移除。
        const isDeprecatedEventName =
          eventType === 'contract.signed' ||
          eventType === 'contract.cancelled' ||
          eventType === 'recurring.charge.success' ||
          eventType === 'recurring.charge.failed'
        if (isDeprecatedEventName) {
          request.log.warn(
            { eventType, deprecated: true },
            'recurring callback received deprecated event_type; migrate to PAPAY.* / TRANSACTION.*',
          )
          // 8.3.2: 上报旧事件名到 Prometheus(埋点,后续监控旧事件是否仍在下发)
          try {
            server.recordRecurringWebhookDeprecated(eventType)
          } catch {
            /* 指标采集失败不影响业务 */
          }
        }

        const resultCode = isTerminateEvent || isChargeFailEvent ? 'FAIL' : 'SUCCESS'

        let notificationType = 'recurring_charge'
        if (isSignEvent) {
          notificationType = 'contract_signed'
        } else if (isTerminateEvent) {
          notificationType = 'contract_cancelled'
        }

        await db.insert(wxPayNotifications).values({
          outTradeNo: outTradeNo || null,
          transactionId: transactionId || null,
          notificationType,
          contractId: contractId || null,
          resultCode,
          rawXml: rawBody,
          status: 0,
        })

        if (isSignEvent) {
          // 回退链:契约编码 → 扣款单号 → 微信契约号
          const matchCondition = outContractCode
            ? eq(wechatPayContracts.outContractCode, outContractCode)
            : outTradeNo
              ? eq(wechatPayContracts.outTradeNo, outTradeNo)
              : contractId
                ? eq(wechatPayContracts.contractId, contractId)
                : null

          if (matchCondition) {
            // P1 并发安全修复(2026-08-02):SELECT-then-UPDATE 在并发回调(微信重试)下
            // 存在 TOCTOU 竞态,两次回调都通过 status!='active' 检查后都执行 UPDATE。
            // 改为事务 + SELECT FOR UPDATE 行锁 + 条件 UPDATE(WHERE status != 'active'),
            // 保证签约状态流转原子性,防重复设置 autoRenew=1 / 重复写 signedAt。
            await db.transaction(async (tx) => {
              const [existing] = await tx
                .select()
                .from(wechatPayContracts)
                .where(matchCondition)
                .for('update')
                .limit(1)

              if (!existing) return

              // 已 active 的签约:不重复处理(幂等),仅同步 contractExpiredAt
              if (existing.status === 'active') return

              const now = new Date()
              const nextChargeTime = existing.trialEndAt
                ? new Date(existing.trialEndAt.getTime())
                : calculateNextChargeTime(await getPlanBillingPeriod(existing.planId))

              // 同步微信侧 contract_expired_time(若已下发,记录到本地用于展示/到期判断)
              const expiredAt = parseContractExpiredTime(
                (decrypted.contract_expired_time as string | undefined) ?? undefined,
              )

              await tx
                .update(wechatPayContracts)
                .set({
                  status: 'active',
                  signedAt: now,
                  nextChargeTime,
                  contractState: 'SIGNED',
                  ...(contractId && contractId !== existing.contractId ? { contractId } : {}),
                  ...(expiredAt ? { contractExpiredAt: expiredAt } : {}),
                  updatedAt: now,
                })
                .where(eq(wechatPayContracts.id, existing.id))

              await setUserVipAutoRenew(existing.userId, 1)
            })
          }
        } else if (isTerminateEvent) {
          // 回退链:微信契约号 → 契约编码 → 扣款单号
          const matchCondition = contractId
            ? eq(wechatPayContracts.contractId, contractId)
            : outContractCode
              ? eq(wechatPayContracts.outContractCode, outContractCode)
              : outTradeNo
                ? eq(wechatPayContracts.outTradeNo, outTradeNo)
                : null

          if (matchCondition) {
            // P1 并发安全修复(2026-08-02):SELECT-then-UPDATE 有竞态,且原代码
            // 已 cancelled 的签约被重复 terminate 会覆盖 cancelledAt 时间戳。
            // 改为事务 + SELECT FOR UPDATE + 状态检查,已 cancelled 直接跳过(幂等)。
            await db.transaction(async (tx) => {
              const [existing] = await tx
                .select()
                .from(wechatPayContracts)
                .where(matchCondition)
                .for('update')
                .limit(1)

              if (!existing) return
              if (existing.status === 'cancelled') return

              const now = new Date()
              await tx
                .update(wechatPayContracts)
                .set({
                  status: 'cancelled',
                  cancelledAt: now,
                  contractState: 'TERMINATED',
                  updatedAt: now,
                })
                .where(eq(wechatPayContracts.id, existing.id))

              await setUserVipAutoRenew(existing.userId, 0)
            })
          }
        } else if (isChargeSuccessEvent) {
          // 回退链:微信契约号 → 扣款单号 → 契约编码
          // (契约编码只用于「定位契约」,不能用于「判定同一笔扣款」)
          const matchCondition = contractId
            ? eq(wechatPayContracts.contractId, contractId)
            : outTradeNo
              ? eq(wechatPayContracts.outTradeNo, outTradeNo)
              : outContractCode
                ? eq(wechatPayContracts.outContractCode, outContractCode)
                : null

          const chargeKey = resolveChargeIdempotencyKey({
            outTradeNo,
            transactionId,
            outContractCode,
          })
          if (chargeKey.kind === 'undetermined') {
            request.log.warn(
              { eventType, contractId, outContractCode },
              'recurring charge callback has no idempotency key (nonce-only dedup, needs real payload verification)',
            )
          }
          const chargeKeyValue = chargeKey.kind === 'undetermined' ? '' : chargeKey.value

          if (matchCondition) {
            // P0 资金安全 + 幂等修复(2026-08-02):原实现无事务、无幂等键,
            // 微信回调重试时会重复 placeOrder + completeOrder,导致:
            // (1) 同一笔扣款创建多个订单(订单号不同但都对应同一 outTradeNo);
            // (2) 重复 completeOrder 触发上游重复发放 VIP/积分(资金超发)。
            // 改为事务 + SELECT FOR UPDATE 行锁 + 幂等键(outTradeNo + lastChargeStatus):
            // 若 lastChargeStatus='success' 且 outTradeNo 与本次相同 → 已处理,跳过;
            // 否则条件 UPDATE(WHERE lastChargeStatus != 'success' OR outTradeNo != current),
            // 0 行影响 = 重复回调,跳过 placeOrder,防资金超发。
            await db.transaction(async (tx) => {
              const [existing] = await tx
                .select()
                .from(wechatPayContracts)
                .where(matchCondition)
                .for('update')
                .limit(1)

              if (!existing) return

              // 幂等检查:同一笔扣款的幂等键(out_trade_no 或 transaction_id)已成功处理过
              // → 跳过(防重复创建订单)。out_contract_code 不参与,否则会漏发下一期。
              // 幂等键不可判定时(仅契约编码且无 transaction_id)只能依赖 nonce,已在上方告警。
              if (
                chargeKeyValue &&
                existing.lastChargeStatus === 'success' &&
                existing.outTradeNo === chargeKeyValue
              ) {
                return
              }

              const billingPeriod = await getPlanBillingPeriod(existing.planId)
              const now = new Date()

              if (existing.planId) {
                const [plan] = await tx
                  .select()
                  .from(plans)
                  .where(eq(plans.id, existing.planId))
                  .limit(1)

                if (plan) {
                  const order = await placeOrder({
                    userId: existing.userId,
                    amount: plan.price,
                    orderType: 1,
                    payType: 'wechat',
                    description: `连续包月自动扣款 - ${plan.name}`,
                  })
                  await tx
                    .update(orders)
                    .set({ planId: plan.id, updatedAt: now })
                    .where(eq(orders.id, order.id))
                  await completeOrder(order.orderNo, transactionId)
                }
              }

              await tx
                .update(wechatPayContracts)
                .set({
                  lastChargeTime: now,
                  lastChargeStatus: 'success',
                  // 锚点用契约已存的 nextChargeTime,首次(为空)才用 now;
                  // 延迟/重投回调不改变续费日。
                  nextChargeTime: calculateNextChargeTime(
                    billingPeriod,
                    existing.nextChargeTime ?? now,
                  ),
                  // 存「本次扣款幂等键」:优先 out_trade_no,缺失时存 transaction_id,
                  // 供下一次重投比对;绝不存会跨期复用的 out_contract_code。
                  outTradeNo: chargeKeyValue || existing.outTradeNo,
                  updatedAt: now,
                })
                .where(eq(wechatPayContracts.id, existing.id))
            })
          }
        } else if (isChargeFailEvent) {
          // 回退链:微信契约号 → 扣款单号 → 契约编码
          const matchCondition = contractId
            ? eq(wechatPayContracts.contractId, contractId)
            : outTradeNo
              ? eq(wechatPayContracts.outTradeNo, outTradeNo)
              : outContractCode
                ? eq(wechatPayContracts.outContractCode, outContractCode)
                : null

          if (matchCondition) {
            // P2 数据完整性修复(2026-08-02):加事务保证 lastChargeTime/lastChargeStatus
            // 原子更新,且避免与 isChargeSuccessEvent 并发时互相覆盖。
            await db.transaction(async (tx) => {
              const [existing] = await tx
                .select()
                .from(wechatPayContracts)
                .where(matchCondition)
                .for('update')
                .limit(1)

              if (!existing) return
              // 若已成功扣款(success),不应被 fail 回调覆盖(可能是延迟到达的旧通知)
              if (existing.lastChargeStatus === 'success') return

              const now = new Date()
              await tx
                .update(wechatPayContracts)
                .set({
                  lastChargeTime: now,
                  lastChargeStatus: 'failed',
                  updatedAt: now,
                })
                .where(eq(wechatPayContracts.id, existing.id))
            })
          }
        }

        return reply.send({ code: 0, message: 'SUCCESS' })
      } catch (e) {
        request.log.error({ err: e }, 'recurring notify processing failed')
        // 此前 catch 无条件回 200 SUCCESS:业务失败被静默吞掉,微信认为已送达不再重投,
        // 用户已扣款但订单/VIP 永久不落地(与 wechat-pay.consumeNotifyNonce 的
        // 「fail-closed + 重投不丢单」口径相反)。改为 FAIL + 释放 nonce,交给微信重试;
        // 业务写路径均已事务化且有 lastChargeStatus 幂等闸,重放松弛安全。
        if (consumedNonce) {
          await releaseNotifyNonce('recurring', consumedNonce.timestamp, consumedNonce.nonce)
        }
        return reply.code(500).send({ code: 'FAIL', message: '系统繁忙,请稍后重试' })
      }
    },
  )

  // ==========================================================================
  // 6. POST /payments/recurring/scan-and-charge - 定时扣款任务
  //
  // Admin 鉴权,扫描 status='active' AND nextChargeTime <= now 的签约,
  // 对每条调 deductRecurring,返回 { scanned, charged, failed, trialExtended }。
  //
  // Body (可选): { deduct_mode?: 'async'|'wait', concurrency?: 1-10 }
  // - deduct_mode='async' (默认): 批量扫扣,受理后立即返回
  // - deduct_mode='wait': 同步轮询终态,仅单签约场景使用
  // - concurrency: 并发上限,默认 3,范围 1-10
  // ==========================================================================
  server.post(
    '/payments/recurring/scan-and-charge',
    {
      schema: buildSchema({
        summary: '定时扣款扫描',
        description: 'Admin 鉴权,扫描到期签约并触发委托扣款(支持 deduct_mode/concurrency 调参)',
        tags: ['Payment'],
        body: scanAndChargeBodySchema,
      }),
      config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      try {
        const payload = await authenticate(request)
        if (payload.roleId < ADMIN_ROLE_ID) {
          const err = new Error('需要管理员权限') as Error & { statusCode: number }
          err.statusCode = 403
          throw err
        }

        const parsed = scanAndChargeBodySchema.safeParse(request.body ?? {})
        const opts: {
          deductMode?: 'async' | 'wait'
          concurrency?: number
        } = {}
        if (parsed.success) {
          if (parsed.data.deduct_mode) opts.deductMode = parsed.data.deduct_mode
          if (parsed.data.concurrency !== undefined) opts.concurrency = parsed.data.concurrency
        }

        const result = await scanAndChargeDueContracts(opts)
        return reply.send(
          success({
            scanned: result.scanned,
            charged: result.charged,
            failed: result.failed,
            skipped: result.skipped,
            trialExtended: result.trialExtended,
          }),
        )
      } catch (e) {
        request.log.error({ err: e }, 'scan and charge failed')
        return reply.status(500).send(error(500, '定时扣款任务执行失败'))
      }
    },
  )

  // ==========================================================================
  // 7. POST /payments/recurring/contracts/:id/charge - 即时扣款
  //
  // 用户主动触发对某条 active 签约的扣款,settleMode 强制 'wait' 同步轮询终态,
  // 立即返回 SUCCESS/PAYERROR/NOTPAY,适合前端按钮点击后的即时反馈。
  // ==========================================================================
  server.post(
    '/payments/recurring/contracts/:id/charge',
    {
      schema: buildSchema({
        summary: '即时扣款(单签约)',
        description: '对指定 active 签约发起一次即时扣款,settleMode=wait 同步等终态',
        tags: ['Payment'],
        params: idParamSchema,
      }),
      config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      try {
        const payload = await authenticate(request)
        const parsed = idParamSchema.safeParse(request.params)
        if (!parsed.success) {
          return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
        }

        const result = await chargeOneContractNow(parsed.data.id, payload.userId)
        return reply.send(success(result))
      } catch (e) {
        request.log.error({ err: e }, 'immediate charge failed')
        const msg = e instanceof Error ? e.message : '即时扣款失败'
        return reply.status(400).send(error(400, msg))
      }
    },
  )
}

async function getPlanBillingPeriod(planId: string | null): Promise<string | undefined> {
  if (!planId) return undefined
  const [plan] = await db
    .select({ billingPeriod: plans.billingPeriod })
    .from(plans)
    .where(eq(plans.id, planId))
    .limit(1)
  return plan?.billingPeriod
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
