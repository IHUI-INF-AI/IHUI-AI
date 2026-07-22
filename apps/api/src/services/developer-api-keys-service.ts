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
import { eq, desc, sql } from 'drizzle-orm'
import { db, dbRead } from '../db/index.js'
import { developerApiKeys, apiLogs, apiKeyQuotas } from '@ihui/database'
import type { DeveloperApiKey } from '@ihui/database'
import { isValidApiKeyPermission, type ApiKeyPermission } from '@ihui/types'
import { generateApiKey, hashSecret } from '../utils/api-key-hash.js'

/** 创建 API Key 入参。permissions 接受 unknown(防御性过滤后再写入)。 */
export interface CreateKeyInput {
  name: string
  permissions?: unknown
  rateLimit?: number
}

/** 更新 API Key 入参。 */
export interface UpdateKeyPatch {
  name?: string
  permissions?: unknown
  rateLimit?: number
  status?: 'active' | 'revoked'
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
  const permissions = filterPermissions(input.permissions)
  const [record] = await db
    .insert(developerApiKeys)
    .values({
      userId,
      name: input.name,
      key,
      secret: hashed,
      permissions,
      rateLimit: input.rateLimit ?? 60,
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
