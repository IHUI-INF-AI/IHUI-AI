// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 会话回灌判据(2026-10-28 从 relay-trae-session-sync.ts 提取,单一真相源)。
 *
 * 客户端票 → 池 的写入由一个纯函数判定,trae / qoder 两条回灌腿共用同一份判据
 * (§0.6:判据只许一份,第二份必然漂移)。平台差异只在取数层,不在这里。
 *
 * - 同票 ⇒ 不写;
 * - 客户端到期时刻早于池内 ⇒ 不写(池内可能来自"票已过期后的兜底续期",旧票不许回写);
 * - 客户端到期时刻更新 / 时刻相同但 token 不同 ⇒ 写;
 * - 客户端没给 refreshToken(web 号)⇒ 保留池内该列不动(refreshToken: null)。
 */

export interface DecideInput {
  poolToken: string | null
  poolTokenExpiresAt: Date | null
  poolRefreshExpiresAt: Date | null
  clientToken: string
  clientRefreshToken: string | null
  clientExpiresAt: Date | null
  clientRefreshExpiresAt: Date | null
}

export type SyncReason = 'same-token' | 'pool-newer' | 'client-newer' | 'client-rotated' | 'apply'

export interface SyncDecision {
  apply: boolean
  reason: SyncReason
  next: {
    token: string
    /** null = 客户端没给 refreshToken,池内该列保持不动 */
    refreshToken: string | null
    tokenExpiresAt: Date | null
    refreshExpiresAt: Date | null
  }
}

/** 单一判据源:决定客户端票是否应写进池(详见文件头)。 */
export function decideSync(input: DecideInput): SyncDecision {
  const clientMs = input.clientExpiresAt?.getTime() ?? null
  const poolMs = input.poolTokenExpiresAt?.getTime() ?? null
  const next = {
    token: input.clientToken,
    refreshToken: input.clientRefreshToken,
    tokenExpiresAt: input.clientExpiresAt ?? input.poolTokenExpiresAt,
    refreshExpiresAt: input.clientRefreshExpiresAt ?? input.poolRefreshExpiresAt,
  }
  if (input.clientToken === input.poolToken) {
    return { apply: false, reason: 'same-token', next }
  }
  if (clientMs !== null && poolMs !== null && clientMs < poolMs) {
    return {
      apply: false,
      reason: 'pool-newer',
      next: {
        ...next,
        token: input.poolToken ?? input.clientToken,
        tokenExpiresAt: input.poolTokenExpiresAt,
        refreshExpiresAt: input.poolRefreshExpiresAt,
      },
    }
  }
  const reason: SyncReason =
    clientMs !== null && poolMs !== null && clientMs > poolMs
      ? 'client-newer'
      : clientMs !== null && poolMs !== null
        ? 'client-rotated'
        : 'apply'
  return { apply: true, reason, next }
}

export function parseIso(value: string | null | undefined): Date | null {
  if (value === null || value === undefined || value === '') return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
