// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 算薪审批(2026-11-24 补口)。
 *
 * 此前 POST /api/hr-payroll/status 直接把周期改成 approved —— 谁提的、谁批的、
 * 退回理由一概没有落点,等于"审批"只是一次状态赋值。本文件补:
 *   · submit:算薪完成 → 提交复核(记 submittedBy/At,状态仍 calculated);
 *   · review:复核人批准/退回(记 reviewedBy/At/意见;退回必填原因);
 *   · 职责分离:提交人不得批准自己提交的周期(制单≠复核)。
 * 状态机:calculated → (submit) calculated → (approve) approved | (reject) rejected;
 * rejected 可重新 /calculate(既有服务允许非 approved/paid 周期重算)。
 */
import { and, eq, sql } from 'drizzle-orm'

import { db } from '../db/index.js'
import { hrPayrollItem, hrPayrollPeriod } from '@ihui/database'
import { AppError } from '../errors/AppError.js'

export async function submitPayrollForReview(
  periodMonth: string,
  userId: string | null | undefined,
) {
  if (!userId) throw new AppError('缺少操作人身份', 401, 'HR_OPERATOR_REQUIRED')
  const [period] = await db
    .select()
    .from(hrPayrollPeriod)
    .where(eq(hrPayrollPeriod.periodMonth, periodMonth))
    .limit(1)
  if (!period) throw new AppError('该月薪资周期不存在', 404, 'PAYROLL_PERIOD_NOT_FOUND')
  if (period.status !== 'calculated') {
    throw new AppError(
      `周期当前为 ${period.status},只有 calculated 才能提交复核`,
      409,
      'PAYROLL_REVIEW_STATE_INVALID',
    )
  }
  const [{ count } = { count: 0 }] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(hrPayrollItem)
    .where(eq(hrPayrollItem.periodId, period.id))
  if (Number(count) === 0) {
    throw new AppError('该周期没有工资明细,不能提交复核', 409, 'PAYROLL_ITEMS_EMPTY')
  }
  const [row] = await db
    .update(hrPayrollPeriod)
    .set({ submittedBy: userId, submittedAt: new Date(), updatedAt: new Date() })
    .where(eq(hrPayrollPeriod.id, period.id))
    .returning()
  return row
}

export async function reviewPayroll(input: {
  periodMonth: string
  decision: 'approve' | 'reject'
  note?: string | null
  reviewerId: string | null | undefined
}) {
  if (!input.reviewerId) throw new AppError('缺少复核人身份', 401, 'HR_OPERATOR_REQUIRED')
  const [period] = await db
    .select()
    .from(hrPayrollPeriod)
    .where(eq(hrPayrollPeriod.periodMonth, input.periodMonth))
    .limit(1)
  if (!period) throw new AppError('该月薪资周期不存在', 404, 'PAYROLL_PERIOD_NOT_FOUND')
  if (period.status !== 'calculated') {
    throw new AppError(
      `周期当前为 ${period.status},只有 calculated 才能复核`,
      409,
      'PAYROLL_REVIEW_STATE_INVALID',
    )
  }
  const preparers = [period.submittedBy, period.operatorId].filter(Boolean)
  if (preparers.includes(input.reviewerId)) {
    throw new AppError(
      '提交人不得复核自己提交的薪资周期(制单≠复核)',
      403,
      'PAYROLL_SELF_REVIEW_FORBIDDEN',
    )
  }
  const note = input.note?.trim() || null
  if (input.decision === 'reject' && !note) {
    throw new AppError('退回必须写明原因', 400, 'PAYROLL_REJECT_REASON_REQUIRED')
  }

  if (input.decision === 'approve') {
    const [{ count } = { count: 0 }] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(hrPayrollItem)
      .where(eq(hrPayrollItem.periodId, period.id))
    if (Number(count) === 0) {
      throw new AppError('该周期没有工资明细,不能批准', 409, 'PAYROLL_ITEMS_EMPTY')
    }
    const [row] = await db
      .update(hrPayrollPeriod)
      .set({
        status: 'approved',
        reviewedBy: input.reviewerId,
        reviewedAt: new Date(),
        reviewNote: note,
        rejectedReason: null,
        updatedAt: new Date(),
      })
      .where(and(eq(hrPayrollPeriod.id, period.id), eq(hrPayrollPeriod.status, 'calculated')))
      .returning()
    if (!row) throw new AppError('状态已被并发修改,请刷新后重试', 409, 'PAYROLL_REVIEW_CONFLICT')
    return row
  }

  const [row] = await db
    .update(hrPayrollPeriod)
    .set({
      status: 'rejected',
      reviewedBy: input.reviewerId,
      reviewedAt: new Date(),
      rejectedReason: note,
      updatedAt: new Date(),
    })
    .where(and(eq(hrPayrollPeriod.id, period.id), eq(hrPayrollPeriod.status, 'calculated')))
    .returning()
  if (!row) throw new AppError('状态已被并发修改,请刷新后重试', 409, 'PAYROLL_REVIEW_CONFLICT')
  return row
}

/** 审批留痕(前端时间线直接渲染;只读)。 */
export async function payrollReviewTrail(periodMonth: string) {
  const [period] = await db
    .select({
      periodMonth: hrPayrollPeriod.periodMonth,
      status: hrPayrollPeriod.status,
      operatorId: hrPayrollPeriod.operatorId,
      submittedBy: hrPayrollPeriod.submittedBy,
      submittedAt: hrPayrollPeriod.submittedAt,
      reviewedBy: hrPayrollPeriod.reviewedBy,
      reviewedAt: hrPayrollPeriod.reviewedAt,
      reviewNote: hrPayrollPeriod.reviewNote,
      rejectedReason: hrPayrollPeriod.rejectedReason,
    })
    .from(hrPayrollPeriod)
    .where(eq(hrPayrollPeriod.periodMonth, periodMonth))
    .limit(1)
  if (!period) throw new AppError('该月薪资周期不存在', 404, 'PAYROLL_PERIOD_NOT_FOUND')
  const events: Array<{
    at: string | null
    type: string
    by: string | null
    note?: string | null
  }> = []
  if (period.submittedAt) {
    events.push({
      at: period.submittedAt.toISOString(),
      type: 'submitted',
      by: period.submittedBy,
      note: null,
    })
  }
  if (period.reviewedAt) {
    events.push({
      at: period.reviewedAt.toISOString(),
      type: period.status === 'rejected' ? 'rejected' : 'approved',
      by: period.reviewedBy,
      note: period.status === 'rejected' ? period.rejectedReason : period.reviewNote,
    })
  }
  return { ...period, events }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
