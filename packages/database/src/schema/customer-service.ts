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
  unique,
} from 'drizzle-orm/pg-core';
import { users } from './users.js';

/**
 * 客服工单分类表。
 * - slug: 分类唯一标识（pre-sales / billing / technical / other 等）。
 */
export const customerServiceCategories = pgTable(
  'customer_service_categories',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 64 }).notNull(),
    slug: varchar('slug', { length: 64 }).notNull().unique(),
    description: varchar('description', { length: 255 }),
    sortOrder: integer('sort_order').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    slugIdx: index('cs_categories_slug_idx').on(t.slug),
  }),
);

/**
 * 客服工单表。
 * - status: pending(待处理) | open(处理中) | resolved(已解决) | closed(已关闭) | rejected(已驳回)。
 * - priority: low | medium | high | urgent。
 * - source: web | app | api。
 * - 工单生命周期：提交(pending) → 分配(open) → 处理(open) → 评级(resolved) → 关闭(closed)。
 */
export const customerServiceTickets = pgTable(
  'customer_service_tickets',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ticketNo: varchar('ticket_no', { length: 64 }).notNull().unique(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    categoryId: uuid('category_id').references(() => customerServiceCategories.id, {
      onDelete: 'set null',
    }),
    title: varchar('title', { length: 200 }).notNull(),
    description: text('description').notNull(),
    status: varchar('status', { length: 16 }).default('pending').notNull(),
    priority: varchar('priority', { length: 16 }).default('medium').notNull(),
    assigneeId: uuid('assignee_id').references(() => customerServiceAgents.id, {
      onDelete: 'set null',
    }),
    source: varchar('source', { length: 16 }).default('web').notNull(),
    attachments: jsonb('attachments').$type<unknown[]>().default([]).notNull(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index('cs_tickets_user_idx').on(t.userId),
    statusIdx: index('cs_tickets_status_idx').on(t.status),
    categoryIdx: index('cs_tickets_category_idx').on(t.categoryId),
    assigneeIdx: index('cs_tickets_assignee_idx').on(t.assigneeId),
  }),
);

/**
 * 工单评论表（用户与客服的往返回复）。
 * - isAdmin: true 表示客服端回复，false 表示用户端回复。
 */
export const customerServiceComments = pgTable(
  'customer_service_comments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ticketId: uuid('ticket_id')
      .notNull()
      .references(() => customerServiceTickets.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    isAdmin: boolean('is_admin').default(false).notNull(),
    attachments: jsonb('attachments').$type<unknown[]>().default([]).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    ticketIdx: index('cs_comments_ticket_idx').on(t.ticketId),
  }),
);

/**
 * 客服坐席表。
 * - status: online(在线) | busy(忙碌) | away(离开) | offline(离线)。
 * - skills: 技能标签数组，用于按分类分配。
 */
export const customerServiceAgents = pgTable(
  'customer_service_agents',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    nickname: varchar('nickname', { length: 64 }).notNull(),
    avatar: varchar('avatar', { length: 500 }),
    status: varchar('status', { length: 16 }).default('offline').notNull(),
    maxConcurrent: integer('max_concurrent').default(5).notNull(),
    currentLoad: integer('current_load').default(0).notNull(),
    skills: jsonb('skills').$type<string[]>().default([]).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: unique('cs_agents_user_unique').on(t.userId),
    statusIdx: index('cs_agents_status_idx').on(t.status),
  }),
);

/**
 * 实时会话表（WebSocket 聊天会话）。
 * - status: waiting(排队中) | active(服务中) | closed(已关闭) | transferred(已转接)。
 */
export const customerServiceSessions = pgTable(
  'customer_service_sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sessionId: varchar('session_id', { length: 64 }).notNull().unique(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    agentId: uuid('agent_id').references(() => customerServiceAgents.id, {
      onDelete: 'set null',
    }),
    status: varchar('status', { length: 16 }).default('waiting').notNull(),
    source: varchar('source', { length: 16 }).default('web').notNull(),
    queuePosition: integer('queue_position').default(0).notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    transferredTo: uuid('transferred_to').references(() => customerServiceAgents.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index('cs_sessions_user_idx').on(t.userId),
    agentIdx: index('cs_sessions_agent_idx').on(t.agentId),
    statusIdx: index('cs_sessions_status_idx').on(t.status),
  }),
);

/**
 * 服务评级表（工单或会话结束后用户评分）。
 * - rating: 1-5 星。
 */
export const customerServiceRatings = pgTable(
  'customer_service_ratings',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ticketId: uuid('ticket_id').references(() => customerServiceTickets.id, {
      onDelete: 'cascade',
    }),
    sessionId: uuid('session_id').references(() => customerServiceSessions.id, {
      onDelete: 'cascade',
    }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    agentId: uuid('agent_id').references(() => customerServiceAgents.id, {
      onDelete: 'set null',
    }),
    rating: integer('rating').notNull(),
    comment: text('comment'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    ticketIdx: index('cs_ratings_ticket_idx').on(t.ticketId),
    sessionIdx: index('cs_ratings_session_idx').on(t.sessionId),
  }),
);

export type CustomerServiceCategory = typeof customerServiceCategories.$inferSelect;
export type NewCustomerServiceCategory = typeof customerServiceCategories.$inferInsert;
export type CustomerServiceTicket = typeof customerServiceTickets.$inferSelect;
export type NewCustomerServiceTicket = typeof customerServiceTickets.$inferInsert;
export type CustomerServiceComment = typeof customerServiceComments.$inferSelect;
export type NewCustomerServiceComment = typeof customerServiceComments.$inferInsert;
export type CustomerServiceAgent = typeof customerServiceAgents.$inferSelect;
export type NewCustomerServiceAgent = typeof customerServiceAgents.$inferInsert;
export type CustomerServiceSession = typeof customerServiceSessions.$inferSelect;
export type NewCustomerServiceSession = typeof customerServiceSessions.$inferInsert;
export type CustomerServiceRating = typeof customerServiceRatings.$inferSelect;
export type NewCustomerServiceRating = typeof customerServiceRatings.$inferInsert;
