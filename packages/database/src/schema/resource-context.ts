import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  index,
  jsonb,
} from 'drizzle-orm/pg-core'

/**
 * 资源上下文表 (2026-07-24 新增)。
 * 管理用户上传的文件/知识库/URL/text 资源,绑定到会话供 AI 引用。
 * type: file|knowledge|url|text
 */
export const resourceContexts = pgTable(
  'resource_contexts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: varchar('user_id', { length: 64 }).notNull(),
    name: varchar('name', { length: 200 }).notNull(),
    type: varchar('type', { length: 20 }).default('file').notNull(),
    url: varchar('url', { length: 2000 }),
    content: text('content'),
    fileId: uuid('file_id'),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdIdx: index('resource_contexts_user_id_idx').on(t.userId),
    typeIdx: index('resource_contexts_type_idx').on(t.type),
  }),
)

/**
 * 资源上下文绑定表 — 资源绑定到会话/agent。
 */
export const resourceContextBindings = pgTable(
  'resource_context_bindings',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    resourceContextId: uuid('resource_context_id').notNull(),
    sessionId: varchar('session_id', { length: 128 }),
    agentId: varchar('agent_id', { length: 128 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    resourceContextIdIdx: index('resource_context_bindings_ctx_idx').on(t.resourceContextId),
    sessionIdIdx: index('resource_context_bindings_session_idx').on(t.sessionId),
    agentIdIdx: index('resource_context_bindings_agent_idx').on(t.agentId),
  }),
)

export type ResourceContext = typeof resourceContexts.$inferSelect
export type NewResourceContext = typeof resourceContexts.$inferInsert
export type ResourceContextBinding = typeof resourceContextBindings.$inferSelect
export type NewResourceContextBinding = typeof resourceContextBindings.$inferInsert
