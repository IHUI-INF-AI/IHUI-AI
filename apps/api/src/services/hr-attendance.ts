// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
import {
  and,
  eq,
  inArray,
  isNull,
  ne,
  sql,
  count,
  gte,
  lte,
  between,
  desc,
  type SQL,
} from 'drizzle-orm'
import {
  hrAttendanceRule,
  hrAttendanceRecord,
  hrEmployee,
  hrDepartment,
  hrLeaveRequest,
} from '@ihui/database'
import {
  judgeStatus,
  buildBizDayWindow,
  dayFloorOf,
  absentCandidatePairsForRule,
  resolveBackfillDays,
  normalizeHm,
  weekdayOfBizDayKey as weekdayOfBizDayKeySafe,
  isPastHm as isPastHmSafe,
} from '@ihui/attendance-core'
import { db } from '../db/index.js'
import { bizDayKey, shiftBizDayKey } from '../utils/biz-day.js'
import { logger } from '../utils/logger.js'
import { AppError } from '../errors/AppError.js'

/**
 * 人事考勤服务(2026-11-09 立,复用 @ihui/attendance-core 判定内核)。
 *
 * 与教育板块(edu-attendance-*) 的边界:judgeStatus / 缺勤补录纯算法全在 core 单源,
 * 本文件只做**场景适配**——把"谁该来"接成 hr_employee(status='active' ∧ 未软删)、
 * 把"哪天该来"接成 hr_attendance_rule.workdays 周工作日掩码(等价于教育的排课门控,
 * 但人事按固定周历,比逐日排课简单)。判定阈值、状态四档、幂等候选对全部委托 core,不复制。
 */

export const DEFAULT_HR_BACKFILL_DAYS = 3

/** 周工作日掩码 → 当天是否工作日(bit0=周一 … bit6=周日,127=全周) */
export function isHrWorkday(dateKey: string, workdaysMask: number): boolean {
  // weekdayOfBizDayKey 返回 1=周一…7=周日,与掩码位序一致
  const wd = weekdayOfBizDayKeySafe(dateKey)
  if (wd === null) return false
  return (workdaysMask & (1 << (wd - 1))) !== 0
}

// weekdayOfBizDayKey 已在顶部 import(单源在 @ihui/attendance-core)

/** 部门考勤规则(enabled 且未软删);无规则 ⇒ null,由调用方按"无阈值"退化。 */
export async function loadEnabledHrRule(departmentId: string): Promise<{
  lateAfter: string | null
  earlyBefore: string | null
  absentAfter: string | null
  workdays: number
  qrSecret: string | null
} | null> {
  const [rule] = await db
    .select()
    .from(hrAttendanceRule)
    .where(
      and(
        eq(hrAttendanceRule.departmentId, departmentId),
        eq(hrAttendanceRule.enabled, true),
        isNull(hrAttendanceRule.deletedAt),
      ),
    )
    .limit(1)
  if (!rule) return null
  return {
    lateAfter: rule.lateAfter ?? null,
    earlyBefore: rule.earlyBefore ?? null,
    absentAfter: rule.absentAfter ?? null,
    workdays: rule.workdays ?? 127,
    qrSecret: rule.qrSecret ?? null,
  }
}

export type HrCheckInResult =
  | { ok: true; record: typeof hrAttendanceRecord.$inferSelect }
  | { ok: false; reason: 'not_employed' | 'duplicate' | 'failed' | 'bad_date' | 'bad_time' }

