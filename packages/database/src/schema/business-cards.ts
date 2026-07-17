import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  index,
  unique,
} from 'drizzle-orm/pg-core'
import { users } from './users.js'

export const businessCards = pgTable(
  'business_cards',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    name: varchar('name', { length: 100 }).notNull(),
    title: varchar('title', { length: 100 }),
    company: varchar('company', { length: 200 }),
    phone: varchar('phone', { length: 20 }),
    email: varchar('email', { length: 200 }),
    avatar: varchar('avatar', { length: 500 }),
    intro: text('intro'),
    qrCode: varchar('qr_code', { length: 500 }),
    isPublic: boolean('is_public').default(true).notNull(),
    viewCount: integer('view_count').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index('business_cards_user_idx').on(t.userId),
  }),
)

export const businessCardFavorites = pgTable(
  'business_card_favorites',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    cardId: uuid('card_id')
      .references(() => businessCards.id, { onDelete: 'cascade' })
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userCardIdx: unique('bcf_user_card_unique').on(t.userId, t.cardId),
  }),
)

export type BusinessCard = typeof businessCards.$inferSelect
export type NewBusinessCard = typeof businessCards.$inferInsert
export type BusinessCardFavorite = typeof businessCardFavorites.$inferSelect
export type NewBusinessCardFavorite = typeof businessCardFavorites.$inferInsert
