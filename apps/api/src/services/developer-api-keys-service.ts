// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 开发者 API Key 统一 service 层。
 *
 * 2026-07-22 立:统一 4 个路由文件(developer / frontend-stub / user-sk / admin-api-platform)
 * 各自实现 secret 生成 + 哈希 + CRUD 逻辑,消除重复与不一致。
 *
 * 职责:
 * - createKey:generateApiKey + hashSecret 写入 DB,返回 { apiKey, secret }
 * - listKeys:返回脱敏列表(不含 secret)
 * - getKey:带归属权校验
 * - updateKey:带归属权校验,permissions 用 isValidApiKeyPermission 过滤(防御性)
 * - deleteKey:带归属权校验
 * - rotateSecret:生成新 secret + 哈希,返回 { apiKey, secret }
 * - getUsage:从 apiLogs 统计 + 读 apiKeyQuotas
 *
 * 读写分离:写用 db,读用 dbRead(参照 developer.ts 现有模式)。
 */
import { eq, desc, sql, and, inArray } from 'drizzle-orm'
import { db, dbRead } from '../db/index.js'
import { developerApiKeys, apiLogs, apiKeyQuotas } from '@ihui/database'
import type { DeveloperApiKey } from '@ihui/database'
import {
  isValidApiKeyPermission,
  DEFAULT_API_KEY_PERMISSIONS,
  type ApiKeyPermission,
} from '@ihui/types'
import { generateApiKey, hashSecret } from '../utils/api-key-hash.js'

/**
 * Key 级配额字段(创建/更新通用)。
 * O2 2026-09-21:此前只有批量端点能设窗口限额,单个 Key 的 PATCH 面缺失;
 * 现与鉴权主链路(requireApiKeyAuth 强制的 5h/1d/7d + 黑名单 + per-model 限流)对齐可配。
 * 语义:undefined = 不修改(仅更新时),null = 清空该限制。
 */
export interface KeyQuotaFields {
  /** IP 黑名单(jsonb 字符串数组,null = 无),命中优先于白名单 → 403 */
  blockedIps?: string[] | null
  /** 5 小时滚动窗口最大请求数(null = 不限) */
  rateLimit5h?: number | null
  /** 每日(UTC+8 自然日)最大请求数(null = 不限) */
  rateLimit1d?: number | null
  /** 每周(UTC+8 周一~周日)最大请求数(null = 不限) */
  rateLimit7d?: number | null
  /** 单模型 RPM 上限映射(jsonb {"gpt-4o": 60},null = 不限) */
  perModelRpmLimit?: Record<string, number> | null
  /** 单模型 TPM 上限映射(jsonb {"gpt-4o": 100000},null = 不限) */
  perModelTpmLimit?: Record<string, number> | null
}

/** KeyQuotaFields 中可写库的列名(updateKey 按 undefined 逐字段挑)。 */
const KEY_QUOTA_FIELDS = [
  'blockedIps',
  'rateLimit5h',
  'rateLimit1d',
  'rateLimit7d',
  'perModelRpmLimit',
  'perModelTpmLimit',
] as const satisfies readonly (keyof KeyQuotaFields)[]

/** 创建 API Key 入参。permissions 接受 unknown(防御性过滤后再写入)。 */
export interface CreateKeyInput extends KeyQuotaFields {
  name: string
  permissions?: unknown
  rateLimit?: number
  // --- P0-7 安全粒度字段(2026-07-31 立)---
  /** 过期时间(null = 永不过期) */
  expiresAt?: Date | null
  /** IP 白名单(null/空 = 不限制),支持 CIDR / IPv6 */
  allowedIps?: string[] | null
  /** 模型白名单(null/空 = 不限制),支持通配符 gpt-4* */
  allowedModels?: string[] | null
  /** 单次请求 token 上限(null = 不限制) */
  maxTokensPerReq?: number | null
}

/** 更新 API Key 入参。 */
export interface UpdateKeyPatch extends KeyQuotaFields {
  name?: string
  permissions?: unknown
  rateLimit?: number
  status?: 'active' | 'revoked'
  // --- P0-7 安全粒度字段(2026-07-31 立)---
  expiresAt?: Date | null
  allowedIps?: string[] | null
  allowedModels?: string[] | null
  maxTokensPerReq?: number | null
}

/** 脱敏行(不含 secret),仅 listKeys 使用。 */
export type SafeApiKey = Omit<DeveloperApiKey, 'secret'>

