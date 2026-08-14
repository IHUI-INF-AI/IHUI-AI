import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import {
  eq,
  and,
  or,
  desc,
  isNull,
  between,
  gte,
  lte,
  count,
  sql,
  inArray,
  ne,
  type SQL,
} from 'drizzle-orm'
import type { AnyPgTable, AnyPgColumn } from 'drizzle-orm/pg-core'
import { db } from '../db/index.js'
import {
  eduTerm,
  eduClass,
  eduCourseSchedule,
  eduMealRecipe,
  eduMealWeekTemplate,
  eduStudyPlan,
  eduPlanItem,
  eduAttendanceRecord,
  eduExamScore,
  eduRankingSnapshot,
  eduLeaveRequest,
  eduParentStudentBinding,
  eduTeacherSchedule,
  eduSchedulingRule,
  eduScheduleChange,
  eduHomeworkSubmission,
  eduLead,
  eduTrialBooking,
  eduEnrollment,
  eduTuitionFee,
  eduPaymentRecord,
  eduRefundRecord,
  users,
} from '@ihui/database'
import { requireAdmin } from '../plugins/require-permission.js'
import { success, error, emptyToUndefined } from '../utils/response.js'

// =============================================================================
// 通用 Zod schemas
// =============================================================================

const uuidParamSchema = z.object({ id: z.string().uuid('无效的 ID') })

// =============================================================================
// 1. 学期管理 (edu_term)
// =============================================================================

const createTermSchema = z.object({
  name: z.string().min(1).max(100),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  isCurrent: z.boolean().optional(),
})

const updateTermSchema = createTermSchema.partial()

// =============================================================================
// 2. 班级管理 (edu_class)
// =============================================================================

const classListQuerySchema = z.object({
  termId: z.transform(emptyToUndefined).pipe(z.string().uuid().optional()),
})

const createClassSchema = z.object({
  termId: z.string().uuid(),
  name: z.string().min(1).max(100),
  grade: z.string().max(50).optional(),
})

const updateClassSchema = createClassSchema.partial()

// =============================================================================
// 3. 课程条目 (edu_course_schedule)
// =============================================================================

const scheduleListQuerySchema = z.object({
  termId: z.transform(emptyToUndefined).pipe(z.string().uuid().optional()),
  classId: z.transform(emptyToUndefined).pipe(z.string().uuid().optional()),
  weekday: z.transform(emptyToUndefined).pipe(z.coerce.number().int().min(1).max(7).optional()),
})

const createScheduleSchema = z.object({
  termId: z.string().uuid(),
  classId: z.string().uuid(),
  courseName: z.string().min(1).max(200),
  teacher: z.string().max(100).optional(),
  weekday: z.number().int().min(1).max(7),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, '时间格式 HH:mm'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, '时间格式 HH:mm'),
  classroom: z.string().max(100).optional(),
  color: z.string().max(20).optional(),
})

const updateScheduleSchema = createScheduleSchema.partial()

// =============================================================================
// 4. 每日菜谱 (edu_meal_recipe)
// =============================================================================

const mealListQuerySchema = z.object({
  startDate: z.transform(emptyToUndefined).pipe(z.string().optional()),
  endDate: z.transform(emptyToUndefined).pipe(z.string().optional()),
  mealType: z.transform(emptyToUndefined).pipe(z.string().max(20).optional()),
})

const createMealSchema = z.object({
  date: z.string().min(1),
  mealType: z.string().min(1).max(20),
  dishName: z.string().min(1).max(200),
  ingredients: z.string().optional(),
  nutrition: z.string().max(500).optional(),
  imageUrl: z.string().max(500).optional(),
  notes: z.string().optional(),
})

const updateMealSchema = createMealSchema.partial()

// =============================================================================
// 5. 周菜谱模板 (edu_meal_week_template)
// =============================================================================

const templateListQuerySchema = z.object({
  name: z.transform(emptyToUndefined).pipe(z.string().max(100).optional()),
})

const createTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  weekday: z.number().int().min(1).max(7),
  mealType: z.string().min(1).max(20),
  dishName: z.string().min(1).max(200),
  ingredients: z.string().optional(),
  nutrition: z.string().max(500).optional(),
})

const updateTemplateSchema = createTemplateSchema.partial()

const applyTemplateSchema = z.object({
  templateName: z.string().min(1).max(100),
  startDate: z.string().min(1),
})

// =============================================================================
// 3b. 课程表新增功能
// =============================================================================

const copyLastWeekSchema = z.object({
  classId: z.string().uuid(),
  targetWeekStart: z.string().min(1), // 目标周周一日期 YYYY-MM-DD
})

const checkTeacherConflictSchema = z.object({
  teacher: z.string().min(1).max(100),
  weekday: z.number().int().min(1).max(7),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, '时间格式 HH:mm'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, '时间格式 HH:mm'),
  excludeScheduleId: z.string().uuid().optional(),
})

const scheduleExportQuerySchema = z.object({
  classId: z.string().uuid(),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
})

// =============================================================================
// 4b. 菜谱新增功能
// =============================================================================

const nutritionSummaryQuerySchema = z.object({
  startDate: z.string().min(1),
  endDate: z.string().min(1),
})

const generateShoppingListSchema = z.object({
  startDate: z.string().min(1),
  endDate: z.string().min(1),
})

const uploadImageSchema = z.object({
  id: z.string().uuid(),
  imageUrl: z.string().min(1).max(500),
})

// =============================================================================
// 6b. 学习计划新增功能
// =============================================================================

const completionStatsQuerySchema = z.object({
  classId: z.string().uuid(),
  termId: z.string().uuid(),
})

const progressTimelineQuerySchema = z.object({
  planId: z.string().uuid(),
})

const reviewItemSchema = z.object({
  notes: z.string().optional(),
  reviewed: z.boolean().optional(),
})

// =============================================================================
// 6. 学习计划 (edu_study_plan) + 计划条目 (edu_plan_item)
// =============================================================================

const planListQuerySchema = z.object({
  classId: z.transform(emptyToUndefined).pipe(z.string().uuid().optional()),
  termId: z.transform(emptyToUndefined).pipe(z.string().uuid().optional()),
  planType: z.transform(emptyToUndefined).pipe(z.string().max(20).optional()),
  status: z.transform(emptyToUndefined).pipe(z.string().max(20).optional()),
})

const createPlanSchema = z.object({
  title: z.string().min(1).max(200),
  planType: z.enum(['monthly', 'weekly']),
  classId: z.string().uuid(),
  termId: z.string().uuid(),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  description: z.string().optional(),
  status: z.string().max(20).optional(),
})

const updatePlanSchema = createPlanSchema.partial()

const createPlanItemSchema = z.object({
  content: z.string().min(1),
  objective: z.string().max(500).optional(),
  dueDate: z.string().optional(),
  studentId: z.string().uuid().optional(),
  parentItemId: z.string().uuid().optional(),
  notes: z.string().optional(),
  sortOrder: z.number().int().optional(),
})

const updatePlanItemSchema = createPlanItemSchema.partial().extend({
  completed: z.boolean().optional(),
})

// =============================================================================
// 8. 签到记录 (edu_attendance_record)
// =============================================================================

const attendanceListQuerySchema = z.object({
  studentId: z.transform(emptyToUndefined).pipe(z.string().uuid().optional()),
  classId: z.transform(emptyToUndefined).pipe(z.string().uuid().optional()),
  date: z.transform(emptyToUndefined).pipe(z.string().optional()),
  status: z.transform(emptyToUndefined).pipe(z.string().max(20).optional()),
})

const checkInSchema = z.object({
  studentId: z.string().uuid(),
  classId: z.string().uuid(),
  date: z.string().optional(),
  checkInMethod: z.string().max(20).optional(),
  status: z.string().max(20).optional(),
  remark: z.string().optional(),
})

const checkOutSchema = z.object({
  studentId: z.string().uuid(),
  classId: z.string().uuid(),
  date: z.string().min(1),
  checkOutMethod: z.string().max(20).optional(),
})

const updateAttendanceSchema = z.object({
  status: z.string().max(20).optional(),
  checkInTime: z.string().optional(),
  checkOutTime: z.string().optional(),
  checkInMethod: z.string().max(20).optional(),
  checkOutMethod: z.string().max(20).optional(),
  remark: z.string().optional(),
})

const attendanceStatsQuerySchema = z.object({
  classId: z.transform(emptyToUndefined).pipe(z.string().uuid().optional()),
  startDate: z.transform(emptyToUndefined).pipe(z.string().optional()),
  endDate: z.transform(emptyToUndefined).pipe(z.string().optional()),
  period: z.transform(emptyToUndefined).pipe(z.enum(['daily', 'weekly', 'monthly']).optional()),
})

// =============================================================================
// 9. 请假申请 (edu_leave_request)
// =============================================================================

const leaveListQuerySchema = z.object({
  studentId: z.transform(emptyToUndefined).pipe(z.string().uuid().optional()),
  classId: z.transform(emptyToUndefined).pipe(z.string().uuid().optional()),
  status: z.transform(emptyToUndefined).pipe(z.string().max(20).optional()),
  startDate: z.transform(emptyToUndefined).pipe(z.string().optional()),
  endDate: z.transform(emptyToUndefined).pipe(z.string().optional()),
})

const createLeaveSchema = z.object({
  studentId: z.string().uuid(),
  classId: z.string().uuid(),
  leaveType: z.enum(['sick', 'personal', 'emergency', 'other']),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  totalDays: z.number().int().min(1),
  reason: z.string().min(1),
  attachment: z.string().max(500).optional(),
})

const updateLeaveSchema = createLeaveSchema.partial()

const approveLeaveSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  approveRemark: z.string().optional(),
})

// =============================================================================
// 10. 家长-学生绑定管理 (edu_parent_student_binding)
// =============================================================================

const createBindingSchema = z.object({
  studentId: z.string().uuid(),
  relationship: z.enum(['father', 'mother', 'guardian', 'other']),
})

const updateBindingSchema = z.object({
  relationship: z.enum(['father', 'mother', 'guardian', 'other']).optional(),
  status: z.enum(['confirmed', 'rejected']).optional(),
})

const bindingListQuerySchema = z.object({
  status: z.transform(emptyToUndefined).pipe(z.string().max(20).optional()),
})

// =============================================================================
// 11. 孩子数据查看（家长端）
// =============================================================================

const childAttendanceQuerySchema = z.object({
  status: z.transform(emptyToUndefined).pipe(z.string().max(20).optional()),
  startDate: z.transform(emptyToUndefined).pipe(z.string().optional()),
  endDate: z.transform(emptyToUndefined).pipe(z.string().optional()),
})

// =============================================================================
// 12. 考试成绩管理 (edu_exam_score)
// =============================================================================

const examScoreListQuerySchema = z.object({
  classId: z.transform(emptyToUndefined).pipe(z.string().uuid().optional()),
  subject: z.transform(emptyToUndefined).pipe(z.string().max(100).optional()),
  examName: z.transform(emptyToUndefined).pipe(z.string().max(200).optional()),
})

const createExamScoreSchema = z.object({
  studentId: z.string().uuid(),
  classId: z.string().uuid(),
  subject: z.string().min(1).max(100),
  examName: z.string().min(1).max(200),
  score: z.number().int().min(0),
  totalScore: z.number().int().min(1).default(100),
  examDate: z.string().min(1),
  remark: z.string().optional(),
})

const examScoreStatsQuerySchema = z.object({
  classId: z.transform(emptyToUndefined).pipe(z.string().uuid().optional()),
})

const examScoreRankingQuerySchema = z.object({
  classId: z.transform(emptyToUndefined).pipe(z.string().uuid().optional()),
  examName: z.transform(emptyToUndefined).pipe(z.string().max(200).optional()),
})

const createSnapshotSchema = z.object({
  classId: z.string().uuid(),
  examName: z.string().min(1).max(200),
})

// =============================================================================
// 13. 教师时间表 (edu_teacher_schedule)
// =============================================================================

const teacherScheduleListQuerySchema = z.object({
  termId: z.transform(emptyToUndefined).pipe(z.string().uuid().optional()),
})

const createTeacherScheduleSchema = z.object({
  teacherId: z.string().uuid(),
  termId: z.string().uuid(),
  dayOfWeek: z.number().int().min(1).max(7),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, '时间格式 HH:mm'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, '时间格式 HH:mm'),
  timeSlot: z.string().max(20).optional(),
  isAvailable: z.boolean().optional(),
})

const updateTeacherScheduleSchema = createTeacherScheduleSchema.partial()

// =============================================================================
// 14. 排课规则 (edu_scheduling_rule)
// =============================================================================

const schedulingRuleListQuerySchema = z.object({
  termId: z.transform(emptyToUndefined).pipe(z.string().uuid().optional()),
  classId: z.transform(emptyToUndefined).pipe(z.string().uuid().optional()),
})

const createSchedulingRuleSchema = z.object({
  termId: z.string().uuid(),
  classId: z.string().uuid(),
  subject: z.string().min(1).max(100),
  teacherId: z.string().uuid(),
  weekday: z.number().int().min(1).max(7),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, '时间格式 HH:mm'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, '时间格式 HH:mm'),
  classroom: z.string().max(100).optional(),
  weeksPerTerm: z.number().int().optional(),
  priority: z.number().int().optional(),
})

const updateSchedulingRuleSchema = createSchedulingRuleSchema.partial()

// =============================================================================
// 15. 自动排课 + 冲突检测
// =============================================================================

const autoGenerateSchema = z.object({
  termId: z.string().uuid(),
  classId: z.transform(emptyToUndefined).pipe(z.string().uuid().optional()),
})

const checkConflictSchema = z.object({
  termId: z.string().uuid(),
  weekday: z.number().int().min(1).max(7),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, '时间格式 HH:mm'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, '时间格式 HH:mm'),
  classroom: z.string().max(100).optional(),
  teacherId: z.transform(emptyToUndefined).pipe(z.string().uuid().optional()),
  excludeScheduleId: z.transform(emptyToUndefined).pipe(z.string().uuid().optional()),
})

// =============================================================================
// 16. 调课申请 (edu_schedule_change)
// =============================================================================

const scheduleChangeListQuerySchema = z.object({
  status: z.transform(emptyToUndefined).pipe(z.string().max(20).optional()),
})

const createScheduleChangeSchema = z.object({
  scheduleId: z.string().uuid(),
  classId: z.string().uuid(),
  subject: z.string().min(1).max(100),
  originalTeacher: z.string().max(100).optional(),
  newTeacher: z.string().max(100).optional(),
  originalWeekday: z.number().int().optional(),
  originalStartTime: z.string().optional(),
  originalEndTime: z.string().optional(),
  newWeekday: z.number().int().optional(),
  newStartTime: z.string().optional(),
  newEndTime: z.string().optional(),
  reason: z.string().min(1),
})

const approveChangeSchema = z.object({
  approveRemark: z.string().optional(),
})

// =============================================================================
// 17. 作业提交 (edu_homework_submission)
// =============================================================================

const homeworkSubmissionListQuerySchema = z.object({
  homeworkId: z.transform(emptyToUndefined).pipe(z.string().uuid().optional()),
  classId: z.transform(emptyToUndefined).pipe(z.string().uuid().optional()),
})

const createHomeworkSubmissionSchema = z.object({
  homeworkId: z.string().uuid(),
  studentId: z.string().uuid(),
  classId: z.string().uuid(),
  content: z.string().optional(),
  attachment: z.string().max(500).optional(),
})

const gradeHomeworkSubmissionSchema = z.object({
  score: z.number().int().min(0),
  comment: z.string().optional(),
})

const homeworkSubmissionStatsQuerySchema = z.object({
  classId: z.transform(emptyToUndefined).pipe(z.string().uuid().optional()),
})

// =============================================================================
// 18. 线索管理 (edu_lead)
// =============================================================================

const leadListQuerySchema = z.object({
  status: z.transform(emptyToUndefined).pipe(z.string().max(20).optional()),
  source: z.transform(emptyToUndefined).pipe(z.string().max(30).optional()),
  followerId: z.transform(emptyToUndefined).pipe(z.string().uuid().optional()),
})

const createLeadSchema = z.object({
  name: z.string().min(1).max(100),
  phone: z.string().max(20).optional(),
  studentName: z.string().max(100).optional(),
  studentAge: z.number().int().min(0).optional(),
  source: z.string().min(1).max(30),
  followerId: z.string().uuid().optional(),
  nextFollowDate: z.string().optional(),
  remark: z.string().optional(),
})

const updateLeadSchema = createLeadSchema.partial()

const updateLeadStatusSchema = z.object({
  status: z.string().min(1).max(20),
})

// =============================================================================
// 19. 试听预约 (edu_trial_booking)
// =============================================================================

const trialBookingListQuerySchema = z.object({
  status: z.transform(emptyToUndefined).pipe(z.string().max(20).optional()),
  date: z.transform(emptyToUndefined).pipe(z.string().optional()),
})

const createTrialBookingSchema = z.object({
  leadId: z.string().uuid(),
  studentName: z.string().min(1).max(100),
  studentAge: z.number().int().min(0).optional(),
  parentName: z.string().max(100).optional(),
  parentPhone: z.string().max(20).optional(),
  trialDate: z.string().min(1),
  trialTime: z.string().max(50).optional(),
  subject: z.string().max(100).optional(),
  teacherId: z.string().uuid().optional(),
  classroom: z.string().max(100).optional(),
})

const updateTrialBookingSchema = createTrialBookingSchema.partial()

const updateTrialBookingStatusSchema = z.object({
  status: z.string().min(1).max(20),
})

// =============================================================================
// 20. 报名记录 (edu_enrollment)
// =============================================================================

const enrollmentListQuerySchema = z.object({
  classId: z.transform(emptyToUndefined).pipe(z.string().uuid().optional()),
  termId: z.transform(emptyToUndefined).pipe(z.string().uuid().optional()),
  status: z.transform(emptyToUndefined).pipe(z.string().max(20).optional()),
})

