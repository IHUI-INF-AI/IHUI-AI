// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
  /** L5-8(2026-08-12):工具瞬时失败自动重试次数(>0 显示"重试N次") */
  retryCount?: number
  /** L5-8(2026-08-12):失败错误分类(timeout/connection/http_5xx/http_4xx/cancelled/unknown) */
  errorType?: string
}

/**
 * 自愈事件(2-3 第四批 2026-09-12):agent_loop_v2._maybe_self_heal 经
 * /api/agents/tasks/stream 的 `event: self-heal` SSE 事件推送。
 * phase=started(检测到失败 pytest,heal 启动)/ finished(ok=修复结果)。
 */
export interface SelfHealEvent {
  id: string
  sessionId: string
  iteration: number | null
  phase: 'started' | 'finished'
  command: string
  failed: number | null
  ok: boolean | null
  attempts: number | null
  rollbackCount: number
  ts: number
}

export interface UseAgentRuntimeReturn {
  sessionTree: AgentSession[]
  loading: boolean
  tokenStream: TokenEvent[]
  toolCallChain: ToolCallEvent[]
  healEvents: SelfHealEvent[]
  connected: boolean
}

const MAX_TOKENS = 1000
/** 自愈事件 FIFO 上限(单 run 事件量小,50 条足够覆盖长会话) */
const MAX_HEAL_EVENTS = 50

type SsePayload =
  | ({ id: string; timestamp: number } & TokenEvent)
  | ({
      id: string
      tool: string
      args: Record<string, unknown>
      status: ToolCallEvent['status']
      result?: unknown
    } & { type: 'tool_call' | 'tool_result' })

function appendFifo(prev: TokenEvent[], evt: TokenEvent): TokenEvent[] {
  const next = [...prev, evt]
  return next.length > MAX_TOKENS ? next.slice(next.length - MAX_TOKENS) : next
}

function appendHealFifo(prev: SelfHealEvent[], evt: SelfHealEvent): SelfHealEvent[] {
  const next = [...prev, evt]
  return next.length > MAX_HEAL_EVENTS ? next.slice(next.length - MAX_HEAL_EVENTS) : next
}

/** Agent 运行时 Hook:session 列表(fetch)+ 实时 token/工具调用流(SSE)。 */
export function useAgentRuntime(agentId: string | null): UseAgentRuntimeReturn {
  const [sessionTree, setSessionTree] = React.useState<AgentSession[]>([])
  const [loading, setLoading] = React.useState(false)
  const [tokenStream, setTokenStream] = React.useState<TokenEvent[]>([])
  const [toolCallChain, setToolCallChain] = React.useState<ToolCallEvent[]>([])
  /** 2-3 第四批(2026-09-12):自愈事件 FIFO(带 event: self-heal 的命名 SSE 事件) */
  const [healEvents, setHealEvents] = React.useState<SelfHealEvent[]>([])
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
      setHealEvents([])
      setConnected(false)
      return
    }
    const url = `/api/agents/tasks/stream?agentId=${encodeURIComponent(agentId)}`
    const es = new EventSource(url)
    esRef.current = es

    es.onopen = () => setConnected(true)
    es.onerror = () => {
      setConnected(false)
      // 2026-08-02 修复:不手动 close,让 EventSource 内置自动重连生效
      // (手动 close 后 EventSource 不会重连,网络抖动会导致 SSE 永久断开)
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
            {
              id: d.id,
              tool: d.tool,
              args: d.args,
              status: d.status ?? 'pending',
              // L5-8(2026-08-12):透传重试次数/错误分类(AgentLoopV2 事件源)
              retryCount: d.retryCount,
              errorType: d.errorType,
            },
          ])
        } else if (data.type === 'tool_result') {
          const d = data as {
            id: string
            result?: unknown
            status: ToolCallEvent['status']
            retryCount?: number
            errorType?: string
          }
          setToolCallChain((prev) =>
            prev.map((c) =>
              c.id === d.id
                ? {
                    ...c,
                    result: d.result,
                    status: d.status,
                    retryCount: d.retryCount,
                    errorType: d.errorType,
                  }
                : c,
            ),
          )
        }
      } catch {
        /* 忽略非 JSON 事件 */
      }
    }

    // 2-3 第四批(2026-09-12):self-heal 是命名 SSE 事件(带 `event: self-heal` 行),
    // 不触发 onmessage,必须 addEventListener(参照 tool-approval-dialog 模式)。
    // 后端 agents.py 输出 {"type":"self-heal","payload":{session_id,iteration,phase,command,failed,ok,attempts,rollbacks,checkpoint_id}}
    es.addEventListener('self-heal', (e) => {
      try {
        const data = JSON.parse(e.data) as {
          type?: string
          payload?: {
            session_id?: string
            iteration?: number | null
            phase?: 'started' | 'finished'
            command?: string
            failed?: number | null
            ok?: boolean | null
            attempts?: number | null
            rollbacks?: number
          }
        }
        const p = data.payload
        const phase = p?.phase
        if (!p || (phase !== 'started' && phase !== 'finished')) return
        setHealEvents((prev) =>
          appendHealFifo(prev, {
            id: `${p.session_id ?? 'unknown'}-${phase}-${p.iteration ?? 0}-${Date.now()}`,
            sessionId: p.session_id ?? '',
            iteration: p.iteration ?? null,
            phase,
            command: p.command ?? '',
            failed: phase === 'started' ? (p.failed ?? null) : null,
            ok: phase === 'finished' ? (p.ok ?? null) : null,
            attempts: phase === 'finished' ? (p.attempts ?? null) : null,
            rollbackCount: p.rollbacks ?? 0,
            ts: Date.now(),
          }),
        )
      } catch {
        /* 忽略非 JSON 事件 */
      }
    })

    return () => {
      es.close()
      esRef.current = null
      setConnected(false)
    }
  }, [agentId])

  return { sessionTree, loading, tokenStream, toolCallChain, healEvents, connected }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
