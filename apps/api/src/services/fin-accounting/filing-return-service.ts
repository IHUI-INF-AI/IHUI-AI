// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 申报表(表级)复核服务 —— 2026-11-23 立。
 *
 * 现状缺口:申报任务(fin_filing_task)只有一个 status,「任务 submitted」既可能是
 * 表全审过、也可能只是某个人点了按钮。一次申报常有多张表(主表 + 附表),表上
 * 没有「谁编、谁审、驳回理由」就无从追责,也没法挡「附表没人看就报出去」。
 *
 * 本文件的边界:
 *   · 表体(payload)由服务层从申报任务汇总生成最小可核行次(计税依据/应纳税额),
 *     不猜税局行号——行号与明细口径由人复核时补,生成物只保证"两个数与原任务一致"。
 *   · 一任务一表型只留一行(taskId + formCode 唯一),重编原地升 version 并清掉上轮复核结论。
 *   · 已 approved / filed 的表不允许再覆盖(要改就新建表型或先人工回退)。
 */

import { and, desc, eq, sql, type SQL } from 'drizzle-orm'

import { db } from '../../db/index.js'
import { AppError } from '../../errors/AppError.js'
import { finFilingReturn, finFilingTask, type FinFilingReturn } from '@ihui/database'

export type FilingReturnStatus = 'draft' | 'submitted' | 'approved' | 'rejected' | 'filed'

/** 表型默认映射:税种 → 该税种主表代号与名称(附表由人按需生成) */
const DEFAULT_FORM: Record<string, { code: string; name: string }> = {
  VAT: { code: 'vat_main', name: '增值税纳税申报表(主表)' },
  CIT: { code: 'cit_a', name: '企业所得税年度纳税申报表(A 类)' },
  IIT: { code: 'iit_withhold', name: '个人所得税扣缴申报表' },
  SURTAX: { code: 'surtax_main', name: '附加税费申报表' },
  STAMP: { code: 'stamp_main', name: '印花税纳税申报表' },
  CONSUMPTION: { code: 'consumption_main', name: '消费税纳税申报表' },
  PROPERTY: { code: 'property_main', name: '房产税纳税申报表' },
  LAND_USE: { code: 'land_use_main', name: '城镇土地使用税纳税申报表' },
  VEHICLE_VESSEL: { code: 'vehicle_vessel_main', name: '车船税纳税申报表' },
  CULTURE: { code: 'culture_main', name: '文化事业建设费申报表' },
  OTHER: { code: 'other_main', name: '其他税费申报表' },
}

export interface ReturnLine {
  code: string
  name: string
  /** 金额(元,两位小数);null = 该行不适用/未取到 */
  amount: number | null
}

interface ReturnPayload {
  lines: ReturnLine[]
  totals: { taxableBase: number | null; taxAmount: number | null }
  note: string
}

function num(v: string | null | undefined): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function buildPayload(task: {
  taxableBase: string | null
  taxAmount: string | null
  taxType: string
  period: string
}): ReturnPayload {
  const base = num(task.taxableBase)
  const tax = num(task.taxAmount)
  const lines: ReturnLine[] = [
    { code: 'taxable_base', name: '计税依据(元)', amount: base },
    { code: 'tax_amount', name: '应纳税额(元)', amount: tax },
  ]
  return {
    lines,
    totals: { taxableBase: base, taxAmount: tax },
    note: `由申报任务 ${task.taxType} / ${task.period} 生成;行次与明细口径请在复核时补充。`,
  }
}

