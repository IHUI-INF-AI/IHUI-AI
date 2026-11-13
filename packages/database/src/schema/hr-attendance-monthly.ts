// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 月度考勤汇总 + 薪资核算表(HR-5 第 2 期,2026-11-12 立)。
 * 每笔薪资 breakdown jsonb 存完整计算过程,可审计、可复算。
 * 勾稽:grossPay − 五险一金个人 − 个税 − 扣款 === netPay。
 */

import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  uniqueIndex,
  uuid,
  varchar,
  timestamp,
} from 'drizzle-orm/pg-core'
import { files } from './files.js'
import { users } from './users.js'
import { hrDepartment, hrEmployee } from './hr-ai-management.js'
import { hrImportBatch } from './hr-import.js'

/**
 * 月度考勤汇总 (hr_attendance_monthly)。
 * otDetail 区分工作日/休息日/节假日加班时长(算加班费用),单位:小时。
 * signed=true 表示已归档签字,财务才能据此算薪(跨部门闸门)。
 */
export const hrAttendanceMonthly = pgTable(
  'hr_attendance_monthly',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    periodMonth: varchar('period_month', { length: 7 }).notNull(),
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => hrEmployee.id, { onDelete: 'cascade' }),
    departmentId: uuid('department_id')
      .notNull()
      .references(() => hrDepartment.id, { onDelete: 'cascade' }),
    /** 应出勤天数(按 hr_attendance_rule.workdays 周掩码算) */
    scheduledDays: numeric('scheduled_days', { precision: 5, scale: 1 }).notNull(),
    actualDays: numeric('actual_days', { precision: 5, scale: 1 }).notNull(),
    lateCount: integer('late_count').default(0).notNull(),
    earlyCount: integer('early_count').default(0).notNull(),
    absentDays: numeric('absent_days', { precision: 5, scale: 1 }).default('0').notNull(),
    /** 请假明细 {sick:1.5, personal:0, annual:2, ...} 单位天 */
    leaveDays: jsonb('leave_days'),
    otHours: numeric('ot_hours', { precision: 6, scale: 2 }).default('0').notNull(),
    /** 加班分类明细 {weekday:2.5, weekend:8, holiday:0} 单位小时 */
    otDetail: jsonb('ot_detail'),
    sourceBatchId: uuid('source_batch_id').references(() => hrImportBatch.id),
    generatedBy: varchar('generated_by', { length: 20 }).default('system_job').notNull(),
    signed: boolean('signed').default(false).notNull(),
    signedBy: uuid('signed_by').references(() => users.id),
    signedAt: timestamp('signed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    periodEmpUqIdx: uniqueIndex('uq_hr_att_monthly_period_emp').on(t.periodMonth, t.employeeId),
    periodIdx: index('ix_hr_att_monthly_period').on(t.periodMonth),
    deptIdx: index('ix_hr_att_monthly_dept').on(t.departmentId),
  }),
)

/**
 * 薪资周期 (hr_payroll_period)。status: draft → calculated → approved → paid。
 */
export const hrPayrollPeriod = pgTable(
  'hr_payroll_period',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    periodMonth: varchar('period_month', { length: 7 }).notNull().unique(),
    status: varchar('status', { length: 20 }).default('draft').notNull(),
    /** 月度考勤表 Excel */
    attendanceSheetFileId: uuid('attendance_sheet_file_id').references(() => files.id),
    /** 薪资单导出文件 */
    payrollSheetFileId: uuid('payroll_sheet_file_id').references(() => files.id),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    operatorId: uuid('operator_id').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    periodIdx: index('ix_hr_pay_period_month').on(t.periodMonth),
  }),
)

/**
 * 薪资明细 (hr_payroll_item)。
 * breakdown jsonb 存完整计算过程(每步输入/公式/中间值),可审计、可复算。
 */
export const hrPayrollItem = pgTable(
  'hr_payroll_item',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    periodId: uuid('period_id')
      .notNull()
      .references(() => hrPayrollPeriod.id, { onDelete: 'cascade' }),
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => hrEmployee.id, { onDelete: 'cascade' }),
    baseSalary: numeric('base_salary', { precision: 12, scale: 2 }).notNull(),
    otAmount: numeric('ot_amount', { precision: 12, scale: 2 }).default('0').notNull(),
    allowance: numeric('allowance', { precision: 12, scale: 2 }).default('0').notNull(),
    attendanceDeduction: numeric('attendance_deduction', { precision: 12, scale: 2 })
      .default('0')
      .notNull(),
    grossPay: numeric('gross_pay', { precision: 12, scale: 2 }).notNull(),
    insurancePersonal: numeric('insurance_personal', { precision: 12, scale: 2 })
      .default('0')
      .notNull(),
    housingFundPersonal: numeric('housing_fund_personal', { precision: 12, scale: 2 })
      .default('0')
      .notNull(),
    taxableIncome: numeric('taxable_income', { precision: 12, scale: 2 }).default('0').notNull(),
    incomeTax: numeric('income_tax', { precision: 12, scale: 2 }).default('0').notNull(),
    otherDeduction: numeric('other_deduction', { precision: 12, scale: 2 }).default('0').notNull(),
    netPay: numeric('net_pay', { precision: 12, scale: 2 }).notNull(),
    breakdown: jsonb('breakdown'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    periodEmpUqIdx: uniqueIndex('uq_hr_payroll_period_emp').on(t.periodId, t.employeeId),
    periodIdx: index('ix_hr_payroll_item_period').on(t.periodId),
  }),
)

export type HrAttendanceMonthly = typeof hrAttendanceMonthly.$inferSelect
export type NewHrAttendanceMonthly = typeof hrAttendanceMonthly.$inferInsert
export type HrPayrollPeriod = typeof hrPayrollPeriod.$inferSelect
export type NewHrPayrollPeriod = typeof hrPayrollPeriod.$inferInsert
export type HrPayrollItem = typeof hrPayrollItem.$inferSelect
export type NewHrPayrollItem = typeof hrPayrollItem.$inferInsert
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
