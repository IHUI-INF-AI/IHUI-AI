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
    studentId: uuid('student_id').references(() => users.id),
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
    approverId: uuid('approver_id').references(() => users.id),
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
    parentId: uuid('parent_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    studentId: uuid('student_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
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
    studentId: uuid('student_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    classId: uuid('class_id')
      .notNull()
      .references(() => eduClass.id, { onDelete: 'cascade' }),
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
    classId: uuid('class_id')
      .notNull()
      .references(() => eduClass.id, { onDelete: 'cascade' }),
    examName: varchar('exam_name', { length: 200 }).notNull(),
    subject: varchar('subject', { length: 100 }),
    studentId: uuid('student_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
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

/**
 * 教师时间表 (edu_teacher_schedule)。
 * 教师的可授课时间段，用于自动排课约束。
 * dayOfWeek: 1=周一, 7=周日
 * timeSlot: morning/afternoon/evening
 */
export const eduTeacherSchedule = pgTable(
  'edu_teacher_schedule',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    teacherId: uuid('teacher_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    termId: uuid('term_id')
      .notNull()
      .references(() => eduTerm.id, { onDelete: 'cascade' }),
    dayOfWeek: integer('day_of_week').notNull(), // 1=周一, 7=周日
    startTime: varchar('start_time', { length: 10 }).notNull(), // HH:mm
    endTime: varchar('end_time', { length: 10 }).notNull(),
    timeSlot: varchar('time_slot', { length: 20 }), // morning/afternoon/evening
    isAvailable: boolean('is_available').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    teacherIdx: index('ix_edu_teacher_sched_teacher').on(t.teacherId),
    termIdx: index('ix_edu_teacher_sched_term').on(t.termId),
    dayIdx: index('ix_edu_teacher_sched_day').on(t.dayOfWeek),
  }),
)

/**
 * 排课规则表 (edu_scheduling_rule)。
 * 定义自动排课的约束规则(班级、科目、教师、时间、教室的匹配)。
 */
export const eduSchedulingRule = pgTable(
  'edu_scheduling_rule',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    termId: uuid('term_id')
      .notNull()
      .references(() => eduTerm.id, { onDelete: 'cascade' }),
    classId: uuid('class_id')
      .notNull()
      .references(() => eduClass.id, { onDelete: 'cascade' }),
    subject: varchar('subject', { length: 100 }).notNull(),
    teacherId: uuid('teacher_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    weekday: integer('weekday').notNull(), // 1=周一, 7=周日
    startTime: varchar('start_time', { length: 10 }).notNull(),
    endTime: varchar('end_time', { length: 10 }).notNull(),
    classroom: varchar('classroom', { length: 100 }),
    weeksPerTerm: integer('weeks_per_term').default(16), // 每学期上课周数
    priority: integer('priority').default(0), // 优先级(越高越优先排)
    isActive: boolean('is_active').default(true).notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    termIdx: index('ix_edu_sched_rule_term').on(t.termId),
    classIdx: index('ix_edu_sched_rule_class').on(t.classId),
    teacherIdx: index('ix_edu_sched_rule_teacher').on(t.teacherId),
    weekdayIdx: index('ix_edu_sched_rule_weekday').on(t.weekday),
  }),
)

/**
 * 调课申请表 (edu_schedule_change)。
 * 教师/管理员申请调课，审批通过后生效。
 * status: pending/approved/rejected/cancelled
 */
export const eduScheduleChange = pgTable(
  'edu_schedule_change',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    scheduleId: uuid('schedule_id')
      .notNull()
      .references(() => eduCourseSchedule.id, { onDelete: 'cascade' }),
    classId: uuid('class_id')
      .notNull()
      .references(() => eduClass.id, { onDelete: 'cascade' }),
    subject: varchar('subject', { length: 100 }).notNull(),
    originalTeacher: varchar('original_teacher', { length: 100 }),
    newTeacher: varchar('new_teacher', { length: 100 }),
    originalWeekday: integer('original_weekday'),
    originalStartTime: varchar('original_start_time', { length: 10 }),
    originalEndTime: varchar('original_end_time', { length: 10 }),
    newWeekday: integer('new_weekday'),
    newStartTime: varchar('new_start_time', { length: 10 }),
    newEndTime: varchar('new_end_time', { length: 10 }),
    reason: text('reason').notNull(),
    status: varchar('status', { length: 20 }).default('pending').notNull(),
    applicantId: uuid('applicant_id')
      .notNull()
      .references(() => users.id),
    approverId: uuid('approver_id').references(() => users.id),
    approveRemark: text('approve_remark'),
    approveAt: timestamp('approve_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    scheduleIdx: index('ix_edu_sched_change_schedule').on(t.scheduleId),
    classIdx: index('ix_edu_sched_change_class').on(t.classId),
    statusIdx: index('ix_edu_sched_change_status').on(t.status),
    applicantIdx: index('ix_edu_sched_change_applicant').on(t.applicantId),
  }),
)

