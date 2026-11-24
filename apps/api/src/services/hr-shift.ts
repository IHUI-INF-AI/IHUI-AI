// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 排班服务(2026-11-24 补口)。
 *
 * 此前 hr_shift 只有"班次定义"表且没有任何路由 —— 日结按部门取第一个启用班次,
 * 多班次/跨天班/调班全都没有落点。本文件补三件事:
 *   1) 班次 CRUD(定义层,部门维度);
 *   2) 排班落点 hr_shift_assignment(人 × 日 × 班次,唯一索引防重);
 *   3) 月历视图(前端排班表一次取全月,不再 N+1)。
 * 日结侧(hr-attendance-settle)优先取当日排班,取不到才回落部门默认班次。
 */
import { and, asc, between, eq, inArray, isNull, sql } from 'drizzle-orm'

import { db } from '../db/index.js'
import { hrDepartment, hrEmployee, hrShift, hrShiftAssignment } from '@ihui/database'
import { AppError } from '../errors/AppError.js'

function assertHm(value: string, field: string): string {
  const m = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value.trim())
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) {
    throw new AppError(`${field} 必须是 HH:MM 或 HH:MM:SS`, 400, 'HR_TIME_FORMAT_INVALID')
  }
  return `${m[1]}:${m[2]}:${m[3] ?? '00'}`
}

function assertDate(value: string, field: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new AppError(`${field} 必须是 YYYY-MM-DD`, 400, 'HR_DATE_FORMAT_INVALID')
  }
  const d = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) throw new AppError(`${field} 不是有效日期`, 400, 'HR_DATE_INVALID')
  return value
}

export interface ShiftInput {
  departmentId: string
  name: string
  startTime: string
  endTime: string
  flexMinutes?: number
  crossesMidnight?: boolean
  status?: 'enabled' | 'disabled'
}

export async function createShift(input: ShiftInput) {
  const [dept] = await db
    .select({ id: hrDepartment.id })
    .from(hrDepartment)
    .where(eq(hrDepartment.id, input.departmentId))
  if (!dept) throw new AppError('部门不存在', 404, 'HR_DEPARTMENT_NOT_FOUND')
  if (!input.name.trim()) throw new AppError('班次名称必填', 400, 'HR_SHIFT_NAME_REQUIRED')
  const flex = input.flexMinutes ?? 0
  if (flex < 0 || flex > 240) {
    throw new AppError('弹性分钟必须在 0~240 之间', 400, 'HR_SHIFT_FLEX_INVALID')
  }
  const startTime = assertHm(input.startTime, 'startTime')
  const endTime = assertHm(input.endTime, 'endTime')
  const crosses = input.crossesMidnight ?? (startTime >= endTime && startTime !== endTime)
  if (startTime === endTime) {
    throw new AppError('上下班时间不能相同', 400, 'HR_SHIFT_TIME_SAME')
  }
  const [row] = await db
    .insert(hrShift)
    .values({
      departmentId: input.departmentId,
      name: input.name.trim(),
      startTime,
      endTime,
      flexMinutes: flex,
      crossesMidnight: crosses,
      status: input.status ?? 'enabled',
    })
    .returning()
  return row
}

export async function listShifts(params: { departmentId?: string; status?: string } = {}) {
  const conds = [isNull(hrShift.deletedAt)]
  if (params.departmentId) conds.push(eq(hrShift.departmentId, params.departmentId))
  if (params.status) conds.push(eq(hrShift.status, params.status))
  return db
    .select()
    .from(hrShift)
    .where(and(...conds))
    .orderBy(asc(hrShift.departmentId), asc(hrShift.startTime))
}

