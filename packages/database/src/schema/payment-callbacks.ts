import { pgTable, bigserial, varchar, integer, text, timestamp, index, unique } from 'drizzle-orm/pg-core';

/**
 * 支付回调原始记录表（payment_callbacks）。
 * - status: 0=待处理, 1=已处理。
 * - raw_data: 第三方回调原始报文（JSON/XML 文本）。
 */
export const paymentCallbacks = pgTable(
  'payment_callbacks',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    orderId: varchar('order_id', { length: 64 }),
    paymentMethod: varchar('payment_method', { length: 32 }),
    callbackType: varchar('callback_type', { length: 32 }),
    rawData: text('raw_data'),
    status: integer('status').default(0).notNull(),
    amount: integer('amount').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    orderIdx: index('payment_callbacks_order_idx').on(t.orderId),
  }),
);

/**
 * 转账信息表（transfer_infos）。
 * - status: 0=待处理, 1=成功, 2=失败。
 */
export const transferInfos = pgTable(
  'transfer_infos',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    transferNo: varchar('transfer_no', { length: 64 }).notNull(),
    fromUser: varchar('from_user', { length: 64 }),
    toUser: varchar('to_user', { length: 64 }),
    amount: integer('amount').default(0).notNull(),
    status: integer('status').default(0).notNull(),
    remark: varchar('remark', { length: 255 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    transferNoUniq: unique('transfer_infos_transfer_no_unique').on(t.transferNo),
  }),
);

/**
 * 微信支付通知表（wx_pay_notifications）。
 * - notification_type: pay=支付, refund=退款。
 * - result_code: SUCCESS/FAIL。
 */
export const wxPayNotifications = pgTable(
  'wx_pay_notifications',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    outTradeNo: varchar('out_trade_no', { length: 64 }),
    transactionId: varchar('transaction_id', { length: 64 }),
    openid: varchar('openid', { length: 128 }),
    tradeType: varchar('trade_type', { length: 32 }),
    bankType: varchar('bank_type', { length: 32 }),
    totalFee: integer('total_fee').default(0).notNull(),
    cashFee: integer('cash_fee').default(0).notNull(),
    refundNo: varchar('refund_no', { length: 64 }),
    notificationType: varchar('notification_type', { length: 32 }),
    resultCode: varchar('result_code', { length: 16 }),
    rawXml: text('raw_xml'),
    status: integer('status').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    outTradeNoIdx: index('wx_pay_notifications_out_trade_no_idx').on(t.outTradeNo),
    transactionIdIdx: index('wx_pay_notifications_transaction_id_idx').on(t.transactionId),
  }),
);

export type PaymentCallback = typeof paymentCallbacks.$inferSelect;
export type NewPaymentCallback = typeof paymentCallbacks.$inferInsert;
export type TransferInfo = typeof transferInfos.$inferSelect;
export type NewTransferInfo = typeof transferInfos.$inferInsert;
export type WxPayNotification = typeof wxPayNotifications.$inferSelect;
export type NewWxPayNotification = typeof wxPayNotifications.$inferInsert;
