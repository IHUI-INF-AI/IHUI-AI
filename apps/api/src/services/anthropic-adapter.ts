// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Anthropic Messages ↔ OpenAI Chat Completions 转换层(2026-07-31 立,P0-6)。
 *
 * 让 Claude SDK(anthropic-sdk-python / @anthropic-ai/sdk)用户无需改代码即可接入
 * IHUI 中转站:API 层接收 Anthropic Messages 原生格式 → 转 OpenAI 格式走现有
 * relay 调用链(ai-service /api/llm/complete[/stream])→ 响应/SSE 转回 Anthropic 格式。
 *
 * 设计要点:
 * - 类型自包含在本文件,不依赖 @ihui/types,避免与其他 subagent 改 packages/types 冲突。
 * - 禁用 any,用 unknown + 类型守卫(AGENTS.md §3)。
 * - 4 个纯函数 + 1 个流式状态机工厂,无副作用,便于单测。
 * - ai-service 已有 protocol_adapter.py(P0-2a),但 API 层走 v1-public relay 调用链,
 *   不直接调 ai-service,故本文件是 TS 版独立实现(不复用 Python 版)。
 */

import { randomBytes } from 'node:crypto'

// =============================================================================
// Anthropic 端类型(自包含,只覆盖 IHUI 中转站需要字段子集)
// =============================================================================

export interface AnthropicTextBlock {
  type: 'text'
  text: string
}

export interface AnthropicToolUseBlock {
  type: 'tool_use'
  id: string
  name: string
  input: unknown
}

export interface AnthropicToolResultBlock {
  type: 'tool_result'
  tool_use_id: string
  content: string | Array<{ type: 'text'; text: string }>
}

export type AnthropicContentBlock =
  AnthropicTextBlock | AnthropicToolUseBlock | AnthropicToolResultBlock

export interface AnthropicMessage {
  role: 'user' | 'assistant'
  content: string | AnthropicContentBlock[]
}

export interface AnthropicTool {
  name: string
  description?: string
  input_schema: Record<string, unknown>
}

export interface AnthropicToolChoice {
  type: 'auto' | 'any' | 'tool'
  name?: string
}

export interface AnthropicMessagesRequest {
  model: string
  messages: AnthropicMessage[]
  system?: string | Array<{ type: 'text'; text: string }>
  max_tokens: number
  tools?: AnthropicTool[]
  tool_choice?: AnthropicToolChoice
  stream?: boolean
  temperature?: number
  top_p?: number
  stop_sequences?: string[]
  metadata?: Record<string, unknown>
}

export interface AnthropicMessagesResponse {
  id: string
  type: 'message'
  role: 'assistant'
  model: string
  content: Array<AnthropicTextBlock | AnthropicToolUseBlock>
  stop_reason: 'end_turn' | 'max_tokens' | 'tool_use' | 'stop_sequence' | 'refusal'
  stop_sequence: string | null
  usage: { input_tokens: number; output_tokens: number }
}

// =============================================================================
// OpenAI 端类型(自包含子集)
// =============================================================================

export interface OpenAIChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  /** OpenAI tool_calls(assistant 调用工具时) */
  tool_calls?: Array<{
    id: string
    type: 'function'
    function: { name: string; arguments: string }
  }>
  /** OpenAI tool 角色消息携带的 tool_call_id */
  tool_call_id?: string
}

export interface OpenAITool {
  type: 'function'
  function: {
    name: string
    description?: string
    parameters: Record<string, unknown>
  }
}

export interface OpenAIChatRequest {
  model: string
  messages: OpenAIChatMessage[]
  max_tokens?: number
  tools?: OpenAITool[]
  tool_choice?: 'auto' | 'none' | { type: 'function'; function: { name: string } }
  stream?: boolean
  temperature?: number
  top_p?: number
  stop?: string[]
  metadata?: Record<string, unknown>
}

