// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { SSEEvent, SSEEventType } from '@ihui/types'
// G-815939:切帧与"尾帧账目"的唯一出口(不在端内自己写 buffer 的收口分支 ——
// 各端各写一遍必然漂开,而漂开的表现是"静默变短":半帧丢了、账面全绿、没人知道少了什么)。
import {
  createSseFrameAccumulator,
  summarizeSseTailAccount,
  type SseFrameAccumulator,
  type SseTailAccount,
} from '@ihui/shared/utils/sse-frame-accumulator'
import { getStreamBaseUrl, getToken } from '@/lib/api'

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
const MAX_RECONNECT_ATTEMPTS = 5
const RECONNECT_BASE_DELAY_MS = 3000

export interface UseAgentStreamOptions {
  threadId: string
  onEvent?: (event: SSEEvent) => void
  onInterrupt?: (event: SSEEvent) => void
  onDone?: () => void
  onError?: (error: string) => void
  /** 自动重连(stream 异常中断时,非主动 stop、非 done event),默认 false */
  autoReconnect?: boolean
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
  /** 当前重连尝试次数(0=未重连,>0=正在重连第 N 次) */
  reconnectAttempt: number
  /**
   * G-815939:本轮流的尾帧账目(完整帧数 / 已排空 / 已丢弃 / 未判定,四态分列)。
   *
   * `null` = **还没收口或压根没建流**(未判定),不得读成"没有残帧"—— 与本仓
   * "不得把 undefined 解释成清除"(G-721)是同一条口径。
   */
  tailAccount: SseTailAccount | null
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

/**
 * G-815939:这条尾段能不能"排空解析"。
 *
 * 判的是一件与"解析成哪种事件"**不同的事** —— 这里只问"这半截自身是不是一条完整的
 * data 帧"(服务端最后少发一个空行是常态,那条帧不该丢)。半截 JSON 必须判不可排空:
 * 交给 parseSseFrame 会走上面那条 catch 分支,把残片包成 `custom` 事件塞进 events,
 * 那是"用错误的方式排空"——比静默丢弃更难查(界面上会出现一段凭空多出的乱码)。
 * 不复用 parseSseFrame 的判型逻辑,正是为了避免两处对同一帧各给一次结论。
 */
function isSalvageableFrame(frame: string): boolean {
  const dataLines = frame
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trimStart())
  if (dataLines.length === 0) return false
  try {
    JSON.parse(dataLines.join('\n'))
    return true
  } catch {
    return false
  }
}

