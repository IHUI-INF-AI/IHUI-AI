// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  real,
  timestamp,
  index,
} from 'drizzle-orm/pg-core'

export const zhsAiUserModelChatConfig = pgTable(
  'zhs_ai_user_model_chat_config',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: varchar('user_id', { length: 64 }).notNull(),
    name: varchar('name', { length: 64 }).notNull(),
    vendor: varchar('vendor', { length: 20 }).notNull(),
    modelId: varchar('model_id', { length: 128 }).notNull(),
    baseUrl: varchar('base_url', { length: 500 }),
    apiKey: varchar('api_key', { length: 256 }).notNull(),
    temperature: real('temperature'),
    maxTokens: integer('max_tokens'),
    enabled: boolean('enabled').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index('zhs_ai_user_model_chat_config_user_idx').on(t.userId),
  }),
)

export const zhsAiUserModelChatHistory = pgTable(
  'zhs_ai_user_model_chat_history',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: varchar('user_id', { length: 64 }).notNull(),
    configId: uuid('config_id').notNull(),
    model: varchar('model', { length: 128 }).notNull(),
    content: text('content').notNull(),
    promptTokens: integer('prompt_tokens').notNull().default(0),
    completionTokens: integer('completion_tokens').notNull().default(0),
    totalTokens: integer('total_tokens').notNull().default(0),
    /**
     * 置顶标记(2026-11-23):与 web `/chat/conversations` 的 `pinned` 同语义(用户级置顶)。
     * 该表按消息粒度存储,一条历史 = 一行,置顶即钉这一行;默认 false,存量行为零变化。
     */
    pinned: boolean('pinned').notNull().default(false),
    /**
     * 文件夹(2026-11-23):与 web `/chat/conversations` 的文件夹同**语义**(用户级组织维度),
     * 但**不同承载** —— web 侧已迁服务端分组表(chat_conversation_groups),本表按消息粒度、
     * 实体与会话 id 不是同一体系,故这里存归一化后的文件夹名(空 = 未分组)。
     * 上限 64 与 shared `ORG_FOLDER_MAX_LENGTH` 同档,写入前在路由内归一化。
     */
    folder: varchar('folder', { length: 64 }),
    /**
     * 自命名标题(2026-11-23):与 web 会话的「重命名」同语义。
     * 本表按消息粒度存,`content` 是用户原话;`title` 存用户改过的显示名(空 = 未改名,
     * 出参回落到 content 前 30 字,故存量行为零变化)。上限 120 与 web `PATCH title` 同档上限。
     */
    title: varchar('title', { length: 120 }),
    /**
     * 归档时间(2026-11-24 真多端互通):与 web /chat/conversations 的 `archivedAt` 同语义
     * (可撤销的一次标记,用可空时间戳而非布尔 —— 布尔表达不了「何时归档」)。
     * null = 未归档,存量行零回填。
     */
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index('zhs_ai_user_model_chat_history_user_idx').on(t.userId),
    configIdx: index('zhs_ai_user_model_chat_history_config_idx').on(t.configId),
  }),
)

export type ZhsAiUserModelChatConfig = typeof zhsAiUserModelChatConfig.$inferSelect
export type NewZhsAiUserModelChatConfig = typeof zhsAiUserModelChatConfig.$inferInsert
export type ZhsAiUserModelChatHistory = typeof zhsAiUserModelChatHistory.$inferSelect
export type NewZhsAiUserModelChatHistory = typeof zhsAiUserModelChatHistory.$inferInsert
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
