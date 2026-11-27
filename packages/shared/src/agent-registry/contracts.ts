// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 总管智能体 · 契约单一源（F0 / P0-03 / V2-08）。
 *
 * 这里是角色、编排模式、运行/定义/审批状态、作用域、错误码五族封闭枚举的**唯一权威定义**。
 * 任何新代码（api / ai-service / web / cli / mobile）只允许从本文件取枚举；
 * 旧处若仍有一份，必须标 `@deprecated` 或走适配层（见 `packages/shared/src/subagents/index.ts`），
 * 并由 `scripts/check-agent-contract-single-source.mjs` 扫描兜底，重复定义数必须为 0。
 *
 * 旧值 → 新值/别名（P0-03 盘点结论）：
 * - AgentRole: 5（researcher/coder/reviewer/architect/debugger）→ 10 内置 + custom
 *   （新增 frontend-dev/backend-dev/devops/security-auditor/test-engineer，旧 5 值全保留）。
 * - OrchestrationMode: 7（pipeline/parallel/debate/vote/critique/decomposed/with_communication）
 *   → 9（single/parallel/pipeline/debate/vote/critique/decomposed/team/recursive）。
 *   别名：`decompose` → `decomposed`；`with_communication` → `team`（ai-service 的
 *   run_with_communication 就是 team 语义）。落库/派发前必须 `normalizeOrchestrationMode()`。
 * - RunStatus: 新封闭 8 值（queued/running/paused/succeeded/failed/canceled/timeout/blocked）。
 *   注意旧派单 `DispatchStatus` 的 `cancelled` 是另一域，不并入本枚举。
 * - DefinitionStatus: 3（active/disabled/deleted）；purge 是物理删行，不是第 4 个状态。
 * - ApprovalStatus: 6（pending/approved/rejected/expired/consumed/failed）。
 * - Scope: 3（system/personal/team）。
 * - ErrorCode: 全量 40 个（对齐 01 §4.4 错误码与 HTTP 映射表）。
 *
 * 约定（00 §5）：错误码大写下划线、封闭集，新增走 ADR；状态小写英文、封闭集，前端只认这组。
 */

// ---------------------------------------------------------------------------
// 角色（AgentRole）
// ---------------------------------------------------------------------------

/**
 * 10 个内置角色。与 `apps/ai-service/app/services/prompt_registry.py` 的
 * DEFAULT_PROMPTS 十个内置一一对应；同时也是内置定义（agent_definitions.name）的保留名。
 */
export const AGENT_ROLES = [
  'researcher',
  'coder',
  'reviewer',
  'architect',
  'debugger',
  'frontend-dev',
  'backend-dev',
  'devops',
  'security-auditor',
  'test-engineer',
] as const

/** 10 个内置角色之一（不含 custom）。 */
export type BuiltinAgentRole = (typeof AGENT_ROLES)[number]

/**
 * 角色全集 = 10 内置 + `custom`。
 * `custom` 是 agent_definitions.role 的默认值（01 §3.1），v1 只读不建角色系统（01 Q15）。
 * 顺序 = AGENT_ROLES 的 10 项 + custom（单测断言两者一致，禁止两处各写一份）。
 */
export const AGENT_ROLE_VALUES = [
  'researcher',
  'coder',
  'reviewer',
  'architect',
  'debugger',
  'frontend-dev',
  'backend-dev',
  'devops',
  'security-auditor',
  'test-engineer',
  'custom',
] as const

/** 智能体定义的角色。10 内置 + custom，封闭集。 */
export type AgentRole = (typeof AGENT_ROLE_VALUES)[number]

// ---------------------------------------------------------------------------
// 编排模式（OrchestrationMode）
// ---------------------------------------------------------------------------

/**
 * 9 个派发/编排模式。对齐 `agent_runs.mode` CHECK 约束与 `agent_ops.dispatch` 的
 * JSON Schema enum（01 §3.3 / §5）；`agent_orchestrator` 九模式复用，不新写执行器。
 */
export const ORCHESTRATION_MODES = [
  'single',
  'parallel',
  'pipeline',
  'debate',
  'vote',
  'critique',
  'decomposed',
  'team',
  'recursive',
] as const

