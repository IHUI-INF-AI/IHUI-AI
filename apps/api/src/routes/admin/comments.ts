// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * /api/admin/comments 路由:评论管理(列表 + 删除)。
 * - GET /comments:分页列表,支持 topicType + keyword + status 过滤
 * - DELETE /comments/:id:管理员软删除评论
 *
 * 设计说明:
 * - 评论的 resourceType 即旧项目的 topicType(article/ask/answer/resource/circle_post/lesson/live_channel/topic/comment)
 * - status 过滤:normal(未删除)/ deleted(已删除)/ all
 * - keyword 对 content 做模糊匹配
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { and, desc, eq, ilike, sql } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { comments, users } from '@ihui/database'
import { success, error, emptyToUndefined } from '../../utils/response.js'
import { requireAdmin } from '../../plugins/require-permission.js'

// 2026-11-01 安全强化:这里原来是本文件自带的第三份 `const ADMIN_ROLE_ID = 1` + 三处裸比较
// —— 门 53(RULE-1)存量面最后一枚。特权判定的单源是 plugins/require-permission.ts,
// 局部重写救不了"常量抄错/档位改了这边不知道"那一型,故整片改走 requireAdmin preHandler。

const TOPIC_TYPES = [
  'article',
  'ask',
  'answer',
  'resource',
  'circle_post',
  'lesson',
  'live_channel',
  'topic',
  'comment',
  'project',
  'file',
  'doc',
  'post',
] as const

const listCommentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  topicType: z.transform(emptyToUndefined).pipe(z.enum(TOPIC_TYPES).optional()),
  keyword: z.transform(emptyToUndefined).pipe(z.string().min(1).max(255).optional()),
  status: z.transform(emptyToUndefined).pipe(z.enum(['normal', 'deleted', 'all']).optional()),
})

const idParamSchema = z.object({ id: z.uuid({ error: '无效的 ID' }) })

const commentsRoutes: FastifyPluginAsync = async (server) => {
  // 插件级闸(与挂载点 admin-missing-routes.ts:70 那条 blanket 同一出口、同一语义):
  // 本地这条不是冗余装饰 —— 挂载点被换、或父级那条 addHook 被挪到 register 之后
  // (Fastify 的 preHandler 在注册那一刻合成,顺序即语义)时,这一片会静默退化成"只需登录"。
  server.addHook('preHandler', requireAdmin)
  // GET /comments - 管理员评论列表(支持 topicType + keyword + status 过滤)
  server.get('/comments', async (request, reply) => {
    const parsed = listCommentsQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { page, pageSize, topicType, keyword, status } = parsed.data

    const conds = []
    if (topicType) conds.push(eq(comments.resourceType, topicType))
    if (keyword) conds.push(ilike(comments.content, `%${keyword}%`))
    if (status === 'normal') conds.push(eq(comments.isDeleted, false))
    if (status === 'deleted') conds.push(eq(comments.isDeleted, true))
    const where = conds.length > 0 ? and(...conds) : undefined
    const offset = (page - 1) * pageSize

    const [list, totalRows] = await Promise.all([
      db
        .select({
          id: comments.id,
          userId: comments.userId,
          resourceType: comments.resourceType,
          resourceId: comments.resourceId,
          parentId: comments.parentId,
          content: comments.content,
          mentions: comments.mentions,
          isDeleted: comments.isDeleted,
          createdAt: comments.createdAt,
          updatedAt: comments.updatedAt,
          userNickname: users.nickname,
          userAvatar: users.avatar,
        })
        .from(comments)
        .leftJoin(users, eq(users.id, comments.userId))
        .where(where)
        .orderBy(desc(comments.createdAt))
        .limit(pageSize)
        .offset(offset),
      db
        .select({ count: sql<number>`COUNT(*)` })
        .from(comments)
        .where(where),
    ])

    return reply.send(success({ list, total: Number(totalRows[0]?.count ?? 0), page, pageSize }))
  })

  // GET /comments/:id - 管理员评论详情(含子评论)
  server.get('/comments/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const [parent] = await db
      .select({
        id: comments.id,
        userId: comments.userId,
        resourceType: comments.resourceType,
        resourceId: comments.resourceId,
        parentId: comments.parentId,
        content: comments.content,
        mentions: comments.mentions,
        isDeleted: comments.isDeleted,
        createdAt: comments.createdAt,
        updatedAt: comments.updatedAt,
        userNickname: users.nickname,
        userAvatar: users.avatar,
      })
      .from(comments)
      .leftJoin(users, eq(users.id, comments.userId))
      .where(eq(comments.id, parsed.data.id))
      .limit(1)
    if (!parent) {
      return reply.status(404).send(error(404, '评论不存在'))
    }
    const replies = await db
      .select({
        id: comments.id,
        userId: comments.userId,
        resourceType: comments.resourceType,
        resourceId: comments.resourceId,
        parentId: comments.parentId,
        content: comments.content,
        mentions: comments.mentions,
        isDeleted: comments.isDeleted,
        createdAt: comments.createdAt,
        updatedAt: comments.updatedAt,
        userNickname: users.nickname,
        userAvatar: users.avatar,
      })
      .from(comments)
      .leftJoin(users, eq(users.id, comments.userId))
      .where(eq(comments.parentId, parsed.data.id))
      .orderBy(desc(comments.createdAt))
    return reply.send(success({ comment: parent, replies }))
  })

  // DELETE /comments/:id - 管理员软删除评论
  server.delete('/comments/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const [existing] = await db
      .select()
      .from(comments)
      .where(eq(comments.id, parsed.data.id))
      .limit(1)
    if (!existing) {
      return reply.status(404).send(error(404, '评论不存在'))
    }
    if (existing.isDeleted) {
      return reply.send(success({ id: parsed.data.id, isDeleted: true }))
    }
    await db
      .update(comments)
      .set({ isDeleted: true, content: '已删除', updatedAt: new Date() })
      .where(eq(comments.id, parsed.data.id))
    return reply.send(success({ id: parsed.data.id, isDeleted: true }))
  })
}

export default commentsRoutes
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
