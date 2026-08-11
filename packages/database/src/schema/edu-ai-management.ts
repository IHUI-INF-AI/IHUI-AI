import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  date,
  timestamp,
  index,
} from 'drizzle-orm/pg-core'
import { users } from './users.js'

/**
 * 学期管理表 (edu_term)。
 * 培训机构的多学期管理，支持切换当前学期。
 */
export const eduTerm = pgTable(
  'edu_term',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 100 }).notNull(),
    startDate: date('start_date').notNull(),
    endDate: date('end_date').notNull(),
    isCurrent: boolean('is_current').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    currentIdx: index('ix_edu_term_current').on(t.isCurrent),
  }),
)

/**
 * 班级管理表 (edu_class)。
 * 与学期关联，每个学期下可有多个班级。
 */
export const eduClass = pgTable(
  'edu_class',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    termId: uuid('term_id')
      .notNull()
      .references(() => eduTerm.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 100 }).notNull(),
    grade: varchar('grade', { length: 50 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    termIdx: index('ix_edu_class_term').on(t.termId),
  }),
)

/**
 * 课程条目表 (edu_course_schedule)。
 * 记录每门课程的时间安排（星期几、时间段、教室等）。
 */
export const eduCourseSchedule = pgTable(
  'edu_course_schedule',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    termId: uuid('term_id')
      .notNull()
      .references(() => eduTerm.id, { onDelete: 'cascade' }),
    classId: uuid('class_id')
      .notNull()
      .references(() => eduClass.id, { onDelete: 'cascade' }),
    courseName: varchar('course_name', { length: 200 }).notNull(),
    teacher: varchar('teacher', { length: 100 }),
    weekday: integer('weekday').notNull(), // 1=周一, 7=周日
    startTime: varchar('start_time', { length: 10 }).notNull(), // HH:mm
    endTime: varchar('end_time', { length: 10 }).notNull(),
    classroom: varchar('classroom', { length: 100 }),
    color: varchar('color', { length: 20 }), // 颜色标记
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    termIdx: index('ix_edu_schedule_term').on(t.termId),
    classIdx: index('ix_edu_schedule_class').on(t.classId),
    weekdayIdx: index('ix_edu_schedule_weekday').on(t.weekday),
  }),
)

/**
 * 每日菜谱表 (edu_meal_recipe)。
 * 培训机构食堂每日菜谱，展示给家长查看。
 * mealType: breakfast/lunch/dinner/snack
 */
export const eduMealRecipe = pgTable(
  'edu_meal_recipe',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    date: date('date').notNull(),
    mealType: varchar('meal_type', { length: 20 }).notNull(),
    dishName: varchar('dish_name', { length: 200 }).notNull(),
    ingredients: text('ingredients'),
    nutrition: varchar('nutrition', { length: 500 }),
    imageUrl: varchar('image_url', { length: 500 }),
    notes: text('notes'),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    dateIdx: index('ix_edu_meal_date').on(t.date),
    typeIdx: index('ix_edu_meal_type').on(t.mealType),
  }),
)

/**
 * 周菜谱模板表 (edu_meal_week_template)。
 * 可复用的每周菜谱模板，一键应用到某周。
 */
export const eduMealWeekTemplate = pgTable(
  'edu_meal_week_template',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 100 }).notNull(),
    weekday: integer('weekday').notNull(), // 1=周一, 7=周日
    mealType: varchar('meal_type', { length: 20 }).notNull(),
    dishName: varchar('dish_name', { length: 200 }).notNull(),
    ingredients: text('ingredients'),
    nutrition: varchar('nutrition', { length: 500 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    weekdayIdx: index('ix_edu_meal_tpl_weekday').on(t.weekday),
    nameIdx: index('ix_edu_meal_tpl_name').on(t.name),
  }),
)

/**
 * 学习计划表 (edu_study_plan)。
 * 管理员制定月计划，自动拆解为周计划；学生可细化执行。
 * planType: monthly/weekly
 * status: draft/active/completed/archived
 */
