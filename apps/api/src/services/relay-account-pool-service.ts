// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 第三方 AI IDE 平台账号池服务(2026-10-22 立,对标码道网关 CodeArtsGateway)。
 *
 * 职责:
 * 1. 批量导入:直接吃「账号导出 JSON」格式({ accounts: [{ name, token, refreshToken,
 *    deviceId, machineId, enabled, cookies[] }] },cookies 为 Chrome 导出格式,
 *    expires_utc 为 WebKit epoch 微秒)。逐条解析 JWT 取 uid/exp,encryptField 加密落库,
 *    (providerCode, uid) 去重(已存在则覆盖凭证 = 重新导入续命)。
 * 2. 凭证解密:供平台适配器取账号的明文 token/refreshToken/cookies。
 * 3. 状态维护:刷新成功/失败计数、健康状态、熔断摘除(tempUnschedulable)。
 *
 * 注意:本服务不发起任何上游请求(上游协议全部住在 relay-upstream-adapters/*);
 * 导入时**不校验账号有效性**(不碰上游),只做本地解析 —— 过期号允许入库(带 refreshToken
 * 的可被调度器续期;没有的直接标 down + 摘除),是否可用交给健康检查/转发链路判定。
 */
import { createHash } from 'node:crypto'
import { and, eq, inArray, isNull, like, or, sql } from 'drizzle-orm'
import {
  aiModelConfig,
  aiModelConfigModels,
  aiRelayAccountPool,
  type AiRelayAccountPool,
} from '@ihui/database'
import { db, dbRead } from '../db/index.js'
import { encryptField, decryptField } from '../utils/crypto.js'
import { logger } from '../utils/logger.js'
import {
  credentialShapeIssue,
  detectPhoneMask,
  earliestCookieExpiry,
  extractTenantId,
  extractTokenExpiry,
  extractUid,
  foreignPassthroughMetadata,
  isFullPhone,
  normalizeCredentialValue,
  normalizeForeignAccountShape,
  parseFlexibleExpiry,
  parseJwtClaims,
  phoneMatchesMask,
  recognizeImportShape,
  resolveOverwriteRefresh,
  resolveRelayAccountName,
  resolveRelayCredentialSlots,
  isRelayProviderCode,
  type RelayAccountNameDecision,
  type RelayAccountNameFallback,
  type RelayAccountNameSource,
  type RelayProviderCode,
} from './relay-account-format.js'
import {
  buildPoolSyncAccount,
  checkinPlatformFor,
  clearCheckinSyncPending,
  extractCosy,
  markCheckinSyncPending,
  pemFromSecrets,
  pushPoolSync,
  type PoolSyncAccount,
} from './relay-account-pool-checkin-sync.js'
import { encryptAccountProxyUrl, resolveAccountProxyUrl } from './relay-proxy-pool.js'

// =============================================================================
// 类型
// =============================================================================

/** 导入 JSON 里的单账号形状(与账号导出工具/浏览器插件格式对齐,字段宽松) */
export interface ImportAccountInput {
  name?: string
  /** 显式上游 uid(签到助手反向同步时以 identity_key 为权威;缺省则从 token 解析) */
  uid?: string
  token?: string
  refreshToken?: string
  deviceId?: string
  machineId?: string
  /** 设备证明材料(Trae 桌面渠道续票必需;密钥对进 secretsEnc,两个都给才生效) */
  deviceKeyPem?: string
  devicePubPem?: string
  enabled?: boolean
  cookies?: unknown[]
  /** 账号级出口代理(可选) */
  proxyUrl?: string
  /** 平台特有附加字段(原样进 extraMetadata) */
  [k: string]: unknown
}

type ImportItemStatus = 'imported' | 'updated' | 'skipped' | 'failed'

interface ImportItemResult {
  index: number
  name: string
  uid: string | null
  status: ImportItemStatus
  reason: string | null
  /** 统一名来源(O66:手机号优先;判据单源 resolveRelayAccountName) */
  nameSource: RelayAccountNameSource
  /** 手机号为何没被采信;null = 用了手机号 */
  nameFallback: RelayAccountNameFallback
  /**
   * 退化的人话归因。**绝不含手机号/候选原值**(PII:手机号只进 `name` 列本身,
   * 不进日志、不进错误 message、不进这里的说明)。
   */
  nameFallbackReason: string | null
}

export interface ImportBatchResult {
  providerCode: RelayProviderCode
  total: number
  imported: number
  updated: number
  skipped: number
  failed: number
  items: ImportItemResult[]
  /**
   * O64 签到同步统计(导入/覆盖 → 签到副本;号池 = 凭证权威)。
   * pushed = 签到侧已建/已更新条数;skipped = 平台无签到引擎条数;pending = 推送失败
   * 落待推条数(由 retryPendingCheckinSyncs / 对账收敛器清偿)。失败不阻塞导入。
   */
  checkinSync?: { pushed: number; skipped: number; pending: number; error: string | null }
  /**
   * O72 设备指纹重复报告(2026-10-28 立;只报告、不改写、不加迁移/唯一索引 ——
   * 唯一索引会把存量池硬失败,升格需机主签字)。同一池内 (providerCode, deviceId)
   * 相同的多行 = 从同一真实客户端导出的 N 个账号,这是上游可直接完成跨账号关联的
   * 暴露面;此前导入面对它零信号。本字段点名这些行,由运营者自行区分/重导。
   */
  deviceCollisions?: Array<{ deviceId: string; uids: string[] }>
  /**
   * deviceCollisions 的判定范围三态(§0.3 取不到不冒绿):
   * - checked   = 本批落库行 + 池内既有行(同 providerCode/归属)一并核对过;
   * - unjudged  = 池内既有行查询失败 ⇒ deviceCollisions 只覆盖本批内部,池面未判定;
   * - none      = 本批没有任何带 deviceId 的落库行(无从碰撞,一次池内查询都不发起)。
   */
  deviceCollisionScope?: 'checked' | 'unjudged' | 'none'
}

/** 批量导入的行为开关(覆盖语义;缺省 = 存量语义,调用方零改动) */
export interface ImportAccountsOptions {
  /**
   * 覆盖既有行时,本批未提供 refreshToken ⇒ 保留库内既有密文而不是写 NULL。
   * 专供"网页一键重登"(重登只换得到 access);缺省 false。
   */
  preserveMissingRefresh?: boolean
}

// =============================================================================
// CodeArts 导入映射(2026-10-22 立)
// =============================================================================

/** CodeArts OAuth 客户端标识(桌面端 product.json 的 urlProtocol) */
const CODEARTS_DEFAULT_CLIENT_ID = 'codearts-agent'

interface CodeartsImportMapping {
  token: string
  refreshToken: string | null
  uid: string
  name: string | null
  expiresAt: Date | null
  secrets: Record<string, unknown>
}

function cstr(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

/**
 * Trae 设备材料 → secrets(2026-10-25 立):新版 ExchangeToken 用设备私钥签名
 * 换票,桌面客户端签发的票只认这条路。只收"两个 PEM 都在"的完整材料,
 * 缺一半视同没有(adapter 会退回旧通道)。token/refreshToken/uid 走原路径,
 * 不参与映射(避免与 opaque token 平台的分支语义混淆)。
 */
function mapTraeImport(acc: ImportAccountInput): { secrets: Record<string, unknown> } | null {
  const secrets: Record<string, unknown> = {}
  const keyPem = cstr(acc['deviceKeyPem'])
  const pubPem = cstr(acc['devicePubPem'])
  if (keyPem && pubPem) {
    secrets.deviceKeyPem = keyPem
    secrets.devicePubPem = pubPem
  }
  // 模板三键同批收进来(2026-10-29 补):只认"两个 PEM 都在"会让"本批只带新模板"这条
  // 整列不写 —— 新模板于是被静默丢弃(没有报错、号池里仍是旧模板)。三键与设备材料
  // 互不相斥:给了就带,不给由后面的合并步骤从既有列保留。
  for (const k of ['sessionTemplate', 'sealedPaths', 'edition'] as const) {
    const v = acc[k]
    if (v === null || v === undefined) continue
    if (typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0) continue
    secrets[k] = v
  }
  return Object.keys(secrets).length > 0 ? { secrets } : null
}

/** DPoP 私钥既可能是 JWK 对象也可能是 JSON 字符串,统一解析为对象 */
function parseJwkValue(v: unknown): Record<string, unknown> | null {
  if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>
  if (typeof v === 'string' && v.trim()) {
    try {
      const parsed = JSON.parse(v)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed))
        return parsed as Record<string, unknown>
    } catch {
      /* 非法 JWK 字符串 → 视为无 */
    }
  }
  return null
}

/**
 * CodeArts 导入映射:两种导出格式都认,凭证拆进 token/refresh/secrets/expiresAt/uid。
 * - 桌面端导出:{accessKey, secretKey, securitytoken, refresh_token, expires_at, domainId,
 *   account:{id,label}, loginContext:{pkcePair:{codeVerifier}, dpopKeyPair:{privateKeyJwk}}}
 * - Seventy73 落盘:{user_id, user_name, domain_id, cloud_dragon_token(=security_token),
 *   access_key_id, secret_access_key, expiration, refresh_token, code_verifier, client_id, dpop_private_key}
 */
function mapCodeartsImport(acc: ImportAccountInput): CodeartsImportMapping | null {
  const a = acc as Record<string, unknown>
  // 凭据落点单源在 relay-account-format 的槽位表(STS 票 / AK / SK 三槽全命中才算一条)
  const { hits } = resolveRelayCredentialSlots(a, 'codearts')
  const sts = hits[0]
  const ak = hits[1]
  const sk = hits[2]
  if (!sts || !ak || !sk) return null
  const token = sts.value
  const accessKeyId = ak.value
  const secretAccessKey = sk.value

  const account = a['account'] as Record<string, unknown> | undefined
  const loginContext = a['loginContext'] as Record<string, unknown> | undefined
  const pkcePair = loginContext?.['pkcePair'] as Record<string, unknown> | undefined
  const dpopKeyPair = loginContext?.['dpopKeyPair'] as Record<string, unknown> | undefined

  const uid =
    cstr(account?.['id']) ||
    cstr(a['user_id']) ||
    `auto:${createHash('sha256').update(accessKeyId).digest('hex').slice(0, 32)}`
  const userName = cstr(a['user_name'])
  const label = cstr(account?.['label'])
  const refreshToken = cstr(a['refresh_token']) || null
  const codeVerifier = cstr(pkcePair?.['codeVerifier']) || cstr(a['code_verifier'])
  const dpopPrivateKeyJwk =
    parseJwkValue(dpopKeyPair?.['privateKeyJwk']) ?? parseJwkValue(a['dpop_private_key'])
  const expRaw = cstr(a['expires_at']) || cstr(a['expiration'])
  const expDate = expRaw ? new Date(expRaw) : null

  return {
    token,
    refreshToken,
    uid,
    name: label || userName || null,
    expiresAt: expDate && !Number.isNaN(expDate.getTime()) ? expDate : null,
    secrets: {
      accessKeyId,
      secretAccessKey,
      dpopPrivateKeyJwk,
      codeVerifier,
      clientId: cstr(a['client_id']) || CODEARTS_DEFAULT_CLIENT_ID,
      domainId: cstr(a['domainId']) || cstr(a['domain_id']),
      userName: userName || label,
    },
  }
}