export interface OpenAIChatResponse {
  id: string
  object?: string
  created?: number
  model?: string
  choices: Array<{
    index: number
    message: {
      role: string
      content: string | null
      tool_calls?: Array<{
        id: string
        type: 'function'
        function: { name: string; arguments: string }
      }>
    }
    finish_reason: string
  }>
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
    total_tokens?: number
  }
}

export interface OpenAIChatChunk {
  id: string
  object?: string
  created?: number
  model?: string
  choices: Array<{
    index: number
    delta: {
      role?: string
      content?: string | null
      tool_calls?: Array<{
        index: number
        id?: string
        type?: string
        function?: { name?: string; arguments?: string }
      }>
    }
    finish_reason: string | null
  }>
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
    total_tokens?: number
  }
}

// =============================================================================
// Anthropic SSE 事件类型
// =============================================================================

export type AnthropicSSEEvent =
  | {
      type: 'message_start'
      message: {
        id: string
        type: 'message'
        role: 'assistant'
        model: string
        content: []
        stop_reason: null
        stop_sequence: null
        usage: { input_tokens: number; output_tokens: number }
      }
    }
  | {
      type: 'content_block_start'
      index: number
      content_block: AnthropicTextBlock | AnthropicToolUseBlock
    }
  | {
      type: 'content_block_delta'
      index: number
      delta:
        { type: 'text_delta'; text: string } | { type: 'input_json_delta'; partial_json: string }
    }
  | { type: 'content_block_stop'; index: number }
  | {
      type: 'message_delta'
      delta: { stop_reason: string; stop_sequence: string | null }
      usage: { output_tokens: number }
    }
  | { type: 'message_stop' }

// =============================================================================
// 类型守卫工具(禁用 any,用 unknown + 守卫)
// =============================================================================

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

// =============================================================================
// 1. Anthropic Messages 请求 → OpenAI Chat Completions 请求
// =============================================================================

/**
 * 将 Anthropic content block 数组转为 OpenAI 消息片段。
 * - text block → 拼接到文本
 * - tool_use(assistant)→ 转为 OpenAI assistant tool_calls(单独返回)
 * - tool_result(user)→ 转为 OpenAI tool 角色消息(单独返回,不拼文本)
 *
 * 返回 [文本片段, 额外 OpenAI 消息数组]。文本为空时返回 ''。
 */
function flattenAnthropicContent(content: AnthropicContentBlock[]): {
  text: string
  toolCalls: NonNullable<OpenAIChatMessage['tool_calls']>
  toolMessages: OpenAIChatMessage[]
} {
  const textParts: string[] = []
  const toolCalls: NonNullable<OpenAIChatMessage['tool_calls']> = []
  const toolMessages: OpenAIChatMessage[] = []

  for (const block of content) {
    if (block.type === 'text') {
      textParts.push(block.text)
    } else if (block.type === 'tool_use') {
      toolCalls.push({
        id: block.id,
        type: 'function',
        function: {
          name: block.name,
          arguments:
            typeof block.input === 'string' ? block.input : JSON.stringify(block.input ?? {}),
        },
      })
    } else if (block.type === 'tool_result') {
      const resultText =
        typeof block.content === 'string'
          ? block.content
          : Array.isArray(block.content)
            ? block.content.map((c) => c.text).join('\n')
            : ''
      toolMessages.push({
        role: 'tool',
        content: resultText,
        tool_call_id: block.tool_use_id,
      })
    }
  }

  return { text: textParts.join('\n'), toolCalls, toolMessages }
}

/**
 * Anthropic Messages 请求 → OpenAI Chat Completions 请求。
 *
 * 转换规则:
 * - system 字段(Anthropic 顶层)→ messages[0] {role:'system'}(OpenAI)
 * - messages[].content(string)→ {role, content: string}
 * - messages[].content(array of content_block)→ 拼接 text blocks 为 string,
 *   tool_use → OpenAI assistant tool_calls,tool_result → OpenAI tool 角色消息
 * - max_tokens → max_tokens(同名)
 * - tools(Anthropic)→ tools(OpenAI function 格式)
 * - tool_choice → tool_choice
 * - stream → stream
 * - stop_sequences → stop
 * - top_p → top_p,temperature → temperature
 */
