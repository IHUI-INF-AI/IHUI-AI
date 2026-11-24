// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 凭证复核流 —— 制单 → 提交复核 → 复核通过/驳回 → 过账。
 *
 * 为什么需要它:代账场景里"制单的人"与"报税/过账的人"通常不是同一个人,
 * 过去系统只有一个 createdBy,谁都能直接过账,等于没有内控。本文件把复核做成
 * 一条可追溯的链:提交者、复核者、复核时刻、复核意见全部留痕。
 *
 * 状态(review_status,整数):
 *   0 未提交(新建默认) → 1 待复核 → 2 复核通过 → 过账放行
 *                                ↘ 3 复核驳回(必须写意见,退回制单人改)
 *   驳回后可重新提交回到 1。
 *
 * 过账闸由账套开关 fin_ledger.review_required 控制,默认关闭(兼容自动记账);
 * source 为 closing/reverse 的系统凭证豁免 —— 结账结转与红冲本身就是系统动作,
 * 其正确性由生成它们的服务保证,不应被复核闸挡死。
 */

import { and, asc, eq, isNull, sql } from 'drizzle-orm'

import { db } from '../../db/index.js'
import { AppError } from '../../errors/AppError.js'
import { finVoucher } from '@ihui/database'
import { getVoucher } from './voucher-service.js'

export const REVIEW_STATUS = {
  NONE: 0,
  PENDING: 1,
  APPROVED: 2,
  REJECTED: 3,
} as const

/** 提交复核(制单人动作):0/3 → 1;已待复核幂等;已通过拒绝。 */
export async function submitReview(voucherId: string) {
  const voucher = await getVoucher(voucherId)
  if (voucher.status === 'reversed') {
    throw new AppError('已红冲的凭证不能再提交复核', 409, 'FIN_REVIEW_VOUCHER_REVERSED')
  }
  if (voucher.status === 'posted') {
    throw new AppError('已过账的凭证不能再提交复核', 409, 'FIN_REVIEW_VOUCHER_POSTED')
  }
  if (voucher.reviewStatus === REVIEW_STATUS.APPROVED) {
    throw new AppError('凭证已复核通过,无需重复提交', 409, 'FIN_REVIEW_ALREADY_APPROVED')
  }
  if (voucher.reviewStatus === REVIEW_STATUS.PENDING) {
    return voucher
  }
  const [row] = await db
    .update(finVoucher)
    .set({
      reviewStatus: REVIEW_STATUS.PENDING,
      reviewedBy: null,
      reviewedAt: null,
      reviewComment: null,
      updatedAt: new Date(),
    })
    .where(eq(finVoucher.id, voucherId))
    .returning()
  return row!
}

/** 复核通过(复核人动作):1 → 2。复核人不得是制单人。 */
export async function approveReview(
  voucherId: string,
  reviewerId: string | null,
  comment?: string,
) {
  if (!reviewerId) throw new AppError('复核人必须登录用户', 400, 'FIN_REVIEW_REVIEWER_REQUIRED')
  const voucher = await getVoucher(voucherId)
  if (voucher.reviewStatus === REVIEW_STATUS.APPROVED) return voucher
  if (voucher.reviewStatus !== REVIEW_STATUS.PENDING) {
    throw new AppError('只有待复核状态的凭证可以复核通过', 409, 'FIN_REVIEW_NOT_PENDING')
  }
  if (voucher.createdBy && voucher.createdBy === reviewerId) {
    throw new AppError('复核人不能是制单人本人', 409, 'FIN_REVIEW_SELF_APPROVE')
  }
  const [row] = await db
    .update(finVoucher)
    .set({
      reviewStatus: REVIEW_STATUS.APPROVED,
      reviewedBy: reviewerId,
      reviewedAt: new Date(),
      reviewComment: comment?.trim() || null,
      updatedAt: new Date(),
    })
    .where(eq(finVoucher.id, voucherId))
    .returning()
  return row!
}

