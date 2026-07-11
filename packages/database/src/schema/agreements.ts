import { pgTable, uuid, varchar, text, integer, timestamp, index } from 'drizzle-orm/pg-core'
import { users } from './users.js'

// 用户协议表 - 动态管理注册/登录协议
// API: /api/agreements/current (公共查询) + /api/admin/agreements (CRUD)
export const agreements = pgTable(
  'agreements',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    type: varchar('type', { length: 32 }).notNull(), // user-agreement/privacy-policy/terms-of-service
    title: varchar('title', { length: 255 }).notNull(),
    content: text('content').notNull(),
    version: varchar('version', { length: 32 }).notNull(), // 协议版本号
    effectiveDate: timestamp('effective_date', { withTimezone: true }).notNull(),
    status: integer('status').default(1).notNull(), // 1-生效 0-失效
    publishedBy: uuid('published_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    typeIdx: index('agreements_type_idx').on(t.type),
    statusIdx: index('agreements_status_idx').on(t.status),
  }),
)

export type Agreement = typeof agreements.$inferSelect
export type NewAgreement = typeof agreements.$inferInsert