/** 9 个规范编排模式，封闭集。 */
export type OrchestrationMode = (typeof ORCHESTRATION_MODES)[number]

/**
 * 历史别名 → 规范模式。
 * - `decompose`：文档/工具里与 `decomposed` 混用，统一归一到 `decomposed`。
 * - `with_communication`：旧 shared 7 值之一，语义即 `team`（ai-service `run_with_communication`）。
 */
export const ORCHESTRATION_MODE_ALIASES = {
  decompose: 'decomposed',
  with_communication: 'team',
} as const satisfies Readonly<Record<string, OrchestrationMode>>

/** 历史别名（仅用于兼容层/迁移，不得写进新契约字段）。 */
export type OrchestrationModeAlias = keyof typeof ORCHESTRATION_MODE_ALIASES

/** 输入侧允许的编排模式 = 9 规范值 + 2 历史别名。 */
export type OrchestrationModeInput = OrchestrationMode | OrchestrationModeAlias

// ---------------------------------------------------------------------------
// 运行时守卫与归一（角色/编排）
// ---------------------------------------------------------------------------

function isOneOf<T extends string>(values: readonly T[], value: string): value is T {
  return (values as readonly string[]).includes(value)
}

/** 是否为 10 内置角色（不含 custom）。 */
export function isBuiltinAgentRole(value: string): value is BuiltinAgentRole {
  return isOneOf(AGENT_ROLES, value)
}

/** 是否为合法角色（10 内置 + custom）。 */
export function isAgentRole(value: string): value is AgentRole {
  return isOneOf(AGENT_ROLE_VALUES, value)
}

/** 是否为 9 个规范编排模式（不含历史别名）。 */
export function isOrchestrationMode(value: string): value is OrchestrationMode {
  return isOneOf(ORCHESTRATION_MODES, value)
}

/** 是否为历史编排别名。 */
export function isOrchestrationModeAlias(value: string): value is OrchestrationModeAlias {
  return Object.prototype.hasOwnProperty.call(ORCHESTRATION_MODE_ALIASES, value)
}

/**
 * 把规范值或历史别名归一为 9 规范模式；未知值返回 undefined（边界解析不抛异常）。
 * 落库/派发前必须调用；新代码不得把别名写进 agent_runs.mode。
 */
export function normalizeOrchestrationMode(value: string): OrchestrationMode | undefined {
  if (isOrchestrationMode(value)) return value
  if (isOrchestrationModeAlias(value)) return ORCHESTRATION_MODE_ALIASES[value]
  return undefined
}

// ---------------------------------------------------------------------------
// 运行状态（RunStatus）
// ---------------------------------------------------------------------------

/**
 * 运行状态 8 值，封闭集。对齐 `agent_runs.status` CHECK（01 §3.3）与运行状态机（01 §2.3）。
 * 注意拼写是 `canceled`（单 l），与旧派单域 `DispatchStatus.cancelled` 刻意区分。
 */
export const RUN_STATUSES = [
  'queued',
  'running',
  'paused',
  'succeeded',
  'failed',
  'canceled',
  'timeout',
  'blocked',
] as const

/** 运行状态，封闭集 8 值。 */
export type RunStatus = (typeof RUN_STATUSES)[number]

/** 终态运行（不可再 pause/resume/steer，重跑必须新建 run，I6）。 */
export const TERMINAL_RUN_STATUSES = [
  'succeeded',
  'failed',
  'canceled',
  'timeout',
] as const satisfies readonly RunStatus[]

/** 未终态运行（并发/心跳/活跃索引使用的集合）。 */
export const ACTIVE_RUN_STATUSES = [
  'queued',
  'running',
  'paused',
  'blocked',
] as const satisfies readonly RunStatus[]

/** 终态运行状态。 */
export type TerminalRunStatus = (typeof TERMINAL_RUN_STATUSES)[number]

// ---------------------------------------------------------------------------
// 定义状态（DefinitionStatus）
// ---------------------------------------------------------------------------

/**
 * 定义状态 3 值，封闭集。对齐 `agent_definitions.status` CHECK（01 §3.1）。
 * `purge` 是物理删除行（历史 run 的 definition_id 置空），不是第 4 个状态。
 */
export const DEFINITION_STATUSES = ['active', 'disabled', 'deleted'] as const

