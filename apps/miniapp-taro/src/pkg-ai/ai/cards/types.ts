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
  /** 后端截断标志与原始长度:小程序拿不到 live 缓冲,不交代就等于把截断当完整 */
  truncated?: boolean
  totalChars?: number
  durationMs?: number
  exitCode?: number
}

/**
 * D34 上下文注入交代(第 45 轮承接):kind 是取词键,**禁止**把后端 collapsed 中文当界面文本
 * (collapsed 只在 kind 未知时兜底显示),fullText 缺省即后端判定超限,不给假"展开"入口。
 */
export interface InjectionView {
  kind: string
  collapsed: string
  fullText?: string
  count?: number
}

/** #11 引用溯源条目(后端只发 source+label;url 字段留位,当前无发射点) */
export interface CitationView {
  source: string
  label: string
  url?: string
}

/**
 * D106 引导已生效交代(Steer 中途引导,web 端 steerNoticeBar 同语义):
 * shape 与 @ihui/api-client 的 SteerEvent 严格对齐。
 */
export interface SteerNoticeView {
  /** 当前仅 "injected"(已注入 messages);预留扩展 */
  phase: 'injected'
  /** 用户引导文本(注入 messages 的原文) */
  text: string
  /** 入队时间(ISO,来自 steer 端点) */
  timestamp?: string
  /** 所属 assistant 消息 ID */
  messageId?: string
}

/** 单条 assistant 消息的引导条数上限(对齐后端 _STEER_QUEUE_LIMIT / web 端 STEER_NOTICE_MAX_PER_MESSAGE) */
export const STEER_NOTICE_MAX = 8

/**
 * steer 帧 → 端内视图。text 为空/纯空白时返回 null(调用方跳过,不渲染空提示)。
 */
export function toSteerNotice(evt: SteerNoticeView): SteerNoticeView | null {
  if (!evt || typeof evt.text !== 'string' || !evt.text.trim()) return null
  return {
    phase: evt.phase,
    text: evt.text.trim(),
    timestamp: evt.timestamp,
    messageId: evt.messageId,
  }
}

/**
 * steer 帧累积:追加 + 上限截断(web appendSteerNotice 同语义:满 8 条丢弃后续,不整替)。
 */
export function appendSteerNotice(
  list: readonly SteerNoticeView[] | undefined,
  notice: SteerNoticeView,
): SteerNoticeView[] {
  const next = list ? [...list] : []
  if (next.length >= STEER_NOTICE_MAX) return next
  next.push(notice)
  return next
}

/**
 * citations 帧累积:**追加** + 按 (source,label) 去重。
 * 整替会让流中后到的引用把流首那批抹掉(web 端 #26 已踩过一次)。
 */
export function appendCitations(
  list: readonly CitationView[] | undefined,
  incoming: readonly CitationView[],
): CitationView[] {
  const next = list ? [...list] : []
  for (const item of incoming) {
    if (next.some((x) => x.source === item.source && x.label === item.label)) continue
    next.push(item)
  }
  return next
}

/**
 * 从消息 metadata.steerApplied 还原"这轮中途引导注入了哪些条"(D106 收尾,2026-09-24 立)。
 *
 * 落库为 {text, timestamp?} 数组(api 侧 persistedSteerAppliedSchema 只钉死 text 非空),
 * 守卫与 web 端 use-chat/history-message.ts 的 readSteerAppliedFromMetadata 同一口径:
 * 坏项(text 缺失/空串/纯空白)逐条剔除;timestamp 仅 string 才带;
 * 全坏/空 → undefined,不给 SteerNoticeCard 造空态。
 * phase 恒 'injected'(历史行只有"已注入"一种终态);上限 8 条对齐 _STEER_QUEUE_LIMIT
 * (后端已拒绝第 9 条入队,这里封顶是防脏数据,非业务可达路径)。
 */
export function readSteerAppliedFromMetadata(raw: unknown): SteerNoticeView[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined
  const out: SteerNoticeView[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const rec = item as Record<string, unknown>
    if (typeof rec.text !== 'string' || !rec.text.trim()) continue
    out.push({
      phase: 'injected',
      text: rec.text.trim(),
      ...(typeof rec.timestamp === 'string' ? { timestamp: rec.timestamp } : {}),
    })
    if (out.length >= STEER_NOTICE_MAX) break
  }
  return out.length > 0 ? out : undefined
}

/**
 * 历史恢复行的最小结构面(不 import ChatMessage,避免 types ↔ api 循环依赖;
 * permission-stamp.ts 同款做法)。
 */
export interface SteerHistoryMessageLike {
  role: string
  metadata?: Record<string, unknown> | null
  aiCards?: AICardsData
}

/**
 * 历史加载链路的 steerApplied 读回(D106 收尾):
 * 逐条检查 assistant 消息,aiCards.steerNotices 缺失且 metadata.steerApplied 可读时
 * 重建补挂 —— live 侧(SSE onSteer)已写入的不覆盖,防双份;metadata 无/全坏时
 * 原样返回(不写 aiCards.steerNotices,不渲染空态)。其余字段一律不动。
 */
export function backfillSteerNoticesFromMetadata<T extends SteerHistoryMessageLike>(
  messages: readonly T[],
): T[] {
  return messages.map((m) => {
    if (m.role !== 'assistant' || m.aiCards?.steerNotices?.length) return m
    const notices = readSteerAppliedFromMetadata(m.metadata?.steerApplied)
    if (!notices) return m
    return {
      ...m,
      aiCards: {
        planSteps: m.aiCards?.planSteps ?? [],
        toolCalls: m.aiCards?.toolCalls ?? [],
        terminalTasks: m.aiCards?.terminalTasks ?? [],
        injections: m.aiCards?.injections ?? [],
        citations: m.aiCards?.citations ?? [],
        steerNotices: notices,
      },
    }
  })
}

/**
 * 单条 assistant 消息携带的工具卡片聚合(计划 / 工具 / 终端 / 注入交代 / 引用溯源),
 * 由 SSE 事件累积写入,随消息历史持久化;对齐 web 端 planSteps/toolCalls/terminalTasks 消费方式。
 */
export interface AICardsData {
  planSteps: PlanStepView[]
  toolCalls: ToolCallView[]
  terminalTasks: TerminalTaskView[]
  injections: InjectionView[]
  citations: CitationView[]
  /** D106 引导已生效记录(旧历史消息无此字段,运行时可能为 undefined) */
  steerNotices?: SteerNoticeView[]
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
