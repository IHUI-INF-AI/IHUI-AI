import { pgTable, uuid, varchar, text, integer, boolean, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { projects } from './projects.js';

/**
 * 工作流定义表。
 * trigger_type: 'manual' | 'schedule' | 'event' | 'webhook'
 * trigger_config: 触发配置（如 cron 表达式、event 名称、webhook secret 等）
 * steps: 步骤定义数组（jsonb），每项形如 { name, type, config, next }
 */
export const workflows = pgTable('workflows', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 128 }).notNull(),
  description: text('description'),
  triggerType: varchar('trigger_type', { length: 32 }).default('manual').notNull(),
  triggerConfig: jsonb('trigger_config'),
  steps: jsonb('steps'),
  isActive: boolean('is_active').default(true).notNull(),
  createdBy: uuid('created_by')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * 工作流实例表。
 * status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
 * context: 实例运行时上下文数据（jsonb）
 */
export const workflowInstances = pgTable('workflow_instances', {
  id: uuid('id').defaultRandom().primaryKey(),
  workflowId: uuid('workflow_id')
    .references(() => workflows.id, { onDelete: 'cascade' })
    .notNull(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  status: varchar('status', { length: 16 }).default('pending').notNull(),
  context: jsonb('context'),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  error: text('error'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * 工作流任务表（实例的每一步执行记录）。
 * type: 'action' | 'condition' | 'loop' | 'delay'
 * status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped'
 */
export const workflowTasks = pgTable('workflow_tasks', {
  id: uuid('id').defaultRandom().primaryKey(),
  instanceId: uuid('instance_id')
    .references(() => workflowInstances.id, { onDelete: 'cascade' })
    .notNull(),
  stepIndex: integer('step_index').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  type: varchar('type', { length: 32 }).default('action').notNull(),
  status: varchar('status', { length: 16 }).default('pending').notNull(),
  input: jsonb('input'),
  output: jsonb('output'),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  error: text('error'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * 工作流日志表。
 * level: 'info' | 'warn' | 'error'
 */
export const workflowLogs = pgTable('workflow_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  instanceId: uuid('instance_id')
    .references(() => workflowInstances.id, { onDelete: 'cascade' })
    .notNull(),
  taskId: uuid('task_id').references(() => workflowTasks.id, { onDelete: 'cascade' }),
  level: varchar('level', { length: 16 }).default('info').notNull(),
  message: text('message').notNull(),
  data: jsonb('data'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export type Workflow = typeof workflows.$inferSelect;
export type NewWorkflow = typeof workflows.$inferInsert;
export type WorkflowInstance = typeof workflowInstances.$inferSelect;
export type NewWorkflowInstance = typeof workflowInstances.$inferInsert;
export type WorkflowTask = typeof workflowTasks.$inferSelect;
export type NewWorkflowTask = typeof workflowTasks.$inferInsert;
export type WorkflowLog = typeof workflowLogs.$inferSelect;
export type NewWorkflowLog = typeof workflowLogs.$inferInsert;
