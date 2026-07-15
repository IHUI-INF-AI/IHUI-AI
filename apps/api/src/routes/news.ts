import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { requireAdmin } from '../plugins/require-permission.js'
import {
  findPublishedNewsCategories,
  findAllNewsCategories,
  findNewsCategoryById,
  createNewsCategory,
  updateNewsCategory,
  deleteNewsCategory,
  findPublishedArticles,
  findAllArticles,
  findArticleById,
  createArticle,
  updateArticle,
  deleteArticle,
  incrementArticleViewCount,
  findArticlesByIds,
} from '../db/news-queries.js'
import {
  createNewsTop,
  deleteNewsTop,
  findNewsTopByNewsId,
  findNewsTopList,
  updateNewsTopSort,
  createNewsRecommend,
  deleteNewsRecommend,
  findNewsRecommendByNewsId,
  findNewsRecommendList,
  updateNewsRecommendSort,
} from '../db/misc-extended-queries.js'
import { success, error } from '../utils/response.js'

// =============================================================================
// Zod schemas
// =============================================================================

const idParamSchema = z.object({ id: z.string().uuid('无效的 ID') })

const articlesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  categoryId: z
    .preprocess(
      (v) => (v === '' || v === null || v === undefined ? undefined : v),
      z.string().uuid('无效的分类 ID'),
    )
    .optional(),
  search: z.string().max(200).optional(),
  status: z.coerce.number().int().min(0).max(1).optional(),
})

const createCategorySchema = z.object({
  name: z.string().min(1).max(100),
  sort: z.number().int().min(0).optional(),
  status: z.number().int().min(0).max(1).optional(),
})

const updateCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  sort: z.number().int().min(0).optional(),
  status: z.number().int().min(0).max(1).optional(),
})

const createArticleSchema = z.object({
  title: z.string().min(1).max(200),
  categoryId: z.string().uuid().nullable().optional(),
  summary: z.string().max(500).nullable().optional(),
  content: z.string().min(1),
  coverImage: z.string().max(512).nullable().optional(),
  authorName: z.string().max(100).nullable().optional(),
  isPublished: z.boolean().optional(),
  isPinned: z.boolean().optional(),
  sort: z.number().int().min(0).optional(),
  status: z.number().int().min(0).max(1).optional(),
})

const updateArticleSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  categoryId: z.string().uuid().nullable().optional(),
  summary: z.string().max(500).nullable().optional(),
  content: z.string().min(1).optional(),
  coverImage: z.string().max(512).nullable().optional(),
  authorName: z.string().max(100).nullable().optional(),
  isPublished: z.boolean().optional(),
  isPinned: z.boolean().optional(),
  sort: z.number().int().min(0).optional(),
  status: z.number().int().min(0).max(1).optional(),
})

const topOrRecommendSchema = z.object({
  sort: z.number().int().min(0).optional(),
})

// =============================================================================
// 公共路由（前缀 /api，匿名可访问）
// =============================================================================

export const newsRoutes: FastifyPluginAsync = async (server) => {
  // GET /news/categories - 启用的分类列表（公开）
  server.get('/news/categories', async (_request, reply) => {
    const list = await findPublishedNewsCategories()
    return reply.send(success({ list }))
  })

  // GET /news/hot - 热门资讯（公开，按浏览量排序）
  server.get('/news/hot', async (request, reply) => {
    const limitQuery = z
      .object({ limit: z.coerce.number().int().min(1).max(50).default(10) })
      .safeParse(request.query)
    const limit = limitQuery.success ? limitQuery.data.limit : 10
    const result = await findPublishedArticles({ page: 1, pageSize: limit })
    const list = result.list.map((a) => ({
      id: a.id,
      title: a.title,
      viewCount: a.viewCount,
      publishedAt: a.publishedAt ? a.publishedAt.toISOString() : new Date().toISOString(),
    }))
    return reply.send(success(list))
  })

  // GET /news/articles - 已发布资讯列表（公开）
  server.get('/news/articles', async (request, reply) => {
    const parsed = articlesQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const result = await findPublishedArticles(parsed.data)
    return reply.send(success(result))
  })

  // GET /news/articles/pinned - 置顶资讯列表（公开）
  server.get('/news/articles/pinned', async (_request, reply) => {
    const tops = await findNewsTopList()
    if (tops.length === 0) return reply.send(success({ list: [] }))
    const articles = await findArticlesByIds(tops.map((t) => t.newsId))
    return reply.send(success({ list: articles }))
  })

  // GET /news/articles/recommended - 推荐资讯列表（公开）
  server.get('/news/articles/recommended', async (_request, reply) => {
    const recs = await findNewsRecommendList()
    if (recs.length === 0) return reply.send(success({ list: [] }))
    const articles = await findArticlesByIds(recs.map((r) => r.newsId))
    return reply.send(success({ list: articles }))
  })

  // GET /news/articles/:id - 资讯详情（公开）
  server.get('/news/articles/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const article = await findArticleById(parsed.data.id)
    if (!article || !article.isPublished) {
      return reply.status(404).send(error(404, '资讯不存在'))
    }
    await incrementArticleViewCount(parsed.data.id)
    return reply.send(success({ article }))
  })
}

