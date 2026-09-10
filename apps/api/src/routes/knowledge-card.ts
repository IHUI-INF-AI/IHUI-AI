// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:

/**
 * Knowledge Card 路由 (2026-09-10 新增,2-1 项目知识引擎)
 *
 * 挂载前缀(由主控统一注册,建议 /api/knowledge-cards):
 * - GET  /            按仓库名列卡片(本人 + 全局)
 * - POST /            创建卡片(手动登录 / ai-service 内部调用经 X-Internal-Secret,source=agent)
 * - GET  /search      按关键词检索(tags/title/content ILIKE)
 * - GET  /:id         卡片详情
 * - PATCH /:id        更新卡片(仅本人)
 * - DELETE /:id       删除卡片(仅本人)
 */

import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { and, desc, eq, isNull, or, ilike, sql } from 'drizzle-orm'
import { z } from 'zod'
import { knowledgeCards } from '@ihui/database'
import { db } from '../db/index.js'
import { authenticate } from '../plugins/auth.js'
import { config } from '../config/index.js'
import { parseOrThrow, success, error } from '../utils/response.js'

// =============================================================================
// Zod schemas
// =============================================================================

/** 卡片类型:experience=任务经验;fact=项目事实;practices=最佳实践;pitfall=踩坑记录 */
const cardKindSchema = z.enum(['experience', 'fact', 'practices', 'pitfall'])

const createSchema = z.object({
  repoName: z.string().min(1, '仓库名不能为空').max(200),
  kind: cardKindSchema.default('experience'),
  title: z.string().min(1, '标题不能为空').max(300),
  content: z.string().min(1, '内容不能为空').max(20_000),
  tags: z.array(z.string().min(1).max(50)).max(20).default([]),
  context: z.record(z.string(), z.unknown()).optional(),
  confidence: z.number().int().min(0).max(100).default(100),
  // 归属用户(仅内部调用使用:ai-service 经验抽取写卡时指定;缺省 null = 全局卡)
  userId: z.string().uuid('无效的用户 ID').optional(),
})

const updateSchema = z.object({
  kind: cardKindSchema.optional(),
  title: z.string().min(1, '标题不能为空').max(300).optional(),
  content: z.string().min(1, '内容不能为空').max(20_000).optional(),
  tags: z.array(z.string().min(1).max(50)).max(20).optional(),
  context: z.record(z.string(), z.unknown()).nullable().optional(),
  confidence: z.number().int().min(0).max(100).optional(),
  markUsed: z.boolean().optional(),
})

const listQuerySchema = z.object({
  repoName: z.string().min(1, '仓库名不能为空').max(200),
  kind: cardKindSchema.optional(),
  tag: z.string().min(1).max(50).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
})

