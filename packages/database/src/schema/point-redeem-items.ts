import { pgTable, uuid, varchar, integer, timestamp, index } from 'drizzle-orm/pg-core'

/**
 * 积分兑换商品表。
 */
export const pointRedeemItems = pgTable(
  'point_redeem_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 100 }).notNull(),
    points: integer('points').default(0).notNull(),
    image: varchar('image', { length: 500 }),
    sortOrder: integer('sort_order').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    sortIdx: index('point_redeem_items_sort_idx').on(t.sortOrder),
  }),
)

export type PointRedeemItem = typeof pointRedeemItems.$inferSelect
export type NewPointRedeemItem = typeof pointRedeemItems.$inferInsert
