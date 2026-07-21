import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  timestamp,
  jsonb,
  index,
} from 'drizzle-orm/pg-core'
import { agents } from './agents-extended.js'
import { agentRule } from './agent-rule.js'

export const agentTasks = pgTable(
  'agent_tasks',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    agentId: uuid('agent_id')
      .references(() => agents.agentId, { onDelete: 'cascade' })
      .notNull(),
    ruleId: uuid('rule_id').references(() => agentRule.id, { onDelete: 'set null' }),
    name: varchar('name', { length: 200 }).notNull(),
    description: text('description'),
    status: varchar('status', { length: 20 }).default('pending').notNull(),
    priority: integer('priority').default(0).notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().default({}).notNull(),
    result: jsonb('result').$type<Record<string, unknown>>(),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    agentIdx: index('agent_tasks_agent_idx').on(t.agentId),
    statusIdx: index('agent_tasks_status_idx').on(t.status),
  }),
)

export type AgentTask = typeof agentTasks.$inferSelect
export type NewAgentTask = typeof agentTasks.$inferInsert