const searchQuerySchema = z.object({
  q: z.string().min(1, '检索关键词不能为空').max(200),
  repoName: z.string().min(1).max(200).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

const idParamSchema = z.object({ id: z.uuid({ error: '无效的卡片 ID' }) })

// =============================================================================
// 鉴权
// =============================================================================

/** 登录校验(authenticate 失败 → 401;成功后 request.userId 可用)。
 * 返回 false 表示已发送错误响应,调用方应直接 return。 */
async function requireLogin(request: FastifyRequest, reply: FastifyReply): Promise<boolean> {
  try {
    await authenticate(request)
    return true
  } catch (e) {
    const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
    reply.status(statusCode).send(error(statusCode, '请先登录'))
    return false
  }
}

// =============================================================================
// 路由
// =============================================================================

export const knowledgeCardRoutes: FastifyPluginAsync = async (app) => {
  // GET / — 按仓库名列卡片(本人 + 全局,按创建时间倒序;kind/tag 可选过滤)
  app.get('/', { preHandler: requireLogin }, async (request, reply) => {
    const query = parseOrThrow(listQuerySchema, request.query)
    const userId = request.userId
    if (!userId) {
      return reply.status(401).send(error(401, '请先登录'))
    }
    const conditions = [
      or(eq(knowledgeCards.userId, userId), isNull(knowledgeCards.userId)),
      eq(knowledgeCards.repoName, query.repoName),
    ]
    if (query.kind) conditions.push(eq(knowledgeCards.kind, query.kind))
    if (query.tag) {
      // tags 为 jsonb 列,ILIKE 需显式转 text
      conditions.push(sql`${knowledgeCards.tags}::text ILIKE ${`%${query.tag}%`}`)
    }

    const rows = await db
      .select({
        id: knowledgeCards.id,
        repoName: knowledgeCards.repoName,
        kind: knowledgeCards.kind,
        source: knowledgeCards.source,
        title: knowledgeCards.title,
        tags: knowledgeCards.tags,
        confidence: knowledgeCards.confidence,
        useCount: knowledgeCards.useCount,
        lastUsedAt: knowledgeCards.lastUsedAt,
        createdAt: knowledgeCards.createdAt,
      })
      .from(knowledgeCards)
      .where(and(...conditions))
      .orderBy(desc(knowledgeCards.createdAt))
      .limit(query.limit)
    return reply.send(success(rows))
  })

  // POST / — 创建卡片
  // - 用户手动录入:登录态,source 固定 manual,作者 = 当前用户
  // - 内部调用(ai-service 经验抽取写卡):X-Internal-Secret 匹配 AI_CALLBACK_SECRET
  //   时绕过 JWT(同 skills.ts 模式),source 固定 agent,userId 由 body 指定(缺省全局卡)
  app.post('/', async (request, reply) => {
    const internalSecret = request.headers['x-internal-secret']
    const isInternal = !!config.AI_CALLBACK_SECRET && internalSecret === config.AI_CALLBACK_SECRET
    if (!isInternal) {
      if (!(await requireLogin(request, reply))) return
    }
    const body = parseOrThrow(createSchema, request.body)
    const [row] = await db
      .insert(knowledgeCards)
      .values({
        userId: isInternal ? (body.userId ?? null) : (request.userId ?? null),
        repoName: body.repoName,
        kind: body.kind,
        source: isInternal ? 'agent' : 'manual',
        title: body.title,
        content: body.content,
        tags: body.tags,
        context: body.context ?? null,
        confidence: body.confidence,
      })
      .returning()
    return reply.status(201).send(success(row))
  })

  // GET /search — 关键词检索(title/content ILIKE;repoName 可选缩小范围)
  app.get('/search', { preHandler: requireLogin }, async (request, reply) => {
    const query = parseOrThrow(searchQuerySchema, request.query)
    const userId = request.userId
    if (!userId) {
      return reply.status(401).send(error(401, '请先登录'))
    }
    const conditions = [
      or(eq(knowledgeCards.userId, userId), isNull(knowledgeCards.userId)),
      or(
        ilike(knowledgeCards.title, `%${query.q}%`),
        ilike(knowledgeCards.content, `%${query.q}%`),
      ),
    ]
    if (query.repoName) conditions.push(eq(knowledgeCards.repoName, query.repoName))

    const rows = await db
      .select({
        id: knowledgeCards.id,
        repoName: knowledgeCards.repoName,
        kind: knowledgeCards.kind,
        source: knowledgeCards.source,
        title: knowledgeCards.title,
        content: knowledgeCards.content,
        tags: knowledgeCards.tags,
        confidence: knowledgeCards.confidence,
        useCount: knowledgeCards.useCount,
        createdAt: knowledgeCards.createdAt,
      })
      .from(knowledgeCards)
      .where(and(...conditions))
      .orderBy(desc(knowledgeCards.useCount), desc(knowledgeCards.createdAt))
      .limit(query.limit)
    return reply.send(success(rows))
  })

  // GET /:id — 卡片详情(本人或全局可见)
  app.get('/:id', { preHandler: requireLogin }, async (request, reply) => {
    const params = parseOrThrow(idParamSchema, request.params)
    const userId = request.userId
    if (!userId) {
      return reply.status(401).send(error(401, '请先登录'))
    }
    const [row] = await db
      .select()
      .from(knowledgeCards)
      .where(eq(knowledgeCards.id, params.id))
      .limit(1)
    if (!row || (row.userId !== null && row.userId !== userId)) {
      return reply.status(404).send(error(404, '卡片不存在'))
    }
    return reply.send(success(row))
  })

  // PATCH /:id — 更新卡片(仅本人;markUsed=true 时自增 useCount 并刷新 lastUsedAt)
  app.patch('/:id', { preHandler: requireLogin }, async (request, reply) => {
    const params = parseOrThrow(idParamSchema, request.params)
    const body = parseOrThrow(updateSchema, request.body)
    const userId = request.userId
    if (!userId) {
      return reply.status(401).send(error(401, '请先登录'))
    }
    const [existing] = await db
      .select({ id: knowledgeCards.id, userId: knowledgeCards.userId })
      .from(knowledgeCards)
      .where(eq(knowledgeCards.id, params.id))
      .limit(1)
    if (!existing || existing.userId !== userId) {
      return reply.status(404).send(error(404, '卡片不存在或无权修改'))
    }

    if (body.markUsed) {
      // 复用打点:useCount +1,lastUsedAt = now(独立于字段编辑,二者可并存)
      const [row] = await db
        .update(knowledgeCards)
        .set({ useCount: sql`${knowledgeCards.useCount} + 1`, lastUsedAt: new Date() })
        .where(eq(knowledgeCards.id, params.id))
        .returning()
      return reply.send(success(row))
    }

    const patch: Record<string, unknown> = { updatedAt: new Date() }
    if (body.kind !== undefined) patch.kind = body.kind
    if (body.title !== undefined) patch.title = body.title
    if (body.content !== undefined) patch.content = body.content
    if (body.tags !== undefined) patch.tags = body.tags
    if (body.context !== undefined) patch.context = body.context
    if (body.confidence !== undefined) patch.confidence = body.confidence

    const [row] = await db
      .update(knowledgeCards)
      .set(patch)
      .where(eq(knowledgeCards.id, params.id))
      .returning()
    return reply.send(success(row))
  })

  // DELETE /:id — 删除卡片(仅本人)
  app.delete('/:id', { preHandler: requireLogin }, async (request, reply) => {
    const params = parseOrThrow(idParamSchema, request.params)
    const userId = request.userId
    if (!userId) {
      return reply.status(401).send(error(401, '请先登录'))
    }
    const [row] = await db
      .select({ id: knowledgeCards.id, userId: knowledgeCards.userId })
      .from(knowledgeCards)
      .where(eq(knowledgeCards.id, params.id))
      .limit(1)
    if (!row || row.userId !== userId) {
      return reply.status(404).send(error(404, '卡片不存在或无权删除'))
    }
    await db.delete(knowledgeCards).where(eq(knowledgeCards.id, params.id))
    return reply.send(success({ deleted: true }))
  })
}