/**
 * 作业提交记录表 (edu_homework_submission)。
 * 关联 learnHomework，记录学生作业提交和批改。
 */
export const eduHomeworkSubmission = pgTable(
  'edu_homework_submission',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    homeworkId: uuid('homework_id').notNull(),
    studentId: uuid('student_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    classId: uuid('class_id')
      .notNull()
      .references(() => eduClass.id, { onDelete: 'cascade' }),
    content: text('content'),
    attachment: varchar('attachment', { length: 500 }),
    submittedAt: timestamp('submitted_at', { withTimezone: true }).defaultNow().notNull(),
    score: integer('score'),
    comment: text('comment'),
    teacherId: uuid('teacher_id').references(() => users.id),
    gradedAt: timestamp('graded_at', { withTimezone: true }),
    status: varchar('status', { length: 20 }).default('submitted').notNull(), // submitted/graded/late/resubmit
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    homeworkIdx: index('ix_edu_hw_sub_homework').on(t.homeworkId),
    studentIdx: index('ix_edu_hw_sub_student').on(t.studentId),
    classIdx: index('ix_edu_hw_sub_class').on(t.classId),
    statusIdx: index('ix_edu_hw_sub_status').on(t.status),
  }),
)

/**
 * 线索表 (edu_lead)。
 * 招生线索管理，记录潜在学员的跟进情况。
 * source: wechat/phone/visit/referral/ad/other
 * status: new/contacted/trial/enrolled/lost
 */
export const eduLead = pgTable(
  'edu_lead',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 100 }).notNull(),
    phone: varchar('phone', { length: 20 }),
    studentName: varchar('student_name', { length: 100 }), // 学员姓名(可能和线索人不同)
    studentAge: integer('student_age'),
    source: varchar('source', { length: 30 }).notNull(),
    status: varchar('status', { length: 20 }).default('new').notNull(),
    followerId: uuid('follower_id').references(() => users.id),
    nextFollowDate: date('next_follow_date'),
    remark: text('remark'),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    statusIdx: index('ix_edu_lead_status').on(t.status),
    followerIdx: index('ix_edu_lead_follower').on(t.followerId),
    phoneIdx: index('ix_edu_lead_phone').on(t.phone),
  }),
)

/**
 * 试听预约表 (edu_trial_booking)。
 * 线索转化的试听预约安排。
 * status: pending/confirmed/completed/cancelled
 */
export const eduTrialBooking = pgTable(
  'edu_trial_booking',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    leadId: uuid('lead_id')
      .notNull()
      .references(() => eduLead.id, { onDelete: 'cascade' }),
    studentName: varchar('student_name', { length: 100 }).notNull(),
    studentAge: integer('student_age'),
    parentName: varchar('parent_name', { length: 100 }),
    parentPhone: varchar('parent_phone', { length: 20 }),
    trialDate: date('trial_date').notNull(),
    trialTime: varchar('trial_time', { length: 50 }), // 时间段描述
    subject: varchar('subject', { length: 100 }),
    teacherId: uuid('teacher_id').references(() => users.id),
    classroom: varchar('classroom', { length: 100 }),
    status: varchar('status', { length: 20 }).default('pending').notNull(),
    remark: text('remark'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    leadIdx: index('ix_edu_trial_lead').on(t.leadId),
    dateIdx: index('ix_edu_trial_date').on(t.trialDate),
    statusIdx: index('ix_edu_trial_status').on(t.status),
  }),
)

/**
 * 报名记录表 (edu_enrollment)。
 * 学生报名/续费记录。
 * status: enrolled/withdrawn/graduate
 */
export const eduEnrollment = pgTable(
  'edu_enrollment',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    studentId: uuid('student_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    classId: uuid('class_id')
      .notNull()
      .references(() => eduClass.id, { onDelete: 'cascade' }),
    termId: uuid('term_id')
      .notNull()
      .references(() => eduTerm.id, { onDelete: 'cascade' }),
    enrollDate: date('enroll_date').notNull(),
    totalFee: integer('total_fee').notNull(),
    paidAmount: integer('paid_amount').default(0).notNull(),
    status: varchar('status', { length: 20 }).default('enrolled').notNull(),
    remark: text('remark'),
    operatorId: uuid('operator_id').references(() => users.id),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    studentIdx: index('ix_edu_enroll_student').on(t.studentId),
    classIdx: index('ix_edu_enroll_class').on(t.classId),
    termIdx: index('ix_edu_enroll_term').on(t.termId),
    statusIdx: index('ix_edu_enroll_status').on(t.status),
  }),
)

/**
 * 学费标准表 (edu_tuition_fee)。
 * 各班级/课程的学费定价标准。
 */
