// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import {
  pgTable,
  uuid,
  varchar,
  boolean,
  text,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
  integer,
} from 'drizzle-orm/pg-core'
import { users } from './users.js'

/**
 * 微信智联账号表（2026-11-23 立）。
 *
 * 一个用户可挂多个账号（个人号 / 小号 / 公众号 / 企微客服），
 * 每个账号一条记录。凭据整包用 AES-256-GCM 加密后存 JSONB，
 * 数据库里不出现明文 token。
 *
 * backend:
 *  - ilink   腾讯官方 ClawBot（扫码登录、长轮询）
 *  - bridge  本地 HTTP 桥（WeChatFerry / wxauto / pywechat / chatlog）
 *  - mock    演示与测试
 */
export const wechatHubAccounts = pgTable(
  'wechat_hub_accounts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    label: varchar('label', { length: 120 }).notNull(),
    backend: varchar('backend', { length: 16 }).notNull(),
    status: varchar('status', { length: 24 }).default('disconnected').notNull(),
    /** 平台侧账号标识（iLink 的 ilink_user_id / 桥返回的 wxid） */
    externalId: varchar('external_id', { length: 255 }),
    avatarUrl: text('avatar_url'),
    /** encryptJSON({...credentials}) 的密文包；禁止明文落库 */
    credentialsEncrypted: jsonb('credentials_encrypted').notNull().default({}),
    /** iLink get_updates_buf；桥后端的增量游标 */
    cursor: varchar('cursor', { length: 512 }),
    /** 非敏感运行信息：联系人 context_token 缓存、白名单开关、桥路径等 */
    metadata: jsonb('metadata').notNull().default({}),
    /** 是否启用白名单（默认 true，只响应白名单内的会话/联系人） */
    allowlistEnabled: boolean('allowlist_enabled').default(true).notNull(),
    lastError: text('last_error'),
    lastPollAt: timestamp('last_poll_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userLabelUniq: uniqueIndex('wechat_hub_accounts_user_label_uniq').on(t.userId, t.label),
    userIdx: index('wechat_hub_accounts_user_idx').on(t.userId),
    statusIdx: index('wechat_hub_accounts_status_idx').on(t.status),
  }),
)

/**
 * 会话表：私聊 / 群聊 / 公众号 / 客服。
 * platformChatId 是平台侧稳定 ID；群聊的 room_id / 私聊的 user_id 都落这里。
 */
export const wechatHubConversations = pgTable(
  'wechat_hub_conversations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    accountId: uuid('account_id')
      .references(() => wechatHubAccounts.id, { onDelete: 'cascade' })
      .notNull(),
    platformChatId: varchar('platform_chat_id', { length: 255 }).notNull(),
    kind: varchar('kind', { length: 16 }).default('private').notNull(),
    title: varchar('title', { length: 255 }).default('').notNull(),
    memberCount: integer('member_count').default(0).notNull(),
    unreadCount: integer('unread_count').default(0).notNull(),
    lastMessageAt: timestamp('last_message_at', { withTimezone: true }),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    accountChatUniq: uniqueIndex('wechat_hub_conversations_account_chat_uniq').on(
      t.accountId,
      t.platformChatId,
    ),
    accountLastIdx: index('wechat_hub_conversations_account_last_idx').on(
      t.accountId,
      t.lastMessageAt,
    ),
  }),
)

/**
 * 消息表：入站与出站统一存储。
 * (account_id, platform_message_id) 唯一，平台重投不会落两行；
 * platform_message_id 为 NULL 时 PG 不拦（旧消息/桥不回执）。
 */
