// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 短信发送审计 / 退订黑名单 / 上行回复台账(2026-10-26 新增)。
 *
 * 三张表各管一件事,不合并:
 *  - sms_delivery_logs:每一次发送的流水,以及回执对账后的最终状态。
 *    腾讯云状态回调只带 request_id / serial_no / 手机号,没有本地流水就无从对账。
 *  - sms_unsubscribes:退订黑名单。营销短信「拒收请回复R」必须真的生效,
 *    否则下一条群发仍会发给他 —— 一次投诉就可能封掉整个短信通道。
 *  - sms_inbound_messages:所有上行回复原文。退订动作从它派生,但原文要留证据。
 */

import { pgTable, uuid, varchar, text, timestamp, jsonb, index, uniqueIndex } from 'drizzle-orm/pg-core'

export const smsDeliveryLogs = pgTable(
  'sms_delivery_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    provider: varchar('provider', { length: 16 }).notNull(), // tencent/aliyun/proxy/none
    category: varchar('category', { length: 16 }).notNull(), // code/notice/marketing
    templateKey: varchar('template_key', { length: 48 }), // 业务用途 key(验证码场景/通知 key)
    templateId: varchar('template_id', { length: 64 }), // 云侧模板 ID
    phone: varchar('phone', { length: 32 }).notNull(), // 归一后的 11 位裸号(仅内部回执对账)
    phoneHash: varchar('phone_hash', { length: 64 }), // sha256(明文号码),台账号码保护/排障索引
    phoneMasked: varchar('phone_masked', { length: 32 }), // 138****8888,列表接口只出这一列
    status: varchar('status', { length: 16 }).notNull(), // accepted/failed/suppressed/delivered/delivery_failed
    reason: varchar('reason', { length: 160 }), // 只放错误码/配置键,不放自由文本
    requestId: varchar('request_id', { length: 96 }), // 腾讯云 RequestId / 阿里云 BizId
    serialNo: varchar('serial_no', { length: 96 }), // 腾讯云 SerialNo(状态回执对账用)
    bizType: varchar('biz_type', { length: 48 }), // 业务标识,如 orders/notifications
    bizId: varchar('biz_id', { length: 96 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    phoneCreatedIdx: index('sms_delivery_logs_phone_created_idx').on(t.phone, t.createdAt),
    phoneHashIdx: index('sms_delivery_logs_phone_hash_idx').on(t.phoneHash),
    bizIdx: index('sms_delivery_logs_biz_idx').on(t.bizType, t.bizId),
    requestIdx: index('sms_delivery_logs_request_idx').on(t.requestId),
    serialIdx: index('sms_delivery_logs_serial_idx').on(t.serialNo),
    statusCreatedIdx: index('sms_delivery_logs_status_created_idx').on(t.status, t.createdAt),
    categoryCreatedIdx: index('sms_delivery_logs_category_created_idx').on(
      t.category,
      t.createdAt,
    ),
  }),
)

export const smsUnsubscribes = pgTable(
  'sms_unsubscribes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    phone: varchar('phone', { length: 32 }).notNull(),
    phoneHash: varchar('phone_hash', { length: 64 }),
    phoneMasked: varchar('phone_masked', { length: 32 }),
    reason: varchar('reason', { length: 160 }),
    rawContent: text('raw_content'), // 触发退订的回复原文
    source: varchar('source', { length: 16 }).notNull().default('reply'), // reply/admin/manual
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    phoneUnique: uniqueIndex('sms_unsubscribes_phone_unique').on(t.phone),
    phoneHashIdx: index('sms_unsubscribes_phone_hash_idx').on(t.phoneHash),
  }),
)

export const smsInboundMessages = pgTable(
  'sms_inbound_messages',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    phone: varchar('phone', { length: 32 }).notNull(),
    content: text('content').notNull(),
    provider: varchar('provider', { length: 16 }).notNull().default('tencent'),
    receivedAt: timestamp('received_at', { withTimezone: true }).defaultNow().notNull(),
    raw: jsonb('raw'),
  },
  (t) => ({
    phoneReceivedIdx: index('sms_inbound_messages_phone_received_idx').on(t.phone, t.receivedAt),
    receivedIdx: index('sms_inbound_messages_received_idx').on(t.receivedAt),
  }),
)

export type SmsDeliveryLog = typeof smsDeliveryLogs.$inferSelect
export type NewSmsDeliveryLog = typeof smsDeliveryLogs.$inferInsert
export type SmsUnsubscribe = typeof smsUnsubscribes.$inferSelect
export type NewSmsUnsubscribe = typeof smsUnsubscribes.$inferInsert
export type SmsInboundMessage = typeof smsInboundMessages.$inferSelect
export type NewSmsInboundMessage = typeof smsInboundMessages.$inferInsert
