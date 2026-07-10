import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { eduOrders } from './order.js';
import { eduRefunds } from './order.js';
import { users } from './users.js';

/**
 * 退款审核记录表。
 * - action: approve(审核通过) | reject(驳回/拒绝)。
 * - 记录每次审核操作的操作人、动作与原因，支持审计追溯。
 */
export const refundAuditRecords = pgTable(
  'refund_audit_records',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => eduOrders.id, { onDelete: 'cascade' }),
    refundId: uuid('refund_id')
      .notNull()
      .references(() => eduRefunds.id, { onDelete: 'cascade' }),
    auditorId: uuid('auditor_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    action: varchar('action', { length: 16 }).notNull(),
    reason: varchar('reason', { length: 500 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    refundIdx: index('refund_audit_records_refund_idx').on(t.refundId),
    auditorIdx: index('refund_audit_records_auditor_idx').on(t.auditorId),
  }),
);

export type RefundAuditRecord = typeof refundAuditRecords.$inferSelect;
export type NewRefundAuditRecord = typeof refundAuditRecords.$inferInsert;
