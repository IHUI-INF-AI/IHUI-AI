/**
 * POST /v1/messages — Anthropic Messages 原生格式端点(2026-07-31 立,P0-6)。
 *
 * 让 Claude SDK(anthropic-sdk-python / @anthropic-ai/sdk)用户无需改代码即可接入
 * IHUI 中转站。内部走现有 relay 调用链(ai-service /api/llm/complete[/stream])+
 * relay-billing-service 计费,与 /v1/chat/completions 共享同一上游与计费逻辑。
 *
 * 流程:
 * 1. preHandler:requireApiKeyAuth + requireApiKeyPermission('chat:write') + requireApiKeyQuota
 * 2. Zod 校验 Anthropic Messages 请求体
 * 3. checkQuota 预检余额
 * 4. anthropicRequestToOpenAI 转 OpenAI 格式
 * 5. 调 ai-service 上游(/api/llm/complete 或 /api/llm/complete/stream)
 * 6. recordCall 计费(透传 model/promptTokens/completionTokens)
 * 7. stream:每个上游 SSE 行 → parseUpstreamLineToOpenAIChunk → openAIStreamChunkToAnthropicEvents → SSE 写出
 *    非流式:openAIResponseToAnthropic 转 Anthropic 响应
 *
 * 设计参考 v1-public.ts 的 streamChatCompletion + /chat/completions handler,
 * 不修改 v1-public.ts(其他 subagent 在改),内部独立实现转换+调用。
 */
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { config } from '../config/index.js'
import {
  requireApiKeyAuth,
  requireApiKeyPermission,
  requireApiKeyQuota,
} from '../plugins/api-key-auth.js'
import { checkQuota, recordCall, isByokCall } from '../services/relay-billing-service.js'
import { error } from '../utils/response.js'
import {
  anthropicRequestToOpenAI,
  openAIResponseToAnthropic,
  openAIStreamChunkToAnthropicEvents,
  createStreamState,
  serializeAnthropicSSEEvent,
  parseUpstreamLineToOpenAIChunk,
  type AnthropicMessagesRequest,
  type OpenAIChatResponse,
} from '../services/anthropic-adapter.js'

/** 鉴权后注入 request 的 API Key 上下文(与 AuthenticatedApiKey 结构一致) */
interface ApiKeyContext {
  id: string
  userId: string
  key: string
  permissions: string[]
  rateLimit: number
}

const errorResponseSchema = {
  type: 'object' as const,
  properties: {
    code: { type: 'number' as const },
    message: { type: 'string' as const },
  },
}

// =============================================================================
// Zod schema:Anthropic Messages 请求体
// =============================================================================

const contentBlockSchema = z.union([
  z.object({ type: z.literal('text'), text: z.string() }),
  z.object({
    type: z.literal('tool_use'),
    id: z.string(),
    name: z.string(),
    input: z.unknown(),
  }),
  z.object({
    type: z.literal('tool_result'),
    tool_use_id: z.string(),
    content: z.union([
      z.string(),
      z.array(z.object({ type: z.literal('text'), text: z.string() })),
    ]),
  }),
  // 允许透传 image 等其他 block(api 层不解析,留给上游;转 OpenAI 时会被忽略)
  z.object({ type: z.string() }).passthrough(),
])

const messageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.union([z.string(), z.array(contentBlockSchema)]),
})

const toolSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  input_schema: z.record(z.unknown()),
})

const toolChoiceSchema = z.object({
  type: z.enum(['auto', 'any', 'tool']),
  name: z.string().optional(),
})

const anthropicMessagesSchema = z.object({
  model: z.string().min(1),
  messages: z.array(messageSchema).min(1),
  system: z
    .union([z.string(), z.array(z.object({ type: z.string(), text: z.string() }))])
    .optional(),
  max_tokens: z.number().int().positive(),
  tools: z.array(toolSchema).optional(),
  tool_choice: toolChoiceSchema.optional(),
  stream: z.boolean().optional().default(false),
  temperature: z.number().optional(),
  top_p: z.number().optional(),
  stop_sequences: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
})

// =============================================================================
// 流式 Anthropic Messages 输出
// =============================================================================

/**
 * 流式调用 ai-service 上游,逐行解析并转为 Anthropic SSE 事件写出。
 * 模仿 v1-public.ts 的 streamChatCompletion,但输出 Anthropic SSE 格式。
 */
