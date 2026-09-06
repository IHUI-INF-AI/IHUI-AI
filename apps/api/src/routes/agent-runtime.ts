// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { authenticate } from '../plugins/auth.js'
import { success, error } from '../utils/response.js'
import { aiServiceFetchStream } from '../utils/ai-service-fetch.js'
import { SessionManager } from '../services/clawdbot/session-manager.js'
import {
  parsePermissionMode,
  checkPermissionMode,
  type DangerLevel,
} from '../services/clawdbot/permission-guard.js'
import {
  persistSession,
  loadSessionFromDb,
  listPersistedSessions,
} from '../services/agent-runtime/session-store.js'
import type { Session } from '../services/clawdbot/session-manager.js'

const sessionManager = new SessionManager()

// 会话解析:内存命中 → 内存 miss 时从 DB 惰性恢复(重启不丢上下文,P0 修复)
async function resolveSession(sessionId: string): Promise<Session> {
  try {
    return sessionManager.get(sessionId)
  } catch {
    // fall through: 内存未命中,尝试 DB 恢复
  }
  const restored = await loadSessionFromDb(sessionId)
  if (!restored) {
    throw new Error(`会话不存在: ${sessionId}`)
  }
  sessionManager.adopt(restored)
  return restored
}

// 追加用户消息并写透 DB(失败自动降级内存,不打断对话流)
function appendMessageAndPersist(sessionId: string, content: string): void {
  sessionManager.appendMessage(sessionId, { role: 'user', content })
  const session = sessionManager.get(sessionId)
  void persistSession(session)
}

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
    let session: Session
    if (sessionId) {
      try {
        session = await resolveSession(sessionId)
      } catch {
        return reply.code(404).send(error(404, '会话不存在'))
      }
    } else {
      session = sessionManager.create(botId ?? 'default', req.userId ?? 'anonymous')
      void persistSession(session)
    }
    appendMessageAndPersist(session.id, message)
    return success({ sessionId: session.id, mode: permMode, received: message })
  })

  app.post(
    '/execute/stream',
    {
      config: {
        rateLimit: {
          max: 20,
          timeWindow: '1 minute',
        },
      },
    },
    async (req, reply) => {
      reply.raw.setHeader('Content-Type', 'text/event-stream')
      reply.raw.setHeader('Cache-Control', 'no-cache')
      reply.raw.setHeader('Connection', 'keep-alive')
      reply.raw.setHeader('X-Accel-Buffering', 'no')
      const parsed = executeSchema.safeParse(req.body)
      if (!parsed.success) {
        reply.raw.write(`event: error\ndata: ${JSON.stringify({ message: '请求参数无效' })}\n\n`)
        return reply.raw.end()
      }
      const { message, mode, sessionId, botId } = parsed.data
      const permMode = parsePermissionMode(mode) ?? 'default'
      let session: Session
      if (sessionId) {
        try {
          session = await resolveSession(sessionId)
        } catch {
          reply.raw.write(`event: error\ndata: ${JSON.stringify({ message: '会话不存在' })}\n\n`)
          return reply.raw.end()
        }
      } else {
        session = sessionManager.create(botId ?? 'default', req.userId ?? 'anonymous')
        void persistSession(session)
      }
      appendMessageAndPersist(session.id, message)

      // G9: 客户端断连检测,中途中断 upstream fetch,避免 LLM token 浪费
      const controller = new AbortController()
      const onClose = () => controller.abort()
      req.raw.on('close', onClose)

      try {
        const upstream = await aiServiceFetchStream(req, '/api/agent-runtime/execute/stream', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
          },
          body: JSON.stringify({ message, mode: permMode, sessionId: session.id, botId }),
          signal: controller.signal,
        })

        if (!upstream.ok || !upstream.body) {
          reply.raw.write(
            `event: error\ndata: ${JSON.stringify({ message: `上游服务异常(状态码 ${upstream.status})` })}\n\n`,
          )
          return reply.raw.end()
        }

        const reader = upstream.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const events = buffer.split('\n\n')
          buffer = events.pop() ?? ''
          for (const evt of events) {
            const trimmed = evt.trim()
            if (!trimmed) continue
            if (trimmed.startsWith('event: permission')) {
              const dataMatch = trimmed.match(/^data: (.+)$/m)
              const dataStr = dataMatch?.[1]
              if (dataStr) {
                try {
                  const data = JSON.parse(dataStr) as Record<string, unknown>
                  const toolName = typeof data.toolName === 'string' ? data.toolName : 'unknown'
                  const dangerLevel = (
                    typeof data.dangerLevel === 'string' ? data.dangerLevel : 'read'
                  ) as DangerLevel
                  const decision = checkPermissionMode(toolName, permMode, dangerLevel)
                  reply.raw.write(
                    `event: permission\ndata: ${JSON.stringify({
                      ...data,
                      mode: permMode,
                      decision,
                    })}\n\n`,
                  )
                  continue
                } catch {
                  // 解析失败,透传原事件
                }
              }
            }
            reply.raw.write(`${trimmed}\n\n`)
          }
        }
        if (buffer.trim()) {
          reply.raw.write(`${buffer.trim()}\n\n`)
        }
        return reply.raw.end()
      } catch (err) {
        // G9: 客户端主动断开是正常行为,不写 error 事件,仅记录日志
        if ((err as Error).name === 'AbortError') {
          req.log.info({ sessionId: session.id }, '[agent-runtime] 客户端断开,中止 upstream fetch')
          return
        }
        reply.raw.write(
          `event: error\ndata: ${JSON.stringify({
            message: '上游连接失败',
            error: String(err),
          })}\n\n`,
        )
        return reply.raw.end()
      } finally {
        // G9: 清理 close listener,避免泄漏
        req.raw.off('close', onClose)
      }
    },
  )

  app.get('/sessions', async (req) => {
    const { limit = '20', offset = '0' } = req.query as { limit?: string; offset?: string }
    // 内存会话 + DB 持久化会话合并(重启后内存为空,列表仍完整;按 id 去重,内存态优先)
    const [memoryList, persisted] = await Promise.all([
      Promise.resolve(sessionManager.listActive()),
      listPersistedSessions(),
    ])
    const seen = new Set(memoryList.map((s) => s.id))
    const merged = [...memoryList, ...persisted.filter((s) => !seen.has(s.id))]
    const start = Math.max(0, parseInt(offset, 10) || 0)
    const end = start + (parseInt(limit, 10) || 20)
    return success({ sessions: merged.slice(start, end), total: merged.length })
  })

  app.get('/sessions/:sessionId', async (req, reply) => {
    const { sessionId } = req.params as { sessionId: string }
    try {
      const session = await resolveSession(sessionId)
      return success(session)
    } catch {
      return reply.code(404).send(error(404, '会话不存在'))
    }
  })

  app.post('/sessions/:sessionId/resume', async (req, reply) => {
    const { sessionId } = req.params as { sessionId: string }
    try {
      const session = await resolveSession(sessionId)
      sessionManager.resume(sessionId)
      void persistSession(session)
      return success({ sessionId, status: 'running' })
    } catch {
      return reply.code(404).send(error(404, '会话不存在'))
    }
  })

  app.get('/:sessionId/status', async (req, reply) => {
    const { sessionId } = req.params as { sessionId: string }
    try {
      const session = await resolveSession(sessionId)
      return success({
        sessionId: session.id,
        status: session.status,
        messageCount: session.context.messages.length,
      })
    } catch {
      return reply.code(404).send(error(404, '会话不存在'))
    }
  })

  app.post('/:sessionId/cancel', async (req, reply) => {
    const { sessionId } = req.params as { sessionId: string }
    try {
      const session = await resolveSession(sessionId)
      sessionManager.close(sessionId)
      void persistSession(session)
      return success({ sessionId, status: 'cancelled' })
    } catch {
      return reply.code(404).send(error(404, '会话不存在'))
    }
  })

  app.get('/permission/check', async (req) => {
    const {
      toolName,
      mode = 'default',
      dangerLevel = 'read',
    } = req.query as {
      toolName: string
      mode?: string
      dangerLevel?: string
    }
    const permMode = parsePermissionMode(mode) ?? 'default'
    const decision = checkPermissionMode(toolName, permMode, (dangerLevel as DangerLevel) ?? 'read')
    return success({ toolName, mode: permMode, dangerLevel, decision })
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