export const wechatHubMessages = pgTable(
  'wechat_hub_messages',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    accountId: uuid('account_id')
      .references(() => wechatHubAccounts.id, { onDelete: 'cascade' })
      .notNull(),
    conversationId: uuid('conversation_id')
      .references(() => wechatHubConversations.id, { onDelete: 'cascade' })
      .notNull(),
    direction: varchar('direction', { length: 16 }).notNull(),
    kind: varchar('kind', { length: 16 }).default('text').notNull(),
    content: text('content').default('').notNull(),
    mediaUrl: text('media_url'),
    senderId: varchar('sender_id', { length: 255 }),
    senderName: varchar('sender_name', { length: 255 }),
    platformMessageId: varchar('platform_message_id', { length: 255 }),
    sentAt: timestamp('sent_at', { withTimezone: true }).defaultNow().notNull(),
    /** 出站投递状态：sent / failed / pending；入站恒为 sent */
    deliveryStatus: varchar('delivery_status', { length: 16 }).default('sent').notNull(),
    errorMessage: text('error_message'),
    /** 裁剪后的原始 payload：只留类型、id、时间、媒体描述，不整包落库 */
    rawPayload: jsonb('raw_payload').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    accountMsgUniq: uniqueIndex('wechat_hub_messages_account_msg_uniq').on(
      t.accountId,
      t.platformMessageId,
    ),
    conversationCreatedIdx: index('wechat_hub_messages_conversation_created_idx').on(
      t.conversationId,
      t.createdAt,
    ),
    accountCreatedIdx: index('wechat_hub_messages_account_created_idx').on(
      t.accountId,
      t.createdAt,
    ),
  }),
)

/**
 * AI 分析任务表。
 * inputHash 由「会话 + 时间窗 + 消息 id 集合 + kind」算出，命中直接复用，
 * 避免同一批消息被重复喂给模型。
 */
export const wechatHubAnalysisRuns = pgTable(
  'wechat_hub_analysis_runs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    accountId: uuid('account_id')
      .references(() => wechatHubAccounts.id, { onDelete: 'cascade' })
      .notNull(),
    conversationId: uuid('conversation_id').references(() => wechatHubConversations.id, {
      onDelete: 'cascade',
    }),
    kind: varchar('kind', { length: 16 }).notNull(),
    status: varchar('status', { length: 16 }).default('pending').notNull(),
    inputHash: varchar('input_hash', { length: 64 }).notNull(),
    result: jsonb('result'),
    model: varchar('model', { length: 128 }),
    tokens: integer('tokens'),
    error: text('error'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (t) => ({
    accountKindHashIdx: index('wechat_hub_analysis_account_kind_hash_idx').on(
      t.accountId,
      t.kind,
      t.inputHash,
    ),
    conversationCreatedIdx: index('wechat_hub_analysis_conversation_created_idx').on(
      t.conversationId,
      t.createdAt,
    ),
  }),
)

/**
 * 动作审计表：发送、连接、断开、分析触发、白名单变更都必须留痕。
 * payload 只记动作参数摘要，禁止写入完整消息正文与 token。
 */
export const wechatHubActionLogs = pgTable(
  'wechat_hub_action_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    accountId: uuid('account_id')
      .references(() => wechatHubAccounts.id, { onDelete: 'cascade' })
      .notNull(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    action: varchar('action', { length: 32 }).notNull(),
    target: varchar('target', { length: 255 }),
    payload: jsonb('payload').notNull().default({}),
    status: varchar('status', { length: 24 }).notNull(),
    error: text('error'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    accountCreatedIdx: index('wechat_hub_action_logs_account_created_idx').on(
      t.accountId,
      t.createdAt,
    ),
    userCreatedIdx: index('wechat_hub_action_logs_user_created_idx').on(t.userId, t.createdAt),
  }),
)

export type WechatHubAccount = typeof wechatHubAccounts.$inferSelect
export type NewWechatHubAccount = typeof wechatHubAccounts.$inferInsert
export type WechatHubConversation = typeof wechatHubConversations.$inferSelect
export type NewWechatHubConversation = typeof wechatHubConversations.$inferInsert
export type WechatHubMessage = typeof wechatHubMessages.$inferSelect
export type NewWechatHubMessage = typeof wechatHubMessages.$inferInsert
export type WechatHubAnalysisRun = typeof wechatHubAnalysisRuns.$inferSelect
export type NewWechatHubAnalysisRun = typeof wechatHubAnalysisRuns.$inferInsert
export type WechatHubActionLog = typeof wechatHubActionLogs.$inferSelect
export type NewWechatHubActionLog = typeof wechatHubActionLogs.$inferInsert
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
