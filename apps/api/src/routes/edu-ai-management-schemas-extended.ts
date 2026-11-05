// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { z } from 'zod'
import { count, sql, type SQL } from 'drizzle-orm'
import type { AnyPgTable, AnyPgColumn } from 'drizzle-orm/pg-core'
import { db } from '../db/index.js'
import { EDU_REMINDER_CHANNELS } from '../services/edu-ledger.js'

// normalizeHm = 时刻归一化单源(与排课冲突检测同一把尺,§0.6):考勤规则三个 HH:MM 阈值入参都过它

// =============================================================================
// 2026-11-08 考勤四缺口补齐(ATT-API 票)新增依赖 —— 三处都是"复用仓内单源,不再造第二份":
//   · judgeStatus  = 考勤状态判定(present/late/early/absent)的唯一实现,归 ATT-JOB 席;
//                    本文件禁止内联第二份判据(AGENTS §0.6 单一真相源)。
//   · secretsEqual = 全仓唯一定长时间比较出口(plugins/internal-service-token.ts:130,
//                    定长 SHA-256 后 timingSafeEqual);扫码签到 HMAC 校验只走它,不自拼比较。
//   · bizDayKey    = 上海墙钟日期键单源(utils/biz-day.ts),与缺勤补录 job 同一口径,
//                    不引入第三种日历算法(现读 check-in 里那句 toISOString() 是 UTC 口径,
//                    新端点一律按 bizDayKey,不与跨日边界再打架)。
// 契约依赖现读(本票收尾时复测):`eduAttendanceRule`(ATT-DB 席)与
// `apps/api/src/services/edu-attendance-rule.ts`(ATT-JOB 席)**已在盘上落定**
// (packages/database/src/schema/edu-ai-management.ts 的 eduAttendanceRule / 服务文件均实测存在),
// 故本文件的 import 不需要替身、也不得内联第二份判据;两席改动未落盘的窗口期里,
// 本文件按登记名先行 import,红项只在缺失符号那一处(§0.3:没判的绝不写成判过)。
// =============================================================================

// 2026-08-30 教师角色 RBAC 接入:教务管理端点由 requireAdmin 改为 requirePermission('edu:manage')
// admin(users.roleId >= 1)在 requirePermission 内自动豁免,行为不变;
// 持有 teacher 角色的普通用户(roleId=0)经 RBAC 表校验后可访问教务管理端点

import { emptyToUndefined } from '../utils/response.js'

// 12. 考试成绩管理 (edu_exam_score)
// =============================================================================

export const examScoreListQuerySchema = z.object({
  classId: z.transform(emptyToUndefined).pipe(z.string().uuid().optional()),
  subject: z.transform(emptyToUndefined).pipe(z.string().max(100).optional()),
  examName: z.transform(emptyToUndefined).pipe(z.string().max(200).optional()),
})

export const createExamScoreSchema = z.object({
  studentId: z.string().uuid(),
  classId: z.string().uuid(),
  subject: z.string().min(1).max(100),
  examName: z.string().min(1).max(200),
  score: z.number().int().min(0),
  totalScore: z.number().int().min(1).default(100),
  examDate: z.string().min(1),
  remark: z.string().optional(),
})

export const examScoreStatsQuerySchema = z.object({
  classId: z.transform(emptyToUndefined).pipe(z.string().uuid().optional()),
})

export const examScoreRankingQuerySchema = z.object({
  classId: z.transform(emptyToUndefined).pipe(z.string().uuid().optional()),
  examName: z.transform(emptyToUndefined).pipe(z.string().max(200).optional()),
})

export const createSnapshotSchema = z.object({
  classId: z.string().uuid(),
  examName: z.string().min(1).max(200),
})

// =============================================================================
// 13. 教师时间表 (edu_teacher_schedule)
// =============================================================================

export const teacherScheduleListQuerySchema = z.object({
  termId: z.transform(emptyToUndefined).pipe(z.string().uuid().optional()),
})

