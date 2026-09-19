// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

'use client'

import * as React from 'react'
import { fetchApi } from '@/lib/api'
import {
  AGENT_TASK_EVENTS,
  parseSelfHealEvent,
  parseThinkingEvent,
  parsePlanStepEvent,
  parseSessionEndEvent,
  parsePermissionModeEvent,
  parseTerminalDeltaEvent,
  parseAgentStatusEvent,
  parseMessageSendEvent,
} from '@ihui/shared'
import type {
  SelfHealEvent,
  AgentPlanStepEvent,
  AgentSessionEndEvent,
  AgentPermissionModeEvent,
  AgentTerminalDeltaEvent,
  AgentTransientStatusEvent,
  AgentMessageSendEvent,
} from '@ihui/shared'

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

// t4 runtime 收敛(2026-09-19):以下 Agent 任务流事件视图类型已迁移至
// @ihui/shared 的 agent-events 单源(事件名常量 + wire/视图双层类型 +
// 逐事件解析器),此处 re-export 维持既有导入面(agent-task-progress-pane 等)不变。
// wire 解析(JSON.parse + 守卫 + snake→camel)由共享 parse* 函数承载,
// 本 hook 仅保留状态组织(FIFO/单值覆盖)职责。
export type {
  SelfHealEvent,
  AgentPlanStepEvent,
  AgentSessionEndEvent,
  AgentPermissionModeEvent,
  AgentTerminalDeltaEvent,
  AgentTransientStatusEvent,
  AgentMessageSendEvent,
}

export interface UseAgentRuntimeReturn {
  sessionTree: AgentSession[]
  loading: boolean
  tokenStream: TokenEvent[]
  toolCallChain: ToolCallEvent[]
  healEvents: SelfHealEvent[]
  /** P0-5:workbench reasoning 累积(多次 thinking 事件拼接,is_final 收尾) */
  thinkingContent: string
  /** P0-5:plan 步骤时间线(step_index 幂等 upsert) */
  planSteps: AgentPlanStepEvent[]
  /** P1(2026-09-19):session 结束摘要(最后一次 session_end 事件) */
  sessionEnd: AgentSessionEndEvent | null
  /** P1(2026-09-19):权限模式切换(最后一次 permission-mode 事件) */
  permissionMode: AgentPermissionModeEvent | null
  /** P1(2026-09-19):运行时终端增量输出 FIFO(terminal-delta) */
  terminalDeltas: AgentTerminalDeltaEvent[]
  /** P1(2026-09-19):agent 瞬态状态(resuming/pausing/cancelling) */
  agentStatus: AgentTransientStatusEvent | null
  /** P1(2026-09-19):最近一轮 LLM 请求发出通知(message_send) */
  lastMessageSend: AgentMessageSendEvent | null
  connected: boolean
}

/** 自愈事件 FIFO 上限(单 run 事件量小,50 条足够覆盖长会话) */
const MAX_HEAL_EVENTS = 50
/** plan 步骤 FIFO 上限(长任务步骤数有限,100 条兜底) */
const MAX_PLAN_STEPS = 100
/** terminal-delta FIFO 上限(4 行/帧,200 帧 ≈ 800 行输出,防长命令刷爆内存) */
const MAX_TERMINAL_DELTAS = 200

