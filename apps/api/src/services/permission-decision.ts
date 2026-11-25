// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 统一权限决策入口(对标落地 L01/P0,2026-11-26 立)。
 *
 * 内置工具、MCP 网关、终端会话三条入口不再各写一套"能不能干":一律调 `decidePermission`,
 * 拿同一个 `PermissionDecision` 对象。判定本身仍归 `@ihui/shared/permission` 的
 * `decideApproval`(规则 → 授权记忆 → 自动复核),本层只做三件它不做的事:
 *
 *  1. **归因**:把入口(scope)、工具名、会话键钉进决策对象,审计里能读出来源;
 *  2. **形态兜底**:`assertPermissionDecision` 判不合法(allow 无凭据 / 已过期 / 未知入口)
 *     时,当场降级成 deny 并留审计 —— 绝不让一个"看起来允许"的空凭据决策漏出去;
 *  3. **落链**:每条决策经 `recordToolApprovalAuditIngest` 走 `recordAuditLog` 唯一出口。
 *
 * 失效方向:审计写失败只告警不阻断执行;但**形态不合法一定阻断**(降级 deny)。
 */

import {
  PERMISSION_DECISION_DEFAULT_TTL_MS,
  PermissionDecisionViolation,
  assertPermissionDecision,
  decideApproval,
  isPermissionAllowed,
  type ApprovalDecision,
  type ApprovalGrant,
  type ApprovalHistoryEntry,
  type ApprovalRequest,
  type ApprovalResult,
  type PermissionDecision,
  type PermissionEvidenceRef,
  type PermissionScope,
} from '@ihui/shared/permission'

import { logger } from './clawdbot/logger.js'
import { recordToolApprovalAuditIngest } from './tool-approval-audit.js'

export interface PermissionDecideInput {
  readonly scope: PermissionScope
  readonly tool: string
  readonly args?: Record<string, unknown>
  readonly sessionId: string
  readonly userId?: string | null
  readonly agentId?: string | null
  readonly workspaceId?: string | null
  /** 既有权限档矩阵的结论;引擎只采纳其 deny/ask,不采纳 allow。 */
  readonly tier?: { readonly verdict: ApprovalDecision; readonly reason: string } | null
  readonly now?: number
}

export interface PermissionDecideDeps {
  /** 已加载的授权记忆(调用方负责按 userId 取);缺省 = 无授权记忆。 */
  readonly grants?: readonly ApprovalGrant[]
  /** 会话内近因历史(自动复核用)。 */
  readonly history?: readonly ApprovalHistoryEntry[]
  /** 非授权类决策的有效期;缺省 60 秒。 */
  readonly ttlMs?: number
  /** 审计出口(测试可注入);缺省走 `recordToolApprovalAuditIngest`。 */
  readonly audit?: typeof recordToolApprovalAuditIngest
}

/** 决策被拒。调用方只需读 `decision.reason` / `decision.evidenceRef` 回话,不必自造说法。 */
export class PermissionDeniedError extends Error {
  readonly decision: PermissionDecision

  constructor(decision: PermissionDecision) {
    super(decision.reason)
    this.name = 'PermissionDeniedError'
    this.decision = decision
  }
}

function evidenceOf(
  result: ApprovalResult,
  grants: readonly ApprovalGrant[],
): PermissionEvidenceRef | null {
  if (result.decision !== 'allow') {
    return null
  }
  if (result.grant) {
    return { kind: 'grant', ref: result.grant.id, note: result.grant.reason }
  }
  if (result.autoReview) {
    return { kind: 'auto-review', ref: result.autoReview.ruleId, note: result.autoReview.reason }
  }
  if (result.matchedRule && result.matchedRule !== 'ask.fallback') {
    return { kind: 'rule', ref: result.matchedRule, note: result.reason }
  }
  // allow 却拿不出任何规则/授权/复核凭据 —— 交给 assert 判死,不在这里编一个。
  void grants
  return null
}

/**
 * 纯计算:不读库、不落审计,便于单测与"先算后判"的场景。
 * 返回的决策**可能不合法**(allow 无凭据、已过期),由 `decidePermission` 兜底降级。
 */
