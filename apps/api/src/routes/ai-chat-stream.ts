import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { repairMessages } from '@ihui/types'
import { compressContextIfNeeded, type ChatMessage } from '@ihui/context-compaction'
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
  /** 当前绑定的本地工作区路径,透传到 ai-service 用于注入项目记忆(CLAUDE.md/AGENTS.md) */
  workspacePath: z.string().optional(),
  /** 模型上下文窗口大小(tokens),达 88% 阈值自动压缩。0 或不传 = 不压缩 */
  contextLimit: z.number().int().min(0).max(2_000_000).optional(),
  metadata: z
    .object({
      conversationId: z.string().optional(),
      userId: z.string().optional(),
      messageId: z.string().optional(),
    })
    .optional(),
})

// AI 主动提问用户回答接口:接收 questionId + answer + 历史消息,把 answer 追加为 user 消息后继续生成
const chatAnswerSchema = chatStreamSchema.extend({
  questionId: z.string().min(1),
  answer: z.string().min(1),
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

  // 共享的 SSE 流式转发逻辑:/chat/stream 和 /chat/answer 共用
  // messages 已是最终列表(已 repair + 已压缩 + 已追加 answer),直接透传到 ai-service
  async function streamToClient(
    request: FastifyRequest,
    reply: FastifyReply,
    finalMessages: ChatMessage[],
    opts: {
      sessionId?: string
      resolvedModel?: string
      agentId?: string
      materialContent?: string
      workspacePath?: string
      contextLimit?: number
      metadata?: { conversationId?: string; userId?: string; messageId?: string }
    },
    extraFirstEvents: Array<{ key: string; payload: unknown }> = [],
  ): Promise<void> {
    reply.hijack()
    const raw = reply.raw
    raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    })

    // 首事件:修复通知 / 压缩通知 / resumed 通知等
    for (const evt of extraFirstEvents) {
      raw.write(`data: ${JSON.stringify({ [evt.key]: evt.payload })}\n\n`)
    }

    const controller = new AbortController()
    const onClose = () => controller.abort()
    request.raw.on('close', onClose)

    try {
      const mergedMetadata = {
        conversationId: opts.metadata?.conversationId,
        userId: opts.metadata?.userId ?? request.userId,
        messageId: opts.metadata?.messageId,
      }
      const resp = await fetch(`${config.AI_SERVICE_URL}/api/llm/complete/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: request.headers.authorization ?? '',
        },
        body: JSON.stringify({
          messages: finalMessages,
          sessionId: opts.sessionId,
          model: opts.resolvedModel,
          agentId: opts.agentId,
          materialContent: opts.materialContent,
          workspacePath: opts.workspacePath,
          contextLimit: opts.contextLimit ?? 0,
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
  }

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
      workspacePath,
      contextLimit,
      metadata,
    } = parsed.data
    const resolvedModel = model ?? modelId

    // P38 跨端同步:修复 messages 结构异常(非法 role/空 content/连续重复/开头 assistant/末尾无响应 user)
    // 共享函数 @ihui/types/message-repair,与 CLI repairSessionHistory / ai-service repair_messages 同源
    const { repaired: messages, removed: repairRemoved } = repairMessages(rawMessages)

    // P39 跨端统一:88% 阈值自动压缩上下文(共享包 @ihui/context-compaction)
    // CLI / API / ai-service 共用同一套规则,前端传 contextLimit 触发,压缩结果通过 SSE 通知前端
    let finalMessages: ChatMessage[] = messages
    const extraFirstEvents: Array<{ key: string; payload: unknown }> = []
    if (repairRemoved > 0) {
      extraFirstEvents.push({ key: 'repair', payload: { removed: repairRemoved } })
    }

    if (contextLimit && contextLimit > 0) {
      const result = compressContextIfNeeded(messages, { contextLimit })
      if (result.compressed) {
        finalMessages = result.messages
        extraFirstEvents.push({
          key: 'compaction',
          payload: {
            triggered: true,
            tokensBefore: result.originalTokens,
            tokensAfter: result.compressedTokens,
            removedCount: result.removedCount,
            usageRatio: result.usageRatio ?? 0,
          },
        })
      }
    }

    return streamToClient(request, reply, finalMessages, {
      sessionId,
      resolvedModel,
      agentId,
      materialContent,
      workspacePath,
      contextLimit,
      metadata,
    }, extraFirstEvents)
  })

  // POST /chat/answer — 用户回答 AI 主动提问,继续生成(不中断对话)
  // 前端收到 SSE question 事件 → 弹窗让用户选择/输入 → 提交答案到本接口
  // 后端把 answer 作为新 user 消息追加到 messages 末尾,然后调用 ai-service 继续流式生成
  server.post('/chat/answer', async (request, reply) => {
    const parsed = chatAnswerSchema.safeParse(request.body)
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
      workspacePath,
      contextLimit,
      metadata,
      questionId,
      answer,
    } = parsed.data
    const resolvedModel = model ?? modelId

    // 把用户答案作为新 user 消息追加到 messages 末尾(在 repair 之前,让 repair 统一处理)
    const messagesWithAnswer = [
      ...rawMessages,
      { role: 'user' as const, content: answer },
    ]

    const { repaired: messages, removed: repairRemoved } = repairMessages(messagesWithAnswer)

    let finalMessages: ChatMessage[] = messages
    const extraFirstEvents: Array<{ key: string; payload: unknown }> = [
      // 首事件通知前端:这是 question 已回答后的续流(前端可据此关闭弹窗)
      { key: 'resumed', payload: { questionId, resumed: true } },
    ]
    if (repairRemoved > 0) {
      extraFirstEvents.push({ key: 'repair', payload: { removed: repairRemoved } })
    }

    if (contextLimit && contextLimit > 0) {
      const result = compressContextIfNeeded(messages, { contextLimit })
      if (result.compressed) {
        finalMessages = result.messages
        extraFirstEvents.push({
          key: 'compaction',
          payload: {
            triggered: true,
            tokensBefore: result.originalTokens,
            tokensAfter: result.compressedTokens,
            removedCount: result.removedCount,
            usageRatio: result.usageRatio ?? 0,
          },
        })
      }
    }

    return streamToClient(request, reply, finalMessages, {
      sessionId,
      resolvedModel,
      agentId,
      materialContent,
      workspacePath,
      contextLimit,
      metadata,
    }, extraFirstEvents)
  })
}
