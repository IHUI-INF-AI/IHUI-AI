/**
 * POST /v1/responses — OpenAI Responses API 兼容端点(2026-07-31 立)。
 *
 * OpenAI 2025 推出的 Responses API,供 Cursor / Codex 等新型客户端直接接入。
 * 内部走 ai-service /api/llm/complete[/stream],与 /v1/chat/completions 共享上游与计费逻辑。
 *
 * 转换流程:
 * 1. preHandler:requireApiKeyAuth(Bearer token + developer_api_keys 表)
 * 2. Zod 校验 Responses API 请求体
 * 3. checkQuota 预检余额(不足 → 402 + code 4029)
 * 4. responsesInputToMessages 转换为 OpenAI Chat 格式(供 ai-service 调用)
 * 5. 调 ai-service 上游(/api/llm/complete 或 /api/llm/complete/stream)
 * 6. recordCall 计费(透传 model/promptTokens/completionTokens)
 * 7. stream:true → SSE 事件流(response.created / response.output_text.delta / response.completed)
 *    stream:false → OpenAI Responses API 响应体
 *
 * 设计参考:
 * - v1-rerank-moderations.ts(鉴权 + 计费集成模式)
 * - v1-public.ts(上游调用 + 流式 SSE 输出模式)
 * - v1-messages.ts(协议适配 + recordCall 透传审计字段)
 *
 * 待主 agent 在 routes/index.ts 注册:
 *   import v1Responses from './v1-responses.js'
 *   server.register(v1Responses, { prefix: '/v1' })
 *
 * 响应格式:OpenAI Responses API 兼容(不套 { code, message, data } 壳,与 v1-public.ts 一致)。
 * 错误格式:{ code, message } + HTTP 状态码(400/401/402/502)。
 */
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { config } from '../config/index.js'
import { requireApiKeyAuth } from '../plugins/api-key-auth.js'
import { checkQuota, recordCall, modelToProviderCode } from '../services/relay-billing-service.js'
// P0-20b 参数覆盖系统转发层集成(2026-08-01 立):转发前应用 applyParamOps
import { applyParamOpsToBody } from '../services/relay-param-ops-config.js'
import { error } from '../utils/response.js'

/** 鉴权后注入 request 的 API Key 上下文(与 v1-public.ts ApiKeyContext 结构一致) */
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
// 类型定义(OpenAI Responses API 兼容类型,inline 定义避免污染 @ihui/types)
// =============================================================================

/** Responses API input item - 简单文本或消息对象(passthrough 保留 image 等扩展字段) */
type ResponsesInputItem =
  | string
  | {
      type?: string
      role?: 'user' | 'assistant' | 'system' | 'developer'
      content?: string | Array<{ type: string; text?: string }>
      [key: string]: unknown
    }

/** Responses API 内置工具(web_search / file_search / code_interpreter) */
interface ResponsesTool {
  type: 'web_search' | 'file_search' | 'code_interpreter' | string
  [key: string]: unknown
}

/** Responses API 输出 message 项 */
interface ResponsesOutputMessage {
  type: 'message'
  id: string
  status: 'completed'
  role: 'assistant'
  content: Array<{ type: 'output_text'; text: string; annotations: unknown[] }>
}

/** Responses API 完整响应 */
interface ResponsesApiResponse {
  id: string
  object: 'response'
  status: 'completed' | 'failed' | 'in_progress'
  model: string
  output: ResponsesOutputMessage[]
  usage: {
    input_tokens: number
    output_tokens: number
    total_tokens: number
  }
}

// =============================================================================
// Zod schema:Responses API 请求体
// =============================================================================

const inputItemSchema = z.union([
  z.string(),
  z.looseObject({
    type: z.string().optional(),
    role: z.enum(['user', 'assistant', 'system', 'developer']).optional(),
    content: z
      .union([
        z.string(),
        z.array(z.looseObject({ type: z.string(), text: z.string().optional() })).min(1),
      ])
      .optional(),
  }),
])

const toolSchema = z.looseObject({ type: z.string() })

const responsesSchema = z.object({
  model: z.string().min(1),
  input: z.union([z.string(), z.array(inputItemSchema).min(1)]),
  instructions: z.string().optional(),
  max_output_tokens: z.number().int().positive().optional(),
  temperature: z.number().optional(),
  tools: z.array(toolSchema).optional(),
  stream: z.boolean().optional().default(false),
})

// =============================================================================
// 转换函数:Responses API 请求 → OpenAI Chat 请求
// =============================================================================