/** 生成(或原地重编)某任务的一张表 */
export async function generateReturn(params: {
  taskId: string
  formCode?: string | undefined
  formName?: string | undefined
  userId?: string | undefined
}): Promise<FinFilingReturn> {
  const [task] = await db.select().from(finFilingTask).where(eq(finFilingTask.id, params.taskId))
  if (!task) throw new AppError('申报任务不存在', 404, 'FILING_TASK_NOT_FOUND')

  const def = DEFAULT_FORM[task.taxType] ?? {
    code: `${task.taxType.toLowerCase()}_main`,
    name: `${task.taxType} 申报表`,
  }
  const formCode = (params.formCode ?? def.code).trim()
  const formName = (params.formName ?? def.name).trim()
  if (!formCode || !formName) throw new AppError('表代号/表名不能为空', 400, 'FILING_FORM_BAD')

  const payload = buildPayload(task)
  const now = new Date()
  const [existing] = await db
    .select()
    .from(finFilingReturn)
    .where(and(eq(finFilingReturn.taskId, params.taskId), eq(finFilingReturn.formCode, formCode)))

  if (existing) {
    if (existing.status === 'approved' || existing.status === 'filed') {
      throw new AppError(
        `已${existing.status === 'approved' ? '复核通过' : '报送'}的表不能重编,请先人工回退`,
        409,
        'FILING_RETURN_LOCKED',
      )
    }
    if (existing.status === 'submitted') {
      throw new AppError('该表正在复核中,不能重编', 409, 'FILING_RETURN_IN_REVIEW')
    }
    // draft / rejected → 原地升版,清掉上轮复核结论
    const [updated] = await db
      .update(finFilingReturn)
      .set({
        formName,
        payload: payload as unknown as Record<string, unknown>,
        taxableBase: task.taxableBase,
        taxAmount: task.taxAmount,
        status: 'draft',
        version: existing.version + 1,
        preparedBy: params.userId ?? existing.preparedBy,
        submittedBy: null,
        submittedAt: null,
        reviewedBy: null,
        reviewedAt: null,
        reviewRemark: null,
        updatedAt: now,
      })
      .where(eq(finFilingReturn.id, existing.id))
      .returning()
    return updated as FinFilingReturn
  }

  const [inserted] = await db
    .insert(finFilingReturn)
    .values({
      taskId: task.id,
      clientId: task.clientId,
      taxType: task.taxType,
      period: task.period,
      formCode,
      formName,
      payload: payload as unknown as Record<string, unknown>,
      taxableBase: task.taxableBase,
      taxAmount: task.taxAmount,
      status: 'draft',
      preparedBy: params.userId ?? null,
    })
    .returning()
  return inserted as FinFilingReturn
}

/** 表级改稿(仅 draft / rejected):只允许改表体与两个金额,不碰状态机 */
export async function patchReturn(params: {
  id: string
  payload?: Record<string, unknown> | undefined
  taxableBase?: string | null | undefined
  taxAmount?: string | null | undefined
  formName?: string | undefined
}): Promise<FinFilingReturn> {
  const [row] = await db.select().from(finFilingReturn).where(eq(finFilingReturn.id, params.id))
  if (!row) throw new AppError('申报表不存在', 404, 'FILING_RETURN_NOT_FOUND')
  if (row.status !== 'draft' && row.status !== 'rejected') {
    throw new AppError('只有草稿或已驳回的表可以改', 409, 'FILING_RETURN_NOT_EDITABLE')
  }
  // 金额三处必须同向:字段(taxableBase/taxAmount) 与表体(payload.lines/totals) 不能各说各话。
  // 只改金额不传 payload 时按新金额重建表体;传了 payload 则把两行金额按字段值回写。
  const effBase = params.taxableBase !== undefined ? params.taxableBase : row.taxableBase
  const effTax = params.taxAmount !== undefined ? params.taxAmount : row.taxAmount
  const nextPayload = (() => {
    if (params.payload === undefined) {
      return buildPayload({
        taxableBase: effBase,
        taxAmount: effTax,
        taxType: row.taxType,
        period: row.period,
      })
    }
    const merged = { ...params.payload } as Partial<ReturnPayload>
    if (Array.isArray(merged.lines)) {
      merged.lines = merged.lines.map((l) =>
        l.code === 'taxable_base'
          ? { ...l, amount: num(effBase) }
          : l.code === 'tax_amount'
            ? { ...l, amount: num(effTax) }
            : l,
      )
    }
    merged.totals = { taxableBase: num(effBase), taxAmount: num(effTax) }
    return merged
  })()

  const [updated] = await db
    .update(finFilingReturn)
    .set({
      payload: nextPayload as unknown as Record<string, unknown>,
      taxableBase: effBase,
      taxAmount: effTax,
      ...(params.formName !== undefined ? { formName: params.formName } : {}),
      updatedAt: new Date(),
    })
    .where(eq(finFilingReturn.id, params.id))
    .returning()
  return updated as FinFilingReturn
}

export interface ReturnQuery {
  clientId?: string | undefined
  taskId?: string | undefined
  period?: string | undefined
  status?: string | undefined
  limit?: number | undefined
  offset?: number | undefined
}

export async function listReturns(
  params: ReturnQuery,
): Promise<{ list: FinFilingReturn[]; total: number }> {
  const filters: SQL[] = []
  if (params.clientId) filters.push(eq(finFilingReturn.clientId, params.clientId))
  if (params.taskId) filters.push(eq(finFilingReturn.taskId, params.taskId))
  if (params.period) filters.push(eq(finFilingReturn.period, params.period))
  if (params.status) filters.push(eq(finFilingReturn.status, params.status))
  const where = filters.length > 0 ? and(...filters) : undefined
  const limit = Math.min(params.limit ?? 50, 200)
  const offset = Math.max(params.offset ?? 0, 0)
  const list = await db
    .select()
    .from(finFilingReturn)
    .where(where)
    .orderBy(desc(finFilingReturn.period), desc(finFilingReturn.createdAt))
    .limit(limit)
    .offset(offset)
  const [countRow] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(finFilingReturn)
    .where(where)
  return { list, total: countRow?.n ?? 0 }
}

