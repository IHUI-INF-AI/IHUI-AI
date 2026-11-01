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

/**
 * 同票轮次的到期回填(2026-11-01 立,治「库里有 rt 密文却读不到 rt 自然终点」)。
 *
 * `decideSync` 的同票分支一个凭证列都不写 —— 那是对的(同票 = 没有新证据,不许推 credVersion),
 * 但客户端手里那两枚**到期时刻**是随票一起白送的真证据,不接就等于把已知信息扔掉:
 * 永久保活号的死线正是 rt 的自然终点(机主已不能靠验证码重登,rt 一死即永久丢号),
 * 而管理面当时读到的只有 NULL。现读 3 行栽在这一格(trae 机主号 / minimax auto / workbuddy)。
 *
 * 只填池内为 NULL 的键,绝不覆盖已有值:客户端那份可能是它上次登录时的旧快照,
 * 而池内的值可能来自票过期后的兜底续期 —— 覆盖方向必须是「未知 → 已知」,反向不归本函数管。
 *
 * **而且只在票面一致时回填**(`ticketIdentical`)。立因(2026-11-01 真接管实测出来):
 * 池换票成功会把 rt 轮转掉,而库里那枚 rt 终点按契约写回未知(NULL);此刻客户端 storage 里
 * 还是**轮转前那张票**的快照(到期时刻属于已死的 rt)。若不问票面就把它的日期回填进池行,
 * 管理面会读到"还剩半年",而真实终点无人知道 —— 比 NULL 更坏,因为它是假的未来。
 * 返回空对象 = 本轮无可补内容(调用方据此不写库、不推 updatedAt)。
 */
export function expiryBackfillOf(input: {
  ticketIdentical: boolean
  poolTokenExpiresAt: Date | null
  poolRefreshExpiresAt: Date | null
  clientExpiresAt: Date | null
  clientRefreshExpiresAt: Date | null
}): { tokenExpiresAt?: Date; refreshExpiresAt?: Date } {
  const out: { tokenExpiresAt?: Date; refreshExpiresAt?: Date } = {}
  if (!input.ticketIdentical) return out
  if (input.poolTokenExpiresAt === null && input.clientExpiresAt !== null) {
    out.tokenExpiresAt = input.clientExpiresAt
  }
  if (input.poolRefreshExpiresAt === null && input.clientRefreshExpiresAt !== null) {
    out.refreshExpiresAt = input.clientRefreshExpiresAt
  }
  return out
}

/**
 * 客户端会话里「rt 自然终点」的键名单源(2026-11-01 立)。
 *
 * 立因是量出来的静默丢数据,不是洁癖:提取器 `toPoolAccount` 产出的键是
 * `refreshTokenExpiresAt`,而 Trae 回灌 wrapper 转发的却是 `a.refreshExpiresAt` —— 那枚键
 * 从来不存在,于是客户端明明知道这枚 rt 还能活多久,这维信息一路走不到库,账面只读得到
 * 「refresh_expires_at = NULL」。qoder 腿用前一种拼写、minimax 腿读后一种,同一个维度三种口径,
 * 而漂移的唯一表现就是安静少数据(判据面不报错,列一直是 NULL,谁都不觉得坏了)。
 * 生产端与消费端配对由 apps/api/tests/relay-session-sync-expiry-contract.test.ts 跨边界判。
 */
export const CLIENT_REFRESH_EXPIRY_KEYS = ['refreshTokenExpiresAt', 'refreshExpiresAt'] as const

/** 按规范拼写优先读客户端给的 rt 终点;两种都没给 ⇒ null(未知,不猜)。 */
export function clientRefreshExpiryRaw(acc: Record<string, unknown>): string | null {
  for (const key of CLIENT_REFRESH_EXPIRY_KEYS) {
    const value = acc[key]
    if (typeof value === 'string' && value.trim() !== '') return value
  }
  return null
}

export function parseIso(value: string | null | undefined): Date | null {
  if (value === null || value === undefined || value === '') return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
