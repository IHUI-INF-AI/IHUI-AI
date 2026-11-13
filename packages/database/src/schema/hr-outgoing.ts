// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:watermarked

import { date, index, integer, pgTable, text, timestamp, time, uuid, varchar } from 'drizzle-orm/pg-core'

import { hrDepartment, hrEmployee } from './hr-ai-management.js'
import { users } from './users.js'

/**
 * 外出/外勤记录表 (hr_outgoing_record),HR-5 第 3 期 2026-11-12 立。
 *
 * 为什么需要独立表:
 *   · 外出是「离开办公地点但仍算出勤」,与请假(不算出勤)、加班(超时工作)都不是一回事;
 *   · 打卡记录只能证明「打了卡」,证明不了「因公外出」,考勤核算时会被误判成旷工/缺卡;
 *   · 外出单在飞书/钉钉里是独立审批单,要能原样导入并回溯。
 *
 * 时长口径:minut/gStartedAt/EndedAt 保留原始起止时刻(可跨天),
 * minutes 是**派生时长**,入库时按起止算好,方便月结直接累加。
 * 跨天的外出(outgoing 常有一整天外勤)允许 start_date <> end_date。
 *
 * status:pending(待批)/ approved(已通过)/ rejected(已驳回)。
 * 只有 approved 的外出应在考勤核算时视为「正常出勤」。
 */
export const hrOutgoingRecord = pgTable(
  'hr_outgoing_record',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => hrEmployee.id, { onDelete: 'cascade' }),
    departmentId: uuid('department_id')
      .notNull()
      .references(() => hrDepartment.id, { onDelete: 'cascade' }),
    /** 外出开始日 */
    startDate: date('start_date').notNull(),
    /** 外出结束日(当天外出时等于 start_date) */
    endDate: date('end_date').notNull(),
    /** 开始时刻(可空,全天外勤时常为空) */
    startTime: time('start_time'),
    /** 结束时刻(可空) */
    endTime: time('end_time'),
    /** 外出分钟数(派生;无起止时刻时按「整天 = 480 分钟」或导入原值) */
    minutes: integer('minutes').default(0).notNull(),
    /** 外出地点/目的地 */
    destination: varchar('destination', { length: 200 }),
    /** 外出事由 */
    reason: text('reason'),
    /** pending / approved / rejected */
    status: varchar('status', { length: 20 }).default('pending').notNull(),
    /** import / manual / system */
    source: varchar('source', { length: 20 }).default('manual').notNull(),
    /** 外部来源的原始单号(飞书/钉钉审批实例号) */
    externalId: varchar('external_id', { length: 120 }),
    operatedBy: uuid('operated_by').references(() => users.id),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    employeeDateIdx: index('ix_hr_out_emp_date').on(t.employeeId, t.startDate),
    deptDateIdx: index('ix_hr_out_dept_date').on(t.departmentId, t.startDate),
    statusIdx: index('ix_hr_out_status').on(t.status),
    externalIdx: index('ix_hr_out_external').on(t.externalId),
  }),
)

export type HrOutgoingRecord = typeof hrOutgoingRecord.$inferSelect
export type NewHrOutgoingRecord = typeof hrOutgoingRecord.$inferInsert
