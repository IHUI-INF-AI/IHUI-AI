// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 工具卡片共享类型 — 复用 @ihui/api-client / @ihui/types 的线上契约,本端不二次定义。
 *
 * 卡片视图类型(PlanStepView / ToolCallView / TerminalTaskView)在此集中定义,
 * 以便 ChatMessage(api/index.ts)以纯类型方式引用,避免反向依赖 ai-cards.tsx 的 React/Taro 运行时。
 */
import type { ToolCall } from '@ihui/types/chat'
import type { ToolCallEvent } from '@ihui/api-client'
import type { PlanStepStatus } from '@ihui/types'

export type { ToolCallEvent } from '@ihui/api-client'
export type { PlanStepStatus } from '@ihui/types'

/** 工具调用状态(前端聚合视图) */
export type ToolCallViewStatus = 'running' | 'done' | 'error'

/** 工具调用卡片数据(由 chat.tsx 从 StreamEventCallbacks 聚合) */
export interface ToolCallView {
  id: string
  name: string
  status: ToolCallViewStatus
  durationMs?: number
  /** 工具来源(内置 / 插件 / MCP),用于角标展示 */
  serverSource?: ToolCallEvent['serverSource']
  isError?: boolean
  /**
   * 工具入参(SSE tool-call-start / tool-result 事件透传)。
   * describeToolCall 据此推出"对象"(路径 / 检索词 / URL / 命令),缺失则只显示功能名。
   */
  args?: Record<string, unknown>
  /**
   * 工具结果(SSE tool-result 事件透传)。
   * 结果度量(4 行 / 2 个结果)与写类工具的 ± 行数都从它算,不在端内自造口径。
   */
  result?: unknown
  /** 本地计时的起点时间戳(tool-call-start 到达时刻),tool-result 时折算为 durationMs */
  startedAt?: number
}

/** 端内状态词汇 → 共享层状态词汇(done 即 success),全端同一口径由 @ihui/shared/chat 消费 */
export function toSharedToolCallStatus(
  status: ToolCallViewStatus,
): 'running' | 'success' | 'error' {
  return status === 'done' ? 'success' : status
}

/**
 * 端内 ToolCallView → 共享 ToolCall 契约。
 *
 * 共享层(computeFileChanges / deriveTaskStatusBar / describeToolCall)只认 @ihui/types 的
 * ToolCall 形状,端内视图字段名不同(name vs toolName、done vs success),在此一次性适配,
 * 避免各渲染层各自翻译一遍产生口径漂移。serverSource / startedAt 等端内展示字段不参与推导,不带。
 */
export function toSharedToolCalls(calls: readonly ToolCallView[]): ToolCall[] {
  return calls.map((call) => ({
    id: call.id,
    toolName: call.name,
    args: call.args ?? {},
    result: call.result,
    status: toSharedToolCallStatus(call.status),
    isError: call.isError,
    durationMs: call.durationMs,
  }))
}

/** 计划步骤卡片数据(由 PlanUpdateEvent.plan 快照映射) */
export interface PlanStepView {
  id: string
  step: string
  status: PlanStepStatus
  explanation?: string
  durationMs?: number
  error?: boolean
}

/** 终端任务卡片数据(由 TerminalStart/EndEvent 聚合) */
export interface TerminalTaskView {
  id: string
  command: string
  status: 'running' | 'completed' | 'failed'
  output?: string
  durationMs?: number
  exitCode?: number
}

/**
 * 单条 assistant 消息携带的工具卡片聚合(计划 / 工具 / 终端),
 * 由 SSE 事件累积写入,随消息历史持久化;对齐 web 端 planSteps/toolCalls/terminalTasks 消费方式。
 */
export interface AICardsData {
  planSteps: PlanStepView[]
  toolCalls: ToolCallView[]
  terminalTasks: TerminalTaskView[]
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
