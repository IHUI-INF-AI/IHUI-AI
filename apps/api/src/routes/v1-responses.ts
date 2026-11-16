// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
import { requireApiKeyAuth, requireApiKeyQuota } from '../plugins/api-key-auth.js'
import { requireCapabilityRules } from '../utils/capability-guard.js'
import {
  checkQuota,
  recordCall,
  modelToProviderCode,
  isByokCall,
} from '../services/relay-billing-service.js'
// P0-20b 参数覆盖系统转发层集成(2026-08-01 立):转发前应用 applyParamOps
import { applyParamOpsToBody } from '../services/relay-param-ops-config.js'
import { error } from '../utils/response.js'
// /v1 网关专用:ai-service 调用注入系统 access token(2026-09-13 修 jwt_auth 401)
import { aiServiceSystemFetch } from '../utils/ai-service-fetch.js'
// 格②(2026-09-26):耗时一律走单调钟出口,落库形态经唯一适配器投影
import { startStopwatch, type ElapsedSample, type Stopwatch } from '../utils/elapsed-ms.js'
import { persistableLatency } from '../utils/latency-persistence.js'

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

/**
 * F-293(2026-11-15):Responses API 的 function_call 输出项。
 * OpenAI Responses 协议里,模型决定调工具时不是产 message,而是产一枚 function_call 项
 * (name/arguments/call_id)。旧路由只产 output_text ⇒ 上游网关返回的 tool_calls 整块丢弃,
 * 工具调用型请求退化为纯文本端点。这里补回该输出项形状。
 */
interface ResponsesOutputFunctionCall {
  type: 'function_call'
  id: string
  status: 'completed'
  call_id: string
  name: string
  arguments: string
}

