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

export interface AnthropicThinkingBlock {
  type: 'thinking'
  thinking: string
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

/**
 * 上游 usage(OpenAI 兼容 + Anthropic prompt cache 字段)。
 * F-726:流式末帧的 usage 是唯一权威口径,cache 字段缺失时才按 estimate 计。
 */
export interface OpenAIUsage {
  prompt_tokens?: number
  completion_tokens?: number
  total_tokens?: number
  prompt_tokens_details?: { cached_tokens?: number }
  cache_read_input_tokens?: number
  cache_creation_input_tokens?: number
}

/** F-726:流式累计的上游 usage 真值;null = 上游没给,由调用方估算兜底 */
export interface UsageTotals {
  inputTokens: number | null
  outputTokens: number | null
  cacheReadInputTokens: number
  cacheCreationInputTokens: number
}

export function createUsageTotals(): UsageTotals {
  return {
    inputTokens: null,
    outputTokens: null,
    cacheReadInputTokens: 0,
    cacheCreationInputTokens: 0,
  }
}

/** 把一帧 usage 并入累计值(后到的真值覆盖先到的;不会把已有真值降级成 0) */
export function mergeOpenAIUsage(
  totals: UsageTotals,
  usage: OpenAIUsage | null | undefined,
): void {
  if (!usage) return
  if (typeof usage.prompt_tokens === 'number') {
    totals.inputTokens = Math.max(0, Math.floor(usage.prompt_tokens))
  }
  if (typeof usage.completion_tokens === 'number') {
    totals.outputTokens = Math.max(0, Math.floor(usage.completion_tokens))
  }
  const cached = usage.prompt_tokens_details?.cached_tokens ?? 0
  const cacheRead = Math.max(cached, usage.cache_read_input_tokens ?? 0)
  if (cacheRead > 0) totals.cacheReadInputTokens = Math.max(0, Math.floor(cacheRead))
  if (typeof usage.cache_creation_input_tokens === 'number') {
    totals.cacheCreationInputTokens = Math.max(0, Math.floor(usage.cache_creation_input_tokens))
  }
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
  usage?: OpenAIUsage
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
      /** 上游思维链增量(非标准 OpenAI 字段,导流模型常见) */
      reasoning_content?: string | null
      tool_calls?: Array<{
        index: number
        id?: string
        type?: string
        function?: { name?: string; arguments?: string }
      }>
    }
    finish_reason: string | null
  }>
  usage?: OpenAIUsage
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
        usage: {
          input_tokens: number
          output_tokens: number
          cache_read_input_tokens?: number
          cache_creation_input_tokens?: number
        }
      }
    }
  | {
      type: 'content_block_start'
      index: number
      content_block: AnthropicTextBlock | AnthropicToolUseBlock | AnthropicThinkingBlock
    }
  | {
      type: 'content_block_delta'
      index: number
      delta:
        | { type: 'text_delta'; text: string }
        | { type: 'input_json_delta'; partial_json: string }
        | { type: 'thinking_delta'; thinking: string }
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
  /** F-726:thinking block 当前是否打开(thinking_delta 用) */
  thinkingBlockOpen: boolean
  /** F-726:累计的上游 usage 真值(含 cache 字段);缺失时调用方按字符估算 */
  usage: UsageTotals
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
    thinkingBlockOpen: false,
    usage: createUsageTotals(),
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
  // F-726:usage 常在无 choices 的末尾帧单独到达,必须先并入状态再决定是否提前 return,
  // 否则真值永远进不了计费,只能按字符估算。
  mergeOpenAIUsage(state.usage, chunk.usage)
  const choice = chunk.choices?.[0]
  if (!choice) return events

  // 首次:message_start
  if (!state.messageStarted) {
    const startUsage: {
      input_tokens: number
      output_tokens: number
      cache_read_input_tokens?: number
      cache_creation_input_tokens?: number
    } = {
      input_tokens: state.usage.inputTokens ?? 0,
      output_tokens: 0,
    }
    if (state.usage.cacheReadInputTokens > 0) {
      startUsage.cache_read_input_tokens = state.usage.cacheReadInputTokens
    }
    if (state.usage.cacheCreationInputTokens > 0) {
      startUsage.cache_creation_input_tokens = state.usage.cacheCreationInputTokens
    }
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
        usage: startUsage,
      },
    })
    state.messageStarted = true
  }

  const delta = choice.delta

  // F-726:思维链增量 → Anthropic thinking block(旧实现直接丢弃,输出内容与计费双失)
  if (typeof delta.reasoning_content === 'string' && delta.reasoning_content.length > 0) {
    if (!state.thinkingBlockOpen) {
      // thinking 与文本/工具块互斥:先关闭已开启的文本块并让出 index
      if (state.textBlockOpen) {
        events.push({ type: 'content_block_stop', index: state.blockIndex })
        state.blockIndex += 1
        state.textBlockOpen = false
        state.contentBlockStarted = false
      }
      events.push({
        type: 'content_block_start',
        index: state.blockIndex,
        content_block: { type: 'thinking', thinking: '' },
      })
      state.thinkingBlockOpen = true
      state.contentBlockStarted = true
    }
    events.push({
      type: 'content_block_delta',
      index: state.blockIndex,
      delta: { type: 'thinking_delta', thinking: delta.reasoning_content },
    })
    state.outputChars += delta.reasoning_content.length
  }

  // 文本内容
  if (typeof delta.content === 'string' && delta.content.length > 0) {
    // thinking 块先收尾,文本另起一个 index
    if (state.thinkingBlockOpen) {
      events.push({ type: 'content_block_stop', index: state.blockIndex })
      state.blockIndex += 1
      state.thinkingBlockOpen = false
      state.contentBlockStarted = false
    }
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
        // 若有未关闭的文本块/thinking 块,先关闭并让出 index
        if (state.contentBlockStarted && state.toolBlocks.size === 0) {
          events.push({ type: 'content_block_stop', index: state.blockIndex })
          state.blockIndex += 1
          state.textBlockOpen = false
          state.thinkingBlockOpen = false
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
    if (state.thinkingBlockOpen) {
      events.push({ type: 'content_block_stop', index: state.blockIndex })
      state.blockIndex += 1
      state.thinkingBlockOpen = false
    }
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
    // F-726:上游给了 output_tokens 就用真值(含 tool_use/thinking),缺失才按字符估算
    // (1 token ≈ 4 字符,与 v1-public 流式估算一致)
    const estimatedOutputTokens = Math.max(1, Math.ceil(state.outputChars / 4))
    events.push({
      type: 'message_delta',
      delta: { stop_reason: stopReason, stop_sequence: null },
      usage: { output_tokens: state.usage.outputTokens ?? estimatedOutputTokens },
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
        // F-726:usage 可能与内容同帧(末帧),也可能单独成帧,两种都要带出去。
        const usage = readOpenAIUsage(json.usage)
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
                ...(usage ? { usage } : {}),
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
        if (typeof json.content === 'string') return makeTextChunk(json.content, model, null, usage)
        if (typeof json.token === 'string') return makeTextChunk(json.token, model, null, usage)
        const delta = json.delta as unknown
        if (isRecord(delta)) {
          if (typeof delta.content === 'string') {
            return makeTextChunk(delta.content, model, null, usage)
          }
          // reasoning_content / reasoning:思维链增量,不能当 null 丢掉
          const reasoning =
            typeof delta.reasoning_content === 'string'
              ? delta.reasoning_content
              : typeof delta.reasoning === 'string'
                ? delta.reasoning
                : ''
          if (reasoning) return makeReasoningChunk(reasoning, model, usage)
        }
        const choices = json.choices as unknown
        if (Array.isArray(choices) && choices.length > 0) {
          // 已经是 OpenAI chunk 格式
          return {
            id: `chatcmpl-${Date.now()}`,
            model,
            choices: choices as OpenAIChatChunk['choices'],
            ...(usage ? { usage } : {}),
          }
        }
        // F-726:纯 usage 帧(常见于末帧,choices 为空)——必须产出 chunk 供计费累计
        if (usage) {
          return { id: `chatcmpl-${Date.now()}`, model, choices: [], usage }
        }
      }
    } catch {
      /* not JSON */
    }
  }

  return null
}

