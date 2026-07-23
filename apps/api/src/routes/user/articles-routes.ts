/**
 * 文章模块 /article/*(9 个端点,like/favorite 用 resource_likes 表 toggleLike)。
 */
import type { FastifyPluginAsync } from 'fastify'
import { success, error } from '../../utils/response.js'
import {
  findPublishedArticles,
  findArticleById,
  incrementArticleViewCount,
  createArticle,
  updateArticle,
  deleteArticle,
  findPublishedNewsCategories,
  findMyArticles,
} from '../../db/news-queries.js'
import { toggleLike } from '../../db/resource-likes-queries.js'
import { parsePagination, parseIdParam } from './_shared.js'

const articlesRoutes: FastifyPluginAsync = async (server) => {
  server.get('/article/list', async (request, reply) => {
    const q = parsePagination(request, reply)
    if (!q) return
    const result = await findPublishedArticles({
      page: q.page,
      pageSize: q.pageSize,
      search: q.search,
    })
    return reply.send(
      success({ list: result.list, total: result.total, page: q.page, pageSize: q.pageSize }),
    )
  })

  server.get('/article/detail/:id', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    const article = await findArticleById(id)
    if (article) await incrementArticleViewCount(id)
    return reply.send(success({ article }))
  })

  server.get('/article/hot', async (_request, reply) => {
    const result = await findPublishedArticles({ page: 1, pageSize: 10 })
    return reply.send(success({ list: result.list }))
  })

  server.get('/article/essence', async (_request, reply) => {
    const result = await findPublishedArticles({ page: 1, pageSize: 10 })
    return reply.send(success({ list: result.list }))
  })

  server.get('/article/categories', async (_request, reply) => {
    const list = await findPublishedNewsCategories()
    return reply.send(success({ list }))
  })

  server.get('/article/my', async (request, reply) => {
    const q = parsePagination(request, reply)
    if (!q) return
    const result = await findMyArticles(request.userId!, { page: q.page, pageSize: q.pageSize })
    return reply.send(
      success({ list: result.list, total: result.total, page: q.page, pageSize: q.pageSize }),
    )
  })

  server.post('/article/publish', async (request, reply) => {
    const body =
      (request.body as {
        title?: string
        content?: string
        categoryId?: string
        summary?: string
        coverImage?: string
        isPublished?: boolean
      } | null) ?? {}
    if (!body.title || !body.content)
      return reply.status(400).send(error(400, '标题和内容不能为空'))
    const article = await createArticle({
      title: body.title,
      content: body.content,
      categoryId: body.categoryId,
      summary: body.summary,
      coverImage: body.coverImage,
      authorId: request.userId,
      isPublished: body.isPublished ?? false,
    })
    return reply.status(201).send(success({ success: true, article }))
  })

  server.post('/article/like', async (request, reply) => {
    const body = (request.body as { id?: string } | null) ?? {}
    if (!body.id) return reply.status(400).send(error(400, '缺少 id'))
    const result = await toggleLike('article', body.id, request.userId!)
    return reply.send(success({ success: true, liked: result.liked }))
  })

  server.post('/article/favorite', async (request, reply) => {
    const body = (request.body as { id?: string } | null) ?? {}
    if (!body.id) return reply.status(400).send(error(400, '缺少 id'))
    const result = await toggleLike('article_favorite', body.id, request.userId!)
    return reply.send(success({ success: true, liked: result.liked }))
  })

  server.put('/article/:id', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    const existing = await findArticleById(id)
    if (!existing) return reply.status(404).send(error(404, '文章不存在'))
    if (existing.authorId !== request.userId)
      return reply.status(403).send(error(403, '无权编辑此文章'))
    const body =
      (request.body as {
        title?: string
        content?: string
        categoryId?: string
        summary?: string
        coverImage?: string
        isPublished?: boolean
      } | null) ?? {}
    if (body.title !== undefined && !body.title.trim())
      return reply.status(400).send(error(400, '标题不能为空'))
    if (body.content !== undefined && !body.content.trim())
      return reply.status(400).send(error(400, '内容不能为空'))
    const article = await updateArticle(id, {
      title: body.title,
      content: body.content,
      categoryId: body.categoryId,
      summary: body.summary,
      coverImage: body.coverImage,
      isPublished: body.isPublished,
    })
    return reply.send(success({ success: true, article }))
  })

  server.delete('/article/:id', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    const existing = await findArticleById(id)
    if (!existing) return reply.status(404).send(error(404, '文章不存在'))
    if (existing.authorId !== request.userId)
      return reply.status(403).send(error(403, '无权删除此文章'))
    await deleteArticle(id)
    return reply.send(success({ success: true }))
  })
}

export default articlesRoutes
