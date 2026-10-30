// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 小程序支付链的后端契约(2026-10-30 立)。
 *
 * 起因:小程序支付页 `pkg-shop/pay/index.tsx` 打的三个端点全仓不存在 ——
 *  - `GET  /coupons/available`            选券入口永远"暂无可用优惠券"
 *  - `POST /pay/balance`                  余额支付必然 404(点下去只弹"操作失败")
 *  - `POST /orders/:orderNo/apply-coupon` 选券不落订单(前端只能本地减金额,实付仍是原价)
 * 三者必须一起补:只补前两个会让"能选券、能点支付、但钱不对"更糟。
 *
 * 口径(一律以「分」为单位,与 orders.amount / user_margins.token_quantity 同尺度):
 *  - 券折减走 coupon-service 的单一算法源(calcCouponDiscount),预览与核销同源,
 *    不在本文件重新实现一遍折扣规则。
 *  - 余额支付只扣 `user_margins.token_quantity`(充值/提现/佣金共用的一本账);
 *    不碰 `user_token_balance` —— 该表除小程序买课外全仓零引用、无任何入账写入点,是孤儿表。
 *  - 余额支付的订单 `paymentMethod` 落 'balance':既如实记账,也让
 *    `/vip/order/:no/payinfo` 的主动查单分支(按 paymentMethod.startsWith('wechat'|'alipay') 走)
 *    不会对一张已用余额结清的订单再去网关查单。
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, and, desc, sql } from 'drizzle-orm'
import { success, error } from '../utils/response.js'
import { checkAuth } from '../plugins/auth.js'
import { db, dbRead } from '../db/index.js'
import { orders, userMargins, tokenFlows, userCoupons, promoCoupons } from '@ihui/database'
import { calcCouponDiscount, redeemCoupon, refundCoupon } from '../services/coupon-service.js'
import { activateOrderSubscription } from '../services/order-service.js'

/** 券不可用原因的对外文案(内部 reason 码 → 用户可读)。 */
const COUPON_REASON_TEXT: Record<string, string> = {
  expired: '已过期',
  not_started: '未到可用时间',
  disabled: '已停用',
  min_spend_not_met: '未满使用门槛',
  scope_not_applicable: '不适用于该商品',
  not_found: '优惠券不存在',
  not_owner: '优惠券不属于当前用户',
  already_used: '已使用',
  not_unused: '状态不可用',
}

const availableQuerySchema = z.object({
  // 订单金额(分)。允许缺省:缺省时按 0 算,券照常列出但满减券会被标门槛不足,
  // 好过整页报错(支付页详情还没回来时就会先打这一枪)。
  amount: z.coerce.number().int().nonnegative().max(100_000_000).optional().default(0),
})

const payBalanceBodySchema = z.object({
  orderNo: z.string().min(1).max(64),
})

const applyCouponBodySchema = z.object({
  // null/undefined = 取消已选券
  userCouponId: z.string().uuid().nullish(),
})

const orderNoParamsSchema = z.object({
  orderNo: z.string().min(1).max(64),
})

/** 订单原价基准:有 original_price 用它,否则用「现价 + 已折减」还原(下单时 original_price 落 0 的存量单)。 */
function basePriceOf(order: {
  amount: number
  originalPrice: number
  discountAmount: number
}): number {
  if (order.originalPrice > 0) return order.originalPrice
  return order.amount + Math.max(0, order.discountAmount)
}

