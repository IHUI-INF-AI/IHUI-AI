// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 费用报销闭环服务(2026-11-24 四波)。
 *
 * 状态机(纯核 decideNext 单测钉死):
 *   submitted --approve×chain 终点--> approved --pay--> paid --link-voucher--> 入账(幂等)
 *   submitted|approved --reject--> rejected(终态,重报须新单)
 *   submitted|approved --void--> voided(终态);paid 之后不可 void(要回冲走红冲凭证入口)。
 * 纪律:
 *   · 审批链提交时刻固化(approverChain),后改规则不影响在飞单;
 *   · 非当前步审批人拒操作;提交人不能是自己单据的唯一审批人(反自批);
 *   · 入账凭证幂等 sourceRef=expense:<id>;账套/科目不存在由 createVoucher 既有硬闸兜底;
 *   · 票据复用校验 assertNoVoucherReuse(逐条真查,与凭证附件的"一票一单"同型)。
 */
import { and, asc, eq, inArray, isNull } from 'drizzle-orm'

import { db } from '../db/index.js'
import { hrEmployee, hrExpenseClaim, type HrExpenseClaim } from '@ihui/database'
import { AppError } from '../errors/AppError.js'
import { createNotificationIdempotent } from '../db/notification-queries.js'
import { bizDayKey } from '../utils/biz-day.js'
import { fromCents, toCents } from './fin-accounting/money.js'
import { createVoucher } from './fin-accounting/voucher-service.js'
import { resolveExpenseApproverChain } from './hr-expense-approvers.js'

export const EXPENSE_PAYMENT_METHODS = ['bank', 'cash'] as const
export type ExpensePaymentMethod = (typeof EXPENSE_PAYMENT_METHODS)[number]

export interface DecideOutcome {
  status: string
  currentStep: number
  finished: boolean
  nextApprover: string | null
}

/**
 * 审批动作纯核:actor 只可以是当前步审批人;approve 推进链,链尽头 ⇒ approved;
 * reject 直接终态。返回新状态,不触库(可测)。
 */
export function decideNext(
  claim: Pick<HrExpenseClaim, 'status' | 'approverChain' | 'currentStep'>,
  actor: string,
  action: 'approve' | 'reject',
): DecideOutcome {
  if (claim.status !== 'submitted') {
    throw new AppError(`单据状态 ${claim.status} 不可再审批`, 409, 'EXPENSE_NOT_APPROVABLE')
  }
  const expected = claim.approverChain[claim.currentStep]
  if (expected !== actor) {
    throw new AppError('不是当前步审批人,无权操作本步', 403, 'EXPENSE_NOT_CURRENT_APPROVER')
  }
  if (action === 'reject') {
    return {
      status: 'rejected',
      currentStep: claim.currentStep,
      finished: true,
      nextApprover: null,
    }
  }
  const next = claim.currentStep + 1
  if (next >= claim.approverChain.length) {
    return {
      status: 'approved',
      currentStep: claim.currentStep,
      finished: true,
      nextApprover: null,
    }
  }
  return {
    status: 'submitted',
    currentStep: next,
    finished: false,
    nextApprover: claim.approverChain[next] ?? null,
  }
}

/** 入账分录构造纯核(测试钉借贷平衡与方向) */
export function buildExpenseVoucherLines(
  claim: Pick<HrExpenseClaim, 'amount' | 'paymentMethod'>,
  expenseAccountCode: string,
): Array<{ accountCode: string; direction: 'debit' | 'credit'; amount: string; summary: string }> {
  const cents = toCents(claim.amount)
  if (cents <= 0) throw new AppError('报销金额为 0,不入账', 409, 'EXPENSE_AMOUNT_ZERO')
  const cashCode = claim.paymentMethod === 'cash' ? '1001' : '1002'
  return [
    {
      accountCode: expenseAccountCode,
      direction: 'debit',
      amount: fromCents(cents),
      summary: `费用报销(借,贷${cashCode})`,
    },
    {
      accountCode: cashCode,
      direction: 'credit',
      amount: fromCents(cents),
      summary: `费用报销付款,${claim.paymentMethod === 'cash' ? '现金' : '银行代发'}`,
    },
  ]
}

