// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 主动巡逻 Agent 表(2026-09-17 立,P3 #40 阶段1)。
 *
 * patrol_tasks:巡检任务(类型 CI/依赖/日志/死链/自定义 + rrule 计划 + 目标),
 *   服务端调度器到点自动调 ai-service agent-runtime 执行巡检;
 * patrol_runs:每次巡检的执行历史(ok/issue/error + 摘要 + 告警会话)。
 * 阶段2:发现 issue 时主动建(或复用)会话并注入首条 assistant 诊断消息,
 *   conversationId 复用存回 patrol_tasks.notify_conversation_id,同一任务告警不刷屏。
 * 调度器实现在 apps/api/src/services/patrol-scheduler.ts(60s tick 轮询)。
 */
import { pgTable, uuid, varchar, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core'
import { users } from './users.js'

/** lastResult jsonb 结构:执行完成后由调度器写入 */
export interface PatrolLastResult {
  finishedAt: string
  status: 'ok' | 'issue' | 'error'
  summary: string
  /** 告警会话 id(仅 issue 时写入,前端深链打开对话) */
  conversationId?: string
}

export const patrolTasks = pgTable(
  'patrol_tasks',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    name: varchar('name', { length: 200 }).notNull(),
    /** 'ci' | 'dependency' | 'log' | 'deadlink' | 'custom' */
    patrolType: varchar('patrol_type', { length: 20 }).default('custom').notNull(),
    /** 巡检目标:仓库/URL/日志范围等自由文本 */
    target: text('target'),
    /** 附加巡检指令(用户自定义关注点,追加到类型模板之后) */
    prompt: text('prompt'),
    /** RFC 5545 RRULE(MVP 仅支持 FREQ=HOURLY/DAILY/WEEKLY + BYHOUR/BYMINUTE/BYDAY) */
    rrule: varchar('rrule', { length: 500 }).notNull(),
    timezone: varchar('timezone', { length: 64 }).default('Asia/Shanghai').notNull(),
    /** 'active' | 'paused'(调度器解析 rrule 失败时自动置 paused 防死循环) */
    status: varchar('status', { length: 20 }).default('active').notNull(),
    /** 告警会话(阶段2 注入诊断消息的会话,同一任务复用不刷屏) */
    notifyConversationId: uuid('notify_conversation_id'),
    lastRunAt: timestamp('last_run_at', { withTimezone: true }),
    /** 下次执行时间(调度器每次执行后重算) */
    nextRunAt: timestamp('next_run_at', { withTimezone: true }),
    lastResult: jsonb('last_result').$type<PatrolLastResult>(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index('patrol_tasks_user_idx').on(t.userId),
    statusIdx: index('patrol_tasks_status_idx').on(t.status),
    nextRunIdx: index('patrol_tasks_next_run_idx').on(t.nextRunAt),
  }),
)

export const patrolRuns = pgTable(
  'patrol_runs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    taskId: uuid('task_id')
      .references(() => patrolTasks.id, { onDelete: 'cascade' })
      .notNull(),
    /** 'ok' = 无新问题;'issue' = 发现问题(已注入告警会话);'error' = 巡检执行失败 */
    status: varchar('status', { length: 16 }).notNull(),
    summary: text('summary').notNull(),
    /** issue 时注入诊断消息的会话 */
    conversationId: uuid('conversation_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    taskIdx: index('patrol_runs_task_idx').on(t.taskId),
  }),
)

export type PatrolTask = typeof patrolTasks.$inferSelect
export type NewPatrolTask = typeof patrolTasks.$inferInsert
export type PatrolRun = typeof patrolRuns.$inferSelect
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
