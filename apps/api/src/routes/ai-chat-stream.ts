import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { config } from '../config/index.js'
import { authenticate } from '../plugins/auth.js'
import { error } from '../utils/response.js'

const chatStreamSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant', 'system']),
        content: z.string(),
      }),
    )
    .min(1),
  sessionId: z.string().optional(),
  modelId: z.string().optional(),
  agentId: z.string().optional(),
  materialContent: z.string().optional(),
})

async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<boolean> {
  try {
    await authenticate(request)
    return true
  } catch (e) {
    const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
    reply
      .status(statusCode)
      .send(error(statusCode, (e as Error).message || 'Authentication required'))
    return false
  }
}

export const aiChatStreamRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(await requireAuth(request, reply))) return
  })

  server.post('/chat/stream', async (request, reply) => {
    const parsed = chatStreamSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { messages, sessionId, modelId, agentId, materialContent } = parsed.data

    reply.hijack()
    const raw = reply.raw
    raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    })

    const controller = new AbortController()
    const onClose = () => controller.abort()
    request.raw.on('close', onClose)

    try {
      const resp = await fetch(`${config.AI_SERVICE_URL}/api/llm/complete/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: request.headers.authorization ?? '',
        },
        body: JSON.stringify({
          messages,
          sessionId,
          modelId,
          agentId,
          materialContent,
          metadata: { userId: request.userId },
        }),
        signal: controller.signal,
      })

      if (!resp.ok || !resp.body) {
        const errText = await resp.text().catch(() => '')
        raw.write(
          `data: ${JSON.stringify({ error: `upstream ${resp.status}: ${errText.slice(0, 200)}` })}\n\n`,
        )
        return
      }

      const reader = resp.body.getReader()
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        raw.write(value)
      }
    } catch (e) {
      const msg = (e as Error).name === 'AbortError' ? '客户端断开' : (e as Error).message
      raw.write(`data: ${JSON.stringify({ error: msg })}\n\n`)
    } finally {
      request.raw.off('close', onClose)
      raw.end()
    }
  })
}
