// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 成本审批判据。
 *
 * ## ⚠️ 状态:已实现,但尚未接入任何调用方(2026-11-12 实测全仓零命中)
 *
 * 诚实说明:本模块的判据是完整的(五档 disposition,量不到就不拦住),
 * 但它为「多租户 + 余额账户 + 审批流」这套场景设计。而 CLI 单次循环里
 * 拿不到余额与审批结论,强行接进执行循环只会让它永远返回 unjudged ——
 * 那是假接线,比不接更糟(会让人以为成本被管住了)。
 *
 * 两处真实落点(将来接的时候):
 *   1. `runToolLoop` 的 maxCostUsd 判定(`apps/cli/src/commands/agent.ts:2559`)——
 *      目前是「到点硬停」;若要做「超限先申请审批再决定」,这里换成 decideCostApproval;
 *   2. API 侧计费前置(需要余额查询与审批单)。
 *
 * 在那之前,不得对外声称「我方有成本审批能力」—— 判据在,链路不在。
 */

export type CostApproval =
  | { disposition: 'proceed'; reason: 'not-mandatory' | 'approved'; effect: 'run' }
  | { disposition: 'held'; reason: 'awaiting-approval'; effect: 'none' }
  | { disposition: 'refused'; reason: 'rejected' | 'insufficient-balance'; effect: 'none' }
  | {
      disposition: 'unjudged'
      reason:
        | 'mandatory-unmeasured'
        | 'mode-unmeasured'
        | 'category-absent'
        | 'amount-unmeasured'
      effect: 'none'
    }

function measuredAmount(value: number | null): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null
  return value
}

/**
 * 强制审批只认 failureMode=requireApproval。
 * 余额或费用没量到就不放行。拒绝和等待的 effect 都是 none。
 */
export function decideCostApproval(input: {
  mandatory: boolean | null
  failureMode: string | null
  category: string | null
  balance: number | null
  cost: number | null
  decision: 'approved' | 'rejected' | null
}): CostApproval {
  if (input.mandatory === null) {
    return { disposition: 'unjudged', reason: 'mandatory-unmeasured', effect: 'none' }
  }
  if (!input.mandatory) return { disposition: 'proceed', reason: 'not-mandatory', effect: 'run' }
  if (input.failureMode !== 'requireApproval') {
    return { disposition: 'unjudged', reason: 'mode-unmeasured', effect: 'none' }
  }
  if (typeof input.category !== 'string' || input.category.trim() === '') {
    return { disposition: 'unjudged', reason: 'category-absent', effect: 'none' }
  }
  const balance = measuredAmount(input.balance)
  const cost = measuredAmount(input.cost)
  if (balance === null || cost === null) {
    return { disposition: 'unjudged', reason: 'amount-unmeasured', effect: 'none' }
  }
  if (cost > balance) return { disposition: 'refused', reason: 'insufficient-balance', effect: 'none' }
  if (input.decision === null) return { disposition: 'held', reason: 'awaiting-approval', effect: 'none' }
  if (input.decision === 'rejected') return { disposition: 'refused', reason: 'rejected', effect: 'none' }
  return { disposition: 'proceed', reason: 'approved', effect: 'run' }
}