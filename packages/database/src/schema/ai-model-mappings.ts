import { pgTable, uuid, varchar, integer, boolean, timestamp, index, unique } from 'drizzle-orm/pg-core'
import { users } from './users.js'
import { developerApiKeys } from './developer-api-keys.js'

/**
 * 模型映射表(2026-07-31 立,P0-4 降本神器)。
 * user_id = null 且 api_key_id = null → 全局映射(admin 配置,所有用户生效)
 * user_id != null 且 api_key_id = null → 用户级映射
 * api_key_id != null → Key 级映射(优先级最高)
 * 优先级:Key 级 > 用户级 > 全局
 */
export const aiModelMappings = pgTable(
  'ai_model_mappings',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    /** null = 全局映射(admin 配置) */
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    /** null = 用户级或全局,非 null = Key 级 */
    apiKeyId: uuid('api_key_id').references(() => developerApiKeys.id, { onDelete: 'cascade' }),
    /** 源模型名(客户端请求的 model,如 'gpt-4o') */
    sourceModel: varchar('source_model', { length: 128 }).notNull(),
    /** 目标模型名(实际调用的 model,如 'deepseek-chat') */
    targetModel: varchar('target_model', { length: 128 }).notNull(),
    /** 优先级(数字越大越优先,同级别按 created_at 排序) */
    priority: integer('priority').default(0).notNull(),
    /** 是否启用 */
    enabled: boolean('enabled').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    // 同一作用域内 source_model 唯一(全局/用户/Key 各自唯一)
    scopeUnique: unique('ai_model_mappings_scope_unique').on(t.userId, t.apiKeyId, t.sourceModel),
    sourceIdx: index('ai_model_mappings_source_idx').on(t.sourceModel),
    userIdx: index('ai_model_mappings_user_idx').on(t.userId),
    apiKeyIdx: index('ai_model_mappings_api_key_idx').on(t.apiKeyId),
  }),
)

export type AiModelMapping = typeof aiModelMappings.$inferSelect
export type NewAiModelMapping = typeof aiModelMappings.$inferInsert