/** 定义状态，封闭集 3 值。 */
export type DefinitionStatus = (typeof DEFINITION_STATUSES)[number]

// ---------------------------------------------------------------------------
// 审批状态（ApprovalStatus）
// ---------------------------------------------------------------------------

/**
 * 审批状态 6 值，封闭集。对齐 `agent_management_approvals.status` CHECK（01 §3.5）。
 * 审批一次性：pending → approved → consumed；不存在 session/always 永久放行（V2-01）。
 */
export const APPROVAL_STATUSES = [
  'pending',
  'approved',
  'rejected',
  'expired',
  'consumed',
  'failed',
] as const

/** 审批状态，封闭集 6 值。 */
export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number]

// ---------------------------------------------------------------------------
// 作用域（Scope）
// ---------------------------------------------------------------------------

/**
 * 定义作用域 3 值，封闭集。system 为全局内置（owner 为空）；personal 归个人；
 * team 指向人类工作区 `teams`（不是 agent_teams，V2-09）。
 */
export const SCOPES = ['system', 'personal', 'team'] as const

/** 定义作用域，封闭集 3 值。 */
export type Scope = (typeof SCOPES)[number]

// ---------------------------------------------------------------------------
// 错误码（ErrorCode）
// ---------------------------------------------------------------------------

/**
 * 错误码全集（40 个），逐条对齐 01 §4.4；新增必须走 ADR（00 §5）。
 * `AGENT_DISABLED` / `AGENT_DELETED` 在映射表里是两档（409 / 404），这里保持两个独立码。
 */
export const ERROR_CODES = [
  'AGENT_NOT_FOUND',
  'AGENT_AMBIGUOUS',
  'AGENT_FORBIDDEN',
  'AGENT_NAME_TAKEN',
  'AGENT_NAME_RESERVED',
  'AGENT_SCOPE_INVALID',
  'AGENT_PROTECTED',
  'AGENT_VERSION_CONFLICT',
  'AGENT_DISABLED',
  'AGENT_DELETED',
  'AGENT_QUOTA_EXCEEDED',
  'AGENT_TOOL_UNKNOWN',
  'AGENT_TOOL_FORBIDDEN',
  'AGENT_PROMPT_TOO_LONG',
  'AGENT_DELETE_BLOCKED',
  'AGENT_PREVIEW_REQUIRED',
  'AGENT_PREVIEW_EXPIRED',
  'AGENT_NOT_RESTORABLE',
  'AGENT_PURGE_TOO_EARLY',
  'AGENT_RUN_NOT_FOUND',
  'AGENT_RUN_NOT_ACTIVE',
  'AGENT_STEER_UNSUPPORTED',
  'AGENT_PAUSE_UNSUPPORTED',
  'CHECKPOINT_UNAVAILABLE',
  'RESUME_FAILED',
  'AGENT_RECURSION_LIMIT',
  'RUN_LEDGER_UNAVAILABLE',
  'MODEL_UNAVAILABLE',
  'AUDIT_UNAVAILABLE',
  'AGENT_INTERNAL_ERROR',
  'APPROVAL_NOT_FOUND',
  'AGENT_BUDGET_INSUFFICIENT',
  'AGENT_RATE_LIMITED',
  'APPROVAL_REQUIRED',
  'APPROVAL_EXPIRED',
  'APPROVAL_MISMATCH',
  'APPROVAL_CONSUMED',
  'IDEMPOTENCY_CONFLICT',
  'STORAGE_UNAVAILABLE',
  'FEATURE_DISABLED',
] as const

/** 封闭错误码全集。 */
export type ErrorCode = (typeof ERROR_CODES)[number]

