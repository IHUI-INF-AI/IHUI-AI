// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 职级服务(2026-11-24 六波)。
 *
 * 时间线纯核(activeAt/validateGrant)单测钉死:
 *   · 同人至多一条开放史(库级部分唯一索引 + 服务层校验双保险);
 *   · 新记录生效日必须晚于当前开放记录(同日双轨拒绝,历史回放不重叠);
 *   · reason 封闭集;字典 retired 后不可再授(历史可查)。
 */
import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm'

import { db } from '../db/index.js'
import {
  GRADE_REASONS,
  hrEmployee,
  hrEmployeeGrade,
  hrJobGrade,
  type GradeReason,
  type HrEmployeeGrade,
} from '@ihui/database'
import { AppError } from '../errors/AppError.js'

export interface GrantInput {
  employeeId: string
  gradeId: string
  effectiveFrom: string
  reason: GradeReason
  note?: string | null
  operatorId?: string | null
}

/** 时间线纯核:指定日在职级(史表按 effectiveFrom 升序传入;闭旧日当天仍算在任) */
export function activeAt(
  history: ReadonlyArray<{
    gradeId: string
    gradeCode: string
    effectiveFrom: string
    endedAt: Date | string | null
  }>,
  date: string,
): { gradeId: string; gradeCode: string } | null {
  let hit: { gradeId: string; gradeCode: string } | null = null
  for (const h of history) {
    if (h.effectiveFrom > date) break
    if (h.endedAt === null || h.endedAt === undefined) {
      hit = { gradeId: h.gradeId, gradeCode: h.gradeCode }
      continue
    }
    const end = new Date(h.endedAt)
    const endDay = Number.isNaN(end.getTime()) ? null : end.toISOString().slice(0, 10)
    if (endDay === null || date <= endDay) hit = { gradeId: h.gradeId, gradeCode: h.gradeCode }
  }
  return hit
}

