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
export const IMPORT_MAX_ACCOUNTS = 500
/** 临期阈值:导入预检把 24h 内到期单独点名 */
export const IMPORT_EXPIRING_SOON_MS = 24 * 60 * 60 * 1000
/** WebKit epoch(1601-01-01)与 Unix epoch(1970-01-01)的毫秒差 */
export const WEBKIT_EPOCH_OFFSET_MS = 11_644_473_600_000

// =============================================================================
// 号池统一名判定(手机号优先,O66 单源)
// =============================================================================

/** 统一名最终采信的来源(可归因:预检报告、入库结果、CLI 共用这一套枚举) */
export type RelayAccountNameSource = 'phone' | 'payload-name' | 'platform-name' | 'sequence'

/**
 * 手机号为何没被采信(§0.3「没判」不得写成「判过」的同族纪律:退化必须点名,不许静默)。
 * - `phone-absent`    = 载荷与票面都没给出任何手机号候选
 * - `phone-not-shape` = 给了手机号候选,但既非 11 位大陆全号、也非掩码形态
 * - `null`            = 采信了手机号(无退化)
 */
export type RelayAccountNameFallback = 'phone-absent' | 'phone-not-shape' | null

/**
 * 手机号取位键(**全仓唯一一份**,支持 `a.b` 嵌套)。
 *
 * 机主 2026-10-28 令「名称应该都统一为手机号 所有平台都是」⇒ 12 平台一律先认顶层
 * `phone`;平台特有的**嵌套**手机号位只在有实证时才登记:
 * - qoder:`user.phone`(桌面端捕获的内联 `user{id,name,phone,email,…}` 会话导出,
 *   见 docs/RELAY_ACCOUNT_IMPORT_FORMAT.md §3.1);
 * - codearts:`account.phone`(桌面端导出 `account{id,label}` 同层预留)。
 * 没有实证的一律**不加** —— 猜出来的键位会把"取不到手机号"读成"取到了别人的值"。
 */
export const RELAY_ACCOUNT_PHONE_KEYS: Record<RelayProviderCode, readonly string[]> = {
  trae: ['phone'],
  workbuddy: ['phone'],
  codearts: ['phone', 'account.phone'],
  qoder: ['phone', 'user.phone'],
  codex: ['phone'],
  opencode: ['phone'],
  minimax: ['phone'],
  zcode: ['phone'],
  loomy: ['phone'],
  doubao: ['phone'],
  lingma: ['phone'],
  grokbot: ['phone'],
}

/**
 * 手机号取不到时的名字候选键位(**全仓唯一一份**,数组顺序即优先级,支持 `a.b` 嵌套)。
 *
 * 这张表把此前**两份**逐平台 if-else(预检 `validateAccountExport` 一份、入库
 * `importAccounts` 一份,两者对 12 平台里的 9 个根本没探 phone)折成一处口径。
 * 顺序 = 改前逐平台读数的并集(trae/workbuddy 取 name、qoder 取 nickname→name、
 * codearts 取 name→account.label→user_name、lingma 补 user_name、余者取 name),
 * 即:除"phone 提前 + 补齐缺失的平台"外不改任何既有优先关系。
 */
export const RELAY_ACCOUNT_NAME_KEYS: Record<RelayProviderCode, readonly string[]> = {
  trae: ['name'],
  workbuddy: ['name'],
  codearts: ['name', 'account.label', 'user_name'],
  qoder: ['nickname', 'name'],
  codex: ['name'],
  opencode: ['name'],
  minimax: ['name'],
  zcode: ['name'],
  loomy: ['name'],
  doubao: ['name'],
  lingma: ['name', 'user_name'],
  grokbot: ['name'],
}

/** 统一名入库列宽上限(与 `ai_relay_account_pool.name` 及 applyPhoneCompletion 同值) */
const RELAY_ACCOUNT_NAME_MAX = 128