/**
 * 将 Responses API 的 input 转换为 OpenAI Chat 的 messages 数组。
 * - instructions(若有)作为 system 消息置顶
 * - input 为字符串 → 单条 user 消息
 * - input 为数组 → 逐项转换(role/content),developer/system/assistant 原样保留,其他归一为 user
 */
function responsesInputToMessages(
  input: string | ResponsesInputItem[],
  instructions?: string,
): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> {
  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = []

  if (instructions) {
    messages.push({ role: 'system', content: instructions })
  }

  if (typeof input === 'string') {
    messages.push({ role: 'user', content: input })
    return messages
  }

  for (const item of input) {
    if (typeof item === 'string') {
      messages.push({ role: 'user', content: item })
      continue
    }
    const role = item.role
    const content = extractContent(item.content)
    if (role === 'system' || role === 'assistant') {
      messages.push({ role, content })
    } else {
      // user / developer / undefined → user
      messages.push({ role: 'user', content })
    }
  }

  return messages
}

/** 从 input item.content 提取纯文本(字符串原样返回,数组逐项拼接 text) */
function extractContent(
  content: string | Array<{ type: string; text?: string }> | undefined,
): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map((c) => (c.type === 'output_text' || c.type === 'text' ? (c.text ?? '') : ''))
      .join('')
  }
  return ''
}

/**
 * 从 ai-service 流式响应行中提取文本(与 v1-public.ts extractStreamText 一致)。
 * 处理 Vercel AI SDK `0:"text"` 格式和 `data: {...}` SSE 格式。
 */
function extractStreamText(line: string): string | null {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith(':')) return null

  // Vercel AI SDK: 0:"text" (type:payload)
  const vercelMatch = /^(\d+):(.+)$/.exec(trimmed)
  if (vercelMatch) {
    const type = vercelMatch[1]
    const payload = vercelMatch[2]
    if (type === '0' && payload) {
      try {
        const text = JSON.parse(payload)
        if (typeof text === 'string') return text
      } catch {
        /* not JSON */
      }
    }
    return null
  }

  // SSE data: format
  if (trimmed.startsWith('data:')) {
    const data = trimmed.slice(5).trim()
    if (!data || data === '[DONE]') return null
    try {
      const json = JSON.parse(data)
      if (typeof json === 'string') return json
      if (typeof json.content === 'string') return json.content
      if (typeof json.token === 'string') return json.token
      if (json.delta?.content) return json.delta.content
      if (json.choices?.[0]?.delta?.content) return json.choices[0].delta.content
    } catch {
      /* not JSON */
    }
  }

  return null
}

// =============================================================================
// 流式 Responses API 输出
// =============================================================================

/**
 * 流式调用 ai-service 上游,逐行解析并转为 Responses API SSE 事件写出。
 * 模仿 v1-public.ts 的 streamChatCompletion,但输出 Responses API SSE 格式:
 *   event: response.created
 *   data: { type: 'response.created', response: { id, object: 'response', status: 'in_progress', ... } }
 *
 *   event: response.output_text.delta
 *   data: { type: 'response.output_text.delta', output_index: 0, content_index: 0, delta: '...' }
 *
 *   event: response.completed
 *   data: { type: 'response.completed', response: { id, object: 'response', status: 'completed', output: [...] } }
 */
