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

/**
 * 「必须人工处理」的机读原因(2026-11-03 立)。
 *
 * 与六态 verdict 的分工:verdict 回答「凭据寿命还剩多少」,reauth 回答
 * 「这一轮为什么没签上、要不要人去重录」。两者共享同一份输入,不另造一套账号体检。
 *
 * 五类中前四类是验收硬要求,`credential_expired` 是保活面补充:
 * - invalid_cookie_decrypt: publish_cookie 密文 InvalidTag,连探活都解不开。
 * - credential_expired: 其余 expired(含 checkin JWT 解密失败/真实到期),只能重录。
 * - expired_no_refresh: token 已过期且该平台没有可用 refresh 协议(如 minimax)。
 * - claim_failed: 凭证仍可用但 claim 被明确拒绝(SessionDead/Client/BusinessError)。
 * - account_down: 健康检查 down / tempUnschedulable,已被调度器摘除。
 *
 * 互斥折叠(2026-11-03 定稿):同一账号命中多条只取一个 `reason` 计数;
 * `reasons` 保留全部命中作证据,主原因排第一。已 down/temp 的账号固定归
 * `account_down` —— 这一轮没签上的直接原因是它根本没被调度,不能笼统算成
 * `claim_failed`;更具体的 expired/claim 证据仍在 `reasons` 里。
 */
export type RelayAccountReauthReason =
  | 'invalid_cookie_decrypt'
  | 'credential_expired'
  | 'expired_no_refresh'
  | 'claim_failed'
  | 'account_down'

export const RELAY_ACCOUNT_REAUTH_ACTION: Record<RelayAccountReauthReason, string> = {
  invalid_cookie_decrypt: '凭据密文无法解密(密钥轮换或密文损坏),需重新扫码录入该账号',
  credential_expired: '凭据已过期且无法自动续期,需重新登录或扫码录入',
  expired_no_refresh: 'token 已过期且该平台无 refresh 协议,需重新登录导入',
  claim_failed: '凭证仍在但 claim 被明确拒绝,需人工登录核验账号状态',
  account_down: '账号已 down / 临时摘除,需人工核验凭据后重新启用',
}

/** 签到侧最近一条记录(只读投影,不含任何凭据)。 */
export interface RelayAccountCheckinSignal {
  ok: boolean | null
  action?: string | null
  code?: string | number | null
  message?: string | null
  classifiedErrorType?: string | null
}

export interface RelayAccountReauthInput {
  providerCode: string
  tokenExpiryMs: number | null
  hasRefreshToken?: boolean
  /** 该 provider 的适配器是否有 refresh 协议;调用方用 isRefreshableProviderCode 判定 */
  refreshSupported?: boolean
  healthStatus?: string | null
  tempUnschedulable?: boolean | null
  lastErrorMessage?: string | null
  lastCheckin?: RelayAccountCheckinSignal | null
  /** 保活面来源:publish_cookie / publish_token / checkin */
  source?: string | null
  lastErrorKind?: string | null
  lastError?: string | null
}

export interface RelayAccountReauthResult {
  needsReauth: boolean
  reason: RelayAccountReauthReason | null
  /** 全部命中,主原因在第一位;用于审计,不参与计数 */
  reasons: RelayAccountReauthReason[]
  detail: string | null
  nextAction: string | null
}

// 可重试分类:网络/限流/服务端/风控/无活动 —— 重试或等下一轮会好,不该喊人重录。
const REAUTH_RETRYABLE_ERRORS = new Set([
  'Unknown',
  'SoftRate',
  'Server',
  'NotFound',
  'Challenge',
  'PlanLimit',
])
// 幂等已签被误记成失败的历史包袱(trae 9095):必须当成功,不能标 needs_reauth。
const REAUTH_ALREADY_MARKERS = [
  '今日已签到',
  '今天已签到',
  '已经签到',
  '已签到',
  'already',
  '请明日再来',
  '明日再来',
]
// 无活动不是凭证失败(qoder 活动未下发),等下一轮即可。
const REAUTH_NON_CREDENTIAL_MARKERS = [
  '活动未下发',
  '等下一轮',
  '活动已结束',
  '已结束',
  'no campaign',
]
const REAUTH_AUTH_ERROR_TYPES = new Set(['SessionDead', 'Client', 'BusinessError'])
const REAUTH_AUTH_MARKERS = [
  '未登录',
  '登录失效',
  '登录过期',
  'authenticate',
  'unauthorized',
  '401',
  'token 无效',
  'token无效',
  '凭证失效',
  '凭证无效',
]
const REAUTH_DECRYPT_MARKERS = ['invalidtag', '凭证无法解密', '解密失败', 'decrypt']

function reauthText(value: unknown): string {
  return value === null || value === undefined ? '' : String(value)
}

function reauthHas(text: string, markers: readonly string[]): boolean {
  const low = text.toLowerCase()
  return markers.some((m) => low.includes(m.toLowerCase()))
}

function reauthCode(value: string | number | null | undefined): string {
  return value === null || value === undefined ? '' : String(value).trim()
}

