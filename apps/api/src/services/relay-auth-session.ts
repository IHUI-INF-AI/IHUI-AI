// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 号池自助授权 —— **判据层**（纯函数：零 db、零网络、零密文读写）。
 *
 * 2026-11-17 立，与 `relay-auth-session-service.ts`（IO 层）同批。拆两层的唯一理由：
 * 「一次上游响应算什么 / 会话该往哪一档迁移 / 一张票怎么组装成入池载荷」这类判断
 * 必须能脱离数据库与网络被单测钉住（AGENTS §22c：测试 import 生产实现，禁止复算判据）。
 *
 * 能力对标：qoder2api 系开源网关（以 shuishuipingan/qoder2api-hub 为代表）的
 * 「OAuth 设备授权免客户端登录入池」那一格。本格做成**会话状态机**而不是一个按钮，
 * 并在这些轴上超过对照（细节与取证依据见 service 层头注与 relay-auth-capabilities.ts）：
 * 能力表数据驱动、未实证拒发起、RFC 8628 退避闸门、把手形态标签防混读、终局即销毁把手。
 *
 * 三条会静默失效的形态，在这里各有一道闸：
 * - 把「响应读不出」读成「还在等」⇒ 拿死把手无限轮询打上游 ⇒ 判 `malformed` 并点名，不记绿。
 * - 把「上游已发票」写成「已入池」⇒ `authorized` 与 `imported` 严格分档（迁移表在这里定义）。
 * - 把票当 device_code 再打一次 token 端点 ⇒ 把手明文带 `v0/v1` 标签，混读在解析那一刻就暴露。
 */
import { createHash } from 'node:crypto'
import type { AuthSessionKind, AuthSessionStatus } from '@ihui/database'
import type { ImportAccountInput } from './relay-account-pool-service.js'
import type { AuthCapability } from './relay-auth-capabilities.js'

/** RFC 8628 §3.4 的 grant_type 全名（只认规范形态，不给「同义写法」留空间） */
export const DEVICE_GRANT_TYPE = 'urn:ietf:params:oauth:grant-type:device_code'
/** 上游没给 expires_in 时的会话寿命（与对照程序同档） */
export const DEFAULT_SESSION_TTL_MS = 15 * 60_000
/** 轮询间隔下限（秒）：低于这个值就是在打上游 */
export const MIN_POLL_INTERVAL_S = 3
/** 轮询间隔上限（秒）：再大就等不到人了，由人重新发起更诚实 */
export const MAX_POLL_INTERVAL_S = 300
/** slow_down 增量（RFC 8628 §3.5 原文 "increase the interval by 5 seconds"） */
export const SLOW_DOWN_STEP_S = 5
/** 单次上游请求最长寿命（挂住的请求不能占着路由） */
export const UPSTREAM_TIMEOUT_MS = 15_000

/** 把手明文形态标签：v0 = device_code（还没换到票）；v1 = 已换到的票（待收尾） */
export const HANDLE_TAG_DEVICE = 'v0'
export const HANDLE_TAG_TOKEN = 'v1'
/** 分隔符取 NUL：device_code / access_token / refresh_token 都不可能含 NUL，比塞 JSON 少一层转义歧义 */
const HANDLE_SEP = String.fromCharCode(0)

// =============================================================================
// 上游响应判据
// =============================================================================

export type PollOutcome =
  | {
      kind: 'authorized'
      accessToken: string
      refreshToken: string | null
      expiresIn: number | null
      raw: Record<string, unknown>
    }
  | { kind: 'waiting'; intervalSeconds: number }
  | { kind: 'slow_down'; intervalSeconds: number }
  | { kind: 'expired' }
  | { kind: 'denied'; errorCode: string; description: string | null }
  | { kind: 'malformed'; reason: string }
  | { kind: 'upstream_error'; status: number; reason: string }

/**
 * 把 token 端点的一次响应判成 PollOutcome：只看结构，不看网络层措辞。
 * 读不出 ⇒ `malformed`（点名原因），绝不因「读不懂」当成「还在等」——后者会演化成
 * 「拿一把已经作废的把手无限轮询」，本仓在保活链上记过同型账。
 */
