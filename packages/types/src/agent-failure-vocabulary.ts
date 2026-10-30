// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Agent 失败词表的两个缺失维度:**结局二分**与**停摆位置**(2026-10-31 立)。
 *
 * 它在修什么(本仓现状,现读复验于 2026-10-31):
 * - 失败只有一档笼统的 `error`(回合终态封闭集里的 `error` 一档,见
 *   `packages/types/src/agent-runtime.ts` 的 AGENT_TURN_STOP_REASONS),而**这一档能不能重试**
 *   今天只住在 `apps/ai-service/app/services/agent_loop_v2.py` 的一份私有 frozenset 里 ——
 *   词表没被声明,所以除那条 if 之外没有任何一层能读到"可重试/终局"这个事实;
 * - "停在哪个环节"这一维全仓没有词表:LLM 重试、工具超时、审批等待、SSE 续传失败、
 *   队列 ACK 后蒸发、权限/预算/hook 拒绝、doom loop 停机各有各的出口,事后只能靠散文猜。
 *
 * **两条轴,不得合并**(合并即把"停在哪"和"还有什么出路"折成一格,是同型失效):
 * - `AgentFailureOutcome` 答"这次失败还有没有自动出路":retryable / terminal / **undetermined**;
 * - `AgentStallStage` 答"它停在哪个环节",每一档都必须指到本仓一处真实停摆现场
 *   (见 AGENT_STALL_STAGE_SITES,漂移由 packages/types/tests 的锚点存在性断言判红,不许凭空造词)。
 *
 * 第三档 `undetermined` 是本仓的硬要求(AGENTS §0.3:取不到输入必须显式「未判定」,
 * 既不冒绿也不冒红):对照程序把失败二分成"可重试/终局"两档,**没有**"判不出"这一态,
 * 于是它把 unknown 静默并进了不可重试一侧。本表反过来:认不出的错误族一律落 `undetermined`,
 * **绝不**当作 terminal —— "不知道能不能重试"说成"重试没用"是方向相反的失真(§0.10)。
 *
 * 边界声明(三个近邻域,互不顶账):
 * - `error-serialize.ts` 的 `FAILURE_STAGES`(client_validation / upstream_request / local_persist)
 *   答的是**一次 API 业务调用在哪条请求边界上失败**;本表答的是**一次 agent 长跑停在哪个环节**,
 *   两域成员互不引用,不得并置进同一张表;
 * - `agent-runtime.ts` 的 `RetryPolicy.retryableErrors`(全仓零消费者)是**调度策略配置面**的
 *   错误类型清单(用户可填的档名),不是判定面的错误族,不得互相替代;
 * - 回合终态 `AGENT_TURN_STOP_REASONS` 答"回合以哪一档收口"(含 cancelled/paused 这类非失败档),
 *   本表的 outcome 只在**已判定为失败**的输入上有意义,非失败输入的判据出口回 `undetermined`
 *   而不是硬塞一档。
 *
 * 跨语言:Python 侧镜像 = `apps/ai-service/app/core/agent_failure_vocabulary.py`
 * (成员集合逐字等值)。对账实现位置见该文件头注与本仓缺口登记:成员等值今天由
 * `apps/ai-service/tests/test_agent_failure_vocabulary.py` 与
 * `packages/types/tests/agent-failure-vocabulary.test.ts` 双侧钉住,**尚无提交链守门看守本域**
 * (守门 151 的射程按 2026-10-07 机主裁定不外扩,本域按同一条纪律另计,不挤进既有门)。
 */

/** 失败结局三档。`undetermined` 是显式第三态,不是"暂时没算出来"的占位。 */
export const AGENT_FAILURE_OUTCOMES = ['retryable', 'terminal', 'undetermined'] as const

export type AgentFailureOutcome = (typeof AGENT_FAILURE_OUTCOMES)[number]

/** 停摆位置封闭集(每档的真实现场见 AGENT_STALL_STAGE_SITES)。 */
export const AGENT_STALL_STAGES = [
  'llm_request',
  'tool_execution',
  'approval_wait',
  'elicitation_wait',
  'stream_channel',
  'queue_dispatch',
  'permission_gate',
  'budget_governance',
  'hook_pipeline',
  'doom_loop_guard',
  'undetermined',
] as const