const createEnrollmentSchema = z.object({
  studentId: z.string().uuid(),
  classId: z.string().uuid(),
  termId: z.string().uuid(),
  enrollDate: z.string().min(1),
  totalFee: z.number().int().min(0),
  paidAmount: z.number().int().min(0).optional(),
  operatorId: z.string().uuid().optional(),
})

const updateEnrollmentSchema = createEnrollmentSchema.partial()

// =============================================================================
// 21. 学费标准 (edu_tuition_fee)
// =============================================================================

const tuitionFeeListQuerySchema = z.object({
  classId: z.transform(emptyToUndefined).pipe(z.string().uuid().optional()),
  termId: z.transform(emptyToUndefined).pipe(z.string().uuid().optional()),
})

const createTuitionFeeSchema = z.object({
  classId: z.string().uuid(),
  termId: z.string().uuid(),
  feeName: z.string().min(1).max(100),
  amount: z.number().int().min(0),
  billingCycle: z.string().max(30).optional(),
  effectiveDate: z.string().min(1),
})

const updateTuitionFeeSchema = createTuitionFeeSchema.partial()

// =============================================================================
// 22. 缴费记录 (edu_payment_record)
// =============================================================================

const paymentRecordListQuerySchema = z.object({
  studentId: z.transform(emptyToUndefined).pipe(z.string().uuid().optional()),
  classId: z.transform(emptyToUndefined).pipe(z.string().uuid().optional()),
  status: z.transform(emptyToUndefined).pipe(z.string().max(20).optional()),
})

const createPaymentRecordSchema = z.object({
  studentId: z.string().uuid(),
  classId: z.string().uuid(),
  feeId: z.string().uuid().optional(),
  amount: z.number().int().min(0),
  paymentDate: z.string().min(1),
  paymentMethod: z.string().min(1).max(30),
  status: z.string().max(20).optional(),
  receiptNo: z.string().max(100).optional(),
  remark: z.string().optional(),
  operatorId: z.string().uuid().optional(),
})

const paymentRecordSummaryQuerySchema = z.object({
  classId: z.transform(emptyToUndefined).pipe(z.string().uuid().optional()),
  termId: z.transform(emptyToUndefined).pipe(z.string().uuid().optional()),
})

// =============================================================================
// 23. 退费记录 (edu_refund_record)
// =============================================================================

const refundRecordListQuerySchema = z.object({
  studentId: z.transform(emptyToUndefined).pipe(z.string().uuid().optional()),
  classId: z.transform(emptyToUndefined).pipe(z.string().uuid().optional()),
  status: z.transform(emptyToUndefined).pipe(z.string().max(20).optional()),
})

const createRefundRecordSchema = z.object({
  studentId: z.string().uuid(),
  classId: z.string().uuid(),
  paymentId: z.string().uuid().optional(),
  amount: z.number().int().min(0),
  refundDate: z.string().min(1),
  refundMethod: z.string().max(30).optional(),
  reason: z.string().min(1),
  operatorId: z.string().uuid().optional(),
})

const approveRefundSchema = z.object({
  approveRemark: z.string().optional(),
})

// =============================================================================
// 批量操作 Schema
// =============================================================================

const batchDeleteSchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
})

const batchToggleSchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
  isActive: z.boolean(),
})

const batchStatusSchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
  status: z.string().min(1).max(20),
})

// =============================================================================
// 分页 Schema & 辅助函数
// =============================================================================

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

async function paginate(
  queryBuilder: AnyPgTable,
  where: SQL | undefined,
  orderBy: SQL | AnyPgColumn | Array<SQL | AnyPgColumn>,
  page: number,
  pageSize: number,
) {
  const [totalResult] = await db
    .select({ count: count() })
    .from(queryBuilder)
    .where(where ?? sql`true`)
  const total = Number(totalResult?.count ?? 0)
  const totalPages = Math.ceil(total / pageSize)
  const orderByArr = Array.isArray(orderBy) ? orderBy : [orderBy]
  const list = await db
    .select()
    .from(queryBuilder)
    .where(where ?? sql`true`)
    .orderBy(...orderByArr)
    .limit(pageSize)
    .offset((page - 1) * pageSize)
  return { list, total, page, pageSize, totalPages }
}

// =============================================================================
// 路由
// =============================================================================