export function judgeTokenResponse(
  status: number,
  body: unknown,
  currentIntervalSeconds: number,
): PollOutcome {
  if (status === 200) {
    if (!body || typeof body !== 'object')
      return { kind: 'malformed', reason: '200 但响应体不是对象' }
    const b = body as Record<string, unknown>
    const access = typeof b.access_token === 'string' ? b.access_token.trim() : ''
    if (!access) return { kind: 'malformed', reason: '200 但无 access_token' }
    const refresh = typeof b.refresh_token === 'string' ? b.refresh_token.trim() : ''
    const expiresIn =
      typeof b.expires_in === 'number' && Number.isFinite(b.expires_in) ? b.expires_in : null
    return {
      kind: 'authorized',
      accessToken: access,
      refreshToken: refresh || null,
      expiresIn,
      raw: b,
    }
  }
  if (status >= 500) return { kind: 'upstream_error', status, reason: `上游 5xx（HTTP ${status}）` }
  // 401/403 在 device flow 语境里意味着「授权客户端配置错」（clientId / 端点拨错），不是「还没授权」
  if (status === 401 || status === 403) {
    return {
      kind: 'upstream_error',
      status,
      reason: `上游拒该授权客户端（HTTP ${status}）：核对 clientId 与端点声明，重试无用`,
    }
  }
  if (status !== 400)
    return { kind: 'upstream_error', status, reason: `上游非预期状态（HTTP ${status}）` }

  if (!body || typeof body !== 'object')
    return { kind: 'malformed', reason: '400 但响应体不是对象' }
  const b = body as Record<string, unknown>
  const code = typeof b.error === 'string' ? b.error.trim() : ''
  const description = typeof b.error_description === 'string' ? b.error_description.trim() : null
  switch (code) {
    case 'authorization_pending':
      return { kind: 'waiting', intervalSeconds: clampInterval(currentIntervalSeconds) }
    case 'slow_down':
      // 必须在当前间隔上再加 5s，而不是按上游 interval 回落（RFC 8628 §3.5）
      return {
        kind: 'slow_down',
        intervalSeconds: clampInterval(currentIntervalSeconds + SLOW_DOWN_STEP_S),
      }
    case 'expired_token':
    case 'device_code_expired': // 个别上游的同义写法：判等过期，不混进 denied
      return { kind: 'expired' }
    case 'access_denied':
    case 'invalid_grant':
      return { kind: 'denied', errorCode: code || 'access_denied', description }
    default:
      return { kind: 'malformed', reason: `400 但 error 不可识别（${code || '空'}）` }
  }
}

/** 间隔夹逼 [MIN, MAX]；NaN / 非正一律回落 MIN（不拿脏值去 sleep） */
export function clampInterval(v: number): number {
  const n = Math.floor(Number(v))
  if (!Number.isFinite(n) || n <= 0) return MIN_POLL_INTERVAL_S
  return Math.min(MAX_POLL_INTERVAL_S, Math.max(MIN_POLL_INTERVAL_S, n))
}

// =============================================================================
// 会话状态迁移
// =============================================================================

/** 终局集合（唯一判据）：这四档之后任何写入都只能是幂等回显 */
export function isTerminalStatus(status: AuthSessionStatus): boolean {
  return (
    status === 'imported' || status === 'failed' || status === 'expired' || status === 'cancelled'
  )
}

/**
 * 状态迁移表。
 * - `authorized` 不许退回 `pending`：那等于把「票已到手」这件事撤回，会让轮询再打一次上游。
 * - 终局之间互斥：`imported` 不能被改写成 `failed`（审计行不许自我推翻）。
 */
export function canTransition(from: AuthSessionStatus, to: AuthSessionStatus): boolean {
  if (from === to) return true
  switch (from) {
    case 'pending':
      return (
        to === 'authorized' ||
        to === 'imported' ||
        to === 'failed' ||
        to === 'expired' ||
        to === 'cancelled'
      )
    case 'authorized':
      return to === 'imported' || to === 'failed' || to === 'cancelled'
    default:
      return false
  }
}

// =============================================================================
// 凭据指纹与把手编解码
// =============================================================================

/** sha256 前 16 位：只用于事后「这把票是不是那把票」的对账，不可逆 */
export function credentialFingerprint(secret: string): string {
  return createHash('sha256').update(secret, 'utf8').digest('hex').slice(0, 16)
}

export type DecodedHandle =
  | { form: 'device'; deviceCode: string }
  | { form: 'token'; accessToken: string; refreshToken: string | null }
  | { form: 'none' }
  | { form: 'invalid'; reason: string }

/** 把手明文编码（形态标签进首段） */
export function encodeHandle(
  form: { deviceCode: string } | { accessToken: string; refreshToken: string | null },
): string {
  if ('deviceCode' in form) return [HANDLE_TAG_DEVICE, form.deviceCode].join(HANDLE_SEP)
  return [HANDLE_TAG_TOKEN, form.accessToken, form.refreshToken ?? ''].join(HANDLE_SEP)
}

