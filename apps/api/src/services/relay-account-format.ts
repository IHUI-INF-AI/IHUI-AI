// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 账号池导入格式的纯解析与校验(零 IO / 零 DB)。
 *
 * 单一真相源:服务端导入(relay-account-pool-service)与 CLI 预检
 * (apps/api/scripts/relay-account-import-validate.ts)共用本文件的 JWT/Cookie 解析,
 * 不允许各自再抄一份 WebKit epoch 换算或 uid 提取。
 *
 * 边界:
 * - JWT **只解码不验签**,导入预检不是鉴权判定;
 * - 校验器只做本地结构/时效检查,不探测上游(账号是否可用交给健康检查);
 * - 报告绝不回显 token 明文,只给 uid / 到期时刻 / 指纹。
 */
import { createHash } from 'node:crypto'

/** 支持反代的第三方 AI IDE 平台 */
export const RELAY_PROVIDERS = ['trae', 'workbuddy', 'codearts', 'qoder'] as const
export type RelayProviderCode = (typeof RELAY_PROVIDERS)[number]

export function isRelayProviderCode(v: string): v is RelayProviderCode {
  return (RELAY_PROVIDERS as readonly string[]).includes(v)
}

/** 导入接口单批上限(与 admin 路由 Zod 的 .max(500) 同值;改这里必须同改路由) */
const IMPORT_MAX_ACCOUNTS = 500
/** 临期阈值:导入预检把 24h 内到期单独点名 */
const IMPORT_EXPIRING_SOON_MS = 24 * 60 * 60 * 1000
/** WebKit epoch(1601-01-01)与 Unix epoch(1970-01-01)的毫秒差 */
const WEBKIT_EPOCH_OFFSET_MS = 11_644_473_600_000

// =============================================================================
// JWT / Cookie 纯解析
// =============================================================================

/**
 * 时刻量纲判据(2026-10-26 立):秒/毫秒混传的过期时刻按「量纲」归一为毫秒。
 *
 * 立因:`parseFlexibleExpiry` 对裸数字一律 ×1000 当 epoch **秒**。第三方账号工具
 * (workbuddy-switch 等)导出的 `expires_at` 是 epoch **毫秒**(Keycloak 惯例,如
 * 1795356026000)→ 放大成 5138 年的"永不过期"时刻随 CAS 版本推给签到副本,所有
 * 临期/摘除/保活判据对它集体失明。
 *
 * 阈值取 1e11:秒制要越过该线得等到公元 5138 年 — 真实世界无此数据;而 ms 制在
 * 1973 年后就恒大于 1e11。故 ≥1e11 判毫秒、否则判秒,两侧现网输入均不受影响。
 * 返回 null = 不是合法时刻(调用方继续回落 JWT exp / ISO 解析)。
 */
export function expireEpochToMs(v: unknown): number | null {
  const n =
    typeof v === 'number'
      ? v
      : typeof v === 'string' && /^\d+$/.test(v.trim())
        ? Number(v.trim())
        : NaN
  if (!Number.isFinite(n) || n <= 0) return null
  return n >= 1e11 ? n : n * 1000
}

/** 解 JWT payload(**不验签**,只取声明)。非三段式/非 base64url JSON → null */
export function parseJwtClaims(token: string): Record<string, unknown> | null {
  const parts = token.split('.')
  const payloadB64 = parts.length === 3 ? parts[1] : undefined
  if (!payloadB64) return null
  try {
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'))
    if (typeof payload !== 'object' || payload === null) return null
    return payload as Record<string, unknown>
  } catch {
    return null
  }
}

/** WebKit epoch(1601-01-01 起的微秒)→ Unix 毫秒。0/空 = 会话 cookie(返回 null) */
export function webkitEpochToUnixMs(expiresUtc: unknown): number | null {
  const v = typeof expiresUtc === 'number' ? expiresUtc : Number(expiresUtc)
  if (!Number.isFinite(v) || v <= 0) return null
  return Math.floor(v / 1000) - WEBKIT_EPOCH_OFFSET_MS
}

