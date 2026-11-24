// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 培训服务(2026-11-24 八波)。纯核(enrollPlanGate/enrollmentTransition/sumHours)
 * 单测钉死;DB 编排层薄。判据口径见 schema 头注(快照防漂移/批量幂等/终态纪律)。
 */
import { and, asc, eq, inArray, sql } from 'drizzle-orm'

import { db } from '../db/index.js'
import {
  hrEmployee,
  hrTrainingCourse,
  hrTrainingEnrollment,
  hrTrainingPlan,
  type HrTrainingEnrollment,
} from '@ihui/database'
import { AppError } from '../errors/AppError.js'

/** 学时换算统一"十分之一小时"整数口径(0.5h ⇒ 5),聚合无浮点 */
export function hoursToTenths(value: string | number): number {
  const n = typeof value === 'number' ? value : Number.parseFloat(value)
  if (!Number.isFinite(n) || n < 0 || n > 9999) {
    throw new AppError(`学时非法:${value}(须 0~9999 之间的小时数)`, 400, 'TRAINING_HOURS_INVALID')
  }
  return Math.round(n * 10)
}

export function tenthsToHours(tenths: number): string {
  return (tenths / 10).toFixed(1)
}

/** 完成/重开状态机纯核 */
export function enrollmentTransition(
  row: Pick<HrTrainingEnrollment, 'status'>,
  action: 'complete' | 'drop' | 'reopen',
): { status: string; snapshotHours: boolean } {
  switch (action) {
    case 'complete':
      if (row.status !== 'enrolled') {
        throw new AppError(`状态 ${row.status} 不可完成(只有 enrolled 可行)`, 409, 'TRAINING_STATE_LOCK')
      }
      return { status: 'completed', snapshotHours: true }
    case 'drop':
      if (row.status === 'completed') {
        throw new AppError('已完成不可撤销为放弃(历史台账要保真;确需更正请重新注册新课次)', 409, 'TRAINING_COMPLETED_LOCK')
      }
      if (row.status === 'dropped') return { status: 'dropped', snapshotHours: false }
      return { status: 'dropped', snapshotHours: false }
    case 'reopen':
      if (row.status !== 'dropped') {
        throw new AppError('只有已放弃的报名可重新激活', 409, 'TRAINING_STATE_LOCK')
      }
      return { status: 'enrolled', snapshotHours: false }
  }
}

/** 报名计划闸:仅 open 计划可投单(draft 未开、closed 收口) */
export function assertPlanOpen(planStatus: string): void {
  if (planStatus !== 'open') {
    throw new AppError(`培训计划状态 ${planStatus} 不接受报名(需 open)`, 409, 'TRAINING_PLAN_NOT_OPEN')
  }
}

/** 批量报名去重纯核:返回 (去重后的新对, 重复点名) */
export function dedupeEnrollments(
  assignments: ReadonlyArray<{ employeeId: string, courseId: string }>,
  existing: ReadonlySet<string>,
): Array<{ employeeId: string, courseId: string }> & { skipped: string[] } {
  const seenLocal = new Set<string>()
  const fresh: Array<{ employeeId: string, courseId: string }> = []
  const skipped: string[] = []
  for (const a of assignments) {
    const key = `${a.employeeId}|${a.courseId}`
    if (existing.has(key)) {
      skipped.push(`${a.employeeId}:已是该课程学员,幂等跳过`)
      continue
    }
    if (seenLocal.has(key)) {
      skipped.push(`${a.employeeId}:本批内重复,丢弃后一条`)
      continue
    }
    seenLocal.add(key)
    fresh.push(a)
  }
  return Object.assign(fresh, { skipped })
}

export function sumEnrolledHours(
  rows: ReadonlyArray<{ hoursAtCompletion: string | number | null }>,
): string {
  let tenths = 0
  for (const r of rows) {
    if (r.hoursAtCompletion === null || r.hoursAtCompletion === undefined) continue
    tenths += hoursToTenths(r.hoursAtCompletion)
  }
  return tenthsToHours(tenths)
}

// ============================ 课程 ============================

export async function createCourse(input: {
  code: string
  name: string
  category?: string
  durationHours: string | number
  description?: string | null
}) {
  const t = hoursToTenths(input.durationHours)
  const [dup] = await db.select({ id: hrTrainingCourse.id }).from(hrTrainingCourse).where(eq(hrTrainingCourse.code, input.code))
  if (dup) throw new AppError(`课程编码 ${input.code} 已存在`, 409, 'TRAINING_CODE_EXISTS')
  const [row] = await db
    .insert(hrTrainingCourse)
    .values({
      code: input.code,
      name: input.name,
      category: input.category ?? 'general',
      durationHours: (t / 10).toFixed(1),
      description: input.description ?? null,
    })
    .returning()
  return row!
}

export async function listCourses(includeRetired = false) {
  const rows = await db.select().from(hrTrainingCourse).orderBy(asc(hrTrainingCourse.code))
  return includeRetired ? rows : rows.filter((r) => r.status === 'active')
}

