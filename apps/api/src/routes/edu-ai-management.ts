// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { createHmac, randomBytes } from 'node:crypto'
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import {
  eq,
  and,
  or,
  desc,
  asc,
  isNull,
  between,
  gte,
  lte,
  count,
  sql,
  inArray,
  ne,
  ilike,
  type SQL,
} from 'drizzle-orm'
import type { AnyPgTable, AnyPgColumn } from 'drizzle-orm/pg-core'
import { db } from '../db/index.js'
import {
  EDU_REMINDER_CHANNELS,
  arrearsSqlExpr,
  buildSchedulePlan,
  hasArrearsCond,
  loadEnrollmentLedger,
  loadUnattributedPayments,
  recomputeEnrollment,
  recordPayment,
  recordRefund,
  settleRefund,
  voidPaymentRecord,
} from '../services/edu-ledger.js'
import {
  aggregateDeliveries,
  attachReminderDelivery,
  dispatchArrearChannels,
  resolveReminderRecipients,
  sendArrearSmsToRecipient,
  sendWxToRecipient,
  type DeliveryEntry,
} from '../services/edu-arrear-remind-service.js'
// normalizeHm = 时刻归一化单源(与排课冲突检测同一把尺,§0.6):考勤规则三个 HH:MM 阈值入参都过它
import { findScheduleConflicts, normalizeHm } from '../services/edu-schedule-conflict.js'
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
import { judgeStatus } from '../services/edu-attendance-rule.js'
import { secretsEqual } from '../plugins/internal-service-token.js'
import { bizDayKey, shiftBizDayKey } from '../utils/biz-day.js'
import { sanitizeCsvCell } from '../utils/csv-utils.js'
import {
  eduTerm,
  eduClass,
  eduCourseSchedule,
  eduMealRecipe,
  eduMealWeekTemplate,
  eduStudyPlan,
  eduPlanItem,
  eduAttendanceRecord,
  eduAttendanceRule,
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
  eduFeeReminder,
  users,
  roles,
  userRoles,
  eduFeeSchedule,
  zhsCoursePay,
  zhsCoursePayLog,
} from '@ihui/database'
// 2026-08-30 教师角色 RBAC 接入:教务管理端点由 requireAdmin 改为 requirePermission('edu:manage')
// admin(users.roleId >= 1)在 requirePermission 内自动豁免,行为不变;
// 持有 teacher 角色的普通用户(roleId=0)经 RBAC 表校验后可访问教务管理端点
import { requirePermission, requireAnyPermission } from '../plugins/require-permission.js'
import { checkAuthOrInternalService } from '../plugins/auth.js'
import { success, error, emptyToUndefined } from '../utils/response.js'
import { createNotification } from '../db/notification-queries.js'
import {
  isSubscribeMessageConfigured,
  getWechatMiniOpenId,
  buildFeeReminderData,
  sendSubscribeMessage,
} from '../services/wechat-subscribe-message.js'

// 2026-08-30 教师角色 RBAC 接入:教务管理统一权限点(preHandler 工厂,模块级复用)
// 注:包装为无 this 参数签名,便于在 handler 内直接 await 调用(实现为箭头函数,不依赖 this)
const requireEduManage: (request: FastifyRequest, reply: FastifyReply) => Promise<unknown> =
  requirePermission('edu:manage')

// 2026-08-30 权限粒度细化:教务只读守卫,edu:view / edu:manage 任一命中即放行(可管理者必然可读)。
// 仅用于只读 GET 端点;写端点(POST/PUT/DELETE)仍统一使用 requireEduManage。
// admin(roleId>=1)在 requireAnyPermission 内自动豁免,与 requireEduManage 行为一致。
const requireEduView: (request: FastifyRequest, reply: FastifyReply) => Promise<unknown> =
  requireAnyPermission(['edu:view', 'edu:manage'])

// =============================================================================
// 通用 Zod schemas
// =============================================================================

const uuidParamSchema = z.object({ id: z.string().uuid('无效的 ID') })
/** `:childId` 形态的同一把形状闸(与 uuidParamSchema 同判据,只换键名)。 */
const childIdParamSchema = z.object({ childId: z.string().uuid('无效的 childId') })

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

/**
 * 考勤 status 筛选闸的合法值(2026-11-04 收口,本文件唯一一份取值表,§0.6)。
 *
 * 立因:`GET /attendance` 的 status 此前是 `z.string().max(20)` ⇒ 任意字符串都被当成一个
 * 合法筛选值,后端按 `eq(status, 'all')` **精确匹配**,于是 web「全部状态」档直传
 * `status=all` 时恒查空列表、且不报错(用户看到的是"今天没人考勤")。前端已于 41d5da91ec8
 * 归一成"不传";本票补后端那一半 —— 非法枚举值必须是可整改的 400,不能静默放行。
 *
 * 值集来源(现读,不另立共享档位常量文件):`edu_attendance_record.status` 的词表
 * = present/late/early/absent/leave,见 packages/database/src/schema/edu-ai-management.ts
 * 的列注释;其中前四档由 services/edu-attendance-rule.ts 的 `judgeStatus` 现算,
 * leave 由请假审批流写入(本文件 `eq(eduAttendanceRecord.status, 'leave')`)。
 *
 * 写法照同文件 `attendanceStatsQuerySchema.period` 的既有形态(就地写 z.enum);
 * 一枚实例被三处考勤读端点共用(GET /attendance、GET /parent/child/:id/attendance、
 * GET /parent/children/:childId/attendance),免得同一取值表在同文件抄两份必然漂移。
 * 错误文案点名合法值,让"该改成什么"当场可知(§0.10:失效方向恒为多要一次定向说明)。
 */
const attendanceStatusFilter = z.enum(
  ['present', 'late', 'early', 'absent', 'leave'],
  'status 仅支持 present/late/early/absent/leave',
)

const attendanceListQuerySchema = z.object({
  studentId: z.transform(emptyToUndefined).pipe(z.string().uuid().optional()),
  classId: z.transform(emptyToUndefined).pipe(z.string().uuid().optional()),
  date: z.transform(emptyToUndefined).pipe(z.string().optional()),
  /** 空串经 emptyToUndefined 归一为"不筛选";非五档值 ⇒ 400(不再静默当合法筛选值)。 */
  status: z.transform(emptyToUndefined).pipe(attendanceStatusFilter.optional()),
})

/**
 * 教师代签入参(2026-11 收口:status 字段已删 —— 状态一律服务端按该班规则 + judgeStatus 现算,
 * 不接受客户端自报;zod 默认 strip 未知键,老客户端继续传 status 只会被静默忽略,不会 400)。
 * checkInTime 为可选 ISO 时刻:当日签到可不传(取服务器 now);回填历史日期必须显式提供且落在该日内。
 */
const checkInSchema = z.object({
  studentId: z.string().uuid(),
  classId: z.string().uuid(),
  date: z.string().optional(),
  checkInMethod: z.string().max(20).optional(),
  checkInTime: z.transform(emptyToUndefined).pipe(z.string().optional()),
  remark: z.string().optional(),
})

const checkOutSchema = z.object({
  studentId: z.string().uuid(),
  classId: z.string().uuid(),
  date: z.string().min(1),
  checkOutMethod: z.string().max(20).optional(),
})

/**
 * 考勤记录修订入参(2026-11-04 收口:**status 字段已删,与教师代签/批量点名同一条口径**)。
 *
 * 取证(现读调用方,不是推断):全仓 `apps/web` / `apps/miniapp-taro/src` / `apps/mobile-rn/src` /
 * `packages/app|shared|api-client` 对 `PUT /attendance/:id` 的调用数 = **0**
 * (web 只有 `DELETE /attendance/${id}`,见 edu-management/attendance/PageClient.tsx;
 * RN 的 `attendance/${kind}` 是 check-in / check-out 两条具名路由;小程序只有 check-in /
 * check-out / batch-check-in;e2e 桩也没登记这条 PUT)。⇒ 这一枚 `status` 是无主死面。
 *
 * 为什么删而不是收成枚举:死字段收成枚举等于给一条没人走的路由再养一份契约;而按 2026-11
 * 已定的口径,`edu_attendance_record.status` 只能由服务端现算
 * (services/edu-attendance-rule.ts 的 `judgeStatus` + 请假审批写 'leave'),
 * 端上自报状态本身就是越权面 —— 留着它,任何拿到 edu:manage 的人都能把 absent 改成 present,
 * 且脏值会长期留在库里、让前端五档取词/色档落到默认档。
 *
 * zod 默认 strip 未知键 ⇒ 老客户端继续传 `status` 只会被静默丢弃(与 checkInSchema 同形),
 * 不会 400 打断既有集成;真正的持久化路径(签退/请假)各自带自己的重判逻辑。
 */
