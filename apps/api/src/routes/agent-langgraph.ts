/**
 * LangGraph Agent 路由(P3 Q1.8)。
 *
 * 4 个 REST 端点 + 1 个 SSE 流式端点,前缀 /agent-langgraph(避开现有 /agent 路由)。
 * 作为 web ↔ ai-service LangGraph 中间层,转发到 ai-service `/api/langgraph/*`。
 *
 * 端点:
 *  - POST /:threadId/interrupt  触发节点暂停
 *  - POST /:threadId/resume     恢复执行(resume / rollback / cancel)
 *  - GET  /:threadId/state      查询线程 checkpoint 状态
 *  - GET  /:threadId/history    查询历史(Time Travel)
 *  - GET  /:threadId/stream     SSE 流式输出(浏览器 EventSource 兼容)
 */

import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { requireAuth } from '../plugins/require-permission.js'
import { success, error } from '../utils/response.js'
import {
  triggerInterrupt,
  resumeExecution,
  getThreadState,
  getThreadHistory,
  streamAgentExecution,
} from '../services/langgraph-proxy.js'
import type { SSEEvent } from '@ihui/types'

const interruptSchema = z.object({
  nodeId: z.string().min(1),
  reason: z.string().min(1),
  payload: z.unknown().optional(),
})

const resumeSchema = z.object({
  interruptId: z.string().min(1),
  resumeValue: z.unknown().optional(),
  action: z.enum(['resume', 'rollback', 'cancel']).default('resume'),
})

/** stream 端点的 query:input 为 JSON 编码的 graphInput(浏览器 EventSource 只支持 GET + query) */
const streamQuerySchema = z.object({
  input: z.string().optional(),
})

export const agentLanggraphRoutes: FastifyPluginAsync = async (server) => {
  // POST /:threadId/interrupt — 触发节点暂停
  server.post('/:threadId/interrupt', async (request, reply) => {
    await requireAuth(request, reply)
    if (reply.sent) return
    const { threadId } = request.params as { threadId: string }
    const parsed = interruptSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    try {
      const result = await triggerInterrupt(
        request,
        threadId,
        parsed.data.nodeId,
        parsed.data.reason,
        parsed.data.payload,
      )
      return reply.send(success(result))
    } catch (e) {
      request.log.error({ err: e, threadId }, 'langgraph interrupt failed')
      return reply.status(502).send(error(502, (e as Error).message))
    }
  })

  // POST /:threadId/resume — 恢复执行
  server.post('/:threadId/resume', async (request, reply) => {
    await requireAuth(request, reply)
    if (reply.sent) return
    const { threadId } = request.params as { threadId: string }
    const parsed = resumeSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    try {
      const result = await resumeExecution(request, {
        threadId,
        interruptId: parsed.data.interruptId,
        resumeValue: parsed.data.resumeValue,
        action: parsed.data.action,
      })
      return reply.send(success(result))
    } catch (e) {
      request.log.error({ err: e, threadId }, 'langgraph resume failed')
      return reply.status(502).send(error(502, (e as Error).message))
    }
  })

  // GET /:threadId/state — 查询线程 checkpoint 状态
  server.get('/:threadId/state', async (request, reply) => {
    await requireAuth(request, reply)
    if (reply.sent) return
    const { threadId } = request.params as { threadId: string }
    try {
      const result = await getThreadState(request, threadId)
      return reply.send(success(result))
    } catch (e) {
      request.log.error({ err: e, threadId }, 'langgraph get state failed')
      return reply.status(502).send(error(502, (e as Error).message))
    }
  })

  // GET /:threadId/history — 查询历史(Time Travel)
  server.get('/:threadId/history', async (request, reply) => {
    await requireAuth(request, reply)
    if (reply.sent) return
    const { threadId } = request.params as { threadId: string }
    const { limit } = request.query as { limit?: number }
    const safeLimit =
      typeof limit === 'number' && Number.isFinite(limit) && limit > 0
        ? Math.min(Math.floor(limit), 1000)
        : 100
    try {
      const result = await getThreadHistory(request, threadId, safeLimit)
      return reply.send(success(result))
    } catch (e) {
      request.log.error({ err: e, threadId }, 'langgraph get history failed')
      return reply.status(502).send(error(502, (e as Error).message))
    }
  })

  // GET /:threadId/stream — SSE 流式输出(浏览器 EventSource 兼容)
  // graphInput 通过 query `input`(JSON 编码)传入;缺失时传空对象(续流场景)
  server.get('/:threadId/stream', async (request, reply) => {
    await requireAuth(request, reply)
    if (reply.sent) return
    const { threadId } = request.params as { threadId: string }
    const parsed = streamQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }

    // 解析 graphInput(JSON 编码的 query 参数)
    let graphInput: Record<string, unknown> = {}
    if (parsed.data.input) {
      try {
        const decoded = JSON.parse(parsed.data.input)
        if (decoded && typeof decoded === 'object' && !Array.isArray(decoded)) {
          graphInput = decoded as Record<string, unknown>
        } else {
          return reply.status(400).send(error(400, 'input 必须是 JSON 对象'))
        }
      } catch {
        return reply.status(400).send(error(400, 'input 不是合法 JSON'))
      }
    }

    // hijack 接管原始响应,SSE 头 + 流式写入
    reply.hijack()
    const raw = reply.raw
    raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    })

    // 客户端断连 → abort 上游 fetch,避免 ai-service token 浪费
    const controller = new AbortController()
    const onClose = () => controller.abort()
    request.raw.on('close', onClose)

    const writeEvent = (evt: SSEEvent): void => {
      raw.write(`data: ${JSON.stringify(evt)}\n\n`)
    }

    try {
      for await (const evt of streamAgentExecution(request, threadId, graphInput, controller.signal)) {
        if (raw.writableEnded) break
        writeEvent(evt)
      }
    } catch (e) {
      if (!raw.writableEnded) {
        const msg =
          (e as Error).name === 'AbortError' ? '客户端断开' : (e as Error).message
        writeEvent({
          type: 'error',
          threadId,
          data: { message: msg },
          timestamp: new Date().toISOString(),
        })
      }
    } finally {
      request.raw.off('close', onClose)
      if (!raw.writableEnded) raw.end()
    }
  })
}
