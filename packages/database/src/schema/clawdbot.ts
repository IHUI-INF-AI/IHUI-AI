import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  index,
} from 'drizzle-orm/pg-core'

export const clawdbotBots = pgTable(
  'clawdbot_bots',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 100 }).notNull(),
    description: text('description'),
    avatar: varchar('avatar', { length: 500 }),
    systemPrompt: text('system_prompt'),
    model: varchar('model', { length: 100 }).default('gpt-4o-mini').notNull(),
    temperature: varchar('temperature', { length: 10 }).default('0.7'),
    maxTokens: integer('max_tokens').default(4096).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    config: jsonb('config').$type<Record<string, unknown>>().default({}).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    activeIdx: index('clawdbot_bots_active_idx').on(t.isActive),
  }),
)

export const clawdbotPermissions = pgTable(
  'clawdbot_permissions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    botId: uuid('bot_id').references(() => clawdbotBots.id, { onDelete: 'cascade' }).notNull(),
    userId: uuid('user_id'),
    role: varchar('role', { length: 50 }).default('user').notNull(),
    permissions: jsonb('permissions').$type<string[]>().default([]).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    botIdx: index('clawdbot_permissions_bot_idx').on(t.botId),
    userIdx: index('clawdbot_permissions_user_idx').on(t.userId),
  }),
)

export const clawdbotSessions = pgTable(
  'clawdbot_sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    botId: uuid('bot_id').references(() => clawdbotBots.id, { onDelete: 'cascade' }).notNull(),
    userId: uuid('user_id').notNull(),
    title: varchar('title', { length: 200 }),
    status: varchar('status', { length: 20 }).default('active').notNull(),
    messageCount: integer('message_count').default(0).notNull(),
    lastMessageAt: timestamp('last_message_at', { withTimezone: true }),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    botIdx: index('clawdbot_sessions_bot_idx').on(t.botId),
    userIdx: index('clawdbot_sessions_user_idx').on(t.userId),
    statusIdx: index('clawdbot_sessions_status_idx').on(t.status),
  }),
)

export type ClawdbotBot = typeof clawdbotBots.$inferSelect
export type NewClawdbotBot = typeof clawdbotBots.$inferInsert
export type ClawdbotPermission = typeof clawdbotPermissions.$inferSelect
export type NewClawdbotPermission = typeof clawdbotPermissions.$inferInsert
export type ClawdbotSession = typeof clawdbotSessions.$inferSelect
export type NewClawdbotSession = typeof clawdbotSessions.$inferInsert
