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

import { randomBytes, randomUUID } from 'node:crypto'

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

/**
 * F-726③(2026-11-16):Anthropic thinking block(流式)。
 * 上游 OpenAI 兼容流的 delta.reasoning_content 归一为 Claude SDK 的 thinking block。
 */
export interface AnthropicThinkingBlock {
  type: 'thinking'
  thinking: string
}

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
    /** F-726①(2026-11-16):prompt cache 命中读取 token(OpenAI prompt_tokens_details.cached_tokens) */
    prompt_tokens_details?: { cached_tokens?: number }
    /** F-726①(2026-11-16):prompt cache 创建写入 token(Anthropic/混合上游) */
    cache_creation_input_tokens?: number
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
    /** F-726①(2026-11-16):prompt cache 命中读取 token(OpenAI prompt_tokens_details.cached_tokens) */
    prompt_tokens_details?: { cached_tokens?: number }
    /** F-726①(2026-11-16):prompt cache 创建写入 token(Anthropic/混合上游) */
    cache_creation_input_tokens?: number
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
  // F-295:拒答(content_filter)必须如实报成 refusal,不得洗成"正常说完"(end_turn)
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

export interface StreamState {
  messageStarted: boolean
  contentBlockStarted: boolean
  /** 当前 content block 索引(Anthropic 用 index 标识 block) */
  blockIndex: number
  model: string
  /** 累计已发送的文本字符数(用于估算 output_tokens) */
  outputChars: number
  /** 已发送的 message id(Anthropic message_start 用) */
  messageId: string
  /** 当前 tool_use block 是否已 start(用于 tool_calls 流式) */
  toolUseStarted: boolean
  /** 当前 tool_use 的 id / name(流式累计) */
  currentToolUseId: string
  currentToolUseName: string
  /**
   * F-307/F-293②(2026-11-15):按 OpenAI `tool_calls[].index` 追踪每一路工具开出的
   * Anthropic block index。增量流靠它把同一工具的后续 args 分片路由到正确 block,
   * 并让并行工具(index 0/1)各占独立 block(F-307 病灶正是忽略 index 致第二工具被吞)。
   * tool-call-start 整帧路径下,每帧工具数组各自从 0 编号,天然不串号。
   * `open` 标记该 block 是否仍开启(finish_reason 收尾时逐枚关闭,关后不再重复 stop)。
   */
  toolCallBlockByIndex: Map<number, { block: number; open: boolean }>
  /**
   * F-726③(2026-11-16):reasoning_content → thinking block 是否已 start。
   * reasoning 输出与 text 输出互斥占用同一 blockIndex(先关再开),用此标记避免重复 start。
   */
  reasoningBlockStarted: boolean
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
    toolCallBlockByIndex: new Map<number, { block: number; open: boolean }>(),
    reasoningBlockStarted: false,
  }
}

/**
 * OpenAI Chat 流式 chunk → Anthropic SSE 事件数组。
 *
 * 转换规则:
 * - 首次调用:发 message_start + content_block_start(text block)
 * - delta.content → content_block_delta(text_delta)
 * - delta.tool_calls → content_block_start(tool_use) + content_block_delta(input_json_delta)
 * - finish_reason 非 null → content_block_stop + message_delta(stop_reason) + message_stop
 *
 * 状态机:state 在调用间保持,函数 mutates state(引用传递,调用方持有同一对象)。
 * 返回的事件数组按 Anthropic SSE 顺序排列,调用方逐个 `event: type\ndata: json\n\n` 写出。
 */
