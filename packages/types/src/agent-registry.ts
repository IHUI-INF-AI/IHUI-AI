// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 总管智能体注册表 · 跨端 DTO 契约（F0 / P1-18）。
 *
 * 形状对齐 01 §4.2（公共端点请求/响应）、§3（5 张表）、§5.2（工具结果信封）。
 * 字段一律 camelCase（API JSON），时间一律 ISO 8601 字符串（UTC，服务端存 UTC、展示按用户时区）。
 * **禁止 any**：未知结构用 `unknown`，可空用 `| null`。
 *
 * 枚举值集是 `packages/shared/src/agent-registry/contracts.ts` 的镜像。
 * 为什么镜像而不是 import：`@ihui/shared` 依赖 `@ihui/types`（shared→types 单向），
 * 若 types 反向 import shared 会形成包级环；本包 tsconfig 的 rootDir 也不允许跨包源码。
 * 因此这里**只允许逐字等值镜像**，并由 `scripts/check-agent-contract-single-source.mjs`
 * 做值集对账（多/少/改拼写即红）。改枚举必须先改 contracts.ts，再同步本文件。
 */

// ---------------------------------------------------------------------------
// 枚举镜像（值集必须与 contracts.ts 完全一致，门禁对账）
// ---------------------------------------------------------------------------

/** 角色镜像：10 内置 + custom。 */
export type AgentRole =
  | 'researcher'
  | 'coder'
  | 'reviewer'
  | 'architect'
  | 'debugger'
  | 'frontend-dev'
  | 'backend-dev'
  | 'devops'
  | 'security-auditor'
  | 'test-engineer'
  | 'custom'

/** 编排模式镜像：9 规范值（历史别名在写入前归一，不属 DTO）。 */
export type OrchestrationMode =
  | 'single'
  | 'parallel'
  | 'pipeline'
  | 'debate'
  | 'vote'
  | 'critique'
  | 'decomposed'
  | 'team'
  | 'recursive'

/** 运行状态镜像：8 值（canceled 单 l）。 */
export type RunStatus =
  'queued' | 'running' | 'paused' | 'succeeded' | 'failed' | 'canceled' | 'timeout' | 'blocked'

/** 定义状态镜像：3 值。 */
export type DefinitionStatus = 'active' | 'disabled' | 'deleted'

/** 审批状态镜像：6 值。 */
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired' | 'consumed' | 'failed'

/** 作用域镜像：3 值。 */
export type Scope = 'system' | 'personal' | 'team'

/** 错误码镜像：40 个（顺序与 contracts.ts 一致，门禁逐项对账）。 */
export type ErrorCode =
  | 'AGENT_NOT_FOUND'
  | 'AGENT_AMBIGUOUS'
  | 'AGENT_FORBIDDEN'
  | 'AGENT_NAME_TAKEN'
  | 'AGENT_NAME_RESERVED'
  | 'AGENT_SCOPE_INVALID'
  | 'AGENT_PROTECTED'
  | 'AGENT_VERSION_CONFLICT'
  | 'AGENT_DISABLED'
  | 'AGENT_DELETED'
  | 'AGENT_QUOTA_EXCEEDED'
  | 'AGENT_TOOL_UNKNOWN'
  | 'AGENT_TOOL_FORBIDDEN'
  | 'AGENT_PROMPT_TOO_LONG'
  | 'AGENT_DELETE_BLOCKED'
  | 'AGENT_PREVIEW_REQUIRED'
  | 'AGENT_PREVIEW_EXPIRED'
  | 'AGENT_NOT_RESTORABLE'
  | 'AGENT_PURGE_TOO_EARLY'
  | 'AGENT_RUN_NOT_FOUND'
  | 'AGENT_RUN_NOT_ACTIVE'
  | 'AGENT_STEER_UNSUPPORTED'
  | 'AGENT_PAUSE_UNSUPPORTED'
  | 'CHECKPOINT_UNAVAILABLE'
  | 'RESUME_FAILED'
  | 'AGENT_RECURSION_LIMIT'
  | 'RUN_LEDGER_UNAVAILABLE'
  | 'MODEL_UNAVAILABLE'
  | 'AUDIT_UNAVAILABLE'
  | 'AGENT_INTERNAL_ERROR'
  | 'APPROVAL_NOT_FOUND'
  | 'AGENT_BUDGET_INSUFFICIENT'
  | 'AGENT_RATE_LIMITED'
  | 'APPROVAL_REQUIRED'
  | 'APPROVAL_EXPIRED'
  | 'APPROVAL_MISMATCH'
  | 'APPROVAL_CONSUMED'
  | 'IDEMPOTENCY_CONFLICT'
  | 'STORAGE_UNAVAILABLE'
  | 'FEATURE_DISABLED'

// ---------------------------------------------------------------------------
// 定义（Definition）
// ---------------------------------------------------------------------------

/** 清单统计（GET /definitions 的 stats）。 */
export interface DefinitionStats {
  /** 近 7 天运行数。 */
  runs7d: number
  /** 近 7 天成功率（0–1）。 */
  successRate: number
  /** 近 7 天消耗积分。 */
  costPoints7d: number
}

/** 定义摘要（列表项 / 创建响应）。 */
export interface DefinitionSummary {
  id: string
  name: string
  displayName: string
  description: string
  scope: Scope
  role: AgentRole
  status: DefinitionStatus
  version: number
  isBuiltin: boolean
  isDispatchable: boolean
  ownerUserId: string | null
  teamId: string | null
  updatedAt: string
  stats?: DefinitionStats
}

