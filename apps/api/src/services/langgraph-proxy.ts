/**
 * LangGraph ai-service 代理服务(P3 Q1.8)。
 *
 * 封装对 ai-service `/api/langgraph/*` 的调用,作为 web ↔ ai-service LangGraph 中间层。
 * 复用 utils/ai-service-fetch.ts 的 aiServiceFetch / aiServiceFetchStream,
 * 自动注入 traceparent 头(W3C 链路追踪) + 透传 Authorization。
 */

import type { FastifyRequest } from 'fastify'
import type {
  InterruptEvent,
  ResumeCommand,
  LangGraphCheckpoint,
  HistoryEntry,
  SSEEvent,
} from '@ihui/types'
import { aiServiceFetch, aiServiceFetchStream } from '../utils/ai-service-fetch.js'

const LANGGRAPH_BASE = '/api/langgraph'

/** 从 ai-service 响应构造错误信息(失败响应体截断 200 字符,便于排错) */
async function upstreamError(prefix: string, resp: Response): Promise<Error> {
  const text = await resp.text().catch(() => '')
  return new Error(`${prefix}: ${resp.status} ${text.slice(0, 200)}`)
}

/** 触发节点暂停(节点等待人工介入) */
export async function triggerInterrupt(
  request: FastifyRequest | null,
  threadId: string,
  nodeId: string,
  reason: string,
  payload?: unknown,
): Promise<InterruptEvent> {
  const resp = await aiServiceFetch(
    request,
    `${LANGGRAPH_BASE}/${encodeURIComponent(threadId)}/interrupt`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nodeId, reason, payload }),
    },
  )
  if (!resp.ok) throw await upstreamError('ai-service interrupt failed', resp)
  return (await resp.json()) as InterruptEvent
}

/** 恢复暂停节点(resume / rollback / cancel 三种 action) */
export async function resumeExecution(
  request: FastifyRequest | null,
  cmd: ResumeCommand,
): Promise<{ success: boolean; message: string }> {
  const resp = await aiServiceFetch(request, `${LANGGRAPH_BASE}/resume`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
  })
  if (!resp.ok) throw await upstreamError('ai-service resume failed', resp)
  return (await resp.json()) as { success: boolean; message: string }
}

/** 查询线程 checkpoint 状态(无 checkpoint 返回 null) */
export async function getThreadState(
  request: FastifyRequest | null,
  threadId: string,
): Promise<LangGraphCheckpoint | null> {
  const resp = await aiServiceFetch(
    request,
    `${LANGGRAPH_BASE}/${encodeURIComponent(threadId)}/state`,
    { method: 'GET' },
  )
  if (resp.status === 404) return null
  if (!resp.ok) throw await upstreamError('ai-service get state failed', resp)
  return (await resp.json()) as LangGraphCheckpoint
}

/** 查询线程历史(Time Travel,按 limit 截断) */
export async function getThreadHistory(
  request: FastifyRequest | null,
  threadId: string,
  limit = 100,
): Promise<HistoryEntry[]> {
  const resp = await aiServiceFetch(
    request,
    `${LANGGRAPH_BASE}/${encodeURIComponent(threadId)}/history?limit=${limit}`,
    { method: 'GET' },
  )
  if (!resp.ok) throw await upstreamError('ai-service get history failed', resp)
  return (await resp.json()) as HistoryEntry[]
}

/**
 * SSE 流式代理:转发 ai-service LangGraph stream,解析为 SSEEvent 序列 yield。
 *
 * 调用方负责:
 *  - 传入 AbortSignal(客户端断连时 abort 上游 fetch,避免 token 浪费)
 *  - 序列化 SSEEvent 为 `data: <json>\n\n` 写入客户端
 */
export async function* streamAgentExecution(
  request: FastifyRequest | null,
  threadId: string,
  graphInput: Record<string, unknown>,
  signal?: AbortSignal,
): AsyncGenerator<SSEEvent> {
  const resp = await aiServiceFetchStream(
    request,
    `${LANGGRAPH_BASE}/${encodeURIComponent(threadId)}/stream`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify(graphInput),
      signal,
    },
  )
  if (!resp.ok || !resp.body) throw await upstreamError('ai-service stream failed', resp)

  const reader = resp.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      // SSE 帧以空行分隔
      let idx: number
      while ((idx = buffer.indexOf('\n\n')) !== -1) {
        const frame = buffer.slice(0, idx)
        buffer = buffer.slice(idx + 2)
        const event = parseSseFrame(frame)
        if (event) yield event
      }
    }
    // flush 残余帧(无尾随空行时)
    if (buffer.trim()) {
      const event = parseSseFrame(buffer)
      if (event) yield event
    }
  } finally {
    reader.releaseLock()
  }
}

/**
 * 解析单个 SSE 帧:多行 `data:` 拼接为完整 JSON,非 JSON / [DONE] 返回 null。
 * `event:` / `id:` / `retry:` 字段忽略(LangGraph 用 JSON data 描述事件类型)。
 */
function parseSseFrame(frame: string): SSEEvent | null {
  const dataLines: string[] = []
  for (const line of frame.split('\n')) {
    const trimmed = line.replace(/\r$/, '')
    if (trimmed.startsWith('data:')) {
      dataLines.push(trimmed.slice(5).replace(/^\s/, ''))
    }
  }
  if (dataLines.length === 0) return null
  const dataStr = dataLines.join('\n')
  if (!dataStr || dataStr === '[DONE]') return null
  try {
    return JSON.parse(dataStr) as SSEEvent
  } catch {
    return null
  }
}
