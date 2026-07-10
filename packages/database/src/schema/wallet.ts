import { pgTable, uuid, varchar, integer, timestamp, primaryKey } from 'drizzle-orm/pg-core';
import { users } from './users.js';
export const userMargins = pgTable(
  'user_margins',
  {
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    tokenQuantity: integer('token_quantity').default(0).notNull(),
    frozenQuantity: integer('frozen_quantity').default(0).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId] }),
  }),
);

/**
 * Token 流水表。
 * opType: 0=充值 1=扣减 2=过期 3=退款 4=佣金 5=管理员调整。
 */
export const tokenFlows = pgTable('token_flows', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  opType: integer('op_type').notNull(),
  quantity: integer('quantity').notNull(),
  balanceAfter: integer('balance_after').default(0).notNull(),
  remark: varchar('remark', { length: 255 }),
  operatorId: uuid('operator_id'), // 管理员调整时记录操作人
  relatedOrderNo: varchar('related_order_no', { length: 64 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export type UserMargin = typeof userMargins.$inferSelect;
export type NewUserMargin = typeof userMargins.$inferInsert;
export type TokenFlow = typeof tokenFlows.$inferSelect;
export type NewTokenFlow = typeof tokenFlows.$inferInsert;
