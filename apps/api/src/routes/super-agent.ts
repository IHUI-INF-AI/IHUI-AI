// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 超级智能体控制面。
 *
 * 登录主体从鉴权结果写入，请求体里的 actorId 必须与之相同。
 * 明确点名才开工；进度报告不出声；面板只列出要人处理的工单。
 *
 * 路径（prefix /api）:
 *   POST /super-agent/triggers
 *   GET  /super-agent/panel
 *   GET  /super-agent/replies
 *   POST /super-agent/tickets/:id/report
 *   POST /super-agent/tickets/:id/stop
 *   GET  /super-agent/tickets/:id/assignment
 *   POST /super-agent/tickets/:id/attach
 *   POST /super-agent/tickets/:id/context
 *   POST /super-agent/tickets/:id/handback
 *   POST /super-agent/tickets/:id/heartbeat
 *   GET  /super-agent/tickets/:id/lease
 *   POST /super-agent/tickets/:id/delivery-failed
 *   POST /super-agent/policy
 *   POST /super-agent/recorded/:id/accept
 *
 * 接单后占上执行槽的工人，交给既有 subagent dispatch。会话 id 只有是 uuid 才写入。
 * 工人租约：report 即心跳；另有 POST /tickets/:id/heartbeat 纯续租通道。
 */
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { workerAssignment } from '@ihui/shared/super-agent'
import { authenticate } from '../plugins/auth.js'
import { dispatchStartedWork, superAgentHost } from '../services/super-agent-pump-service.js'
import { error, success } from '../utils/response.js'

const triggerSchema = z.object({
  id: z.string().min(1).max(200),
  sourceId: z.string().min(1).max(120),
  threadId: z.string().min(1).max(200),
  actorId: z.string().min(1).max(200),
  addressed: z.boolean(),
  fromBot: z.boolean().default(false),
  text: z.string().min(1).max(8000),
})

const reportSchema = z.object({
  state: z.enum(['progress', 'waiting', 'ready', 'blocked', 'failed', 'dropped']),
  text: z.string().min(1).max(8000),
  question: z.string().min(1).max(500).optional(),
})

const stopSchema = z.object({
  reason: z.string().min(1).max(500).optional(),
})

async function requireUser(request: FastifyRequest, reply: FastifyReply): Promise<string | null> {
  try {
    await authenticate(request)
  } catch (e) {
    const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
    const message = (e as Error).message || '操作失败,请稍后重试'
    reply.status(statusCode).send(error(statusCode, message))
    return null
  }
  const userId = request.userId
  if (!userId) {
    reply.status(401).send(error(401, '操作失败,请稍后重试'))
    return null
  }
  return userId
}

async function dispatchStarted(
  _userId: string,
  threadId: string | undefined,
): Promise<{ sessionId: string; dispatchId?: string; error?: string }[]> {
  return dispatchStartedWork(threadId)
}

const policySchema = z.object({
  version: z.string().min(1).max(80),
  paused: z.boolean(),
  acceptMode: z.enum(['record', 'auto']),
  maxWorkers: z.number().int().min(1).max(20),
  workerLeaseMs: z.number().int().min(0).max(3_600_000).optional(),
  sessionIsAllowlist: z.boolean(),
  allowedActors: z.array(z.string().min(1).max(200)).optional(),
  rules: z
    .array(
      z.object({
        id: z.string().min(1).max(120),
        enabled: z.boolean(),
        revision: z.string().min(1).max(120).optional(),
      }),
    )
    .optional(),
})

