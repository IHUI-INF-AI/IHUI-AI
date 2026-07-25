import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { repairMessages } from '@ihui/types'
import { compressContextIfNeeded, type ChatMessage } from '@ihui/context-compaction'
import { checkAuth, authenticate } from '../plugins/auth.js'
import { error, success } from '../utils/response.js'
import { createMessage, patchConversationMetadata } from '../db/chat-queries.js'
import { aiServiceFetchStream } from '../utils/ai-service-fetch.js'

// P3-1 SSE 流式对话实时指标(admin 调试用,不直接进 Prometheus;Prometheus 抓取由 business-metrics.ts 负责)
const sseMetrics = {
  timeouts: 0, // SSE 服务端超时次数(5min 兜底超时触发)
  rateLimitHits: 0, // rateLimit 拦截次数(fastify-rate-limit 内部处理,本计数器暂不递增)
  budgetRejects: 0, // 预算校验拦截次数
  retryAfterSent: 0, // Retry-After header 下发次数
  upstreamErrors: 0, // 上游 ai-service 错误次数
}

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
  /** Agent 工具名列表(2026-07-22 立,AI 浏览器/电脑控制):
   *  传入工具名列表后,ai-service 走 tool loop(complete→tool_calls→execute→astream)。
   *  如 ["browser_screenshot", "computer_mouse_click"] */
  agentTools: z.array(z.string()).max(100).optional(),
  /** Plan/Act 模式(2026-07-24 立,对标 Trae Work plan/act toggle + Codex)
   * plan=只制定计划不执行工具(后端注入 Plan Mode system prompt),act=正常执行(默认)
   * 前端 extraBody 传 plan_mode(snake_case),透传到 ai-service /api/llm/complete/stream */
  plan_mode: z.string().optional(),
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

