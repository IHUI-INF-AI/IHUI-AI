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
import { and, eq } from 'drizzle-orm'
import { aiRelayAccountPool, type AiRelayAccountPool } from '@ihui/database'
import { db } from '../db/index.js'
import { encryptField, decryptField } from '../utils/crypto.js'

// =============================================================================
// 类型
// =============================================================================

/** 支持反代的第三方 AI IDE 平台 */
export const RELAY_PROVIDERS = ['trae', 'workbuddy', 'codearts'] as const
export type RelayProviderCode = (typeof RELAY_PROVIDERS)[number]

export function isRelayProviderCode(v: string): v is RelayProviderCode {
  return (RELAY_PROVIDERS as readonly string[]).includes(v)
}

/** 导入 JSON 里的单账号形状(与账号导出工具/浏览器插件格式对齐,字段宽松) */
export interface ImportAccountInput {
  name?: string
  token?: string
  refreshToken?: string
  deviceId?: string
  machineId?: string
  enabled?: boolean
  cookies?: unknown[]
  /** 账号级出口代理(可选) */
  proxyUrl?: string
  /** 平台特有附加字段(原样进 extraMetadata) */
  [k: string]: unknown
}

export type ImportItemStatus = 'imported' | 'updated' | 'skipped' | 'failed'

export interface ImportItemResult {
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
}

// =============================================================================
// JWT / Cookie 解析工具(纯本地,无网络)
// =============================================================================

/**
 * 解 JWT payload(**不验签**,只取声明)。非三段式/非 base64url JSON → null。
 */
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

/**
 * WebKit epoch(1601-01-01 起的微秒)→ Unix 毫秒。0/空 = 会话 cookie(返回 null)。
 */