export const superAgentRoutes: FastifyPluginAsync = async (server) => {
  server.post('/super-agent/triggers', async (request, reply) => {
    const userId = await requireUser(request, reply)
    if (!userId) return
    const parsed = triggerSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const result = superAgentHost.receive(parsed.data, userId)
    const dispatched = await dispatchStarted(userId, parsed.data.threadId)
    return success({ ...result, dispatched })
  })

  server.get('/super-agent/panel', async (request, reply) => {
    const userId = await requireUser(request, reply)
    if (!userId) return
    return success(superAgentHost.panel(userId))
  })

  server.post('/super-agent/tickets/:id/report', async (request, reply) => {
    const userId = await requireUser(request, reply)
    if (!userId) return
    const params = z.object({ id: z.string().min(1) }).safeParse(request.params)
    const parsed = reportSchema.safeParse(request.body)
    if (!params.success || !parsed.success) {
      return reply.status(400).send(error(400, '参数错误'))
    }
    const result = superAgentHost.report(params.data.id, userId, parsed.data)
    const threadId = superAgentHost.getTicket(params.data.id, userId)?.threadId
    const dispatched = await dispatchStarted(userId, threadId)
    return success({ ...result, dispatched })
  })

  server.post('/super-agent/tickets/:id/stop', async (request, reply) => {
    const userId = await requireUser(request, reply)
    if (!userId) return
    const params = z.object({ id: z.string().min(1) }).safeParse(request.params)
    const parsed = stopSchema.safeParse(request.body ?? {})
    if (!params.success || !parsed.success) {
      return reply.status(400).send(error(400, '参数错误'))
    }
    const threadId = superAgentHost.getTicket(params.data.id, userId)?.threadId
    const result = superAgentHost.stop(params.data.id, userId, parsed.data.reason ?? 'stopped')
    const dispatched = await dispatchStarted(userId, threadId)
    return success({ ...result, dispatched })
  })

  server.get('/super-agent/replies', async (request, reply) => {
    const userId = await requireUser(request, reply)
    if (!userId) return
    const parsed = z
      .object({ sourceId: z.string().min(1), threadId: z.string().min(1) })
      .safeParse(request.query)
    if (!parsed.success) return reply.status(400).send(error(400, '参数错误'))
    return success(superAgentHost.replies(userId, parsed.data.sourceId, parsed.data.threadId))
  })

  server.get('/super-agent/tickets/:id/assignment', async (request, reply) => {
    const userId = await requireUser(request, reply)
    if (!userId) return
    const params = z.object({ id: z.string().min(1) }).safeParse(request.params)
    if (!params.success) return reply.status(400).send(error(400, '参数错误'))
    const ticket = superAgentHost.getTicket(params.data.id, userId)
    if (!ticket) return reply.status(404).send(error(404, '工单不存在'))
    return success(workerAssignment(ticket))
  })

  server.post('/super-agent/tickets/:id/heartbeat', async (request, reply) => {
    const userId = await requireUser(request, reply)
    if (!userId) return
    const params = z.object({ id: z.string().min(1) }).safeParse(request.params)
    if (!params.success) return reply.status(400).send(error(400, '参数错误'))
    return success(superAgentHost.renewLease(userId, params.data.id))
  })

  server.get('/super-agent/tickets/:id/lease', async (request, reply) => {
    const userId = await requireUser(request, reply)
    if (!userId) return
    const params = z.object({ id: z.string().min(1) }).safeParse(request.params)
    if (!params.success) return reply.status(400).send(error(400, '参数错误'))
    const ticket = superAgentHost.getTicket(params.data.id, userId)
    if (!ticket) return reply.status(404).send(error(404, '工单不存在'))
    return success({
      remainingMs: superAgentHost.leaseRemaining(params.data.id, userId),
      lostLeaseCount: ticket.lostLeaseCount,
      leaseLostAt: ticket.leaseLostAt,
    })
  })

  server.post('/super-agent/tickets/:id/attach', async (request, reply) => {
    const userId = await requireUser(request, reply)
    if (!userId) return
    const params = z.object({ id: z.string().min(1) }).safeParse(request.params)
    const parsed = triggerSchema.safeParse(request.body)
    if (!params.success || !parsed.success) return reply.status(400).send(error(400, '参数错误'))
    const result = superAgentHost.attach(userId, params.data.id, parsed.data)
    const dispatched = await dispatchStarted(userId, parsed.data.threadId)
    return success({ ...result, dispatched })
  })

  server.post('/super-agent/tickets/:id/context', async (request, reply) => {
    const userId = await requireUser(request, reply)
    if (!userId) return
    const params = z.object({ id: z.string().min(1) }).safeParse(request.params)
    const parsed = z
      .object({ sourceId: z.string().min(1), threadId: z.string().min(1) })
      .safeParse(request.body)
    if (!params.success || !parsed.success) return reply.status(400).send(error(400, '参数错误'))
    return success(
      superAgentHost.followForContext(
        userId,
        params.data.id,
        parsed.data.sourceId,
        parsed.data.threadId,
      ),
    )
  })

  server.post('/super-agent/tickets/:id/handback', async (request, reply) => {
    const userId = await requireUser(request, reply)
    if (!userId) return
    const params = z.object({ id: z.string().min(1) }).safeParse(request.params)
    const parsed = z
      .object({ triggerId: z.string().min(1), reason: z.string().min(1).max(500) })
      .safeParse(request.body)
    if (!params.success || !parsed.success) return reply.status(400).send(error(400, '参数错误'))
    return success(
      superAgentHost.handback(userId, params.data.id, parsed.data.triggerId, parsed.data.reason),
    )
  })

  server.post('/super-agent/tickets/:id/delivery-failed', async (request, reply) => {
    const userId = await requireUser(request, reply)
    if (!userId) return
    const params = z.object({ id: z.string().min(1) }).safeParse(request.params)
    const parsed = z.object({ error: z.string().min(1).max(500) }).safeParse(request.body)
    if (!params.success || !parsed.success) return reply.status(400).send(error(400, '参数错误'))
    return success(superAgentHost.deliveryFailed(userId, params.data.id, parsed.data.error))
  })

  server.post('/super-agent/policy', async (request, reply) => {
    const userId = await requireUser(request, reply)
    if (!userId) return
    const parsed = policySchema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send(error(400, '参数错误'))
    return success({ notified: superAgentHost.applyPolicy(userId, parsed.data) })
  })

  server.post('/super-agent/recorded/:id/accept', async (request, reply) => {
    const userId = await requireUser(request, reply)
    if (!userId) return
    const params = z.object({ id: z.string().min(1) }).safeParse(request.params)
    const parsed = z
      .object({
        ruleId: z.string().min(1).max(120),
        routerNotes: z.string().max(8000).optional(),
      })
      .safeParse(request.body)
    if (!params.success || !parsed.success) return reply.status(400).send(error(400, '参数错误'))
    const result = superAgentHost.acceptRecorded(
      userId,
      params.data.id,
      parsed.data.ruleId,
      parsed.data.routerNotes ?? '',
    )
    const threadId = result.ticketId
      ? superAgentHost.getTicket(result.ticketId, userId)?.threadId
      : undefined
    const dispatched = await dispatchStarted(userId, threadId)
    return success({ ...result, dispatched })
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
