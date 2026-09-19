// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Agent 任务流 SSE 事件契约 —— 单一事实源(t4 runtime 收敛,2026-09-19 立)。
 *
 * 覆盖端点:/agents/tasks/stream(ai-service agents.py 经 hook_engine 订阅
 * AGENT_SUBSCRIBE_EVENTS,按 HOOK_EVENT_TO_SSE 映射为前端 kebab-case 命名事件)。
 *
 * 本文件集中定义该流的事件名常量 + wire payload 形态(snake_case) + 视图事件形态
 * (camelCase) + 逐事件解析器,替代此前散落在 apps/web use-agent-runtime.ts /
 * tool-approval-dialog.tsx 的内联字符串与解析模板。
 *
 * 命名对齐:Python 侧权威源为
 *   apps/ai-service/app/services/agent_events.py 的 HOOK_EVENT_TO_SSE(值侧)
 * 由 scripts/check-agent-event-parity.mjs 段 1d 提取后端生产面;本模块
 * AGENT_TASK_EVENTS 的值侧与其一一对应,前端消费点改用常量引用后由守门段 2a
 * 解析常量映射继续对账。
 *
 * 与对话流契约的关系:packages/shared/src/sse/contract.ts 的 SSE_EVENTS 覆盖
 * /v1/chat/completions 对话流(24 事件);本模块覆盖 agent 任务流。两流在
 * 'thinking'/'plan-step'/'compaction' 等名字上有交集属正常(同名义事件
 * 在两条流上各自生产)。
 */

/** Agent 任务流事件名常量(单一事实源)。值即 wire 上的 `event: <名>`。 */
export const AGENT_TASK_EVENTS = {
  /** hook session.start → 会话建立 */
  SESSION: 'session',
  /** hook session.end → 会话结束摘要 */
  SESSION_END: 'session_end',
  /** hook tool.before → 工具调用开始(onmessage JSON 事件) */
  TOOL_CALL: 'tool_call',
  /** hook tool.after → 工具执行结果(onmessage JSON 事件) */
  TOOL_RESULT: 'tool_result',
  /** hook tool.approval → 高危工具审批请求 */
  TOOL_APPROVAL: 'tool-approval',
  /** hook message.send → 本轮 LLM 请求即将发出 */
  MESSAGE_SEND: 'message_send',
  /** hook message.receive → LLM 响应到达 */
  MESSAGE: 'message',
  /** hook error → 错误 */
  ERROR: 'error',
  /** hook permission.mode → 权限模式切换 */
  PERMISSION_MODE: 'permission-mode',
  /** hook self_heal → 自愈循环事件 */
  SELF_HEAL: 'self-heal',
  /** hook thinking.delta → 思考增量 */
  THINKING: 'thinking',
  /** hook plan.step → 计划步骤时间线 */
  PLAN_STEP: 'plan-step',
  /** hook terminal.delta → 终端逐行输出增量 */
  TERMINAL_DELTA: 'terminal-delta',
  /** hook compaction → 上下文压缩通知 */
  COMPACTION: 'compaction',
  /** hook agent.status → agent 瞬态状态(resuming/pausing/cancelling) */
  AGENT_STATUS: 'agent-status',
} as const

/** 全部 Agent 任务流事件名的联合类型。 */
export type AgentTaskEventName = (typeof AGENT_TASK_EVENTS)[keyof typeof AGENT_TASK_EVENTS]

/** 事件名数组(去重,用于契约对账/测试)。 */
export const AGENT_TASK_EVENT_NAMES: readonly AgentTaskEventName[] =
  Object.values(AGENT_TASK_EVENTS)

/** 判断字符串是否为已知 Agent 任务流事件名(类型守卫)。 */
export function isAgentTaskEventName(value: string): value is AgentTaskEventName {
  return (AGENT_TASK_EVENT_NAMES as readonly string[]).includes(value)
}

// ============================================================================
// wire payload 形态(snake_case,agents.py _format_sse 序列化输出)
// ============================================================================

/** wire 通用信封:命名事件的 data JSON,载荷挂在 payload 下,顶层带 type 与 session_id。 */
export interface AgentTaskWireEnvelope<TPayload = Record<string, unknown>> {
  type?: string
  session_id?: string
  payload?: TPayload
}

/** self-heal wire 载荷。 */
export interface SelfHealWirePayload {
  session_id?: string
  iteration?: number | null
  phase?: 'started' | 'finished'
  command?: string
  failed?: number | null
  ok?: boolean | null
  attempts?: number | null
  rollbacks?: number
}

/** thinking wire 载荷。 */
export interface ThinkingWirePayload {
  run_id?: string
  content?: string
  iteration?: number | null
  is_final?: boolean
}

/** plan-step wire 载荷。 */
export interface PlanStepWirePayload {
  run_id?: string
  step_index?: number
  tool_name?: string
  status?: string
  decision?: string | null
  reason?: string | null
}

