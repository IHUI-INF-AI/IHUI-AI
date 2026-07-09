import { pgTable, uuid, varchar, integer, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { users } from './users.js';

/**
 * 操作审计日志表。
 * 由 plugins/audit.ts 的 onResponse 钩子异步写入，记录所有 POST/PATCH/PUT/DELETE 写请求。
 * user_id 可空（用于未鉴权的写操作或系统操作）；用户删除时级联删除其审计记录。
 */
export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  action: varchar('action', { length: 32 }).notNull(),
  resourceType: varchar('resource_type', { length: 64 }),
  resourceId: varchar('resource_id', { length: 64 }),
  details: jsonb('details'),
  ip: varchar('ip', { length: 64 }),
  userAgent: varchar('user_agent', { length: 512 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * 搜索历史表。
 * 每次 GET /api/search 异步记录用户查询条件与命中数，用于搜索历史回放。
 */
export const searchHistory = pgTable('search_history', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  query: varchar('query', { length: 255 }).notNull(),
  filters: jsonb('filters'),
  resultsCount: integer('results_count').default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
export type SearchHistory = typeof searchHistory.$inferSelect;
export type NewSearchHistory = typeof searchHistory.$inferInsert;
