// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'

import { users } from './users.js'

/**
 * 流程待办表 (workflow_todo),HR-6 第 4 期 2026-11-13 立。
 *
 * 为什么需要它("一键代办"的最后一块):
 *   前几期让流程能自动跑、能自检、能补偿。但"需要人决策的点"(考勤差异未裁决、
 *   员工缺薪资配置、算薪环比异常)此前只以字符串形式塞在 `problems: string[]` 里,
 *   HR 看到一句"3 人缺薪资配置"却不知道该点哪里。
 *
 *   这张表把那些提示变成**可认领、可关闭、带上下文**的条目:
 *   谁、在哪一步、影响多少人/多少钱、去哪个页面处理。
 *
 * 关键设计:
 *   · **幂等**:`dedupe_key` 唯一。同一件事重复跑流程只更新计数,不堆一堆重复待办;
 *   · **不自动关闭人的事**:`status` 只能由人或业务代码显式推进,流程重跑不会把
 *     「已忽略」的待办重新打开(避免反复打扰);
 *   · **带上下文快照**:`context` 存生成时的关键数字(人数/金额/月份),
 *     事后再看能还原"当时是什么情况",不依赖重新查询;
 *   · **可溯源**:`source_type` + `source_ref` 指回产生它的流程与运行实例。
 *
 * status 取值:
 *   · `open`      待处理(默认)
 *   · `resolved`  已处理(人工点过"已完成",或业务侧确认问题消失)
 *   · `ignored`   已知悉但不处理(例如"这月就是有 3 人是新人,没配薪资属正常")
 */
export const workflowTodo = pgTable(
  'workflow_todo',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    /**
     * 幂等键:同一件事的重跑必须落在同一行。
     * 形如 `hr.monthly-payroll:2026-11:missing_salary_config`
     */
    dedupeKey: varchar('dedupe_key', { length: 200 }).notNull(),

    /** 来源:流程/模块标识(如 hr.monthly-payroll) */
    sourceType: varchar('source_type', { length: 80 }).notNull(),
    /** 来源引用:通常是业务周期(如 2026-11)或运行 id */
    sourceRef: varchar('source_ref', { length: 120 }),

    /** 严重度:blocker(不能继续)/ warn(可继续但有风险)/ info(仅提示) */
    severity: varchar('severity', { length: 20 }).default('warn').notNull(),

    /** 一句话标题(列表展示) */
    title: varchar('title', { length: 200 }).notNull(),
    /** 详细说明(可多行,人话) */
    detail: text('detail'),

    /** 影响规模:涉及人数(便于排优先级;可空) */
    affectedCount: integer('affected_count'),
    /** 影响金额(分;可空。用整数分避免浮点) */
    affectedAmountCents: integer('affected_amount_cents'),

    /** 处理去向:前端按这个跳转到具体页面(可空 = 无固定入口,需人工判断) */
    actionPath: varchar('action_path', { length: 300 }),
    /** 处理动作说明(如"补齐薪资配置后重算") */
    actionHint: varchar('action_hint', { length: 300 }),

    /** 生成时的上下文快照(数字/状态),便于事后还原现场 */
    context: jsonb('context'),

    /** open / resolved / ignored */
    status: varchar('status', { length: 20 }).default('open').notNull(),

    /** 认领人(可空 = 未认领) */
    assigneeId: uuid('assignee_id').references(() => users.id, { onDelete: 'set null' }),
    /** 处理人 */
    resolvedBy: uuid('resolved_by').references(() => users.id, { onDelete: 'set null' }),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    /** 处理备注(为什么这么处理) */
    resolutionNote: text('resolution_note'),

    /** 首次生成时间(重跑不更新,用于算"挂了多久") */
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    /** 最近一次被流程确认仍存在的时间(重跑会刷新,用于识别陈旧待办) */
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    dedupeUqIdx: uniqueIndex('uq_workflow_todo_dedupe').on(t.dedupeKey),
    statusIdx: index('ix_workflow_todo_status').on(t.status),
    sourceIdx: index('ix_workflow_todo_source').on(t.sourceType, t.sourceRef),
    severityIdx: index('ix_workflow_todo_severity').on(t.severity),
  }),
)

export type WorkflowTodo = typeof workflowTodo.$inferSelect
export type NewWorkflowTodo = typeof workflowTodo.$inferInsert
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