async function streamResponses(
  request: FastifyRequest,
  reply: FastifyReply,
  opts: {
    openaiBody: Record<string, unknown>
    model: string
    apiKeyId?: string
    userId?: string
    promptText: string
    startTime: number
    providerCode?: string
    clientIp?: string
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

  const responseId = `resp-${randomUUID()}`
  /** 累计响应文本用于估算 token(流式无准确 usage) */
  let responseText = ''
  let streamError: string | null = null
  let firstTokenTime: number | null = null
  let upstreamHttpStatus: number | null = null

  /** 发送 SSE 事件(OpenAI Responses API 流式格式:event + data 双行) */
  const writeEvent = (eventType: string, data: Record<string, unknown>): void => {
    raw.write(`event: ${eventType}\n`)
    raw.write(`data: ${JSON.stringify(data)}\n\n`)
  }

  // response.created 事件(发送首个 token 前)
  writeEvent('response.created', {
    type: 'response.created',
    response: {
      id: responseId,
      object: 'response',
      status: 'in_progress',
      model: opts.model,
      output: [],
    },
  })

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

    upstreamHttpStatus = resp.status

    if (!resp.ok || !resp.body) {
      const errText = await resp.text().catch(() => '')
      streamError = `upstream ${resp.status}: ${errText.slice(0, 200)}`
      // 把上游错误作为 delta 发出(让客户端可见错误信息)
      const errorDelta = `[error] ${streamError}`
      responseText += errorDelta
      writeEvent('response.output_text.delta', {
        type: 'response.output_text.delta',
        output_index: 0,
        content_index: 0,
        delta: errorDelta,
      })
    } else {
      const reader = resp.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      const processLine = (line: string): void => {
        const text = extractStreamText(line)
        if (text) {
          if (firstTokenTime === null) firstTokenTime = Date.now()
          responseText += text
          writeEvent('response.output_text.delta', {
            type: 'response.output_text.delta',
            output_index: 0,
            content_index: 0,
            delta: text,
          })
        }
      }

      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        let nl: number
        while ((nl = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, nl).replace(/\r$/, '')
          buffer = buffer.slice(nl + 1)
          processLine(line)
        }
      }
      if (buffer.trim()) {
        processLine(buffer)
      }
    }

    // response.completed 事件(末尾,带完整 output + status)
    writeEvent('response.completed', {
      type: 'response.completed',
      response: {
        id: responseId,
        object: 'response',
        status: streamError ? 'failed' : 'completed',
        model: opts.model,
        output: [
          {
            type: 'message',
            id: `msg-${randomUUID()}`,
            status: 'completed',
            role: 'assistant',
            content: [
              {
                type: 'output_text',
                text: responseText,
                annotations: [],
              },
            ],
          },
        ],
      },
    })
  } catch (e) {
    const msg = (e as Error).name === 'AbortError' ? 'client disconnected' : (e as Error).message
    streamError = msg
    writeEvent('response.completed', {
      type: 'response.completed',
      response: {
        id: responseId,
        object: 'response',
        status: 'failed',
        model: opts.model,
        output: [],
        error: { message: msg },
      },
    })
  } finally {
    request.raw.off('close', onClose)
    raw.end()

    // 计费:流式结束后聚合 token 用量写入计费
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
        metadata: { stream: true, protocol: 'responses' },
        providerCode: opts.providerCode,
        clientIp: opts.clientIp,
        httpStatus: upstreamHttpStatus ?? undefined,
        ttftMs: firstTokenTime !== null ? firstTokenTime - opts.startTime : undefined,
      }).catch(() => {})
    }
  }
}

// =============================================================================
// 路由插件
// =============================================================================

