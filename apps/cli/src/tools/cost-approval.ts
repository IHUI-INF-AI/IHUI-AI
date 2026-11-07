// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
