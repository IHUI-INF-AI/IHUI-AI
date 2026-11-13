// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 管理后台商城/API 分组路由（5 个端点）。
 * 替代 admin-missing-routes.ts 中的 registerEmptyStub 空桩。
 * 复用现有 userMargins/tokenFlows/zhsProduct/withdrawalFlows/developerApiKeys 表。
 */
import { randomUUID } from 'node:crypto'
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { eq, or, ilike, desc, sql, and, inArray, type SQL } from 'drizzle-orm'
import { db } from '../db/index.js'
import { requireAdmin } from '../plugins/require-permission.js'
import { success, error, emptyToUndefined } from '../utils/response.js'
import { isUuidString } from '../utils/uuid.js'
import { TOKEN_FLOW_OP } from '../services/relay-billing-service.js'
import {
  userMargins,
  tokenFlows,
  zhsProduct,
  withdrawalFlows,
  developerApiKeys,
  users,
  type ZhsProduct,
  type WithdrawalFlow,
} from '@ihui/database'

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.transform(emptyToUndefined).pipe(z.string().max(200).optional()),
})

const idParamSchema = z.object({ id: z.string() })

const productStatusSchema = z.enum(['online', 'offline'])
type ProductStatus = z.infer<typeof productStatusSchema>
const PRODUCT_INT: Record<ProductStatus, number> = { online: 1, offline: 0 }
const isProductStatus = (s: string): s is ProductStatus => s === 'online' || s === 'offline'
const productStatusFromInt = (s: number | null): ProductStatus => (s === 1 ? 'online' : 'offline')

const withdrawalStatusSchema = z.enum(['pending', 'approved', 'rejected', 'completed', 'failed'])
type WithdrawalStatus = z.infer<typeof withdrawalStatusSchema>
// F-457:withdrawal_flows.status 全仓唯一口径(schema 注释):0=pending 1=processing 2=completed
// 3=failed(驳回/终态失败)。此前这里把 rejected 写 4,与主链路驳回(rejectWithdrawal 写 3)分裂
// ⇒ 主链路驳回单在商城后台显示 failed、按 rejected 筛选查不到、资金统计四类计数之和 < 总数。
// 写侧一律落 3;4 仅作为历史遗留数据在读取/筛选时兼容,不再写入。
const WITHDRAWAL_INT: Record<WithdrawalStatus, number> = {
  pending: 0,
  approved: 1,
  completed: 2,
  failed: 3,
  rejected: 3,
}
/** 驳回/失败的终态集合:3=现行口径,4=旧版商城后台写入的历史数据 */
const WITHDRAWAL_REJECTED_INTS = [3, 4] as const
const WITHDRAWAL_STATUS_LIST = ['pending', 'approved', 'rejected', 'completed', 'failed'] as const
const isWithdrawalStatus = (s: string): s is WithdrawalStatus =>
  (WITHDRAWAL_STATUS_LIST as readonly string[]).includes(s)
const withdrawalStatusFromInt = (s: number): WithdrawalStatus => {
  if (s === 1) return 'approved'
  if (s === 2) return 'completed'
  if (s === 3 || s === 4) return 'rejected'
  return 'pending'
}

function mapProduct(r: ZhsProduct) {
  return {
    name: r.name ?? '',
    category: '',
    price: r.price ?? 0,
    stock: 0,
    sales: 0,
    desc: '',
    images: '',
    status: productStatusFromInt(r.status),
    type: r.type ?? '',
    denomination: '',
    denominationVip: '',
    denominationOperate: '',
    createdAt: r.createdAt.toISOString(),
  }
}

type WithdrawalSelectRow = {
  w: WithdrawalFlow
  username: string | null
  nickname: string | null
}