/** 授予校验纯核:新生效日必须严格晚于当前开放记录(同日双轨拒绝) */
export function validateGrant(
  open: Pick<HrEmployeeGrade, 'effectiveFrom'> | null | undefined,
  newEffectiveFrom: string,
): void {
  if (open && newEffectiveFrom <= open.effectiveFrom) {
    throw new AppError(
      `新职级生效日(${newEffectiveFrom})必须晚于当前在职记录(${open.effectiveFrom}),同日双轨不允许`,
      409,
      'HR_GRADE_OVERLAP',
    )
  }
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export async function listGrades(includeRetired = false) {
  const conds = includeRetired ? [] : [eq(hrJobGrade.status, 'active')]
  return db
    .select()
    .from(hrJobGrade)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(asc(hrJobGrade.level))
}

export async function createGrade(input: { code: string; name: string; level: number; note?: string | null }) {
  if (!/^[A-Za-z0-9-]{1,40}$/.test(input.code)) {
    throw new AppError('职级编码只允许字母数字与短横线', 400, 'HR_GRADE_CODE_INVALID')
  }
  if (!Number.isInteger(input.level) || input.level < 1) {
    throw new AppError('level 必须为正整数(用于排序比较)', 400, 'HR_GRADE_LEVEL_INVALID')
  }
  const [dup] = await db.select({ id: hrJobGrade.id }).from(hrJobGrade).where(eq(hrJobGrade.code, input.code))
  if (dup) throw new AppError(`职级 ${input.code} 已存在`, 409, 'HR_GRADE_CODE_EXISTS')
  const [row] = await db.insert(hrJobGrade).values(input).returning()
  return row!
}

export async function updateGrade(id: string, patch: { name?: string; level?: number; note?: string | null; status?: 'active' | 'retired' }) {
  const [g] = await db.select().from(hrJobGrade).where(eq(hrJobGrade.id, id))
  if (!g) throw new AppError('职级不存在', 404, 'HR_GRADE_NOT_FOUND')
  const set: Partial<typeof g> = { updatedAt: new Date() }
  if (patch.name !== undefined) set.name = patch.name
  if (patch.note !== undefined) set.note = patch.note
  if (patch.level !== undefined) {
    if (!Number.isInteger(patch.level) || patch.level < 1) {
      throw new AppError('level 必须为正整数', 400, 'HR_GRADE_LEVEL_INVALID')
    }
    set.level = patch.level
  }
  if (patch.status !== undefined) set.status = patch.status
  const [row] = await db.update(hrJobGrade).set(set).where(eq(hrJobGrade.id, id)).returning()
  return row!
}

/** 授予新职级:闭旧开新。字典 retired 拒授;员工/字典存在性服务端核验。 */
export async function grantGrade(input: GrantInput) {
  if (!DATE_RE.test(input.effectiveFrom)) {
    throw new AppError('effectiveFrom 必须是 YYYY-MM-DD', 400, 'HR_GRADE_DATE_INVALID')
  }
  if (!GRADE_REASONS.includes(input.reason)) {
    throw new AppError(`reason 必须是 ${GRADE_REASONS.join('/')} 之一`, 400, 'HR_GRADE_REASON_INVALID')
  }
  const [emp] = await db.select({ id: hrEmployee.id }).from(hrEmployee).where(eq(hrEmployee.id, input.employeeId))
  if (!emp) throw new AppError('员工不存在', 404, 'HR_GRADE_EMPLOYEE_NOT_FOUND')
  const [grade] = await db.select().from(hrJobGrade).where(eq(hrJobGrade.id, input.gradeId))
  if (!grade) throw new AppError('职级不存在', 404, 'HR_GRADE_NOT_FOUND')
  if (grade.status !== 'active') {
    throw new AppError(`职级 ${grade.code} 已停用,不可再授予`, 409, 'HR_GRADE_RETIRED')
  }
  const [openRow] = await db
    .select()
    .from(hrEmployeeGrade)
    .where(and(eq(hrEmployeeGrade.employeeId, input.employeeId), isNull(hrEmployeeGrade.endedAt)))
  validateGrant(openRow, input.effectiveFrom)
  const now = new Date()
  if (openRow) {
    await db
      .update(hrEmployeeGrade)
      .set({ endedAt: now })
      .where(eq(hrEmployeeGrade.id, openRow.id))
  }
  const [row] = await db
    .insert(hrEmployeeGrade)
    .values({
      employeeId: input.employeeId,
      gradeId: grade.id,
      gradeCode: grade.code,
      effectiveFrom: input.effectiveFrom,
      reason: input.reason,
      note: input.note ?? null,
      operatorId: input.operatorId ?? null,
    })
    .returning()
  return { current: row!, closed: openRow ?? null }
}

export async function currentGrade(employeeId: string) {
  const [row] = await db
    .select()
    .from(hrEmployeeGrade)
    .where(and(eq(hrEmployeeGrade.employeeId, employeeId), isNull(hrEmployeeGrade.endedAt)))
  return row ?? null
}

export async function gradeHistory(employeeId: string) {
  return db
    .select()
    .from(hrEmployeeGrade)
    .where(eq(hrEmployeeGrade.employeeId, employeeId))
    .orderBy(desc(hrEmployeeGrade.effectiveFrom))
}

/** 花名册批量当前级(管理端列表用;N 员工一条 SQL) */
export async function currentGradesBulk(employeeIds: readonly string[]) {
  if (employeeIds.length === 0) return []
  const rows = await db
    .select({
      employeeId: hrEmployeeGrade.employeeId,
      gradeId: hrEmployeeGrade.gradeId,
      gradeCode: hrEmployeeGrade.gradeCode,
      effectiveFrom: hrEmployeeGrade.effectiveFrom,
    })
    .from(hrEmployeeGrade)
    .where(and(inArray(hrEmployeeGrade.employeeId, employeeIds), isNull(hrEmployeeGrade.endedAt)))
  const byEmp = new Map(rows.map((r) => [r.employeeId, r]))
  return employeeIds.map((id) => ({ employeeId: id, grade: byEmp.get(id) ?? null }))
}

/** 职级分布统计(dict join 史表 count) */
export async function gradeDistribution() {
  return db
    .select({
      gradeCode: hrEmployeeGrade.gradeCode,
      count: sql<number>`count(*)::int`,
    })
    .from(hrEmployeeGrade)
    .where(isNull(hrEmployeeGrade.endedAt))
    .groupBy(hrEmployeeGrade.gradeCode)
    .orderBy(asc(hrEmployeeGrade.gradeCode))
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
