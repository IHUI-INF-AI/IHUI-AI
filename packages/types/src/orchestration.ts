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

// ---------------------------------------------------------------------------
// 联合决策引擎
// ---------------------------------------------------------------------------

/** 编排决策状态 */
export type DecisionStatus =
  | 'pending'
  | 'executing'
  | 'completed'
  | 'partially_failed'
  | 'failed'
  | 'skipped'

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