export const eduTuitionFee = pgTable(
  'edu_tuition_fee',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    classId: uuid('class_id')
      .notNull()
      .references(() => eduClass.id, { onDelete: 'cascade' }),
    termId: uuid('term_id')
      .notNull()
      .references(() => eduTerm.id, { onDelete: 'cascade' }),
    feeName: varchar('fee_name', { length: 100 }).notNull(),
    amount: integer('amount').notNull(),
    billingCycle: varchar('billing_cycle', { length: 30 }).default('term').notNull(), // term/monthly/yearly
    effectiveDate: date('effective_date').notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    classIdx: index('ix_edu_fee_class').on(t.classId),
    termIdx: index('ix_edu_fee_term').on(t.termId),
    activeIdx: index('ix_edu_fee_active').on(t.isActive),
  }),
)

/**
 * 缴费记录表 (edu_payment_record)。
 * 记录学生的缴费历史。
 * paymentMethod: cash/transfer/wechat/alipay/credit_card/other
 * status: pending/paid/refunded/cancelled
 */
export const eduPaymentRecord = pgTable(
  'edu_payment_record',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    studentId: uuid('student_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    classId: uuid('class_id')
      .notNull()
      .references(() => eduClass.id, { onDelete: 'cascade' }),
    feeId: uuid('fee_id').references(() => eduTuitionFee.id),
    amount: integer('amount').notNull(),
    paymentDate: date('payment_date').notNull(),
    paymentMethod: varchar('payment_method', { length: 30 }).notNull(),
    status: varchar('status', { length: 20 }).default('paid').notNull(),
    receiptNo: varchar('receipt_no', { length: 100 }),
    remark: text('remark'),
    operatorId: uuid('operator_id').references(() => users.id),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    studentIdx: index('ix_edu_pay_student').on(t.studentId),
    classIdx: index('ix_edu_pay_class').on(t.classId),
    feeIdx: index('ix_edu_pay_fee').on(t.feeId),
    dateIdx: index('ix_edu_pay_date').on(t.paymentDate),
  }),
)

/**
 * 退费记录表 (edu_refund_record)。
 * 记录学生的退费历史。
 * status: pending/approved/rejected/completed/cancelled
 */
export const eduRefundRecord = pgTable(
  'edu_refund_record',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    studentId: uuid('student_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    classId: uuid('class_id')
      .notNull()
      .references(() => eduClass.id, { onDelete: 'cascade' }),
    paymentId: uuid('payment_id').references(() => eduPaymentRecord.id),
    amount: integer('amount').notNull(),
    refundDate: date('refund_date').notNull(),
    refundMethod: varchar('refund_method', { length: 30 }),
    reason: text('reason').notNull(),
    status: varchar('status', { length: 20 }).default('pending').notNull(),
    approverId: uuid('approver_id').references(() => users.id),
    approveRemark: text('approve_remark'),
    approveAt: timestamp('approve_at', { withTimezone: true }),
    operatorId: uuid('operator_id').references(() => users.id),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    studentIdx: index('ix_edu_refund_student').on(t.studentId),
    classIdx: index('ix_edu_refund_class').on(t.classId),
    paymentIdx: index('ix_edu_refund_payment').on(t.paymentId),
    statusIdx: index('ix_edu_refund_status').on(t.status),
  }),
)

export type NewEduTeacherSchedule = typeof eduTeacherSchedule.$inferInsert
export type EduTeacherSchedule = typeof eduTeacherSchedule.$inferSelect
export type NewEduSchedulingRule = typeof eduSchedulingRule.$inferInsert
export type EduSchedulingRule = typeof eduSchedulingRule.$inferSelect
export type NewEduScheduleChange = typeof eduScheduleChange.$inferInsert
export type EduScheduleChange = typeof eduScheduleChange.$inferSelect
export type NewEduHomeworkSubmission = typeof eduHomeworkSubmission.$inferInsert
export type EduHomeworkSubmission = typeof eduHomeworkSubmission.$inferSelect
export type NewEduLead = typeof eduLead.$inferInsert
export type EduLead = typeof eduLead.$inferSelect
export type NewEduTrialBooking = typeof eduTrialBooking.$inferInsert
export type EduTrialBooking = typeof eduTrialBooking.$inferSelect
export type NewEduEnrollment = typeof eduEnrollment.$inferInsert
export type EduEnrollment = typeof eduEnrollment.$inferSelect
export type NewEduTuitionFee = typeof eduTuitionFee.$inferInsert
export type EduTuitionFee = typeof eduTuitionFee.$inferSelect
export type NewEduPaymentRecord = typeof eduPaymentRecord.$inferInsert
export type EduPaymentRecord = typeof eduPaymentRecord.$inferSelect
export type NewEduRefundRecord = typeof eduRefundRecord.$inferInsert
export type EduRefundRecord = typeof eduRefundRecord.$inferSelect