/** 一票一单:fileId 是否已被其他未删报销单占用(逐条真查;数据量到万级前不引表达式索引) */
export async function findVoucherReuse(fileIds: readonly string[], selfId?: string) {
  const rows = await db
    .select({
      id: hrExpenseClaim.id,
      title: hrExpenseClaim.title,
      vouchers: hrExpenseClaim.vouchers,
    })
    .from(hrExpenseClaim)
    .where(
      and(
        isNull(hrExpenseClaim.deletedAt),
        inArray(hrExpenseClaim.status, ['submitted', 'approved', 'paid']),
      ),
    )
  const hits: Array<{ fileId: string; claimId: string; title: string }> = []
  for (const row of rows) {
    if (selfId && row.id === selfId) continue
    for (const v of row.vouchers ?? []) {
      if (fileIds.includes(v.fileId)) {
        hits.push({ fileId: v.fileId, claimId: row.id, title: row.title })
      }
    }
  }
  return hits
}

export interface SubmitExpenseInput {
  employeeId: string
  ledgerId?: string | null
  category: string
  title: string
  amount: string
  vouchers: Array<{ fileId: string; name: string; url: string; sha256?: string }>
  /**
   * 自助面可缺省(2026-11-24 十一波):缺省时按财务权限池自动解析
   * (见 hr-expense-approvers);管理面路由仍要求显式给链。
   */
  approverChain?: string[]
  note?: string | null
}

export async function submitClaim(input: SubmitExpenseInput, submittedBy: string | null) {
  if (!input.vouchers || input.vouchers.length === 0) {
    throw new AppError('报销必须附票据影像(≥1),裸金额提单不入账', 400, 'EXPENSE_NO_VOUCHERS')
  }
  const chain =
    input.approverChain && input.approverChain.length > 0
      ? input.approverChain
      : (await resolveExpenseApproverChain(submittedBy)).userIds
  if (chain.length === 0) {
    throw new AppError('审批链至少 1 人', 400, 'EXPENSE_EMPTY_CHAIN')
  }
  const cents = toCents(input.amount)
  if (cents <= 0) throw new AppError('报销金额必须大于 0', 400, 'EXPENSE_AMOUNT_INVALID')
  if (submittedBy && chain.length === 1 && chain[0] === submittedBy) {
    throw new AppError('提交人不能是自己单据的唯一审批人(反自批)', 400, 'EXPENSE_SELF_APPROVAL')
  }
  const [emp] = await db
    .select({ id: hrEmployee.id })
    .from(hrEmployee)
    .where(eq(hrEmployee.id, input.employeeId))
  if (!emp) throw new AppError('报销人不存在', 404, 'EXPENSE_EMPLOYEE_NOT_FOUND')
  const dup = await findVoucherReuse(input.vouchers.map((v) => v.fileId))
  if (dup.length > 0) {
    throw new AppError(
      `票据已挂在其他报销单:${dup.map((d) => `${d.title}(${d.fileId.slice(0, 8)})`).join(';')}`,
      409,
      'EXPENSE_VOUCHER_REUSED',
    )
  }
  const [row] = await db
    .insert(hrExpenseClaim)
    .values({
      employeeId: input.employeeId,
      ledgerId: input.ledgerId ?? null,
      category: input.category,
      title: input.title,
      amount: fromCents(cents),
      vouchers: input.vouchers,
      approverChain: chain,
      currentStep: 0,
      steps: [],
      status: 'submitted',
      note: input.note ?? null,
      submittedBy,
    })
    .returning()
  const first = row!
  await notifyExpense(
    first.approverChain[0] ?? null,
    '有新的报销单待你审批',
    `${first.title}(¥${first.amount})`,
    first.id,
    first,
  )
  return first
}

async function notifyExpense(
  to: string | null | undefined,
  title: string,
  content: string,
  claimId: string,
  meta: Record<string, unknown>,
) {
  if (!to) return
  await createNotificationIdempotent({
    userId: to,
    type: 'hr.expense',
    title,
    content,
    data: { claimId, ...meta },
    idempotencyKey: `hr-expense:${claimId}:${title.slice(0, 12)}:${bizDayKey(new Date())}`,
  })
}

export async function getClaim(id: string) {
  const [row] = await db
    .select()
    .from(hrExpenseClaim)
    .where(and(eq(hrExpenseClaim.id, id), isNull(hrExpenseClaim.deletedAt)))
  if (!row) throw new AppError('报销单不存在', 404, 'EXPENSE_NOT_FOUND')
  return row
}