// =============================================================================
// 管理员路由（前缀 /api/admin）
// =============================================================================

export const adminNewsRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)

  // ----- Categories Admin -----

  server.get('/news/categories', async (_request, reply) => {
    const list = await findAllNewsCategories()
    return reply.send(success({ list }))
  })

  server.post('/news/categories', async (request, reply) => {
    const parsed = createCategorySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const category = await createNewsCategory(parsed.data)
    return reply.status(201).send(success({ category }))
  })

  server.put('/news/categories/:id', async (request, reply) => {
    const idParsed = idParamSchema.safeParse(request.params)
    if (!idParsed.success) {
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const parsed = updateCategorySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const existing = await findNewsCategoryById(idParsed.data.id)
    if (!existing) return reply.status(404).send(error(404, '分类不存在'))
    const category = await updateNewsCategory(idParsed.data.id, parsed.data)
    return reply.send(success({ category }))
  })

  server.delete('/news/categories/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const existing = await findNewsCategoryById(parsed.data.id)
    if (!existing) return reply.status(404).send(error(404, '分类不存在'))
    await deleteNewsCategory(parsed.data.id)
    return reply.send(success({ ok: true }))
  })

  // ----- Articles Admin -----

  server.get('/news/articles', async (request, reply) => {
    const parsed = articlesQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const result = await findAllArticles(parsed.data)
    return reply.send(success(result))
  })

  server.get('/news/articles/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const article = await findArticleById(parsed.data.id)
    if (!article) return reply.status(404).send(error(404, '资讯不存在'))
    return reply.send(success({ article }))
  })

  server.post('/news/articles', async (request, reply) => {
    const parsed = createArticleSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const article = await createArticle({
      ...parsed.data,
      authorId: request.userId,
    })
    return reply.status(201).send(success({ article }))
  })

  server.put('/news/articles/:id', async (request, reply) => {
    const idParsed = idParamSchema.safeParse(request.params)
    if (!idParsed.success) {
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const parsed = updateArticleSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const existing = await findArticleById(idParsed.data.id)
    if (!existing) return reply.status(404).send(error(404, '资讯不存在'))
    const article = await updateArticle(idParsed.data.id, parsed.data)
    return reply.send(success({ article }))
  })

  server.delete('/news/articles/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const existing = await findArticleById(parsed.data.id)
    if (!existing) return reply.status(404).send(error(404, '资讯不存在'))
    await deleteArticle(parsed.data.id)
    return reply.send(success({ ok: true }))
  })

  // ----- 置顶 / 推荐 -----

  // PUT /news/articles/:id/top - 置顶（已有则更新 sort）
  server.put('/news/articles/:id/top', async (request, reply) => {
    const idParsed = idParamSchema.safeParse(request.params)
    if (!idParsed.success) {
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const parsed = topOrRecommendSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const article = await findArticleById(idParsed.data.id)
    if (!article) return reply.status(404).send(error(404, '资讯不存在'))
    const existing = await findNewsTopByNewsId(idParsed.data.id)
    if (existing) {
      const updated = await updateNewsTopSort(idParsed.data.id, parsed.data.sort ?? existing.sort)
      return reply.send(success({ newsTop: updated }))
    }
    const newsTop = await createNewsTop({ newsId: idParsed.data.id, sort: parsed.data.sort })
    return reply.send(success({ newsTop }))
  })

  // DELETE /news/articles/:id/top - 取消置顶
  server.delete('/news/articles/:id/top', async (request, reply) => {
    const idParsed = idParamSchema.safeParse(request.params)
    if (!idParsed.success) {
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    }
    await deleteNewsTop(idParsed.data.id)
    return reply.send(success({ id: idParsed.data.id, deleted: true }))
  })

  // PUT /news/articles/:id/recommend - 推荐（已有则更新 sort）
  server.put('/news/articles/:id/recommend', async (request, reply) => {
    const idParsed = idParamSchema.safeParse(request.params)
    if (!idParsed.success) {
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const parsed = topOrRecommendSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const article = await findArticleById(idParsed.data.id)
    if (!article) return reply.status(404).send(error(404, '资讯不存在'))
    const existing = await findNewsRecommendByNewsId(idParsed.data.id)
    if (existing) {
      const updated = await updateNewsRecommendSort(
        idParsed.data.id,
        parsed.data.sort ?? existing.sort,
      )
      return reply.send(success({ newsRecommend: updated }))
    }
    const newsRecommend = await createNewsRecommend({
      newsId: idParsed.data.id,
      sort: parsed.data.sort,
    })
    return reply.send(success({ newsRecommend }))
  })

  // DELETE /news/articles/:id/recommend - 取消推荐
  server.delete('/news/articles/:id/recommend', async (request, reply) => {
    const idParsed = idParamSchema.safeParse(request.params)
    if (!idParsed.success) {
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    }
    await deleteNewsRecommend(idParsed.data.id)
    return reply.send(success({ id: idParsed.data.id, deleted: true }))
  })
}
