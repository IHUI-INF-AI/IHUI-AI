/**
 * Design 预览 + 评论路由(2026-07-23 立,对齐 @ihui/shared/design/element 契约)。
 *
 * 保存/列出当前用户的 HTML 预览(desktop 画布 + 元素选择器 + 评论闭环)。
 * 预览存储:Redis key `design-preview:<userId>`(value 为预览数组 JSON)
 * 评论存储:Redis List `design-comments:<previewId>`,LPUSH 新评论 + LRANGE 0 -1 取全部
 * Redis 不可用时降级为进程内 Map(仅开发环境,重启失效)。
 *
 * 端点:
 *  - POST /design/preview             保存预览
 *  - GET  /design/previews            列出当前用户所有预览
 *  - POST /design/comments            新增评论(LPUSH 到 Redis List)
 *  - GET  /design/comments/:previewId 列出指定预览的所有评论(LRANGE 0 -1)
 */
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { checkAuth } from '../plugins/auth.js'
import { success, error } from '../utils/response.js'
import type { DesignPreview, DesignPreviewResponse, DesignComment } from '@ihui/shared'

const previewSchema = z.object({
  name: z.string().min(1).max(200),
  html: z.string().min(1).max(500_000),
})

const commentSchema = z.object({
  previewId: z.string().min(1).max(200),
  content: z.string().min(1).max(10_000),
  elementId: z.string().max(200).optional(),
})

/** Redis 不可用时的进程内降级存储:userId → previews[] */
const previewFallback = new Map<string, DesignPreview[]>()
/** Redis 不可用时的进程内降级存储:previewId → comments[](最新在头部) */
const commentFallback = new Map<string, DesignComment[]>()

function userKey(userId: string): string {
  return `design-preview:${userId}`
}

function commentKey(previewId: string): string {
  return `design-comments:${previewId}`
}

async function readPreviews(
  redis: { get: (k: string) => Promise<string | null> },
  key: string,
): Promise<DesignPreview[]> {
  try {
    const raw = await redis.get(key)
    if (!raw) return []
    return JSON.parse(raw) as DesignPreview[]
  } catch {
    return previewFallback.get(key) ?? []
  }
}

async function writePreviews(
  redis: { set: (k: string, v: string) => Promise<unknown> },
  key: string,
  previews: DesignPreview[],
): Promise<void> {
  try {
    await redis.set(key, JSON.stringify(previews))
  } catch {
    previewFallback.set(key, previews)
  }
}

/** LPUSH 一条评论到 Redis List,失败降级进程内数组(unshift)。 */
async function pushComment(
  redis: { lpush: (k: string, v: string) => Promise<number> },
  key: string,
  comment: DesignComment,
): Promise<void> {
  try {
    await redis.lpush(key, JSON.stringify(comment))
  } catch {
    const list = commentFallback.get(key) ?? []
    list.unshift(comment)
    commentFallback.set(key, list)
  }
}

/** LRANGE 0 -1 取全部评论,失败降级进程内数组。返回顺序:最新在头部。 */
async function readComments(
  redis: { lrange: (k: string, s: number, e: number) => Promise<string[]> },
  key: string,
): Promise<DesignComment[]> {
  try {
    const rawList = await redis.lrange(key, 0, -1)
    const result: DesignComment[] = []
    for (const item of rawList) {
      try {
        result.push(JSON.parse(item) as DesignComment)
      } catch {
        /* 损坏条目跳过 */
      }
    }
    return result
  } catch {
    return commentFallback.get(key) ?? []
  }
}

export const designRoutes: FastifyPluginAsync = async (server) => {
  // POST /design/preview — 保存预览
  server.post('/design/preview', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(await checkAuth(request, reply))) return
    const userId = request.userId!

    const parsed = previewSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }

    const { name, html } = parsed.data
    const now = new Date().toISOString()
    const preview: DesignPreview = {
      id: randomUUID(),
      userId: Number(userId),
      name,
      html,
      createdAt: now,
      updatedAt: now,
    }

    const key = userKey(userId)
    const previews = await readPreviews(server.redis, key)
    previews.push(preview)
    await writePreviews(server.redis, key, previews)

    const response: DesignPreviewResponse = { preview }
    return reply.status(201).send(success(response))
  })

  // GET /design/previews — 列出当前用户所有预览
  server.get('/design/previews', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(await checkAuth(request, reply))) return
    const userId = request.userId!

    const key = userKey(userId)
    const previews = await readPreviews(server.redis, key)
    return reply.send(success({ previews, total: previews.length }))
  })

  // POST /design/comments — 新增评论(LPUSH 到 Redis List `design-comments:<previewId>`)
  server.post('/design/comments', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(await checkAuth(request, reply))) return
    const userId = request.userId!

    const parsed = commentSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }

    const { previewId, content, elementId } = parsed.data
    const phone = request.jwtPayload?.phone ?? ''
    const comment: DesignComment = {
      id: randomUUID(),
      previewId,
      elementId: elementId ?? '',
      userId: Number(userId),
      userName: phone || `User ${userId}`,
      content,
      createdAt: new Date().toISOString(),
    }

    await pushComment(server.redis, commentKey(previewId), comment)

    return reply.status(201).send(success(comment))
  })

  // GET /design/comments/:previewId — 列出指定预览的所有评论(LRANGE 0 -1,最新在头部)
  server.get(
    '/design/comments/:previewId',
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (!(await checkAuth(request, reply))) return

      const { previewId } = request.params as { previewId: string }
      if (!previewId) {
        return reply.status(400).send(error(400, 'previewId 为必填'))
      }

      const comments = await readComments(server.redis, commentKey(previewId))
      return reply.send(success({ comments, total: comments.length }))
    },
  )
}