export const eduStudyPlan = pgTable(
  'edu_study_plan',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    title: varchar('title', { length: 200 }).notNull(),
    planType: varchar('plan_type', { length: 20 }).notNull(), // monthly/weekly
    creatorId: uuid('creator_id')
      .notNull()
      .references(() => users.id),
    classId: uuid('class_id')
      .notNull()
      .references(() => eduClass.id, { onDelete: 'cascade' }),
    termId: uuid('term_id')
      .notNull()
      .references(() => eduTerm.id, { onDelete: 'cascade' }),
    startDate: date('start_date').notNull(),
    endDate: date('end_date').notNull(),
    description: text('description'),
    status: varchar('status', { length: 20 }).default('draft').notNull(),
    parentPlanId: uuid('parent_plan_id'), // 月计划→周计划关联
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    classIdx: index('ix_edu_plan_class').on(t.classId),
    termIdx: index('ix_edu_plan_term').on(t.termId),
    typeIdx: index('ix_edu_plan_type').on(t.planType),
    parentIdx: index('ix_edu_plan_parent').on(t.parentPlanId),
  }),
)

/**
 * 计划条目表 (edu_plan_item)。
 * 计划下的具体条目，学生可添加子任务和备注。
 */
export const eduPlanItem = pgTable(
  'edu_plan_item',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    planId: uuid('plan_id')
      .notNull()
      .references(() => eduStudyPlan.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    objective: varchar('objective', { length: 500 }),
    dueDate: date('due_date'),
    completed: boolean('completed').default(false).notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    studentId: uuid('student_id')
      .references(() => users.id),
    parentItemId: uuid('parent_item_id'), // 学生添加子任务时关联
    notes: text('notes'), // 学生备注
    sortOrder: integer('sort_order').default(0).notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    planIdx: index('ix_edu_plan_item_plan').on(t.planId),
    studentIdx: index('ix_edu_plan_item_student').on(t.studentId),
    parentIdx: index('ix_edu_plan_item_parent').on(t.parentItemId),
  }),
)

/**
 * 签到记录表 (edu_attendance_record)。
 * 记录学生每日签到/签退，支持正常签到、迟到、早退、缺勤等状态。
 * status: present/late/early/absent/leave
 * checkInMethod: manual(教师代签)/face(人脸)/qrcode(扫码)/self(学生自签)
 */
export const eduAttendanceRecord = pgTable(
  'edu_attendance_record',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    studentId: uuid('student_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    classId: uuid('class_id')
      .notNull()
      .references(() => eduClass.id, { onDelete: 'cascade' }),
    date: date('date').notNull(),
    checkInTime: timestamp('check_in_time', { withTimezone: true }),
    checkOutTime: timestamp('check_out_time', { withTimezone: true }),
    status: varchar('status', { length: 20 }).default('present').notNull(), // present/late/early/absent/leave
    checkInMethod: varchar('check_in_method', { length: 20 }).default('manual').notNull(),
    checkOutMethod: varchar('check_out_method', { length: 20 }).default('manual'),
    operatedBy: uuid('operated_by') // 操作人(教师代签时记录)
      .references(() => users.id),
    remark: text('remark'),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    studentDateIdx: index('ix_edu_att_student_date').on(t.studentId, t.date),
    classDateIdx: index('ix_edu_att_class_date').on(t.classId, t.date),
    statusIdx: index('ix_edu_att_status').on(t.status),
  }),
)

/**
 * 请假申请表 (edu_leave_request)。
 * 学生请假申请，教师/管理员审批。
 * status: pending/approved/rejected/cancelled
 * leaveType: sick(病假)/personal(事假)/emergency(紧急)/other(其他)
 */
export const eduLeaveRequest = pgTable(
  'edu_leave_request',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    studentId: uuid('student_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    classId: uuid('class_id')
      .notNull()
      .references(() => eduClass.id, { onDelete: 'cascade' }),
    leaveType: varchar('leave_type', { length: 30 }).notNull(), // sick/personal/emergency/other
    startDate: date('start_date').notNull(),
    endDate: date('end_date').notNull(),
    totalDays: integer('total_days').notNull(),
    reason: text('reason').notNull(),
    attachment: varchar('attachment', { length: 500 }), // 附件(病假条等)
    status: varchar('status', { length: 20 }).default('pending').notNull(),
    approverId: uuid('approver_id')
      .references(() => users.id),
    approveRemark: text('approve_remark'),
    approveAt: timestamp('approve_at', { withTimezone: true }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    studentIdx: index('ix_edu_leave_student').on(t.studentId),
    classIdx: index('ix_edu_leave_class').on(t.classId),
    statusIdx: index('ix_edu_leave_status').on(t.status),
    dateRangeIdx: index('ix_edu_leave_dates').on(t.startDate, t.endDate),
  }),
)

