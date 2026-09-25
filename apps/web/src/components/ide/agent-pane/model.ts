// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type {
  AgentStreamEvent,
  GoalHardCriterion,
  GoalVerification,
} from '@ihui/api-client'
import type { PlanStepStatus, TerminalTask } from '@/hooks/use-agent-progress'
import type { InlineDiffInfo } from '@/components/ai/types'
import { FALLBACK_MODELS } from '@/components/chat/fallback-models'

// 2026-09-09 0-6 组件拆分:MODEL_OPTIONS 由 agent-pane.tsx 收敛进 model(纯数据,无 JSX)
export const MODEL_OPTIONS: ReadonlyArray<{ value: string; labelKey?: string; label?: string }> = [
  { value: '', labelKey: 'agentPane.modelDefault' },
  ...FALLBACK_MODELS.map((m) => ({ value: m.value, label: m.label })),
]

export const CHANGE_TOOL_NAMES = new Set(['edit_file', 'write_file'])

export interface ToolEventData {
  id?: string
  name?: string
  toolName?: string
  args?: Record<string, unknown>
  arguments?: Record<string, unknown>
  result?: unknown
  error?: string
  iteration?: number
}

export function parseToolData(event: AgentStreamEvent): ToolEventData {
  return event as unknown as ToolEventData
}

export interface TerminalEventData {
  id?: string
  command?: string
  status?: string
  output?: string
  exitCode?: number
}

export function parseTerminalData(event: AgentStreamEvent): TerminalEventData {
  return event as unknown as TerminalEventData
}

export interface PlanStepData {
  step: string
  status?: string
  startedAt?: string
  endedAt?: string
  durationMs?: number
}

export interface PlanEventData {
  explanation?: string
  plan?: PlanStepData[]
}

export function parsePlanData(event: AgentStreamEvent): PlanEventData {
  return event as unknown as PlanEventData
}

export function isPlanStepStatus(value: unknown): value is PlanStepStatus {
  // 契约五态:pending/in_progress/completed/skipped/failed
  return (
    value === 'pending' ||
    value === 'in_progress' ||
    value === 'completed' ||
    value === 'skipped' ||
    value === 'failed'
  )
}

export function isTerminalStatus(value: unknown): value is TerminalTask['status'] {
  return value === 'running' || value === 'completed' || value === 'failed'
}

export function deriveDiffInfoFromArgs(
  toolName: string,
  args: Record<string, unknown>,
  unknownFileLabel: string,
): InlineDiffInfo | null {
  const pickString = (keys: string[]): string => {
    for (const key of keys) {
      const value = args[key]
      if (typeof value === 'string') return value
    }
    return ''
  }

  const filePath = pickString(['path', 'file_path', 'filePath', 'filename']) || unknownFileLabel

  if (toolName === 'edit_file') {
    const oldContent = pickString(['oldText', 'old_text', 'oldContent', 'old_content'])
    const newContent = pickString(['newText', 'new_text', 'newContent', 'new_content'])
    if (!oldContent && !newContent) return null
    return { file_path: filePath, old_content: oldContent, new_content: newContent }
  }

  if (toolName === 'write_file') {
    const content = pickString(['content', 'fileContent', 'file_content', 'text'])
    if (!content) return null
    return { file_path: filePath, old_content: '', new_content: content, is_new_file: true }
  }

  return null
}

// ============================================================================
// goal 模式独立校验闸门(AGENTS.md §8 第 3 步)—— done 帧 → UI 视图模型
// ----------------------------------------------------------------------------
// 闸门本体在 ai-service(`app/services/goal_completion_gate.py`),结论随 done 帧的
// `verification` / `goal_status` 到达本端(见 packages/api-client GoalVerification)。
// 本层**不重算结论**,只负责两件半件事:
//  ① 把服务端档位收敛成六档;认不出的档位一律折成 `undetermined`(不猜);
//  ② fail-closed:done 帧缺 `verification` 对象、缺 `goal_status`、或写着 achieved 却
//     没有闸门自己的 `treat_as_complete === true` 时,绝不落到「完成」那一档。
//     把「判不了」渲染成「干完了」正是 §8 禁止的模型自评,所以这一条比显示更重要;
//  ③ 「本次没声明硬性指标」(not_declared)与「校验判未判定」(undetermined)必须分档,
//     否则普通运行会被误读成校验失败。
// ============================================================================

/** 服务端 `AgentExecuteRequest.hard_criteria` 的 max_length(routers/agents.py),超出的行丢弃。 */
export const HARD_CRITERIA_MAX = 40

