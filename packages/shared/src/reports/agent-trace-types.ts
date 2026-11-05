// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 自包含诊断报告的输入契约。
 *
 * 立因:对侧程序(WorkBuddy 5.9.3)随产品分发两枚单文件诊断报告 HTML,形态是"喂一份日志进去
 * 就出 KPI + 阶段瀑布 + findings"的离线工具;本层只做**输入形态**与**判据档位**的声明,
 * 取数在 trace-metrics.ts、文档在 agent-trace-report.ts、样式在 report-styles.ts。
 *
 * 为什么不复用 @ihui/types 的会话消息类型:报告只吃"步"这一层,引整个会话类型会把 api-client
 * 拉进可达闭包(实测 apps/cli/tests/chat-history-read-ops-wiring.test.ts 记过那条环)。
 */
import type { ToolCallStatus } from '../chat/tool-activity'

/**
 * 取词函数:与 `chat/tool-activity` 的 `translate(key, params?)` 同一形态。
 * 为什么留注入而不落文案:AGENTS §19 —— shared 不硬编码界面文案,五语言语言包面另有归属席在飞。
 */
export type ReportTranslate = (key: string, params?: Record<string, string | number>) => string

/** 一次工具调用步。`durationMs` 缺省 = 这一量不到,**不得当 0**(诚实档,AGENTS §0.3 同族)。 */
export interface AgentTraceStep {
  toolName: string
  /** 状态词表唯一源 = chat/tool-activity 的 ToolCallStatus;运行期取值由 STATUS_BUCKETS 反查(不另列名单) */
  status: ToolCallStatus
  durationMs?: number | null
}

/** 会话消息的最小投影:报告只用于"这一趟跑了多少条、什么角色",不承载正文语义 */
export interface AgentTraceMessage {
  role: string
  content?: string
}

export interface AgentTrace {
  title: string
  toolCalls: readonly AgentTraceStep[]
  messages?: readonly AgentTraceMessage[]
  exportedAt: string
  locale?: string
  timeZone?: string
}

/** findings 的三档强度(与 monitor 告警词表刻意不同域:这里是"一份报告内部的整改优先级") */
export type TraceFindingSeverity = 'high' | 'medium' | 'low'

/**
 * 判据档位:全部具名可注入(超越对侧那一格 —— 对方的阈值埋在它自己的内联脚本里,拿不到也改不了)。
 * 命名不取 TTL/MAX_AGE/RETENTION 大写族:守门 121 C1 那类"策略常量必须有消费者"的射程按名扫,
 * 本层阈值确由 evaluateAgentTraceFindings 消费,但刻意不占那把尺的名单。
 */
export const TRACE_FINDING_DEFAULTS = {
  /** 失败步数达到该值即出 finding(0 档 = 关判据) */
  failedStepCountToFlag: 1,
  /** 最慢步占总耗时的比例超过该值即出 finding;单步轨迹豁免(它恒等于 100%,判它是噪声) */
  slowestShareToFlag: 0.5,
  /** 量不到耗时的步数达到该值即出 finding */
  unmeasuredStepCountToFlag: 1,
  /** 步数不超过该值即判"空轨迹" */
  emptyTraceStepCount: 0,
  /** 有耗时步的总耗时超过该毫秒数即出 finding */
  measuredTotalMsToFlag: 120_000,
} as const

export type TraceFindingThresholds = {
  -readonly [K in keyof typeof TRACE_FINDING_DEFAULTS]: number
}

export type TraceFindingId =
  | 'failuresPresent'
  | 'slowestStepDominant'
  | 'unmeasuredSteps'
  | 'emptyTrace'
  | 'measuredTotalOverBudget'

export interface TraceFinding {
  id: TraceFindingId
  severity: TraceFindingSeverity
  /** 数值明细独立成 chip 渲染:文案缺键时数字仍在场(不靠译文承载事实) */
  params: Record<string, string | number>
}

/** KPI 读数。`null` 一律是"量不到",不是 0。 */
export interface AgentTraceKpi {
  stepCount: number
  successCount: number
  errorCount: number
  cancelledCount: number
  runningCount: number
  measuredStepCount: number
  unmeasuredStepCount: number
  measuredTotalMs: number
  slowestStepIndex: number | null
  slowestToolName: string | null
  slowestMs: number | null
  slowestShare: number | null
}

export interface BuildAgentTraceReportOptions {
  trace: AgentTrace
  translate?: ReportTranslate
  thresholds?: Partial<TraceFindingThresholds>
}

export interface AgentTraceReport {
  kpi: AgentTraceKpi
  findings: TraceFinding[]
  /** 取词回显(等于键名或空串)的键清单:非空即本地化欠账,报告里显式点名,不静默 */
  missingCopyKeys: string[]
  html: string
}

/**
 * 外部 JSON 归一化的落点在 trace-metrics.ts(`normalizeAgentTraceStep`):
 * 那一层同时持有 STATUS_BUCKETS,运行期状态取值由它反查,本层不另立名单。
 */
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