export const aiChatStreamRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(await checkAuth(request, reply))) return
  })

  // Token 预算前置校验:调用 aiCost.checkBudget 检查用户日 token 预算。
  // 实际签名 checkBudget(scope, scopeKey, model?) 与期望的 ({userId, model, estimatedTokens}) 不一致,
  // 用 try/catch 兜底:checkBudget 不可用或异常时降级为只 log warning 不阻塞主链路。
  // 返回 true 放行;返回 false 表示超预算(已通过 reply 返回 429,调用方应直接 return)。
  async function checkTokenBudget(
    request: FastifyRequest,
    reply: FastifyReply,
    userId: string | undefined,
    model: string | undefined,
  ): Promise<boolean> {
    if (!userId) return true // 无 userId 无法校验,放行
    try {
      const result = await server.aiCost.checkBudget('user', userId, model)
      if (!result.allowed) {
        // P2-2 日预算超限:下发 Retry-After(60s)让客户端按协商重试,而非无脑指数退避
        sseMetrics.budgetRejects++
        sseMetrics.retryAfterSent++
        reply.header('Retry-After', '60')
        reply.code(429).send({
          code: 429,
          message: '预算超限',
          data: { reason: 'budget_exceeded', detail: result.reason },
        })
        return false
      }
      return true
    } catch (e) {
      // checkBudget 不可用或异常:降级为只 log warning 不阻塞主链路
      request.log.warn({ err: e, userId, model }, 'checkBudget failed, degrade to allow')
      return true
    }
  }

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
      agentTools?: string[]
      planMode?: string
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
    // 服务端超时兜底:防 ai-service 卡死时连接无限挂起(5 分钟,正常对话远小于此)
    // timedOut 标记用于区分"服务端超时 abort" vs "客户端主动断开 abort"
    let timedOut = false
    const serverTimeout = setTimeout(() => {
      timedOut = true
      sseMetrics.timeouts++
      controller.abort()
    }, 5 * 60_000)
    const onClose = () => controller.abort()
    request.raw.on('close', onClose)

    try {
      const mergedMetadata = {
        conversationId: opts.metadata?.conversationId,
        userId: opts.metadata?.userId ?? request.userId,
        messageId: opts.metadata?.messageId,
      }
      const resp = await aiServiceFetchStream(request, '/api/llm/complete/stream', {
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
          agentTools: opts.agentTools,
          plan_mode: opts.planMode,
          metadata: mergedMetadata,
        }),
        signal: controller.signal,
      })

      if (!resp.ok || !resp.body) {
        sseMetrics.upstreamErrors++
        const errText = await resp.text().catch(() => '')
        // 上游错误响应完整透传:尝试 JSON.parse,若成功则原样透传 {errorCode, message, ...}
        // 前端可基于 errorCode 做精准提示(如 MODEL_NOT_CONFIGURED → 提示用户切换模型)
        let errChunk: Record<string, unknown>
        try {
          const parsed = JSON.parse(errText) as Record<string, unknown>
          errChunk =
            typeof parsed === 'object' && parsed !== null
              ? parsed
              : { error: `upstream ${resp.status}: ${errText.slice(0, 200)}` }
        } catch {
          errChunk = { error: `upstream ${resp.status}: ${errText.slice(0, 200)}` }
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
          if (opts.agentId && line.startsWith('data:') && !line.startsWith('data: [DONE]')) {
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
      const msg =
        (e as Error).name === 'AbortError'
          ? timedOut
            ? '服务端超时'
            : '客户端断开'
          : (e as Error).message
      const errChunk: Record<string, unknown> = { error: msg }
      if (opts.agentId) errChunk.agentId = opts.agentId
      raw.write(`data: ${JSON.stringify(errChunk)}\n\n`)
    } finally {
      request.raw.off('close', onClose)
      clearTimeout(serverTimeout)
      raw.end()
    }
  }

  server.post(
    '/chat/stream',
    {
      config: {
        rateLimit: {
          max: 20,
          timeWindow: '1 minute',
          keyGenerator: (req) => req.userId || req.ip,
        },
      },
    },
    async (request, reply) => {
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
      agentTools,
      plan_mode: planMode,
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

    // Token 预算前置校验:超预算直接返回 429,不进入流式(避免无效消耗 ai-service 配额)
    if (!(await checkTokenBudget(request, reply, metadata?.userId ?? request.userId, resolvedModel))) {
      return
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
        agentTools,
        planMode,
        metadata,
      },
      extraFirstEvents,
    )
  },
  )

  // POST /chat/answer — 用户回答 AI 主动提问,继续生成(不中断对话)
  // 前端收到 SSE question 事件 → 弹窗让用户选择/输入 → 提交答案到本接口
  // 后端把 answer 作为新 user 消息追加到 messages 末尾,然后调用 ai-service 继续流式生成
  //
  // P2 多端同步增强(2026-07-21):
  // 1. 持久化 answer 到 chat_messages(role: user, metadata: { questionId, isAnswer: true })
  // 2. 清除原 assistant 消息 metadata.pendingQuestion(标记已回答)
  // 3. WS 广播 chat_question_answered 通知其他端关闭弹窗
  server.post(
    '/chat/answer',
    {
      config: {
        rateLimit: {
          max: 20,
          timeWindow: '1 minute',
          keyGenerator: (req) => req.userId || req.ip,
        },
      },
    },
    async (request, reply) => {
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
      agentTools,
      plan_mode: planMode,
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

    // Token 预算前置校验:超预算直接返回 429,不进入流式(避免无效消耗 ai-service 配额)
    if (!(await checkTokenBudget(request, reply, userId, resolvedModel))) {
      return
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
        agentTools,
        planMode,
        metadata,
      },
      extraFirstEvents,
    )
  },
  )

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
    options: z
      .array(z.object({ id: z.string(), label: z.string() }))
      .max(100)
      .default([]),
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

  // GET /api/admin/ai/chat/metrics — SSE 流式对话实时指标(admin 调试用)
  // P3-1 简化方案:不引入 prom-client,不改 business-metrics.ts(不在受影响文件清单),
  // 改为 admin JSON 端点暴露细分计数器,供 admin 看板查询。
  // Prometheus 抓取仍由 business-metrics.ts 的 /business-metrics 负责,本端点不直接进 Prometheus。
  server.get('/api/admin/ai/chat/metrics', { preHandler: authenticate }, async () => {
    return success(sseMetrics)
  })
}
