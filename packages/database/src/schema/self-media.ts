import { pgTable, uuid, varchar, timestamp, jsonb } from 'drizzle-orm/pg-core'
import { users } from './users.js'

/**
 * 自媒体已发布内容记忆表(self_media_published)。
 *
 * 来源:迁移自源项目 `F:\BaiduSyncdisk\自媒体\公众号\wechat-article-system\已发布内容记忆.json`
 * 与 `口播稿\koubo\materials\已发布内容记忆.json`,统一存数据库供 ai-service 查询。
 *
 * category: 'wechat' = 公众号文章 / 'koubo' = 抖音口播稿
 * status:   'generated' = 已生成草稿 / 'published' = 已正式发布 / 'failed' = 流水线失败
 *
 * payload: JSONB,存放原 JSON 文件中的扩展字段(image_registry / topic_keyword / draft_id 等)
 */
export const selfMediaPublished = pgTable('self_media_published', {
  id: uuid('id').defaultRandom().primaryKey(),
  category: varchar('category', { length: 16 }).notNull(),
  title: varchar('title', { length: 200 }).notNull(),
  status: varchar('status', { length: 16 }).default('generated').notNull(),
  draftId: varchar('draft_id', { length: 128 }),
  topicKeyword: varchar('topic_keyword', { length: 200 }),
  payload: jsonb('payload'),
  authorId: uuid('author_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export type SelfMediaPublished = typeof selfMediaPublished.$inferSelect
export type NewSelfMediaPublished = typeof selfMediaPublished.$inferInsert
