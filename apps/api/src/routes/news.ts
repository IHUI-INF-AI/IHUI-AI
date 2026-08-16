import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { and, eq, desc, asc } from 'drizzle-orm'
import { requireAdmin } from '../plugins/require-permission.js'
import { authenticate } from '../plugins/auth.js'
import { toggleLike, findLikeCounts } from '../db/resource-likes-queries.js'
import { aiWorldItems, zhsAiModelInfo } from '@ihui/database'
import { db } from '../db/index.js'
import { logger } from '../utils/logger.js'
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

const idParamSchema = z.object({ id: z.uuid({ error: '无效的 ID' }) })

const articlesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  categoryId: z
    .unknown()
    .transform((v) => (v === '' || v === null || v === undefined ? undefined : v))
    .pipe(z.uuid({ error: '无效的分类 ID' }).optional())
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
  categoryId: z.uuid().nullable().optional(),
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
  categoryId: z.uuid().nullable().optional(),
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

  // GET /news/feed - AI 资讯 feed(公开,合并置顶+推荐+最新发布,去重按 limit 截断)
  // 供 /models 公开页"AI 资讯条带"SSR 拉取,前端 models-api.ts getAiNewsFeed 消费。
  server.get('/news/feed', async (request, reply) => {
    const limitQuery = z
      .object({ limit: z.coerce.number().int().min(1).max(50).default(6) })
      .safeParse(request.query)
    const limit = limitQuery.success ? limitQuery.data.limit : 6

    const [tops, recs, latest] = await Promise.all([
      findNewsTopList(),
      findNewsRecommendList(),
      findPublishedArticles({ page: 1, pageSize: limit }),
    ])

    type ArticleItem = Awaited<ReturnType<typeof findArticlesByIds>>[number]
    const map = new Map<string, ArticleItem>()
    const ids = new Set<string>()
    for (const t of tops) ids.add(t.newsId)
    for (const r of recs) ids.add(r.newsId)
    for (const a of latest.list) ids.add(a.id)

    if (ids.size > 0) {
      const articles = await findArticlesByIds(Array.from(ids))
      for (const a of articles) map.set(a.id, a)
    }

    // 排序:置顶优先 → 推荐次之 → 最新发布
    const ordered: string[] = []
    const seen = new Set<string>()
    for (const t of tops)
      if (!seen.has(t.newsId)) {
        ordered.push(t.newsId)
        seen.add(t.newsId)
      }
    for (const r of recs)
      if (!seen.has(r.newsId)) {
        ordered.push(r.newsId)
        seen.add(r.newsId)
      }
    for (const a of latest.list)
      if (!seen.has(a.id)) {
        ordered.push(a.id)
        seen.add(a.id)
      }

    type FeedItem = {
      id: string
      title: string
      summary: string
      cover: string | null
      author: string
      category: string | null
      publishedAt: string | null
      relatedModelIds: string[]
      source: 'api' | 'ai-world'
    }
    const items: FeedItem[] = ordered
      .slice(0, limit)
      .map((id) => map.get(id))
      .filter((a): a is ArticleItem => !!a)
      .map((a) => ({
        id: String(a.id),
        title: a.title,
        summary: a.summary ?? '',
        cover: a.coverImage ?? null,
        author: a.authorName ?? '',
        category: null as string | null,
        publishedAt: a.publishedAt ? a.publishedAt.toISOString() : null,
        relatedModelIds: [] as string[],
        source: 'api' as const,
      }))

    // 2026-08-05 修复:news_articles 生产为 0 条导致资讯条带空白,
    // fallback 到 AI World 每日同步数据(kind='news',每日 0/12 点更新,真实资讯)。
    if (items.length === 0) {
      try {
        const world = await db
          .select({
            id: aiWorldItems.id,
            title: aiWorldItems.title,
            summary: aiWorldItems.summary,
            cover: aiWorldItems.coverImage,
            author: aiWorldItems.source,
            publishedAt: aiWorldItems.publishedAt,
          })
          .from(aiWorldItems)
          .where(and(eq(aiWorldItems.kind, 'news'), eq(aiWorldItems.status, 1)))
          .orderBy(desc(aiWorldItems.publishedAt), desc(aiWorldItems.fetchedAt))
          .limit(limit)
        if (world.length > 0) {
          for (const w of world) {
            items.push({
              id: `aiw-${w.id}`,
              title: w.title,
              summary: w.summary ?? '',
              cover: w.cover ?? null,
              author: w.author ?? '',
              category: null,
              publishedAt: w.publishedAt ? w.publishedAt.toISOString() : null,
              relatedModelIds: [],
              source: 'ai-world',
            })
          }
        }
      } catch (err) {
        logger.warn('[news/feed] ai_world fallback failed', {
          error: err instanceof Error ? err.message : err,
        })
      }
    }

    return reply.send(success({ items }))
  })

  // GET /models/market - 模型市场公开列表(DB 驱动 zhsAiModelInfo status=1)
  // 2026-08-05 补建:前端 models-api.ts getMarketModels 调用但路由此前不存在(404),
  // 数据由 scripts/seed-zhs-model-info.mjs 从 default_models.json seed(102 个模型)。
  server.get('/models/market', async (request, reply) => {
    const limitQuery = z
      .object({ limit: z.coerce.number().int().min(1).max(200).default(200) })
      .safeParse(request.query)
    const limit = limitQuery.success ? limitQuery.data.limit : 200
    const models = await db
      .select({
        id: zhsAiModelInfo.id,
        name: zhsAiModelInfo.name,
        source: zhsAiModelInfo.source,
        icon: zhsAiModelInfo.icon,
        description: zhsAiModelInfo.description,
        code: zhsAiModelInfo.code,
        modelCode: zhsAiModelInfo.modelCode,
        manufacturer: zhsAiModelInfo.manufacturer,
        isGratis: zhsAiModelInfo.isGratis,
        isNew: zhsAiModelInfo.isNew,
        isTop: zhsAiModelInfo.isTop,
        isHot: zhsAiModelInfo.isHot,
        sort: zhsAiModelInfo.sort,
      })
      .from(zhsAiModelInfo)
      .where(eq(zhsAiModelInfo.status, 1))
      .orderBy(desc(zhsAiModelInfo.isTop), desc(zhsAiModelInfo.isHot), asc(zhsAiModelInfo.sort))
      .limit(limit)
    return reply.send(success({ models }))
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

  // GET /news/articles/:id/related - 相关资讯（公开,同分类优先,推荐位兜底）
  server.get('/news/articles/:id/related', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const id = parsed.data.id
    const article = await findArticleById(id)
    if (!article || !article.isPublished) {
      return reply.status(404).send(error(404, '资讯不存在'))
    }

    // 1. 优先查同分类的其他已发布文章(多取 1 个用于排除当前 id)
    if (article.categoryId) {
      const result = await findPublishedArticles({
        page: 1,
        pageSize: 6,
        categoryId: article.categoryId,
      })
      const list = result.list.filter((a) => a.id !== id).slice(0, 5)
      if (list.length > 0) return reply.send(success({ list }))
    }

    // 2. fallback:同分类无结果 → 推荐位文章(排除当前 id)
    const recs = await findNewsRecommendList()
    const recIds = recs
      .map((r) => r.newsId)
      .filter((rid) => rid !== id)
      .slice(0, 5)
    if (recIds.length > 0) {
      const list = await findArticlesByIds(recIds)
      return reply.send(success({ list }))
    }

    return reply.send(success({ list: [] }))
  })

  // POST /news/articles/:id/like - 点赞资讯(需登录,复用 resource_likes 表 toggleLike)
  server.post('/news/articles/:id/like', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    try {
      await authenticate(request)
    } catch {
      return reply.status(401).send(error(401, 'Authentication required'))
    }
    const id = parsed.data.id
    const userId = request.userId!
    const article = await findArticleById(id)
    if (!article || !article.isPublished) {
      return reply.status(404).send(error(404, '资讯不存在'))
    }
    const { liked } = await toggleLike('news_article', id, userId)
    const countMap = await findLikeCounts('news_article', [id])
    const likeCount = countMap.get(id) ?? 0
    return reply.send(success({ liked, likeCount }))
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
