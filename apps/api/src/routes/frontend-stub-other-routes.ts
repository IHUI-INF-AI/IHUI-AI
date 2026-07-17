/**
 * 前端 other 模块缺失路由桩 → 真实实现升级。
 *
 * 来源:api-routes-missing.json 中未匹配到后端路由的调用。
 * 策略:
 *  - 有 schema 表支持的真空桩 → 接入真实 DB 查询 + 业务逻辑(Drizzle ORM)。
 *  - 需新表的路由 → 保留空桩并标注 `NEEDS_NEW_TABLE: <表名>`,待 schema 补全后激活。
 *  - 路径与现有真实实现不同但语义相同的(如 /developer/keys vs /developer/api-keys)→ 保留路径并接入同一张表。
 *
 * 所有路由:
 *  - 使用 authenticate 中间件(用户端需登录)
 *  - 响应格式统一 { code: 0, message: 'success', data }
 *  - 列表接口支持分页(page/pageSize)
 */
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { eq, and, desc, asc, sql, or, isNotNull, count } from 'drizzle-orm'
import { authenticate } from '../plugins/auth.js'
import { success, error, emptyToUndefined } from '../utils/response.js'
import { db, dbRead } from '../db/index.js'
import {
  aiWorldItems,
  developerApiKeys,
  developerSubscriptions,
  developerPricing,
  teamInvitations,
  teamMembers,
  aiGcContent,
  contentGenerationTemplates,
  knowledgeBase,
  levels,
  circles,
  circleMembers,
  zhsFaq,
  tools,
  notifications,
  messages,
  userProfiles,
  tourContent,
  aiCapabilities,
  aiCapabilityTemplates,
  businessCards,
  businessCardFavorites,
  serviceAppointments,
  userAddresses,
} from '@ihui/database'
import { findActivityById, joinActivity } from '../db/promotion-queries.js'
import { findAuditLogList } from '../db/oauth-queries.js'
import {
  findTickets,
  findTicketById,
  findCommentsByTicket,
  findRatingByTicket,
  transitionTicket,
} from '../db/customer-service-queries.js'
import { findUserPreferences, upsertUserPreference } from '../db/user-preferences-queries.js'
import { findSecurityLogs } from '../db/security-logs-queries.js'
import { createMessage } from '../db/notification-queries.js'
import { findGenerationHistory, findGenerationTemplates } from '../db/content-generation-queries.js'

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.preprocess(emptyToUndefined, z.string().max(200).optional()),
})

const idParamSchema = z.object({ id: z.string() })

function parsePagination(request: FastifyRequest, reply: FastifyReply) {
  const parsed = paginationSchema.safeParse(request.query)
  if (!parsed.success) {
    reply.status(400).send(error(400, '参数错误'))
    return null
  }
  return parsed.data
}

function parseIdParam(request: FastifyRequest, reply: FastifyReply) {
  const parsed = idParamSchema.safeParse(request.params)
  if (!parsed.success) {
    reply.status(400).send(error(400, '参数错误'))
    return null
  }
  return parsed.data.id
}

