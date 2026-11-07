// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

export const HOST_IDENTITIES = ['User', 'RuntimeOwner', 'RuntimeAgent'] as const

export type HostIdentity = (typeof HOST_IDENTITIES)[number]

export type IdentityAttemptDecision =
  | { disposition: 'admitted'; reason: 'host-selected'; identity: HostIdentity }
  | {
      disposition: 'refused'
      reason: 'identity-mismatch' | 'identity-switch' | 'denial-stands'
      identity: null
    }
  | {
      disposition: 'unjudged'
      reason: 'identity-unmeasured' | 'attempt-unmeasured' | 'denial-unmeasured'
      identity: null
    }

function isHostIdentity(value: string | null): value is HostIdentity {
  return HOST_IDENTITIES.some((identity) => identity === value)
}

/**
 * 决定这一次身份尝试能不能沿用宿主选定的那一档。
 * 宿主身份不在三档时不默认任何身份。尝试值为空时不猜。
 * 拒绝记录读不出来时，不当成尚未拒绝。
 * 尚未拒绝且尝试值就是宿主选定的身份，才放行。
 * 同一身份被拒绝后仍然有效；拒绝后再换身份重试也不放行。
 * 尚未拒绝时，不得用别的身份顶替宿主选定的身份。
 */
export function decideIdentityAttempt(input: {
  hostIdentity: string | null
  attemptedIdentity: string | null
  deniedHostIdentity: string | null
}): IdentityAttemptDecision {
  if (!isHostIdentity(input.hostIdentity)) {
    return { disposition: 'unjudged', reason: 'identity-unmeasured', identity: null }
  }
  const host = input.hostIdentity

  if (input.attemptedIdentity === null || input.attemptedIdentity === '') {
    return { disposition: 'unjudged', reason: 'attempt-unmeasured', identity: null }
  }
  const attempted = input.attemptedIdentity

  if (input.deniedHostIdentity !== null) {
    if (!isHostIdentity(input.deniedHostIdentity) || input.deniedHostIdentity !== host) {
      return { disposition: 'unjudged', reason: 'denial-unmeasured', identity: null }
    }
    if (attempted !== input.deniedHostIdentity) {
      return { disposition: 'refused', reason: 'identity-switch', identity: null }
    }
    return { disposition: 'refused', reason: 'denial-stands', identity: null }
  }

  if (attempted !== host) {
    return { disposition: 'refused', reason: 'identity-mismatch', identity: null }
  }
  return { disposition: 'admitted', reason: 'host-selected', identity: host }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
