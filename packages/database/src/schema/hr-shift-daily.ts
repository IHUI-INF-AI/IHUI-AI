// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  date,
  time,
  timestamp,
  index,
  uniqueIndex,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core'
import { hrDepartment, hrEmployee, hrAttendanceRecord } from './hr-ai-management.js'
import { users } from './users.js'

/**
 * 人事考勤第 1 期(HR-2,2026-11-11 立):补齐「工时」与「假期额度」数据模型。
 *
 * HR-1 已让 `hr_attendance_record`(原始签到签退)到点自己补;本文件在它之上补四张表:
 *   · hr_shift            —— 部门班次(该来几点到几点、弹性、跨天)
 *   · hr_attendance_daily —— 日结(HR-1 日任务产出:应出勤 / 实出勤 / 迟到早退加班分钟数)
 *   · hr_leave_balance    —— 假期额度(按员工 × 假期类型 × 年度记账)
 *   · hr_punch_fix        —— 补卡申请(审批通过后回写 hr_attendance_record)
 *
 * 与教育板块(edu-*)的关系:hr_attendance_daily 与 edu 的日结同源判定内核
 * (`@ihui/attendance-core`),本文件只承载数据,不复制判定代码。
 */

/**
 * 班次表 (hr_shift)。
 * 一个部门可定义多个班次(早班/晚班/弹性班);flex_minutes 为弹性分钟数(在弹性窗内签到不算迟到)。
 * crosses_midnight=true 表示跨天班(如 22:00~06:00),日结算需把签退折到次日。
 */
export const hrShift = pgTable(
  'hr_shift',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    departmentId: uuid('department_id')
      .notNull()
      .references(() => hrDepartment.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 100 }).notNull(),
    startTime: time('start_time').notNull(),
    endTime: time('end_time').notNull(),
    /** 弹性分钟数:签到在 [start_time, start_time + flex_minutes] 内不算迟到 */
    flexMinutes: integer('flex_minutes').default(0).notNull(),
    /** 是否跨天班(结束时刻在次日) */
    crossesMidnight: boolean('crosses_midnight').default(false).notNull(),
    /** enabled/disabled */
    status: varchar('status', { length: 20 }).default('enabled').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => ({
    deptIdx: index('ix_hr_shift_dept').on(t.departmentId),
    statusIdx: index('ix_hr_shift_status').on(t.status),
  }),
)

/**
 * 考勤日结表 (hr_attendance_daily)。
 * 每员工每部门每天一行,由 HR-1 日任务产出(汇总 hr_attendance_record 的原始打卡 + 班次规则)。
 * scheduled_minutes 应出勤 = 班次时长 - 休息;actual_minutes 实出勤按有效打卡区间折算。
 * status 词表与 hr_attendance_record 一致(present/late/early/absent/leave),由判定内核给出。
 */
export const hrAttendanceDaily = pgTable(
  'hr_attendance_daily',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => hrEmployee.id, { onDelete: 'cascade' }),
    departmentId: uuid('department_id')
      .notNull()
      .references(() => hrDepartment.id, { onDelete: 'cascade' }),
    date: date('date').notNull(),
    shiftId: uuid('shift_id').references((): AnyPgColumn => hrShift.id, { onDelete: 'set null' }),
    /** 应出勤分钟数 */
    scheduledMinutes: integer('scheduled_minutes').default(0).notNull(),
    /** 实出勤分钟数 */
    actualMinutes: integer('actual_minutes').default(0).notNull(),
    /** 迟到分钟数(超出弹性窗的部分) */
    lateMinutes: integer('late_minutes').default(0).notNull(),
    /** 早退分钟数 */
    earlyMinutes: integer('early_minutes').default(0).notNull(),
    /** 加班分钟数 */
    overtimeMinutes: integer('overtime_minutes').default(0).notNull(),
    /** present/late/early/absent/leave */
    status: varchar('status', { length: 20 }).default('present').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    employeeDateIdx: index('ix_hr_daily_emp_date').on(t.employeeId, t.date),
    deptDateIdx: index('ix_hr_daily_dept_date').on(t.departmentId, t.date),
    statusIdx: index('ix_hr_daily_status').on(t.status),
    // 同一员工同一部门同一日只应有一行日结(与 hr_attendance_record 的幂等口径一致)
    employeeDeptDateUqIdx: uniqueIndex('uq_hr_daily_emp_dept_date').on(
      t.employeeId,
      t.departmentId,
      t.date,
    ),
  }),
)