export function useAgentStream(options: UseAgentStreamOptions): UseAgentStreamReturn {
  const { threadId, onEvent, onInterrupt, onDone, onError, autoReconnect = false } = options

  const [state, setState] = useState<StreamState>(initialState)
  const [isStreaming, setIsStreaming] = useState(false)
  const [reconnectAttempt, setReconnectAttempt] = useState(0)
  // G-815939:尾帧账目。null 的含义见 UseAgentStreamReturn.tailAccount 注释(未判定 ≠ 没有)。
  const [tailAccount, setTailAccount] = useState<SseTailAccount | null>(null)

  const abortRef = useRef<AbortController | null>(null)
  const streamRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null)
  // 回调存 ref,避免 start 依赖变化导致闭包陈旧
  const cbRef = useRef({ onEvent, onInterrupt, onDone, onError })
  cbRef.current = { onEvent, onInterrupt, onDone, onError }

  // 重连相关 ref
  const autoReconnectRef = useRef(autoReconnect)
  autoReconnectRef.current = autoReconnect
  const receivedDoneRef = useRef(false)
  // 2026-08-02 修复 Bug #12:跟踪是否收到过任何事件,
  // stream 正常结束(done=true)但无 done event 时,只在完全没收到事件才重连
  const receivedAnyEventRef = useRef(false)
  const userStoppedRef = useRef(false)
  const lastInputRef = useRef<Record<string, unknown> | undefined>(undefined)
  const reconnectAttemptRef = useRef(0)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // start 函数 ref(供重连递归调用,避免闭包陈旧)
  const startRef = useRef<(input?: Record<string, unknown>) => void>(() => {})

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
    }
  }, [])

  const stop = useCallback(() => {
    userStoppedRef.current = true
    clearReconnectTimer()
    if (streamRef.current) {
      streamRef.current.cancel().catch(() => {})
      streamRef.current = null
    }
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }
    reconnectAttemptRef.current = 0
    setReconnectAttempt(0)
    setIsStreaming(false)
  }, [clearReconnectTimer])

  const clear = useCallback(() => {
    setState(initialState)
    reconnectAttemptRef.current = 0
    setReconnectAttempt(0)
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

      clearReconnectTimer()
      // 重置重连标志(每次主动 start 都视为新会话)
      receivedDoneRef.current = false
      receivedAnyEventRef.current = false
      userStoppedRef.current = false
      lastInputRef.current = input
      // 主动 start 时重置重连计数(但重连内部调用 start 时不重置)
      // 用 reconnectAttemptRef > 0 判断是否为重连调用
      if (reconnectAttemptRef.current === 0) {
        setReconnectAttempt(0)
      }

      const query = input ? `?input=${encodeURIComponent(JSON.stringify(input))}` : ''
      const relativeUrl = `/api/agent-langgraph/${threadId}/stream${query}`
      const baseUrl = getStreamBaseUrl()
      const url = baseUrl ? `${baseUrl}${relativeUrl}` : relativeUrl

      const controller = new AbortController()
      abortRef.current = controller

      // 2026-08-02 修复 Bug #13:重连时保留累积的 content/lastState/lastPlan,
      // 避免服务端只发增量 token 时重连后 content 从空开始累积导致内容不连续
      // 2026-08-02 修复 Bug #10:同时保留 currentNode,避免重连瞬间"当前节点"badge 闪空,
      // 直到下一个 node_start 事件到达才恢复
      if (reconnectAttemptRef.current === 0) {
        setState(initialState)
      } else {
        setState((s) => ({
          ...initialState,
          events: s.events,
          content: s.content,
          lastState: s.lastState,
          lastPlan: s.lastPlan,
          currentNode: s.currentNode,
        }))
      }
      setIsStreaming(true)
      // G-815939:全新一次 start 才清账(重连那轮沿用上轮读数,直到它自己 close)。
      // 清成 null 的含义是"**未判定**",不是"本轮没有残帧"—— 两者必须分型(G-721 同一条口径)。
      if (reconnectAttemptRef.current === 0) setTailAccount(null)

      const dispatch = (evt: SSEEvent) => {
        receivedAnyEventRef.current = true
        setState((prev) => {
          // 优化(问题 4-3):token 事件高频(每 LLM token 一条),且 events 数组在下游
          // (use-agent-progress.ts)只消费 plan/subagent/tool_call/tool_result/terminal 等结构化
          // 事件;token 已通过下方 switch 'token' 分支累积到 next.content,无需重复入 events,
          // 避免 MAX_EVENTS=200 时每帧创建新数组造成 GC 压力
          let events: SSEEvent[]
          if (evt.type === 'token') {
            events = prev.events
          } else {
            events = [...prev.events, evt]
            // 截断保留最近 MAX_EVENTS 条
            if (events.length > MAX_EVENTS) {
              events.splice(0, events.length - MAX_EVENTS)
            }
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
          receivedDoneRef.current = true
          cb.onDone?.()
          setIsStreaming(false)
        }
        if (evt.type === 'error') {
          cb.onError?.(String(evt.data ?? '未知错误'))
          setIsStreaming(false)
        }
      }

      // 尝试自动重连(stream 异常中断时)
      const tryReconnect = () => {
        if (!autoReconnectRef.current) return
        if (userStoppedRef.current) return
        if (receivedDoneRef.current) return
        if (reconnectAttemptRef.current >= MAX_RECONNECT_ATTEMPTS) {
          setReconnectAttempt(0)
          reconnectAttemptRef.current = 0
          return
        }
        reconnectAttemptRef.current += 1
        const attempt = reconnectAttemptRef.current
        setReconnectAttempt(attempt)
        const delay = RECONNECT_BASE_DELAY_MS * Math.pow(2, attempt - 1)
        reconnectTimerRef.current = setTimeout(() => {
          reconnectTimerRef.current = null
          // 重连前再次检查用户是否已 stop
          if (userStoppedRef.current) return
          startRef.current(lastInputRef.current)
        }, delay)
      }

      ;(async () => {
        // G-815939:累加器在 try 外声明 —— 收账必须发生在**所有**出口(正常收尾 / 主动
        // stop / 异常),否则"半途断掉的流"恰好是尾帧最常见的那一型,反而没有账。
        let accumulator: SseFrameAccumulator | null = null
        try {
          // 2026-09-09 0-5-f 豁免确认:SSE 流式直接消费 res.body reader 逐行解析,
          // fetchApi 是一次性 JSON 解析通道,不适用流式;自实现指数退避重连。
          const headers: Record<string, string> = { Accept: 'text/event-stream' }
          const token = getToken()
          if (token) headers['Authorization'] = `Bearer ${token}`
          const res = await fetch(url, {
            method: 'GET',
            signal: controller.signal,
            headers,
            credentials: 'include',
          })

          if (!res.ok || !res.body) {
            const msg = `HTTP ${res.status}`
            cbRef.current.onError?.(msg)
            setState((s) => ({ ...s, error: msg }))
            setIsStreaming(false)
            // HTTP 错误也尝试重连
            tryReconnect()
            return
          }

          const reader = res.body.getReader()
          streamRef.current = reader

          // 重连成功后重置计数
          if (reconnectAttemptRef.current > 0) {
            reconnectAttemptRef.current = 0
            setReconnectAttempt(0)
          }

          const decoder = new TextDecoder()
          // G-815939:切帧交给带账目的累加器。原先这里是自己写的 buffer 循环,
          // 而 `done` 一到就 break —— 缓冲区里剩下的那半帧**既不解析也不报**,永久消失且零痕迹。
          accumulator = createSseFrameAccumulator({
            onFrame: (frame) => {
              const evt = parseSseFrame(frame)
              if (evt) dispatch(evt)
            },
            // 排空通道:只在尾段自身已是一条完整 JSON data 帧时才认领
            // (服务端最后少发一个空行是常态,那条帧不该丢;半截 JSON 一律计丢弃,
            // 因为把它硬喂给 parseSseFrame 会折成 custom 事件 —— 那是用错误的方式排空)
            salvage: (tail) => {
              if (!isSalvageableFrame(tail)) return false
              const evt = parseSseFrame(tail)
              if (!evt) return false
              dispatch(evt)
              return true
            },
          })

          // SSE 流式响应的标准模式:while(true) 持续读取直到 done
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            accumulator.push(decoder.decode(value, { stream: true }))
          }
          // 解码器里还可能压着跨 chunk 的多字节残片:先请它吐完再收口,
          // 否则那半截连"被丢弃"都算不上 —— 它根本没进过账。
          accumulator.push(decoder.decode())
          // 2026-08-02 修复 Bug #12:stream 正常结束但未收到 done event
          // 只在完全没收到任何事件时才重连(真正的连接问题),
          // 收到过事件但无 done → 视为服务端正常关闭流(忘记发 done),不重连
          if (!receivedAnyEventRef.current) {
            tryReconnect()
          }
        } catch (err) {
          if (controller.signal.aborted) {
            // 主动 stop,不报错
            return
          }
          const msg = err instanceof Error ? err.message : String(err)
          cbRef.current.onError?.(msg)
          setState((s) => ({ ...s, error: msg }))
          // 网络错误尝试重连
          tryReconnect()
        } finally {
          setIsStreaming(false)
          streamRef.current = null
          abortRef.current = null
          // G-815939:无论走到哪个出口都要结一次尾帧账。
          // 没建流(例如 HTTP 直接失败 / 还没读到第一块就 abort)时 accumulator 为 null ⇒
          // 账目显式回落到 null,即"**未判定**",不得留上一轮的旧账在这里冒充"本轮已结清"。
          if (accumulator) {
            const account = accumulator.close()
            setTailAccount(account)
            const summary = summarizeSseTailAccount(account)
            if (summary) {
              // 丢弃/判不出必须"响":这一行就是 §5e 那条禁令要的可诊断痕迹,且逐条点名内容预览。
              // 走 console 而不是界面文案 —— 新增用户可见提示要补 i18n 五语言,不属本票范围。
              console.warn(`[use-agent-stream] 尾帧账目 thread=${threadId} ${summary}`)
            }
          } else {
            setTailAccount(null)
          }
        }
      })()
    },
    [threadId, stop, clearReconnectTimer],
  )

  // 保持 startRef 最新,供重连递归调用
  startRef.current = start

  // 卸载时清理重连定时器 + 中止进行中的 SSE 流
  // 2026-08-02 修复 P1(问题 4-1):原 cleanup 仅 clearTimeout,未中止活跃流。
  // 组件卸载后 SSE 连接在后台持续运行,setState 被 React 静默忽略但 reader/decoder/网络
  // 连接仍占用资源,构成内存泄漏。此处补 abort + cancel,与 stop() 函数对称。
  useEffect(() => {
    return () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }
      abortRef.current?.abort()
      streamRef.current?.cancel().catch(() => {})
    }
  }, [])

  return {
    events: state.events,
    isStreaming,
    interruptEvent: state.interruptEvent,
    currentNode: state.currentNode,
    content: state.content,
    lastState: state.lastState,
    lastPlan: state.lastPlan,
    error: state.error,
    reconnectAttempt,
    // G-815939:最近一次收口的尾帧账目(null = 未判定,详见接口注释)
    tailAccount,
    start,
    stop,
    clear,
    clearInterrupt,
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
