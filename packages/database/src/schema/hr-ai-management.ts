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
  // 自引用外键(parent_id -> 本表)需要显式标注列类型,否则 TS 在定义完成前就要求推断 ⇒ 循环。
  // 与 comments.ts / learn.ts 的既有写法同形,不用 any。
  type AnyPgColumn,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { users } from './users.js'

/**
 * 人事部(独立板块,2026-11-09 立)。
 *
 * 与教育机构板块(edu-*) 的关系:考勤**判定内核**(`@ihui/attendance-core` 的 `judgeStatus`
 * 与缺勤补录纯算法)全仓**只有一份**,教育用 `edu_attendance_*`、人事用 `hr_attendance_*`,
 * 两者共用同一份判定逻辑,只是"被考勤主体"与"该不该来的依据"不同:
 *   · 教育:主体 = 学生(student),该来 = 有课(edu_course_schedule 排课)
 *   · 人事:主体 = 员工(employee),该来 = 工作日(hr_attendance_rule.workdays 周掩码)
 * 故人事不复制任何判定代码,只注入"在册=员工+部门"、"工作日=周掩码"两个适配器。
 */

/**
 * 部门表 (hr_department)。
 * 支持树形(上级部门 parent_id 自引用);leader_employee_id 指向部门负责人。
 */
export const hrDepartment = pgTable(
  'hr_department',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 100 }).notNull(),
    parentId: uuid('parent_id').references((): AnyPgColumn => hrDepartment.id, {
      onDelete: 'set null',
    }),
    leaderEmployeeId: uuid('leader_employee_id'),
    sortOrder: integer('sort_order').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    parentIdx: index('ix_hr_dept_parent').on(t.parentId),
  }),
)

/**
 * 员工表 (hr_employee)。
 * 关联账户(users)用于登录与操作人归属;employee_no 为工号;status 控制在职/离职。
 */
export const hrEmployee = pgTable(
  'hr_employee',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    employeeNo: varchar('employee_no', { length: 50 }).notNull(),
    name: varchar('name', { length: 100 }).notNull(),
    departmentId: uuid('department_id')
      .notNull()
      .references(() => hrDepartment.id, { onDelete: 'cascade' }),
    position: varchar('position', { length: 100 }),
    hireDate: date('hire_date'),
    status: varchar('status', { length: 20 }).default('active').notNull(), // active/left
    phone: varchar('phone', { length: 30 }),
    idNumber: varchar('id_number', { length: 30 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => ({
    deptIdx: index('ix_hr_emp_dept').on(t.departmentId),
    noIdx: uniqueIndex('uq_hr_emp_no').on(t.employeeNo),
    statusIdx: index('ix_hr_emp_status').on(t.status),
  }),
)

/**
 * 人事考勤规则表 (hr_attendance_rule)。
 * 迟到/早退/缺勤判定阈值与扫码签到密钥,**与 edu_attendance_rule 同源判定**(judgeStatus)。
 * 一个部门只应有一条规则 ⇒ department_id 唯一。
 * workdays:周工作日位掩码(bit0=周一 … bit6=周日,1..127)。缺勤补录用它判断"当天是否工作日",
 * 等价于教育的"排课门控"——但人事按固定周历,比逐日排课简单。
 */
export const hrAttendanceRule = pgTable(
  'hr_attendance_rule',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    departmentId: uuid('department_id')
      .notNull()
      .unique()
      .references(() => hrDepartment.id, { onDelete: 'cascade' }),
    lateAfter: time('late_after'), // 超过该时刻签到判 late
    earlyBefore: time('early_before'), // 早于该时刻签退判 early
    absentAfter: time('absent_after'), // 当日过该时刻仍无记录则补 absent
    workdays: integer('workdays').default(127).notNull(), // 127 = 周一到周日全上班
    qrSecret: varchar('qr_secret', { length: 64 }), // 扫码签到令牌密钥
    enabled: boolean('enabled').default(true).notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    deptIdx: index('ix_hr_att_rule_dept').on(t.departmentId),
    enabledIdx: index('ix_hr_att_rule_enabled').on(t.enabled),
  }),
)

