// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { z } from 'zod'

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

// =============================================================================
// 通用 Zod schemas
// =============================================================================

export const uuidParamSchema = z.object({ id: z.string().uuid('无效的 ID') })
/** `:childId` 形态的同一把形状闸(与 uuidParamSchema 同判据,只换键名)。 */
export const childIdParamSchema = z.object({ childId: z.string().uuid('无效的 childId') })

// =============================================================================
// 1. 学期管理 (edu_term)
// =============================================================================

export const createTermSchema = z.object({
  name: z.string().min(1).max(100),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  isCurrent: z.boolean().optional(),
})

export const updateTermSchema = createTermSchema.partial()

// =============================================================================
// 2. 班级管理 (edu_class)
// =============================================================================

export const classListQuerySchema = z.object({
  termId: z.transform(emptyToUndefined).pipe(z.string().uuid().optional()),
})

export const createClassSchema = z.object({
  termId: z.string().uuid(),
  name: z.string().min(1).max(100),
  grade: z.string().max(50).optional(),
})

export const updateClassSchema = createClassSchema.partial()

// =============================================================================
// 3. 课程条目 (edu_course_schedule)
// =============================================================================

export const scheduleListQuerySchema = z.object({
  termId: z.transform(emptyToUndefined).pipe(z.string().uuid().optional()),
  classId: z.transform(emptyToUndefined).pipe(z.string().uuid().optional()),
  weekday: z.transform(emptyToUndefined).pipe(z.coerce.number().int().min(1).max(7).optional()),
})

export const createScheduleSchema = z.object({
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

export const updateScheduleSchema = createScheduleSchema.partial()

// =============================================================================
// 4. 每日菜谱 (edu_meal_recipe)
// =============================================================================

export const mealListQuerySchema = z.object({
  startDate: z.transform(emptyToUndefined).pipe(z.string().optional()),
  endDate: z.transform(emptyToUndefined).pipe(z.string().optional()),
  mealType: z.transform(emptyToUndefined).pipe(z.string().max(20).optional()),
})

export const createMealSchema = z.object({
  date: z.string().min(1),
  mealType: z.string().min(1).max(20),
  dishName: z.string().min(1).max(200),
  ingredients: z.string().optional(),
  nutrition: z.string().max(500).optional(),
  imageUrl: z.string().max(500).optional(),
  notes: z.string().optional(),
})

export const updateMealSchema = createMealSchema.partial()

// =============================================================================
// 5. 周菜谱模板 (edu_meal_week_template)
// =============================================================================

export const templateListQuerySchema = z.object({
  name: z.transform(emptyToUndefined).pipe(z.string().max(100).optional()),
})

export const createTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  weekday: z.number().int().min(1).max(7),
  mealType: z.string().min(1).max(20),
  dishName: z.string().min(1).max(200),
  ingredients: z.string().optional(),
  nutrition: z.string().max(500).optional(),
})

export const updateTemplateSchema = createTemplateSchema.partial()

export const applyTemplateSchema = z.object({
  templateName: z.string().min(1).max(100),
  startDate: z.string().min(1),
})

// =============================================================================
// 3b. 课程表新增功能
// =============================================================================

export const copyLastWeekSchema = z.object({
  classId: z.string().uuid(),
  targetWeekStart: z.string().min(1), // 目标周周一日期 YYYY-MM-DD
})

export const checkTeacherConflictSchema = z.object({
  teacher: z.string().min(1).max(100),
  weekday: z.number().int().min(1).max(7),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, '时间格式 HH:mm'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, '时间格式 HH:mm'),
  excludeScheduleId: z.string().uuid().optional(),
})

export const scheduleExportQuerySchema = z.object({
  classId: z.string().uuid(),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
})

// =============================================================================
// 4b. 菜谱新增功能
// =============================================================================

export const nutritionSummaryQuerySchema = z.object({
  startDate: z.string().min(1),
  endDate: z.string().min(1),
})

export const generateShoppingListSchema = z.object({
  startDate: z.string().min(1),
  endDate: z.string().min(1),
})

export const uploadImageSchema = z.object({
  id: z.string().uuid(),
  imageUrl: z.string().min(1).max(500),
})

// =============================================================================
// 6b. 学习计划新增功能
// =============================================================================

export const completionStatsQuerySchema = z.object({
  classId: z.string().uuid(),
  termId: z.string().uuid(),
})

export const progressTimelineQuerySchema = z.object({
  planId: z.string().uuid(),
})

export const reviewItemSchema = z.object({
  notes: z.string().optional(),
  reviewed: z.boolean().optional(),
})

// =============================================================================
// 6. 学习计划 (edu_study_plan) + 计划条目 (edu_plan_item)
// =============================================================================

export const planListQuerySchema = z.object({
  classId: z.transform(emptyToUndefined).pipe(z.string().uuid().optional()),
  termId: z.transform(emptyToUndefined).pipe(z.string().uuid().optional()),
  planType: z.transform(emptyToUndefined).pipe(z.string().max(20).optional()),
  status: z.transform(emptyToUndefined).pipe(z.string().max(20).optional()),
})

export const createPlanSchema = z.object({
  title: z.string().min(1).max(200),
  planType: z.enum(['monthly', 'weekly']),
  classId: z.string().uuid(),
  termId: z.string().uuid(),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  description: z.string().optional(),
  status: z.string().max(20).optional(),
})

export const updatePlanSchema = createPlanSchema.partial()