export function resolveRelayAccountReauth(
  input: RelayAccountReauthInput,
  now: number = Date.now(),
): RelayAccountReauthResult {
  const matched: RelayAccountReauthReason[] = []
  const errorText = reauthText(input.lastError)

  // 1/2: 保活面 expired 只能重录;publish_cookie 的解密失败单独成因。
  if (input.lastErrorKind === 'expired') {
    if (input.source === 'publish_cookie' && reauthHas(errorText, REAUTH_DECRYPT_MARKERS)) {
      matched.push('invalid_cookie_decrypt')
    } else {
      matched.push('credential_expired')
    }
  }

  // 3: token 已过期且没有可用的续期通道。
  const expiry =
    input.tokenExpiryMs !== null && Number.isFinite(input.tokenExpiryMs)
      ? input.tokenExpiryMs
      : null
  if (
    expiry !== null &&
    expiry < now &&
    (input.hasRefreshToken !== true || input.refreshSupported === false)
  ) {
    matched.push('expired_no_refresh')
  }

  // 4: claim 被明确拒绝。只认凭证类证据,网络/限流/无活动/已签一律排除。
  const c = input.lastCheckin
  if (c && c.ok === false && reauthText(c.action) === 'claim') {
    const code = reauthCode(c.code)
    const message = reauthText(c.message)
    const type = reauthText(c.classifiedErrorType)
    const already =
      code === '9095' || code === '10001' || reauthHas(message, REAUTH_ALREADY_MARKERS)
    const retryable = REAUTH_RETRYABLE_ERRORS.has(type)
    const nonCredential = reauthHas(message, REAUTH_NON_CREDENTIAL_MARKERS)
    const authEvidence =
      REAUTH_AUTH_ERROR_TYPES.has(type) || reauthHas(message, REAUTH_AUTH_MARKERS)
    if (!already && !retryable && !nonCredential && authEvidence) matched.push('claim_failed')
  }

  // 5: 调度层已摘除。
  const down = input.healthStatus === 'down' || input.tempUnschedulable === true
  if (down) matched.push('account_down')

  if (matched.length === 0) {
    return { needsReauth: false, reason: null, reasons: [], detail: null, nextAction: null }
  }

  // 互斥折叠:down/temp 且没有更高优先的保活类原因时,主原因固定 account_down。
  const overrideDown =
    down &&
    matched.includes('account_down') &&
    !matched.includes('invalid_cookie_decrypt') &&
    !matched.includes('credential_expired')
  const reasons: RelayAccountReauthReason[] = overrideDown
    ? ['account_down', ...matched.filter((r) => r !== 'account_down')]
    : matched
  // matched 已非空(上方早退),overrideDown 分支又显式保留了 account_down ⇒ 首元素恒存在
  const reason = reasons[0] as RelayAccountReauthReason

  let detail: string | null = null
  if (reason === 'invalid_cookie_decrypt' || reason === 'credential_expired') {
    detail = errorText.slice(0, 200) || null
  } else if (reason === 'expired_no_refresh') {
    detail =
      expiry !== null
        ? `token 已于 ${new Date(expiry).toISOString()} 到期,且该平台无可用 refresh 协议`
        : null
  } else if (reason === 'claim_failed') {
    detail = reauthText(c?.message).slice(0, 200) || 'claim 返回明确拒绝'
  } else if (reason === 'account_down') {
    detail =
      reauthText(input.lastErrorMessage).slice(0, 200) ||
      (input.tempUnschedulable === true
        ? '账号已临时摘除(tempUnschedulable)'
        : '健康检查已标记 down')
  }

  return {
    needsReauth: true,
    reason,
    reasons,
    detail,
    nextAction: RELAY_ACCOUNT_REAUTH_ACTION[reason],
  }
}

/**
 * 按 provider / reason 聚合(只统计 needsReauth=true,每账号按主原因计一次)。
 * 返回三面:provider 计数、reason 计数、provider×reason 交叉表 —— 直接喂状态接口。
 */
export function summarizeRelayAccountReauth(
  items: ReadonlyArray<{
    providerCode: string
    needsReauth: boolean
    reason: RelayAccountReauthReason | null
  }>,
): {
  total: number
  byProvider: Record<string, number>
  byReason: Record<string, number>
  byProviderReason: Record<string, Record<string, number>>
} {
  const byProvider: Record<string, number> = {}
  const byReason: Record<string, number> = {}
  const byProviderReason: Record<string, Record<string, number>> = {}
  let total = 0
  for (const item of items) {
    if (!item.needsReauth || item.reason === null) continue
    total += 1
    byProvider[item.providerCode] = (byProvider[item.providerCode] ?? 0) + 1
    byReason[item.reason] = (byReason[item.reason] ?? 0) + 1
    const bucket = (byProviderReason[item.providerCode] ??= {})
    bucket[item.reason] = (bucket[item.reason] ?? 0) + 1
  }
  return { total, byProvider, byReason, byProviderReason }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
