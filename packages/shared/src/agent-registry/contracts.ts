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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