export function webkitEpochToUnixMs(expiresUtc: unknown): number | null {
  const v = typeof expiresUtc === 'number' ? expiresUtc : Number(expiresUtc)
  if (!Number.isFinite(v) || v <= 0) return null
  // 1601-01-01 → 1970-01-01 相差 11644473600 秒
  return Math.floor(v / 1000) - 11_644_473_600_000
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
 * 解析账号 uid(去重键)。优先 JWT 声明:payload.data.id(Trae 会话惯例)→ sub → uid → data.user_id;
 * 全失败:sha256(token) 前 32 位(加 'auto:' 前缀,保证可去重可追溯)。
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
function extractTenantId(token: string): string | null {
  const claims = parseJwtClaims(token)
  const data = claims?.['data'] as Record<string, unknown> | undefined
  const t = data?.['tenant_id']
  return typeof t === 'string' && t.length > 0 ? t : null
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
  const token =
    cstr(a['securitytoken']) || cstr(a['security_token']) || cstr(a['cloud_dragon_token'])
  const accessKeyId = cstr(a['accessKey']) || cstr(a['access_key_id'])
  const secretAccessKey = cstr(a['secretKey']) || cstr(a['secret_access_key'])
  if (!token || !accessKeyId || !secretAccessKey) return null

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
// 批量导入
// =============================================================================

/**
 * 批量导入账号(幂等:同 (providerCode, uid) 再导入 = 覆盖凭证 + 重置健康状态)。
 * 逐条独立 try/catch,一条坏不影响整批。
 */
export async function importAccounts(
  providerCode: RelayProviderCode,
  accounts: ImportAccountInput[],
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

  for (let i = 0; i < accounts.length; i++) {
    const acc = accounts[i] ?? {}
    const accName = typeof acc.name === 'string' && acc.name ? acc.name : ''
    let displayName = accName || `#${i + 1}`
    try {
      // CodeArts 分支(2026-10-22):STS 凭据包非 JWT,桌面端导出/Seventy73 落盘两种格式都认
      const mapped = providerCode === 'codearts' ? mapCodeartsImport(acc) : null
      if (!accName && mapped?.name) displayName = mapped.name
      if (providerCode === 'codearts' && !mapped) {
        result.failed++
        result.items.push({
          index: i,
          name: displayName,
          uid: null,
          status: 'failed',
          reason: 'CodeArts 导入缺少 STS 凭据(securitytoken/accessKey/secretAccessKey)',
        })
        continue
      }
      const token = mapped ? mapped.token : typeof acc.token === 'string' ? acc.token.trim() : ''
      if (!token) {
        result.failed++
        result.items.push({
          index: i,
          name: displayName,
          uid: null,
          status: 'failed',
          reason: '缺少 token',
        })
        continue
      }
      const refreshToken = mapped
        ? mapped.refreshToken
        : typeof acc.refreshToken === 'string' && acc.refreshToken.trim()
          ? acc.refreshToken.trim()
          : null
      const uid = mapped ? mapped.uid : extractUid(token)
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

      const tokenExpiresAt = mapped ? mapped.expiresAt : extractTokenExpiry(token)
      const now = new Date()
      const expired = tokenExpiresAt !== null && tokenExpiresAt <= now

      // 过期且无续期凭证 → 入库但摘除(诚实标记,不冒充可用)
      const down = expired && !refreshToken
      const healthStatus = down ? 'down' : 'unknown'

      const cookies = Array.isArray(acc.cookies) ? acc.cookies : []
      const extra: Record<string, unknown> = {}
      const tenantId = providerCode === 'trae' ? extractTenantId(token) : null
      if (tenantId) extra.tenantId = tenantId
      if (cookies.length > 0) extra.cookieCount = cookies.length
      const cookieEarliest = earliestCookieExpiry(cookies)
      if (cookieEarliest !== null)
        extra.cookieEarliestExpiry = new Date(cookieEarliest).toISOString()
      if (expired) extra.importedExpired = true

      const values = {
        providerCode,
        uid,
        name: displayName.slice(0, 128),
        tokenEnc: encryptField(token),
        refreshTokenEnc: refreshToken ? encryptField(refreshToken) : null,
        cookiesEnc: cookies.length > 0 ? encryptField(JSON.stringify(cookies)) : null,
        secretsEnc: mapped ? encryptField(JSON.stringify(mapped.secrets)) : null,
        deviceId:
          typeof acc.deviceId === 'string' && acc.deviceId ? acc.deviceId.slice(0, 128) : null,
        machineId:
          typeof acc.machineId === 'string' && acc.machineId ? acc.machineId.slice(0, 128) : null,
        tokenExpiresAt,
        isEnabled: acc.enabled === false ? false : true,
        tempUnschedulable: down,
        healthStatus,
        lastErrorMessage: down ? '导入时 access token 已过期且无 refreshToken' : null,
        refreshFailureCount: 0,
        consecutiveFailures: 0,
        proxyUrl: typeof acc.proxyUrl === 'string' && acc.proxyUrl ? acc.proxyUrl : null,
        extraMetadata: extra,
        updatedAt: new Date(),
      }

      const existing = await db
        .select({ id: aiRelayAccountPool.id })
        .from(aiRelayAccountPool)
        .where(
          and(eq(aiRelayAccountPool.providerCode, providerCode), eq(aiRelayAccountPool.uid, uid)),
        )
        .limit(1)

      if (existing.length > 0 && existing[0]) {
        await db
          .update(aiRelayAccountPool)
          .set(values)
          .where(eq(aiRelayAccountPool.id, existing[0].id))
        result.updated++
        result.items.push({
          index: i,
          name: displayName,
          uid,
          status: 'updated',
          reason: down
            ? '已覆盖凭证;token 过期且无 refreshToken,已摘除'
            : '已覆盖凭证并重置健康状态',
        })
      } else {
        await db.insert(aiRelayAccountPool).values(values)
        result.imported++
        result.items.push({
          index: i,
          name: displayName,
          uid,
          status: 'imported',
          reason: down ? 'token 已过期且无 refreshToken,入库即摘除' : null,
        })
      }
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
  return result
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

/** 把 Chrome 导出 cookies 数组拼成 Cookie 请求头(name=value; …) */
export function buildCookieHeader(cookies: Array<Record<string, unknown>>): string {
  return cookies
    .filter((c) => typeof c['name'] === 'string' && typeof c['value'] === 'string')
    .map((c) => `${c['name']}=${c['value']}`)
    .join('; ')
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