/** session_end wire 载荷。 */
export interface SessionEndWirePayload {
  session_id?: string
  user_id?: string
  success?: boolean
  stop_reason?: string
  total_iterations?: number
  total_duration_ms?: number
}

/** permission-mode wire 载荷。 */
export interface PermissionModeWirePayload {
  mode?: string
  tool?: string
  decision?: string
  session_id?: string
}

/** terminal-delta wire 载荷。 */
export interface TerminalDeltaWirePayload {
  session_id?: string
  run_id?: string
  command?: string
  stream?: string
  text?: string
  iteration?: number | null
  tool_call_id?: string | null
}

/** agent-status wire 载荷。 */
export interface AgentStatusWirePayload {
  session_id?: string
  status?: string
}

/** message_send wire 载荷。 */
export interface MessageSendWirePayload {
  session_id?: string
  iteration?: number
  messages_count?: number
}

/** tool-approval wire 载荷(session_id 可能在 payload 内或信封顶层)。 */
export interface ToolApprovalWirePayload {
  approval_id?: string | number
  tool_name?: string
  tool_call_id?: string | number
  args_preview?: string
  danger_level?: string
  session_id?: string
}

// ============================================================================
// 视图事件形态(camelCase,前端消费层的稳定接口)
// ============================================================================

/**
 * 自愈事件(2-3 第四批 2026-09-12):agent_loop_v2._maybe_self_heal 推送。
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

/** thinking 增量事件(P0-5):同一 run 多次事件拼接累积,is_final 收尾。 */
export interface ThinkingDeltaEvent {
  runId: string
  content: string
  iteration: number | null
  isFinal: boolean
}

/**
 * plan 步骤事件(P0-5):agent_loop_v2.emit_plan_step 推送。
 * status=started/completed;blocked 由拦截/审批路径承载(本层不发射,契约保留)。
 */
export interface AgentPlanStepEvent {
  runId: string
  stepIndex: number
  toolName: string
  status: 'started' | 'completed' | 'blocked'
  decision: string | null
  reason: string | null
  ts: number
}

/** session 结束摘要(P1,2026-09-19)。 */
export interface AgentSessionEndEvent {
  sessionId: string
  success: boolean
  stopReason: string
  totalIterations: number
  totalDurationMs: number
  ts: number
}

/** 权限模式切换(P1,2026-09-19):高危工具审批门模式/决策变化。 */
export interface AgentPermissionModeEvent {
  mode: string
  tool: string
  decision: string
  ts: number
}

/** 运行时终端增量输出(P1,2026-09-19):run_command 逐行 stdout/stderr(4 行/帧节流)。 */
export interface AgentTerminalDeltaEvent {
  id: string
  command: string
  stream: 'stdout' | 'stderr'
  text: string
  iteration: number | null
  ts: number
}

/** agent 瞬态状态(P1,2026-09-19):pause/cancel 过渡。 */
export interface AgentTransientStatusEvent {
  sessionId: string
  status: 'resuming' | 'pausing' | 'cancelling'
  ts: number
}

/** 本轮 LLM 请求发出通知(P1,2026-09-19)。 */
export interface AgentMessageSendEvent {
  iteration: number
  messagesCount: number
  ts: number
}

/** 审批请求视图形态(与 @ihui/types ToolApprovalRequest 字段对齐)。 */
export interface ToolApprovalEvent {
  approvalId: string
  toolName: string
  toolCallId: string
  argsPreview: string
  dangerLevel: string
  sessionId: string
}

// ============================================================================
// 逐事件解析器(JSON.parse + 守卫校验 + snake→camel 格式化,无效载荷返回 null)
// ============================================================================

/** 安全 JSON.parse:非 JSON/非对象一律返回 null(替代各消费点重复的 try/catch 模板)。 */
function parseEnvelope(raw: unknown): AgentTaskWireEnvelope | null {
  if (typeof raw !== 'string') return null
  try {
    const data = JSON.parse(raw) as AgentTaskWireEnvelope
    if (data === null || typeof data !== 'object' || Array.isArray(data)) return null
    return data
  } catch {
    return null
  }
}

/** self-heal 解析:phase 仅接受 started/finished,其余丢弃。 */
export function parseSelfHealEvent(raw: unknown): SelfHealEvent | null {
  const data = parseEnvelope(raw)
  const p = data?.payload as SelfHealWirePayload | undefined
  const phase = p?.phase
  if (!p || (phase !== 'started' && phase !== 'finished')) return null
  return {
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
  }
}