export async function getReturn(id: string): Promise<FinFilingReturn> {
  const [row] = await db.select().from(finFilingReturn).where(eq(finFilingReturn.id, id))
  if (!row) throw new AppError('申报表不存在', 404, 'FILING_RETURN_NOT_FOUND')
  return row
}

/** 提交复核:draft / rejected → submitted */
export async function submitReturn(params: {
  id: string
  userId?: string | undefined
}): Promise<FinFilingReturn> {
  const row = await getReturn(params.id)
  if (row.status !== 'draft' && row.status !== 'rejected') {
    throw new AppError(`当前状态(${row.status})不能提交复核`, 409, 'FILING_RETURN_BAD_STATE')
  }
  const now = new Date()
  const [updated] = await db
    .update(finFilingReturn)
    .set({
      status: 'submitted',
      submittedBy: params.userId ?? row.submittedBy,
      submittedAt: now,
      // 重提时清掉上一轮驳回结论,避免"驳回理由"跟着新稿走
      reviewedBy: null,
      reviewedAt: null,
      reviewRemark: null,
      updatedAt: now,
    })
    .where(eq(finFilingReturn.id, params.id))
    .returning()
  return updated as FinFilingReturn
}

/** 复核决策:submitted → approved / rejected */
export async function reviewReturn(params: {
  id: string
  approve: boolean
  remark?: string | undefined
  userId?: string | undefined
}): Promise<FinFilingReturn> {
  const row = await getReturn(params.id)
  if (row.status !== 'submitted') {
    throw new AppError(`当前状态(${row.status})不在复核中`, 409, 'FILING_RETURN_NOT_IN_REVIEW')
  }
  if (!params.approve && !params.remark?.trim()) {
    throw new AppError('驳回必须写理由', 400, 'FILING_RETURN_REMARK_REQUIRED')
  }
  const now = new Date()
  const [updated] = await db
    .update(finFilingReturn)
    .set({
      status: params.approve ? 'approved' : 'rejected',
      reviewedBy: params.userId ?? null,
      reviewedAt: now,
      reviewRemark: params.remark?.trim() || null,
      updatedAt: now,
    })
    .where(eq(finFilingReturn.id, params.id))
    .returning()
  return updated as FinFilingReturn
}

/** 表级复核看板:各状态计数 + 是否"全部表已批" */
export async function returnsSummary(params: {
  clientId?: string | undefined
  period?: string | undefined
}): Promise<{
  total: number
  draft: number
  submitted: number
  approved: number
  rejected: number
  filed: number
  pendingReview: number
  allApproved: boolean
}> {
  const filters: SQL[] = []
  if (params.clientId) filters.push(eq(finFilingReturn.clientId, params.clientId))
  if (params.period) filters.push(eq(finFilingReturn.period, params.period))
  const where = filters.length > 0 ? and(...filters) : undefined
  const rows = await db
    .select({ status: finFilingReturn.status, n: sql<number>`count(*)::int` })
    .from(finFilingReturn)
    .where(where)
    .groupBy(finFilingReturn.status)
  const by = new Map(rows.map((r) => [r.status, r.n]))
  const total = rows.reduce((s, r) => s + r.n, 0)
  const draft = by.get('draft') ?? 0
  const submitted = by.get('submitted') ?? 0
  const approved = by.get('approved') ?? 0
  const rejected = by.get('rejected') ?? 0
  const filed = by.get('filed') ?? 0
  return {
    total,
    draft,
    submitted,
    approved,
    rejected,
    filed,
    pendingReview: submitted,
    allApproved: total > 0 && approved + filed === total,
  }
}

/** 任务级汇总:一次申报下所有表是否都已通过(给申报看板塞结论) */
export async function taskApprovalProgress(taskId: string): Promise<{
  total: number
  approved: number
  pending: number
  rejected: number
  allApproved: boolean
}> {
  const { list } = await listReturns({ taskId, limit: 200 })
  const approved = list.filter((r) => r.status === 'approved' || r.status === 'filed').length
  const rejected = list.filter((r) => r.status === 'rejected').length
  const pending = list.filter((r) => r.status === 'draft' || r.status === 'submitted').length
  return {
    total: list.length,
    approved,
    pending,
    rejected,
    allApproved: list.length > 0 && approved === list.length,
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
