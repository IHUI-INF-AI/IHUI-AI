/**
 * API Key 临时分享/限时 token service 层。
 *
 * 职责:
 * - createShare:生成 share_token(crypto.randomBytes 32 字节 hex)+ 写入 DB
 * - getShareByToken:查询未过期+未撤销的分享,返回源 Key 信息 + scope 限制
 * - revokeShare:设置 revoked_at(带归属权校验)
 * - listSharesBySourceKey:列出源 Key 的所有分享(带归属权校验)
 * - listSharesByUser:列出当前用户创建的所有分享(跨 Key)
 * - incrementUsage:原子递增 used_total_tokens
 * - cleanupExpired:删除已过期 30 天的记录(定时任务用)
 *
 * 读写分离:写用 db,读用 dbRead(参照 developer-api-keys-service.ts 模式)。
 * 类型约束:禁止 any,所有输入输出显式类型标注。
 */
import { randomBytes } from 'node:crypto'
import { eq, and, lt, isNull, isNotNull, or, desc, sql } from 'drizzle-orm'
import { db, dbRead } from '../db/index.js'
// NOTE:apiKeyShares 由本任务新增,主 agent 后续在 schema/index.ts 统一 export 后,
// `@ihui/database` 会自动导出 apiKeyShares / ApiKeyShare(与 apiKeyGroups 模式一致)。
// 当前 typecheck 会因 schema/index.ts 未注册而报 TS2305,主 agent 注册后即通过。
import { apiKeyShares, developerApiKeys } from '@ihui/database'
import type { ApiKeyShare, DeveloperApiKey } from '@ihui/database'

/** 创建分享入参(由 zod schema 校验后传入,字段均可空类型用 unknown 防御)。 */
export interface CreateShareInput {
  /** 源 API Key ID(被分享的 Key) */
  sourceApiKeyId: string
  /** 创建者用户 ID */
  createdBy: string
  /** 被分享给的用户 ID(null = 公开分享链接) */
  sharedWithUserId?: string | null
  /** 允许调用的模型列表(null = 继承源 Key) */
  scopeModels?: string[] | null
  /** 允许的端点(chat/embeddings/image),null = 全部 */
  scopeEndpoints?: string[] | null
  /** 每分钟请求上限(默认 60) */
  rateLimitRpm?: number
  /** 每分钟 token 上限(默认 100000) */
  rateLimitTpm?: number
  /** 总 token 上限(null = 无限) */
  maxTotalTokens?: number | null
  /** 过期时间(必填) */
  expiresAt: Date
}

/** 创建结果:分享记录 + share_token(仅此一次完整返回)。 */
export interface CreatedShare {
  share: ApiKeyShare
  /** share_token(用户用这个当 API key 调用,仅创建时返回完整值) */
  shareToken: string
}

/** getShareByToken 返回:分享记录 + 源 Key(用于运行时鉴权继承源 Key 配置)。 */
export interface ShareWithSource extends ApiKeyShare {
  /** 源 API Key 完整记录(用于继承 allowedModels / tokenBalance 等配置) */
  sourceKey: DeveloperApiKey
}

/** 生成 64 字符 hex 的 share_token(crypto.randomBytes 32 字节)。 */
function generateShareToken(): string {
  return randomBytes(32).toString('hex')
}

/**
 * 创建 API Key 分享(带源 Key 归属权校验)。
 * 校验:sourceApiKeyId 必须归属 createdBy 用户,否则返回 null。
 * @returns { share: 完整行, shareToken: 明文 token(仅此一次返回) };源 Key 不存在或不归属返回 null。
 */
export async function createShare(input: CreateShareInput): Promise<CreatedShare | null> {
  // 归属权校验:源 Key 必须归属创建者
  const [sourceKey] = await dbRead
    .select({ id: developerApiKeys.id, userId: developerApiKeys.userId })
    .from(developerApiKeys)
    .where(eq(developerApiKeys.id, input.sourceApiKeyId))
    .limit(1)
  if (!sourceKey || sourceKey.userId !== input.createdBy) return null

  const shareToken = generateShareToken()
  const [record] = await db
    .insert(apiKeyShares)
    .values({
      sourceApiKeyId: input.sourceApiKeyId,
      createdBy: input.createdBy,
      shareToken,
      sharedWithUserId: input.sharedWithUserId ?? null,
      scopeModels: input.scopeModels ?? null,
      scopeEndpoints: input.scopeEndpoints ?? null,
      rateLimitRpm: input.rateLimitRpm ?? 60,
      rateLimitTpm: input.rateLimitTpm ?? 100000,
      maxTotalTokens: input.maxTotalTokens ?? null,
      expiresAt: input.expiresAt,
    })
    .returning()
  if (!record) throw new Error('创建 API Key 分享失败')
  return { share: record, shareToken }
}

