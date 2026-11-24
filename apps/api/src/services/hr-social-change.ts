// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 社保/公积金增减员台账(2026-11-24 补口)。
 *
 * 此前"入职建员工、离职办结"与社保网报之间没有任何连接件:
 * 人已经离职了,减员还要人另外记一笔;入职漏增员直接导致断缴。
 * 本文件只做**台账**,不代替社保平台申报(平台动作走 browser/computer 点位包):
 *   · 入职 → 自动生成 increase(pending),账期=入职月;
 *   · 离职办结 → 自动生成 decrease(pending),账期=最后工作日所在月;
 *   · 人工可改基数/地区,平台报完回填 submitted/accepted 与回执号。
 */
import { and, desc, eq, sql } from 'drizzle-orm'

import { db } from '../db/index.js'
import { hrEmployee, hrInsuranceRateConfig, hrSocialInsuranceChange } from '@ihui/database'
import { AppError } from '../errors/AppError.js'

export type SocialChangeType = 'increase' | 'decrease' | 'adjust'

/** 空值守卫:基数类字段 null 与 undefined 同义,eqeqeq 纪律下不写 == null */
function isNil(value: unknown): value is null | undefined {
  return value === null || value === undefined
}

function monthOf(date: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new AppError('日期必须是 YYYY-MM-DD', 400, 'HR_DATE_FORMAT_INVALID')
  }
  return date.slice(0, 7)
}

async function latestRegionConfig(year: number) {
  const rows = await db
    .select({ regionName: hrInsuranceRateConfig.regionName })
    .from(hrInsuranceRateConfig)
    .where(
      and(eq(hrInsuranceRateConfig.enabled, true), eq(hrInsuranceRateConfig.effectiveYear, year)),
    )
    .orderBy(desc(hrInsuranceRateConfig.updatedAt))
    .limit(1)
  return rows[0]?.regionName ?? null
}

export async function createSocialChange(input: {
  employeeId: string
  changeType: SocialChangeType
  effectiveMonth?: string
  regionName?: string | null
  insuranceBase?: number | null
  fundBase?: number | null
  note?: string | null
  operatorId?: string | null
}) {
  if (!['increase', 'decrease', 'adjust'].includes(input.changeType)) {
    throw new AppError('changeType 只能是 increase/decrease/adjust', 400, 'HR_SOCIAL_TYPE_INVALID')
  }
  const [emp] = await db
    .select({ id: hrEmployee.id, status: hrEmployee.status, hireDate: hrEmployee.hireDate })
    .from(hrEmployee)
    .where(eq(hrEmployee.id, input.employeeId))
  if (!emp) throw new AppError('员工不存在', 404, 'HR_EMPLOYEE_NOT_FOUND')
  if (input.changeType === 'decrease' && emp.status !== 'left') {
    throw new AppError('员工尚未办结离职,不能减员', 400, 'HR_SOCIAL_DECREASE_BEFORE_LEFT')
  }
  const effectiveMonth =
    input.effectiveMonth ?? monthOf(emp.hireDate ?? new Date().toISOString().slice(0, 10))
  if (!/^\d{4}-\d{2}$/.test(effectiveMonth)) {
    throw new AppError('effectiveMonth 必须是 YYYY-MM', 400, 'HR_PERIOD_INVALID')
  }
  if (input.changeType === 'adjust' && (isNil(input.insuranceBase) || isNil(input.fundBase))) {
    throw new AppError('基数调整必须同时给社保基数与公积金基数', 400, 'HR_SOCIAL_BASE_REQUIRED')
  }
  const regionName =
    input.regionName ?? (await latestRegionConfig(Number(effectiveMonth.slice(0, 4))))
  const [row] = await db
    .insert(hrSocialInsuranceChange)
    .values({
      employeeId: input.employeeId,
      changeType: input.changeType,
      effectiveMonth,
      regionName,
      insuranceBase: isNil(input.insuranceBase) ? null : input.insuranceBase.toFixed(2),
      fundBase: isNil(input.fundBase) ? null : input.fundBase.toFixed(2),
      note: input.note?.trim() || null,
      operatorId: input.operatorId ?? null,
    })
    .returning()
  return row
}

/** 入职自动增员(幂等:同人同类型同月已存在则直接返回既有行)。 */
export async function autoIncreaseOnHire(
  employeeId: string,
  hireDate: string,
  operatorId?: string | null,
) {
  return ensureAutoChange(employeeId, 'increase', monthOf(hireDate), operatorId, '入职自动增员')
}

/** 离职自动减员(幂等)。 */
export async function autoDecreaseOnResign(
  employeeId: string,
  lastWorkDate: string,
  operatorId?: string | null,
) {
  return ensureAutoChange(
    employeeId,
    'decrease',
    monthOf(lastWorkDate),
    operatorId,
    '离职办结自动减员',
  )
}

