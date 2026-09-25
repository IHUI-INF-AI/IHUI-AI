// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 步骤决策(D55 / G-66)词汇表 —— 跨端单一真相源。
 *
 * 数据来源:`apps/ai-service` 的 `_derive_step_decision()`(从结果可见路径推导)与
 * `_decision_hints`(auto 免审批等不可见路径手工写入),两处合计 15 个字面量。
 * 本模块只认**全集**,不另建第二套枚举(后端新增字面量时由用例与守门 57 一起逼齐)。
 *
 * 纪律:
 * - 未知取值一律**原样显示**,绝不编造文案,也绝不把键名喷到界面上;
 * - 状态只归并到 approved / rejected / needsUser / unknown 四类 —— "自动审查中"由
 *   plan-step 的 `status=started` 承载(那是进度不是决策),不在此伪造第五态。
 */

export const STEP_DECISIONS = [
  'plan_blocked',
  'security_blocked',
  'rejected_by_user',
  'approval_timeout',
  'tool_missing',
  'execute_tool_failed',
  'execute_tool_retried',
  'execute_tool',
  'approval_persist_hit',
  'exec_policy_approved',
  'auto_skip_approval',
  'bypass_skip_approval',
  'mcp_annotations_require_approval',
  'approval_policy_always',
  'approval_policy_never',
] as const

export type StepDecision = (typeof STEP_DECISIONS)[number]

/** 徽章归并态(配色/语义分组由各端渲染层决定,这里只给事实分类) */
export type StepDecisionState = 'approved' | 'rejected' | 'needsUser' | 'unknown'

const DECISION_SET: ReadonlySet<string> = new Set<string>(STEP_DECISIONS)

const DECISION_WORD_KEY: Record<StepDecision, string> = {
  plan_blocked: 'decision.planBlocked',
  security_blocked: 'decision.securityBlocked',
  rejected_by_user: 'decision.rejectedByUser',
  approval_timeout: 'decision.approvalTimeout',
  tool_missing: 'decision.toolMissing',
  execute_tool_failed: 'decision.executeFailed',
  execute_tool_retried: 'decision.executeRetried',
  execute_tool: 'decision.executed',
  approval_persist_hit: 'decision.approvalPersistHit',
  exec_policy_approved: 'decision.execPolicyApproved',
  auto_skip_approval: 'decision.autoSkipApproval',
  bypass_skip_approval: 'decision.bypassSkipApproval',
  mcp_annotations_require_approval: 'decision.mcpRequiresApproval',
  approval_policy_always: 'decision.policyRequiresApproval',
  approval_policy_never: 'decision.policySkipsApproval',
}

const DECISION_STATE: Record<StepDecision, StepDecisionState> = {
  plan_blocked: 'rejected',
  security_blocked: 'rejected',
  rejected_by_user: 'rejected',
  approval_timeout: 'needsUser',
  tool_missing: 'rejected',
  execute_tool_failed: 'rejected',
  execute_tool_retried: 'approved',
  execute_tool: 'approved',
  approval_persist_hit: 'approved',
  exec_policy_approved: 'approved',
  auto_skip_approval: 'approved',
  bypass_skip_approval: 'approved',
  mcp_annotations_require_approval: 'needsUser',
  approval_policy_always: 'needsUser',
  // 后端 `never` 指的是"永不弹窗"(agent_loop_v2.py 置 needs_approval=False 后照常执行),
  // 不是"永不允许"。曾按字面把它归进 rejected + 「策略禁止执行」,于是界面在工具真的
  // 跑完之后告诉用户"被拒绝了" —— 改回来之前先读那两行。
  approval_policy_never: 'approved',
}

export function isStepDecision(value: unknown): value is StepDecision {
  return typeof value === 'string' && DECISION_SET.has(value)
}

/** 决策 → 归并态;认不出(含缺失)一律 unknown,不猜 */
export function stepDecisionState(value: unknown): StepDecisionState {
  return isStepDecision(value) ? DECISION_STATE[value] : 'unknown'
}

/** 取词函数由各端注入(组件内不 useTranslations,保证跨端可复用) */
export type StepDecisionTranslate = (key: string) => string

/**
 * 决策徽章文案。三类返回值:
 * ① 已知枚举且词包命中 → 本地化文案;
 * ② 已知枚举但词包缺键 → 退回原始码(绝不喷 `decision.xxx` 这种键名);
 * ③ 未知取值 → 原样显示,态归 unknown。
 */
export function stepDecisionLabel(
  value: unknown,
  t: StepDecisionTranslate,
): { text: string; state: StepDecisionState } {
  const state = stepDecisionState(value)
  if (state === 'unknown') {
    return {
      text: typeof value === 'string' && value !== '' ? value : stateLabel('unknown', t),
      state,
    }
  }
  const key = DECISION_WORD_KEY[value as StepDecision]
  const word = t(key)
  return { text: word === key ? String(value) : word, state }
}

/** 归并态标题(四态卡的分组标签) */
export function stateLabel(state: StepDecisionState, t: StepDecisionTranslate): string {
  const key = `state.${state}`
  const word = t(key)
  return word === key ? state : word
}

/**
 * `/agent-runtime` 通道的 permission 决策矩阵取值(producer 是
 * `apps/ai-service/app/routers/agent_runtime.py::_check_permission`,与上面 15 值**不同源**)。
 * 只登记已核实字面量 —— 审批语境下把 deny 误译成"已放行"会直接误导用户的授权决定。
 */
const PERMISSION_DECISION_KEY: Readonly<Record<string, string>> = {
  allow: 'perm.allow',
  ask: 'perm.ask',
  deny: 'perm.deny',
}

/**
 * 运行时权限决策的**唯一**取词入口(4 端共用):先认 15 值步骤决策集,再认 allow/ask/deny
 * 权限矩阵,两条都不中 → 原样返回(不猜语义、不喷键名)。
 */
export function permissionDecisionWord(value: unknown, t: StepDecisionTranslate): string {
  if (isStepDecision(value)) return stepDecisionLabel(value, t).text
  if (typeof value === 'string' && value !== '') {
    const key = PERMISSION_DECISION_KEY[value]
    if (key !== undefined) {
      const word = t(key)
      return word === key ? value : word
    }
  }
  return typeof value === 'string' ? value : ''
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
