// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { FastifyPluginAsync, FastifyReply } from 'fastify'
import { z } from 'zod'

import { HR_JOBS, ALL_HR_JOB_NAMES, runHrJob, listHrJobRuns } from '../services/hr-jobs.js'
import { requirePermission } from '../plugins/require-permission.js'
import { success, error } from '../utils/response.js'
import { buildSchema } from '../utils/swagger.js'

/**
 * 人事定时任务端点(HR-1 第 0 期,2026-11-11 立)。
 *
 * 权限:读写均需 hr:attendance:manage(manage 权限手动补跑是高危动作 —— 会直接写考勤/留痕)。
 * 与 cron 的关系:手动补跑走 runHrJob(manual:true),幂等键带毫秒后缀,允许对同一业务窗口
 * 多次补跑各留一条痕;cron 自动触发走 manual:false,同业务日去重。
 */

const HR_MANAGE = 'hr:attendance:manage'

const runBodySchema = z.object({
  /** 可选:手动补跑指定的业务日 YYYY-MM-DD(缺省=当下);用于补历史某天的缺勤/异常 */
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, '日期必须是 YYYY-MM-DD')
    .optional(),
})

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
})

function badReply(
  reply: FastifyReply,
  parsed: { error?: { issues: Array<{ message?: string }> } },
) {
  return reply.status(400).send(error(400, parsed.error?.issues[0]?.message ?? '参数错误'))
}

export const hrJobRoutes: FastifyPluginAsync = async (fastify) => {
  // 任务清单(名字/说明/cron),供管理端展示与 AI 工具 hr_job_list 消费
  fastify.get(
    '/',
    {
      preHandler: requirePermission(HR_MANAGE),
      schema: buildSchema({
        summary: '人事定时任务清单',
        description: '列出全部人事定时任务的名字/说明/cron 表达式,供管理端展示与 AI 工具消费。',
        tags: ['HR'],
      }),
    },
    async (_request, reply) => {
      return reply.send(success({ list: HR_JOBS }))
    },
  )

  // 手动补跑指定任务(高危:写考勤/留痕)。返回本轮执行结果(含 skipped 幂等命中)。
  fastify.post(
    '/:name/run',
    {
      preHandler: requirePermission(HR_MANAGE),
      schema: buildSchema({
        summary: '手动补跑指定人事任务',
        description:
          '手动触发指定人事定时任务(高危:直接写考勤/留痕)。可指定历史业务日 date 补历史缺勤/异常;缺省补当下。',
        tags: ['HR'],
        params: z.object({ name: z.string().min(1).describe('任务名,必须 ∈ ALL_HR_JOB_NAMES') }),
        body: runBodySchema,
      }),
    },
    async (request, reply) => {
      const name = (request.params as { name: string }).name
      if (!ALL_HR_JOB_NAMES.includes(name as never)) {
        return reply.status(400).send(error(400, `未知人事任务: ${name}`))
      }
      const parsed = runBodySchema.safeParse(request.body ?? {})
      if (!parsed.success) return badReply(reply, parsed)
      const at = parsed.data.date ? new Date(`${parsed.data.date}T00:00:00+08:00`) : new Date()
      const outcome = await runHrJob(name, at, { manual: true })
      return reply.send(success({ outcome }))
    },
  )

  // 任务执行历史(按任务名过滤,倒序分页)。供回查"哪天跑了没跑/影响多少行/错在哪"。
  fastify.get(
    '/:name/runs',
    {
      preHandler: requirePermission(HR_MANAGE),
      schema: buildSchema({
        summary: '人事任务执行历史',
        description:
          '按任务名倒序分页查询该定时任务的执行留痕,供回查某天跑了没跑/影响行数/错误信息。',
        tags: ['HR'],
        params: z.object({ name: z.string().min(1).describe('任务名,必须 ∈ ALL_HR_JOB_NAMES') }),
        querystring: listQuerySchema,
      }),
    },
    async (request, reply) => {
      const name = (request.params as { name: string }).name
      if (!ALL_HR_JOB_NAMES.includes(name as never)) {
        return reply.status(400).send(error(400, `未知人事任务: ${name}`))
      }
      const q = listQuerySchema.safeParse(request.query ?? {})
      if (!q.success) return badReply(reply, q)
      const { list, total } = await listHrJobRuns({
        jobName: name,
        limit: q.data.limit ?? 50,
        offset: q.data.offset ?? 0,
      })
      return reply.send(success({ list, total }))
    },
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
