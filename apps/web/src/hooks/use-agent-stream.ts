'use client'

import { useCallback, useRef, useState } from 'react'
import type { SSEEvent, SSEEventType } from '@ihui/types'

/**
 * LangGraph Agent SSE 流消费 hook(2026-07-23 立,Q1 HITL web 端)
 *
 * 端点:GET /api/agent-langgraph/:threadId/stream?input=<JSON>
 *
 * 实现:fetch + ReadableStream(而非 EventSource),原因:
 *  1. 可主动 abort(stop)
 *  2. 可读取错误响应体,触发 onError 而非静默重连
 *  3. 解析完整 SSE 帧(event/data 双字段),支持 12 类事件
 *
 * 事件分发(对应 SSEEventType):
 *  - session     → 标记流开始
 *  - token       → 累积到 currentContent
 *  - node_start  → 设置 currentNode
 *  - node_end    → 清除 currentNode
 *  - tool_call/tool_result → 追加事件
 *  - state_update → 更新 lastState
 *  - plan        → 更新 lastPlan
 *  - interrupt   → 设置 interruptEvent + 调用 onInterrupt(流不自动断开,等待 resume 后 server 继续 push)
 *  - done        → 调用 onDone,停止 streaming
 *  - error       → 调用 onError,停止 streaming
 *  - custom      → 追加事件
 */

const MAX_EVENTS = 200

export interface UseAgentStreamOptions {
  threadId: string
  onEvent?: (event: SSEEvent) => void
  onInterrupt?: (event: SSEEvent) => void
  onDone?: () => void
  onError?: (error: string) => void
}

export interface UseAgentStreamReturn {
  /** 全部已收到事件(截断保留最近 MAX_EVENTS 条) */
  events: SSEEvent[]
  /** 是否正在流式接收 */
  isStreaming: boolean
  /** 当前中断事件(遇到 interrupt 时设置,resume 后清空) */
  interruptEvent: SSEEvent | null
  /** 当前正在执行的节点(node_start 后、node_end 前) */
  currentNode: string | null
  /** token 累积的内容 */
  content: string
  /** 最近一次 state_update 数据 */
  lastState: unknown
  /** 最近一次 plan 数据 */
  lastPlan: unknown
  /** 最近错误信息 */
  error: string | null
  /** 启动流(input 将 JSON 编码到 query) */
  start: (input?: Record<string, unknown>) => void
  /** 主动中断流 */
  stop: () => void
  /** 清空已累积的事件与状态(interruptEvent 也会清空) */
  clear: () => void
  /** 手动清除中断态(resume 后由 panel 调用) */
  clearInterrupt: () => void
}

interface StreamState {
  events: SSEEvent[]
  interruptEvent: SSEEvent | null
  currentNode: string | null
  content: string
  lastState: unknown
  lastPlan: unknown
  error: string | null
}

const initialState: StreamState = {
  events: [],
  interruptEvent: null,
  currentNode: null,
  content: '',
  lastState: null,
  lastPlan: null,
  error: null,
}

/**
 * 解析单个 SSE 帧(以空行分隔的文本块),返回 SSEEvent 或 null
 *
 * 帧格式:
 *   event: <type>
 *   data: <json>
 *
 * 或仅 data 行(默认 message 事件,LangGraph 不使用,但兼容)
 */
function parseSseFrame(frame: string): SSEEvent | null {
  const lines = frame.split('\n')
  let eventType = 'message'
  const dataLines: string[] = []

  for (const line of lines) {
    if (!line) continue
    if (line.startsWith('event:')) {
      eventType = line.slice(6).trim()
    } else if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trimStart())
    }
  }

  if (dataLines.length === 0) return null
  const dataStr = dataLines.join('\n')

  try {
    const parsed = JSON.parse(dataStr) as SSEEvent
    // 服务端可能省略 type 字段,用 event: 行兜底
    if (!parsed.type) {
      parsed.type = eventType as SSEEventType
    }
    return parsed
  } catch {
    // data 非 JSON(如纯文本 token),包装为 custom 事件
    return {
      type: 'custom',
      threadId: '',
      data: dataStr,
      timestamp: new Date().toISOString(),
    }
  }
}

