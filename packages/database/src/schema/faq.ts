import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  jsonb,
  timestamp,
  index,
} from 'drizzle-orm/pg-core'

export const zhsFaqCategory = pgTable('zhs_faq_category', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 64 }).notNull(),
  slug: varchar('slug', { length: 64 }).notNull().unique(),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const zhsFaq = pgTable(
  'zhs_faq',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    categoryId: uuid('category_id').notNull(),
    question: varchar('question', { length: 200 }).notNull(),
    answer: text('answer').notNull(),
    keywords: jsonb('keywords').notNull().default([]),
    pinned: boolean('pinned').notNull().default(false),
    published: boolean('published').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    categoryIdx: index('zhs_faq_category_id_idx').on(t.categoryId),
    pinnedIdx: index('zhs_faq_pinned_idx').on(t.pinned),
  }),
)

export type ZhsFaqCategory = typeof zhsFaqCategory.$inferSelect
export type NewZhsFaqCategory = typeof zhsFaqCategory.$inferInsert
export type ZhsFaq = typeof zhsFaq.$inferSelect
export type NewZhsFaq = typeof zhsFaq.$inferInsert
