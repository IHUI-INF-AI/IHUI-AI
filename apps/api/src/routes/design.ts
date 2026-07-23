/**
 * Design 预览路由(2026-07-23 立,对齐 @ihui/shared/design/element 契约)。
 *
 * 保存/列出当前用户的 HTML 预览(desktop 画布 + 元素选择器 + 评论闭环)。
 * Redis key 格式:design-preview:<userId>(value 为预览数组 JSON)
 * Redis 不可用时降级为进程内 Map(仅开发环境,重启失效)。
 *
 * 端点:
 *  - POST /design/preview    保存预览
 *  - GET  /design/previews   列出当前用户所有预览
 */
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { checkAuth } from '../plugins/auth.js'
import { success, error } from '../utils/response.js'
import type { DesignPreview, DesignPreviewResponse } from '@ihui/shared'

const previewSchema = z.object({
  name: z.string().min(1).max(200),
  html: z.string().min(1).max(500_000),
})

/** Redis 不可用时的进程内降级存储:userId → previews[] */
const previewFallback = new Map<string, DesignPreview[]>()

function userKey(userId: string): string {
  return `design-preview:${userId}`
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
}