export async function decideClaim(
  id: string,
  actor: string,
  action: 'approve' | 'reject',
  comment?: string,
) {
  const claim = await getClaim(id)
  const outcome = decideNext(claim, actor, action)
  const now = new Date()
  const steps = [
    ...(claim.steps ?? []),
    { approver: actor, action, at: now.toISOString(), comment: comment?.slice(0, 500) },
  ]
  const [updated] = await db
    .update(hrExpenseClaim)
    .set({ status: outcome.status, currentStep: outcome.currentStep, steps, updatedAt: now })
    .where(eq(hrExpenseClaim.id, id))
    .returning()
  const row = updated!
  if (action === 'reject') {
    await notifyExpense(
      row.submittedBy,
      '报销被驳回',
      `${row.title}:${comment ?? '未填理由'}`,
      row.id,
      { action },
    )
  } else if (outcome.finished) {
    await notifyExpense(row.submittedBy, '报销已批准(可付款)', row.title, row.id, { action })
  } else if (outcome.nextApprover) {
    await notifyExpense(
      outcome.nextApprover,
      '有新的报销单待你审批',
      `${row.title}(¥${row.amount})`,
      row.id,
      { action: 'forward' },
    )
  }
  return row
}

export async function payClaim(id: string, method: ExpensePaymentMethod, actor: string | null) {
  const claim = await getClaim(id)
  if (claim.status !== 'approved') {
    throw new AppError(`状态 ${claim.status} 不可付款(需先走完审批)`, 409, 'EXPENSE_NOT_APPROVED')
  }
  const now = new Date()
  await db
    .update(hrExpenseClaim)
    .set({ status: 'paid', paymentMethod: method, paidAt: now, updatedAt: now })
    .where(eq(hrExpenseClaim.id, id))
  await notifyExpense(
    claim.submittedBy ?? actor,
    '报销款已支付',
    `${claim.title}(¥${claim.amount}, ${method})`,
    id,
    { action: 'paid' },
  )
  return getClaim(id)
}

/** 入账:paid + 已绑账套 ⇒ 生成凭证(幂等);expenseAccountCode 由调用方给(默认 5502 管理费用) */
export async function linkVoucher(id: string, expenseAccountCode: string, userId?: string | null) {
  const claim = await getClaim(id)
  if (claim.voucherId && claim.voucherNo) return { ...claim, idempotent: true }
  if (claim.status !== 'paid') throw new AppError('付款后才能入账', 409, 'EXPENSE_NOT_PAID')
  if (!claim.ledgerId)
    throw new AppError('报销单未绑定账套,不入账(先补 ledgerId)', 409, 'EXPENSE_NO_LEDGER')
  const lines = buildExpenseVoucherLines(claim, expenseAccountCode)
  const period = bizDayKey(claim.paidAt ?? new Date()).slice(0, 7)
  const voucher = await createVoucher(
    claim.ledgerId,
    {
      period,
      voucherDate: bizDayKey(claim.paidAt ?? new Date()),
      summary: `报销入账:${claim.title}`,
      source: 'auto',
      sourceRef: `expense:${claim.id}`,
      post: true,
      lines,
    },
    userId,
  )
  await db
    .update(hrExpenseClaim)
    .set({ voucherId: voucher.id, voucherNo: voucher.voucherNo, updatedAt: new Date() })
    .where(eq(hrExpenseClaim.id, id))
  const out = await getClaim(id)
  return { ...out, idempotent: false }
}

export async function voidClaim(id: string, actor: string | null) {
  const claim = await getClaim(id)
  if (claim.status === 'paid') {
    throw new AppError(
      '已付款不可作废;要回冲请走红冲凭证入口,留完整痕迹',
      409,
      'EXPENSE_PAID_NO_VOID',
    )
  }
  if (claim.status !== 'submitted' && claim.status !== 'approved') {
    throw new AppError(`状态 ${claim.status} 不可作废`, 409, 'EXPENSE_NOT_VOIDABLE')
  }
  await db
    .update(hrExpenseClaim)
    .set({ status: 'voided', updatedAt: new Date() })
    .where(eq(hrExpenseClaim.id, id))
  await notifyExpense(claim.submittedBy ?? actor, '报销单已作废', claim.title, id, {
    action: 'void',
  })
  return getClaim(id)
}

export async function listClaims(scope: {
  employeeId?: string
  status?: string
  ledgerId?: string
}) {
  const conds = [isNull(hrExpenseClaim.deletedAt)]
  if (scope.employeeId) conds.push(eq(hrExpenseClaim.employeeId, scope.employeeId))
  if (scope.status) conds.push(eq(hrExpenseClaim.status, scope.status))
  if (scope.ledgerId) conds.push(eq(hrExpenseClaim.ledgerId, scope.ledgerId))
  return db
    .select()
    .from(hrExpenseClaim)
    .where(and(...conds))
    .orderBy(asc(hrExpenseClaim.createdAt))
    .limit(500)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
