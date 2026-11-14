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
import { eduOrders, orders } from '@ihui/database'
import { requireAdmin } from '../../plugins/require-permission.js'
import { success, error, parseOrThrow } from '../../utils/response.js'
import { idParamSchema } from './_shared.js'
import { isUuidString } from '../../utils/uuid.js'
import { logAction } from '../../services/audit-service.js'
// F-465:后台改单的状态迁移必须复用主链路状态机,不得裸写 status。
import { completeOrder, cancelOrder, refundOrder } from '../../services/order-service.js'
// F-453:此第 5 条提现写入口原先直接 status=2|3、where 只有 id——无冻结释放、无退款、无
// 前置状态断言:0→2 后回调只处理 0/1(payment-extended:147),冻结永久沉淀;reject 把终态
// 改回 3 使 token 永久丢失;且可把任意终态改写。保留路由契约(前端两处审批仍调
// /admin/shop/withdrawals/:id/:action),但改调 commission-queries 单源服务,与主链路同一份
// 资金守恒逻辑:approve 只允许 0→1、reject 只允许 0→3 并退还冻结(带「冻结够才退」守卫)。
import { approveWithdrawal, rejectWithdrawal } from '../../db/commission-queries.js'

const updateOrderSchema = z.strictObject({
  status: z.enum(['pending', 'paid', 'cancelled', 'refunded']).optional(),
  payType: z.string().max(50).optional(),
  remark: z.string().max(500).optional(),
  targetTitle: z.string().max(200).optional(),
})

/**
 * F-465:订单状态迁移表(与 services/order-service.ts 的四个状态迁移同源)。
 *   pending → paid(completeOrder 完整履约)/ cancelled(cancelOrder)
 *   paid    → refunded(refundOrder,含资金副作用与时间戳)
 *   cancelled / refunded 为终态,不可回退(原实现可把 refunded 改回 paid)。
 * 表外迁移一律 409,且在写库之前拦截。
 */
const ORDER_STATUS_TRANSITIONS: Readonly<Record<string, readonly string[]>> = {
  pending: ['paid', 'cancelled'],
  paid: ['refunded'],
  cancelled: [],
  refunded: [],
}