/**
 * 人事考勤记录表 (hr_attendance_record)。
 * status 词表与教育一致(present/late/early/absent/leave),由 @ihui/attendance-core 判定。
 * 唯一索引 (employee_id, department_id, date) WHERE deleted_at IS NULL 保证幂等。
 */
export const hrAttendanceRecord = pgTable(
  'hr_attendance_record',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => hrEmployee.id, { onDelete: 'cascade' }),
    departmentId: uuid('department_id')
      .notNull()
      .references(() => hrDepartment.id, { onDelete: 'cascade' }),
    date: date('date').notNull(),
    checkInTime: timestamp('check_in_time', { withTimezone: true }),
    checkOutTime: timestamp('check_out_time', { withTimezone: true }),
    status: varchar('status', { length: 20 }).default('present').notNull(),
    checkInMethod: varchar('check_in_method', { length: 20 }).default('manual').notNull(),
    checkOutMethod: varchar('check_out_method', { length: 20 }).default('manual'),
    operatedBy: uuid('operated_by').references(() => users.id),
    remark: text('remark'),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    employeeDateIdx: index('ix_hr_att_emp_date').on(t.employeeId, t.date),
    deptDateIdx: index('ix_hr_att_dept_date').on(t.departmentId, t.date),
    statusIdx: index('ix_hr_att_status').on(t.status),
    employeeDeptDateUqIdx: uniqueIndex('uq_hr_att_emp_dept_date')
      .on(t.employeeId, t.departmentId, t.date)
      .where(sql`deleted_at is null`),
  }),
)

/**
 * 请假申请表 (hr_leave_request)。
 * status: pending/approved/rejected/cancelled
 * leaveType: sick(病假)/personal(事假)/annual(年假)/marriage(婚假)/maternity(产假)/other(其他)
 */
export const hrLeaveRequest = pgTable(
  'hr_leave_request',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => hrEmployee.id, { onDelete: 'cascade' }),
    departmentId: uuid('department_id')
      .notNull()
      .references(() => hrDepartment.id, { onDelete: 'cascade' }),
    leaveType: varchar('leave_type', { length: 30 }).notNull(),
    startDate: date('start_date').notNull(),
    endDate: date('end_date').notNull(),
    totalDays: integer('total_days').notNull(),
    reason: text('reason').notNull(),
    attachment: varchar('attachment', { length: 500 }),
    status: varchar('status', { length: 20 }).default('pending').notNull(),
    approverId: uuid('approver_id').references(() => users.id),
    approveRemark: text('approve_remark'),
    approveAt: timestamp('approve_at', { withTimezone: true }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    employeeIdx: index('ix_hr_leave_emp').on(t.employeeId),
    deptIdx: index('ix_hr_leave_dept').on(t.departmentId),
    statusIdx: index('ix_hr_leave_status').on(t.status),
    dateRangeIdx: index('ix_hr_leave_dates').on(t.startDate, t.endDate),
  }),
)

export type HrDepartment = typeof hrDepartment.$inferSelect
export type NewHrDepartment = typeof hrDepartment.$inferInsert
export type HrEmployee = typeof hrEmployee.$inferSelect
export type NewHrEmployee = typeof hrEmployee.$inferInsert
export type HrAttendanceRule = typeof hrAttendanceRule.$inferSelect
export type NewHrAttendanceRule = typeof hrAttendanceRule.$inferInsert
export type HrAttendanceRecord = typeof hrAttendanceRecord.$inferSelect
export type NewHrAttendanceRecord = typeof hrAttendanceRecord.$inferInsert
export type HrLeaveRequest = typeof hrLeaveRequest.$inferSelect
export type NewHrLeaveRequest = typeof hrLeaveRequest.$inferInsert
