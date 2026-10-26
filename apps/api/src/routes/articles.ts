// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import {
  findArticleById,
  findPublishedArticles,
  type ArticleWithCategory,
} from '../db/news-queries.js'
import { success, error } from '../utils/response.js'
import { withPublicEdgeCache } from '../utils/public-edge-cache.js'

const idParamSchema = z.object({ id: z.uuid({ error: '无效的 ID' }) })

/**
 * RN 端契约补齐:packages/types 的 ArticleListItem/ArticleDetailItem 用
 * author/cover/views/publishedAt(详情另有 content/likes),而 news_articles 表列名是
 * authorName/coverImage/viewCount。此前 /api/articles 直接返回表原形,RN 屏照契约读字段
 * ⇒ 标题在、作者/浏览量/封面全空。这里**在原字段之上增补契约键**(不删原键:Web/admin/测试
 * 仍按 categoryName 等表原形断言)。news_articles 无点赞列 ⇒ likes 恒 0,
 * RN 详情页的点赞本就是本地态(apps/mobile-rn/src/screens/ArticleDetailScreen.tsx:99)。
 */
function withAppContract(a: ArticleWithCategory) {
  return {
    ...a,
    author: a.authorName ?? '',
    cover: a.coverImage ?? undefined,
    views: a.viewCount ?? 0,
    likes: 0,
    publishedAt: a.publishedAt ? a.publishedAt.toISOString() : '',
  }
}

const articlesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  categoryId: z
    .unknown()
    .transform((v) => (v === '' || v === null || v === undefined ? undefined : v))
    .pipe(z.uuid({ error: '无效的分类 ID' }).optional())
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
    return withPublicEdgeCache(reply).send(success(result.list.map(withAppContract)))
  })

  // GET /articles/:id - 文章详情(RN 端消费;与 /news/articles/:id 同一张表、同一个查询函数)。
  // 这条路由 2026-10-26 之前不存在,而 RN ArticleDetailScreen 早就在打它
  // (apps/mobile-rn/src/screens/ArticleDetailScreen.tsx:82)、watch-aspect.ts:27 也早已
  // 预置了该 URL 的浏览计数拦截 ⇒ 详情链路 100% 404。视图计数由 watch-aspect 的 preHandler
  // 统一自增,本路由不自增(重复自增 = 一次浏览计两次)。
  server.get('/articles/:id', async (request, reply) => {
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const article = await findArticleById(parsed.data.id)
    if (!article || !article.isPublished) {
      return reply.status(404).send(error(404, '文章不存在'))
    }
    return reply.send(success(withAppContract(article)))
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
