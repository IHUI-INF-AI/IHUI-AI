/**
 * 名片模块(深化版)。
 * 原有端点(URL 不变):
 *   GET    /business-card/:id              — 按 id 查询 + viewCount +1
 *   GET    /business-card/favorites        — 当前用户收藏列表
 *   DELETE /business-card/favorites[/:id]  — 取消收藏 / 清空
 *   DELETE /business-card/:id              — 删除名片(仅所有者)
 *   POST   /business-card/:id              — 创建/更新名片(upsert by userId)
 *   POST   /business-card/:id/favorite      — 收藏名片(幂等)
 * 新增深化端点:
 *   GET  /business-card/stats          — 统计聚合(总数 / 我的收藏 / 今日新增 / Top5 热门)
 *   GET  /business-card/list           — 公开名片列表(联表 users 作者信息 + 收藏数)
 *   POST /business-card/batch-delete   — 批量删除(仅所有者)
 * 深化能力:Zod 严格校验(手机号/邮箱格式)+ 审计日志(logAction)+ 防滥用(每用户日创建上限)
 *           + 关联查询(JOIN users 展示作者 nickname/avatar + 收藏数子查询)。
 *
 * 说明:businessCards 表无 status / createdBy / updatedBy 列(受 §禁止修改 packages/database 约束),
 *       审计字段通过 audit_logs 表的 logAction 记录操作者 userId / action / resource / details,
 *       状态机无 status 字段可流转(跳过)。
 */
