/**
 * 互动端点:like / comment / follow 统一入口(别名层)。
 *
 * 复用现有 /comments/:id/like /follows/:userId /comments 端点的 query 函数,
 * 仅提供对外语义清晰的 /api/interactions/* 别名路径,
 * 方便前端在不同场景(评论/帖子/动态)使用同一组 URL 表达点赞/关注/评论。
 *
 * 不重复实现业务逻辑,只做参数透传 + 响应适配。
 */
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { and, eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { authenticate } from '../plugins/auth.js'
import { success, error } from '../utils/response.js'
import { commentLikes } from '@ihui/database'
import {
  findComments,
  createComment,
  likeComment,
  unlikeComment,
} from '../db/comment-queries.js'
import { followUser, unfollowUser, isFollowing } from '../db/social-queries.js'

// ============================================================================
// Schemas
// ============================================================================

const likeSchema = z.object({
  commentId: z.string().uuid('commentId 必须为 UUID'),
})

const followSchema = z.object({
  userId: z.string().uuid('userId 必须为 UUID'),
})

const commentCreateSchema = z.object({
  resourceType: z.enum(['project', 'file', 'doc', 'post', 'comment']),
  resourceId: z.string().min(1).max(128),
  content: z.string().min(1).max(2000),
  parentId: z.string().uuid().optional(),
  mentions: z.array(z.string().uuid()).max(50).optional(),
})

const commentListQuerySchema = z.object({
  resourceType: z.enum(['project', 'file', 'doc', 'post', 'comment']),
  resourceId: z.string().min(1).max(128),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  offset: z.coerce.number().int().min(0).optional().default(0),
})

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// ============================================================================
// Routes
// ============================================================================

export const interactionsRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await authenticate(request)
    } catch (e) {
      const err = e as Error & { statusCode?: number }
      reply.status(err.statusCode ?? 401).send(error(err.statusCode ?? 401, err.message))
    }
  })

  // POST /interactions/like — 点赞评论(comment_likes 表,幂等)
  server.post('/like', async (request, reply) => {
    const parsed = likeSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { commentId } = parsed.data
    await likeComment(commentId, request.userId!)
    return reply.status(201).send(success({ commentId, liked: true }))
  })

  // DELETE /interactions/like/:commentId — 取消点赞
  server.delete<{ Params: { commentId: string } }>(
    '/like/:commentId',
    async (request, reply) => {
      const { commentId } = request.params
      if (!UUID_RE.test(commentId)) {
        return reply.status(400).send(error(400, 'commentId 必须为 UUID'))
      }
      await unlikeComment(commentId, request.userId!)
      return reply.send(success({ commentId, liked: false }))
    },
  )

  // GET /interactions/like/check?commentId=xxx — 查询是否已点赞
  server.get<{ Querystring: { commentId?: string } }>(
    '/like/check',
    async (request, reply) => {
      const cid = request.query.commentId
      if (!cid || !UUID_RE.test(cid)) {
        return reply.status(400).send(error(400, 'commentId 必须为 UUID'))
      }
      const [row] = await db
        .select()
        .from(commentLikes)
        .where(and(eq(commentLikes.commentId, cid), eq(commentLikes.userId, request.userId!)))
        .limit(1)
      return reply.send(success({ commentId: cid, liked: Boolean(row) }))
    },
  )

  // POST /interactions/follow — 关注用户(userFollows 表,幂等)
  server.post('/follow', async (request, reply) => {
    const parsed = followSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { userId: targetId } = parsed.data
    const followerId = request.userId!
    if (targetId === followerId) {
      return reply.status(400).send(error(400, '不能关注自己'))
    }
    await followUser(followerId, targetId)
    const isMutual = await isFollowing(targetId, followerId)
    return reply.status(201).send(success({ following: true, isMutual }))
  })

  // DELETE /interactions/follow/:userId — 取消关注
  server.delete<{ Params: { userId: string } }>(
    '/follow/:userId',
    async (request, reply) => {
      const { userId: targetId } = request.params
      if (!UUID_RE.test(targetId)) {
        return reply.status(400).send(error(400, 'userId 必须为 UUID'))
      }
      await unfollowUser(request.userId!, targetId)
      return reply.send(success({ following: false }))
    },
  )

  // GET /interactions/follow/status?userId=xxx — 关注状态
  server.get<{ Querystring: { userId?: string } }>(
    '/follow/status',
    async (request, reply) => {
      const tid = request.query.userId
      if (!tid || !UUID_RE.test(tid)) {
        return reply.status(400).send(error(400, 'userId 必须为 UUID'))
      }
      const following = await isFollowing(request.userId!, tid)
      const isMutual = following ? await isFollowing(tid, request.userId!) : false
      return reply.send(success({ following, isMutual }))
    },
  )

  // POST /interactions/comment — 创建评论
  server.post('/comment', async (request, reply) => {
    const parsed = commentCreateSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const data = parsed.data
    const created = await createComment({
      userId: request.userId!,
      resourceType: data.resourceType,
      resourceId: data.resourceId,
      content: data.content,
      parentId: data.parentId ?? null,
      mentions: data.mentions ?? [],
    })
    return reply.status(201).send(success(created))
  })

  // GET /interactions/comment?resourceType=&resourceId=&limit=&offset=
  server.get('/comment', async (request, reply) => {
    const parsed = commentListQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { resourceType, resourceId, limit, offset } = parsed.data
    const { list, total } = await findComments({
      resourceType,
      resourceId,
      page: Math.floor(offset / limit) + 1,
      pageSize: limit,
      currentUserId: request.userId!,
    })
    return reply.send(success({ list, total, limit, offset }))
  })
}

export default interactionsRoutes