// =============================================================================
// Qoder 导入映射(2026-10-23 立)
// =============================================================================

/**
 * Qoder 导入映射:token 是 27 字符 opaque 单段串(非 JWT,真机实证
 * 2026-10-12/10-23)⇒
 * - uid 真源 = 显式 uid(桌面端 checkin_capture.rs 的 session.user.id),
 *   也认 user.{id,userId,uid,user_id};全缺才退化为 extractUid 哈希;
 * - expiresAt 是 ISO 8601 字符串(auth.v1.dat 原文),也收 epoch 秒;
 * - Cosy 设备头族(machineToken/machineCode/machineType/version,客户端
 *   resources/umid/runtime-info.exe 产出)随 extraMetadata 落库,adapter
 *   刷新/健康检查时带上(缺失时 adapter 兜底默认,不阻塞)。
 */
interface QoderImportMapping {
  token: string
  refreshToken: string | null
  uid: string
  expiresAt: Date | null
  refreshExpiresAt: Date | null
  name: string | null
  cosy: Record<string, string> | null
  /** 会话模板(整份会话剔凭证):缺它时「登录本机」以客户端当前文件兜底 ⇒ 带旧号资料 */
  secrets?: Record<string, unknown>
}

function mapQoderImport(acc: ImportAccountInput): QoderImportMapping | null {
  const a = acc as Record<string, unknown>
  const { hits } = resolveRelayCredentialSlots(a, 'qoder')
  const token = hits[0]?.value ?? ''
  if (!token) return null
  const user =
    a['user'] !== null && typeof a['user'] === 'object' && !Array.isArray(a['user'])
      ? (a['user'] as Record<string, unknown>)
      : null
  const uid =
    cstr(a['uid']) ||
    (user
      ? cstr(user['id']) || cstr(user['userId']) || cstr(user['uid']) || cstr(user['user_id'])
      : '') ||
    extractUid(token)
  const cosy: Record<string, string> = {}
  // 2026-10-23 修:cosy 落库键改蛇形(对齐 checkin_qoder.COSY_HEADER_KEYS 的
  // device_map["cosy"] 契约;此前存驼峰导致 adapter 取不到 → Cosy 头族缺失)
  const cosyKeyMap: ReadonlyArray<readonly [string, string]> = [
    ['machineToken', 'machine_token'],
    ['machineCode', 'machine_code'],
    ['machineType', 'machine_type'],
    ['version', 'version'],
  ]
  for (const [srcKey, storeKey] of cosyKeyMap) {
    const v = cstr(a[srcKey])
    if (v) cosy[storeKey] = v
  }
  return {
    token,
    refreshToken: cstr(a['refreshToken']) || null,
    uid,
    expiresAt: parseFlexibleExpiry(a['expiresAt']) ?? extractTokenExpiry(token),
    refreshExpiresAt: parseFlexibleExpiry(a['refreshTokenExpiresAt']),
    // 平台映射名:手机号一律由统一名单源 resolveRelayAccountName 裁定(键位含 phone 与
    // user.phone),这里**不再判一遍**(§0.6 单一真相源:两处判手机号必然漂移)。
    // 本字段只在拿不到手机号时作 platform-name 兜底,昵称仍压过载荷自带名。
    name: cstr(a['nickname']) || cstr(a['name']) || null,
    cosy: Object.keys(cosy).length > 0 ? cosy : null,
    // 会话模板:提取器 buildSessionTemplate 已剔凭证;此前这里不返回 ⇒ 模板在导入面被
    // 静默丢弃,池票永远 tpl=NULL,「登录本机」只能以客户端当前文件兜底 ⇒ 带旧号资料。
    // 空对象视同没有(否则会把既有模板覆盖成空)。
    ...(() => {
      const tpl = objField(a as Record<string, unknown>, 'sessionTemplate')
      return tpl && Object.keys(tpl).length > 0 ? { secrets: { sessionTemplate: tpl } } : {}
    })(),
  }
}

// =============================================================================
// 2026-10-27 扩容八平台导入映射(提取器 raw 直通 → 在此单一映射,§0.6)
// =============================================================================

/**
 * 映射必选平台的导入失败点名(§0.3:取不到就报原因,不静默)。
 *
 * 判据单源在 relay-account-format 的 RELAY_IMPORT_SHAPE_REASON —— 这里不再抄一份
 * 文案(Web 路由闸门 / CLI 预检 / 服务端逐条报错共用同一句人话,抄一份就分叉一次)。
 */

/** uid 退化哈希(对齐 codearts 的 auto: 前缀形态) */
function autoUid(seed: string): string {
  return `auto:${createHash('sha256').update(seed).digest('hex').slice(0, 32)}`
}

/**
 * 稳定键材料的唯一消毒口径(2026-11-06 Y-24 立):剥 NUL + 去首尾空白。
 * 与落库侧 `stripNulDeep` 同判据(键与值不得两套消毒,§0.6);`recordKey` 实测内嵌
 * leveldb 键分隔符 NUL,不消毒则"同一条记录两次导出算出两枚键"。
 */
function stableKeyMaterial(v: unknown): string {
  return cstr(v)
    .replace(/\u0000/g, '')
    .trim()
}

/**
 * 从票里取"账号级稳定标识"(2026-11-06 Y-24 立):只认声明名,**绝不把 token 本体当材料**。
 * 取不到 ⇒ 返回 ''(交回调用方,由它显式决定退化形态;本函数不冒充稳定)。
 */
function stableClaimUid(claims: Record<string, unknown> | null, names: readonly string[]): string {
  if (!claims) return ''
  for (const n of names) {
    const v = claims[n]
    const s =
      typeof v === 'string'
        ? stableKeyMaterial(v)
        : typeof v === 'number' && Number.isFinite(v)
          ? String(v)
          : ''
    if (s) return s.slice(0, 128)
  }
  return ''
}

/**
 * 递归剥除字符串里的 NUL 字节(PG text/jsonb 拒收 \u0000;leveldb 键名等本机
 * 取证材料常内嵌键分隔符,透传进 extra_metadata 前统一消毒,只去非法字节不改语义)。
 */
function stripNulDeep<T>(v: T, depth = 0): T {
  if (depth > 8) return v
  if (typeof v === 'string') return v.replace(/\u0000/g, '') as unknown as T
  if (Array.isArray(v)) return v.map((x) => stripNulDeep(x, depth + 1)) as unknown as T
  if (v !== null && typeof v === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      out[k] = stripNulDeep(val, depth + 1)
    }
    return out as unknown as T
  }
  return v
}

function objField(a: Record<string, unknown>, key: string): Record<string, unknown> | null {
  const v = a[key]
  return v !== null && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null
}

/** Codex:auth.json 的 tokens 对象直通(access_token/refresh_token/account_id) */
function mapCodexImport(acc: ImportAccountInput): {
  token: string
  refreshToken: string | null
  uid: string
  name: string | null
  expiresAt: Date | null
  secrets: Record<string, unknown>
} | null {
  const a = acc as Record<string, unknown>
  const tokens = objField(a, 'tokens')
  const { hits } = resolveRelayCredentialSlots(a, 'codex')
  const token = hits[0]?.value ?? ''
  if (!token) return null
  const accountId = cstr(tokens?.['account_id'])
  return {
    token,
    refreshToken: cstr(tokens?.['refresh_token']) || null,
    uid: accountId || autoUid(token),
    name: accountId ? `codex:${accountId.slice(0, 8)}` : null,
    // auth.json 无到期字段(90 天滑动+客户端自动刷新),不猜时刻 ⇒ null
    expiresAt: null,
    secrets: {
      authMode: cstr(a['authMode']) || null,
      accountId: accountId || null,
      idTokenPresent: Boolean(tokens?.['id_token']),
      lastRefresh: cstr(a['lastRefresh']) || null,
      fingerprint: cstr(a['fingerprint']) || null,
    },
  }
}

/** OpenCode:auth.json 每 provider 一条(type:"api" 用 key,"oauth" 用 access/refresh) */
function mapOpencodeImport(acc: ImportAccountInput): {
  token: string
  refreshToken: string | null
  uid: string
  name: string | null
  expiresAt: Date | null
  secrets: Record<string, unknown>
} | null {
  const a = acc as Record<string, unknown>
  const auth = objField(a, 'auth')
  const { hits } = resolveRelayCredentialSlots(a, 'opencode')
  const token = hits[0]?.value ?? ''
  if (!token) return null
  const providerID = cstr(a['providerID'])
  return {
    token,
    refreshToken: cstr(auth?.['refresh']) || null,
    uid: cstr(auth?.['accountId']) || autoUid(`${providerID}:${token}`),
    name: providerID ? `opencode:${providerID}` : null,
    expiresAt: parseFlexibleExpiry(auth?.['expires']),
    secrets: {
      providerID: providerID || null,
      authType: cstr(auth?.['type']) || null,
      enterpriseUrl: cstr(auth?.['enterpriseUrl']) || null,
      fingerprint: cstr(a['fingerprint']) || null,
    },
  }
}

/**
 * MiniMax 导入映射(2026-10-27 扩容;2026-11-06 Y-24 收稳定身份键)。
 *
 * 键源缺陷(主会话现读实证,dev 库 25 行 / 23 枚去重键):`minimax:cn` 一名占 3 行 3 枚 uid,
 * 而这 3 行的 `extra_metadata.recordKey` sha256 前 8 位同为 `95f3a1fe`,且等于本机
 * `~/.minimax/auth/prod/cn/mcode-public/auth.json` **当下**那条记录键(整键 sha 同为 `95f3a1fe`)
 * ⇒ 同一账号、同一记录键、三枚不同 uid,唯一变量就是票 ⇒ 旧口径把 token 混进 seed,
 * 换一次票就换一枚键,「同 provider+uid 覆盖」永远命中不到旧行,每重导出一次多留一行孤儿。
 * 现收口:键 = `minimax:record:<recordKey>` 的哈希,token 只进凭据列。
 * `recordKey` 是 mcode 客户端 `auth.json.records` 的映射键(账号级),`scripts/tests/local-login.test.mjs`
 * ⑤ 族用例已钉"按 recordKey 打补丁、其它记录不得被动" ⇒ 记录键与账号一一对应、不随票旋转。
 * 退化档:载荷没有 recordKey 时仍按 token 哈希(不硬造伪稳定键;该平台需补采集列已在册)。
 */