export function anthropicRequestToOpenAI(input: AnthropicMessagesRequest): OpenAIChatRequest {
  const messages: OpenAIChatMessage[] = []

  // system → messages[0]
  if (input.system !== undefined) {
    const sysText =
      typeof input.system === 'string'
        ? input.system
        : Array.isArray(input.system)
          ? input.system
              .map((s) => (isRecord(s) && typeof s.text === 'string' ? s.text : ''))
              .join('\n')
          : ''
    if (sysText) messages.push({ role: 'system', content: sysText })
  }

  // messages 转换
  for (const msg of input.messages) {
    if (typeof msg.content === 'string') {
      messages.push({ role: msg.role, content: msg.content })
      continue
    }

    // content block 数组
    const { text, toolCalls, toolMessages } = flattenAnthropicContent(msg.content)
    if (msg.role === 'assistant') {
      const assistantMsg: OpenAIChatMessage = {
        role: 'assistant',
        content: text || '',
      }
      if (toolCalls.length > 0) assistantMsg.tool_calls = toolCalls
      messages.push(assistantMsg)
    } else {
      // user 角色:text 作为 user 消息,tool_result 作为 tool 消息
      if (text) messages.push({ role: 'user', content: text })
      // tool_result 消息放在 user 消息之后(OpenAI 要求 tool 消息跟在 assistant tool_calls 之后)
      for (const tm of toolMessages) messages.push(tm)
    }
  }

  const out: OpenAIChatRequest = {
    model: input.model,
    messages,
  }
  if (input.max_tokens !== undefined) out.max_tokens = input.max_tokens
  if (input.temperature !== undefined) out.temperature = input.temperature
  if (input.top_p !== undefined) out.top_p = input.top_p
  if (input.stop_sequences && input.stop_sequences.length > 0) out.stop = input.stop_sequences
  if (input.stream !== undefined) out.stream = input.stream
  if (input.metadata !== undefined) out.metadata = input.metadata

  if (input.tools && input.tools.length > 0) {
    out.tools = input.tools.map((t) => ({
      type: 'function' as const,
      function: {
        name: t.name,
        ...(t.description !== undefined ? { description: t.description } : {}),
        parameters: t.input_schema,
      },
    }))
  }

  if (input.tool_choice) {
    if (input.tool_choice.type === 'auto') out.tool_choice = 'auto'
    else if (input.tool_choice.type === 'any') out.tool_choice = 'auto'
    else if (input.tool_choice.type === 'tool' && input.tool_choice.name) {
      out.tool_choice = { type: 'function', function: { name: input.tool_choice.name } }
    }
  }

  return out
}

// =============================================================================
// 2. OpenAI Chat 响应 → Anthropic Messages 响应(非流式)
// =============================================================================

const FINISH_REASON_MAP: Record<string, AnthropicMessagesResponse['stop_reason']> = {
  stop: 'end_turn',
  length: 'max_tokens',
  tool_calls: 'tool_use',
  function_call: 'tool_use',
  // F-295:内容过滤是"拒答",不是"正常说完";Anthropic 语义用 refusal。
  content_filter: 'refusal',
}

/**
 * OpenAI Chat 响应 → Anthropic Messages 响应(非流式)。
 *
 * - choices[0].message.content → content: [{type:'text', text}]
 * - choices[0].message.tool_calls → 追加 {type:'tool_use', id, name, input}
 * - finish_reason → stop_reason 映射(stop→end_turn, length→max_tokens, tool_calls→tool_use)
 * - usage.prompt_tokens → usage.input_tokens
 * - usage.completion_tokens → usage.output_tokens
 */