/**
 * F-726:从上游帧里读出 usage(只认数值;`'***'` 之类脱敏字符串视为缺失)。
 * cache 兼容 OpenAI `prompt_tokens_details.cached_tokens` 与 Anthropic 两字段。
 */
function readOpenAIUsage(raw: unknown): OpenAIUsage | null {
  if (!isRecord(raw)) return null
  const num = (v: unknown): number | undefined =>
    typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : undefined
  const usage: OpenAIUsage = {}
  let found = false
  const prompt = num(raw.prompt_tokens)
  if (prompt !== undefined) {
    usage.prompt_tokens = prompt
    found = true
  }
  const completion = num(raw.completion_tokens)
  if (completion !== undefined) {
    usage.completion_tokens = completion
    found = true
  }
  const total = num(raw.total_tokens)
  if (total !== undefined) {
    usage.total_tokens = total
    found = true
  }
  const details = isRecord(raw.prompt_tokens_details) ? raw.prompt_tokens_details : null
  const cached = details ? num(details.cached_tokens) : undefined
  if (cached !== undefined) {
    usage.prompt_tokens_details = { cached_tokens: cached }
    found = true
  }
  const cacheRead = num(raw.cache_read_input_tokens)
  if (cacheRead !== undefined) {
    usage.cache_read_input_tokens = cacheRead
    found = true
  }
  const cacheCreation = num(raw.cache_creation_input_tokens)
  if (cacheCreation !== undefined) {
    usage.cache_creation_input_tokens = cacheCreation
    found = true
  }
  return found ? usage : null
}

function makeTextChunk(
  text: string,
  model: string,
  finishReason: string | null,
  usage?: OpenAIUsage | null,
): OpenAIChatChunk {
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
    ...(usage ? { usage } : {}),
  }
}

function makeReasoningChunk(
  reasoning: string,
  model: string,
  usage?: OpenAIUsage | null,
): OpenAIChatChunk {
  return {
    id: `chatcmpl-${Date.now()}`,
    model,
    choices: [
      {
        index: 0,
        delta: { reasoning_content: reasoning },
        finish_reason: null,
      },
    ],
    ...(usage ? { usage } : {}),
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
