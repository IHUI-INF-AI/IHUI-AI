import { pgTable, uuid, varchar, text, integer, timestamp, index } from 'drizzle-orm/pg-core'

/**
 * 智能体规则表 (agent_rule)。
 * 迁移自旧架构 zhs_agent_rule 表，绑定到具体 Agent 的执行规则。
 * ruleType: text(文本) / regex(正则) / llm(大模型判断)。
 * priority: 优先级，越大越先执行。
 * status: 0=禁用, 1=启用。
 */
export const agentRule = pgTable(
  'agent_rule',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    agentId: varchar('agent_id', { length: 64 }).notNull(),
    ruleName: varchar('rule_name', { length: 128 }).notNull(),
    ruleCode: text('rule_code').notNull(),
    ruleType: varchar('rule_type', { length: 32 }).default('text'),
    priority: integer('priority').default(0),
    status: integer('status').default(1),
    description: varchar('description', { length: 255 }).default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    agentIdIdx: index('idx_rule_agent_id').on(t.agentId),
    statusIdx: index('ix_agent_rule_status').on(t.status),
  }),
)

export type AgentRule = typeof agentRule.$inferSelect
export type NewAgentRule = typeof agentRule.$inferInsert