/**
 * 假期额度表 (hr_leave_balance)。
 * 按员工 × 假期类型 × 年度记账;remaining = total - used - frozen(申请中冻结部分)。
 * 唯一索引 (employee_id, leave_type, year) 保证同一年同一假期类型只有一条额度账。
 * leave_type 词表与 hr_leave_request.leave_type 一致(sick/personal/annual/marriage/maternity/other)。
 */
export const hrLeaveBalance = pgTable(
  'hr_leave_balance',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => hrEmployee.id, { onDelete: 'cascade' }),
    leaveType: varchar('leave_type', { length: 30 }).notNull(),
    /** 年度(自然年,如 2026) */
    year: integer('year').notNull(),
    /** 年度总额度(天) */
    totalDays: integer('total_days').default(0).notNull(),
    /** 已用天数(已审批通过的请假) */
    usedDays: integer('used_days').default(0).notNull(),
    /** 冻结天数(申请中待审批的请假,审批通过转 used、驳回退还) */
    frozenDays: integer('frozen_days').default(0).notNull(),
    /** 剩余可用天数(派生列,写入口维护 = total - used - frozen) */
    remainingDays: integer('remaining_days').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    employeeIdx: index('ix_hr_leave_bal_emp').on(t.employeeId),
    typeYearIdx: index('ix_hr_leave_bal_type_year').on(t.leaveType, t.year),
    employeeTypeYearUqIdx: uniqueIndex('uq_hr_leave_bal_emp_type_year').on(
      t.employeeId,
      t.leaveType,
      t.year,
    ),
  }),
)

/**
 * 补卡申请表 (hr_punch_fix)。
 * 员工漏打卡时发起补卡;审批通过后由 service 回写 hr_attendance_record 的
 * checkInTime / checkOutTime / status(punch_type=check_in 回写 checkInTime,check_out 回写 checkOutTime)。
 * status: pending(待审批)/ approved(已通过)/ rejected(已驳回)。
 */
export const hrPunchFix = pgTable(
  'hr_punch_fix',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => hrEmployee.id, { onDelete: 'cascade' }),
    departmentId: uuid('department_id')
      .notNull()
      .references(() => hrDepartment.id, { onDelete: 'cascade' }),
    date: date('date').notNull(),
    /** check_in(补签到)/ check_out(补签退) */
    punchType: varchar('punch_type', { length: 20 }).notNull(),
    /** 补卡时刻(回写目标时刻) */
    punchTime: timestamp('punch_time', { withTimezone: true }),
    /** 补卡事由(必填) */
    reason: text('reason').notNull(),
    /** pending/approved/rejected */
    status: varchar('status', { length: 20 }).default('pending').notNull(),
    approverId: uuid('approver_id').references(() => users.id),
    approveRemark: text('approve_remark'),
    approveAt: timestamp('approve_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    employeeDateIdx: index('ix_hr_punch_fix_emp_date').on(t.employeeId, t.date),
    deptDateIdx: index('ix_hr_punch_fix_dept_date').on(t.departmentId, t.date),
    statusIdx: index('ix_hr_punch_fix_status').on(t.status),
  }),
)

// 回写目标考勤记录(供 service 显式引用,避免隐式依赖)
export const HR_PUNCH_FIX_TARGET = hrAttendanceRecord

export type HrShift = typeof hrShift.$inferSelect
export type NewHrShift = typeof hrShift.$inferInsert
export type HrAttendanceDaily = typeof hrAttendanceDaily.$inferSelect
export type NewHrAttendanceDaily = typeof hrAttendanceDaily.$inferInsert
export type HrLeaveBalance = typeof hrLeaveBalance.$inferSelect
export type NewHrLeaveBalance = typeof hrLeaveBalance.$inferInsert
export type HrPunchFix = typeof hrPunchFix.$inferSelect
export type NewHrPunchFix = typeof hrPunchFix.$inferInsert
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