/** 按 `a.b.c` 键路径取字符串(只穿对象层;数组/标量中途即算取不到)。取不到 → `''` */
export function readAccountKeyPath(row: Record<string, unknown>, path: string): string {
  let cur: unknown = row
  for (const seg of path.split('.')) {
    if (cur === null || typeof cur !== 'object' || Array.isArray(cur)) return ''
    cur = (cur as Record<string, unknown>)[seg]
  }
  return cstr(cur)
}

/** 是不是号池统一名接受的手机号形态(全号或掩码;其余一律不算手机号) */
export function isRelayNamePhoneShape(v: string): boolean {
  return isFullPhone(v) || detectPhoneMask(v) !== null
}

export interface RelayAccountNameInput {
  providerCode: RelayProviderCode
  /** 归一化后的账号载荷(`normalizeForeignAccountShape` 的输出) */
  payload: Record<string, unknown>
  /** 0-based 行序号,`#序号` 兜底用(预检与入库同一形态) */
  index?: number
  /** 平台映射器算出的名字(codex `codex:<id8>`、minimax `minimax:<region>` 等),可空 */
  platformName?: string | null
  /**
   * 调用方补强的手机号候选。WorkBuddy 的官方绑定手机号住在 Keycloak 票的
   * `preferred_username` 声明里、不在载荷字段上 ⇒ 由服务端解出后传进来。
   * **形态判定不许在调用方复算**(§0.6),这里只喂原始字符串。
   */
  extraPhoneCandidates?: readonly (string | null | undefined)[]
}

export interface RelayAccountNameDecision {
  /** 最终统一名(可能就是手机号;这是设计,见 PII 纪律) */
  name: string
  source: RelayAccountNameSource
  fallback: RelayAccountNameFallback
  /** 退化的人话说明;**绝不含号码/候选原值**(PII 纪律:日志、错误 message、对外面不落地) */
  fallbackReason: string | null
}

/** 退化说明(按码给固定句式,只报码与退化去向,不报候选原值) */
function nameFallbackText(code: Exclude<RelayAccountNameFallback, null>, target: string): string {
  const why =
    code === 'phone-absent'
      ? '载荷与票面都没有手机号候选'
      : '手机号候选既非 11 位大陆全号也非掩码形态(原值不回显)'
  return `统一名未取到手机号(${code}:${why}),已退化为${target}`
}

/**
 * 号池统一名 = 官方绑定手机号(手机号优先),取不到才按
 * 载荷自带名 → 平台映射名 → `#序号` 退化。
 *
 * 预检(`validateAccountExport`)与入库(`importAccounts`)**共用本函数** ⇒ 两侧口径
 * 不可能再分叉(改前是分叉的:预检只给 qoder/trae/workbuddy 补了 phone,入库只有
 * qoder 走 phone、workbuddy 走票内声明,其余 9 个平台连 `phone` 这个键都没看过)。
 *
 * 手机号形态两档都采信:全号最佳;掩码形态(上游只下发脱敏号)照采,入库后由
 * `extraMetadata.phoneMask` + complete-phone / match-phone 补全成对账链。
 * 既非全号也非掩码的候选**一律不入名**(这是"非法 phone 不落原文"那一格)。
 *
 * PII:返回的 `name` 可能就是手机号本身(号池统一名的定义如此,与既有 qoder/workbuddy
 * 行为同形);但 `fallbackReason` 永不含号码原值,调用方不得把候选原值写进日志/错误面。
 */
