import { pgTable, uuid, varchar, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core'
import { users } from './users.js'

/**
 * 用户安全日志表 (security_logs) - 记录用户安全相关事件(登录/登出/改密/异常等)。
 * - action: 安全动作类型(如 login/logout/password_change 等)
 * - ip: 客户端 IP(v4/v6,45 足够)
 * - userAgent: 客户端 UA
 * - metadata: 附加 JSON 上下文
 */
export const securityLogs = pgTable(
  'security_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    action: varchar('action', { length: 100 }).notNull(),
    ip: varchar('ip', { length: 45 }),
    userAgent: text('user_agent'),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index('security_logs_user_idx').on(t.userId),
  }),
)

export type SecurityLog = typeof securityLogs.$inferSelect
export type NewSecurityLog = typeof securityLogs.$inferInsert
