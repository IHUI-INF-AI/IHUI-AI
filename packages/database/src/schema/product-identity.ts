import { pgTable, uuid, varchar, text, timestamp, index } from 'drizzle-orm/pg-core'

/**
 * 产品标识管理表。
 * type: 'app_id' / 'package_name' / 'bundle_id' / 'scheme' / 'deeplink' 等标识类型。
 * status: 'active'(启用) / 'disabled'(已禁用)。
 * code: 业务编码（唯一标识）。value: 标识值。
 */
export const productIdentities = pgTable(
  'product_identities',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 100 }).notNull(),
    code: varchar('code', { length: 64 }).notNull().unique(),
    type: varchar('type', { length: 32 }).notNull(),
    value: varchar('value', { length: 255 }).notNull(),
    description: text('description'),
    status: varchar('status', { length: 20 }).default('active').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    typeIdx: index('product_identities_type_idx').on(t.type),
    statusIdx: index('product_identities_status_idx').on(t.status),
  }),
)

export type ProductIdentity = typeof productIdentities.$inferSelect
export type NewProductIdentity = typeof productIdentities.$inferInsert
