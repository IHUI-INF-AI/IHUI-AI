import { pgTable, uuid, varchar, text, integer, timestamp, jsonb } from 'drizzle-orm/pg-core'
import { users } from './users.js'

/**
 * Stock 分析记录表。
 * 一次分析对应一行：股票代码、用户问题、AI 返回的分析文本、消耗 token 等。
 */
export const stockAnalyses = pgTable('stock_analyses', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  symbol: varchar('symbol', { length: 32 }).notNull(),
  question: text('question').notNull(),
  analysis: text('analysis').notNull(),
  model: varchar('model', { length: 64 }),
  conversationId: varchar('conversation_id', { length: 64 }),
  tokensUsed: integer('tokens_used').default(0).notNull(),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export type StockAnalysisRecord = typeof stockAnalyses.$inferSelect
export type NewStockAnalysisRecord = typeof stockAnalyses.$inferInsert
