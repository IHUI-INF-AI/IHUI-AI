// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 薪资配置表(HR-5 第 2 期,2026-11-12 立)。
 * 补 hr_employee 无薪资字段的缺口;社保/公积金/个税规则全部可配置(各地不同、每年变,不写死)。
 */

import {
  boolean,
  date,
  index,
  integer,
  numeric,
  pgTable,
  uniqueIndex,
  uuid,
  varchar,
  timestamp,
} from 'drizzle-orm/pg-core'
import { users } from './users.js'
import { hrEmployee } from './hr-ai-management.js'

/** 员工薪资配置 (hr_salary_config)。一对多历史版本,支持调薪与回溯。 */
export const hrSalaryConfig = pgTable(
  'hr_salary_config',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => hrEmployee.id, { onDelete: 'cascade' }),
    baseSalary: numeric('base_salary', { precision: 12, scale: 2 }).notNull(),
    otBase: numeric('ot_base', { precision: 12, scale: 2 }),
    insuranceBase: numeric('insurance_base', { precision: 12, scale: 2 }),
    housingFundRate: numeric('housing_fund_rate', { precision: 5, scale: 4 }),
    fixedAllowance: numeric('fixed_allowance', { precision: 12, scale: 2 }).default('0').notNull(),
    effectiveFrom: date('effective_from').notNull(),
    effectiveTo: date('effective_to'),
    createdBy: uuid('created_by').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    empIdx: index('ix_hr_sal_cfg_emp').on(t.employeeId),
    empFromIdx: index('ix_hr_sal_cfg_emp_from').on(t.employeeId, t.effectiveFrom),
  }),
)

/** 参保地社保/公积金费率配置 (hr_insurance_rate_config)。各地不同、每年变,绝不能写死。 */
export const hrInsuranceRateConfig = pgTable(
  'hr_insurance_rate_config',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    regionName: varchar('region_name', { length: 100 }).notNull(),
    pensionEmployer: numeric('pension_employer', { precision: 5, scale: 4 }),
    pensionPersonal: numeric('pension_personal', { precision: 5, scale: 4 }),
    unemploymentEmployer: numeric('unemployment_employer', { precision: 5, scale: 4 }),
    unemploymentPersonal: numeric('unemployment_personal', { precision: 5, scale: 4 }),
    medicalEmployer: numeric('medical_employer', { precision: 5, scale: 4 }),
    medicalPersonal: numeric('medical_personal', { precision: 5, scale: 4 }),
    injuryEmployer: numeric('injury_employer', { precision: 5, scale: 4 }),
    housingFundRate: numeric('housing_fund_rate', { precision: 5, scale: 4 }),
    insuranceBaseMin: numeric('insurance_base_min', { precision: 12, scale: 2 }),
    insuranceBaseMax: numeric('insurance_base_max', { precision: 12, scale: 2 }),
    fundBaseMin: numeric('fund_base_min', { precision: 12, scale: 2 }),
    fundBaseMax: numeric('fund_base_max', { precision: 12, scale: 2 }),
    effectiveYear: integer('effective_year').notNull(),
    enabled: boolean('enabled').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    regionYearIdx: uniqueIndex('uq_hr_ins_region_year').on(t.regionName, t.effectiveYear),
  }),
)

/** 员工个税专项附加扣除信息 (hr_employee_tax_profile)。本表只存个人填报份额/选项。 */
export const hrEmployeeTaxProfile = pgTable(
  'hr_employee_tax_profile',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    employeeId: uuid('employee_id')
      .notNull()
      .unique()
      .references(() => hrEmployee.id, { onDelete: 'cascade' }),
    childrenCount: integer('children_count').default(0).notNull(),
    childrenDeductionRatio: numeric('children_deduction_ratio', { precision: 4, scale: 2 })
      .default('1.00')
      .notNull(),
    infantCount: integer('infant_count').default(0).notNull(),
    isOnlyChild: boolean('is_only_child').default(true).notNull(),
    elderlySupportShare: numeric('elderly_support_share', { precision: 12, scale: 2 }),
    housingType: varchar('housing_type', { length: 10 }).default('none').notNull(),
    housingRentAmount: numeric('housing_rent_amount', { precision: 12, scale: 2 }),
    otherMonthlyDeduction: numeric('other_monthly_deduction', { precision: 12, scale: 2 })
      .default('0')
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    empIdx: index('ix_hr_tax_prof_emp').on(t.employeeId),
  }),
)

export type HrSalaryConfig = typeof hrSalaryConfig.$inferSelect
export type NewHrSalaryConfig = typeof hrSalaryConfig.$inferInsert
export type HrInsuranceRateConfig = typeof hrInsuranceRateConfig.$inferSelect
export type NewHrInsuranceRateConfig = typeof hrInsuranceRateConfig.$inferInsert
export type HrEmployeeTaxProfile = typeof hrEmployeeTaxProfile.$inferSelect
export type NewHrEmployeeTaxProfile = typeof hrEmployeeTaxProfile.$inferInsert
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