const eduAiManagementRoutes: FastifyPluginAsync = async (server) => {
  // ===========================================================================
  // 1. 学期管理 CRUD
  // ===========================================================================

  server.get('/term', async (request, reply) => {
    const { page, pageSize } = paginationSchema.parse(request.query)
    const result = await paginate(
      eduTerm,
      undefined,
      [desc(eduTerm.isCurrent), desc(eduTerm.startDate)],
      page,
      pageSize,
    )
    return reply.send(success(result))
  })

  server.get('/term/:id', async (request, reply) => {
    const parsed = uuidParamSchema.safeParse(request.params)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [row] = await db.select().from(eduTerm).where(eq(eduTerm.id, parsed.data.id)).limit(1)
    if (!row) return reply.status(404).send(error(404, '学期不存在'))
    return reply.send(success({ term: row }))
  })

  server.post('/term', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const parsed = createTermSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    // 如果设为当前学期，先把其他学期设为非当前
    if (parsed.data.isCurrent) {
      await db.update(eduTerm).set({ isCurrent: false })
    }
    const [row] = await db.insert(eduTerm).values(parsed.data).returning()
    return reply.status(201).send(success({ term: row }))
  })

  server.put('/term/:id', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const idParsed = uuidParamSchema.safeParse(request.params)
    if (!idParsed.success)
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    const parsed = updateTermSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [existing] = await db
      .select()
      .from(eduTerm)
      .where(eq(eduTerm.id, idParsed.data.id))
      .limit(1)
    if (!existing) return reply.status(404).send(error(404, '学期不存在'))
    if (parsed.data.isCurrent) {
      await db.update(eduTerm).set({ isCurrent: false })
    }
    const [row] = await db
      .update(eduTerm)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(eduTerm.id, idParsed.data.id))
      .returning()
    return reply.send(success({ term: row }))
  })

  server.delete('/term/:id', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const parsed = uuidParamSchema.safeParse(request.params)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [existing] = await db
      .select()
      .from(eduTerm)
      .where(eq(eduTerm.id, parsed.data.id))
      .limit(1)
    if (!existing) return reply.status(404).send(error(404, '学期不存在'))
    await db.delete(eduTerm).where(eq(eduTerm.id, parsed.data.id))
    return reply.send(success({ deleted: true }))
  })

  // ===========================================================================
  // 2. 班级管理 CRUD
  // ===========================================================================

  server.get('/class', async (request, reply) => {
    const parsed = classListQuerySchema.safeParse(request.query)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const conds: SQL[] = []
    if (parsed.data.termId) conds.push(eq(eduClass.termId, parsed.data.termId))
    const where = conds.length > 0 ? and(...conds) : undefined
    const list = await db.select().from(eduClass).where(where).orderBy(desc(eduClass.createdAt))
    return reply.send(success({ list }))
  })

  server.get('/class/:id', async (request, reply) => {
    const parsed = uuidParamSchema.safeParse(request.params)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [row] = await db.select().from(eduClass).where(eq(eduClass.id, parsed.data.id)).limit(1)
    if (!row) return reply.status(404).send(error(404, '班级不存在'))
    return reply.send(success({ class: row }))
  })

  server.post('/class', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const parsed = createClassSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [row] = await db.insert(eduClass).values(parsed.data).returning()
    return reply.status(201).send(success({ class: row }))
  })

  server.put('/class/:id', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const idParsed = uuidParamSchema.safeParse(request.params)
    if (!idParsed.success)
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    const parsed = updateClassSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [existing] = await db
      .select()
      .from(eduClass)
      .where(eq(eduClass.id, idParsed.data.id))
      .limit(1)
    if (!existing) return reply.status(404).send(error(404, '班级不存在'))
    const [row] = await db
      .update(eduClass)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(eduClass.id, idParsed.data.id))
      .returning()
    return reply.send(success({ class: row }))
  })

  server.delete('/class/:id', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const parsed = uuidParamSchema.safeParse(request.params)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [existing] = await db
      .select()
      .from(eduClass)
      .where(eq(eduClass.id, parsed.data.id))
      .limit(1)
    if (!existing) return reply.status(404).send(error(404, '班级不存在'))
    await db.delete(eduClass).where(eq(eduClass.id, parsed.data.id))
    return reply.send(success({ deleted: true }))
  })

  // ===========================================================================
  // 3. 课程条目 CRUD
  // ===========================================================================

  server.get('/schedule', async (request, reply) => {
    const parsed = scheduleListQuerySchema.safeParse(request.query)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const conds = [isNull(eduCourseSchedule.deletedAt)]
    if (parsed.data.termId) conds.push(eq(eduCourseSchedule.termId, parsed.data.termId))
    if (parsed.data.classId) conds.push(eq(eduCourseSchedule.classId, parsed.data.classId))
    if (parsed.data.weekday) conds.push(eq(eduCourseSchedule.weekday, parsed.data.weekday))
    const where = and(...conds)
    const list = await db
      .select()
      .from(eduCourseSchedule)
      .where(where)
      .orderBy(eduCourseSchedule.weekday, eduCourseSchedule.startTime)
    return reply.send(success({ list }))
  })

  server.get('/schedule/:id', async (request, reply) => {
    const parsed = uuidParamSchema.safeParse(request.params)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [row] = await db
      .select()
      .from(eduCourseSchedule)
      .where(and(eq(eduCourseSchedule.id, parsed.data.id), isNull(eduCourseSchedule.deletedAt)))
      .limit(1)
    if (!row) return reply.status(404).send(error(404, '课程不存在'))
    return reply.send(success({ schedule: row }))
  })

  server.post('/schedule', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const parsed = createScheduleSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [row] = await db.insert(eduCourseSchedule).values(parsed.data).returning()
    return reply.status(201).send(success({ schedule: row }))
  })

  server.put('/schedule/:id', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const idParsed = uuidParamSchema.safeParse(request.params)
    if (!idParsed.success)
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    const parsed = updateScheduleSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [existing] = await db
      .select()
      .from(eduCourseSchedule)
      .where(and(eq(eduCourseSchedule.id, idParsed.data.id), isNull(eduCourseSchedule.deletedAt)))
      .limit(1)
    if (!existing) return reply.status(404).send(error(404, '课程不存在'))
    const [row] = await db
      .update(eduCourseSchedule)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(eduCourseSchedule.id, idParsed.data.id))
      .returning()
    return reply.send(success({ schedule: row }))
  })

  server.delete('/schedule/:id', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const parsed = uuidParamSchema.safeParse(request.params)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [existing] = await db
      .select()
      .from(eduCourseSchedule)
      .where(and(eq(eduCourseSchedule.id, parsed.data.id), isNull(eduCourseSchedule.deletedAt)))
      .limit(1)
    if (!existing) return reply.status(404).send(error(404, '课程不存在'))
    await db
      .update(eduCourseSchedule)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(eduCourseSchedule.id, parsed.data.id))
    return reply.send(success({ deleted: true }))
  })

  // ===========================================================================
  // 3b. 课程表新增功能：复制上周 / 教师冲突检测 / 导出
  // ===========================================================================

  server.post('/schedule/copy-last-week', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const parsed = copyLastWeekSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const { classId, targetWeekStart: _targetWeekStart } = parsed.data

    // 查询该班级所有课程条目（课程表按 weekday 存储，不绑定具体日期）
    const lastWeekSchedules = await db
      .select()
      .from(eduCourseSchedule)
      .where(and(eq(eduCourseSchedule.classId, classId), isNull(eduCourseSchedule.deletedAt)))

    if (lastWeekSchedules.length === 0) {
      return reply.send(success({ count: 0, message: '上周无课程数据' }))
    }

    // 复制到目标周（weekday不变，日期区间调整）
    const newSchedules = lastWeekSchedules.map((s) => ({
      termId: s.termId,
      classId: s.classId,
      courseName: s.courseName,
      teacher: s.teacher,
      weekday: s.weekday,
      startTime: s.startTime,
      endTime: s.endTime,
      classroom: s.classroom,
      color: s.color,
    }))

    const inserted = await db.insert(eduCourseSchedule).values(newSchedules).returning()
    return reply.status(201).send(success({ count: inserted.length, schedules: inserted }))
  })

  server.post('/schedule/check-teacher-conflict', async (request, reply) => {
    const parsed = checkTeacherConflictSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const { teacher, weekday, startTime, endTime, excludeScheduleId } = parsed.data

    const conds: SQL[] = [
      eq(eduCourseSchedule.teacher, teacher),
      eq(eduCourseSchedule.weekday, weekday),
      isNull(eduCourseSchedule.deletedAt),
    ]

    // 排除当前编辑的课程
    if (excludeScheduleId) {
      conds.push(ne(eduCourseSchedule.id, excludeScheduleId))
    }

    // 时间重叠检测: (startA < endB) AND (endA > startB)
    conds.push(
      sql`${eduCourseSchedule.startTime} < ${endTime}`,
      sql`${eduCourseSchedule.endTime} > ${startTime}`,
    )

    const conflicts = await db
      .select()
      .from(eduCourseSchedule)
      .where(and(...conds))
      .orderBy(eduCourseSchedule.startTime)

    return reply.send(success({ conflicts, hasConflict: conflicts.length > 0 }))
  })

  server.get('/schedule/export', async (request, reply) => {
    const parsed = scheduleExportQuerySchema.safeParse(request.query)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const { classId, startDate, endDate } = parsed.data

    const list = await db
      .select()
      .from(eduCourseSchedule)
      .where(and(eq(eduCourseSchedule.classId, classId), isNull(eduCourseSchedule.deletedAt)))
      .orderBy(eduCourseSchedule.weekday, eduCourseSchedule.startTime)

    // 获取班级信息
    const [classInfo] = await db
      .select({ id: eduClass.id, name: eduClass.name, grade: eduClass.grade })
      .from(eduClass)
      .where(eq(eduClass.id, classId))
      .limit(1)

    return reply.send(
      success({
        exportDate: new Date().toISOString(),
        dateRange: { startDate, endDate },
        class: classInfo ?? null,
        schedules: list,
        totalCount: list.length,
      }),
    )
  })

  // ===========================================================================
  // 4. 每日菜谱 CRUD
  // ===========================================================================

  server.get('/meal', async (request, reply) => {
    const parsed = mealListQuerySchema.safeParse(request.query)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const { page, pageSize } = paginationSchema.parse(request.query)
    const conds = [isNull(eduMealRecipe.deletedAt)]
    if (parsed.data.startDate && parsed.data.endDate) {
      conds.push(between(eduMealRecipe.date, parsed.data.startDate, parsed.data.endDate))
    } else if (parsed.data.startDate) {
      conds.push(gte(eduMealRecipe.date, parsed.data.startDate))
    } else if (parsed.data.endDate) {
      conds.push(lte(eduMealRecipe.date, parsed.data.endDate))
    }
    if (parsed.data.mealType) conds.push(eq(eduMealRecipe.mealType, parsed.data.mealType))
    const where = and(...conds)
    const result = await paginate(
      eduMealRecipe,
      where,
      [eduMealRecipe.date, eduMealRecipe.mealType],
      page,
      pageSize,
    )
    return reply.send(success(result))
  })

  server.get('/meal/:id', async (request, reply) => {
    const parsed = uuidParamSchema.safeParse(request.params)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [row] = await db
      .select()
      .from(eduMealRecipe)
      .where(and(eq(eduMealRecipe.id, parsed.data.id), isNull(eduMealRecipe.deletedAt)))
      .limit(1)
    if (!row) return reply.status(404).send(error(404, '菜谱不存在'))
    return reply.send(success({ meal: row }))
  })

  server.post('/meal', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const parsed = createMealSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [row] = await db.insert(eduMealRecipe).values(parsed.data).returning()
    return reply.status(201).send(success({ meal: row }))
  })

  server.put('/meal/:id', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const idParsed = uuidParamSchema.safeParse(request.params)
    if (!idParsed.success)
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    const parsed = updateMealSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [existing] = await db
      .select()
      .from(eduMealRecipe)
      .where(and(eq(eduMealRecipe.id, idParsed.data.id), isNull(eduMealRecipe.deletedAt)))
      .limit(1)
    if (!existing) return reply.status(404).send(error(404, '菜谱不存在'))
    const [row] = await db
      .update(eduMealRecipe)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(eduMealRecipe.id, idParsed.data.id))
      .returning()
    return reply.send(success({ meal: row }))
  })

  server.delete('/meal/:id', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const parsed = uuidParamSchema.safeParse(request.params)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [existing] = await db
      .select()
      .from(eduMealRecipe)
      .where(and(eq(eduMealRecipe.id, parsed.data.id), isNull(eduMealRecipe.deletedAt)))
      .limit(1)
    if (!existing) return reply.status(404).send(error(404, '菜谱不存在'))
    await db
      .update(eduMealRecipe)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(eduMealRecipe.id, parsed.data.id))
    return reply.send(success({ deleted: true }))
  })

  // ===========================================================================
  // 5. 周菜谱模板 CRUD + 应用模板
  // ===========================================================================

  server.get('/meal/template', async (request, reply) => {
    const parsed = templateListQuerySchema.safeParse(request.query)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const { page, pageSize } = paginationSchema.parse(request.query)
    const conds: SQL[] = []
    if (parsed.data.name) conds.push(eq(eduMealWeekTemplate.name, parsed.data.name))
    const where = conds.length > 0 ? and(...conds) : undefined
    const result = await paginate(
      eduMealWeekTemplate,
      where,
      [eduMealWeekTemplate.name, eduMealWeekTemplate.weekday, eduMealWeekTemplate.mealType],
      page,
      pageSize,
    )
    return reply.send(success(result))
  })

  server.get('/meal/template/:id', async (request, reply) => {
    const parsed = uuidParamSchema.safeParse(request.params)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [row] = await db
      .select()
      .from(eduMealWeekTemplate)
      .where(eq(eduMealWeekTemplate.id, parsed.data.id))
      .limit(1)
    if (!row) return reply.status(404).send(error(404, '模板不存在'))
    return reply.send(success({ template: row }))
  })

  server.post('/meal/template', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const parsed = createTemplateSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [row] = await db.insert(eduMealWeekTemplate).values(parsed.data).returning()
    return reply.status(201).send(success({ template: row }))
  })

  server.put('/meal/template/:id', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const idParsed = uuidParamSchema.safeParse(request.params)
    if (!idParsed.success)
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    const parsed = updateTemplateSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [existing] = await db
      .select()
      .from(eduMealWeekTemplate)
      .where(eq(eduMealWeekTemplate.id, idParsed.data.id))
      .limit(1)
    if (!existing) return reply.status(404).send(error(404, '模板不存在'))
    const [row] = await db
      .update(eduMealWeekTemplate)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(eduMealWeekTemplate.id, idParsed.data.id))
      .returning()
    return reply.send(success({ template: row }))
  })

  server.delete('/meal/template/:id', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const parsed = uuidParamSchema.safeParse(request.params)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [existing] = await db
      .select()
      .from(eduMealWeekTemplate)
      .where(eq(eduMealWeekTemplate.id, parsed.data.id))
      .limit(1)
    if (!existing) return reply.status(404).send(error(404, '模板不存在'))
    await db.delete(eduMealWeekTemplate).where(eq(eduMealWeekTemplate.id, parsed.data.id))
    return reply.send(success({ deleted: true }))
  })

  // 应用模板到指定周
  server.post('/meal/apply-template', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const parsed = applyTemplateSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const { templateName, startDate } = parsed.data
    // 查询模板所有条目
    const templates = await db
      .select()
      .from(eduMealWeekTemplate)
      .where(eq(eduMealWeekTemplate.name, templateName))
    if (templates.length === 0) return reply.status(404).send(error(404, '模板不存在'))
    // 计算目标周的日期范围（从startDate开始的7天）
    const start = new Date(startDate)
    const mealValues: Array<{
      date: string
      mealType: string
      dishName: string
      ingredients: string | null
      nutrition: string | null
    }> = templates.map((t) => {
      const mealDate = new Date(start)
      mealDate.setDate(mealDate.getDate() + (t.weekday - 1))
      return {
        date: mealDate.toISOString().split('T')[0]!,
        mealType: t.mealType,
        dishName: t.dishName,
        ingredients: t.ingredients,
        nutrition: t.nutrition,
      }
    })
    const inserted = await db.insert(eduMealRecipe).values(mealValues).returning()
    return reply.status(201).send(success({ count: inserted.length, meals: inserted }))
  })

  // 获取模板名称列表（去重）
  server.get('/meal/template-names', async (_request, reply) => {
    const rows = await db
      .select({ name: eduMealWeekTemplate.name })
      .from(eduMealWeekTemplate)
      .groupBy(eduMealWeekTemplate.name)
      .orderBy(eduMealWeekTemplate.name)
    return reply.send(success({ names: rows.map((r) => r.name) }))
  })

  // ===========================================================================
  // 4b. 菜谱新增功能：营养分析 / 采购清单 / 图片上传
  // ===========================================================================

  server.get('/meal/nutrition-summary', async (request, reply) => {
    const parsed = nutritionSummaryQuerySchema.safeParse(request.query)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const { startDate, endDate } = parsed.data

    try {
      const meals = await db
        .select()
        .from(eduMealRecipe)
        .where(
          and(between(eduMealRecipe.date, startDate, endDate), isNull(eduMealRecipe.deletedAt)),
        )
        .orderBy(eduMealRecipe.date, eduMealRecipe.mealType)

      // 按餐类型汇总营养信息
      const nutritionByType: Record<
        string,
        { count: number; calories: number; protein: number; carbs: number }
      > = {}
      let totalCalories = 0
      let totalProtein = 0
      let totalCarbs = 0

      for (const meal of meals) {
        const type = meal.mealType
        if (!nutritionByType[type]) {
          nutritionByType[type] = { count: 0, calories: 0, protein: 0, carbs: 0 }
        }
        nutritionByType[type]!.count++

        if (meal.nutrition) {
          // 解析营养信息字符串，如 "热量450kcal, 蛋白质25g, 碳水30g"
          const calMatch = meal.nutrition.match(/热量\s*(\d+(?:\.\d+)?)/)
          const proMatch = meal.nutrition.match(/蛋白质\s*(\d+(?:\.\d+)?)/)
          const carbMatch = meal.nutrition.match(/碳水\s*(\d+(?:\.\d+)?)/)

          const cal = calMatch ? Number.parseFloat(calMatch[1]!) : 0
          const pro = proMatch ? Number.parseFloat(proMatch[1]!) : 0
          const carb = carbMatch ? Number.parseFloat(carbMatch[1]!) : 0

          nutritionByType[type]!.calories += cal
          nutritionByType[type]!.protein += pro
          nutritionByType[type]!.carbs += carb

          totalCalories += cal
          totalProtein += pro
          totalCarbs += carb
        }
      }

      return reply.send(
        success({
          dateRange: { startDate, endDate },
          totalMeals: meals.length,
          summary: {
            totalCalories: Math.round(totalCalories),
            totalProtein: Math.round(totalProtein),
            totalCarbs: Math.round(totalCarbs),
          },
          byType: Object.entries(nutritionByType).map(([type, data]) => ({
            mealType: type,
            ...data,
            avgCalories: data.count > 0 ? Math.round(data.calories / data.count) : 0,
          })),
        }),
      )
    } catch (_err) {
      return reply.status(500).send(error(500, '营养分析查询失败'))
    }
  })

  server.post('/meal/generate-shopping-list', async (request, reply) => {
    const parsed = generateShoppingListSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const { startDate, endDate } = parsed.data

    try {
      const meals = await db
        .select()
        .from(eduMealRecipe)
        .where(
          and(between(eduMealRecipe.date, startDate, endDate), isNull(eduMealRecipe.deletedAt)),
        )
        .orderBy(eduMealRecipe.date, eduMealRecipe.mealType)

      // 汇总所有食材
      const ingredientMap = new Map<
        string,
        { ingredient: string; count: number; dishes: string[] }
      >()
      for (const meal of meals) {
        if (meal.ingredients) {
          // 按逗号分割食材
          const items = meal.ingredients
            .split(/[,，、]/)
            .map((s) => s.trim())
            .filter(Boolean)
          for (const item of items) {
            const existing = ingredientMap.get(item) ?? { ingredient: item, count: 0, dishes: [] }
            existing.count++
            if (!existing.dishes.includes(meal.dishName)) {
              existing.dishes.push(meal.dishName)
            }
            ingredientMap.set(item, existing)
          }
        }
      }

      const shoppingList = Array.from(ingredientMap.values()).sort((a, b) => b.count - a.count)

      return reply.send(
        success({
          dateRange: { startDate, endDate },
          shoppingList,
          totalIngredients: shoppingList.length,
        }),
      )
    } catch (_err) {
      return reply.status(500).send(error(500, '采购清单生成失败'))
    }
  })

  server.post('/meal/upload-image', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const parsed = uploadImageSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const { id, imageUrl } = parsed.data

    const [existing] = await db
      .select()
      .from(eduMealRecipe)
      .where(and(eq(eduMealRecipe.id, id), isNull(eduMealRecipe.deletedAt)))
      .limit(1)
    if (!existing) return reply.status(404).send(error(404, '菜谱不存在'))

    const [row] = await db
      .update(eduMealRecipe)
      .set({ imageUrl, updatedAt: new Date() })
      .where(eq(eduMealRecipe.id, id))
      .returning()
    return reply.send(success({ meal: row }))
  })

  // ===========================================================================
  // 6. 学习计划 CRUD + 月→周拆解
  // ===========================================================================

  server.get('/study-plan', async (request, reply) => {
    const parsed = planListQuerySchema.safeParse(request.query)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const { page, pageSize } = paginationSchema.parse(request.query)
    const conds = [isNull(eduStudyPlan.deletedAt)]
    if (parsed.data.classId) conds.push(eq(eduStudyPlan.classId, parsed.data.classId))
    if (parsed.data.termId) conds.push(eq(eduStudyPlan.termId, parsed.data.termId))
    if (parsed.data.planType) conds.push(eq(eduStudyPlan.planType, parsed.data.planType))
    if (parsed.data.status) conds.push(eq(eduStudyPlan.status, parsed.data.status))
    const where = and(...conds)
    const result = await paginate(eduStudyPlan, where, desc(eduStudyPlan.createdAt), page, pageSize)
    return reply.send(success(result))
  })

  server.get('/study-plan/:id', async (request, reply) => {
    const parsed = uuidParamSchema.safeParse(request.params)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [row] = await db
      .select()
      .from(eduStudyPlan)
      .where(and(eq(eduStudyPlan.id, parsed.data.id), isNull(eduStudyPlan.deletedAt)))
      .limit(1)
    if (!row) return reply.status(404).send(error(404, '计划不存在'))
    return reply.send(success({ plan: row }))
  })

  server.post('/study-plan', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const parsed = createPlanSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [row] = await db
      .insert(eduStudyPlan)
      .values({ ...parsed.data, creatorId: request.userId! })
      .returning()
    return reply.status(201).send(success({ plan: row }))
  })

  server.put('/study-plan/:id', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const idParsed = uuidParamSchema.safeParse(request.params)
    if (!idParsed.success)
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    const parsed = updatePlanSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [existing] = await db
      .select()
      .from(eduStudyPlan)
      .where(and(eq(eduStudyPlan.id, idParsed.data.id), isNull(eduStudyPlan.deletedAt)))
      .limit(1)
    if (!existing) return reply.status(404).send(error(404, '计划不存在'))
    const [row] = await db
      .update(eduStudyPlan)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(eduStudyPlan.id, idParsed.data.id))
      .returning()
    return reply.send(success({ plan: row }))
  })

  server.delete('/study-plan/:id', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const parsed = uuidParamSchema.safeParse(request.params)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [existing] = await db
      .select()
      .from(eduStudyPlan)
      .where(and(eq(eduStudyPlan.id, parsed.data.id), isNull(eduStudyPlan.deletedAt)))
      .limit(1)
    if (!existing) return reply.status(404).send(error(404, '计划不存在'))
    await db
      .update(eduStudyPlan)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(eduStudyPlan.id, parsed.data.id))
    return reply.send(success({ deleted: true }))
  })

  // 月计划自动拆解为周计划
  server.post('/study-plan/:id/auto-split', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const idParsed = uuidParamSchema.safeParse(request.params)
    if (!idParsed.success)
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    const [parent] = await db
      .select()
      .from(eduStudyPlan)
      .where(and(eq(eduStudyPlan.id, idParsed.data.id), isNull(eduStudyPlan.deletedAt)))
      .limit(1)
    if (!parent) return reply.status(404).send(error(404, '计划不存在'))
    if (parent.planType !== 'monthly') return reply.status(400).send(error(400, '仅月计划可拆解'))

    // 按月计划的时间范围拆解为周
    const start = new Date(parent.startDate)
    const end = new Date(parent.endDate)
    const weekPlans: Array<{
      title: string
      planType: 'weekly'
      creatorId: string
      classId: string
      termId: string
      startDate: string
      endDate: string
      description: string
      status: string
      parentPlanId: string
    }> = []
    const weekStart = new Date(start)

    while (weekStart < end) {
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekEnd.getDate() + 6)
      if (weekEnd > end) weekEnd.setTime(end.getTime())

      weekPlans.push({
        title: `${parent.title} - 第${Math.ceil((weekStart.getTime() - start.getTime()) / (7 * 86400000)) + 1}周`,
        planType: 'weekly' as const,
        creatorId: parent.creatorId,
        classId: parent.classId,
        termId: parent.termId,
        startDate: weekStart.toISOString().split('T')[0]!,
        endDate: weekEnd.toISOString().split('T')[0]!,
        description: `自动拆解自: ${parent.title}`,
        status: 'active',
        parentPlanId: parent.id,
      })

      weekStart.setDate(weekStart.getDate() + 7)
    }

    if (weekPlans.length > 0) {
      const inserted = await db.insert(eduStudyPlan).values(weekPlans).returning()
      // 更新父计划状态
      await db
        .update(eduStudyPlan)
        .set({ status: 'active', updatedAt: new Date() })
        .where(eq(eduStudyPlan.id, parent.id))
      return reply.status(201).send(success({ count: inserted.length, plans: inserted }))
    }
    return reply.send(success({ count: 0, plans: [] }))
  })

  // ===========================================================================
  // 7. 计划条目 CRUD
  // ===========================================================================

  server.get('/study-plan/:id/items', async (request, reply) => {
    const idParsed = uuidParamSchema.safeParse(request.params)
    if (!idParsed.success)
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    const items = await db
      .select()
      .from(eduPlanItem)
      .where(and(eq(eduPlanItem.planId, idParsed.data.id), isNull(eduPlanItem.deletedAt)))
      .orderBy(eduPlanItem.sortOrder, eduPlanItem.createdAt)
    return reply.send(success({ items }))
  })

  server.post('/study-plan/:id/items', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const idParsed = uuidParamSchema.safeParse(request.params)
    if (!idParsed.success)
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    const parsed = createPlanItemSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [row] = await db
      .insert(eduPlanItem)
      .values({ ...parsed.data, planId: idParsed.data.id })
      .returning()
    return reply.status(201).send(success({ item: row }))
  })

  server.put('/plan-item/:id', async (request, reply) => {
    const idParsed = uuidParamSchema.safeParse(request.params)
    if (!idParsed.success)
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    const parsed = updatePlanItemSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [existing] = await db
      .select()
      .from(eduPlanItem)
      .where(and(eq(eduPlanItem.id, idParsed.data.id), isNull(eduPlanItem.deletedAt)))
      .limit(1)
    if (!existing) return reply.status(404).send(error(404, '条目不存在'))

    // 如果标记完成，记录完成时间
    const updates: Record<string, unknown> = { ...parsed.data, updatedAt: new Date() }
    if (parsed.data.completed === true && !existing.completed) {
      updates.completedAt = new Date()
    } else if (parsed.data.completed === false) {
      updates.completedAt = null
    }

    const [row] = await db
      .update(eduPlanItem)
      .set(updates)
      .where(eq(eduPlanItem.id, idParsed.data.id))
      .returning()
    return reply.send(success({ item: row }))
  })

  server.delete('/plan-item/:id', async (request, reply) => {
    const idParsed = uuidParamSchema.safeParse(request.params)
    if (!idParsed.success)
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    const [existing] = await db
      .select()
      .from(eduPlanItem)
      .where(and(eq(eduPlanItem.id, idParsed.data.id), isNull(eduPlanItem.deletedAt)))
      .limit(1)
    if (!existing) return reply.status(404).send(error(404, '条目不存在'))
    await db
      .update(eduPlanItem)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(eduPlanItem.id, idParsed.data.id))
    return reply.send(success({ deleted: true }))
  })

  // ===========================================================================
  // 6b. 学习计划新增功能：完成率统计 / 进度时间线 / 教师审核备注
  // ===========================================================================

  server.get('/study-plan/completion-stats', async (request, reply) => {
    const parsed = completionStatsQuerySchema.safeParse(request.query)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const { classId, termId } = parsed.data

    // 查询该班级学期下的所有计划
    const plans = await db
      .select()
      .from(eduStudyPlan)
      .where(
        and(
          eq(eduStudyPlan.classId, classId),
          eq(eduStudyPlan.termId, termId),
          isNull(eduStudyPlan.deletedAt),
        ),
      )
      .orderBy(eduStudyPlan.startDate)

    // 统计每个计划的完成率
    const stats = await Promise.all(
      plans.map(async (plan) => {
        const items = await db
          .select({
            total: count(),
            completed: sql<number>`count(case when ${eduPlanItem.completed} = true then 1 end)`,
          })
          .from(eduPlanItem)
          .where(and(eq(eduPlanItem.planId, plan.id), isNull(eduPlanItem.deletedAt)))
          .limit(1)

        const total = items[0]?.total ?? 0
        const completed = items[0]?.completed ?? 0
        const rate = total > 0 ? Math.round((completed / total) * 100) : 0

        return {
          planId: plan.id,
          planTitle: plan.title,
          planType: plan.planType,
          status: plan.status,
          startDate: plan.startDate,
          endDate: plan.endDate,
          totalItems: total,
          completedItems: completed,
          completionRate: rate,
        }
      }),
    )

    // 汇总统计
    const totalItems = stats.reduce((sum, s) => sum + s.totalItems, 0)
    const totalCompleted = stats.reduce((sum, s) => sum + s.completedItems, 0)
    const overallRate = totalItems > 0 ? Math.round((totalCompleted / totalItems) * 100) : 0

    return reply.send(
      success({
        classId,
        termId,
        overallRate,
        totalItems,
        totalCompleted,
        plans: stats,
      }),
    )
  })

  server.get('/study-plan/progress-timeline', async (request, reply) => {
    const parsed = progressTimelineQuerySchema.safeParse(request.query)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const { planId } = parsed.data

    // 查询计划信息
    const [plan] = await db
      .select()
      .from(eduStudyPlan)
      .where(and(eq(eduStudyPlan.id, planId), isNull(eduStudyPlan.deletedAt)))
      .limit(1)
    if (!plan) return reply.status(404).send(error(404, '计划不存在'))

    // 查询所有已完成的条目，按完成时间排序
    const completedItems = await db
      .select()
      .from(eduPlanItem)
      .where(
        and(
          eq(eduPlanItem.planId, planId),
          eq(eduPlanItem.completed, true),
          isNull(eduPlanItem.deletedAt),
        ),
      )
      .orderBy(eduPlanItem.completedAt, eduPlanItem.sortOrder)

    // 查询所有条目总数
    const [totalResult] = await db
      .select({ count: count() })
      .from(eduPlanItem)
      .where(and(eq(eduPlanItem.planId, planId), isNull(eduPlanItem.deletedAt)))

    const totalItems = totalResult?.count ?? 0

    // 按完成日期分组
    const timelineMap = new Map<
      string,
      { date: string; items: Array<{ id: string; content: string; completedAt: string }> }
    >()
    for (const item of completedItems) {
      if (item.completedAt) {
        const dateStr = new Date(item.completedAt).toISOString().split('T')[0]!
        const existing = timelineMap.get(dateStr) ?? { date: dateStr, items: [] }
        existing.items.push({
          id: item.id,
          content: item.content,
          completedAt:
            item.completedAt instanceof Date
              ? item.completedAt.toISOString()
              : String(item.completedAt),
        })
        timelineMap.set(dateStr, existing)
      }
    }

    const timeline = Array.from(timelineMap.values()).sort((a, b) => a.date.localeCompare(b.date))

    return reply.send(
      success({
        plan: {
          id: plan.id,
          title: plan.title,
          planType: plan.planType,
          startDate: plan.startDate,
          endDate: plan.endDate,
        },
        totalItems,
        completedItems: completedItems.length,
        completionRate: totalItems > 0 ? Math.round((completedItems.length / totalItems) * 100) : 0,
        timeline,
      }),
    )
  })

  server.put('/study-plan-item/:id/review', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const idParsed = uuidParamSchema.safeParse(request.params)
    if (!idParsed.success)
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    const parsed = reviewItemSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))

    const [existing] = await db
      .select()
      .from(eduPlanItem)
      .where(and(eq(eduPlanItem.id, idParsed.data.id), isNull(eduPlanItem.deletedAt)))
      .limit(1)
    if (!existing) return reply.status(404).send(error(404, '条目不存在'))

    const updates: Record<string, unknown> = { updatedAt: new Date() }
    if (parsed.data.notes !== undefined) {
      updates.notes = parsed.data.notes
    }
    if (parsed.data.reviewed !== undefined) {
      // 将审核状态附加到 notes 字段中
      const currentNotes = existing.notes ?? ''
      // 移除旧的审核标记
      const cleanNotes = currentNotes.replace(/\s*\[已审核\]|\s*\[未审核\]/g, '')
      updates.notes = cleanNotes + (parsed.data.reviewed ? ' [已审核]' : '')
    }

    const [row] = await db
      .update(eduPlanItem)
      .set(updates)
      .where(eq(eduPlanItem.id, idParsed.data.id))
      .returning()
    return reply.send(success({ item: row }))
  })

  // ===========================================================================
  // 8. 签到记录 CRUD + 签到/签退 + 统计
  // ===========================================================================

  // 出勤统计（需在 :id 路由前注册）
  server.get('/attendance/stats', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const parsed = attendanceStatsQuerySchema.safeParse(request.query)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))

    const conds: SQL[] = [isNull(eduAttendanceRecord.deletedAt)]
    if (parsed.data.classId) conds.push(eq(eduAttendanceRecord.classId, parsed.data.classId))
    if (parsed.data.startDate && parsed.data.endDate) {
      conds.push(between(eduAttendanceRecord.date, parsed.data.startDate, parsed.data.endDate))
    } else if (parsed.data.startDate) {
      conds.push(gte(eduAttendanceRecord.date, parsed.data.startDate))
    } else if (parsed.data.endDate) {
      conds.push(lte(eduAttendanceRecord.date, parsed.data.endDate))
    }
    const where = and(...conds)

    // 状态维度统计
    const statusBreakdown = await db
      .select({
        status: eduAttendanceRecord.status,
        count: count(),
      })
      .from(eduAttendanceRecord)
      .where(where)
      .groupBy(eduAttendanceRecord.status)

    const total = statusBreakdown.reduce((sum, r) => sum + r.count, 0)
    const present = statusBreakdown.find((r) => r.status === 'present')?.count ?? 0
    const attendanceRate = total > 0 ? Math.round((present / total) * 10000) / 100 : 0

    // 时间维度聚合
    let periodBreakdown: Array<{ period: string; status: string; count: number }> | undefined
    if (parsed.data.period) {
      const periodExpr =
        parsed.data.period === 'daily'
          ? sql<string>`to_char(${eduAttendanceRecord.date}::timestamp, 'YYYY-MM-DD')`
          : parsed.data.period === 'weekly'
            ? sql<string>`to_char(${eduAttendanceRecord.date}::timestamp, 'IYYY-IW')`
            : sql<string>`to_char(${eduAttendanceRecord.date}::timestamp, 'YYYY-MM')`

      periodBreakdown = (await db
        .select({
          period: periodExpr,
          status: eduAttendanceRecord.status,
          count: count(),
        })
        .from(eduAttendanceRecord)
        .where(where)
        .groupBy(periodExpr, eduAttendanceRecord.status)
        .orderBy(periodExpr)) as Array<{ period: string; status: string; count: number }>
    }

    return reply.send(success({ total, attendanceRate, statusBreakdown, periodBreakdown }))
  })

  server.get('/attendance', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const parsed = attendanceListQuerySchema.safeParse(request.query)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const { page, pageSize } = paginationSchema.parse(request.query)
    const conds: SQL[] = [isNull(eduAttendanceRecord.deletedAt)]
    if (parsed.data.studentId) conds.push(eq(eduAttendanceRecord.studentId, parsed.data.studentId))
    if (parsed.data.classId) conds.push(eq(eduAttendanceRecord.classId, parsed.data.classId))
    if (parsed.data.date) conds.push(eq(eduAttendanceRecord.date, parsed.data.date))
    if (parsed.data.status) conds.push(eq(eduAttendanceRecord.status, parsed.data.status))
    const where = and(...conds)
    const result = await paginate(
      eduAttendanceRecord,
      where,
      [desc(eduAttendanceRecord.date), desc(eduAttendanceRecord.createdAt)],
      page,
      pageSize,
    )
    return reply.send(success(result))
  })

  server.post('/attendance/check-in', async (request, reply) => {
    const parsed = checkInSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))

    const now = new Date()
    const today = now.toISOString().split('T')[0]!
    const date = parsed.data.date || today

    try {
      const [row] = await db.transaction(async (tx) => {
        // 检查是否已签到
        const [existing] = await tx
          .select()
          .from(eduAttendanceRecord)
          .where(
            and(
              eq(eduAttendanceRecord.studentId, parsed.data.studentId),
              eq(eduAttendanceRecord.classId, parsed.data.classId),
              eq(eduAttendanceRecord.date, date),
              isNull(eduAttendanceRecord.deletedAt),
            ),
          )
          .limit(1)
        if (existing) throw new Error('DUPLICATE_CHECKIN')

        return tx
          .insert(eduAttendanceRecord)
          .values({
            studentId: parsed.data.studentId,
            classId: parsed.data.classId,
            date,
            checkInTime: now,
            status: parsed.data.status || 'present',
            checkInMethod: parsed.data.checkInMethod || 'manual',
            operatedBy: request.userId,
            remark: parsed.data.remark,
          })
          .returning()
      })
      return reply.status(201).send(success({ record: row }))
    } catch (err: unknown) {
      if ((err as { message?: string }).message === 'DUPLICATE_CHECKIN')
        return reply.status(409).send(error(409, '该学生今日已签到'))
      return reply.status(500).send(error(500, '签到失败'))
    }
  })

  server.put('/attendance/check-out', async (request, reply) => {
    const parsed = checkOutSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))

    try {
      const [row] = await db.transaction(async (tx) => {
        const [existing] = await tx
          .select()
          .from(eduAttendanceRecord)
          .where(
            and(
              eq(eduAttendanceRecord.studentId, parsed.data.studentId),
              eq(eduAttendanceRecord.classId, parsed.data.classId),
              eq(eduAttendanceRecord.date, parsed.data.date),
              isNull(eduAttendanceRecord.deletedAt),
            ),
          )
          .limit(1)
        if (!existing) throw new Error('NOT_FOUND')
        if (existing.checkOutTime) throw new Error('ALREADY_CHECKED_OUT')

        return tx
          .update(eduAttendanceRecord)
          .set({
            checkOutTime: new Date(),
            checkOutMethod: parsed.data.checkOutMethod || 'manual',
            updatedAt: new Date(),
          })
          .where(eq(eduAttendanceRecord.id, existing.id))
          .returning()
      })
      return reply.send(success({ record: row }))
    } catch (err: unknown) {
      if ((err as { message?: string }).message === 'NOT_FOUND')
        return reply.status(404).send(error(404, '未找到签到记录'))
      if ((err as { message?: string }).message === 'ALREADY_CHECKED_OUT')
        return reply.status(409).send(error(409, '该学生今日已签退'))
      return reply.status(500).send(error(500, '签退失败'))
    }
  })

  server.put('/attendance/:id', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const idParsed = uuidParamSchema.safeParse(request.params)
    if (!idParsed.success)
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    const parsed = updateAttendanceSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [existing] = await db
      .select()
      .from(eduAttendanceRecord)
      .where(
        and(eq(eduAttendanceRecord.id, idParsed.data.id), isNull(eduAttendanceRecord.deletedAt)),
      )
      .limit(1)
    if (!existing) return reply.status(404).send(error(404, '签到记录不存在'))
    const updates: Record<string, unknown> = { ...parsed.data, updatedAt: new Date() }
    // 将字符串时间转为 Date 对象
    if (typeof updates.checkInTime === 'string')
      updates.checkInTime = new Date(updates.checkInTime as string)
    if (typeof updates.checkOutTime === 'string')
      updates.checkOutTime = new Date(updates.checkOutTime as string)
    const [row] = await db
      .update(eduAttendanceRecord)
      .set(updates)
      .where(eq(eduAttendanceRecord.id, idParsed.data.id))
      .returning()
    return reply.send(success({ record: row }))
  })

  server.delete('/attendance/:id', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const parsed = uuidParamSchema.safeParse(request.params)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [existing] = await db
      .select()
      .from(eduAttendanceRecord)
      .where(and(eq(eduAttendanceRecord.id, parsed.data.id), isNull(eduAttendanceRecord.deletedAt)))
      .limit(1)
    if (!existing) return reply.status(404).send(error(404, '签到记录不存在'))
    await db
      .update(eduAttendanceRecord)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(eduAttendanceRecord.id, parsed.data.id))
    return reply.send(success({ deleted: true }))
  })

  // ===========================================================================
  // 9. 请假申请 CRUD + 审批
  // ===========================================================================

  server.get('/leave', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const parsed = leaveListQuerySchema.safeParse(request.query)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const { page, pageSize } = paginationSchema.parse(request.query)
    const conds: SQL[] = [isNull(eduLeaveRequest.deletedAt)]
    if (parsed.data.studentId) conds.push(eq(eduLeaveRequest.studentId, parsed.data.studentId))
    if (parsed.data.classId) conds.push(eq(eduLeaveRequest.classId, parsed.data.classId))
    if (parsed.data.status) conds.push(eq(eduLeaveRequest.status, parsed.data.status))
    if (parsed.data.startDate && parsed.data.endDate) {
      const range = and(
        gte(eduLeaveRequest.endDate, parsed.data.startDate),
        lte(eduLeaveRequest.startDate, parsed.data.endDate),
      )
      if (range) conds.push(range)
    } else if (parsed.data.startDate) {
      conds.push(gte(eduLeaveRequest.startDate, parsed.data.startDate))
    } else if (parsed.data.endDate) {
      conds.push(lte(eduLeaveRequest.endDate, parsed.data.endDate))
    }
    const where = and(...conds)
    const result = await paginate(
      eduLeaveRequest,
      where,
      desc(eduLeaveRequest.createdAt),
      page,
      pageSize,
    )
    return reply.send(success(result))
  })

  server.post('/leave', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const parsed = createLeaveSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [row] = await db.insert(eduLeaveRequest).values(parsed.data).returning()
    return reply.status(201).send(success({ leave: row }))
  })

  server.put('/leave/:id', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const idParsed = uuidParamSchema.safeParse(request.params)
    if (!idParsed.success)
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    const parsed = updateLeaveSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [existing] = await db
      .select()
      .from(eduLeaveRequest)
      .where(and(eq(eduLeaveRequest.id, idParsed.data.id), isNull(eduLeaveRequest.deletedAt)))
      .limit(1)
    if (!existing) return reply.status(404).send(error(404, '请假申请不存在'))
    const [row] = await db
      .update(eduLeaveRequest)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(eduLeaveRequest.id, idParsed.data.id))
      .returning()
    return reply.send(success({ leave: row }))
  })

  server.put('/leave/:id/approve', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const idParsed = uuidParamSchema.safeParse(request.params)
    if (!idParsed.success)
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    const parsed = approveLeaveSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [existing] = await db
      .select()
      .from(eduLeaveRequest)
      .where(and(eq(eduLeaveRequest.id, idParsed.data.id), isNull(eduLeaveRequest.deletedAt)))
      .limit(1)
    if (!existing) return reply.status(404).send(error(404, '请假申请不存在'))
    if (existing.status !== 'pending')
      return reply.status(400).send(error(400, '仅待审批的申请可审批'))
    const [row] = await db
      .update(eduLeaveRequest)
      .set({
        status: parsed.data.status,
        approverId: request.userId,
        approveRemark: parsed.data.approveRemark,
        approveAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(eduLeaveRequest.id, idParsed.data.id))
      .returning()
    return reply.send(success({ leave: row }))
  })

  server.delete('/leave/:id', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const parsed = uuidParamSchema.safeParse(request.params)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [existing] = await db
      .select()
      .from(eduLeaveRequest)
      .where(and(eq(eduLeaveRequest.id, parsed.data.id), isNull(eduLeaveRequest.deletedAt)))
      .limit(1)
    if (!existing) return reply.status(404).send(error(404, '请假申请不存在'))
    await db
      .update(eduLeaveRequest)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(eduLeaveRequest.id, parsed.data.id))
    return reply.send(success({ deleted: true }))
  })

  // ===========================================================================
  // 10. 家长-学生绑定管理
  // ===========================================================================

  // 获取当前用户的绑定列表（家长视角：查看绑定的孩子；学生视角：查看绑定的家长）
  server.get('/parent/binding', async (request, reply) => {
    const parsed = bindingListQuerySchema.safeParse(request.query)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const userId = request.userId
    if (!userId) return reply.status(401).send(error(401, '未登录'))

    const conds: SQL[] = [
      or(
        eq(eduParentStudentBinding.parentId, userId),
        eq(eduParentStudentBinding.studentId, userId),
      ) ?? sql`false`,
      isNull(eduParentStudentBinding.deletedAt),
    ]
    if (parsed.data.status) conds.push(eq(eduParentStudentBinding.status, parsed.data.status))
    const where = and(...conds) ?? sql`true`
    const list = await db
      .select()
      .from(eduParentStudentBinding)
      .where(where)
      .orderBy(desc(eduParentStudentBinding.createdAt))
    return reply.send(success({ list }))
  })

  // 创建绑定（家长发起）
  server.post('/parent/binding', async (request, reply) => {
    const parsed = createBindingSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const userId = request.userId
    if (!userId) return reply.status(401).send(error(401, '未登录'))

    // 检查是否已存在绑定
    const [existing] = await db
      .select()
      .from(eduParentStudentBinding)
      .where(
        and(
          eq(eduParentStudentBinding.parentId, userId),
          eq(eduParentStudentBinding.studentId, parsed.data.studentId),
          isNull(eduParentStudentBinding.deletedAt),
        ),
      )
      .limit(1)
    if (existing) return reply.status(409).send(error(409, '已存在绑定关系'))

    const [row] = await db
      .insert(eduParentStudentBinding)
      .values({
        parentId: userId,
        studentId: parsed.data.studentId,
        relationship: parsed.data.relationship,
      })
      .returning()
    return reply.status(201).send(success({ binding: row }))
  })

  // 确认/拒绝绑定（学生端确认）
  server.put('/parent/binding/:id', async (request, reply) => {
    const idParsed = uuidParamSchema.safeParse(request.params)
    if (!idParsed.success)
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    const parsed = updateBindingSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const userId = request.userId
    if (!userId) return reply.status(401).send(error(401, '未登录'))

    const [existing] = await db
      .select()
      .from(eduParentStudentBinding)
      .where(
        and(
          eq(eduParentStudentBinding.id, idParsed.data.id),
          isNull(eduParentStudentBinding.deletedAt),
        ),
      )
      .limit(1)
    if (!existing) return reply.status(404).send(error(404, '绑定不存在'))
    if (existing.studentId !== userId)
      return reply.status(403).send(error(403, '仅学生本人可确认绑定'))

    const updates: Record<string, unknown> = { updatedAt: new Date() }
    if (parsed.data.relationship) updates.relationship = parsed.data.relationship
    if (parsed.data.status) {
      updates.status = parsed.data.status
      if (parsed.data.status === 'confirmed') updates.confirmedAt = new Date()
    }

    const [row] = await db
      .update(eduParentStudentBinding)
      .set(updates)
      .where(eq(eduParentStudentBinding.id, idParsed.data.id))
      .returning()
    return reply.send(success({ binding: row }))
  })

  // 解除绑定（家长或学生均可发起）
  server.delete('/parent/binding/:id', async (request, reply) => {
    const idParsed = uuidParamSchema.safeParse(request.params)
    if (!idParsed.success)
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    const userId = request.userId
    if (!userId) return reply.status(401).send(error(401, '未登录'))

    const [existing] = await db
      .select()
      .from(eduParentStudentBinding)
      .where(
        and(
          eq(eduParentStudentBinding.id, idParsed.data.id),
          isNull(eduParentStudentBinding.deletedAt),
        ),
      )
      .limit(1)
    if (!existing) return reply.status(404).send(error(404, '绑定不存在'))
    if (existing.parentId !== userId && existing.studentId !== userId) {
      return reply.status(403).send(error(403, '无权操作'))
    }

    await db
      .update(eduParentStudentBinding)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(eduParentStudentBinding.id, idParsed.data.id))
    return reply.send(success({ deleted: true }))
  })

  // 获取家长绑定的所有孩子列表（含孩子基本信息）
  server.get('/parent/children', async (request, reply) => {
    const userId = request.userId
    if (!userId) return reply.status(401).send(error(401, '未登录'))

    const bindings = await db
      .select()
      .from(eduParentStudentBinding)
      .where(
        and(
          eq(eduParentStudentBinding.parentId, userId),
          eq(eduParentStudentBinding.status, 'confirmed'),
          isNull(eduParentStudentBinding.deletedAt),
        ),
      )

    if (bindings.length === 0) return reply.send(success({ children: [] }))

    // 查询孩子用户信息
    const studentIds = bindings.map((b) => b.studentId)
    const students = await db
      .select({
        id: users.id,
        username: users.username,
        nickname: users.nickname,
        avatar: users.avatar,
      })
      .from(users)
      .where(inArray(users.id, studentIds))

    // 合并数据
    const children = bindings.map((b) => {
      const student = students.find((s) => s.id === b.studentId)
      return {
        bindingId: b.id,
        studentId: b.studentId,
        relationship: b.relationship,
        status: b.status,
        student: student || null,
      }
    })

    return reply.send(success({ children }))
  })
  // ===========================================================================
  // 11. 孩子数据查看（家长端）
  // ===========================================================================

  // 孩子考勤记录（按学生ID）
  server.get('/parent/child/:id/attendance', async (request, reply) => {
    const idParsed = uuidParamSchema.safeParse(request.params)
    if (!idParsed.success)
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    const parsed = childAttendanceQuerySchema.safeParse(request.query)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const userId = request.userId
    if (!userId) return reply.status(401).send(error(401, '未登录'))

    // 验证该学生确实是当前用户的孩子
    const [binding] = await db
      .select()
      .from(eduParentStudentBinding)
      .where(
        and(
          eq(eduParentStudentBinding.parentId, userId),
          eq(eduParentStudentBinding.studentId, idParsed.data.id),
          eq(eduParentStudentBinding.status, 'confirmed'),
          isNull(eduParentStudentBinding.deletedAt),
        ),
      )
      .limit(1)
    if (!binding) return reply.status(403).send(error(403, '无权查看该学生数据'))

    const conds: SQL[] = [
      eq(eduAttendanceRecord.studentId, idParsed.data.id),
      isNull(eduAttendanceRecord.deletedAt),
    ]
    if (parsed.data.status) conds.push(eq(eduAttendanceRecord.status, parsed.data.status))
    if (parsed.data.startDate && parsed.data.endDate) {
      conds.push(between(eduAttendanceRecord.date, parsed.data.startDate, parsed.data.endDate))
    } else if (parsed.data.startDate) {
      conds.push(gte(eduAttendanceRecord.date, parsed.data.startDate))
    } else if (parsed.data.endDate) {
      conds.push(lte(eduAttendanceRecord.date, parsed.data.endDate))
    }
    const where = and(...conds)
    const list = await db
      .select()
      .from(eduAttendanceRecord)
      .where(where)
      .orderBy(desc(eduAttendanceRecord.date))
    return reply.send(success({ list }))
  })

  // 孩子成绩列表（按学生ID）
  server.get('/parent/child/:id/grades', async (request, reply) => {
    const idParsed = uuidParamSchema.safeParse(request.params)
    if (!idParsed.success)
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    const userId = request.userId
    if (!userId) return reply.status(401).send(error(401, '未登录'))

    // 验证绑定
    const [binding] = await db
      .select()
      .from(eduParentStudentBinding)
      .where(
        and(
          eq(eduParentStudentBinding.parentId, userId),
          eq(eduParentStudentBinding.studentId, idParsed.data.id),
          eq(eduParentStudentBinding.status, 'confirmed'),
          isNull(eduParentStudentBinding.deletedAt),
        ),
      )
      .limit(1)
    if (!binding) return reply.status(403).send(error(403, '无权查看该学生数据'))

    const list = await db
      .select()
      .from(eduExamScore)
      .where(and(eq(eduExamScore.studentId, idParsed.data.id), isNull(eduExamScore.deletedAt)))
      .orderBy(desc(eduExamScore.examDate), eduExamScore.subject)
    return reply.send(success({ list }))
  })

  // 孩子课程表（按班级ID，从签到记录中查找最近的班级）
  server.get('/parent/child/:id/schedule', async (request, reply) => {
    const idParsed = uuidParamSchema.safeParse(request.params)
    if (!idParsed.success)
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    const userId = request.userId
    if (!userId) return reply.status(401).send(error(401, '未登录'))

    // 验证绑定
    const [binding] = await db
      .select()
      .from(eduParentStudentBinding)
      .where(
        and(
          eq(eduParentStudentBinding.parentId, userId),
          eq(eduParentStudentBinding.studentId, idParsed.data.id),
          eq(eduParentStudentBinding.status, 'confirmed'),
          isNull(eduParentStudentBinding.deletedAt),
        ),
      )
      .limit(1)
    if (!binding) return reply.status(403).send(error(403, '无权查看该学生数据'))

    // 从签到记录中查找该学生最近的班级
    const [latestAttendance] = await db
      .select()
      .from(eduAttendanceRecord)
      .where(
        and(
          eq(eduAttendanceRecord.studentId, idParsed.data.id),
          isNull(eduAttendanceRecord.deletedAt),
        ),
      )
      .orderBy(desc(eduAttendanceRecord.date))
      .limit(1)

    if (!latestAttendance) {
      return reply.send(success({ list: [], classId: null }))
    }

    // 查询该班级的课程表
    const list = await db
      .select()
      .from(eduCourseSchedule)
      .where(
        and(
          eq(eduCourseSchedule.classId, latestAttendance.classId),
          isNull(eduCourseSchedule.deletedAt),
        ),
      )
      .orderBy(eduCourseSchedule.weekday, eduCourseSchedule.startTime)
    return reply.send(success({ list, classId: latestAttendance.classId }))
  })

  // 孩子学习计划（按班级ID，从签到记录中查找最近的班级）
  server.get('/parent/child/:id/study-plans', async (request, reply) => {
    const idParsed = uuidParamSchema.safeParse(request.params)
    if (!idParsed.success)
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    const userId = request.userId
    if (!userId) return reply.status(401).send(error(401, '未登录'))

    // 验证绑定
    const [binding] = await db
      .select()
      .from(eduParentStudentBinding)
      .where(
        and(
          eq(eduParentStudentBinding.parentId, userId),
          eq(eduParentStudentBinding.studentId, idParsed.data.id),
          eq(eduParentStudentBinding.status, 'confirmed'),
          isNull(eduParentStudentBinding.deletedAt),
        ),
      )
      .limit(1)
    if (!binding) return reply.status(403).send(error(403, '无权查看该学生数据'))

    // 从签到记录中查找该学生最近的班级
    const [latestAttendance] = await db
      .select()
      .from(eduAttendanceRecord)
      .where(
        and(
          eq(eduAttendanceRecord.studentId, idParsed.data.id),
          isNull(eduAttendanceRecord.deletedAt),
        ),
      )
      .orderBy(desc(eduAttendanceRecord.date))
      .limit(1)

    if (!latestAttendance) {
      return reply.send(success({ list: [], classId: null }))
    }

    // 查询该班级的学习计划
    const list = await db
      .select()
      .from(eduStudyPlan)
      .where(
        and(eq(eduStudyPlan.classId, latestAttendance.classId), isNull(eduStudyPlan.deletedAt)),
      )
      .orderBy(desc(eduStudyPlan.createdAt))
    return reply.send(success({ list, classId: latestAttendance.classId }))
  })

  // 孩子菜谱（学校通用，无需班级信息）
  server.get('/parent/child/:id/meals', async (request, reply) => {
    const idParsed = uuidParamSchema.safeParse(request.params)
    if (!idParsed.success)
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    const userId = request.userId
    if (!userId) return reply.status(401).send(error(401, '未登录'))

    // 验证绑定
    const [binding] = await db
      .select()
      .from(eduParentStudentBinding)
      .where(
        and(
          eq(eduParentStudentBinding.parentId, userId),
          eq(eduParentStudentBinding.studentId, idParsed.data.id),
          eq(eduParentStudentBinding.status, 'confirmed'),
          isNull(eduParentStudentBinding.deletedAt),
        ),
      )
      .limit(1)
    if (!binding) return reply.status(403).send(error(403, '无权查看该学生数据'))

    // 获取当前周的菜谱
    const now = new Date()
    const startOfWeek = new Date(now)
    startOfWeek.setDate(now.getDate() - now.getDay() + 1) // 周一
    const endOfWeek = new Date(startOfWeek)
    endOfWeek.setDate(startOfWeek.getDate() + 6) // 周日
    const startStr = startOfWeek.toISOString().split('T')[0]!
    const endStr = endOfWeek.toISOString().split('T')[0]!

    const list = await db
      .select()
      .from(eduMealRecipe)
      .where(and(between(eduMealRecipe.date, startStr, endStr), isNull(eduMealRecipe.deletedAt)))
      .orderBy(eduMealRecipe.date, eduMealRecipe.mealType)
    return reply.send(success({ list }))
  })

  // ===========================================================================
  // 12. 孩子数据查看（家长端，children/:childId 前缀）
  //     与 Section 11 功能相同，URL 路径不同以匹配前端页面调用
  // ===========================================================================

  // 孩子课程表
  server.get('/parent/children/:childId/courses', async (request, reply) => {
    const childId = (request.params as { childId: string }).childId
    if (!childId) return reply.status(400).send(error(400, '无效的孩子ID'))
    const userId = request.userId
    if (!userId) return reply.status(401).send(error(401, '未登录'))

    // 验证绑定
    const [binding] = await db
      .select()
      .from(eduParentStudentBinding)
      .where(
        and(
          eq(eduParentStudentBinding.parentId, userId),
          eq(eduParentStudentBinding.studentId, childId),
          eq(eduParentStudentBinding.status, 'confirmed'),
          isNull(eduParentStudentBinding.deletedAt),
        ),
      )
      .limit(1)
    if (!binding) return reply.status(403).send(error(403, '无权查看该学生数据'))

    // 从签到记录中查找该学生最近的班级
    const [latestAttendance] = await db
      .select({ classId: eduAttendanceRecord.classId })
      .from(eduAttendanceRecord)
      .where(and(eq(eduAttendanceRecord.studentId, childId), isNull(eduAttendanceRecord.deletedAt)))
      .orderBy(desc(eduAttendanceRecord.date))
      .limit(1)

    if (!latestAttendance) {
      return reply.send(success({ list: [] }))
    }

    const list = await db
      .select()
      .from(eduCourseSchedule)
      .where(
        and(
          eq(eduCourseSchedule.classId, latestAttendance.classId),
          isNull(eduCourseSchedule.deletedAt),
        ),
      )
      .orderBy(eduCourseSchedule.weekday, eduCourseSchedule.startTime)
    return reply.send(success({ list }))
  })

  // 孩子今日菜谱
  server.get('/parent/children/:childId/meals', async (request, reply) => {
    const childId = (request.params as { childId: string }).childId
    if (!childId) return reply.status(400).send(error(400, '无效的孩子ID'))
    const userId = request.userId
    if (!userId) return reply.status(401).send(error(401, '未登录'))

    const [binding] = await db
      .select()
      .from(eduParentStudentBinding)
      .where(
        and(
          eq(eduParentStudentBinding.parentId, userId),
          eq(eduParentStudentBinding.studentId, childId),
          eq(eduParentStudentBinding.status, 'confirmed'),
          isNull(eduParentStudentBinding.deletedAt),
        ),
      )
      .limit(1)
    if (!binding) return reply.status(403).send(error(403, '无权查看该学生数据'))

    const today = new Date().toISOString().split('T')[0]!
    const list = await db
      .select()
      .from(eduMealRecipe)
      .where(and(eq(eduMealRecipe.date, today), isNull(eduMealRecipe.deletedAt)))
      .orderBy(eduMealRecipe.mealType)
    return reply.send(success({ list }))
  })

  // 孩子学习计划
  server.get('/parent/children/:childId/study-plans', async (request, reply) => {
    const childId = (request.params as { childId: string }).childId
    if (!childId) return reply.status(400).send(error(400, '无效的孩子ID'))
    const userId = request.userId
    if (!userId) return reply.status(401).send(error(401, '未登录'))

    const [binding] = await db
      .select()
      .from(eduParentStudentBinding)
      .where(
        and(
          eq(eduParentStudentBinding.parentId, userId),
          eq(eduParentStudentBinding.studentId, childId),
          eq(eduParentStudentBinding.status, 'confirmed'),
          isNull(eduParentStudentBinding.deletedAt),
        ),
      )
      .limit(1)
    if (!binding) return reply.status(403).send(error(403, '无权查看该学生数据'))

    const [latestAttendance] = await db
      .select({ classId: eduAttendanceRecord.classId })
      .from(eduAttendanceRecord)
      .where(and(eq(eduAttendanceRecord.studentId, childId), isNull(eduAttendanceRecord.deletedAt)))
      .orderBy(desc(eduAttendanceRecord.date))
      .limit(1)

    if (!latestAttendance) {
      return reply.send(success({ list: [] }))
    }

    const list = await db
      .select()
      .from(eduStudyPlan)
      .where(
        and(eq(eduStudyPlan.classId, latestAttendance.classId), isNull(eduStudyPlan.deletedAt)),
      )
      .orderBy(desc(eduStudyPlan.createdAt))
    return reply.send(success({ list }))
  })

  // 孩子考勤记录
  server.get('/parent/children/:childId/attendance', async (request, reply) => {
    const childId = (request.params as { childId: string }).childId
    if (!childId) return reply.status(400).send(error(400, '无效的孩子ID'))
    const userId = request.userId
    if (!userId) return reply.status(401).send(error(401, '未登录'))

    const [binding] = await db
      .select()
      .from(eduParentStudentBinding)
      .where(
        and(
          eq(eduParentStudentBinding.parentId, userId),
          eq(eduParentStudentBinding.studentId, childId),
          eq(eduParentStudentBinding.status, 'confirmed'),
          isNull(eduParentStudentBinding.deletedAt),
        ),
      )
      .limit(1)
    if (!binding) return reply.status(403).send(error(403, '无权查看该学生数据'))

    const list = await db
      .select()
      .from(eduAttendanceRecord)
      .where(and(eq(eduAttendanceRecord.studentId, childId), isNull(eduAttendanceRecord.deletedAt)))
      .orderBy(desc(eduAttendanceRecord.date))
    return reply.send(success({ list }))
  })

  // 孩子考试成绩
  server.get('/parent/children/:childId/grades', async (request, reply) => {
    const childId = (request.params as { childId: string }).childId
    if (!childId) return reply.status(400).send(error(400, '无效的孩子ID'))
    const userId = request.userId
    if (!userId) return reply.status(401).send(error(401, '未登录'))

    const [binding] = await db
      .select()
      .from(eduParentStudentBinding)
      .where(
        and(
          eq(eduParentStudentBinding.parentId, userId),
          eq(eduParentStudentBinding.studentId, childId),
          eq(eduParentStudentBinding.status, 'confirmed'),
          isNull(eduParentStudentBinding.deletedAt),
        ),
      )
      .limit(1)
    if (!binding) return reply.status(403).send(error(403, '无权查看该学生数据'))

    const list = await db
      .select()
      .from(eduExamScore)
      .where(and(eq(eduExamScore.studentId, childId), isNull(eduExamScore.deletedAt)))
      .orderBy(desc(eduExamScore.examDate), eduExamScore.subject)
    return reply.send(success({ list }))
  })

  // ===========================================================================
  // 12. 考试成绩管理 CRUD + 统计 + 排名 + 快照
  // ===========================================================================

  // 成绩列表
  server.get('/exam-score', async (request, reply) => {
    const parsed = examScoreListQuerySchema.safeParse(request.query)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const conds: SQL[] = [isNull(eduExamScore.deletedAt)]
    if (parsed.data.classId) conds.push(eq(eduExamScore.classId, parsed.data.classId))
    if (parsed.data.subject) conds.push(eq(eduExamScore.subject, parsed.data.subject))
    if (parsed.data.examName) conds.push(eq(eduExamScore.examName, parsed.data.examName))
    const where = and(...conds)
    const list = await db
      .select()
      .from(eduExamScore)
      .where(where)
      .orderBy(desc(eduExamScore.examDate), eduExamScore.subject)
    return reply.send(success({ list }))
  })

  // 创建成绩
  server.post('/exam-score', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const parsed = createExamScoreSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [row] = await db
      .insert(eduExamScore)
      .values({ ...parsed.data, recordedBy: request.userId })
      .returning()
    return reply.status(201).send(success({ score: row }))
  })

  // 删除成绩（软删除）
  server.delete('/exam-score/:id', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const idParsed = uuidParamSchema.safeParse(request.params)
    if (!idParsed.success)
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    const [existing] = await db
      .select()
      .from(eduExamScore)
      .where(and(eq(eduExamScore.id, idParsed.data.id), isNull(eduExamScore.deletedAt)))
      .limit(1)
    if (!existing) return reply.status(404).send(error(404, '成绩记录不存在'))
    await db
      .update(eduExamScore)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(eduExamScore.id, idParsed.data.id))
    return reply.send(success({ deleted: true }))
  })

  // 成绩统计
  server.get('/exam-score/stats', async (request, reply) => {
    const parsed = examScoreStatsQuerySchema.safeParse(request.query)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const conds: SQL[] = [isNull(eduExamScore.deletedAt)]
    if (parsed.data.classId) conds.push(eq(eduExamScore.classId, parsed.data.classId))
    const where = and(...conds)

    const stats = await db
      .select({
        avgScore: sql<number>`ROUND(AVG(${eduExamScore.score}::numeric), 1)`,
        maxScore: sql<number>`MAX(${eduExamScore.score})`,
        minScore: sql<number>`MIN(${eduExamScore.score})`,
        totalCount: count(),
      })
      .from(eduExamScore)
      .where(where)

    const avgScore = Number(stats[0]?.avgScore ?? 0)
    const maxScore = Number(stats[0]?.maxScore ?? 0)
    const minScore = Number(stats[0]?.minScore ?? 0)
    const totalCount = Number(stats[0]?.totalCount ?? 0)

    // 及格率（score >= totalScore * 0.6）
    const passCount = await db
      .select({ count: count() })
      .from(eduExamScore)
      .where(and(where, sql`${eduExamScore.score} >= ${eduExamScore.totalScore} * 0.6`))
    const passRate =
      totalCount > 0 ? Math.round((Number(passCount[0]?.count ?? 0) / totalCount) * 100) : 0

    // 分数分布
    const distribution = [
      { range: '0-59', count: 0 },
      { range: '60-69', count: 0 },
      { range: '70-79', count: 0 },
      { range: '80-89', count: 0 },
      { range: '90-100', count: 0 },
    ]
    const allScores = await db
      .select({ score: eduExamScore.score, totalScore: eduExamScore.totalScore })
      .from(eduExamScore)
      .where(where)
    for (const s of allScores) {
      const pct = Math.round((s.score / s.totalScore) * 100)
      if (pct < 60) distribution[0]!.count++
      else if (pct < 70) distribution[1]!.count++
      else if (pct < 80) distribution[2]!.count++
      else if (pct < 90) distribution[3]!.count++
      else distribution[4]!.count++
    }

    return reply.send(success({ avgScore, maxScore, minScore, totalCount, passRate, distribution }))
  })

  // 排名（按考试+班级聚合）
  server.get('/exam-score/ranking', async (request, reply) => {
    const parsed = examScoreRankingQuerySchema.safeParse(request.query)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const conds: SQL[] = [isNull(eduExamScore.deletedAt)]
    if (parsed.data.classId) conds.push(eq(eduExamScore.classId, parsed.data.classId))
    if (parsed.data.examName) conds.push(eq(eduExamScore.examName, parsed.data.examName))
    const where = and(...conds)

    // 按学生聚合总分
    const raw = await db
      .select({
        studentId: eduExamScore.studentId,
        totalScore: sql<number>`SUM(${eduExamScore.score})`,
        examCount: count(),
      })
      .from(eduExamScore)
      .where(where)
      .groupBy(eduExamScore.studentId)
      .orderBy(sql`SUM(${eduExamScore.score}) DESC`)

    const ranking = raw.map((r, i) => ({
      studentId: r.studentId,
      totalScore: Number(r.totalScore),
      examCount: Number(r.examCount),
      rank: i + 1,
    }))

    return reply.send(success({ ranking, totalStudents: ranking.length }))
  })

  // 创建排名快照
  server.post('/exam-score/snapshot', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const parsed = createSnapshotSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))

    const conds: SQL[] = [
      eq(eduExamScore.classId, parsed.data.classId),
      eq(eduExamScore.examName, parsed.data.examName),
      isNull(eduExamScore.deletedAt),
    ]
    const where = and(...conds)

    const raw = await db
      .select({
        studentId: eduExamScore.studentId,
        totalScore: sql<number>`SUM(${eduExamScore.score})`,
      })
      .from(eduExamScore)
      .where(where)
      .groupBy(eduExamScore.studentId)
      .orderBy(sql`SUM(${eduExamScore.score}) DESC`)

    const totalStudents = raw.length
    const snapshotValues = raw.map((r, i) => ({
      classId: parsed.data.classId,
      examName: parsed.data.examName,
      studentId: r.studentId,
      score: Number(r.totalScore),
      rank: i + 1,
      totalStudents,
      snapshotDate: new Date().toISOString().split('T')[0]!,
    }))

    if (snapshotValues.length > 0) {
      await db.insert(eduRankingSnapshot).values(snapshotValues)
    }

    return reply.status(201).send(success({ count: snapshotValues.length }))
  })

  // ===========================================================================
  // 13. 教师时间表 CRUD (edu_teacher_schedule)
  // ===========================================================================

  server.get('/teacher-schedule', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const parsed = teacherScheduleListQuerySchema.safeParse(request.query)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const conds: SQL[] = []
    if (parsed.data.termId) conds.push(eq(eduTeacherSchedule.termId, parsed.data.termId))
    const where = conds.length > 0 ? and(...conds) : undefined
    const list = await db
      .select()
      .from(eduTeacherSchedule)
      .where(where)
      .orderBy(eduTeacherSchedule.dayOfWeek, eduTeacherSchedule.startTime)
    return reply.send(success({ list }))
  })

  server.post('/teacher-schedule', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const parsed = createTeacherScheduleSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [row] = await db.insert(eduTeacherSchedule).values(parsed.data).returning()
    return reply.status(201).send(success({ teacherSchedule: row }))
  })

  server.put('/teacher-schedule/:id', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const idParsed = uuidParamSchema.safeParse(request.params)
    if (!idParsed.success)
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    const parsed = updateTeacherScheduleSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [existing] = await db
      .select()
      .from(eduTeacherSchedule)
      .where(eq(eduTeacherSchedule.id, idParsed.data.id))
      .limit(1)
    if (!existing) return reply.status(404).send(error(404, '教师时间表不存在'))
    const [row] = await db
      .update(eduTeacherSchedule)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(eduTeacherSchedule.id, idParsed.data.id))
      .returning()
    return reply.send(success({ teacherSchedule: row }))
  })

  server.delete('/teacher-schedule/:id', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const parsed = uuidParamSchema.safeParse(request.params)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [existing] = await db
      .select()
      .from(eduTeacherSchedule)
      .where(eq(eduTeacherSchedule.id, parsed.data.id))
      .limit(1)
    if (!existing) return reply.status(404).send(error(404, '教师时间表不存在'))
    await db.delete(eduTeacherSchedule).where(eq(eduTeacherSchedule.id, parsed.data.id))
    return reply.send(success({ deleted: true }))
  })

  // ===========================================================================
  // 14. 排课规则 CRUD (edu_scheduling_rule)
  // ===========================================================================

  server.get('/scheduling-rule', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const parsed = schedulingRuleListQuerySchema.safeParse(request.query)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const conds: SQL[] = [isNull(eduSchedulingRule.deletedAt)]
    if (parsed.data.termId) conds.push(eq(eduSchedulingRule.termId, parsed.data.termId))
    if (parsed.data.classId) conds.push(eq(eduSchedulingRule.classId, parsed.data.classId))
    const where = and(...conds)
    const list = await db
      .select()
      .from(eduSchedulingRule)
      .where(where)
      .orderBy(
        desc(eduSchedulingRule.priority),
        eduSchedulingRule.weekday,
        eduSchedulingRule.startTime,
      )
    return reply.send(success({ list }))
  })

  server.post('/scheduling-rule', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const parsed = createSchedulingRuleSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [row] = await db.insert(eduSchedulingRule).values(parsed.data).returning()
    return reply.status(201).send(success({ schedulingRule: row }))
  })

  server.put('/scheduling-rule/:id', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const idParsed = uuidParamSchema.safeParse(request.params)
    if (!idParsed.success)
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    const parsed = updateSchedulingRuleSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [existing] = await db
      .select()
      .from(eduSchedulingRule)
      .where(and(eq(eduSchedulingRule.id, idParsed.data.id), isNull(eduSchedulingRule.deletedAt)))
      .limit(1)
    if (!existing) return reply.status(404).send(error(404, '排课规则不存在'))
    const [row] = await db
      .update(eduSchedulingRule)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(eduSchedulingRule.id, idParsed.data.id))
      .returning()
    return reply.send(success({ schedulingRule: row }))
  })

  server.delete('/scheduling-rule/:id', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const parsed = uuidParamSchema.safeParse(request.params)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [existing] = await db
      .select()
      .from(eduSchedulingRule)
      .where(and(eq(eduSchedulingRule.id, parsed.data.id), isNull(eduSchedulingRule.deletedAt)))
      .limit(1)
    if (!existing) return reply.status(404).send(error(404, '排课规则不存在'))
    await db
      .update(eduSchedulingRule)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(eduSchedulingRule.id, parsed.data.id))
    return reply.send(success({ deleted: true }))
  })

  // ===========================================================================
  // 15. 自动排课 + 冲突检测
  // ===========================================================================

  // 自动排课
  server.post('/scheduling/auto-generate', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const parsed = autoGenerateSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))

    const { termId, classId } = parsed.data

    try {
      const result = await db.transaction(async (tx) => {
        // 查询 active 的排课规则
        const ruleConds: SQL[] = [
          eq(eduSchedulingRule.termId, termId),
          eq(eduSchedulingRule.isActive, true),
          isNull(eduSchedulingRule.deletedAt),
        ]
        if (classId) ruleConds.push(eq(eduSchedulingRule.classId, classId))
        const rules = await tx
          .select()
          .from(eduSchedulingRule)
          .where(and(...ruleConds))
          .orderBy(desc(eduSchedulingRule.priority))

        // 检查教师时间可用性
        const teacherSchedules = await tx
          .select()
          .from(eduTeacherSchedule)
          .where(
            and(eq(eduTeacherSchedule.termId, termId), eq(eduTeacherSchedule.isAvailable, true)),
          )

        // 检查已有课程，避免冲突
        const existingSchedules = await tx
          .select()
          .from(eduCourseSchedule)
          .where(and(eq(eduCourseSchedule.termId, termId), isNull(eduCourseSchedule.deletedAt)))

        const toInsert: Array<{
          termId: string
          classId: string
          courseName: string
          teacher: string
          weekday: number
          startTime: string
          endTime: string
          classroom: string | null
        }> = []

        for (const rule of rules) {
          // 检查教师在该时间段是否可用
          const tsAvailable = teacherSchedules.some(
            (ts) =>
              ts.teacherId === rule.teacherId &&
              ts.dayOfWeek === rule.weekday &&
              ts.startTime <= rule.startTime &&
              ts.endTime >= rule.endTime,
          )
          if (!tsAvailable) continue

          // 检查冲突：同一时间段同一教室或同一教师已有课程
          const hasConflict = existingSchedules.some(
            (es) =>
              es.weekday === rule.weekday &&
              es.startTime < rule.endTime &&
              es.endTime > rule.startTime &&
              (es.classroom === rule.classroom || es.teacher === rule.teacherId),
          )
          if (hasConflict) continue

          toInsert.push({
            termId: rule.termId,
            classId: rule.classId,
            courseName: rule.subject,
            teacher: rule.teacherId,
            weekday: rule.weekday,
            startTime: rule.startTime,
            endTime: rule.endTime,
            classroom: rule.classroom ?? null,
          })
        }

        let insertedCount = 0
        if (toInsert.length > 0) {
          const result = await tx.insert(eduCourseSchedule).values(toInsert).returning()
          insertedCount = result.length
        }

        return { count: insertedCount }
      })
      return reply.status(201).send(success(result))
    } catch (_err) {
      return reply.status(500).send(error(500, '自动排课失败'))
    }
  })

  // 冲突检测
  server.post('/scheduling/check-conflict', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const parsed = checkConflictSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))

    try {
      const { termId, weekday, startTime, endTime, classroom, teacherId, excludeScheduleId } =
        parsed.data

      const conds: SQL[] = [
        eq(eduCourseSchedule.termId, termId),
        eq(eduCourseSchedule.weekday, weekday),
        isNull(eduCourseSchedule.deletedAt),
      ]
      // 时间重叠检测
      conds.push(sql`${eduCourseSchedule.startTime} < ${endTime}`)
      conds.push(sql`${eduCourseSchedule.endTime} > ${startTime}`)
      if (excludeScheduleId) conds.push(sql`${eduCourseSchedule.id} != ${excludeScheduleId}::uuid`)

      // 教师冲突
      let teacherConflicts: Array<{ id: string; courseName: string; classroom: string | null }> = []
      if (teacherId) {
        const teacherConds = [...conds, eq(eduCourseSchedule.teacher, teacherId)]
        teacherConflicts = await db
          .select({
            id: eduCourseSchedule.id,
            courseName: eduCourseSchedule.courseName,
            classroom: eduCourseSchedule.classroom,
          })
          .from(eduCourseSchedule)
          .where(and(...teacherConds))
      }

      // 教室冲突
      let classroomConflicts: Array<{ id: string; courseName: string; teacher: string | null }> = []
      if (classroom) {
        const roomConds = [...conds, eq(eduCourseSchedule.classroom, classroom)]
        classroomConflicts = await db
          .select({
            id: eduCourseSchedule.id,
            courseName: eduCourseSchedule.courseName,
            teacher: eduCourseSchedule.teacher,
          })
          .from(eduCourseSchedule)
          .where(and(...roomConds))
      }

      return reply.send(success({ teacherConflicts, classroomConflicts }))
    } catch (_err) {
      return reply.status(500).send(error(500, '冲突检测失败'))
    }
  })

  // ===========================================================================
  // 16. 调课申请 CRUD + 审批 (edu_schedule_change)
  // ===========================================================================

  server.get('/schedule-change', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const parsed = scheduleChangeListQuerySchema.safeParse(request.query)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const { page, pageSize } = paginationSchema.parse(request.query)
    const conds: SQL[] = []
    if (parsed.data.status) conds.push(eq(eduScheduleChange.status, parsed.data.status))
    const where = conds.length > 0 ? and(...conds) : undefined
    const result = await paginate(
      eduScheduleChange,
      where,
      desc(eduScheduleChange.createdAt),
      page,
      pageSize,
    )
    return reply.send(success(result))
  })

  server.post('/schedule-change', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const parsed = createScheduleChangeSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [row] = await db
      .insert(eduScheduleChange)
      .values({ ...parsed.data, applicantId: request.userId! })
      .returning()
    return reply.status(201).send(success({ scheduleChange: row }))
  })

  // 审批通过
  server.put('/schedule-change/:id/approve', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const idParsed = uuidParamSchema.safeParse(request.params)
    if (!idParsed.success)
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    const parsed = approveChangeSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))

    try {
      const row = await db.transaction(async (tx) => {
        const [existing] = await tx
          .select()
          .from(eduScheduleChange)
          .where(eq(eduScheduleChange.id, idParsed.data.id))
          .limit(1)
        if (!existing) throw new Error('NOT_FOUND')
        if (existing.status !== 'pending') throw new Error('NOT_PENDING')

        const approverId = request.userId!

        // 更新调课申请状态
        const [updated] = await tx
          .update(eduScheduleChange)
          .set({
            status: 'approved',
            approverId,
            approveRemark: parsed.data.approveRemark,
            approveAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(eduScheduleChange.id, idParsed.data.id))
          .returning()
        if (!updated) throw new Error('UPDATE_FAILED')

        // 同步更新 edu_course_schedule 对应记录
        const scheduleUpdates: Record<string, unknown> = { updatedAt: new Date() }
        if (existing.newTeacher) scheduleUpdates.teacher = existing.newTeacher
        if (existing.newWeekday !== null) scheduleUpdates.weekday = existing.newWeekday
        if (existing.newStartTime) scheduleUpdates.startTime = existing.newStartTime
        if (existing.newEndTime) scheduleUpdates.endTime = existing.newEndTime

        if (Object.keys(scheduleUpdates).length > 1) {
          await tx
            .update(eduCourseSchedule)
            .set(scheduleUpdates)
            .where(eq(eduCourseSchedule.id, existing.scheduleId))
        }

        return updated
      })
      return reply.send(success({ scheduleChange: row }))
    } catch (err: unknown) {
      if ((err as { message?: string }).message === 'NOT_FOUND')
        return reply.status(404).send(error(404, '调课申请不存在'))
      if ((err as { message?: string }).message === 'NOT_PENDING')
        return reply.status(400).send(error(400, '仅待审批的申请可审批'))
      return reply.status(500).send(error(500, '审批失败'))
    }
  })

  // 驳回
  server.put('/schedule-change/:id/reject', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const idParsed = uuidParamSchema.safeParse(request.params)
    if (!idParsed.success)
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    const parsed = approveChangeSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [existing] = await db
      .select()
      .from(eduScheduleChange)
      .where(eq(eduScheduleChange.id, idParsed.data.id))
      .limit(1)
    if (!existing) return reply.status(404).send(error(404, '调课申请不存在'))
    if (existing.status !== 'pending')
      return reply.status(400).send(error(400, '仅待审批的申请可驳回'))

    const [row] = await db
      .update(eduScheduleChange)
      .set({
        status: 'rejected',
        approverId: request.userId,
        approveRemark: parsed.data.approveRemark,
        updatedAt: new Date(),
      })
      .where(eq(eduScheduleChange.id, idParsed.data.id))
      .returning()
    return reply.send(success({ scheduleChange: row }))
  })

  // ===========================================================================
  // 17. 作业提交 CRUD + 批改 + 统计 (edu_homework_submission)
  // ===========================================================================

  server.get('/homework-submission', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const parsed = homeworkSubmissionListQuerySchema.safeParse(request.query)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const { page, pageSize } = paginationSchema.parse(request.query)
    const conds: SQL[] = [isNull(eduHomeworkSubmission.deletedAt)]
    if (parsed.data.homeworkId)
      conds.push(eq(eduHomeworkSubmission.homeworkId, parsed.data.homeworkId))
    if (parsed.data.classId) conds.push(eq(eduHomeworkSubmission.classId, parsed.data.classId))
    const where = and(...conds)
    const result = await paginate(
      eduHomeworkSubmission,
      where,
      desc(eduHomeworkSubmission.createdAt),
      page,
      pageSize,
    )
    return reply.send(success(result))
  })

  server.post('/homework-submission', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const parsed = createHomeworkSubmissionSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [row] = await db.insert(eduHomeworkSubmission).values(parsed.data).returning()
    return reply.status(201).send(success({ submission: row }))
  })

  // 批改作业
  server.put('/homework-submission/:id/grade', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const idParsed = uuidParamSchema.safeParse(request.params)
    if (!idParsed.success)
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    const parsed = gradeHomeworkSubmissionSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [existing] = await db
      .select()
      .from(eduHomeworkSubmission)
      .where(
        and(
          eq(eduHomeworkSubmission.id, idParsed.data.id),
          isNull(eduHomeworkSubmission.deletedAt),
        ),
      )
      .limit(1)
    if (!existing) return reply.status(404).send(error(404, '作业提交记录不存在'))
    const [row] = await db
      .update(eduHomeworkSubmission)
      .set({
        score: parsed.data.score,
        comment: parsed.data.comment,
        teacherId: request.userId,
        gradedAt: new Date(),
        status: 'graded',
        updatedAt: new Date(),
      })
      .where(eq(eduHomeworkSubmission.id, idParsed.data.id))
      .returning()
    return reply.send(success({ submission: row }))
  })

  // 作业统计
  server.get('/homework-submission/stats', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const parsed = homeworkSubmissionStatsQuerySchema.safeParse(request.query)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const conds: SQL[] = [isNull(eduHomeworkSubmission.deletedAt)]
    if (parsed.data.classId) conds.push(eq(eduHomeworkSubmission.classId, parsed.data.classId))
    const where = and(...conds)

    const totalCount = await db
      .select({ count: count() })
      .from(eduHomeworkSubmission)
      .where(where)
      .then((r) => Number(r[0]?.count ?? 0))

    const gradedCount = await db
      .select({ count: count() })
      .from(eduHomeworkSubmission)
      .where(and(where, eq(eduHomeworkSubmission.status, 'graded')))
      .then((r) => Number(r[0]?.count ?? 0))

    const avgResult = await db
      .select({ avg: sql<number>`ROUND(AVG(${eduHomeworkSubmission.score}::numeric), 1)` })
      .from(eduHomeworkSubmission)
      .where(and(where, eq(eduHomeworkSubmission.status, 'graded')))
    const avgScore = Number(avgResult[0]?.avg ?? 0)

    const completionRate = totalCount > 0 ? Math.round((gradedCount / totalCount) * 100) : 0

    return reply.send(success({ totalCount, gradedCount, avgScore, completionRate }))
  })

  // ===========================================================================
  // 18. 线索管理 CRUD (edu_lead)
  // ===========================================================================

  server.get('/lead', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const parsed = leadListQuerySchema.safeParse(request.query)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const { page, pageSize } = paginationSchema.parse(request.query)
    const conds: SQL[] = [isNull(eduLead.deletedAt)]
    if (parsed.data.status) conds.push(eq(eduLead.status, parsed.data.status))
    if (parsed.data.source) conds.push(eq(eduLead.source, parsed.data.source))
    if (parsed.data.followerId) conds.push(eq(eduLead.followerId, parsed.data.followerId))
    const where = and(...conds)
    const result = await paginate(eduLead, where, desc(eduLead.createdAt), page, pageSize)
    return reply.send(success(result))
  })

  server.post('/lead', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const parsed = createLeadSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [row] = await db.insert(eduLead).values(parsed.data).returning()
    return reply.status(201).send(success({ lead: row }))
  })

  server.put('/lead/:id', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const idParsed = uuidParamSchema.safeParse(request.params)
    if (!idParsed.success)
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    const parsed = updateLeadSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [existing] = await db
      .select()
      .from(eduLead)
      .where(and(eq(eduLead.id, idParsed.data.id), isNull(eduLead.deletedAt)))
      .limit(1)
    if (!existing) return reply.status(404).send(error(404, '线索不存在'))
    const [row] = await db
      .update(eduLead)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(eduLead.id, idParsed.data.id))
      .returning()
    return reply.send(success({ lead: row }))
  })

  server.put('/lead/:id/status', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const idParsed = uuidParamSchema.safeParse(request.params)
    if (!idParsed.success)
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    const parsed = updateLeadStatusSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [existing] = await db
      .select()
      .from(eduLead)
      .where(and(eq(eduLead.id, idParsed.data.id), isNull(eduLead.deletedAt)))
      .limit(1)
    if (!existing) return reply.status(404).send(error(404, '线索不存在'))
    const [row] = await db
      .update(eduLead)
      .set({ status: parsed.data.status, updatedAt: new Date() })
      .where(eq(eduLead.id, idParsed.data.id))
      .returning()
    return reply.send(success({ lead: row }))
  })

  server.delete('/lead/:id', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const parsed = uuidParamSchema.safeParse(request.params)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [existing] = await db
      .select()
      .from(eduLead)
      .where(and(eq(eduLead.id, parsed.data.id), isNull(eduLead.deletedAt)))
      .limit(1)
    if (!existing) return reply.status(404).send(error(404, '线索不存在'))
    await db
      .update(eduLead)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(eduLead.id, parsed.data.id))
    return reply.send(success({ deleted: true }))
  })

  // ===========================================================================
  // 19. 试听预约 CRUD (edu_trial_booking)
  // ===========================================================================

  server.get('/trial-booking', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const parsed = trialBookingListQuerySchema.safeParse(request.query)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const { page, pageSize } = paginationSchema.parse(request.query)
    const conds: SQL[] = []
    if (parsed.data.status) conds.push(eq(eduTrialBooking.status, parsed.data.status))
    if (parsed.data.date) conds.push(eq(eduTrialBooking.trialDate, parsed.data.date))
    const where = conds.length > 0 ? and(...conds) : undefined
    const result = await paginate(
      eduTrialBooking,
      where,
      desc(eduTrialBooking.createdAt),
      page,
      pageSize,
    )
    return reply.send(success(result))
  })

  server.post('/trial-booking', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const parsed = createTrialBookingSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [row] = await db.insert(eduTrialBooking).values(parsed.data).returning()
    return reply.status(201).send(success({ trialBooking: row }))
  })

  server.put('/trial-booking/:id', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const idParsed = uuidParamSchema.safeParse(request.params)
    if (!idParsed.success)
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    const parsed = updateTrialBookingSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [existing] = await db
      .select()
      .from(eduTrialBooking)
      .where(eq(eduTrialBooking.id, idParsed.data.id))
      .limit(1)
    if (!existing) return reply.status(404).send(error(404, '试听预约不存在'))
    const [row] = await db
      .update(eduTrialBooking)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(eduTrialBooking.id, idParsed.data.id))
      .returning()
    return reply.send(success({ trialBooking: row }))
  })

  server.put('/trial-booking/:id/status', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const idParsed = uuidParamSchema.safeParse(request.params)
    if (!idParsed.success)
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    const parsed = updateTrialBookingStatusSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [existing] = await db
      .select()
      .from(eduTrialBooking)
      .where(eq(eduTrialBooking.id, idParsed.data.id))
      .limit(1)
    if (!existing) return reply.status(404).send(error(404, '试听预约不存在'))
    const [row] = await db
      .update(eduTrialBooking)
      .set({ status: parsed.data.status, updatedAt: new Date() })
      .where(eq(eduTrialBooking.id, idParsed.data.id))
      .returning()
    return reply.send(success({ trialBooking: row }))
  })

  // ===========================================================================
  // 20. 报名记录 CRUD (edu_enrollment)
  // ===========================================================================

  server.get('/enrollment', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const parsed = enrollmentListQuerySchema.safeParse(request.query)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const { page, pageSize } = paginationSchema.parse(request.query)
    const conds: SQL[] = [isNull(eduEnrollment.deletedAt)]
    if (parsed.data.classId) conds.push(eq(eduEnrollment.classId, parsed.data.classId))
    if (parsed.data.termId) conds.push(eq(eduEnrollment.termId, parsed.data.termId))
    if (parsed.data.status) conds.push(eq(eduEnrollment.status, parsed.data.status))
    const where = and(...conds)
    const result = await paginate(
      eduEnrollment,
      where,
      desc(eduEnrollment.createdAt),
      page,
      pageSize,
    )
    return reply.send(success(result))
  })

  server.post('/enrollment', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const parsed = createEnrollmentSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [row] = await db.insert(eduEnrollment).values(parsed.data).returning()
    return reply.status(201).send(success({ enrollment: row }))
  })

  server.put('/enrollment/:id', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const idParsed = uuidParamSchema.safeParse(request.params)
    if (!idParsed.success)
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    const parsed = updateEnrollmentSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [existing] = await db
      .select()
      .from(eduEnrollment)
      .where(and(eq(eduEnrollment.id, idParsed.data.id), isNull(eduEnrollment.deletedAt)))
      .limit(1)
    if (!existing) return reply.status(404).send(error(404, '报名记录不存在'))
    const [row] = await db
      .update(eduEnrollment)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(eduEnrollment.id, idParsed.data.id))
      .returning()
    return reply.send(success({ enrollment: row }))
  })

  server.delete('/enrollment/:id', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const parsed = uuidParamSchema.safeParse(request.params)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [existing] = await db
      .select()
      .from(eduEnrollment)
      .where(and(eq(eduEnrollment.id, parsed.data.id), isNull(eduEnrollment.deletedAt)))
      .limit(1)
    if (!existing) return reply.status(404).send(error(404, '报名记录不存在'))
    await db
      .update(eduEnrollment)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(eduEnrollment.id, parsed.data.id))
    return reply.send(success({ deleted: true }))
  })

  // ===========================================================================
  // 21. 学费标准 CRUD (edu_tuition_fee)
  // ===========================================================================

  server.get('/tuition-fee', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const parsed = tuitionFeeListQuerySchema.safeParse(request.query)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const { page, pageSize } = paginationSchema.parse(request.query)
    const conds: SQL[] = [isNull(eduTuitionFee.deletedAt)]
    if (parsed.data.classId) conds.push(eq(eduTuitionFee.classId, parsed.data.classId))
    if (parsed.data.termId) conds.push(eq(eduTuitionFee.termId, parsed.data.termId))
    const where = and(...conds)
    const result = await paginate(
      eduTuitionFee,
      where,
      desc(eduTuitionFee.createdAt),
      page,
      pageSize,
    )
    return reply.send(success(result))
  })

  server.post('/tuition-fee', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const parsed = createTuitionFeeSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [row] = await db.insert(eduTuitionFee).values(parsed.data).returning()
    return reply.status(201).send(success({ tuitionFee: row }))
  })

  server.put('/tuition-fee/:id', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const idParsed = uuidParamSchema.safeParse(request.params)
    if (!idParsed.success)
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    const parsed = updateTuitionFeeSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [existing] = await db
      .select()
      .from(eduTuitionFee)
      .where(and(eq(eduTuitionFee.id, idParsed.data.id), isNull(eduTuitionFee.deletedAt)))
      .limit(1)
    if (!existing) return reply.status(404).send(error(404, '学费标准不存在'))
    const [row] = await db
      .update(eduTuitionFee)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(eduTuitionFee.id, idParsed.data.id))
      .returning()
    return reply.send(success({ tuitionFee: row }))
  })

  server.delete('/tuition-fee/:id', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const parsed = uuidParamSchema.safeParse(request.params)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [existing] = await db
      .select()
      .from(eduTuitionFee)
      .where(and(eq(eduTuitionFee.id, parsed.data.id), isNull(eduTuitionFee.deletedAt)))
      .limit(1)
    if (!existing) return reply.status(404).send(error(404, '学费标准不存在'))
    await db
      .update(eduTuitionFee)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(eduTuitionFee.id, parsed.data.id))
    return reply.send(success({ deleted: true }))
  })

  // ===========================================================================
  // 22. 缴费记录 CRUD + 汇总 (edu_payment_record)
  // ===========================================================================

  server.get('/payment-record', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const parsed = paymentRecordListQuerySchema.safeParse(request.query)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const { page, pageSize } = paginationSchema.parse(request.query)
    const conds: SQL[] = [isNull(eduPaymentRecord.deletedAt)]
    if (parsed.data.studentId) conds.push(eq(eduPaymentRecord.studentId, parsed.data.studentId))
    if (parsed.data.classId) conds.push(eq(eduPaymentRecord.classId, parsed.data.classId))
    if (parsed.data.status) conds.push(eq(eduPaymentRecord.status, parsed.data.status))
    const where = and(...conds)
    const result = await paginate(
      eduPaymentRecord,
      where,
      desc(eduPaymentRecord.createdAt),
      page,
      pageSize,
    )
    return reply.send(success(result))
  })

  server.post('/payment-record', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const parsed = createPaymentRecordSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [row] = await db.insert(eduPaymentRecord).values(parsed.data).returning()
    return reply.status(201).send(success({ paymentRecord: row }))
  })

  // 缴费汇总
  server.get('/payment-record/summary', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const parsed = paymentRecordSummaryQuerySchema.safeParse(request.query)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))

    try {
      const result = await db.transaction(async (tx) => {
        const conds: SQL[] = [isNull(eduPaymentRecord.deletedAt)]
        if (parsed.data.classId) conds.push(eq(eduPaymentRecord.classId, parsed.data.classId))
        const where = and(...conds)

        // 总收入
        const totalResult = await tx
          .select({ total: sql<number>`COALESCE(SUM(${eduPaymentRecord.amount}), 0)` })
          .from(eduPaymentRecord)
          .where(and(where, eq(eduPaymentRecord.status, 'paid')))
        const totalIncome = Number(totalResult[0]?.total ?? 0)

        // 已缴费人数（去重）
        const paidResult = await tx.select({ count: count() }).from(
          tx
            .select({ studentId: eduPaymentRecord.studentId })
            .from(eduPaymentRecord)
            .where(and(where, eq(eduPaymentRecord.status, 'paid')))
            .groupBy(eduPaymentRecord.studentId)
            .as('paid_students'),
        )
        const paidStudentCount = Number(paidResult[0]?.count ?? 0)

        // 欠费人数和欠费总额（从 enrollment 表计算）
        const enrollConds: SQL[] = [isNull(eduEnrollment.deletedAt)]
        if (parsed.data.classId) enrollConds.push(eq(eduEnrollment.classId, parsed.data.classId))
        if (parsed.data.termId) enrollConds.push(eq(eduEnrollment.termId, parsed.data.termId))
        const enrollWhere = and(...enrollConds)
        const enrollments = await tx.select().from(eduEnrollment).where(enrollWhere)
        const arrearsStudents = enrollments.filter((e) => e.totalFee > e.paidAmount)
        const arrearsCount = arrearsStudents.length
        const arrearsTotal = arrearsStudents.reduce(
          (sum, e) => sum + (e.totalFee - e.paidAmount),
          0,
        )

        return { totalIncome, paidStudentCount, arrearsCount, arrearsTotal }
      })
      return reply.send(success(result))
    } catch (_err) {
      return reply.status(500).send(error(500, '汇总查询失败'))
    }
  })

  server.delete('/payment-record/:id', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const parsed = uuidParamSchema.safeParse(request.params)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [existing] = await db
      .select()
      .from(eduPaymentRecord)
      .where(and(eq(eduPaymentRecord.id, parsed.data.id), isNull(eduPaymentRecord.deletedAt)))
      .limit(1)
    if (!existing) return reply.status(404).send(error(404, '缴费记录不存在'))
    await db
      .update(eduPaymentRecord)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(eduPaymentRecord.id, parsed.data.id))
    return reply.send(success({ deleted: true }))
  })

  // ===========================================================================
  // 23. 退费记录 CRUD + 审批 (edu_refund_record)
  // ===========================================================================

  server.get('/refund-record', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const parsed = refundRecordListQuerySchema.safeParse(request.query)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const { page, pageSize } = paginationSchema.parse(request.query)
    const conds: SQL[] = [isNull(eduRefundRecord.deletedAt)]
    if (parsed.data.studentId) conds.push(eq(eduRefundRecord.studentId, parsed.data.studentId))
    if (parsed.data.classId) conds.push(eq(eduRefundRecord.classId, parsed.data.classId))
    if (parsed.data.status) conds.push(eq(eduRefundRecord.status, parsed.data.status))
    const where = and(...conds)
    const result = await paginate(
      eduRefundRecord,
      where,
      desc(eduRefundRecord.createdAt),
      page,
      pageSize,
    )
    return reply.send(success(result))
  })

  server.post('/refund-record', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const parsed = createRefundRecordSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [row] = await db
      .insert(eduRefundRecord)
      .values({ ...parsed.data, operatorId: parsed.data.operatorId || request.userId })
      .returning()
    return reply.status(201).send(success({ refundRecord: row }))
  })

  // 审批通过
  server.put('/refund-record/:id/approve', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const idParsed = uuidParamSchema.safeParse(request.params)
    if (!idParsed.success)
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    const parsed = approveRefundSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [existing] = await db
      .select()
      .from(eduRefundRecord)
      .where(and(eq(eduRefundRecord.id, idParsed.data.id), isNull(eduRefundRecord.deletedAt)))
      .limit(1)
    if (!existing) return reply.status(404).send(error(404, '退费记录不存在'))
    if (existing.status !== 'pending')
      return reply.status(400).send(error(400, '仅待审批的退费可审批'))
    const [row] = await db
      .update(eduRefundRecord)
      .set({
        status: 'approved',
        approverId: request.userId,
        approveRemark: parsed.data.approveRemark,
        approveAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(eduRefundRecord.id, idParsed.data.id))
      .returning()
    return reply.send(success({ refundRecord: row }))
  })

  // 驳回
  server.put('/refund-record/:id/reject', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const idParsed = uuidParamSchema.safeParse(request.params)
    if (!idParsed.success)
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    const parsed = approveRefundSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [existing] = await db
      .select()
      .from(eduRefundRecord)
      .where(and(eq(eduRefundRecord.id, idParsed.data.id), isNull(eduRefundRecord.deletedAt)))
      .limit(1)
    if (!existing) return reply.status(404).send(error(404, '退费记录不存在'))
    if (existing.status !== 'pending')
      return reply.status(400).send(error(400, '仅待审批的退费可驳回'))
    const [row] = await db
      .update(eduRefundRecord)
      .set({
        status: 'rejected',
        approverId: request.userId,
        approveRemark: parsed.data.approveRemark,
        updatedAt: new Date(),
      })
      .where(eq(eduRefundRecord.id, idParsed.data.id))
      .returning()
    return reply.send(success({ refundRecord: row }))
  })
  // ===========================================================================
  // 批量操作端点
  // ===========================================================================

  // 批量删除课程表条目
  server.post('/course-schedule/batch-delete', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const parsed = batchDeleteSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    try {
      const result = await db
        .update(eduCourseSchedule)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(inArray(eduCourseSchedule.id, parsed.data.ids))
        .returning()
      return reply.send(success({ deleted: result.length }))
    } catch (_err) {
      return reply.status(500).send(error(500, '批量删除失败'))
    }
  })

  // 批量启用/禁用排课规则
  server.post('/scheduling-rule/batch-toggle', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const parsed = batchToggleSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    try {
      const result = await db
        .update(eduSchedulingRule)
        .set({ isActive: parsed.data.isActive, updatedAt: new Date() })
        .where(inArray(eduSchedulingRule.id, parsed.data.ids))
        .returning()
      return reply.send(success({ updated: result.length }))
    } catch (_err) {
      return reply.status(500).send(error(500, '批量更新失败'))
    }
  })

  // 批量更新线索状态
  server.post('/lead/batch-status', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const parsed = batchStatusSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    try {
      const result = await db
        .update(eduLead)
        .set({ status: parsed.data.status, updatedAt: new Date() })
        .where(and(inArray(eduLead.id, parsed.data.ids), isNull(eduLead.deletedAt)))
        .returning()
      return reply.send(success({ updated: result.length }))
    } catch (_err) {
      return reply.status(500).send(error(500, '批量更新状态失败'))
    }
  })

  // 批量更新报名状态
  server.post('/enrollment/batch-status', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const parsed = batchStatusSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    try {
      const result = await db
        .update(eduEnrollment)
        .set({ status: parsed.data.status, updatedAt: new Date() })
        .where(and(inArray(eduEnrollment.id, parsed.data.ids), isNull(eduEnrollment.deletedAt)))
        .returning()
      return reply.send(success({ updated: result.length }))
    } catch (_err) {
      return reply.status(500).send(error(500, '批量更新状态失败'))
    }
  })

  // ===========================================================================
  // F3 前端路径别名 / 补齐 (bug-audit-2026-08-14.md)。
  // 以下端点前端 apps/web 通过 fetchApi('/api/edu-ai-management/...') 调用,
  // 但此前后端仅在"不同路径名"下实现了等价功能(如 /trial-booking ↔ /trial-reservation),
  // 导致前端 404。此处一律复用上方已定义的 Zod schema 与 edu_* 表,
  // 不重复造表、不重复定义校验,仅补齐前端实际使用的路径别名 + 3 个新端点。
  // ===========================================================================

  // --- 试听预约:前端 /trial-reservation ↔ 后端 /trial-booking ---
  server.post('/trial-reservation', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const parsed = createTrialBookingSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [row] = await db.insert(eduTrialBooking).values(parsed.data).returning()
    return reply.status(201).send(success({ trialBooking: row }))
  })

  server.put('/trial-reservation/:id', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const idParsed = uuidParamSchema.safeParse(request.params)
    if (!idParsed.success)
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    const parsed = updateTrialBookingSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [existing] = await db
      .select()
      .from(eduTrialBooking)
      .where(eq(eduTrialBooking.id, idParsed.data.id))
      .limit(1)
    if (!existing) return reply.status(404).send(error(404, '试听预约不存在'))
    const [row] = await db
      .update(eduTrialBooking)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(eduTrialBooking.id, idParsed.data.id))
      .returning()
    return reply.send(success({ trialBooking: row }))
  })

  // --- 学费标准:前端 /tuition-standard ↔ 后端 /tuition-fee ---
  server.post('/tuition-standard', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const parsed = createTuitionFeeSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [row] = await db.insert(eduTuitionFee).values(parsed.data).returning()
    return reply.status(201).send(success({ tuitionFee: row }))
  })

  server.put('/tuition-standard/:id', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const idParsed = uuidParamSchema.safeParse(request.params)
    if (!idParsed.success)
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    const parsed = updateTuitionFeeSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [existing] = await db
      .select()
      .from(eduTuitionFee)
      .where(and(eq(eduTuitionFee.id, idParsed.data.id), isNull(eduTuitionFee.deletedAt)))
      .limit(1)
    if (!existing) return reply.status(404).send(error(404, '学费标准不存在'))
    const [row] = await db
      .update(eduTuitionFee)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(eduTuitionFee.id, idParsed.data.id))
      .returning()
    return reply.send(success({ tuitionFee: row }))
  })

  server.delete('/tuition-standard/:id', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const parsed = uuidParamSchema.safeParse(request.params)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [existing] = await db
      .select()
      .from(eduTuitionFee)
      .where(and(eq(eduTuitionFee.id, parsed.data.id), isNull(eduTuitionFee.deletedAt)))
      .limit(1)
    if (!existing) return reply.status(404).send(error(404, '学费标准不存在'))
    await db
      .update(eduTuitionFee)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(eduTuitionFee.id, parsed.data.id))
    return reply.send(success({ deleted: true }))
  })

  // --- 退费:前端 /refund ↔ 后端 /refund-record ---
  server.post('/refund', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const parsed = createRefundRecordSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [row] = await db
      .insert(eduRefundRecord)
      .values({ ...parsed.data, operatorId: parsed.data.operatorId || request.userId })
      .returning()
    return reply.status(201).send(success({ refundRecord: row }))
  })

  server.put('/refund/:id/approve', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const idParsed = uuidParamSchema.safeParse(request.params)
    if (!idParsed.success)
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    const parsed = approveRefundSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [existing] = await db
      .select()
      .from(eduRefundRecord)
      .where(and(eq(eduRefundRecord.id, idParsed.data.id), isNull(eduRefundRecord.deletedAt)))
      .limit(1)
    if (!existing) return reply.status(404).send(error(404, '退费记录不存在'))
    if (existing.status !== 'pending')
      return reply.status(400).send(error(400, '仅待审批的退费可审批'))
    const [row] = await db
      .update(eduRefundRecord)
      .set({
        status: 'approved',
        approverId: request.userId,
        approveRemark: parsed.data.approveRemark,
        approveAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(eduRefundRecord.id, idParsed.data.id))
      .returning()
    return reply.send(success({ refundRecord: row }))
  })

  // --- 排课规则:前端 /scheduling/rule ↔ 后端 /scheduling-rule ---
  server.post('/scheduling/rule', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const parsed = createSchedulingRuleSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [row] = await db.insert(eduSchedulingRule).values(parsed.data).returning()
    return reply.status(201).send(success({ schedulingRule: row }))
  })

  server.put('/scheduling/rule/:id', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const idParsed = uuidParamSchema.safeParse(request.params)
    if (!idParsed.success)
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    const parsed = updateSchedulingRuleSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [existing] = await db
      .select()
      .from(eduSchedulingRule)
      .where(and(eq(eduSchedulingRule.id, idParsed.data.id), isNull(eduSchedulingRule.deletedAt)))
      .limit(1)
    if (!existing) return reply.status(404).send(error(404, '排课规则不存在'))
    const [row] = await db
      .update(eduSchedulingRule)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(eduSchedulingRule.id, idParsed.data.id))
      .returning()
    return reply.send(success({ schedulingRule: row }))
  })

  server.delete('/scheduling/rule/:id', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const parsed = uuidParamSchema.safeParse(request.params)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [existing] = await db
      .select()
      .from(eduSchedulingRule)
      .where(and(eq(eduSchedulingRule.id, parsed.data.id), isNull(eduSchedulingRule.deletedAt)))
      .limit(1)
    if (!existing) return reply.status(404).send(error(404, '排课规则不存在'))
    await db
      .update(eduSchedulingRule)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(eduSchedulingRule.id, parsed.data.id))
    return reply.send(success({ deleted: true }))
  })

  // --- 冲突检测:前端 /scheduling/check-conflicts ↔ 后端 /scheduling/check-conflict ---
  server.post('/scheduling/check-conflicts', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const parsed = checkConflictSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))

    try {
      const { termId, weekday, startTime, endTime, classroom, teacherId, excludeScheduleId } =
        parsed.data

      const conds: SQL[] = [
        eq(eduCourseSchedule.termId, termId),
        eq(eduCourseSchedule.weekday, weekday),
        isNull(eduCourseSchedule.deletedAt),
      ]
      conds.push(sql`${eduCourseSchedule.startTime} < ${endTime}`)
      conds.push(sql`${eduCourseSchedule.endTime} > ${startTime}`)
      if (excludeScheduleId) conds.push(sql`${eduCourseSchedule.id} != ${excludeScheduleId}::uuid`)

      let teacherConflicts: Array<{ id: string; courseName: string; classroom: string | null }> = []
      if (teacherId) {
        const teacherConds = [...conds, eq(eduCourseSchedule.teacher, teacherId)]
        teacherConflicts = await db
          .select({
            id: eduCourseSchedule.id,
            courseName: eduCourseSchedule.courseName,
            classroom: eduCourseSchedule.classroom,
          })
          .from(eduCourseSchedule)
          .where(and(...teacherConds))
      }

      let classroomConflicts: Array<{ id: string; courseName: string; teacher: string | null }> = []
      if (classroom) {
        const roomConds = [...conds, eq(eduCourseSchedule.classroom, classroom)]
        classroomConflicts = await db
          .select({
            id: eduCourseSchedule.id,
            courseName: eduCourseSchedule.courseName,
            teacher: eduCourseSchedule.teacher,
          })
          .from(eduCourseSchedule)
          .where(and(...roomConds))
      }

      return reply.send(success({ teacherConflicts, classroomConflicts }))
    } catch (_err) {
      return reply.status(500).send(error(500, '冲突检测失败'))
    }
  })

  // --- 教师时间表:前端 /scheduling/teacher-schedule ↔ 后端 /teacher-schedule ---
  server.post('/scheduling/teacher-schedule', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const parsed = createTeacherScheduleSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [row] = await db.insert(eduTeacherSchedule).values(parsed.data).returning()
    return reply.status(201).send(success({ teacherSchedule: row }))
  })

  server.put('/scheduling/teacher-schedule/:id', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const idParsed = uuidParamSchema.safeParse(request.params)
    if (!idParsed.success)
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    const parsed = updateTeacherScheduleSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [existing] = await db
      .select()
      .from(eduTeacherSchedule)
      .where(eq(eduTeacherSchedule.id, idParsed.data.id))
      .limit(1)
    if (!existing) return reply.status(404).send(error(404, '教师时间表不存在'))
    const [row] = await db
      .update(eduTeacherSchedule)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(eduTeacherSchedule.id, idParsed.data.id))
      .returning()
    return reply.send(success({ teacherSchedule: row }))
  })

  server.delete('/scheduling/teacher-schedule/:id', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const parsed = uuidParamSchema.safeParse(request.params)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [existing] = await db
      .select()
      .from(eduTeacherSchedule)
      .where(eq(eduTeacherSchedule.id, parsed.data.id))
      .limit(1)
    if (!existing) return reply.status(404).send(error(404, '教师时间表不存在'))
    await db.delete(eduTeacherSchedule).where(eq(eduTeacherSchedule.id, parsed.data.id))
    return reply.send(success({ deleted: true }))
  })

  // --- 调课审批:前端 /scheduling/change/:id/approve ↔ 后端 /schedule-change/:id/approve ---
  server.put('/scheduling/change/:id/approve', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const idParsed = uuidParamSchema.safeParse(request.params)
    if (!idParsed.success)
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    const parsed = approveChangeSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))

    try {
      const row = await db.transaction(async (tx) => {
        const [existing] = await tx
          .select()
          .from(eduScheduleChange)
          .where(eq(eduScheduleChange.id, idParsed.data.id))
          .limit(1)
        if (!existing) throw new Error('NOT_FOUND')
        if (existing.status !== 'pending') throw new Error('NOT_PENDING')

        const approverId = request.userId!
        const [updated] = await tx
          .update(eduScheduleChange)
          .set({
            status: 'approved',
            approverId,
            approveRemark: parsed.data.approveRemark,
            approveAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(eduScheduleChange.id, idParsed.data.id))
          .returning()
        if (!updated) throw new Error('UPDATE_FAILED')

        const scheduleUpdates: Record<string, unknown> = { updatedAt: new Date() }
        if (existing.newTeacher) scheduleUpdates.teacher = existing.newTeacher
        if (existing.newWeekday !== null) scheduleUpdates.weekday = existing.newWeekday
        if (existing.newStartTime) scheduleUpdates.startTime = existing.newStartTime
        if (existing.newEndTime) scheduleUpdates.endTime = existing.newEndTime

        if (Object.keys(scheduleUpdates).length > 1) {
          await tx
            .update(eduCourseSchedule)
            .set(scheduleUpdates)
            .where(eq(eduCourseSchedule.id, existing.scheduleId))
        }
        return updated
      })
      return reply.send(success({ scheduleChange: row }))
    } catch (err: unknown) {
      if ((err as { message?: string }).message === 'NOT_FOUND')
        return reply.status(404).send(error(404, '调课申请不存在'))
      if ((err as { message?: string }).message === 'NOT_PENDING')
        return reply.status(400).send(error(400, '仅待审批的申请可审批'))
      return reply.status(500).send(error(500, '审批失败'))
    }
  })

  // --- 家长绑定:前端 /parent-binding ↔ 后端 /parent/binding ---
  server.post('/parent-binding', async (request, reply) => {
    const parsed = createBindingSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const userId = request.userId
    if (!userId) return reply.status(401).send(error(401, '未登录'))

    const [existing] = await db
      .select()
      .from(eduParentStudentBinding)
      .where(
        and(
          eq(eduParentStudentBinding.parentId, userId),
          eq(eduParentStudentBinding.studentId, parsed.data.studentId),
          isNull(eduParentStudentBinding.deletedAt),
        ),
      )
      .limit(1)
    if (existing) return reply.status(409).send(error(409, '已存在绑定关系'))

    const [row] = await db
      .insert(eduParentStudentBinding)
      .values({
        parentId: userId,
        studentId: parsed.data.studentId,
        relationship: parsed.data.relationship,
      })
      .returning()
    return reply.status(201).send(success({ binding: row }))
  })

  server.delete('/parent-binding/:id', async (request, reply) => {
    const idParsed = uuidParamSchema.safeParse(request.params)
    if (!idParsed.success)
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    const userId = request.userId
    if (!userId) return reply.status(401).send(error(401, '未登录'))

    const [existing] = await db
      .select()
      .from(eduParentStudentBinding)
      .where(
        and(
          eq(eduParentStudentBinding.id, idParsed.data.id),
          isNull(eduParentStudentBinding.deletedAt),
        ),
      )
      .limit(1)
    if (!existing) return reply.status(404).send(error(404, '绑定不存在'))
    if (existing.parentId !== userId && existing.studentId !== userId)
      return reply.status(403).send(error(403, '仅绑定双方可解除绑定'))

    await db
      .update(eduParentStudentBinding)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(eduParentStudentBinding.id, idParsed.data.id))
    return reply.send(success({ deleted: true }))
  })

  // 学生确认绑定(前端 PUT /parent-binding/:id/confirm)
  server.put('/parent-binding/:id/confirm', async (request, reply) => {
    const idParsed = uuidParamSchema.safeParse(request.params)
    if (!idParsed.success)
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    const userId = request.userId
    if (!userId) return reply.status(401).send(error(401, '未登录'))

    const [existing] = await db
      .select()
      .from(eduParentStudentBinding)
      .where(
        and(
          eq(eduParentStudentBinding.id, idParsed.data.id),
          isNull(eduParentStudentBinding.deletedAt),
        ),
      )
      .limit(1)
    if (!existing) return reply.status(404).send(error(404, '绑定不存在'))
    if (existing.studentId !== userId)
      return reply.status(403).send(error(403, '仅学生本人可确认绑定'))

    const [row] = await db
      .update(eduParentStudentBinding)
      .set({ status: 'confirmed', confirmedAt: new Date(), updatedAt: new Date() })
      .where(eq(eduParentStudentBinding.id, idParsed.data.id))
      .returning()
    return reply.send(success({ binding: row }))
  })

  // 学生拒绝绑定(前端 PUT /parent-binding/:id/reject)
  server.put('/parent-binding/:id/reject', async (request, reply) => {
    const idParsed = uuidParamSchema.safeParse(request.params)
    if (!idParsed.success)
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    const userId = request.userId
    if (!userId) return reply.status(401).send(error(401, '未登录'))

    const [existing] = await db
      .select()
      .from(eduParentStudentBinding)
      .where(
        and(
          eq(eduParentStudentBinding.id, idParsed.data.id),
          isNull(eduParentStudentBinding.deletedAt),
        ),
      )
      .limit(1)
    if (!existing) return reply.status(404).send(error(404, '绑定不存在'))
    if (existing.studentId !== userId)
      return reply.status(403).send(error(403, '仅学生本人可拒绝绑定'))

    const [row] = await db
      .update(eduParentStudentBinding)
      .set({ status: 'rejected', updatedAt: new Date() })
      .where(eq(eduParentStudentBinding.id, idParsed.data.id))
      .returning()
    return reply.send(success({ binding: row }))
  })

  // --- 成绩薄弱点分析(前端 GET /exam-score/weakness/:id,此前无对应端点)---
  server.get('/exam-score/weakness/:id', async (request, reply) => {
    const idParsed = uuidParamSchema.safeParse(request.params)
    if (!idParsed.success)
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    const rows = await db
      .select()
      .from(eduExamScore)
      .where(and(eq(eduExamScore.studentId, idParsed.data.id), isNull(eduExamScore.deletedAt)))

    const bySubject = new Map<string, { sum: number; count: number; total: number }>()
    for (const r of rows) {
      const cur = bySubject.get(r.subject) ?? { sum: 0, count: 0, total: r.totalScore }
      cur.sum += r.score
      cur.count += 1
      cur.total = r.totalScore
      bySubject.set(r.subject, cur)
    }
    const weaknesses = [...bySubject.entries()]
      .map(([subject, v]) => {
        const avg = v.count ? v.sum / v.count : 0
        const rate = v.total ? avg / v.total : 0
        return {
          subject,
          avgScore: Math.round(avg * 10) / 10,
          examCount: v.count,
          totalScore: v.total,
          weak: rate < 0.6,
        }
      })
      .filter((w) => w.weak)
    return reply.send(success({ studentId: idParsed.data.id, weaknesses }))
  })
}

export default eduAiManagementRoutes
