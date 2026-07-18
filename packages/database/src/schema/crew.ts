/**
 * 多智能体 Crew 系统持久化表。
 * 等价自 v1.0.2-sealed: server/app/models/crew_models.py
 *
 * 3 张表:
 * - zhs_crew_session  会话
 * - zhs_crew_task     会话任务
 * - zhs_crew_message  消息日志
 */
import { pgTable, uuid, varchar, text, integer, timestamp, jsonb, index } from 'drizzle-orm/pg-core'

export const crewSession = pgTable(
  'zhs_crew_session',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: varchar('user_id', { length: 64 }).notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    status: varchar('status', { length: 20 }).default('pending').notNull(),
    inputMessage: text('input_message').notNull(),
    outputMessage: text('output_message'),
    config: jsonb('config').$type<Record<string, unknown>>().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (t) => ({
    userIdx: index('ix_crew_session_user').on(t.userId),
    statusIdx: index('ix_crew_session_status').on(t.status),
  }),
)

export const crewTask = pgTable(
  'zhs_crew_task',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sessionId: uuid('session_id')
      .references(() => crewSession.id, { onDelete: 'cascade' })
      .notNull(),
    taskIndex: integer('task_index').notNull(),
    agentRole: varchar('agent_role', { length: 50 }).notNull(),
    description: text('description').notNull(),
    expectedOutput: text('expected_output'),
    status: varchar('status', { length: 20 }).default('pending').notNull(),
    outputData: text('output_data'),
    errorMessage: text('error_message'),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    sessionIdx: index('ix_crew_task_session').on(t.sessionId),
  }),
)

export const crewMessage = pgTable(
  'zhs_crew_message',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sessionId: uuid('session_id')
      .references(() => crewSession.id, { onDelete: 'cascade' })
      .notNull(),
    fromRole: varchar('from_role', { length: 50 }).notNull(),
    toRole: varchar('to_role', { length: 50 }).notNull(),
    content: text('content').notNull(),
    messageType: varchar('message_type', { length: 30 }).default('text').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    sessionIdx: index('ix_crew_message_session').on(t.sessionId),
  }),
)

/** 运行产物 (Run artifacts) - 新增能力,基线 runs/:id/artifacts */
export const crewArtifact = pgTable(
  'zhs_crew_artifact',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sessionId: uuid('session_id')
      .references(() => crewSession.id, { onDelete: 'cascade' })
      .notNull(),
    name: varchar('name', { length: 200 }).notNull(),
    type: varchar('type', { length: 50 }).default('text').notNull(),
    content: text('content').notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    sessionIdx: index('ix_crew_artifact_session').on(t.sessionId),
  }),
)

export type CrewSession = typeof crewSession.$inferSelect
export type CrewTask = typeof crewTask.$inferSelect
export type CrewMessage = typeof crewMessage.$inferSelect
export type CrewArtifact = typeof crewArtifact.$inferSelect