function mapMinimaxImport(acc: ImportAccountInput): {
  token: string
  refreshToken: string | null
  uid: string
  name: string | null
  expiresAt: Date | null
  secrets: Record<string, unknown>
} | null {
  const a = acc as Record<string, unknown>
  const { hits } = resolveRelayCredentialSlots(a, 'minimax')
  const token = hits[0]?.value ?? ''
  if (!token) return null
  const expMs = typeof a['expiresAtMs'] === 'number' ? (a['expiresAtMs'] as number) : null
  const region = cstr(a['region']) || null
  return {
    token,
    refreshToken: cstr(a['refreshToken']) || null,
    // Y-24:键源 = 账号级 recordKey,token 不进键(缺材料才回落 token 哈希)
    uid: (() => {
      const rk = stableKeyMaterial(a['recordKey'])
      return rk ? autoUid(`minimax:record:${rk}`) : autoUid(`minimax:${token}`)
    })(),
    name: `minimax${region ? `:${region}` : ''}`,
    expiresAt: expMs !== null && Number.isFinite(expMs) ? new Date(expMs) : null,
    secrets: {
      clientId: cstr(a['clientId']) || null,
      audience: cstr(a['audience']) || null,
      scopes: Array.isArray(a['scopes']) ? a['scopes'] : null,
      tokenType: cstr(a['tokenType']) || null,
      loginEpoch: cstr(a['loginEpoch']) || null,
      region,
      recordKey: cstr(a['recordKey']) || null,
      sourcePath: cstr(a['sourcePath']) || null,
      fingerprint: cstr(a['fingerprint']) || null,
    },
  }
}

/**
 * ZCode:credentials.json 扁平图直通,token 主选 oauth:bigmodel:access_token。
 *
 * 2026-11-06 Y-24 收稳定身份键:本机实提那枚票解出的 JWT 声明里带
 * `customer_id / user_id / username`(账号级),而 `oauth:bigmodel:user_info.id` 与
 * `customer_id` **同指纹**(同为 `c20d04f8`,两份互独立材料互相印证)⇒ 该 id 不是票派生量,
 * 换票不改。故 uid = 声明 `customer_id`(缺则 `user_id`);两者皆缺才回落 token 哈希。
 */
function mapZcodeImport(acc: ImportAccountInput): {
  token: string
  refreshToken: string | null
  uid: string
  name: string | null
  expiresAt: Date | null
  secrets: Record<string, unknown>
} | null {
  const a = acc as Record<string, unknown>
  const RESERVED = new Set(['region', 'regions', 'sourceRoot', 'sourcePath', 'fingerprint'])
  const { hits } = resolveRelayCredentialSlots(a, 'zcode')
  const token = hits[0]?.value ?? ''
  if (!token) return null
  const rawMap: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(a)) {
    if (!RESERVED.has(k)) rawMap[k] = v
  }
  const region = cstr(a['region']) || null
  return {
    token,
    refreshToken: null,
    // Y-24:键源 = 票内账号级声明,token 不进键(声明皆缺才回落 token 哈希)
    uid: stableClaimUid(parseJwtClaims(token), ['customer_id', 'user_id']) || autoUid(token),
    name: `zcode${region ? `:${region}` : ''}`,
    expiresAt: null,
    secrets: {
      credentialMap: rawMap,
      region,
      regions: Array.isArray(a['regions']) ? a['regions'] : null,
      sourcePath: cstr(a['sourcePath']) || null,
    },
  }
}

/** Loomy/豆包共用:会话条目 {source,key,host,value} → token=value */
function mapSessionEntryImport(
  providerCode: 'loomy' | 'doubao',
  providerLabel: string,
  acc: ImportAccountInput,
): {
  token: string
  refreshToken: string | null
  uid: string
  name: string | null
  expiresAt: Date | null
  secrets: Record<string, unknown>
} | null {
  const a = acc as Record<string, unknown>
  const { hits } = resolveRelayCredentialSlots(a, providerCode)
  const token = hits[0]?.value ?? ''
  if (!token) return null
  const key = cstr(a['key'])
  const source = cstr(a['source']) || providerCode
  /**
   * Y-24 收口(2026-11-06):这一支原本是 `autoUid(source:key:token)` —— 对豆包而言 token 就是
   * `sessionid` 一类的**会话票**,重登即轮换 ⇒ 换一次票换一枚键,「同 provider+uid 覆盖」命中不到
   * 旧行,每重导出一次多留一行孤儿(dev 库那 12 行的原始成因正是它)。
   * 改取账号级稳定标识:字节系 `uid_tt` / `uid_tt_ss` 承载用户 id(本机实提的会话族 12 票里就有,
   * 且席 A 一手量到"uid_tt 族值指纹登录期内不变")。载荷里没有这两枚 ⇒ 保持旧口径,
   * **不硬造伪稳定键**(退化档有锁,见 tests T9 ⑤)。
   */
  const cookieList = Array.isArray(a['cookies'])
    ? (a['cookies'] as Array<Record<string, unknown>>)
    : []
  const accountUid = (() => {
    for (const n of ['uid_tt', 'uid_tt_ss']) {
      const hit = cookieList.find((c) => stableKeyMaterial(c['name']) === n)
      const v = hit ? stableKeyMaterial(hit['value']) : ''
      if (v) return v
    }
    return ''
  })()
  return {
    token,
    refreshToken: null,
    uid: accountUid ? autoUid(`${source}:uid:${accountUid}`) : autoUid(`${source}:${key}:${token}`),
    name: key ? `${providerLabel}:${key}` : providerLabel,
    expiresAt: null,
    secrets: {
      entrySource: cstr(a['source']) || null,
      entryKey: key || null,
      host: cstr(a['host']) || null,
    },
  }
}

const mapLoomyImport = (acc: ImportAccountInput) => mapSessionEntryImport('loomy', 'loomy', acc)
const mapDoubaoImport = (acc: ImportAccountInput) => mapSessionEntryImport('doubao', 'doubao', acc)

/** 灵码:raw 凭证记录(字段级形状未实证,token 按常见键名探测,取不到如实 null) */
function mapLingmaImport(acc: ImportAccountInput): {
  token: string
  refreshToken: string | null
  uid: string
  name: string | null
  expiresAt: Date | null
  secrets: Record<string, unknown>
} | null {
  const a = acc as Record<string, unknown>
  const { hits } = resolveRelayCredentialSlots(a, 'lingma')
  const token = hits[0]?.value ?? ''
  if (!token) return null
  return {
    token,
    refreshToken: cstr(a['refreshToken']) || cstr(a['refresh_token']) || null,
    uid: cstr(a['uid']) || cstr(a['user_id']) || autoUid(token),
    name: cstr(a['name']) || cstr(a['user_name']) || null,
    expiresAt:
      parseFlexibleExpiry(a['expiresAt']) ??
      parseFlexibleExpiry(a['expires_at']) ??
      parseFlexibleExpiry(a['expiration']),
    secrets: a,
  }
}

/** GrokBot:凭证全为密封串 ⇒ 映射恒 null,导入在分派处按点名原因失败(不猜不解封) */
function mapGrokbotImport(_acc: ImportAccountInput): null {
  return null
}

/**
 * 平台导入映射的唯一分派(2026-11-06 抽出)。
 *
 * 内容 = 原 `importAccounts` 内联三元链的**逐字搬迁**(各映射函数语义一字未改),抽出只为
 * 让"落库口径的 uid"有一个可复用的入口:预检面(relay-account-import CLI / Web 预检)此前
 * 自己按 `extractUid(token)` 算 uid,而落库按本函数的 `mapped.uid` 算 ⇒ 同一份输入两个键,
 * 预检报的 uid 永远指不到将要被覆盖的那一行。收口 = 调用侧复用本函数 + `uidFromImportPayload`
 * (见 `resolveImportAccountUid`),**不动四个 `auto:` 生成点**、不改任何身份键的取值。
 */
function mapImportedAccount(providerCode: RelayProviderCode, acc: ImportAccountInput) {
  return providerCode === 'codearts'
    ? mapCodeartsImport(acc)
    : providerCode === 'qoder'
      ? mapQoderImport(acc)
      : providerCode === 'codex'
        ? mapCodexImport(acc)
        : providerCode === 'opencode'
          ? mapOpencodeImport(acc)
          : providerCode === 'minimax'
            ? mapMinimaxImport(acc)
            : providerCode === 'zcode'
              ? mapZcodeImport(acc)
              : providerCode === 'loomy'
                ? mapLoomyImport(acc)
                : providerCode === 'doubao'
                  ? mapDoubaoImport(acc)
                  : providerCode === 'lingma'
                    ? mapLingmaImport(acc)
                    : providerCode === 'grokbot'
                      ? mapGrokbotImport(acc)
                      : null
}

/**
 * 落库口径 uid 的唯一推导(与 `importAccounts` 循环内那一行同源,§0.6 不许有第二份)。
 * 优先级:平台映射 uid > 载荷显式 uid(归一化后)> `extractUid(token)` 兜底。
 */
function uidFromImportPayload(
  mapped: { uid: string } | null,
  fallbackAccountUid: unknown,
  token: string,
): string {
  return normalizeCredentialValue(mapped ? mapped.uid : fallbackAccountUid) ?? extractUid(token)
}

/**
 * 「这条载荷真导入后会落在哪个 uid 上」的只读出口(2026-11-06 立,预检↔落库键源收口)。
 *
 * 与 `importAccounts` 的取值路径逐步对齐:同一次 `normalizeForeignAccountShape` → 同一个
 * 形状闸门 → 同一个映射分派(`mapImportedAccount`)→ 同一句 uid 推导(`uidFromImportPayload`)。
 * 因此本函数返回的 uid **就是**入库行的 `(provider_code, uid)` 去重键,预检报出的键可以直接
 * 用于查/删/重导入命中同一行。
 *
 * 返回 null 的三种情形(与落库侧的"这条根本不会写行"一一对应,§0.3 不猜):
 * - 形状闸门不通过(平台认不出 / 无明文凭据);
 * - 归一化后 token 为空;
 * - 入参不是对象形状。
 * 本函数零 IO、零写库:只算键,不碰数据。
 */
export function resolveImportAccountUid(
  providerCode: RelayProviderCode,
  account: ImportAccountInput,
): string | null {
  if (account === null || typeof account !== 'object' || Array.isArray(account)) return null
  const acc = normalizeForeignAccountShape(account) as ImportAccountInput
  if (!recognizeImportShape(providerCode, acc).importable) return null
  const mapped = mapImportedAccount(providerCode, acc)
  const token = normalizeCredentialValue(mapped ? mapped.token : acc.token) ?? ''
  if (!token) return null
  return uidFromImportPayload(mapped, acc.uid, token)
}

