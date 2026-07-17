import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { repairMessages } from '@ihui/types'
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
  model: z.string().optional(),
  modelId: z.string().optional(), // 向后兼容,优先使用 model
  agentId: z.string().optional(),
  materialContent: z.string().optional(),
  metadata: z
    .object({
      conversationId: z.string().optional(),
      userId: z.string().optional(),
      messageId: z.string().optional(),
    })
    .optional(),
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
    const {
      messages: rawMessages,
      sessionId,
      model,
      modelId,
      agentId,
      materialContent,
      metadata,
    } = parsed.data
    const resolvedModel = model ?? modelId

    // P38 跨端同步:修复 messages 结构异常(非法 role/空 content/连续重复/开头 assistant/末尾无响应 user)
    // 共享函数 @ihui/types/message-repair,与 CLI repairSessionHistory / ai-service repair_messages 同源
    const { repaired: messages, removed: repairRemoved } = repairMessages(rawMessages)

    reply.hijack()
    const raw = reply.raw
    raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    })

    // 若发生修复,通过 SSE 首事件通知前端(对标 CLI /repair 命令的可见性)
    if (repairRemoved > 0) {
      raw.write(`data: ${JSON.stringify({ repair: { removed: repairRemoved } })}\n\n`)
    }

    const controller = new AbortController()
    const onClose = () => controller.abort()
    request.raw.on('close', onClose)

    try {
      // 合并 metadata:客户端传入的 conversationId/messageId + 服务端的 userId
      const mergedMetadata = {
        conversationId: metadata?.conversationId,
        userId: metadata?.userId ?? request.userId,
        messageId: metadata?.messageId,
      }
      const resp = await fetch(`${config.AI_SERVICE_URL}/api/llm/complete/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: request.headers.authorization ?? '',
        },
        body: JSON.stringify({
          messages,
          sessionId,
          model: resolvedModel,
          agentId,
          materialContent,
          metadata: mergedMetadata,
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
