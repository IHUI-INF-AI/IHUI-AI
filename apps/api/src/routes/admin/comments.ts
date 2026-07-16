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

const ADMIN_ROLE_ID = 1

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
  topicType: z.preprocess(emptyToUndefined, z.enum(TOPIC_TYPES).optional()),
  keyword: z.preprocess(emptyToUndefined, z.string().min(1).max(255).optional()),
  status: z.preprocess(emptyToUndefined, z.enum(['normal', 'deleted', 'all']).optional()),
})

const idParamSchema = z.object({ id: z.string().uuid('无效的 ID') })

const commentsRoutes: FastifyPluginAsync = async (server) => {
  // GET /comments - 管理员评论列表(支持 topicType + keyword + status 过滤)
  server.get('/comments', async (request, reply) => {
    const roleId = request.jwtPayload?.roleId ?? 0
    if (roleId < ADMIN_ROLE_ID) {
      return reply.status(403).send(error(403, '需要管理员权限'))
    }
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
    const roleId = request.jwtPayload?.roleId ?? 0
    if (roleId < ADMIN_ROLE_ID) {
      return reply.status(403).send(error(403, '需要管理员权限'))
    }
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
    const roleId = request.jwtPayload?.roleId ?? 0
    if (roleId < ADMIN_ROLE_ID) {
      return reply.status(403).send(error(403, '需要管理员权限'))
    }
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
