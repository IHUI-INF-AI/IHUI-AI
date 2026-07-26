import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { success, error } from '../../utils/response.js'
import { parseNum, parseStr } from './_shared.js'
import { findJobLogList, cleanJobLogs, deleteJobLog } from '../../db/admin-sys-queries.js'

const jobIdParamSchema = z.object({ id: z.coerce.number().int().min(1) })

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

  // DELETE /job/log/:id - 删除单条任务日志
  s.delete('/:id', async (request, reply) => {
    const parsed = jobIdParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '无效的日志 ID'))
    }
    const deleted = await deleteJobLog(parsed.data.id)
    if (!deleted) {
      return reply.status(404).send(error(404, '日志不存在'))
    }
    return reply.send(success({ id: parsed.data.id, deleted: true }))
  })

  // DELETE /job/log/clean - 清空任务日志
  s.delete('/clean', async (_request, reply) => {
    await cleanJobLogs()
    return reply.send(success({}))
  })
}