export async function updateCourse(id: string, patch: { name?: string; durationHours?: string | number; description?: string | null; status?: 'active' | 'retired' }) {
  const [c] = await db.select().from(hrTrainingCourse).where(eq(hrTrainingCourse.id, id))
  if (!c) throw new AppError('课程不存在', 404, 'TRAINING_COURSE_NOT_FOUND')
  if (patch.status === 'retired') {
    // 停用不封历史:completed 台账仍可查,仅新报名被闸(在 enroll 处判)
  }
  const set: Record<string, unknown> = { updatedAt: new Date() }
  if (patch.name !== undefined) set.name = patch.name
  if (patch.description !== undefined) set.description = patch.description
  if (patch.status !== undefined) set.status = patch.status
  if (patch.durationHours !== undefined) {
    const t = hoursToTenths(patch.durationHours)
    // 改了时长影响后续完成的快照,历史 completed 不动
    set.durationHours = (t / 10).toFixed(1)
  }
  const [row] = await db.update(hrTrainingCourse).set(set).where(eq(hrTrainingCourse.id, id)).returning()
  return row!
}

// ============================ 计划 ============================

export async function createPlan(input: { name: string; startFrom: string; endTo: string; note?: string | null }) {
  if (input.endTo < input.startFrom) {
    throw new AppError('计划结束日不得早于开始日', 400, 'TRAINING_PLAN_RANGE')
  }
  const [dup] = await db.select({ id: hrTrainingPlan.id }).from(hrTrainingPlan).where(eq(hrTrainingPlan.name, input.name))
  if (dup) throw new AppError(`培训计划 ${input.name} 已存在`, 409, 'TRAINING_PLAN_EXISTS')
  const [row] = await db
    .insert(hrTrainingPlan)
    .values({ name: input.name, startFrom: input.startFrom, endTo: input.endTo, status: 'draft', note: input.note ?? null })
    .returning()
  return row!
}

const PLAN_FLOW: Record<string, string[]> = { draft: ['open'], open: ['closed'], closed: ['open'] }

export async function setPlanStatus(id: string, status: 'open' | 'closed') {
  const [p] = await db.select().from(hrTrainingPlan).where(eq(hrTrainingPlan.id, id))
  if (!p) throw new AppError('计划不存在', 404, 'TRAINING_PLAN_NOT_FOUND')
  if (!(PLAN_FLOW[p.status] ?? []).includes(status)) {
    throw new AppError(`计划状态 ${p.status} 不可到 ${status}。规则:draft→open→closed,可回开`, 409, 'TRAINING_PLAN_FLOW')
  }
  const [row] = await db.update(hrTrainingPlan).set({ status, updatedAt: new Date() }).where(eq(hrTrainingPlan.id, id)).returning()
  return row!
}

export async function listPlans(status?: string) {
  if (status) {
    return db.select().from(hrTrainingPlan).where(eq(hrTrainingPlan.status, status)).orderBy(asc(hrTrainingPlan.startFrom))
  }
  return db.select().from(hrTrainingPlan).orderBy(asc(hrTrainingPlan.startFrom))
}

// ============================ 报名/完成 ============================

export async function enroll(planId: string, assignments: Array<{ employeeId: string; courseId: string }>) {
  const [plan] = await db.select().from(hrTrainingPlan).where(eq(hrTrainingPlan.id, planId))
  if (!plan) throw new AppError('计划不存在', 404, 'TRAINING_PLAN_NOT_FOUND')
  assertPlanOpen(plan.status)
  const empIds = assignments.map((a) => a.employeeId)
  const courseIds = assignments.map((a) => a.courseId)
  const [emps, courses, existing] = await Promise.all([
    empIds.length
      ? db.select({ id: hrEmployee.id }).from(hrEmployee).where(inArray(hrEmployee.id, empIds))
      : Promise.resolve([]),
    courseIds.length
      ? db.select().from(hrTrainingCourse).where(inArray(hrTrainingCourse.id, courseIds))
      : Promise.resolve([]),
    planId && empIds.length
      ? db
          .select({ employeeId: hrTrainingEnrollment.employeeId, courseId: hrTrainingEnrollment.courseId })
          .from(hrTrainingEnrollment)
          .where(and(eq(hrTrainingEnrollment.planId, planId), inArray(hrTrainingEnrollment.employeeId, empIds)))
      : Promise.resolve([]),
  ])
  const empSet = new Set(emps.map((e) => e.id))
  const courseMap = new Map(courses.map((c) => [c.id, c]))
  const existingKeys = new Set(existing.map((r) => `${r.employeeId}|${r.courseId}`))
  const freshWithSkips = dedupeEnrollments(assignments, existingKeys)
  const skipped = [...freshWithSkips.skipped]
  const created: HrTrainingEnrollment[] = []
  for (const a of freshWithSkips) {
    if (!empSet.has(a.employeeId)) {
      skipped.push(`${a.employeeId}:员工不存在`)
      continue
    }
    const course = courseMap.get(a.courseId)
    if (!course) {
      skipped.push(`课程 ${a.courseId} 不存在`)
      continue
    }
    if (course.status !== 'active') {
      skipped.push(`${course.code}:已停用,不可新报名`)
      continue
    }
    const [row] = await db
      .insert(hrTrainingEnrollment)
      .values({ planId, employeeId: a.employeeId, courseId: a.courseId, status: 'enrolled' })
      .returning()
    created.push(row!)
  }
  return { created: created.length, skipped, ids: created.map((r) => r.id) }
}

