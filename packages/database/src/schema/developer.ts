import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  numeric,
  jsonb,
  timestamp,
  index,
} from 'drizzle-orm/pg-core'
import { users } from './users.js'

export const developerApplications = pgTable(
  'developer_applications',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 100 }).notNull(),
    description: text('description'),
    status: integer('status').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index('ix_developer_applications_user').on(t.userId),
    statusIdx: index('ix_developer_applications_status').on(t.status),
  }),
)

export const developerPricing = pgTable(
  'developer_pricing',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 100 }).notNull(),
    price: numeric('price', { precision: 10, scale: 2 }).notNull(),
    period: varchar('period', { length: 50 }),
    features: jsonb('features').notNull().default([]),
    status: integer('status').default(1).notNull(),
    sort: integer('sort').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    statusIdx: index('ix_developer_pricing_status').on(t.status),
  }),
)

export type DeveloperApplication = typeof developerApplications.$inferSelect
export type NewDeveloperApplication = typeof developerApplications.$inferInsert
export type DeveloperPricing = typeof developerPricing.$inferSelect
export type NewDeveloperPricing = typeof developerPricing.$inferInsert
