import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, and, desc, isNull, between, gte, lte, count, sql } from 'drizzle-orm'
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
  eduLeaveRequest,
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
// 路由
// =============================================================================

const eduAiManagementRoutes: FastifyPluginAsync = async (server) => {
  // ===========================================================================
  // 1. 学期管理 CRUD
  // ===========================================================================

  server.get('/term', async (_request, reply) => {
    const list = await db
      .select()
      .from(eduTerm)
      .orderBy(desc(eduTerm.isCurrent), desc(eduTerm.startDate))
    return reply.send(success({ list }))
  })

  server.get('/term/:id', async (request, reply) => {
    const parsed = uuidParamSchema.safeParse(request.params)
    if (!parsed.success) return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [row] = await db.select().from(eduTerm).where(eq(eduTerm.id, parsed.data.id)).limit(1)
    if (!row) return reply.status(404).send(error(404, '学期不存在'))
    return reply.send(success({ term: row }))
  })

  server.post('/term', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const parsed = createTermSchema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
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
    if (!idParsed.success) return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    const parsed = updateTermSchema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [existing] = await db.select().from(eduTerm).where(eq(eduTerm.id, idParsed.data.id)).limit(1)
    if (!existing) return reply.status(404).send(error(404, '学期不存在'))
    if (parsed.data.isCurrent) {
      await db.update(eduTerm).set({ isCurrent: false })
    }
    const [row] = await db.update(eduTerm).set({ ...parsed.data, updatedAt: new Date() }).where(eq(eduTerm.id, idParsed.data.id)).returning()
    return reply.send(success({ term: row }))
  })

  server.delete('/term/:id', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const parsed = uuidParamSchema.safeParse(request.params)
    if (!parsed.success) return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [existing] = await db.select().from(eduTerm).where(eq(eduTerm.id, parsed.data.id)).limit(1)
    if (!existing) return reply.status(404).send(error(404, '学期不存在'))
    await db.delete(eduTerm).where(eq(eduTerm.id, parsed.data.id))
    return reply.send(success({ deleted: true }))
  })

  // ===========================================================================
  // 2. 班级管理 CRUD
  // ===========================================================================

  server.get('/class', async (request, reply) => {
    const parsed = classListQuerySchema.safeParse(request.query)
    if (!parsed.success) return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const conds: any[] = []
    if (parsed.data.termId) conds.push(eq(eduClass.termId, parsed.data.termId))
    const where = conds.length > 0 ? and(...conds) : undefined
    const list = await db.select().from(eduClass).where(where).orderBy(desc(eduClass.createdAt))
    return reply.send(success({ list }))
  })

  server.get('/class/:id', async (request, reply) => {
    const parsed = uuidParamSchema.safeParse(request.params)
    if (!parsed.success) return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [row] = await db.select().from(eduClass).where(eq(eduClass.id, parsed.data.id)).limit(1)
    if (!row) return reply.status(404).send(error(404, '班级不存在'))
    return reply.send(success({ class: row }))
  })

  server.post('/class', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const parsed = createClassSchema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [row] = await db.insert(eduClass).values(parsed.data).returning()
    return reply.status(201).send(success({ class: row }))
  })

  server.put('/class/:id', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const idParsed = uuidParamSchema.safeParse(request.params)
    if (!idParsed.success) return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    const parsed = updateClassSchema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [existing] = await db.select().from(eduClass).where(eq(eduClass.id, idParsed.data.id)).limit(1)
    if (!existing) return reply.status(404).send(error(404, '班级不存在'))
    const [row] = await db.update(eduClass).set({ ...parsed.data, updatedAt: new Date() }).where(eq(eduClass.id, idParsed.data.id)).returning()
    return reply.send(success({ class: row }))
  })

  server.delete('/class/:id', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const parsed = uuidParamSchema.safeParse(request.params)
    if (!parsed.success) return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [existing] = await db.select().from(eduClass).where(eq(eduClass.id, parsed.data.id)).limit(1)
    if (!existing) return reply.status(404).send(error(404, '班级不存在'))
    await db.delete(eduClass).where(eq(eduClass.id, parsed.data.id))
    return reply.send(success({ deleted: true }))
  })

  // ===========================================================================
  // 3. 课程条目 CRUD
  // ===========================================================================

  server.get('/schedule', async (request, reply) => {
    const parsed = scheduleListQuerySchema.safeParse(request.query)
    if (!parsed.success) return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
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
    if (!parsed.success) return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
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
    if (!parsed.success) return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [row] = await db.insert(eduCourseSchedule).values(parsed.data).returning()
    return reply.status(201).send(success({ schedule: row }))
  })

  server.put('/schedule/:id', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const idParsed = uuidParamSchema.safeParse(request.params)
    if (!idParsed.success) return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    const parsed = updateScheduleSchema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
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
    if (!parsed.success) return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
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
  // 4. 每日菜谱 CRUD
  // ===========================================================================

  server.get('/meal', async (request, reply) => {
    const parsed = mealListQuerySchema.safeParse(request.query)
    if (!parsed.success) return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
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
    const list = await db
      .select()
      .from(eduMealRecipe)
      .where(where)
      .orderBy(eduMealRecipe.date, eduMealRecipe.mealType)
    return reply.send(success({ list }))
  })

  server.get('/meal/:id', async (request, reply) => {
    const parsed = uuidParamSchema.safeParse(request.params)
    if (!parsed.success) return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
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
    if (!parsed.success) return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [row] = await db.insert(eduMealRecipe).values(parsed.data).returning()
    return reply.status(201).send(success({ meal: row }))
  })

  server.put('/meal/:id', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const idParsed = uuidParamSchema.safeParse(request.params)
    if (!idParsed.success) return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    const parsed = updateMealSchema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
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
    if (!parsed.success) return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
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
    if (!parsed.success) return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const conds: any[] = []
    if (parsed.data.name) conds.push(eq(eduMealWeekTemplate.name, parsed.data.name))
    const where = conds.length > 0 ? and(...conds) : undefined
    const list = await db
      .select()
      .from(eduMealWeekTemplate)
      .where(where)
      .orderBy(eduMealWeekTemplate.name, eduMealWeekTemplate.weekday, eduMealWeekTemplate.mealType)
    return reply.send(success({ list }))
  })

  server.get('/meal/template/:id', async (request, reply) => {
    const parsed = uuidParamSchema.safeParse(request.params)
    if (!parsed.success) return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [row] = await db.select().from(eduMealWeekTemplate).where(eq(eduMealWeekTemplate.id, parsed.data.id)).limit(1)
    if (!row) return reply.status(404).send(error(404, '模板不存在'))
    return reply.send(success({ template: row }))
  })

  server.post('/meal/template', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const parsed = createTemplateSchema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [row] = await db.insert(eduMealWeekTemplate).values(parsed.data).returning()
    return reply.status(201).send(success({ template: row }))
  })

  server.put('/meal/template/:id', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const idParsed = uuidParamSchema.safeParse(request.params)
    if (!idParsed.success) return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    const parsed = updateTemplateSchema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [existing] = await db.select().from(eduMealWeekTemplate).where(eq(eduMealWeekTemplate.id, idParsed.data.id)).limit(1)
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
    if (!parsed.success) return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [existing] = await db.select().from(eduMealWeekTemplate).where(eq(eduMealWeekTemplate.id, parsed.data.id)).limit(1)
    if (!existing) return reply.status(404).send(error(404, '模板不存在'))
    await db.delete(eduMealWeekTemplate).where(eq(eduMealWeekTemplate.id, parsed.data.id))
    return reply.send(success({ deleted: true }))
  })

  // 应用模板到指定周
  server.post('/meal/apply-template', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const parsed = applyTemplateSchema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
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
  // 6. 学习计划 CRUD + 月→周拆解
  // ===========================================================================

  server.get('/study-plan', async (request, reply) => {
    const parsed = planListQuerySchema.safeParse(request.query)
    if (!parsed.success) return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const conds = [isNull(eduStudyPlan.deletedAt)]
    if (parsed.data.classId) conds.push(eq(eduStudyPlan.classId, parsed.data.classId))
    if (parsed.data.termId) conds.push(eq(eduStudyPlan.termId, parsed.data.termId))
    if (parsed.data.planType) conds.push(eq(eduStudyPlan.planType, parsed.data.planType))
    if (parsed.data.status) conds.push(eq(eduStudyPlan.status, parsed.data.status))
    const where = and(...conds)
    const list = await db
      .select()
      .from(eduStudyPlan)
      .where(where)
      .orderBy(desc(eduStudyPlan.createdAt))
    return reply.send(success({ list }))
  })

  server.get('/study-plan/:id', async (request, reply) => {
    const parsed = uuidParamSchema.safeParse(request.params)
    if (!parsed.success) return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
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
    if (!parsed.success) return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [row] = await db.insert(eduStudyPlan).values({ ...parsed.data, creatorId: request.userId! }).returning()
    return reply.status(201).send(success({ plan: row }))
  })

  server.put('/study-plan/:id', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const idParsed = uuidParamSchema.safeParse(request.params)
    if (!idParsed.success) return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    const parsed = updatePlanSchema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
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
    if (!parsed.success) return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
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
    if (!idParsed.success) return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
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
    let weekStart = new Date(start)

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
    if (!idParsed.success) return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
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
    if (!idParsed.success) return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    const parsed = createPlanItemSchema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [row] = await db.insert(eduPlanItem).values({ ...parsed.data, planId: idParsed.data.id }).returning()
    return reply.status(201).send(success({ item: row }))
  })

  server.put('/plan-item/:id', async (request, reply) => {
    const idParsed = uuidParamSchema.safeParse(request.params)
    if (!idParsed.success) return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    const parsed = updatePlanItemSchema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
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
    if (!idParsed.success) return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
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
  // 8. 签到记录 CRUD + 签到/签退 + 统计
  // ===========================================================================

  // 出勤统计（需在 :id 路由前注册）
  server.get('/attendance/stats', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const parsed = attendanceStatsQuerySchema.safeParse(request.query)
    if (!parsed.success) return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))

    const conds: any[] = [isNull(eduAttendanceRecord.deletedAt)]
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

      periodBreakdown = await db
        .select({
          period: periodExpr,
          status: eduAttendanceRecord.status,
          count: count(),
        })
        .from(eduAttendanceRecord)
        .where(where)
        .groupBy(periodExpr, eduAttendanceRecord.status)
        .orderBy(periodExpr) as Array<{ period: string; status: string; count: number }>
    }

    return reply.send(success({ total, attendanceRate, statusBreakdown, periodBreakdown }))
  })

  server.get('/attendance', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const parsed = attendanceListQuerySchema.safeParse(request.query)
    if (!parsed.success) return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const conds: any[] = [isNull(eduAttendanceRecord.deletedAt)]
    if (parsed.data.studentId) conds.push(eq(eduAttendanceRecord.studentId, parsed.data.studentId))
    if (parsed.data.classId) conds.push(eq(eduAttendanceRecord.classId, parsed.data.classId))
    if (parsed.data.date) conds.push(eq(eduAttendanceRecord.date, parsed.data.date))
    if (parsed.data.status) conds.push(eq(eduAttendanceRecord.status, parsed.data.status))
    const where = and(...conds)
    const list = await db
      .select()
      .from(eduAttendanceRecord)
      .where(where)
      .orderBy(desc(eduAttendanceRecord.date), desc(eduAttendanceRecord.createdAt))
    return reply.send(success({ list }))
  })

  server.post('/attendance/check-in', async (request, reply) => {
    const parsed = checkInSchema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))

    const now = new Date()
    const today = now.toISOString().split('T')[0]!
    const date = parsed.data.date || today

    // 检查是否已签到
    const [existing] = await db
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
    if (existing) return reply.status(409).send(error(409, '该学生今日已签到'))

    const [row] = await db
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
    return reply.status(201).send(success({ record: row }))
  })

  server.put('/attendance/check-out', async (request, reply) => {
    const parsed = checkOutSchema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))

    const [existing] = await db
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
    if (!existing) return reply.status(404).send(error(404, '未找到签到记录'))
    if (existing.checkOutTime) return reply.status(409).send(error(409, '该学生今日已签退'))

    const [row] = await db
      .update(eduAttendanceRecord)
      .set({
        checkOutTime: new Date(),
        checkOutMethod: parsed.data.checkOutMethod || 'manual',
        updatedAt: new Date(),
      })
      .where(eq(eduAttendanceRecord.id, existing.id))
      .returning()
    return reply.send(success({ record: row }))
  })

  server.put('/attendance/:id', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const idParsed = uuidParamSchema.safeParse(request.params)
    if (!idParsed.success) return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    const parsed = updateAttendanceSchema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [existing] = await db
      .select()
      .from(eduAttendanceRecord)
      .where(and(eq(eduAttendanceRecord.id, idParsed.data.id), isNull(eduAttendanceRecord.deletedAt)))
      .limit(1)
    if (!existing) return reply.status(404).send(error(404, '签到记录不存在'))
    const updates: Record<string, unknown> = { ...parsed.data, updatedAt: new Date() }
    // 将字符串时间转为 Date 对象
    if (typeof updates.checkInTime === 'string') updates.checkInTime = new Date(updates.checkInTime as string)
    if (typeof updates.checkOutTime === 'string') updates.checkOutTime = new Date(updates.checkOutTime as string)
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
    if (!parsed.success) return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
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
    if (!parsed.success) return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const conds: any[] = [isNull(eduLeaveRequest.deletedAt)]
    if (parsed.data.studentId) conds.push(eq(eduLeaveRequest.studentId, parsed.data.studentId))
    if (parsed.data.classId) conds.push(eq(eduLeaveRequest.classId, parsed.data.classId))
    if (parsed.data.status) conds.push(eq(eduLeaveRequest.status, parsed.data.status))
    if (parsed.data.startDate && parsed.data.endDate) {
      conds.push(
        and(
          gte(eduLeaveRequest.endDate, parsed.data.startDate),
          lte(eduLeaveRequest.startDate, parsed.data.endDate),
        ),
      )
    } else if (parsed.data.startDate) {
      conds.push(gte(eduLeaveRequest.startDate, parsed.data.startDate))
    } else if (parsed.data.endDate) {
      conds.push(lte(eduLeaveRequest.endDate, parsed.data.endDate))
    }
    const where = and(...conds)
    const list = await db
      .select()
      .from(eduLeaveRequest)
      .where(where)
      .orderBy(desc(eduLeaveRequest.createdAt))
    return reply.send(success({ list }))
  })

  server.post('/leave', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const parsed = createLeaveSchema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [row] = await db.insert(eduLeaveRequest).values(parsed.data).returning()
    return reply.status(201).send(success({ leave: row }))
  })

  server.put('/leave/:id', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const idParsed = uuidParamSchema.safeParse(request.params)
    if (!idParsed.success) return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    const parsed = updateLeaveSchema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
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
    if (!idParsed.success) return reply.status(400).send(error(400, idParsed.error.issues[0]?.message ?? '参数错误'))
    const parsed = approveLeaveSchema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    const [existing] = await db
      .select()
      .from(eduLeaveRequest)
      .where(and(eq(eduLeaveRequest.id, idParsed.data.id), isNull(eduLeaveRequest.deletedAt)))
      .limit(1)
    if (!existing) return reply.status(404).send(error(404, '请假申请不存在'))
    if (existing.status !== 'pending') return reply.status(400).send(error(400, '仅待审批的申请可审批'))
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
    if (!parsed.success) return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
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

  }

export default eduAiManagementRoutes