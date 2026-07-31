import {
  pgTable,
  uuid,
  varchar,
  integer,
  bigint,
  timestamp,
  text,
  index,
} from 'drizzle-orm/pg-core'
import { developerApiKeys } from './developer-api-keys.js'
import { users } from './users.js'

/**
 * API Key 临时分享/限时 token 表(2026-08-01 立,B 端协作场景高频需求)。
 *
 * 允许用户为自己的 developer_api_key 生成限时分享 token 给他人使用:
 * - share_token 作为 API key 调用(独立于源 Key 的速率/配额)
 * - scope_models / scope_endpoints 限定调用范围(null = 继承源 Key / 全部端点)
 * - rate_limit_rpm / rate_limit_tpm 独立限流(不占源 Key 配额)
 * - max_total_tokens 总 token 上限(null = 无限),used_total_tokens 累计递增
 * - expires_at 必填,过期自动失效;revoked_at 手动撤销
 *
 * 关联:source_api_key_id → developer_api_keys(级联删除);
 *      shared_with_user_id → users(SET NULL,null = 公开分享链接);
 *      created_by → users(创建者,删除时 RESTRICT)。
 *
 * 迁移文件:packages/database/drizzle/20260801010040_add_api_key_shares_table.sql
 */
export const apiKeyShares = pgTable(
  'api_key_shares',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    /** 源 API Key(被分享的 Key),删除源 Key 级联删除所有分享 */
    sourceApiKeyId: uuid('source_api_key_id')
      .references(() => developerApiKeys.id, { onDelete: 'cascade' })
      .notNull(),
    /** 被分享给的用户 ID(null = 公开分享链接,任何拿到 token 的人都可用) */
    sharedWithUserId: uuid('shared_with_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    /** 限时分享 token(用户用这个当 API key 调用),64 字符 hex,全局唯一 */
    shareToken: varchar('share_token', { length: 64 }).notNull().unique(),
    /** 允许调用的模型列表(null = 继承源 Key 的 allowedModels) */
    scopeModels: text('scope_models').array(),
    /** 允许的端点(chat/embeddings/image),null = 全部 */
    scopeEndpoints: text('scope_endpoints').array(),
    /** 每分钟请求上限(独立于源 Key,默认 60) */
    rateLimitRpm: integer('rate_limit_rpm').default(60).notNull(),
    /** 每分钟 token 上限(独立于源 Key,默认 100000) */
    rateLimitTpm: integer('rate_limit_tpm').default(100000).notNull(),
    /** 总 token 上限(null = 无限) */
    maxTotalTokens: bigint('max_total_tokens', { mode: 'number' }),
    /** 已用 token 累计(用于统计,不回退) */
    usedTotalTokens: bigint('used_total_tokens', { mode: 'number' }).default(0).notNull(),
    /** 过期时间(必填,过期自动失效) */
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    /** 手动撤销时间(null = 未撤销) */
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    /** 创建者(源 Key 持有者) */
    createdBy: uuid('created_by')
      .references(() => users.id, { onDelete: 'restrict' })
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    // 仅未撤销的 token 走索引(活跃分享查询主路径)
    tokenIdx: index('idx_api_key_shares_token').on(t.shareToken),
    sourceIdx: index('idx_api_key_shares_source').on(t.sourceApiKeyId),
    expiresIdx: index('idx_api_key_shares_expires').on(t.expiresAt),
  }),
)

export type ApiKeyShare = typeof apiKeyShares.$inferSelect
export type NewApiKeyShare = typeof apiKeyShares.$inferInsert
