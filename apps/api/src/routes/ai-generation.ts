import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { authenticate } from '../plugins/auth.js'
import { success, error, emptyToUndefined } from '../utils/response.js'
import {
  enqueue,
  getStatus,
  cancel,
  listByUser,
  getQueueStats,
} from '../services/ai/generation-queue-service.js'

const ADMIN_ROLE_ID = 1

const JOB_STATES = [
  'completed',
  'failed',
  'delayed',
  'active',
  'waiting',
  'waiting-children',
  'prioritized',
] as const

const enqueueSchema = z.object({
  taskId: z.string().min(1, 'taskId 不能为空'),
  type: z.enum(['text', 'image', 'video', 'audio', 'multimodal']),
  userId: z.string().min(1, 'userId 不能为空'),
  prompt: z.string().min(1, 'prompt 不能为空'),
  modelId: z.string().min(1, 'modelId 不能为空'),
  params: z.record(z.string(), z.unknown()).default({}),
  callbackUrl: z.string().url().optional(),
  priority: z.enum(['high', 'normal', 'low']).optional(),
  dedupeWindowMs: z.number().int().positive().optional(),
})

const jobIdParamSchema = z.object({ jobId: z.string().min(1, 'jobId 不能为空') })
const userIdParamSchema = z.object({ userId: z.string().min(1, 'userId 不能为空') })

const listByUserQuerySchema = z.object({
  status: z.preprocess(emptyToUndefined, z.enum(JOB_STATES).optional()),
  limit: z.coerce.number().int().min(1).max(200).optional(),
})

const plugin: FastifyPluginAsync = async (server) => {
  // 统一鉴权：所有 generation 路由均需登录
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await authenticate(request)
    } catch (e) {
      const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
      return reply
        .status(statusCode)
        .send(error(statusCode, (e as Error).message || 'Authentication required'))
    }
  })

  // POST /ai/generation/enqueue — 入队生成任务
  server.post('/ai/generation/enqueue', async (req, reply) => {
    const parsed = enqueueSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { priority, dedupeWindowMs, ...data } = parsed.data
    try {
      const jobId = await enqueue(data, priority ?? 'normal', dedupeWindowMs)
      return reply.status(202).send(success({ jobId, queued: true }))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '入队失败'))
    }
  })

  // GET /ai/generation/:jobId/status — 查询任务状态
  server.get('/ai/generation/:jobId/status', async (req, reply) => {
    const parsed = jobIdParamSchema.safeParse(req.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    try {
      const status = await getStatus(parsed.data.jobId)
      if (!status) return reply.status(404).send(error(404, '任务不存在'))
      return reply.send(success(status))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '查询状态失败'))
    }
  })

  // DELETE /ai/generation/:jobId — 取消任务
  server.delete('/ai/generation/:jobId', async (req, reply) => {
    const parsed = jobIdParamSchema.safeParse(req.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    try {
      const removed = await cancel(parsed.data.jobId)
      if (!removed) return reply.status(404).send(error(404, '任务不存在'))
      return reply.send(success({ jobId: parsed.data.jobId, canceled: true }))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '取消任务失败'))
    }
  })

  // GET /ai/generation/user/:userId — 列出用户最近任务
  server.get('/ai/generation/user/:userId', async (req, reply) => {
    const paramsParsed = userIdParamSchema.safeParse(req.params)
    if (!paramsParsed.success) {
      return reply.status(400).send(error(400, paramsParsed.error.issues[0]?.message ?? '参数错误'))
    }
    const queryParsed = listByUserQuerySchema.safeParse(req.query)
    if (!queryParsed.success) {
      return reply.status(400).send(error(400, queryParsed.error.issues[0]?.message ?? '参数错误'))
    }
    try {
      const jobs = await listByUser(
        paramsParsed.data.userId,
        queryParsed.data.status,
        queryParsed.data.limit ?? 50,
      )
      const list = jobs.map((j) => ({
        jobId: j.id,
        data: j.data,
        progress: j.progress,
        result: j.returnvalue,
        failedReason: j.failedReason,
      }))
      return reply.send(success({ list, total: list.length }))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '查询用户任务失败'))
    }
  })

  // GET /ai/generation/stats — 队列统计（管理员）
  server.get('/ai/generation/stats', async (req, reply) => {
    const roleId = req.jwtPayload?.roleId ?? 0
    if (roleId < ADMIN_ROLE_ID) {
      return reply.status(403).send(error(403, '需要管理员权限'))
    }
    try {
      const stats = await getQueueStats()
      return reply.send(success(stats))
    } catch (e) {
      req.log.error(e)
      return reply.status(500).send(error(500, '查询队列统计失败'))
    }
  })
}

export default plugin