/** 防御性过滤 permissions:非法值被剔除。 */
function filterPermissions(perms: unknown): ApiKeyPermission[] {
  if (!Array.isArray(perms)) return []
  return perms.filter(isValidApiKeyPermission)
}

/**
 * 创建 API Key。
 * @returns { apiKey: 完整行(secret 为哈希), secret: 明文(仅此一次返回) }
 */
export async function createKey(
  userId: string,
  input: CreateKeyInput,
): Promise<{ apiKey: DeveloperApiKey; secret: string }> {
  const { key, secret } = generateApiKey()
  const hashed = hashSecret(secret)
  const filtered = filterPermissions(input.permissions)
  // 2026-09-13 修复:新建 Key 权限为空(未传或全部非法)时赋予默认权限,
  // 保证开箱即用可直接调用 /v1/chat/completions,否则 403 "Missing permission: chat:write"
  const permissions: ApiKeyPermission[] =
    filtered.length > 0 ? filtered : [...DEFAULT_API_KEY_PERMISSIONS]
  const [record] = await db
    .insert(developerApiKeys)
    .values({
      userId,
      name: input.name,
      key,
      secret: hashed,
      permissions,
      rateLimit: input.rateLimit ?? 60,
      // P0-7 安全粒度字段:undefined → null(DB 默认),null = 不限制
      expiresAt: input.expiresAt ?? null,
      allowedIps: input.allowedIps ?? null,
      allowedModels: input.allowedModels ?? null,
      maxTokensPerReq: input.maxTokensPerReq ?? null,
      // Key 级配额(O2 2026-09-21):undefined → null = 不限,存量行为不变
      blockedIps: input.blockedIps ?? null,
      rateLimit5h: input.rateLimit5h ?? null,
      rateLimit1d: input.rateLimit1d ?? null,
      rateLimit7d: input.rateLimit7d ?? null,
      perModelRpmLimit: input.perModelRpmLimit ?? null,
      perModelTpmLimit: input.perModelTpmLimit ?? null,
    })
    .returning()
  if (!record) throw new Error('创建 API 密钥失败')
  return { apiKey: record, secret }
}

/**
 * 列出当前用户的所有 API 密钥(脱敏,不含 secret)。
 */
export async function listKeys(userId: string): Promise<SafeApiKey[]> {
  const rows = await dbRead
    .select({
      id: developerApiKeys.id,
      userId: developerApiKeys.userId,
      name: developerApiKeys.name,
      key: developerApiKeys.key,
      permissions: developerApiKeys.permissions,
      status: developerApiKeys.status,
      lastUsedAt: developerApiKeys.lastUsedAt,
      rateLimit: developerApiKeys.rateLimit,
      tokenBalance: developerApiKeys.tokenBalance,
      costBalanceCents: developerApiKeys.costBalanceCents,
      tokenUsedTotal: developerApiKeys.tokenUsedTotal,
      costUsedTotalCents: developerApiKeys.costUsedTotalCents,
      // P0-7 安全粒度字段
      expiresAt: developerApiKeys.expiresAt,
      allowedIps: developerApiKeys.allowedIps,
      allowedModels: developerApiKeys.allowedModels,
      maxTokensPerReq: developerApiKeys.maxTokensPerReq,
      // 多租户关联字段(与 schema 同步,保证 SafeApiKey 类型完整)
      tenantId: developerApiKeys.tenantId,
      // 限流窗口 + IP 黑名单(B/C,2026-09-16,与 schema 同步)
      blockedIps: developerApiKeys.blockedIps,
      rateLimit5h: developerApiKeys.rateLimit5h,
      rateLimit1d: developerApiKeys.rateLimit1d,
      rateLimit7d: developerApiKeys.rateLimit7d,
      // per-model 限流列(2026-09-21,O2 落地,保证 SafeApiKey 类型完整)
      perModelRpmLimit: developerApiKeys.perModelRpmLimit,
      perModelTpmLimit: developerApiKeys.perModelTpmLimit,
      createdAt: developerApiKeys.createdAt,
      updatedAt: developerApiKeys.updatedAt,
    })
    .from(developerApiKeys)
    .where(eq(developerApiKeys.userId, userId))
    .orderBy(desc(developerApiKeys.createdAt))
  return rows
}

/**
 * 查询单个 API Key(带归属权校验)。
 * @returns 完整行(含哈希 secret);不存在或不归属 userId 返回 null。
 */
