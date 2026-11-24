// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { date, index, integer, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'

import { hrDepartment, hrEmployee } from './hr-ai-management.js'
import { users } from './users.js'

/**
 * 加班记录表 (hr_overtime_record),HR-5 第 3 期 2026-11-12 立。
 *
 * 为什么单独建表而不是只写 hr_attendance_daily.overtime_minutes:
 *   · 日结表存的是**核算结果**(分钟数),丢掉了「谁批的、按什么标准、几点到几点」;
 *   · 加班费争议时要能回溯原始申请,日结表的分钟数不足以举证;
 *   · 飞书/钉钉导出的加班单天然带起止时刻与时长,应当原样留痕。
 *
 * source 区分来源:import(打卡表导入)/ manual(手工登记)/ system(规则推算)。
 * status:pending(待批)/ approved(已通过)/ rejected(已驳回)。
 * 月度核算时只把 approved 的 minutes 汇总进 hr_attendance_daily.overtime_minutes。
 */
export const hrOvertimeRecord = pgTable(
  'hr_overtime_record',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => hrEmployee.id, { onDelete: 'cascade' }),
    departmentId: uuid('department_id')
      .notNull()
      .references(() => hrDepartment.id, { onDelete: 'cascade' }),
    /** 加班发生日 */
    date: date('date').notNull(),
    /** 加班分钟数(整数,避免浮点误差) */
    minutes: integer('minutes').notNull(),
    /** 加班类型:workday(工作日)/ weekend(休息日)/ holiday(法定节假日),影响计薪倍率 */
    overtimeType: varchar('overtime_type', { length: 20 }).default('workday').notNull(),
    /** 申请事由 */
    reason: text('reason'),
    /** pending / approved / rejected */
    status: varchar('status', { length: 20 }).default('pending').notNull(),
    /** import / manual / system */
    source: varchar('source', { length: 20 }).default('manual').notNull(),
    /** 外部来源的原始单号(飞书/钉钉审批实例号),用于去重与回溯 */
    externalId: varchar('external_id', { length: 120 }),
    operatedBy: uuid('operated_by').references(() => users.id),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    employeeDateIdx: index('ix_hr_ot_emp_date').on(t.employeeId, t.date),
    deptDateIdx: index('ix_hr_ot_dept_date').on(t.departmentId, t.date),
    statusIdx: index('ix_hr_ot_status').on(t.status),
    externalIdx: index('ix_hr_ot_external').on(t.externalId),
  }),
)

export type HrOvertimeRecord = typeof hrOvertimeRecord.$inferSelect
export type NewHrOvertimeRecord = typeof hrOvertimeRecord.$inferInsert
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
