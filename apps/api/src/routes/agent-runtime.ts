import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { authenticate } from '../plugins/auth.js'
import { success, error } from '../utils/response.js'
import { SessionManager } from '../services/clawdbot/session-manager.js'
import {
  parsePermissionMode,
  checkPermissionMode,
  type DangerLevel,
} from '../services/clawdbot/permission-guard.js'

const sessionManager = new SessionManager()

const executeSchema = z.object({
  message: z.string().min(1),
  mode: z.string().optional().default('default'),
  sessionId: z.string().optional(),
  botId: z.string().optional(),
})

export const agentRuntimeRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', async (request) => {
    await authenticate(request)
  })

  app.post('/execute', async (req, reply) => {
    const parsed = executeSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send(error(400, 'invalid body'))
    }
    const { message, mode, sessionId, botId } = parsed.data
    const permMode = parsePermissionMode(mode) ?? 'default'
    let session
    if (sessionId) {
      try {
        session = sessionManager.get(sessionId)
      } catch {
        return reply.code(404).send(error(404, 'session not found'))
      }
    } else {
      session = sessionManager.create(botId ?? 'default', req.userId ?? 'anonymous')
    }
    sessionManager.appendMessage(session.id, { role: 'user', content: message })
    return success({ sessionId: session.id, mode: permMode, received: message })
  })

  app.post('/execute/stream', async (req, reply) => {
    reply.raw.setHeader('Content-Type', 'text/event-stream')
    reply.raw.setHeader('Cache-Control', 'no-cache')
    reply.raw.setHeader('Connection', 'keep-alive')
    const parsed = executeSchema.safeParse(req.body)
    if (!parsed.success) {
      reply.raw.write(`event: error\ndata: ${JSON.stringify({ message: 'invalid body' })}\n\n`)
      return reply.raw.end()
    }
    const { message, mode, sessionId } = parsed.data
    const permMode = parsePermissionMode(mode) ?? 'default'
    let session
    if (sessionId) {
      try {
        session = sessionManager.get(sessionId)
      } catch {
        reply.raw.write(
          `event: error\ndata: ${JSON.stringify({ message: 'session not found' })}\n\n`,
        )
        return reply.raw.end()
      }
    } else {
      session = sessionManager.create('default', req.userId ?? 'anonymous')
    }
    sessionManager.appendMessage(session.id, { role: 'user', content: message })
    reply.raw.write(`event: session\ndata: ${JSON.stringify({ sessionId: session.id })}\n\n`)
    reply.raw.write(
      `event: permission\ndata: ${JSON.stringify({ mode: permMode, decision: 'allow' })}\n\n`,
    )
    reply.raw.write(
      `event: done\ndata: ${JSON.stringify({ sessionId: session.id, status: 'streaming-placeholder' })}\n\n`,
    )
    return reply.raw.end()
  })

  app.get('/sessions', async (req) => {
    const { limit = '20', offset = '0' } = req.query as { limit?: string; offset?: string }
    const list = sessionManager.listActive()
    const start = Math.max(0, parseInt(offset, 10) || 0)
    const end = start + (parseInt(limit, 10) || 20)
    return success({ sessions: list.slice(start, end), total: list.length })
  })

  app.get('/sessions/:sessionId', async (req, reply) => {
    const { sessionId } = req.params as { sessionId: string }
    try {
      const session = sessionManager.get(sessionId)
      return success(session)
    } catch {
      return reply.code(404).send(error(404, 'session not found'))
    }
  })

  app.post('/sessions/:sessionId/resume', async (req, reply) => {
    const { sessionId } = req.params as { sessionId: string }
    try {
      sessionManager.resume(sessionId)
      return success({ sessionId, status: 'running' })
    } catch {
      return reply.code(404).send(error(404, 'session not found'))
    }
  })

  app.get('/:sessionId/status', async (req, reply) => {
    const { sessionId } = req.params as { sessionId: string }
    try {
      const session = sessionManager.get(sessionId)
      return success({
        sessionId: session.id,
        status: session.status,
        messageCount: session.context.messages.length,
      })
    } catch {
      return reply.code(404).send(error(404, 'session not found'))
    }
  })

  app.post('/:sessionId/cancel', async (req, reply) => {
    const { sessionId } = req.params as { sessionId: string }
    try {
      sessionManager.get(sessionId)
      sessionManager.close(sessionId)
      return success({ sessionId, status: 'cancelled' })
    } catch {
      return reply.code(404).send(error(404, 'session not found'))
    }
  })

  app.get('/permission/check', async (req) => {
    const { toolName, mode = 'default', dangerLevel = 'read' } = req.query as {
      toolName: string
      mode?: string
      dangerLevel?: string
    }
    const permMode = parsePermissionMode(mode) ?? 'default'
    const decision = checkPermissionMode(
      toolName,
      permMode,
      (dangerLevel as DangerLevel) ?? 'read',
    )
    return success({ toolName, mode: permMode, dangerLevel, decision })
  })
}
