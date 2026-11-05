// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { FastifyInstance, FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, and, desc, sql, ilike } from 'drizzle-orm'
import { db } from '../db/index.js'
import { resourceContexts, resourceContextBindings } from '@ihui/database'
import { success, error } from '../utils/response.js'
import { requireAuth } from '../plugins/require-permission.js'
import { isUuidString } from '../utils/uuid.js'

/**
 * 资源上下文管理接口(7 端点)— 真实 DB 查询。
 * 管理用户上传的文件/知识库/URL/text 资源,绑定到会话供 AI 引用。
 */
const plugin: FastifyPluginAsync = async (server: FastifyInstance) => {
  // 1. GET /api/resource-context/list — 资源上下文列表(分页 + type 过滤 + keyword 搜索)
  const listQuery = z.object({
    page: z.coerce.number().int().min(1).optional().default(1),
    pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
    type: z.string().optional(),
    keyword: z.string().optional(),
  })

  server.get('/api/resource-context/list', { preHandler: requireAuth }, async (req, reply) => {
    const parsed = listQuery.safeParse(req.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { page, pageSize, type, keyword } = parsed.data
    const userId = req.userId
    if (!userId) return reply.status(401).send(error(401, '需要登录'))

    const conditions = [eq(resourceContexts.userId, userId)]
    if (type) conditions.push(eq(resourceContexts.type, type))
    if (keyword) conditions.push(ilike(resourceContexts.name, `%${keyword}%`))

    const [list, countResult] = await Promise.all([
      db
        .select()
        .from(resourceContexts)
        .where(and(...conditions))
        .orderBy(desc(resourceContexts.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(resourceContexts)
        .where(and(...conditions)),
    ])

    return reply.send(success({ list, total: countResult[0]?.count ?? 0, page, pageSize }))
  })

  // 2. POST /api/resource-context/create — 创建资源上下文
  const createBody = z.object({
    name: z.string().min(1).max(200),
    type: z.enum(['file', 'knowledge', 'url', 'text']).default('file'),
    url: z.string().max(2000).optional(),
    content: z.string().optional(),
    fileId: z.uuid().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })

  server.post('/api/resource-context/create', { preHandler: requireAuth }, async (req, reply) => {
    const parsed = createBody.safeParse(req.body ?? {})
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const userId = req.userId
    if (!userId) return reply.status(401).send(error(401, '需要登录'))

    const [created] = await db
      .insert(resourceContexts)
      .values({ ...parsed.data, userId })
      .returning()
    return reply.status(201).send(success(created))
  })

  // 3. GET /api/resource-context/:id — 资源上下文详情
  const idParam = z.object({ id: z.string().min(1) })

  // 归属判据(2026-11-01 IDOR 收口)：本文件下方所有按 id 的读/写/删/绑，一律把
  // `user_id` 与 `id` **同时**放进 SQL 的 where(and 谓词)，不是"先查再在内存里比对"。
  // 取不到即 404(而非 403)：他人资源与不存在资源在响应上同形，不泄露"这个 id 存在"。
  // 与上面 list/create 两处的既有形态同源 —— 那两处本来就带 userId，这里只是补齐。
  server.get('/api/resource-context/:id', { preHandler: requireAuth }, async (req, reply) => {
    const parsed = idParam.safeParse(req.params)
    if (!parsed.success) return reply.status(400).send(error(400, '无效的 ID'))
    if (!isUuidString(parsed.data.id)) return reply.status(404).send(error(404, '资源上下文不存在'))
    const userId = req.userId
    if (!userId) return reply.status(401).send(error(401, '需要登录'))

    const [row] = await db
      .select()
      .from(resourceContexts)
      .where(
        and(eq(resourceContexts.id, parsed.data.id), eq(resourceContexts.userId, userId)),
      )
      .limit(1)
    if (!row) return reply.status(404).send(error(404, '资源上下文不存在'))
    return reply.send(success(row))
  })

  // 4. PUT /api/resource-context/:id — 更新资源上下文
  const updateBody = z.object({
    name: z.string().min(1).max(200).optional(),
    type: z.enum(['file', 'knowledge', 'url', 'text']).optional(),
    url: z.string().max(2000).optional(),
    content: z.string().optional(),
    fileId: z.uuid().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })

  server.put('/api/resource-context/:id', { preHandler: requireAuth }, async (req, reply) => {
    const paramParsed = idParam.safeParse(req.params)
    if (!paramParsed.success) return reply.status(400).send(error(400, '无效的 ID'))
    if (!isUuidString(paramParsed.data.id)) return reply.status(400).send(error(400, 'id 格式不正确'))
    const bodyParsed = updateBody.safeParse(req.body ?? {})
    if (!bodyParsed.success) {
      return reply.status(400).send(error(400, bodyParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const userId = req.userId
    if (!userId) return reply.status(401).send(error(401, '需要登录'))

    // 归属进 SQL：他人的 id 命中 0 行 ⇒ updated 为空 ⇒ 404，且没有任何字段被改写
    const [updated] = await db
      .update(resourceContexts)
      .set({ ...bodyParsed.data, updatedAt: new Date() })
      .where(
        and(eq(resourceContexts.id, paramParsed.data.id), eq(resourceContexts.userId, userId)),
      )
      .returning()
    if (!updated) return reply.status(404).send(error(404, '资源上下文不存在'))
    return reply.send(success(updated))
  })

  // 5. DELETE /api/resource-context/:id — 删除资源上下文(级联清理 bindings)
  server.delete('/api/resource-context/:id', { preHandler: requireAuth }, async (req, reply) => {
    const parsed = idParam.safeParse(req.params)
    if (!parsed.success) return reply.status(400).send(error(400, '无效的 ID'))
    // 形状闸(2026-09-28 普查收口):下面这些 :id 最终会被喂进 uuid 列,非 uuid 字面量让 Postgres
    // 抛 22P02 invalid input syntax for type uuid,而未被兜住就是 500 —— 于是"这条不存在"与
    // "服务坏了"在响应上完全同形。判据只有一份(utils/uuid.ts 的 isUuidString),闸必须在进 SQL 之前。
    if (!isUuidString(parsed.data.id)) return reply.status(400).send(error(400, 'id 格式不正确'))
    const userId = req.userId
    if (!userId) return reply.status(401).send(error(401, '需要登录'))

    // 归属进 SQL：他人的 id 删不掉，返回 404；级联清理只在该行走掉之后执行
    const [deleted] = await db
      .delete(resourceContexts)
      .where(and(eq(resourceContexts.id, parsed.data.id), eq(resourceContexts.userId, userId)))
      .returning({ id: resourceContexts.id })
    if (!deleted) return reply.status(404).send(error(404, '资源上下文不存在'))

    // 级联清理 bindings
    await db
      .delete(resourceContextBindings)
      .where(eq(resourceContextBindings.resourceContextId, parsed.data.id))
    return reply.send(success({ id: deleted.id }))
  })

  // 6. POST /api/resource-context/bind — 绑定资源到会话/agent
  const bindBody = z.object({
    resourceContextId: z.string().min(1),
    sessionId: z.string().min(1).optional(),
    agentId: z.string().min(1).optional(),
  })

  server.post('/api/resource-context/bind', { preHandler: requireAuth }, async (req, reply) => {
    const parsed = bindBody.safeParse(req.body ?? {})
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const userId = req.userId
    if (!userId) return reply.status(401).send(error(401, '需要登录'))
    // 形状闸：resourceContextId 会进 uuid 列，非 uuid 字面量必须先挡在 SQL 之前
    if (!isUuidString(parsed.data.resourceContextId)) {
      return reply.status(404).send(error(404, '资源上下文不存在'))
    }

    // 归属进 SQL：只认 (id, user_id) 同时命中的资源。此前只校验"资源存在"，
    // 于是可以把他人资源绑到自己的 sessionId，AI 回答时把他人的私有文件当自己的上下文引用。
    const [ctx] = await db
      .select({ id: resourceContexts.id })
      .from(resourceContexts)
      .where(
        and(
          eq(resourceContexts.id, parsed.data.resourceContextId),
          eq(resourceContexts.userId, userId),
        ),
      )
      .limit(1)
    if (!ctx) return reply.status(404).send(error(404, '资源上下文不存在'))

    const [binding] = await db.insert(resourceContextBindings).values(parsed.data).returning()
    return reply.send(success({ bound: true, ...binding }))
  })

  // 7. GET /api/resource-context/session/:sessionId — 按会话查询资源上下文
  const sessionIdParam = z.object({ sessionId: z.string().min(1) })

  server.get(
    '/api/resource-context/session/:sessionId',
    { preHandler: requireAuth },
    async (req, reply) => {
      const parsed = sessionIdParam.safeParse(req.params)
      if (!parsed.success) return reply.status(400).send(error(400, '无效的 sessionId'))
      const userId = req.userId
      if (!userId) return reply.status(401).send(error(401, '需要登录'))

      // 归属(2026-11-01 IDOR 收口)：此前只按 sessionId 查绑定，任取一个他人的 sessionId
      // 就能反向读出他人资源上下文。
      //
      // 为什么不用 chat 的会话归属判据(chat-conversation-access.ts 的 getConversationAccess)：
      // 本表的 session_id 是 varchar(128) 的**不透明 id**，不保证等于 chat_conversations.id(uuid)，
      // 把它喂进 uuid 列会 22P02 → 500；而且那族判据把"已接受协作成员"也算可达，对私有的
      // 资源上下文过宽。故按任务书给的兜底口径：反查该 sessionId 下绑定资源的属主，
      // **全部属主都等于当前用户**才返回；只要有一条属于他人 ⇒ 404(与"不存在"同形，不泄露存在性)。
      const owners = await db
        .selectDistinct({ ownerId: resourceContexts.userId })
        .from(resourceContexts)
        .innerJoin(
          resourceContextBindings,
          eq(resourceContextBindings.resourceContextId, resourceContexts.id),
        )
        .where(eq(resourceContextBindings.sessionId, parsed.data.sessionId))
      if (owners.some((o) => o.ownerId !== userId)) {
        return reply.status(404).send(error(404, '会话不存在'))
      }

      const list = await db
        .select()
        .from(resourceContextBindings)
        .innerJoin(
          resourceContexts,
          eq(resourceContextBindings.resourceContextId, resourceContexts.id),
        )
        .where(eq(resourceContextBindings.sessionId, parsed.data.sessionId))
        .orderBy(desc(resourceContextBindings.createdAt))

      return reply.send(success({ list }))
    },
  )
}

export default plugin
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