/** 错误码 → HTTP 状态码（01 §4.4 原表）。Record 保证新增错误码必须同步映射。 */
export const ERROR_HTTP_STATUS: Readonly<Record<ErrorCode, number>> = {
  AGENT_NOT_FOUND: 404,
  AGENT_AMBIGUOUS: 409,
  AGENT_FORBIDDEN: 403,
  AGENT_NAME_TAKEN: 409,
  AGENT_NAME_RESERVED: 400,
  AGENT_SCOPE_INVALID: 400,
  AGENT_PROTECTED: 403,
  AGENT_VERSION_CONFLICT: 409,
  AGENT_DISABLED: 409,
  AGENT_DELETED: 404,
  AGENT_QUOTA_EXCEEDED: 429,
  AGENT_TOOL_UNKNOWN: 422,
  AGENT_TOOL_FORBIDDEN: 403,
  AGENT_PROMPT_TOO_LONG: 422,
  AGENT_DELETE_BLOCKED: 409,
  AGENT_PREVIEW_REQUIRED: 428,
  AGENT_PREVIEW_EXPIRED: 410,
  AGENT_NOT_RESTORABLE: 409,
  AGENT_PURGE_TOO_EARLY: 409,
  AGENT_RUN_NOT_FOUND: 404,
  AGENT_RUN_NOT_ACTIVE: 409,
  AGENT_STEER_UNSUPPORTED: 422,
  AGENT_PAUSE_UNSUPPORTED: 422,
  CHECKPOINT_UNAVAILABLE: 409,
  RESUME_FAILED: 500,
  AGENT_RECURSION_LIMIT: 409,
  RUN_LEDGER_UNAVAILABLE: 503,
  MODEL_UNAVAILABLE: 503,
  AUDIT_UNAVAILABLE: 503,
  AGENT_INTERNAL_ERROR: 500,
  APPROVAL_NOT_FOUND: 404,
  AGENT_BUDGET_INSUFFICIENT: 402,
  AGENT_RATE_LIMITED: 429,
  APPROVAL_REQUIRED: 428,
  APPROVAL_EXPIRED: 410,
  APPROVAL_MISMATCH: 409,
  APPROVAL_CONSUMED: 409,
  IDEMPOTENCY_CONFLICT: 409,
  STORAGE_UNAVAILABLE: 503,
  FEATURE_DISABLED: 403,
}

/** 可重试错误码（01 §4.4「可重试」列；重试策略由调用方决定）。 */
export const RETRYABLE_ERROR_CODES = [
  'AGENT_VERSION_CONFLICT',
  'AGENT_QUOTA_EXCEEDED',
  'AGENT_DELETE_BLOCKED',
  'AGENT_PREVIEW_REQUIRED',
  'AGENT_PREVIEW_EXPIRED',
  'RESUME_FAILED',
  'RUN_LEDGER_UNAVAILABLE',
  'MODEL_UNAVAILABLE',
  'AUDIT_UNAVAILABLE',
  'AGENT_INTERNAL_ERROR',
  'AGENT_BUDGET_INSUFFICIENT',
  'AGENT_RATE_LIMITED',
  'APPROVAL_REQUIRED',
  'APPROVAL_EXPIRED',
  'STORAGE_UNAVAILABLE',
] as const satisfies readonly ErrorCode[]

// ---------------------------------------------------------------------------
// 运行时守卫与归一（状态/错误码）
// ---------------------------------------------------------------------------

/** 是否终态运行。 */
export function isTerminalRunStatus(value: string): value is TerminalRunStatus {
  return isOneOf(TERMINAL_RUN_STATUSES, value)
}

/** 是否为合法运行状态。 */
export function isRunStatus(value: string): value is RunStatus {
  return isOneOf(RUN_STATUSES, value)
}

/** 是否为合法定义状态。 */
export function isDefinitionStatus(value: string): value is DefinitionStatus {
  return isOneOf(DEFINITION_STATUSES, value)
}

/** 是否为合法审批状态。 */
export function isApprovalStatus(value: string): value is ApprovalStatus {
  return isOneOf(APPROVAL_STATUSES, value)
}

/** 是否为合法作用域。 */
export function isScope(value: string): value is Scope {
  return isOneOf(SCOPES, value)
}

/** 是否为合法错误码。 */
export function isErrorCode(value: string): value is ErrorCode {
  return isOneOf(ERROR_CODES, value)
}

/** 错误码 → HTTP 状态码；未知码返回 500（与 AGENT_INTERNAL_ERROR 对齐）。 */
export function httpStatusForErrorCode(code: ErrorCode): number {
  return ERROR_HTTP_STATUS[code]
}

/** 错误码是否可重试。 */
export function isRetryableErrorCode(code: ErrorCode): boolean {
  return (RETRYABLE_ERROR_CODES as readonly ErrorCode[]).includes(code)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