/** 复核驳回(复核人动作):1 → 3,必须写理由。 */
export async function rejectReview(voucherId: string, reviewerId: string | null, comment: string) {
  if (!reviewerId) throw new AppError('复核人必须登录用户', 400, 'FIN_REVIEW_REVIEWER_REQUIRED')
  const reason = comment?.trim() ?? ''
  if (reason.length < 2) {
    throw new AppError('驳回必须写复核意见(至少 2 个字)', 400, 'FIN_REVIEW_COMMENT_REQUIRED')
  }
  const voucher = await getVoucher(voucherId)
  if (voucher.reviewStatus !== REVIEW_STATUS.PENDING) {
    throw new AppError('只有待复核状态的凭证可以驳回', 409, 'FIN_REVIEW_NOT_PENDING')
  }
  if (voucher.createdBy && voucher.createdBy === reviewerId) {
    throw new AppError('复核人不能是制单人本人', 409, 'FIN_REVIEW_SELF_APPROVE')
  }
  const [row] = await db
    .update(finVoucher)
    .set({
      reviewStatus: REVIEW_STATUS.REJECTED,
      reviewedBy: reviewerId,
      reviewedAt: new Date(),
      reviewComment: reason,
      updatedAt: new Date(),
    })
    .where(eq(finVoucher.id, voucherId))
    .returning()
  return row!
}

/**
 * 复核队列:待复核 / 驳回 / 未提交,按凭证日期升序。
 */
export async function reviewQueue(params: {
  ledgerId: string
  status?: number
  page?: number
  limit?: number
}) {
  const page = Math.max(1, params.page ?? 1)
  const limit = Math.min(200, Math.max(1, params.limit ?? 20))
  const where = [eq(finVoucher.ledgerId, params.ledgerId), isNull(finVoucher.deletedAt)]
  if (params.status !== undefined) {
    if (![0, 1, 2, 3].includes(params.status)) {
      throw new AppError('status 必须是 0/1/2/3', 400, 'FIN_REVIEW_BAD_STATUS')
    }
    where.push(eq(finVoucher.reviewStatus, params.status))
  }
  const cond = and(...where)
  const [rows, count] = await Promise.all([
    db
      .select({
        id: finVoucher.id,
        voucherNo: finVoucher.voucherNo,
        voucherDate: finVoucher.voucherDate,
        period: finVoucher.period,
        summary: finVoucher.summary,
        status: finVoucher.status,
        source: finVoucher.source,
        reviewStatus: finVoucher.reviewStatus,
        totalDebit: finVoucher.totalDebit,
        createdBy: finVoucher.createdBy,
        reviewedBy: finVoucher.reviewedBy,
        reviewedAt: finVoucher.reviewedAt,
        reviewComment: finVoucher.reviewComment,
      })
      .from(finVoucher)
      .where(cond)
      .orderBy(asc(finVoucher.voucherDate), asc(finVoucher.voucherNo))
      .limit(limit)
      .offset((page - 1) * limit),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(finVoucher)
      .where(cond),
  ])
  return { list: rows, page, limit, total: count[0]?.n ?? 0 }
}

/** 复核看板:各状态计数 + 待复核金额合计。 */
export async function reviewSummary(ledgerId: string, period?: string) {
  const where = [eq(finVoucher.ledgerId, ledgerId), isNull(finVoucher.deletedAt)]
  if (period) where.push(eq(finVoucher.period, period))
  const rows = await db
    .select({
      reviewStatus: finVoucher.reviewStatus,
      n: sql<number>`count(*)::int`,
      debit: sql<string>`coalesce(sum(${finVoucher.totalDebit}), 0)::text`,
    })
    .from(finVoucher)
    .where(and(...where))
    .groupBy(finVoucher.reviewStatus)
  const by = new Map(rows.map((r) => [r.reviewStatus, r]))
  return {
    ledgerId,
    period: period ?? null,
    notSubmitted: by.get(REVIEW_STATUS.NONE)?.n ?? 0,
    pending: by.get(REVIEW_STATUS.PENDING)?.n ?? 0,
    approved: by.get(REVIEW_STATUS.APPROVED)?.n ?? 0,
    rejected: by.get(REVIEW_STATUS.REJECTED)?.n ?? 0,
    pendingAmount: by.get(REVIEW_STATUS.PENDING)?.debit ?? '0.00',
    total: rows.reduce((s, r) => s + r.n, 0),
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
