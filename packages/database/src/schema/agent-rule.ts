import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  bigint,
  timestamp,
  jsonb,
  index,
} from 'drizzle-orm/pg-core'

/**
 * 智能体规则表 (agent_rule)。
 * 等价自旧架构 zhs_agent_rule 表，绑定到具体 Agent 的执行规则。
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

/**
 * 智能体规则关联表 (agent_rule_link)。
 * 将规则关联到具体目标(agent/category)。
 * targetType: 'agent' | 'category'。
 */
export const agentRuleLink = pgTable(
  'agent_rule_link',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ruleId: uuid('rule_id').references(() => agentRule.id, { onDelete: 'cascade' }),
    targetType: varchar('target_type', { length: 32 }).notNull(),
    targetId: uuid('target_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    ruleIdIdx: index('idx_rule_link_rule_id').on(t.ruleId),
    targetIdx: index('idx_rule_link_target').on(t.targetType, t.targetId),
  }),
)

export type AgentRuleLink = typeof agentRuleLink.$inferSelect
export type NewAgentRuleLink = typeof agentRuleLink.$inferInsert

/**
 * 智能体规则参数表 (agent_rule_param)。
 * 存储规则的可配置参数键值对。
 * paramType: string/number/boolean/json。
 */
export const agentRuleParam = pgTable(
  'agent_rule_param',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ruleId: uuid('rule_id').references(() => agentRule.id, { onDelete: 'cascade' }),
    paramName: varchar('param_name', { length: 100 }).notNull(),
    paramValue: text('param_value'),
    paramType: varchar('param_type', { length: 32 }).default('string'),
    sort: integer('sort').default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    ruleIdIdx: index('idx_rule_param_rule_id').on(t.ruleId),
  }),
)

export type AgentRuleParam = typeof agentRuleParam.$inferSelect
export type NewAgentRuleParam = typeof agentRuleParam.$inferInsert

/**
 * 智能体上传记录表 (agent_upload)。
 * 记录用户为智能体上传的文件(知识库/素材等)。
 * status: pending(处理中) / completed(完成) / failed(失败)。
 */
export const agentUpload = pgTable(
  'agent_upload',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    agentId: uuid('agent_id').notNull(),
    userId: uuid('user_id').notNull(),
    fileName: varchar('file_name', { length: 255 }).notNull(),
    filePath: varchar('file_path', { length: 500 }).notNull(),
    fileSize: bigint('file_size', { mode: 'number' }),
    fileType: varchar('file_type', { length: 50 }),
    mimeType: varchar('mime_type', { length: 100 }),
    status: varchar('status', { length: 20 }).default('pending'),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    agentIdIdx: index('idx_agent_upload_agent_id').on(t.agentId),
    userIdx: index('idx_agent_upload_user_id').on(t.userId),
  }),
)

export type AgentUpload = typeof agentUpload.$inferSelect
export type NewAgentUpload = typeof agentUpload.$inferInsert
