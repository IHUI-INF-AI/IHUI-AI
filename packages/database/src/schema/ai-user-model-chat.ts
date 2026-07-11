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