const updateAttendanceSchema = z.object({
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

// --- 2026-11-08 考勤补齐:批量点名 / 导出 / 学生自签 / 扫码签到 -----------------

/** 考勤日期列口径(与 edu_attendance_record.date 的 YYYY-MM-DD 一致,不接受其他形态)。 */
const attendanceDateSchema = z.transform(emptyToUndefined).pipe(
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式必须为 YYYY-MM-DD')
    .optional(),
)

/**
 * 批量点名入参。
 * 刻意**不含 studentIds**:名单唯一来源是「该班在册学生」(见 batchCheckIn 端点)。
 * 让客户端自报"给谁记账"等于把归属判定交给调用方,与 AGENTS §5「不得信客户端自报」同一条纪律。
 * 2026-11 收口(与教师代签同口径):status 字段已删,状态服务端现算;
 * checkInTime 同 checkInSchema —— 当日可不传,回填历史日必须显式提供且落在该日内。
 */
const batchCheckInSchema = z.object({
  classId: z.string().uuid(),
  date: attendanceDateSchema,
  checkInTime: z.transform(emptyToUndefined).pipe(z.string().optional()),
  remark: z.string().max(500).optional(),
})

/**
 * 考勤导出入参。format 只认 csv —— 未登记的格式回 400 点名,不静默回落成 csv(§0.3)。
 * classId 必填:导出是全班名册级数据,不给"无班级=全库"留口子。
 */
const attendanceExportQuerySchema = z.object({
  classId: z.string().uuid(),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  format: z.enum(['csv']).default('csv'),
})

/**
 * 学生自签入参:**没有 studentId、也没有 classId** —— 身份只从登录态 request.userId 取,
 * 班级归属由服务端按在册关系现取(AGENTS §5:归属主体由承载层显式传入,不得信客户端自报;
 * 此前要求客户端传 classId 已实测造成小程序 400 / RN 死结 / Web 手输 UUID 三处伤害)。
 * 客户端硬塞的 classId 会被 zod 默认 strip 静默忽略(生效班级以服务端现取结果为准并回显)。
 * 若日后要支持家长代签,另开端点显式校验 edu_parent_student_binding,不得在这里加可选字段。
 */
const selfCheckInSchema = z.object({
  date: attendanceDateSchema,
  remark: z.string().max(500).optional(),
})

/**
 * 学生本人考勤查询入参:三个日期档一律走同一把 attendanceDateSchema 形状闸,
 * 不在这里另写第二份正则(§0.6 单一真相源)。刻意**不含 studentId**:
 * 归属主体只从登录态 request.userId 取,客户端自报一律被 zod strip 静默忽略(AGENTS §5)。
 */
const myAttendanceQuerySchema = z.object({
  date: attendanceDateSchema,
  startDate: attendanceDateSchema,
  endDate: attendanceDateSchema,
})

const attendanceQrCodeQuerySchema = z.object({
  classId: z.string().uuid(),
})

/**
 * 扫码签到入参:只收 token —— classId 包含在教师端出码的 HMAC 载荷里
 * (buildAttendanceQrToken 签名覆盖 classId|exp,学生端不得再自报班级,防"拿 A 班码签 B 班")。
 * token 长度上限 2048 防"巨型 base64 进 HMAC 前解析";身份同样只取 request.userId。
 */
const qrcodeCheckInSchema = z.object({
  token: z.string().min(1).max(2048),
})

// --- 考勤规则配置入口(2026-11-08 本票①:此前无任何端点可写 edu_attendance_rule,
//     导致 qrSecret 恒空、扫码档结构上不可用,迟到阈值也无据可判) -------------------

const attendanceRuleQuerySchema = z.object({
  classId: z.string().uuid(),
})

/**
 * 规则 upsert 入参:三个阈值只声明为非空字符串,合法形态交 normalizeHm 单源裁决
 * (返回 null ⇒ 400 点名原值,不静默回落,§0.3)。
 */
const attendanceRuleUpsertSchema = z.object({
  classId: z.string().uuid(),
  lateAfter: z.string().min(1).optional(),
  earlyBefore: z.string().min(1).optional(),
  absentAfter: z.string().min(1).optional(),
  enabled: z.boolean().optional(),
})

const rotateQrSecretSchema = z.object({
  classId: z.string().uuid(),
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
  /**
   * 家长侧「按状态筛选孩子的考勤」与 `GET /attendance` 同一张脸(2026-11-04 同批收口):
   * 此前同样是 `z.string().max(20)`,非法值被静默当合法筛选条件 ⇒ 恒空且不报错。
   * 共用同一枚 `attendanceStatusFilter` 实例,不在这里抄第二份取值表(§0.6)。
   * 2026-11-04 补:这枚 schema 现由**两条**家长读端点共用
   * (`/parent/child/:id/attendance` 与 `/parent/children/:childId/attendance`)
   * —— 后者此前没有任何 query 闸,传 status 被静默忽略;同一条查询形状两条端点判得不一样
   * 就是缺陷,所以不复抄新表、直接复用这一枚。
   */
  status: z.transform(emptyToUndefined).pipe(attendanceStatusFilter.optional()),
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

// 全学期冲突扫描 body(2026-09-17,4-4-13)
const termConflictScanSchema = z.object({
  termId: z.string().uuid(),
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
  operatorId: z.string().uuid().optional(),
})

/**
 * 报名的两列派生态 paidAmount / nextDueDate **不在入参里**,这是刻意的:
 * 它们由 edu-ledger 从缴费流水 − 退费算出。若允许这里裸写,就会出现
 * "有已缴额但没有这笔钱从哪来"的死账 —— 下一次重算还会把它冲成流水口径的值,
 * 机构看到的数字随第几次写而变。缴费一律走 POST /payment-record。
 */
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

/**
 * 缴费登记入参。
 * **enrollmentId 必填**:一笔缴费必须挂到一条确定的报名上,否则它进不了
 * "该报名已缴多少" —— 旧契约反过来要求 studentId+classId 必填、没有归属锚点,
 * 于是同一班级续读多个学期的学生根本无从表达"这笔钱抵哪一期"。
 * studentId / classId 改为可选且只用于**一致性校验**:服务端一律以报名行里的值为准,
 * 请求自报的不一致直接拒(与本仓"归属/身份不得从请求体自报"同一条纪律)。
 */
const createPaymentRecordSchema = z.object({
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

const paymentRecordSummaryQuerySchema = z.object({
  classId: z.transform(emptyToUndefined).pipe(z.string().uuid().optional()),
  termId: z.transform(emptyToUndefined).pipe(z.string().uuid().optional()),
})

// =============================================================================
// 24. 学生名册 + 催费 (业务线/欠费聚合,2026-09-19)
// =============================================================================

/** 业务线枚举:与 edu_class.business_line 对齐 */
const BUSINESS_LINES = [
  'after_school_care',
  'kindergarten',
  'academic',
  'ai_course',
  'other',
] as const
const businessLineSchema = z.enum(BUSINESS_LINES)

const studentRosterQuerySchema = z.object({
  businessLine: z.transform(emptyToUndefined).pipe(businessLineSchema.optional()),
  classId: z.transform(emptyToUndefined).pipe(z.string().uuid().optional()),
  termId: z.transform(emptyToUndefined).pipe(z.string().uuid().optional()),
  keyword: z.transform(emptyToUndefined).pipe(z.string().max(100).optional()),
  arrearsOnly: z.transform(emptyToUndefined).pipe(z.enum(['1', 'true']).optional()),
})

const feeReminderListQuerySchema = z.object({
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
const generateFeeScheduleSchema = z.object({
  enrollmentId: z.string().uuid(),
  periodCount: z.number().int().min(1).max(36),
  firstDueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期格式须为 YYYY-MM-DD'),
  cycle: z.enum(['once', 'monthly', 'termly']),
  monthsPerPeriod: z.number().int().min(1).max(24).optional(),
  graceDays: z.number().int().min(0).max(90).default(0),
  /** false 时若已有账期直接 409,不静默覆盖 —— 覆盖会连带抹掉已挂上账期的缴费归属 */
  replace: z.boolean().default(false),
})

const createFeeReminderSchema = z.object({
  enrollmentId: z.string().uuid(),
  channel: z.enum(EDU_REMINDER_CHANNELS).default('in_app'),
  message: z.string().max(500).optional(),
})

/** 批量催费:勾选欠费名单(报名记录)一次发送,上限 100 */
const batchFeeReminderSchema = z.object({
  enrollmentIds: z.array(z.string().uuid()).min(1).max(100),
  channel: z.enum(EDU_REMINDER_CHANNELS).default('in_app'),
  message: z.string().max(500).optional(),
})

/** 统计窗口:1–365 天。上限是防"全表扫描式"报表请求拖垮库,不是业务规则。 */
const feeReminderStatsSchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
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
// 8b. 考勤补齐的模块级出口(2026-11-08,ATT-API 票)
// =============================================================================

/** 扫码 token 有效期:60 秒。教学现场"教师投码 → 学生扫码"在一分钟内完成;
 *  取短 TTL 是因为载荷里没有一次性 nonce —— 同班同窗口内 token 对全班等价,长 TTL 等于把
 *  可重放窗口交给走廊里举着手机的人。 */
const ATT_QR_TOKEN_TTL_MS = 60_000

/**
 * 把 [startDate, endDate] 折成逐日日期键数组(含两端)。
 * 走 `shiftBizDayKey`(与 `bizDayKey` 同一口径),不引入第二套日历算法。
 * 上界 366 天:请假单跨年是异常数据,而"异常时无界循环"正是补录类写操作最坏的形态,
 * 故超限直接抛错让调用方回 400,而不是默默写几千行。
 */
function enumerateAttendanceDates(startDate: string, endDate: string): string[] {
  const out: string[] = []
  let cursor = startDate
  // 字符串 YYYY-MM-DD 的字典序 == 时间序,无需再解一次 Date
  while (cursor <= endDate) {
    out.push(cursor)
    if (out.length > 366) throw new Error('LEAVE_RANGE_TOO_WIDE')
    cursor = shiftBizDayKey(cursor, 1)
  }
  return out
}

/** 班级考勤规则(enabled 且未软删);无规则 ⇒ null,由调用方按"无阈值"退化,不自造默认阈值。
 *  只读单例 db(不接 tx):本函数读的是**配置**不是被写的那行,把它塞进事务只会让 tx 类型在
 *  drizzle 的 db/tx 两态之间反复妥协;判据本身仍由 judgeStatus 单源承担。 */
async function loadEnabledAttendanceRule(classId: string): Promise<{
  lateAfter: string | null
  earlyBefore: string | null
  qrSecret: string | null
} | null> {
  const [rule] = await db
    .select()
    .from(eduAttendanceRule)
    .where(
      and(
        eq(eduAttendanceRule.classId, classId),
        eq(eduAttendanceRule.enabled, true),
        isNull(eduAttendanceRule.deletedAt),
      ),
    )
    .limit(1)
  if (!rule) return null
  return {
    lateAfter: rule.lateAfter ?? null,
    earlyBefore: rule.earlyBefore ?? null,
    qrSecret: rule.qrSecret ?? null,
  }
}

/**
 * 教师侧签到两入口(单人代签 / 批量点名)的统一前置(2026-11 本票立,推广 checkInByStudent
 * 已定档的正确口径,不新造判据):
 *   ① checkInTime 与记录 date 必须落在同一个上海业务日(bizDayKey 单源口径,守门 246):
 *        未显式给时刻 ⇒ 只有当日业务日才取服务器 now,回填历史日一律拒收;
 *        显式给时刻 ⇒ 解析失败或跨业务日同样拒收(§0.3,不静默回落成 now);
 *   ② status 一律由 judgeStatus + 该班 edu_attendance_rule 现算,入参 schema 已删 status,
 *        客户端自报值被 zod strip 后结构上进不了库。
 * 本函数体内不出现任何阈值比较 —— 迟到的那把尺始终在 judgeStatus(§0.6 单一真相源)。
 */
async function resolveTeacherCheckIn(params: {
  classId: string
  date: string
  checkInTimeRaw?: string | undefined
  now: Date
}): Promise<{ ok: true; checkInTime: Date; status: string } | { ok: false; message: string }> {
  const { classId, date, checkInTimeRaw, now } = params
  let checkInTime: Date
  if (checkInTimeRaw === undefined) {
    if (bizDayKey(now) !== date)
      return { ok: false, message: '回填非当日的考勤必须显式提供该日内的签到时刻 checkInTime' }
    checkInTime = now
  } else {
    const d = new Date(checkInTimeRaw)
    if (Number.isNaN(d.getTime())) return { ok: false, message: 'checkInTime 不是合法时刻' }
    if (bizDayKey(d) !== date) return { ok: false, message: 'checkInTime 必须与考勤日期 date 同日' }
    checkInTime = d
  }
  const rule = await loadEnabledAttendanceRule(classId)
  const status = judgeStatus({
    lateAfter: rule?.lateAfter ?? null,
    earlyBefore: rule?.earlyBefore ?? null,
    checkInTime,
    checkOutTime: null,
  })
  return { ok: true, checkInTime, status }
}

/**
 * 签退重判的优先级保护(2026-11 本票②):leave(请假审批联动写入)与 absent(日终补录/
 * 判定写入)都比 present/late/early 三档的"当日在场结论"优先级高,
 * 签退重判绝不把这两态洗回去;其余状态才交 judgeStatus 现判(早退维自此真能落库)。
 * 本函数只答"原态是否保留",不答"该判成什么"——判定阈值仍单源在 judgeStatus。
 */
function statusPreservedOnCheckOut(status: string): boolean {
  return status === 'leave' || status === 'absent'
}

/** edu_attendance_rule 的行形态(随表定义走,不在端点里各抄一份字段清单)。 */
type AttendanceRuleRow = typeof eduAttendanceRule.$inferSelect

/**
 * 规则行对外的唯一投影出口(本票①契约):响应**绝不含 qrSecret 原文**,
 * 只回 qrSecretConfigured 布尔 —— 密钥只作为 HMAC 的 key 参与签名,不落任何出参。
 */
function toAttendanceRuleDto(row: AttendanceRuleRow | null): {
  id: string
  classId: string
  lateAfter: string | null
  earlyBefore: string | null
  absentAfter: string | null
  enabled: boolean
  qrSecretConfigured: boolean
  createdAt: Date
  updatedAt: Date
} | null {
  if (!row) return null
  return {
    id: row.id,
    classId: row.classId,
    lateAfter: row.lateAfter ?? null,
    earlyBefore: row.earlyBefore ?? null,
    absentAfter: row.absentAfter ?? null,
    enabled: row.enabled,
    qrSecretConfigured: Boolean(row.qrSecret),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

/**
 * 自签班级归属的服务端现取(本票②),顺序固定两步,没有第三步兜底:
 *   ① 该生当日已有未软删考勤行所属班级(同日再次签退/补签仍落同一个班);
 *   ② 否则 eduEnrollment 中该生 status='enrolled' ∧ 未软删、按 createdAt 倒序最近一条的 classId
 *      (在册口径与批量点名、缺勤补录 job 同源,不另定义);
 *   两步都取不到 ⇒ null,由调用方回 409 给可读 reason —— 禁止回落成"随便挑一个班"。
 */
async function resolveSelfCheckInClassId(studentId: string, date: string): Promise<string | null> {
  const [todayRow] = await db
    .select({ classId: eduAttendanceRecord.classId })
    .from(eduAttendanceRecord)
    .where(
      and(
        eq(eduAttendanceRecord.studentId, studentId),
        eq(eduAttendanceRecord.date, date),
        isNull(eduAttendanceRecord.deletedAt),
      ),
    )
    .limit(1)
  if (todayRow?.classId) return todayRow.classId

  const [enrollment] = await db
    .select({ classId: eduEnrollment.classId })
    .from(eduEnrollment)
    .where(
      and(
        eq(eduEnrollment.studentId, studentId),
        eq(eduEnrollment.status, 'enrolled'),
        isNull(eduEnrollment.deletedAt),
      ),
    )
    .orderBy(desc(eduEnrollment.createdAt))
    .limit(1)
  return enrollment?.classId ?? null
}

/** 扫码 token 的载荷形态(decode 单点:出码校验与解班两处共用,不各写一份 JSON.parse)。 */
type AttendanceQrDecoded = { classId: string; exp: number; sig: string }

/** 解析 base64url token 载荷;形态不合 ⇒ null(调用方按 TOKEN_MALFORMED 处理)。 */
function decodeAttendanceQrToken(rawToken: string): AttendanceQrDecoded | null {
  let decoded: unknown
  try {
    decoded = JSON.parse(Buffer.from(rawToken, 'base64url').toString('utf8'))
  } catch {
    return null
  }
  const t = decoded as { classId?: unknown; exp?: unknown; sig?: unknown }
  if (
    !t ||
    typeof t.classId !== 'string' ||
    typeof t.exp !== 'number' ||
    typeof t.sig !== 'string' ||
    t.sig.length === 0
  )
    return null
  return { classId: t.classId, exp: t.exp, sig: t.sig }
}

/**
 * 生成签到二维码载荷的 token 部分:classId + 到期时刻经 qrSecret 做 HMAC-SHA256。
 * 载荷里**绝不含密钥原文**(qrSecret 只作为 HMAC 的 key 参与签名,不入 token、不入响应)。
 */
function buildAttendanceQrToken(
  classId: string,
  qrSecret: string,
  nowMs: number,
  ttlMs: number,
): { token: string; expiresAtMs: number } {
  const expiresAtMs = nowMs + ttlMs
  const signature = createHmac('sha256', qrSecret).update(`${classId}|${expiresAtMs}`).digest('hex')
  const token = Buffer.from(
    JSON.stringify({ v: 1, classId, exp: expiresAtMs, sig: signature }),
    'utf8',
  ).toString('base64url')
  return { token, expiresAtMs }
}

/** token 校验的四类失败码(逐类点名,不并成一句"校验失败" —— 现场排障要能分清是过期还是签错) */
type AttendanceQrVerifyFailure =
  'TOKEN_MALFORMED' | 'TOKEN_CLASS_MISMATCH' | 'TOKEN_EXPIRED' | 'TOKEN_SIGNATURE_INVALID'

/**
 * 校验扫码 token。返回 null 表示通过,否则给出失败码。
 * 签名比较必须走 `secretsEqual`(全仓唯一定长时间出口):直接 `a === b` 会按公共前缀长度早退,
 * 等于把 HMAC 的每一位花一次请求慢慢试出来。
 */
function verifyAttendanceQrToken(
  rawToken: string,
  classId: string,
  qrSecret: string,
  nowMs: number,
): AttendanceQrVerifyFailure | null {
  const t = decodeAttendanceQrToken(rawToken)
  if (!t) return 'TOKEN_MALFORMED'
  if (t.classId !== classId) return 'TOKEN_CLASS_MISMATCH'
  if (nowMs > t.exp) return 'TOKEN_EXPIRED'
  const expected = createHmac('sha256', qrSecret).update(`${t.classId}|${t.exp}`).digest('hex')
  if (!secretsEqual(expected, t.sig)) return 'TOKEN_SIGNATURE_INVALID'
  return null
}

/** CSV 单元格转义:先用仓内单源的公式注入防护(sanitizeCsvCell),再处理逗号/引号/换行。 */
function toCsvCell(value: unknown): string {
  const raw = value === null || value === undefined ? '' : String(value)
  const safe = sanitizeCsvCell(raw)
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

/** edu_attendance_record 的行形态(随表定义走,不在端点里各抄一份字段清单)。 */
type AttendanceRow = typeof eduAttendanceRecord.$inferSelect

/** 导出行的形态 = 共享出口 paginate 的返回元素类型;本票不另抄一份列清单,也不为此改 paginate 签名。 */
type AttendanceExportRow = Awaited<ReturnType<typeof paginate>>['list'][number]

/** 时间列 → ISO 8601:paginate 的行类型到 unknown 为止,故这里按运行时形态判,不做断言。 */
function toIsoCell(value: unknown): string {
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'string' && value.length > 0) return new Date(value).toISOString()
  return ''
}

/** 扫码 token 四类失败的措辞单点表(状态码在端点、措辞在这里,两条端点不再各写一份)。 */
const ATT_QR_FAILURE_MESSAGES: Record<AttendanceQrVerifyFailure, string> = {
  TOKEN_MALFORMED: '二维码内容不合法',
  TOKEN_CLASS_MISMATCH: '二维码与所选班级不匹配',
  TOKEN_EXPIRED: '二维码已过期,请让老师重新出示',
  TOKEN_SIGNATURE_INVALID: '二维码签名校验失败',
}

/** 学生侧签到的三类失败(与 HTTP 码解耦:同一 reason 在自签与扫码两条端点上落同一状态码)。 */
type StudentCheckInFailure = 'not_enrolled' | 'duplicate' | 'failed'

/**
 * 学生侧签到的共用落库出口(自签 / 扫码同一条链,动作只有一份实现):
 *   ① 在册校验:与批量点名、缺勤补录 job **同一口径**(eduEnrollment.status='enrolled' ∧ 未软删),
 *      退学/毕业的人不能自签进本班名册 ⇒ 不在册即失败(承载层回 403);
 *   ② 当日已有未软删记录 ⇒ 失败(duplicate),**不静默覆盖**已存在的行;
 *   ③ status 由 `judgeStatus` + 该班 `edu_attendance_rule` 现算,不接受客户端传 status,
 *      本函数也不复算阈值(§0.6:判据单源,第二份必然漂移)。
 */
async function checkInByStudent(params: {
  studentId: string
  classId: string
  date: string
  checkInMethod: 'self' | 'qrcode'
  operatedBy: string
  remark?: string | undefined
}): Promise<{ ok: true; record: AttendanceRow } | { ok: false; reason: StudentCheckInFailure }> {
  const { studentId, classId, date, checkInMethod, operatedBy, remark } = params

  const [enrollment] = await db
    .select({ id: eduEnrollment.id })
    .from(eduEnrollment)
    .where(
      and(
        eq(eduEnrollment.studentId, studentId),
        eq(eduEnrollment.classId, classId),
        eq(eduEnrollment.status, 'enrolled'),
        isNull(eduEnrollment.deletedAt),
      ),
    )
    .limit(1)
  if (!enrollment) return { ok: false, reason: 'not_enrolled' }

  const rule = await loadEnabledAttendanceRule(classId)
  const now = new Date()
  const status = judgeStatus({
    lateAfter: rule?.lateAfter ?? null,
    earlyBefore: rule?.earlyBefore ?? null,
    checkInTime: now,
    checkOutTime: null,
  })

  try {
    const txResult = await db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(eduAttendanceRecord)
        .where(
          and(
            eq(eduAttendanceRecord.studentId, studentId),
            eq(eduAttendanceRecord.classId, classId),
            eq(eduAttendanceRecord.date, date),
            isNull(eduAttendanceRecord.deletedAt),
          ),
        )
        .limit(1)
      if (existing) return { state: 'duplicate' as const }
      const inserted = await tx
        .insert(eduAttendanceRecord)
        .values({
          studentId,
          classId,
          date,
          checkInTime: now,
          status,
          checkInMethod,
          // operatedBy 显式写登录态本人:归属由承载层入参给(AGENTS §5),
          // 与教师代签(operatedBy=教师)落在同一列上,事后追责读这一列即可。
          operatedBy,
          remark,
        })
        .onConflictDoNothing()
        .returning()
      return { state: 'inserted' as const, rows: inserted }
    })
    if (txResult.state === 'duplicate') return { ok: false, reason: 'duplicate' }
    const record = txResult.rows[0]
    if (!record) return { ok: false, reason: 'failed' }
    return { ok: true, record }
  } catch (_err) {
    return { ok: false, reason: 'failed' }
  }
}

/** 学生侧签到失败 → HTTP 三态(403 不在册 / 409 已存在 / 500 落库失败)。 */
function studentCheckInFailureReply(
  reply: FastifyReply,
  reason: StudentCheckInFailure,
): FastifyReply {
  if (reason === 'not_enrolled') return reply.status(403).send(error(403, '该账号不是本班在册学生'))
  if (reason === 'duplicate') return reply.status(409).send(error(409, '今日已有考勤记录'))
  return reply.status(500).send(error(500, '签到失败'))
}

// =============================================================================
// 路由
// =============================================================================

// 2026-08-30 安全加固:GET 端点统一补充 requireAdmin 鉴权(此前仅写操作有鉴权,
// 存在越权读取风险);/parent/* 家长端端点保留原有"登录 + 绑定校验"鉴权不变。

const eduAiManagementRoutes: FastifyPluginAsync = async (server) => {
  // ===========================================================================
  // 1. 学期管理 CRUD
  // ===========================================================================

  server.get('/term', async (request, reply) => {
    await requireEduView(request, reply)
    if (reply.sent) return
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
    await requireEduView(request, reply)
    if (reply.sent) return
    const parsed = uuidParamSchema.safeParse(request.params)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [row] = await db.select().from(eduTerm).where(eq(eduTerm.id, parsed.data.id)).limit(1)
    if (!row) return reply.status(404).send(error(404, '学期不存在'))
    return reply.send(success({ term: row }))
  })

  server.post('/term', async (request, reply) => {
    await requireEduManage(request, reply)
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
    await requireEduManage(request, reply)
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
    await requireEduManage(request, reply)
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
    const removed = await db
      .delete(eduTerm)
      .where(eq(eduTerm.id, parsed.data.id))
      .returning({ id: eduTerm.id })
    return reply.send(success({ deleted: removed.length > 0 }))
  })

  // ===========================================================================
  // 2. 班级管理 CRUD
  // ===========================================================================

  server.get('/class', async (request, reply) => {
    await requireEduView(request, reply)
    if (reply.sent) return
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
    await requireEduView(request, reply)
    if (reply.sent) return
    const parsed = uuidParamSchema.safeParse(request.params)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [row] = await db.select().from(eduClass).where(eq(eduClass.id, parsed.data.id)).limit(1)
    if (!row) return reply.status(404).send(error(404, '班级不存在'))
    return reply.send(success({ class: row }))
  })

  server.post('/class', async (request, reply) => {
    await requireEduManage(request, reply)
    if (reply.sent) return
    const parsed = createClassSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [row] = await db.insert(eduClass).values(parsed.data).returning()
    return reply.status(201).send(success({ class: row }))
  })

  server.put('/class/:id', async (request, reply) => {
    await requireEduManage(request, reply)
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
    await requireEduManage(request, reply)
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
    const removed = await db
      .delete(eduClass)
      .where(eq(eduClass.id, parsed.data.id))
      .returning({ id: eduClass.id })
    return reply.send(success({ deleted: removed.length > 0 }))
  })

  // ===========================================================================
  // 3. 课程条目 CRUD
  // ===========================================================================

  server.get('/schedule', async (request, reply) => {
    await requireEduView(request, reply)
    if (reply.sent) return
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
    await requireEduView(request, reply)
    if (reply.sent) return
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
    await requireEduManage(request, reply)
    if (reply.sent) return
    const parsed = createScheduleSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [row] = await db.insert(eduCourseSchedule).values(parsed.data).returning()
    return reply.status(201).send(success({ schedule: row }))
  })

  server.put('/schedule/:id', async (request, reply) => {
    await requireEduManage(request, reply)
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
    await requireEduManage(request, reply)
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
    const removed = await db
      .update(eduCourseSchedule)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(eduCourseSchedule.id, parsed.data.id))
      .returning({ id: eduCourseSchedule.id })
    return reply.send(success({ deleted: removed.length > 0 }))
  })

  // ===========================================================================
  // 3b. 课程表新增功能：复制上周 / 教师冲突检测 / 导出
  // ===========================================================================

  server.post('/schedule/copy-last-week', async (request, reply) => {
    await requireEduManage(request, reply)
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
    // 2026-08-30 安全加固:排课冲突检测属教务管理功能,补 requireEduManage 守卫(历史遗留无鉴权)
    await requireEduManage(request, reply)
    if (reply.sent) return
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
    await requireEduView(request, reply)
    if (reply.sent) return
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
    await requireEduView(request, reply)
    if (reply.sent) return
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
    await requireEduView(request, reply)
    if (reply.sent) return
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
    await requireEduManage(request, reply)
    if (reply.sent) return
    const parsed = createMealSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [row] = await db.insert(eduMealRecipe).values(parsed.data).returning()
    return reply.status(201).send(success({ meal: row }))
  })

  server.put('/meal/:id', async (request, reply) => {
    await requireEduManage(request, reply)
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
    await requireEduManage(request, reply)
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
    const removed = await db
      .update(eduMealRecipe)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(eduMealRecipe.id, parsed.data.id))
      .returning({ id: eduMealRecipe.id })
    return reply.send(success({ deleted: removed.length > 0 }))
  })

  // ===========================================================================
  // 5. 周菜谱模板 CRUD + 应用模板
  // ===========================================================================

  server.get('/meal/template', async (request, reply) => {
    await requireEduView(request, reply)
    if (reply.sent) return
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
    await requireEduView(request, reply)
    if (reply.sent) return
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
    await requireEduManage(request, reply)
    if (reply.sent) return
    const parsed = createTemplateSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [row] = await db.insert(eduMealWeekTemplate).values(parsed.data).returning()
    return reply.status(201).send(success({ template: row }))
  })

  server.put('/meal/template/:id', async (request, reply) => {
    await requireEduManage(request, reply)
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
    await requireEduManage(request, reply)
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
    const removed = await db
      .delete(eduMealWeekTemplate)
      .where(eq(eduMealWeekTemplate.id, parsed.data.id))
      .returning({ id: eduMealWeekTemplate.id })
    return reply.send(success({ deleted: removed.length > 0 }))
  })

  // 应用模板到指定周
  server.post('/meal/apply-template', async (request, reply) => {
    await requireEduManage(request, reply)
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
  server.get('/meal/template-names', async (request, reply) => {
    await requireEduView(request, reply)
    if (reply.sent) return
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
    await requireEduView(request, reply)
    if (reply.sent) return
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
    // 2026-08-30 安全加固:生成购物清单属教务管理功能,补 requireEduManage 守卫(历史遗留无鉴权)
    await requireEduManage(request, reply)
    if (reply.sent) return
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
    await requireEduManage(request, reply)
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
    await requireEduView(request, reply)
    if (reply.sent) return
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
    await requireEduView(request, reply)
    if (reply.sent) return
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
    await requireEduManage(request, reply)
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
    await requireEduManage(request, reply)
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
    await requireEduManage(request, reply)
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
    const removed = await db
      .update(eduStudyPlan)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(eduStudyPlan.id, parsed.data.id))
      .returning({ id: eduStudyPlan.id })
    return reply.send(success({ deleted: removed.length > 0 }))
  })

  // 月计划自动拆解为周计划
  server.post('/study-plan/:id/auto-split', async (request, reply) => {
    await requireEduManage(request, reply)
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
    await requireEduView(request, reply)
    if (reply.sent) return
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
    await requireEduManage(request, reply)
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
    // 2026-08-30 安全加固:学习计划项写操作,补 requireEduManage 守卫(历史遗留无鉴权)
    await requireEduManage(request, reply)
    if (reply.sent) return
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
    // 2026-08-30 安全加固:学习计划项删除,补 requireEduManage 守卫(历史遗留无鉴权)
    await requireEduManage(request, reply)
    if (reply.sent) return
    const idParsed = uuidParamSchema.safeParse(request.params)
    if (!idParsed.success)
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    const [existing] = await db
      .select()
      .from(eduPlanItem)
      .where(and(eq(eduPlanItem.id, idParsed.data.id), isNull(eduPlanItem.deletedAt)))
      .limit(1)
    if (!existing) return reply.status(404).send(error(404, '条目不存在'))
    const removed = await db
      .update(eduPlanItem)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(eduPlanItem.id, idParsed.data.id))
      .returning({ id: eduPlanItem.id })
    return reply.send(success({ deleted: removed.length > 0 }))
  })

  // ===========================================================================
  // 6b. 学习计划新增功能：完成率统计 / 进度时间线 / 教师审核备注
  // ===========================================================================

  server.get('/study-plan/completion-stats', async (request, reply) => {
    await requireEduView(request, reply)
    if (reply.sent) return
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
    await requireEduView(request, reply)
    if (reply.sent) return
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
    await requireEduManage(request, reply)
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
    await requireEduView(request, reply)
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
    await requireEduView(request, reply)
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
    // 2026-08-30 教师角色 RBAC 接入:该端点仅教务管理页调用(签到操作),补上权限守卫
    await requireEduManage(request, reply)
    if (reply.sent) return
    const parsed = checkInSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))

    const now = new Date()
    // 缺省日期改走 bizDayKey(与批量点名/自签同一上海业务日口径;此前用 UTC 日键,
    // 上海 00:00–08:00 之间会把"今天"错认成昨天,守门 246 单源要求)
    const date = parsed.data.date || bizDayKey(now)

    // status 服务端现算(本票①):judgeStatus + 该班规则,不接受客户端自报;
    // checkInTime 与 date 强制同日,回填历史日必须显式带该日内时刻。
    const resolved = await resolveTeacherCheckIn({
      classId: parsed.data.classId,
      date,
      checkInTimeRaw: parsed.data.checkInTime,
      now,
    })
    if (!resolved.ok) return reply.status(400).send(error(400, resolved.message))

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
            checkInTime: resolved.checkInTime,
            // 人脸档(checkInMethod='face')本票裁决**明确不做**,也不建空壳端点:
            // 本仓当前既没有人脸特征库/1:N 比对服务,也没有活体检测与摄像头推流链路 ——
            // 先摆一个 `/attendance/face-check-in` 只会产出"接口在、判定是假的"的虚假安全感,
            // 而考勤是要落到免责链条上的记录。等真有比对服务时,应作为 checkInMethod 的新档位
            // 接进本端点(载体的列已存在),而不是另立一条无人守的入口。
            status: resolved.status,
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
    // 2026-08-30 教师角色 RBAC 接入:该端点仅教务管理页调用(签退操作),补上权限守卫
    await requireEduManage(request, reply)
    if (reply.sent) return
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

        // 本票②:签退后以 judgeStatus + 该班规则重判 status,early 自此有了唯一写入路径。
        // 优先级保护:leave/absent 是审批联动与补录写入的高优先态,重判不得洗成 present/early。
        // 判据零内联(§0.6):阈值比较只在 judgeStatus 里,这里只决定"要不要问它"。
        const checkOutTime = new Date()
        let nextStatus = existing.status
        if (!statusPreservedOnCheckOut(existing.status)) {
          const rule = await loadEnabledAttendanceRule(parsed.data.classId)
          nextStatus = judgeStatus({
            lateAfter: rule?.lateAfter ?? null,
            earlyBefore: rule?.earlyBefore ?? null,
            checkInTime: existing.checkInTime,
            checkOutTime,
          })
        }

        return tx
          .update(eduAttendanceRecord)
          .set({
            checkOutTime,
            checkOutMethod: parsed.data.checkOutMethod || 'manual',
            status: nextStatus,
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

  // -------------------------------------------------------------------------
  // 8b. 批量点名(2026-11-08,ATT-API 票)
  //     名单唯一来源 = 该班在册学生;不接受客户端自报 studentIds。
  //     计数诚实性(blocking 门 134):created/skipped/missedIds 三个数全部来自
  //     `.returning()` 回库确认集与库确认的"已有记录集",没有一个来自请求侧 length。
  // -------------------------------------------------------------------------
  server.post('/attendance/batch-check-in', async (request, reply) => {
    await requireEduManage(request, reply)
    if (reply.sent) return
    const parsed = batchCheckInSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))

    const classId = parsed.data.classId
    const now = new Date()
    const date = parsed.data.date ?? bizDayKey(now)
    // 本票③:与教师代签同口径 —— status 服务端现算(judgeStatus + 该班规则),
    // 入参 schema 已删 status;zod strip 后客户端自报值结构上进不了库。
    const resolved = await resolveTeacherCheckIn({
      classId,
      date,
      checkInTimeRaw: parsed.data.checkInTime,
      now,
    })
    if (!resolved.ok) return reply.status(400).send(error(400, resolved.message))
    const status = resolved.status

    const outcome = await db.transaction(async (tx) => {
      // 在册口径**复用**缺勤补录 job 已登记的那一条(eduEnrollment.status='enrolled' ∧ 未软删),
      // 本文件不另定义"什么算在册"(§0.6;出处 services/edu-attendance-absent-job.ts 头注「在册口径」段)。
      const enrolled = await tx
        .select({ studentId: eduEnrollment.studentId })
        .from(eduEnrollment)
        .where(
          and(
            eq(eduEnrollment.classId, classId),
            eq(eduEnrollment.status, 'enrolled'),
            isNull(eduEnrollment.deletedAt),
          ),
        )
      const studentIds = Array.from(new Set(enrolled.map((r) => r.studentId)))
      if (studentIds.length === 0)
        return { roster: 0, created: 0, skipped: 0, missedIds: [] as string[] }

      // 当日已有未软删记录的学生:跳过集取自库确认查询,不是"请求数减插入数"倒推出来的
      const existing = await tx
        .select({ studentId: eduAttendanceRecord.studentId })
        .from(eduAttendanceRecord)
        .where(
          and(
            eq(eduAttendanceRecord.classId, classId),
            eq(eduAttendanceRecord.date, date),
            inArray(eduAttendanceRecord.studentId, studentIds),
            isNull(eduAttendanceRecord.deletedAt),
          ),
        )
      const existingSet = new Set(existing.map((r) => r.studentId))
      const pending = studentIds.filter((id) => !existingSet.has(id))
      if (pending.length === 0)
        return {
          roster: studentIds.length,
          created: 0,
          skipped: existingSet.size,
          missedIds: [] as string[],
        }

      // onConflictDoNothing 的兜底前提是 ATT-DB 席新增的 (student_id,class_id,date)
      // WHERE deleted_at IS NULL 部分唯一索引;预筛只挡串行读,并发同键撞索引时靠它消解。
      const inserted = await tx
        .insert(eduAttendanceRecord)
        .values(
          pending.map((studentId) => ({
            studentId,
            classId,
            date,
            checkInTime: resolved.checkInTime,
            status,
            checkInMethod: 'manual',
            operatedBy: request.userId,
            remark: parsed.data.remark,
          })),
        )
        .onConflictDoNothing()
        .returning({ id: eduAttendanceRecord.id, studentId: eduAttendanceRecord.studentId })

      const landed = new Set(inserted.map((r) => r.studentId))
      // missedIds = 应写而未落库的学生(并发下同键已被他人写入是正常来源);点名到学生,不报总数了事。
      const missedIds = pending.filter((id) => !landed.has(id))
      return {
        roster: studentIds.length,
        created: inserted.length,
        skipped: existingSet.size + missedIds.length,
        missedIds,
      }
    })

    if (outcome.roster === 0)
      return reply.status(400).send(error(400, '该班暂无在册学生,批量点名无对象'))
    return reply.send(
      success({
        classId,
        date,
        status,
        roster: outcome.roster,
        created: outcome.created,
        skipped: outcome.skipped,
        missedIds: outcome.missedIds,
      }),
    )
  })

  // -------------------------------------------------------------------------
  // 8c. 考勤导出 CSV(2026-11-08,ATT-API 票)
  //     形态对齐本文件既有 /schedule/export(同一 query 三件套 + 只读守卫),
  //     但响应是 text/csv:导出要的是"拿去就能开",不是再包一层 { code, data }。
  // -------------------------------------------------------------------------
  server.get('/attendance/export', async (request, reply) => {
    await requireEduView(request, reply)
    if (reply.sent) return
    const parsed = attendanceExportQuerySchema.safeParse(request.query)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const { classId, startDate, endDate } = parsed.data

    const where = and(
      isNull(eduAttendanceRecord.deletedAt),
      eq(eduAttendanceRecord.classId, classId),
      between(eduAttendanceRecord.date, startDate, endDate),
    )

    // **分页取全量必须循环到 totalPages**:现读 paginate(本文件 paginate())是 offset/limit 实现,
    // 一次只回一页 ⇒ 只调一次 = "导出成功"而文件里只有第一页。排序键带 id 末位保证翻页不重不漏。
    const EXPORT_PAGE_SIZE = 100
    const EXPORT_MAX_ROWS = 100_000
    // 行形态取 paginate 的返回元素类型:该共享出口内部是 `db.select().from(AnyPgTable)`,
    // 行类型只能到 `{[x:string]: unknown}`。本票不为此改 paginate 签名(它被约 30 个端点共用,
    // 收窄签名属另一张票),故导出侧一律经 toCsvCell/fmtIso 两个 unknown 入口出单元格。
    const rows: AttendanceExportRow[] = []
    let page = 1
    let total = 0
    for (;;) {
      const result = await paginate(
        eduAttendanceRecord,
        where,
        [
          asc(eduAttendanceRecord.date),
          asc(eduAttendanceRecord.studentId),
          asc(eduAttendanceRecord.id),
        ],
        page,
        EXPORT_PAGE_SIZE,
      )
      rows.push(...result.list)
      total = result.total
      if (page >= result.totalPages) break
      page += 1
      if (rows.length > EXPORT_MAX_ROWS)
        return reply
          .status(400)
          .send(error(400, `导出行数超过 ${EXPORT_MAX_ROWS},请缩小日期范围或按班分批`))
    }

    const header = ['学生ID', '日期', '状态', '签到时间', '签退时间', '签到方式', '备注']
    const lines = [header.map(toCsvCell).join(',')]
    for (const r of rows) {
      // 时间列写 ISO 8601(UTC):导出是数据交换格式而非 UI 展示档,
      // 用 Intl 反而把"读的人的时区"钉进文件里,跨机对账会二次错位。
      lines.push(
        [
          r.studentId,
          r.date,
          r.status,
          toIsoCell(r.checkInTime),
          toIsoCell(r.checkOutTime),
          r.checkInMethod,
          r.remark ?? '',
        ]
          .map(toCsvCell)
          .join(','),
      )
    }

    // UTF-8 BOM:无 BOM 时 Excel 按本地 ANSI 码页解 UTF-8 字节,中文列头与备注必乱码
    // (与本仓 admin/export-csv.ts、audit.ts、edu-canteen.ts 的采购单导出同一形态)。
    const csv = '﻿' + lines.join('\r\n')
    reply.header('Content-Type', 'text/csv; charset=utf-8')
    reply.header(
      'Content-Disposition',
      `attachment; filename="attendance-${classId}-${startDate}_${endDate}.csv"`,
    )
    server.log.debug({ classId, startDate, endDate, total, exported: rows.length }, '考勤导出')
    return reply.send(csv)
  })

  // -------------------------------------------------------------------------
  // 8d. 学生自签(2026-11-08,ATT-API 票;同日晚些时候本票②收口班级归属)
  //     登录即可,**不要 edu:manage** —— 这是学生给自己的归属型记录写一行。
  //     身份纪律(AGENTS §5 硬条款):承载层显式取 request.userId,入参不含 studentId/classId,
  //     于是"studentId 只能等于登录态""班级只能由在册关系决定"两条都是结构上成立。
  //     班级判定顺序见 resolveSelfCheckInClassId(当日考勤行 → 最近在册 → 409,无第三步兜底)。
  //     状态判定一律交 judgeStatus + edu_attendance_rule,本端点不内联第二份判据。
  // -------------------------------------------------------------------------
  server.post('/attendance/self-check-in', async (request, reply) => {
    // 承载层出口(§5):鉴权先于一切判据。本插件未挂 preHandler,request.userId 只由
    // checkAuth/authenticate 写;此前端点内手写 `if (!userId) 401` ⇒ 每条真实请求恒 401。
    const authed = await checkAuthOrInternalService(request, reply)
    if (!authed) return
    const userId = request.userId!
    const parsed = selfCheckInSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))

    const date = parsed.data.date ?? bizDayKey(new Date())
    // 客户端硬塞的 classId 已被 schema strip;生效班级只认服务端现取结果(本票②)。
    const classId = await resolveSelfCheckInClassId(userId, date)
    if (!classId)
      return reply
        .status(409)
        .send(error(409, '未找到在读班级:当日无考勤记录,也没有在册(enrolled)报名'))

    const result = await checkInByStudent({
      studentId: userId,
      classId,
      date,
      checkInMethod: 'self',
      operatedBy: userId,
      remark: parsed.data.remark,
    })
    if (!result.ok) return studentCheckInFailureReply(reply, result.reason)
    return reply.status(201).send(
      success({
        // 回显最终生效的班级与判定结果,学生端"签到到了哪个班"直接可显示(本票②契约)
        classId: result.record.classId,
        status: result.record.status,
        checkInTime: result.record.checkInTime,
        record: result.record,
        // 判定来源如实点名:status 不是客户端传的,是规则 + judgeStatus 算出来的
        judgedBy: 'edu_attendance_rule.judgeStatus',
      }),
    )
  })

  // -------------------------------------------------------------------------
  // 8d-b. 学生本人考勤查询(2026-11-03)
  //       三端「我的考勤」此前借道 /parent/children/:childId/attendance 取数,
  //       而那条走的是 edu_parent_student_binding 家长口径 ⇒ 学生查自己不成立。
  //       本端点主体只从承载层取(studentId = request.userId),入参不含 studentId;
  //       返回形态与 /parent/children/:childId/attendance 严格一致({ list }),前端三端已按此取数。
  // -------------------------------------------------------------------------
  server.get('/attendance/me', async (request, reply) => {
    // 承载层出口(§5):身份只由 checkAuthOrInternalService 注入,拿不到即回 401 并终止。
    const authed = await checkAuthOrInternalService(request, reply)
    if (!authed) return
    const studentId = request.userId!
    const parsed = myAttendanceQuerySchema.safeParse(request.query)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))

    const conds: SQL[] = [
      eq(eduAttendanceRecord.studentId, studentId),
      isNull(eduAttendanceRecord.deletedAt),
    ]
    if (parsed.data.date) conds.push(eq(eduAttendanceRecord.date, parsed.data.date))
    if (parsed.data.startDate && parsed.data.endDate) {
      conds.push(between(eduAttendanceRecord.date, parsed.data.startDate, parsed.data.endDate))
    } else if (parsed.data.startDate) {
      conds.push(gte(eduAttendanceRecord.date, parsed.data.startDate))
    } else if (parsed.data.endDate) {
      conds.push(lte(eduAttendanceRecord.date, parsed.data.endDate))
    }
    const list = await db
      .select()
      .from(eduAttendanceRecord)
      .where(and(...conds))
      .orderBy(desc(eduAttendanceRecord.date))
    return reply.send(success({ list }))
  })

  // -------------------------------------------------------------------------
  // 8e. 扫码签到两档(2026-11-08,ATT-API 票)
  //     GET /attendance/qrcode      教师出码(requireEduManage):载荷 = classId + 短期 HMAC token + 有效期,
  //                                **绝不含 qrSecret 原文**(它只做 HMAC 的 key)。
  //     POST /attendance/qrcode-check-in  学生扫码签到:校验签名与有效期后按规则落库。
  // -------------------------------------------------------------------------
  server.get('/attendance/qrcode', async (request, reply) => {
    await requireEduManage(request, reply)
    if (reply.sent) return
    const parsed = attendanceQrCodeQuerySchema.safeParse(request.query)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))

    const rule = await loadEnabledAttendanceRule(parsed.data.classId)
    if (!rule?.qrSecret)
      return reply
        .status(400)
        .send(error(400, '该班未配置启用中的考勤规则或未设置扫码密钥(qrSecret)'))

    const { token, expiresAtMs } = buildAttendanceQrToken(
      parsed.data.classId,
      rule.qrSecret,
      Date.now(),
      ATT_QR_TOKEN_TTL_MS,
    )
    const payload = JSON.stringify({
      type: 'edu-attendance-checkin',
      version: 1,
      classId: parsed.data.classId,
      token,
      expiresAt: new Date(expiresAtMs).toISOString(),
    })
    return reply.send(
      success({
        payload,
        classId: parsed.data.classId,
        expiresAt: new Date(expiresAtMs).toISOString(),
        ttlMs: ATT_QR_TOKEN_TTL_MS,
      }),
    )
  })

  server.post('/attendance/qrcode-check-in', async (request, reply) => {
    // 承载层出口(§5):同 self-check-in,鉴权先于判据;身份只认承载层注入的 request.userId。
    const authed = await checkAuthOrInternalService(request, reply)
    if (!authed) return
    const userId = request.userId!
    const parsed = qrcodeCheckInSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))

    // 本票②:classId 不再由客户端自报 —— 它包含在教师端出码的 HMAC 载荷里,
    // 从 token 解出后用该班规则密钥核验签名与 TTL(签名覆盖 classId|exp,伪造换班即签名失败)。
    const decoded = decodeAttendanceQrToken(parsed.data.token)
    if (!decoded) return reply.status(403).send(error(403, ATT_QR_FAILURE_MESSAGES.TOKEN_MALFORMED))

    const rule = await loadEnabledAttendanceRule(decoded.classId)
    if (!rule?.qrSecret)
      return reply.status(400).send(error(400, '该班未配置扫码签到密钥(qrSecret)'))

    const failure = verifyAttendanceQrToken(
      parsed.data.token,
      decoded.classId,
      rule.qrSecret,
      Date.now(),
    )
    if (failure) return reply.status(403).send(error(403, ATT_QR_FAILURE_MESSAGES[failure]))

    const date = bizDayKey(new Date())
    const result = await checkInByStudent({
      studentId: userId,
      classId: decoded.classId,
      date,
      checkInMethod: 'qrcode',
      operatedBy: userId,
    })
    if (!result.ok) return studentCheckInFailureReply(reply, result.reason)
    return reply.status(201).send(
      success({
        // 与自签同形:回显最终生效班级,端上能显示签到到了哪个班(本票②契约)
        classId: result.record.classId,
        status: result.record.status,
        checkInTime: result.record.checkInTime,
        record: result.record,
        judgedBy: 'edu_attendance_rule.judgeStatus',
      }),
    )
  })

  // -------------------------------------------------------------------------
  // 8f. 考勤规则配置入口(2026-11-08,本票①)
  //     此前全仓没有任何端点能写 edu_attendance_rule ⇒ qrSecret 恒空,
  //     扫码签到结构上不可用、迟到阈值也无据可判;这三条端点就是那格缺口。
  //     出参一律走 toAttendanceRuleDto 投影:qrSecret 原文绝不出仓,responsibility 见该函数头注。
  //     阈值归一化只用 edu-schedule-conflict.normalizeHm 单源,非法值 400 点名原值、不回落。
  // -------------------------------------------------------------------------
  server.get('/attendance/rule', async (request, reply) => {
    await requireEduView(request, reply)
    if (reply.sent) return
    const parsed = attendanceRuleQuerySchema.safeParse(request.query)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))

    const [row] = await db
      .select()
      .from(eduAttendanceRule)
      .where(
        and(
          eq(eduAttendanceRule.classId, parsed.data.classId),
          isNull(eduAttendanceRule.deletedAt),
        ),
      )
      .limit(1)
    return reply.send(success({ rule: toAttendanceRuleDto(row ?? null) }))
  })

  server.put('/attendance/rule', async (request, reply) => {
    await requireEduManage(request, reply)
    if (reply.sent) return
    const parsed = attendanceRuleUpsertSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))

    const { classId, enabled } = parsed.data
    const thresholds: { lateAfter?: string; earlyBefore?: string; absentAfter?: string } = {}
    for (const field of ['lateAfter', 'earlyBefore', 'absentAfter'] as const) {
      const raw = parsed.data[field]
      if (raw === undefined) continue
      const hm = normalizeHm(raw)
      if (hm === null)
        return reply
          .status(400)
          .send(error(400, `时间格式非法:${field}="${raw}"(必须可归一化为 HH:MM)`))
      thresholds[field] = hm
    }

    // upsert 按 classId(unique)幂等(本仓幂等铁律 onConflictDoUpdate);冲突更新面只写本次给出的字段。
    const [row] = await db
      .insert(eduAttendanceRule)
      .values({ classId, ...thresholds, ...(enabled === undefined ? {} : { enabled }) })
      .onConflictDoUpdate({
        target: eduAttendanceRule.classId,
        set: {
          ...thresholds,
          ...(enabled === undefined ? {} : { enabled }),
          updatedAt: new Date(),
        },
      })
      .returning()
    return reply.send(success({ rule: toAttendanceRuleDto(row ?? null) }))
  })

  server.post('/attendance/rule/rotate-qr-secret', async (request, reply) => {
    await requireEduManage(request, reply)
    if (reply.sent) return
    const parsed = rotateQrSecretSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))

    const secret = randomBytes(32).toString('hex')
    const [updated] = await db
      .update(eduAttendanceRule)
      .set({ qrSecret: secret, updatedAt: new Date() })
      .where(
        and(
          eq(eduAttendanceRule.classId, parsed.data.classId),
          isNull(eduAttendanceRule.deletedAt),
        ),
      )
      .returning()
    if (!updated)
      return reply.status(404).send(error(404, '该班尚无考勤规则,请先 PUT /attendance/rule 建档'))
    // 响应绝不回显密钥原文,只给可核对不可用的指纹(前 6 位)
    return reply.send(success({ rotated: true, fingerprint: secret.slice(0, 6) }))
  })

  server.put('/attendance/:id', async (request, reply) => {
    await requireEduManage(request, reply)
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
    await requireEduManage(request, reply)
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
    const removed = await db
      .update(eduAttendanceRecord)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(eduAttendanceRecord.id, parsed.data.id))
      .returning({ id: eduAttendanceRecord.id })
    return reply.send(success({ deleted: removed.length > 0 }))
  })

  // ===========================================================================
  // 9. 请假申请 CRUD + 审批
  // ===========================================================================

  server.get('/leave', async (request, reply) => {
    await requireEduView(request, reply)
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
    await requireEduManage(request, reply)
    if (reply.sent) return
    const parsed = createLeaveSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [row] = await db.insert(eduLeaveRequest).values(parsed.data).returning()
    return reply.status(201).send(success({ leave: row }))
  })

  server.put('/leave/:id', async (request, reply) => {
    await requireEduManage(request, reply)
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
    await requireEduManage(request, reply)
    if (reply.sent) return
    const idParsed = uuidParamSchema.safeParse(request.params)
    if (!idParsed.success)
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    const parsed = approveLeaveSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))

    // 审批通过 ⇒ 同一事务内把 [startDate, endDate] 逐日幂等写进考勤(status='leave')。
    // 立因:此前"审批只改请假单",考勤表对该生该日要么空着、要么仍是缺勤 ——
    // 于是 GET /attendance/stats 把"批过假的人"计入缺勤,出勤率恒低(2026-11-08 ATT-API 票)。
    // 事务的理由:单已 approved 而考勤没落 = 半状态,重放审批会被"仅待审批可审批"挡死,
    // 那半状态再也修不回来,只能人工改库 ⇒ 两处写必须同批成或同批不成。
    // 不覆盖非 leave 状态:教师已手改过"迟到/已签到"的一天,审批一张假单不该把它抹掉。
    try {
      const result = await db.transaction(async (tx) => {
        const [existing] = await tx
          .select()
          .from(eduLeaveRequest)
          .where(and(eq(eduLeaveRequest.id, idParsed.data.id), isNull(eduLeaveRequest.deletedAt)))
          .limit(1)
        if (!existing) return { kind: 'not_found' as const }
        if (existing.status !== 'pending') return { kind: 'not_pending' as const }

        const [row] = await tx
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
        // 库确认:更新链必须回读,拿不到行 ⇒ 记录已不在(并发软删),不能回 200
        if (!row) return { kind: 'not_found' as const }

        const attendanceSynced = { created: 0, updated: 0, skipped: 0 }
        if (parsed.data.status === 'approved') {
          const days = enumerateAttendanceDates(existing.startDate, existing.endDate)
          for (const day of days) {
            const [cur] = await tx
              .select()
              .from(eduAttendanceRecord)
              .where(
                and(
                  eq(eduAttendanceRecord.studentId, existing.studentId),
                  eq(eduAttendanceRecord.classId, existing.classId),
                  eq(eduAttendanceRecord.date, day),
                  isNull(eduAttendanceRecord.deletedAt),
                ),
              )
              .limit(1)
            if (cur && cur.status !== 'leave') {
              attendanceSynced.skipped += 1
              continue
            }
            const syncedRemark = `请假审批联动 · 请假单 ${existing.id}`
            if (cur) {
              // 原本就是 leave 行 ⇒ 幂等刷新 operatedBy/remark(上一轮审批人不同时留下最新一次)
              const updated = await tx
                .update(eduAttendanceRecord)
                .set({
                  status: 'leave',
                  operatedBy: request.userId,
                  remark: syncedRemark,
                  updatedAt: new Date(),
                })
                .where(
                  and(
                    eq(eduAttendanceRecord.id, cur.id),
                    // 状态前置写进同一把 where:① B4 终态回退要求同列前置(差值棘轮只拦新增);
                    // ② 更要紧的是 select 与 update 之间那一瞬,别席可能已把这行改成"迟到"——
                    //    没有这个前置就会覆盖掉它,而本票的承诺是"非 leave 不覆盖"。
                    eq(eduAttendanceRecord.status, 'leave'),
                  ),
                )
                .returning({ id: eduAttendanceRecord.id })
              if (updated.length === 1) attendanceSynced.updated += 1
              else attendanceSynced.skipped += 1
            } else {
              const created = await tx
                .insert(eduAttendanceRecord)
                .values({
                  studentId: existing.studentId,
                  classId: existing.classId,
                  date: day,
                  status: 'leave',
                  checkInMethod: 'manual',
                  operatedBy: request.userId,
                  remark: syncedRemark,
                })
                .onConflictDoNothing()
                .returning({ id: eduAttendanceRecord.id })
              if (created.length === 1) attendanceSynced.created += 1
              else attendanceSynced.skipped += 1
            }
          }
        }
        return { kind: 'ok' as const, leave: row, attendanceSynced }
      })

      if (result.kind === 'not_found') return reply.status(404).send(error(404, '请假申请不存在'))
      if (result.kind === 'not_pending')
        return reply.status(400).send(error(400, '仅待审批的申请可审批'))
      return reply.send(success({ leave: result.leave, attendanceSynced: result.attendanceSynced }))
    } catch (err: unknown) {
      if ((err as { message?: string }).message === 'LEAVE_RANGE_TOO_WIDE')
        return reply.status(400).send(error(400, '请假日期跨度过大,请拆分后重新申请'))
      return reply.status(500).send(error(500, '审批失败'))
    }
  })

  server.delete('/leave/:id', async (request, reply) => {
    await requireEduManage(request, reply)
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
    const removed = await db
      .update(eduLeaveRequest)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(eduLeaveRequest.id, parsed.data.id))
      .returning({ id: eduLeaveRequest.id })
    return reply.send(success({ deleted: removed.length > 0 }))
  })

  // ===========================================================================
  // 10. 家长-学生绑定管理
  // ===========================================================================

  // 获取当前用户的绑定列表（家长视角：查看绑定的孩子；学生视角：查看绑定的家长）
  server.get('/parent/binding', async (request, reply) => {
    // 承载层出口(§5):本插件未挂 preHandler ⇒ 此前手写 `if (!userId) 401` 恒命中。
    // 绑定行含双方 UUID 与关系字段,属私有数据,不在任何游客/公开白名单内。
    const authed = await checkAuthOrInternalService(request, reply)
    if (!authed) return
    const parsed = bindingListQuerySchema.safeParse(request.query)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const userId = request.userId!

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
    // 承载层出口(§5):parentId 只从登录态取,不接受客户端自报(AGENTS §5 不得信客户端)。
    const authed = await checkAuthOrInternalService(request, reply)
    if (!authed) return
    const parsed = createBindingSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const userId = request.userId!

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
    // 承载层出口(§5):鉴权先于形状闸;下方「仅学生本人可确认绑定」的归属校验保留。
    const authed = await checkAuthOrInternalService(request, reply)
    if (!authed) return
    const idParsed = uuidParamSchema.safeParse(request.params)
    if (!idParsed.success)
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    const parsed = updateBindingSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const userId = request.userId!

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
    // 承载层出口(§5);下方「仅绑定双方可解除」的归属校验保留(鉴权≠授权)。
    const authed = await checkAuthOrInternalService(request, reply)
    if (!authed) return
    const idParsed = uuidParamSchema.safeParse(request.params)
    if (!idParsed.success)
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    const userId = request.userId!

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

    const removed = await db
      .update(eduParentStudentBinding)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(eduParentStudentBinding.id, idParsed.data.id))
      .returning({ id: eduParentStudentBinding.id })
    return reply.send(success({ deleted: removed.length > 0 }))
  })

  // 获取家长绑定的所有孩子列表（含孩子基本信息）
  server.get('/parent/children', async (request, reply) => {
    // 承载层出口(§5):孩子名单是本人绑定集,私有数据;身份只从 request.userId 取。
    const authed = await checkAuthOrInternalService(request, reply)
    if (!authed) return
    const userId = request.userId!

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
    // 承载层出口(§5):鉴权先于形状闸;下方 confirmed 绑定校验保留(鉴权≠授权)。
    const authed = await checkAuthOrInternalService(request, reply)
    if (!authed) return
    const idParsed = uuidParamSchema.safeParse(request.params)
    if (!idParsed.success)
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    const parsed = childAttendanceQuerySchema.safeParse(request.query)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const userId = request.userId!

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
    // 承载层出口(§5):鉴权先于形状闸;下方 confirmed 绑定校验保留(鉴权≠授权)。
    const authed = await checkAuthOrInternalService(request, reply)
    if (!authed) return
    const idParsed = uuidParamSchema.safeParse(request.params)
    if (!idParsed.success)
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    const userId = request.userId!

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
    // 承载层出口(§5):鉴权先于形状闸;下方 confirmed 绑定校验保留(鉴权≠授权)。
    const authed = await checkAuthOrInternalService(request, reply)
    if (!authed) return
    const idParsed = uuidParamSchema.safeParse(request.params)
    if (!idParsed.success)
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    const userId = request.userId!

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
    // 承载层出口(§5):鉴权先于形状闸;下方 confirmed 绑定校验保留(鉴权≠授权)。
    const authed = await checkAuthOrInternalService(request, reply)
    if (!authed) return
    const idParsed = uuidParamSchema.safeParse(request.params)
    if (!idParsed.success)
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    const userId = request.userId!

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
    // 承载层出口(§5):菜谱本身是学校通用数据,但本端点仍先验绑定,不做匿名可见。
    const authed = await checkAuthOrInternalService(request, reply)
    if (!authed) return
    const idParsed = uuidParamSchema.safeParse(request.params)
    if (!idParsed.success)
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    const userId = request.userId!

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
    // 承载层出口(§5):鉴权先于形状闸;下方 confirmed 绑定校验保留(鉴权≠授权)。
    const authed = await checkAuthOrInternalService(request, reply)
    if (!authed) return
    const childId = (request.params as { childId: string }).childId
    if (!childId) return reply.status(400).send(error(400, '无效的孩子ID'))
    const userId = request.userId!

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
    // 承载层出口(§5):鉴权先于形状闸;下方 confirmed 绑定校验保留(鉴权≠授权)。
    const authed = await checkAuthOrInternalService(request, reply)
    if (!authed) return
    const childId = (request.params as { childId: string }).childId
    if (!childId) return reply.status(400).send(error(400, '无效的孩子ID'))
    const userId = request.userId!

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
    // 承载层出口(§5):鉴权先于形状闸;下方 confirmed 绑定校验保留(鉴权≠授权)。
    const authed = await checkAuthOrInternalService(request, reply)
    if (!authed) return
    const childId = (request.params as { childId: string }).childId
    if (!childId) return reply.status(400).send(error(400, '无效的孩子ID'))
    const userId = request.userId!

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
    // 承载层出口(§5):鉴权先于形状闸;下方 confirmed 绑定校验保留(鉴权≠授权)。
    const authed = await checkAuthOrInternalService(request, reply)
    if (!authed) return
    const childId = (request.params as { childId: string }).childId
    if (!childId) return reply.status(400).send(error(400, '无效的孩子ID'))
    // 查询形状闸(2026-11-04 补):此前这条端点**根本没有 query 闸**,传任何 status 都被
    // 静默忽略 ⇒ 客户端以为筛了、服务端按全量回,与同族 GET /parent/child/:id/attendance
    // 的「非法值 400 点名 + 合法值真筛」两张脸对不上。取证(现读 web 家长子页 PageClient 与
    // 小程序/RN 的家长侧取数)⇒ 目前**没有任何调用方发 status**,所以缺的是筛选能力而不是
    // 已发生的静默失效缺陷;能力是否接线归前端票,本票只做"不再静默忽略"这一半。
    // 复用同枚 `childAttendanceQuerySchema` 实例(§0.6:取值表全文件只有一份)。
    const parsed = childAttendanceQuerySchema.safeParse(request.query)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const userId = request.userId!

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

    const conds: SQL[] = [
      eq(eduAttendanceRecord.studentId, childId),
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
    const list = await db
      .select()
      .from(eduAttendanceRecord)
      .where(and(...conds))
      .orderBy(desc(eduAttendanceRecord.date))
    return reply.send(success({ list }))
  })

  // 孩子考试成绩
  /**
   * 家长查看孩子的学费账单(账期 + 欠费 + 到期日)。
   *
   * 立因:催缴通知现在会发给已确认绑定的家长,但家长登录后**没有任何地方**能看到
   * "哪一期、多少、什么时候到期、已交过什么" —— 收到"孩子欠费 800"却无从核对,
   * 等于把一条通知丢进没有落点的通道。
   *
   * 三条口径:
   * 1. 鉴权与同族家长端点同形:childId 必须在**调用者自己**的 confirmed 绑定集里。
   *    绑定不存在一律 403,不回 404 —— "这个孩子不存在"与"不是你的孩子"必须同形,
   *    否则端点自己变成存在性预言机(与 §5"认证不等于授权"那条同族)。
   * 2. 欠费额只由账目出口 loadEnrollmentLedger 给,这里不重算(守门 AR1 也会拦)。
   * 3. 只读:家长侧不得经本端点写缴费(缴费是机构动作,走 POST /payment-record 且需 edu:manage)。
   */
  server.get('/parent/children/:childId/bills', async (request, reply) => {
    // 承载层出口(§5):此前这里是端点手写的 `if (!request.userId) 401`,而该端点
    // 自身没有任何 preHandler ⇒ request.userId 恒空、每条请求都是 401「未登录」,
    // 且身份来源不可变(内部服务通道永远进不来)。与同文件 5578 那处同形归位。
    const authed = await checkAuthOrInternalService(request, reply)
    if (!authed) return
    const userId = request.userId!
    // 参数名是 childId,不是 id:此前套用只认 `id` 键的那把形状闸 ⇒ 每条请求都
    // 400 "expected string, received undefined",整个端点在生产上从未成功过一次。
    const idParsed = childIdParamSchema.safeParse(request.params)
    if (!idParsed.success)
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    const childId = idParsed.data.childId

    const [bound] = await db
      .select({ id: eduParentStudentBinding.id })
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
    if (!bound) return reply.status(403).send(error(403, '无权查看该学员的账单'))

    const enrollments = await db
      .select({
        enrollmentId: eduEnrollment.id,
        classId: eduEnrollment.classId,
        className: eduClass.name,
        termId: eduEnrollment.termId,
        termName: eduTerm.name,
        status: eduEnrollment.status,
        totalFee: eduEnrollment.totalFee,
      })
      .from(eduEnrollment)
      .innerJoin(eduClass, eq(eduEnrollment.classId, eduClass.id))
      .innerJoin(eduTerm, eq(eduEnrollment.termId, eduTerm.id))
      .where(and(eq(eduEnrollment.studentId, childId), isNull(eduEnrollment.deletedAt)))
      .orderBy(eduEnrollment.enrollDate)

    const bills = await Promise.all(
      enrollments.map(async (e) => ({ ...e, ledger: await loadEnrollmentLedger(e.enrollmentId) })),
    )
    return reply.send(success({ childId, bills }))
  })

  server.get('/parent/children/:childId/grades', async (request, reply) => {
    // 承载层出口(§5):鉴权先于形状闸;下方 confirmed 绑定校验保留(鉴权≠授权)。
    const authed = await checkAuthOrInternalService(request, reply)
    if (!authed) return
    const childId = (request.params as { childId: string }).childId
    if (!childId) return reply.status(400).send(error(400, '无效的孩子ID'))
    const userId = request.userId!

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
    await requireEduView(request, reply)
    if (reply.sent) return
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
    await requireEduManage(request, reply)
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
    await requireEduManage(request, reply)
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
    const removed = await db
      .update(eduExamScore)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(eduExamScore.id, idParsed.data.id))
      .returning({ id: eduExamScore.id })
    return reply.send(success({ deleted: removed.length > 0 }))
  })

  // 成绩统计
  server.get('/exam-score/stats', async (request, reply) => {
    await requireEduView(request, reply)
    if (reply.sent) return
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
    await requireEduView(request, reply)
    if (reply.sent) return
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
    await requireEduManage(request, reply)
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
    await requireEduView(request, reply)
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

  // 教师列表(2026-09-17,4-4-13):RBAC teacher 角色 → 排课规则/教师时间表下拉选项
  server.get('/teachers', async (request, reply) => {
    await requireEduView(request, reply)
    if (reply.sent) return
    const list = await db
      .selectDistinct({
        id: users.id,
        name: sql<string>`coalesce(nullif(${users.nickname}, ''), ${users.username})`,
      })
      .from(users)
      .innerJoin(userRoles, eq(userRoles.userId, users.id))
      .innerJoin(roles, eq(roles.id, userRoles.roleId))
      .where(eq(roles.name, 'teacher'))
      .orderBy(sql`2`)
    return reply.send(success({ list }))
  })

  server.post('/teacher-schedule', async (request, reply) => {
    await requireEduManage(request, reply)
    if (reply.sent) return
    const parsed = createTeacherScheduleSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [row] = await db.insert(eduTeacherSchedule).values(parsed.data).returning()
    return reply.status(201).send(success({ teacherSchedule: row }))
  })

  server.put('/teacher-schedule/:id', async (request, reply) => {
    await requireEduManage(request, reply)
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
    await requireEduManage(request, reply)
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
    const removed = await db
      .delete(eduTeacherSchedule)
      .where(eq(eduTeacherSchedule.id, parsed.data.id))
      .returning({ id: eduTeacherSchedule.id })
    return reply.send(success({ deleted: removed.length > 0 }))
  })

  // ===========================================================================
  // 14. 排课规则 CRUD (edu_scheduling_rule)
  // ===========================================================================

  server.get('/scheduling-rule', async (request, reply) => {
    await requireEduView(request, reply)
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
    await requireEduManage(request, reply)
    if (reply.sent) return
    const parsed = createSchedulingRuleSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [row] = await db.insert(eduSchedulingRule).values(parsed.data).returning()
    return reply.status(201).send(success({ schedulingRule: row }))
  })

  server.put('/scheduling-rule/:id', async (request, reply) => {
    await requireEduManage(request, reply)
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
    await requireEduManage(request, reply)
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
    const removed = await db
      .update(eduSchedulingRule)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(eduSchedulingRule.id, parsed.data.id))
      .returning({ id: eduSchedulingRule.id })
    return reply.send(success({ deleted: removed.length > 0 }))
  })

  // ===========================================================================
  // 15. 自动排课 + 冲突检测
  // ===========================================================================

  // 自动排课
  server.post('/scheduling/auto-generate', async (request, reply) => {
    await requireEduManage(request, reply)
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
    await requireEduManage(request, reply)
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
    await requireEduView(request, reply)
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
    await requireEduManage(request, reply)
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
    await requireEduManage(request, reply)
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
    await requireEduManage(request, reply)
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
    await requireEduView(request, reply)
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
    await requireEduManage(request, reply)
    if (reply.sent) return
    const parsed = createHomeworkSubmissionSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [row] = await db.insert(eduHomeworkSubmission).values(parsed.data).returning()
    return reply.status(201).send(success({ submission: row }))
  })

  // 批改作业
  server.put('/homework-submission/:id/grade', async (request, reply) => {
    await requireEduManage(request, reply)
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
    await requireEduView(request, reply)
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
    await requireEduView(request, reply)
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
    await requireEduManage(request, reply)
    if (reply.sent) return
    const parsed = createLeadSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [row] = await db.insert(eduLead).values(parsed.data).returning()
    return reply.status(201).send(success({ lead: row }))
  })

  server.put('/lead/:id', async (request, reply) => {
    await requireEduManage(request, reply)
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
    await requireEduManage(request, reply)
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
    await requireEduManage(request, reply)
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
    const removed = await db
      .update(eduLead)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(eduLead.id, parsed.data.id))
      .returning({ id: eduLead.id })
    return reply.send(success({ deleted: removed.length > 0 }))
  })

  // ===========================================================================
  // 19. 试听预约 CRUD (edu_trial_booking)
  // ===========================================================================

  server.get('/trial-booking', async (request, reply) => {
    await requireEduView(request, reply)
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
    await requireEduManage(request, reply)
    if (reply.sent) return
    const parsed = createTrialBookingSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [row] = await db.insert(eduTrialBooking).values(parsed.data).returning()
    return reply.status(201).send(success({ trialBooking: row }))
  })

  server.put('/trial-booking/:id', async (request, reply) => {
    await requireEduManage(request, reply)
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
    await requireEduManage(request, reply)
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
    await requireEduView(request, reply)
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
    await requireEduManage(request, reply)
    if (reply.sent) return
    const parsed = createEnrollmentSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [row] = await db.insert(eduEnrollment).values(parsed.data).returning()
    return reply.status(201).send(success({ enrollment: row }))
  })

  server.put('/enrollment/:id', async (request, reply) => {
    await requireEduManage(request, reply)
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
    await requireEduManage(request, reply)
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
    const removed = await db
      .update(eduEnrollment)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(eduEnrollment.id, parsed.data.id))
      .returning({ id: eduEnrollment.id })
    return reply.send(success({ deleted: removed.length > 0 }))
  })

  // ===========================================================================
  // 21. 学费标准 CRUD (edu_tuition_fee)
  // ===========================================================================

  /**
   * 学费标准读侧的**唯一实现**。
   * 立因:此前写侧有 `/tuition-fee` 与 `/tuition-standard` 两套别名各 3 个端点,
   * 而读侧只注册了 `/tuition-fee` —— 前端整页用的是 `/tuition-standard`,
   * 于是「学费标准」tab 永远 404 显示"加载学费标准失败",
   * 但新增/编辑/删除却能成功 ⇒ 用户看到的是"加进去了、列表永远是空的"。
   * 补齐读侧别名(共用同一实现,不复制第二份逻辑);把两套路径真正合并成一套属另一票,
   * 那要先核全部调用方(web / 小程序 / ai-service 的 6 个教育工具)。
   */
  async function listTuitionFees(request: FastifyRequest, reply: FastifyReply) {
    await requireEduView(request, reply)
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
  }

  server.get('/tuition-fee', listTuitionFees)
  server.get('/tuition-standard', listTuitionFees)

  server.post('/tuition-fee', async (request, reply) => {
    await requireEduManage(request, reply)
    if (reply.sent) return
    const parsed = createTuitionFeeSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [row] = await db.insert(eduTuitionFee).values(parsed.data).returning()
    return reply.status(201).send(success({ tuitionFee: row }))
  })

  server.put('/tuition-fee/:id', async (request, reply) => {
    await requireEduManage(request, reply)
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
    await requireEduManage(request, reply)
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
    const removed = await db
      .update(eduTuitionFee)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(eduTuitionFee.id, parsed.data.id))
      .returning({ id: eduTuitionFee.id })
    return reply.send(success({ deleted: removed.length > 0 }))
  })

  // ===========================================================================
  // 22. 缴费记录 CRUD + 汇总 (edu_payment_record)
  // ===========================================================================

  // 无归属流水点名(2026-09-29):loadUnattributedPayments 此前只有 service 实现、没有 HTTP
  // 出口 —— 机构在界面上永远看不到"这笔钱没挂到期次"。这些流水不计入任何期次的已缴额、
  // 也不会被催缴覆盖,必须点名出来让运营处置(按正确期次重录,或撤销错录流水)。
  // 静态路径必须挂在 GET /payment-record 列表之前声明无关紧要(方法+路径不同不冲突),
  // 但语义上它是"缴费读侧的第 0 张表",紧跟分节注释放最前。
  server.get('/payment-record/unattributed', async (request, reply) => {
    await requireEduView(request, reply)
    if (reply.sent) return
    const list = await loadUnattributedPayments()
    return reply.send(success({ list, total: list.length }))
  })

  server.get('/payment-record', async (request, reply) => {
    await requireEduView(request, reply)
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
    // 2026-09-29:此前 paginate() 返回裸表行,studentName/className/feeName 从未在响应里 ——
    // 前端三列长期空白,撤销缴费确认文案拿到的名字是 undefined("撤销 undefined 的缴费")。
    // 无归属流水要靠"认出是谁的钱"才能修,名字列不能空。join 补齐展示名;count 口径不变。
    const [totalResult] = await db
      .select({ count: count() })
      .from(eduPaymentRecord)
      .where(where ?? sql`true`)
    const total = Number(totalResult?.count ?? 0)
    const list = await db
      .select({
        id: eduPaymentRecord.id,
        studentId: eduPaymentRecord.studentId,
        classId: eduPaymentRecord.classId,
        feeId: eduPaymentRecord.feeId,
        studentName: users.nickname,
        className: eduClass.name,
        feeName: eduTuitionFee.feeName,
        amount: eduPaymentRecord.amount,
        paymentDate: eduPaymentRecord.paymentDate,
        paymentMethod: eduPaymentRecord.paymentMethod,
        status: eduPaymentRecord.status,
        receiptNo: eduPaymentRecord.receiptNo,
        remark: eduPaymentRecord.remark,
        scheduleId: eduPaymentRecord.scheduleId,
        enrollmentId: eduPaymentRecord.enrollmentId,
        deletedAt: eduPaymentRecord.deletedAt,
        createdAt: eduPaymentRecord.createdAt,
        updatedAt: eduPaymentRecord.updatedAt,
      })
      .from(eduPaymentRecord)
      .leftJoin(users, eq(eduPaymentRecord.studentId, users.id))
      .leftJoin(eduClass, eq(eduPaymentRecord.classId, eduClass.id))
      .leftJoin(eduTuitionFee, eq(eduPaymentRecord.feeId, eduTuitionFee.id))
      .where(where ?? sql`true`)
      .orderBy(desc(eduPaymentRecord.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize)
    // ── 遗留表历史账段(G-816106 ⑤,拍板 2026-10-07)──
    // zhs_course_pay(+ 操作日志 zhs_course_pay_log)是旧课程平台的支付记录。拍板:
    // 数据归属**维持遗留表为历史账**(不回填、不改写、不迁数据),但读数出口并入本端点,
    // 随新流水一起对 web 财务页可见,每行带 source:'legacy' 来源标记 + 该笔的操作日志。
    // 遗留行的 user_uuid 是旧平台标识,与新 users.id 无映射,所以这一段只读展示、
    // 不参与欠费/汇总口径(欠费口径仍只由账目出口 edu-ledger 持有),也不受上面的
    // studentId/classId 过滤影响 —— 那些过滤键对遗留表结构上无意义,硬套是编造归属。
    const legacyPays = await db
      .select({
        payId: zhsCoursePay.id,
        userUuid: zhsCoursePay.userUuid,
        courseId: zhsCoursePay.courseId,
        orderNo: zhsCoursePay.orderNo,
        amount: zhsCoursePay.amount,
        status: zhsCoursePay.status,
        createTime: zhsCoursePay.createTime,
      })
      .from(zhsCoursePay)
      .orderBy(desc(zhsCoursePay.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize)
    const legacyPayIds = legacyPays.map((p) => p.payId)
    const legacyLogs = legacyPayIds.length
      ? await db
          .select({
            payId: zhsCoursePayLog.payId,
            action: zhsCoursePayLog.action,
            detail: zhsCoursePayLog.detail,
            createTime: zhsCoursePayLog.createTime,
          })
          .from(zhsCoursePayLog)
          .where(inArray(zhsCoursePayLog.payId, legacyPayIds))
          .orderBy(asc(zhsCoursePayLog.createTime))
      : []
    const [legacyTotalRow] = await db.select({ c: count() }).from(zhsCoursePay)
    const legacy = buildLegacySegment(legacyPays, legacyLogs, Number(legacyTotalRow?.c ?? 0))
    return reply.send(
      success({ list, total, page, pageSize, totalPages: Math.ceil(total / pageSize), legacy }),
    )
  })

  server.post('/payment-record', async (request, reply) => {
    await requireEduManage(request, reply)
    if (reply.sent) return
    const parsed = createPaymentRecordSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    // 归属一律以**报名行**为准:请求只负责点名是哪一条报名。
    // 自报的 studentId/classId 只用于一致性校验(不一致直接拒),绝不采信 ——
    // 采信就等于让调用方把这笔钱记到别人的账上。
    const {
      enrollmentId: wantedId,
      studentId: claimedStudent,
      classId: claimedClass,
      ...payFields
    } = parsed.data
    const [enrollRow] = await db
      .select({
        id: eduEnrollment.id,
        studentId: eduEnrollment.studentId,
        classId: eduEnrollment.classId,
      })
      .from(eduEnrollment)
      .where(and(eq(eduEnrollment.id, wantedId), isNull(eduEnrollment.deletedAt)))
      .limit(1)
    if (!enrollRow) {
      return reply.status(404).send(error(404, '所选报名不存在或已删除,无法登记缴费'))
    }
    if (claimedStudent && claimedStudent !== enrollRow.studentId) {
      return reply.status(400).send(error(400, '自报学员与所选报名不一致,请重新选择期次'))
    }
    if (claimedClass && claimedClass !== enrollRow.classId) {
      return reply.status(400).send(error(400, '自报班级与所选报名不一致,请重新选择期次'))
    }
    // 唯一入口:写流水 + 重算派生缓存。旧写法只 insert 不回写 paidAmount,
    // 于是"后台录了缴费、欠费名单照旧亮红、第二天继续被催缴"。
    const { ledger } = await recordPayment({
      ...payFields,
      studentId: enrollRow.studentId,
      classId: enrollRow.classId,
      enrollmentId: enrollRow.id,
    })
    return reply.status(201).send(success({ paymentRecord: null, ledger }))
  })

  // 缴费汇总
  server.get('/payment-record/summary', async (request, reply) => {
    await requireEduView(request, reply)
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
        // 欠费人数与欠费总额:口径必须和名单、催费完全一致,所以只在**一处**表达。
        // 旧写法把整张 edu_enrollment 拉进内存再 filter/reduce —— 随报名数线性膨胀,
        // 且与 roster 那条 SQL 算式各写各的(那边漏了下限 0,超缴的学员会被算成"负欠费",
        // 汇总时还会把负数加进去,把总欠费额冲小)。
        const enrollWhere = and(...enrollConds)
        const arrearsRow = await tx
          .select({
            arrearsCount: count(),
            arrearsTotal: sql<number>`COALESCE(SUM(${arrearsSqlExpr()}), 0)`,
          })
          .from(eduEnrollment)
          .where(and(enrollWhere, hasArrearsCond()))
        const arrearsCount = Number(arrearsRow[0]?.arrearsCount ?? 0)
        const arrearsTotal = Number(arrearsRow[0]?.arrearsTotal ?? 0)

        return { totalIncome, paidStudentCount, arrearsCount, arrearsTotal }
      })
      return reply.send(success(result))
    } catch (_err) {
      return reply.status(500).send(error(500, '汇总查询失败'))
    }
  })

  server.delete('/payment-record/:id', async (request, reply) => {
    await requireEduManage(request, reply)
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
    // 撤销缴费必须重算:否则 paidAmount 里那笔钱永远退不回来,欠费数字长期偏小、催费漏发。
    const { enrollmentId, ledger } = await voidPaymentRecord(parsed.data.id)
    return reply.send(
      success({
        deleted: true,
        ledger,
        unattributed: enrollmentId === null,
      }),
    )
  })

  // ===========================================================================
  // 23. 退费记录 CRUD + 审批 (edu_refund_record)
  // ===========================================================================

  /** 退费列表读侧唯一实现;同样补 `/refund` 读侧别名(前端用这个路径,此前只有写侧有别名) */
  async function listRefundRecords(request: FastifyRequest, reply: FastifyReply) {
    await requireEduView(request, reply)
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
  }

  server.get('/refund-record', listRefundRecords)
  server.get('/refund', listRefundRecords)

  server.post('/refund-record', async (request, reply) => {
    await requireEduManage(request, reply)
    if (reply.sent) return
    const parsed = createRefundRecordSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    // 归属解析与重算全在账目出口里做一次(见 edu-ledger::recordRefund)。
    // 此前这两个别名端点各写一遍 insert + 各自判归属,于是"两处必须同改"成了缺陷温床 ——
    // 真实事故就是其中一半没做:不带 paymentId 的退费退了钱却不减已缴额。
    const r = await recordRefund({
      ...parsed.data,
      operatorId: parsed.data.operatorId || request.userId,
    })
    return reply.status(201).send(
      success({
        refundRecord: r.refund,
        enrollmentId: r.enrollmentId,
        unattributed: !r.enrollmentId,
      }),
    )
  })

  // 审批通过
  server.put('/refund-record/:id/approve', async (request, reply) => {
    await requireEduManage(request, reply)
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
    // 退费必须落进账目:改状态的同时重算该报名的已缴额。
    // 旧写法只 update 本表 —— 既不冲销 paidAmount 也不动原流水,于是退完钱系统仍认为
    // "已缴清",欠费归零、催费从此不再发出。这是资金级缺陷,不是显示问题。
    await settleRefund({
      refundId: idParsed.data.id,
      status: 'approved',
      approverId: request.userId,
      approveRemark: parsed.data.approveRemark,
    })
    const [row] = await db
      .select()
      .from(eduRefundRecord)
      .where(eq(eduRefundRecord.id, idParsed.data.id))
      .limit(1)
    return reply.send(success({ refundRecord: row }))
  })

  // 驳回
  server.put('/refund-record/:id/reject', async (request, reply) => {
    await requireEduManage(request, reply)
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
    await requireEduManage(request, reply)
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
    await requireEduManage(request, reply)
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
    await requireEduManage(request, reply)
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
    await requireEduManage(request, reply)
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
  // G-962 #68: 前端 enrollment/page.tsx 用 GET /trial-reservation 拉列表,此前仅 POST/PUT 在册。
  server.get('/trial-reservation', async (request, reply) => {
    await requireEduView(request, reply)
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

  server.post('/trial-reservation', async (request, reply) => {
    await requireEduManage(request, reply)
    if (reply.sent) return
    const parsed = createTrialBookingSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [row] = await db.insert(eduTrialBooking).values(parsed.data).returning()
    return reply.status(201).send(success({ trialBooking: row }))
  })

  server.put('/trial-reservation/:id', async (request, reply) => {
    await requireEduManage(request, reply)
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
    await requireEduManage(request, reply)
    if (reply.sent) return
    const parsed = createTuitionFeeSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [row] = await db.insert(eduTuitionFee).values(parsed.data).returning()
    return reply.status(201).send(success({ tuitionFee: row }))
  })

  server.put('/tuition-standard/:id', async (request, reply) => {
    await requireEduManage(request, reply)
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
    await requireEduManage(request, reply)
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
    const removed = await db
      .update(eduTuitionFee)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(eduTuitionFee.id, parsed.data.id))
      .returning({ id: eduTuitionFee.id })
    return reply.send(success({ deleted: removed.length > 0 }))
  })

  // --- 退费:前端 /refund ↔ 后端 /refund-record ---
  server.post('/refund', async (request, reply) => {
    await requireEduManage(request, reply)
    if (reply.sent) return
    const parsed = createRefundRecordSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    // 归属解析与重算全在账目出口里做一次(见 edu-ledger::recordRefund)。
    // 此前这两个别名端点各写一遍 insert + 各自判归属,于是"两处必须同改"成了缺陷温床 ——
    // 真实事故就是其中一半没做:不带 paymentId 的退费退了钱却不减已缴额。
    const r = await recordRefund({
      ...parsed.data,
      operatorId: parsed.data.operatorId || request.userId,
    })
    return reply.status(201).send(
      success({
        refundRecord: r.refund,
        enrollmentId: r.enrollmentId,
        unattributed: !r.enrollmentId,
      }),
    )
  })

  server.put('/refund/:id/approve', async (request, reply) => {
    await requireEduManage(request, reply)
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
    // 退费必须落进账目:改状态的同时重算该报名的已缴额。
    // 旧写法只 update 本表 —— 既不冲销 paidAmount 也不动原流水,于是退完钱系统仍认为
    // "已缴清",欠费归零、催费从此不再发出。这是资金级缺陷,不是显示问题。
    await settleRefund({
      refundId: idParsed.data.id,
      status: 'approved',
      approverId: request.userId,
      approveRemark: parsed.data.approveRemark,
    })
    const [row] = await db
      .select()
      .from(eduRefundRecord)
      .where(eq(eduRefundRecord.id, idParsed.data.id))
      .limit(1)
    return reply.send(success({ refundRecord: row }))
  })

  // --- 全学期冲突检测(2026-09-17,4-4-13 重写):前端传 {termId},返回人读冲突串 ---
  // 说明:排课规则/教师时间表/调课审批的写端点统一走原生 hyphen 路径
  // (POST/PUT/DELETE /scheduling-rule、/teacher-schedule、/schedule-change/:id/approve|reject),
  // 此前的 slash 桥接副本(POST/PUT/DELETE /scheduling/rule 等)已删除,避免双路径漂移。
  server.post('/scheduling/check-conflicts', async (request, reply) => {
    await requireEduManage(request, reply)
    if (reply.sent) return
    const parsed = termConflictScanSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))

    try {
      const rows = await db
        .select()
        .from(eduCourseSchedule)
        .where(
          and(
            eq(eduCourseSchedule.termId, parsed.data.termId),
            isNull(eduCourseSchedule.deletedAt),
          ),
        )
      // 判定与规范化在 edu-schedule-conflict.ts(纯函数,有测试)。
      // 旧实现在这里直接比字符串 `a.startTime < b.endTime`:非补零的 '9:00' 会被判成
      // 不与 '10:00-11:00' 冲突 —— 页面一路绿,老师却被排进同一时刻两节课。
      const { conflicts, malformedTimes } = findScheduleConflicts(
        rows.map((r) => ({
          weekday: r.weekday,
          startTime: r.startTime,
          endTime: r.endTime,
          teacher: r.teacher,
          classroom: r.classroom,
          courseName: r.courseName,
        })),
      )
      return reply.send(success({ conflicts, malformedTimes }))
    } catch (_err) {
      return reply.status(500).send(error(500, '冲突检测失败'))
    }
  })

  // --- 家长绑定:前端 /parent-binding ↔ 后端 /parent/binding ---
  // G-962 #69: 前端 parent/bind/page.tsx 用 GET /parent-binding 拉本人绑定列表。
  server.get('/parent-binding', async (request, reply) => {
    // 承载层出口(§5):与 /parent/binding 同族同形 —— 本人绑定列表是私有数据,不接受匿名。
    const authed = await checkAuthOrInternalService(request, reply)
    if (!authed) return
    const parsed = bindingListQuerySchema.safeParse(request.query)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const userId = request.userId!

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

  server.post('/parent-binding', async (request, reply) => {
    // 承载层出口(§5):parentId 只从登录态取,不接受客户端自报。
    const authed = await checkAuthOrInternalService(request, reply)
    if (!authed) return
    const parsed = createBindingSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const userId = request.userId!

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
    // 承载层出口(§5);下方「仅绑定双方可解除」的归属校验保留(鉴权≠授权)。
    const authed = await checkAuthOrInternalService(request, reply)
    if (!authed) return
    const idParsed = uuidParamSchema.safeParse(request.params)
    if (!idParsed.success)
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    const userId = request.userId!

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

    const removed = await db
      .update(eduParentStudentBinding)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(eduParentStudentBinding.id, idParsed.data.id))
      .returning({ id: eduParentStudentBinding.id })
    return reply.send(success({ deleted: removed.length > 0 }))
  })

  // 学生确认绑定(前端 PUT /parent-binding/:id/confirm)
  server.put('/parent-binding/:id/confirm', async (request, reply) => {
    // 承载层出口(§5);下方「仅学生本人可确认绑定」的归属校验保留(鉴权≠授权)。
    const authed = await checkAuthOrInternalService(request, reply)
    if (!authed) return
    const idParsed = uuidParamSchema.safeParse(request.params)
    if (!idParsed.success)
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    const userId = request.userId!

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
    // 承载层出口(§5);下方「仅学生本人可拒绝绑定」的归属校验保留(鉴权≠授权)。
    const authed = await checkAuthOrInternalService(request, reply)
    if (!authed) return
    const idParsed = uuidParamSchema.safeParse(request.params)
    if (!idParsed.success)
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    const userId = request.userId!

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

  // --- 成绩趋势(前端 GET /exam-score/trend/:studentId,2026-09-17 补)---
  // grades/trend/[studentId] 面板按学生拉成绩时间线;此前只有 weakness/stats/ranking 有端点,
  // trend 因前端调用含内联查询串(`?subject=`)落进守门正则盲区而从未暴露。
  // 返回契约与 edu_exam_score 表字段一一对应(id/examName/subject/score/totalScore/examDate),
  // 可选 subject 过滤,按考试日期升序(时间线)。
  server.get('/exam-score/trend/:id', async (request, reply) => {
    await requireEduView(request, reply)
    if (reply.sent) return
    const idParsed = uuidParamSchema.safeParse(request.params)
    if (!idParsed.success)
      return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    const subjectParsed = z
      .transform(emptyToUndefined)
      .pipe(z.string().max(100).optional())
      .safeParse((request.query as Record<string, unknown> | undefined)?.subject)
    const conds: SQL[] = [
      eq(eduExamScore.studentId, idParsed.data.id),
      isNull(eduExamScore.deletedAt),
    ]
    if (subjectParsed.success && subjectParsed.data)
      conds.push(eq(eduExamScore.subject, subjectParsed.data))
    const list = await db
      .select({
        id: eduExamScore.id,
        examName: eduExamScore.examName,
        subject: eduExamScore.subject,
        score: eduExamScore.score,
        totalScore: eduExamScore.totalScore,
        examDate: eduExamScore.examDate,
      })
      .from(eduExamScore)
      .where(and(...conds))
      .orderBy(eduExamScore.examDate, eduExamScore.subject)
    return reply.send(success({ list }))
  })

  // --- 成绩薄弱点分析(前端 GET /exam-score/weakness/:id,此前无对应端点)---
  server.get('/exam-score/weakness/:id', async (request, reply) => {
    await requireEduView(request, reply)
    if (reply.sent) return
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

  // ===========================================================================
  // 24. 学生名册 + 催费 (业务线/欠费聚合,2026-09-19)
  // 欠费定义沿用 /payment-record/summary 先例:enrollment.totalFee > paidAmount。
  // 催费动作落 edu_fee_reminder 留痕(欠费快照 dueAmount),站内信必达;
  // channel=wechat 走小程序订阅消息真实外发(尽力而为,需用户已订阅授权),sms 仍为意图标记。
  // ===========================================================================

  /** 催费默认文案 */
  function defaultReminderMessage(studentName: string, dueAmount: number): string {
    return `【学费催缴】${studentName} 同学本学期尚有学费 ${dueAmount} 元未缴清,请尽快完成缴费。如有疑问请联系机构老师。`
  }

  /**
   * 微信小程序订阅消息尽力外发(仅 channel=wechat 时调用)。
   * 失败不抛错,返回失败原因供响应体透出;站内信兜底始终执行。
   */
  async function trySendWechatReminder(
    studentId: string,
    studentName: string,
    dueAmount: number,
  ): Promise<{ sent: boolean; reason?: string }> {
    if (!isSubscribeMessageConfigured()) return { sent: false, reason: 'not_configured' }
    try {
      const openId = await getWechatMiniOpenId(studentId)
      if (!openId) return { sent: false, reason: 'no_openid' }
      const res = await sendSubscribeMessage(
        openId,
        buildFeeReminderData(studentName, dueAmount),
        '/pkg-user/bill/index',
      )
      return res.ok ? { sent: true } : { sent: false, reason: `wx_${res.errcode ?? 'unknown'}` }
    } catch {
      return { sent: false, reason: 'send_exception' }
    }
  }

  // 学生名册:报名 × 学生 × 班级聚合,支持业务线/班级/学期/关键词/仅欠费筛选
  server.get('/student-roster', async (request, reply) => {
    await requireEduView(request, reply)
    if (reply.sent) return
    const parsed = studentRosterQuerySchema.safeParse(request.query)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const { page, pageSize } = paginationSchema.parse(request.query)
    const conds: SQL[] = [isNull(eduEnrollment.deletedAt)]
    if (parsed.data.businessLine) conds.push(eq(eduClass.businessLine, parsed.data.businessLine))
    if (parsed.data.classId) conds.push(eq(eduEnrollment.classId, parsed.data.classId))
    if (parsed.data.termId) conds.push(eq(eduEnrollment.termId, parsed.data.termId))
    if (parsed.data.arrearsOnly) conds.push(hasArrearsCond())
    if (parsed.data.keyword) {
      const kw = `%${parsed.data.keyword}%`
      const kwCond = or(ilike(users.nickname, kw), ilike(users.phone, kw))
      if (kwCond) conds.push(kwCond)
    }
    const where = and(...conds)

    const baseQuery = db
      .select({ enrollmentId: eduEnrollment.id })
      .from(eduEnrollment)
      .innerJoin(eduClass, eq(eduEnrollment.classId, eduClass.id))
      .innerJoin(users, eq(eduEnrollment.studentId, users.id))
      .where(where)
      .as('roster_base')

    const [totalResult] = await db.select({ count: count() }).from(baseQuery)
    const total = Number(totalResult?.count ?? 0)
    const totalPages = Math.ceil(total / pageSize)
    const list = await db
      .select({
        enrollmentId: eduEnrollment.id,
        studentId: users.id,
        studentName: users.nickname,
        studentPhone: users.phone,
        classId: eduClass.id,
        className: eduClass.name,
        businessLine: eduClass.businessLine,
        grade: eduClass.grade,
        termId: eduEnrollment.termId,
        enrollDate: eduEnrollment.enrollDate,
        totalFee: eduEnrollment.totalFee,
        paidAmount: eduEnrollment.paidAmount,
        /** 欠费算式取自账目出口的那一份,此处不重写 */
        dueAmount: arrearsSqlExpr(),
        nextDueDate: eduEnrollment.nextDueDate,
        status: eduEnrollment.status,
      })
      .from(eduEnrollment)
      .innerJoin(eduClass, eq(eduEnrollment.classId, eduClass.id))
      .innerJoin(users, eq(eduEnrollment.studentId, users.id))
      .where(where)
      .orderBy(desc(eduEnrollment.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize)
    return reply.send(success({ list, total, page, pageSize, totalPages }))
  })

  // ===========================================================================
  // 24b. 账期 / 缴费计划 (edu_fee_schedule) —— "什么时间该缴费"的数据来源
  //      入参 schema 在模块顶层(与其余 schema 同处一份,体内不留第二份)
  // ===========================================================================

  server.get('/fee-schedule', async (request, reply) => {
    await requireEduView(request, reply)
    if (reply.sent) return
    const parsed = z
      .object({
        enrollmentId: z.string().uuid().optional(),
        studentId: z.string().uuid().optional(),
      })
      .safeParse(request.query)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    if (!parsed.data.enrollmentId && !parsed.data.studentId) {
      return reply.status(400).send(error(400, '请至少提供 enrollmentId 或 studentId'))
    }
    const conds: SQL[] = [isNull(eduFeeSchedule.deletedAt)]
    if (parsed.data.enrollmentId)
      conds.push(eq(eduFeeSchedule.enrollmentId, parsed.data.enrollmentId))
    if (parsed.data.studentId) conds.push(eq(eduFeeSchedule.studentId, parsed.data.studentId))
    const rows = await db
      .select()
      .from(eduFeeSchedule)
      .where(and(...conds))
      .orderBy(asc(eduFeeSchedule.dueDate))
    return reply.send(success({ list: rows, total: rows.length }))
  })

  server.post('/fee-schedule/generate', async (request, reply) => {
    await requireEduManage(request, reply)
    if (reply.sent) return
    const parsed = generateFeeScheduleSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [enrollment] = await db
      .select()
      .from(eduEnrollment)
      .where(and(eq(eduEnrollment.id, parsed.data.enrollmentId), isNull(eduEnrollment.deletedAt)))
      .limit(1)
    if (!enrollment) return reply.status(404).send(error(404, '报名记录不存在'))

    const existing = await db
      .select({ id: eduFeeSchedule.id })
      .from(eduFeeSchedule)
      .where(and(eq(eduFeeSchedule.enrollmentId, enrollment.id), isNull(eduFeeSchedule.deletedAt)))
      .limit(1)
    if (existing.length > 0 && !parsed.data.replace) {
      return reply
        .status(409)
        .send(
          error(
            409,
            '该报名已有账期。确要重建请带 replace:true —— 重建会断开已挂在旧账期上的缴费归属',
          ),
        )
    }

    const plan = buildSchedulePlan({
      periodCount: parsed.data.periodCount,
      amountTotal: enrollment.totalFee,
      firstDueDate: parsed.data.firstDueDate,
      cycle: parsed.data.cycle,
      monthsPerPeriod: parsed.data.monthsPerPeriod,
    })
    if (!plan) {
      return reply
        .status(400)
        .send(error(400, '无法展开账期:参数组合非法(期数/日期/周期请一并核对)'))
    }

    const created = await db.transaction(async (tx) => {
      if (existing.length > 0) {
        await tx
          .update(eduFeeSchedule)
          .set({ deletedAt: new Date(), updatedAt: new Date() })
          .where(
            and(eq(eduFeeSchedule.enrollmentId, enrollment.id), isNull(eduFeeSchedule.deletedAt)),
          )
      }
      return tx
        .insert(eduFeeSchedule)
        .values(
          plan.map((p) => ({
            enrollmentId: enrollment.id,
            studentId: enrollment.studentId,
            classId: enrollment.classId,
            termId: enrollment.termId,
            periodLabel: p.periodLabel,
            dueDate: p.dueDate,
            amountDue: p.amountDue,
            graceDays: parsed.data.graceDays,
            status: 'pending',
          })),
        )
        .returning({ id: eduFeeSchedule.id })
    })

    const ledger = await recomputeEnrollment(enrollment.id)
    return reply.status(201).send(
      success({
        createdCount: created.length,
        replaced: existing.length > 0,
        ledger,
        // 摊派自证:逐期相加必须恰好等于应缴额,少 1 元末期就永远"差一点缴清"
        planTotal: plan.reduce((s, p) => s + p.amountDue, 0),
        amountTotal: enrollment.totalFee,
      }),
    )
  })

  // 单发催费
  server.post('/fee-reminder', async (request, reply) => {
    await requireEduManage(request, reply)
    if (reply.sent) return
    const parsed = createFeeReminderSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [enrollment] = await db
      .select()
      .from(eduEnrollment)
      .where(and(eq(eduEnrollment.id, parsed.data.enrollmentId), isNull(eduEnrollment.deletedAt)))
      .limit(1)
    if (!enrollment) return reply.status(404).send(error(404, '报名记录不存在'))
    // 欠费额一律取账目出口。旧版这里写 `enrollment.totalFee - enrollment.paidAmount`,
    // 那是第二个口径(且因为读的是**对象属性**而非 drizzle 列,列引用形态的对账判据看不见它),
    // 后果是账期摊派与"无归属流水认领"都进不了这个数 —— 催缴金额会和名单不一致。
    const ledger = await loadEnrollmentLedger(parsed.data.enrollmentId)
    const dueAmount = ledger?.arrears ?? 0
    if (dueAmount <= 0) return reply.status(400).send(error(400, '该报名无欠费,无需催缴'))

    const [student] = await db
      .select({ nickname: users.nickname })
      .from(users)
      .where(eq(users.id, enrollment.studentId))
      .limit(1)
    const message =
      parsed.data.message ?? defaultReminderMessage(student?.nickname ?? '同学', dueAmount)

    const [row] = await db
      .insert(eduFeeReminder)
      .values({
        studentId: enrollment.studentId,
        enrollmentId: enrollment.id,
        classId: enrollment.classId,
        dueAmount,
        channel: parsed.data.channel,
        status: 'sent',
        message,
        operatorId: request.userId,
      })
      .returning()
    if (!row) return reply.status(500).send(error(500, '催费记录创建失败'))

    // 通道编排交给服务层。此前 channel='sms' 只是写进留痕的"意图标记",没有任何发送实现;
    // 现在它真的发给学员 + 已确认家长,并把"没配短信密钥""某人没留手机号""运营商拒了"
    // 三种不可达分开报回来(并成一档就等于让运营去查运营商,而真因是没配密钥)。
    const dispatch = await dispatchArrearChannels({
      studentId: enrollment.studentId,
      message,
      studentName: student?.nickname ?? '同学',
      dueAmount,
      channel: parsed.data.channel,
      sendWx: trySendWechatReminder,
    })
    const wxSent = dispatch.wx?.sent ?? false
    const wxFailReason = dispatch.wx?.reason
    // 回执持久化:微信那支此前只有整体结论,所以按整体落一条(reason 命中已知档时原样保留,
    // 否则归 failed —— 不确定的一律不冒充某个具体档);短信是逐收件人明细,直接落。
    // 批量手动催费仍不写(它只有聚合计数),故统计里的 unknown 含"历史行 + 批量手动"两类。
    const deliveryEntries: DeliveryEntry[] = []
    if (parsed.data.channel === 'wechat') {
      const known = ['not_configured', 'no_openid', 'user_refused']
      const r = dispatch.wx?.reason ?? ''
      deliveryEntries.push({
        userId: enrollment.studentId,
        role: 'student',
        channel: 'wechat',
        bucket: dispatch.wx?.sent
          ? 'sent'
          : ((known.includes(r) ? r : 'failed') as DeliveryEntry['bucket']),
        at: new Date().toISOString(),
      })
    }
    for (const s of dispatch.sms) {
      deliveryEntries.push({
        userId: s.userId,
        role: s.role,
        channel: 'sms',
        bucket: s.bucket,
        ...(s.detail ? { detail: s.detail } : {}),
        at: new Date().toISOString(),
      })
    }
    if (deliveryEntries.length) await attachReminderDelivery(row.id, deliveryEntries)

    // 站内信必达:sms/wechat 亦同步发一条站内通知兜底
    try {
      await createNotification({
        userId: enrollment.studentId,
        type: 'edu_fee_reminder',
        title: '学费催缴通知',
        content: message,
        data: {
          reminderId: row.id,
          enrollmentId: enrollment.id,
          dueAmount,
          channel: parsed.data.channel,
        },
      })
    } catch (_err) {
      // 通知失败不回滚催费留痕,仅标记发送失败
      const [failed] = await db
        .update(eduFeeReminder)
        .set({ status: 'failed', updatedAt: new Date() })
        .where(eq(eduFeeReminder.id, row.id))
        .returning()
      return reply
        .status(201)
        .send(
          success({ reminder: failed, notified: false, wxSent, wxFailReason, sms: dispatch.sms }),
        )
    }
    return reply.status(201).send(
      success({
        reminder: row,
        notified: true,
        wxSent,
        wxFailReason,
        // 每收件人一档:sent / failed / not_configured / no_phone
        smsSent: dispatch.smsSent,
        sms: dispatch.sms,
      }),
    )
  })

  // 批量催费:勾选欠费名单(报名记录)一次发送
  server.post('/fee-reminder/batch', async (request, reply) => {
    await requireEduManage(request, reply)
    if (reply.sent) return
    const parsed = batchFeeReminderSchema.safeParse(request.body)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))

    const enrollments = await db
      .select()
      .from(eduEnrollment)
      .where(
        and(inArray(eduEnrollment.id, parsed.data.enrollmentIds), isNull(eduEnrollment.deletedAt)),
      )
    const enrollmentMap = new Map(enrollments.map((e) => [e.id, e]))
    // 欠费额逐条取自账目出口(与名单、汇总、定时催费同一把尺子),不再各自减一次。
    // 批量上限 100,并发取数;取不到账目按 0 处理并落进 skipped 明细,不猜金额。
    const arrearsById = new Map<string, number>()
    await Promise.all(
      parsed.data.enrollmentIds.map(async (id) => {
        const l = await loadEnrollmentLedger(id)
        arrearsById.set(id, l?.arrears ?? 0)
      }),
    )
    const skipped: Array<{ enrollmentId: string; reason: string }> = []
    const dueList = parsed.data.enrollmentIds
      .map((id) => {
        const enrollment = enrollmentMap.get(id)
        if (!enrollment) {
          skipped.push({ enrollmentId: id, reason: 'not_found' })
          return null
        }
        const dueAmount = arrearsById.get(id) ?? 0
        if (dueAmount <= 0) {
          skipped.push({ enrollmentId: id, reason: 'no_arrears' })
          return null
        }
        return { enrollment, dueAmount }
      })
      .filter(
        (v): v is { enrollment: (typeof enrollments)[number]; dueAmount: number } => v !== null,
      )
    if (dueList.length === 0) return reply.send(success({ sent: 0, skipped }))

    // 批量补学生昵称(默认文案用)
    const studentIds = [...new Set(dueList.map((d) => d.enrollment.studentId))]
    const students = await db
      .select({ id: users.id, nickname: users.nickname })
      .from(users)
      .where(inArray(users.id, studentIds))
    const nameMap = new Map(students.map((s) => [s.id, s.nickname]))

    const values = dueList.map(({ enrollment, dueAmount }) => {
      const studentName = nameMap.get(enrollment.studentId) ?? '同学'
      return {
        studentId: enrollment.studentId,
        enrollmentId: enrollment.id,
        classId: enrollment.classId,
        dueAmount,
        channel: parsed.data.channel,
        status: 'sent',
        message: parsed.data.message ?? defaultReminderMessage(studentName, dueAmount),
        operatorId: request.userId,
      }
    })
    const rows = await db.insert(eduFeeReminder).values(values).returning()

    // 逐条发送:微信订阅消息尽力外发(仅 channel=wechat) + 站内信必达;失败条目标记 failed,不中断其余发送
    let notified = 0
    let wxSentCount = 0
    // 逐条累计四档,不在循环里静默累加一个总数 —— 批量最怕的就是"发出去了 0 条但没原因"
    const smsTally = { sent: 0, failed: 0, not_configured: 0, no_phone: 0 }
    for (const row of rows) {
      // 逐收件人发送 + 落回执。此前批量只有聚合计数,于是统计的 unknown 里混着"今天的批量手动催费",
      // 读报表的人分不出"没数据"与"没记录"两种 unknown —— 那是同一格被两种原因污染。
      const entries: DeliveryEntry[] = []
      let rowWxOk = false
      if (row.channel === 'wechat' || row.channel === 'sms') {
        const recipients = await resolveReminderRecipients(row.studentId)
        const studentName = nameMap.get(row.studentId) ?? '同学'
        for (const recipient of recipients) {
          if (row.channel === 'wechat') {
            const wx = await sendWxToRecipient(recipient, studentName, row.dueAmount)
            if (wx.bucket === 'sent') rowWxOk = true
            entries.push({
              userId: recipient.userId,
              role: recipient.role,
              channel: 'wechat',
              bucket: wx.bucket,
              ...(wx.detail ? { detail: wx.detail } : {}),
              at: new Date().toISOString(),
            })
          } else {
            // 短信走结构化模板(row.message 是机构自定义文案,只作站内留痕,不进短信)
            const sms = await sendArrearSmsToRecipient(recipient, {
              student: studentName,
              money: String(row.dueAmount),
            })
            if (sms.bucket === 'sent') smsTally.sent += 1
            else if (sms.bucket === 'no_phone') smsTally.no_phone += 1
            else if (sms.bucket === 'not_configured') smsTally.not_configured += 1
            else smsTally.failed += 1
            entries.push({
              userId: recipient.userId,
              role: recipient.role,
              channel: 'sms',
              bucket: sms.bucket,
              ...(sms.detail ? { detail: sms.detail } : {}),
              at: new Date().toISOString(),
            })
          }
        }
      }
      // 计数口径保持"条"不变(与改造前逐字一致),不因换成逐人发送而悄悄把 wxSent 变成人数
      if (rowWxOk) wxSentCount += 1
      if (entries.length) await attachReminderDelivery(row.id, entries)
      try {
        await createNotification({
          userId: row.studentId,
          type: 'edu_fee_reminder',
          title: '学费催缴通知',
          content: row.message ?? '',
          data: {
            reminderId: row.id,
            enrollmentId: row.enrollmentId,
            dueAmount: row.dueAmount,
            channel: row.channel,
          },
        })
        notified += 1
      } catch (_err) {
        // 先取现值、按键比较:只有状态真的不是 failed 才写(守门 161 出口形态)。
        // 无条件盖 updatedAt 会把「没变」伪装成「变过」,污染 tasks.ts 的 since 补拉窗口。
        const [current] = await db
          .select({ status: eduFeeReminder.status })
          .from(eduFeeReminder)
          .where(eq(eduFeeReminder.id, row.id))
          .limit(1)
        const changed = current && current.status !== 'failed' ? { status: 'failed' as const } : {}
        if (Object.keys(changed).length > 0) {
          await db
            .update(eduFeeReminder)
            .set({ ...changed, updatedAt: new Date() })
            .where(eq(eduFeeReminder.id, row.id))
        }
      }
    }
    return reply.status(201).send(
      success({
        sent: notified,
        total: rows.length,
        wxSent: wxSentCount,
        sms: smsTally,
        skipped,
      }),
    )
  })

  // 催费记录列表
  /**
   * 催缴留痕统计(只读)。
   *
   * 为什么要有:在此之前,"这个月到底催了多少、各通道成了几条"没人答得上来 ——
   * 数据其实都在 `edu_fee_reminder` 里,只是没有出口,于是催缴效果只能靠翻日志。
   *
   * **caveat 是本端点的一部分,不是脚注**:这里统计的是**留痕**(登记了催缴、走哪条通道、
   * 留痕状态),**不等于送达**。通道级四档回执(`sent`/`failed`/`not_configured`/`no_phone`,
   * 通道级回执(sent/failed/not_configured/no_phone,微信另有 user_refused)已随三条写路径(每日自动、手动单发、手动批量)落到本表 delivery 列;
   * 所以"sent=N"读作"N 条催缴被登记",读不出"N 条家长真收到"。
   * 把这句话放进响应而不是只写在注释里,是因为数字一旦被搬进报表,注释不会跟着走。
   */
  server.get('/fee-reminder/stats', async (request, reply) => {
    await requireEduView(request, reply)
    if (reply.sent) return
    const parsed = feeReminderStatsSchema.safeParse(request.query)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const { days } = parsed.data
    const since = new Date(Date.now() - days * 86_400_000)
    const windowCond = gte(eduFeeReminder.createdAt, since)
    const dayExpr = sql<string>`to_char(${eduFeeReminder.createdAt}, 'YYYY-MM-DD')`

    const [totalRow, byChannel, byDay, deliveryRows] = await Promise.all([
      db.select({ n: count() }).from(eduFeeReminder).where(windowCond),
      db
        .select({ channel: eduFeeReminder.channel, status: eduFeeReminder.status, n: count() })
        .from(eduFeeReminder)
        .where(windowCond)
        .groupBy(eduFeeReminder.channel, eduFeeReminder.status),
      db
        .select({ day: dayExpr, n: count() })
        .from(eduFeeReminder)
        .where(windowCond)
        .groupBy(dayExpr)
        .orderBy(dayExpr),
      db.select({ delivery: eduFeeReminder.delivery }).from(eduFeeReminder).where(windowCond),
    ])
    const delivery = aggregateDeliveries(deliveryRows)

    return reply.send(
      success({
        days,
        since: since.toISOString(),
        total: totalRow[0]?.n ?? 0,
        byChannel,
        byDay,
        // 真实触达计数(仅覆盖已落回执的留痕;更早的行计入 unknown,不猜任何一侧)
        delivery,
        caveat:
          'byChannel/byDay 是催缴**留痕**计数(登记了几条、走哪条通道、留痕状态),不等于送达。' +
          '真实触达看 delivery.buckets:自动催缴、手动单发、手动批量三条路径都写逐收件人回执;' +
          `unknownReminders=${delivery.unknownReminders} 是该列上线前登记的历史行 —— 不计入送达也不计入失败,读作"触达情况未知"。`,
      }),
    )
  })

  server.get('/fee-reminder', async (request, reply) => {
    await requireEduView(request, reply)
    if (reply.sent) return
    const parsed = feeReminderListQuerySchema.safeParse(request.query)
    if (!parsed.success)
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const { page, pageSize } = paginationSchema.parse(request.query)
    const conds: SQL[] = []
    if (parsed.data.studentId) conds.push(eq(eduFeeReminder.studentId, parsed.data.studentId))
    if (parsed.data.classId) conds.push(eq(eduFeeReminder.classId, parsed.data.classId))
    if (parsed.data.channel) conds.push(eq(eduFeeReminder.channel, parsed.data.channel))
    const where = conds.length > 0 ? and(...conds) : undefined
    const result = await paginate(
      eduFeeReminder,
      where,
      desc(eduFeeReminder.createdAt),
      page,
      pageSize,
    )
    return reply.send(success(result))
  })

  // 25. 我的学费账单(小程序家长端,2026-09-19)
  // 学员登录后自查:我的报名(应缴/已缴/欠费) + 最近缴费记录。非管理端权限。
  // 2026-09-19:改用混合鉴权 —— JWT(学员自查)优先,失败降级 internal service token
  // (AI 对话链 edu_my_bills 工具经此端点查真实聊天用户的账单)。
  server.get('/my-bills', async (request, reply) => {
    const authed = await checkAuthOrInternalService(request, reply)
    if (!authed) return
    const userId = request.userId!
    const enrollments = await db
      .select({
        id: eduEnrollment.id,
        classId: eduEnrollment.classId,
        className: eduClass.name,
        termId: eduEnrollment.termId,
        termName: eduTerm.name,
        businessLine: eduClass.businessLine,
        status: eduEnrollment.status,
        totalFee: eduEnrollment.totalFee,
        paidAmount: eduEnrollment.paidAmount,
        createdAt: eduEnrollment.createdAt,
      })
      .from(eduEnrollment)
      .innerJoin(eduClass, eq(eduEnrollment.classId, eduClass.id))
      .innerJoin(eduTerm, eq(eduClass.termId, eduTerm.id))
      .where(and(eq(eduEnrollment.studentId, userId), isNull(eduEnrollment.deletedAt)))
      .orderBy(desc(eduEnrollment.createdAt))
      .limit(50)
    const payments = await db
      .select({
        id: eduPaymentRecord.id,
        enrollmentClassId: eduPaymentRecord.classId,
        amount: eduPaymentRecord.amount,
        paymentDate: eduPaymentRecord.paymentDate,
        paymentMethod: eduPaymentRecord.paymentMethod,
        status: eduPaymentRecord.status,
        receiptNo: eduPaymentRecord.receiptNo,
        remark: eduPaymentRecord.remark,
        createdAt: eduPaymentRecord.createdAt,
      })
      .from(eduPaymentRecord)
      .where(and(eq(eduPaymentRecord.studentId, userId), isNull(eduPaymentRecord.deletedAt)))
      .orderBy(desc(eduPaymentRecord.createdAt))
      .limit(20)
    // 账期视图:学生/家长自助页要回答"哪一期、什么时候到期、还差多少",
    // 而这些数字必须由账目出口给,不得由前端拿 totalFee - paidAmount 自己算
    // (前端自算是第三个口径,本仓已因"三处各算一遍"出过一次催缴对象错人的事故)。
    // 逐条查的代价:上面 enrollments 已 limit(50),最坏 50 次轻量查询,自助页可接受。
    const ledgers = await Promise.all(
      enrollments.map(async (e) => ({
        enrollmentId: e.id,
        ledger: await loadEnrollmentLedger(e.id),
      })),
    )
    return reply.send(success({ enrollments, payments, ledgers }))
  })
}

/**
 * 遗留表历史账段组装(G-816106 ⑤,拍板 2026-10-07)。抽成纯函数的理由与缴费契约同:
 * 「legacy 段每行必带 source:'legacy' + 自己的操作日志;没日志的行给空数组而不是 undefined」
 * 这条形状约定,翻坏时 typecheck 不响(web 端 `p.logs.map` 直接炸),必须有一条不连库
 * 就能钉住的断言(测试见 apps/api/tests/edu-legacy-paylog-contract.test.ts)。
 * 口径边界:遗留行只读展示、不参与欠费/汇总;分组保持入参顺序(SQL 侧已按 createTime 升序)。
 */
export interface LegacyPayRow {
  payId: number
  userUuid: string
  courseId: number
  orderNo: string | null
  amount: number
  status: number
  createTime: Date | null
}
export interface LegacyPayLogRow {
  payId: number
  action: string
  detail: string | null
  createTime: Date | null
}
export function buildLegacySegment(
  pays: LegacyPayRow[],
  logs: LegacyPayLogRow[],
  total: number,
): {
  source: 'legacy'
  total: number
  list: Array<LegacyPayRow & { source: 'legacy'; logs: Array<Omit<LegacyPayLogRow, 'payId'>> }>
} {
  const logsByPay = new Map<
    number,
    { action: string; detail: string | null; createTime: Date | null }[]
  >()
  for (const l of logs) {
    const arr = logsByPay.get(l.payId)
    if (arr) arr.push({ action: l.action, detail: l.detail, createTime: l.createTime })
    else logsByPay.set(l.payId, [{ action: l.action, detail: l.detail, createTime: l.createTime }])
  }
  return {
    source: 'legacy' as const,
    total,
    list: pays.map((p) => ({
      ...p,
      source: 'legacy' as const,
      logs: logsByPay.get(p.payId) ?? [],
    })),
  }
}

/**
 * 供测试 import 的判据出口(§22c)。
 * 为什么必须导出而不是"跑一次 HTTP 看看":缴费契约在 2026-09-29 从
 * 「studentId/classId 必填」翻成「enrollmentId 必填」—— 翻错或被人改回去时,
 * 前端与 ai-service 两侧都会静默 400,而 typecheck 与其余门都不响(旧版就是这个形状:
 * 弹窗发三个自由文本、后端要 uuid,那个按钮从来没有成功过一次,账面全绿)。
 * 所以这条契约需要一条不连库就能钉住的断言。
 */
export const __test__ = {
  createPaymentRecordSchema,
  createFeeReminderSchema,
  batchFeeReminderSchema,
  generateFeeScheduleSchema,
  feeReminderStatsSchema,
  buildLegacySegment,
  // 2026-11-04 考勤 status 枚举闸(§22c:镜像测试直接 import 源件实例,不在测试里抄取值表)
  attendanceStatusFilter,
  attendanceListQuerySchema,
  childAttendanceQuerySchema,
  // 2026-11-04 写面收口:status 已从入参删除 ⇒ 必须能被测试直接 import 钉住(不靠跑 HTTP 看形状)
  updateAttendanceSchema,
}

export default eduAiManagementRoutes
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
