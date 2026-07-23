/**
 * AI Feed/World 模块 /ai-feed/*, /ai-world/*(4 个端点)。
 */
import type { FastifyPluginAsync } from 'fastify'
import { success, error } from '../../utils/response.js'
import { findAiFeedPosts, findAiFeedPostById } from '../../db/ai-feed-post-queries.js'
import { findAiWorldItemById } from '../../db/ai-world-queries.js'
import { parsePagination, parseIdParam } from './_shared.js'

const aiFeedRoutes: FastifyPluginAsync = async (server) => {
  server.get('/ai-feed', async (request, reply) => {
    const q = parsePagination(request, reply)
    if (!q) return
    const result = await findAiFeedPosts({ page: q.page, pageSize: q.pageSize, search: q.search })
    return reply.send(
      success({ list: result.list, total: result.total, page: q.page, pageSize: q.pageSize }),
    )
  })

  server.get('/ai-ext/ai-feed/items', async (request, reply) => {
    const q = parsePagination(request, reply)
    if (!q) return
    const result = await findAiFeedPosts({ page: q.page, pageSize: q.pageSize, search: q.search })
    return reply.send(
      success({ list: result.list, total: result.total, page: q.page, pageSize: q.pageSize }),
    )
  })

  server.get('/ai-feed/:id', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    const feed = await findAiFeedPostById(id)
    if (!feed) return reply.status(404).send(error(404, '资讯不存在'))
    return reply.send(success({ feed }))
  })

  server.get('/ai-world/:id', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    const world = await findAiWorldItemById(id)
    if (!world) return reply.status(404).send(error(404, '条目不存在'))
    return reply.send(success({ world }))
  })
}

export default aiFeedRoutes