/**
 * 根据 share_token 查询有效分享(未过期 + 未撤销)。
 * 返回分享记录 + 源 Key 完整信息(用于运行时鉴权继承源 Key 配置)。
 * @returns 不存在/已过期/已撤销返回 null。
 */
export async function getShareByToken(token: string): Promise<ShareWithSource | null> {
  const [row] = await dbRead
    .select({
      share: apiKeyShares,
      sourceKey: developerApiKeys,
    })
    .from(apiKeyShares)
    .innerJoin(developerApiKeys, eq(apiKeyShares.sourceApiKeyId, developerApiKeys.id))
    .where(
      and(
        eq(apiKeyShares.shareToken, token),
        isNull(apiKeyShares.revokedAt),
        // 未过期:expiresAt > now()
        sql`${apiKeyShares.expiresAt} > now()`,
      ),
    )
    .limit(1)
  if (!row) return null
  return { ...row.share, sourceKey: row.sourceKey }
}

/**
 * 撤销分享(带归属权校验)。
 * 仅创建者(createdBy)可撤销自己的分享。
 * @returns true=撤销成功;false=不存在或不归属。
 */
export async function revokeShare(shareId: string, userId: string): Promise<boolean> {
  const [existing] = await dbRead
    .select({ id: apiKeyShares.id, createdBy: apiKeyShares.createdBy })
    .from(apiKeyShares)
    .where(eq(apiKeyShares.id, shareId))
    .limit(1)
  if (!existing || existing.createdBy !== userId) return false
  // 已撤销的也允许重复撤销(idempotent),只是 updated_at 会刷新
  const [updated] = await db
    .update(apiKeyShares)
    .set({ revokedAt: new Date(), updatedAt: new Date() })
    .where(eq(apiKeyShares.id, shareId))
    .returning({ id: apiKeyShares.id })
  return updated !== undefined
}

/**
 * 列出源 Key 的所有分享(带归属权校验)。
 * 仅源 Key 持有者可查看(通过 sourceApiKeyId 反查 userId 比对)。
 * @returns 分享列表(按创建时间倒序);源 Key 不存在或不归属返回 null。
 */
export async function listSharesBySourceKey(
  apiKeyId: string,
  userId: string,
): Promise<ApiKeyShare[] | null> {
  // 归属权校验:源 Key 必须归属 userId
  const [sourceKey] = await dbRead
    .select({ id: developerApiKeys.id, userId: developerApiKeys.userId })
    .from(developerApiKeys)
    .where(eq(developerApiKeys.id, apiKeyId))
    .limit(1)
  if (!sourceKey || sourceKey.userId !== userId) return null

  return dbRead
    .select()
    .from(apiKeyShares)
    .where(eq(apiKeyShares.sourceApiKeyId, apiKeyId))
    .orderBy(desc(apiKeyShares.createdAt))
}

/**
 * 列出当前用户创建的所有分享(跨 Key)。
 * @returns 分享列表(按创建时间倒序)。
 */
export async function listSharesByUser(userId: string): Promise<ApiKeyShare[]> {
  return dbRead
    .select()
    .from(apiKeyShares)
    .where(eq(apiKeyShares.createdBy, userId))
    .orderBy(desc(apiKeyShares.createdAt))
}

/**
 * 原子递增分享的 used_total_tokens(运行时调用 LLM 后回写)。
 * 用 SQL 表达式原子递增,避免读-改-写竞态。
 * @returns true=递增成功;false=分享不存在。
 */
export async function incrementUsage(shareId: string, tokens: number): Promise<boolean> {
  if (tokens < 0) throw new Error('递增 token 数不能为负数')
  const [updated] = await db
    .update(apiKeyShares)
    .set({
      usedTotalTokens: sql`${apiKeyShares.usedTotalTokens} + ${tokens}`,
      updatedAt: new Date(),
    })
    .where(eq(apiKeyShares.id, shareId))
    .returning({ id: apiKeyShares.id })
  return updated !== undefined
}

/**
 * 清理已过期 30 天的分享记录(定时任务用)。
 * 删除 revoked_at IS NOT NULL 或 expires_at < now() - interval '30 days' 的记录。
 * @returns 删除的记录数。
 */
export async function cleanupExpired(): Promise<number> {
  const result = await db
    .delete(apiKeyShares)
    .where(
      or(
        // 已撤销的记录
        isNotNull(apiKeyShares.revokedAt),
        // 已过期超过 30 天的记录
        lt(apiKeyShares.expiresAt, sql`now() - interval '30 days'`),
      ),
    )
    .returning({ id: apiKeyShares.id })
  return result.length
}