const v1ResponsesRoutes: FastifyPluginAsync = async (server) => {
  server.post(
    '/responses',
    {
      compress: false,
      schema: {
        description: 'OpenAI Responses API 兼容端点(Cursor/Codex 客户端,支持 stream)',
        tags: ['Responses'],
        body: {
          type: 'object',
          properties: {
            model: { type: 'string', description: '模型名(如 gpt-4o / gpt-5 / o3)' },
            input: {
              anyOf: [
                { type: 'string' },
                { type: 'array', description: '消息数组(role/content 等)' },
              ],
              description: '输入文本或消息数组(OpenAI Responses API 格式)',
            },
            instructions: { type: 'string', description: '系统指令(等同 system 消息)' },
            max_output_tokens: { type: 'number', minimum: 1 },
            temperature: { type: 'number' },
            tools: {
              type: 'array',
              description: '内置工具(web_search / file_search / code_interpreter)',
            },
            stream: { type: 'boolean', default: false },
          },
          required: ['model', 'input'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              object: { type: 'string' },
              status: { type: 'string' },
              model: { type: 'string' },
              output: { type: 'array' },
              usage: {
                type: 'object',
                properties: {
                  input_tokens: { type: 'number' },
                  output_tokens: { type: 'number' },
                  total_tokens: { type: 'number' },
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
      preHandler: [requireApiKeyAuth],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parsed = responsesSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const { model, input, instructions, max_output_tokens, temperature, tools, stream } =
        parsed.data

      // 计费:调用前检查 API Key 余额
      const apiKey = (request as FastifyRequest & { apiKey?: ApiKeyContext }).apiKey
      const startTime = Date.now()
      const messages = responsesInputToMessages(input, instructions)
      const promptText = messages.map((m) => `${m.role}: ${m.content}`).join('\n')

      if (apiKey) {
        const estimatedTokens = Math.ceil(promptText.length / 4)
        const quotaCheck = await checkQuota(apiKey.id, estimatedTokens)
        if (!quotaCheck.allowed) {
          // 任务约束 8:余额不足返回业务码 4029(HTTP 状态码 402)
          return reply.status(402).send(error(4029, '余额不足,请充值或联系管理员'))
        }
      }

      // 构造 ai-service OpenAI 格式请求体(max_output_tokens → max_tokens)
      const openaiBody: Record<string, unknown> = { messages, model }
      if (max_output_tokens !== undefined) openaiBody.max_tokens = max_output_tokens
      if (temperature !== undefined) openaiBody.temperature = temperature
      // 内置工具透传(ai-service 上游自行决定是否处理 web_search/file_search/code_interpreter)
      if (tools && tools.length > 0) {
        openaiBody.tools = tools as ResponsesTool[]
      }
      if (apiKey?.userId) {
        openaiBody.metadata = { userId: apiKey.userId }
      }

      // P0-20b 参数覆盖系统转发层集成(2026-08-01):转发前应用 applyParamOps
      const paramOpsResult = await applyParamOpsToBody(openaiBody, {
        model,
        original_model: model,
      })
      const modifiedOpenaiBody = paramOpsResult.body

      // 流式
      if (stream) {
        return streamResponses(request, reply, {
          openaiBody: modifiedOpenaiBody,
          model,
          apiKeyId: apiKey?.id,
          userId: apiKey?.userId,
          promptText,
          startTime,
          providerCode: modelToProviderCode(model),
          clientIp: request.ip,
        })
      }

      // 非流式:转发到 ai-service /api/llm/complete
      try {
        const resp = await fetch(`${config.AI_SERVICE_URL}/api/llm/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(modifiedOpenaiBody),
        })

        if (!resp.ok) {
          if (apiKey) {
            void recordCall({
              apiKeyId: apiKey.id,
              userId: apiKey.userId,
              model,
              prompt: promptText,
              response: null,
              promptTokens: 0,
              completionTokens: 0,
              totalTokens: 0,
              latencyMs: Date.now() - startTime,
              status: 'error',
              errorMessage: `AI service unavailable (${resp.status})`,
              metadata: { protocol: 'responses' },
              providerCode: modelToProviderCode(model),
              clientIp: request.ip,
              httpStatus: resp.status,
            }).catch(() => {})
          }
          // 任务约束 8:上游错误返回 502
          return reply.status(502).send(error(502, `AI service unavailable (${resp.status})`))
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
              model,
              prompt: promptText,
              response: null,
              promptTokens: 0,
              completionTokens: 0,
              totalTokens: 0,
              latencyMs: Date.now() - startTime,
              status: 'error',
              errorMessage: data.error_message ?? 'AI service error',
              metadata: { protocol: 'responses' },
              providerCode: modelToProviderCode(model),
              clientIp: request.ip,
              httpStatus: resp.status,
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

        // 构造 Responses API 响应
        const result: ResponsesApiResponse = {
          id: `resp-${randomUUID()}`,
          object: 'response',
          status: 'completed',
          model: data.model ?? model,
          output: [
            {
              type: 'message',
              id: `msg-${randomUUID()}`,
              status: 'completed',
              role: 'assistant',
              content: [
                {
                  type: 'output_text',
                  text: data.content ?? '',
                  annotations: [],
                },
              ],
            },
          ],
          usage: {
            input_tokens: promptTokens,
            output_tokens: completionTokens,
            total_tokens: totalTokens,
          },
        }

        // 计费:调用成功,记录流水 + 扣减余额
        if (apiKey) {
          recordCall({
            apiKeyId: apiKey.id,
            userId: apiKey.userId,
            model,
            prompt: promptText,
            response: data.content ?? '',
            promptTokens,
            completionTokens,
            totalTokens,
            latencyMs: Date.now() - startTime,
            status: 'success',
            metadata: { protocol: 'responses' },
            providerCode: modelToProviderCode(model),
            clientIp: request.ip,
            httpStatus: resp.status,
          }).catch((e) => {
            console.error('[v1/responses] recordCall FAIL', e?.message || e)
          })
        }

        return reply.send(result)
      } catch (e) {
        if (apiKey) {
          void recordCall({
            apiKeyId: apiKey.id,
            userId: apiKey.userId,
            model,
            prompt: promptText,
            response: null,
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
            latencyMs: Date.now() - startTime,
            status: 'error',
            errorMessage: (e as Error).message || 'AI service unavailable',
            metadata: { protocol: 'responses' },
            providerCode: modelToProviderCode(model),
            clientIp: request.ip,
          }).catch(() => {})
        }
        return reply.status(502).send(error(502, (e as Error).message || 'AI service unavailable'))
      }
    },
  )
}

export default v1ResponsesRoutes