/** 预检逐行 uid 探针(零 IO;`duplicateOf` 口径与 importAccounts 的 seenInBatch 一致) */
export interface ImportUidProbe {
  index: number
  /** 落库口径 uid;null = 这条根本不会写行(形状闸门不过 / 归一化后无明文 token) */
  uid: string | null
  /** 批内已有同 uid 首条时点名其下标(= 落库时会以「批次内重复 uid(以首条为准)」跳过) */
  duplicateOf: number | null
}

/**
 * 一批载荷的落库口径 uid 探针(2026-11-06 立;预检面的唯一出口)。
 * 逐行只算键、不查库、不写库 ⇒ 预检可以零副作用地报出"真导入后落在哪一行"。
 */
export function resolveImportAccountUidProbe(
  providerCode: RelayProviderCode,
  accounts: readonly ImportAccountInput[],
): ImportUidProbe[] {
  const firstIndexByUid = new Map<string, number>()
  const probes: ImportUidProbe[] = []
  for (let index = 0; index < accounts.length; index++) {
    const account = accounts[index]
    const uid =
      account !== null && typeof account === 'object' && !Array.isArray(account)
        ? resolveImportAccountUid(providerCode, account)
        : null
    let duplicateOf: number | null = null
    if (uid === null) {
      // 取不到键 = 未判定,不冒充"不重复"
    } else if (firstIndexByUid.has(uid)) {
      duplicateOf = firstIndexByUid.get(uid) ?? null
    } else {
      firstIndexByUid.set(uid, index)
    }
    probes.push({ index, uid, duplicateOf })
  }
  return probes
}

// =============================================================================
// 设备指纹碰撞报告(O72@2026-10-28;判据纯函数,测试经 __test__ 直用生产实现)
// =============================================================================

interface DeviceRowRef {
  uid: string
  deviceId: string | null
}

/**
 * 按 (deviceId) 分组点名碰撞:同一 deviceId 下出现 ≥2 个不同 uid 即碰撞。
 * - deviceId 为空/纯空白 ⇒ 不参与(无设备材料的行不构成同设备证据);
 * - uid 天然按行去重((providerCode, uid) 是本表去重键,批内+池面两路行集合并后
 *   同一 uid 出现多次只算一枚);
 * - 输出按 deviceId、uids 双升序,报告形态确定可测。
 */
function computeDeviceCollisions(
  rows: ReadonlyArray<DeviceRowRef>,
): Array<{ deviceId: string; uids: string[] }> {
  const byDevice = new Map<string, Set<string>>()
  for (const r of rows) {
    const d = typeof r.deviceId === 'string' ? r.deviceId.trim() : ''
    if (!d) continue
    let set = byDevice.get(d)
    if (!set) {
      set = new Set<string>()
      byDevice.set(d, set)
    }
    set.add(r.uid)
  }
  const out: Array<{ deviceId: string; uids: string[] }> = []
  for (const [deviceId, uidSet] of byDevice) {
    if (uidSet.size > 1) out.push({ deviceId, uids: [...uidSet].sort() })
  }
  return out.sort((a, b) => (a.deviceId < b.deviceId ? -1 : a.deviceId > b.deviceId ? 1 : 0))
}

export const __test__ = { computeDeviceCollisions, mapQoderImport }

// =============================================================================
// 批量导入
// =============================================================================

/**
 * 批量导入账号(幂等:同一归属内 (providerCode, uid) 再导入 = 覆盖凭证 + 重置健康状态)。
 * ownerUserId 缺省/null = 运营池(存量行为零变化);非 null = 该平台用户的个人号池。
 * 逐条独立 try/catch,一条坏不影响整批。
 *
 * options.preserveMissingRefresh(2026-10-27 立):覆盖时若本批没带 refreshToken,保留
 * 库内既有密文而不是写 NULL —— 给"网页一键重登"用(重登只换得到 access,老语义会
 * 把能自续的号抹成待重登死号)。缺省 false = 存量导入语义不变。
 */
