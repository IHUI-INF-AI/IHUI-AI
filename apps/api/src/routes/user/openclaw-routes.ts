/**
 * OpenClaw /openclaw/*(2 个端点)。
 */
import type { FastifyPluginAsync } from 'fastify'
import { success, error } from '../../utils/response.js'
import { findOpenclawItems, findOpenclawItemById } from '../../db/openclaw-queries.js'
import { parsePagination, parseIdParam } from './_shared.js'

const openclawRoutes: FastifyPluginAsync = async (server) => {
  server.get('/openclaw', async (request, reply) => {
    const q = parsePagination(request, reply)
    if (!q) return
    const result = await findOpenclawItems({
      page: q.page,
      pageSize: q.pageSize,
      search: q.search,
    })
    return reply.send(
      success({ list: result.list, total: result.total, page: q.page, pageSize: q.pageSize }),
    )
  })

  server.get('/openclaw/:id', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    const openclaw = await findOpenclawItemById(id)
    if (!openclaw) return reply.status(404).send(error(404, 'OpenClaw 条目不存在'))
    return reply.send(success({ openclaw }))
  })
}

export default openclawRoutes
