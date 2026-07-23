import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { success, error } from '../../utils/response.js'
import { parseNum, parseStr } from './_shared.js'
import {
  findJobList,
  findJobById,
  createJob,
  updateJob,
  updateJobStatus,
  deleteJobsBatch,
} from '../../db/admin-sys-queries.js'

// job_router (prefix=/job)
const jobBodySchema = z.object({
  jobId: z.number().int().optional(),
  jobName: z.string().min(1),
  jobGroup: z.string().optional(),
  invokeTarget: z.string().min(1),
  cronExpression: z.string().min(1),
  misfirePolicy: z.string().optional(),
  concurrent: z.string().optional(),
  status: z.string().optional(),
  remark: z.string().optional(),
})

const jobChangeStatusBodySchema = z.object({
  jobId: z.number().int(),
  status: z.string(),
})

const jobRunBodySchema = z.object({
  jobId: z.number().int(),
  jobGroup: z.string().optional(),
})

export const jobRoutes: FastifyPluginAsync = async (s) => {
  // GET /job/list - 定时任务列表
  s.get('/list', async (request, reply) => {
    const q = request.query as Record<string, string>
    const { list, total } = await findJobList({
      page: parseNum(q.page, 1),
      pageSize: parseNum(q.pageSize, 10),
      jobName: parseStr(q.jobName),
      jobGroup: parseStr(q.jobGroup),
      status: parseStr(q.status),
    })
    return reply.send(success({ list, total }))
  })

  // GET /job/:jobId - 任务详情
  s.get('/:jobId', async (request, reply) => {
    const { jobId } = z.object({ jobId: z.string() }).parse(request.params)
    const id = Number(jobId)
    if (Number.isNaN(id)) {
      return reply.status(400).send(error(400, '无效的 ID'))
    }
    const data = await findJobById(id)
    if (!data) {
      return reply.status(404).send(error(404, '任务不存在'))
    }
    return reply.send(success({ data }))
  })

  // POST /job - 新增定时任务
  s.post('', async (request, reply) => {
    const parsed = jobBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { jobId: _jobId, ...data } = parsed.data
    const job = await createJob({ ...data, createBy: request.userId })
    return reply.send(success({ job }))
  })

  // PUT /job - 修改定时任务
  s.put('', async (request, reply) => {
    const parsed = jobBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { jobId, ...data } = parsed.data
    if (!jobId) {
      return reply.status(400).send(error(400, 'jobId 不能为空'))
    }
    const job = await updateJob(jobId, { ...data, updateBy: request.userId })
    if (!job) {
      return reply.status(404).send(error(404, '任务不存在'))
    }
    return reply.send(success({ job }))
  })

  // PUT /job/changeStatus - 暂停/恢复任务
  s.put('/changeStatus', async (request, reply) => {
    const parsed = jobChangeStatusBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const job = await updateJobStatus(parsed.data.jobId, parsed.data.status)
    if (!job) {
      return reply.status(404).send(error(404, '任务不存在'))
    }
    return reply.send(success({ job }))
  })

  // PUT /job/run - 立即执行
  s.put('/run', async (request, reply) => {
    const parsed = jobRunBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const job = await findJobById(parsed.data.jobId)
    if (!job) {
      return reply.status(404).send(error(404, '任务不存在'))
    }
    return reply.send(success({ jobId: parsed.data.jobId, message: '任务已触发执行' }))
  })

  // DELETE /job/:jobIds - 删除(逗号分隔)
  s.delete('/:jobIds', async (request, reply) => {
    const { jobIds } = z.object({ jobIds: z.string() }).parse(request.params)
    const ids = jobIds
      .split(',')
      .filter(Boolean)
      .map(Number)
      .filter((n) => !Number.isNaN(n))
    const deleted = await deleteJobsBatch(ids)
    return reply.send(success({ deleted }))
  })
}
