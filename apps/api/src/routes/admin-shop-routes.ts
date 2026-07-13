/**
 * 管理后台商城/API 分组路由（5 个端点）。
 * 替代 admin-missing-routes.ts 中的 registerEmptyStub 空桩。
 * 复用现有 userMargins/tokenFlows/zhsProduct/withdrawalFlows/developerApiKeys 表。
 */
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { eq, or, ilike, desc, sql, and, inArray, type SQL } from 'drizzle-orm'
import { db } from '../db/index.js'
import { requireAdmin } from '../plugins/require-permission.js'
import { success, error, emptyToUndefined } from '../utils/response.js'
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
  search: z.preprocess(emptyToUndefined, z.string().max(200).optional()),
})

const idParamSchema = z.object({ id: z.string() })

const productStatusSchema = z.enum(['online', 'offline'])
type ProductStatus = z.infer<typeof productStatusSchema>
const PRODUCT_INT: Record<ProductStatus, number> = { online: 1, offline: 0 }
const isProductStatus = (s: string): s is ProductStatus => s === 'online' || s === 'offline'
const productStatusFromInt = (s: number | null): ProductStatus => (s === 1 ? 'online' : 'offline')

const withdrawalStatusSchema = z.enum(['pending', 'approved', 'rejected', 'completed', 'failed'])
type WithdrawalStatus = z.infer<typeof withdrawalStatusSchema>
const WITHDRAWAL_INT: Record<WithdrawalStatus, number> = {
  pending: 0,
  approved: 1,
  completed: 2,
  failed: 3,
  rejected: 4,
}
const WITHDRAWAL_STATUS_LIST = ['pending', 'approved', 'rejected', 'completed', 'failed'] as const
const isWithdrawalStatus = (s: string): s is WithdrawalStatus =>
  (WITHDRAWAL_STATUS_LIST as readonly string[]).includes(s)
const withdrawalStatusFromInt = (s: number): WithdrawalStatus => {
  if (s === 1) return 'approved'
  if (s === 2) return 'completed'
  if (s === 3) return 'failed'
  if (s === 4) return 'rejected'
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
        totalRecharge: sql<number>`coalesce(sum(case when ${tokenFlows.opType} = 0 then ${tokenFlows.quantity} else 0 end), 0)::int`,
        totalConsume: sql<number>`coalesce(sum(case when ${tokenFlows.opType} = 1 then ${tokenFlows.quantity} else 0 end), 0)::int`,
      })
      .from(tokenFlows)
      .where(inArray(tokenFlows.opType, [0, 1]))
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
    name: z.preprocess(emptyToUndefined, z.string().max(200).optional()),
    category: z.preprocess(emptyToUndefined, z.string().max(100).optional()),
    status: z.preprocess(emptyToUndefined, z.string().max(20).optional()),
    type: z.preprocess(emptyToUndefined, z.string().max(50).optional()),
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
    if (!row) return reply.status(500).send(error(500, '创建失败'))
    return reply.status(201).send(success({ id: String(row.id), ...mapProduct(row) }))
  })

  server.patch('/shop/products/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    const b = productBodySchema.partial().safeParse(request.body)
    if (!b.success) return reply.status(400).send(error(400, '参数错误'))
    const set: Partial<typeof zhsProduct.$inferInsert> = { updatedAt: new Date() }
    if (b.data.name !== undefined) set.name = b.data.name
    if (b.data.price !== undefined) set.price = b.data.price
    if (b.data.type !== undefined) set.type = b.data.type
    if (b.data.status !== undefined) set.status = PRODUCT_INT[b.data.status]
    const [row] = await db
      .update(zhsProduct)
      .set(set)
      .where(eq(zhsProduct.id, Number(p.data.id)))
      .returning()
    if (!row) return reply.status(404).send(error(404, '商品不存在'))
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
      if (!row) return reply.status(404).send(error(404, '商品不存在'))
      return reply.send(success({ id: String(row.id), status: productStatusFromInt(row.status) }))
    },
  )

  server.delete('/shop/products/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
    await db.delete(zhsProduct).where(eq(zhsProduct.id, Number(p.data.id)))
    return reply.send(success({ id: p.data.id, deleted: true }))
  })

  // 4. /shop/withdrawals — withdrawalFlows CRUD + approve/reject
  const withdrawalQuerySchema = paginationSchema.extend({
    status: z.preprocess(emptyToUndefined, z.string().max(20).optional()),
    user: z.preprocess(emptyToUndefined, z.string().max(100).optional()),
    outBillNo: z.preprocess(emptyToUndefined, z.string().max(64).optional()),
    reviewer: z.preprocess(emptyToUndefined, z.string().max(100).optional()),
    userName: z.preprocess(emptyToUndefined, z.string().max(100).optional()),
    minAmount: z.preprocess(emptyToUndefined, z.coerce.number().int().optional()),
    maxAmount: z.preprocess(emptyToUndefined, z.coerce.number().int().optional()),
  })
  const withdrawalBodySchema = z.object({
    user: z.string().min(1),
    amount: z.coerce.number().int().min(0),
    channel: z.enum(['alipay', 'wechat', 'bank']),
    account: z.string().max(255),
    status: withdrawalStatusSchema.default('pending'),
  })

  server.get('/shop/withdrawals', async (request: FastifyRequest, reply: FastifyReply) => {
    const q = withdrawalQuerySchema.safeParse(request.query)
    if (!q.success) return reply.status(400).send(error(400, '参数错误'))
    const { page, pageSize, status, user, outBillNo, userName, minAmount, maxAmount } = q.data
    const conds: (SQL | undefined)[] = []
    if (status && isWithdrawalStatus(status))
      conds.push(eq(withdrawalFlows.status, WITHDRAWAL_INT[status]))
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

  server.post('/shop/withdrawals', async (request: FastifyRequest, reply: FastifyReply) => {
    const b = withdrawalBodySchema.safeParse(request.body)
    if (!b.success) return reply.status(400).send(error(400, '参数错误'))
    const [row] = await db
      .insert(withdrawalFlows)
      .values({
        userId: b.data.user,
        amount: b.data.amount,
        originalAmount: b.data.amount,
        method: b.data.channel,
        accountInfo: { account: b.data.account },
        status: WITHDRAWAL_INT[b.data.status],
      })
      .returning()
    if (!row) return reply.status(500).send(error(500, '创建失败'))
    return reply.status(201).send(success({ id: row.id }))
  })

  server.put('/shop/withdrawals/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数错误'))
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
    await db.delete(withdrawalFlows).where(eq(withdrawalFlows.id, p.data.id))
    return reply.send(success({ id: p.data.id, deleted: true }))
  })

  server.post(
    '/shop/withdrawals/:id/approve',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const p = idParamSchema.safeParse(request.params)
      if (!p.success) return reply.status(400).send(error(400, '参数错误'))
      const [row] = await db
        .update(withdrawalFlows)
        .set({
          status: WITHDRAWAL_INT.approved,
          processedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(withdrawalFlows.id, p.data.id))
        .returning()
      if (!row) return reply.status(404).send(error(404, '记录不存在'))
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
      const [row] = await db
        .update(withdrawalFlows)
        .set({
          status: WITHDRAWAL_INT.rejected,
          rejectReason: b.data.notes ?? null,
          processedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(withdrawalFlows.id, p.data.id))
        .returning()
      if (!row) return reply.status(404).send(error(404, '记录不存在'))
      return reply.send(success({ id: row.id, status: 'rejected', reviewer: request.userId ?? '' }))
    },
  )
}
