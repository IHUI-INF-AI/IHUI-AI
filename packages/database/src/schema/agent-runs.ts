// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { sql } from 'drizzle-orm'
import {
  type AnyPgColumn,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'
import { agentDefinitions } from './agent-definitions.js'
import { teams } from './teams.js'
import { users } from './users.js'

/**
 * 运行账本(总管智能体 P1-03,2026-11-27 立)。
 *
 * 唯一写入口是 API(ai-service 走内部票 + 本地 outbox 重放),这里只定义存储面:
 * - definition_id 可空(SET NULL):purge 定义后仍要保留历史运行统计;
 *   definition_name / definition_version 是派发时的快照,不随定义改名/改版本漂移(I5/I18)。
 * - owner_user_id 是计费与权限主体,团队运行也必须有(不能只挂 team)。
 * - parent_run_id 表达递归/子运行(trace 树);dispatch_id 关联派单,用来把"派单状态"
 *   与"运行状态"对账(运行账本始终是权威)。
 * - trace_id 非空:每次 run 必有 trace,事后按 trace 反查日志/事件/成本。
 * - 状态枚举 8 值封闭;queued 是默认落点,worker claim 才转 running。
 * - cost_points 为整数点的 numeric(12,4):预扣/结算复用 points-service 的 hold,
 *   本表只记最终金额,不承担并发扣减。
 */
export const agentRuns = pgTable(
  'agent_runs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    /** purge 后置空,历史统计仍可查;派发时强制只允许 active 定义 */
    definitionId: uuid('definition_id').references(() => agentDefinitions.id, {
      onDelete: 'set null',
    }),
    /** 派发时的定义展示名快照(定义改名不追溯) */
    definitionName: varchar('definition_name', { length: 100 }).notNull(),
    /** 派发时绑定的定义版本(I5:执行中不换提示词) */
    definitionVersion: integer('definition_version').notNull(),
    /** 计费与权限主体;用户注销即级联清理其运行 */
    ownerUserId: uuid('owner_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** 团队运行记录归属团队;团队解散只解链,运行账本保留 */
    teamId: uuid('team_id').references(() => teams.id, { onDelete: 'set null' }),
    /** 父运行(递归/子 agent);父被清理时子运行保留但断链 */
    parentRunId: uuid('parent_run_id').references((): AnyPgColumn => agentRuns.id, {
      onDelete: 'set null',
    }),
    /** 派单 id(与 dispatch 域对账用,不设 FK) */
    dispatchId: varchar('dispatch_id', { length: 64 }),
    /** 会话 id(聊天/AgentLoop 会话;与 dispatch worker 的 inbox 语义不同) */
    sessionId: varchar('session_id', { length: 64 }),
    /** single | parallel | pipeline | debate | vote | critique | decomposed | team | recursive */
    mode: varchar('mode', { length: 24 }).$type<AgentRunMode>().notNull(),
    goal: text('goal').notNull(),
    /** queued | running | paused | succeeded | failed | canceled | timeout | blocked */
    status: varchar('status', { length: 16 }).$type<AgentRunStatus>().default('queued').notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    /** 30 分钟无心跳由巡检判 timeout */
    lastHeartbeatAt: timestamp('last_heartbeat_at', { withTimezone: true }),
    inputTokens: integer('input_tokens').default(0).notNull(),
    outputTokens: integer('output_tokens').default(0).notNull(),
    costPoints: numeric('cost_points', { precision: 12, scale: 4 }).default('0').notNull(),
    /** 封闭错误码(AGENT_* / MODEL_* 等),失败时必填 */
    errorCode: varchar('error_code', { length: 64 }),
    errorMessage: text('error_message'),
    artifactCount: integer('artifact_count').default(0).notNull(),
    /** 每次运行必有 trace;按 trace 反查 run/事件/成本 */
    traceId: varchar('trace_id', { length: 64 }).notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    defCreatedIdx: index('ix_agent_runs_def_created').on(t.definitionId, t.createdAt.desc()),
    ownerCreatedIdx: index('ix_agent_runs_owner_created').on(t.ownerUserId, t.createdAt.desc()),
    /** 活跃运行巡检:只扫 queued/running/paused/blocked,心跳超时判定与并发计数都走它 */
    activeIdx: index('ix_agent_runs_active')
      .on(t.status, t.lastHeartbeatAt)
      .where(sql`${t.status} in ('queued', 'running', 'paused', 'blocked')`),
    traceIdx: index('ix_agent_runs_trace').on(t.traceId),
    dispatchIdx: index('ix_agent_runs_dispatch')
      .on(t.dispatchId)
      .where(sql`${t.dispatchId} IS NOT NULL`),
    sessionIdx: index('ix_agent_runs_session')
      .on(t.sessionId)
      .where(sql`${t.sessionId} IS NOT NULL`),
    modeCheck: check(
      'ck_agent_run_mode',
      sql`${t.mode} in ('single', 'parallel', 'pipeline', 'debate', 'vote', 'critique', 'decomposed', 'team', 'recursive')`,
    ),
    statusCheck: check(
      'ck_agent_run_status',
      sql`${t.status} in ('queued', 'running', 'paused', 'succeeded', 'failed', 'canceled', 'timeout', 'blocked')`,
    ),
    definitionVersionCheck: check(
      'ck_agent_run_definition_version',
      sql`${t.definitionVersion} > 0`,
    ),
    tokensCheck: check(
      'ck_agent_run_tokens',
      sql`${t.inputTokens} >= 0 AND ${t.outputTokens} >= 0 AND ${t.artifactCount} >= 0`,
    ),
  }),
)

export type AgentRunMode =
  | 'single'
  | 'parallel'
  | 'pipeline'
  | 'debate'
  | 'vote'
  | 'critique'
  | 'decomposed'
  | 'team'
  | 'recursive'

export type AgentRunStatus =
  'queued' | 'running' | 'paused' | 'succeeded' | 'failed' | 'canceled' | 'timeout' | 'blocked'

export type AgentRun = typeof agentRuns.$inferSelect
export type NewAgentRun = typeof agentRuns.$inferInsert