// 2026-09-19:content 匿名形态已删除(/agents/tasks/stream 全部为命名事件,
// onmessage 运行时不可达),SsePayload 仅保留守门认可的 tool_call/tool_result 分支形态。
type SsePayload = {
  id: string
  tool: string
  args: Record<string, unknown>
  status: ToolCallEvent['status']
  result?: unknown
} & { type: typeof AGENT_TASK_EVENTS.TOOL_CALL | typeof AGENT_TASK_EVENTS.TOOL_RESULT }

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
  /** P0-5(2026-09-13):workbench reasoning 累积(命名 SSE 事件 thinking) */
  const [thinkingContent, setThinkingContent] = React.useState('')
  /** P0-5(2026-09-13):plan 步骤时间线(命名 SSE 事件 plan-step) */
  const [planSteps, setPlanSteps] = React.useState<AgentPlanStepEvent[]>([])
  /** P1(2026-09-19):session 结束摘要(命名 SSE 事件 session_end,单值覆盖) */
  const [sessionEnd, setSessionEnd] = React.useState<AgentSessionEndEvent | null>(null)
  /** P1(2026-09-19):权限模式切换(命名 SSE 事件 permission-mode,单值覆盖) */
  const [permissionMode, setPermissionMode] = React.useState<AgentPermissionModeEvent | null>(null)
  /** P1(2026-09-19):运行时终端增量输出(命名 SSE 事件 terminal-delta,FIFO) */
  const [terminalDeltas, setTerminalDeltas] = React.useState<AgentTerminalDeltaEvent[]>([])
  /** P1(2026-09-19):agent 瞬态状态(命名 SSE 事件 agent-status,单值覆盖) */
  const [agentStatus, setAgentStatus] = React.useState<AgentTransientStatusEvent | null>(null)
  /** P1(2026-09-19):最近一轮 LLM 请求发出(命名 SSE 事件 message_send,单值覆盖) */
  const [lastMessageSend, setLastMessageSend] = React.useState<AgentMessageSendEvent | null>(null)
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
      setThinkingContent('')
      setPlanSteps([])
      setSessionEnd(null)
      setPermissionMode(null)
      setTerminalDeltas([])
      setAgentStatus(null)
      setLastMessageSend(null)
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
        if (data.type === AGENT_TASK_EVENTS.TOOL_CALL) {
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
        } else if (data.type === AGENT_TASK_EVENTS.TOOL_RESULT) {
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
    // t4(2026-09-19):wire 解析迁移至共享 parseSelfHealEvent,此处仅保留 FIFO 状态组织。
    es.addEventListener(AGENT_TASK_EVENTS.SELF_HEAL, (e) => {
      const evt = parseSelfHealEvent(e.data)
      if (evt) setHealEvents((prev) => appendHealFifo(prev, evt))
    })

    // P0-5(2026-09-13):thinking 是命名 SSE 事件(agents.py "thinking.delta"→"thinking")。
    // reasoning 整段一次性到达,同一 run 多次事件拼接累积;is_final 收尾(当前实现整段透传,追加即可)。
    // t4(2026-09-19):wire 解析迁移至共享 parseThinkingEvent,此处仅保留拼接策略。
    es.addEventListener(AGENT_TASK_EVENTS.THINKING, (e) => {
      const evt = parseThinkingEvent(e.data)
      if (!evt) return
      setThinkingContent((prev) => (prev.length > 0 ? `${prev}\n\n${evt.content}` : evt.content))
    })

    // P0-5(2026-09-13):plan-step 是命名 SSE 事件(agents.py "plan.step"→"plan-step")。
    // started upsert 条目,completed/blocked 更新状态;同 step_index 幂等。
    // t4(2026-09-19):wire 解析迁移至共享 parsePlanStepEvent,此处仅保留幂等 upsert。
    es.addEventListener(AGENT_TASK_EVENTS.PLAN_STEP, (e) => {
      const evt = parsePlanStepEvent(e.data)
      if (!evt) return
      setPlanSteps((prev) => {
        const idx = prev.findIndex((s) => s.stepIndex === evt.stepIndex)
        if (idx === -1) {
          const next = [...prev, evt]
          return next.length > MAX_PLAN_STEPS ? next.slice(next.length - MAX_PLAN_STEPS) : next
        }
        const next = [...prev]
        next[idx] = { ...next[idx]!, ...evt }
        return next
      })
    })

    // P1(2026-09-19):session_end 是命名 SSE 事件(hook "session.end"→"session_end"),
    // payload {session_id,user_id,success,stop_reason,total_iterations,total_duration_ms}。
    // t4(2026-09-19):wire 解析迁移至共享 parseSessionEndEvent,此处仅保留单值覆盖。
    es.addEventListener(AGENT_TASK_EVENTS.SESSION_END, (e) => {
      const evt = parseSessionEndEvent(e.data)
      if (evt) setSessionEnd(evt)
    })

    // P1(2026-09-19):permission-mode(hook "permission.mode"→"permission-mode"),
    // 高危工具审批门模式/决策变化,单值覆盖。
    // t4(2026-09-19):wire 解析迁移至共享 parsePermissionModeEvent。
    es.addEventListener(AGENT_TASK_EVENTS.PERMISSION_MODE, (e) => {
      const evt = parsePermissionModeEvent(e.data)
      if (evt) setPermissionMode(evt)
    })

    // P1(2026-09-19):terminal-delta(hook "terminal.delta"→"terminal-delta"),
    // run_command 逐行 stdout/stderr(4 行/帧节流);FIFO 上限 MAX_TERMINAL_DELTAS。
    // t4(2026-09-19):wire 解析迁移至共享 parseTerminalDeltaEvent,此处仅保留 FIFO。
    es.addEventListener(AGENT_TASK_EVENTS.TERMINAL_DELTA, (e) => {
      const evt = parseTerminalDeltaEvent(e.data)
      if (!evt) return
      setTerminalDeltas((prev) => {
        const next = [...prev, evt]
        return next.length > MAX_TERMINAL_DELTAS
          ? next.slice(next.length - MAX_TERMINAL_DELTAS)
          : next
      })
    })

    // P1(2026-09-19):agent-status(hook "agent.status"→"agent-status"),
    // pause/cancel 过渡(resuming/pausing/cancelling),单值覆盖。
    // t4(2026-09-19):wire 解析迁移至共享 parseAgentStatusEvent。
    es.addEventListener(AGENT_TASK_EVENTS.AGENT_STATUS, (e) => {
      const evt = parseAgentStatusEvent(e.data)
      if (evt) setAgentStatus(evt)
    })

    // P1(2026-09-19):message_send(hook "message.send"→"message_send"),
    // 本轮 LLM 请求即将发出,单值覆盖。
    // t4(2026-09-19):wire 解析迁移至共享 parseMessageSendEvent。
    es.addEventListener(AGENT_TASK_EVENTS.MESSAGE_SEND, (e) => {
      const evt = parseMessageSendEvent(e.data)
      if (evt) setLastMessageSend(evt)
    })

    return () => {
      es.close()
      esRef.current = null
      setConnected(false)
      setThinkingContent('')
      setPlanSteps([])
      setSessionEnd(null)
      setPermissionMode(null)
      setTerminalDeltas([])
      setAgentStatus(null)
      setLastMessageSend(null)
    }
  }, [agentId])

  return {
    sessionTree,
    loading,
    tokenStream,
    toolCallChain,
    healEvents,
    thinkingContent,
    planSteps,
    sessionEnd,
    permissionMode,
    terminalDeltas,
    agentStatus,
    lastMessageSend,
    connected,
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