export const orderRoutes: FastifyPluginAsync = async (server) => {
  server.put('/admin/orders/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = parseOrThrow(idParamSchema, request.params)
    if (!isUuidString(id)) return reply.status(400).send(error(400, 'id 格式不正确'))
    const body = parseOrThrow(updateOrderSchema, request.body)
    const [existing] = await db
      .select({ status: eduOrders.status, orderNo: eduOrders.orderNo })
      .from(eduOrders)
      .where(eq(eduOrders.id, id))
      .limit(1)
    if (!existing) return reply.status(404).send(error(404, '订单不存在'))
    // F-465:非法迁移不写库(先校验,再动任何一张表)。
    const nextStatus =
      body.status !== undefined && body.status !== existing.status ? body.status : undefined
    if (nextStatus !== undefined) {
      const allowed = ORDER_STATUS_TRANSITIONS[existing.status] ?? []
      if (!allowed.includes(nextStatus)) {
        return reply
          .status(409)
          .send(error(409, `当前状态(${existing.status})不允许变更为 ${nextStatus}`))
      }
      // 复用主链路履约入口:paid → completeOrder(token 充值/学费入账/积分/Outbox);
      // cancelled → cancelOrder;refunded → refundOrder(退款回收)。
      // 时间戳(orders.paid_at/refund_time 与 edu_orders.pay_time/refund_time)由同源
      // updateOrderStatus 在两表内一并写入,不再由本路由裸写 status。
      let result: { success: boolean; reason?: string }
      try {
        result =
          nextStatus === 'paid'
            ? await completeOrder(existing.orderNo)
            : nextStatus === 'cancelled'
              ? await cancelOrder(existing.orderNo)
              : await refundOrder(existing.orderNo)
      } catch (e) {
        return reply
          .status(409)
          .send(error(409, `订单状态迁移失败:${(e as Error).message}`))
      }
      if (!result.success) {
        return reply.status(409).send(error(409, result.reason ?? '订单状态迁移失败'))
      }
    }
    // 非状态字段(payType/remark/targetTitle)仍按普通字段更新;状态已由上面的服务写库。
    const eduSet: Record<string, unknown> = {}
    if (body.payType !== undefined) eduSet.payType = body.payType
    if (body.remark !== undefined) eduSet.remark = body.remark
    if (body.targetTitle !== undefined) eduSet.targetTitle = body.targetTitle
    // Phase 3: 同步到统一 orders 表（payType → paymentMethod）
    const ordersSet: Record<string, unknown> = {}
    if (body.payType !== undefined) ordersSet.paymentMethod = body.payType
    if (body.remark !== undefined) ordersSet.remark = body.remark
    if (body.targetTitle !== undefined) ordersSet.targetTitle = body.targetTitle
    if (Object.keys(eduSet).length > 0) {
      eduSet.updatedAt = new Date()
      await db.update(eduOrders).set(eduSet).where(eq(eduOrders.id, id))
    }
    if (Object.keys(ordersSet).length > 0) {
      ordersSet.updatedAt = new Date()
      await db.update(orders).set(ordersSet).where(eq(orders.id, id))
    }
    const [row] = await db
      .select()
      .from(eduOrders)
      .where(eq(eduOrders.id, id))
      .limit(1)
    return reply.send(success(row))
  })
  server.delete('/admin/orders/:id', { preHandler: requireAdmin }, async (request, reply) => {
    const { id } = parseOrThrow(idParamSchema, request.params)
    // 形状闸(2026-09-28 普查收口):下面这些 :id 最终会被喂进 uuid 列,非 uuid 字面量让 Postgres
    // 抛 22P02 invalid input syntax for type uuid,而未被兜住就是 500 —— 于是"这条不存在"与
    // "服务坏了"在响应上完全同形。判据只有一份(utils/uuid.ts 的 isUuidString),闸必须在进 SQL 之前。
    if (!isUuidString(id)) return reply.status(400).send(error(400, 'id 格式不正确'))
    // F-130:已支付 / 已退款订单禁止物理删除。
    //
    // 修前这里直接 `delete(eduOrders)` 再 `delete(orders)`,不看支付状态;而
    // `payments.order_id` / `edu_payments.order_id` 都是 `onDelete: 'cascade'` ⇒ 一次删除
    // 把已支付订单连同网关原始响应一起抹掉:财务对账、退款、发票与审计证据都**不可恢复**。
    // 物理删除只对"从未产生资金流"的订单成立(pending / cancelled);其余一律 409,
    // 由人工走退款/作废流程 —— 这里刻意不做软删:表上没有软删列,现造一列等于改 schema
    // 与全部查询口径,超出本票射程(fail-closed 优先)。
    const [existing] = await db
      .select({ status: eduOrders.status })
      .from(eduOrders)
      .where(eq(eduOrders.id, id))
      .limit(1)
    if (!existing) return reply.status(404).send(error(404, '订单不存在'))
    if (existing.status === 'paid' || existing.status === 'refunded') {
      return reply
        .status(409)
        .send(
          error(409, `订单状态为 ${existing.status},已产生资金流,禁止物理删除;请走退款/作废流程`),
        )
    }
    const [row] = await db.delete(eduOrders).where(eq(eduOrders.id, id)).returning()
    if (!row) return reply.status(404).send(error(404, '订单不存在'))
    // Phase 3: 同步删除统一 orders 表
    await db.delete(orders).where(eq(orders.id, id))
    // F-130:物理删除是资金凭证的终点,必须留痕(谁、删了哪条、删除前状态)。
    const ua = request.headers['user-agent']
    await logAction({
      userId: request.userId,
      action: 'order.delete',
      resourceType: 'order',
      resourceId: id,
      details: { status: existing.status },
      ip: request.ip,
      userAgent: typeof ua === 'string' ? ua.slice(0, 512) : undefined,
    })
    return reply.send(success({ id, deleted: Boolean(row) }))
  })
  server.post(
    '/admin/shop/payments/:id/ship',
    { preHandler: requireAdmin },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = parseOrThrow(idParamSchema, request.params)
      // F-464: 同资源 PUT/DELETE 都有 uuid 闸,ship 漏了 ⇒ 非 uuid 字面量直达 uuid 列报 500
      if (!isUuidString(id)) return reply.status(400).send(error(400, 'id 格式不正确'))
      const [existing] = await db
        .select({ status: eduOrders.status, remark: eduOrders.remark })
        .from(eduOrders)
        .where(eq(eduOrders.id, id))
        .limit(1)
      if (!existing) return reply.status(404).send(error(404, '订单不存在'))
      // F-464: 仅已支付订单可发货,且不得重复发货/覆盖用户原始备注
      if (existing.status !== 'paid') {
        return reply
          .status(409)
          .send(error(409, `订单状态为 ${existing.status},仅已支付订单可发货`))
      }
      if (existing.remark?.startsWith('已发货')) {
        return reply.status(409).send(error(409, '订单已发货,不可重复发货'))
      }
      const now = new Date()
      const shipRemark = `已发货 ${now.toISOString()}`
      const mergedRemark = existing.remark ? `${existing.remark} | ${shipRemark}` : shipRemark
      const [row] = await db
        .update(eduOrders)
        .set({ remark: mergedRemark, updatedAt: now })
        .where(eq(eduOrders.id, id))
        .returning()
      if (!row) return reply.status(404).send(error(404, '订单不存在'))
      // Phase 3: 同步发货备注到统一 orders 表
      await db.update(orders).set({ remark: mergedRemark, updatedAt: now }).where(eq(orders.id, id))
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
      // F-453:改调统一提现服务(单源资金守恒),不再直接写 status。
      // approve:仅 pending(0)→processing(1) 条件 UPDATE;冻结释放交给支付回调。
      // reject:仅 pending(0)→failed(3),事务内退还冻结(token+=amount / frozen-=amount,带守卫)。
      // rejectReason 为空时补兜底文案(服务不要求必填,但留痕更可读)。
      const operatorId = request.userId ?? null
      const updated =
        action === 'approve'
          ? await approveWithdrawal(id, operatorId)
          : await rejectWithdrawal(id, '管理端驳回', operatorId)
      if (!updated) {
        return reply.status(409).send(error(409, '提现记录不存在或已被处理(仅待审核可审批/驳回)'))
      }
      return reply.send(success(updated))
    },
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