export async function importAccounts(
  providerCode: RelayProviderCode,
  accounts: ImportAccountInput[],
  ownerUserId: string | null = null,
  options: ImportAccountsOptions = {},
): Promise<ImportBatchResult> {
  const result: ImportBatchResult = {
    providerCode,
    total: accounts.length,
    imported: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    items: [],
  }
  const seenInBatch = new Set<string>()
  // O64:签到推送载荷收集(明文凭证仅本进程内传递,循环结束后一次性推送)
  const checkinPush: PoolSyncAccount[] = []
  // O72:本批落库行的设备材料收集(uid 是 (providerCode,uid) 去重键,可直接当行标识)
  const writtenDeviceRows: Array<{ uid: string; deviceId: string | null }> = []

  /**
   * 结果项装配的唯一出口:命名归因三键恒与该行的 naming 判定同源带出,
   * 免得七处 push 各抄一遍、抄漏一处就把"退化了"报成"没退化"。
   */
  const pushItem = (
    naming: RelayAccountNameDecision,
    item: Omit<ImportItemResult, 'nameSource' | 'nameFallback' | 'nameFallbackReason'>,
  ): void => {
    result.items.push({
      ...item,
      nameSource: naming.source,
      nameFallback: naming.fallback,
      nameFallbackReason: naming.fallbackReason,
    })
  }

  for (let i = 0; i < accounts.length; i++) {
    // 外来格式自适应(判据单源 relay-account-format,与 validateAccountExport 同一函数):
    // workbuddy-switch 等第三方导出(access_token/expires_at 等)在这里归一成规范形状;
    // 我方原生形状(token 在场)原样通过。
    const acc = normalizeForeignAccountShape(accounts[i] ?? {}) as ImportAccountInput
    // 统一名 = 官方绑定手机号(O66)。判定单源 resolveRelayAccountName(与 CLI 预检
    // validateAccountExport 同一函数,改前两侧是两份各写各的链)。这里先按「载荷 + 无票内
    // 候选」定一次名(形状闸门/凭据闸门失败时也要报得出名字与退化归因),取到 token 之后再
    // 带票内手机号候选与平台映射名复算一次。
    let naming = resolveRelayAccountName({ providerCode, payload: acc, index: i })
    let displayName = naming.name
    try {
      // 形状闸门(单源判据 relay-account-format.recognizeImportShape):只有本仓认得的
      // 平台形状才放行;认不出就整条拒掉并点名缺哪个键 —— 绝不静默丢弃,也绝不把
      // 认不出的东西塞成"无效账号"进库(Web 路由闸门 / CLI 预检共用同一判据)。
      const shape = recognizeImportShape(providerCode, acc)
      if (!shape.importable) {
        result.failed++
        pushItem(naming, {
          index: i,
          name: displayName,
          uid: null,
          status: 'failed',
          reason: shape.reason ?? `${providerCode} 导入缺少 token`,
        })
        continue
      }
      // 非 JWT 平台映射分支:CodeArts(2026-10-22)STS 凭据包 / Qoder(2026-10-23)
      // opaque token 会话 / 2026-10-27 扩容八平台(codex/opencode/minimax/zcode/
      // loomy/doubao/lingma/grokbot)。各格式的 uid/expiresAt 都在映射层显式解析,
      // 不透传则退化为哈希 uid + 无过期时刻。
      // 2026-11-06 分派链抽出到 mapImportedAccount(逐字搬迁,语义不变):预检面经
      // resolveImportAccountUid 复用同一枚,杜绝"预检 uid ≠ 入库 uid"两套键源。
      const mapped = mapImportedAccount(providerCode, acc)
      // Trae 设备材料独立成档:只写 secretsEnc,不接管 token/refreshToken/uid 的取值路径
      const traeSecrets = providerCode === 'trae' ? mapTraeImport(acc) : null
      // 入口归一化:从 JSON 整段复制的粘贴值会带包裹引号,上游按前缀校验 ⇒ 一个多余字符
      // 就令号池自刷新与每日签到同时失败(dev 实测 `"drt-…` 那枚,详见 normalizeCredentialValue 头注)
      const token = normalizeCredentialValue(mapped ? mapped.token : acc.token) ?? ''
      // ── 统一名复算(手机号优先,O66)──
      // 三份输入齐了才能定名:载荷(phone 键位表 + 载荷名)、平台映射名(mapped.name)、
      // 票内手机号候选(JWT preferred_username:WorkBuddy 的官方绑定手机号全号住在这里,
      // 不在载荷字段上)。形态判据一律交还单源 resolveRelayAccountName,本处不再各判一遍
      // (§0.6;改前这里只有 qoder 走 phone、workbuddy 走票内声明,其余 9 个平台从未看过 phone)。
      const prefClaim = token ? parseJwtClaims(token)?.['preferred_username'] : undefined
      naming = resolveRelayAccountName({
        providerCode,
        payload: acc,
        index: i,
        platformName: mapped?.name ?? null,
        extraPhoneCandidates: [typeof prefClaim === 'string' ? prefClaim : null],
      })
      displayName = naming.name
      if (!token) {
        result.failed++
        pushItem(naming, {
          index: i,
          name: displayName,
          uid: null,
          status: 'failed',
          reason: `${providerCode} 的凭据归一后为空(剥掉包裹引号/空白后没有内容)`,
        })
        continue
      }
      const refreshToken = normalizeCredentialValue(mapped ? mapped.refreshToken : acc.refreshToken)
      // uid 取值单源 uidFromImportPayload(2026-11-06 抽出;预检面 resolveImportAccountUid
      // 走同一句 ⇒ "预检报的键"与"入库落地的键"从此是同一枚)
      const uid = uidFromImportPayload(mapped, acc.uid, token)
      const shapeIssue = credentialShapeIssue(providerCode, { refreshToken })
      if (shapeIssue) {
        result.failed++
        pushItem(naming, {
          index: i,
          name: displayName,
          uid,
          status: 'failed',
          reason: shapeIssue,
        })
        continue
      }
      if (seenInBatch.has(uid)) {
        result.skipped++
        pushItem(naming, {
          index: i,
          name: displayName,
          uid,
          status: 'skipped',
          reason: '批次内重复 uid(以首条为准)',
        })
        continue
      }
      seenInBatch.add(uid)

      // 到期时刻:平台映射优先 → JWT exp → 显式 expiresAt(归一化已折成 ISO;
      // 非 JWT 平台或 claims 无 exp 时不至于留 NULL 让临期刷新失明)
      const tokenExpiresAt =
        (mapped ? mapped.expiresAt : null) ??
        extractTokenExpiry(token) ??
        parseFlexibleExpiry(acc.expiresAt)
      const now = new Date()
      const expired = tokenExpiresAt !== null && tokenExpiresAt <= now

      // 既有行先查出来:覆盖语义(保不保留旧 refreshToken)与"过期是否摘除"都依赖它
      const existing = await db
        .select({
          id: aiRelayAccountPool.id,
          hasRefreshToken: sql<boolean>`${aiRelayAccountPool.refreshTokenEnc} is not null`,
          secretsEnc: aiRelayAccountPool.secretsEnc,
        })
        .from(aiRelayAccountPool)
        .where(
          and(
            ownerUserId === null
              ? isNull(aiRelayAccountPool.ownerUserId)
              : eq(aiRelayAccountPool.ownerUserId, ownerUserId),
            eq(aiRelayAccountPool.providerCode, providerCode),
            eq(aiRelayAccountPool.uid, uid),
          ),
        )
        .limit(1)
      // 既有 secrets 解出(模板三键保留判据用;坏密文/密钥轮换 ⇒ 当作无既有 secrets,本次提供的照写)
      let existingSecrets: Record<string, unknown> | null = null
      if (existing[0]?.secretsEnc) {
        try {
          const parsed = JSON.parse(decryptField(existing[0].secretsEnc))
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            existingSecrets = parsed as Record<string, unknown>
          }
        } catch {
          /* 非法 secrets → 视为空 */
        }
      }
      // 一键重登只换 access:本批未带 refreshToken 时按开关保留旧票(判据单源在 format)
      const overwriteRefresh = resolveOverwriteRefresh({
        providerCode,
        incomingRefreshToken: refreshToken,
        existingHasRefreshToken: existing[0]?.hasRefreshToken === true,
        preserveMissingRefresh: options.preserveMissingRefresh === true,
      })

      // 过期且无续期凭证 → 入库但摘除(诚实标记,不冒充可用)。
      // 留住旧票的覆盖不算"无续期凭证",否则重登反而把能自续的号摘掉。
      const hasUsableRefresh = refreshToken !== null || overwriteRefresh.preserve
      const down = expired && !hasUsableRefresh
      const healthStatus = down ? 'down' : 'unknown'

      const cookies = Array.isArray(acc.cookies) ? acc.cookies : []
      // 账号级代理:明文只用于签到侧推送载荷,落库一律 encryptField 加密
      const proxyUrlPlain =
        typeof acc.proxyUrl === 'string' && acc.proxyUrl.trim() ? acc.proxyUrl.trim() : null
      const extra: Record<string, unknown> = {}
      const tenantId = providerCode === 'trae' ? extractTenantId(token) : null
      if (tenantId) extra.tenantId = tenantId
      if (providerCode === 'qoder') {
        // Qoder:Cosy 设备头族(导入时随账号带上,adapter 刷新/健康检查用)与
        // refreshToken 到期时刻(调度器判断"能否自救刷新"的参考)
        const q = mapped as QoderImportMapping | null
        if (q?.cosy) extra.cosy = q.cosy
        if (q?.refreshExpiresAt) extra.refreshTokenExpiresAt = q.refreshExpiresAt.toISOString()
      }
      if (cookies.length > 0) extra.cookieCount = cookies.length
      const cookieEarliest = earliestCookieExpiry(cookies)
      if (cookieEarliest !== null)
        extra.cookieEarliestExpiry = new Date(cookieEarliest).toISOString()
      if (expired) extra.importedExpired = true
      // 未知字段原样透传(兑现 RELAY_ACCOUNT_IMPORT_FORMAT.md §2 承诺;此前服务端
      // 并没有真做透传 ⇒ 外来格式的 payment_type/checkin_streak 等平台侧键会整枚丢失)。
      // canonical/别名集之外的键一律进 extraMetadata,单源判据见 foreignPassthroughMetadata。
      // NUL 消毒(2026-10-27 实弹:MiniMax recordKey 内嵌 leveldb 键分隔符 \u0000,
      // PG text/jsonb 拒收 NUL ⇒ 透传值里所有字符串统一剥除,不改语义只去非法字节)。
      Object.assign(extra, stripNulDeep(foreignPassthroughMetadata(acc)))
      // 掩码待补全标记(2026-10-28 立):Trae 会话协议只下发脱敏号(前3后2),导入后
      // 统一名可能仍是掩码形态 ⇒ 落 extraMetadata.phoneMask 供管理面识别"待补全"、
      // complete-phone 归位校验与 match-phone 批量匹配。补全成功后该键被折成
      // {original, completedAt, via};以全号重导入则整键消失(待补全态自然解除)。
      const nameMask = detectPhoneMask(displayName)
      if (nameMask) extra.phoneMask = { ...nameMask, detectedAt: new Date().toISOString() }

      // 平台映射(目前仅 qoder)优先;其余平台认账号对象上的 refreshTokenExpiresAt
      // (Trae 提取器已写入,2026-10-24:此前只有 qoder 分支会落这一列 ⇒ trae 恒 NULL)
      const incomingRefreshExpiresAt =
        mapped && 'refreshExpiresAt' in mapped
          ? mapped.refreshExpiresAt
          : parseFlexibleExpiry(acc['refreshTokenExpiresAt'])

      // 本次导入的 secrets 图(口径与 gate 一致:mapped.secrets 优先,trae 设备材料独立成档)
      const incomingSecrets: Record<string, unknown> | null =
        mapped && 'secrets' in mapped
          ? (mapped.secrets as Record<string, unknown>)
          : traeSecrets
            ? traeSecrets.secrets
            : null
      // 模板三键保留(2026-10-28,HEAD mergeSecrets 对这三键语义的最小恢复):secretsEnc 同时装
      // 凭据图与会话模板三键(sessionTemplate/sealedPaths/edition —— worker cron 每 10 分钟经
      // relay-workbuddy-session-sync 回灌,「登录本机」relay-local-login 唯一消费面)。导入载荷
      // 通常只带凭证 ⇒ 整列覆盖会把三键抹掉。判据:以既有为底,仅当本批 secrets 图显式提供
      // 非空值才覆盖这三键;本批不带任何 secrets ⇒ 该列不动(等价 HEAD 的 undefined 语义)。
      let secretsEncOut: string | null | undefined
      if (incomingSecrets) {
        // 以既有为底(2026-10-29 修):原写法是"只以本批为底 + 回填三键",于是本批带模板时
        // 会把既有的设备材料二键整对抹掉 —— 换票链当场失去签名材料。既有为底 + 本批非空才
        // 覆盖,既保住"本批带什么就写什么",也保住"本批没带的材料不被清空"。
        const merged: Record<string, unknown> = { ...existingSecrets }
        for (const [k, v] of Object.entries(incomingSecrets)) {
          if (v === null || v === undefined) continue
          if (typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0) continue
          merged[k] = v
        }
        secretsEncOut = encryptField(JSON.stringify(merged))
      } else if (existingSecrets) {
        secretsEncOut = undefined
      } else {
        secretsEncOut = null
      }

      const values = {
        ownerUserId,
        providerCode,
        uid,
        name: displayName.slice(0, 128),
        tokenEnc: encryptField(token),
        refreshTokenEnc: refreshToken ? encryptField(refreshToken) : null,
        cookiesEnc: cookies.length > 0 ? encryptField(JSON.stringify(cookies)) : null,
        secretsEnc: secretsEncOut,
        deviceId:
          typeof acc.deviceId === 'string' && acc.deviceId ? acc.deviceId.slice(0, 128) : null,
        machineId:
          typeof acc.machineId === 'string' && acc.machineId ? acc.machineId.slice(0, 128) : null,
        tokenExpiresAt,
        refreshExpiresAt: incomingRefreshExpiresAt,
        isEnabled: acc.enabled === false ? false : true,
        tempUnschedulable: down,
        healthStatus,
        lastErrorMessage: down ? '导入时 access token 已过期且无 refreshToken' : null,
        refreshFailureCount: 0,
        consecutiveFailures: 0,
        proxyUrl: encryptAccountProxyUrl(proxyUrlPlain),
        extraMetadata: extra,
        updatedAt: new Date(),
      }

      // O64:凭证写入即 cred_version 变化 —— insert 显式 1;覆盖走 SQL 原子自增
      // (+1 = 签到侧 pool_cred_version 防降级的 CAS 基准,杜绝并发覆盖版本撞车)。
      // returning 取新版本号,供签到推送载荷携带。
      const cosyPayload = extractCosy(extra)
      let writtenId: string
      let writtenCredVersion: number
      if (existing.length > 0 && existing[0]) {
        // preserve ⇒ 省略 refreshTokenEnc(该列保持原值)。refreshExpiresAt 与 name 同理:
        // 只有「本批确实带来新信息」才写 —— 网页重登只换得到 access,载荷带不到 refresh
        // 到期时刻,名字也只能回退成 uid;整列覆盖会把这些元数据抹成 NULL / uid
        // (2026-10-27 真机实证:2027-04-07 被写成 NULL、展示名退成 uid)。
        const {
          refreshTokenEnc: _keptRefreshTokenEnc,
          refreshExpiresAt: incomingExpiryColumn,
          name: incomingNameColumn,
          ...valuesWithoutRefresh
        } = values
        void _keptRefreshTokenEnc
        // 只有「本批确实带来权威名」才覆盖 name 列:手机号(O66 统一名)或载荷自带名。
        // 退化成平台映射名/#序号 的那一批不写,免得网页重登把库里已有的统一名抹成 `#1`
        // (2026-10-27 真机实证:展示名退成 uid)。
        const nameIsAuthoritative = naming.source === 'phone' || naming.source === 'payload-name'
        const overwriteValues = overwriteRefresh.preserve
          ? {
              ...valuesWithoutRefresh,
              ...(incomingExpiryColumn === null ? {} : { refreshExpiresAt: incomingExpiryColumn }),
              ...(nameIsAuthoritative && displayName !== uid ? { name: incomingNameColumn } : {}),
            }
          : values
        const [written] = await db
          .update(aiRelayAccountPool)
          .set({
            ...overwriteValues,
            credVersion: sql`${aiRelayAccountPool.credVersion} + 1`,
          })
          .where(eq(aiRelayAccountPool.id, existing[0].id))
          .returning({
            id: aiRelayAccountPool.id,
            credVersion: aiRelayAccountPool.credVersion,
          })
        if (!written) throw new Error('覆盖凭证后未取到回写行(id/credVersion)')
        writtenId = written.id
        writtenCredVersion = written.credVersion
        result.updated++
        pushItem(naming, {
          index: i,
          name: displayName,
          uid,
          status: 'updated',
          reason: down
            ? '已覆盖凭证;token 过期且无 refreshToken,已摘除'
            : overwriteRefresh.note
              ? `已覆盖凭证并重置健康状态(${overwriteRefresh.note})`
              : '已覆盖凭证并重置健康状态',
        })
      } else {
        const [written] = await db
          .insert(aiRelayAccountPool)
          .values({ ...values, credVersion: 1 })
          .returning({
            id: aiRelayAccountPool.id,
            credVersion: aiRelayAccountPool.credVersion,
          })
        if (!written) throw new Error('插入后未取到回写行(id/credVersion)')
        writtenId = written.id
        writtenCredVersion = written.credVersion
        result.imported++
        pushItem(naming, {
          index: i,
          name: displayName,
          uid,
          status: 'imported',
          reason: down ? 'token 已过期且无 refreshToken,入库即摘除' : null,
        })
      }
      writtenDeviceRows.push({ uid, deviceId: values.deviceId })
      checkinPush.push(
        buildPoolSyncAccount({
          id: writtenId,
          ownerUserId,
          uid,
          name: displayName.slice(0, 128),
          token,
          refreshToken,
          credVersion: writtenCredVersion,
          enabled: values.isEnabled,
          proxyUrl: proxyUrlPlain,
          deviceId: values.deviceId,
          machineId: values.machineId,
          cosy: cosyPayload,
          tokenExpiresAt,
        }),
      )
    } catch (e) {
      result.failed++
      pushItem(naming, {
        index: i,
        name: displayName,
        uid: null,
        status: 'failed',
        reason: e instanceof Error ? e.message.slice(0, 200) : '未知错误',
      })
    }
  }
  // O64:导入/覆盖即推送签到侧(号池 = 凭证权威 → 签到副本)。推送失败绝不阻塞导入:
  // 整批失败全落 pending;部分失败按 poolAccountId 精确落;由重推器/对账收敛器清偿。
  /**
   * 落「已同步」徽章 = `ai_relay_account_pool.extra_metadata->'checkinSync'`。
   *
   * 这是 admin 号池页「签到同步徽章」的唯一数据源(routes/admin/relay-account-pool.ts:416
   * 的 `checkinSync: sql(...-> 'checkinSync')`)。此前**只有失败分支**写
   * markCheckinSyncPending ⇒ 推送成功的行上根本没有 checkinSync 键;而对账收敛器
   * (relay-account-pool-reconcile.ts)只在"签到侧缺行 / pool_cred_version 落后"时才补推
   * 并 clearCheckinSyncPending,两侧一致时它不动 ⇒ 没有任何一处会写成功态 ⇒ 徽章恒空。
   * 所以成功也必须落一次 {pending:false, lastSyncedAt, attempts:0}。
   *
   * 2026-11-01 实测实证:本机 qoder 号 uid `01a191f4-8dc3-75db-831b-4ef5c2dedd4a` 走自动
   * 入池进本函数,签到侧 `checkin_accounts.id=15` 已存在且 pool_cred_version 与号池
   * cred_version 一致,但号池行 extra_metadata 只有
   * `{cosy,version,machineCode,machineType,machineToken,refreshTokenExpiresAt}` —— 没有
   * checkinSync,admin 页显示不出同步态。
   *
   * fail-open:徽章只是可观测性,单次 UPDATE 失败只告警,绝不让导入结果变成失败。
   */
  const markCheckinSynced = async (ids: string[]): Promise<void> => {
    if (ids.length === 0) return
    try {
      await clearCheckinSyncPending(ids)
    } catch (e) {
      logger.warn('[account-pool] 导入后写 checkinSync 同步态失败(徽章缺失,不影响导入)', {
        count: ids.length,
        error: e instanceof Error ? e.message : String(e),
      })
    }
  }
  const checkinPlatform = checkinPlatformFor(providerCode)
  if (checkinPush.length === 0) {
    result.checkinSync = { pushed: 0, skipped: 0, pending: 0, error: null }
  } else if (!checkinPlatform) {
    // 平台无签到引擎(如 codearts):如实计 skipped,不推送、不落 pending、也不写徽章
    result.checkinSync = { pushed: 0, skipped: checkinPush.length, pending: 0, error: null }
  } else {
    const push = await pushPoolSync(checkinPlatform, checkinPush)
    if (push.ok) {
      result.checkinSync = {
        pushed: push.pushed,
        skipped: push.skipped,
        pending: 0,
        error: push.error,
      }
      // 全批算已同步:skipped 的是上游按幂等跳过(pool_cred_version 未变),签到侧已有同版本。
      await markCheckinSynced(checkinPush.map((a) => a.poolAccountId))
    } else {
      const failedIdSet = new Set(push.failedIds)
      const pendingIds =
        push.failedIds.length > 0
          ? checkinPush.filter((a) => failedIdSet.has(a.poolAccountId)).map((a) => a.poolAccountId)
          : checkinPush.map((a) => a.poolAccountId)
      // 非本条目责任的失败仍算已同步:failedIds 为空(整批 HTTP 失败)时全批 pending,一条不 clear。
      const syncedIds =
        push.failedIds.length > 0
          ? checkinPush.filter((a) => !failedIdSet.has(a.poolAccountId)).map((a) => a.poolAccountId)
          : []
      await markCheckinSynced(syncedIds)
      await markCheckinSyncPending(pendingIds, 'cred', null, push.error ?? '未知错误')
      result.checkinSync = {
        pushed: push.pushed,
        skipped: push.skipped,
        pending: pendingIds.length,
        error: push.error,
      }
    }
  }
  // O72 设备指纹碰撞报告(只报告不改写;报告失败绝不阻塞导入本身):
  // 本批落库行 + 同池(providerCode/归属一致)既有行一并核对 (deviceId) 分组,
  // 点名"从同一真实客户端导出 N 号 ⇒ N 行共用一枚 device_id"的跨账号关联暴露面。
  const batchDeviceIds = [
    ...new Set(
      writtenDeviceRows
        .map((r) => (typeof r.deviceId === 'string' ? r.deviceId.trim() : ''))
        .filter((d) => d !== ''),
    ),
  ]
  if (batchDeviceIds.length === 0) {
    result.deviceCollisionScope = 'none'
    result.deviceCollisions = []
  } else {
    const merged: Array<{ uid: string; deviceId: string | null }> = [...writtenDeviceRows]
    try {
      const poolRows = await dbRead
        .select({ uid: aiRelayAccountPool.uid, deviceId: aiRelayAccountPool.deviceId })
        .from(aiRelayAccountPool)
        .where(
          and(
            ownerUserId === null
              ? isNull(aiRelayAccountPool.ownerUserId)
              : eq(aiRelayAccountPool.ownerUserId, ownerUserId),
            eq(aiRelayAccountPool.providerCode, providerCode),
            inArray(aiRelayAccountPool.deviceId, batchDeviceIds),
          ),
        )
      for (const row of poolRows) {
        if (typeof row.uid === 'string' && row.uid) {
          merged.push({ uid: row.uid, deviceId: row.deviceId ?? null })
        }
      }
      result.deviceCollisionScope = 'checked'
    } catch {
      // 池面查询失败 ⇒ 只报了本批内部,池面维度如实落 unjudged(§0.3 不记绿)
      result.deviceCollisionScope = 'unjudged'
    }
    result.deviceCollisions = computeDeviceCollisions(merged)
  }
  return result
}

