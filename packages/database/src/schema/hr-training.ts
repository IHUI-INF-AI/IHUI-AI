// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 培训(2026-11-24 八波立):课程目录 + 培训计划 + 报名/完成台账。
 * 补齐原始缺口表"绩效、培训命中都在教育域,人事域没有"的最后一格。
 *
 * 纪律:
 *   · 完成时把课程 durationHours 快照进 enrollment.hoursAtCompletion ——
 *     课程之后被改时长不回洗历史台账(与 perf 的 grade 定稿快照同型);
 *   · 报名批量幂等:重复(计划×员工×课程)跳过点名,不撞唯一索引也不冒充新建;
 *   · 状态机:enrolled → completed(终) / dropped(可重新激活回 enrolled);
 *     completed 不可 drop(要改走"重新报名"留痕);
 *   · retired 课程不可再报名,历史 completed 仍可查。
 */
import {
  date,
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'

import { hrEmployee } from './hr-ai-management.js'

export const TRAINING_COURSE_STATUSES = ['active', 'retired'] as const
export const TRAINING_PLAN_STATUSES = ['draft', 'open', 'closed'] as const
export const TRAINING_ENROLL_STATUSES = ['enrolled', 'completed', 'dropped'] as const

export const hrTrainingCourse = pgTable(
  'hr_training_course',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    code: varchar('code', { length: 40 }).notNull(),
    name: varchar('name', { length: 200 }).notNull(),
    category: varchar('category', { length: 60 }).default('general').notNull(),
    /** 学时(小时,支持 0.5 粒度) */
    durationHours: numeric('duration_hours', { precision: 5, scale: 1 }).notNull(),
    description: text('description'),
    status: varchar('status', { length: 20 }).default('active').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    codeUq: uniqueIndex('uq_hr_training_course_code').on(t.code),
    statusIdx: index('ix_hr_training_course_status').on(t.status),
  }),
)

export const hrTrainingPlan = pgTable(
  'hr_training_plan',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 120 }).notNull(),
    startFrom: date('start_from').notNull(),
    endTo: date('end_to').notNull(),
    status: varchar('status', { length: 20 }).default('draft').notNull(),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    nameUq: uniqueIndex('uq_hr_training_plan_name').on(t.name),
    statusIdx: index('ix_hr_training_plan_status').on(t.status),
  }),
)

export const hrTrainingEnrollment = pgTable(
  'hr_training_enrollment',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    planId: uuid('plan_id')
      .notNull()
      .references(() => hrTrainingPlan.id, { onDelete: 'restrict' }),
    employeeId: uuid('employee_id')
      .notNull()
      .references(() => hrEmployee.id, { onDelete: 'restrict' }),
    courseId: uuid('course_id')
      .notNull()
      .references(() => hrTrainingCourse.id, { onDelete: 'restrict' }),
    status: varchar('status', { length: 20 }).default('enrolled').notNull(),
    /** 完成时刻的课程学时快照;未完成为 null */
    hoursAtCompletion: numeric('hours_at_completion', { precision: 5, scale: 1 }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    tripleUq: uniqueIndex('uq_hr_training_enrollment_triple').on(t.planId, t.employeeId, t.courseId),
    empIdx: index('ix_hr_training_enrollment_emp').on(t.employeeId, t.status),
    planIdx: index('ix_hr_training_enrollment_plan').on(t.planId, t.status),
  }),
)

export type HrTrainingCourse = typeof hrTrainingCourse.$inferSelect
export type HrTrainingPlan = typeof hrTrainingPlan.$inferSelect
export type HrTrainingEnrollment = typeof hrTrainingEnrollment.$inferSelect
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
