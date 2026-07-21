import { pgTable, uuid, varchar, text, boolean, integer, timestamp, index } from 'drizzle-orm/pg-core'
import { users } from './users.js'

/**
 * 用户自定义 AI 对话框技能表 (user_chat_skills) - 2026-07-21 新增
 * AI 对话框的 Skill 库统一面板允许用户自定义技能,填到 textarea 后即可调用。
 *
 * 字段说明:
 * - category:  来源分类(template / slash / self-media / openclaw / mcp / custom)
 * - scenario:  场景分类(writing / coding / media / tool / custom)
 * - prompt:    模板内容(点击 Skill 时填到 textarea 的内容)
 * - icon:      lucide 图标名(前端用 lucide-react 动态解析)
 * - sortOrder: 列表排序(数字越小越靠前,默认 0)
 * - enabled:   启停(false 时前端不显示)
 */
export const userChatSkills = pgTable(
  'user_chat_skills',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 128 }).notNull(),
    category: varchar('category', { length: 32 }).notNull().default('custom'),
    scenario: varchar('scenario', { length: 32 }).notNull().default('custom'),
    prompt: text('prompt').notNull(),
    icon: varchar('icon', { length: 64 }),
    sortOrder: integer('sort_order').notNull().default(0),
    enabled: boolean('enabled').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index('user_chat_skills_user_idx').on(t.userId),
    userEnabledIdx: index('user_chat_skills_user_enabled_idx').on(t.userId, t.enabled),
  }),
)

export type UserChatSkill = typeof userChatSkills.$inferSelect
export type NewUserChatSkill = typeof userChatSkills.$inferInsert
