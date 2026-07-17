import { pgTable, uuid, varchar, text, timestamp, index, unique } from 'drizzle-orm/pg-core'
import { users } from './users.js'

/**
 * AI 生成图片收藏表(存储 prompt + imageUrl 快照,避免依赖 aiGcContent 的 content 字段解析)。
 */
export const imageGenFavorites = pgTable(
  'image_gen_favorites',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    prompt: text('prompt').notNull(),
    imageUrl: varchar('image_url', { length: 1000 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index('image_gen_favorites_user_idx').on(t.userId),
    userUrlIdx: unique('igf_user_url_unique').on(t.userId, t.imageUrl),
  }),
)

export type ImageGenFavorite = typeof imageGenFavorites.$inferSelect
export type NewImageGenFavorite = typeof imageGenFavorites.$inferInsert