export function useAgentStream(
  options: UseAgentStreamOptions,
): UseAgentStreamReturn {
  const { threadId, onEvent, onInterrupt, onDone, onError } = options

  const [state, setState] = useState<StreamState>(initialState)
  const [isStreaming, setIsStreaming] = useState(false)

  const abortRef = useRef<AbortController | null>(null)
  const streamRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null)
  // 回调存 ref,避免 start 依赖变化导致闭包陈旧
  const cbRef = useRef({ onEvent, onInterrupt, onDone, onError })
  cbRef.current = { onEvent, onInterrupt, onDone, onError }

  const stop = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.cancel().catch(() => {})
      streamRef.current = null
    }
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }
    setIsStreaming(false)
  }, [])

  const clear = useCallback(() => {
    setState(initialState)
  }, [])

  const clearInterrupt = useCallback(() => {
    setState((s) => ({ ...s, interruptEvent: null }))
  }, [])

  const start = useCallback(
    (input?: Record<string, unknown>) => {
      if (!threadId) return
      // 已在流中,先停止旧流
      if (abortRef.current) {
        stop()
      }

      const query = input
        ? `?input=${encodeURIComponent(JSON.stringify(input))}`
        : ''
      const url = `/api/agent-langgraph/${threadId}/stream${query}`

      const controller = new AbortController()
      abortRef.current = controller

      setState((s) => ({ ...initialState, events: s.events }))
      setIsStreaming(true)

      const dispatch = (evt: SSEEvent) => {
        setState((prev) => {
          const events = [...prev.events, evt]
          // 截断保留最近 MAX_EVENTS 条
          if (events.length > MAX_EVENTS) {
            events.splice(0, events.length - MAX_EVENTS)
          }

          const next: StreamState = {
            ...prev,
            events,
          }

          switch (evt.type) {
            case 'token':
              next.content = prev.content + String(evt.data ?? '')
              next.currentNode = prev.currentNode
              break
            case 'node_start':
              next.currentNode = evt.nodeId ?? null
              break
            case 'node_end':
              next.currentNode = null
              break
            case 'state_update':
              next.lastState = evt.data
              break
            case 'plan':
              next.lastPlan = evt.data
              break
            case 'interrupt':
              next.interruptEvent = evt
              break
            case 'error':
              next.error = String(evt.data ?? '未知错误')
              break
            default:
              break
          }

          return next
        })

        // 派发回调(在 setState 之外,避免回调内 setState 死循环)
        const cb = cbRef.current
        cb.onEvent?.(evt)
        if (evt.type === 'interrupt') cb.onInterrupt?.(evt)
        if (evt.type === 'done') {
          cb.onDone?.()
          setIsStreaming(false)
        }
        if (evt.type === 'error') {
          cb.onError?.(String(evt.data ?? '未知错误'))
          setIsStreaming(false)
        }
      }

      ;(async () => {
        try {
          const res = await fetch(url, {
            method: 'GET',
            signal: controller.signal,
            headers: { Accept: 'text/event-stream' },
          })

          if (!res.ok || !res.body) {
            const msg = `HTTP ${res.status}`
            cbRef.current.onError?.(msg)
            setState((s) => ({ ...s, error: msg }))
            setIsStreaming(false)
            return
          }

          const reader = res.body.getReader()
          streamRef.current = reader

          const decoder = new TextDecoder()
          let buffer = ''

          // eslint-disable-next-line no-constant-condition
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            buffer += decoder.decode(value, { stream: true })

            // SSE 帧以空行(\n\n)分隔
            let idx = buffer.indexOf('\n\n')
            while (idx !== -1) {
              const frame = buffer.slice(0, idx)
              buffer = buffer.slice(idx + 2)
              const evt = parseSseFrame(frame)
              if (evt) dispatch(evt)
              idx = buffer.indexOf('\n\n')
            }
          }
        } catch (err) {
          if (controller.signal.aborted) {
            // 主动 stop,不报错
            return
          }
          const msg = err instanceof Error ? err.message : String(err)
          cbRef.current.onError?.(msg)
          setState((s) => ({ ...s, error: msg }))
        } finally {
          setIsStreaming(false)
          streamRef.current = null
          abortRef.current = null
        }
      })()
    },
    [threadId, stop],
  )

  return {
    events: state.events,
    isStreaming,
    interruptEvent: state.interruptEvent,
    currentNode: state.currentNode,
    content: state.content,
    lastState: state.lastState,
    lastPlan: state.lastPlan,
    error: state.error,
    start,
    stop,
    clear,
    clearInterrupt,
  }
}
