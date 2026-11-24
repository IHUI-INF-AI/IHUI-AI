// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 人事补口表(2026-11-24):
 *   · hr_shift_assignment     排班(人 × 日 × 班次),hr_shift 此前只有班次定义、没有排班落点
 *   · hr_social_insurance_change 社保/公积金增减员台账(入职自动增员、离职自动减员)
 *   · hr_bonus_payment        年终奖/一次性奖金单独计税记录
 *   · hr_severance_record     经济补偿金测算与个税记录
 *
 * 拆成独立文件而不是塞进既有 hr-*.ts:多会话共树,向大文件插段冲突率高;
 * 这里只做新增,既有表只加列(见 hr_payroll_period 的审批留痕列)。
 */
import {
  boolean,
  date,
  index,
  jsonb,
  numeric,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'

import { users } from './users.js'
import { hrDepartment, hrEmployee } from './hr-ai-management.js'
import { hrShift } from './hr-shift-daily.js'
import { hrResignation } from './hr-lifecycle.js'

/** 排班表(hr_shift_assignment)。一人一日只能排一个班次,冲突由唯一索引兜底。 */
export const hrShiftAssignment = pgTable(
  'hr_shift_assignment',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => hrEmployee.id, { onDelete: 'cascade' }),
    departmentId: uuid('department_id')
      .notNull()
      .references(() => hrDepartment.id, { onDelete: 'cascade' }),
    workDate: date('work_date').notNull(),
    shiftId: uuid('shift_id')
      .notNull()
      .references(() => hrShift.id, { onDelete: 'restrict' }),
    /** 备注(调班原因/替班人等) */
    note: varchar('note', { length: 200 }),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    empDateUq: uniqueIndex('uq_hr_shift_assign_emp_date').on(t.employeeId, t.workDate),
    dateIdx: index('ix_hr_shift_assign_date').on(t.workDate),
    shiftIdx: index('ix_hr_shift_assign_shift').on(t.shiftId),
  }),
)

/** 社保/公积金增减员台账(hr_social_insurance_change)。 */
export const hrSocialInsuranceChange = pgTable(
  'hr_social_insurance_change',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => hrEmployee.id, { onDelete: 'cascade' }),
    /** increase=增员 / decrease=减员 / adjust=基数调整 */
    changeType: varchar('change_type', { length: 20 }).notNull(),
    /** 生效账期 YYYY-MM */
    effectiveMonth: varchar('effective_month', { length: 7 }).notNull(),
    /** 参保地区(对应 hr_insurance_rate_config.region_name;减员可空) */
    regionName: varchar('region_name', { length: 100 }),
    /** 社保基数/公积金基数(调整类必填,增员可按配置自动取) */
    insuranceBase: numeric('insurance_base', { precision: 12, scale: 2 }),
    fundBase: numeric('fund_base', { precision: 12, scale: 2 }),
    /** pending=待报 / submitted=已报平台 / accepted=平台已受理 / failed=平台退回 */
    status: varchar('status', { length: 20 }).default('pending').notNull(),
    /** 平台回执号/受理编号 */
    platformRef: varchar('platform_ref', { length: 100 }),
    note: varchar('note', { length: 500 }),
    operatorId: uuid('operator_id').references(() => users.id, { onDelete: 'set null' }),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    empTypeMonthUq: uniqueIndex('uq_hr_social_change_emp_type_month').on(
      t.employeeId,
      t.changeType,
      t.effectiveMonth,
    ),
    statusIdx: index('ix_hr_social_change_status').on(t.status),
    monthIdx: index('ix_hr_social_change_month').on(t.effectiveMonth),
  }),
)

/** 年终奖/一次性奖金单独计税记录(hr_bonus_payment)。 */
export const hrBonusPayment = pgTable(
  'hr_bonus_payment',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => hrEmployee.id, { onDelete: 'cascade' }),
    /** 发放归属月 YYYY-MM */
    periodMonth: varchar('period_month', { length: 7 }).notNull(),
    /** annual=全年一次性奖金 / quarterly / project / other */
    bonusType: varchar('bonus_type', { length: 20 }).default('annual').notNull(),
    bonusAmount: numeric('bonus_amount', { precision: 12, scale: 2 }).notNull(),
    /** separate=单独计税 / merged=并入综合所得(本表只记录选择,合并口径由算薪处理) */
    taxMethod: varchar('tax_method', { length: 20 }).default('separate').notNull(),
    taxableAmount: numeric('taxable_amount', { precision: 12, scale: 2 }).notNull(),
    taxAmount: numeric('tax_amount', { precision: 12, scale: 2 }).notNull(),
    netAmount: numeric('net_amount', { precision: 12, scale: 2 }).notNull(),
    /** 计算过程:税率档位/速算扣除数/政策依据 */
    calcDetail: jsonb('calc_detail').$type<Record<string, unknown>>(),
    /** calculated=已测算 / paid=已随薪发放 */
    status: varchar('status', { length: 20 }).default('calculated').notNull(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    empMonthIdx: index('ix_hr_bonus_emp_month').on(t.employeeId, t.periodMonth),
    monthIdx: index('ix_hr_bonus_month').on(t.periodMonth),
  }),
)

/** 经济补偿金测算记录(hr_severance_record)。 */
export const hrSeveranceRecord = pgTable(
  'hr_severance_record',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => hrEmployee.id, { onDelete: 'cascade' }),
    resignationId: uuid('resignation_id').references(() => hrResignation.id, {
      onDelete: 'set null',
    }),
    /** 本单位工作年限(满 1 年记 1,满 6 个月不满 1 年记 1,不满 6 个月记 0.5) */
    yearsOfService: numeric('years_of_service', { precision: 6, scale: 2 }).notNull(),
    /** 离职前 12 个月平均工资 */
    monthlyAvgWage: numeric('monthly_avg_wage', { precision: 12, scale: 2 }).notNull(),
    /** 当地上年度职工月平均工资(免税额度 = 3 倍) */
    localAvgMonthlyWage: numeric('local_avg_monthly_wage', { precision: 12, scale: 2 }).notNull(),
    /** 月工资是否已按社平 3 倍封顶 */
    capped: boolean('capped').default(false).notNull(),
    /** 经济补偿总额 N × 月工资(封顶后) */
    compensationAmount: numeric('compensation_amount', { precision: 14, scale: 2 }).notNull(),
    /** 免税部分(3 倍社平以内) */
    exemptAmount: numeric('exempt_amount', { precision: 14, scale: 2 }).notNull(),
    /** 应税部分(超过 3 倍社平) */
    taxableExcess: numeric('taxable_excess', { precision: 14, scale: 2 }).notNull(),
    taxAmount: numeric('tax_amount', { precision: 14, scale: 2 }).notNull(),
    netAmount: numeric('net_amount', { precision: 14, scale: 2 }).notNull(),
    /** 计算过程:分摊年限/月度税率档/政策依据 */
    calcDetail: jsonb('calc_detail').$type<Record<string, unknown>>(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    empIdx: index('ix_hr_severance_emp').on(t.employeeId),
    createdIdx: index('ix_hr_severance_created').on(t.createdAt),
  }),
)

export type HrShiftAssignment = typeof hrShiftAssignment.$inferSelect
export type HrSocialInsuranceChange = typeof hrSocialInsuranceChange.$inferSelect
export type HrBonusPayment = typeof hrBonusPayment.$inferSelect
export type HrSeveranceRecord = typeof hrSeveranceRecord.$inferSelect
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
