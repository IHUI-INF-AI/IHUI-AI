import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { findAnnouncements, findAnnouncementById } from '../db/content-queries.js'
import { success, error } from '../utils/response.js'

/**
 * P2-2 公告系统 — CLI 专用轻量端点。
 *
 * 与现有 /api/announcements(在 content.ts)共存,本路由注册到 /api/cli/announcements,
 * 提供 CLI 启动时拉取所需的精简字段(不含 content 正文)与版本探测端点(用于客户端缓存失效判断)。
 *
 * 灵感来源:参考行业 Agent 框架的 CLI 启动公告拉取。
 * 简化策略:复用现有 findAnnouncements 查询,仅在响应中精简字段 + 加 limit。
 */

const latestQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
})

const idParamSchema = z.object({ id: z.string().min(1) })

export const announcementsRoutes: FastifyPluginAsync = async (server) => {
  // GET /cli/announcements/latest?limit=10
  // 返回最近 N 条已发布且未过期的公告(轻量字段,不含正文)
  server.get('/cli/announcements/latest', async (request, reply) => {
    const parsed = latestQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    try {
      const all = await findAnnouncements()
      const limited = all.slice(0, parsed.data.limit)
      // 精简字段:仅返回 CLI 需要的(id/title/type/isPinned/publishedAt)
      // summary 由 content 前 100 字符截取(避免拉取大段正文)
      const list = limited.map((a) => ({
        id: a.id,
        title: a.title,
        type: a.type,
        isPinned: a.isPinned,
        publishedAt: a.publishedAt ? a.publishedAt.toISOString() : null,
        summary: a.content ? a.content.slice(0, 100) : null,
      }))
      return reply.send(success({ list, total: all.length }))
    } catch {
      return reply.send(success({ list: [], total: 0 }))
    }
  })

  // GET /cli/announcements/:id
  // 返回单条公告完整内容(用于 /announcements read <id> 命令)
  server.get('/cli/announcements/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    try {
      const a = await findAnnouncementById(parsed.data.id)
      if (!a || !a.isPublished) {
        return reply.status(404).send(error(404, '公告不存在'))
      }
      return reply.send(
        success({
          announcement: {
            id: a.id,
            title: a.title,
            type: a.type,
            isPinned: a.isPinned,
            publishedAt: a.publishedAt ? a.publishedAt.toISOString() : null,
            summary: a.content ? a.content.slice(0, 100) : null,
            content: a.content,
          },
        }),
      )
    } catch {
      return reply.status(500).send(error(500, '服务器错误'))
    }
  })

  // GET /cli/announcements/version
  // 返回最新公告的 publishedAt 时间戳(客户端用于缓存失效判断)
  server.get('/cli/announcements/version', async (_request, reply) => {
    try {
      const all = await findAnnouncements()
      if (all.length === 0) {
        return reply.send(success({ latestAt: null, count: 0 }))
      }
      const latest = all[0]
      return reply.send(
        success({
          latestAt: latest?.publishedAt ? latest.publishedAt.toISOString() : null,
          count: all.length,
        }),
      )
    } catch {
      return reply.send(success({ latestAt: null, count: 0 }))
    }
  })
}
