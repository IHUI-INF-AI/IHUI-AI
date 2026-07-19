import { pgTable, uuid, varchar, integer, timestamp, index } from 'drizzle-orm/pg-core'

// 敏感词表 - 用于 UGC 内容审核
// API: /api/admin/sensitive-words (CRUD + 内容过滤)
export const sensitiveWords = pgTable(
  'sensitive_words',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    word: varchar('word', { length: 128 }).notNull(), // 敏感词
    category: varchar('category', { length: 32 }).default('default').notNull(), // 分类：politics/explicit/ads/harassment 等(中性 ID,避免敏感词进 LLM 上下文)
    level: integer('level').default(1).notNull(), // 级别：1-替换 2-拦截 3-禁言
    replacement: varchar('replacement', { length: 128 }).default('***'), // 替换文本
    status: integer('status').default(1).notNull(), // 1-启用 0-禁用
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    wordIdx: index('sensitive_words_word_idx').on(t.word),
    categoryIdx: index('sensitive_words_category_idx').on(t.category),
  }),
)

export type SensitiveWord = typeof sensitiveWords.$inferSelect
export type NewSensitiveWord = typeof sensitiveWords.$inferInsert
