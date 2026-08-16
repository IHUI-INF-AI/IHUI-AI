/**
 * OpenAI 协议扩展工具集(stream_options.include_usage + response_format json_schema + seed)
 * 主 agent 会在 v1-public.ts 的 /chat/completions 中 import 这些函数使用
 *
 * 本文件是工具函数库,不定义路由。所有函数纯函数,无副作用(除 buildStreamUsageChunk 读取 Date.now())。
 */

// =============================================================================
// 类型定义
// =============================================================================

export interface ChatCompletionRequest {
  model: string
  messages: Array<{ role: string; content: string | unknown[] }>
  stream?: boolean
  stream_options?: { include_usage?: boolean }
  response_format?:
    | { type: 'text' }
    | { type: 'json_object' }
    | {
        type: 'json_schema'
        json_schema: { name: string; schema: Record<string, unknown>; strict?: boolean }
      }
  seed?: number
  temperature?: number
  max_tokens?: number
  [key: string]: unknown
}

export interface ProtocolExtensionResult {
  openaiBody: Record<string, unknown>
  streamUsageEnabled: boolean
}

// =============================================================================
// 协议扩展工具函数
// =============================================================================

/**
 * 检测 stream_options.include_usage,标记需要在流式最后一个 chunk 注入 usage。
 * 仅当 stream=true 且未显式关闭 include_usage 时返回 true。
 */
export function detectStreamUsage(request: ChatCompletionRequest): boolean {
  return request.stream === true && request.stream_options?.include_usage !== false
}

/**
 * 构造 SSE usage chunk(符合 OpenAI chat.completion.chunk 格式)。
 * 在流式响应最后一个 chunk 发送,携带 usage 统计。
 */
export function buildStreamUsageChunk(
  id: string,
  model: string,
  promptTokens: number,
  completionTokens: number,
): string {
  const payload = {
    id,
    object: 'chat.completion.chunk',
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [] as unknown[],
    usage: {
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: promptTokens + completionTokens,
    },
  }
  return `data: ${JSON.stringify(payload)}\n\n`
}

/**
 * 应用 response_format json_schema 转换。
 * 若启用 json_schema:透传 response_format 给上游 + 在 system message 末尾追加 schema 提示。
 * 否则返回 modified=false,openaiBody 为空(由调用方决定是否透传 text/json_object)。
 */
export function applyJsonSchemaResponseFormat(request: ChatCompletionRequest): {
  modified: boolean
  openaiBody: Record<string, unknown>
} {
  const rf = request.response_format
  if (!rf || rf.type !== 'json_schema') {
    return { modified: false, openaiBody: {} }
  }
  const schemaHint = `Your response must follow this JSON schema: ${JSON.stringify(rf.json_schema.schema)}`
  const modifiedMessages = injectSystemMessage(request.messages, schemaHint)
  return {
    modified: true,
    openaiBody: {
      response_format: rf,
      messages: modifiedMessages,
    },
  }
}

/**
 * 应用 seed 参数透传。
 * seed 为 number 且在 0-999999 范围内时返回 { seed },否则返回 {}。
 * NaN/Infinity/负数/超出范围均不透传。
 */
export function applySeedParameter(request: ChatCompletionRequest): { seed?: number } {
  const { seed } = request
  if (typeof seed === 'number' && seed >= 0 && seed <= 999999) {
    return { seed }
  }
  return {}
}

/**
 * 在 system message 末尾追加内容,无 system 则在数组开头插入。
 * - 字符串 content:用 `\n\n` 分隔后拼接
 * - 数组 content(多模态):追加 { type: 'text', text } 内容块
 * 不修改原数组,返回新数组。
 */
export function injectSystemMessage(
  messages: Array<{ role: string; content: string | unknown[] }>,
  additionalContent: string,
): Array<{ role: string; content: string | unknown[] }> {
  const idx = messages.findIndex((m) => m.role === 'system')
  if (idx === -1) {
    return [{ role: 'system', content: additionalContent }, ...messages]
  }
  return messages.map((msg, i) => {
    if (i !== idx) return msg
    if (typeof msg.content === 'string') {
      return { ...msg, content: `${msg.content}\n\n${additionalContent}` }
    }
    return { ...msg, content: [...msg.content, { type: 'text', text: additionalContent }] }
  })
}

/**
 * 聚合函数:依次应用所有协议扩展,返回最终 openaiBody + streamUsageEnabled 标志。
 *
 * 处理顺序:
 * 1. 基础字段(model/messages/stream/temperature/max_tokens)
 * 2. response_format:json_schema 走转换路径(注入 system 提示),text/json_object 走透传
 * 3. seed:符合范围则透传
 * 4. streamUsageEnabled:detectStreamUsage 结果,供调用方决定是否在流末尾注入 usage chunk
 */
export function applyProtocolExtensions(request: ChatCompletionRequest): ProtocolExtensionResult {
  const openaiBody: Record<string, unknown> = {
    model: request.model,
    messages: request.messages,
  }
  if (request.stream !== undefined) openaiBody.stream = request.stream
  if (request.temperature !== undefined) openaiBody.temperature = request.temperature
  if (request.max_tokens !== undefined) openaiBody.max_tokens = request.max_tokens

  // response_format:json_schema 走转换路径,text/json_object 走透传
  const jsonSchemaResult = applyJsonSchemaResponseFormat(request)
  if (jsonSchemaResult.modified) {
    Object.assign(openaiBody, jsonSchemaResult.openaiBody)
  } else if (request.response_format !== undefined) {
    openaiBody.response_format = request.response_format
  }

  // seed 透传
  const seedResult = applySeedParameter(request)
  if (seedResult.seed !== undefined) {
    openaiBody.seed = seedResult.seed
  }

  return {
    openaiBody,
    streamUsageEnabled: detectStreamUsage(request),
  }
}
