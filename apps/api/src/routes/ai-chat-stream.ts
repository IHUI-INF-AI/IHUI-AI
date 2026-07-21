import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { repairMessages } from '@ihui/types'
import { compressContextIfNeeded, type ChatMessage } from '@ihui/context-compaction'
import { config } from '../config/index.js'
import { authenticate } from '../plugins/auth.js'
import { error, success } from '../utils/response.js'
import { createMessage, patchConversationMetadata } from '../db/chat-queries.js'

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
    // 若该流绑定到某个 agent(opts.agentId),在 chunk 顶层注入 agentId,
    // 前端可据此把通知分流到对应 subagent 卡片;缺失时降级为单 agent 模式
    for (const evt of extraFirstEvents) {
      const chunk: Record<string, unknown> = { [evt.key]: evt.payload }
      if (opts.agentId) chunk.agentId = opts.agentId
      raw.write(`data: ${JSON.stringify(chunk)}\n\n`)
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
        const errChunk: Record<string, unknown> = {
          error: `upstream ${resp.status}: ${errText.slice(0, 200)}`,
        }
        if (opts.agentId) errChunk.agentId = opts.agentId
        raw.write(`data: ${JSON.stringify(errChunk)}\n\n`)
        return
      }

      // 逐行注入 agentId:ai-service 返回的 token chunk 默认不带 agentId,
      // 这里对 JSON 格式的 data: 行注入顶层 agentId,让前端能按 agentId 分流到 subagent 卡片。
      // Vercel AI SDK `0:"token"` 格式无法注入(协议限制),透传原样。
      const reader = resp.body.getReader()
      const decoder = new TextDecoder()
      let streamBuffer = ''
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        streamBuffer += decoder.decode(value, { stream: true })
        let nl: number
        while ((nl = streamBuffer.indexOf('\n')) !== -1) {
          const line = streamBuffer.slice(0, nl).replace(/\r$/, '')
          streamBuffer = streamBuffer.slice(nl + 1)
          if (
            opts.agentId &&
            line.startsWith('data:') &&
            !line.startsWith('data: [DONE]')
          ) {
            const data = line.slice(5).replace(/^\s/, '')
            // 仅对 JSON 对象注入;Vercel AI SDK `0:"..."` / 纯文本透传
            if (data && data !== '[DONE]' && data.startsWith('{')) {
              try {
                const json = JSON.parse(data) as Record<string, unknown>
                if (typeof json === 'object' && json !== null && !json.agentId) {
                  json.agentId = opts.agentId
                  raw.write(`data: ${JSON.stringify(json)}\n`)
                  continue
                }
              } catch {
                /* 非 JSON,透传 */
              }
            }
          }
          raw.write(line + '\n')
        }
      }
      if (streamBuffer) raw.write(streamBuffer)
    } catch (e) {
      const msg = (e as Error).name === 'AbortError' ? '客户端断开' : (e as Error).message
      const errChunk: Record<string, unknown> = { error: msg }
      if (opts.agentId) errChunk.agentId = opts.agentId
      raw.write(`data: ${JSON.stringify(errChunk)}\n\n`)
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

    return streamToClient(
      request,
      reply,
      finalMessages,
      {
        sessionId,
        resolvedModel,
        agentId,
        materialContent,
        workspacePath,
        contextLimit,
        metadata,
      },
      extraFirstEvents,
    )
  })

  // POST /chat/answer — 用户回答 AI 主动提问,继续生成(不中断对话)
  // 前端收到 SSE question 事件 → 弹窗让用户选择/输入 → 提交答案到本接口
  // 后端把 answer 作为新 user 消息追加到 messages 末尾,然后调用 ai-service 继续流式生成
  //
  // P2 多端同步增强(2026-07-21):
  // 1. 持久化 answer 到 chat_messages(role: user, metadata: { questionId, isAnswer: true })
  // 2. 清除原 assistant 消息 metadata.pendingQuestion(标记已回答)
  // 3. WS 广播 chat_question_answered 通知其他端关闭弹窗
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
    const userId = metadata?.userId ?? request.userId
    const conversationId = metadata?.conversationId

    // P2 多端同步:持久化 answer + 清挂起 + WS 广播(fire-and-forget,不阻塞 SSE 流)
    // 失败仅打日志,不影响续流(参考 persistMessageSafe 的容错策略)
    if (conversationId && userId) {
      void (async () => {
        try {
          // 1. 持久化 answer 为 user 消息(metadata 标记 questionId + isAnswer,便于后续查询关联)
          const savedAnswer = await createMessage({
            conversationId,
            role: 'user',
            content: answer,
            metadata: { questionId, isAnswer: true },
          })

          // 2. 清除 conversation.metadata.pendingQuestion(对话级挂起状态,标记已回答)
          //    用 merge 模式,不覆盖 conversation.metadata 的其他 key
          await patchConversationMetadata(conversationId, userId, {
            pendingQuestion: null,
            answeredQuestionId: questionId,
          })

          // 3. WS 广播 chat_question_answered 通知其他端关闭弹窗
          //    pushNotification 已支持 Redis Pub/Sub 多实例,所有端都会收到
          try {
            const push = (
              server as unknown as {
                pushNotification?: (userId: string, payload: unknown) => void
              }
            ).pushNotification
            // 3a. 推送 chat_message 让其他端看到用户回答(与 POST /conversations/:id/messages 同模式)
            push?.(userId, {
              type: 'chat_message',
              conversationId,
              message: savedAnswer,
            })
            // 3b. 推送 chat_question_answered 让其他端关闭弹窗
            push?.(userId, {
              type: 'chat_question_answered',
              conversationId,
              questionId,
            })
          } catch {
            /* 推送失败不阻塞 */
          }
        } catch (e) {
          request.log.error(
            { err: e, questionId, conversationId },
            'chat/answer persistence failed',
          )
        }
      })()
    }

    // 把用户答案作为新 user 消息追加到 messages 末尾(在 repair 之前,让 repair 统一处理)
    const messagesWithAnswer = [...rawMessages, { role: 'user' as const, content: answer }]

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

    return streamToClient(
      request,
      reply,
      finalMessages,
      {
        sessionId,
        resolvedModel,
        agentId,
        materialContent,
        workspacePath,
        contextLimit,
        metadata,
      },
      extraFirstEvents,
    )
  })

  // POST /chat/questions — 持久化 AI 主动提问挂起状态 + WS 广播到多端
  // 前端收到 SSE question 事件时主动调用本端点,把挂起状态写入 chat_conversations.metadata.pendingQuestion
  // 其他端通过 WS ai_question 事件收到后 setPendingQuestion 弹窗,实现多端同步
  //
  // 设计权衡(2026-07-21):
  // - 不改 ai-service _fire_callback 链路(避免侵入式修改 Python 端 + ai-callback worker)
  // - 前端是 SSE question 事件的唯一消费者,由前端主动持久化是单一来源
  // - 用 conversation.metadata 而非 message.metadata,因为前端 onQuestion 时 assistantMessageId
  //   是前端 UUID(占位),DB id 要等 ai-callback 完成后才落地,无法立即持久化到 message.metadata
  // - 缺点:用户 A 关闭浏览器前未调本端点 → 挂起状态不持久化(罕见场景,可接受)
  // - 优点:架构简单,不改 ai-service + ai-callback 链路,工作量最小
  const questionSchema = z.object({
    conversationId: z.string().min(1),
    questionId: z.string().min(1),
    prompt: z.string().min(1),
    options: z.array(z.object({ id: z.string(), label: z.string() })).default([]),
    allowCustom: z.boolean().default(false),
    allowMultiple: z.boolean().default(false),
  })

  server.post('/chat/questions', async (request, reply) => {
    const parsed = questionSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { conversationId, questionId, prompt, options, allowCustom, allowMultiple } = parsed.data
    const userId = request.userId
    if (!userId) {
      return reply.status(401).send(error(401, '未登录'))
    }

    // 1. 把 pendingQuestion 写入 conversation.metadata(merge 模式,不覆盖其他 key)
    //    若对话不存在或不属于该用户 → 返回 404(前端降级为仅本地弹窗,不影响主流程)
    const updated = await patchConversationMetadata(conversationId, userId, {
      pendingQuestion: { questionId, prompt, options, allowCustom, allowMultiple },
    })
    if (!updated) {
      return reply.status(404).send(error(404, '对话不存在或无权限'))
    }

    // 2. WS 广播 ai_question 通知其他端弹窗(pushNotification 支持 Redis Pub/Sub 多实例)
    try {
      ;(
        server as unknown as {
          pushNotification?: (userId: string, payload: unknown) => void
        }
      ).pushNotification?.(userId, {
        type: 'ai_question',
        conversationId,
        question: { questionId, prompt, options, allowCustom, allowMultiple },
      })
    } catch {
      /* 推送失败不阻塞 */
    }

    return reply.send(success({ ok: true, persisted: true }))
  })
}
