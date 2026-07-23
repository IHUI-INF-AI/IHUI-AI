import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { success, error } from '../../utils/response.js'
import { parseNum, parseStr } from './_shared.js'
import { findOperlogList, deleteOperlogsBatch, cleanOperlogs } from '../../db/admin-sys-queries.js'

// operlog_router (prefix=/operlog)
export const operlogRoutes: FastifyPluginAsync = async (s) => {
  // GET /operlog/list - 操作日志列表
  s.get('/list', async (request, reply) => {
    const q = request.query as Record<string, string>
    const { list, total } = await findOperlogList({
      page: parseNum(q.page, 1),
      pageSize: parseNum(q.pageSize, 10),
      title: parseStr(q.title),
      businessType: parseNum(q.businessType),
      operName: parseStr(q.operName),
      status: parseNum(q.status),
    })
    return reply.send(success({ list, total }))
  })

  // DELETE /operlog/clean - 清空操作日志
  s.delete('/clean', async (_request, reply) => {
    await cleanOperlogs()
    return reply.send(success({}))
  })

  // DELETE /operlog/:operIds - 删除操作日志(逗号分隔)
  s.delete('/:operIds', async (request, reply) => {
    const { operIds } = z.object({ operIds: z.string() }).parse(request.params)
    const ids = operIds
      .split(',')
      .filter(Boolean)
      .map(Number)
      .filter((n) => !Number.isNaN(n))
    if (ids.length === 0) {
      return reply.status(400).send(error(400, '无效的 ID'))
    }
    const deleted = await deleteOperlogsBatch(ids)
    return reply.send(success({ deleted }))
  })
}
