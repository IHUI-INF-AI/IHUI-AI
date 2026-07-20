import { pgTable, uuid, varchar, text, jsonb, timestamp, index } from 'drizzle-orm/pg-core'
import { users } from './users.js'

/**
 * 邮件发送审计日志。
 *
 * 用于:
 * - 失败排查(provider 拒信 / SMTP 连接错误 / SES 配额超限 等)
 * - 人工重发(查询 toEmail + subject 找到原 log 重投)
 * - 营销邮件退订(查询 toEmail 全部 log)
 * - 监控告警(按 status='failed' 聚合 + 5xx 告警)
 *
 * 字段约定(用 varchar 不用 pg enum,避免 enum 兼容性问题,与 notifications.ts 保持一致):
 * - provider: 'smtp' | 'resend' | 'tencent' | 'stub'
 * - status:   'sent' | 'stub' | 'failed'
 * - scene:    'register' | 'login' | 'reset' | 'transaction' | 'marketing' | 'notification' | 'other'
 */
export const emailLogs = pgTable(
  'email_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    toEmail: varchar('to_email', { length: 255 }).notNull(),
    subject: varchar('subject', { length: 500 }).notNull(),
    provider: varchar('provider', { length: 16 }).notNull(),
    status: varchar('status', { length: 16 }).notNull(),
    error: text('error'),
    scene: varchar('scene', { length: 32 }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    templateSlug: varchar('template_slug', { length: 64 }),
    messageId: varchar('message_id', { length: 200 }),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    toEmailIdx: index('email_logs_to_email_idx').on(t.toEmail),
    statusIdx: index('email_logs_status_idx').on(t.status),
    userIdIdx: index('email_logs_user_id_idx').on(t.userId),
    createdAtIdx: index('email_logs_created_at_idx').on(t.createdAt),
  }),
)

export type EmailLog = typeof emailLogs.$inferSelect
export type NewEmailLog = typeof emailLogs.$inferInsert
