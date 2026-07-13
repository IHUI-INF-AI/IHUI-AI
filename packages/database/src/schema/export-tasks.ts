import { pgTable, uuid, varchar, integer, timestamp, index } from 'drizzle-orm/pg-core'
import { users } from './users.js'

/**
 * 用户数据导出任务表 (export_tasks) - 异步导出用户个人数据。
 * - type: 导出类型(user_data/order_data 等)
 * - status: 0=pending 1=done 2=failed
 * - fileUrl: 导出文件可下载地址(完成前为 null)
 * - completedAt: 完成时间(完成前为 null)
 */
export const exportTasks = pgTable(
  'export_tasks',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: varchar('type', { length: 50 }).notNull(),
    status: integer('status').default(0).notNull(),
    fileUrl: varchar('file_url', { length: 500 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (t) => ({
    userIdx: index('export_tasks_user_idx').on(t.userId),
  }),
)

export type ExportTask = typeof exportTasks.$inferSelect
export type NewExportTask = typeof exportTasks.$inferInsert