// =============================================================================
// 手机号补全(2026-10-28 立:号池统一名 = 官方绑定手机号全号)
// =============================================================================
//
// 立因:Trae 会话协议只下发脱敏号(前3后2,如 180******69),掩码名曾直接当池内
// 统一名,补全只能靠手写 SQL —— 产品层没有功能。本节把补全做成正式能力:
// - completeAccountPhone:单账号人工补全(掩码吻合校验防归位错号);
// - matchPhoneCandidates:批量候选号自动匹配(前3后2 唯一命中才改名,歧义挂起待人工);
// - 改名一律经 applyPhoneCompletion:落名 + phoneMask 归档 + cred_version 前进 +
//   签到副本传播(改名不 bump 版本会被签到侧防降级 CAS 吞掉,传播永远失效)。

/** 补全结果码(调用方按码映射 HTTP:not_found=404,invalid_phone/mask_mismatch=400,already_full=409) */
export type CompletePhoneCode =
  'ok' | 'not_found' | 'invalid_phone' | 'mask_mismatch' | 'already_full'

/** 补全后签到传播结果(pending=true ⇒ 已落待推,由重推器/对账收敛器清偿) */
export interface CheckinSyncOutcome {
  pushed: number
  pending: boolean
  error: string | null
}

export interface CompletePhoneResult {
  code: CompletePhoneCode
  message: string | null
  id: string | null
  oldName: string | null
  name: string | null
  changed: boolean
  checkinSync: CheckinSyncOutcome
}

const NO_SYNC: CheckinSyncOutcome = { pushed: 0, pending: false, error: null }

function failPhone(code: Exclude<CompletePhoneCode, 'ok'>, message: string): CompletePhoneResult {
  return {
    code,
    message,
    id: null,
    oldName: null,
    name: null,
    changed: false,
    checkinSync: NO_SYNC,
  }
}

/**
 * 落名 + 归档 + 传播(单账号)。extraMetadata 走 jsonb || 合并,checkinSync 等
 * 其它键原样保留;phoneMask 折成 {original, completedAt, via} 留补全痕迹。
 */
