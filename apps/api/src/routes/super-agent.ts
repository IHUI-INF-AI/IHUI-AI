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
 *   POST /super-agent/tickets/:id/report
 *   POST /super-agent/tickets/:id/stop
 */
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { SuperAgentHost } from '@ihui/shared/super-agent'
import { authenticate } from '../plugins/auth.js'
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

export const superAgentRoutes: FastifyPluginAsync = async (server) => {
  server.post('/super-agent/triggers', async (request, reply) => {
    const userId = await requireUser(request, reply)
    if (!userId) return
    const parsed = triggerSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    return success(host.receive(parsed.data, userId))
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
    return success(host.report(params.data.id, userId, parsed.data))
  })

  server.post('/super-agent/tickets/:id/stop', async (request, reply) => {
    const userId = await requireUser(request, reply)
    if (!userId) return
    const params = z.object({ id: z.string().min(1) }).safeParse(request.params)
    const parsed = stopSchema.safeParse(request.body ?? {})
    if (!params.success || !parsed.success) {
      return reply.status(400).send(error(400, '参数错误'))
    }
    return success(host.stop(params.data.id, userId, parsed.data.reason ?? 'stopped'))
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