/** 员工签到(教师/管理员代签或自助):status 由 core.judgeStatus + 部门规则现算,不接收客户端 status。 */
export async function hrCheckIn(params: {
  employeeId: string
  departmentId: string
  date: string
  checkInMethod: 'self' | 'qrcode' | 'manual'
  operatedBy: string
  checkInTimeRaw?: string | undefined
  remark?: string | undefined
}): Promise<HrCheckInResult> {
  const { employeeId, departmentId, date, checkInMethod, operatedBy, checkInTimeRaw, remark } =
    params

  const [emp] = await db
    .select({ id: hrEmployee.id })
    .from(hrEmployee)
    .where(
      and(
        eq(hrEmployee.id, employeeId),
        eq(hrEmployee.departmentId, departmentId),
        eq(hrEmployee.status, 'active'),
        isNull(hrEmployee.deletedAt),
      ),
    )
    .limit(1)
  if (!emp) return { ok: false, reason: 'not_employed' }

  let checkInTime: Date
  if (checkInTimeRaw === undefined) {
    if (bizDayKey(new Date()) !== date) return { ok: false, reason: 'bad_date' }
    checkInTime = new Date()
  } else {
    const d = new Date(checkInTimeRaw)
    if (Number.isNaN(d.getTime())) return { ok: false, reason: 'bad_time' }
    if (bizDayKey(d) !== date) return { ok: false, reason: 'bad_date' }
    checkInTime = d
  }

  const rule = await loadEnabledHrRule(departmentId)
  const status = judgeStatus({
    lateAfter: rule?.lateAfter ?? null,
    earlyBefore: rule?.earlyBefore ?? null,
    checkInTime,
    checkOutTime: null,
  })

  try {
    const txResult = await db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(hrAttendanceRecord)
        .where(
          and(
            eq(hrAttendanceRecord.employeeId, employeeId),
            eq(hrAttendanceRecord.departmentId, departmentId),
            eq(hrAttendanceRecord.date, date),
            isNull(hrAttendanceRecord.deletedAt),
          ),
        )
        .limit(1)
      if (existing) return { state: 'duplicate' as const }
      const inserted = await tx
        .insert(hrAttendanceRecord)
        .values({
          employeeId,
          departmentId,
          date,
          checkInTime,
          status,
          checkInMethod,
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
  } catch {
    return { ok: false, reason: 'failed' }
  }
}

/** 员工签退:重判早退维,leave/absent 两态优先级高于在場结论,绝不洗回。 */
export async function hrCheckOut(params: {
  employeeId: string
  departmentId: string
  date: string
  checkOutTimeRaw: string
  operatedBy: string
}): Promise<
  { ok: true; record: typeof hrAttendanceRecord.$inferSelect } | { ok: false; reason: string }
> {
  const { employeeId, departmentId, date, checkOutTimeRaw, operatedBy } = params
  const checkOutTime = new Date(checkOutTimeRaw)
  if (Number.isNaN(checkOutTime.getTime())) return { ok: false, reason: 'bad_time' }

  const [row] = await db
    .select()
    .from(hrAttendanceRecord)
    .where(
      and(
        eq(hrAttendanceRecord.employeeId, employeeId),
        eq(hrAttendanceRecord.departmentId, departmentId),
        eq(hrAttendanceRecord.date, date),
        isNull(hrAttendanceRecord.deletedAt),
      ),
    )
    .limit(1)
  if (!row) return { ok: false, reason: 'no_record' }

  if (row.status === 'leave' || row.status === 'absent') {
    // 优先级保护:leave/absent 不被签退洗回,只补 checkOutTime
    // G-998153 出口形态:先取现值、按键比较,只有真变化才写(重复同值签退不再空转 updatedAt)。
    const changed: Partial<typeof hrAttendanceRecord.$inferInsert> = {}
    if (row.checkOutTime?.getTime() !== checkOutTime.getTime()) changed.checkOutTime = checkOutTime
    if (row.checkOutMethod !== 'manual') changed.checkOutMethod = 'manual'
    if (row.operatedBy !== operatedBy) changed.operatedBy = operatedBy
    if (Object.keys(changed).length === 0) return { ok: true, record: row }
    const [updated] = await db
      .update(hrAttendanceRecord)
      .set({ ...changed, updatedAt: new Date() })
      .where(eq(hrAttendanceRecord.id, row.id))
      .returning()
    if (!updated) throw new AppError('签退写入后回读失败', 500, 'INTERNAL')
    return { ok: true, record: updated }
  }

  const rule = await loadEnabledHrRule(departmentId)
  const status = judgeStatus({
    lateAfter: rule?.lateAfter ?? null,
    earlyBefore: rule?.earlyBefore ?? null,
    checkInTime: row.checkInTime,
    checkOutTime,
  })
  // G-998153 出口形态:同上,真变化才写。
  const changed: Partial<typeof hrAttendanceRecord.$inferInsert> = {}
  if (row.checkOutTime?.getTime() !== checkOutTime.getTime()) changed.checkOutTime = checkOutTime
  if (row.checkOutMethod !== 'manual') changed.checkOutMethod = 'manual'
  if (row.status !== status) changed.status = status
  if (row.operatedBy !== operatedBy) changed.operatedBy = operatedBy
  if (Object.keys(changed).length === 0) return { ok: true, record: row }
  const [updated] = await db
    .update(hrAttendanceRecord)
    .set({ ...changed, updatedAt: new Date() })
    .where(eq(hrAttendanceRecord.id, row.id))
    .returning()
  if (!updated) throw new AppError('签退写入后回读失败', 500, 'INTERNAL')
  return { ok: true, record: updated }
}

export interface HrAbsentRunResult {
  rules: number
  employees: number
  created: number
  skipped: number
}

/**
 * 缺勤补录一轮(含回溯窗 + 工作日门控)。由 scheduler-worker 调用,本文件不做 setInterval。
 * 与教育的差异:门控依据是 hr_attendance_rule.workdays 周掩码(而非 edu_course_schedule 排课)。
 */
export async function runHrAbsentAttendance(
  at: Date = new Date(),
  options: { backfillDays?: number } = {},
): Promise<HrAbsentRunResult> {
  const todayKey = bizDayKey(at)
  const backfillDays = resolveBackfillDays(options.backfillDays ?? DEFAULT_HR_BACKFILL_DAYS)
  const windowKeys = buildBizDayWindow(todayKey, backfillDays, shiftBizDayKey)

  const rules = await db
    .select({
      id: hrAttendanceRule.id,
      departmentId: hrAttendanceRule.departmentId,
      absentAfter: hrAttendanceRule.absentAfter,
      workdays: hrAttendanceRule.workdays,
      createdAt: hrAttendanceRule.createdAt,
    })
    .from(hrAttendanceRule)
    .where(
      and(
        eq(hrAttendanceRule.enabled, true),
        isNull(hrAttendanceRule.deletedAt),
        sql`${hrAttendanceRule.absentAfter} IS NOT NULL`,
      ),
    )

  let rulesCount = 0
  let employeesTotal = 0
  let createdTotal = 0
  let skippedTotal = 0

  for (const rule of rules) {
    const dueDates = windowKeys.filter(
      (d) =>
        isHrWorkday(d, rule.workdays ?? 127) &&
        (d !== todayKey || isPastHmSafe(String(rule.absentAfter ?? ''), at)),
    )
    if (dueDates.length === 0) continue
    rulesCount += 1

    const employees = await db
      .select({ id: hrEmployee.id, hireDate: hrEmployee.hireDate })
      .from(hrEmployee)
      .where(
        and(
          eq(hrEmployee.departmentId, rule.departmentId),
          eq(hrEmployee.status, 'active'),
          isNull(hrEmployee.deletedAt),
        ),
      )
    const employeeIds = employees.map((e) => String(e.id))
    if (employeeIds.length === 0) continue
    employeesTotal += employeeIds.length

    const ruleFloor = dayFloorOf(rule.createdAt)
    const existing = await db
      .select({
        employeeId: hrAttendanceRecord.employeeId,
        date: hrAttendanceRecord.date,
      })
      .from(hrAttendanceRecord)
      .where(
        and(
          eq(hrAttendanceRecord.departmentId, rule.departmentId),
          inArray(hrAttendanceRecord.date, dueDates),
          inArray(hrAttendanceRecord.employeeId, employeeIds),
          isNull(hrAttendanceRecord.deletedAt),
        ),
      )

    const { candidates } = absentCandidatePairsForRule({
      scopeId: String(rule.departmentId),
      dueDates,
      subjects: employees.map((e) => ({
        subjectId: String(e.id),
        floor: dayFloorOf(e.hireDate),
      })),
      ruleFloor,
      // core.absentCandidatePairsForRule 只读 `subjectId`,必须把 employeeId 折成该键
      existing: existing.map((r) => ({ subjectId: String(r.employeeId), date: r.date })),
    })
    if (candidates.length === 0) {
      skippedTotal += employeeIds.length
      continue
    }

    const inserted = await db
      .insert(hrAttendanceRecord)
      .values(
        candidates.map((c) => ({
          employeeId: c.subjectId,
          departmentId: c.scopeId,
          date: c.date,
          status: 'absent',
          checkInMethod: 'manual',
          operatedBy: null,
        })),
      )
      .onConflictDoNothing()
      .returning({ id: hrAttendanceRecord.id })
    createdTotal += inserted.length
    skippedTotal += candidates.length - inserted.length
  }

  logger.info('hr attendance absent job done', {
    dateKey: todayKey,
    backfillDays,
    rules: rulesCount,
    employees: employeesTotal,
    created: createdTotal,
    skipped: skippedTotal,
  })
  return {
    rules: rulesCount,
    employees: employeesTotal,
    created: createdTotal,
    skipped: skippedTotal,
  }
}

// isPastHm 已在顶部 import(单源在 @ihui/attendance-core)

/** 请假单创建 */
export async function createHrLeave(params: {
  employeeId: string
  departmentId: string
  leaveType: string
  startDate: string
  endDate: string
  totalDays: number
  reason: string
  attachment?: string | undefined
}) {
  const [row] = await db.insert(hrLeaveRequest).values(params).returning()
  return row
}

/** 请假审批(approved/rejected)。审批通过时联动写入 attendance_record 的 leave 状态(覆盖补录的 absent)。 */
export async function approveHrLeave(
  leaveId: string,
  approverId: string,
  decision: 'approved' | 'rejected',
  approveRemark?: string | undefined,
) {
  const [leave] = await db
    .select()
    .from(hrLeaveRequest)
    .where(and(eq(hrLeaveRequest.id, leaveId), isNull(hrLeaveRequest.deletedAt)))
    .limit(1)
  if (!leave) return null
  const [updated] = await db
    .update(hrLeaveRequest)
    .set({
      status: decision,
      approverId,
      approveRemark: approveRemark ?? null,
      approveAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(hrLeaveRequest.id, leaveId))
    .returning()
  if (decision === 'approved') {
    // 覆盖区间内已有的 absent 记录为 leave(优先级高于 absent)
    // G-998153 出口形态:WHERE 排除已是 leave 的行(同值空写不推进 updatedAt),真变化才写。
    const changed: Partial<typeof hrAttendanceRecord.$inferInsert> = { status: 'leave' }
    await db
      .update(hrAttendanceRecord)
      .set({ ...changed, updatedAt: new Date() })
      .where(
        and(
          eq(hrAttendanceRecord.employeeId, leave.employeeId),
          eq(hrAttendanceRecord.departmentId, leave.departmentId),
          sql`${hrAttendanceRecord.date} >= ${leave.startDate}::date`,
          sql`${hrAttendanceRecord.date} <= ${leave.endDate}::date`,
          isNull(hrAttendanceRecord.deletedAt),
          ne(hrAttendanceRecord.status, 'leave'),
        ),
      )
  }
  return updated
}

// =============================================================================
// 读面 + 主数据(部门/员工)适配器:与写面同一处出口,调用方不再各抄一份 SQL。
// 这些只读查询走单例 db,不进事务(读配置/主数据,不接 tx)。
// =============================================================================

/** 部门考勤规则安全投影:绝不回显 qrSecret 原文,只给 qrSecretConfigured 布尔。 */
export async function getHrAttendanceRule(departmentId: string) {
  const [row] = await db
    .select()
    .from(hrAttendanceRule)
    .where(and(eq(hrAttendanceRule.departmentId, departmentId), isNull(hrAttendanceRule.deletedAt)))
    .limit(1)
  if (!row) return null
  return {
    id: row.id,
    departmentId: row.departmentId,
    lateAfter: row.lateAfter ?? null,
    earlyBefore: row.earlyBefore ?? null,
    absentAfter: row.absentAfter ?? null,
    workdays: row.workdays ?? 127,
    enabled: row.enabled,
    qrSecretConfigured: Boolean(row.qrSecret),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export type HrAttendanceRuleDto = NonNullable<Awaited<ReturnType<typeof getHrAttendanceRule>>>

/** 考勤记录列表(支持员工/部门/单日/区间过滤 + 简单分页)。 */
export async function listHrAttendanceRecords(params: {
  employeeId?: string
  departmentId?: string
  date?: string
  startDate?: string
  endDate?: string
  limit?: number
  offset?: number
}): Promise<{ list: (typeof hrAttendanceRecord.$inferSelect)[]; total: number }> {
  const conds: SQL[] = [isNull(hrAttendanceRecord.deletedAt)]
  if (params.employeeId) conds.push(eq(hrAttendanceRecord.employeeId, params.employeeId))
  if (params.departmentId) conds.push(eq(hrAttendanceRecord.departmentId, params.departmentId))
  if (params.date) conds.push(eq(hrAttendanceRecord.date, params.date))
  if (params.startDate && params.endDate)
    conds.push(between(hrAttendanceRecord.date, params.startDate, params.endDate))
  else if (params.startDate) conds.push(gte(hrAttendanceRecord.date, params.startDate))
  else if (params.endDate) conds.push(lte(hrAttendanceRecord.date, params.endDate))
  const where = and(...conds)
  const [totalRow] = await db.select({ c: count() }).from(hrAttendanceRecord).where(where)
  const list = await db
    .select()
    .from(hrAttendanceRecord)
    .where(where)
    .orderBy(desc(hrAttendanceRecord.date), desc(hrAttendanceRecord.createdAt))
    .limit(params.limit ?? 50)
    .offset(params.offset ?? 0)
  return { list, total: Number(totalRow?.c ?? 0) }
}

/** 考勤统计:按 status 聚合计数(含总计)。用于出勤率看板。 */
export async function getHrAttendanceStats(params: {
  departmentId?: string
  startDate?: string
  endDate?: string
}): Promise<{ total: number; byStatus: Record<string, number> }> {
  const conds: SQL[] = [isNull(hrAttendanceRecord.deletedAt)]
  if (params.departmentId) conds.push(eq(hrAttendanceRecord.departmentId, params.departmentId))
  if (params.startDate) conds.push(gte(hrAttendanceRecord.date, params.startDate))
  if (params.endDate) conds.push(lte(hrAttendanceRecord.date, params.endDate))
  const rows = await db
    .select({ status: hrAttendanceRecord.status, c: count() })
    .from(hrAttendanceRecord)
    .where(and(...conds))
    .groupBy(hrAttendanceRecord.status)
  const byStatus: Record<string, number> = {}
  let total = 0
  for (const r of rows) {
    byStatus[r.status] = Number(r.c)
    total += Number(r.c)
  }
  return { total, byStatus }
}

/** 部门列表(树形自引用,按 sortOrder 升序)。部门表无软删列(无删除端点),不做 deletedAt 过滤。 */
export async function listHrDepartments(): Promise<(typeof hrDepartment.$inferSelect)[]> {
  return db.select().from(hrDepartment).orderBy(hrDepartment.sortOrder, hrDepartment.createdAt)
}

/** 新建部门。name 必填,parentId/leaderEmployeeId 可选;重复名校验交给唯一约束兜底。 */
export async function createHrDepartment(params: {
  name: string
  parentId?: string | undefined
  leaderEmployeeId?: string | undefined
  sortOrder?: number | undefined
}) {
  const [row] = await db
    .insert(hrDepartment)
    .values({
      name: params.name,
      parentId: params.parentId ?? null,
      leaderEmployeeId: params.leaderEmployeeId ?? null,
      sortOrder: params.sortOrder ?? 0,
    })
    .returning()
  return row
}

/** 员工列表(按部门/状态过滤)。 */
export async function listHrEmployees(
  params: {
    departmentId?: string
    status?: string
  } = {},
): Promise<(typeof hrEmployee.$inferSelect)[]> {
  const conds: SQL[] = [isNull(hrEmployee.deletedAt)]
  if (params.departmentId) conds.push(eq(hrEmployee.departmentId, params.departmentId))
  if (params.status) conds.push(eq(hrEmployee.status, params.status))
  return db
    .select()
    .from(hrEmployee)
    .where(and(...conds))
    .orderBy(hrEmployee.createdAt)
}

/** 新建员工(employeeNo 唯一,重复由唯一索引兜底返错)。 */
export async function createHrEmployee(params: {
  userId?: string | undefined
  employeeNo: string
  name: string
  departmentId: string
  position?: string | undefined
  hireDate?: string | undefined
  phone?: string | undefined
  idNumber?: string | undefined
}) {
  const [row] = await db
    .insert(hrEmployee)
    .values({
      userId: params.userId ?? null,
      employeeNo: params.employeeNo,
      name: params.name,
      departmentId: params.departmentId,
      position: params.position ?? null,
      hireDate: params.hireDate ?? null,
      phone: params.phone ?? null,
      idNumber: params.idNumber ?? null,
    })
    .returning()
  return row
}

/** 部门考勤规则 upsert(按 departmentId 唯一幂等)。阈值经 core.normalizeHm 归一化,非法即抛错。 */
export async function upsertHrAttendanceRule(params: {
  departmentId: string
  lateAfter?: string | null
  earlyBefore?: string | null
  absentAfter?: string | null
  workdays?: number
  enabled?: boolean
  qrSecret?: string | null
}): Promise<HrAttendanceRuleDto> {
  const thresholds: {
    lateAfter?: string | null
    earlyBefore?: string | null
    absentAfter?: string | null
  } = {}
  for (const field of ['lateAfter', 'earlyBefore', 'absentAfter'] as const) {
    const raw = params[field]
    if (raw === undefined) continue
    if (raw === null) {
      thresholds[field] = null
      continue
    }
    const hm = normalizeHm(raw)
    if (hm === null)
      throw new AppError(
        `时间格式非法:${field}="${raw}"(必须可归一化为 HH:MM)`,
        400,
        'INVALID_TIME',
      )
    thresholds[field] = hm
  }
  const values: typeof hrAttendanceRule.$inferInsert = {
    departmentId: params.departmentId,
    ...thresholds,
  }
  if (params.workdays !== undefined) values.workdays = params.workdays
  if (params.enabled !== undefined) values.enabled = params.enabled
  if (params.qrSecret !== undefined) values.qrSecret = params.qrSecret

  const setClause: Record<string, unknown> = { ...thresholds, updatedAt: new Date() }
  if (params.workdays !== undefined) setClause.workdays = params.workdays
  if (params.enabled !== undefined) setClause.enabled = params.enabled
  if (params.qrSecret !== undefined) setClause.qrSecret = params.qrSecret

  await db
    .insert(hrAttendanceRule)
    .values(values)
    .onConflictDoUpdate({ target: hrAttendanceRule.departmentId, set: setClause })
    .returning()
  // 回读安全投影(过滤 qrSecret),与 GET /attendance/rule 同口径
  const dto = await getHrAttendanceRule(params.departmentId)
  if (!dto) throw new AppError('规则写入后回读失败', 500, 'INTERNAL')
  return dto
}

/** 请假单列表(员工/部门/状态/区间过滤)。 */
export async function listHrLeaves(
  params: {
    employeeId?: string
    departmentId?: string
    status?: string
    startDate?: string
    endDate?: string
  } = {},
): Promise<(typeof hrLeaveRequest.$inferSelect)[]> {
  const conds: SQL[] = [isNull(hrLeaveRequest.deletedAt)]
  if (params.employeeId) conds.push(eq(hrLeaveRequest.employeeId, params.employeeId))
  if (params.departmentId) conds.push(eq(hrLeaveRequest.departmentId, params.departmentId))
  if (params.status) conds.push(eq(hrLeaveRequest.status, params.status))
  if (params.startDate && params.endDate)
    conds.push(between(hrLeaveRequest.startDate, params.startDate, params.endDate))
  else if (params.startDate) conds.push(gte(hrLeaveRequest.startDate, params.startDate))
  else if (params.endDate) conds.push(lte(hrLeaveRequest.endDate, params.endDate))
  return db
    .select()
    .from(hrLeaveRequest)
    .where(and(...conds))
    .orderBy(desc(hrLeaveRequest.createdAt))
}
