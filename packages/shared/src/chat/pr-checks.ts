// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// D105 PR 检查状态与动作卡 · 共享层纯函数(G-146,2026-09-23 立)
//
// 对标 Codex `localConversation.pullRequest.actions.*` 的一手形状,收敛为**跨端唯一**的
// 「CI 检查状态」判定层:
//   · 六态 —— failed / passed / pending / skipped / neutral / unknown
//     (含 neutral 与 unknown 两个极易漏掉的态,它们是"看着没事其实没结论"的典型)
//   · 聚合三态 + 空态 —— failing / pending / successful / none
//
// **数据面纪律**:本模块**不取数**。它只定义"给定一组检查,状态该怎么判、该取哪个文案键"。
// PR 数据面复用既有 `review_pr_github` 工具与 `ide-workspace` 的 pullRequest 结构,
// 禁止为渲染卡另建第二套 PR 数据通道(台账 D105 明文)。
//
// 聚合语义(逐条可测,不做"看起来对"的推断):
//   none        —— 没有检查(含 undefined / 空数组)
//   failing     —— 存在 failed(最高优先:失败必须压过其他态)
//   pending     —— 无 failed,但存在 pending **或 unknown**
//                  (`unknown` 归 pending 而非 successful:状态未知时**不得宣称成功**)
//   successful  —— 其余(passed / skipped / neutral;skipped 与 neutral 都不阻塞成功)

/** CI 检查六态(取值即 i18n 键片段,便于各端取词) */
export const CI_CHECK_STATES = ['failed', 'passed', 'pending', 'skipped', 'neutral', 'unknown'] as const
export type CiCheckState = (typeof CI_CHECK_STATES)[number]

/** 聚合态(含空态 none) */
export const CI_CHECKS_SUMMARIES = ['failing', 'pending', 'successful', 'none'] as const
export type CiChecksSummary = (typeof CI_CHECKS_SUMMARIES)[number]

/** 单条检查(字段对齐 GitHub/Gitee 通用形状;url 可选,用于跳转) */
export interface CiCheck {
  readonly name: string
  readonly state: CiCheckState
  readonly url?: string
}

const STATE_SET: ReadonlySet<string> = new Set<string>(CI_CHECK_STATES)

/** 是否为合法六态之一 */
export function isCiCheckState(value: string): value is CiCheckState {
  return STATE_SET.has(value)
}

/**
 * 把后端/平台的原始状态串归一化到六态。
 * 认不出 → `'unknown'`(**不编造、不抛错**;这正是 `unknown` 态存在的意义)。
 */
export function normalizeCiCheckState(raw: string | null | undefined): CiCheckState {
  if (!raw) return 'unknown'
  const key = raw.trim().toLowerCase()
  if (key === 'success' || key === 'succeeded' || key === 'passed') return 'passed'
  if (key === 'failure' || key === 'errored' || key === 'error') return 'failed'
  if (key === 'queued' || key === 'in_progress' || key === 'running' || key === 'pending') return 'pending'
  if (key === 'cancelled' || key === 'canceled' || key === 'skipped') return 'skipped'
  if (key === 'neutral' || key === 'stale') return 'neutral'
  return isCiCheckState(key) ? key : 'unknown'
}

/** 按六态计数(缺失态记 0,便于断言与埋点) */
export function countChecksByState(
  checks: readonly CiCheck[] | null | undefined,
): Record<CiCheckState, number> {
  const counts = { failed: 0, passed: 0, pending: 0, skipped: 0, neutral: 0, unknown: 0 } as Record<
    CiCheckState,
    number
  >
  for (const check of checks ?? []) counts[check.state] += 1
  return counts
}

/** 聚合判定(语义见文件头;纯函数,可单测) */
export function deriveChecksSummary(
  checks: readonly CiCheck[] | null | undefined,
): CiChecksSummary {
  if (!checks || checks.length === 0) return 'none'
  const counts = countChecksByState(checks)
  if (counts.failed > 0) return 'failing'
  if (counts.pending > 0 || counts.unknown > 0) return 'pending'
  return 'successful'
}

/** 六态 → i18n 键名(`ai.pane.prChecks.state.<key>`,供各端命名空间拼接) */
export function ciCheckStateKey(state: CiCheckState): string {
  return `state.${state}`
}

/** 聚合态 → i18n 键名(`ai.pane.prChecks.summary.<key>`) */
export function checksSummaryKey(summary: CiChecksSummary): string {
  return `summary.${summary}`
}

/** 动作族(与 D15 / G-135 交叉引用;**不在此实现数据面**,只给稳定的动作 id 供各端接线) */
export const PR_CHECK_ACTIONS = ['checksFix', 'checksRemove', 'commentsAddress', 'commentsRemove'] as const
export type PrCheckAction = (typeof PR_CHECK_ACTIONS)[number]

/** 动作 id → i18n 键名 */
export function prCheckActionKey(action: PrCheckAction): string {
  return `action.${action}`
}

/**
 * 是否应展示"把失败检查交给 Agent 修复"入口。
 * 只在**确有失败**时给 —— 无失败时提供"修复"是对用户撒谎(Trae/Codex 同口径)。
 */
export function shouldOfferFix(summary: CiChecksSummary): boolean {
  return summary === 'failing'
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