export const createTeacherScheduleSchema = z.object({
  teacherId: z.string().uuid(),
  termId: z.string().uuid(),
  dayOfWeek: z.number().int().min(1).max(7),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, '时间格式 HH:mm'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, '时间格式 HH:mm'),
  timeSlot: z.string().max(20).optional(),
  isAvailable: z.boolean().optional(),
})

export const updateTeacherScheduleSchema = createTeacherScheduleSchema.partial()

// =============================================================================
// 14. 排课规则 (edu_scheduling_rule)
// =============================================================================

export const schedulingRuleListQuerySchema = z.object({
  termId: z.transform(emptyToUndefined).pipe(z.string().uuid().optional()),
  classId: z.transform(emptyToUndefined).pipe(z.string().uuid().optional()),
})

export const createSchedulingRuleSchema = z.object({
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

export const updateSchedulingRuleSchema = createSchedulingRuleSchema.partial()

// =============================================================================
// 15. 自动排课 + 冲突检测
// =============================================================================

export const autoGenerateSchema = z.object({
  termId: z.string().uuid(),
  classId: z.transform(emptyToUndefined).pipe(z.string().uuid().optional()),
})

export const checkConflictSchema = z.object({
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

export const scheduleChangeListQuerySchema = z.object({
  status: z.transform(emptyToUndefined).pipe(z.string().max(20).optional()),
})

export const createScheduleChangeSchema = z.object({
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

export const approveChangeSchema = z.object({
  approveRemark: z.string().optional(),
})

// 全学期冲突扫描 body(2026-09-17,4-4-13)
export const termConflictScanSchema = z.object({
  termId: z.string().uuid(),
})

// =============================================================================
// 17. 作业提交 (edu_homework_submission)
// =============================================================================

export const homeworkSubmissionListQuerySchema = z.object({
  homeworkId: z.transform(emptyToUndefined).pipe(z.string().uuid().optional()),
  classId: z.transform(emptyToUndefined).pipe(z.string().uuid().optional()),
})

export const createHomeworkSubmissionSchema = z.object({
  homeworkId: z.string().uuid(),
  studentId: z.string().uuid(),
  classId: z.string().uuid(),
  content: z.string().optional(),
  attachment: z.string().max(500).optional(),
})

export const gradeHomeworkSubmissionSchema = z.object({
  score: z.number().int().min(0),
  comment: z.string().optional(),
})

export const homeworkSubmissionStatsQuerySchema = z.object({
  classId: z.transform(emptyToUndefined).pipe(z.string().uuid().optional()),
})

// =============================================================================
// 18. 线索管理 (edu_lead)
// =============================================================================

export const leadListQuerySchema = z.object({
  status: z.transform(emptyToUndefined).pipe(z.string().max(20).optional()),
  source: z.transform(emptyToUndefined).pipe(z.string().max(30).optional()),
  followerId: z.transform(emptyToUndefined).pipe(z.string().uuid().optional()),
})

export const createLeadSchema = z.object({
  name: z.string().min(1).max(100),
  phone: z.string().max(20).optional(),
  studentName: z.string().max(100).optional(),
  studentAge: z.number().int().min(0).optional(),
  source: z.string().min(1).max(30),
  followerId: z.string().uuid().optional(),
  nextFollowDate: z.string().optional(),
  remark: z.string().optional(),
})

export const updateLeadSchema = createLeadSchema.partial()

export const updateLeadStatusSchema = z.object({
  status: z.string().min(1).max(20),
})

// =============================================================================
// 19. 试听预约 (edu_trial_booking)
// =============================================================================

export const trialBookingListQuerySchema = z.object({
  status: z.transform(emptyToUndefined).pipe(z.string().max(20).optional()),
  date: z.transform(emptyToUndefined).pipe(z.string().optional()),
})

export const createTrialBookingSchema = z.object({
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

export const updateTrialBookingSchema = createTrialBookingSchema.partial()

export const updateTrialBookingStatusSchema = z.object({
  status: z.string().min(1).max(20),
})

// =============================================================================
// 20. 报名记录 (edu_enrollment)
// =============================================================================

export const enrollmentListQuerySchema = z.object({
  classId: z.transform(emptyToUndefined).pipe(z.string().uuid().optional()),
  termId: z.transform(emptyToUndefined).pipe(z.string().uuid().optional()),
  status: z.transform(emptyToUndefined).pipe(z.string().max(20).optional()),
})

export const createEnrollmentSchema = z.object({
  studentId: z.string().uuid(),
  classId: z.string().uuid(),
  termId: z.string().uuid(),
  enrollDate: z.string().min(1),
  totalFee: z.number().int().min(0),
  operatorId: z.string().uuid().optional(),
})

/**
 * 报名的两列派生态 paidAmount / nextDueDate **不在入参里**,这是刻意的:
 * 它们由 edu-ledger 从缴费流水 − 退费算出。若允许这里裸写,就会出现
 * "有已缴额但没有这笔钱从哪来"的死账 —— 下一次重算还会把它冲成流水口径的值,
 * 机构看到的数字随第几次写而变。缴费一律走 POST /payment-record。
 */
export const updateEnrollmentSchema = createEnrollmentSchema.partial()

// =============================================================================
// 21. 学费标准 (edu_tuition_fee)
// =============================================================================

export const tuitionFeeListQuerySchema = z.object({
  classId: z.transform(emptyToUndefined).pipe(z.string().uuid().optional()),
  termId: z.transform(emptyToUndefined).pipe(z.string().uuid().optional()),
})

export const createTuitionFeeSchema = z.object({
  classId: z.string().uuid(),
  termId: z.string().uuid(),
  feeName: z.string().min(1).max(100),
  amount: z.number().int().min(0),
  billingCycle: z.string().max(30).optional(),
  effectiveDate: z.string().min(1),
})

export const updateTuitionFeeSchema = createTuitionFeeSchema.partial()

// =============================================================================
// 22. 缴费记录 (edu_payment_record)
// =============================================================================

export const paymentRecordListQuerySchema = z.object({
  studentId: z.transform(emptyToUndefined).pipe(z.string().uuid().optional()),
  classId: z.transform(emptyToUndefined).pipe(z.string().uuid().optional()),
  status: z.transform(emptyToUndefined).pipe(z.string().max(20).optional()),
})

/**
 * 缴费登记入参。
 * **enrollmentId 必填**:一笔缴费必须挂到一条确定的报名上,否则它进不了
 * "该报名已缴多少" —— 旧契约反过来要求 studentId+classId 必填、没有归属锚点,
 * 于是同一班级续读多个学期的学生根本无从表达"这笔钱抵哪一期"。
 * studentId / classId 改为可选且只用于**一致性校验**:服务端一律以报名行里的值为准,
 * 请求自报的不一致直接拒(与本仓"归属/身份不得从请求体自报"同一条纪律)。
 */
export const createPaymentRecordSchema = z.object({
  enrollmentId: z.string().uuid(),
  studentId: z.string().uuid().optional(),
  classId: z.string().uuid().optional(),
  feeId: z.string().uuid().optional(),
  amount: z.number().int().min(0),
  paymentDate: z.string().min(1),
  paymentMethod: z.string().min(1).max(30),
  status: z.string().max(20).optional(),
  receiptNo: z.string().max(100).optional(),
  remark: z.string().optional(),
  operatorId: z.string().uuid().optional(),
})

export const paymentRecordSummaryQuerySchema = z.object({
  classId: z.transform(emptyToUndefined).pipe(z.string().uuid().optional()),
  termId: z.transform(emptyToUndefined).pipe(z.string().uuid().optional()),
})

// =============================================================================
// 24. 学生名册 + 催费 (业务线/欠费聚合,2026-09-19)
// =============================================================================

/** 业务线枚举:与 edu_class.business_line 对齐 */
export const BUSINESS_LINES = [
  'after_school_care',
  'kindergarten',
  'academic',
  'ai_course',
  'other',
] as const
export const businessLineSchema = z.enum(BUSINESS_LINES)

export const studentRosterQuerySchema = z.object({
  businessLine: z.transform(emptyToUndefined).pipe(businessLineSchema.optional()),
  classId: z.transform(emptyToUndefined).pipe(z.string().uuid().optional()),
  termId: z.transform(emptyToUndefined).pipe(z.string().uuid().optional()),
  keyword: z.transform(emptyToUndefined).pipe(z.string().max(100).optional()),
  arrearsOnly: z.transform(emptyToUndefined).pipe(z.enum(['1', 'true']).optional()),
})

export const feeReminderListQuerySchema = z.object({
  studentId: z.transform(emptyToUndefined).pipe(z.string().uuid().optional()),
  classId: z.transform(emptyToUndefined).pipe(z.string().uuid().optional()),
  channel: z.transform(emptyToUndefined).pipe(z.string().max(30).optional()),
})

/** 单发催费:锚定报名记录(欠费口径见 edu-ledger::deriveEnrollmentLedger),快照欠费金额 */

/**
 * 账期展开入参。**分期规则由调用方给**,系统只做机械摊派(见 edu-ledger::buildSchedulePlan)。
 * 放在模块顶层而不是路由体内 —— 顶层才能被测试出口 import 到(放在体内时,
 * 判据在文件末尾的 __test__ 里根本看不见它,TS 直接报 Cannot find name)。
 */
export const generateFeeScheduleSchema = z.object({
  enrollmentId: z.string().uuid(),
  periodCount: z.number().int().min(1).max(36),
  firstDueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式须为 YYYY-MM-DD'),
  cycle: z.enum(['once', 'monthly', 'termly']),
  monthsPerPeriod: z.number().int().min(1).max(24).optional(),
  graceDays: z.number().int().min(0).max(90).default(0),
  /** false 时若已有账期直接 409,不静默覆盖 —— 覆盖会连带抹掉已挂上账期的缴费归属 */
  replace: z.boolean().default(false),
})

export const createFeeReminderSchema = z.object({
  enrollmentId: z.string().uuid(),
  channel: z.enum(EDU_REMINDER_CHANNELS).default('in_app'),
  message: z.string().max(500).optional(),
})

/** 批量催费:勾选欠费名单(报名记录)一次发送,上限 100 */
export const batchFeeReminderSchema = z.object({
  enrollmentIds: z.array(z.string().uuid()).min(1).max(100),
  channel: z.enum(EDU_REMINDER_CHANNELS).default('in_app'),
  message: z.string().max(500).optional(),
})

/** 统计窗口:1–365 天。上限是防"全表扫描式"报表请求拖垮库,不是业务规则。 */
export const feeReminderStatsSchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
})

// =============================================================================
// 23. 退费记录 (edu_refund_record)
// =============================================================================

export const refundRecordListQuerySchema = z.object({
  studentId: z.transform(emptyToUndefined).pipe(z.string().uuid().optional()),
  classId: z.transform(emptyToUndefined).pipe(z.string().uuid().optional()),
  status: z.transform(emptyToUndefined).pipe(z.string().max(20).optional()),
})

export const createRefundRecordSchema = z.object({
  studentId: z.string().uuid(),
  classId: z.string().uuid(),
  paymentId: z.string().uuid().optional(),
  amount: z.number().int().min(0),
  refundDate: z.string().min(1),
  refundMethod: z.string().max(30).optional(),
  reason: z.string().min(1),
  operatorId: z.string().uuid().optional(),
})

export const approveRefundSchema = z.object({
  approveRemark: z.string().optional(),
})

// =============================================================================
// 批量操作 Schema
// =============================================================================

export const batchDeleteSchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
})

export const batchToggleSchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
  isActive: z.boolean(),
})

export const batchStatusSchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
  status: z.string().min(1).max(20),
})

// =============================================================================
// 分页 Schema & 辅助函数
// =============================================================================

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

export async function paginate(
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
