import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { and, desc, eq, sql } from 'drizzle-orm'
import { db, dbRead } from '../db/index.js'
import { liveGift, liveGiftCatalog, users, type LiveGift } from '@ihui/database'
import { requireAdmin, requireAuth } from '../plugins/require-permission.js'
import { error, paginatedSuccess, success } from '../utils/response.js'

// =============================================================================
// 礼物目录表(2026-08-31 已纳入共享 schema live-extended.ts 的 liveGiftCatalog,
// 此处保留幂等建表 SQL 兜底,避免依赖 migration 时序)。
// live_gift 仍是"打赏记录表"(channel_id/user_id/gift_name/gift_count/total_price)。
// =============================================================================

const CREATE_CATALOG_SQL = sql`
  CREATE TABLE IF NOT EXISTS live_gift_catalog (
    id serial PRIMARY KEY,
    name varchar(100) NOT NULL,
    icon varchar(500),
    price numeric(20, 4) NOT NULL DEFAULT 0,
    status integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )
`

// =============================================================================
// Zod schemas
// =============================================================================

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.coerce.number().int().min(0).max(1).optional(),
  all: z.enum(['1']).optional(),
})

const idParamSchema = z.object({ id: z.coerce.number().int().positive() })

const createGiftSchema = z.object({
  name: z.string().min(1).max(100),
  icon: z.string().max(500).optional(),
  price: z.coerce.number().nonnegative(),
  status: z.coerce.number().int().min(0).max(1).default(1),
})

const updateGiftSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  icon: z.string().max(500).nullable().optional(),
  price: z.coerce.number().nonnegative().optional(),
  status: z.coerce.number().int().min(0).max(1).optional(),
})

const sendGiftSchema = z.object({
  liveId: z.coerce.number().int().positive().optional(),
  receiverId: z.string().max(64).optional(),
  quantity: z.coerce.number().int().min(1).max(999).default(1),
})

// =============================================================================
// 路由插件
// =============================================================================