async function ensureAutoChange(
  employeeId: string,
  changeType: SocialChangeType,
  effectiveMonth: string,
  operatorId: string | null | undefined,
  reason: string,
) {
  const [existing] = await db
    .select()
    .from(hrSocialInsuranceChange)
    .where(
      and(
        eq(hrSocialInsuranceChange.employeeId, employeeId),
        eq(hrSocialInsuranceChange.changeType, changeType),
        eq(hrSocialInsuranceChange.effectiveMonth, effectiveMonth),
      ),
    )
  if (existing) return { created: false, change: existing }
  const [emp] = await db
    .select({ id: hrEmployee.id })
    .from(hrEmployee)
    .where(eq(hrEmployee.id, employeeId))
  if (!emp) throw new AppError('员工不存在', 404, 'HR_EMPLOYEE_NOT_FOUND')
  const regionName = await latestRegionConfig(Number(effectiveMonth.slice(0, 4)))
  const [row] = await db
    .insert(hrSocialInsuranceChange)
    .values({
      employeeId,
      changeType,
      effectiveMonth,
      regionName,
      note: regionName ? reason : `${reason};未配置参保地,待补`,
      operatorId: operatorId ?? null,
    })
    .returning()
  if (!row) throw new AppError('生成增减员记录失败', 500, 'HR_SOCIAL_CHANGE_CREATE_FAILED')
  return { created: true, change: row }
}

export async function listSocialChanges(params: {
  employeeId?: string
  status?: string
  effectiveMonth?: string
  changeType?: string
}) {
  const conds = []
  if (params.employeeId) conds.push(eq(hrSocialInsuranceChange.employeeId, params.employeeId))
  if (params.status) conds.push(eq(hrSocialInsuranceChange.status, params.status))
  if (params.effectiveMonth) {
    conds.push(eq(hrSocialInsuranceChange.effectiveMonth, params.effectiveMonth))
  }
  if (params.changeType) conds.push(eq(hrSocialInsuranceChange.changeType, params.changeType))
  return db
    .select()
    .from(hrSocialInsuranceChange)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(hrSocialInsuranceChange.createdAt))
    .limit(500)
}

export async function markSocialSubmitted(
  id: string,
  platformRef: string,
  operatorId?: string | null,
) {
  if (!platformRef.trim()) throw new AppError('请填写平台回执号', 400, 'HR_SOCIAL_REF_REQUIRED')
  const [row] = await db
    .update(hrSocialInsuranceChange)
    .set({
      status: 'submitted',
      platformRef: platformRef.trim(),
      submittedAt: new Date(),
      operatorId: operatorId ?? null,
      updatedAt: new Date(),
    })
    .where(eq(hrSocialInsuranceChange.id, id))
    .returning()
  if (!row) throw new AppError('增减员记录不存在', 404, 'HR_SOCIAL_CHANGE_NOT_FOUND')
  return row
}

export async function markSocialAccepted(id: string, note?: string | null) {
  const [row] = await db
    .update(hrSocialInsuranceChange)
    .set({
      status: 'accepted',
      acceptedAt: new Date(),
      note: note?.trim() || null,
      updatedAt: new Date(),
    })
    .where(eq(hrSocialInsuranceChange.id, id))
    .returning()
  if (!row) throw new AppError('增减员记录不存在', 404, 'HR_SOCIAL_CHANGE_NOT_FOUND')
  return row
}

export async function markSocialFailed(id: string, note: string) {
  if (!note.trim()) throw new AppError('退回必须写明原因', 400, 'HR_SOCIAL_FAIL_REASON_REQUIRED')
  const [row] = await db
    .update(hrSocialInsuranceChange)
    .set({ status: 'failed', note: note.trim(), updatedAt: new Date() })
    .where(eq(hrSocialInsuranceChange.id, id))
    .returning()
  if (!row) throw new AppError('增减员记录不存在', 404, 'HR_SOCIAL_CHANGE_NOT_FOUND')
  return row
}

export async function socialChangeSummary(effectiveMonth: string) {
  const rows = await db
    .select({
      changeType: hrSocialInsuranceChange.changeType,
      status: hrSocialInsuranceChange.status,
      count: sqlCount(),
    })
    .from(hrSocialInsuranceChange)
    .where(eq(hrSocialInsuranceChange.effectiveMonth, effectiveMonth))
  return {
    effectiveMonth,
    groups: rows.map((r) => ({ ...r, count: Number(r.count) })),
  }
}

function sqlCount() {
  return sql<number>`COUNT(*)`
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
