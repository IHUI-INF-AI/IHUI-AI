import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  index,
} from 'drizzle-orm/pg-core'

/**
 * AI Feed 文章表 - 区别于 ai-feed.ts 中的 hot_item(抓取条目),
 * 此表存储编辑发布的 AI 资讯文章。
 */
export const aiFeedPosts = pgTable(
  'ai_feed_posts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    title: varchar('title', { length: 200 }).notNull(),
    content: text('content'),
    coverImage: varchar('cover_image', { length: 500 }),
    authorId: uuid('author_id'),
    viewCount: integer('view_count').default(0).notNull(),
    likeCount: integer('like_count').default(0).notNull(),
    isPublished: boolean('is_published').default(false).notNull(),
    status: integer('status').default(1).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    publishedIdx: index('ix_ai_feed_posts_published').on(t.isPublished),
  }),
)

export type AiFeedPost = typeof aiFeedPosts.$inferSelect
export type NewAiFeedPost = typeof aiFeedPosts.$inferInsert