/** 把手明文解析；标签不认识 ⇒ invalid（宁可判不成,也不猜成另一种形态） */
export function parseHandle(plain: string): DecodedHandle {
  if (!plain) return { form: 'none' }
  const parts = plain.split(HANDLE_SEP)
  if (parts.length < 2) return { form: 'invalid', reason: '把手缺形态标签' }
  const tag = parts[0]
  const first = parts[1] ?? ''
  const second = parts[2] ?? ''
  if (tag === HANDLE_TAG_DEVICE) {
    return first
      ? { form: 'device', deviceCode: first }
      : { form: 'invalid', reason: 'device_code 为空' }
  }
  if (tag === HANDLE_TAG_TOKEN) {
    return first
      ? { form: 'token', accessToken: first, refreshToken: second ? second : null }
      : { form: 'invalid', reason: 'access_token 为空' }
  }
  return { form: 'invalid', reason: `未知把手标签（${tag || '空'}）` }
}

// =============================================================================
// 票 → 入池载荷
// =============================================================================

/**
 * PAT 形态：票即凭证。命名与 uid 都走指纹，事后查得到「哪张贴过池」，又不把票泄进可读面。
 * `enabled:false` 是刻意档位：通路未经运营确认前不进转发选路（对照入池即上量的做法）。
 */
export function mapPatToImport(cap: AuthCapability, pat: string): ImportAccountInput {
  const fp = credentialFingerprint(pat)
  return {
    name: `${cap.providerCode}-pat-${fp.slice(0, 8)}`,
    uid: fp,
    token: pat,
    enabled: false,
    authMode: 'pat',
    issuedVia: 'auth-session',
  }
}

/**
 * OAuth token pair → 入池载荷。
 * uid 优先取上游自证的稳定身份键；一个都没有时用票指纹当占位，并把来源写进载荷
 * （`authUidSource`）——绝不用 access_token 前缀当名（对照程序的做法：票一轮换就对不上号）。
 */
export function mapTokenPairToImport(
  cap: AuthCapability,
  accessToken: string,
  refreshToken: string | null,
  raw: Record<string, unknown>,
): ImportAccountInput {
  const declared = ['id', 'user_id', 'uid', 'sub']
    .map((k) => raw[k])
    .find((v) => typeof v === 'string' && (v as string).trim())
  const fp = credentialFingerprint(accessToken)
  const uid = typeof declared === 'string' ? declared.trim() : fp
  const nameHint = ['username', 'name', 'login']
    .map((k) => raw[k])
    .find((v) => typeof v === 'string' && (v as string).trim())
  const name =
    typeof nameHint === 'string'
      ? `${cap.providerCode}-${nameHint.trim()}`
      : `${cap.providerCode}-oauth-${uid.slice(-8)}`
  return {
    name,
    uid,
    token: accessToken,
    ...(refreshToken ? { refreshToken } : {}),
    enabled: false,
    authMode: 'device_flow',
    authUidSource: declared ? 'upstream' : 'fingerprint',
    authScope: cap.scope ?? null,
    issuedVia: 'auth-session',
  }
}

/**
 * 映射器接线判据（唯一一处）：未接线的 mapper 一律不许产出「看起来成功」的形态。
 * 已接线 = 上面两个 map*ToImport 真能把票组装成 ImportAccountInput 的那些。
 */
export function mapperIsWired(mapper: AuthCapability['mapper']): boolean {
  return mapper === 'oauth_token_pair' || mapper === 'qoder_pat' || mapper === 'bearer_key'
}

/**
 * 前端二维码载荷（RFC 8628 §3.3）：上游给了 verification_uri_complete 就用它，
 * 否则由 uri + user_code 拼；两者都缺 ⇒ null（不许画一枚空码给人扫）。
 */
export function buildQrPayload(
  uri: string | null,
  complete: string | null,
  userCode: string | null,
): string | null {
  if (complete) return complete
  if (!uri || !userCode) return null
  return `${uri}${uri.includes('?') ? '&' : '?'}user_code=${encodeURIComponent(userCode)}`
}

/** 授权形态档位（IO 层与路由共用这一份，别处不得自造字符串） */
export const SESSION_KINDS_FOR_UI = [
  'device_flow',
  'pat',
  'redirect_pkce',
  'cookie_exchange',
] as const
export type SessionKindForUi = (typeof SESSION_KINDS_FOR_UI)[number]
export type { AuthSessionKind }

export const __test__ = {
  judgeTokenResponse,
  clampInterval,
  canTransition,
  isTerminalStatus,
  credentialFingerprint,
  encodeHandle,
  parseHandle,
  mapTokenPairToImport,
  mapPatToImport,
  mapperIsWired,
  buildQrPayload,
  DEVICE_GRANT_TYPE,
  MIN_POLL_INTERVAL_S,
  MAX_POLL_INTERVAL_S,
  SLOW_DOWN_STEP_S,
  DEFAULT_SESSION_TTL_MS,
  HANDLE_TAG_DEVICE,
  HANDLE_TAG_TOKEN,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