/**
 * 输入框文本 → 执行**前**声明的硬性指标(每行一条,空行忽略)。
 * id 取序号 `c1..cN`:服务端只要求 id 非空且唯一(重复即拒 422),不承载语义;
 * 拿 statement 当 id 会撞它的 max_length=64,所以不那么写。
 */
export function buildHardCriteria(rawText: string): GoalHardCriterion[] {
  return rawText
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .slice(0, HARD_CRITERIA_MAX)
    .map((statement, index) => ({ id: `c${index + 1}`, statement, required: true }))
}

/** UI 侧收敛后的六档(goal_status 档位比这更多,未列出的全部并入 undetermined)。 */
export type GoalVerificationKind =
  | 'achieved'
  | 'unmet'
  | 'undetermined'
  | 'blocked'
  | 'budget_limited'
  | 'not_declared'

export interface GoalVerificationView {
  kind: GoalVerificationKind
  /** 闸门原始结论(not_declared 时为 null)——展示件按它逐条渲染 verdict/reason */
  verification: GoalVerification | null
  /** 达标条数;闸门没给指标时为 null(不得显示 0/0 冒充「全条不达标」) */
  metCount: number | null
  totalCount: number | null
}

/** 判「达成」的**唯一**入口:档位 + 闸门自己的放行章,两者同时成立。 */
function isGateAllowed(record: Record<string, unknown>): boolean {
  return record.treat_as_complete === true
}

/**
 * done 帧 → 六档视图。
 *
 * `criteriaDeclared` 是**调用侧上下文**(本次请求有没有声明硬性指标)。缺了它就分不清
 * "没要求校验" 与 "要求了却没拿到结论" —— 后者必须 fail-closed 成 undetermined,否则
 * 旧版服务端 / 丢帧会把一次没被校验过的运行静默渲染成"什么都没发生",而 §8 禁止的
 * 正是这种静默(它等价于让执行模型自己宣布完成)。
 */
export function resolveGoalVerificationView(
  event: AgentStreamEvent,
  criteriaDeclared = false,
): GoalVerificationView {
  const raw: unknown = event.verification
  if (typeof raw !== 'object' || raw === null) {
    if (criteriaDeclared) {
      // 声明了指标却没拿到结论 = 判不了(不等于通过)
      return { kind: 'undetermined', verification: null, metCount: null, totalCount: null }
    }
    // 本次请求根本没声明硬性指标 → 闸门未运行(与「运行了但判不了」必须分开)
    return { kind: 'not_declared', verification: null, metCount: null, totalCount: null }
  }
  const record = raw as Record<string, unknown>
  const verification = raw as GoalVerification
  const criteria = Array.isArray(record.criteria) ? (record.criteria as unknown[]) : []
  const metCount = criteria.length
    ? criteria.filter((item) => (item as { verdict?: unknown })?.verdict === 'met').length
    : null
  const totalCount = criteria.length || null
  // goal_status 缺失时退回内层 status(闸门两处同写);两处都认不出 → 判不了
  const status =
    typeof record.goal_status === 'string'
      ? record.goal_status
      : typeof record.status === 'string'
        ? record.status
        : ''
  const fallback = (kind: GoalVerificationKind): GoalVerificationView => ({
    kind,
    verification,
    metCount,
    totalCount,
  })
  switch (status) {
    case 'achieved':
      // 写着 achieved 却没放行章 = 帧被拼出来的,不认
      return isGateAllowed(record) ? fallback('achieved') : fallback('undetermined')
    case 'not_achieved':
      return fallback('unmet')
    case 'undetermined':
    case 'not_run':
      return fallback('undetermined')
    case 'blocked':
      return fallback('blocked')
    case 'budget_limited':
      return fallback('budget_limited')
    case 'not_declared':
    case 'skipped':
      // 要求了校验却被服务端标成「跳过」= 同样不能当成没事发生
      return criteriaDeclared
        ? fallback('undetermined')
        : { kind: 'not_declared', verification, metCount: null, totalCount: null }
    default:
      return fallback('undetermined')
  }
}

/**
 * 结果区图标色调:闸门没放行时不许再挂「绿色对勾」—— 那会让一次未达成/未判定的运行
 * 在页面上看起来像完成(本票要根除的正是这一格)。
 */
export type ResultTone = 'success' | 'failure' | 'warning'

export function resultToneFromGoalKind(kind: GoalVerificationKind | null): ResultTone {
  if (kind === 'achieved') return 'success'
  if (kind === 'unmet' || kind === 'blocked') return 'failure'
  if (kind === 'undetermined' || kind === 'budget_limited') return 'warning'
  // not_declared / null:非 goal 运行,维持既有观感(校验结论由独立区块呈现)
  return 'success'
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
