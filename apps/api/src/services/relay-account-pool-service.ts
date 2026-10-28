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
import { and, eq, isNull, like, sql } from 'drizzle-orm'
import { aiRelayAccountPool, type AiRelayAccountPool } from '@ihui/database'
import { db, dbRead } from '../db/index.js'
import { encryptField, decryptField } from '../utils/crypto.js'
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
  resolveRelayCredentialSlots,
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
  const keyPem = cstr(acc['deviceKeyPem'])
  const pubPem = cstr(acc['devicePubPem'])
  if (!keyPem || !pubPem) return null
  return { secrets: { deviceKeyPem: keyPem, devicePubPem: pubPem } }
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
    // 号池统一名称 = 官方绑定手机号(2026-10-28 定):phone 优先,昵称/显示名只作兜底;
    // 取不到 phone 才退回 nickname → name,绝不拿昵称当统一名。
    name:
      cstr(a['phone']) ||
      (user ? cstr(user['phone']) : '') ||
      cstr(a['nickname']) ||
      cstr(a['name']) ||
      null,
    cosy: Object.keys(cosy).length > 0 ? cosy : null,
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

/** MiniMax:mcode auth 记录(accessToken/refreshToken/expiresAtMs + region 溯源) */
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
    uid: autoUid(`${cstr(a['recordKey']) || 'minimax'}:${token}`),
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

/** ZCode:credentials.json 扁平图直通,token 主选 oauth:bigmodel:access_token */
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
    uid: autoUid(token),
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
  return {
    token,
    refreshToken: null,
    uid: autoUid(`${cstr(a['source']) || providerLabel}:${key}:${token}`),
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

  for (let i = 0; i < accounts.length; i++) {
    // 外来格式自适应(判据单源 relay-account-format,与 validateAccountExport 同一函数):
    // workbuddy-switch 等第三方导出(access_token/expires_at 等)在这里归一成规范形状;
    // 我方原生形状(token 在场)原样通过。
    const acc = normalizeForeignAccountShape(accounts[i] ?? {}) as ImportAccountInput
    const accName = typeof acc.name === 'string' && acc.name ? acc.name : ''
    let displayName = accName || `#${i + 1}`
    try {
      // 形状闸门(单源判据 relay-account-format.recognizeImportShape):只有本仓认得的
      // 平台形状才放行;认不出就整条拒掉并点名缺哪个键 —— 绝不静默丢弃,也绝不把
      // 认不出的东西塞成"无效账号"进库(Web 路由闸门 / CLI 预检共用同一判据)。
      const shape = recognizeImportShape(providerCode, acc)
      if (!shape.importable) {
        result.failed++
        result.items.push({
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
      const mapped =
        providerCode === 'codearts'
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
      // Trae 设备材料独立成档:只写 secretsEnc,不接管 token/refreshToken/uid 的取值路径
      const traeSecrets = providerCode === 'trae' ? mapTraeImport(acc) : null
      // 号池统一名称 = 官方绑定手机号:qoder 映射出的 name 即 phone,具备权威性,
      // 压过载荷自带的 name(捕获件里它是客户端昵称,不能当统一名;2026-10-28 定)
      if (mapped?.name && (!accName || providerCode === 'qoder')) displayName = mapped.name
      // 入口归一化:从 JSON 整段复制的粘贴值会带包裹引号,上游按前缀校验 ⇒ 一个多余字符
      // 就令号池自刷新与每日签到同时失败(dev 实测 `"drt-…` 那枚,详见 normalizeCredentialValue 头注)
      const token = normalizeCredentialValue(mapped ? mapped.token : acc.token) ?? ''
      if (!token) {
        result.failed++
        result.items.push({
          index: i,
          name: displayName,
          uid: null,
          status: 'failed',
          reason: `${providerCode} 的凭据归一后为空(剥掉包裹引号/空白后没有内容)`,
        })
        continue
      }
      // WorkBuddy 全号通道(2026-10-28 立):Keycloak JWT 的 preferred_username 就是官方
      // 绑定的完整手机号;客户端会话只有昵称、第三方导出件常带脱敏号,故以票内声明为准
      // 覆盖统一名。只对全号形态生效,解不出/非手机号形态一律不动(维持原兜底命名)。
      if (providerCode === 'workbuddy') {
        const pref = parseJwtClaims(token)?.['preferred_username']
        if (typeof pref === 'string' && /^1[3-9]\d{9}$/.test(pref)) displayName = pref
      }
      const refreshToken = normalizeCredentialValue(mapped ? mapped.refreshToken : acc.refreshToken)
      const uid = normalizeCredentialValue(mapped ? mapped.uid : acc.uid) ?? extractUid(token)
      const shapeIssue = credentialShapeIssue(providerCode, { refreshToken })
      if (shapeIssue) {
        result.failed++
        result.items.push({
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
        result.items.push({
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
        const merged: Record<string, unknown> = { ...incomingSecrets }
        if (existingSecrets) {
          for (const k of ['sessionTemplate', 'sealedPaths', 'edition'] as const) {
            const cur = merged[k]
            const provided =
              cur !== null &&
              cur !== undefined &&
              !(typeof cur === 'object' && !Array.isArray(cur) && Object.keys(cur).length === 0)
            const keep = existingSecrets[k]
            if (!provided && keep !== null && keep !== undefined) merged[k] = keep
          }
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
        const overwriteValues = overwriteRefresh.preserve
          ? {
              ...valuesWithoutRefresh,
              ...(incomingExpiryColumn === null ? {} : { refreshExpiresAt: incomingExpiryColumn }),
              ...(accName && accName !== uid ? { name: incomingNameColumn } : {}),
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
        result.items.push({
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
        result.items.push({
          index: i,
          name: displayName,
          uid,
          status: 'imported',
          reason: down ? 'token 已过期且无 refreshToken,入库即摘除' : null,
        })
      }
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
      result.items.push({
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
  const checkinPlatform = checkinPlatformFor(providerCode)
  if (checkinPush.length === 0) {
    result.checkinSync = { pushed: 0, skipped: 0, pending: 0, error: null }
  } else if (!checkinPlatform) {
    // 平台无签到引擎(如 codearts):如实计 skipped,不推送、不落 pending
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
    } else {
      const failedIdSet = new Set(push.failedIds)
      const pendingIds =
        push.failedIds.length > 0
          ? checkinPush.filter((a) => failedIdSet.has(a.poolAccountId)).map((a) => a.poolAccountId)
          : checkinPush.map((a) => a.poolAccountId)
      await markCheckinSyncPending(pendingIds, 'cred', null, push.error ?? '未知错误')
      result.checkinSync = {
        pushed: push.pushed,
        skipped: push.skipped,
        pending: pendingIds.length,
        error: push.error,
      }
    }
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
  via: 'manual' | 'match',
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
 */
export async function completeAccountPhone(
  accountId: string,
  phone: string,
  via: 'manual' | 'match' = 'manual',
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
  if (maskShape && !phoneMatchesMask(p, maskShape)) {
    return failPhone(
      'mask_mismatch',
      `与池内掩码 ${maskShape.mask} 前3后2不吻合,拒绝归位(防止张冠李戴)`,
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