function mapWithdrawal(r: WithdrawalSelectRow) {
  const method = r.w.method
  const channel: 'alipay' | 'wechat' | 'bank' =
    method === 'wechat' ? 'wechat' : method === 'bank' ? 'bank' : 'alipay'
  const accountInfo = r.w.accountInfo as { account?: string } | null
  return {
    id: r.w.id,
    user: r.w.userId,
    userName: r.nickname ?? r.username ?? undefined,
    amount: r.w.amount,
    channel,
    account: accountInfo?.account ?? '',
    status: withdrawalStatusFromInt(r.w.status),
    createdAt: r.w.createdAt.toISOString(),
    reviewer: undefined,
    reviewerTime: r.w.processedAt ? r.w.processedAt.getTime() : undefined,
    outBillNo: r.w.partnerTradeNo ?? undefined,
    notes: r.w.rejectReason ?? undefined,
    weChatMsg: undefined,
    withdrawalTime: r.w.processedAt ? r.w.processedAt.getTime() : undefined,
    auditAmount: r.w.originalAmount,
  }
}

export const adminShopRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)

  // 1. /api-groups — developerApiKeys 按 name 聚合
  server.get('/api-groups', async (_request: FastifyRequest, reply: FastifyReply) => {
    const rows = await db
      .select({
        name: developerApiKeys.name,
        apiCount: sql<number>`count(*)::int`,
        createdAt: sql<Date>`min(${developerApiKeys.createdAt})`,
      })
      .from(developerApiKeys)
      .groupBy(developerApiKeys.name)
      .orderBy(desc(sql`min(${developerApiKeys.createdAt})`))
    const list = rows.map((r) => ({
      id: r.name,
      name: r.name,
      description: '',
      apiCount: r.apiCount,
      createdAt: r.createdAt.toISOString(),
    }))
    return reply.send(success({ list }))
  })

  // 2. /shop/funds/accounts — userMargins + tokenFlows 聚合
  server.get('/shop/funds/accounts', async (_request: FastifyRequest, reply: FastifyReply) => {
    const rows = await db
      .select({
        userId: userMargins.userId,
        balance: userMargins.tokenQuantity,
        frozen: userMargins.frozenQuantity,
        updatedAt: userMargins.updatedAt,
        username: users.username,
        email: users.email,
        phone: users.phone,
      })
      .from(userMargins)
      .leftJoin(users, eq(users.id, userMargins.userId))

    const flows = await db
      .select({
        userId: tokenFlows.userId,
        // F-394:口径统一 —— 充值/消耗都按绝对值累计,提现等负号流水不得把消耗合计抵小;
        // opType 走 TOKEN_FLOW_OP,不再写魔法数字。
        totalRecharge: sql<number>`coalesce(sum(case when ${tokenFlows.opType} = ${TOKEN_FLOW_OP.RECHARGE} then abs(${tokenFlows.quantity}) else 0 end), 0)::int`,
        totalConsume: sql<number>`coalesce(sum(case when ${tokenFlows.opType} = ${TOKEN_FLOW_OP.CONSUME} then abs(${tokenFlows.quantity}) else 0 end), 0)::int`,
      })
      .from(tokenFlows)
      .where(inArray(tokenFlows.opType, [TOKEN_FLOW_OP.RECHARGE, TOKEN_FLOW_OP.CONSUME]))
      .groupBy(tokenFlows.userId)
    const flowMap = new Map(flows.map((f) => [f.userId, f]))

    const list = rows.map((r) => {
      const f = flowMap.get(r.userId)
      return {
        id: r.userId,
        user: r.username ?? r.email ?? r.phone ?? r.userId,
        balance: r.balance,
        frozen: r.frozen,
        totalRecharge: f?.totalRecharge ?? 0,
        totalConsume: f?.totalConsume ?? 0,
        updatedAt: r.updatedAt.toISOString(),
      }
    })
    return reply.send(success({ list }))
  })

  // 3. /shop/products — zhsProduct CRUD + PATCH status
  const productQuerySchema = paginationSchema.extend({
    name: z.transform(emptyToUndefined).pipe(z.string().max(200).optional()),
    category: z.transform(emptyToUndefined).pipe(z.string().max(100).optional()),
    status: z.transform(emptyToUndefined).pipe(z.string().max(20).optional()),
    type: z.transform(emptyToUndefined).pipe(z.string().max(50).optional()),
  })
  const productBodySchema = z.object({
    name: z.string().min(1).max(200),
    category: z.string().max(100).optional(),
    price: z.coerce.number().min(0),
    stock: z.coerce.number().int().min(0).optional(),
    sales: z.coerce.number().int().min(0).optional(),
    desc: z.string().optional(),
    images: z.string().optional(),
    status: productStatusSchema,
    type: z.string().max(50).optional(),
    denomination: z.string().optional(),
    denominationVip: z.string().optional(),
    denominationOperate: z.string().optional(),
  })

  server.get('/shop/products', async (request: FastifyRequest, reply: FastifyReply) => {
    const q = productQuerySchema.safeParse(request.query)
    if (!q.success) return reply.status(400).send(error(400, '参数错误'))
    const { page, pageSize, name, status, type } = q.data
    const conds: (SQL | undefined)[] = []
    if (name) conds.push(ilike(zhsProduct.name, `%${name}%`))
    if (status && isProductStatus(status)) conds.push(eq(zhsProduct.status, PRODUCT_INT[status]))
    if (type) conds.push(ilike(zhsProduct.type, `%${type}%`))
    const where = conds.length ? and(...conds) : undefined
    const listRows = await db
      .select()
      .from(zhsProduct)
      .where(where)
      .orderBy(desc(zhsProduct.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize)
    const total =
      (
        await db
          .select({ c: sql<number>`count(*)::int` })
          .from(zhsProduct)
          .where(where)
      )[0]?.c ?? 0
    const list = listRows.map((r) => ({ id: String(r.id), ...mapProduct(r) }))
    return reply.send(success({ list, total }))
  })

  server.post('/shop/products', async (request: FastifyRequest, reply: FastifyReply) => {
    const b = productBodySchema.safeParse(request.body)
    if (!b.success) return reply.status(400).send(error(400, '参数错误'))
    const [row] = await db
      .insert(zhsProduct)
      .values({
        name: b.data.name,
        price: b.data.price,
        type: b.data.type,
        status: PRODUCT_INT[b.data.status],
      })
      .returning()
    // F-395:INSERT 返回空行 = 没落库,不得回 2xx 让后台以为保存成功
    if (!row) return reply.status(409).send(error(409, '商品创建失败,请重试'))
    return reply.status(201).send(success({ id: String(row.id), ...mapProduct(row) }))
  })

  server.get('/shop/products/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const [row] = await db
      .select()
      .from(zhsProduct)
      .where(eq(zhsProduct.id, Number(p.data.id)))
      .limit(1)
    if (!row) return reply.status(404).send(error(404, '商品不存在'))
    return reply.send(success({ id: String(row.id), ...mapProduct(row) }))
  })

  server.put('/shop/products/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const b = productBodySchema.partial().safeParse(request.body)
    if (!b.success) return reply.status(400).send(error(400, '参数错误'))
    const set: Partial<typeof zhsProduct.$inferInsert> = {}
    if (b.data.name !== undefined) set.name = b.data.name
    if (b.data.price !== undefined) set.price = b.data.price
    if (b.data.type !== undefined) set.type = b.data.type
    if (b.data.status !== undefined) set.status = PRODUCT_INT[b.data.status]
    // F-395:空对象 / 只有不可落库可选列 ⇒ 一行都不会变,不能回 200 假成功
    if (Object.keys(set).length === 0)
      return reply.status(400).send(error(400, '无可用更新字段'))
    set.updatedAt = new Date()
    const [row] = await db
      .update(zhsProduct)
      .set(set)
      .where(eq(zhsProduct.id, Number(p.data.id)))
      .returning()
    // F-395:UPDATE 返回空行 = 目标已被删除(并发),如实回 404
    if (!row) return reply.status(404).send(error(404, '商品不存在或已被删除'))
    return reply.send(success({ id: String(row.id), ...mapProduct(row) }))
  })

  server.patch(
    '/shop/products/:id/status',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const p = idParamSchema.safeParse(request.params)
      if (!p.success) return reply.status(400).send(error(400, '参数错误'))
      const b = z.object({ status: productStatusSchema }).safeParse(request.body)
      if (!b.success) return reply.status(400).send(error(400, '参数错误'))
      const [row] = await db
        .update(zhsProduct)
        .set({ status: PRODUCT_INT[b.data.status], updatedAt: new Date() })
        .where(eq(zhsProduct.id, Number(p.data.id)))
        .returning()
      // F-395:上下架写后判空,目标不在了就别回 200
      if (!row) return reply.status(404).send(error(404, '商品不存在或已被删除'))
      return reply.send(success({ id: String(row.id), status: productStatusFromInt(row.status) }))
    },
  )

  server.delete('/shop/products/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const removed = await db
      .delete(zhsProduct)
      .where(eq(zhsProduct.id, Number(p.data.id)))
      .returning({ id: zhsProduct.id })
    return reply.send(success({ id: p.data.id, deleted: removed.length > 0 }))
  })

  // 4. /shop/withdrawals — withdrawalFlows CRUD + approve/reject
  const withdrawalQuerySchema = paginationSchema.extend({
    status: z.transform(emptyToUndefined).pipe(z.string().max(20).optional()),
    user: z.transform(emptyToUndefined).pipe(z.string().max(100).optional()),
    outBillNo: z.transform(emptyToUndefined).pipe(z.string().max(64).optional()),
    reviewer: z.transform(emptyToUndefined).pipe(z.string().max(100).optional()),
    userName: z.transform(emptyToUndefined).pipe(z.string().max(100).optional()),
    minAmount: z.transform(emptyToUndefined).pipe(z.coerce.number().int().optional()),
    maxAmount: z.transform(emptyToUndefined).pipe(z.coerce.number().int().optional()),
  })
  const withdrawalBodySchema = z.object({
    user: z.string().min(1),
    amount: z.coerce.number().int().positive(),
    channel: z.enum(['alipay', 'wechat', 'bank']),
    account: z.string().max(255),
    status: withdrawalStatusSchema.default('pending'),
  })

  server.get('/shop/withdrawals', async (request: FastifyRequest, reply: FastifyReply) => {
    const q = withdrawalQuerySchema.safeParse(request.query)
    if (!q.success) return reply.status(400).send(error(400, '参数错误'))
    const { page, pageSize, status, user, outBillNo, userName, minAmount, maxAmount } = q.data
    const conds: (SQL | undefined)[] = []
    if (status && isWithdrawalStatus(status)) {
      // F-457:rejected/failed 都是同一终态(3),筛选须同时覆盖历史 4,否则旧驳回单仍查不到
      if (status === 'rejected' || status === 'failed')
        conds.push(inArray(withdrawalFlows.status, [...WITHDRAWAL_REJECTED_INTS]))
      else conds.push(eq(withdrawalFlows.status, WITHDRAWAL_INT[status]))
    }
    if (outBillNo) conds.push(ilike(withdrawalFlows.partnerTradeNo, `%${outBillNo}%`))
    if (minAmount !== undefined) conds.push(sql`${withdrawalFlows.amount} >= ${minAmount}`)
    if (maxAmount !== undefined) conds.push(sql`${withdrawalFlows.amount} <= ${maxAmount}`)
    if (user)
      conds.push(
        or(
          ilike(users.username, `%${user}%`),
          ilike(users.email, `%${user}%`),
          ilike(users.phone, `%${user}%`),
        ),
      )
    if (userName) conds.push(ilike(users.nickname, `%${userName}%`))
    const where = conds.length ? and(...conds) : undefined
    const listRows = await db
      .select({ w: withdrawalFlows, username: users.username, nickname: users.nickname })
      .from(withdrawalFlows)
      .leftJoin(users, eq(users.id, withdrawalFlows.userId))
      .where(where)
      .orderBy(desc(withdrawalFlows.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize)
    const total =
      (
        await db
          .select({ c: sql<number>`count(*)::int` })
          .from(withdrawalFlows)
          .leftJoin(users, eq(users.id, withdrawalFlows.userId))
          .where(where)
      )[0]?.c ?? 0
    const list = listRows.map(mapWithdrawal)
    return reply.send(success({ list, total }))
  })

  server.get('/shop/withdrawals/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    if (!isUuidString(p.data.id)) return reply.status(404).send(error(404, '记录不存在'))
    const [row] = await db
      .select({ w: withdrawalFlows, username: users.username, nickname: users.nickname })
      .from(withdrawalFlows)
      .leftJoin(users, eq(users.id, withdrawalFlows.userId))
      .where(eq(withdrawalFlows.id, p.data.id))
      .limit(1)
    if (!row) return reply.status(404).send(error(404, '记录不存在'))
    return reply.send(success(mapWithdrawal(row)))
  })

  server.post('/shop/withdrawals', async (request: FastifyRequest, reply: FastifyReply) => {
    const b = withdrawalBodySchema.safeParse(request.body)
    if (!b.success) return reply.status(400).send(error(400, '参数错误'))
    // F-455:直插表即建单等于凭空造出提现单 —— 后台只能建"待审核"单,资金动作必须与
    // 用户自助/开发者提现同口径:申请即从可用余额扣减并等额转入冻结。
    if (b.data.status !== 'pending')
      return reply.status(400).send(error(400, '管理端仅可创建待审核提现单'))
    const amount = b.data.amount
    try {
      const flow = await db.transaction(async (tx) => {
        // 行锁串行化同一用户的并发建单,再在事务内复核可用余额(禁止 TOCTOU 超发)
        const [margin] = await tx
          .select()
          .from(userMargins)
          .where(eq(userMargins.userId, b.data.user))
          .for('update')
          .limit(1)
        if (!margin || margin.tokenQuantity < amount)
          throw Object.assign(new Error('可用余额不足'), { statusCode: 409 })
        const [updated] = await tx
          .update(userMargins)
          .set({
            tokenQuantity: sql`${userMargins.tokenQuantity} - ${amount}`,
            frozenQuantity: sql`${userMargins.frozenQuantity} + ${amount}`,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(userMargins.userId, b.data.user),
              sql`${userMargins.tokenQuantity} >= ${amount}`,
            ),
          )
          .returning({ tokenQuantity: userMargins.tokenQuantity })
        if (!updated) throw Object.assign(new Error('可用余额不足'), { statusCode: 409 })
        const [row] = await tx
          .insert(withdrawalFlows)
          .values({
            userId: b.data.user,
            amount,
            originalAmount: amount,
            method: b.data.channel,
            accountInfo: { account: b.data.account },
            status: WITHDRAWAL_INT.pending,
            // F-455:后台单独立单号前缀,便于对账时区分来源
            partnerTradeNo: `ADMWD${Date.now()}-${randomUUID()}`,
          })
          .returning()
        if (!row) throw Object.assign(new Error('创建失败'), { statusCode: 500 })
        await tx.insert(tokenFlows).values({
          userId: b.data.user,
          opType: TOKEN_FLOW_OP.CONSUME,
          quantity: -amount,
          balanceAfter: updated.tokenQuantity,
          remark: '管理端提现申请',
        })
        return row
      })
      return reply.status(201).send(success({ id: flow.id }))
    } catch (e) {
      const statusCode = (e as { statusCode?: number }).statusCode ?? 500
      if (statusCode < 500) {
        return reply.status(statusCode).send(error(statusCode, (e as Error).message))
      }
      request.log.error(e)
      return reply.status(500).send(error(500, '创建失败'))
    }
  })

  server.put('/shop/withdrawals/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    if (!isUuidString(p.data.id)) return reply.status(400).send(error(400, 'id 格式不正确'))
    const b = withdrawalBodySchema.safeParse(request.body)
    if (!b.success) return reply.status(400).send(error(400, '参数错误'))
    const [row] = await db
      .update(withdrawalFlows)
      .set({
        userId: b.data.user,
        amount: b.data.amount,
        method: b.data.channel,
        accountInfo: { account: b.data.account },
        status: WITHDRAWAL_INT[b.data.status],
        updatedAt: new Date(),
      })
      .where(eq(withdrawalFlows.id, p.data.id))
      .returning()
    if (!row) return reply.status(404).send(error(404, '记录不存在'))
    return reply.send(success({ id: row.id }))
  })

  server.delete('/shop/withdrawals/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    // 形状闸(2026-09-28 普查收口):下面这些 :id 最终会被喂进 uuid 列,非 uuid 字面量让 Postgres
    // 抛 22P02 invalid input syntax for type uuid,而未被兜住就是 500 —— 于是"这条不存在"与
    // "服务坏了"在响应上完全同形。判据只有一份(utils/uuid.ts 的 isUuidString),闸必须在进 SQL 之前。
    if (!isUuidString(p.data.id)) return reply.status(400).send(error(400, 'id 格式不正确'))
    try {
      const deleted = await db.transaction(async (tx) => {
        // F-455:删单必须与原资金动作对称 —— 先锁行再判状态,禁止无退款直接删行。
        const [flow] = await tx
          .select()
          .from(withdrawalFlows)
          .where(eq(withdrawalFlows.id, p.data.id))
          .for('update')
          .limit(1)
        // 已被删除(含重复 DELETE):幂等返回,不再退款
        if (!flow) return false
        // 已放款/已完成:资金已出账,删单必须走冲正,不能在这里凭空回填
        if (
          flow.status === WITHDRAWAL_INT.approved ||
          flow.status === WITHDRAWAL_INT.completed
        ) {
          throw Object.assign(new Error('已完成/已审批的提现单不可删除,请走冲正流程'), {
            statusCode: 409,
          })
        }
        // 仅 pending 占用了冻结资金;rejected/failed 在驳回链路已退回,删单不得重复退。
        if (flow.status === WITHDRAWAL_INT.pending) {
          if (!flow.userId)
            throw Object.assign(new Error('提现单归属用户已注销,需人工对账'), { statusCode: 409 })
          // 口径同驳回:可用余额按毛额(到账额 + 手续费)退回,冻结只释放净额
          const refundGross = flow.amount + (flow.fee ?? 0)
          const [refunded] = await tx
            .update(userMargins)
            .set({
              tokenQuantity: sql`${userMargins.tokenQuantity} + ${refundGross}`,
              frozenQuantity: sql`${userMargins.frozenQuantity} - ${flow.amount}`,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(userMargins.userId, flow.userId),
                sql`${userMargins.frozenQuantity} >= ${flow.amount}`,
              ),
            )
            .returning({ userId: userMargins.userId })
          // 冻结不足(如资金已被别处释放)拒绝删除,避免"删了单资金却没退"的半截态
          if (!refunded)
            throw Object.assign(new Error('冻结余额不足以退回,需人工对账'), { statusCode: 409 })
        }
        await tx.delete(withdrawalFlows).where(eq(withdrawalFlows.id, p.data.id))
        return true
      })
      return reply.send(success({ id: p.data.id, deleted }))
    } catch (e) {
      const statusCode = (e as { statusCode?: number }).statusCode ?? 500
      if (statusCode < 500) {
        return reply.status(statusCode).send(error(statusCode, (e as Error).message))
      }
      request.log.error(e)
      return reply.status(500).send(error(500, '删除失败'))
    }
  })

  server.post(
    '/shop/withdrawals/:id/approve',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const p = idParamSchema.safeParse(request.params)
      if (!p.success) return reply.status(400).send(error(400, '参数错误'))
      // P1 修复(2026-08-06): 审批通过只改 status 不回退冻结资金,导致 frozen 永久沉淀。
      // 事务内:① 条件 UPDATE pending→approved(防并发重复审批) ② 冻结资金实际转出(frozen -= amount)。
      const row = await db.transaction(async (tx) => {
        const [flow] = await tx
          .update(withdrawalFlows)
          .set({
            status: WITHDRAWAL_INT.approved,
            processedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(withdrawalFlows.id, p.data.id),
              eq(withdrawalFlows.status, WITHDRAWAL_INT.pending),
            ),
          )
          .returning()
        if (!flow) return undefined // 已被处理或不存在
        // flow.userId 可空(用户删除时 SET NULL),null 时无法更新余额,跳过(等待人工对账)
        if (flow.userId) {
          const [margin] = await tx
            .update(userMargins)
            .set({
              frozenQuantity: sql`${userMargins.frozenQuantity} - ${flow.amount}`,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(userMargins.userId, flow.userId),
                sql`${userMargins.frozenQuantity} >= ${flow.amount}`,
              ),
            )
            .returning()
          if (!margin) {
            // frozen 已被释放(如回调已处理),资金守恒不允许负数,整体回滚
            throw Object.assign(new Error('冻结资金不足,无法审批'), { statusCode: 400 })
          }
        }
        return flow
      })
      if (!row) return reply.status(404).send(error(404, '记录不存在或已处理'))
      return reply.send(success({ id: row.id, status: 'approved', reviewer: request.userId ?? '' }))
    },
  )

  server.post(
    '/shop/withdrawals/:id/reject',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const p = idParamSchema.safeParse(request.params)
      if (!p.success) return reply.status(400).send(error(400, '参数错误'))
      const b = z.object({ notes: z.string().max(500).optional() }).safeParse(request.body)
      if (!b.success) return reply.status(400).send(error(400, '参数错误'))
      // P1 修复(2026-08-06): 驳回只改 status 不退还冻结,导致用户余额永久卡死。
      // 事务内:① 条件 UPDATE pending→rejected(防并发重复驳回) ② 解冻回退(frozen -= amount, token += amount)。
      const row = await db.transaction(async (tx) => {
        const [flow] = await tx
          .update(withdrawalFlows)
          .set({
            status: WITHDRAWAL_INT.rejected,
            rejectReason: b.data.notes ?? null,
            processedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(withdrawalFlows.id, p.data.id),
              eq(withdrawalFlows.status, WITHDRAWAL_INT.pending),
            ),
          )
          .returning()
        if (!flow) return undefined // 已被处理或不存在
        if (flow.userId) {
          const [margin] = await tx
            .update(userMargins)
            .set({
              tokenQuantity: sql`${userMargins.tokenQuantity} + ${flow.amount}`,
              frozenQuantity: sql`${userMargins.frozenQuantity} - ${flow.amount}`,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(userMargins.userId, flow.userId),
                sql`${userMargins.frozenQuantity} >= ${flow.amount}`,
              ),
            )
            .returning()
          if (!margin) {
            // frozen 已被释放(如回调已处理),资金守恒不允许负数,整体回滚
            throw Object.assign(new Error('冻结资金不足,无法驳回'), { statusCode: 400 })
          }
        }
        return flow
      })
      if (!row) return reply.status(404).send(error(404, '记录不存在或已处理'))
      return reply.send(success({ id: row.id, status: 'rejected', reviewer: request.userId ?? '' }))
    },
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
