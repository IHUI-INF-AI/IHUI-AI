import {
  pgTable,
  uuid,
  varchar,
  boolean,
  timestamp,
  index,
} from 'drizzle-orm/pg-core'
import { users } from './users.js'

/**
 * 用户收货地址表。
 */
export const userAddresses = pgTable(
  'user_addresses',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    recipientName: varchar('recipient_name', { length: 100 }).notNull(),
    phone: varchar('phone', { length: 20 }).notNull(),
    province: varchar('province', { length: 50 }).notNull(),
    city: varchar('city', { length: 50 }).notNull(),
    district: varchar('district', { length: 50 }).notNull(),
    detail: varchar('detail', { length: 500 }).notNull(),
    postalCode: varchar('postal_code', { length: 20 }),
    isDefault: boolean('is_default').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index('user_addresses_user_idx').on(t.userId),
  }),
)

export type UserAddress = typeof userAddresses.$inferSelect
export type NewUserAddress = typeof userAddresses.$inferInsert