export const createPlanItemSchema = z.object({
  content: z.string().min(1),
  objective: z.string().max(500).optional(),
  dueDate: z.string().optional(),
  studentId: z.string().uuid().optional(),
  parentItemId: z.string().uuid().optional(),
  notes: z.string().optional(),
  sortOrder: z.number().int().optional(),
})

export const updatePlanItemSchema = createPlanItemSchema.partial().extend({
  completed: z.boolean().optional(),
})

// =============================================================================
// 8. 签到记录 (edu_attendance_record)
// =============================================================================

/**
 * 教师代签入参(2026-11 收口:status 字段已删 —— 状态一律服务端按该班规则 + judgeStatus 现算,
 * 不接受客户端自报;zod 默认 strip 未知键,老客户端继续传 status 只会被静默忽略,不会 400)。
 * checkInTime 为可选 ISO 时刻:当日签到可不传(取服务器 now);回填历史日期必须显式提供且落在该日内。
 */
export const checkInSchema = z.object({
  studentId: z.string().uuid(),
  classId: z.string().uuid(),
  date: z.string().optional(),
  checkInMethod: z.string().max(20).optional(),
  checkInTime: z.transform(emptyToUndefined).pipe(z.string().optional()),
  remark: z.string().optional(),
})

export const checkOutSchema = z.object({
  studentId: z.string().uuid(),
  classId: z.string().uuid(),
  date: z.string().min(1),
  checkOutMethod: z.string().max(20).optional(),
})

export const attendanceStatsQuerySchema = z.object({
  classId: z.transform(emptyToUndefined).pipe(z.string().uuid().optional()),
  startDate: z.transform(emptyToUndefined).pipe(z.string().optional()),
  endDate: z.transform(emptyToUndefined).pipe(z.string().optional()),
  period: z.transform(emptyToUndefined).pipe(z.enum(['daily', 'weekly', 'monthly']).optional()),
})

// --- 2026-11-08 考勤补齐:批量点名 / 导出 / 学生自签 / 扫码签到 -----------------

/**
 * 考勤导出入参。format 只认 csv —— 未登记的格式回 400 点名,不静默回落成 csv(§0.3)。
 * classId 必填:导出是全班名册级数据,不给"无班级=全库"留口子。
 */
export const attendanceExportQuerySchema = z.object({
  classId: z.string().uuid(),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  format: z.enum(['csv']).default('csv'),
})

export const attendanceQrCodeQuerySchema = z.object({
  classId: z.string().uuid(),
})

/**
 * 扫码签到入参:只收 token —— classId 包含在教师端出码的 HMAC 载荷里
 * (buildAttendanceQrToken 签名覆盖 classId|exp,学生端不得再自报班级,防"拿 A 班码签 B 班")。
 * token 长度上限 2048 防"巨型 base64 进 HMAC 前解析";身份同样只取 request.userId。
 */
export const qrcodeCheckInSchema = z.object({
  token: z.string().min(1).max(2048),
})

// --- 考勤规则配置入口(2026-11-08 本票①:此前无任何端点可写 edu_attendance_rule,
//     导致 qrSecret 恒空、扫码档结构上不可用,迟到阈值也无据可判) -------------------

export const attendanceRuleQuerySchema = z.object({
  classId: z.string().uuid(),
})

/**
 * 规则 upsert 入参:三个阈值只声明为非空字符串,合法形态交 normalizeHm 单源裁决
 * (返回 null ⇒ 400 点名原值,不静默回落,§0.3)。
 */
export const attendanceRuleUpsertSchema = z.object({
  classId: z.string().uuid(),
  lateAfter: z.string().min(1).optional(),
  earlyBefore: z.string().min(1).optional(),
  absentAfter: z.string().min(1).optional(),
  enabled: z.boolean().optional(),
})

export const rotateQrSecretSchema = z.object({
  classId: z.string().uuid(),
})

// =============================================================================
// 9. 请假申请 (edu_leave_request)
// =============================================================================

export const leaveListQuerySchema = z.object({
  studentId: z.transform(emptyToUndefined).pipe(z.string().uuid().optional()),
  classId: z.transform(emptyToUndefined).pipe(z.string().uuid().optional()),
  status: z.transform(emptyToUndefined).pipe(z.string().max(20).optional()),
  startDate: z.transform(emptyToUndefined).pipe(z.string().optional()),
  endDate: z.transform(emptyToUndefined).pipe(z.string().optional()),
})

export const createLeaveSchema = z.object({
  studentId: z.string().uuid(),
  classId: z.string().uuid(),
  leaveType: z.enum(['sick', 'personal', 'emergency', 'other']),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  totalDays: z.number().int().min(1),
  reason: z.string().min(1),
  attachment: z.string().max(500).optional(),
})

export const updateLeaveSchema = createLeaveSchema.partial()

export const approveLeaveSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  approveRemark: z.string().optional(),
})

// =============================================================================
// 10. 家长-学生绑定管理 (edu_parent_student_binding)
// =============================================================================

export const createBindingSchema = z.object({
  studentId: z.string().uuid(),
  relationship: z.enum(['father', 'mother', 'guardian', 'other']),
})

export const updateBindingSchema = z.object({
  relationship: z.enum(['father', 'mother', 'guardian', 'other']).optional(),
  status: z.enum(['confirmed', 'rejected']).optional(),
})

export const bindingListQuerySchema = z.object({
  status: z.transform(emptyToUndefined).pipe(z.string().max(20).optional()),
})
