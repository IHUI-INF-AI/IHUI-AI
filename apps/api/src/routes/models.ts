/**
 * 模型市场公共路由(前缀 /api/models,匿名可访问)。
 *
 * 设计说明:
 *   - 本插件由 news.ts newsRoutes 内 server.register 挂载(前缀 /models),
 *     因 newsRoutes 已注册 prefix:'/api',故最终 URL 为 /api/models/market。
 *   - 复用 zhsAiModelInfo 表(status=1 即已发布),不要求登录,
 *     供 /models 公开市场页 SSR/ISR 拉取。
 *   - 返回形状兼容前端 Model 类型(id 转字符串 + 最小字段集)。
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, and, desc } from 'drizzle-orm'
import { db } from '../db/index.js'
import { zhsAiModelInfo } from '@ihui/database'
import { success, error } from '../utils/response.js'

const marketQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(200),
})

export const modelsRoutes: FastifyPluginAsync = async (server) => {
  // GET /market - 模型市场列表(公开,已发布模型)
  server.get('/market', async (request, reply) => {
    try {
      const parsed = marketQuerySchema.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const rows = await db
        .select()
        .from(zhsAiModelInfo)
        .where(and(eq(zhsAiModelInfo.status, 1)))
        .orderBy(desc(zhsAiModelInfo.isTop), desc(zhsAiModelInfo.isHot), desc(zhsAiModelInfo.sort))
        .limit(parsed.data.limit)

      // 映射为前端 Model 兼容形状(id 字符串化 + 最小字段集)
      const items = rows.map((m) => ({
        id: String(m.id),
        name: m.name,
        provider: (m.manufacturer ?? m.source ?? 'unknown') as string,
        description: m.description ?? '',
        contextLength: 0,
        inputPrice: 0,
        features: [] as string[],
        releasedAt: m.createdAt ? m.createdAt.toISOString() : undefined,
        highlight: m.isTop === true,
      }))

      return reply.send(success({ models: items, items, total: items.length }))
    } catch (e) {
      return reply.status(500).send(error(500, (e as Error).message || 'Failed to list market models'))
    }
  })
}