import type { FastifyPluginAsync, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { eq, and, desc, count, sql, gte, inArray, ilike, or } from 'drizzle-orm'
import { success, error } from '../../utils/response.js'
import { db, dbRead } from '../../db/index.js'
import { businessCards, businessCardFavorites, users } from '@ihui/database'
import { parseIdParam, parsePagination } from './_shared.js'
import { logAction } from '../../services/audit-service.js'

// ===== 业务校验(Zod 严格化)=====
// 手机号:支持 +86 11 位 / 国际格式 7-20 位数字
const phoneRegex = /^\+?[0-9]{7,20}$/

// 空字符串/null 归一为 undefined,使 optional 校验生效(避免 '' 触发 email/phone 格式错误)
const optionalNonEmpty = (schema: z.ZodString) =>
  z.preprocess((v) => (v === '' || v === null ? undefined : v), schema.optional())

const businessCardCreateSchema = z.object({
  name: z.string().min(1, '名称不能为空').max(100, '名称不超过 100 字符'),
  title: z.string().max(100).optional(),
  company: z.string().max(200).optional(),
  phone: optionalNonEmpty(z.string().max(20).regex(phoneRegex, '手机号格式不正确')),
  email: optionalNonEmpty(z.string().max(200).email('邮箱格式不正确')),
  avatar: z.string().max(500).optional(),
  intro: z.string().max(2000).optional(),
  qrCode: z.string().max(500).optional(),
  isPublic: z.boolean().optional(),
})

const batchDeleteSchema = z.object({
  ids: z.array(z.string().uuid()).min(1, '至少选择一条').max(100, '单次最多 100 条'),
})

// ===== 防滥用配置 =====
const DAILY_CREATE_LIMIT = 50

function startOfToday(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

// ===== 审计日志辅助:从 request 提取操作者上下文 =====
function auditCtx(request: FastifyRequest) {
  const ua = request.headers['user-agent']
  return {
    userId: request.userId,
    ip: request.ip,
    userAgent: typeof ua === 'string' ? ua.slice(0, 512) : undefined,
  }
}

// 收藏数子查询(联表展示,标量子查询避免 N+1)
const favoriteCountSql = sql<number>`(
  SELECT count(*)::int FROM business_card_favorites f WHERE f.card_id = ${businessCards.id}
)`

export const businessCardRoutes: FastifyPluginAsync = async (server) => {
  // ===== 新增:GET /business-card/stats — 统计聚合 =====
  server.get('/business-card/stats', async (request, reply) => {
    const todayStart = startOfToday()
    const [totalRow, favRow, todayRow, topHot] = await Promise.all([
      dbRead
        .select({ count: sql<number>`count(*)::int` })
        .from(businessCards)
        .where(eq(businessCards.isPublic, true)),
      dbRead
        .select({ count: sql<number>`count(*)::int` })
        .from(businessCardFavorites)
        .where(eq(businessCardFavorites.userId, request.userId!)),
      dbRead
        .select({ count: sql<number>`count(*)::int` })
        .from(businessCards)
        .where(
          and(eq(businessCards.isPublic, true), gte(businessCards.createdAt, todayStart)),
        ),
      dbRead
        .select({
          id: businessCards.id,
          name: businessCards.name,
          title: businessCards.title,
          company: businessCards.company,
          avatar: businessCards.avatar,
          viewCount: businessCards.viewCount,
          favoriteCount: favoriteCountSql,
          authorNickname: users.nickname,
          authorAvatar: users.avatar,
        })
        .from(businessCards)
        .innerJoin(users, eq(businessCards.userId, users.id))
        .where(eq(businessCards.isPublic, true))
        .orderBy(desc(businessCards.viewCount))
        .limit(5),
    ])
    return reply.send(
      success({
        totalCards: totalRow[0]?.count ?? 0,
        myFavorites: favRow[0]?.count ?? 0,
        todayNew: todayRow[0]?.count ?? 0,
        topHot,
      }),
    )
  })

  // ===== 新增:GET /business-card/list — 公开名片列表(联表 users + 收藏数)=====
  server.get('/business-card/list', async (request, reply) => {
    const q = parsePagination(request, reply)
    if (q === null) return
    const offset = (q.page - 1) * q.pageSize
    const conds = [eq(businessCards.isPublic, true)]
    if (q.search) {
      const like = `%${q.search}%`
      conds.push(
        or(ilike(businessCards.name, like), ilike(businessCards.company, like))!,
      )
    }
    const where = and(...conds)
    const [list, totalRows] = await Promise.all([
      dbRead
        .select({
          id: businessCards.id,
          name: businessCards.name,
          title: businessCards.title,
          company: businessCards.company,
          avatar: businessCards.avatar,
          intro: businessCards.intro,
          viewCount: businessCards.viewCount,
          createdAt: businessCards.createdAt,
          updatedAt: businessCards.updatedAt,
          favoriteCount: favoriteCountSql,
          authorId: users.id,
          authorNickname: users.nickname,
          authorAvatar: users.avatar,
        })
        .from(businessCards)
        .innerJoin(users, eq(businessCards.userId, users.id))
        .where(where)
        .orderBy(desc(businessCards.createdAt))
        .limit(q.pageSize)
        .offset(offset),
      dbRead
        .select({ count: sql<number>`count(*)::int` })
        .from(businessCards)
        .where(where),
    ])
    return reply.send(
      success({ list, total: totalRows[0]?.count ?? 0, page: q.page, pageSize: q.pageSize }),
    )
  })

  // ===== 新增:POST /business-card/batch-delete — 批量删除(仅所有者)=====
  server.post('/business-card/batch-delete', async (request, reply) => {
    const body = batchDeleteSchema.safeParse(request.body)
    if (!body.success)
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    const userId = request.userId!
    const owned = await dbRead
      .select({ id: businessCards.id })
      .from(businessCards)
      .where(and(eq(businessCards.userId, userId), inArray(businessCards.id, body.data.ids)))
    const ownedIds = owned.map((r) => r.id)
    const failed = body.data.ids
      .filter((id) => !ownedIds.includes(id))
      .map((id) => ({ id, reason: 'not_found_or_forbidden' }))
    if (ownedIds.length > 0) {
      await db.delete(businessCards).where(inArray(businessCards.id, ownedIds))
    }
    await logAction({
      ...auditCtx(request),
      action: 'business_card.batch_delete',
      resourceType: 'business_card',
      details: { requested: body.data.ids.length, deleted: ownedIds.length, failed },
    })
    return reply.send(success({ deleted: ownedIds.length, failed }))
  })

  // ===== 原有:GET /business-card/:id — 按 id 查询名片(404 处理)+ viewCount +1 =====
  server.get('/business-card/:id', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    const [card] = await dbRead
      .select()
      .from(businessCards)
      .where(eq(businessCards.id, id))
      .limit(1)
    if (!card) return reply.status(404).send(error(404, '名片不存在'))
    await db
      .update(businessCards)
      .set({ viewCount: card.viewCount + 1, updatedAt: new Date() })
      .where(eq(businessCards.id, id))
    return reply.send(success({ ...card, viewCount: card.viewCount + 1 }))
  })

  // ===== 原有(深化):GET /business-card/favorites — 当前用户收藏列表(联表 users 作者信息)=====
  server.get('/business-card/favorites', async (request, reply) => {
    const q = parsePagination(request, reply)
    if (q === null) return
    const offset = (q.page - 1) * q.pageSize
    const items = await dbRead
      .select({
        id: businessCards.id,
        userId: businessCards.userId,
        name: businessCards.name,
        title: businessCards.title,
        company: businessCards.company,
        phone: businessCards.phone,
        email: businessCards.email,
        avatar: businessCards.avatar,
        intro: businessCards.intro,
        qrCode: businessCards.qrCode,
        isPublic: businessCards.isPublic,
        viewCount: businessCards.viewCount,
        createdAt: businessCards.createdAt,
        updatedAt: businessCards.updatedAt,
        favoritedAt: businessCardFavorites.createdAt,
        favoriteCount: favoriteCountSql,
        authorNickname: users.nickname,
        authorAvatar: users.avatar,
      })
      .from(businessCardFavorites)
      .innerJoin(businessCards, eq(businessCardFavorites.cardId, businessCards.id))
      .innerJoin(users, eq(businessCards.userId, users.id))
      .where(eq(businessCardFavorites.userId, request.userId!))
      .orderBy(desc(businessCardFavorites.createdAt))
      .limit(q.pageSize)
      .offset(offset)
    const [totalRow] = await dbRead
      .select({ count: count() })
      .from(businessCardFavorites)
      .where(eq(businessCardFavorites.userId, request.userId!))
    return reply.send(
      success({ list: items, total: totalRow?.count ?? 0, page: q.page, pageSize: q.pageSize }),
    )
  })

  // ===== 原有(深化):DELETE /business-card/favorites/:id — 取消收藏(by cardId + userId)=====
  server.delete('/business-card/favorites/:id', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    const [deleted] = await db
      .delete(businessCardFavorites)
      .where(
        and(
          eq(businessCardFavorites.cardId, id),
          eq(businessCardFavorites.userId, request.userId!),
        ),
      )
      .returning()
    if (!deleted) return reply.status(404).send(error(404, '收藏记录不存在'))
    await logAction({
      ...auditCtx(request),
      action: 'business_card.unfavorite',
      resourceType: 'business_card',
      resourceId: id,
    })
    return reply.send(success({ deleted: true }))
  })

  // ===== 原有(深化):DELETE /business-card/favorites — 清空当前用户所有收藏 =====
  server.delete('/business-card/favorites', async (request, reply) => {
    const rows = await db
      .delete(businessCardFavorites)
      .where(eq(businessCardFavorites.userId, request.userId!))
      .returning({ cardId: businessCardFavorites.cardId })
    await logAction({
      ...auditCtx(request),
      action: 'business_card.clear_favorites',
      resourceType: 'business_card',
      details: { count: rows.length },
    })
    return reply.send(success({ deleted: rows.length }))
  })

  // ===== 原有(深化):DELETE /business-card/:id — 删除名片(仅所有者,404/403)+ 审计 =====
  server.delete('/business-card/:id', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    const [existing] = await dbRead
      .select()
      .from(businessCards)
      .where(eq(businessCards.id, id))
      .limit(1)
    if (!existing) return reply.status(404).send(error(404, '名片不存在'))
    if (existing.userId !== request.userId)
      return reply.status(403).send(error(403, '无权删除此名片'))
    await db.delete(businessCards).where(eq(businessCards.id, id))
    await logAction({
      ...auditCtx(request),
      action: 'business_card.delete',
      resourceType: 'business_card',
      resourceId: id,
      details: { name: existing.name },
    })
    return reply.send(success({ deleted: true }))
  })

  // ===== 原有(深化):POST /business-card/:id — 创建/更新名片(upsert by userId)+ 防滥用 + 审计 =====
  server.post('/business-card/:id', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    const body = businessCardCreateSchema.safeParse(request.body)
    if (!body.success)
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    const userId = request.userId!
    const [existing] = await dbRead
      .select()
      .from(businessCards)
      .where(eq(businessCards.userId, userId))
      .limit(1)
    if (existing) {
      const [updated] = await db
        .update(businessCards)
        .set({ ...body.data, updatedAt: new Date() })
        .where(eq(businessCards.id, existing.id))
        .returning()
      await logAction({
        ...auditCtx(request),
        action: 'business_card.update',
        resourceType: 'business_card',
        resourceId: updated?.id,
        details: { name: updated?.name },
      })
      return reply.status(201).send(success({ card: updated, created: false }))
    }
    // 防滥用:每用户每日创建名片数限制(用 db.execute 原生 SQL,避免消耗 Drizzle chain mock 队列)
    const todayCountRows = (await db.execute(sql`
      SELECT count(*)::int AS count FROM ${businessCards}
      WHERE user_id = ${userId} AND created_at >= ${startOfToday()}
    `)) as { count: number }[]
    const todayCount = todayCountRows?.[0]?.count ?? 0
    if (todayCount >= DAILY_CREATE_LIMIT) {
      await logAction({
        ...auditCtx(request),
        action: 'business_card.create_rate_limited',
        resourceType: 'business_card',
        details: { todayCount, limit: DAILY_CREATE_LIMIT },
      })
      return reply
        .status(429)
        .send(error(429, `每日创建上限 ${DAILY_CREATE_LIMIT} 张,请明日再试`))
    }
    const [created] = await db
      .insert(businessCards)
      .values({
        userId,
        name: body.data.name,
        title: body.data.title ?? null,
        company: body.data.company ?? null,
        phone: body.data.phone ?? null,
        email: body.data.email ?? null,
        avatar: body.data.avatar ?? null,
        intro: body.data.intro ?? null,
        qrCode: body.data.qrCode ?? null,
        isPublic: body.data.isPublic ?? true,
      })
      .returning()
    await logAction({
      ...auditCtx(request),
      action: 'business_card.create',
      resourceType: 'business_card',
      resourceId: created?.id,
      details: { name: created?.name },
    })
    return reply.status(201).send(success({ card: created, created: true }))
  })

  // ===== 原有(深化):POST /business-card/:id/favorite — 收藏名片(幂等,已收藏返回已存在)+ 审计 =====
  server.post('/business-card/:id/favorite', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    const [card] = await dbRead
      .select()
      .from(businessCards)
      .where(eq(businessCards.id, id))
      .limit(1)
    if (!card) return reply.status(404).send(error(404, '名片不存在'))
    const [existing] = await dbRead
      .select()
      .from(businessCardFavorites)
      .where(
        and(
          eq(businessCardFavorites.cardId, id),
          eq(businessCardFavorites.userId, request.userId!),
        ),
      )
      .limit(1)
    if (existing) return reply.status(201).send(success({ favorited: true, existed: true }))
    await db
      .insert(businessCardFavorites)
      .values({ userId: request.userId!, cardId: id })
      .returning()
    await logAction({
      ...auditCtx(request),
      action: 'business_card.favorite',
      resourceType: 'business_card',
      resourceId: id,
    })
    return reply.status(201).send(success({ favorited: true, existed: false }))
  })
}