export async function getKey(id: string, userId: string): Promise<DeveloperApiKey | null> {
  const [row] = await dbRead
    .select()
    .from(developerApiKeys)
    .where(eq(developerApiKeys.id, id))
    .limit(1)
  if (!row || row.userId !== userId) return null
  return row
}

/**
 * 更新 API Key(带归属权校验)。
 * permissions 写入前用 isValidApiKeyPermission 过滤(防御性)。
 * @returns 更新后的完整行(含哈希 secret);不存在或不归属返回 null。
 */
export async function updateKey(
  id: string,
  userId: string,
  patch: UpdateKeyPatch,
): Promise<DeveloperApiKey | null> {
  const [existing] = await dbRead
    .select()
    .from(developerApiKeys)
    .where(eq(developerApiKeys.id, id))
    .limit(1)
  if (!existing || existing.userId !== userId) return null

  const setData: Record<string, unknown> = { updatedAt: new Date() }
  if (patch.name !== undefined) setData.name = patch.name
  if (patch.permissions !== undefined) setData.permissions = filterPermissions(patch.permissions)
  if (patch.rateLimit !== undefined) setData.rateLimit = patch.rateLimit
  if (patch.status !== undefined) setData.status = patch.status
  // P0-7 安全粒度字段:undefined = 不修改,null = 清除限制
  if (patch.expiresAt !== undefined) setData.expiresAt = patch.expiresAt
  if (patch.allowedIps !== undefined) setData.allowedIps = patch.allowedIps
  if (patch.allowedModels !== undefined) setData.allowedModels = patch.allowedModels
  if (patch.maxTokensPerReq !== undefined) setData.maxTokensPerReq = patch.maxTokensPerReq
  // Key 级配额(黑名单 / 5h·1d·7d 窗口 / per-model RPM·TPM):同上语义
  for (const field of KEY_QUOTA_FIELDS) {
    if (patch[field] !== undefined) setData[field] = patch[field]
  }

  const [updated] = await db
    .update(developerApiKeys)
    .set(setData)
    .where(eq(developerApiKeys.id, id))
    .returning()
  if (!updated) return null
  return updated
}

/**
 * 删除 API Key(带归属权校验)。
 * @returns true=删除成功;false=不存在或不归属。
 */
export async function deleteKey(id: string, userId: string): Promise<boolean> {
  const [existing] = await dbRead
    .select({ id: developerApiKeys.id, userId: developerApiKeys.userId })
    .from(developerApiKeys)
    .where(eq(developerApiKeys.id, id))
    .limit(1)
  if (!existing || existing.userId !== userId) return false
  await db.delete(developerApiKeys).where(eq(developerApiKeys.id, id))
  return true
}

/**
 * Key 批量编辑(2026-09-16 立,深度对标补强 C,对标竞品 bulkEdit)。
 *
 * - 仅允许安全字段(限流/过期/IP 黑白名单/三窗口限额),ids 上限 100;
 * - 归属校验:UPDATE 带 userId 条件,越权 id 自动落空(返回的 updated 为真实条数);
 * - patch 中 undefined = 不改,显式 null = 清空该限制。
 */
export interface BulkUpdateKeysPatch {
  rateLimit?: number | null
  expiresAt?: string | null
  allowedIps?: string[] | null
  blockedIps?: string[] | null
  rateLimit5h?: number | null
  rateLimit1d?: number | null
  rateLimit7d?: number | null
}

export async function bulkUpdateKeys(
  userId: string,
  ids: string[],
  patch: BulkUpdateKeysPatch,
): Promise<{ updated: number }> {
  if (ids.length === 0 || ids.length > 100) return { updated: 0 }
  const setData: Record<string, unknown> = { updatedAt: new Date() }
  if (patch.rateLimit !== undefined) setData.rateLimit = patch.rateLimit
  if (patch.expiresAt !== undefined)
    setData.expiresAt = patch.expiresAt ? new Date(patch.expiresAt) : null
  if (patch.allowedIps !== undefined) setData.allowedIps = patch.allowedIps
  if (patch.blockedIps !== undefined) setData.blockedIps = patch.blockedIps
  if (patch.rateLimit5h !== undefined) setData.rateLimit5h = patch.rateLimit5h
  if (patch.rateLimit1d !== undefined) setData.rateLimit1d = patch.rateLimit1d
  if (patch.rateLimit7d !== undefined) setData.rateLimit7d = patch.rateLimit7d
  const rows = await db
    .update(developerApiKeys)
    .set(setData)
    .where(and(eq(developerApiKeys.userId, userId), inArray(developerApiKeys.id, ids)))
    .returning({ id: developerApiKeys.id })
  return { updated: rows.length }
}

