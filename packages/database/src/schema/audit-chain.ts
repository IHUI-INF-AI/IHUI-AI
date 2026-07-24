import { pgTable, uuid, varchar, timestamp, jsonb, char, index } from 'drizzle-orm/pg-core';
import { users } from './users.js';

/**
 * 国安级审计日志链表。
 * 独立于现有 audit_logs 表,采用 prev_hash/current_hash 链式结构保证日志不可篡改。
 * user_id 可空(未鉴权的写操作或系统操作);用户删除时保留审计记录,userId 置 NULL。
 */
export const auditLogsChain = pgTable(
  'audit_logs_chain',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    timestamp: timestamp('timestamp', { withTimezone: true }).notNull(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    action: varchar('action', { length: 64 }).notNull(),
    resourceType: varchar('resource_type', { length: 64 }),
    resourceId: varchar('resource_id', { length: 64 }),
    ip: varchar('ip', { length: 64 }),
    userAgent: varchar('user_agent', { length: 512 }),
    result: varchar('result', { length: 32 }),
    metadata: jsonb('metadata').default({}),
    prevHash: char('prev_hash', { length: 64 }).notNull(),
    currentHash: char('current_hash', { length: 64 }).notNull(),
  },
  (t) => ({
    tsIdx: index('idx_audit_chain_ts').on(t.timestamp),
    userIdx: index('idx_audit_chain_user').on(t.userId),
    actIdx: index('idx_audit_chain_act').on(t.action),
  }),
);

export type AuditLogChain = typeof auditLogsChain.$inferSelect;
export type NewAuditLogChain = typeof auditLogsChain.$inferInsert;
