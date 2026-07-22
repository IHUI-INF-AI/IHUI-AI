/**
 * SSE 流式响应解析器。
 *
 * 支持两种流式端点:
 * - POST /v1/chat/completions(stream:true)→ OpenAI 兼容 `data: {json}\n\n` + `data: [DONE]`
 * - POST /v1/agents/execute/stream → 逐行透传 SSE 事件
 */

/** chat.completions 流式 chunk(OpenAI 兼容)。 */
export interface ChatStreamChunk {
  id: string
  object: 'chat.completion.chunk'
  created: number
  model: string
  choices: Array<{
    index: number
    delta: { role?: string; content?: string }
    finishReason?: string | null
  }>
}

/** Agent 执行流式事件。 */
export interface AgentStreamEvent {
  type: 'data' | 'event' | 'raw'
  data: Record<string, unknown>
}

/**
 * 解析 chat.completions SSE 流(OpenAI 兼容 `data: {json}\n\n` 格式)。
 * 遇到 `data: [DONE]` 时结束。
 */
export async function* parseChatStream(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<ChatStreamChunk> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data:')) continue

        const payload = trimmed.slice(5).trim()
        if (payload === '[DONE]') return

        try {
          yield JSON.parse(payload) as ChatStreamChunk
        } catch {
          // 跳过无法解析的行(心跳/注释)
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

/**
 * 解析 Agent 执行 SSE 流(逐行透传 data/event/raw)。
 */
export async function* parseAgentStream(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<AgentStreamEvent> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) continue

        if (trimmed.startsWith('data:')) {
          const payload = trimmed.slice(5).trim()
          if (payload === '[DONE]') return
          try {
            yield { type: 'data', data: JSON.parse(payload) as Record<string, unknown> }
          } catch {
            yield { type: 'raw', data: { text: payload } }
          }
        } else if (trimmed.startsWith('event:')) {
          yield { type: 'event', data: { name: trimmed.slice(6).trim() } }
        } else {
          yield { type: 'raw', data: { text: trimmed } }
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}