export function openAIStreamChunkToAnthropicEvents(
  chunk: OpenAIChatChunk,
  state: StreamState,
  /** F-726①(2026-11-16):本 chunk 携带的上游真 usage,finish_reason 时 message_delta 用真值 */
  chunkUsage?: OpenAIChatChunk['usage'],
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

  // F-726③(2026-11-16):reasoning_content → thinking block
  // ai-service / OpenAI 兼容上游把思维链放在 delta.reasoning_content;Claude SDK
  // 需要看到 thinking block(content_block_start type:'thinking' + thinking_delta)。
  if (typeof (delta as { reasoning_content?: unknown }).reasoning_content === 'string') {
    const reasoning = (delta as { reasoning_content: string }).reasoning_content
    if (reasoning.length > 0) {
      if (!state.reasoningBlockStarted) {
        events.push({
          type: 'content_block_start',
          index: state.blockIndex,
          content_block: { type: 'thinking', thinking: '' },
        })
        state.reasoningBlockStarted = true
        state.contentBlockStarted = true
      }
      events.push({
        type: 'content_block_delta',
        index: state.blockIndex,
        delta: { type: 'thinking_delta', thinking: reasoning },
      })
      state.outputChars += reasoning.length
    }
  }

  // 文本内容(开 text block 前先关 thinking / tool block)
  if (typeof delta.content === 'string' && delta.content.length > 0) {
    if (state.reasoningBlockStarted) {
      events.push({ type: 'content_block_stop', index: state.blockIndex })
      state.blockIndex += 1
      state.reasoningBlockStarted = false
    }
    if (!state.contentBlockStarted || state.toolUseStarted) {
      // 切回 text block(若之前在 tool_use block,先关闭)
      if (state.toolUseStarted) {
        events.push({ type: 'content_block_stop', index: state.blockIndex })
        state.blockIndex += 1
        state.toolUseStarted = false
      }
      events.push({
        type: 'content_block_start',
        index: state.blockIndex,
        content_block: { type: 'text', text: '' },
      })
      state.contentBlockStarted = true
    }
    events.push({
      type: 'content_block_delta',
      index: state.blockIndex,
      delta: { type: 'text_delta', text: delta.content },
    })
    state.outputChars += delta.content.length
  }

  // tool_calls 流式(F-307 + F-293② 2026-11-15 以 **OpenAI tool_calls[].index 为主键**重构)
  //
  // 用 state.toolCallBlockByIndex(index → {block, open})追踪每一路工具,统一覆盖两种上游形态:
  //   ① OpenAI 原生**增量**流(F-307 并行工具):首个分片带 {index, id, function:{name}},后续
  //      分片只带 {index, function:{arguments:续片}}(无 id/name)。靠 index 把同一工具的续片
  //      路由到同一 block,并行工具(index 0/1)各占独立 block —— 病灶正是旧代码忽略 index,
  //      只有一个 toolUseStarted,第二工具被吞、两段 args 拼成非法 JSON。
  //   ② 上游 `tool-call-start` 自定义帧(F-293②,ai-service 裸 function calling 一次性发全量
  //      args)经 parseUpstreamLineToOpenAIChunk 还原成的 chunk:每帧每个工具都带完整
  //      {id, function:{name, arguments}},且各自 index 从 0 编号 ⇒ 每帧为该工具开一枚新
  //      block(全量 args),多帧多工具各成独立 block,不再被 `!toolUseStarted` 折叠。
  // finish_reason('tool_calls')负责关闭所有仍开启的工具 block + message_delta
  // (stop_reason:'tool_use') + message_stop。
  if (Array.isArray(delta.tool_calls)) {
    for (const tc of delta.tool_calls) {
      const tcIdx = typeof tc.index === 'number' ? tc.index : 0
      let tracked = state.toolCallBlockByIndex.get(tcIdx)
      // 该路工具首次出现(或其 block 已被收尾关闭后又来了分片)⇒ 开一枚新 tool_use block
      if (!tracked || !tracked.open) {
        // 开工具 block 前先关掉未关闭的 text block(仅首次;并行工具各自开 block 不互关)
        if (!tracked && state.contentBlockStarted && !state.toolUseStarted) {
          events.push({ type: 'content_block_stop', index: state.blockIndex })
          state.blockIndex += 1
          state.contentBlockStarted = false
        }
        const id = tc.id || `call_${randomUUID()}`
        const name = tc.function?.name
        if (!name) {
          // 边界帧既无已跟踪 block、又无 name ⇒ 无法开 block,丢弃该分片(与旧 null 行为一致)
          continue
        }
        events.push({
          type: 'content_block_start',
          index: state.blockIndex,
          content_block: {
            type: 'tool_use',
            id,
            name,
            input: {},
          },
        })
        state.currentToolUseId = id
        state.currentToolUseName = name
        tracked = { block: state.blockIndex, open: true }
        state.toolCallBlockByIndex.set(tcIdx, tracked)
        state.blockIndex += 1
        state.toolUseStarted = true
        state.contentBlockStarted = true
      }
      // arguments 增量(或 tool-call-start 的全量 args)→ 路由到该工具自己的 block
      if (tc.function?.arguments) {
        events.push({
          type: 'content_block_delta',
          index: tracked.block,
          delta: { type: 'input_json_delta', partial_json: tc.function.arguments },
        })
        state.outputChars += tc.function.arguments.length
      }
    }
  }

  // finish_reason:关闭所有仍开启的 block + message_delta + message_stop
  if (choice.finish_reason) {
    // 并行工具下可能有多枚开启的 tool block,index 感知逐枚关闭(F-307)
    for (const [, tracked] of state.toolCallBlockByIndex) {
      if (tracked.open) {
        events.push({ type: 'content_block_stop', index: tracked.block })
        tracked.open = false
      }
    }
    if (state.reasoningBlockStarted) {
      events.push({ type: 'content_block_stop', index: state.blockIndex })
      state.blockIndex += 1
      state.reasoningBlockStarted = false
    }
    if (state.contentBlockStarted) {
      events.push({ type: 'content_block_stop', index: state.blockIndex })
      state.blockIndex += 1
      state.contentBlockStarted = false
      state.toolUseStarted = false
    }
    const stopReason = FINISH_REASON_MAP[choice.finish_reason] ?? 'end_turn'
    // F-726①(2026-11-16):优先用上游真 usage(prompt→input_tokens;completion→output_tokens),
    // 缺失字段才回退"字符 ÷ 4"估算。中文(≈1 字符/token)与 tool JSON 输出旧估算系统性少计 3~6 倍。
    const realCompletion = chunkUsage?.completion_tokens
    const estimatedOutputTokens = Math.max(1, Math.ceil(state.outputChars / 4))
    const outputTokens =
      typeof realCompletion === 'number' && Number.isFinite(realCompletion) && realCompletion >= 0
        ? Math.floor(realCompletion)
        : estimatedOutputTokens
    const realPrompt = chunkUsage?.prompt_tokens
    const inputTokens =
      typeof realPrompt === 'number' && Number.isFinite(realPrompt) && realPrompt >= 0
        ? Math.floor(realPrompt)
        : 0
    events.push({
      type: 'message_delta',
      delta: { stop_reason: stopReason, stop_sequence: null },
      usage: {
        output_tokens: outputTokens,
        // Anthropic message_delta.usage 允许累积 input_tokens(真值时上报,估算时不覆盖 message_start 的值)
        ...(chunkUsage?.prompt_tokens !== undefined ? { input_tokens: inputTokens } : {}),
      },
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
 * - data: [DONE] → 返回 null
 */
export function parseUpstreamLineToOpenAIChunk(
  line: string,
  model: string,
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
        if (typeof json.content === 'string') return makeTextChunk(json.content, model, null)
        if (typeof json.token === 'string') return makeTextChunk(json.token, model, null)
        const delta = json.delta as unknown
        if (isRecord(delta) && typeof delta.content === 'string') {
          return makeTextChunk(delta.content, model, null)
        }
        // F-295/F-726(2026-11-15):ai-service 主聊天流 `/api/llm/complete/stream` 的收尾帧是
        // 自定义 `{"type":"done","usage":{...},"finishReason":"..."}`(见 llm.py done_event),
        // 文本帧是 `{"type":"chunk","content":"..."}`。旧解析器在 done 帧上三个分支全不命中
        // ⇒ 返回 null ⇒ **usage 与 finishReason 整帧被丢**。后果有二,都跨端:
        //   ① F-295:路由收不到 finishReason ⇒ 走"兜底补 stop" ⇒ 截断(length)/拒答被洗成 end_turn;
        //   ② F-726:路由收不到 usage ⇒ 计费退回"字符数 ÷ 4"估算 ⇒ 中文/tool 输出系统性少计 3~6 倍。
        // 这里把 done 帧还原成 OpenAI 收尾 chunk(空 delta + finish_reason + usage),
        // 让既有 `openAIStreamChunkToAnthropicEvents` 的 finish_reason 那一支照常产出
        // message_delta(stop_reason) —— 与 OpenAI 兼容流同一收尾语义,不另立一套。
        if (json.type === 'done') {
          const fr = typeof json.finishReason === 'string' ? json.finishReason.trim() : ''
          return makeUsageFinishChunk(model, fr || null, json.usage)
        }
        // F-293②(2026-11-15):裸 function calling 下,ai-service 把上游 tool_calls 一次性
        // 转成 `{"type":"tool-call-start","toolCallId","toolName","args"}` 自定义帧(不再分片,
        // args 已归一为对象)。旧解析器对此返回 null ⇒ 流式 /v1/messages 客户端永远收不到
        // tool_use block(Claude SDK / Codex 用工具即空回复)。这里把它还原成"带完整
        // delta.tool_calls 数组 + finish_reason:'tool_calls'"的 OpenAI chunk,由
        // openAIStreamChunkToAnthropicEvents 产出一枚独立 tool_use block(全量 args)并收尾。
        if (json.type === 'tool-call-start') {
          const toolCallId = typeof json.toolCallId === 'string' ? json.toolCallId : ''
          const toolName = typeof json.toolName === 'string' ? json.toolName : ''
          if (!toolName) return null
          // args 在上游已归一为对象;个别残缺仍可能是字符串,统一序列化成 OpenAI arguments 串
          const argsVal = json.args
          const argsStr =
            typeof argsVal === 'string'
              ? argsVal
              : argsVal !== undefined && argsVal !== null
                ? JSON.stringify(argsVal)
                : ''
          return {
            id: `chatcmpl-${Date.now()}`,
            model,
            choices: [
              {
                index: 0,
                delta: {
                  tool_calls: [
                    {
                      index: 0,
                      id: toolCallId || `call_${randomUUID()}`,
                      type: 'function',
                      function: { name: toolName, arguments: argsStr },
                    },
                  ],
                },
                finish_reason: 'tool_calls',
              },
            ],
          }
        }
        const choices = json.choices as unknown
        if (Array.isArray(choices) && choices.length > 0) {
          // 已经是 OpenAI chunk 格式
          return {
            id: `chatcmpl-${Date.now()}`,
            model,
            choices: choices as OpenAIChatChunk['choices'],
            // F-726:usage 与 choices 同层,旧代码整块丢弃 ⇒ 透传保留
            ...(isRecord(json.usage) ? { usage: json.usage } : {}),
          }
        }
        // F-726:部分 OpenAI 兼容上游把 usage 放在 choices 为空的收尾 chunk 里
        // (`{"choices":[],"usage":{...}}`)。旧适配器在 `!choice` 时整帧丢弃 ⇒ 真 usage 丢失。
        // 这里让"无 choices 但带 usage"的帧也能透传 usage,由适配器单独消化。
        if (Array.isArray(choices) && choices.length === 0 && isRecord(json.usage)) {
          return makeUsageFinishChunk(model, null, json.usage)
        }
      }
    } catch {
      /* not JSON */
    }
  }

  return null
}

/**
 * 构造一枚"带 usage(可选)+ finish_reason(可选)、无正文 delta"的收尾 chunk。
 *
 * F-295/F-726 共用:done 帧(自定义)与"choices 为空但带 usage"的 OpenAI 兼容帧都经此还原。
 * usage 只认 prompt_tokens/completion_tokens/total_tokens 三个数值字段(与 OpenAIChatChunk.usage
 * 同形);ai-service done 帧 usage 就是这个形状,llm_gateway 已归一。
 */
function makeUsageFinishChunk(
  model: string,
  finishReason: string | null,
  usage: unknown,
): OpenAIChatChunk {
  const usageOut: OpenAIChatChunk['usage'] | undefined = (() => {
    if (!isRecord(usage)) return undefined
    const prompt = usage.prompt_tokens
    const completion = usage.completion_tokens
    const total = usage.total_tokens
    const hasAny =
      typeof prompt === 'number' || typeof completion === 'number' || typeof total === 'number'
    if (!hasAny) return undefined
    const pick = (v: unknown): number | undefined =>
      typeof v === 'number' && Number.isFinite(v) ? v : undefined
    return {
      ...(typeof prompt === 'number' ? { prompt_tokens: pick(prompt) } : {}),
      ...(typeof completion === 'number' ? { completion_tokens: pick(completion) } : {}),
      ...(typeof total === 'number' ? { total_tokens: pick(total) } : {}),
    }
  })()
  return {
    id: `chatcmpl-${Date.now()}`,
    model,
    choices: [
      {
        index: 0,
        delta: {},
        finish_reason: finishReason,
      },
    ],
    ...(usageOut ? { usage: usageOut } : {}),
  }
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