async function applyPhoneCompletion(
  row: AiRelayAccountPool,
  phone: string,
  via: 'manual' | 'match' | 'owner_override',
): Promise<CompletePhoneResult> {
  const oldName = row.name ?? ''
  const maskShape = detectPhoneMask(oldName)
  const newName = phone.slice(0, 128)
  const [written] = await db
    .update(aiRelayAccountPool)
    .set({
      name: newName,
      credVersion: sql`${aiRelayAccountPool.credVersion} + 1`,
      extraMetadata: sql`coalesce(${aiRelayAccountPool.extraMetadata}, '{}'::jsonb) || jsonb_build_object(
        'phoneMask', jsonb_build_object(
          'original', ${maskShape ? maskShape.mask : null}::text,
          'completedAt', ${new Date().toISOString()}::text,
          'via', ${via}::text
        )
      )`,
      updatedAt: new Date(),
    })
    .where(eq(aiRelayAccountPool.id, row.id))
    .returning({ id: aiRelayAccountPool.id, credVersion: aiRelayAccountPool.credVersion })
  if (!written) {
    return { ...failPhone('not_found', '账号不存在或已被删除'), oldName, name: newName }
  }
  // 签到传播(旁路,失败不阻塞改名):凭证未动,载荷 = 库内现值解密重建 + 新名 + 新版本。
  const checkinSync: CheckinSyncOutcome = { pushed: 0, pending: false, error: null }
  const platform = checkinPlatformFor(row.providerCode)
  if (platform) {
    try {
      const credentials = decryptAccountCredentials(row)
      const acc = buildPoolSyncAccount({
        id: row.id,
        ownerUserId: row.ownerUserId,
        uid: row.uid ?? '',
        name: newName,
        token: credentials.token,
        refreshToken: credentials.refreshToken,
        credVersion: written.credVersion,
        enabled: row.isEnabled,
        proxyUrl: resolveAccountProxyUrl(row.proxyUrl),
        deviceId: row.deviceId,
        machineId: row.machineId,
        cosy: extractCosy(row.extraMetadata),
        deviceKeyPem: pemFromSecrets(credentials.secrets, 'deviceKeyPem'),
        devicePubPem: pemFromSecrets(credentials.secrets, 'devicePubPem'),
        tokenExpiresAt: row.tokenExpiresAt,
      })
      const push = await pushPoolSync(platform, [acc])
      if (push.ok && push.failed === 0) {
        checkinSync.pushed = push.pushed
        // 与 importAccounts 同口径:成功也落 checkinSync 徽章(pending:false + lastSyncedAt),
        // 否则 admin 号池页的签到同步态只会在走完一次 pending 流程后才可见。
        await clearCheckinSyncPending([row.id])
      } else {
        checkinSync.error = push.error
        try {
          await markCheckinSyncPending([row.id], 'cred', null, push.error ?? '补全后签到推送失败')
          checkinSync.pending = true
        } catch {
          /* pending 落库失败只意味着少一条待推痕迹,对账收敛器兜底 */
        }
      }
    } catch (e) {
      checkinSync.error = e instanceof Error ? e.message.slice(0, 200) : '签到同步异常'
    }
  }
  return {
    code: 'ok',
    message: null,
    id: row.id,
    oldName,
    name: newName,
    changed: true,
    checkinSync,
  }
}

/**
 * 单账号人工补全手机号。
 * 校验链:全号形态 → 行存在 → 掩码归位吻合(现名是掩码时)→ 现名已是全号则拒绝换号。
 * 现名是昵称/占位(非掩码非全号)允许直接落成全号 —— 统一命名规约本就要求全号。
 * opts.force=true 只放开掩码吻合闸门(机主换绑场景:掩码是旧绑定号,新全号对不上);
 * already_full/幂等分支不受 force 影响(现名已是全号仍须重导入,防误覆盖活号)。
 * force 调用应配 via='owner_override',归档的 phoneMask.via 留运维痕迹。
 */
export async function completeAccountPhone(
  accountId: string,
  phone: string,
  via: 'manual' | 'match' | 'owner_override' = 'manual',
  opts?: { force?: boolean },
): Promise<CompletePhoneResult> {
  const p = phone.trim()
  if (!isFullPhone(p)) {
    return failPhone(
      'invalid_phone',
      '手机号必须是 11 位大陆全号(1[3-9] 开头),掩码形态请走 match-phone',
    )
  }
  const [row] = await dbRead
    .select()
    .from(aiRelayAccountPool)
    .where(eq(aiRelayAccountPool.id, accountId))
    .limit(1)
  if (!row) return failPhone('not_found', '账号不存在')
  const oldName = row.name ?? ''
  const maskShape = detectPhoneMask(oldName)
  if (!opts?.force && maskShape && !phoneMatchesMask(p, maskShape)) {
    return failPhone(
      'mask_mismatch',
      `与池内掩码 ${maskShape.mask} 前3后2不吻合,拒绝归位(防止张冠李戴);确属机主换绑可带 force=true 强制`,
    )
  }
  if (!maskShape && isFullPhone(oldName)) {
    if (oldName === p) {
      return {
        code: 'ok',
        message: '现名已是同一全号,无需补全',
        id: row.id,
        oldName,
        name: p,
        changed: false,
        checkinSync: NO_SYNC,
      }
    }
    return failPhone(
      'already_full',
      `现名 ${oldName} 已是全号且与新号不一致;确属换绑请重新导入该账号`,
    )
  }
  return applyPhoneCompletion(row, p, via)
}

// =============================================================================
// 共享到运营池标记(2026-11-07 立,李总指令)
// =============================================================================

export interface SetSharedResult {
  code: 'ok' | 'not_found'
  message: string | null
  id: string | null
  sharedToOps: boolean | null
  changed: boolean
  checkinSync: CheckinSyncOutcome
}

/**
 * 设置账号的"共享到运营池"标记(全局开放模型)。
 *
 * - shared=true:该号在保留个人池归属(本人可用)的同时,对所有用户/匿名开放(转发选路纳入);
 * - shared=false:仅个人池可见可用,绝不服务他人请求。
 *
 * 仅改路由标记,凭证不变;仍按 applyPhoneCompletion 同口径 bump cred_version 并推一次签到
 * 同步(使边缘视图对该账号保持最新,且改动可被对账收敛器感知),失败不阻塞主流程。
 */
