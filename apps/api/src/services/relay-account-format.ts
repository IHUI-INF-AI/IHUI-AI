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

    const acc = row
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
        uid = extractUid(token)
        expiresAt = extractTokenExpiry(token)
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