/**
 * 吊销 API Key(2026-09-16 立,软操作)。
 *
 * 与 deleteKey(硬删除)的区别:吊销只把 status 置为 'revoked',保留 Key 记录
 * 与全部调用日志(llm_call_logs 关联不丢失),用户可在管理端看到"已吊销"状态。
 * checkQuota 对 status !== 'active' 一律拒绝,吊销立即生效。
 * 幂等:已是 revoked 直接返回 true。
 */
export async function revokeKey(id: string, userId: string): Promise<boolean> {
  const [existing] = await dbRead
    .select({
      id: developerApiKeys.id,
      userId: developerApiKeys.userId,
      status: developerApiKeys.status,
    })
    .from(developerApiKeys)
    .where(eq(developerApiKeys.id, id))
    .limit(1)
  if (!existing || existing.userId !== userId) return false
  if (existing.status === 'revoked') return true
  await db
    .update(developerApiKeys)
    .set({ status: 'revoked', updatedAt: new Date() })
    .where(eq(developerApiKeys.id, id))
  return true
}

/**
 * 轮换 API Key 的 secret(带归属权校验)。
 * 生成新 secret + 哈希,旧 secret 失效。
 * @returns { apiKey: 完整行(含新哈希 secret), secret: 新明文(仅此一次返回) };不存在或不归属返回 null。
 */
export async function rotateSecret(
  id: string,
  userId: string,
): Promise<{ apiKey: DeveloperApiKey; secret: string } | null> {
  const [existing] = await dbRead
    .select()
    .from(developerApiKeys)
    .where(eq(developerApiKeys.id, id))
    .limit(1)
  if (!existing || existing.userId !== userId) return null

  const { secret } = generateApiKey()
  const hashed = hashSecret(secret)
  const [updated] = await db
    .update(developerApiKeys)
    .set({ secret: hashed, updatedAt: new Date() })
    .where(eq(developerApiKeys.id, id))
    .returning()
  if (!updated) return null
  return { apiKey: updated, secret }
}

/**
 * 查询 API Key 使用量(带归属权校验)。
 * 从 apiLogs 统计调用次数/最后使用时间/Top 端点,并读 apiKeyQuotas 配额信息。
 */
export async function getUsage(
  id: string,
  userId: string,
): Promise<{
  callCount: number
  lastUsedAt: Date | null
  topEndpoints: Array<{ path: string; method: string; count: number }>
  quota: { hourlyUsed: number; dailyUsed: number; hourlyLimit: number; dailyLimit: number } | null
} | null> {
  const [existing] = await dbRead
    .select()
    .from(developerApiKeys)
    .where(eq(developerApiKeys.id, id))
    .limit(1)
  if (!existing || existing.userId !== userId) return null

  // apiLogs 通过 userId 关联(密钥使用时以密钥所有者身份记录)
  const [countRow] = await dbRead
    .select({ callCount: sql<number>`count(*)::int` })
    .from(apiLogs)
    .where(eq(apiLogs.userId, userId))

  const [lastRow] = await dbRead
    .select({ lastUsedAt: apiLogs.createdAt })
    .from(apiLogs)
    .where(eq(apiLogs.userId, userId))
    .orderBy(desc(apiLogs.createdAt))
    .limit(1)

  const topEndpoints = await dbRead
    .select({
      path: apiLogs.path,
      method: apiLogs.method,
      count: sql<number>`count(*)::int`,
    })
    .from(apiLogs)
    .where(eq(apiLogs.userId, userId))
    .groupBy(apiLogs.path, apiLogs.method)
    .orderBy(desc(sql`count(*)::int`))
    .limit(5)

  // 读配额信息(可能尚未初始化)
  const [quotaRow] = await dbRead
    .select({
      hourlyUsed: apiKeyQuotas.hourlyUsed,
      dailyUsed: apiKeyQuotas.dailyUsed,
      hourlyLimit: apiKeyQuotas.hourlyLimit,
      dailyLimit: apiKeyQuotas.dailyLimit,
    })
    .from(apiKeyQuotas)
    .where(eq(apiKeyQuotas.apiKeyId, id))
    .limit(1)

  return {
    callCount: countRow?.callCount ?? 0,
    lastUsedAt: lastRow?.lastUsedAt ?? existing.lastUsedAt,
    topEndpoints,
    quota: quotaRow ?? null,
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