export function openAIResponseToAnthropic(
  resp: OpenAIChatResponse,
  model: string,
): AnthropicMessagesResponse {
  const choice = resp.choices?.[0]
  const msg = choice?.message
  const content: Array<AnthropicTextBlock | AnthropicToolUseBlock> = []

  if (msg) {
    if (typeof msg.content === 'string' && msg.content.length > 0) {
      content.push({ type: 'text', text: msg.content })
    } else if (typeof msg.content === 'string' && msg.content.length === 0) {
      // 空文本 + 有 tool_calls 时不push空 text block(Anthropic 习惯)
    }
    if (Array.isArray(msg.tool_calls)) {
      for (const tc of msg.tool_calls) {
        let parsedInput: unknown = {}
        try {
          parsedInput = tc.function.arguments ? JSON.parse(tc.function.arguments) : {}
        } catch {
          parsedInput = tc.function.arguments
        }
        content.push({
          type: 'tool_use',
          id: tc.id,
          name: tc.function.name,
          input: parsedInput,
        })
      }
    }
  }

  const finishReason = choice?.finish_reason ?? 'stop'
  const stopReason = FINISH_REASON_MAP[finishReason] ?? 'end_turn'

  const inputTokens = resp.usage?.prompt_tokens ?? 0
  const outputTokens = resp.usage?.completion_tokens ?? 0

  return {
    id: resp.id || `msg_${Date.now()}`,
    type: 'message',
    role: 'assistant',
    model: resp.model ?? model,
    content,
    stop_reason: stopReason,
    stop_sequence: null,
    usage: {
      input_tokens: typeof inputTokens === 'number' ? inputTokens : 0,
      output_tokens: typeof outputTokens === 'number' ? outputTokens : 0,
    },
  }
}

// =============================================================================
// 3 & 4. 流式状态机 + OpenAI Chat 流式 chunk → Anthropic SSE 事件数组
// =============================================================================

export interface ToolBlockState {
  /** 该工具独占的 Anthropic content block index */
  blockIndex: number
  /** 是否已发 content_block_start */
  started: boolean
}

export interface StreamState {
  messageStarted: boolean
  /** 是否有任一 content block 处于打开状态(路由收尾兜底用) */
  contentBlockStarted: boolean
  /** 当前文本块索引;同时作为新 content block 的分配游标 */
  blockIndex: number
  model: string
  /** 累计已发送的文本字符数(用于估算 output_tokens) */
  outputChars: number
  /** 已发送的 message id(Anthropic message_start 用) */
  messageId: string
  /** 是否已有 tool_use block 开启(兼容旧语义) */
  toolUseStarted: boolean
  /** 最近一条 tool_use 的 id / name(流式累计) */
  currentToolUseId: string
  currentToolUseName: string
  /** 文本块当前是否打开 */
  textBlockOpen: boolean
  /** F-307:按 tool_calls[].index 分开维护各自独立的 tool_use block */
  toolBlocks: Map<number, ToolBlockState>
  /** F-295:本流是否已按上游 finish_reason 收尾(路由据此区分"真没发"的补尾) */
  finished: boolean
  /** F-295:未知 finish_reason / 兜底的日志出口(路由注入 request.log.warn) */
  warn?: (message: string) => void
}

export function createStreamState(model: string): StreamState {
  return {
    messageStarted: false,
    contentBlockStarted: false,
    blockIndex: 0,
    model,
    outputChars: 0,
    // 2026-08-02 P2 安全加固：用 CSPRNG 替换 Math.random，防止 messageId 被预测
    messageId: `msg_${Date.now()}_${randomBytes(6).toString('hex')}`,
    toolUseStarted: false,
    currentToolUseId: '',
    currentToolUseName: '',
    textBlockOpen: false,
    toolBlocks: new Map(),
    finished: false,
  }
}

