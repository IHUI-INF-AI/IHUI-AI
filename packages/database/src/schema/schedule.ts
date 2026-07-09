import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';

/**
 * 定时任务表。
 * - cronExpression: 标准 5 字段 cron 表达式。
 * - targetService/targetMethod: 调用的目标服务与方法。
 * - parameters: 任务参数(JSON 字符串)。
 * - priority: 1-10，越大越优先。
 * - maxRetryCount: 最大重试次数。
 * - timeout: 超时时间(秒)。
 * - lastRunStatus: running/success/failed/timeout。
 */
export const scheduleTasks = pgTable(
  'schedule_tasks',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 200 }).notNull(),
    description: text('description'),
    cronExpression: varchar('cron_expression', { length: 100 }).notNull(),
    targetService: varchar('target_service', { length: 100 }),
    targetMethod: varchar('target_method', { length: 100 }),
    parameters: text('parameters'), // 任务参数(JSON 字符串)
    priority: integer('priority').default(5).notNull(),
    maxRetryCount: integer('max_retry_count').default(3).notNull(),
    timeout: integer('timeout').default(3600).notNull(), // 秒
    enabled: boolean('enabled').default(true).notNull(),
    lastRunTime: timestamp('last_run_time', { withTimezone: true }),
    lastRunStatus: varchar('last_run_status', { length: 20 }), // running/success/failed/timeout
    lastRunMessage: text('last_run_message'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    enabledIdx: index('schedule_tasks_enabled_idx').on(t.enabled),
    priorityIdx: index('schedule_tasks_priority_idx').on(t.priority),
  }),
);

/**
 * 任务执行日志表。
 * - status: running/success/failed/timeout。
 * - duration: 执行耗时(秒)。
 * - retryCount: 实际重试次数。
 */
export const scheduleLogs = pgTable(
  'schedule_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    taskId: uuid('task_id')
      .notNull()
      .references(() => scheduleTasks.id, { onDelete: 'cascade' }),
    taskName: varchar('task_name', { length: 200 }).notNull(),
    status: varchar('status', { length: 20 }).notNull(), // running/success/failed/timeout
    startTime: timestamp('start_time', { withTimezone: true }),
    endTime: timestamp('end_time', { withTimezone: true }),
    duration: integer('duration').default(0).notNull(), // 秒
    message: text('message'),
    retryCount: integer('retry_count').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    taskIdx: index('schedule_logs_task_idx').on(t.taskId),
    statusIdx: index('schedule_logs_status_idx').on(t.status),
  }),
);

export type ScheduleTask = typeof scheduleTasks.$inferSelect;
export type NewScheduleTask = typeof scheduleTasks.$inferInsert;
export type ScheduleLog = typeof scheduleLogs.$inferSelect;
export type NewScheduleLog = typeof scheduleLogs.$inferInsert;
