// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 家长端账单聚合(纯逻辑,零 RN/DOM 依赖,可直接单测)。
 *
 * 票面 G-26 ③ 的缺口不是"没有单孩子账单"——web `edu/parent` 的 bills 子 Tab 与 RN
 * `EduChildBills` 都在;缺的是**家长视角**:家长要横向看到"我几个孩子各欠多少、哪个
 * 最近到期",现在只能逐个孩子点进去。本件把 N 次
 * `GET /parent/children/:childId/bills` 的结果折成"一孩子一组"。
 *
 * 金额纪律:欠费/已缴/到期日全部由 api 侧账目出口 `loadEnrollmentLedger` 算好递过来,
 * 本层只做**加法**聚合,绝不重算 `totalFee - paidAmount`(前端自算是本仓已出过
 * 「催缴发给错人」「汇总把总欠费冲小」两类事故的第三个口径)。
 *
 * 两条"不猜"的纪律(AGENTS §0.3):
 * 1. 某个孩子取数失败 ⇒ 该组 `failed` 带原因、金额保持 0,`UI` 必须写"加载失败"并保留
 *    重试,不得把"取不到"当成"没欠费";
 * 2. 账目出口没给 ledger(该期账期未就绪)⇒ 计入 `ledgerPendingCount`,不计入任何金额;
 *    `ledgerPendingCount > 0` 时 UI 用"—"而不是 ¥0。
 */

/** 账目出口 `loadEnrollmentLedger` 的家长端投影(与 /parent/children/:childId/bills 同形) */
export interface ParentBillLedger {
  arrears: number
  paidAmount: number
  nextDueDate: string | null
  overdueCount: number
  dueSoonCount: number
}

/** 单期账单(一条报名 = 一个期次) */
export interface ParentBillItem {
  enrollmentId: string
  className: string
  termName: string
  status: string
  totalFee: number
  ledger: ParentBillLedger | null
}

/** 家长已确认绑定的孩子(只取聚合需要的两个字段,避免与 /parent/children 形状漂移) */
export interface ParentBillChildRef {
  studentId: string
  /** 昵称优先,空则落 studentId(与 EduParentScreen 列表同口径) */
  name: string
}

/** 单孩子的取数结果:成功带 bills,失败带原因 —— 不提供"成功但空"以外的兜底 */
export type ParentBillFetch =
  { studentId: string; bills: ParentBillItem[] } | { studentId: string; failed: string }

/** 聚合后的一孩子一组 */
export interface ParentBillGroup {
  studentId: string
  name: string
  bills: ParentBillItem[]
  /** 期数(含 ledger 未就绪的期) */
  termCount: number
  /** 账目未就绪的期数 —— 这些期不进任何金额合计 */
  ledgerPendingCount: number
  totalFee: number
  paidAmount: number
  arrears: number
  overdueCount: number
  /** 所有已知账期里最早的一个到期日;无可用日期 ⇒ null */
  nextDueDate: string | null
  /** 取数失败原因;成功为 null */
  failed: string | null
}

/** 取两个 ISO 日期里更早的那个;无法解析的一律忽略(不猜) */
export function earliestDue(current: string | null, candidate: string | null): string | null {
  if (!candidate) return current
  const next = Date.parse(candidate)
  if (Number.isNaN(next)) return current
  if (!current) return candidate
  const prev = Date.parse(current)
  if (Number.isNaN(prev)) return candidate
  return next < prev ? candidate : current
}

function emptyGroup(child: ParentBillChildRef, failed: string | null): ParentBillGroup {
  return {
    studentId: child.studentId,
    name: child.name,
    bills: [],
    termCount: 0,
    ledgerPendingCount: 0,
    totalFee: 0,
    paidAmount: 0,
    arrears: 0,
    overdueCount: 0,
    nextDueDate: null,
    failed,
  }
}

/**
 * 按孩子的顺序聚合(输出顺序 = 入参 children 顺序,与家长首页列表一致)。
 * 结果里出现但 children 里没有的 studentId 一律忽略 —— 归属以孩子列表为准。
 */
export function aggregateParentBills(
  children: ParentBillChildRef[],
  results: ParentBillFetch[],
): ParentBillGroup[] {
  const byChild = new Map<string, ParentBillFetch>()
  for (const r of results) byChild.set(r.studentId, r)

  return children.map((child) => {
    const hit = byChild.get(child.studentId)
    if (!hit) return emptyGroup(child, 'missing-result')
    if ('failed' in hit) return emptyGroup(child, hit.failed)

    const group = emptyGroup(child, null)
    for (const bill of hit.bills) {
      group.bills.push(bill)
      group.termCount += 1
      group.totalFee += bill.totalFee
      if (!bill.ledger) {
        group.ledgerPendingCount += 1
        continue
      }
      group.paidAmount += bill.ledger.paidAmount
      group.arrears += bill.ledger.arrears
      group.overdueCount += bill.ledger.overdueCount
      group.nextDueDate = earliestDue(group.nextDueDate, bill.ledger.nextDueDate)
    }
    return group
  })
}

/** 全部孩子合计(汇总条用;口径 = 各组已算好的数相加,不引入第二套算法) */
export function sumParentBills(groups: ParentBillGroup[]): {
  arrears: number
  overdueCount: number
  nextDueDate: string | null
  ledgerPendingCount: number
  failedCount: number
} {
  let arrears = 0
  let overdueCount = 0
  let ledgerPendingCount = 0
  let failedCount = 0
  let nextDueDate: string | null = null
  for (const g of groups) {
    if (g.failed) {
      failedCount += 1
      continue
    }
    arrears += g.arrears
    overdueCount += g.overdueCount
    ledgerPendingCount += g.ledgerPendingCount
    nextDueDate = earliestDue(nextDueDate, g.nextDueDate)
  }
  return { arrears, overdueCount, nextDueDate, ledgerPendingCount, failedCount }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
