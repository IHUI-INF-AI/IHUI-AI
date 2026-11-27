// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { sql } from 'drizzle-orm'
import {
  bigserial,
  check,
  integer,
  jsonb,
  pgTable,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'
import { agentRuns } from './agent-runs.js'

/**
 * 运行事件流水(总管智能体 P1-04,2026-11-27 立)。
 *
 * 写协议:AI 服务不直写本表,事件经 API 内部端点重放;(run_id, seq) 唯一,
 * 重复上报按幂等成功处理(I19)。seq 由运行侧单调分配(1 起,不跳号不打乱)。
 *
 * 保留与体积:
 * - 保留 30 天,按 created_at 批删(§3.8);v1 不分区,单表 >1000 万行再按月分区。
 * - 单条 payload ≤16KB:超出由服务层截断并置 truncated:true;数据库不替调用方裁剪,
 *   只在列上存 JSONB,避免"悄悄丢证据"与"悄悄存炸弹"两种极端。
 *
 * type 封闭集(status/step/tool/error/artifact/steer/checkpoint/approval/note);
 * 新增事件类型必须走 ADR 并同步迁移里的 CHECK,否则写入被数据库拒绝。
 */
export const agentRunEvents = pgTable(
  'agent_run_events',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    runId: uuid('run_id')
      .notNull()
      .references(() => agentRuns.id, { onDelete: 'cascade' }),
    /** 运行内单调序号(1 起);与 run_id 组成唯一键,重复上报幂等 */
    seq: integer('seq').notNull(),
    /** status | step | tool | error | artifact | steer | checkpoint | approval | note */
    type: varchar('type', { length: 32 }).$type<AgentRunEventType>().notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().default({}).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    /** 幂等键:同一 run 内 seq 只允许一条;并发重复上报由唯一约束兜底 */
    runSeqUq: unique('agent_run_events_run_seq_uq').on(t.runId, t.seq),
    seqCheck: check('ck_agent_run_event_seq', sql`${t.seq} > 0`),
    typeCheck: check(
      'ck_agent_run_event_type',
      sql`${t.type} in ('status', 'step', 'tool', 'error', 'artifact', 'steer', 'checkpoint', 'approval', 'note')`,
    ),
  }),
)

export type AgentRunEventType =
  'status' | 'step' | 'tool' | 'error' | 'artifact' | 'steer' | 'checkpoint' | 'approval' | 'note'

export type AgentRunEvent = typeof agentRunEvents.$inferSelect
export type NewAgentRunEvent = typeof agentRunEvents.$inferInsert