export function computePermissionDecision(
  input: PermissionDecideInput,
  deps: PermissionDecideDeps = {},
): PermissionDecision {
  const now = input.now ?? Date.now()
  const request: ApprovalRequest = {
    tool: input.tool,
    args: input.args ?? {},
    context: {
      workspaceId: input.workspaceId ?? null,
      agentId: input.agentId ?? null,
      userId: input.userId ?? null,
      now,
      grants: deps.grants,
      history: deps.history,
      tier: input.tier ?? undefined,
    },
  }
  const result = decideApproval(request, { history: deps.history })
  const evidenceRef = evidenceOf(result, deps.grants ?? [])
  const ttlMs = deps.ttlMs ?? PERMISSION_DECISION_DEFAULT_TTL_MS
  const grantExpiry =
    evidenceRef?.kind === 'grant'
      ? deps.grants?.find((grant) => grant.id === evidenceRef.ref)?.expiresAt
      : undefined
  return {
    scope: input.scope,
    kind: result.decision,
    tool: input.tool,
    sessionId: input.sessionId,
    expiresAt:
      typeof grantExpiry === 'number' && Number.isFinite(grantExpiry) ? grantExpiry : now + ttlMs,
    reason: result.reason,
    evidenceRef,
  }
}

async function auditDecision(
  decision: PermissionDecision,
  input: PermissionDecideInput,
  deps: PermissionDecideDeps,
): Promise<void> {
  const userId = input.userId
  if (!userId) {
    // 无主体键时无法落链(recordAuditLog 必填 userId);留痕到日志,不阻断。
    logger.warn(
      { tool: decision.tool, scope: decision.scope, kind: decision.kind },
      'permission-decision: 决策缺少 userId,审计跳过',
    )
    return
  }
  const ingest = deps.audit ?? recordToolApprovalAuditIngest
  try {
    await ingest(userId, {
      facts: [
        {
          sessionId: decision.sessionId,
          toolName: decision.tool,
          route:
            decision.kind === 'allow' ? 'approved' : decision.kind === 'deny' ? 'denied' : 'flag',
        },
      ],
    })
  } catch (error) {
    logger.warn(
      { err: error, tool: decision.tool, scope: decision.scope },
      'permission-decision: 审计写入失败',
    )
  }
}

/**
 * 形态收口:校验 → (不合法则降级 deny)→ 审计。
 * 独立成函数是为了让"无凭据的 allow"这一条能被单测直接钉住 —— 它不是只有引擎跑歪才会出现的
 * 假想分支,而是任何一处把 allow 拼错的兜底。
 */
export async function settlePermissionDecision(
  decision: PermissionDecision,
  input: PermissionDecideInput,
  deps: PermissionDecideDeps = {},
): Promise<PermissionDecision> {
  const now = input.now ?? Date.now()
  let settled = decision
  try {
    assertPermissionDecision(settled, now)
  } catch (error) {
    if (!(error instanceof PermissionDecisionViolation)) throw error
    // 形态不合法 = 没有资格放行:降级 deny,并把成因写进 reason 供审计回读。
    settled = {
      ...settled,
      kind: 'deny',
      evidenceRef: null,
      reason: `决策形态不合法(${error.code}):${error.message}`,
    }
  }
  await auditDecision(settled, input, deps)
  return settled
}

/**
 * 唯一判定出口:算 → 收口。返回的决策一定过得了 `assertPermissionDecision`。
 */
export async function decidePermission(
  input: PermissionDecideInput,
  deps: PermissionDecideDeps = {},
): Promise<PermissionDecision> {
  return settlePermissionDecision(computePermissionDecision(input, deps), input, deps)
}

/** 需要"不通过就抛"的调用方用这个;抛出的错误自带决策对象,路由层可直接回 403 说明。 */
export async function requirePermission(
  input: PermissionDecideInput,
  deps: PermissionDecideDeps = {},
): Promise<PermissionDecision> {
  const decision = await decidePermission(input, deps)
  if (!isPermissionAllowed(decision)) throw new PermissionDeniedError(decision)
  return decision
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
