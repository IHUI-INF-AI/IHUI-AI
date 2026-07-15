import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { findPublishedArticles } from '../db/news-queries.js'
import { success, error } from '../utils/response.js'

const articlesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  categoryId: z
    .preprocess(
      (v) => (v === '' || v === null || v === undefined ? undefined : v),
      z.string().uuid('无效的分类 ID'),
    )
    .optional(),
  search: z.string().max(200).optional(),
})

export const articleRoutes: FastifyPluginAsync = async (server) => {
  server.get('/articles', async (request, reply) => {
    const parsed = articlesQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const pageSize = parsed.data.limit ?? parsed.data.pageSize
    const result = await findPublishedArticles({
      page: parsed.data.page,
      pageSize,
      categoryId: parsed.data.categoryId,
      search: parsed.data.search,
    })
    return reply.send(success(result.list))
  })
}
