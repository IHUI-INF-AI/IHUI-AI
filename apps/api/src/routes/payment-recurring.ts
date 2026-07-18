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
  decryptCallback,
  generateOutTradeNo,
  parseContractExpiredTime,
} from '../services/wechat-pay.js'

const ADMIN_ROLE_ID = 1

// =============================================================================
// Zod schemas
// =============================================================================

const signBodySchema = z.object({
  planId: z.string().uuid('无效的方案 ID'),
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

function calculateNextChargeTime(billingPeriod: string | null | undefined): Date {
  const now = new Date()
  switch (billingPeriod) {
    case 'year': {
      const next = new Date(now)
      next.setFullYear(next.getFullYear() + 1)
      return next
    }
    case 'week': {
      const next = new Date(now)
      next.setDate(next.getDate() + 7)
      return next
    }
    case 'month':
    default: {
      const next = new Date(now)
      next.setMonth(next.getMonth() + 1)
      return next
    }
  }
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
        querystring: z.object({ refresh: z.coerce.boolean().optional() }),
      }),
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
    },
    async (request, reply) => {
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
        const outTradeNo =
          (decrypted.out_contract_code as string) ?? (decrypted.out_trade_no as string) ?? ''
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
          const matchCondition = outTradeNo
            ? eq(wechatPayContracts.outContractCode, outTradeNo)
            : outTradeNo
              ? eq(wechatPayContracts.outTradeNo, outTradeNo)
              : contractId
                ? eq(wechatPayContracts.contractId, contractId)
                : null

          if (matchCondition) {
            const [existing] = await db
              .select()
              .from(wechatPayContracts)
              .where(matchCondition)
              .limit(1)

            if (existing) {
              const now = new Date()
              const nextChargeTime = existing.trialEndAt
                ? new Date(existing.trialEndAt.getTime())
                : calculateNextChargeTime(await getPlanBillingPeriod(existing.planId))

              // 同步微信侧 contract_expired_time(若已下发,记录到本地用于展示/到期判断)
              const expiredAt = parseContractExpiredTime(
                (decrypted.contract_expired_time as string | undefined) ?? undefined,
              )

              await db
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
            }
          }
        } else if (isTerminateEvent) {
          const matchCondition = contractId
            ? eq(wechatPayContracts.contractId, contractId)
            : outTradeNo
              ? eq(wechatPayContracts.outContractCode, outTradeNo)
              : null

          if (matchCondition) {
            const [existing] = await db
              .select()
              .from(wechatPayContracts)
              .where(matchCondition)
              .limit(1)

            if (existing && existing.status !== 'cancelled') {
              const now = new Date()
              await db
                .update(wechatPayContracts)
                .set({
                  status: 'cancelled',
                  cancelledAt: now,
                  contractState: 'TERMINATED',
                  updatedAt: now,
                })
                .where(eq(wechatPayContracts.id, existing.id))

              await setUserVipAutoRenew(existing.userId, 0)
            }
          }
        } else if (isChargeSuccessEvent) {
          const matchCondition = contractId
            ? eq(wechatPayContracts.contractId, contractId)
            : outTradeNo
              ? eq(wechatPayContracts.outTradeNo, outTradeNo)
              : null

          if (matchCondition) {
            const [existing] = await db
              .select()
              .from(wechatPayContracts)
              .where(matchCondition)
              .limit(1)

            if (existing) {
              const billingPeriod = await getPlanBillingPeriod(existing.planId)
              const now = new Date()

              if (existing.planId) {
                const [plan] = await db
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
                  await db
                    .update(orders)
                    .set({ planId: plan.id, updatedAt: now })
                    .where(eq(orders.id, order.id))
                  await completeOrder(order.orderNo, transactionId)
                }
              }

              await db
                .update(wechatPayContracts)
                .set({
                  lastChargeTime: now,
                  lastChargeStatus: 'success',
                  nextChargeTime: calculateNextChargeTime(billingPeriod),
                  outTradeNo: outTradeNo || existing.outTradeNo,
                  updatedAt: now,
                })
                .where(eq(wechatPayContracts.id, existing.id))
            }
          }
        } else if (isChargeFailEvent) {
          const matchCondition = contractId
            ? eq(wechatPayContracts.contractId, contractId)
            : outTradeNo
              ? eq(wechatPayContracts.outTradeNo, outTradeNo)
              : null

          if (matchCondition) {
            const now = new Date()
            await db
              .update(wechatPayContracts)
              .set({
                lastChargeTime: now,
                lastChargeStatus: 'failed',
                updatedAt: now,
              })
              .where(matchCondition)
          }
        }

        return reply.send({ code: 0, message: 'SUCCESS' })
      } catch (e) {
        request.log.error({ err: e }, 'recurring notify processing failed')
        return reply.send({ code: 0, message: 'SUCCESS' })
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
