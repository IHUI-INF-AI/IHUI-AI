// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { authenticate } from '../plugins/auth.js'
import { requireAdmin } from '../plugins/require-permission.js'
import { success, error } from '../utils/response.js'
import { requireStepUpForTwoFactorUser } from '../services/two-factor-step-up-store.js'
import {
  getBalance,
  rechargeToken,
  deductToken,
  refundTokenDeduct,
  expireToken,
  listTokenFlows,
  listCommissionFlows,
  commissionSummary,
  applyWithdrawal,
  approveWithdrawal,
  rejectWithdrawal,
  listWithdrawals,
  withdrawalSummary,
  availableWithdrawal,
  listSubordinates,
  teamCenter,
} from '../db/commission-queries.js'
import { orders } from '@ihui/database'
import { eq, and, desc, sql } from 'drizzle-orm'
import { db } from '../db/index.js'

export const financeRoutes: FastifyPluginAsync = async (server) => {
  const pageLimitQuery = z.object({
    // P1 修复(2026-08-06): 分页 limit 补上限,防恶意大分页拖垮数据库
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  })

  // ==========================================================================
  // Token 钱包余额
  // ==========================================================================

  server.get('/finance/margin/balance', async (request, reply) => {
    await authenticate(request)
    const userId = request.userId!
    const balance = await getBalance(userId)
    return reply.send(success({ balance }))
  })

  server.get('/finance/margin/check', async (request, reply) => {
    await authenticate(request)
    const { minTokens } = z.object({ minTokens: z.coerce.number() }).parse(request.query)
    const userId = request.userId!
    const balance = await getBalance(userId)
    return reply.send(success({ sufficient: balance >= minTokens, balance }))
  })

  // F-65(2026-11-13):资金面数量统一口径 —— 必须是正整数且有上限。
  // 原 `z.coerce.number()` 放行 0 / 负数 / 小数 / NaN:
  //  · deductToken 的 `token_quantity >= quantity` 对负数恒真,且 `- (-N)` 等于加钱;
  //  · recharge / commission 同样可被负数写成反向铸币。
  // 上限 10 亿分(= 1000 万元)远超任何真实单笔流水,只用于兜住 1e18 之类的溢出/滥用值。
  const MARGIN_QUANTITY_MAX = 1_000_000_000
  const marginQuantity = z.coerce
    .number({ error: '数量必须是数字' })
    .int({ error: '数量必须是整数' })
    .positive({ error: '数量必须大于 0' })
    .max(MARGIN_QUANTITY_MAX, { error: `数量不能超过 ${MARGIN_QUANTITY_MAX}` })
  // F-65:目标账户可由请求参数指定;缺省仍是调用者(与既有文档口径一致)。
  // 账号归属校验落在各自的业务事实上:recharge/refund 必须与订单归属一致,
  // refund 另禁止落到操作者本人。
  const targetUserIdSchema = z.uuid({ error: 'userId 格式不正确' }).optional()

  // P1-4 修复:/finance/margin/* 资金操作全部加 admin 权限校验(roleId >= 1),禁止普通用户自助调用
  server.post('/finance/margin/deduct', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const parsed = z
      .object({
        quantity: marginQuantity,
        remark: z.string().optional().default(''),
        userId: targetUserIdSchema,
      })
      .safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { quantity, remark, userId: targetUserId } = parsed.data
    const userId = targetUserId ?? request.userId!
    const balance = await deductToken(userId, quantity, remark)
    return reply.send(success({ balance }))
  })

  server.post('/finance/margin/recharge', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const parsed = z
      .object({
        quantity: marginQuantity,
        outTradeNo: z.string(),
        userId: targetUserIdSchema,
      })
      .safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { quantity, outTradeNo, userId: targetUserId } = parsed.data
    const userId = targetUserId ?? request.userId!
    // G8: 补 JOIN orders 校验,确认 outTradeNo 对应已支付订单,堵住"凭任意订单号印钞"漏洞
    const orderRows = await db
      .select({ status: orders.status, userId: orders.userId, amount: orders.amount })
      .from(orders)
      .where(eq(orders.orderNo, outTradeNo))
      .limit(1)
    const order = orderRows[0]
    if (!order) {
      return reply.status(400).send(error(400, '订单不存在'))
    }
    if (order.status !== 'paid') {
      return reply.status(400).send(error(400, `订单状态非已支付(当前: ${order.status})`))
    }
    if (order.userId !== userId) {
      return reply.status(403).send(error(403, '订单归属与目标账户不匹配'))
    }
    // F-65:按订单金额限幅,堵住「0.01 元已支付单充 1e9 token」
    if (quantity > order.amount) {
      return reply.status(400).send(error(400, `充值数量不能超过订单金额(${order.amount})`))
    }
    const balance = await rechargeToken(userId, quantity, outTradeNo)
    return reply.send(success({ balance }))
  })

  server.post('/finance/margin/expire', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const parsed = z
      .object({
        quantity: marginQuantity,
        source: z.string().optional().default('到期清零'),
        userId: targetUserIdSchema,
      })
      .safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { quantity, source, userId: targetUserId } = parsed.data
    const userId = targetUserId ?? request.userId!
    const balance = await expireToken(userId, quantity, source)
    return reply.send(success({ balance }))
  })

  server.post('/finance/margin/commission', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const parsed = z
      .object({
        quantity: marginQuantity,
        invitedUserId: targetUserIdSchema,
        source: z.string().optional().default('invite'),
      })
      .safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { quantity, invitedUserId, source } = parsed.data
    // F-65:invitedUserId 不再被 void —— 它就是佣金要入账的目标账户;
    // 缺省(不传)仍是调用者,保持既有文档口径。
    const userId = invitedUserId ?? request.userId!
    const balance = await rechargeToken(userId, quantity, undefined, source)
    return reply.send(success({ balance }))
  })

  server.post('/finance/margin/refund', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    // F-64(2026-11-13):退款方向反了 —— 原实现走 rechargeToken(opType=0),
    // 把 token 加给操作者(管理员)自己,且与原充值共用 (related_order_no, op_type=0)
    // 幂等键,退款被 23505 静默吞掉(接口成功但什么都没发生)。
    // 现在:必须显式指定目标账户 + 原单号;目标账户的 token 被扣回(opType=3,
    // related_order_no=`refund:<orderNo>`),与充值的 opType=0 幂等键互不干扰。
    const parsed = z
      .object({
        quantity: marginQuantity,
        // 归属校验要落到具体订单上,故单号不再是可选项(缺单号时也无法做幂等)
        orderNo: z.string().min(1, { error: 'orderNo 必填' }),
        remark: z.string().optional().default(''),
        // 拒绝默认操作者:退款目标必须显式指定
        userId: z.uuid({ error: 'userId 必填且格式正确' }),
      })
      .safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { quantity, orderNo, remark, userId: targetUserId } = parsed.data
    if (targetUserId === request.userId) {
      return reply.status(400).send(error(400, '退款目标账户不能是操作者本人'))
    }
    const orderRows = await db
      .select({ status: orders.status, userId: orders.userId, amount: orders.amount })
      .from(orders)
      .where(eq(orders.orderNo, orderNo))
      .limit(1)
    const order = orderRows[0]
    if (!order) {
      return reply.status(400).send(error(400, '订单不存在'))
    }
    if (order.userId !== targetUserId) {
      return reply.status(403).send(error(403, '订单归属与目标账户不匹配'))
    }
    // F-64:退款扣回不得超过原单金额
    if (quantity > order.amount) {
      return reply.status(400).send(error(400, `退款数量不能超过订单金额(${order.amount})`))
    }
    const balance = await refundTokenDeduct(targetUserId, quantity, orderNo, remark || undefined)
    return reply.send(success({ balance }))
  })

  server.get('/finance/margin/flows', async (request, reply) => {
    await authenticate(request)
    const { page, limit, opType } = z
      .object({
        // P1 修复(2026-08-06): 分页 limit 补上限
        page: z.coerce.number().int().min(1).optional().default(1),
        limit: z.coerce.number().int().min(1).max(100).optional().default(20),
        opType: z.coerce.number().optional(),
      })
      .parse(request.query)
    const userId = request.userId!
    // token_flows.quantity 在 op_type 0–5 是「分」，op_type 6 是 API 配额计数（个）。
    // 本端点是钱流水，未显式指定 opType 时排除配额腿，避免被当金额展示。
    const result = await listTokenFlows(userId, page, limit, opType, true)
    return reply.send(success(result))
  })

  // ==========================================================================
  // 佣金
  // ==========================================================================

  server.get('/finance/commission/list', async (request, reply) => {
    await authenticate(request)
    const { page, limit } = pageLimitQuery.parse(request.query)
    const userId = request.userId!
    const result = await listCommissionFlows(userId, page, limit)
    return reply.send(success(result))
  })

  server.get('/finance/commission/summary', async (request, reply) => {
    await authenticate(request)
    const userId = request.userId!
    const summary = await commissionSummary(userId)
    return reply.send(success(summary))
  })

  server.get('/finance/commission/orders', async (request, reply) => {
    await authenticate(request)
    const { page, limit, orderType, status } = z
      .object({
        // P1 修复(2026-08-06): 分页 limit 补上限
        page: z.coerce.number().int().min(1).optional().default(1),
        limit: z.coerce.number().int().min(1).max(100).optional().default(20),
        orderType: z.string().optional(),
        status: z.string().optional(),
      })
      .parse(request.query)
    const userId = request.userId!
    const conditions = [eq(orders.userId, userId)]
    if (orderType) conditions.push(eq(orders.paymentMethod, orderType))
    if (status) conditions.push(eq(orders.status, status))
    const where = conditions.length === 1 ? conditions[0] : and(...conditions)
    const rows = await db
      .select()
      .from(orders)
      .where(where)
      .orderBy(desc(orders.createdAt))
      .limit(limit)
      .offset((page - 1) * limit)
    const countRows = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(orders)
      .where(where)
    return reply.send(success({ items: rows, total: countRows[0]?.count ?? 0 }))
  })

  // ==========================================================================
  // 分销
  // ==========================================================================

  server.get('/finance/distribution/subordinates', async (request, reply) => {
    await authenticate(request)
    const { page, limit } = pageLimitQuery.parse(request.query)
    const userId = request.userId!
    const result = await listSubordinates(userId, page, limit)
    return reply.send(success(result))
  })

  server.get('/finance/distribution/team/center', async (request, reply) => {
    await authenticate(request)
    const userId = request.userId!
    const center = await teamCenter(userId)
    return reply.send(success(center))
  })

  server.get('/finance/distribution/invitee-stats', async (request, reply) => {
    await authenticate(request)
    const userId = request.userId!
    const center = await teamCenter(userId)
    return reply.send(
      success({ totalInvitees: center.totalInvitees, vipInvitees: center.vipInvitees }),
    )
  })

  // ==========================================================================
  // 提现
  // ==========================================================================

  server.post('/finance/withdrawal/apply', async (request, reply) => {
    await authenticate(request)
    const { amount: amountCents } = z.object({ amount: z.coerce.number() }).parse(request.query)
    const userId = request.userId!
    // 2FA step-up 闸：已开 2FA 的账号，敏感操作前须有窗内二次验证（会话被窃 ⇒ 拿不到凭据）
    const stepUp = await requireStepUpForTwoFactorUser({ userId, redis: request.server.redis })
    if (!stepUp.ok) {
      return reply
        .status(401)
        .send(
          error(
            401,
            stepUp.code === 'STEP_UP_REQUIRED'
              ? '该操作需要二次验证：请先调用 POST /auth/2fa/step-up 提交当前 TOTP 验证码（5 分钟内有效）'
              : '暂时无法确认该账号的两步验证状态，请稍后重试',
            stepUp.code,
          ),
        )
    }
    if (amountCents <= 0) return reply.status(400).send(error(400, '提现金额必须为正'))

    // 风控评估：大额提现 / 异常 IP 检测
    const risk = server.riskEngine.evaluateRisk({
      userId,
      withdrawalAmountFen: amountCents,
      ip: request.ip,
    })
    if (risk.action === 'DENY') {
      request.log.warn({ userId, hits: risk.hits }, '提现被风控拒绝')
      return reply.status(403).send(error(403, '提现请求被风控拦截，请联系客服'))
    }
    if (risk.action === 'REVIEW') {
      request.log.info({ userId, hits: risk.hits }, '提现进入人工复核')
    }

    const doApply = async () => {
      const available = await availableWithdrawal(userId)
      if (amountCents > available) {
        throw Object.assign(new Error('可提现余额不足'), { statusCode: 400 })
      }
      return applyWithdrawal(
        {
          userId,
          amount: amountCents,
          method: 'wechat',
          accountInfo: {},
        },
        request.userId ?? null,
      )
    }

    // 分布式锁防并发重复提现；锁不可用时降级直接执行
    try {
      const flow = await server.distributedLock.withLock(
        `withdrawal:user:${userId}`,
        10000,
        doApply,
      )
      return reply.send(success(flow))
    } catch (e) {
      if ((e as Error & { statusCode?: number }).statusCode) throw e
      request.log.warn({ err: e, userId }, '分布式锁不可用，降级执行提现')
      const flow = await doApply()
      return reply.send(success(flow))
    }
  })

  server.get('/finance/withdrawal/list', async (request, reply) => {
    await authenticate(request)
    const { page, limit } = pageLimitQuery.parse(request.query)
    const userId = request.userId!
    const result = await listWithdrawals(userId, page, limit)
    return reply.send(success(result))
  })

  server.get('/finance/withdrawal/summary', async (request, reply) => {
    await authenticate(request)
    const userId = request.userId!
    const summary = await withdrawalSummary(userId)
    return reply.send(success(summary))
  })

  server.get('/finance/withdrawal/available', async (request, reply) => {
    await authenticate(request)
    const userId = request.userId!
    const available = await availableWithdrawal(userId)
    return reply.send(success({ available }))
  })

  // PUT /admin/finance/withdrawal/:id/audit — 管理员审核提现申请
  // 路径含 /admin 前缀(finance.ts 挂载于 /api),实际路径 /api/admin/finance/withdrawal/:id/audit
  // body: { status: 'approved' | 'rejected', remark?: string }
  // DB withdrawal_flows.status:0=pending 1=processing 2=completed 3=failed
  server.put('/admin/finance/withdrawal/:id/audit', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const parsedParams = z.object({ id: z.uuid({ error: '无效的 ID' }) }).safeParse(request.params)
    if (!parsedParams.success) {
      return reply.status(400).send(error(400, parsedParams.error.issues[0]?.message ?? '参数错误'))
    }
    const parsed = z
      .object({
        status: z.enum(['approved', 'rejected']),
        remark: z.string().max(500).optional(),
      })
      .safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    // F-62:原实现按 id 无条件 UPDATE —— (1) rejected 只改状态、不退还冻结余额,
    // token 永久卡在 frozen;(2) 已 completed(2)/已退款(3) 的流水可被改回 processing(1)
    // 再次进入打款流程(退款后又收一次钱);(3) 并发通过/驳回均成功。
    // 统一走已实现状态机:approve 只允许 0→1,reject 只允许 0→3 且同事务退还冻结。
    const operatorId = request.userId ?? null
    if (parsed.data.status === 'approved') {
      const updated = await approveWithdrawal(parsedParams.data.id, operatorId)
      if (!updated) {
        return reply.status(409).send(error(409, '提现记录不存在或已被处理'))
      }
      return reply.send(success({}))
    }
    const rejected = await rejectWithdrawal(
      parsedParams.data.id,
      parsed.data.remark ?? '管理员驳回',
      operatorId,
    )
    if (!rejected) {
      return reply.status(409).send(error(409, '提现记录不存在或已被处理'))
    }
    return reply.send(success({}))
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
