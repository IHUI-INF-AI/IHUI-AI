// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * community/topics 子路由(从 community.ts 拆分)。
 * 包含 sections: 话题/动态（历史 circle_dynamic，integer id）, 圈子分类关系（历史 circle_category_relation，integer id）, 圈子类目关系（历史 circle_circle_category_relation，integer id）
 */
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { authenticate } from '../../plugins/auth.js'
import { success, error } from '../../utils/response.js'
import { and, desc, eq } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { circleCategoryRelation, circleCircleCategoryRelation, circleDynamic } from '@ihui/database'
import { sanitizeUgcInput } from '../../db/sensitive-words-queries.js'
import {
  countSubscribers,
  findTagById,
  isSubscribed,
  subscribe,
  unsubscribe,
} from '../../db/social-queries.js'

/**
 * 话题关注落库时的 subscriptions.target_type 取值。
 * 'tag' 是 social.ts 的 TARGET_TYPES(['user','project','tag','category'])在册值,不是新造档位;
 * 话题实体即 tags 行(见 GET /api/circles/topics/hot 的取源理由)。
 */
const TOPIC_TARGET_TYPE = 'tag'

const topicsRoutes: FastifyPluginAsync = async (server) => {
  // 统一鉴权：所有 circles / asks 路由均需登录
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await authenticate(request)
    } catch (e) {
      const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
      const message = (e as Error).message || '操作失败,请稍后重试'
      return reply.status(statusCode).send(error(statusCode, message))
    }
  })

  // ===== Circles =====

  // GET /circles - 圈子列表(?page&pageSize&search)
  // ===== 话题/动态（历史 circle_dynamic，integer id） =====

  // GET /circles/topic/list - 话题列表
  server.get('/circles/topic/list', async (request, reply) => {
    const { page, pageSize, circleId, memberId, status } = z
      .object({
        page: z.coerce.number().optional().default(1),
        // P1 修复(2026-08-06): 分页 pageSize 补上限
        pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
        circleId: z.coerce.number().optional(),
        memberId: z.coerce.number().optional(),
        status: z.string().optional(),
      })
      .parse(request.query)
    const conditions: Array<ReturnType<typeof eq>> = []
    if (circleId) conditions.push(eq(circleDynamic.circleId, Number(circleId)))
    if (memberId) conditions.push(eq(circleDynamic.memberId, Number(memberId)))
    if (status) conditions.push(eq(circleDynamic.status, String(status)))
    const baseQuery =
      conditions.length > 0
        ? db
            .select()
            .from(circleDynamic)
            .where(and(...conditions))
        : db.select().from(circleDynamic)
    const list = await baseQuery
      .orderBy(desc(circleDynamic.id))
      .limit(Number(pageSize))
      .offset((Number(page) - 1) * Number(pageSize))
    return reply.send(success({ list, page: Number(page), pageSize: Number(pageSize) }))
  })

  // GET /circles/topic/:tid - 话题详情
  server.get('/circles/topic/:tid', async (request, reply) => {
    const { tid } = z.object({ tid: z.string() }).parse(request.params)
    const tidNum = Number(tid)
    if (!Number.isInteger(tidNum) || tidNum <= 0) {
      return reply.status(400).send(error(400, '无效的话题 ID'))
    }
    const [item] = await db
      .select()
      .from(circleDynamic)
      .where(eq(circleDynamic.id, tidNum))
      .limit(1)
    if (!item) return reply.status(404).send(error(404, '话题不存在'))
    return reply.send(success({ topic: item }))
  })

  // POST /circles/topic - 创建话题
  server.post('/circles/topic', async (request, reply) => {
    const body = z
      .object({
        content: z.string().min(1),
        circleId: z.number().int().positive(),
        memberId: z.number().int().positive(),
        image: z.string().max(3000).optional().default(''),
        status: z.string().max(100).optional().default('published'),
      })
      .safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    }
    // P0 合规:话题内容敏感词过滤
    const filtered = await sanitizeUgcInput(
      { content: body.data.content },
      {
        action: 'ugc.topic.create',
        resourceType: 'topic',
        userId: request.userId,
        ip: request.ip,
        userAgent: request.headers['user-agent'] as string | undefined,
      },
    )
    if (!filtered.ok) {
      return reply.status(400).send(error(400, '内容含违规词,发布失败'))
    }
    const [created] = await db
      .insert(circleDynamic)
      .values({
        content: filtered.fields.content!.text,
        circleId: body.data.circleId,
        memberId: body.data.memberId,
        image: body.data.image,
        status: body.data.status,
      })
      .returning()
    if (!created) return reply.status(500).send(error(500, '创建话题失败'))
    return reply.status(201).send(success({ topic: created }))
  })

  // PUT /circles/topic/:tid - 修改话题
  server.put('/circles/topic/:tid', async (request, reply) => {
    const { tid } = z.object({ tid: z.string() }).parse(request.params)
    const tidNum = Number(tid)
    if (!Number.isInteger(tidNum) || tidNum <= 0) {
      return reply.status(400).send(error(400, '无效的话题 ID'))
    }
    const body = z
      .object({
        content: z.string().min(1).optional(),
        image: z.string().max(3000).optional(),
        status: z.string().max(100).optional(),
      })
      .safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    }
    // P0 合规:修改话题内容过滤
    if (body.data.content !== undefined) {
      const filtered = await sanitizeUgcInput(
        { content: body.data.content },
        {
          action: 'ugc.topic.update',
          resourceType: 'topic',
          userId: request.userId,
          ip: request.ip,
          userAgent: request.headers['user-agent'] as string | undefined,
        },
      )
      if (!filtered.ok) {
        return reply.status(400).send(error(400, '内容含违规词,编辑失败'))
      }
      body.data.content = filtered.fields.content!.text
    }
    const updateData: Record<string, unknown> = { updatedAt: new Date() }
    if (body.data.content !== undefined) updateData.content = body.data.content
    if (body.data.image !== undefined) updateData.image = body.data.image
    if (body.data.status !== undefined) updateData.status = body.data.status
    const [updated] = await db
      .update(circleDynamic)
      .set(updateData)
      .where(eq(circleDynamic.id, tidNum))
      .returning()
    if (!updated) return reply.status(404).send(error(404, '话题不存在'))
    return reply.send(success({ topic: updated }))
  })

  // DELETE /circles/topic/:tid - 删除话题
  server.delete('/circles/topic/:tid', async (request, reply) => {
    const { tid } = z.object({ tid: z.string() }).parse(request.params)
    const tidNum = Number(tid)
    if (!Number.isInteger(tidNum) || tidNum <= 0) {
      return reply.status(400).send(error(400, '无效的话题 ID'))
    }
    const removed = await db
      .delete(circleDynamic)
      .where(eq(circleDynamic.id, tidNum))
      .returning({ id: circleDynamic.id })
    if (removed.length === 0) return reply.status(404).send(error(404, '话题不存在'))
    return reply.send(success({ id: tidNum, deleted: removed.length > 0 }))
  })

  // POST /circles/topic/:tid/follow - 关注/取关话题(一次 POST 翻转一次,语义由两端调用点声明)
  //
  // 立因:RN TopicDetailScreen.tsx:131 与小程序 pkg-content/topic/detail.tsx:113 都在打这条
  // 路径,后端零注册 ⇒ 关注按钮恒"操作失败"。
  //
  // 落点选谁(全部现读定性,不造壳):
  //  - user_follows:两侧都是 users FK(follower_id/following_id),结构上放不进"话题" ⇒ 用它要迁移;
  //  - t_follow / t_favorite / t_like:以 member_id(bigint 旧会员号)为主体,而 JWT 主体是
  //    users.id(uuid) ⇒ 要么补一张 uuid↔memberId 映射,要么从被操作记录反推身份(§5 禁止);
  //  - subscriptions:user_id(uuid,FK users)+ target_type varchar(32) + target_id varchar(128),
  //    联合唯一,已在册为 POST/DELETE/GET /api/subscriptions(social.ts),且 'tag' 本就是
  //    TARGET_TYPES 里的合法值 ⇒ 话题=tag 行,零迁移复用这条真实机制。
  //
  // 话题身份域 = tags.id(uuid),与 GET /api/circles/topics/hot 同源。本文件既有的
  // /circles/topic/:tid 走 circle_dynamic 整数域,两条不混用:传整数 ⇒ 400(不进库、不落一条
  // 指向不存在话题的订阅),传不存在的 uuid ⇒ 404。
  //
  // followerCount 是 COUNT(*) 实算(countSubscribers),不是 +1/−1 累加 ⇒ 不与明细漂移。
  server.post('/circles/topic/:tid/follow', async (request, reply) => {
    const parsed = z
      .strictObject({ tid: z.uuid({ error: '无效的话题 ID' }) })
      .safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const tid = parsed.data.tid
    // 归属只认 JWT 主体;query/body 里自报的 userId 一律不读(§5 认证不等于授权)
    const userId = request.userId
    if (!userId) return reply.status(401).send(error(401, '请先登录'))
    if (!(await findTagById(tid))) {
      return reply.status(404).send(error(404, '话题不存在'))
    }
    const wasFollowing = await isSubscribed({
      userId,
      targetType: TOPIC_TARGET_TYPE,
      targetId: tid,
    })
    if (wasFollowing) {
      await unsubscribe({ userId, targetType: TOPIC_TARGET_TYPE, targetId: tid })
    } else {
      await subscribe({ userId, targetType: TOPIC_TARGET_TYPE, targetId: tid })
    }
    const followerCount = await countSubscribers(TOPIC_TARGET_TYPE, tid)
    return reply.send(success({ topicId: tid, followed: !wasFollowing, followerCount }))
  })

  // ===== 圈子分类关系（历史 circle_category_relation，integer id） =====

  // GET /circles/category-relation/list - 分类关系列表
  server.get('/circles/category-relation/list', async (request, reply) => {
    const { fatherCategoryId, childCategoryId } = z
      .object({
        fatherCategoryId: z.coerce.number().optional(),
        childCategoryId: z.coerce.number().optional(),
      })
      .parse(request.query)
    const conditions: Array<ReturnType<typeof eq>> = []
    if (fatherCategoryId)
      conditions.push(eq(circleCategoryRelation.fatherCategoryId, Number(fatherCategoryId)))
    if (childCategoryId)
      conditions.push(eq(circleCategoryRelation.childCategoryId, Number(childCategoryId)))
    const list =
      conditions.length > 0
        ? await db
            .select()
            .from(circleCategoryRelation)
            .where(and(...conditions))
        : await db.select().from(circleCategoryRelation)
    return reply.send(success({ list, total: list.length }))
  })

  // POST /circles/category-relation - 创建分类关系
  server.post('/circles/category-relation', async (request, reply) => {
    const body = z
      .object({
        childCategoryId: z.number().int().positive(),
        fatherCategoryId: z.number().int().positive(),
        directFatherCategoryId: z.number().int().positive(),
        isSub: z.boolean().default(false),
      })
      .safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    }
    const [created] = await db
      .insert(circleCategoryRelation)
      .values({
        childCategoryId: body.data.childCategoryId,
        fatherCategoryId: body.data.fatherCategoryId,
        directFatherCategoryId: body.data.directFatherCategoryId,
        isSub: body.data.isSub,
      })
      .returning()
    if (!created) return reply.status(500).send(error(500, '创建分类关系失败'))
    return reply.status(201).send(success({ relation: created }))
  })

  // DELETE /circles/category-relation/:rid - 删除分类关系
  server.delete('/circles/category-relation/:rid', async (request, reply) => {
    const { rid } = z.object({ rid: z.string() }).parse(request.params)
    const ridNum = Number(rid)
    if (!Number.isInteger(ridNum) || ridNum <= 0) {
      return reply.status(400).send(error(400, '无效的关系 ID'))
    }
    const removed = await db
      .delete(circleCategoryRelation)
      .where(eq(circleCategoryRelation.id, ridNum))
      .returning({ id: circleCategoryRelation.id })
    if (removed.length === 0) return reply.status(404).send(error(404, '分类关系不存在'))
    return reply.send(success({ id: ridNum, deleted: removed.length > 0 }))
  })

  // ===== 圈子类目关系（历史 circle_circle_category_relation，integer id） =====

  // GET /circles/circle-category-relation/list - 类目关系列表
  server.get('/circles/circle-category-relation/list', async (request, reply) => {
    const { categoryId, circleId } = z
      .object({
        categoryId: z.coerce.number().optional(),
        circleId: z.coerce.number().optional(),
      })
      .parse(request.query)
    const conditions: Array<ReturnType<typeof eq>> = []
    if (categoryId) conditions.push(eq(circleCircleCategoryRelation.categoryId, Number(categoryId)))
    if (circleId) conditions.push(eq(circleCircleCategoryRelation.circleId, Number(circleId)))
    const list =
      conditions.length > 0
        ? await db
            .select()
            .from(circleCircleCategoryRelation)
            .where(and(...conditions))
        : await db.select().from(circleCircleCategoryRelation)
    return reply.send(success({ list, total: list.length }))
  })

  // POST /circles/circle-category-relation - 创建类目关系
  server.post('/circles/circle-category-relation', async (request, reply) => {
    const body = z
      .object({
        categoryId: z.number().int().positive(),
        circleId: z.number().int().positive(),
      })
      .safeParse(request.body)
    if (!body.success) {
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    }
    const [created] = await db
      .insert(circleCircleCategoryRelation)
      .values({
        categoryId: body.data.categoryId,
        circleId: body.data.circleId,
      })
      .returning()
    if (!created) return reply.status(500).send(error(500, '创建类目关系失败'))
    return reply.status(201).send(success({ relation: created }))
  })

  // DELETE /circles/circle-category-relation/:rid - 删除类目关系
  server.delete('/circles/circle-category-relation/:rid', async (request, reply) => {
    const { rid } = z.object({ rid: z.string() }).parse(request.params)
    const ridNum = Number(rid)
    if (!Number.isInteger(ridNum) || ridNum <= 0) {
      return reply.status(400).send(error(400, '无效的关系 ID'))
    }
    const removed = await db
      .delete(circleCircleCategoryRelation)
      .where(eq(circleCircleCategoryRelation.id, ridNum))
      .returning({ id: circleCircleCategoryRelation.id })
    if (removed.length === 0) return reply.status(404).send(error(404, '类目关系不存在'))
    return reply.send(success({ id: ridNum, deleted: removed.length > 0 }))
  })
}
export default topicsRoutes
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
