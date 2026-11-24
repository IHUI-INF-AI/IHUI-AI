// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 绩效考核(2026-11-24 七波立):考核周期 + 三级审批评估单。
 *
 * 刻意不碰 hr_review / hr_approval(请假域)等他席文件;表独立、权限族复用
 * hr:employee:view|manage。流程纪律与报销波同形:
 *   pending --自评(本人)--> self_done --上级评分--> reviewed --员工确认--> confirmed
 *                                          └--员工 refuse--> refused --上级重评--> reviewed
 *   finalScore/等级在上级评分时定稿(grade = gradeFromScore(finalScore) 当场算存,
 *   事后改阈值表不回洗历史);周期 close 前必须清完未完成单 —— 硬闸,不 force。
 */
import { sql } from 'drizzle-orm'
import {
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'

import { hrEmployee } from './hr-ai-management.js'
import { users } from './users.js'

export const PERF_CYCLE_TYPES = ['month', 'quarter', 'half', 'year'] as const
export const PERF_CYCLE_STATUSES = ['draft', 'open', 'reviewing', 'closed'] as const
export const PERF_REVIEW_STATUSES = [
  'pending',
  'self_done',
  'reviewed',
  'confirmed',
  'refused',
] as const

export const hrPerfCycle = pgTable(
  'hr_perf_cycle',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 100 }).notNull(),
    cycleType: varchar('cycle_type', { length: 10 }).notNull(),
    startFrom: date('start_from').notNull(),
    endTo: date('end_to').notNull(),
    status: varchar('status', { length: 20 }).default('draft').notNull(),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    nameUq: uniqueIndex('uq_hr_perf_cycle_name').on(t.name),
    statusIdx: index('ix_hr_perf_cycle_status').on(t.status),
  }),
)

export const hrPerfReview = pgTable(
  'hr_perf_review',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    cycleId: uuid('cycle_id')
      .notNull()
      .references(() => hrPerfCycle.id, { onDelete: 'restrict' }),
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => hrEmployee.id, { onDelete: 'restrict' }),
    /** 上级评估人(users.id);发起时显式指派,系统不猜汇报线 */
    reviewerId: uuid('reviewer_id')
      .notNull()
      .references(() => users.id, { onDelete: 'set null' }),
    status: varchar('status', { length: 20 }).default('pending').notNull(),
    selfScore: integer('self_score'),
    selfComment: text('self_comment'),
    managerScore: integer('manager_score'),
    managerComment: text('manager_comment'),
    finalScore: integer('final_score'),
    /** 定稿等级(评分时按当时阈值表算存) */
    grade: varchar('grade', { length: 4 }),
    rounds: integer('rounds').default(1).notNull(),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => ({
    /** 一人一周期一单 */
    empCycleUq: uniqueIndex('uq_hr_perf_review_emp_cycle')
      .on(t.cycleId, t.employeeId)
      .where(sql`${t.deletedAt} IS NULL`),
    cycleIdx: index('ix_hr_perf_review_cycle').on(t.cycleId, t.status),
    reviewerIdx: index('ix_hr_perf_review_reviewer').on(t.reviewerId, t.status),
  }),
)

export type HrPerfCycle = typeof hrPerfCycle.$inferSelect
export type HrPerfReview = typeof hrPerfReview.$inferSelect
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