export const frontendStubOtherRoutes: FastifyPluginAsync = async (server) => {
  // 统一鉴权:所有路由需登录
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await authenticate(request)
    } catch (e) {
      const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
      return reply
        .status(statusCode)
        .send(error(statusCode, (e as Error).message || 'Authentication required'))
    }
  })

  // ===========================================================================
  // 1. 活动模块 /activities/* (1 个)
  // ===========================================================================

  // POST /activities/:id — 用户报名参与活动(activityParticipants 表)
  server.post('/activities/:id', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    const activity = await findActivityById(id)
    if (!activity) return reply.status(404).send(error(404, '活动不存在'))
    if (activity.status !== 'published')
      return reply.status(400).send(error(400, '活动未发布或已结束'))
    const participant = await joinActivity(id, request.userId!, request.body)
    if (!participant) return reply.send(success({ joined: true, message: '已参与该活动' }))
    return reply.status(201).send(success({ joined: true, participant }))
  })

  // ===========================================================================
  // 2. OAuth 应用审计日志 /agents/oauth-apps/* (1 个)
  // ===========================================================================
  // 注:真实实现在 /oauth-apps/audit-logs (agents.ts),此处路径不同,接入同一张表

  server.get('/agents/oauth-apps/audit-logs', async (request, reply) => {
    const q = z
      .object({
        page: z.coerce.number().int().min(1).default(1),
        pageSize: z.coerce.number().int().min(1).max(100).default(20),
        clientId: z.preprocess(emptyToUndefined, z.string().optional()),
        event: z.preprocess(emptyToUndefined, z.string().optional()),
        status: z.preprocess(emptyToUndefined, z.string().optional()),
      })
      .parse(request.query)
    const { items, total } = await findAuditLogList({
      page: q.page,
      limit: q.pageSize,
      clientId: q.clientId,
      event: q.event,
      status: q.status,
      userId: request.userId,
    })
    return reply.send(success({ list: items, total, page: q.page, pageSize: q.pageSize }))
  })

  // ===========================================================================
  // 3. AI 世界 /ai-world/* (2 个)
  // ===========================================================================

  // POST /ai-world/create — 创建 AI 世界条目
  server.post('/ai-world/create', async (request, reply) => {
    const body = z
      .object({
        title: z.string().min(1).max(200),
        content: z.string().optional(),
        coverImage: z.string().max(500).optional(),
        categoryId: z.string().uuid().optional(),
        status: z.number().int().default(1),
      })
      .safeParse(request.body)
    if (!body.success)
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    const [item] = await db
      .insert(aiWorldItems)
      .values({
        title: body.data.title,
        content: body.data.content ?? null,
        coverImage: body.data.coverImage ?? null,
        categoryId: body.data.categoryId ?? null,
        authorId: request.userId,
        status: body.data.status,
      })
      .returning()
    return reply.status(201).send(success({ item }))
  })

  // PUT /ai-world/:id — 更新 AI 世界条目
  server.put('/ai-world/:id', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    const body = z
      .object({
        title: z.string().min(1).max(200).optional(),
        content: z.string().optional(),
        coverImage: z.string().max(500).optional(),
        categoryId: z.string().uuid().optional(),
        status: z.number().int().optional(),
      })
      .safeParse(request.body)
    if (!body.success)
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    const [existing] = await dbRead
      .select()
      .from(aiWorldItems)
      .where(eq(aiWorldItems.id, id))
      .limit(1)
    if (!existing) return reply.status(404).send(error(404, '条目不存在'))
    const [updated] = await db
      .update(aiWorldItems)
      .set({ ...body.data, updatedAt: new Date() })
      .where(eq(aiWorldItems.id, id))
      .returning()
    return reply.send(success({ item: updated }))
  })

  // ===========================================================================
  // 4. LLM 流式补全 /llm/complete/stream (1 个) — NEEDS_NEW_TABLE: llm_call_logs
  // ===========================================================================
  // 真实实现需调用 AI-service /api/llm/complete 并转发 SSE 流,此处保留空桩

  server.post('/llm/complete/stream', async (_request, reply) => {
    // NEEDS_NEW_TABLE: llm_call_logs (记录 LLM 调用流水)
    // 真实实现:转发到 AI_SERVICE_URL/api/llm/complete 并以 SSE 流式返回
    return reply.send(success({ stream: false, message: 'LLM 流式补全需接入 AI service' }))
  })

  // ===========================================================================
  // 5. 名片模块 /business-card/* (7 个)
  // ===========================================================================

  const businessCardCreateSchema = z.object({
    name: z.string().min(1).max(100),
    title: z.string().max(100).optional(),
    company: z.string().max(200).optional(),
    phone: z.string().max(20).optional(),
    email: z.string().max(200).optional(),
    avatar: z.string().max(500).optional(),
    intro: z.string().optional(),
    qrCode: z.string().max(500).optional(),
    isPublic: z.boolean().optional(),
  })

  // GET /business-card/:id — 按 id 查询名片(404 处理)+ viewCount +1
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

  // GET /business-card/favorites — 当前用户收藏的名片列表(分页,联表 business_cards)
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
      })
      .from(businessCardFavorites)
      .innerJoin(businessCards, eq(businessCardFavorites.cardId, businessCards.id))
      .where(eq(businessCardFavorites.userId, request.userId!))
      .orderBy(desc(businessCardFavorites.createdAt))
      .limit(q.pageSize)
      .offset(offset)
    const [totalRow] = await dbRead
      .select({ count: count() })
      .from(businessCardFavorites)
      .where(eq(businessCardFavorites.userId, request.userId!))
    return reply.send(success({ list: items, total: totalRow?.count ?? 0, page: q.page, pageSize: q.pageSize }))
  })

  // DELETE /business-card/favorites/:id — 取消收藏(by cardId + userId)
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
    return reply.send(success({ deleted: true }))
  })

  // DELETE /business-card/favorites — 清空当前用户所有收藏
  server.delete('/business-card/favorites', async (request, reply) => {
    await db
      .delete(businessCardFavorites)
      .where(eq(businessCardFavorites.userId, request.userId!))
    return reply.send(success({ deleted: true }))
  })

  // DELETE /business-card/:id — 删除名片(仅所有者,404/403)
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
    return reply.send(success({ deleted: true }))
  })

  // POST /business-card/:id — 创建/更新名片(:id 为用户标识,upsert 该用户的名片)
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
      return reply.status(201).send(success({ card: updated, created: false }))
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
    return reply.status(201).send(success({ card: created, created: true }))
  })

  // POST /business-card/:id/favorite — 收藏名片(幂等,已收藏返回已存在)
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
    return reply.status(201).send(success({ favorited: true, existed: false }))
  })

  // ===========================================================================
  // 6. 开发者模块 /developer/keys, /developer/subscription, /developer/team (9 个)
  // ===========================================================================
  // 注:真实 /developer/api-keys 已在 developer.ts 实现,此处路径不同,接入同一张 developerApiKeys 表

  // POST /developer/keys — 创建 API 密钥(兼容路径)
  server.post('/developer/keys', async (request, reply) => {
    const body = z
      .object({
        name: z.string().min(1).max(100),
        permissions: z.array(z.string()).default([]),
        rateLimit: z.number().int().min(1).max(10000).optional(),
      })
      .safeParse(request.body)
    if (!body.success)
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    const apiKey = `ihui_${randomUUID().replace(/-/g, '').slice(0, 24)}`
    const apiSecret = `sk_${randomUUID().replace(/-/g, '')}`
    const [record] = await db
      .insert(developerApiKeys)
      .values({
        userId: request.userId!,
        name: body.data.name,
        key: apiKey,
        secret: apiSecret,
        permissions: body.data.permissions,
        rateLimit: body.data.rateLimit ?? 60,
      })
      .returning()
    request.skipResponseSanitization = true
    return reply.status(201).send(success({ apiKey: record, secret: apiSecret }))
  })

  // DELETE /developer/keys/:id — 删除 API 密钥
  server.delete('/developer/keys/:id', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    const [deleted] = await db
      .delete(developerApiKeys)
      .where(eq(developerApiKeys.id, id))
      .returning()
    if (!deleted) return reply.status(404).send(error(404, 'API 密钥不存在'))
    if (deleted.userId !== request.userId)
      return reply.status(403).send(error(403, '无权删除此 API 密钥'))
    return reply.send(success({ ok: true }))
  })

  // POST /developer/keys/:id/reset — 重置密钥 secret
  server.post('/developer/keys/:id/reset', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    const [existing] = await dbRead
      .select()
      .from(developerApiKeys)
      .where(eq(developerApiKeys.id, id))
      .limit(1)
    if (!existing) return reply.status(404).send(error(404, 'API 密钥不存在'))
    if (existing.userId !== request.userId)
      return reply.status(403).send(error(403, '无权重置此 API 密钥'))
    const newSecret = `sk_${randomUUID().replace(/-/g, '')}`
    const [updated] = await db
      .update(developerApiKeys)
      .set({ secret: newSecret, updatedAt: new Date() })
      .where(eq(developerApiKeys.id, id))
      .returning()
    request.skipResponseSanitization = true
    return reply.status(201).send(success({ apiKey: updated, secret: newSecret }))
  })

  // POST /developer/subscription — 开通开发者订阅
  server.post('/developer/subscription', async (request, reply) => {
    const body = z
      .object({
        pricingId: z.string().uuid('无效的套餐 ID'),
        period: z.enum(['monthly', 'yearly']).optional(),
      })
      .safeParse(request.body)
    if (!body.success)
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    const [pricing] = await dbRead
      .select()
      .from(developerPricing)
      .where(and(eq(developerPricing.id, body.data.pricingId), eq(developerPricing.status, 1)))
      .limit(1)
    if (!pricing) return reply.status(404).send(error(404, '开发者套餐不存在或已下架'))
    const period = body.data.period ?? pricing.period ?? 'monthly'
    const days = period === 'yearly' ? 365 : 30
    const now = new Date()
    const [sub] = await db
      .insert(developerSubscriptions)
      .values({
        userId: request.userId!,
        pricingId: pricing.id,
        period,
        startTime: now,
        endTime: new Date(now.getTime() + days * 86400_000),
        status: 1,
      })
      .returning()
    return reply.status(201).send(success({ subscription: sub }))
  })

  // POST /developer/subscription/renew — 续费
  server.post('/developer/subscription/renew', async (request, reply) => {
    const body = z
      .object({ period: z.enum(['monthly', 'yearly']).optional() })
      .safeParse(request.body)
    if (!body.success)
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    const [existing] = await dbRead
      .select()
      .from(developerSubscriptions)
      .where(
        and(
          eq(developerSubscriptions.userId, request.userId!),
          eq(developerSubscriptions.status, 1),
        ),
      )
      .orderBy(desc(developerSubscriptions.createdAt))
      .limit(1)
    if (!existing) return reply.status(404).send(error(404, '无生效中的订阅'))
    const period = body.data.period ?? existing.period ?? 'monthly'
    const days = period === 'yearly' ? 365 : 30
    const baseTime = existing.endTime > new Date() ? existing.endTime : new Date()
    const [renewed] = await db
      .update(developerSubscriptions)
      .set({ endTime: new Date(baseTime.getTime() + days * 86400_000), updatedAt: new Date() })
      .where(eq(developerSubscriptions.id, existing.id))
      .returning()
    return reply.status(201).send(success({ subscription: renewed }))
  })

  // POST /developer/subscription/upgrade — 升级套餐
  server.post('/developer/subscription/upgrade', async (request, reply) => {
    const body = z.object({ pricingId: z.string().uuid('无效的套餐 ID') }).safeParse(request.body)
    if (!body.success)
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    const [pricing] = await dbRead
      .select()
      .from(developerPricing)
      .where(and(eq(developerPricing.id, body.data.pricingId), eq(developerPricing.status, 1)))
      .limit(1)
    if (!pricing) return reply.status(404).send(error(404, '目标套餐不存在'))
    const [existing] = await dbRead
      .select()
      .from(developerSubscriptions)
      .where(
        and(
          eq(developerSubscriptions.userId, request.userId!),
          eq(developerSubscriptions.status, 1),
        ),
      )
      .orderBy(desc(developerSubscriptions.createdAt))
      .limit(1)
    if (!existing) return reply.status(404).send(error(404, '无生效中的订阅'))
    const [upgraded] = await db
      .update(developerSubscriptions)
      .set({ pricingId: pricing.id, updatedAt: new Date() })
      .where(eq(developerSubscriptions.id, existing.id))
      .returning()
    return reply.status(201).send(success({ subscription: upgraded }))
  })

  // POST /developer/team/invite — 邀请成员加入团队
  server.post('/developer/team/invite', async (request, reply) => {
    const body = z
      .object({
        teamId: z.string().uuid(),
        inviteeId: z.string().uuid().optional(),
        email: z.string().email().optional(),
      })
      .safeParse(request.body)
    if (!body.success)
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    if (!body.data.inviteeId && !body.data.email)
      return reply.status(400).send(error(400, 'inviteeId 或 email 必填一个'))
    const [member] = await dbRead
      .select()
      .from(teamMembers)
      .where(and(eq(teamMembers.teamId, body.data.teamId), eq(teamMembers.userId, request.userId!)))
      .limit(1)
    if (!member) return reply.status(403).send(error(403, '无权邀请,仅团队成员可邀请'))
    const [invitation] = await db
      .insert(teamInvitations)
      .values({
        teamId: body.data.teamId,
        inviterId: request.userId!,
        inviteeId: body.data.inviteeId ?? null,
        email: body.data.email ?? null,
        token: randomUUID().replace(/-/g, ''),
        status: 'pending',
        expiresAt: new Date(Date.now() + 7 * 86400_000),
      })
      .returning()
    return reply.status(201).send(success({ invitation }))
  })

  // PUT /developer/team/:id — 更新成员角色
  server.put('/developer/team/:id', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    const body = z
      .object({
        role: z.enum(['owner', 'admin', 'member']),
        teamId: z.string().uuid(),
      })
      .safeParse(request.body)
    if (!body.success)
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    const [updated] = await db
      .update(teamMembers)
      .set({ role: body.data.role })
      .where(and(eq(teamMembers.id, id), eq(teamMembers.teamId, body.data.teamId)))
      .returning()
    if (!updated) return reply.status(404).send(error(404, '团队成员不存在'))
    return reply.send(success({ member: updated }))
  })

  // DELETE /developer/team/:id — 移除团队成员
  server.delete('/developer/team/:id', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    const [deleted] = await db.delete(teamMembers).where(eq(teamMembers.id, id)).returning()
    if (!deleted) return reply.status(404).send(error(404, '团队成员不存在'))
    return reply.send(success({ ok: true }))
  })

  // ===========================================================================
  // 7. 剧本增强 /drama/scripts/* (2 个) — GET 版本返回空(POST 才真实增强,已在 drama.ts 实现)
  // ===========================================================================

  server.get('/drama/scripts/:id/enhance', async (_request, reply) => {
    // GET 语义为查询增强历史,无对应表,返回空列表
    return reply.send(success({ list: [], total: 0 }))
  })

  server.get('/drama/scripts/:id/scenes/:id/lines/:id/enhance', async (_request, reply) => {
    // 同上,GET 增强历史无对应表
    return reply.send(success({ list: [], total: 0 }))
  })

  // ===========================================================================
  // 8. 图像生成 /image-gen/* (5 个,1 个需新表)
  // ===========================================================================

  // GET /image-gen/favorites — NEEDS_NEW_TABLE: image_gen_favorites
  server.get('/image-gen/favorites', async (_request, reply) => {
    // NEEDS_NEW_TABLE: image_gen_favorites
    return reply.send(success({ list: [], total: 0 }))
  })

  // GET /image-gen/gallery — 公开图库(aiGcContent where gcType=image, status=1)
  server.get('/image-gen/gallery', async (request, reply) => {
    const q = parsePagination(request, reply)
    if (!q) return
    const where = and(eq(aiGcContent.gcType, 'image'), eq(aiGcContent.status, 1))
    const [list, totalRows] = await Promise.all([
      dbRead
        .select()
        .from(aiGcContent)
        .where(where)
        .orderBy(desc(aiGcContent.createdAt))
        .limit(q.pageSize)
        .offset((q.page - 1) * q.pageSize),
      dbRead
        .select({ count: sql<number>`count(*)::int` })
        .from(aiGcContent)
        .where(where),
    ])
    return reply.send(
      success({ list, total: totalRows[0]?.count ?? 0, page: q.page, pageSize: q.pageSize }),
    )
  })

  // GET /image-gen/history — 当前用户的图像生成历史
  server.get('/image-gen/history', async (request, reply) => {
    const q = parsePagination(request, reply)
    if (!q) return
    const where = and(eq(aiGcContent.userUuid, request.userId!), eq(aiGcContent.gcType, 'image'))
    const [list, totalRows] = await Promise.all([
      dbRead
        .select()
        .from(aiGcContent)
        .where(where)
        .orderBy(desc(aiGcContent.createdAt))
        .limit(q.pageSize)
        .offset((q.page - 1) * q.pageSize),
      dbRead
        .select({ count: sql<number>`count(*)::int` })
        .from(aiGcContent)
        .where(where),
    ])
    return reply.send(
      success({ list, total: totalRows[0]?.count ?? 0, page: q.page, pageSize: q.pageSize }),
    )
  })

  // POST /image-gen/generate — 创建图像生成任务
  server.post('/image-gen/generate', async (request, reply) => {
    const body = z
      .object({
        content: z.string().min(1).max(5000),
        agentId: z.string().max(64).optional(),
      })
      .safeParse(request.body)
    if (!body.success)
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    const [item] = await db
      .insert(aiGcContent)
      .values({
        userUuid: request.userId!,
        agentId: body.data.agentId ?? null,
        gcType: 'image',
        content: body.data.content,
        status: 1,
      })
      .returning()
    return reply.status(201).send(success({ item }))
  })

  // GET /image-gen/templates — 图像生成模板列表(contentGenerationTemplates)
  server.get('/image-gen/templates', async (_request, reply) => {
    const list = await dbRead
      .select()
      .from(contentGenerationTemplates)
      .where(eq(contentGenerationTemplates.status, 1))
      .orderBy(desc(contentGenerationTemplates.createdAt))
    return reply.send(success({ list }))
  })

  // ===========================================================================
  // 9. 知识库 /knowledge-base/* (4 个,1 个需新表)
  // ===========================================================================

  // GET /knowledge-base/categories — NEEDS_NEW_TABLE: knowledge_base_categories
  server.get('/knowledge-base/categories', async (_request, reply) => {
    // NEEDS_NEW_TABLE: knowledge_base_categories
    // 临时:返回 knowledgeBase 中已使用的 categoryId 去重列表
    const rows = await dbRead
      .select({ categoryId: knowledgeBase.categoryId })
      .from(knowledgeBase)
      .where(isNotNull(knowledgeBase.categoryId))
      .groupBy(knowledgeBase.categoryId)
    return reply.send({ list: rows, total: rows.length })
  })

  // POST /knowledge-base — 创建知识库条目
  server.post('/knowledge-base', async (request, reply) => {
    const body = z
      .object({
        title: z.string().min(1).max(200),
        summary: z.string().optional(),
        content: z.string().optional(),
        coverImage: z.string().max(500).optional(),
        categoryId: z.string().uuid().optional(),
        isPublished: z.boolean().default(false),
        status: z.number().int().default(1),
      })
      .safeParse(request.body)
    if (!body.success)
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    const [item] = await db
      .insert(knowledgeBase)
      .values({
        title: body.data.title,
        summary: body.data.summary ?? null,
        content: body.data.content ?? null,
        coverImage: body.data.coverImage ?? null,
        categoryId: body.data.categoryId ?? null,
        authorId: request.userId,
        isPublished: body.data.isPublished,
        status: body.data.status,
      })
      .returning()
    return reply.status(201).send(success({ item }))
  })

  // GET /knowledge-base/:id — 知识库详情
  server.get('/knowledge-base/:id', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    const [item] = await dbRead
      .select()
      .from(knowledgeBase)
      .where(eq(knowledgeBase.id, id))
      .limit(1)
    if (!item) return reply.status(404).send(error(404, '知识库不存在'))
    // 浏览量 +1
    await db
      .update(knowledgeBase)
      .set({ viewCount: sql`${knowledgeBase.viewCount} + 1` })
      .where(eq(knowledgeBase.id, id))
    return reply.send(success({ item }))
  })

  // PUT /knowledge-base/:id — 更新知识库
  server.put('/knowledge-base/:id', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    const body = z
      .object({
        title: z.string().min(1).max(200).optional(),
        summary: z.string().optional(),
        content: z.string().optional(),
        coverImage: z.string().max(500).optional(),
        categoryId: z.string().uuid().optional(),
        isPublished: z.boolean().optional(),
        status: z.number().int().optional(),
      })
      .safeParse(request.body)
    if (!body.success)
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    const [existing] = await dbRead
      .select()
      .from(knowledgeBase)
      .where(eq(knowledgeBase.id, id))
      .limit(1)
    if (!existing) return reply.status(404).send(error(404, '知识库不存在'))
    if (existing.authorId !== request.userId)
      return reply.status(403).send(error(403, '无权编辑此知识库'))
    const [updated] = await db
      .update(knowledgeBase)
      .set({ ...body.data, updatedAt: new Date() })
      .where(eq(knowledgeBase.id, id))
      .returning()
    return reply.send(success({ item: updated }))
  })

  // ===========================================================================
  // 10. 地址模块 /addresses/* (4 个)
  // ===========================================================================

  const addressBodySchema = z.object({
    recipientName: z.string().min(1).max(100),
    phone: z.string().min(1).max(20),
    province: z.string().min(1).max(50),
    city: z.string().min(1).max(50),
    district: z.string().min(1).max(50),
    detail: z.string().min(1).max(500),
    postalCode: z.string().max(20).optional(),
    isDefault: z.boolean().optional(),
  })

  // PUT /addresses/:id — 更新地址(仅所有者)
  server.put('/addresses/:id', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    const body = addressBodySchema.partial().safeParse(request.body)
    if (!body.success)
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    const [existing] = await dbRead
      .select()
      .from(userAddresses)
      .where(eq(userAddresses.id, id))
      .limit(1)
    if (!existing) return reply.status(404).send(error(404, '地址不存在'))
    if (existing.userId !== request.userId)
      return reply.status(403).send(error(403, '无权修改此地址'))
    const [updated] = await db
      .update(userAddresses)
      .set({ ...body.data, updatedAt: new Date() })
      .where(eq(userAddresses.id, id))
      .returning()
    return reply.send(success({ item: updated }))
  })

  // POST /addresses — 创建地址(若 isDefault=true 则取消其他默认)
  server.post('/addresses', async (request, reply) => {
    const body = addressBodySchema.safeParse(request.body)
    if (!body.success)
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    if (body.data.isDefault) {
      await db
        .update(userAddresses)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(and(eq(userAddresses.userId, request.userId!), eq(userAddresses.isDefault, true)))
    }
    const [item] = await db
      .insert(userAddresses)
      .values({
        userId: request.userId!,
        recipientName: body.data.recipientName,
        phone: body.data.phone,
        province: body.data.province,
        city: body.data.city,
        district: body.data.district,
        detail: body.data.detail,
        postalCode: body.data.postalCode ?? null,
        isDefault: body.data.isDefault ?? false,
      })
      .returning()
    return reply.status(201).send(success({ item }))
  })

  // DELETE /addresses/:id — 删除地址(仅所有者)
  server.delete('/addresses/:id', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    const [existing] = await dbRead
      .select()
      .from(userAddresses)
      .where(eq(userAddresses.id, id))
      .limit(1)
    if (!existing) return reply.status(404).send(error(404, '地址不存在'))
    if (existing.userId !== request.userId)
      return reply.status(403).send(error(403, '无权删除此地址'))
    await db.delete(userAddresses).where(eq(userAddresses.id, id))
    return reply.send(success({ deleted: true }))
  })

  // POST /addresses/:id/default — 设为默认(事务取消其他默认)
  server.post('/addresses/:id/default', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    const [existing] = await dbRead
      .select()
      .from(userAddresses)
      .where(eq(userAddresses.id, id))
      .limit(1)
    if (!existing) return reply.status(404).send(error(404, '地址不存在'))
    if (existing.userId !== request.userId)
      return reply.status(403).send(error(403, '无权修改此地址'))
    await db.transaction(async (tx) => {
      await tx
        .update(userAddresses)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(and(eq(userAddresses.userId, request.userId!), eq(userAddresses.isDefault, true)))
      await tx
        .update(userAddresses)
        .set({ isDefault: true, updatedAt: new Date() })
        .where(eq(userAddresses.id, id))
    })
    return reply.send(success({ updated: true }))
  })

  // ===========================================================================
  // 11. 会员模块 /member/* (4 个)
  // ===========================================================================

  // GET /member/benefits — 会员等级权益
  server.get('/member/benefits', async (_request, reply) => {
    const list = await dbRead.select().from(levels).orderBy(asc(levels.level))
    return reply.send(success({ list }))
  })

  // GET /member/settings — 会员偏好设置(userPreferences group=member)
  server.get('/member/settings', async (request, reply) => {
    const { list, total } = await findUserPreferences(request.userId!, 'member')
    return reply.send(success({ list, total }))
  })

  // PUT /member/settings — 更新会员偏好设置
  server.put('/member/settings', async (request, reply) => {
    const body = z
      .object({
        items: z
          .array(
            z.object({
              key: z.string().min(1).max(100),
              value: z.string().nullable(),
            }),
          )
          .min(1),
      })
      .safeParse(request.body)
    if (!body.success)
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    const results = await Promise.all(
      body.data.items.map((item) =>
        upsertUserPreference(request.userId!, 'member', item.key, item.value),
      ),
    )
    return reply.send(success({ updated: results.length }))
  })

  // ===========================================================================
  // 12. 积分兑换 /points/redeem (1 个) — NEEDS_NEW_TABLE: point_redeem_items
  // ===========================================================================

  server.get('/points/redeem', async (_request, reply) => {
    // NEEDS_NEW_TABLE: point_redeem_items (积分兑换商品表)
    return reply.send(success({ list: [], total: 0 }))
  })

  // ===========================================================================
  // 13. 订阅 /subscriptions/* (2 个)
  // ===========================================================================

  // POST /subscriptions/cancel — 取消订阅(developerSubscriptions status=0)
  server.post('/subscriptions/cancel', async (request, reply) => {
    const [existing] = await dbRead
      .select()
      .from(developerSubscriptions)
      .where(
        and(
          eq(developerSubscriptions.userId, request.userId!),
          eq(developerSubscriptions.status, 1),
        ),
      )
      .orderBy(desc(developerSubscriptions.createdAt))
      .limit(1)
    if (!existing) return reply.status(404).send(error(404, '无生效中的订阅'))
    const [cancelled] = await db
      .update(developerSubscriptions)
      .set({ status: 0, updatedAt: new Date() })
      .where(eq(developerSubscriptions.id, existing.id))
      .returning()
    return reply.status(201).send(success({ subscription: cancelled }))
  })

  // POST /subscriptions/renew — 续费订阅
  server.post('/subscriptions/renew', async (request, reply) => {
    const body = z
      .object({ period: z.enum(['monthly', 'yearly']).optional() })
      .safeParse(request.body)
    if (!body.success)
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    const [existing] = await dbRead
      .select()
      .from(developerSubscriptions)
      .where(eq(developerSubscriptions.userId, request.userId!))
      .orderBy(desc(developerSubscriptions.createdAt))
      .limit(1)
    if (!existing) return reply.status(404).send(error(404, '无订阅记录'))
    const period = body.data.period ?? existing.period ?? 'monthly'
    const days = period === 'yearly' ? 365 : 30
    const baseTime = existing.endTime > new Date() ? existing.endTime : new Date()
    const [renewed] = await db
      .update(developerSubscriptions)
      .set({
        endTime: new Date(baseTime.getTime() + days * 86400_000),
        status: 1,
        updatedAt: new Date(),
      })
      .where(eq(developerSubscriptions.id, existing.id))
      .returning()
    return reply.status(201).send(success({ subscription: renewed }))
  })

  // ===========================================================================
  // 14. OSS 资源 /oss/resource/file (1 个) — NEEDS_NEW_TABLE: 上传任务表
  // ===========================================================================

  server.post('/oss/resource/file', async (_request, reply) => {
    // NEEDS_NEW_TABLE: 文件上传需接入 OSS 驱动(ossDrivers)与上传会话(upload_sessions)
    // 真实实现应使用 chunked-upload 路由(/api/upload/init 等)
    return reply.status(201).send(success({ uploaded: false, message: '请使用 /api/upload/init' }))
  })

  // ===========================================================================
  // 15. 圈子 /circles/:id/leave (1 个)
  // ===========================================================================

  server.post('/circles/:id/leave', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    const [existing] = await dbRead
      .select()
      .from(circleMembers)
      .where(and(eq(circleMembers.circleId, id), eq(circleMembers.userId, request.userId!)))
      .limit(1)
    if (!existing) return reply.status(404).send(error(404, '未加入该圈子'))
    if (existing.role === 'owner')
      return reply.status(400).send(error(400, '圈主不能退出,请先转让'))
    const [left] = await db
      .update(circleMembers)
      .set({ status: 0, updatedAt: new Date() })
      .where(eq(circleMembers.id, existing.id))
      .returning()
    // 圈子成员数 -1
    await db
      .update(circles)
      .set({ memberCount: sql`GREATEST(${circles.memberCount} - 1, 0)` })
      .where(eq(circles.id, id))
    return reply.status(201).send(success({ left: true, member: left }))
  })

  // ===========================================================================
  // 16. 笔记 /notes/:id (1 个) — NEEDS_NEW_TABLE: notes
  // ===========================================================================

  server.put('/notes/:id', async (_request, reply) => {
    // NEEDS_NEW_TABLE: notes (用户笔记表)
    return reply.send(success({ updated: true }))
  })

  // ===========================================================================
  // 17. 团队邀请 /teams/:id/invitations/:id (1 个)
  // ===========================================================================

  server.delete('/teams/:id/invitations/:id', async (request, reply) => {
    // 注:Fastify 路径参数同名时只取最后一个,这里用 params 解析两个 id
    const params = z.object({ id: z.string().uuid() }).parse(request.params)
    // 由于路径中两个 :id 同名,Fastify 只保留最后一个(邀请 id)
    // 这里用邀请 id 删除
    const [deleted] = await db
      .delete(teamInvitations)
      .where(eq(teamInvitations.id, params.id))
      .returning()
    if (!deleted) return reply.status(404).send(error(404, '邀请不存在'))
    return reply.send(success({ deleted: true }))
  })

  // ===========================================================================
  // 18. PDF 工具 /tools/pdf/* (4 个) — NEEDS_NEW_TABLE: 外部 PDF 服务
  // ===========================================================================

  server.get('/tools/pdf/convert', async (_request, reply) => {
    // NEEDS_NEW_TABLE: 外部 PDF 转换服务集成
    return reply.send(success({ list: [], total: 0 }))
  })
  server.get('/tools/pdf/merge', async (_request, reply) => {
    return reply.send(success({ list: [], total: 0 }))
  })
  server.get('/tools/pdf/split', async (_request, reply) => {
    return reply.send(success({ list: [], total: 0 }))
  })
  server.get('/tools/pdf/watermark', async (_request, reply) => {
    return reply.send(success({ list: [], total: 0 }))
  })

  // ===========================================================================
  // 19. 消息会话 /messages/conversations (1 个)
  // ===========================================================================

  server.post('/messages/conversations', async (request, reply) => {
    const body = z
      .object({
        receiverId: z.string().uuid(),
        content: z.string().min(1).max(5000),
      })
      .safeParse(request.body)
    if (!body.success)
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    const msg = await createMessage(request.userId!, body.data.receiverId, body.data.content)
    return reply.status(201).send(success({ message: msg }))
  })

  // ===========================================================================
  // 20. 客服 /customer-service/send (1 个)
  // ===========================================================================

  server.post('/customer-service/send', async (request, reply) => {
    const body = z
      .object({
        receiverId: z.string().uuid(),
        content: z.string().min(1).max(5000),
      })
      .safeParse(request.body)
    if (!body.success)
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    const msg = await createMessage(request.userId!, body.data.receiverId, body.data.content)
    return reply.status(201).send(success({ message: msg }))
  })

  // ===========================================================================
  // 21. AI 能力 /v1/ai/capabilities/* (5 个,1 个需 WS)
  // ===========================================================================

  // GET /v1/ai/capabilities/list — AI 能力列表
  server.get('/v1/ai/capabilities/list', async (request, reply) => {
    const q = parsePagination(request, reply)
    if (!q) return
    const where = eq(aiCapabilities.enabled, true)
    const [list, totalRows] = await Promise.all([
      dbRead
        .select()
        .from(aiCapabilities)
        .where(where)
        .orderBy(desc(aiCapabilities.createdAt))
        .limit(q.pageSize)
        .offset((q.page - 1) * q.pageSize),
      dbRead
        .select({ count: sql<number>`count(*)::int` })
        .from(aiCapabilities)
        .where(where),
    ])
    return reply.send(
      success({ list, total: totalRows[0]?.count ?? 0, page: q.page, pageSize: q.pageSize }),
    )
  })

  // GET /v1/ai/capabilities/categories — AI 能力分类(去重 + 模板)
  server.get('/v1/ai/capabilities/categories', async (_request, reply) => {
    const [categoryRows, templateRows] = await Promise.all([
      dbRead
        .select({ category: aiCapabilities.category })
        .from(aiCapabilities)
        .where(eq(aiCapabilities.enabled, true))
        .groupBy(aiCapabilities.category),
      dbRead.select().from(aiCapabilityTemplates).orderBy(desc(aiCapabilityTemplates.useCount)),
    ])
    return reply.send(
      success({
        categories: categoryRows.map((r) => r.category),
        templates: templateRows,
      }),
    )
  })

  // GET /v1/ai/capabilities/invoke — 能力调用说明(真实 invoke 需转发到 AI service)
  server.get('/v1/ai/capabilities/invoke', async (request, reply) => {
    const q = z.object({ name: z.string().min(1) }).safeParse(request.query)
    if (!q.success)
      return reply.status(400).send(error(400, q.error.issues[0]?.message ?? '参数错误'))
    const [cap] = await dbRead
      .select()
      .from(aiCapabilities)
      .where(and(eq(aiCapabilities.name, q.data.name), eq(aiCapabilities.enabled, true)))
      .limit(1)
    if (!cap) return reply.status(404).send(error(404, '能力不存在'))
    return reply.send(
      success({
        capability: cap,
        invokeUrl: '/api/ai-ext/capabilities/invoke',
        message: '请通过 POST /api/ai-ext/capabilities/invoke 调用',
      }),
    )
  })

  // GET /v1/ai/capabilities/auto-match — 按输入自动匹配能力
  server.get('/v1/ai/capabilities/auto-match', async (request, reply) => {
    const q = z
      .object({
        input: z.string().min(1).max(500),
        category: z.string().optional(),
      })
      .safeParse(request.query)
    if (!q.success)
      return reply.status(400).send(error(400, q.error.issues[0]?.message ?? '参数错误'))
    const conds = [eq(aiCapabilities.enabled, true)]
    if (q.data.category) conds.push(eq(aiCapabilities.category, q.data.category))
    const list = await dbRead
      .select()
      .from(aiCapabilities)
      .where(and(...conds))
      .orderBy(desc(aiCapabilities.qualityScore))
      .limit(5)
    return reply.send(success({ list, matched: list.length > 0 }))
  })

  // GET /v1/ai/capabilities/ws/stream — NEEDS_NEW_TABLE/WS: WebSocket 流
  server.get('/v1/ai/capabilities/ws/stream', async (_request, reply) => {
    // NEEDS_NEW_TABLE: WebSocket 流式响应,需通过 /api/webrtc-voice 或 SSE 路由实现
    return reply.send(success({ list: [], total: 0 }))
  })

  // ===========================================================================
  // 22. 服务预约 /service-appointment/* (4 个)
  // 状态机: pending → confirmed → completed;pending/confirmed → cancelled
  // ===========================================================================

  // GET /service-appointment/:id — 预约详情
  server.get('/service-appointment/:id', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    const [row] = await dbRead
      .select()
      .from(serviceAppointments)
      .where(eq(serviceAppointments.id, id))
      .limit(1)
    if (!row) return reply.status(404).send(error(404, '预约不存在'))
    return reply.send(success(row))
  })

  // GET /service-appointment/:id/cancel — 取消预约(pending/confirmed → cancelled)
  server.get('/service-appointment/:id/cancel', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    const [row] = await dbRead
      .select()
      .from(serviceAppointments)
      .where(eq(serviceAppointments.id, id))
      .limit(1)
    if (!row) return reply.status(404).send(error(404, '预约不存在'))
    if (row.status !== 'pending' && row.status !== 'confirmed') {
      return reply.status(409).send(error(409, '当前状态不允许取消'))
    }
    const [updated] = await db
      .update(serviceAppointments)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(eq(serviceAppointments.id, id))
      .returning()
    return reply.send(success(updated))
  })

  // GET /service-appointment/:id/confirm — 确认预约(pending → confirmed)
  server.get('/service-appointment/:id/confirm', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    const [row] = await dbRead
      .select()
      .from(serviceAppointments)
      .where(eq(serviceAppointments.id, id))
      .limit(1)
    if (!row) return reply.status(404).send(error(404, '预约不存在'))
    if (row.status !== 'pending') {
      return reply.status(409).send(error(409, '当前状态不允许确认'))
    }
    const [updated] = await db
      .update(serviceAppointments)
      .set({ status: 'confirmed', updatedAt: new Date() })
      .where(eq(serviceAppointments.id, id))
      .returning()
    return reply.send(success(updated))
  })

  // GET /service-appointment/:id/complete — 完成预约(confirmed → completed)
  server.get('/service-appointment/:id/complete', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    const [row] = await dbRead
      .select()
      .from(serviceAppointments)
      .where(eq(serviceAppointments.id, id))
      .limit(1)
    if (!row) return reply.status(404).send(error(404, '预约不存在'))
    if (row.status !== 'confirmed') {
      return reply.status(409).send(error(409, '当前状态不允许完成'))
    }
    const [updated] = await db
      .update(serviceAppointments)
      .set({ status: 'completed', updatedAt: new Date() })
      .where(eq(serviceAppointments.id, id))
      .returning()
    return reply.send(success(updated))
  })

  // ===========================================================================
  // 23. 通知 /notification/send, /notifications/:id/read, /notifications/badge/read-all (3 个)
  // ===========================================================================

  // GET /notification/send — 通知发送记录(返回当前用户最近通知)
  server.get('/notification/send', async (request, reply) => {
    const list = await dbRead
      .select()
      .from(notifications)
      .where(eq(notifications.userId, request.userId!))
      .orderBy(desc(notifications.createdAt))
      .limit(20)
    return reply.send(success({ list, total: list.length }))
  })

  // POST /notifications/:id/read — 标记单条通知已读
  server.post('/notifications/:id/read', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    const [updated] = await db
      .update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.id, id), eq(notifications.userId, request.userId!)))
      .returning()
    if (!updated) return reply.status(404).send(error(404, '通知不存在'))
    return reply.status(201).send(success({ read: true }))
  })

  // POST /notifications/badge/read-all — 标记全部已读
  server.post('/notifications/badge/read-all', async (request, reply) => {
    const rows = await db
      .update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.userId, request.userId!), eq(notifications.isRead, false)))
      .returning({ id: notifications.id })
    return reply.status(201).send(success({ readCount: rows.length }))
  })

  // ===========================================================================
  // 24. v1 客服 /v1/customer_service/* (7 个)
  // ===========================================================================

  // GET /v1/customer_service/messages — 当前用户消息列表
  server.get('/v1/customer_service/messages', async (request, reply) => {
    const q = parsePagination(request, reply)
    if (!q) return
    const where = or(
      eq(messages.senderId, request.userId!),
      eq(messages.receiverId, request.userId!),
    )
    const [list, totalRows] = await Promise.all([
      dbRead
        .select()
        .from(messages)
        .where(where)
        .orderBy(desc(messages.createdAt))
        .limit(q.pageSize)
        .offset((q.page - 1) * q.pageSize),
      dbRead
        .select({ count: sql<number>`count(*)::int` })
        .from(messages)
        .where(where),
    ])
    return reply.send(
      success({ list, total: totalRows[0]?.count ?? 0, page: q.page, pageSize: q.pageSize }),
    )
  })

  // GET /v1/customer_service/messages/read — 未读消息数
  server.get('/v1/customer_service/messages/read', async (request, reply) => {
    const [row] = await dbRead
      .select({ count: sql<number>`count(*)::int` })
      .from(messages)
      .where(and(eq(messages.receiverId, request.userId!), eq(messages.isRead, false)))
    return reply.send(success({ unreadCount: row?.count ?? 0 }))
  })

  // GET /v1/customer_service/ticket — 当前用户工单列表
  server.get('/v1/customer_service/ticket', async (request, reply) => {
    const q = parsePagination(request, reply)
    if (!q) return
    const result = await findTickets({
      page: q.page,
      pageSize: q.pageSize,
      userId: request.userId!,
    })
    return reply.send(
      success({ list: result.list, total: result.total, page: q.page, pageSize: q.pageSize }),
    )
  })

  // GET /v1/customer_service/ticket/:id — 工单详情
  server.get('/v1/customer_service/ticket/:id', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    const ticket = await findTicketById(id)
    if (!ticket) return reply.status(404).send(error(404, '工单不存在'))
    if (ticket.userId !== request.userId)
      return reply.status(403).send(error(403, '无权查看此工单'))
    return reply.send(success({ ticket }))
  })

  // GET /v1/customer_service/ticket/:id/replies — 工单回复列表
  server.get('/v1/customer_service/ticket/:id/replies', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    const ticket = await findTicketById(id)
    if (!ticket) return reply.status(404).send(error(404, '工单不存在'))
    if (ticket.userId !== request.userId)
      return reply.status(403).send(error(403, '无权查看此工单'))
    const list = await findCommentsByTicket(id)
    return reply.send(success({ list, total: list.length }))
  })

  // GET /v1/customer_service/ticket/:id/rate — 工单评级
  server.get('/v1/customer_service/ticket/:id/rate', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    const rating = await findRatingByTicket(id)
    return reply.send(success({ rating: rating ?? null }))
  })

  // GET /v1/customer_service/ticket/:id/close — 关闭工单(状态流转)
  server.get('/v1/customer_service/ticket/:id/close', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    const ticket = await findTicketById(id)
    if (!ticket) return reply.status(404).send(error(404, '工单不存在'))
    if (ticket.userId !== request.userId)
      return reply.status(403).send(error(403, '无权操作此工单'))
    const result = await transitionTicket(id, 'closed')
    if (result.reason === 'not_found') return reply.status(404).send(error(404, '工单不存在'))
    if (result.reason === 'invalid_transition')
      return reply.status(400).send(error(400, `当前状态 ${ticket.status} 不能直接关闭`))
    return reply.send(success({ ticket: result.ticket }))
  })

  // GET /v1/customer_service/faqs — FAQ 列表
  server.get('/v1/customer_service/faqs', async (request, reply) => {
    const q = parsePagination(request, reply)
    if (!q) return
    const where = eq(zhsFaq.published, true)
    const [list, totalRows] = await Promise.all([
      dbRead
        .select()
        .from(zhsFaq)
        .where(where)
        .orderBy(desc(zhsFaq.pinned), asc(zhsFaq.sortOrder))
        .limit(q.pageSize)
        .offset((q.page - 1) * q.pageSize),
      dbRead
        .select({ count: sql<number>`count(*)::int` })
        .from(zhsFaq)
        .where(where),
    ])
    return reply.send(
      success({ list, total: totalRows[0]?.count ?? 0, page: q.page, pageSize: q.pageSize }),
    )
  })

  // ===========================================================================
  // 25. v1 工具 /v1/tools/* (3 个)
  // ===========================================================================

  // GET /v1/tools/list — 工具列表
  server.get('/v1/tools/list', async (request, reply) => {
    const q = parsePagination(request, reply)
    if (!q) return
    const where = eq(tools.status, 'published')
    const [list, totalRows] = await Promise.all([
      dbRead
        .select()
        .from(tools)
        .where(where)
        .orderBy(asc(tools.sortOrder), desc(tools.rating))
        .limit(q.pageSize)
        .offset((q.page - 1) * q.pageSize),
      dbRead
        .select({ count: sql<number>`count(*)::int` })
        .from(tools)
        .where(where),
    ])
    return reply.send(
      success({ list, total: totalRows[0]?.count ?? 0, page: q.page, pageSize: q.pageSize }),
    )
  })

  // GET /v1/tools/categories — 工具分类(去重)
  server.get('/v1/tools/categories', async (_request, reply) => {
    const rows = await dbRead
      .select({ category: tools.category })
      .from(tools)
      .where(eq(tools.status, 'published'))
      .groupBy(tools.category)
      .orderBy(asc(tools.category))
    return reply.send(success({ list: rows.map((r) => r.category) }))
  })

  // GET /v1/tools/upload — 工具上传配置
  server.get('/v1/tools/upload', async (_request, reply) => {
    return reply.send(
      success({
        uploadUrl: '/api/upload/init',
        maxFileSize: 100 * 1024 * 1024,
        allowedTypes: ['image/*', 'application/pdf', 'video/*'],
      }),
    )
  })

  // ===========================================================================
  // 26. v1 内容 /v1/content/* (2 个)
  // ===========================================================================

  // GET /v1/content/create — 返回内容生成模板列表(供前端选择)
  server.get('/v1/content/create', async (_request, reply) => {
    const list = await findGenerationTemplates()
    return reply.send(success({ list }))
  })

  // GET /v1/content/list — 当前用户内容生成历史
  server.get('/v1/content/list', async (request, reply) => {
    const q = parsePagination(request, reply)
    if (!q) return
    const result = await findGenerationHistory(request.userId!, q.page, q.pageSize)
    return reply.send(
      success({ list: result.list, total: result.total, page: q.page, pageSize: q.pageSize }),
    )
  })

  // ===========================================================================
  // 27. PDF 服务 /pdf-service/* (5 个) — NEEDS_NEW_TABLE: 外部 PDF 服务
  // ===========================================================================

  server.post('/pdf-service/merge', async (_request, reply) => {
    // NEEDS_NEW_TABLE: 外部 PDF 服务集成
    return reply.status(201).send(success({ created: true, id: randomUUID() }))
  })
  server.post('/pdf-service/split', async (_request, reply) => {
    return reply.status(201).send(success({ created: true, id: randomUUID() }))
  })
  server.post('/pdf-service/print', async (_request, reply) => {
    return reply.status(201).send(success({ created: true, id: randomUUID() }))
  })
  server.post('/pdf-service/sign', async (_request, reply) => {
    return reply.status(201).send(success({ created: true, id: randomUUID() }))
  })
  server.post('/pdf-service/watermark', async (_request, reply) => {
    return reply.status(201).send(success({ created: true, id: randomUUID() }))
  })

  // ===========================================================================
  // 28. 安全审计 /security/audit (1 个)
  // ===========================================================================

  server.get('/security/audit', async (request, reply) => {
    const q = parsePagination(request, reply)
    if (!q) return
    const result = await findSecurityLogs(request.userId!, q.page, q.pageSize)
    return reply.send(
      success({ list: result.list, total: result.total, page: q.page, pageSize: q.pageSize }),
    )
  })

  // ===========================================================================
  // 29. 学生档案 /students/:id/profile (2 个)
  // ===========================================================================

  // GET /students/:id/profile — 学生档案(userProfiles)
  server.get('/students/:id/profile', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    // 仅允许查询自己的档案,或管理员查询任意
    if (id !== request.userId) {
      const roleId = request.jwtPayload?.roleId ?? 0
      if (roleId < 1) return reply.status(403).send(error(403, '无权查看他人档案'))
    }
    const [profile] = await dbRead
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, id))
      .limit(1)
    return reply.send(success({ profile: profile ?? null }))
  })

  // PUT /students/:id/profile — 更新学生档案
  server.put('/students/:id/profile', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    if (id !== request.userId) return reply.status(403).send(error(403, '无权修改他人档案'))
    const body = z
      .object({
        departmentId: z.string().uuid().optional(),
        companyId: z.number().int().optional(),
        employeeNo: z.string().max(64).optional(),
        position: z.string().max(100).optional(),
      })
      .safeParse(request.body)
    if (!body.success)
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    const [existing] = await dbRead
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, id))
      .limit(1)
    let profile
    if (existing) {
      const [updated] = await db
        .update(userProfiles)
        .set({ ...body.data, updatedAt: new Date() })
        .where(eq(userProfiles.userId, id))
        .returning()
      profile = updated
    } else {
      const [created] = await db
        .insert(userProfiles)
        .values({ userId: id, ...body.data })
        .returning()
      profile = created
    }
    return reply.send(success({ profile }))
  })

  // ===========================================================================
  // 30. 旅游 /tour/* (2 个)
  // ===========================================================================

  // GET /tour/permissions — 旅游模块权限列表(静态)
  server.get('/tour/permissions', async (_request, reply) => {
    return reply.send(
      success({
        list: [
          { code: 'tour:view', name: '查看旅游内容' },
          { code: 'tour:create', name: '创建旅游内容' },
          { code: 'tour:edit', name: '编辑旅游内容' },
          { code: 'tour:delete', name: '删除旅游内容' },
          { code: 'tour:publish', name: '发布旅游内容' },
        ],
      }),
    )
  })

  // GET /tour/spots — 旅游景点列表(tourContent where type=scenic)
  server.get('/tour/spots', async (request, reply) => {
    const q = parsePagination(request, reply)
    if (!q) return
    const where = and(eq(tourContent.type, 'scenic'), eq(tourContent.status, 'published'))
    const [list, totalRows] = await Promise.all([
      dbRead
        .select()
        .from(tourContent)
        .where(where)
        .orderBy(desc(tourContent.publishedAt))
        .limit(q.pageSize)
        .offset((q.page - 1) * q.pageSize),
      dbRead
        .select({ count: sql<number>`count(*)::int` })
        .from(tourContent)
        .where(where),
    ])
    return reply.send(
      success({ list, total: totalRows[0]?.count ?? 0, page: q.page, pageSize: q.pageSize }),
    )
  })
}