export async function updateShift(
  id: string,
  patch: Partial<Omit<ShiftInput, 'departmentId'>> & { departmentId?: string },
) {
  const [existing] = await db.select().from(hrShift).where(eq(hrShift.id, id))
  if (!existing || existing.deletedAt) throw new AppError('班次不存在', 404, 'HR_SHIFT_NOT_FOUND')
  const set: Record<string, unknown> = { updatedAt: new Date() }
  if (patch.name !== undefined) {
    if (!patch.name.trim()) throw new AppError('班次名称必填', 400, 'HR_SHIFT_NAME_REQUIRED')
    set.name = patch.name.trim()
  }
  if (patch.startTime !== undefined) set.startTime = assertHm(patch.startTime, 'startTime')
  if (patch.endTime !== undefined) set.endTime = assertHm(patch.endTime, 'endTime')
  if (patch.flexMinutes !== undefined) {
    if (patch.flexMinutes < 0 || patch.flexMinutes > 240) {
      throw new AppError('弹性分钟必须在 0~240 之间', 400, 'HR_SHIFT_FLEX_INVALID')
    }
    set.flexMinutes = patch.flexMinutes
  }
  if (patch.crossesMidnight !== undefined) set.crossesMidnight = patch.crossesMidnight
  if (patch.status !== undefined) set.status = patch.status
  if (patch.departmentId !== undefined) {
    const [dept] = await db
      .select({ id: hrDepartment.id })
      .from(hrDepartment)
      .where(eq(hrDepartment.id, patch.departmentId))
    if (!dept) throw new AppError('部门不存在', 404, 'HR_DEPARTMENT_NOT_FOUND')
    set.departmentId = patch.departmentId
  }
  const [row] = await db.update(hrShift).set(set).where(eq(hrShift.id, id)).returning()
  return row
}

export async function deleteShift(id: string, today = new Date().toISOString().slice(0, 10)) {
  const [existing] = await db.select().from(hrShift).where(eq(hrShift.id, id))
  if (!existing || existing.deletedAt) throw new AppError('班次不存在', 404, 'HR_SHIFT_NOT_FOUND')
  const future = await db
    .select({ id: hrShiftAssignment.id })
    .from(hrShiftAssignment)
    .where(and(eq(hrShiftAssignment.shiftId, id), sql`${hrShiftAssignment.workDate} >= ${today}`))
    .limit(1)
  if (future.length > 0) {
    throw new AppError('该班次仍有未执行的排班,请先改排或删除排班', 409, 'HR_SHIFT_IN_USE')
  }
  await db
    .update(hrShift)
    .set({ deletedAt: new Date(), updatedAt: new Date(), status: 'disabled' })
    .where(eq(hrShift.id, id))
  return { id, deleted: true }
}

export interface AssignShiftInput {
  employeeId: string
  shiftId: string
  /** 排班日期列表(YYYY-MM-DD),单次 ≤62 天 */
  workDates: string[]
  note?: string | null
  createdBy?: string | null
}

/** 批量排班;同人同日重复排班按"后写覆盖"处理并报数。 */
export async function assignShifts(input: AssignShiftInput) {
  if (!Array.isArray(input.workDates) || input.workDates.length === 0) {
    throw new AppError('请提供排班日期', 400, 'HR_SHIFT_DATES_REQUIRED')
  }
  if (input.workDates.length > 62) {
    throw new AppError('单次最多排 62 天,请分批', 400, 'HR_SHIFT_DATES_TOO_MANY')
  }
  const dates = [...new Set(input.workDates.map((d) => assertDate(d, 'workDate')))].sort()
  const [shift] = await db.select().from(hrShift).where(eq(hrShift.id, input.shiftId))
  if (!shift || shift.deletedAt) throw new AppError('班次不存在', 404, 'HR_SHIFT_NOT_FOUND')
  if (shift.status !== 'enabled') {
    throw new AppError('班次已停用,不能排班', 400, 'HR_SHIFT_DISABLED')
  }
  const [emp] = await db
    .select({ id: hrEmployee.id, departmentId: hrEmployee.departmentId, status: hrEmployee.status })
    .from(hrEmployee)
    .where(and(eq(hrEmployee.id, input.employeeId), isNull(hrEmployee.deletedAt)))
  if (!emp) throw new AppError('员工不存在', 404, 'HR_EMPLOYEE_NOT_FOUND')
  if (emp.status === 'left') throw new AppError('离职员工不能排班', 400, 'HR_EMPLOYEE_LEFT')

  let created = 0
  let updated = 0
  for (const workDate of dates) {
    const [before] = await db
      .select({ id: hrShiftAssignment.id })
      .from(hrShiftAssignment)
      .where(
        and(
          eq(hrShiftAssignment.employeeId, input.employeeId),
          eq(hrShiftAssignment.workDate, workDate),
        ),
      )
      .limit(1)
    await db
      .insert(hrShiftAssignment)
      .values({
        employeeId: input.employeeId,
        departmentId: emp.departmentId,
        workDate,
        shiftId: input.shiftId,
        note: input.note?.trim() || null,
        createdBy: input.createdBy ?? null,
      })
      .onConflictDoUpdate({
        target: [hrShiftAssignment.employeeId, hrShiftAssignment.workDate],
        set: { shiftId: input.shiftId, note: input.note?.trim() || null, updatedAt: new Date() },
      })
    if (before) updated += 1
    else created += 1
  }
  return { dates: dates.length, created, updated, shiftId: input.shiftId }
}