export function resolveRelayAccountName(input: RelayAccountNameInput): RelayAccountNameDecision {
  const seq = `#${(input.index ?? 0) + 1}`
  const phoneKeys = RELAY_ACCOUNT_PHONE_KEYS[input.providerCode] ?? ['phone']
  const phoneCandidates = [
    ...phoneKeys.map((k) => readAccountKeyPath(input.payload, k)),
    ...(input.extraPhoneCandidates ?? []).map((v) => cstr(v)),
  ].filter((v) => v !== '')

  // 全号优先于掩码:同一行同时给了两档时,统一名必须是能签到对账的那个
  const full = phoneCandidates.find((v) => isFullPhone(v))
  if (full) {
    return {
      name: full.slice(0, RELAY_ACCOUNT_NAME_MAX),
      source: 'phone',
      fallback: null,
      fallbackReason: null,
    }
  }
  const masked = phoneCandidates.find((v) => detectPhoneMask(v) !== null)
  if (masked) {
    return {
      name: masked.slice(0, RELAY_ACCOUNT_NAME_MAX),
      source: 'phone',
      fallback: null,
      fallbackReason: null,
    }
  }

  const code: Exclude<RelayAccountNameFallback, null> =
    phoneCandidates.length === 0 ? 'phone-absent' : 'phone-not-shape'
  const nameKeys = RELAY_ACCOUNT_NAME_KEYS[input.providerCode] ?? ['name']
  const payloadName = nameKeys
    .map((k) => readAccountKeyPath(input.payload, k))
    .find((v) => v !== '')
  if (payloadName) {
    return {
      name: payloadName.slice(0, RELAY_ACCOUNT_NAME_MAX),
      source: 'payload-name',
      fallback: code,
      fallbackReason: nameFallbackText(code, '载荷自带名'),
    }
  }
  const platformName = cstr(input.platformName)
  if (platformName) {
    return {
      name: platformName.slice(0, RELAY_ACCOUNT_NAME_MAX),
      source: 'platform-name',
      fallback: code,
      fallbackReason: nameFallbackText(code, '平台映射名'),
    }
  }
  return {
    name: seq,
    source: 'sequence',
    fallback: code,
    fallbackReason: nameFallbackText(code, '#序号'),
  }
}

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

export type ImportIssueLevel = 'error' | 'warning'

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

export interface ImportIssue {
  level: ImportIssueLevel
  code: string
  message: string
}

export interface AccountValidation {
  index: number
  name: string
  /** 统一名来源(O66:手机号优先;见 resolveRelayAccountName) */
  nameSource: RelayAccountNameSource
  /** 手机号为何没被采信;null = 用了手机号。说明绝不含号码原值 */
  nameFallback: RelayAccountNameFallback
  nameFallbackReason: string | null
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
        nameSource: 'sequence',
        nameFallback: 'phone-absent',
        nameFallbackReason: nameFallbackText('phone-absent', '#序号'),
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
    // 统一名 = 官方绑定手机号(O66,2026-10-30 收口到 12 平台全覆盖):判据单源
    // resolveRelayAccountName(与入库 importAccounts 同一函数)。载荷里的 name/nickname
    // 是客户端昵称或第三方导出件里的脱敏串,不作统一名;给了 phone 就以 phone 为准,
    // 取不到手机号才退化,且退化必须带归因(nameFallback / nameFallbackReason)。
    const naming = resolveRelayAccountName({
      providerCode: opts.providerCode,
      payload: acc,
      index,
    })
    const name = naming.name

    // ── 凭证必填面(形状判据单源:recognizeImportShape)──
    // 12 平台原生形状(tokens.access_token / auth.key / accessToken / value /
    // securitytoken+AK/SK …)的判据只有一份,Web 路由闸门、CLI 预检、服务端落库共用;
    // 这里不再按平台各抄一段(抄一份就分叉一次,分叉一次就有平台导不进去)。
    const shape = recognizeImportShape(opts.providerCode, row)
    const token = shape.credential ?? ''
    if (!shape.importable) {
      issues.push(
        issue(
          'error',
          RELAY_IMPORT_SHAPE_ISSUE_CODE[opts.providerCode],
          shape.reason ?? '缺少 token',
        ),
      )
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
      nameSource: naming.source,
      nameFallback: naming.fallback,
      nameFallbackReason: naming.fallbackReason,
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
