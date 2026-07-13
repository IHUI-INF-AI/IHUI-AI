import { pgTable, uuid, varchar, text, integer, timestamp, index } from 'drizzle-orm/pg-core'
import { users } from './users.js'

/**
 * Workspace-AI 任务表 - 记录 AI 组件生成 / Agentic 任务。
 * status: 0=pending 1=running 2=done 3=failed
 */
export const workspaceAiTasks = pgTable(
  'workspace_ai_tasks',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: varchar('type', { length: 50 }).notNull(),
    input: text('input'),
    output: text('output'),
    status: integer('status').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (t) => ({
    userIdx: index('ix_workspace_ai_tasks_user').on(t.userId),
    statusIdx: index('ix_workspace_ai_tasks_status').on(t.status),
  }),
)

export type WorkspaceAiTask = typeof workspaceAiTasks.$inferSelect
export type NewWorkspaceAiTask = typeof workspaceAiTasks.$inferInsert
