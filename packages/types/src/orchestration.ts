// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 跨支柱编排中枢 — 共享类型契约(2026-07-23 立)。
 *
 * 让 6 大超越支柱(Rules/Hook/Spec/Context/Subagent/Terminal)
 * 通过事件总线协同决策,统一 LLM 预算治理与遥测。
 */

// ---------------------------------------------------------------------------
// 支柱枚举
// ---------------------------------------------------------------------------

export const PILLARS = [
  'rules',
  'hook',
  'spec',
  'context',
  'subagent',
  'terminal',
  'budget',
] as const
export type Pillar = (typeof PILLARS)[number]

// ---------------------------------------------------------------------------
// 事件总线
// ---------------------------------------------------------------------------

/** 支柱事件类型(26 种) */
export const PILLAR_EVENT_TYPES = [
  'rules.matched',
  'rules.violated',
  'rules.conflict_resolved',
  'rules.auto_generated',
  'hook.emitted',
  'hook.failed',
  'hook.health_degraded',
  'hook.ab_test_completed',
  'spec.generated',
  'spec.approved',
  'spec.rejected',
  'spec.task_split',
  'spec.patch_applied',
  'context.compressed',
  'context.enriched',
  'context.behavior_recorded',
  'subagent.dispatched',
  'subagent.completed',
  'subagent.failed',
  'subagent.evolved',
  'terminal.command_failed',
  'terminal.command_succeeded',
  'terminal.ai_diagnosed',
  'terminal.recording_completed',
  'budget.exceeded',
  'budget.warning',
] as const
export type PillarEventType = (typeof PILLAR_EVENT_TYPES)[number]

/** 严重级别 */
export type Severity = 'info' | 'warning' | 'critical'

/** 支柱事件 */
export interface PillarEvent {
  event_type: PillarEventType
  source_pillar: Pillar
  timestamp: string
  payload: Record<string, unknown>
  dispatch_id?: string
  severity: Severity
  event_id?: string
}

/** 事件发射请求 */
export interface EmitEventRequest {
  event_type: PillarEventType
  source_pillar: Pillar
  payload: Record<string, unknown>
  severity?: Severity
}

/**
 * emit 的联动结论档位 —— 与 ai-service `app/routers/orchestration.py` 的
 * `resolve_emit_outcome()` 三个返回值同形(2026-09-26 第九轮 B2 加性接入)。
 *
 * - `settled`    本次调用当场拿到可关联到该事件的结论
 * - `accepted`   事件已交给后台消费循环,结论稍后出现在 status
 * - `unsettled`  同步路径但没拿到可关联的结论(skipped/异常/交错)
 *
 * 为什么必须有这一档:`emit` 的语义只是"事件已交给中枢",**不等于联动已发生**。
 * 只回 `event_id` 时,调用方会把"收下"读成"办完"。
 */
export type EmitEventOutcome = 'settled' | 'accepted' | 'unsettled'

/**
 * `POST /orchestration/events/emit` 响应里的 `data` 形状。
 *
 * 三键一律 **可缺失且可为 null**,这是判据不是保守:
 *  - `degraded` / `non_ok_pillars` 只在 `outcome === 'settled'` 时有值,
 *    其余档位必须是 `null`(= 未知)。把未知写成 `false` 等于把"没判"写成"判过了"。
 *  - 三键整体缺失 = 上游是加性改造前的旧版,同样不得被下游折算成"未降级"。
 */
export interface EmitEventResult {
  event_id: string
  outcome?: EmitEventOutcome
  degraded?: boolean | null
  non_ok_pillars?: string[] | null
}

// ---------------------------------------------------------------------------
// 联合决策引擎
// ---------------------------------------------------------------------------

/** 编排决策状态 */
export type DecisionStatus =
  'pending' | 'executing' | 'completed' | 'partially_failed' | 'failed' | 'skipped'

/** 编排决策 */
export interface OrchestrationDecision {
  decision_id: string
  trigger_event: PillarEvent
  playbook_id: string
  actions: PlaybookAction[]
  status: DecisionStatus
  results: ActionResult[]
  created_at: string
  executed_at: string
  duration_ms: number
}

/** Playbook 动作 */
export interface PlaybookAction {
  pillar: Pillar
  action: string
  params: Record<string, unknown>
}

/** 动作执行结果 */
export interface ActionResult {
  pillar: string
  action: string
  success: boolean
  result?: unknown
  error?: string
  duration_ms: number
}

/** 预置联动策略 */
export interface OrchestrationPlaybook {
  id: string
  name: string
  trigger: PillarEventType
  actions: PlaybookAction[]
  enabled: boolean
}

// ---------------------------------------------------------------------------
// LLM 预算治理
// ---------------------------------------------------------------------------

