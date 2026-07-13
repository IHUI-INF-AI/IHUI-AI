import { pgTable, uuid, varchar, integer, text, timestamp, index } from 'drizzle-orm/pg-core'
import { users } from './users.js'

/**
 * 智能体评价表。
 * - agentId: 关联 agents.agentId（逻辑关联，未做物理外键以避免跨文件 FK 顺序依赖）。
 * - rating: 1-5 星评分。
 */
export const agentReviews = pgTable(
  'agent_reviews',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    agentId: varchar('agent_id', { length: 100 }).notNull(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    rating: integer('rating').notNull(),
    content: text('content'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    agentIdx: index('ix_agent_reviews_agent').on(t.agentId),
    userIdx: index('ix_agent_reviews_user').on(t.userId),
  }),
)

export type AgentReview = typeof agentReviews.$inferSelect
export type NewAgentReview = typeof agentReviews.$inferInsert