/** thinking 解析:空 content 丢弃(整段透传,由消费方决定拼接策略)。 */
export function parseThinkingEvent(raw: unknown): ThinkingDeltaEvent | null {
  const data = parseEnvelope(raw)
  const p = data?.payload as ThinkingWirePayload | undefined
  if (!p || typeof p.content !== 'string' || p.content.length === 0) return null
  return {
    runId: p.run_id ?? '',
    content: p.content,
    iteration: typeof p.iteration === 'number' ? p.iteration : null,
    isFinal: p.is_final === true,
  }
}

/** plan-step 解析:step_index/tool_name 必填,status 仅 started/completed/blocked。 */
export function parsePlanStepEvent(raw: unknown): AgentPlanStepEvent | null {
  const data = parseEnvelope(raw)
  const p = data?.payload as PlanStepWirePayload | undefined
  const status = p?.status
  if (!p || typeof p.step_index !== 'number' || typeof p.tool_name !== 'string') return null
  if (status !== 'started' && status !== 'completed' && status !== 'blocked') return null
  return {
    runId: p.run_id ?? '',
    stepIndex: p.step_index,
    toolName: p.tool_name,
    status,
    decision: typeof p.decision === 'string' ? p.decision : null,
    reason: typeof p.reason === 'string' ? p.reason : null,
    ts: Date.now(),
  }
}

/** session_end 解析:payload 缺失即丢弃。 */
export function parseSessionEndEvent(raw: unknown): AgentSessionEndEvent | null {
  const data = parseEnvelope(raw)
  const p = data?.payload as SessionEndWirePayload | undefined
  if (!p) return null
  return {
    sessionId: p.session_id ?? '',
    success: Boolean(p.success),
    stopReason: p.stop_reason ?? '',
    totalIterations: p.total_iterations ?? 0,
    totalDurationMs: p.total_duration_ms ?? 0,
    ts: Date.now(),
  }
}

/** permission-mode 解析:payload 缺失即丢弃。 */
export function parsePermissionModeEvent(raw: unknown): AgentPermissionModeEvent | null {
  const data = parseEnvelope(raw)
  const p = data?.payload as PermissionModeWirePayload | undefined
  if (!p) return null
  return {
    mode: p.mode ?? '',
    tool: p.tool ?? '',
    decision: p.decision ?? '',
    ts: Date.now(),
  }
}

/** terminal-delta 解析:text 必填,stream 仅 stdout/stderr。 */
export function parseTerminalDeltaEvent(raw: unknown): AgentTerminalDeltaEvent | null {
  const data = parseEnvelope(raw)
  const p = data?.payload as TerminalDeltaWirePayload | undefined
  const stream = p?.stream
  if (!p || typeof p.text !== 'string' || (stream !== 'stdout' && stream !== 'stderr')) {
    return null
  }
  return {
    id: `${p.tool_call_id ?? p.run_id ?? 'unknown'}-${Date.now()}`,
    command: p.command ?? '',
    stream,
    text: p.text,
    iteration: typeof p.iteration === 'number' ? p.iteration : null,
    ts: Date.now(),
  }
}

/** agent-status 解析:status 仅 resuming/pausing/cancelling。 */
export function parseAgentStatusEvent(raw: unknown): AgentTransientStatusEvent | null {
  const data = parseEnvelope(raw)
  const p = data?.payload as AgentStatusWirePayload | undefined
  const status = p?.status
  if (!p || (status !== 'resuming' && status !== 'pausing' && status !== 'cancelling')) {
    return null
  }
  return { sessionId: p.session_id ?? '', status, ts: Date.now() }
}

/** message_send 解析:iteration 必填(number)。 */
export function parseMessageSendEvent(raw: unknown): AgentMessageSendEvent | null {
  const data = parseEnvelope(raw)
  const p = data?.payload as MessageSendWirePayload | undefined
  if (!p || typeof p.iteration !== 'number') return null
  return {
    iteration: p.iteration,
    messagesCount: p.messages_count ?? 0,
    ts: Date.now(),
  }
}

/** tool-approval 解析:session_id 顶层优先、payload 内兜底;danger_level 缺省 high。 */
export function parseToolApprovalEvent(raw: unknown): ToolApprovalEvent | null {
  const data = parseEnvelope(raw)
  if (!data || data.type !== AGENT_TASK_EVENTS.TOOL_APPROVAL) return null
  const p = data.payload as ToolApprovalWirePayload | undefined
  if (!p) return null
  return {
    approvalId: String(p.approval_id ?? ''),
    toolName: String(p.tool_name ?? ''),
    toolCallId: String(p.tool_call_id ?? ''),
    argsPreview: String(p.args_preview ?? ''),
    dangerLevel: p.danger_level ?? 'high',
    sessionId: String(data.session_id ?? p.session_id ?? ''),
  }
}

// ============================================================================
// 统一分发工厂(EventSink 协议的解析层:事件名 → 解析器路由)
// ============================================================================

