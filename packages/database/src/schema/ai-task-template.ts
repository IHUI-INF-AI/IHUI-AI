// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  integer,
  jsonb,
  boolean,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

/**
 * AI 任务模板(HR-4,2026-11-11 立):把「能调端点」升级成「会自己干完一件事」。
 *
 * 模板 = 一句话目标(goal)+ 步骤序列(steps)+ 触发方式(trigger_type)。
 * 每步 = { method, path, params 模板, 注入上一步输出的方式 },执行器逐步跑、把上一步
 * 输出注入下一步参数,逐步留痕到 ai_task_run.step_results。
 * 触发方式:manual(管理端/AI 手动点) / cron(定时) / event(事件驱动,本期预留)。
 */
export const aiTaskTemplate = pgTable(
  'ai_task_template',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    /** 模板名,唯一;执行器按名加载 */
    name: varchar('name', { length: 120 }).notNull(),
    /** 一句话目标(人读,供回查与展示) */
    goal: varchar('goal', { length: 1000 }).notNull(),
    /**
     * 步骤序列。每步形状:
     * { method, path, params: Record<string, unknown>,
     *   injectFromPrev?: { into: string } }  —— injectFromPrev 把上一步输出整包塞进本步 params[into]
     * 结构由执行器(ai-task-executor.ts)消费,本表只存 jsonb 不重复类型。
     */
    steps: jsonb('steps').notNull(),
    /** manual / cron / event */
    triggerType: varchar('trigger_type', { length: 20 }).default('manual').notNull(),
    /** cron 表达式(trigger_type=cron 时必填,本期只存不调度) */
    cron: varchar('cron', { length: 100 }),
    /** 停用开关:停用后执行器拒绝跑 */
    enabled: boolean('enabled').default(true).notNull(),
    /** 最近一次触发时刻(回查用,执行器成功落痕时回写) */
    lastRunAt: timestamp('last_run_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    nameUqIdx: uniqueIndex('uq_ai_task_template_name').on(t.name),
  }),
)

/**
 * AI 任务执行留痕:每轮触发(无论手动还是后续 cron)在此留一条,逐步留痕到 step_results。
 * 幂等:(template_id, idempotency_key) 唯一 ⇒ 同一模板同一触发窗口重复触发不落新行、不再执行。
 *   manual 触发 idemKey = <name>:<dayKey>:m<毫秒>-<seq>  —— 允许同窗口多次手动触发各留一痕
 *   cron   触发 idemKey = <name>:<dayKey>                —— 同业务窗口去重
 * 失败可重放:failedStepIndex 记录失败步下标,重放从该步续跑(已成功步不重复调端点)。
 */
export const aiTaskRun = pgTable(
  'ai_task_run',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    templateId: uuid('template_id').notNull(),
    /** 冗余模板名(回查免 join;执行器从模板读出后一并落) */
    templateName: varchar('template_name', { length: 120 }).notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    /** running / success / failed */
    status: varchar('status', { length: 20 }).default('running').notNull(),
    /**
     * 逐步留痕。数组下标 = 步序;每项:
     * { stepIndex, method, path, ok, output?, error?, startedAt, finishedAt }
     * 失败步之后的步骤不执行(留空数组尾)。
     */
    stepResults: jsonb('step_results'),
    /** 失败步下标(成功为 null);重放从这一步续跑 */
    failedStepIndex: integer('failed_step_index'),
    errorMessage: varchar('error_message', { length: 1000 }),
    /** 幂等键:同一模板下唯一 ⇒ 重复触发不落新行(ON CONFLICT DO NOTHING) */
    idempotencyKey: varchar('idempotency_key', { length: 200 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    templateTimeIdx: index('ix_ai_task_run_template_time').on(t.templateId, t.startedAt),
    statusIdx: index('ix_ai_task_run_status').on(t.status),
    // (template_id, idempotency_key) 唯一 ⇒ 同一模板同一触发窗口重复触发不落新行
    idemUqIdx: uniqueIndex('uq_ai_task_run_template_idem').on(t.templateId, t.idempotencyKey),
  }),
)

export type AiTaskTemplate = typeof aiTaskTemplate.$inferSelect
export type NewAiTaskTemplate = typeof aiTaskTemplate.$inferInsert
export type AiTaskRun = typeof aiTaskRun.$inferSelect
export type NewAiTaskRun = typeof aiTaskRun.$inferInsert
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
