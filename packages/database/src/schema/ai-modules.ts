import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  index,
} from 'drizzle-orm/pg-core'
import { users } from './users.js'

export const aiIndexBanners = pgTable(
  'ai_index_banners',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    title: varchar('title', { length: 100 }),
    image: varchar('image', { length: 500 }),
    link: varchar('link', { length: 500 }),
    sort: integer('sort').default(0).notNull(),
    status: integer('status').default(1).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    statusIdx: index('ix_ai_index_banners_status').on(t.status),
  }),
)

export const aiTeamMembers = pgTable(
  'ai_team_members',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 100 }).notNull(),
    avatar: varchar('avatar', { length: 500 }),
    description: text('description'),
    sort: integer('sort').default(0).notNull(),
    status: integer('status').default(1).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    statusIdx: index('ix_ai_team_members_status').on(t.status),
  }),
)

export const aiConversations = pgTable(
  'ai_conversations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 200 }),
    modelId: varchar('model_id', { length: 100 }),
    lastMessageAt: timestamp('last_message_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index('ix_ai_conversations_user').on(t.userId),
  }),
)

export const aiAigcTasks = pgTable(
  'ai_aigc_tasks',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: varchar('type', { length: 50 }).notNull(),
    status: integer('status').default(0).notNull(),
    input: text('input'),
    output: text('output'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (t) => ({
    userIdx: index('ix_ai_aigc_tasks_user').on(t.userId),
    statusIdx: index('ix_ai_aigc_tasks_status').on(t.status),
  }),
)

export const aiExtCapabilities = pgTable('ai_ext_capabilities', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  enabled: boolean('enabled').default(false).notNull(),
  config: text('config'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const aiExtReports = pgTable(
  'ai_ext_reports',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: varchar('type', { length: 50 }).notNull(),
    content: text('content'),
    status: integer('status').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index('ix_ai_ext_reports_user').on(t.userId),
  }),
)

export const aiCareers = pgTable(
  'ai_careers',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    title: varchar('title', { length: 200 }).notNull(),
    company: varchar('company', { length: 100 }),
    description: text('description'),
    salary: varchar('salary', { length: 50 }),
    location: varchar('location', { length: 100 }),
    sort: integer('sort').default(0).notNull(),
    status: integer('status').default(1).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    statusIdx: index('ix_ai_careers_status').on(t.status),
  }),
)

export const aiChatTypes = pgTable(
  'ai_chat_types',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 100 }).notNull(),
    description: text('description'),
    icon: varchar('icon', { length: 500 }),
    sort: integer('sort').default(0).notNull(),
    status: integer('status').default(1).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    statusIdx: index('ix_ai_chat_types_status').on(t.status),
  }),
)

export const aiCommunityPosts = pgTable(
  'ai_community_posts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    title: varchar('title', { length: 200 }).notNull(),
    content: text('content'),
    likes: integer('likes').default(0).notNull(),
    views: integer('views').default(0).notNull(),
    status: integer('status').default(1).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index('ix_ai_community_posts_user').on(t.userId),
    statusIdx: index('ix_ai_community_posts_status').on(t.status),
  }),
)

export type AiIndexBanner = typeof aiIndexBanners.$inferSelect
export type NewAiIndexBanner = typeof aiIndexBanners.$inferInsert
export type AiTeamMember = typeof aiTeamMembers.$inferSelect
export type NewAiTeamMember = typeof aiTeamMembers.$inferInsert
export type AiConversation = typeof aiConversations.$inferSelect
export type NewAiConversation = typeof aiConversations.$inferInsert
export type AiAigcTask = typeof aiAigcTasks.$inferSelect
export type NewAiAigcTask = typeof aiAigcTasks.$inferInsert
export type AiExtCapability = typeof aiExtCapabilities.$inferSelect
export type NewAiExtCapability = typeof aiExtCapabilities.$inferInsert
export type AiExtReport = typeof aiExtReports.$inferSelect
export type NewAiExtReport = typeof aiExtReports.$inferInsert
export type AiCareer = typeof aiCareers.$inferSelect
export type NewAiCareer = typeof aiCareers.$inferInsert
export type AiChatType = typeof aiChatTypes.$inferSelect
export type NewAiChatType = typeof aiChatTypes.$inferInsert
export type AiCommunityPost = typeof aiCommunityPosts.$inferSelect
export type NewAiCommunityPost = typeof aiCommunityPosts.$inferInsert