/** 权限授予档（对齐 01 §4.2 create 示例）。 */
export type PermissionGrant = 'allow' | 'read' | 'write' | 'deny'

/** 定义级权限（filesystem/network/shell 为已知键，允许扩展）。 */
export interface DefinitionPermissions {
  filesystem?: PermissionGrant
  network?: PermissionGrant
  shell?: PermissionGrant
  [key: string]: PermissionGrant | undefined
}

/** 记忆访问档。 */
export type MemoryAccess = 'none' | 'read' | 'write'

/** 三层记忆策略。 */
export interface MemoryPolicy {
  global?: MemoryAccess
  project?: MemoryAccess
  agent?: MemoryAccess
}

/** 定义预算（01 §4.2 / §5.3 两处示例的并集）。 */
export interface DefinitionBudget {
  dailyTokens?: number
  perRunTokens?: number
  maxPoints?: number
  maxTokens?: number
}

/** 定义元数据（自由 JSON，不含提示词/密钥）。 */
export type DefinitionMetadata = Record<string, unknown>

/** 定义详情（GET /definitions/:id）。systemPrompt 仅 owner/team_admin/admin 可见。 */
export interface DefinitionDetail extends DefinitionSummary {
  /** 完整提示词；无权限时缺省（同时给 promptHash + promptLength）。 */
  systemPrompt?: string
  /** sha256(systemPrompt + model + tools)。 */
  promptHash: string
  promptLength: number
  promptVersion: number
  model: string | null
  temperature: number
  maxTokens: number | null
  maxIterations: number
  tools: readonly string[]
  skills: readonly string[]
  permissions: DefinitionPermissions
  memoryPolicy: MemoryPolicy
  budget: DefinitionBudget
  concurrencyLimit: number
  marketAgentId: string | null
  metadata: DefinitionMetadata
  createdAt: string
  createdBy: string | null
  updatedBy: string | null
  deletedAt: string | null
  purgeAfter: string | null
}

// ---------------------------------------------------------------------------
// 运行（Run）
// ---------------------------------------------------------------------------

/** 运行摘要（列表项 / 派发响应）。 */
export interface RunSummary {
  id: string
  definitionId: string | null
  definitionName: string
  definitionVersion: number
  ownerUserId: string
  teamId: string | null
  parentRunId: string | null
  dispatchId: string | null
  sessionId: string | null
  mode: OrchestrationMode
  goal: string
  status: RunStatus
  startedAt: string | null
  endedAt: string | null
  lastHeartbeatAt: string | null
  inputTokens: number
  outputTokens: number
  costPoints: number
  errorCode: ErrorCode | null
  errorMessage: string | null
  artifactCount: number
  traceId: string
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

// ---------------------------------------------------------------------------
// 审批（Approval）
// ---------------------------------------------------------------------------

/** 审批动作（agent_management_approvals.action）。 */
export type ApprovalAction = 'delete' | 'purge' | 'rollback'

/** 审批摘要（GET /approvals 列表项 / 删除发起响应）。 */
export interface ApprovalSummary {
  id: string
  definitionId: string
  definitionName: string
  definitionVersion: number
  action: ApprovalAction
  actorUserId: string | null
  status: ApprovalStatus
  impactHash: string
  reason: string | null
  requestId: string | null
  traceId: string | null
  requestedAt: string
  decidedAt: string | null
  consumedAt: string | null
  expiresAt: string
  errorMessage: string | null
}

/** 预检阻断项（12 域之一）。 */
export interface PrecheckBlockingItem {
  domain: string
  count: number
  ids: readonly string[]
}

/** 审批影响快照（预检报告；审批卡展示）。 */
export interface ApprovalImpactSnapshot {
  definitionId: string
  blocking: readonly PrecheckBlockingItem[]
  warnings: readonly PrecheckBlockingItem[]
  precheckTokenHash?: string
  generatedAt?: string
}

// ---------------------------------------------------------------------------
// 工具结果信封（agent_registry / agent_ops / master_memory）
// ---------------------------------------------------------------------------

/** 结果元信息。requestId 与审计 requestId 一致，便于对账。 */
export interface ToolResultMeta {
  requestId?: string
  traceId?: string
  durationMs?: number
  nextActions?: readonly string[]
}

/** 结构化失败（01 §5.2 失败信封）。 */
export interface ToolResultError {
  code: ErrorCode
  message: string
  retryable: boolean
  details?: Record<string, unknown>
  suggestion?: string
}

/** 审批待办投影（破坏性动作返回，用户点击前不得写「已删除」）。 */
export interface ToolResultApproval {
  approvalId: string
  action: ApprovalAction
  status: ApprovalStatus
  impactHash: string
  expiresAt: string
}

/**
 * 27 个 action 的统一结果信封。
 * 成功：`{ ok:true, action, data, meta }`；失败：`{ ok:false, action, error, meta }`。
 * `code`/`message` 是 P3-10 要求的扁平兼容字段，与 `error` 同源。
 */
export interface ToolResult<TData = unknown> {
  ok: boolean
  action: string
  code?: ErrorCode
  message?: string
  data?: TData
  error?: ToolResultError
  meta?: ToolResultMeta
  approval?: ToolResultApproval
  auditId?: string
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