/**
 * 预算帧 `level` 档位的封闭词表 —— **唯一份**(2026-11-06 收口:此前同一件东西在仓内有四份字面量副本)。
 *
 * `stopped` 有生产者,不是设想档(现读取证):
 *  · 生产侧:`apps/ai-service/app/routers/agents.py` 的预算硬停分支在
 *    `frame_stop_reason == "budget_exceeded"` 时下发 `{"type":"budget","level":"stopped", …}`
 *    (原因码闭集见 `app/core/budget_reason.py`);
 *  · 落库侧:`apps/api/src/routes/ai-chat-stream.ts` 与 `routes/mobile-chat-routes.ts` 的
 *    budget 中继只认 `level === 'stopped'` 才写 `chat_budget_stops` 一行;
 *    `packages/database/src/schema/chat-ledger.ts` 该列注释同为三档。
 * 而消费侧也早已按三档写,并各带用例:web `hooks/use-chat/budget-state.ts`(终态不被覆盖)、
 * RN `utils/budget-note.ts`(stopped 走原因码文案 + `nextBudgetLevel`)、小程序
 * `lib/chat-budget-ledger-frames.ts` 的 `applyBudgetStopEvent`(同判据,用例在
 * `pkg-ai/ai/__tests__/cap-budget-ledger.test.ts`)。
 *
 * 副本清单(收口前):`@ihui/api-client` 的 `BudgetEvent.level` 联合 + 同包 `tryParseBudget`
 * 的字面量守卫、`@ihui/shared` 的 `sse/contract.ts` budget 分支 + `utils/sse-parse.ts` 的字面量
 * 守卫,再加 RN `api/chat-ledger.ts` 的一处 —— 同一闭集五处手抄。实测后果正是 §0.6 说的那一型:
 * 2026-11-06 批次 3 把三档写进了其中几处,其余仍停在两档,于是"提交面说三档、工作树产物说两档",
 * 表现是 `packages/shared/src/utils/sse-parse.ts` 交 `stopped` 给 `BudgetEvent` 时 TS2322
 * (编译不过),或更安静的一型 —— 某条解析路径把终态帧整帧静默丢弃。
 * 档位集合自此只这一份,两侧都从这里取。
 *
 * 三档语义各自不同,不可合并:warning(80%~95% 软提醒)/ critical(95%~100% 硬预警)/
 * stopped(流内硬停止**终态**;≥100% 的 HTTP 429 仍是请求级错误,不走本帧)。
 *
 * 形态照 `monitor-vocabulary.ts` 的先例:canonical `as const` 一处声明,类型与守卫都从它走。
 * 文案**不进这里** —— 标签归各端 i18n,这里只管"合法值有哪些"。
 */
export const BUDGET_LEVELS = ['warning', 'critical', 'stopped'] as const
export type BudgetLevel = (typeof BUDGET_LEVELS)[number]

/**
 * 档位守卫。未知值返回 false —— **不猜档、不折成 warning**(同 `isMonitorAlertStatus` 的纪律):
 * 解析器据此整帧不产出,写侧据此拒收。
 */
export function isBudgetLevel(value: unknown): value is BudgetLevel {
  return typeof value === 'string' && (BUDGET_LEVELS as readonly string[]).includes(value)
}

/** 预算检查结果 */
export interface BudgetCheckResult {
  allowed: boolean
  degrade_to_model: string | null
  reason: string
  usage_percent: number
  pillar_usage_percent: number
  remaining_tokens: number
  remaining_cost_usd: number
}

/** 用量记录 */
export interface UsageRecord {
  pillar: Pillar
  model: string
  input_tokens: number
  output_tokens: number
  cost_usd: number
  timestamp: string
  request_id: string
  action: string
}

/** 用量汇总 */
export interface UsageSummary {
  total_tokens: number
  total_cost: number
  by_pillar: Record<string, { tokens: number; cost: number }>
  by_model: Record<string, { tokens: number; cost: number }>
  limit: number
  usage_percent: number
}

/** 用量趋势项 */
export interface UsageTrendItem {
  date: string
  tokens: number
  cost: number
  by_pillar: Record<string, { tokens: number; cost: number }>
}

/** 支柱预算详情 */
export interface PillarBudget {
  allocated_limit: number
  used_tokens: number
  used_cost: number
  remaining: number
  usage_percent: number
  degraded_model: string | null
}

/** 成本分解 */
export interface CostBreakdown {
  by_pillar: Record<string, number>
  by_model: Record<string, number>
  by_action: Record<string, number>
  total: number
}

/** 预算配置更新请求 */
export interface BudgetConfigUpdate {
  daily_token_limit?: number
  daily_cost_limit_usd?: number
  hourly_token_limit?: number
  warning_threshold?: number
  critical_threshold?: number
  auto_degrade_at?: number
  hard_stop_at?: number
}

// ---------------------------------------------------------------------------
// 统一遥测
// ---------------------------------------------------------------------------

/** Metric 类型 */
export type MetricType = 'counter' | 'gauge' | 'histogram'

/** Metric 值 */
export interface MetricValue {
  labels: Record<string, string>
  value: number
}

/** Metric 定义 */
export interface MetricDefinition {
  name: string
  type: MetricType
  help: string
  labels: string[]
  values: MetricValue[]
}

/** Span 状态 */
export type SpanStatus = 'ok' | 'error'

/** Trace Span */
export interface TraceSpan {
  trace_id: string
  span_id: string
  parent_span_id: string | null
  name: string
  pillar: Pillar
  start_time: number
  end_time: number
  duration_ms: number
  attributes: Record<string, unknown>
  status: SpanStatus
  events: { name: string; attributes?: Record<string, unknown>; timestamp: string }[]
}

/** 支柱健康状态 */
export type PillarHealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown'

/** 支柱健康 */
export interface PillarHealth {
  status: PillarHealthStatus
  key_metrics: Record<string, number | string>
}

// ---------------------------------------------------------------------------
// 仪表盘聚合
// ---------------------------------------------------------------------------

/** 编排仪表盘 */
export interface OrchestrationDashboard {
  event_stats: Record<string, { count: number; success_rate: number }>
  decision_stats: {
    total_decisions: number
    success_rate: number
    avg_duration_ms: number
    by_playbook: Record<string, number>
  }
  playbooks: OrchestrationPlaybook[]
  pillar_health: Record<string, { status: string; total: number; success_rate: number }>
}

/** 遥测仪表盘 */
export interface TelemetryDashboard {
  metrics_summary: Record<string, number>
  pillar_health: Record<string, PillarHealth>
  recent_traces: TraceSpan[]
  system_overview: {
    total_llm_calls: number
    total_tokens: number
    total_cost: number
    active_sessions: number
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
