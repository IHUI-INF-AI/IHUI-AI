import type { FastifyPluginAsync } from 'fastify'
import { success } from '../../utils/response.js'
import { parseNum, parseStr } from './_shared.js'
import { findJobLogList, cleanJobLogs } from '../../db/admin-sys-queries.js'

// job_log_router (prefix=/job/log)
export const jobLogRoutes: FastifyPluginAsync = async (s) => {
  // GET /job/log/list - 任务执行日志
  s.get('/list', async (request, reply) => {
    const q = request.query as Record<string, string>
    const { list, total } = await findJobLogList({
      page: parseNum(q.page, 1),
      pageSize: parseNum(q.pageSize, 10),
      jobName: parseStr(q.jobName),
      jobGroup: parseStr(q.jobGroup),
      status: parseStr(q.status),
    })
    return reply.send(success({ list, total }))
  })

  // DELETE /job/log/clean - 清空任务日志
  s.delete('/clean', async (_request, reply) => {
    await cleanJobLogs()
    return reply.send(success({}))
  })
}