/** Agent 任务流解析后视图事件的判别联合。 */
export type AgentTaskEvent =
  | { name: typeof AGENT_TASK_EVENTS.SELF_HEAL; event: SelfHealEvent }
  | { name: typeof AGENT_TASK_EVENTS.THINKING; event: ThinkingDeltaEvent }
  | { name: typeof AGENT_TASK_EVENTS.PLAN_STEP; event: AgentPlanStepEvent }
  | { name: typeof AGENT_TASK_EVENTS.SESSION_END; event: AgentSessionEndEvent }
  | { name: typeof AGENT_TASK_EVENTS.PERMISSION_MODE; event: AgentPermissionModeEvent }
  | { name: typeof AGENT_TASK_EVENTS.TERMINAL_DELTA; event: AgentTerminalDeltaEvent }
  | { name: typeof AGENT_TASK_EVENTS.AGENT_STATUS; event: AgentTransientStatusEvent }
  | { name: typeof AGENT_TASK_EVENTS.MESSAGE_SEND; event: AgentMessageSendEvent }
  | { name: typeof AGENT_TASK_EVENTS.TOOL_APPROVAL; event: ToolApprovalEvent }

/**
 * 按事件名路由到对应解析器(EventSink 协议统一入口)。
 * 未知事件名/无效载荷返回 null,调用方静默丢弃(与各消费点既有 try/catch 行为等价)。
 * 仅覆盖前端当前逐名消费的 9 个事件;session/tool_call/tool_result/message/error/
 * compaction 由 onmessage 泛型或对话流契约(SSE_EVENTS)承载,不经本工厂。
 */
export function parseAgentTaskEvent(name: string, raw: unknown): AgentTaskEvent | null {
  switch (name) {
    case AGENT_TASK_EVENTS.SELF_HEAL: {
      const event = parseSelfHealEvent(raw)
      return event ? { name, event } : null
    }
    case AGENT_TASK_EVENTS.THINKING: {
      const event = parseThinkingEvent(raw)
      return event ? { name, event } : null
    }
    case AGENT_TASK_EVENTS.PLAN_STEP: {
      const event = parsePlanStepEvent(raw)
      return event ? { name, event } : null
    }
    case AGENT_TASK_EVENTS.SESSION_END: {
      const event = parseSessionEndEvent(raw)
      return event ? { name, event } : null
    }
    case AGENT_TASK_EVENTS.PERMISSION_MODE: {
      const event = parsePermissionModeEvent(raw)
      return event ? { name, event } : null
    }
    case AGENT_TASK_EVENTS.TERMINAL_DELTA: {
      const event = parseTerminalDeltaEvent(raw)
      return event ? { name, event } : null
    }
    case AGENT_TASK_EVENTS.AGENT_STATUS: {
      const event = parseAgentStatusEvent(raw)
      return event ? { name, event } : null
    }
    case AGENT_TASK_EVENTS.MESSAGE_SEND: {
      const event = parseMessageSendEvent(raw)
      return event ? { name, event } : null
    }
    case AGENT_TASK_EVENTS.TOOL_APPROVAL: {
      const event = parseToolApprovalEvent(raw)
      return event ? { name, event } : null
    }
    default:
      return null
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌​‌‍‍‌‌​​‌‌​‌‌​‍‍‌​‌‌​‌​‌‌​‌​‍‍‌​‌‌​‌​‌‌​‌‌‍‍‌‌​​‌‌​‌‌​‍‍​‌​​‌​​​‌‍‍​‌​​‌‌​‌‍‍‌​‌​​‌‌​‍‍​‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​‌​‌‍‍​‌​‌​​‌​‍‍‌‌​​‌​‌‍‍‌‌​‌‌​‌‌​‍‍‌‌​​‌‌​‌‌‌‌​‌​‍‍‌‌​‌‌​‌​‌‍‍‌‌​​‌‌​​​‍‍​‌‌​‌‌​‍‍​‌​‌​‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​‌​‌‌​‍‍‌​‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​‌​‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​‌‌‌‍‍‌‌​‌‌​‌​‍‍‌‌​​‌‌​‍‍​‌‌​‌​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​​‍‍​‌​‌‌​‌​‌‍‍‌‌​‌​​‌​‌‍‍​‌​​​‌​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌​‍‍‌‌​‌‌​‌​‍‍​‌‌​‌‌​‍‍​‌​‌​‌​‌‍‍​‌‌​‌​‍‍‌​‌‌​‌‌​‌‍‍​‌​​‌‌​‌‍‍‌‌​​‌​‍‍‌‌​​‌​‍‍​‌‌​‌‌​‌‍‍​‌​‌‌​‌​‌‍‍​‌​​​​​‌‍‍​‌​‌‌​‌​‌‍‍​‌​​‌​​‍‍​‌​​​‌‌​‍‍‌‌​‌‌​‌‌​⁠
