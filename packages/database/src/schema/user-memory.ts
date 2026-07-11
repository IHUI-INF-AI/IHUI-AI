import { pgTable, uuid, varchar, text, timestamp, jsonb, integer, index } from 'drizzle-orm/pg-core'

/**
 * 用户记忆表（user_memories）。
 *
 * 用于 AI 对话中的长期记忆持久化：记录用户的偏好、事实、历史事件等，
 * 让 AI 能跨会话记住用户特征，实现个性化对话。
 *
 * - memory_type: preference(偏好) / fact(事实) / event(事件) / skill(技能) / relationship(关系)
 * - importance: 0-100 重要度评分，影响检索排序与遗忘策略
 * - status: active(活跃) / archived(归档) / forgotten(已遗忘)
 * - metadata: 结构化附加字段（jsonb）
 */
export const userMemories = pgTable(
  'user_memories',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull(),
    memoryType: varchar('memory_type', { length: 32 }).notNull(),
    content: text('content').notNull(),
    summary: varchar('summary', { length: 500 }),
    importance: integer('importance').default(50).notNull(),
    status: varchar('status', { length: 32 }).default('active').notNull(),
    source: varchar('source', { length: 64 }),
    metadata: jsonb('metadata').notNull().default({}),
    lastAccessedAt: timestamp('last_accessed_at', { withTimezone: true }),
    accessCount: integer('access_count').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdIdx: index('user_memories_user_idx').on(t.userId),
    typeIdx: index('user_memories_type_idx').on(t.memoryType),
    statusIdx: index('user_memories_status_idx').on(t.status),
    importanceIdx: index('user_memories_importance_idx').on(t.importance),
  }),
)

export type UserMemory = typeof userMemories.$inferSelect
export type NewUserMemory = typeof userMemories.$inferInsert
