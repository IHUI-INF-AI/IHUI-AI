/**
 * v1 内容(从 frontend-stub-other-routes.ts 拆分)。
 * GET /v1/content/{create,list}
 */
import type { FastifyPluginAsync } from 'fastify'
import { success } from '../../utils/response.js'
import { findGenerationHistory, findGenerationTemplates } from '../../db/content-generation-queries.js'
import { parsePagination } from './_shared.js'

export const v1ContentRoutes: FastifyPluginAsync = async (server) => {
  // GET /v1/content/create — 返回内容生成模板列表(供前端选择)
  server.get('/v1/content/create', async (_request, reply) => {
    const list = await findGenerationTemplates()
    return reply.send(success({ list }))
  })

  // GET /v1/content/list — 当前用户内容生成历史
  server.get('/v1/content/list', async (request, reply) => {
    const q = parsePagination(request, reply)
    if (!q) return
    const result = await findGenerationHistory(request.userId!, q.page, q.pageSize)
    return reply.send(
      success({ list: result.list, total: result.total, page: q.page, pageSize: q.pageSize }),
    )
  })
}
