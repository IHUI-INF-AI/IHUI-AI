// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * computer-use 的应用白名单(2026-11-04 立)
 *
 * 语义:
 *  - **非白名单应用必须 ask**,不存在"默认全放";
 *  - 白名单的唯一来源是**授权记忆**(`ApprovalGrant.tool = 'computer_use'`,
 *    `matchPattern = 应用名`),且必须通过 scope + expiresAt 校验;
 *  - 凭据/密码类应用恒 deny,即便有授权记忆也不放行(deny 优先于允许)。
 *
 * 应用名缺失时无法确认目标 ⇒ ask(最严)。
 */

import {
  APPROVAL_RULES,
  computeFacts,
  decideApproval,
  type ApprovalRequest,
  type ApprovalResult,
  type ApprovalRule,
  type EvaluateOptions,
} from './rules'

/** computer-use 专用规则集:只依赖 app 事实,不掺入通用工具族规则。 */
export const COMPUTER_USE_RULES: readonly ApprovalRule[] = [
  {
    id: 'deny.app-blocked',
    reason: '目标应用属于凭据/密码类应用,禁止自动操作',
    match: { appBlocked: true },
    decision: 'deny',
    priority: 85,
  },
  {
    id: 'ask.app-name-missing',
    reason: '无法确认 computer-use 目标应用,转人工',
    match: { appNamePresent: false },
    decision: 'ask',
    priority: 75,
  },
  {
    id: 'ask.app-not-whitelisted',
    reason: '目标应用不在应用白名单(需首次授权并记入授权记忆)',
    match: { appNamePresent: true, appWhitelisted: false },
    decision: 'ask',
    priority: 70,
  },
  {
    id: 'allow.app-granted',
    reason: '目标应用已在授权记忆内(scope/expiresAt 校验通过)',
    match: { appWhitelisted: true },
    decision: 'allow',
    priority: 40,
  },
]

for (const rule of COMPUTER_USE_RULES) {
  if (APPROVAL_RULES.some((r) => r.id === rule.id)) {
    throw new Error(`computer-use 规则 id 与通用规则集重复: ${rule.id}`)
  }
}

export interface ComputerUseRequest extends ApprovalRequest {
  /** 目标应用名(如 `Notepad`、`chrome`),缺失即 ask */
  args: Record<string, unknown> & { appName?: string }
}

/**
 * 判定一次 computer-use 动作。
 * @example evaluateComputerUse({tool:'computer_use.mouse_click', args:{appName:'Notepad'}, context})
 */
export function evaluateComputerUse(
  request: ComputerUseRequest,
  options: EvaluateOptions = {},
): ApprovalResult {
  const facts = computeFacts(request, options.commandRiskAnalyzer)
  return decideApproval(request, { rules: options.rules ?? COMPUTER_USE_RULES, facts })
}

/** 应用是否已被授权记忆覆盖(供 UI 显示"已授权"标识,只读判定)。 */
export function isComputerAppWhitelisted(request: ComputerUseRequest): boolean {
  return computeFacts(request).appWhitelisted
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