export async function listAssignments(params: {
  month?: string
  employeeId?: string
  departmentId?: string
}) {
  const conds = []
  if (params.employeeId) conds.push(eq(hrShiftAssignment.employeeId, params.employeeId))
  if (params.departmentId) conds.push(eq(hrShiftAssignment.departmentId, params.departmentId))
  if (params.month) {
    if (!/^\d{4}-\d{2}$/.test(params.month)) {
      throw new AppError('month 必须是 YYYY-MM', 400, 'HR_PERIOD_INVALID')
    }
    const start = `${params.month}-01`
    const end = `${params.month}-31`
    conds.push(between(hrShiftAssignment.workDate, start, end))
  }
  return db
    .select({
      id: hrShiftAssignment.id,
      employeeId: hrShiftAssignment.employeeId,
      employeeNo: hrEmployee.employeeNo,
      employeeName: hrEmployee.name,
      departmentId: hrShiftAssignment.departmentId,
      workDate: hrShiftAssignment.workDate,
      shiftId: hrShiftAssignment.shiftId,
      shiftName: hrShift.name,
      startTime: hrShift.startTime,
      endTime: hrShift.endTime,
      crossesMidnight: hrShift.crossesMidnight,
      note: hrShiftAssignment.note,
    })
    .from(hrShiftAssignment)
    .innerJoin(hrEmployee, eq(hrShiftAssignment.employeeId, hrEmployee.id))
    .innerJoin(hrShift, eq(hrShiftAssignment.shiftId, hrShift.id))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(asc(hrShiftAssignment.workDate), asc(hrEmployee.employeeNo))
    .limit(2000)
}

/** 月历视图:按员工分组,前端直接渲染排班表。 */
export async function shiftCalendar(month: string) {
  const rows = await listAssignments({ month })
  const byEmployee = new Map<
    string,
    { employeeId: string; employeeNo: string; employeeName: string; days: unknown[] }
  >()
  for (const r of rows) {
    const key = r.employeeId
    if (!byEmployee.has(key)) {
      byEmployee.set(key, {
        employeeId: r.employeeId,
        employeeNo: r.employeeNo,
        employeeName: r.employeeName,
        days: [],
      })
    }
    byEmployee.get(key)!.days.push({
      date: r.workDate,
      shiftId: r.shiftId,
      shiftName: r.shiftName,
      startTime: r.startTime,
      endTime: r.endTime,
      crossesMidnight: r.crossesMidnight,
      note: r.note,
    })
  }
  return { month, employees: [...byEmployee.values()], totalAssignments: rows.length }
}

export async function deleteAssignment(id: string) {
  const [row] = await db.select().from(hrShiftAssignment).where(eq(hrShiftAssignment.id, id))
  if (!row) throw new AppError('排班记录不存在', 404, 'HR_SHIFT_ASSIGNMENT_NOT_FOUND')
  await db.delete(hrShiftAssignment).where(eq(hrShiftAssignment.id, id))
  return { id, deleted: true }
}

/**
 * 日结侧取班次的统一入口:当日排班优先,回落部门默认启用班次。
 * 返回 Map<`${employeeId}|${date}`, shift>;供 hr-attendance-settle 覆盖默认口径。
 */
export async function loadShiftAssignments(
  employeeIds: string[],
  start: string,
  end: string,
): Promise<Map<string, typeof hrShift.$inferSelect>> {
  if (employeeIds.length === 0) return new Map()
  const rows = await db
    .select({
      employeeId: hrShiftAssignment.employeeId,
      workDate: hrShiftAssignment.workDate,
      shift: hrShift,
    })
    .from(hrShiftAssignment)
    .innerJoin(hrShift, eq(hrShiftAssignment.shiftId, hrShift.id))
    .where(
      and(
        inArray(hrShiftAssignment.employeeId, employeeIds),
        between(hrShiftAssignment.workDate, start, end),
        isNull(hrShift.deletedAt),
      ),
    )
  const map = new Map<string, typeof hrShift.$inferSelect>()
  for (const r of rows) map.set(`${r.employeeId}|${r.workDate}`, r.shift)
  return map
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