/**
 * OpenAI Chat 流式 chunk → Anthropic SSE 事件数组。
 *
 * 转换规则:
 * - 首次调用:发 message_start + content_block_start(text block)
 * - delta.content → content_block_delta(text_delta)
 * - delta.tool_calls → 按 tool_calls[].index 各自 content_block_start(tool_use)
 *   + content_block_delta(input_json_delta),并行工具互不合并
 * - finish_reason 非 null → 关闭全部 block + message_delta(stop_reason) + message_stop
 *
 * 状态机:state 在调用间保持,函数 mutates state(引用传递,调用方持有同一对象)。
 * 返回的事件数组按 Anthropic SSE 顺序排列,调用方逐个 `event: type\ndata: json\n\n` 写出。
 */
export function openAIStreamChunkToAnthropicEvents(
  chunk: OpenAIChatChunk,
  state: StreamState,
): AnthropicSSEEvent[] {
  const events: AnthropicSSEEvent[] = []
  const choice = chunk.choices?.[0]
  if (!choice) return events

  // 首次:message_start
  if (!state.messageStarted) {
    events.push({
      type: 'message_start',
      message: {
        id: state.messageId,
        type: 'message',
        role: 'assistant',
        model: state.model,
        content: [],
        stop_reason: null,
        stop_sequence: null,
        usage: { input_tokens: chunk.usage?.prompt_tokens ?? 0, output_tokens: 0 },
      },
    })
    state.messageStarted = true
  }

  const delta = choice.delta

  // 文本内容
  if (typeof delta.content === 'string' && delta.content.length > 0) {
    // 文本块与工具块互斥:先关闭所有已开启的 tool_use block
    const openTools = Array.from(state.toolBlocks.values()).filter((b) => b.started)
    if (openTools.length > 0) {
      for (const b of openTools) {
        events.push({ type: 'content_block_stop', index: b.blockIndex })
        b.started = false
      }
      state.toolUseStarted = false
      state.contentBlockStarted = false
    }
    if (!state.textBlockOpen) {
      events.push({
        type: 'content_block_start',
        index: state.blockIndex,
        content_block: { type: 'text', text: '' },
      })
      state.textBlockOpen = true
      state.contentBlockStarted = true
    }
    events.push({
      type: 'content_block_delta',
      index: state.blockIndex,
      delta: { type: 'text_delta', text: delta.content },
    })
    state.outputChars += delta.content.length
  }

  // tool_calls 流式:F-307 每个 tool_calls[].index 各自独立 start/delta/stop
  if (Array.isArray(delta.tool_calls)) {
    for (const tc of delta.tool_calls) {
      // 缺省 index 视作 0,兼容不带 index 的单工具老流
      const toolKey = typeof tc.index === 'number' ? tc.index : 0
      const hasIdentity = Boolean(tc.id || tc.function?.name)

      let block = state.toolBlocks.get(toolKey)
      if (!block && hasIdentity) {
        // 若有未关闭的文本块,先关闭并让出 index
        if (state.contentBlockStarted && state.toolBlocks.size === 0) {
          events.push({ type: 'content_block_stop', index: state.blockIndex })
          state.blockIndex += 1
          state.textBlockOpen = false
          state.contentBlockStarted = false
        }
        block = { blockIndex: state.blockIndex, started: false }
        state.blockIndex += 1
        state.toolBlocks.set(toolKey, block)
      }

      // 每个 index 首次拿到 id/name 时独立 content_block_start
      if (block && !block.started && hasIdentity) {
        const id = tc.id ?? ''
        const name = tc.function?.name ?? ''
        state.currentToolUseId = id
        state.currentToolUseName = name
        events.push({
          type: 'content_block_start',
          index: block.blockIndex,
          content_block: { type: 'tool_use', id, name, input: {} },
        })
        block.started = true
        state.toolUseStarted = true
        state.contentBlockStarted = true
      }

      // arguments 增量只写回该 index 自己的 block
      if (block?.started && tc.function?.arguments) {
        events.push({
          type: 'content_block_delta',
          index: block.blockIndex,
          delta: { type: 'input_json_delta', partial_json: tc.function.arguments },
        })
        state.outputChars += tc.function.arguments.length
      }
    }
  }

  // finish_reason:关闭所有 block + message_delta + message_stop
  if (choice.finish_reason) {
    for (const block of state.toolBlocks.values()) {
      if (block.started) {
        events.push({ type: 'content_block_stop', index: block.blockIndex })
        block.started = false
      }
    }
    state.toolBlocks.clear()
    state.toolUseStarted = false
    if (state.textBlockOpen) {
      events.push({ type: 'content_block_stop', index: state.blockIndex })
      state.blockIndex += 1
      state.textBlockOpen = false
    }
    state.contentBlockStarted = false
    state.finished = true
    // F-295:未知值不硬编码成 end_turn —— 走既有兜底,但必须留痕,便于定位上游新枚举。
    const mappedStopReason = FINISH_REASON_MAP[choice.finish_reason]
    if (mappedStopReason === undefined) {
      state.warn?.(`[anthropic-adapter] 未知 finish_reason=${JSON.stringify(choice.finish_reason)},已按 end_turn 兜底`)
    }
    const stopReason = mappedStopReason ?? 'end_turn'
    // 估算 output_tokens(1 token ≈ 4 字符,与 v1-public 流式估算一致)
    const estimatedOutputTokens = Math.max(1, Math.ceil(state.outputChars / 4))
    events.push({
      type: 'message_delta',
      delta: { stop_reason: stopReason, stop_sequence: null },
      usage: { output_tokens: estimatedOutputTokens },
    })
    events.push({ type: 'message_stop' })
  }

  return events
}

