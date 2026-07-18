import { pgTable, uuid, varchar, text, jsonb, integer, timestamp, index } from 'drizzle-orm/pg-core'

// 消息模板表 - 短信/邮件/站内通知模板管理
export const messageTemplates = pgTable(
  'message_templates',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    code: varchar('code', { length: 64 }).notNull().unique(), // 模板编码（如 sms_verify_code）
    channel: varchar('channel', { length: 32 }).notNull(), // sms/email/notification/push/dingtalk/feishu/wechat
    title: varchar('title', { length: 255 }).notNull(),
    content: text('content').notNull(), // 模板内容，支持 {var} 占位符
    variables: jsonb('variables').default([]), // 变量定义数组 [{name,description}]
    status: integer('status').default(1).notNull(), // 1-启用 0-禁用
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    channelIdx: index('message_templates_channel_idx').on(t.channel),
    statusIdx: index('message_templates_status_idx').on(t.status),
  }),
)

export type MessageTemplate = typeof messageTemplates.$inferSelect
export type NewMessageTemplate = typeof messageTemplates.$inferInsert
