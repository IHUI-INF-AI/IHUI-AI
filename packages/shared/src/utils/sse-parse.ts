export interface SSEEvent {
  type: 'chunk' | 'done' | 'error' | 'reasoning' | 'meta' | 'compaction'
  content?: string
  sessionId?: string
  /** 错误码(对齐 @ihui/api-client SSEErrorInfo 字段) */
  code?: number
  errorCode?: string
  retryAfter?: number
  /** 上下文自动压缩事件字段(对齐后端 SSE compaction 事件) */
  compaction?: {
    triggered: true
    tokensBefore: number
    tokensAfter: number
    removedCount: number
    usageRatio: number
  }
  /** done 事件携带的 token 用量(对标原 ai_assistant.vue total_tokens,ai-service event:done 下发) */
  usage?: {
    promptTokens?: number
    completionTokens?: number
    totalTokens?: number
  }
  /** done 事件携带的模型名 */
  model?: string
}

function applyErrorMeta(evt: SSEEvent, json: Record<string, unknown>): void {
  if (typeof json.code === 'number') evt.code = json.code
  if (typeof json.statusCode === 'number' && evt.code === undefined) evt.code = json.statusCode
  if (typeof json.errorCode === 'string') evt.errorCode = json.errorCode
  if (typeof json.retryAfter === 'number') evt.retryAfter = json.retryAfter
}

export function parseSSEChunk(buffer: string): { events: SSEEvent[]; remainder: string } {
  const events: SSEEvent[] = []
  let rest = buffer

  let nl: number
  while ((nl = rest.indexOf('\n')) !== -1) {
    const line = rest.slice(0, nl).replace(/\r$/, '')
    rest = rest.slice(nl + 1)
    const evt = parseLine(line)
    if (evt) events.push(evt)
  }

  return { events, remainder: rest }
}

function parseLine(line: string): SSEEvent | null {
  if (!line || line.startsWith(':')) return null

  let data = line
  if (line.startsWith('data:')) {
    data = line.slice(5).replace(/^\s/, '')
  } else if (line.startsWith('event:') || line.startsWith('id:') || line.startsWith('retry:')) {
    return null
  }

  if (data === '[DONE]') return { type: 'done' }

  const proto = data.match(/^(\d+):(.*)$/s)
  const protoType = proto?.[1]
  const protoPayload = proto?.[2]
  if (protoType && protoPayload) {
    try {
      const parsed = JSON.parse(protoPayload)
      if (protoType === '0' && typeof parsed === 'string') {
        return { type: 'chunk', content: parsed }
      }
      if (protoType === '9' && typeof parsed === 'string') {
        return { type: 'reasoning', content: parsed }
      }
      return null
    } catch {
      return null
    }
  }

  try {
    const json = JSON.parse(data) as Record<string, unknown>
    if (typeof json?.error === 'string') {
      const evt: SSEEvent = { type: 'error', content: json.error }
      applyErrorMeta(evt, json)
      return evt
    }
    if (json?.type === 'error' && typeof json?.message === 'string') {
      const evt: SSEEvent = { type: 'error', content: json.message }
      applyErrorMeta(evt, json)
      return evt
    }
    if (json?.error === true && typeof json?.error_message === 'string') {
      const evt: SSEEvent = { type: 'error', content: json.error_message }
      applyErrorMeta(evt, json)
      return evt
    }
    const choices = json?.choices as Array<Record<string, unknown>> | undefined
    const choice = choices?.[0]
    if (choice) {
      const delta =
        (choice.delta as Record<string, unknown> | undefined)?.content ??
        (choice.message as Record<string, unknown> | undefined)?.content ??
        choice.text
      if (typeof delta === 'string') return { type: 'chunk', content: delta }
    }
    if (json?.type === 'reasoning' && typeof json?.delta === 'string') {
      return { type: 'reasoning', content: json.delta }
    }
    if (typeof json?.content === 'string') return { type: 'chunk', content: json.content }
    if (typeof json?.delta === 'string') return { type: 'chunk', content: json.delta }
    if (typeof json?.text === 'string') return { type: 'chunk', content: json.text }
    if (json?.type === 'meta' && typeof json?.sessionId === 'string') {
      return { type: 'meta', sessionId: json.sessionId }
    }
    // done 事件:ai-service 在流末尾下发 {"type":"done","model":"...","usage":{"prompt_tokens":..,"completion_tokens":..,"total_tokens":..}}
    // 解析 usage.total_tokens 填充到消息的 tokenCount(对标原 ai_assistant.vue total_tokens 显示)
    if (json?.type === 'done') {
      const rawUsage = json.usage as Record<string, unknown> | undefined
      const usage = rawUsage
        ? {
            promptTokens: typeof rawUsage.prompt_tokens === 'number' ? rawUsage.prompt_tokens : undefined,
            completionTokens:
              typeof rawUsage.completion_tokens === 'number' ? rawUsage.completion_tokens : undefined,
            totalTokens: typeof rawUsage.total_tokens === 'number' ? rawUsage.total_tokens : undefined,
          }
        : undefined
      return {
        type: 'done',
        usage,
        model: typeof json.model === 'string' ? json.model : undefined,
      }
    }
    if (typeof json?.sessionId === 'string') {
      return { type: 'meta', sessionId: json.sessionId }
    }
    // 上下文自动压缩事件(跨端统一 88% 阈值触发,后端 SSE 首事件)
    const compaction = json?.compaction as Record<string, unknown> | undefined
    if (compaction && compaction.triggered === true) {
      return {
        type: 'compaction',
        compaction: {
          triggered: true,
          tokensBefore: Number(compaction.tokensBefore ?? 0),
          tokensAfter: Number(compaction.tokensAfter ?? 0),
          removedCount: Number(compaction.removedCount ?? 0),
          usageRatio: Number(compaction.usageRatio ?? 0),
        },
      }
    }
    return null
  } catch {
    return data ? { type: 'chunk', content: data } : null
  }
}
