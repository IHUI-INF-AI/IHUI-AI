// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import cron from 'node-cron'
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

/**
 * F-163:invokeTarget 白名单 —— 与 src/jobs/* 实际存在的调度作业同源(模块 id)。
 *
 * 仓库内没有「invokeTarget → 可调用体」的通用任务注册表(sys_job 不参与调度,
 * 定时器在 src/index.ts 按固定表达式硬编码),所以这里只收紧入口:未登记值一律 400,
 * 禁止任意串落库;真正的执行器接入后应把此清单替换为注册表导出。
 */
export const JOB_INVOKE_TARGETS = [
  'ai-task-cron',
  'ai-world-sync',
  'audit-evidence-retention',
  'backup-jobs-cron',
  'hot-words-sync',
  'hr-approval-cron',
  'hr-jobs-cron',
  'ops-retention-cleanup',
  'ops-watch-reader',
  'pii-retention-cleanup',
  'portal-source-probe',
  'relay-alert-rules-evaluation',
] as const

const invokeTargetSchema = z
  .string()
  .min(1)
  .max(64)
  .refine(
    (v) => (JOB_INVOKE_TARGETS as readonly string[]).includes(v),
    'invokeTarget 不在任务注册表白名单内',
  )

// job_router (prefix=/job)
const jobBodySchema = z.object({
  jobId: z.number().int().optional(),
  jobName: z.string().min(1),
  jobGroup: z.string().optional(),
  invokeTarget: invokeTargetSchema,
  // F-163:cron 必须是 node-cron 可解析的表达式,否则落库后永不会被调度
  cronExpression: z
    .string()
    .min(1)
    .max(64)
    .refine((v) => cron.validate(v), 'cronExpression 不是合法的 cron 表达式'),
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
  // F-163:仓库内没有 sys_job 的执行器(sys_job 的 cron/invokeTarget 不参与调度,
  // 定时器在 src/index.ts 按固定表达式硬编码),此处如实返回 501,
  // 不再回 200「任务已触发执行」让调用方误以为真的跑了。
  s.put('/run', async (request, reply) => {
    const parsed = jobRunBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const job = await findJobById(parsed.data.jobId)
    if (!job) {
      return reply.status(404).send(error(404, '任务不存在'))
    }
    // 与 admin-extended/system-routes.ts:128-141(F-446)同口径:无执行器不得伪称已执行
    const message = `任务「${job.jobName}」的执行器尚未接入,未执行(与 /admin/system/tasks/:id/run 同口径)`
    return reply.status(501).send(error(501, message))
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
