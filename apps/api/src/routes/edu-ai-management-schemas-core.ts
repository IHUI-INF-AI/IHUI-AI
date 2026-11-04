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
export const attendanceStatusFilter = z.enum(
  ['present', 'late', 'early', 'absent', 'leave'],
  'status 仅支持 present/late/early/absent/leave',
)

export const attendanceListQuerySchema = z.object({
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
export const updateAttendanceSchema = z.object({
  checkInTime: z.string().optional(),
  checkOutTime: z.string().optional(),
  checkInMethod: z.string().max(20).optional(),
  checkOutMethod: z.string().max(20).optional(),
  remark: z.string().optional(),
})

export const attendanceStatsQuerySchema = z.object({
  classId: z.transform(emptyToUndefined).pipe(z.string().uuid().optional()),
  startDate: z.transform(emptyToUndefined).pipe(z.string().optional()),
  endDate: z.transform(emptyToUndefined).pipe(z.string().optional()),
  period: z.transform(emptyToUndefined).pipe(z.enum(['daily', 'weekly', 'monthly']).optional()),
})

// --- 2026-11-08 考勤补齐:批量点名 / 导出 / 学生自签 / 扫码签到 -----------------

/** 考勤日期列口径(与 edu_attendance_record.date 的 YYYY-MM-DD 一致,不接受其他形态)。 */
export const attendanceDateSchema = z.transform(emptyToUndefined).pipe(
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
export const batchCheckInSchema = z.object({
  classId: z.string().uuid(),
  date: attendanceDateSchema,
  checkInTime: z.transform(emptyToUndefined).pipe(z.string().optional()),
  remark: z.string().max(500).optional(),
})

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

/**
 * 学生自签入参:**没有 studentId、也没有 classId** —— 身份只从登录态 request.userId 取,
 * 班级归属由服务端按在册关系现取(AGENTS §5:归属主体由承载层显式传入,不得信客户端自报;
 * 此前要求客户端传 classId 已实测造成小程序 400 / RN 死结 / Web 手输 UUID 三处伤害)。
 * 客户端硬塞的 classId 会被 zod 默认 strip 静默忽略(生效班级以服务端现取结果为准并回显)。
 * 若日后要支持家长代签,另开端点显式校验 edu_parent_student_binding,不得在这里加可选字段。
 */
export const selfCheckInSchema = z.object({
  date: attendanceDateSchema,
  remark: z.string().max(500).optional(),
})

/**
 * 学生本人考勤查询入参:三个日期档一律走同一把 attendanceDateSchema 形状闸,
 * 不在这里另写第二份正则(§0.6 单一真相源)。刻意**不含 studentId**:
 * 归属主体只从登录态 request.userId 取,客户端自报一律被 zod strip 静默忽略(AGENTS §5)。
 */
export const myAttendanceQuerySchema = z.object({
  date: attendanceDateSchema,
  startDate: attendanceDateSchema,
  endDate: attendanceDateSchema,
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

// =============================================================================
// 11. 孩子数据查看（家长端）
// =============================================================================

export const childAttendanceQuerySchema = z.object({
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