export async function setAccountShared(
  accountId: string,
  shared: boolean,
): Promise<SetSharedResult> {
  const target = shared === true
  const [row] = await dbRead
    .select()
    .from(aiRelayAccountPool)
    .where(eq(aiRelayAccountPool.id, accountId))
    .limit(1)
  if (!row) {
    return {
      code: 'not_found',
      message: '账号不存在或已被删除',
      id: null,
      sharedToOps: null,
      changed: false,
      checkinSync: NO_SYNC,
    }
  }
  if (row.sharedToOps === target) {
    return {
      code: 'ok',
      message: null,
      id: row.id,
      sharedToOps: target,
      changed: false,
      checkinSync: NO_SYNC,
    }
  }
  const [written] = await db
    .update(aiRelayAccountPool)
    .set({
      sharedToOps: target,
      credVersion: sql`${aiRelayAccountPool.credVersion} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(aiRelayAccountPool.id, row.id))
    .returning({
      id: aiRelayAccountPool.id,
      credVersion: aiRelayAccountPool.credVersion,
      sharedToOps: aiRelayAccountPool.sharedToOps,
    })
  if (!written) {
    return {
      code: 'not_found',
      message: '账号不存在或已被删除',
      id: null,
      sharedToOps: null,
      changed: false,
      checkinSync: NO_SYNC,
    }
  }
  // 签到传播(旁路,失败不阻塞):凭证未动,载荷 = 库内现值解密重建 + 新版本。
  const checkinSync: CheckinSyncOutcome = { pushed: 0, pending: false, error: null }
  const platform = checkinPlatformFor(row.providerCode)
  if (platform) {
    try {
      const credentials = decryptAccountCredentials(row)
      const acc = buildPoolSyncAccount({
        id: row.id,
        ownerUserId: row.ownerUserId,
        uid: row.uid ?? '',
        name: row.name ?? '',
        token: credentials.token,
        refreshToken: credentials.refreshToken,
        credVersion: written.credVersion,
        enabled: row.isEnabled,
        proxyUrl: resolveAccountProxyUrl(row.proxyUrl),
        deviceId: row.deviceId,
        machineId: row.machineId,
        cosy: extractCosy(row.extraMetadata),
        deviceKeyPem: pemFromSecrets(credentials.secrets, 'deviceKeyPem'),
        devicePubPem: pemFromSecrets(credentials.secrets, 'devicePubPem'),
        tokenExpiresAt: row.tokenExpiresAt,
      })
      const push = await pushPoolSync(platform, [acc])
      if (push.ok && push.failed === 0) {
        checkinSync.pushed = push.pushed
        await clearCheckinSyncPending([row.id])
      } else {
        checkinSync.error = push.error
        try {
          await markCheckinSyncPending(
            [row.id],
            'cred',
            null,
            push.error ?? '共享标记变更后签到推送失败',
          )
          checkinSync.pending = true
        } catch {
          /* pending 落库失败只意味着少一条待推痕迹,对账收敛器兜底 */
        }
      }
    } catch (e) {
      checkinSync.error = e instanceof Error ? e.message.slice(0, 200) : '签到同步异常'
    }
  }
  return {
    code: 'ok',
    message: null,
    id: row.id,
    sharedToOps: written.sharedToOps,
    changed: true,
    checkinSync,
  }
}

/** 批量候选匹配报告(零凭据;只报 id/名/候选号,歧义项交人工裁决) */
export interface MatchPhoneReport {
  scannedMasked: number
  matched: Array<{ id: string; oldName: string; name: string; checkinSync: CheckinSyncOutcome }>
  ambiguous: Array<{ id: string; name: string; candidates: string[] }>
  unmatched: Array<{ id: string; name: string }>
  rejected: Array<{ phone: string; reason: string }>
}

/**
 * 批量候选全号 → 池内掩码名账号自动归位。
 * 判据:一个掩码行只有唯一候选、且该候选也只命中这一行 ⇒ 自动改名;
 * 任一方向出现多对多 ⇒ ambiguous 挂起待人工(绝不猜号归位)。
 */
export async function matchPhoneCandidates(phones: string[]): Promise<MatchPhoneReport> {
  const clean: string[] = []
  const rejected: MatchPhoneReport['rejected'] = []
  const seen = new Set<string>()
  for (const raw of phones) {
    const p = typeof raw === 'string' ? raw.trim() : ''
    if (!isFullPhone(p)) {
      rejected.push({ phone: p.slice(0, 32), reason: '非 11 位大陆全号形态' })
      continue
    }
    if (seen.has(p)) continue
    seen.add(p)
    clean.push(p)
  }
  const report: MatchPhoneReport = {
    scannedMasked: 0,
    matched: [],
    ambiguous: [],
    unmatched: [],
    rejected,
  }
  const rows = await dbRead
    .select()
    .from(aiRelayAccountPool)
    .where(like(aiRelayAccountPool.name, '%*%'))
  const masked = rows.flatMap((row) => {
    const shape = detectPhoneMask(row.name ?? '')
    return shape ? [{ row, shape }] : []
  })
  report.scannedMasked = masked.length
  // 候选 → 命中行数(双向唯一才放行)
  const hitCount = new Map<string, number>()
  for (const m of masked) {
    for (const p of clean) {
      if (phoneMatchesMask(p, m.shape)) hitCount.set(p, (hitCount.get(p) ?? 0) + 1)
    }
  }
  for (const m of masked) {
    const candidates = clean.filter((p) => phoneMatchesMask(p, m.shape))
    if (candidates.length === 0) {
      report.unmatched.push({ id: m.row.id, name: m.row.name ?? '' })
      continue
    }
    if (candidates.length > 1 || (hitCount.get(candidates[0]!) ?? 0) > 1) {
      report.ambiguous.push({ id: m.row.id, name: m.row.name ?? '', candidates })
      continue
    }
    const result = await applyPhoneCompletion(m.row, candidates[0]!, 'match')
    if (result.code === 'ok' && result.changed) {
      report.matched.push({
        id: m.row.id,
        oldName: result.oldName ?? '',
        name: candidates[0]!,
        checkinSync: result.checkinSync,
      })
    } else {
      report.unmatched.push({ id: m.row.id, name: m.row.name ?? '' })
    }
  }
  return report
}

// =============================================================================
// 凭证解密(供适配器使用)
// =============================================================================

export interface AccountCredentials {
  token: string
  refreshToken: string | null
  cookies: Array<Record<string, unknown>>
  /** 平台扩展敏感凭证(secretsEnc 解密解析;非法/空 → {},如 CodeArts 的 AK/SK/DPoP 私钥/PKCE) */
  secrets: Record<string, unknown>
}

/** 解密账号凭证;cookies 解不出/非法 JSON → 空数组(不抛,由适配器决定降级) */
export function decryptAccountCredentials(row: AiRelayAccountPool): AccountCredentials {
  const cookies: Array<Record<string, unknown>> = []
  if (row.cookiesEnc) {
    try {
      const parsed = JSON.parse(decryptField(row.cookiesEnc))
      if (Array.isArray(parsed)) {
        for (const c of parsed)
          if (c && typeof c === 'object') cookies.push(c as Record<string, unknown>)
      }
    } catch {
      /* 非法 cookies → 视为无 cookies */
    }
  }
  let secrets: Record<string, unknown> = {}
  if (row.secretsEnc) {
    try {
      const parsed = JSON.parse(decryptField(row.secretsEnc))
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        secrets = parsed as Record<string, unknown>
      }
    } catch {
      /* 非法 secrets → 视为空,由适配器决定降级 */
    }
  }
  return {
    token: decryptField(row.tokenEnc),
    refreshToken: row.refreshTokenEnc ? decryptField(row.refreshTokenEnc) : null,
    cookies,
    secrets,
  }
}

// =============================================================================
// 个人号池 → 对话模型清单(2026-11-10 立)
// =============================================================================

/**
 * 模型选择器「我的号池」分组的一条模型。
 *
 * id 的定义是硬约束:它会被原样当作 /v1/chat/completions 的 model 发回,
 * 因此必须能被转发器反查(全局登记行 model_id 逐字节相等,或 `<平台>/<上游模型名>` 形态)。
 * 前者的路线是 ai_model_config 命中,后者靠 resolvePoolProviders 的前缀兜底 —— 两条都在
 * relay-account-forwarder 里落判据,这里只负责给出合法 id(不另立规则)。
 */
export interface UserPoolModelItem {
  id: string
  name: string
  /** 平台 code(trae / workbuddy / …),前端据此分组与打标 */
  provider: string
  /** 该平台下当前可调度的账号数(选号面同源判据,不是行数) */
  accountCount: number
  /** preset = 全局登记行(有展示名/定价);upstream = 上游模型清单现拉 */
  source: 'preset' | 'upstream'
}

interface UserPoolModelCacheEntry {
  expiresAt: number
  /** 上游原始模型 id(不带平台前缀;拼前缀在输出时统一做) */
  upstreamIds: string[]
}

/** 清单缓存 10 分钟:模型目录变化慢,而选择器每次开面板都会问 */
const POOL_MODEL_CACHE_TTL_MS = 10 * 60 * 1000
/** 缓存键帽:键含 userId,不封顶就是一条按用户增长的内存泄漏 */
const POOL_MODEL_CACHE_MAX = 500
/** 单平台上游清单超时:拉清单不该把选择器拖到十几秒 */
const POOL_MODEL_UPSTREAM_TIMEOUT_MS = 8_000
const poolModelCache = new Map<string, UserPoolModelCacheEntry>()

/** 上游模型 id → 选择器 id:`<平台>/<上游名>`(已带同前缀则不重复拼,qoder 的登记形态即如此) */
function toPoolModelId(providerCode: string, upstreamId: string): string {
  const id = upstreamId.trim()
  if (id.startsWith(`${providerCode}/`)) return id
  return `${providerCode}/${id}`
}

/**
 * 单平台上游清单。永不抛:无 listModels / 超时 / 上游拒收一律归空数组,
 * 由预置登记行兜底(取不到 ≠ 没模型,只是这一轮没拿到)。
 */
async function fetchUpstreamModelIds(
  providerCode: RelayProviderCode,
  row: AiRelayAccountPool,
): Promise<string[]> {
  try {
    // 注册是幂等的;这里自己兜一次 —— 清单接口可能在 worker 之外(仅 API 进程)被首次调用,
    // 不依赖「worker 已启动」这个隐含前提,否则适配器表为空会静默返回零模型。
    const [{ getRelayAdapter }, { registerAllRelayAdapters }] = await Promise.all([
      import('./relay-upstream-adapters.js'),
      import('./upstream-adapters/index.js'),
    ])
    registerAllRelayAdapters()
    const adapter = getRelayAdapter(providerCode)
    if (!adapter) return []
    const ctx = { row, credentials: decryptAccountCredentials(row) }
    // 生命周期调用与 chat 同出口 IP(同号同代理,避免 IP 漂移触发风控)
    const opts = { proxyUrl: row.proxyUrl ? resolveAccountProxyUrl(row.proxyUrl) : null }
    const task = async (): Promise<string[]> => {
      if (adapter.listModelsDetailed) {
        const detailed = await adapter.listModelsDetailed(ctx, opts)
        if (detailed.ok && Array.isArray(detailed.models)) {
          const ids = detailed.models
            .map((m) => m.id ?? m.name)
            .map((s) => (typeof s === 'string' ? s.trim() : ''))
            .filter((s) => s !== '')
          if (ids.length > 0) return ids
        }
      }
      if (adapter.listModels) return await adapter.listModels(ctx, opts)
      return []
    }
    const timeout = new Promise<string[]>((resolve) => {
      const timer = setTimeout(() => resolve([]), POOL_MODEL_UPSTREAM_TIMEOUT_MS)
      timer.unref?.()
    })
    const ids = await Promise.race([task().catch(() => []), timeout])
    return [...new Set(ids.map((s) => s.trim()).filter((s) => s !== ''))]
  } catch {
    return []
  }
}

/**
 * 当前登录用户个人号池能被对话链路用到的模型清单。
 *
 * 口径(用户 2026-11-10 定档):预置为主 + 上游刷新为辅 ——
 * 预置 = 该平台在 ai_model_config 的启用模型行(有展示名、有定价,请求天然命中反查);
 * 上游 = 适配器 listModels 现拉(补上尚未登记的模型,靠 `<平台>/<名>` 前缀反查)。
 * 同 id 预置优先(展示名/定价更可信),上游只补缺。
 *
 * 只读 + 不抛:任何一段失败都退化为"少几条模型",绝不让选择器打不开。
 */
export async function listUserPoolModels(
  userId: string,
  opts: { refresh?: boolean } = {},
): Promise<UserPoolModelItem[]> {
  const { accountSchedulableCondition } = await import('./relay-account-pool-scheduler.js')
  const accounts = await dbRead
    .select()
    .from(aiRelayAccountPool)
    .where(and(eq(aiRelayAccountPool.ownerUserId, userId), accountSchedulableCondition()))
    .orderBy(aiRelayAccountPool.providerCode)
  if (accounts.length === 0) return []

  // 每平台只留一枚代表号去拉清单:清单语义是「这平台有哪些模型」,与具体哪枚号无关
  const byProvider = new Map<string, { row: AiRelayAccountPool; count: number }>()
  for (const row of accounts) {
    const hit = byProvider.get(row.providerCode)
    if (hit) hit.count += 1
    else byProvider.set(row.providerCode, { row, count: 1 })
  }

  const providers = [...byProvider.keys()]
  // 预置:一次查全(避免 12 次往返),按平台+模型名排序保证输出稳定
  const presetRows = await dbRead
    .select({
      providerCode: aiModelConfig.providerCode,
      modelId: aiModelConfigModels.modelId,
      displayName: aiModelConfigModels.displayName,
    })
    .from(aiModelConfigModels)
    .innerJoin(aiModelConfig, eq(aiModelConfigModels.configId, aiModelConfig.id))
    .where(
      and(
        inArray(aiModelConfig.providerCode, providers),
        eq(aiModelConfig.enabled, true),
        or(isNull(aiModelConfigModels.enabled), eq(aiModelConfigModels.enabled, true)),
      ),
    )
    .orderBy(aiModelConfig.providerCode, aiModelConfigModels.modelId)

  const presetByProvider = new Map<string, Array<{ id: string; name: string }>>()
  for (const row of presetRows) {
    if (!row.modelId) continue
    const list = presetByProvider.get(row.providerCode) ?? []
    list.push({ id: row.modelId, name: row.displayName || row.modelId })
    presetByProvider.set(row.providerCode, list)
  }

  const upstreamByProvider = new Map<string, string[]>()
  await Promise.all(
    [...byProvider.entries()].map(async ([code, hit]) => {
      const cacheKey = `${userId}:${code}`
      const cached = poolModelCache.get(cacheKey)
      if (!opts.refresh && cached && cached.expiresAt > Date.now()) {
        upstreamByProvider.set(code, cached.upstreamIds)
        return
      }
      const ids = isRelayProviderCode(code) ? await fetchUpstreamModelIds(code, hit.row) : []
      upstreamByProvider.set(code, ids)
    }),
  )

  const items: UserPoolModelItem[] = []
  for (const [code, hit] of byProvider) {
    const seen = new Set<string>()
    for (const preset of presetByProvider.get(code) ?? []) {
      if (seen.has(preset.id)) continue
      seen.add(preset.id)
      items.push({
        id: preset.id,
        name: preset.name,
        provider: code,
        accountCount: hit.count,
        source: 'preset',
      })
    }
    for (const upstreamId of upstreamByProvider.get(code) ?? []) {
      const id = toPoolModelId(code, upstreamId)
      // 裸名与带前缀名都算重复:平台登记行可能就用裸名(trae 系),上游清单再报一次不该出两条
      if (seen.has(id) || seen.has(upstreamId)) continue
      seen.add(id)
      items.push({
        id,
        name: upstreamId,
        provider: code,
        accountCount: hit.count,
        source: 'upstream',
      })
    }
    // 回写缓存:只存上游那一半(预置每次现读,登记变更立即生效)
    if (poolModelCache.size >= POOL_MODEL_CACHE_MAX && !poolModelCache.has(`${userId}:${code}`)) {
      const oldestKey = poolModelCache.keys().next().value
      if (oldestKey !== undefined) poolModelCache.delete(oldestKey)
    }
    poolModelCache.set(`${userId}:${code}`, {
      expiresAt: Date.now() + POOL_MODEL_CACHE_TTL_MS,
      upstreamIds: upstreamByProvider.get(code) ?? [],
    })
  }
  return items
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