/** Responses API 完整响应 */
interface ResponsesApiResponse {
  id: string
  object: 'response'
  status: 'completed' | 'failed' | 'in_progress'
  model: string
  output: Array<ResponsesOutputMessage | ResponsesOutputFunctionCall>
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
    /** 格②(2026-09-26):由 handler 起表后传入的单调钟(替代原墙钟 epoch startTime) */
    sw: Stopwatch
    providerCode?: string
    clientIp?: string
    /**
     * F-292:计费口径。BYOK(用户对该 model 配了私有 ai_model_config)时只收平台费,
     * 不能按中转站原价×倍率再扣一次。缺省 relay 保持旧行为。
     */
    mode?: 'relay' | 'byok'
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
  /** F-89:只累计真实产出的文本(不含 `[error] ...` 文案),用于判 partial/error 与计费 */
  let billableCompletionChars = 0
  let streamError: string | null = null
  /**
   * F-726(2026-11-15):上游真 usage 捕获位(与 v1-messages 同口径)。收尾计费优先用真值,
   * 缺失字段再回退字符估算 —— 不再无条件 `ceil(chars/4)`。
   */
  let upstreamUsage: {
    prompt_tokens?: number
    completion_tokens?: number
    total_tokens?: number
    prompt_tokens_details?: { cached_tokens?: number }
    cache_creation_input_tokens?: number
  } = {}
  /**
   * F-726③(2026-11-16):reasoning_content(思维链)累计,用于 response.completed 的 reasoning 输出项。
   * Responses API 把思维链作为独立 output item(type:'reasoning')下发。
   */
  let responseReasoning = ''
  /**
   * F-295(2026-11-15):上游收尾帧 `finishReason`(如 `length`)。response.completed 的
   * status 据此判 `incomplete`,不再一律 `completed`。
   */
  let upstreamFinishReason: string | null = null
  /** 格②(2026-09-26):首 token 处再取一次样本(原为墙钟 epoch firstTokenTime) */
  let ttftSample: ElapsedSample | null = null
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
    const resp = await aiServiceSystemFetch('/api/llm/complete/stream', {
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
      // F-296:上游错误只留内部留底,**不得**塞进 output_text.delta(SDK 会当回答落库,
      // 且泄露上游 body / request-id)。这里只发 `response.failed`(status:"failed" +
      // error.code/message),固定文案不含上游原文;也不再补 response.completed 冒充正常收尾。
      streamError = `upstream ${resp.status}: ${errText.slice(0, 200)}`
      writeEvent('response.failed', {
        type: 'response.failed',
        response: {
          id: responseId,
          object: 'response',
          status: 'failed',
          model: opts.model,
          output: [],
          error: {
            code: 'upstream_error',
            message: 'Upstream service temporarily unavailable',
          },
        },
      })
      return
    }
    const reader = resp.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    const processLine = (line: string): void => {
      // F-295/F-726(2026-11-15):收尾帧 `{"type":"done","usage":{...},"finishReason":"..."}`
      // 旧 processLine 只走 extractStreamText(只认文本),done 帧返回 null ⇒ usage 与
      // finishReason 整帧被丢。此处显式认领 done 帧,捕获 usage(计费真值)与 finishReason
      // (response.completed 的 incomplete 判据)。
      const trimmedLine = line.trim()
      if (trimmedLine.startsWith('data:')) {
        const payload = trimmedLine.slice(5).trim()
        if (payload && payload !== '[DONE]') {
          try {
            const json = JSON.parse(payload) as unknown
            if (
              json &&
              typeof json === 'object' &&
              (json as Record<string, unknown>).type === 'done'
            ) {
              const doneFrame = json as {
                usage?: unknown
                finishReason?: unknown
              }
              if (doneFrame.usage && typeof doneFrame.usage === 'object') {
                upstreamUsage = { ...upstreamUsage, ...(doneFrame.usage as object) }
              }
              if (typeof doneFrame.finishReason === 'string' && doneFrame.finishReason.trim()) {
                upstreamFinishReason = doneFrame.finishReason.trim()
              }
              return
            }
            // F-726①(2026-11-16):OpenAI 兼容收尾帧 `{"choices":[...finish_reason:stop],"usage":{...}}`
            // 与 ai-service 的 done 帧不同,旧 processLine 走 extractStreamText 只取文本 ⇒ usage 丢。
            // 这里认领 choices[0].finish_reason 与顶层 usage。
            const choices = (json as Record<string, unknown>).choices
            const jsonUsage = (json as Record<string, unknown>).usage
            if (
              Array.isArray(choices) &&
              Array.isArray(choices) &&
              jsonUsage &&
              typeof jsonUsage === 'object'
            ) {
              upstreamUsage = { ...upstreamUsage, ...(jsonUsage as object) }
              const fr = (choices as Array<{ finish_reason?: unknown }>)[0]?.finish_reason
              if (typeof fr === 'string' && fr.trim()) upstreamFinishReason = fr.trim()
              return
            }
            // F-726③(2026-11-16):reasoning_content(思维链)→ response.reasoning_summary_text.delta
            const delta = (json as Record<string, unknown>)?.delta as
              Record<string, unknown> | undefined
            const choiceDelta = ((json as { choices?: Array<{ delta?: Record<string, unknown> }> })
              ?.choices?.[0]?.delta ?? delta) as Record<string, unknown> | undefined
            const reasoning = choiceDelta?.reasoning_content
            if (typeof reasoning === 'string' && reasoning.length > 0) {
              if (ttftSample === null) ttftSample = opts.sw.stop()
              responseReasoning += reasoning
              billableCompletionChars += reasoning.length
              writeEvent('response.reasoning_summary_text.delta', {
                type: 'response.reasoning_summary_text.delta',
                output_index: 0,
                summary_index: 0,
                delta: reasoning,
              })
              return
            }
          } catch {
            /* not JSON: 落到文本提取 */
          }
        }
      }
      const text = extractStreamText(line)
      if (text) {
        if (ttftSample === null) ttftSample = opts.sw.stop()
        responseText += text
        // F-89:真实文本才计入计费 token
        billableCompletionChars += text.length
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

    // response.completed 事件(末尾,带完整 output + status)
    // F-295(2026-11-15):上游收尾帧 finishReason=length ⇒ status='incomplete' +
    // incomplete_details.reason='max_output_tokens',不再一律报 'completed'(客户端无法得知被截断)。
    // Anthropic/Responses 协议中截断属 incomplete,内容过滤同理归 incomplete(无独立 refusal 档)。
    const isTruncated =
      upstreamFinishReason === 'length' || upstreamFinishReason === 'content_filter'
    // F-726①(2026-11-16):response.completed 带 usage(优先真值,缺失回退估算),与计费同源
    const estimatePromptTokens = Math.ceil(opts.promptText.length / 4)
    const estimateCompletionTokens = Math.ceil(billableCompletionChars / 4)
    const realPrompt = upstreamUsage.prompt_tokens
    const realCompletion = upstreamUsage.completion_tokens
    const promptTokens =
      typeof realPrompt === 'number' && Number.isFinite(realPrompt) && realPrompt >= 0
        ? Math.floor(realPrompt)
        : estimatePromptTokens
    const completionTokens =
      typeof realCompletion === 'number' && Number.isFinite(realCompletion) && realCompletion >= 0
        ? Math.floor(realCompletion)
        : estimateCompletionTokens
    const cachedTokens =
      typeof upstreamUsage.prompt_tokens_details?.cached_tokens === 'number'
        ? upstreamUsage.prompt_tokens_details.cached_tokens
        : 0
    // F-726③(2026-11-16):reasoning 输出项(思维链)
    const outputItems: Array<Record<string, unknown>> = []
    if (responseReasoning.length > 0) {
      outputItems.push({
        type: 'reasoning',
        id: `rs_${randomUUID()}`,
        summary: [{ type: 'summary_text', text: responseReasoning }],
      })
    }
    outputItems.push({
      type: 'message',
      id: `msg-${randomUUID()}`,
      status: isTruncated && !streamError ? 'incomplete' : 'completed',
      role: 'assistant',
      content: [
        {
          type: 'output_text',
          text: responseText,
          annotations: [],
        },
      ],
    })
    writeEvent('response.completed', {
      type: 'response.completed',
      response: {
        id: responseId,
        object: 'response',
        status: streamError ? 'failed' : isTruncated ? 'incomplete' : 'completed',
        ...(isTruncated && !streamError
          ? {
              incomplete_details: {
                reason: upstreamFinishReason === 'length' ? 'max_output_tokens' : 'content_filter',
              },
            }
          : {}),
        model: opts.model,
        usage: {
          input_tokens: promptTokens,
          output_tokens: completionTokens,
          total_tokens: promptTokens + completionTokens,
          ...(cachedTokens > 0 ? { input_tokens_details: { cached_tokens: cachedTokens } } : {}),
        },
        output: outputItems,
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
      // F-726(2026-11-15):优先用上游真 usage,缺失字段才回退"字符 ÷ 4"估算(与 v1-messages 同口径)。
      const estimatePromptTokens = Math.ceil(opts.promptText.length / 4)
      const estimateCompletionTokens = Math.ceil(billableCompletionChars / 4)
      const realPrompt = upstreamUsage.prompt_tokens
      const realCompletion = upstreamUsage.completion_tokens
      const promptTokens =
        typeof realPrompt === 'number' && Number.isFinite(realPrompt) && realPrompt >= 0
          ? Math.floor(realPrompt)
          : estimatePromptTokens
      const completionTokens =
        typeof realCompletion === 'number' && Number.isFinite(realCompletion) && realCompletion >= 0
          ? Math.floor(realCompletion)
          : estimateCompletionTokens
      const totalTokens = promptTokens + completionTokens
      // F-726①(2026-11-16):prompt cache token 透传给计费(OpenAI cached_tokens / Anthropic cache_creation)
      const cacheReadTokens =
        typeof upstreamUsage.prompt_tokens_details?.cached_tokens === 'number'
          ? upstreamUsage.prompt_tokens_details.cached_tokens
          : 0
      const cacheCreationTokens =
        typeof upstreamUsage.cache_creation_input_tokens === 'number'
          ? upstreamUsage.cache_creation_input_tokens
          : 0
      // F-89:已产出 token 后中断记 partial(按实际结算),零产出才记 error(免单)
      const status: 'success' | 'partial' | 'error' = streamError
        ? completionTokens > 0
          ? 'partial'
          : 'error'
        : 'success'
      // 格②(2026-09-26):总耗时与 TTFT 各取一次独立样本、各自交叉校验;不可信样本落 0 并随行标真
      const latency = persistableLatency(opts.sw.stop())
      const ttft = ttftSample === null ? null : persistableLatency(ttftSample)
      void recordCall({
        apiKeyId: opts.apiKeyId,
        userId: opts.userId,
        model: opts.model,
        prompt: opts.promptText,
        response: responseText,
        promptTokens,
        completionTokens,
        totalTokens,
        latencyMs: latency.latencyMs,
        status,
        errorMessage: streamError,
        metadata: {
          stream: true,
          protocol: 'responses',
          latencyTrusted: latency.latencyTrusted,
          ...(ttft ? { ttftTrusted: ttft.latencyTrusted } : {}),
          ...(status === 'partial' ? { partialDelivery: true } : {}),
        },
        providerCode: opts.providerCode,
        clientIp: opts.clientIp,
        // F-292:未传 mode 时 recordCall 会默认 'relay',BYOK 用户被二次全额扣费
        mode: opts.mode ?? 'relay',
        httpStatus: upstreamHttpStatus ?? undefined,
        ttftMs: ttft ? ttft.latencyMs : undefined,
        // F-726①(2026-11-16):prompt cache token 透传给计费
        cacheReadTokens,
        cacheCreationTokens,
      }).catch(() => {})
    }
  }
}

// =============================================================================
// 路由插件
// =============================================================================

// O3 能力闸:/v1/responses 需 responses:write(计费 + 幂等键登记)
const responsesCapabilityGate = requireCapabilityRules([
  { methods: ['POST'], pattern: /^\/v1\/responses(\/|$)/, scope: 'responses:write' },
])

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
      // F-299:补挂 Key 级小时/天配额闸 —— 与 /v1/messages 等其余 v1 LLM 端点同源,
      // 缺挂时 api_key_quotas 不累加、不判 429,默认配额在本端点完全失效。
      preHandler: [requireApiKeyAuth, responsesCapabilityGate, requireApiKeyQuota()],
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
      // 格②(2026-09-26):原 `const startTime = Date.now()` 是墙钟 epoch,换成单调钟表
      const sw = startStopwatch()
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

      // F-292:与 v1-messages 对齐 —— 用户对该 model 配了私有 ai_model_config 时按 BYOK 计费,
      // 只收平台费;否则 recordCall 默认 'relay' 会把上游费用再全额扣一遍。
      let billingMode: 'relay' | 'byok' = 'relay'
      if (apiKey?.userId) {
        try {
          if (await isByokCall(apiKey.userId, model)) billingMode = 'byok'
        } catch {
          // isByokCall 失败默认走 relay,不影响主链路
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
          sw,
          providerCode: modelToProviderCode(model),
          clientIp: request.ip,
          mode: billingMode,
        })
      }

      // 非流式:转发到 ai-service /api/llm/complete
      try {
        const resp = await aiServiceSystemFetch('/api/llm/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(modifiedOpenaiBody),
        })

        if (!resp.ok) {
          if (apiKey) {
            const latency = persistableLatency(sw.stop())
            void recordCall({
              apiKeyId: apiKey.id,
              userId: apiKey.userId,
              model,
              prompt: promptText,
              response: null,
              promptTokens: 0,
              completionTokens: 0,
              totalTokens: 0,
              latencyMs: latency.latencyMs,
              status: 'error',
              errorMessage: `AI service unavailable (${resp.status})`,
              metadata: { protocol: 'responses', latencyTrusted: latency.latencyTrusted },
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
          /** F-293:上游网关非流式返回的 OpenAI function calling 工具调用 */
          tool_calls?: Array<{
            id?: string
            type?: string
            function?: { name?: string; arguments?: string }
          }>
        }

        if (data.error) {
          if (apiKey) {
            const latency = persistableLatency(sw.stop())
            void recordCall({
              apiKeyId: apiKey.id,
              userId: apiKey.userId,
              model,
              prompt: promptText,
              response: null,
              promptTokens: 0,
              completionTokens: 0,
              totalTokens: 0,
              latencyMs: latency.latencyMs,
              status: 'error',
              errorMessage: data.error_message ?? 'AI service error',
              metadata: { protocol: 'responses', latencyTrusted: latency.latencyTrusted },
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
        // F-293(2026-11-15):上游返回 tool_calls 时,除 message 项外追加 function_call 输出项。
        // 旧代码只产 output_text ⇒ 工具调用被整块丢弃,/v1/responses 退化为纯文本端点。
        const toolCallOutputs: ResponsesOutputFunctionCall[] = Array.isArray(data.tool_calls)
          ? data.tool_calls
              .filter(
                (tc): tc is NonNullable<typeof tc> & { function: { name: string } } =>
                  !!tc &&
                  typeof tc === 'object' &&
                  !!tc.function &&
                  typeof tc.function.name === 'string',
              )
              .map((tc) => {
                const callId = typeof tc.id === 'string' && tc.id ? tc.id : `call_${randomUUID()}`
                return {
                  type: 'function_call' as const,
                  id: `fc_${randomUUID()}`,
                  status: 'completed' as const,
                  call_id: callId,
                  name: tc.function.name,
                  arguments: typeof tc.function.arguments === 'string' ? tc.function.arguments : '',
                }
              })
          : []
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
            ...toolCallOutputs,
          ],
          usage: {
            input_tokens: promptTokens,
            output_tokens: completionTokens,
            total_tokens: totalTokens,
          },
        }

        // 计费:调用成功,记录流水 + 扣减余额
        if (apiKey) {
          const latency = persistableLatency(sw.stop())
          recordCall({
            apiKeyId: apiKey.id,
            userId: apiKey.userId,
            model,
            prompt: promptText,
            response: data.content ?? '',
            promptTokens,
            completionTokens,
            totalTokens,
            latencyMs: latency.latencyMs,
            status: 'success',
            metadata: { protocol: 'responses', latencyTrusted: latency.latencyTrusted },
            providerCode: modelToProviderCode(model),
            clientIp: request.ip,
            // F-292:BYOK 只收平台费
            mode: billingMode,
            httpStatus: resp.status,
          }).catch((e) => {
            console.error('[v1/responses] recordCall FAIL', e?.message || e)
          })
        }

        return reply.send(result)
      } catch (e) {
        if (apiKey) {
          const latency = persistableLatency(sw.stop())
          void recordCall({
            apiKeyId: apiKey.id,
            userId: apiKey.userId,
            model,
            prompt: promptText,
            response: null,
            promptTokens: 0,
            completionTokens: 0,
            totalTokens: 0,
            latencyMs: latency.latencyMs,
            status: 'error',
            errorMessage: (e as Error).message || 'AI service unavailable',
            metadata: { protocol: 'responses', latencyTrusted: latency.latencyTrusted },
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
