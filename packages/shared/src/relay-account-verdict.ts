// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 号池账号「体检结论」判据单源(2026-10-26 立)。
 *
 * 立因:CLI(`apps/api/scripts/relay-account-inspect.ts`)先落了一份六态结论,管理页要
 * 展示同一件事 —— 若两边各写一份枚举与"下一步"文案,迟早漂移(§0.6)。本文件是那六态
 * 与其下一步话术的**唯一实现**:
 *   - CLI(读导出 JSON / 本机登录文件):把 token 解成到期毫秒后喂进来;
 *   - admin list/detail 接口:把库里 `tokenExpiresAt/refreshExpiresAt` + 非密钥布尔
 *     `hasRefreshToken` 喂进来;
 *   - 前端只渲染接口回传的机器枚举,**不在 UI 复写判据**。
 *
 * 纯 Date 数学、零 node: 内建/零 IO ⇒ 可安全进 shared 被任意宿主 import。
 * 与调度器 `keepaliveIdleWhere` 的关系:那条是**SQL 面**的选取谓词(greatest/coalesce),
 * 这里是**JS 展示面**的同语义折算 —— 同一件事的两个面,不是第二份判据(取数逻辑不同,
 * 共用只会让 SQL 里塞 JS 或反之)。
 */

/** ≤该天数即将到期 ⇒ expiring-soon(与调度临期档 15min 不同:这里给人看"还剩多久",不是给机器挑刷票时机) */
export const RELAY_ACCOUNT_EXPIRING_SOON_DAYS = 1

export type RelayAccountVerdictKind =
  | 'usable'
  | 'expiring-soon'
  | 'expired-renewable'
  | 'expired-dead'
  | 'envelope-only'
  | 'indeterminate'

/** 结论枚举 → 一行下一步(永不回显凭据;取不到 ≠ 过期的纪律同 AGENTS §0.3) */
export const RELAY_ACCOUNT_VERDICT_ACTION: Record<RelayAccountVerdictKind, string> = {
  usable: '无需处理；号池临期档/空闲保活会自动续票',
  'expiring-soon': '1 天内到期：确认号池在线（调度会自动刷）或本机开一次客户端续票',
  'expired-renewable':
    '已过期，但带 refreshToken：导入/留在号池即由调度器救回，本机需重启客户端换票',
  'expired-dead': '已过期且无 refreshToken：只能重新登录/重新导出，别指望它自愈',
  'envelope-only':
    '加密信封（$wbEncrypted）：仅同机 WorkBuddy 能解回明文，号池无法代刷、查积分/跨机均不可用，需在有客户端的机器上重导一份明文',
  indeterminate:
    '读不到到期时刻（非 JWT 且无显式 expiresAt）：不代表过期，能不能用以上游健康检查为准',
}

export const RELAY_ACCOUNT_VERDICT_KINDS = Object.keys(
  RELAY_ACCOUNT_VERDICT_ACTION,
) as RelayAccountVerdictKind[]

export interface RelayAccountVerdictInput {
  /** access token 到期时刻（ms epoch）；无则 null */
  tokenExpiryMs: number | null
  /** refresh 侧到期（ms epoch）；库里可空 */
  refreshExpiryMs?: number | null
  /** 凭据值本身是 $wbEncrypted 信封（只有导出/本机文件面判得出） */
  envelope?: boolean
  /** 是否存在 access 侧凭据（库面恒 true：导入即要求 token；导出面由调用方判空串） */
  hasCredential?: boolean
  /** 是否存在可自救续票通道（refreshToken 或 cookie 通道） */
  hasRefreshCredential?: boolean
}

/** 剩余天数（null=未知；负值=已过期天数；一位小数） */
export function relayAccountRemainingDays(
  expiryMs: number | null | undefined,
  now: number,
): number | null {
  if (expiryMs === null || expiryMs === undefined || !Number.isFinite(expiryMs)) return null
  return Math.round(((expiryMs - now) / 86_400_000) * 10) / 10
}

/**
 * 核心结论纯函数：调用方负责把各自面的输入折算成 ms 后传入（CLI 解 JWT exp/显式 ISO；
 * 服务端读列）；本函数**不猜**——拿不到到期只给 indeterminate，绝不冒判 usable/expired。
 */
export function resolveRelayAccountVerdict(
  input: RelayAccountVerdictInput,
  now: number = Date.now(),
): { verdict: RelayAccountVerdictKind; nextAction: string; tokenRemainingDays: number | null } {
  if (input.envelope) {
    return {
      verdict: 'envelope-only',
      nextAction: RELAY_ACCOUNT_VERDICT_ACTION['envelope-only'],
      tokenRemainingDays: null,
    }
  }
  if (input.hasCredential === false) {
    return {
      verdict: 'indeterminate',
      nextAction: RELAY_ACCOUNT_VERDICT_ACTION.indeterminate,
      tokenRemainingDays: null,
    }
  }
  const days = relayAccountRemainingDays(input.tokenExpiryMs, now)
  const canRenew = input.hasRefreshCredential === true
  let verdict: RelayAccountVerdictKind
  if (days === null) verdict = 'indeterminate'
  else if (days < 0) verdict = canRenew ? 'expired-renewable' : 'expired-dead'
  else if (days <= RELAY_ACCOUNT_EXPIRING_SOON_DAYS) verdict = 'expiring-soon'
  else verdict = 'usable'
  return { verdict, nextAction: RELAY_ACCOUNT_VERDICT_ACTION[verdict], tokenRemainingDays: days }
}

/**
 * 闲置时钟（JS 展示面，等价调度 `accountIdleClock` 的语义）：上次使用/上次刷新取较新，
 * 都没发生则回落 createdAt。返回 null 表示三面都缺（不可判定龄，UI 显示 "-"）。
 */
export function relayAccountIdleDays(
  input: {
    lastUsedAt?: number | string | Date | null
    lastRefreshAt?: number | string | Date | null
    createdAt?: number | string | Date | null
  },
  now: number = Date.now(),
): number | null {
  const ms = (v: number | string | Date | null | undefined): number | null => {
    if (v === null || v === undefined || v === '') return null
    const t = v instanceof Date ? v.getTime() : typeof v === 'string' ? Date.parse(v) : v
    return Number.isFinite(t) ? (t as number) : null
  }
  const clock = Math.max(
    ms(input.lastUsedAt) ?? -Infinity,
    ms(input.lastRefreshAt) ?? -Infinity,
    ms(input.createdAt) ?? -Infinity,
  )
  if (!Number.isFinite(clock) || clock === -Infinity) return null
  return Math.max(0, Math.round(((now - clock) / 86_400_000) * 10) / 10)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
