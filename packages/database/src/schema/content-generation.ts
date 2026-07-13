import { pgTable, uuid, varchar, text, integer, timestamp, index } from 'drizzle-orm/pg-core'
import { users } from './users.js'

/**
 * 内容生成任务表 (content_generation_tasks) - AI 内容生成请求记录。
 * - status: 0=pending 1=done 2=failed
 * - templateId: 关联模板(可选)
 * - input/output: 输入提示与生成结果
 */
export const contentGenerationTasks = pgTable(
  'content_generation_tasks',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    templateId: uuid('template_id'),
    input: text('input'),
    output: text('output'),
    status: integer('status').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index('content_generation_tasks_user_idx').on(t.userId),
  }),
)

/**
 * 内容生成模板表 (content_generation_templates) - 预置提示词模板。
 * - status: 1=启用 0=禁用
 */
export const contentGenerationTemplates = pgTable('content_generation_templates', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  prompt: text('prompt'),
  category: varchar('category', { length: 50 }),
  status: integer('status').default(1).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export type ContentGenerationTask = typeof contentGenerationTasks.$inferSelect
export type NewContentGenerationTask = typeof contentGenerationTasks.$inferInsert
export type ContentGenerationTemplate = typeof contentGenerationTemplates.$inferSelect
export type NewContentGenerationTemplate = typeof contentGenerationTemplates.$inferInsert