export async function markCompleted(enrollmentId: string, note?: string | null) {
  const [row0] = await db.select().from(hrTrainingEnrollment).where(eq(hrTrainingEnrollment.id, enrollmentId))
  if (!row0) throw new AppError('报名不存在', 404, 'TRAINING_ENROLL_NOT_FOUND')
  const tr = enrollmentTransition(row0, 'complete')
  const [course] = await db.select().from(hrTrainingCourse).where(eq(hrTrainingCourse.id, row0.courseId))
  if (!course) throw new AppError('关联课程丢失,无法完成登记', 409, 'TRAINING_COURSE_MISSING')
  // 快照当前学时(十分之一小时口径写回 numeric 字符串)
  const snap = course.durationHours
  const [row] = await db
    .update(hrTrainingEnrollment)
    .set({
      status: tr.status,
      hoursAtCompletion: snap,
      completedAt: new Date(),
      note: note ?? row0.note,
      updatedAt: new Date(),
    })
    .where(eq(hrTrainingEnrollment.id, enrollmentId))
    .returning()
  return row!
}

export async function markDropped(enrollmentId: string, note?: string | null) {
  const [row0] = await db.select().from(hrTrainingEnrollment).where(eq(hrTrainingEnrollment.id, enrollmentId))
  if (!row0) throw new AppError('报名不存在', 404, 'TRAINING_ENROLL_NOT_FOUND')
  const tr = enrollmentTransition(row0, 'drop')
  const [row] = await db
    .update(hrTrainingEnrollment)
    .set({ status: tr.status, note: note ?? row0.note, updatedAt: new Date() })
    .where(eq(hrTrainingEnrollment.id, enrollmentId))
    .returning()
  return row!
}

export async function reopen(enrollmentId: string) {
  const [row0] = await db.select().from(hrTrainingEnrollment).where(eq(hrTrainingEnrollment.id, enrollmentId))
  if (!row0) throw new AppError('报名不存在', 404, 'TRAINING_ENROLL_NOT_FOUND')
  const tr = enrollmentTransition(row0, 'reopen')
  const [row] = await db
    .update(hrTrainingEnrollment)
    .set({ status: tr.status, completedAt: null, hoursAtCompletion: null, updatedAt: new Date() })
    .where(eq(hrTrainingEnrollment.id, enrollmentId))
    .returning()
  return row!
}

export async function employeeTrainingHours(employeeId: string) {
  const rows = await db
    .select()
    .from(hrTrainingEnrollment)
    .where(and(eq(hrTrainingEnrollment.employeeId, employeeId), eq(hrTrainingEnrollment.status, 'completed')))
  return {
    employeeId,
    courses: rows.length,
    totalHours: sumEnrolledHours(rows.map((r) => ({ hoursAtCompletion: r.hoursAtCompletion }))),
    detail: rows.map((r) => ({ id: r.id, courseId: r.courseId, hours: r.hoursAtCompletion, completedAt: r.completedAt })),
  }
}

export async function planProgress(planId: string) {
  const rows = await db
    .select({
      status: hrTrainingEnrollment.status,
      count: sql<number>`count(*)::int`,
    })
    .from(hrTrainingEnrollment)
    .where(eq(hrTrainingEnrollment.planId, planId))
    .groupBy(hrTrainingEnrollment.status)
  const by = Object.fromEntries(rows.map((r) => [r.status, r.count]))
  return { planId, enrolled: by.enrolled ?? 0, completed: by.completed ?? 0, dropped: by.dropped ?? 0 }
}

export async function listEnrollments(planId: string, employeeId?: string, courseStatus?: string) {
  const conds = [eq(hrTrainingEnrollment.planId, planId)]
  if (employeeId) conds.push(eq(hrTrainingEnrollment.employeeId, employeeId))
  if (courseStatus) conds.push(eq(hrTrainingEnrollment.status, courseStatus))
  return db.select().from(hrTrainingEnrollment).where(and(...conds))
}

/** 自助端(本人作用域):跨计划的全部报名记录,倒序 */
export async function listMyEnrollments(employeeId: string) {
  return db
    .select()
    .from(hrTrainingEnrollment)
    .where(eq(hrTrainingEnrollment.employeeId, employeeId))
    .orderBy(asc(hrTrainingEnrollment.createdAt))
}

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