export type AgentStallStage = (typeof AGENT_STALL_STAGES)[number]

/** 错误族中"重试语义安全"的那一侧 —— 与 Python 侧逐字镜像,也是 retry 闸的唯一取源。 */
export const AGENT_RETRYABLE_ERROR_FAMILIES = ['timeout', 'connection', 'http_5xx'] as const

/** 错误族中"重试无意义"的那一侧:判定成立才登记,认不出的一律不进这张表。 */
export const AGENT_TERMINAL_ERROR_FAMILIES = [
  'http_4xx',
  'cancelled',
  'aborted',
  'user_rejected',
  'permission_denied',
  'approval_timeout',
  'hook_denied',
  'axis_forbid',
  'budget_exceeded',
] as const

export type AgentJudgedErrorFamily =
  (typeof AGENT_RETRYABLE_ERROR_FAMILIES)[number] | (typeof AGENT_TERMINAL_ERROR_FAMILIES)[number]

/** 停摆现场的形状:文件 + 该文件里必须存在的锚点标识符(改名即判红,不读成"搬家了就算没有")。 */
export interface AgentStallStageSite {
  readonly file: string
  readonly anchor: string
}

/**
 * 每一档停摆位置对应的**本仓真实现场**(相对仓库根的路径)。
 * `undetermined` 刻意映射 null:它是"指不出环节"的显式第三态,没有现场可指,
 * 也不许借任一真实环节冒充 —— 测试对本档只判"必须为 null",不判存在性。
 */
export const AGENT_STALL_STAGE_SITES: Readonly<
  Partial<Record<AgentStallStage, AgentStallStageSite>>
> = {
  llm_request: {
    file: 'apps/ai-service/app/core/responses_retry.py',
    anchor: 'decide_stream_retry',
  },
  tool_execution: {
    file: 'apps/ai-service/app/services/agent_loop_v2.py',
    anchor: '_report_tool_error',
  },
  approval_wait: {
    file: 'apps/ai-service/app/core/mcp_tool_approval.py',
    anchor: 'requires_mcp_tool_approval',
  },
  elicitation_wait: {
    file: 'apps/ai-service/app/core/elicitation_pause.py',
    anchor: 'wait_until_clear',
  },
  stream_channel: {
    file: 'apps/ai-service/app/core/sse_buffer.py',
    anchor: 'not_resumable',
  },
  queue_dispatch: {
    file: 'apps/ai-service/app/core/queue_ledger.py',
    anchor: 'def recover',
  },
  permission_gate: {
    file: 'apps/ai-service/app/core/permission_axis_gate.py',
    anchor: 'AxisDecision',
  },
  budget_governance: {
    file: 'apps/ai-service/app/services/tool_budget_governor.py',
    anchor: 'budget_exceeded',
  },
  hook_pipeline: { file: 'apps/ai-service/app/core/hook_runtime.py', anchor: 'HookOutcome' },
  doom_loop_guard: {
    file: 'apps/ai-service/app/core/doom_loop.py',
    anchor: 'DOOM_ALERT_ROUNDS_TO_TERMINATE',
  },
}

const FAILURE_OUTCOME_SET: ReadonlySet<string> = new Set<string>(AGENT_FAILURE_OUTCOMES)
const STALL_STAGE_SET: ReadonlySet<string> = new Set<string>(AGENT_STALL_STAGES)
const RETRYABLE_FAMILY_SET: ReadonlySet<string> = new Set<string>(AGENT_RETRYABLE_ERROR_FAMILIES)
const TERMINAL_FAMILY_SET: ReadonlySet<string> = new Set<string>(AGENT_TERMINAL_ERROR_FAMILIES)

/** 任意输入 → 规范结局档;认不出返回 null(**不**回退 `undetermined`:归一化判"是不是这一族",判不出归哪一档是下面的分类器的事)。 */
export function normalizeAgentFailureOutcome(raw: unknown): AgentFailureOutcome | null {
  return typeof raw === 'string' && FAILURE_OUTCOME_SET.has(raw)
    ? (raw as AgentFailureOutcome)
    : null
}

