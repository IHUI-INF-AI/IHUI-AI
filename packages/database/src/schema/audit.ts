import { pgTable, uuid, varchar, integer, timestamp, jsonb, index } from 'drizzle-orm/pg-core'
import { users } from './users.js'

/**
 * 操作审计日志表。
 * 由 plugins/audit.ts 的 onResponse 钩子异步写入，记录所有 POST/PATCH/PUT/DELETE 写请求。
 * user_id 可空（用于未鉴权的写操作或系统操作）；用户删除时保留审计记录，userId 置 NULL。
 *
 * 索引声明对齐 migration 0060(R70 分区表已创建,父表索引自动传播到所有子分区)。
 */
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    action: varchar('action', { length: 32 }).notNull(),
    resourceType: varchar('resource_type', { length: 64 }),
    resourceId: varchar('resource_id', { length: 64 }),
    details: jsonb('details').default({}),
    ip: varchar('ip', { length: 64 }),
    userAgent: varchar('user_agent', { length: 512 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdIdx: index('idx_audit_logs_user_id').on(t.userId),
    actionIdx: index('idx_audit_logs_action').on(t.action),
    resourceIdx: index('idx_audit_logs_resource').on(t.resourceType, t.resourceId),
    createdAtIdx: index('idx_audit_logs_created_at').on(t.createdAt),
  }),
)

/**
 * 搜索历史表。
 * 每次 GET /api/search 异步记录用户查询条件与命中数，用于搜索历史回放。
 */
export const searchHistory = pgTable(
  'search_history',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    query: varchar('query', { length: 255 }).notNull(),
    filters: jsonb('filters').default({}),
    resultsCount: integer('results_count').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdIdx: index('search_history_user_idx').on(t.userId),
  }),
)

export type AuditLog = typeof auditLogs.$inferSelect
export type NewAuditLog = typeof auditLogs.$inferInsert
export type SearchHistory = typeof searchHistory.$inferSelect
export type NewSearchHistory = typeof searchHistory.$inferInsert
