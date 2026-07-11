import {
  pgTable,
  uuid,
  varchar,
  integer,
  boolean,
  jsonb,
  timestamp,
  index,
} from 'drizzle-orm/pg-core'

export const zhsZone = pgTable(
  'zhs_zone',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 64 }).notNull(),
    code: varchar('code', { length: 32 }).notNull().unique(),
    parentId: uuid('parent_id'),
    level: integer('level').notNull().default(0),
    sortOrder: integer('sort_order').notNull().default(0),
    enabled: boolean('enabled').notNull().default(true),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    parentIdx: index('zhs_zone_parent_idx').on(t.parentId),
    levelIdx: index('zhs_zone_level_idx').on(t.level),
  }),
)

export type ZhsZone = typeof zhsZone.$inferSelect
export type NewZhsZone = typeof zhsZone.$inferInsert
