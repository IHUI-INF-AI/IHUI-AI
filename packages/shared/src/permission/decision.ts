// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 统一权限决策对象(对标落地 L01/P0,2026-11-26 立)。
 *
 * 为什么要有这一层:内置工具、MCP 网关、终端会话三条入口各自长着一套"能不能干"的判断,
 * 拒绝时的说法各不相同,审计里也读不出"凭什么放行"。这里的形态把三件事钉死:
 *  - `scope` 说清是哪条入口;
 *  - `evidenceRef` 是**放行的唯一凭据**(授权记忆 id / 自动复核规则 / 规则 id),没有凭据的 allow
 *    不允许存在 —— 校验器直接拒绝,不落在"看起来通过了"的灰区;
 *  - `expiresAt` 让每次放行都带有效期,读的人不必猜它是不是一直有效。
 *
 * 判定引擎仍是 `rules.ts` 的 `decideApproval`(规则 → 授权记忆 → 自动复核),本模块只做
 * 形态收敛与校验,不复制任何判定词表。
 */

import type { ApprovalDecision } from './rules.js'

/** 三类入口。新增入口必须同时扩这里与 api 侧 `decidePermission` 的 scope 分支。 */
export const PERMISSION_SCOPES = ['builtin', 'mcp', 'terminal'] as const
export type PermissionScope = (typeof PERMISSION_SCOPES)[number]

/** 决策档:与判定引擎同一套词汇(allow / ask / deny)。 */
export type PermissionKind = ApprovalDecision

/** 凭据种类:授权记忆、自动复核、规则命中。 */
export const PERMISSION_EVIDENCE_KINDS = ['grant', 'auto-review', 'rule'] as const
export type PermissionEvidenceKind = (typeof PERMISSION_EVIDENCE_KINDS)[number]

export interface PermissionEvidenceRef {
  readonly kind: PermissionEvidenceKind
  /** 可回查的标识:grantId / 规则 id / `auto-review:<rule>@<scopeKey>`。 */
  readonly ref: string
  /** 人类可读解释,原样来自判定引擎的 reason。 */
  readonly note?: string
}

export interface PermissionDecision {
  readonly scope: PermissionScope
  readonly kind: PermissionKind
  readonly tool: string
  /** 会话归因键;与审批历史的 sessionId 同口径。 */
  readonly sessionId: string
  /** 决策有效期(epoch ms)。allow 到期即失效;deny 的到期表示"这条拒绝记录可归档"。 */
  readonly expiresAt: number
  readonly reason: string
  /** 放行凭据;`allow` 必须非空,`ask`/`deny` 允许为空。 */
  readonly evidenceRef: PermissionEvidenceRef | null
}

/** 默认有效期:一分钟内可复用同一结论,避免同一轮里同一工具反复重判。 */
export const PERMISSION_DECISION_DEFAULT_TTL_MS = 60_000

export type PermissionDecisionViolationCode =
  'bad-scope' | 'missing-session' | 'allow-without-evidence' | 'expired'

/** 决策形态不合法。调用方只能按拒绝处理,不得吞掉后继续执行。 */
export class PermissionDecisionViolation extends Error {
  readonly code: PermissionDecisionViolationCode
  readonly decision: PermissionDecision

  constructor(
    code: PermissionDecisionViolationCode,
    decision: PermissionDecision,
    message: string,
  ) {
    super(message)
    this.name = 'PermissionDecisionViolation'
    this.code = code
    this.decision = decision
  }
}

export function isPermissionAllowed(decision: PermissionDecision): boolean {
  return decision.kind === 'allow' && decision.evidenceRef !== null
}

/**
 * 形态校验。**没有凭据的 allow 一律拒绝** —— 这是本对象存在的理由,不是可放宽的断言。
 */
export function assertPermissionDecision(
  decision: PermissionDecision,
  now: number = Date.now(),
): void {
  if (!PERMISSION_SCOPES.includes(decision.scope)) {
    throw new PermissionDecisionViolation(
      'bad-scope',
      decision,
      `未知入口 scope: ${String(decision.scope)}`,
    )
  }
  if (!decision.sessionId.trim()) {
    throw new PermissionDecisionViolation('missing-session', decision, '决策缺少 sessionId')
  }
  if (decision.kind === 'allow') {
    const ref = decision.evidenceRef
    if (!ref || !ref.ref.trim() || !PERMISSION_EVIDENCE_KINDS.includes(ref.kind)) {
      throw new PermissionDecisionViolation(
        'allow-without-evidence',
        decision,
        'allow 缺少可回查的 evidenceRef',
      )
    }
  }
  if (!Number.isFinite(decision.expiresAt) || decision.expiresAt <= now) {
    throw new PermissionDecisionViolation(
      'expired',
      decision,
      `决策已过期(expiresAt=${decision.expiresAt}, now=${now})`,
    )
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