async function streamAnthropicMessages(
  request: FastifyRequest,
  reply: FastifyReply,
  opts: {
    openaiBody: Record<string, unknown>
    model: string
    apiKeyId?: string
    userId?: string
    promptText: string
    startTime: number
    mode: 'relay' | 'byok'
  },
): Promise<void> {
  reply.hijack()
  const raw = reply.raw
  raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  })

  const state = createStreamState(opts.model)
  /** 累计响应文本用于估算 token(P0-5 流式无准确 usage) */
  let responseText = ''
  let streamError: string | null = null

  const writeEvents = (events: ReturnType<typeof openAIStreamChunkToAnthropicEvents>) => {
    for (const ev of events) {
      raw.write(serializeAnthropicSSEEvent(ev))
      // 累计 text_delta 文本用于计费估算
      if (ev.type === 'content_block_delta' && ev.delta.type === 'text_delta') {
        responseText += ev.delta.text
      }
    }
  }

  const controller = new AbortController()
  const onClose = () => controller.abort()
  request.raw.on('close', onClose)

  try {
    const resp = await fetch(`${config.AI_SERVICE_URL}/api/llm/complete/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify(opts.openaiBody),
      signal: controller.signal,
    })

    if (!resp.ok || !resp.body) {
      const errText = await resp.text().catch(() => '')
      streamError = `upstream ${resp.status}: ${errText.slice(0, 200)}`
      // 发一个 error text block + 结束
      const errChunk = {
        id: `chatcmpl-${randomUUID()}`,
        model: opts.model,
        choices: [
          {
            index: 0,
            delta: { content: `[error] ${streamError}` },
            finish_reason: null as string | null,
          },
        ],
      }
      writeEvents(openAIStreamChunkToAnthropicEvents(errChunk, state))
      // 关闭
      const stopChunk = {
        id: `chatcmpl-${randomUUID()}`,
        model: opts.model,
        choices: [
          {
            index: 0,
            delta: {},
            finish_reason: 'stop' as string | null,
          },
        ],
      }
      writeEvents(openAIStreamChunkToAnthropicEvents(stopChunk, state))
      return
    }

    const reader = resp.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let nl: number
      while ((nl = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, nl).replace(/\r$/, '')
        buffer = buffer.slice(nl + 1)
        const chunk = parseUpstreamLineToOpenAIChunk(line, opts.model)
        if (chunk) writeEvents(openAIStreamChunkToAnthropicEvents(chunk, state))
      }
    }
    if (buffer.trim()) {
      const chunk = parseUpstreamLineToOpenAIChunk(buffer, opts.model)
      if (chunk) writeEvents(openAIStreamChunkToAnthropicEvents(chunk, state))
    }

    // 若上游未发 finish_reason,补一个 stop 收尾(防止客户端挂起)
    if (state.messageStarted && !state.contentBlockStarted) {
      // 已经收尾了,跳过
    } else if (state.messageStarted) {
      const stopChunk = {
        id: `chatcmpl-${randomUUID()}`,
        model: opts.model,
        choices: [
          {
            index: 0,
            delta: {},
            finish_reason: 'stop' as string | null,
          },
        ],
      }
      writeEvents(openAIStreamChunkToAnthropicEvents(stopChunk, state))
    }
  } catch (e) {
    const msg =
      (e as Error).name === 'AbortError' ? 'client disconnected' : (e as Error).message
    streamError = msg
    if (state.messageStarted && state.contentBlockStarted) {
      // 已开始,补一个 stop 收尾
      const stopChunk = {
        id: `chatcmpl-${randomUUID()}`,
        model: opts.model,
        choices: [
          {
            index: 0,
            delta: {},
            finish_reason: 'stop' as string | null,
          },
        ],
      }
      writeEvents(openAIStreamChunkToAnthropicEvents(stopChunk, state))
    }
  } finally {
    request.raw.off('close', onClose)
    raw.end()

    // P0-5 中转站计费:流式结束后聚合 token 用量写入计费
    if (opts.apiKeyId && opts.userId) {
      const promptTokens = Math.ceil(opts.promptText.length / 4)
      const completionTokens = Math.ceil(responseText.length / 4)
      const totalTokens = promptTokens + completionTokens
      void recordCall({
        apiKeyId: opts.apiKeyId,
        userId: opts.userId,
        model: opts.model,
        prompt: opts.promptText,
        response: responseText,
        promptTokens,
        completionTokens,
        totalTokens,
        latencyMs: Date.now() - opts.startTime,
        status: streamError ? 'error' : 'success',
        errorMessage: streamError,
        metadata: { stream: true, protocol: 'anthropic-messages' },
        mode: opts.mode,
      }).catch(() => {})
    }
  }
}

// =============================================================================
// 路由插件
// =============================================================================

const v1MessagesRoutes: FastifyPluginAsync = async (server) => {
  server.post(
    '/messages',
    {
      schema: {
        description: 'Anthropic Messages 原生格式端点(Claude SDK 兼容,支持 stream)',
        tags: ['Messages'],
        body: {
          type: 'object',
          properties: {
            model: { type: 'string' },
            messages: { type: 'array' },
            // system 字段可为 string 或 array,JSON Schema 联合类型会触发 ajv strictTypes,
            // 故 body schema 不声明 system(由 handler 内 Zod schema 校验)
            max_tokens: { type: 'number' },
            tools: { type: 'array' },
            tool_choice: { type: 'object' },
            stream: { type: 'boolean' },
            temperature: { type: 'number' },
            top_p: { type: 'number' },
            stop_sequences: { type: 'array' },
            metadata: { type: 'object' },
          },
          required: ['model', 'messages', 'max_tokens'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              type: { type: 'string' },
              role: { type: 'string' },
              model: { type: 'string' },
              content: { type: 'array' },
              stop_reason: { type: 'string' },
              stop_sequence: { type: ['string', 'null'] },
              usage: {
                type: 'object',
                properties: {
                  input_tokens: { type: 'number' },
                  output_tokens: { type: 'number' },
                },
              },
            },
          },
          400: errorResponseSchema,
          401: errorResponseSchema,
          402: errorResponseSchema,
          502: errorResponseSchema,
          503: errorResponseSchema,
        },
      },
      preHandler: [requireApiKeyAuth, requireApiKeyPermission('chat:write'), requireApiKeyQuota()],
    },
    async (request, reply) => {
      const parsed = anthropicMessagesSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply
          .status(400)
          .send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const body = parsed.data as AnthropicMessagesRequest

      // P0-5 中转站计费:调用前检查 API Key 余额
      const apiKey = (request as FastifyRequest & { apiKey?: ApiKeyContext }).apiKey
      const startTime = Date.now()
      const promptText = body.messages
        .map((m) => {
          if (typeof m.content === 'string') return `${m.role}: ${m.content}`
          return `${m.role}: ${m.content
            .map((b) => (b.type === 'text' ? b.text : b.type === 'tool_use' ? `[tool_use:${b.name}]` : '[tool_result]'))
            .join(' ')}`
        })
        .join('\n')

      if (apiKey) {
        const estimatedTokens = Math.ceil(promptText.length / 4)
        const quotaCheck = await checkQuota(apiKey.id, estimatedTokens)
        if (!quotaCheck.allowed) {
          const reasonMap: Record<string, string> = {
            no_balance_token: 'Token 余额不足,请充值或联系管理员',
            no_balance_cost: '成本余额不足,请充值或联系管理员',
            key_not_found: 'API Key 不存在',
            key_revoked: 'API Key 已被吊销',
          }
          const statusCode = quotaCheck.reason === 'key_not_found' ? 401 : 402
          return reply
            .status(statusCode)
            .send(error(statusCode, reasonMap[quotaCheck.reason ?? ''] ?? '额度不足'))
        }
      }

      // BYOK 平台模式:若用户对该 model 有私有 ai_model_config,走 BYOK 计费分支
      let mode: 'relay' | 'byok' = 'relay'
      if (apiKey?.userId) {
        try {
          if (await isByokCall(apiKey.userId, body.model)) mode = 'byok'
        } catch {
          // isByokCall 失败默认走 relay,不影响主链路
        }
      }

      // Anthropic → OpenAI 转换
      const openaiReq = anthropicRequestToOpenAI(body)
      const openaiBody: Record<string, unknown> = {
        messages: openaiReq.messages,
        model: openaiReq.model,
      }
      if (openaiReq.max_tokens !== undefined) openaiBody.max_tokens = openaiReq.max_tokens
      if (openaiReq.temperature !== undefined) openaiBody.temperature = openaiReq.temperature
      if (openaiReq.top_p !== undefined) openaiBody.top_p = openaiReq.top_p
      if (openaiReq.stop) openaiBody.stop = openaiReq.stop
      if (openaiReq.tools) openaiBody.tools = openaiReq.tools
      if (openaiReq.tool_choice) openaiBody.tool_choice = openaiReq.tool_choice
      if (apiKey?.userId) {
        openaiBody.metadata = {
          userId: apiKey.userId,
          ...(mode === 'byok' ? { byokMode: true } : {}),
        }
      }

      // 流式
      if (body.stream) {
        return streamAnthropicMessages(request, reply, {
          openaiBody,
          model: body.model,
          apiKeyId: apiKey?.id,
          userId: apiKey?.userId,
          promptText,
          startTime,
          mode,
        })
      }

      // 非流式:转发到 ai-service /api/llm/complete
      try {
        const resp = await fetch(`${config.AI_SERVICE_URL}/api/llm/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(openaiBody),
        })

        if (!resp.ok) {
          if (apiKey) {
            void recordCall({
              apiKeyId: apiKey.id,
              userId: apiKey.userId,
              model: body.model,
              prompt: promptText,
              response: null,
              promptTokens: 0,
              completionTokens: 0,
              totalTokens: 0,
              latencyMs: Date.now() - startTime,
              status: 'error',
              errorMessage: `AI service unavailable (${resp.status})`,
              metadata: { protocol: 'anthropic-messages' },
              mode,
            }).catch(() => {})
          }
          return reply
            .status(503)
            .send(error(503, `AI service unavailable (${resp.status})`))
        }

        const data = (await resp.json()) as {
          content?: string
          model?: string
          usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
          error?: boolean
          error_message?: string
        }

        if (data.error) {
          if (apiKey) {
            void recordCall({
              apiKeyId: apiKey.id,
              userId: apiKey.userId,
              model: body.model,
              prompt: promptText,
              response: null,
              promptTokens: 0,
              completionTokens: 0,
              totalTokens: 0,
              latencyMs: Date.now() - startTime,
              status: 'error',
              errorMessage: data.error_message ?? 'AI service error',
              metadata: { protocol: 'anthropic-messages' },
              mode,
            }).catch(() => {})
          }
          return reply.status(502).send(error(502, data.error_message ?? 'AI service error'))
        }

        // 估算 token(与 v1-public 一致:ai-service 偶发脱敏 usage 为 '***')
        const safeInt = (v: unknown, fallbackChars: number): number => {
          if (typeof v === 'number' && Number.isFinite(v) && v >= 0) return Math.floor(v)
          if (typeof v === 'string') {
            const n = Number(v)
            if (Number.isFinite(n) && n >= 0) return Math.floor(n)
            return Math.max(1, Math.ceil(fallbackChars / 4))
          }
          return Math.max(1, Math.ceil(fallbackChars / 4))
        }
        const promptTokens = safeInt(data.usage?.prompt_tokens, promptText.length)
        const completionTokens = safeInt(data.usage?.completion_tokens, (data.content ?? '').length)
        const totalTokens = promptTokens + completionTokens

        // 构造 OpenAI 风格响应 → 转 Anthropic
        const openaiResp: OpenAIChatResponse = {
          id: `chatcmpl-${randomUUID()}`,
          model: data.model ?? body.model,
          choices: [
            {
              index: 0,
              message: { role: 'assistant', content: data.content ?? '' },
              finish_reason: 'stop',
            },
          ],
          usage: {
            prompt_tokens: promptTokens,
            completion_tokens: completionTokens,
            total_tokens: totalTokens,
          },
        }
        const anthropicResp = openAIResponseToAnthropic(openaiResp, body.model)

        // P0-5 中转站计费:调用成功,记录流水 + 扣减余额
        if (apiKey) {
          recordCall({
            apiKeyId: apiKey.id,
            userId: apiKey.userId,
            model: body.model,
            prompt: promptText,
            response: data.content ?? '',
            promptTokens,
            completionTokens,
            totalTokens,
            latencyMs: Date.now() - startTime,
            status: 'success',
            metadata: { protocol: 'anthropic-messages' },
            mode,
          }).catch((e) => {
            console.error('[v1/messages] recordCall FAIL', e?.message || e)
          })
        }

        return reply.send(anthropicResp)
      } catch (e) {
        if (apiKey) {
          void recordCall({
            apiKeyId: apiKey.id,
            userId: apiKey.userId,
            model: body.model,
            prompt: promptText,
            response: null,
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
            latencyMs: Date.now() - startTime,
            status: 'error',
            errorMessage: (e as Error).message || 'AI service unavailable',
            metadata: { protocol: 'anthropic-messages' },
            mode,
          }).catch(() => {})
        }
        return reply
          .status(503)
          .send(error(503, (e as Error).message || 'AI service unavailable'))
      }
    },
  )
}

export default v1MessagesRoutes