// =============================================================================
// 辅助:SSE 序列化(路由层用)
// =============================================================================

/**
 * 将 AnthropicSSEEvent 序列化为 SSE 行(`event: type\ndata: json\n\n`)。
 * 路由层流式写出时调用此函数。
 */
export function serializeAnthropicSSEEvent(event: AnthropicSSEEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`
}

/**
 * 从上游 SSE 行中提取 OpenAI 风格 chunk(复用 v1-public 的 extractStreamText 逻辑,
 * 但包装为 OpenAIChatChunk 形状,便于喂给 openAIStreamChunkToAnthropicEvents)。
 *
 * 支持:
 * - Vercel AI SDK: 0:"text"
 * - SSE data: {choices:[{delta:{content}}]} / {delta:{content}} / {content} / {token} / string
 * - SSE data: {"type":"done","finishReason":"..."} → 带 finish_reason 的收尾 chunk(F-295)
 * - SSE data: {"type":"tool-call-start"...} / {"type":"tool-call-args-delta"...}
 *   → OpenAI `delta.tool_calls` chunk(F-293)
 * - data: [DONE] → 返回 null
 *
 * @param toolIndexRef F-293:同一工具调用的多个 `tool-call-start` 帧需要各自独立的
 *   tool_calls index(否则 Anthropic 侧会合并成一个块)。调用方按流创建
 *   `{ next: 0 }` 并复用;缺省时按 0 处理(单工具/纯函数单测)。
 */
export function parseUpstreamLineToOpenAIChunk(
  line: string,
  model: string,
  toolIndexRef?: { next: number },
): OpenAIChatChunk | null {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith(':')) return null

  // Vercel AI SDK: 0:"text"
  const vercelMatch = /^(\d+):(.+)$/.exec(trimmed)
  if (vercelMatch) {
    const type = vercelMatch[1]
    const payload = vercelMatch[2]
    if (type === '0' && payload) {
      try {
        const text = JSON.parse(payload)
        if (typeof text === 'string') {
          return makeTextChunk(text, model, null)
        }
      } catch {
        /* not JSON */
      }
    }
    return null
  }

  if (trimmed.startsWith('data:')) {
    const data = trimmed.slice(5).trim()
    if (!data || data === '[DONE]') return null
    try {
      const json = JSON.parse(data) as unknown
      if (typeof json === 'string') return makeTextChunk(json, model, null)
      if (isRecord(json)) {
        // F-295:ai-service 的 `event: done` 帧把上游结束原因放在 finishReason 里。
        // 旧实现没有这一支 ⇒ done 帧被丢弃 ⇒ 路由补 stop ⇒ 截断(length)/内容过滤
        // (content_filter)被洗成 end_turn。这里转成带 finish_reason 的收尾 chunk,
        // 由 openAIStreamChunkToAnthropicEvents 统一映射;缺席不造值(留给路由兜底并留痕)。
        if (json.type === 'done') {
          const rawFinishReason =
            typeof json.finishReason === 'string' ? json.finishReason.trim() : ''
          return rawFinishReason
            ? {
                id: `chatcmpl-${Date.now()}`,
                model,
                choices: [{ index: 0, delta: {}, finish_reason: rawFinishReason }],
              }
            : null
        }
        // F-293:工具帧映射。此前这几种帧一律落到函数末尾的 null,流式工具调用整条丢失。
        // - tool-call-args-delta:逐片入参(对象形态、非增量字符串)。只用来提前开块,
        //   不把分片序列化后当 partial_json 拼 —— 多段 JSON 拼接后客户端无法解析。
        // - tool-call-start:聚合后的完整 id/name/args,才是 tool_use 的权威入参。
        if (json.type === 'tool-call-args-delta') {
          const id = typeof json.id === 'string' ? json.id : ''
          const name = typeof json.name === 'string' ? json.name : ''
          // 续片常只有 args 没有 name;此时开块会得到空 name 的 tool_use,故只认带 name 的帧。
          if (!name) return null
          const index = typeof json.index === 'number' ? json.index : 0
          return {
            id: `chatcmpl-${Date.now()}`,
            model,
            choices: [
              {
                index: 0,
                delta: {
                  tool_calls: [{ index, id, type: 'function', function: { name, arguments: '' } }],
                },
                finish_reason: null,
              },
            ],
          }
        }
        if (json.type === 'tool-call-start') {
          const id = typeof json.toolCallId === 'string' ? json.toolCallId : ''
          const name = typeof json.toolName === 'string' ? json.toolName : ''
          const index = toolIndexRef ? toolIndexRef.next++ : 0
          return {
            id: `chatcmpl-${Date.now()}`,
            model,
            choices: [
              {
                index: 0,
                delta: {
                  tool_calls: [
                    {
                      index,
                      id,
                      type: 'function',
                      function: {
                        name,
                        arguments: JSON.stringify(json.args ?? {}),
                      },
                    },
                  ],
                },
                finish_reason: null,
              },
            ],
          }
        }
        if (typeof json.content === 'string') return makeTextChunk(json.content, model, null)
        if (typeof json.token === 'string') return makeTextChunk(json.token, model, null)
        const delta = json.delta as unknown
        if (isRecord(delta) && typeof delta.content === 'string') {
          return makeTextChunk(delta.content, model, null)
        }
        const choices = json.choices as unknown
        if (Array.isArray(choices) && choices.length > 0) {
          // 已经是 OpenAI chunk 格式
          return {
            id: `chatcmpl-${Date.now()}`,
            model,
            choices: choices as OpenAIChatChunk['choices'],
          }
        }
      }
    } catch {
      /* not JSON */
    }
  }

  return null
}

function makeTextChunk(text: string, model: string, finishReason: string | null): OpenAIChatChunk {
  return {
    id: `chatcmpl-${Date.now()}`,
    model,
    choices: [
      {
        index: 0,
        delta: { content: text },
        finish_reason: finishReason,
      },
    ],
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
