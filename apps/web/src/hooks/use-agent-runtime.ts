'use client'

import * as React from 'react'
import { fetchApi } from '@/lib/api'

export interface AgentSession {
  id: string
  status: string
  children?: AgentSession[]
}

export interface TokenEvent {
  id: string
  type: 'content' | 'tool_call' | 'tool_result'
  value: string
  timestamp: number
}

export interface ToolCallEvent {
  id: string
  tool: string
  args: Record<string, unknown>
  result?: unknown
  status: 'pending' | 'success' | 'error'
}

export interface UseAgentRuntimeReturn {
  sessionTree: AgentSession[]
  loading: boolean
  tokenStream: TokenEvent[]
  toolCallChain: ToolCallEvent[]
  connected: boolean
}

const MAX_TOKENS = 1000

type SsePayload =
  | ({ id: string; timestamp: number } & TokenEvent)
  | ({ id: string; tool: string; args: Record<string, unknown>; status: ToolCallEvent['status']; result?: unknown } & { type: 'tool_call' | 'tool_result' })

function appendFifo(prev: TokenEvent[], evt: TokenEvent): TokenEvent[] {
  const next = [...prev, evt]
  return next.length > MAX_TOKENS ? next.slice(next.length - MAX_TOKENS) : next
}

/** Agent 运行时 Hook:session 列表(fetch)+ 实时 token/工具调用流(SSE)。 */
export function useAgentRuntime(agentId: string | null): UseAgentRuntimeReturn {
  const [sessionTree, setSessionTree] = React.useState<AgentSession[]>([])
  const [loading, setLoading] = React.useState(false)
  const [tokenStream, setTokenStream] = React.useState<TokenEvent[]>([])
  const [toolCallChain, setToolCallChain] = React.useState<ToolCallEvent[]>([])
  const [connected, setConnected] = React.useState(false)
  const esRef = React.useRef<EventSource | null>(null)

  React.useEffect(() => {
    if (!agentId) {
      setSessionTree([])
      return
    }
    let cancelled = false
    setLoading(true)
    void (async () => {
      try {
        const res = await fetchApi<{ list?: AgentSession[]; data?: AgentSession[] }>(
          '/api/agent-task',
        )
        if (cancelled) return
        if (res.success) {
          setSessionTree(res.data.list ?? res.data.data ?? [])
        }
      } catch {
        /* 降级空树 */
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [agentId])

  React.useEffect(() => {
    if (!agentId || typeof window === 'undefined' || !('EventSource' in window)) {
      setTokenStream([])
      setToolCallChain([])
      setConnected(false)
      return
    }
    const url = `/api/agents/tasks/stream?agentId=${encodeURIComponent(agentId)}`
    const es = new EventSource(url)
    esRef.current = es

    es.onopen = () => setConnected(true)
    es.onerror = () => {
      setConnected(false)
      es.close()
    }
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data) as SsePayload
        if (data.type === 'content') {
          setTokenStream((prev) =>
            appendFifo(prev, {
              id: data.id,
              type: 'content',
              value: (data as TokenEvent).value,
              timestamp: data.timestamp,
            }),
          )
        } else if (data.type === 'tool_call') {
          const d = data as ToolCallEvent & { type: 'tool_call' }
          setToolCallChain((prev) => [
            ...prev,
            { id: d.id, tool: d.tool, args: d.args, status: d.status ?? 'pending' },
          ])
        } else if (data.type === 'tool_result') {
          const d = data as { id: string; result?: unknown; status: ToolCallEvent['status'] }
          setToolCallChain((prev) =>
            prev.map((c) =>
              c.id === d.id ? { ...c, result: d.result, status: d.status } : c,
            ),
          )
        }
      } catch {
        /* 忽略非 JSON 事件 */
      }
    }

    return () => {
      es.close()
      esRef.current = null
      setConnected(false)
    }
  }, [agentId])

  return { sessionTree, loading, tokenStream, toolCallChain, connected }
}
