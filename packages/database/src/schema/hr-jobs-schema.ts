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
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

/**
 * 人事部定时任务执行留痕(2026-11-11 立,HR-1 第 0 期)。
 *
 * 目的:让「到点自己跑」成立 —— 每轮任务(无论 cron 自动触发还是管理端手动补跑)
 * 都在此留一条记录,机主可回查"哪天跑了没跑、跑了影响多少行、错在哪"。
 * 幂等安全:(job_name, idempotency_key) 唯一 ⇒ 同一任务同一业务窗口重复触发不产生重复数据。
 *
 * job_name 取值(由 hr-jobs.ts 的 HR_JOBS 单源定义,本文件不重复枚举):
 *   hr.daily.absent    —— 每日 00:10 补昨日(含回溯窗)缺勤
 *   hr.daily.exception —— 每日 09:00 汇总昨日迟到/早退/未签退异常清单
 *   hr.monthly.stats   —— 每月 1 日汇总上月部门考勤统计
 */
export const hrJobRun = pgTable(
  'hr_job_run',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    jobName: varchar('job_name', { length: 100 }).notNull(),
    /** 计划触发时刻(cron 定义的时刻,用于对照"实际时刻"衡量延迟) */
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }).notNull(),
    /** 实际开始时刻 */
    startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    /** running/success/failed */
    status: varchar('status', { length: 20 }).default('running').notNull(),
    /** 影响行数(补录 created / 异常条数 / 汇总部门数等,语义随 job 而定) */
    affectedRows: integer('affected_rows').default(0).notNull(),
    /** 执行摘要(机器可读,结构随 job 而定) */
    summary: jsonb('summary'),
    errorMessage: varchar('error_message', { length: 1000 }),
    /** 幂等键:同一任务名下唯一 ⇒ 重复触发不再落新行(ON CONFLICT DO NOTHING) */
    idempotencyKey: varchar('idempotency_key', { length: 200 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    nameTimeIdx: index('ix_hr_job_run_name_time').on(t.jobName, t.startedAt),
    statusIdx: index('ix_hr_job_run_status').on(t.status),
    // (job_name, idempotency_key) 唯一 ⇒ 同一任务同一业务窗口重复触发不落新行
    idemUqIdx: uniqueIndex('uq_hr_job_run_name_idem').on(t.jobName, t.idempotencyKey),
  }),
)

export type HrJobRun = typeof hrJobRun.$inferSelect
export type NewHrJobRun = typeof hrJobRun.$inferInsert
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