/** 从 cookies 数组里取最早过期时间(全部会话 cookie → null) */
export function earliestCookieExpiry(cookies: unknown[]): number | null {
  let min: number | null = null
  for (const c of cookies) {
    const ms = webkitEpochToUnixMs((c as { expires_utc?: unknown })?.expires_utc)
    if (ms !== null && (min === null || ms < min)) min = ms
  }
  return min
}

/**
 * 宽松过期时刻解析(Qoder 导入用,2026-10-23 立):ISO 8601 字符串
 * (auth.v1.dat 实证形态,如 "2026-11-21T11:38:26Z")或 epoch 秒
 * (数字/纯数字串) → Date;缺失/坏格式 → null。与 ai-service
 * checkin_qoder._parse_expiry_value 同判据(那边是 Python 侧投影)。
 */
export function parseFlexibleExpiry(v: unknown): Date | null {
  if (typeof v === 'number') {
    if (!Number.isFinite(v) || v <= 0) return null
    const d = new Date(v * 1000)
    return Number.isNaN(d.getTime()) ? null : d
  }
  const s = cstr(v)
  if (!s) return null
  if (/^\d+$/.test(s)) {
    const n = Number(s)
    if (!(n > 0)) return null
    const d = new Date(n * 1000)
    return Number.isNaN(d.getTime()) ? null : d
  }
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * 解析账号 uid(去重键)。优先 JWT 声明:payload.data.id(Trae 会话惯例)→ sub → uid →
 * data.user_id;全失败:sha256(token) 前 32 位(加 'auto:' 前缀,保证可去重可追溯)。
 */
export function extractUid(token: string): string {
  const claims = parseJwtClaims(token)
  if (claims) {
    const data = claims['data'] as Record<string, unknown> | undefined
    const candidates: unknown[] = [data?.['id'], claims['sub'], claims['uid'], data?.['user_id']]
    for (const c of candidates) {
      if (typeof c === 'string' && c.length > 0 && c.length <= 128) return c
      if (typeof c === 'number') return String(c).slice(0, 128)
    }
  }
  return `auto:${createHash('sha256').update(token).digest('hex').slice(0, 32)}`
}

/** 从 JWT 取 exp(Unix 秒)→ Date;无 exp → null */
export function extractTokenExpiry(token: string): Date | null {
  const claims = parseJwtClaims(token)
  const exp = claims?.['exp']
  if (typeof exp === 'number' && Number.isFinite(exp)) return new Date(exp * 1000)
  return null
}

/** Trae 特有:payload.data.tenant_id(导入时顺手存进 extraMetadata) */
export function extractTenantId(token: string): string | null {
  const claims = parseJwtClaims(token)
  const data = claims?.['data'] as Record<string, unknown> | undefined
  const t = data?.['tenant_id']
  return typeof t === 'string' && t.length > 0 ? t : null
}

/** 把 Chrome 导出 cookies 数组拼成 Cookie 请求头(name=value; …) */
export function buildCookieHeader(cookies: Array<Record<string, unknown>>): string {
  return cookies
    .filter((c) => typeof c['name'] === 'string' && typeof c['value'] === 'string')
    .map((c) => `${c['name']}=${c['value']}`)
    .join('; ')
}

// =============================================================================
// 导入预检
// =============================================================================

type ImportIssueLevel = 'error' | 'warning'

/**
 * 凭证字符串录入归一化(2026-10-23 立,dev 库实测根因)。
 *
 * 现象:`ai_relay_account_pool` 里那枚 Qoder 号 `health_status=down`、
 * 签到侧天天 `活动查询失败 HTTP 401`,而失败原文是
 * `DeviceRefreshTokenPrefixInvalid: invalid refresh_token: must start with drt-`。
 * 现读解密后判形态:存进去的本体是 `"drt-…`/`"dt-…` —— 首字符是一个引号
 * (从 auth.v1.dat 之类的 JSON 里整段复制时把引号一起粘上了),长度比正常值多 2。
 * 上游按前缀校验,一个多余字符都不认 ⇒ 号池自己刷不动(连撞 3 次后自动摘除),
 * 签到侧拿的还是这枚坏票,而用户界面上只看得见"签到失败"。
 *
 * 所以入口必须先把包裹引号/反引号与首尾空白剥掉,而不是等上游报错再猜。
 * 只用于单段凭证串(token/refreshToken/uid);cookie 数组走 JSON 通道,不经此函数。
 */
export function normalizeCredentialValue(v: unknown): string | null {
  if (typeof v !== 'string') return null
  // 逐轮剥除两端的引号/反引号与空白,直到不再变化(容忍 `""drt-…""`、` "drt-…" ` 诸型)
  let s = v
  for (;;) {
    const next = s.trim().replace(/^[ "'`]+|[ "'`]+$/g, '')
    if (next === s) break
    s = next
  }
  return s === '' ? null : s
}

/**
 * 归一化之后的形态判据:能就地拒收的,绝不留给上游去 401。
 * 返回 null = 合形或该平台无此约束;否则给出可直接执行的修正说明。
 * 消息里不回显任何凭据字符(§9:日志与错误面只记 uid/version 这类非凭据键)。
 */
export function credentialShapeIssue(
  providerCode: RelayProviderCode,
  fields: { refreshToken: string | null },
): string | null {
  if (
    providerCode === 'qoder' &&
    fields.refreshToken !== null &&
    !fields.refreshToken.startsWith('drt-')
  ) {
    return 'Qoder refreshToken 形态不符:需取 auth.v1.dat 里 `refreshToken` 字段本体(以 drt- 开头);当前值不是该形态,留着它号池无法自刷新、签到会天天被上游拒'
  }
  return null
}

/**
 * 覆盖导入时「refreshToken 写不写」的判据(2026-10-27 立,单源)。
 *
 * 立因:网页一键重登只能换到 access token —— Trae 的 GetUserToken 与 WorkBuddy 的
 * cookie 换登录态都不发 refreshToken;而覆盖导入的默认语义是「缺字段即写 NULL」。
 * 两者相遇就是个自毁环:一次重登把原本能自续的 refreshToken 抹成 NULL,号从
 * `expired-renewable` 掉成 `expired-dead` —— 救号的动作本身把号弄死。
 *
 * 因此重登路径显式带 `preserveMissingRefresh=true`:本批未提供 refreshToken 时保留
 * 库内既有密文;提供了新值则照常覆盖(显式输入永远优先)。默认 false = 保持存量导入
 * 语义(缺字段即清空),不让普通导入静默变成"永远删不掉旧票"。
 */
export interface OverwriteRefreshDecision {
  /** true ⇒ 更新时不写 refresh_token_enc 列(保留库内既有密文) */
  preserve: boolean
  /** 结果项人话(null = 无需额外说明) */
  note: string | null
}

export function resolveOverwriteRefresh(input: {
  providerCode: RelayProviderCode
  incomingRefreshToken: string | null
  existingHasRefreshToken: boolean
  preserveMissingRefresh: boolean
}): OverwriteRefreshDecision {
  // 显式新票优先:用户贴了新的 refreshToken 就没有"保留"的余地
  if (input.incomingRefreshToken) return { preserve: false, note: null }
  if (!input.preserveMissingRefresh) return { preserve: false, note: null }
  if (!input.existingHasRefreshToken) return { preserve: false, note: null }
  return {
    preserve: true,
    note: `${input.providerCode} 本次未提供 refreshToken,已保留库内原票(重登只换 access)`,
  }
}

interface ImportIssue {
  level: ImportIssueLevel
  code: string
  message: string
}

interface AccountValidation {
  index: number
  name: string
  uid: string | null
  tokenExpiresAt: string | null
  expired: boolean
  expiringSoon: boolean
  hasRefreshToken: boolean
  cookieCount: number
  cookieEarliestExpiry: string | null
  issues: ImportIssue[]
}

export interface ImportValidation {
  providerCode: RelayProviderCode
  total: number
  valid: number
  invalid: number
  duplicateUids: number
  expired: number
  expiringSoon: number
  expiredWithoutRefresh: number
  strict: boolean
  /** 文件级问题(顶层结构/数量上限) */
  issues: ImportIssue[]
  accounts: AccountValidation[]
  /** 结构无 error;strict 模式下 warning 也计入不通过 */
  ok: boolean
}

export interface ValidateOptions {
  providerCode: RelayProviderCode
  now?: Date
  strict?: boolean
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function cstr(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

function issue(level: ImportIssueLevel, code: string, message: string): ImportIssue {
  return { level, code, message }
}

function hasAny(obj: Record<string, unknown>, keys: string[]): boolean {
  return keys.some((k) => cstr(obj[k]) !== '')
}

// =============================================================================
// 外来格式自适应(2026-10-26 立)
// =============================================================================

/**
 * 我方导入契约的规范字段集(单源:归一化、未知字段透传、路由白名单校验共用)。
 * 除此之外的键 → 原样进 `extraMetadata`(兑现 RELAY_ACCOUNT_IMPORT_FORMAT.md §2
 * 「其他字段原样透传」的承诺 —— 此前服务端并没有真做透传,外来格式的
 * access_token/expires_at/uid 会在入口被整体丢弃,判成「缺少 token」)。
 */
export const IMPORT_CANONICAL_KEYS = [
  'name',
  'uid',
  'token',
  'refreshToken',
  'deviceId',
  'machineId',
  'deviceKeyPem',
  'devicePubPem',
  'enabled',
  'cookies',
  'proxyUrl',
  'expiresAt',
  'refreshTokenExpiresAt',
] as const

const FOREIGN_TOKEN_ALIASES = ['access_token', 'accessToken', 'id_token', 'idToken']
const FOREIGN_REFRESH_ALIASES = ['refresh_token', 'refresh', 'rt']
const FOREIGN_UID_ALIASES = ['userId', 'user_id', 'account_id', 'accountId']
const FOREIGN_NAME_ALIASES = ['nickname', 'accountName', 'user_name', 'username', 'phone']
/** 过期时刻的字段名族;值统一走 expireEpochToMs(秒/毫秒自适应)或 ISO */
const FOREIGN_EXPIRES_ALIASES = ['expires_at', 'expired_time', 'expiry']
const FOREIGN_REFRESH_EXPIRES_ALIASES = ['refresh_expires_at', 'refresh_token_expires_at']
const FOREIGN_DEVICE_ID_ALIASES = ['device_id']
const FOREIGN_MACHINE_ID_ALIASES = ['machine_id']
/** 标记键:归一化发生过;同时列入不透传集,免得混进 extraMetadata */
const FOREIGN_MARKER = 'foreignShape'
const FOREIGN_META_NOISE = new Set([
  ...IMPORT_CANONICAL_KEYS,
  FOREIGN_MARKER,
  ...FOREIGN_TOKEN_ALIASES,
  ...FOREIGN_REFRESH_ALIASES,
  ...FOREIGN_UID_ALIASES,
  ...FOREIGN_NAME_ALIASES,
  ...FOREIGN_EXPIRES_ALIASES,
  ...FOREIGN_REFRESH_EXPIRES_ALIASES,
  ...FOREIGN_DEVICE_ID_ALIASES,
  ...FOREIGN_MACHINE_ID_ALIASES,
])

/** ISO 串(非法时刻 → null),供归一化结果继续走既有 parseFlexibleExpiry 通道 */
function isoOrNull(ms: number | null): string | null {
  if (ms === null || !Number.isFinite(ms) || ms <= 0) return null
  const d = new Date(ms)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

function parseIsoMs(v: unknown): number | null {
  if (typeof v !== 'string') return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d.getTime()
}

/** 把一行里所有过期时刻候选(规范键存数值 + 别名字段)折成最早的有效毫秒值 */
function resolveExplicitExpiryMs(
  row: Record<string, unknown>,
  canonicalKey: string,
  aliases: string[],
): number | null {
  const values: unknown[] = [row[canonicalKey], ...aliases.map((k) => row[k])]
  let min: number | null = null
  for (const v of values) {
    if (v === undefined || v === null || v === '') continue
    const ms = typeof v === 'number' ? expireEpochToMs(v) : (expireEpochToMs(v) ?? parseIsoMs(v))
    if (ms === null) continue
    if (min === null || ms < min) min = ms
  }
  return min
}

/**
 * 把第三方账号工具的导出条目归一成我方形状;**非外来形状原样返回**。
 *
 * 判据:条目没有规范 `token`,但命中 `access_token`/`accessToken` 族别名 ⇒ 认定是
 * 外来导出(典型:workbuddy-switch 的 `workbuddy-<uid>-<id>.json`,字段为
 * access_token/refresh_token/expires_at(ms)/uid/nickname/payment_type/checkin_streak…)。
 * 只做**字段搬运与量纲归一**,不改任何语义;canonical 值优先,别名只补空缺。
 *
 * 过期时刻统一折成 ISO 串后再交还既有通道(规范键若被外来数据存成裸毫秒/秒数值,
 * 同样在此收编 —— `parseFlexibleExpiry` 把裸数字当秒,毫秒值会折成 5138 年的
 * "永不过期")。显式值仅当**早于** JWT exp 才采信:保守取早,宁可多刷一次,
 * 绝不冒充长效。归一结果带 `foreignShape: true` 标记(预检/落库两侧可观测),
 * 未知字段不删 —— 由服务端按 IMPORT_CANONICAL_KEYS 差集原样落 `extraMetadata`。
 * 输出对象仍可能含明文凭证:调用方不得打印、不得入库以外的落盘。
 */
export function normalizeForeignAccountShape(row: unknown): Record<string, unknown> {
  if (!isRecord(row)) return {}
  if (cstr(row['token'])) return row
  const token = FOREIGN_TOKEN_ALIASES.map((k) => cstr(row[k])).find(Boolean)
  if (!token) return row

  const out: Record<string, unknown> = { ...row }
  out['token'] = token
  const fillFrom = (canonical: string, aliases: string[]): void => {
    if (cstr(out[canonical])) return
    const v = aliases.map((k) => row[k]).find((x) => cstr(x) !== '')
    if (v !== undefined) out[canonical] = v
  }
  fillFrom('refreshToken', FOREIGN_REFRESH_ALIASES)
  fillFrom('uid', FOREIGN_UID_ALIASES)
  fillFrom('name', FOREIGN_NAME_ALIASES)
  fillFrom('deviceId', FOREIGN_DEVICE_ID_ALIASES)
  fillFrom('machineId', FOREIGN_MACHINE_ID_ALIASES)

  const jwtExpMs = extractTokenExpiry(token)?.getTime() ?? null
  const explicitMs = resolveExplicitExpiryMs(row, 'expiresAt', FOREIGN_EXPIRES_ALIASES)
  const finalExpMs =
    explicitMs !== null && (jwtExpMs === null || explicitMs < jwtExpMs) ? explicitMs : jwtExpMs
  if (finalExpMs !== null) out['expiresAt'] = isoOrNull(finalExpMs)

  const refreshTokenVal = cstr(out['refreshToken'])
  const jwtRtExpMs = refreshTokenVal
    ? (extractTokenExpiry(refreshTokenVal)?.getTime() ?? null)
    : null
  const rtExplicitMs = resolveExplicitExpiryMs(
    row,
    'refreshTokenExpiresAt',
    FOREIGN_REFRESH_EXPIRES_ALIASES,
  )
  const finalRtMs =
    rtExplicitMs !== null && (jwtRtExpMs === null || rtExplicitMs < jwtRtExpMs)
      ? rtExplicitMs
      : jwtRtExpMs
  if (finalRtMs !== null) out['refreshTokenExpiresAt'] = isoOrNull(finalRtMs)

  out[FOREIGN_MARKER] = true
  return out
}

/**
 * 外来条目里未被我方规范消费的键(含别名之外的全部未知键)→ 供服务端原样落
 * extraMetadata。值只收标量与短数组/对象(JSON.stringify 后 ≤1024),防爆库。
 */
export function foreignPassthroughMetadata(acc: Record<string, unknown>): Record<string, unknown> {
  const extra: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(acc)) {
    if (FOREIGN_META_NOISE.has(k)) continue
    if (v === undefined || v === null) continue
    if (typeof v === 'number' || typeof v === 'boolean') {
      extra[k] = v
      continue
    }
    if (typeof v === 'string') {
      if (v.length > 0 && v.length <= 1024) extra[k] = v
      continue
    }
    if (Array.isArray(v) || typeof v === 'object') {
      let s = ''
      try {
        s = JSON.stringify(v)
      } catch {
        s = ''
      }
      if (s && s.length <= 1024) extra[k] = v
    }
  }
  return extra
}

/**
 * 校验一份账号导出 JSON。接受 `{accounts:[...]}` 或裸数组。
 * 不修改入参、不读写文件、不发网络。
 */
export function validateAccountExport(raw: unknown, opts: ValidateOptions): ImportValidation {
  const now = opts.now ?? new Date()
  const strict = opts.strict === true
  const fileIssues: ImportIssue[] = []
  let rows: unknown[] = []

  if (Array.isArray(raw)) {
    rows = raw
  } else if (isRecord(raw) && Array.isArray(raw['accounts'])) {
    rows = raw['accounts']
  } else {
    fileIssues.push(issue('error', 'top-level-shape', '顶层必须是 { accounts: [...] } 或账号数组'))
  }

  if (fileIssues.length === 0 && rows.length === 0) {
    fileIssues.push(issue('error', 'empty-accounts', 'accounts 为空,没有可导入的账号'))
  }
  if (rows.length > IMPORT_MAX_ACCOUNTS) {
    fileIssues.push(
      issue(
        'error',
        'too-many-accounts',
        `单批最多 ${IMPORT_MAX_ACCOUNTS} 个账号,当前 ${rows.length} 个;请拆批导入`,
      ),
    )
  }

  const accounts: AccountValidation[] = []
  const seenUids = new Set<string>()
  let duplicateUids = 0
  let expired = 0
  let expiringSoon = 0
  let expiredWithoutRefresh = 0

  rows.forEach((row, index) => {
    const issues: ImportIssue[] = []
    if (!isRecord(row)) {
      accounts.push({
        index,
        name: `#${index + 1}`,
        uid: null,
        tokenExpiresAt: null,
        expired: false,
        expiringSoon: false,
        hasRefreshToken: false,
        cookieCount: 0,
        cookieEarliestExpiry: null,
        issues: [issue('error', 'account-shape', '账号条目必须是对象')],
      })
      return
    }

    // 外来格式自适应:第三方账号工具导出(access_token/expires_at 等)先归一成规范形状
    // 再进入校验;我方原生形状(token 在场)原样通过。判据单源,服务端 importAccounts 调
    // 同一个函数,不允许任何调用方自己抄别名表。
    const acc = normalizeForeignAccountShape(row)
    const isCodearts = opts.providerCode === 'codearts'
    const codeartsAccount = isCodearts && isRecord(acc['account']) ? acc['account'] : undefined
    const name =
      cstr(acc['name']) ||
      (isCodearts
        ? cstr(codeartsAccount?.['label']) || cstr(acc['user_name']) || `#${index + 1}`
        : opts.providerCode === 'qoder'
          ? cstr(acc['nickname']) || cstr(acc['phone']) || `#${index + 1}`
          : `#${index + 1}`)

    // ── 凭证必填面 ──
    let token = cstr(acc['token'])
    if (isCodearts) {
      const sts = hasAny(acc, ['securitytoken', 'security_token', 'cloud_dragon_token'])
      const ak = hasAny(acc, ['accessKey', 'access_key_id'])
      const sk = hasAny(acc, ['secretKey', 'secret_access_key'])
      if (!sts || !ak || !sk) {
        issues.push(
          issue(
            'error',
            'codearts-credentials',
            'CodeArts 导入缺少 STS 凭据(securitytoken/accessKey/secretAccessKey)',
          ),
        )
      }
      token =
        cstr(acc['securitytoken']) || cstr(acc['security_token']) || cstr(acc['cloud_dragon_token'])
    } else if (!token) {
      issues.push(issue('error', 'missing-token', '缺少 token'))
    }

    // ── 字段类型 ──
    if (
      acc['name'] !== undefined &&
      (typeof acc['name'] !== 'string' || cstr(acc['name']).length > 128)
    ) {
      issues.push(issue('error', 'name-invalid', 'name 必须是不超过 128 字符的字符串'))
    }
    if (acc['enabled'] !== undefined && typeof acc['enabled'] !== 'boolean') {
      issues.push(issue('error', 'enabled-invalid', 'enabled 必须是布尔值'))
    }
    // refreshToken 不是短指纹:WorkBuddy 实测 700 字符(Trae 更短),128 会把合法号判死
    const refreshTokenMax = 4096
    if (
      acc['refreshToken'] !== undefined &&
      (typeof acc['refreshToken'] !== 'string' || acc['refreshToken'].length > refreshTokenMax)
    ) {
      issues.push(
        issue(
          'error',
          'refreshToken-invalid',
          `refreshToken 必须是不超过 ${refreshTokenMax} 字符的字符串`,
        ),
      )
    }
    for (const [key, label] of [
      ['deviceId', 'deviceId'],
      ['machineId', 'machineId'],
    ] as const) {
      const v = acc[key]
      if (v !== undefined && (typeof v !== 'string' || v.length > 128)) {
        issues.push(issue('error', `${key}-invalid`, `${label} 必须是不超过 128 字符的字符串`))
      }
    }

    // ── 出口代理(可选) ──
    const proxyUrl = cstr(acc['proxyUrl'])
    if (proxyUrl) {
      let protocol = ''
      try {
        protocol = new URL(proxyUrl).protocol
      } catch {
        protocol = ''
      }
      if (!['http:', 'https:', 'socks5:'].includes(protocol)) {
        issues.push(
          issue(
            'warning',
            'proxy-url-invalid',
            'proxyUrl 不是 http(s)/socks5 地址,导入后该号将无法出网',
          ),
        )
      }
    }

    // ── cookies(Chrome 导出格式) ──
    const cookies = acc['cookies']
    let cookieCount = 0
    if (cookies !== undefined) {
      if (!Array.isArray(cookies)) {
        issues.push(issue('error', 'cookies-invalid', 'cookies 必须是数组'))
      } else {
        cookieCount = cookies.length
        cookies.forEach((c, ci) => {
          if (!isRecord(c)) {
            issues.push(issue('warning', 'cookie-shape', `cookies[${ci}] 不是对象,导入时会忽略`))
            return
          }
          if (typeof c['name'] !== 'string' || typeof c['value'] !== 'string') {
            issues.push(
              issue('warning', 'cookie-name-value', `cookies[${ci}] 缺 name/value,导入时会忽略`),
            )
          }
          const exp = c['expires_utc']
          if (exp !== undefined && (typeof exp !== 'number' || !Number.isFinite(exp) || exp < 0)) {
            issues.push(
              issue(
                'warning',
                'cookie-expires-utc',
                `cookies[${ci}].expires_utc 必须是 WebKit epoch 微秒(非负数)`,
              ),
            )
          }
        })
      }
    }

    // ── uid / 到期时刻 ──
    let uid: string | null = null
    let expiresAt: Date | null = null
    if (isCodearts) {
      const account = isRecord(acc['account']) ? acc['account'] : undefined
      uid =
        cstr(account?.['id']) ||
        cstr(acc['user_id']) ||
        (cstr(acc['accessKey']) || cstr(acc['access_key_id'])
          ? `auto:${createHash('sha256')
              .update(cstr(acc['accessKey']) || cstr(acc['access_key_id']))
              .digest('hex')
              .slice(0, 32)}`
          : null)
      const expRaw = cstr(acc['expires_at']) || cstr(acc['expiration'])
      const parsed = expRaw ? new Date(expRaw) : null
      expiresAt = parsed && !Number.isNaN(parsed.getTime()) ? parsed : null
      if (expRaw && !expiresAt) {
        issues.push(issue('warning', 'expires-at-invalid', 'expires_at/expiration 不是合法日期'))
      }
    } else if (token) {
      if (opts.providerCode === 'qoder') {
        // Qoder(2026-10-23 立):token 是 27 字符 opaque 单段串(非 JWT,真机实证)
        // ⇒ uid 真源 = 显式传入的 uid(桌面端捕获的 session.user.id),expiresAt 是
        // ISO 8601 字符串(auth.v1.dat 原文);缺失才退化为哈希 uid / 无过期时刻。
        uid = cstr(acc['uid']) || extractUid(token)
        expiresAt = parseFlexibleExpiry(acc['expiresAt']) ?? extractTokenExpiry(token)
      } else {
        const claims = parseJwtClaims(token)
        if (!claims) {
          issues.push(
            issue(
              'warning',
              'token-not-jwt',
              'token 不是三段式 JWT,无法解析 uid/exp;服务端将按哈希去重',
            ),
          )
        }
        // 显式 uid / expiresAt 优先(与服务端 importAccounts 的去重口径一致;
        // 归一化已把外来 expires_at(ms) 折成 ISO 串,非法 ISO 时 parseFlexibleExpiry
        // 返回 null 自然回退 JWT exp)
        uid = cstr(acc['uid']) || extractUid(token)
        expiresAt = parseFlexibleExpiry(acc['expiresAt']) ?? extractTokenExpiry(token)
      }
    }

    if (uid) {
      if (seenUids.has(uid)) {
        duplicateUids++
        issues.push(issue('warning', 'duplicate-uid', `批内重复 uid ${uid},导入时以首条为准`))
      } else {
        seenUids.add(uid)
      }
    }

    const refreshToken = cstr(acc['refreshToken'])
    const hasRefresh = refreshToken !== ''
    let isExpired = false
    let isExpiringSoon = false
    if (expiresAt) {
      const delta = expiresAt.getTime() - now.getTime()
      isExpired = delta <= 0
      isExpiringSoon = !isExpired && delta <= IMPORT_EXPIRING_SOON_MS
      if (isExpired) {
        expired++
        issues.push(
          issue(
            'warning',
            'token-expired',
            hasRefresh
              ? 'access token 已过期,但有 refreshToken,可由调度器续期'
              : 'access token 已过期且无 refreshToken,入库即摘除(down)',
          ),
        )
        if (!hasRefresh) expiredWithoutRefresh++
      } else if (isExpiringSoon) {
        expiringSoon++
        issues.push(issue('warning', 'token-expiring-soon', 'access token 将在 24 小时内过期'))
      }
    }

    const cookieEarliest = Array.isArray(cookies) ? earliestCookieExpiry(cookies) : null
    accounts.push({
      index,
      name,
      uid,
      tokenExpiresAt: expiresAt ? expiresAt.toISOString() : null,
      expired: isExpired,
      expiringSoon: isExpiringSoon,
      hasRefreshToken: hasRefresh,
      cookieCount,
      cookieEarliestExpiry: cookieEarliest !== null ? new Date(cookieEarliest).toISOString() : null,
      issues,
    })
  })

  const invalid = accounts.filter((a) => a.issues.some((i) => i.level === 'error')).length
  const fileHasError = fileIssues.some((i) => i.level === 'error')
  const accountHasError = accounts.some((a) => a.issues.some((i) => i.level === 'error'))
  const hasWarning =
    fileIssues.some((i) => i.level === 'warning') ||
    accounts.some((a) => a.issues.some((i) => i.level === 'warning'))

  return {
    providerCode: opts.providerCode,
    total: rows.length,
    valid: rows.length - invalid,
    invalid,
    duplicateUids,
    expired,
    expiringSoon,
    expiredWithoutRefresh,
    strict,
    issues: fileIssues,
    accounts,
    ok: !fileHasError && !accountHasError && !(strict && hasWarning),
  }
}

/** 把导出文件包装成 admin 导入接口的请求体(不写盘、不回显凭证) */
export function toImportRequestBody(
  raw: unknown,
  providerCode: RelayProviderCode,
): { providerCode: RelayProviderCode; accounts: unknown[] } {
  const accounts = Array.isArray(raw)
    ? raw
    : isRecord(raw) && Array.isArray(raw['accounts'])
      ? raw['accounts']
      : []
  return { providerCode, accounts }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