/** 任意输入 → 规范停摆档;认不出返回 null(同上,不猜)。 */
export function normalizeAgentStallStage(raw: unknown): AgentStallStage | null {
  return typeof raw === 'string' && STALL_STAGE_SET.has(raw) ? (raw as AgentStallStage) : null
}

/**
 * 错误族 → 失败结局(唯一的判定出口,纯函数零 IO)。
 *
 * 判序:命中可重试族 ⇒ `retryable`;命中终局族 ⇒ `terminal`;**其余一切**(含 `unknown`、
 * 空串、null、宿主盖章的未登记错误码)⇒ `undetermined`。
 * 最后这一步是本表与"二分"的差别所在:未登记**不等于**不可重试,它等于"这一格没判"。
 * 消费方拿到 `undetermined` 必须显式处置(报给人/记未判定),不得回退成 `terminal`。
 */
export function agentFailureOutcomeOf(errorFamily: unknown): AgentFailureOutcome {
  if (typeof errorFamily !== 'string') return 'undetermined'
  if (RETRYABLE_FAMILY_SET.has(errorFamily)) return 'retryable'
  if (TERMINAL_FAMILY_SET.has(errorFamily)) return 'terminal'
  return 'undetermined'
}

/** 结局是否为"判出来的"(undetermined 恒 false —— 不许把没判读成判过,§0.3)。 */
export function isAgentFailureOutcomeJudged(outcome: unknown): outcome is AgentFailureOutcome {
  return (
    typeof outcome === 'string' && outcome !== 'undetermined' && FAILURE_OUTCOME_SET.has(outcome)
  )
}

/** 取某一档停摆位置的登记现场;`undetermined` 与未登记值一律 null。 */
export function agentStallStageSite(stage: unknown): AgentStallStageSite | null {
  const normalized = normalizeAgentStallStage(stage)
  if (normalized === null || normalized === 'undetermined') return null
  return AGENT_STALL_STAGE_SITES[normalized] ?? null
}

// ==================== 用户可见文案的 i18n 键(§30:五语言同批,禁端内硬编码)====================

/** 成员 → PascalCase 段(`llm_request` → `LlmRequest`),键集由登记表推导,不抄第二份成员清单。 */
function toPascalSegment(member: string): string {
  return member
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')
}

/** 结局档的词条键(住在 `packages/i18n/messages/cli/*.json` 的 `cli` 命名空间)。 */
export const AGENT_FAILURE_OUTCOME_LABEL_KEYS = Object.fromEntries(
  AGENT_FAILURE_OUTCOMES.map((o) => [o, `cli.failureOutcome${toPascalSegment(o)}`]),
) as Record<AgentFailureOutcome, string>

/** 停摆档的词条键。 */
export const AGENT_STALL_STAGE_LABEL_KEYS = Object.fromEntries(
  AGENT_STALL_STAGES.map((s) => [s, `cli.agentStall${toPascalSegment(s)}`]),
) as Record<AgentStallStage, string>

/** 组合播报行(两个槽位各填上面两张表取出的词条译文)。 */
export const AGENT_FAILURE_NOTICE_KEY = 'cli.agentFailureTerminated'

/** 取结局档词条键;登记表之外一律 null,不替未知值猜一档文案。 */
export function agentFailureOutcomeLabelKey(outcome: string): string | null {
  return Object.prototype.hasOwnProperty.call(AGENT_FAILURE_OUTCOME_LABEL_KEYS, outcome)
    ? AGENT_FAILURE_OUTCOME_LABEL_KEYS[outcome as AgentFailureOutcome]
    : null
}

/** 取停摆档词条键;同上,登记表之外一律 null。 */
export function agentStallStageLabelKey(stage: string): string | null {
  return Object.prototype.hasOwnProperty.call(AGENT_STALL_STAGE_LABEL_KEYS, stage)
    ? AGENT_STALL_STAGE_LABEL_KEYS[stage as AgentStallStage]
    : null
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