export const miniappPayRoutes: FastifyPluginAsync = async (server) => {
  // ==========================================================================
  // GET /coupons/available — 我的可用券(带本单折减额)
  // ==========================================================================
  server.get('/coupons/available', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const userId = request.userId!
    const parsed = availableQuerySchema.safeParse(request.query ?? {})
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const spendCents = parsed.data.amount

    // 只取 unused 的券;过期/停用/门槛不足在本层判定,不靠清扫任务改库状态
    // (清扫是滞后的,库里 unused 的券可能早就过期了 —— 与 /user/coupons 的投影口径一致)
    const rows = await dbRead
      .select({ userCoupon: userCoupons, coupon: promoCoupons })
      .from(userCoupons)
      .innerJoin(promoCoupons, eq(userCoupons.couponId, promoCoupons.id))
      .where(and(eq(userCoupons.userId, userId), eq(userCoupons.status, 'unused')))
      .orderBy(desc(userCoupons.createdAt))

    const now = Date.now()
    const items = rows.map(({ userCoupon, coupon }) => {
      const base = {
        id: userCoupon.id,
        couponId: coupon.id,
        title: coupon.name,
        // amount/threshold 单位都是分,与支付页 CouponItem 契约一致
        amount: 0,
        threshold: coupon.minSpend ?? 0,
        expiresAt: coupon.expiresAt,
        usable: true,
        reason: '',
      }
      if (!coupon.enabled) {
        return { ...base, usable: false, reason: COUPON_REASON_TEXT.disabled! }
      }
      if (new Date(coupon.startsAt).getTime() > now) {
        return { ...base, usable: false, reason: COUPON_REASON_TEXT.not_started! }
      }
      if (new Date(coupon.expiresAt).getTime() < now) {
        return { ...base, usable: false, reason: COUPON_REASON_TEXT.expired! }
      }
      // 适用范围:支付页结算的是 VIP/课程(subscription 类),relay(中转站)券不适用
      if (coupon.applicableScope !== 'all' && coupon.applicableScope !== 'subscription') {
        return { ...base, usable: false, reason: COUPON_REASON_TEXT.scope_not_applicable! }
      }
      const calc = calcCouponDiscount(coupon, spendCents)
      if (calc.reason) {
        return {
          ...base,
          usable: false,
          reason: COUPON_REASON_TEXT[calc.reason] ?? calc.reason,
        }
      }
      // 折减 0 元的券对用户没有意义,按不可用处理(避免"选了没变化"的困惑)
      if (calc.discountCents <= 0) {
        return { ...base, usable: false, reason: '本单不可抵扣' }
      }
      return { ...base, usable: true, amount: calc.discountCents }
    })

    // 可用的排前面,再按折减额从大到小 —— 支付页直接把第一项当默认推荐
    const sorted = items.sort((a, b) => {
      if (a.usable !== b.usable) return a.usable ? -1 : 1
      return b.amount - a.amount
    })
    return reply.send(success({ items: sorted, total: sorted.length, amount: spendCents }))
  })

  // ==========================================================================
  // POST /orders/:orderNo/apply-coupon — 选券落到订单上(或取消)
  // ==========================================================================
  server.post('/orders/:orderNo/apply-coupon', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const userId = request.userId!
    const params = orderNoParamsSchema.safeParse(request.params)
    if (!params.success) return reply.status(400).send(error(400, '订单号不合法'))
    const body = applyCouponBodySchema.safeParse(request.body ?? {})
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    }
    const userCouponId = body.data.userCouponId ?? null

    const order = (
      await dbRead.select().from(orders).where(eq(orders.orderNo, params.data.orderNo)).limit(1)
    )[0]
    if (!order) return reply.status(404).send(error(404, '订单不存在'))
    if (order.userId && order.userId !== userId) {
      return reply.status(403).send(error(403, '无权操作此订单'))
    }
    if (order.status !== 'pending') {
      return reply.status(409).send(error(409, '订单状态不可改价'))
    }

    const basePrice = basePriceOf(order)
    // 这一单已经核销出去的券(靠 redeemCoupon 新落的 usedOnOrderId 反查)
    const already = await dbRead
      .select({ id: userCoupons.id })
      .from(userCoupons)
      .where(and(eq(userCoupons.usedOnOrderId, order.id), eq(userCoupons.status, 'used')))

    // 取消选券:把已核销的券退掉、订单恢复原价(幂等:本来就没券则直接返回当前值)
    if (!userCouponId) {
      for (const row of already) await refundCoupon(row.id)
      if (order.discountAmount !== 0 || order.amount !== basePrice) {
        await db
          .update(orders)
          .set({
            amount: basePrice,
            originalPrice: basePrice,
            discountAmount: 0,
            updatedAt: new Date(),
          })
          .where(and(eq(orders.id, order.id), eq(orders.status, 'pending')))
      }
      return reply.send(
        success({
          orderNo: order.orderNo,
          amount: basePrice,
          originalPrice: basePrice,
          discountAmount: 0,
        }),
      )
    }

    // 同一张券重复应用(前端重试/用户连点):幂等返回当前值,不再核销一次
    if (already.length === 1 && already[0]!.id === userCouponId) {
      return reply.send(
        success({
          orderNo: order.orderNo,
          amount: order.amount,
          originalPrice: basePrice,
          discountAmount: order.discountAmount,
        }),
      )
    }

    // 先核销新券(原子翻转 unused→used 能挡住并发双用),成功后再动订单与旧券:
    // 反过来做(先退旧券再核销新券)一旦新券不可用,用户就会"券被退了、订单还是原价"
    const redeemed = await redeemCoupon(userId, userCouponId, {
      spendCents: basePrice,
      orderId: order.id,
    })
    if (!redeemed.success) {
      const reason = COUPON_REASON_TEXT[redeemed.reason ?? ''] ?? redeemed.reason ?? '优惠券不可用'
      return reply.status(400).send(error(400, reason))
    }
    const discountCents = redeemed.discountCents ?? 0
    const newAmount = Math.max(0, basePrice - discountCents)

    const updated = await db
      .update(orders)
      .set({
        amount: newAmount,
        originalPrice: basePrice,
        discountAmount: discountCents,
        updatedAt: new Date(),
      })
      .where(and(eq(orders.id, order.id), eq(orders.status, 'pending')))
      .returning({ id: orders.id })
    if (updated.length === 0) {
      // 订单在核销与改价之间被别人支付/取消 —— 把刚核销的券退回去,不留悬空核销
      await refundCoupon(userCouponId)
      return reply.status(409).send(error(409, '订单状态已变更,请刷新后重试'))
    }

    // 换券:旧券退回
    for (const row of already) {
      if (row.id !== userCouponId) await refundCoupon(row.id)
    }

    return reply.send(
      success({
        orderNo: order.orderNo,
        amount: newAmount,
        originalPrice: basePrice,
        discountAmount: discountCents,
      }),
    )
  })

  // ==========================================================================
  // POST /pay/balance — 余额支付(扣钱包余额 + 结清订单 + 按订单类型发货)
  // ==========================================================================
  server.post('/pay/balance', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const userId = request.userId!
    const parsed = payBalanceBodySchema.safeParse(request.body ?? {})
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const orderNo = parsed.data.orderNo

    const order = (
      await dbRead.select().from(orders).where(eq(orders.orderNo, orderNo)).limit(1)
    )[0]
    if (!order) return reply.status(404).send(error(404, '订单不存在'))
    if (order.userId !== userId) return reply.status(403).send(error(403, '无权支付此订单'))
    if (order.status === 'paid') {
      // 幂等:已结清直接回执(前端重试/双开都能安全重放)
      const [margin] = await dbRead
        .select({ balance: userMargins.tokenQuantity })
        .from(userMargins)
        .where(eq(userMargins.userId, userId))
        .limit(1)
      return reply.send(
        success({ paid: true, orderNo, balance: margin?.balance ?? 0, idempotent: true }),
      )
    }
    if (order.status !== 'pending') {
      return reply.status(409).send(error(409, `订单状态(${order.status})不可支付`))
    }
    if (order.expiresAt && new Date(order.expiresAt).getTime() < Date.now()) {
      return reply.status(409).send(error(409, '订单已超时,请重新下单'))
    }
    const amount = Math.max(0, order.amount || 0)
    if (amount <= 0) return reply.status(400).send(error(400, '订单金额异常'))

    // 单事务:条件置 paid + 条件扣款 + 写流水。三者同生共死 ——
    // 分开做会留下"钱扣了订单没结清"或"订单结清了钱没扣"的窗口(余额支付没有第三方回调兜底)。
    let newBalance = 0
    try {
      newBalance = await db.transaction(async (tx) => {
        // 1) 条件 UPDATE:只有 pending 能被结清,并发两笔只有一个成功
        const marked = await tx
          .update(orders)
          .set({
            status: 'paid',
            paidAt: new Date(),
            paymentMethod: 'balance',
            updatedAt: new Date(),
          })
          .where(and(eq(orders.id, order.id), eq(orders.status, 'pending')))
          .returning({ id: orders.id })
        if (marked.length === 0)
          throw Object.assign(new Error('订单状态已变更'), { statusCode: 409 })

        // 2) 条件扣款:够才扣,不足直接抛。token_quantity 是 integer,比较用数值。
        const [deducted] = await tx
          .update(userMargins)
          .set({
            tokenQuantity: sql`${userMargins.tokenQuantity} - ${amount}`,
            updatedAt: new Date(),
          })
          .where(
            and(eq(userMargins.userId, userId), sql`${userMargins.tokenQuantity} >= ${amount}`),
          )
          .returning({ balance: userMargins.tokenQuantity })
        if (!deducted) throw Object.assign(new Error('余额不足'), { statusCode: 402 })

        // 3) 流水:opType=1 扣减,quantity 与 deductToken 同口径(正数 + 类型表意)
        await tx.insert(tokenFlows).values({
          userId,
          opType: 1,
          quantity: amount,
          balanceAfter: deducted.balance,
          remark: `余额支付订单 ${orderNo}`,
          relatedOrderNo: orderNo,
        })
        return deducted.balance
      })
    } catch (e) {
      const err = e as Error & { statusCode?: number }
      const code = err.statusCode ?? 500
      if (code === 402) return reply.status(402).send(error(402, '余额不足'))
      if (code === 409) return reply.status(409).send(error(409, '订单状态已变更,请刷新后重试'))
      request.log.error({ err, orderNo }, '余额支付失败')
      return reply.status(500).send(error(500, '支付失败,请稍后重试'))
    }

    // 发货:与支付回调走同一条订阅激活链(activateOrderSubscription 覆盖 VIP/开发者套餐/API 订阅),
    // 但**不走** completeOrder —— 后者对 orderType=2/3 会 rechargeToken(把订单金额当充值入账),
    // 余额买 VIP 会变成"钱付了、余额还多出来一笔"。
    try {
      const paidOrder = await dbRead.select().from(orders).where(eq(orders.id, order.id)).limit(1)
      if (paidOrder[0]) await activateOrderSubscription(paidOrder[0])
    } catch (e) {
      // 已扣款不能回滚(钱已付出),发货失败留痕由人工/补偿处理,回执如实标注
      request.log.error({ err: e, orderNo }, '余额支付成功但订阅激活失败')
      return reply.send(
        success({
          paid: true,
          orderNo,
          balance: newBalance,
          activated: false,
          warning: '权益发放延迟,请联系客服',
        }),
      )
    }

    return reply.send(
      success({ paid: true, orderNo, amount, balance: newBalance, activated: true }),
    )
  })
}

export default miniappPayRoutes
