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
 *   POST /super-agent/tickets/:id/delivery-failed
 *   POST /super-agent/policy
 *   POST /super-agent/recorded/:id/accept
 *
 * 接单后占上执行槽的工人，交给既有 subagent dispatch。会话 id 只有是 uuid 才写入。
 */
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { SuperAgentHost, workerAssignment } from '@ihui/shared/super-agent'
import { authenticate } from '../plugins/auth.js'
import { subagentDispatchService } from '../services/subagent-dispatch-service.js'
import { error, success } from '../utils/response.js'

const host = new SuperAgentHost()

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

function conversationIdOf(threadId: string | undefined): string | undefined {
  if (!threadId) return undefined
  const parsed = z.string().uuid().safeParse(threadId)
  return parsed.success ? parsed.data : undefined
}

async function dispatchStarted(
  userId: string,
  threadId: string | undefined,
): Promise<{ sessionId: string; dispatchId?: string; error?: string }[]> {
  const started = host.takeStarted()
  const conversationId = conversationIdOf(threadId)
  const dispatched: { sessionId: string; dispatchId?: string; error?: string }[] = []
  for (const work of started) {
    try {
      const result = await subagentDispatchService.dispatch({
        goal: work.goal,
        affectedFiles: [],
        verifyCommands: [],
        constraints: work.constraints,
        deliverables: work.deliverables,
        agentRole: 'coder',
        ownerUserId: userId,
        ...(conversationId ? { conversationId } : {}),
      })
      dispatched.push({
        sessionId: work.sessionId,
        dispatchId: result.dispatch?.id,
        error: result.outcome === 'ok' ? undefined : (result.error ?? result.outcome),
      })
    } catch (e) {
      dispatched.push({
        sessionId: work.sessionId,
        error: e instanceof Error ? e.message : 'dispatch_failed',
      })
    }
  }
  return dispatched
}

const policySchema = z.object({
  version: z.string().min(1).max(80),
  paused: z.boolean(),
  acceptMode: z.enum(['record', 'auto']),
  maxWorkers: z.number().int().min(1).max(20),
  sessionIsAllowlist: z.boolean(),
})

export const superAgentRoutes: FastifyPluginAsync = async (server) => {
  server.post('/super-agent/triggers', async (request, reply) => {
    const userId = await requireUser(request, reply)
    if (!userId) return
    const parsed = triggerSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const result = host.receive(parsed.data, userId)
    const dispatched = await dispatchStarted(userId, parsed.data.threadId)
    return success({ ...result, dispatched })
  })

  server.get('/super-agent/panel', async (request, reply) => {
    const userId = await requireUser(request, reply)
    if (!userId) return
    return success(host.panel(userId))
  })

  server.post('/super-agent/tickets/:id/report', async (request, reply) => {
    const userId = await requireUser(request, reply)
    if (!userId) return
    const params = z.object({ id: z.string().min(1) }).safeParse(request.params)
    const parsed = reportSchema.safeParse(request.body)
    if (!params.success || !parsed.success) {
      return reply.status(400).send(error(400, '参数错误'))
    }
    const result = host.report(params.data.id, userId, parsed.data)
    const threadId = host.getTicket(params.data.id, userId)?.threadId
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
    const threadId = host.getTicket(params.data.id, userId)?.threadId
    const result = host.stop(params.data.id, userId, parsed.data.reason ?? 'stopped')
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
    return success(host.replies(userId, parsed.data.sourceId, parsed.data.threadId))
  })

  server.get('/super-agent/tickets/:id/assignment', async (request, reply) => {
    const userId = await requireUser(request, reply)
    if (!userId) return
    const params = z.object({ id: z.string().min(1) }).safeParse(request.params)
    if (!params.success) return reply.status(400).send(error(400, '参数错误'))
    const ticket = host.getTicket(params.data.id, userId)
    if (!ticket) return reply.status(404).send(error(404, '工单不存在'))
    return success(workerAssignment(ticket))
  })

  server.post('/super-agent/tickets/:id/attach', async (request, reply) => {
    const userId = await requireUser(request, reply)
    if (!userId) return
    const params = z.object({ id: z.string().min(1) }).safeParse(request.params)
    const parsed = triggerSchema.safeParse(request.body)
    if (!params.success || !parsed.success) return reply.status(400).send(error(400, '参数错误'))
    const result = host.attach(userId, params.data.id, parsed.data)
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
      host.followForContext(userId, params.data.id, parsed.data.sourceId, parsed.data.threadId),
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
    return success(host.handback(userId, params.data.id, parsed.data.triggerId, parsed.data.reason))
  })

  server.post('/super-agent/tickets/:id/delivery-failed', async (request, reply) => {
    const userId = await requireUser(request, reply)
    if (!userId) return
    const params = z.object({ id: z.string().min(1) }).safeParse(request.params)
    const parsed = z.object({ error: z.string().min(1).max(500) }).safeParse(request.body)
    if (!params.success || !parsed.success) return reply.status(400).send(error(400, '参数错误'))
    return success(host.deliveryFailed(userId, params.data.id, parsed.data.error))
  })

  server.post('/super-agent/policy', async (request, reply) => {
    const userId = await requireUser(request, reply)
    if (!userId) return
    const parsed = policySchema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send(error(400, '参数错误'))
    return success({ notified: host.applyPolicy(userId, parsed.data) })
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
    const result = host.acceptRecorded(
      userId,
      params.data.id,
      parsed.data.ruleId,
      parsed.data.routerNotes ?? '',
    )
    const threadId = result.ticketId ? host.getTicket(result.ticketId, userId)?.threadId : undefined
    const dispatched = await dispatchStarted(userId, threadId)
    return success({ ...result, dispatched })
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
