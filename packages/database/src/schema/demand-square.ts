import { pgTable, uuid, varchar, text, timestamp, index, numeric, jsonb } from 'drizzle-orm/pg-core'

export const zhsDemandSquare = pgTable(
  'zhs_demand_square',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: varchar('user_id', { length: 64 }).notNull(),
    type: varchar('type', { length: 20 }).notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description'),
    lowestPrice: numeric('lowest_price', { precision: 12, scale: 2 }),
    peakPrice: numeric('peak_price', { precision: 12, scale: 2 }),
    contact: varchar('contact', { length: 200 }),
    cycle: varchar('cycle', { length: 50 }),
    cycleUnit: varchar('cycle_unit', { length: 20 }),
    closingTime: timestamp('closing_time', { withTimezone: true }),
    types: jsonb('types').$type<string[]>(),
    categories: jsonb('categories').$type<string[]>(),
    status: varchar('status', { length: 20 }).notNull().default('pending'),
    taskStatus: varchar('task_status', { length: 20 }).notNull().default('waiting'),
    rejectReason: varchar('reject_reason', { length: 500 }),
    reviewedBy: varchar('reviewed_by', { length: 64 }),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    statusIdx: index('zhs_demand_square_status_idx').on(t.status),
    typeIdx: index('zhs_demand_square_type_idx').on(t.type),
  }),
)

export type ZhsDemandSquare = typeof zhsDemandSquare.$inferSelect
export type NewZhsDemandSquare = typeof zhsDemandSquare.$inferInsert