export type EduTerm = typeof eduTerm.$inferSelect
export type NewEduTerm = typeof eduTerm.$inferInsert
export type EduClass = typeof eduClass.$inferSelect
export type NewEduClass = typeof eduClass.$inferInsert
export type EduCourseSchedule = typeof eduCourseSchedule.$inferSelect
export type NewEduCourseSchedule = typeof eduCourseSchedule.$inferInsert
export type EduMealRecipe = typeof eduMealRecipe.$inferSelect
export type NewEduMealRecipe = typeof eduMealRecipe.$inferInsert
export type EduMealWeekTemplate = typeof eduMealWeekTemplate.$inferSelect
export type NewEduMealWeekTemplate = typeof eduMealWeekTemplate.$inferInsert
export type EduStudyPlan = typeof eduStudyPlan.$inferSelect
export type NewEduStudyPlan = typeof eduStudyPlan.$inferInsert
export type EduPlanItem = typeof eduPlanItem.$inferSelect
export type NewEduPlanItem = typeof eduPlanItem.$inferInsert
export type EduAttendanceRecord = typeof eduAttendanceRecord.$inferSelect
export type NewEduAttendanceRecord = typeof eduAttendanceRecord.$inferInsert
/**
 * 家长-学生绑定表 (edu_parent_student_binding)。
 * 绑定了家长和学生用户的关联关系，支持多孩子绑定。
 * status: pending/confirmed/rejected
 * relationship: father/mother/guardian/other
 */
export const eduParentStudentBinding = pgTable(
  'edu_parent_student_binding',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    parentId: uuid('parent_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    studentId: uuid('student_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    relationship: varchar('relationship', { length: 30 }).notNull(),
    status: varchar('status', { length: 20 }).default('pending').notNull(),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    parentIdx: index('ix_edu_parent_binding_parent').on(t.parentId),
    studentIdx: index('ix_edu_parent_binding_student').on(t.studentId),
    statusIdx: index('ix_edu_parent_binding_status').on(t.status),
  }),
)

export type EduLeaveRequest = typeof eduLeaveRequest.$inferSelect
export type NewEduLeaveRequest = typeof eduLeaveRequest.$inferInsert
export type EduParentStudentBinding = typeof eduParentStudentBinding.$inferSelect
export type NewEduParentStudentBinding = typeof eduParentStudentBinding.$inferInsert

/**
 * 考试成绩表 (edu_exam_score)。
 * 记录学生每次考试的科目成绩，支持软删除。
 */
export const eduExamScore = pgTable(
  'edu_exam_score',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    studentId: uuid('student_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    classId: uuid('class_id').notNull().references(() => eduClass.id, { onDelete: 'cascade' }),
    subject: varchar('subject', { length: 100 }).notNull(),
    examName: varchar('exam_name', { length: 200 }).notNull(),
    score: integer('score').notNull(),
    totalScore: integer('total_score').default(100).notNull(),
    examDate: date('exam_date').notNull(),
    remark: text('remark'),
    recordedBy: uuid('recorded_by').references(() => users.id),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    studentIdx: index('ix_edu_score_student').on(t.studentId),
    classIdx: index('ix_edu_score_class').on(t.classId),
    subjectIdx: index('ix_edu_score_subject').on(t.subject),
    examDateIdx: index('ix_edu_score_date').on(t.examDate),
  }),
)

/**
 * 排名快照表 (edu_ranking_snapshot)。
 * 记录每次考试/排名的快照，用于历史排名对比。
 */
export const eduRankingSnapshot = pgTable(
  'edu_ranking_snapshot',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    classId: uuid('class_id').notNull().references(() => eduClass.id, { onDelete: 'cascade' }),
    examName: varchar('exam_name', { length: 200 }).notNull(),
    subject: varchar('subject', { length: 100 }),
    studentId: uuid('student_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    score: integer('score').notNull(),
    rank: integer('rank').notNull(),
    totalStudents: integer('total_students').notNull(),
    snapshotDate: date('snapshot_date').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    classExamIdx: index('ix_edu_rank_class_exam').on(t.classId, t.examName),
    studentIdx: index('ix_edu_rank_student').on(t.studentId),
    snapshotDateIdx: index('ix_edu_rank_date').on(t.snapshotDate),
  }),
)

export type EduExamScore = typeof eduExamScore.$inferSelect
export type NewEduExamScore = typeof eduExamScore.$inferInsert
export type EduRankingSnapshot = typeof eduRankingSnapshot.$inferSelect
export type NewEduRankingSnapshot = typeof eduRankingSnapshot.$inferInsert