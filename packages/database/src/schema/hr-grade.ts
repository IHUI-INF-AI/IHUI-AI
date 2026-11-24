// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 职级体系(2026-11-24 六波立):职级字典 + 员工职级生效史。
 *
 * 设计取舍:
 *   · 不动 hr_employee 主表(他席高频消费面),任职关系独立成史表 ——
 *     升级/调岗 = 闭旧+开新,天然带时间线审计,"某日 TA 是什么级"可回放;
 *   · 史表冗余 gradeCode 快照列(FK 指向字典 id),字典改名不断史;
 *   · reason 封闭集, hire/promotion/transfer/demotion/other —— 与"调岗/晋升 0 命中"
 *     的原始缺口语义一一对应,报表直接按 reason 聚合异动。
 */
import { sql } from 'drizzle-orm'
import {
  index,
  integer,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
  date,
  text,
} from 'drizzle-orm/pg-core'

import { hrEmployee } from './hr-ai-management.js'
import { users } from './users.js'

export const GRADE_REASONS = ['hire', 'promotion', 'transfer', 'demotion', 'other'] as const
export type GradeReason = (typeof GRADE_REASONS)[number]

/** 职级字典(如 P1..P9 / M1..M4),level 用于排序与比较,不判薪资 */
export const hrJobGrade = pgTable(
  'hr_job_grade',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    code: varchar('code', { length: 40 }).notNull(),
    name: varchar('name', { length: 100 }).notNull(),
    level: integer('level').notNull(),
    note: text('note'),
    status: varchar('status', { length: 20 }).default('active').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    codeUq: uniqueIndex('uq_hr_job_grade_code').on(t.code),
    levelIdx: index('ix_hr_job_grade_level').on(t.level),
  }),
)

/** 员工职级生效史:endedAt=null 即当前在职级;同人至多一条未闭(部分唯一索引兜底) */
export const hrEmployeeGrade = pgTable(
  'hr_employee_grade',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => hrEmployee.id, { onDelete: 'restrict' }),
    gradeId: uuid('grade_id')
      .notNull()
      .references(() => hrJobGrade.id, { onDelete: 'restrict' }),
    /** 字典改名不断史:快照 */
    gradeCode: varchar('grade_code', { length: 40 }).notNull(),
    effectiveFrom: date('effective_from').notNull(),
    reason: varchar('reason', { length: 20 }).notNull(),
    note: text('note'),
    operatorId: uuid('operator_id').references(() => users.id, { onDelete: 'set null' }),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    empOpenUq: uniqueIndex('uq_hr_employee_grade_open')
      .on(t.employeeId)
      .where(sql`${t.endedAt} IS NULL`),
    empIdx: index('ix_hr_employee_grade_emp').on(t.employeeId, t.effectiveFrom),
  }),
)

export type HrJobGrade = typeof hrJobGrade.$inferSelect
export type NewHrJobGrade = typeof hrJobGrade.$inferInsert
export type HrEmployeeGrade = typeof hrEmployeeGrade.$inferSelect
export type NewHrEmployeeGrade = typeof hrEmployeeGrade.$inferInsert
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
