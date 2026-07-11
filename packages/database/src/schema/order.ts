import {
  pgTable,
  uuid,
  varchar,
  integer,
  timestamp,
  numeric,
  decimal,
  serial,
  index,
  unique,
} from 'drizzle-orm/pg-core'
import { users } from './users.js'

/**
 * 教育平台订单表（与 billing.orders 区分：本表承载课程/会员卡等教育订单）。
 * - orderType: course | card。
 * - targetId: 关联目标（课程/会员卡）id，字符串以兼容多类型，不做 FK。
 * - status: pending(待支付) | paid(已支付) | cancelled(已取消) | refunded(已退款)。
 * - 价格字段统一 numeric(10,2)。
 */
export const eduOrders = pgTable(
  'edu_orders',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orderNo: varchar('order_no', { length: 64 }).notNull().unique(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    orderType: varchar('order_type', { length: 32 }).notNull(),
    targetId: varchar('target_id', { length: 64 }),
    targetTitle: varchar('target_title', { length: 200 }),
    quantity: integer('quantity').default(1).notNull(),
    originalPrice: numeric('original_price', { precision: 10, scale: 2 }).default('0').notNull(),
    discountAmount: numeric('discount_amount', { precision: 10, scale: 2 }).default('0').notNull(),
    payAmount: numeric('pay_amount', { precision: 10, scale: 2 }).default('0').notNull(),
    payType: varchar('pay_type', { length: 50 }),
    status: varchar('status', { length: 16 }).default('pending').notNull(),
    payTime: timestamp('pay_time', { withTimezone: true }),
    cancelTime: timestamp('cancel_time', { withTimezone: true }),
    refundTime: timestamp('refund_time', { withTimezone: true }),
    remark: varchar('remark', { length: 500 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index('edu_orders_user_idx').on(t.userId),
    statusIdx: index('edu_orders_status_idx').on(t.status),
    typeIdx: index('edu_orders_type_idx').on(t.orderType),
  }),
)

/**
 * 支付记录表。
 * - status: created | paying | paid | failed | cancelled。
 * - 订单级联删除。
 */
export const eduPayments = pgTable(
  'edu_payments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    paymentNo: varchar('payment_no', { length: 64 }).notNull().unique(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => eduOrders.id, { onDelete: 'cascade' }),
    orderType: varchar('order_type', { length: 32 }).notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    payType: varchar('pay_type', { length: 50 }).notNull(),
    payAmount: numeric('pay_amount', { precision: 10, scale: 2 }).default('0').notNull(),
    payUrl: varchar('pay_url', { length: 500 }),
    status: varchar('status', { length: 16 }).default('created').notNull(),
    payTime: timestamp('pay_time', { withTimezone: true }),
    thirdPartyNo: varchar('third_party_no', { length: 128 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index('edu_payments_user_idx').on(t.userId),
    orderIdx: index('edu_payments_order_idx').on(t.orderId),
  }),
)

/**
 * 退款记录表。
 * - refundType: original(原路退回) | balance(退到余额)。
 * - status: pending | approved | rejected | processing | completed | failed。
 */
export const eduRefunds = pgTable(
  'edu_refunds',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => eduOrders.id, { onDelete: 'cascade' }),
    orderType: varchar('order_type', { length: 32 }).notNull(),
    orderNo: varchar('order_no', { length: 64 }).notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    reason: varchar('reason', { length: 500 }),
    refundAmount: numeric('refund_amount', { precision: 10, scale: 2 }).default('0').notNull(),
    refundType: varchar('refund_type', { length: 32 }).default('original').notNull(),
    status: varchar('status', { length: 16 }).default('pending').notNull(),
    applyTime: timestamp('apply_time', { withTimezone: true }),
    processTime: timestamp('process_time', { withTimezone: true }),
    completeTime: timestamp('complete_time', { withTimezone: true }),
    processMessage: varchar('process_message', { length: 500 }),
    handleMessage: varchar('handle_message', { length: 500 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index('edu_refunds_user_idx').on(t.userId),
    orderIdx: index('edu_refunds_order_idx').on(t.orderId),
  }),
)

/**
 * 发票抬头表。
 * - titleType: personal(个人) | company(企业)。
 */
export const eduInvoiceTitles = pgTable(
  'edu_invoice_titles',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    titleType: varchar('title_type', { length: 16 }).default('personal').notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    taxNo: varchar('tax_no', { length: 50 }),
    bank: varchar('bank', { length: 200 }),
    bankAccount: varchar('bank_account', { length: 50 }),
    address: varchar('address', { length: 500 }),
    phone: varchar('phone', { length: 20 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index('edu_invoice_titles_user_idx').on(t.userId),
  }),
)

/**
 * 发票申请表。
 * - invoiceType: normal(普票) | special(专票)。
 * - status: pending | approved | rejected | invoicing | invoiced | canceled。
 * - 订单删除时置 NULL（保留申请记录）；抬头删除时置 NULL。
 */
export const eduInvoiceApplications = pgTable(
  'edu_invoice_applications',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orderId: uuid('order_id').references(() => eduOrders.id, { onDelete: 'set null' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    invoiceType: varchar('invoice_type', { length: 16 }).default('normal').notNull(),
    titleId: uuid('title_id').references(() => eduInvoiceTitles.id, { onDelete: 'set null' }),
    amount: numeric('amount', { precision: 10, scale: 2 }).default('0').notNull(),
    email: varchar('email', { length: 100 }),
    status: varchar('status', { length: 16 }).default('pending').notNull(),
    remark: varchar('remark', { length: 500 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index('edu_invoice_applications_user_idx').on(t.userId),
    statusIdx: index('edu_invoice_applications_status_idx').on(t.status),
    uniq: unique('edu_invoice_applications_order_unique').on(t.orderId),
  }),
)

export type EduOrder = typeof eduOrders.$inferSelect
export type NewEduOrder = typeof eduOrders.$inferInsert
export type EduPayment = typeof eduPayments.$inferSelect
export type NewEduPayment = typeof eduPayments.$inferInsert
export type EduRefund = typeof eduRefunds.$inferSelect
export type NewEduRefund = typeof eduRefunds.$inferInsert
export type EduInvoiceTitle = typeof eduInvoiceTitles.$inferSelect
export type NewEduInvoiceTitle = typeof eduInvoiceTitles.$inferInsert
export type EduInvoiceApplication = typeof eduInvoiceApplications.$inferSelect
export type NewEduInvoiceApplication = typeof eduInvoiceApplications.$inferInsert

/**
 * 订单明细表 - 订单包含的具体商品行项。
 * - orderId: 关联 edu_orders（逻辑关联，未做物理外键）。
 * - price/subtotal: decimal(10,2)。
 */
export const eduOrderItems = pgTable('edu_order_items', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id').notNull(),
  productId: integer('product_id'),
  productName: varchar('product_name', { length: 255 }),
  quantity: integer('quantity').default(1),
  price: decimal('price', { precision: 10, scale: 2 }),
  subtotal: decimal('subtotal', { precision: 10, scale: 2 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export type EduOrderItem = typeof eduOrderItems.$inferSelect
export type NewEduOrderItem = typeof eduOrderItems.$inferInsert
