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

/**
 * 联系人表（2026-11-23 P0 增补）。
 * 入站消息的发送者自动归档；remark/tags/blocked 是用户维护的本地字段，
 * 不回写平台。群成员另表存，避免把几百人塞进 metadata。
 */
export const wechatHubContacts = pgTable(
  'wechat_hub_contacts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    accountId: uuid('account_id')
      .references(() => wechatHubAccounts.id, { onDelete: 'cascade' })
      .notNull(),
    platformUserId: varchar('platform_user_id', { length: 255 }).notNull(),
    displayName: varchar('display_name', { length: 255 }).default('').notNull(),
    remark: varchar('remark', { length: 255 }).default('').notNull(),
    tags: jsonb('tags').default([]).notNull(),
    blocked: boolean('blocked').default(false).notNull(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    accountContactUniq: uniqueIndex('wechat_hub_contacts_account_user_uniq').on(
      t.accountId,
      t.platformUserId,
    ),
    accountLastSeenIdx: index('wechat_hub_contacts_account_last_seen_idx').on(
      t.accountId,
      t.lastSeenAt,
    ),
  }),
)

/**
 * 群成员表：桥后端推送 group members 时同步；iLink 不支持群。
 * role: owner/admin/member；未知角色统一落 member。
 */
export const wechatHubGroupMembers = pgTable(
  'wechat_hub_group_members',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    accountId: uuid('account_id')
      .references(() => wechatHubAccounts.id, { onDelete: 'cascade' })
      .notNull(),
    conversationId: uuid('conversation_id')
      .references(() => wechatHubConversations.id, { onDelete: 'cascade' })
      .notNull(),
    memberId: varchar('member_id', { length: 255 }).notNull(),
    nickname: varchar('nickname', { length: 255 }).default('').notNull(),
    role: varchar('role', { length: 16 }).default('member').notNull(),
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    groupMemberUniq: uniqueIndex('wechat_hub_group_members_conv_member_uniq').on(
      t.accountId,
      t.conversationId,
      t.memberId,
    ),
    conversationIdx: index('wechat_hub_group_members_conversation_idx').on(t.conversationId),
  }),
)

/**
 * 自动回复规则（2026-11-23 P0 增补）。
 * 默认关闭；只对入站消息触发，命中后走上游同一套出站策略与审计。
 * matchType: contains / exact / prefix；keywords 任一命中即可。
 */
export const wechatHubAutoReplyRules = pgTable(
  'wechat_hub_auto_reply_rules',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    accountId: uuid('account_id')
      .references(() => wechatHubAccounts.id, { onDelete: 'cascade' })
      .notNull(),
    name: varchar('name', { length: 120 }).notNull(),
    enabled: boolean('enabled').default(false).notNull(),
    matchType: varchar('match_type', { length: 16 }).default('contains').notNull(),
    keywords: jsonb('keywords').default([]).notNull(),
    replyText: text('reply_text').default('').notNull(),
    scope: varchar('scope', { length: 16 }).default('all').notNull(),
    cooldownSeconds: integer('cooldown_seconds').default(0).notNull(),
    lastTriggeredAt: timestamp('last_triggered_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    accountEnabledIdx: index('wechat_hub_auto_reply_account_enabled_idx').on(
      t.accountId,
      t.enabled,
    ),
  }),
)

/**
 * 日报计划（2026-11-23 P0 增补）。
 * 进程内调度（非 Windows 计划任务）：每分钟检查一次，按 timezone 的 hour/minute
 * 判断当天是否已跑；lastRunAt 同时作为跨实例抢占闸。
 */
export const wechatHubDigestSchedules = pgTable(
  'wechat_hub_digest_schedules',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    accountId: uuid('account_id')
      .references(() => wechatHubAccounts.id, { onDelete: 'cascade' })
      .notNull(),
    enabled: boolean('enabled').default(false).notNull(),
    hour: integer('hour').default(9).notNull(),
    minute: integer('minute').default(0).notNull(),
    timezone: varchar('timezone', { length: 64 }).default('Asia/Shanghai').notNull(),
    /** 推送目标；为空时只生成日报不发送 */
    target: varchar('target', { length: 255 }).default('').notNull(),
    lastRunAt: timestamp('last_run_at', { withTimezone: true }),
    /** 本地时区日期 YYYY-MM-DD，作为"今天已跑"的抢占闸 */
    lastRunDay: varchar('last_run_day', { length: 10 }),
    lastStatus: varchar('last_status', { length: 24 }),
    lastError: text('last_error'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    accountUniq: uniqueIndex('wechat_hub_digest_schedules_account_uniq').on(t.accountId),
  }),
)

/**
 * 朋友圈归档表（2026-11-25 增补）。
 * 每次 moment.fetch 成功后把抓到的动态按 (account_id, moment_key) 幂等 upsert：
 * 重复命中只累加 seenCount、刷新 lastSeenAt；正文更长才覆盖，作者身份解析只升不降。
 * 桥本地 JSONL 是降级数据源，本表是 API 侧的稳定历史层。
 */
export const wechatHubMoments = pgTable(
  'wechat_hub_moments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    accountId: uuid('account_id')
      .references(() => wechatHubAccounts.id, { onDelete: 'cascade' })
      .notNull(),
    /** 平台动态 id；缺失时由作者+正文归一化哈希生成，保证同账号内稳定去重 */
    momentKey: varchar('moment_key', { length: 255 }).notNull(),
    authorId: varchar('author_id', { length: 255 }),
    authorName: varchar('author_name', { length: 255 }).default('').notNull(),
    /** 作者是否真的映射到已知联系人/群成员；OCR 拿不到 wxid 时为 false，命中后只升不降 */
    authorResolved: boolean('author_resolved').default(false).notNull(),
    content: text('content').default('').notNull(),
    mediaUrls: jsonb('media_urls').default([]).notNull(),
    /** 动态原始时间（毫秒时间戳）；OCR 来源可能没有 */
    createdAt: integer('created_at'),
    source: varchar('source', { length: 32 }).default('bridge').notNull(),
    page: integer('page'),
    firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).defaultNow().notNull(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).defaultNow().notNull(),
    seenCount: integer('seen_count').default(1).notNull(),
    metadata: jsonb('metadata').notNull().default({}),
  },
  (t) => ({
    accountKeyUniq: uniqueIndex('wechat_hub_moments_account_key_uniq').on(t.accountId, t.momentKey),
    accountLastIdx: index('wechat_hub_moments_account_last_idx').on(t.accountId, t.lastSeenAt),
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
export type WechatHubContact = typeof wechatHubContacts.$inferSelect
export type NewWechatHubContact = typeof wechatHubContacts.$inferInsert
export type WechatHubGroupMember = typeof wechatHubGroupMembers.$inferSelect
export type NewWechatHubGroupMember = typeof wechatHubGroupMembers.$inferInsert
export type WechatHubAutoReplyRule = typeof wechatHubAutoReplyRules.$inferSelect
export type NewWechatHubAutoReplyRule = typeof wechatHubAutoReplyRules.$inferInsert
export type WechatHubDigestSchedule = typeof wechatHubDigestSchedules.$inferSelect
export type NewWechatHubDigestSchedule = typeof wechatHubDigestSchedules.$inferInsert
export type WechatHubMoment = typeof wechatHubMoments.$inferSelect
export type NewWechatHubMoment = typeof wechatHubMoments.$inferInsert
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
