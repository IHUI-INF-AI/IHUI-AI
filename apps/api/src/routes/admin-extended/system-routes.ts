/**
 * 系统岗位/定时任务路由(从原 frontend-stub-admin-routes.ts 拆分)。
 * 路径前缀:/admin/system
 */
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { eq, desc, and, count } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { sysJobs, sysJobLogs, sysPosts } from '@ihui/database'
import { requireAdmin } from '../../plugins/require-permission.js'
import { success, error, parseOrThrow } from '../../utils/response.js'
import { idParamSchema, adminListSchema } from './_shared.js'

export const systemRoutes: FastifyPluginAsync = async (server) => {
  server.get('/admin/system/posts', { preHandler: requireAdmin }, async (request, reply) => {
    const q = adminListSchema.parse(request.query ?? {})
    const page = q.page ?? 1
    const pageSize = q.pageSize ?? 20
    const offset = (page - 1) * pageSize
    const [list, countResult] = await Promise.all([
      db.select().from(sysPosts).orderBy(sysPosts.postSort).limit(pageSize).offset(offset),
      db.select({ count: count() }).from(sysPosts),
    ])
    return reply.send(success({ list, total: countResult[0]?.count ?? 0, page, pageSize }))
  })
  server.get('/admin/system/tasks', { preHandler: requireAdmin }, async (request, reply) => {
    const q = adminListSchema.parse(request.query ?? {})
    const page = q.page ?? 1
    const pageSize = q.pageSize ?? 20
    const offset = (page - 1) * pageSize
    // 前端状态枚举:all/running/paused/idle/failed(DB status:0=正常 1=暂停)
    const rawStatus = (request.query as { status?: string }).status
    const conds = []
    if (rawStatus === 'running') conds.push(eq(sysJobs.status, '0'))
    if (rawStatus === 'paused') conds.push(eq(sysJobs.status, '1'))
    const where = conds.length > 0 ? and(...conds) : undefined
    const [list, countResult] = await Promise.all([
      db
        .select()
        .from(sysJobs)
        .where(where)
        .orderBy(desc(sysJobs.jobId))
        .limit(pageSize)
        .offset(offset),
      db.select({ count: count() }).from(sysJobs).where(where),
    ])
    // 每个任务最近一次执行日志(job_name 匹配)
    const latestLogs = await db
      .selectDistinctOn([sysJobLogs.jobName], {
        jobName: sysJobLogs.jobName,
        status: sysJobLogs.status,
        createTime: sysJobLogs.createTime,
      })
      .from(sysJobLogs)
      .orderBy(sysJobLogs.jobName, desc(sysJobLogs.createTime))
    const logMap = new Map(latestLogs.map((l) => [l.jobName, l]))
    const tasks = list.map((job) => {
      const latest = logMap.get(job.jobName)
      return {
        id: String(job.jobId),
        name: job.jobName,
        type: 'cron' as const,
        schedule: job.cronExpression,
        status: job.status === '1' ? ('paused' as const) : ('running' as const),
        lastRunAt: latest?.createTime ? latest.createTime.toISOString() : null,
        nextRunAt: null,
        lastDuration: null,
        lastStatus: latest
          ? latest.status === '0'
            ? ('success' as const)
            : ('failed' as const)
          : null,
      }
    })
    return reply.send(success({ list: tasks, total: countResult[0]?.count ?? 0, page, pageSize }))
  })
  server.post(
    '/admin/system/tasks/:id/pause',
    { preHandler: requireAdmin },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = parseOrThrow(idParamSchema, request.params)
      const jobId = Number(id)
      const [job] = await db.select().from(sysJobs).where(eq(sysJobs.jobId, jobId)).limit(1)
      if (!job) return reply.status(404).send(error(404, '任务不存在'))
      const [updated] = await db
        .update(sysJobs)
        .set({ status: '1' })
        .where(eq(sysJobs.jobId, jobId))
        .returning()
      return reply.send(success(updated))
    },
  )
  server.post(
    '/admin/system/tasks/:id/resume',
    { preHandler: requireAdmin },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = parseOrThrow(idParamSchema, request.params)
      const jobId = Number(id)
      const [job] = await db.select().from(sysJobs).where(eq(sysJobs.jobId, jobId)).limit(1)
      if (!job) return reply.status(404).send(error(404, '任务不存在'))
      const [updated] = await db
        .update(sysJobs)
        .set({ status: '0' })
        .where(eq(sysJobs.jobId, jobId))
        .returning()
      return reply.send(success(updated))
    },
  )
  server.get('/admin/system/tasks/logs', { preHandler: requireAdmin }, async (request, reply) => {
    const q = adminListSchema.parse(request.query ?? {})
    const page = q.page ?? 1
    const pageSize = q.pageSize ?? 20
    const offset = (page - 1) * pageSize
    const [list, countResult] = await Promise.all([
      db
        .select()
        .from(sysJobLogs)
        .orderBy(desc(sysJobLogs.createTime))
        .limit(pageSize)
        .offset(offset),
      db.select({ count: count() }).from(sysJobLogs),
    ])
    return reply.send(success({ list, total: countResult[0]?.count ?? 0, page, pageSize }))
  })
  server.post(
    '/admin/system/tasks/:id/run',
    { preHandler: requireAdmin },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = parseOrThrow(idParamSchema, request.params)
      const jobId = Number(id)
      const [job] = await db.select().from(sysJobs).where(eq(sysJobs.jobId, jobId)).limit(1)
      if (!job) return reply.status(404).send(error(404, '任务不存在'))
      const [log] = await db
        .insert(sysJobLogs)
        .values({
          jobName: job.jobName,
          jobGroup: job.jobGroup,
          invokeTarget: job.invokeTarget,
          jobMessage: '手动触发执行',
          status: '0',
        })
        .returning()
      return reply.status(201).send(success(log))
    },
  )
}
