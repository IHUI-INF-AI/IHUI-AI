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
 * IM 多平台适配器配置表(2026-07-31 立,P0)。
 *
 * 持久化用户对 16 平台(飞书/企业微信/钉钉/Discord/Telegram/Slack/微信/
 * Webhook/WhatsApp/LINE/KakaoTalk/Signal/Matrix/Rocket.Chat/Mattermost/Zulip)
 * 的适配器配置,替代原 im-gateway.ts 的 Redis 兜底方案。
 *
 * credentialsJson 存储平台特定字段(webhookSecret/botToken/appId/appSecret/
 * callbackUrl/useLarkCli),用 JSONB 避免 schema 漂移。
 */
export const imAdapters = pgTable(
  'im_adapters',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    /** 平台标识(16 平台之一) */
    platform: varchar('platform', { length: 32 }).notNull(),
    /** 是否启用 */
    enabled: boolean('enabled').default(false).notNull(),
    /** 平台特定凭证(JSONB:webhookSecret/botToken/appId/appSecret/callbackUrl/useLarkCli) */
    credentialsJson: jsonb('credentials_json').notNull().default({}),
    /** 适配器配置 schema 版本(后续字段升级用) */
    schemaVersion: integer('schema_version').default(1).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    // 每个 user 每个 platform 只能有一条配置
    userPlatformIdx: uniqueIndex('im_adapters_user_platform_idx').on(t.userId, t.platform),
    userIdx: index('im_adapters_user_idx').on(t.userId),
    enabledIdx: index('im_adapters_enabled_idx').on(t.enabled),
  }),
)

/**
 * IM 消息历史表(入站 + 出站统一存储)。
 *
 * direction: 'inbound'(IM → IHUI-AI)/ 'outbound'(IHUI-AI → IM)
 * content: 文本内容或 JSON 序列化的富消息(卡片/文件/音视频/审批)
 * rawPayload: 平台原始 webhook payload(入站)或发送响应(出站)
 */
export const imMessages = pgTable(
  'im_messages',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    /** 平台标识 */
    platform: varchar('platform', { length: 32 }).notNull(),
    /** 消息方向 */
    direction: varchar('direction', { length: 16 }).notNull(),
    /** 平台原始会话/群 ID */
    chatId: varchar('chat_id', { length: 255 }),
    /** 平台原始消息 ID(入站)或平台返回的发送 ID(出站) */
    platformMessageId: varchar('platform_message_id', { length: 255 }),
    /** 消息内容(文本或 JSON 序列化的富消息) */
    content: text('content'),
    /** 平台原始 payload(完整 webhook 数据 / 发送响应) */
    rawPayload: jsonb('raw_payload').notNull().default({}),
    /** 投递状态(outbound 专用):pending/sent/failed */
    deliveryStatus: varchar('delivery_status', { length: 16 }).default('sent'),
    /** 失败原因(deliveryStatus=failed 时填充) */
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index('im_messages_user_idx').on(t.userId),
    platformIdx: index('im_messages_platform_idx').on(t.platform),
    userPlatformIdx: index('im_messages_user_platform_idx').on(t.userId, t.platform),
    directionIdx: index('im_messages_direction_idx').on(t.direction),
    createdAtIdx: index('im_messages_created_at_idx').on(t.createdAt),
  }),
)

export type ImAdapter = typeof imAdapters.$inferSelect
export type NewImAdapter = typeof imAdapters.$inferInsert
export type ImMessage = typeof imMessages.$inferSelect
export type NewImMessage = typeof imMessages.$inferInsert
