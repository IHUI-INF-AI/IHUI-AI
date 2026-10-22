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
import {
  earliestCookieExpiry,
  extractTenantId,
  extractTokenExpiry,
  extractUid,
  parseFlexibleExpiry,
  type RelayProviderCode,
} from './relay-account-format.js'

// =============================================================================
// 类型
// =============================================================================

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
  const token = cstr(a['token'])
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
  for (const k of ['machineToken', 'machineCode', 'machineType', 'version']) {
    const v = cstr(a[k])
    if (v) cosy[k] = v
  }
  return {
    token,
    refreshToken: cstr(a['refreshToken']) || null,
    uid,
    expiresAt: parseFlexibleExpiry(a['expiresAt']) ?? extractTokenExpiry(token),
    refreshExpiresAt: parseFlexibleExpiry(a['refreshTokenExpiresAt']),
    name: cstr(a['name']) || cstr(a['nickname']) || cstr(a['phone']) || null,
    cosy: Object.keys(cosy).length > 0 ? cosy : null,
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
      // 非 JWT 平台映射分支:CodeArts(2026-10-22)STS 凭据包 / Qoder(2026-10-23)
      // opaque token 会话。两种格式的 uid/expiresAt 都在映射层显式解析,
      // 不透传则退化为哈希 uid + 无过期时刻。
      const mapped =
        providerCode === 'codearts'
          ? mapCodeartsImport(acc)
          : providerCode === 'qoder'
            ? mapQoderImport(acc)
            : null
      if (!accName && mapped?.name) displayName = mapped.name
      if ((providerCode === 'codearts' || providerCode === 'qoder') && !mapped) {
        result.failed++
        result.items.push({
          index: i,
          name: displayName,
          uid: null,
          status: 'failed',
          reason:
            providerCode === 'codearts'
              ? 'CodeArts 导入缺少 STS 凭据(securitytoken/accessKey/secretAccessKey)'
              : 'Qoder 导入缺少 token',
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

      const values = {
        providerCode,
        uid,
        name: displayName.slice(0, 128),
        tokenEnc: encryptField(token),
        refreshTokenEnc: refreshToken ? encryptField(refreshToken) : null,
        cookiesEnc: cookies.length > 0 ? encryptField(JSON.stringify(cookies)) : null,
        secretsEnc:
          mapped && 'secrets' in mapped ? encryptField(JSON.stringify(mapped.secrets)) : null,
        deviceId:
          typeof acc.deviceId === 'string' && acc.deviceId ? acc.deviceId.slice(0, 128) : null,
        machineId:
          typeof acc.machineId === 'string' && acc.machineId ? acc.machineId.slice(0, 128) : null,
        tokenExpiresAt,
        refreshExpiresAt: mapped && 'refreshExpiresAt' in mapped ? mapped.refreshExpiresAt : null,
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