export const liveGiftsRoutes: FastifyPluginAsync = async (server) => {
  // 幂等建表(测试环境 db 被 mock,execute 直接放行)
  await db.execute(CREATE_CATALOG_SQL)

  // ----- 礼物列表(默认只返回上架 status=1;管理端可传 status=0 或 all=1) -----
  server.get('/live-gifts', async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = listQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { page, pageSize, status, all } = parsed.data
    const conds = []
    if (all !== '1') conds.push(eq(liveGiftCatalog.status, status ?? 1))
    const where = conds.length ? and(...conds) : undefined

    const [rows, totalRows] = await Promise.all([
      db
        .select()
        .from(liveGiftCatalog)
        .where(where)
        .orderBy(desc(liveGiftCatalog.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(liveGiftCatalog)
        .where(where),
    ])
    return reply.send(paginatedSuccess(rows, totalRows[0]?.count ?? 0, { page, pageSize }))
  })

  // ----- 新增礼物(管理端) -----
  server.post(
    '/live-gifts',
    { preHandler: requireAdmin },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = createGiftSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const rows = await db
        .insert(liveGiftCatalog)
        .values({
          name: parsed.data.name,
          icon: parsed.data.icon ?? null,
          price: String(parsed.data.price),
          status: parsed.data.status,
        })
        .returning()
      const gift = rows[0]
      if (!gift) return reply.status(500).send(error(500, '创建礼物失败'))
      return reply.status(201).send(success({ gift }))
    },
  )

  // ----- 更新礼物(管理端) -----
  server.patch(
    '/live-gifts/:id',
    { preHandler: requireAdmin },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const idParsed = idParamSchema.safeParse(request.params)
      if (!idParsed.success) {
        return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
      }
      const parsed = updateGiftSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const set: Record<string, unknown> = {}
      if (parsed.data.name !== undefined) set.name = parsed.data.name
      if (parsed.data.icon !== undefined) set.icon = parsed.data.icon
      if (parsed.data.price !== undefined) set.price = String(parsed.data.price)
      if (parsed.data.status !== undefined) set.status = parsed.data.status
      set.updatedAt = new Date()

      const rows = await db
        .update(liveGiftCatalog)
        .set(set)
        .where(eq(liveGiftCatalog.id, idParsed.data.id))
        .returning()
      const gift = rows[0]
      if (!gift) return reply.status(404).send(error(404, '礼物不存在'))
      return reply.send(success({ gift }))
    },
  )

  // ----- 打赏(需登录,扣平台币/积分余额 + 写 live_gift 记录) -----
  server.post(
    '/live-gifts/:id/send',
    { preHandler: requireAuth },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const idParsed = idParamSchema.safeParse(request.params)
      if (!idParsed.success) {
        return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
      }
      const parsed = sendGiftSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const quantity = parsed.data.quantity
      const userId = request.userId
      if (!userId) return reply.status(401).send(error(401, '请先登录'))

      const giftRows = await dbRead
        .select()
        .from(liveGiftCatalog)
        .where(and(eq(liveGiftCatalog.id, idParsed.data.id), eq(liveGiftCatalog.status, 1)))
        .limit(1)
      const gift = giftRows[0]
      if (!gift) return reply.status(404).send(error(404, '礼物不存在或已下架'))

      const price = Number(gift.price)
      const totalPrice = Math.round(price * quantity)

      // 赠送人昵称(供记录展示)
      const userRows = await dbRead
        .select({ nickname: users.nickname })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1)
      const nickname = userRows[0]?.nickname ?? null

      // 余额校验(user_token_balance 为平台币/积分余额表)
      const balanceRows = await dbRead.execute(
        sql`SELECT balance FROM user_token_balance WHERE user_uuid = ${userId} LIMIT 1`,
      )
      const balanceRow = balanceRows[0] as { balance: string | number } | undefined
      const currentBalance = balanceRow ? Number(balanceRow.balance) : 0
      if (currentBalance < totalPrice) {
        return reply.status(400).send(error(400, '余额不足'))
      }

      // 原子扣减(条件 UPDATE 兜底并发)
      const updateResult = await db.execute(
        sql`UPDATE user_token_balance SET balance = balance - ${totalPrice}, updated_at = now() WHERE user_uuid = ${userId} AND balance >= ${totalPrice}`,
      )
      const affected = (updateResult as { count?: number }).count
      if (typeof affected === 'number' && affected < 1) {
        return reply.status(400).send(error(400, '余额不足'))
      }

      // 写打赏记录(live_gift 表)
      const inserted = await db
        .insert(liveGift)
        .values({
          channelId: parsed.data.liveId ?? 0,
          userId,
          userName: nickname,
          giftId: gift.id,
          giftName: gift.name,
          giftCount: quantity,
          totalPrice,
        })
        .returning()
      const record = inserted[0]
      if (!record) return reply.status(500).send(error(500, '写入打赏记录失败'))

      return reply.send(success({ record, balanceAfter: Math.max(0, currentBalance - totalPrice) }))
    },
  )

  // ----- 打赏记录列表(分页) -----
  server.get('/live-gifts/records', async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = listQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { page, pageSize } = parsed.data
    const [rows, totalRows] = await Promise.all([
      db
        .select({ record: liveGift, senderName: users.nickname })
        .from(liveGift)
        .leftJoin(users, eq(liveGift.userId, users.id))
        .orderBy(desc(liveGift.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      db.select({ count: sql<number>`count(*)::int` }).from(liveGift),
    ])
    const items: (LiveGift & { senderName: string | null })[] = rows.map((r) => ({
      ...r.record,
      senderName: r.senderName,
    }))
    return reply.send(paginatedSuccess(items, totalRows[0]?.count ?? 0, { page, pageSize }))
  })
}
