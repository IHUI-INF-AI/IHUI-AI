// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 发薪闭环 —— 收款账户 / 代发批次 / 工资条 / 签收。
 *
 * 补齐的三步(2026-11-23 前全断在 hr_payroll_item):
 *   ① 员工没有收款账户 ⇒ 出纳手工誊账号,错一个数字就是退汇;
 *   ② 没有代发文件 ⇒ 银行批量代发只能靠网银手工录入;
 *   ③ 没有工资条与签收 ⇒ 员工不知道自己被扣了什么,"已告知"无法证明。
 *
 * 纪律:
 *   · 卡号落库剥空格,列表接口只回脱敏形态(后四位);
 *   · 代发文件**不写服务器磁盘**,导出接口直接回文本(含卡号,权限由路由档位控制);
 *   · 导出记 sha256 指纹,事后可回答"银行收到的是不是我们发的那一份";
 *   · 工资条快照生成时冻结,后续改薪资配置不影响已发月份。
 */

import { createHash } from 'node:crypto'
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm'

import { db } from '../db/index.js'
import { createNotificationIdempotent } from '../db/notification-queries.js'
import { AppError } from '../errors/AppError.js'
import {
  hrEmployee,
  hrPayrollItem,
  hrPayrollPeriod,
  hrPayrollPayout,
  hrPayslip,
} from '@ihui/database'
import { fromCents, toCents } from './fin-accounting/money.js'

const ACCOUNT_RE = /^\d{8,32}$/

/** 卡号脱敏:前 4 + **** + 后 4(长度不足 8 位则整体打码) */
export function maskAccountNo(accountNo: string | null | undefined): string | null {
  if (!accountNo) return null
  const clean = accountNo.trim()
  if (clean.length < 8) return '****'
  return `${clean.slice(0, 4)} **** ${clean.slice(-4)}`
}

/** 设置员工收款账户(卡号必填、纯数字 8~32 位;户名缺省取员工姓名)。 */
export async function setEmployeeBank(
  employeeId: string,
  input: { bankName: string; bankAccountNo: string; bankAccountName?: string | null | undefined },
) {
  const accountNo = input.bankAccountNo.replace(/\s+/g, '')
  if (!ACCOUNT_RE.test(accountNo)) {
    throw new AppError(
      '收款账号必须是 8~32 位纯数字(可含空格,落库前会剥除)',
      400,
      'HR_BANK_ACCOUNT_INVALID',
    )
  }
  const bankName = input.bankName.trim()
  if (bankName.length < 2) throw new AppError('开户银行必填', 400, 'HR_BANK_NAME_REQUIRED')
  const [emp] = await db
    .select({ id: hrEmployee.id, name: hrEmployee.name, deletedAt: hrEmployee.deletedAt })
    .from(hrEmployee)
    .where(eq(hrEmployee.id, employeeId))
  if (!emp || emp.deletedAt) throw new AppError('员工不存在', 404, 'HR_EMPLOYEE_NOT_FOUND')
  const [row] = await db
    .update(hrEmployee)
    .set({
      bankName,
      bankAccountNo: accountNo,
      bankAccountName: input.bankAccountName?.trim() || emp.name,
      updatedAt: new Date(),
    })
    .where(eq(hrEmployee.id, employeeId))
    .returning({
      id: hrEmployee.id,
      bankName: hrEmployee.bankName,
      bankAccountNo: hrEmployee.bankAccountNo,
      bankAccountName: hrEmployee.bankAccountName,
    })
  return { ...row!, bankAccountNoMasked: maskAccountNo(row!.bankAccountNo) }
}

/** 读员工收款账户(默认脱敏;withPlain=true 仅限导出文件内部使用) */
export async function getEmployeeBank(employeeId: string, withPlain = false) {
  const [emp] = await db
    .select({
      id: hrEmployee.id,
      employeeNo: hrEmployee.employeeNo,
      name: hrEmployee.name,
      bankName: hrEmployee.bankName,
      bankAccountNo: hrEmployee.bankAccountNo,
      bankAccountName: hrEmployee.bankAccountName,
    })
    .from(hrEmployee)
    .where(eq(hrEmployee.id, employeeId))
  if (!emp) throw new AppError('员工不存在', 404, 'HR_EMPLOYEE_NOT_FOUND')
  return {
    ...emp,
    bankAccountNo: withPlain ? emp.bankAccountNo : maskAccountNo(emp.bankAccountNo),
  }
}

/** 找该月薪资周期(draft/calculated/approved 都可;paid 也可重出批次) */
async function findPeriod(periodMonth: string) {
  const [period] = await db
    .select()
    .from(hrPayrollPeriod)
    .where(eq(hrPayrollPeriod.periodMonth, periodMonth))
    .limit(1)
  if (!period) throw new AppError('该月尚未算薪,无法生成代发批次', 404, 'PAYROLL_PERIOD_NOT_FOUND')
  return period
}

/**
 * 生成(或重出)代发批次。
 *
 * 缺收款账户的员工不阻断整批,但会被逐条列进 missingAccounts —— 出纳能一眼看到
 * "这 3 个人这次发不了",而不是等银行退汇才发现。若一个可发的都没有则直接报错。
 */
export async function buildPayoutBatch(periodMonth: string, operatorId?: string | null) {
  const period = await findPeriod(periodMonth)
  const items = await db
    .select({
      itemId: hrPayrollItem.id,
      netPay: hrPayrollItem.netPay,
      employeeId: hrEmployee.id,
      employeeNo: hrEmployee.employeeNo,
      name: hrEmployee.name,
      bankName: hrEmployee.bankName,
      bankAccountNo: hrEmployee.bankAccountNo,
      bankAccountName: hrEmployee.bankAccountName,
      status: hrEmployee.status,
      deletedAt: hrEmployee.deletedAt,
    })
    .from(hrPayrollItem)
    .innerJoin(hrEmployee, eq(hrPayrollItem.employeeId, hrEmployee.id))
    .where(eq(hrPayrollItem.periodId, period.id))

  const missingAccounts: Array<{ employeeNo: string; name: string }> = []
  let headCount = 0
  let totalCents = 0
  for (const it of items) {
    if (it.deletedAt || !it.bankAccountNo) {
      missingAccounts.push({ employeeNo: it.employeeNo, name: it.name })
      continue
    }
    headCount += 1
    totalCents += toCents(it.netPay)
  }
  if (headCount === 0) {
    throw new AppError(
      `该月 ${items.length} 名员工全部缺少收款账户,无法生成代发文件(请先补银行卡号)`,
      400,
      'PAYROLL_NO_PAYABLE_EMPLOYEE',
    )
  }

  const [row] = await db
    .insert(hrPayrollPayout)
    .values({
      periodId: period.id,
      periodMonth,
      status: 'draft',
      headCount,
      totalAmount: fromCents(totalCents),
      missingAccounts,
      operatorId: operatorId ?? null,
    })
    .returning()
  return {
    batch: row!,
    payables: headCount,
    missingAccounts,
    skipped: items.length - headCount,
  }
}

/**
 * 导出代发文件(UTF-8 BOM + CRLF,Excel 与网银批量模板都能直接吃)。
 *
 * 列:序号,收款人姓名,收款账号,开户银行,金额,摘要
 * 状态流转:draft → exported;已 exported 的可重复导出(内容一致,指纹相同)。
 */
export async function exportPayoutFile(batchId: string) {
  const [batch] = await db.select().from(hrPayrollPayout).where(eq(hrPayrollPayout.id, batchId))
  if (!batch) throw new AppError('代发批次不存在', 404, 'PAYROLL_BATCH_NOT_FOUND')
  if (batch.status === 'paid') {
    throw new AppError(
      '该批次已标记发放,不能再导出(如需重发请新建批次)',
      409,
      'PAYROLL_BATCH_ALREADY_PAID',
    )
  }
  const rows = await db
    .select({
      employeeNo: hrEmployee.employeeNo,
      name: hrEmployee.name,
      accountName: hrEmployee.bankAccountName,
      accountNo: hrEmployee.bankAccountNo,
      bankName: hrEmployee.bankName,
      netPay: hrPayrollItem.netPay,
      status: hrEmployee.status,
      deletedAt: hrEmployee.deletedAt,
    })
    .from(hrPayrollItem)
    .innerJoin(hrEmployee, eq(hrPayrollItem.employeeId, hrEmployee.id))
    .where(eq(hrPayrollItem.periodId, batch.periodId))

  const lines: string[] = ['序号,收款人姓名,收款账号,开户银行,金额,摘要']
  let idx = 0
  let totalCents = 0
  for (const r of rows) {
    if (r.deletedAt || !r.accountNo) continue
    idx += 1
    totalCents += toCents(r.netPay)
    lines.push(
      [
        String(idx),
        csvCell(r.accountName || r.name),
        r.accountNo,
        csvCell(r.bankName ?? ''),
        fromCents(toCents(r.netPay)),
        csvCell(`${batch.periodMonth}工资`),
      ].join(','),
    )
  }
  if (idx === 0) throw new AppError('该批次没有可导出的收款人', 400, 'PAYROLL_NO_PAYABLE_EMPLOYEE')
  const content = `\uFEFF${lines.join('\r\n')}\r\n`
  const fileHash = createHash('sha256').update(content, 'utf8').digest('hex').slice(0, 32)

  const [updated] = await db
    .update(hrPayrollPayout)
    .set({
      status: 'exported',
      fileHash,
      fileRows: idx,
      headCount: idx,
      totalAmount: fromCents(totalCents),
      exportedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(hrPayrollPayout.id, batchId))
    .returning()
  return {
    batch: updated!,
    fileName: `代发工资-${batch.periodMonth}-${fileHash.slice(0, 8)}.csv`,
    rows: idx,
    totalAmount: fromCents(totalCents),
    fileHash,
    content,
  }
}

function csvCell(v: string): string {
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
}

/** 标记"已交银行"(exported → submitted) */
export async function markPayoutSubmitted(batchId: string) {
  const [batch] = await db.select().from(hrPayrollPayout).where(eq(hrPayrollPayout.id, batchId))
  if (!batch) throw new AppError('代发批次不存在', 404, 'PAYROLL_BATCH_NOT_FOUND')
  if (batch.status !== 'exported') {
    throw new AppError('只有已导出的批次可以标记交银行', 409, 'PAYROLL_BATCH_NOT_EXPORTED')
  }
  const [row] = await db
    .update(hrPayrollPayout)
    .set({ status: 'submitted', submittedAt: new Date(), updatedAt: new Date() })
    .where(eq(hrPayrollPayout.id, batchId))
    .returning()
  return row!
}

/** 标记"已到账"(submitted → paid);到账日期可回填 */
export async function markPayoutPaid(batchId: string, paidAt?: string | undefined) {
  const [batch] = await db.select().from(hrPayrollPayout).where(eq(hrPayrollPayout.id, batchId))
  if (!batch) throw new AppError('代发批次不存在', 404, 'PAYROLL_BATCH_NOT_FOUND')
  if (batch.status !== 'submitted') {
    throw new AppError('只有已交银行的批次可以标记到账', 409, 'PAYROLL_BATCH_NOT_SUBMITTED')
  }
  const when = paidAt ? new Date(`${paidAt}T00:00:00Z`) : new Date()
  if (Number.isNaN(when.getTime()))
    throw new AppError('paidAt 必须是 YYYY-MM-DD', 400, 'PAYROLL_BAD_DATE')
  const [row] = await db
    .update(hrPayrollPayout)
    .set({ status: 'paid', paidAt: when, updatedAt: new Date() })
    .where(eq(hrPayrollPayout.id, batchId))
    .returning()
  // 到账后同步把薪资周期置 paid(仅当仍为 approved)
  await db
    .update(hrPayrollPeriod)
    .set({ status: 'paid', closedAt: when, updatedAt: new Date() })
    .where(and(eq(hrPayrollPeriod.id, batch.periodId), eq(hrPayrollPeriod.status, 'approved')))
  return row!
}

/** 最近批次(默认只回最新一条) */
export async function listPayoutBatches(periodMonth?: string) {
  const where = periodMonth ? [eq(hrPayrollPayout.periodMonth, periodMonth)] : []
  return db
    .select()
    .from(hrPayrollPayout)
    .where(where.length > 0 ? and(...where) : undefined)
    .orderBy(desc(hrPayrollPayout.createdAt))
    .limit(20)
}

/**
 * 生成工资条(幂等):一人一月一条,已签收的不覆盖。
 * 快照冻结应发/各扣除/实发与累计预扣明细,后续改薪资配置不影响已发工资条。
 */
export async function generatePayslips(periodMonth: string) {
  const period = await findPeriod(periodMonth)
  const items = await db
    .select({
      itemId: hrPayrollItem.id,
      employeeId: hrEmployee.id,
      employeeNo: hrEmployee.employeeNo,
      name: hrEmployee.name,
      departmentId: hrEmployee.departmentId,
      baseSalary: hrPayrollItem.baseSalary,
      otAmount: hrPayrollItem.otAmount,
      allowance: hrPayrollItem.allowance,
      attendanceDeduction: hrPayrollItem.attendanceDeduction,
      grossPay: hrPayrollItem.grossPay,
      insurancePersonal: hrPayrollItem.insurancePersonal,
      housingFundPersonal: hrPayrollItem.housingFundPersonal,
      taxableIncome: hrPayrollItem.taxableIncome,
      incomeTax: hrPayrollItem.incomeTax,
      otherDeduction: hrPayrollItem.otherDeduction,
      netPay: hrPayrollItem.netPay,
      breakdown: hrPayrollItem.breakdown,
    })
    .from(hrPayrollItem)
    .innerJoin(hrEmployee, eq(hrPayrollItem.employeeId, hrEmployee.id))
    .where(eq(hrPayrollItem.periodId, period.id))

  const existing = await db
    .select({ id: hrPayslip.id, employeeId: hrPayslip.employeeId, status: hrPayslip.status })
    .from(hrPayslip)
    .where(eq(hrPayslip.periodId, period.id))
  const acknowledged = new Set(
    existing.filter((e) => e.status === 'acknowledged').map((e) => e.employeeId),
  )

  let created = 0
  let skipped = 0
  for (const it of items) {
    if (acknowledged.has(it.employeeId)) {
      skipped += 1
      continue
    }
    const snapshot = {
      periodMonth,
      employeeNo: it.employeeNo,
      name: it.name,
      departmentId: it.departmentId,
      income: {
        baseSalary: it.baseSalary,
        otAmount: it.otAmount,
        allowance: it.allowance,
        attendanceDeduction: it.attendanceDeduction,
        grossPay: it.grossPay,
      },
      deduction: {
        insurancePersonal: it.insurancePersonal,
        housingFundPersonal: it.housingFundPersonal,
        incomeTax: it.incomeTax,
        otherDeduction: it.otherDeduction,
      },
      taxableIncome: it.taxableIncome,
      netPay: it.netPay,
      cumulative:
        (it.breakdown as { cumulative?: Record<string, unknown> } | null)?.cumulative ?? null,
    }
    const [row] = await db
      .insert(hrPayslip)
      .values({
        periodId: period.id,
        periodMonth,
        employeeId: it.employeeId,
        payrollItemId: it.itemId,
        status: 'generated',
        snapshot,
      })
      .onConflictDoUpdate({
        target: [hrPayslip.periodId, hrPayslip.employeeId],
        set: { snapshot, payrollItemId: it.itemId, updatedAt: new Date() },
      })
      .returning({ id: hrPayslip.id })
    if (row) created += 1
  }
  return { total: items.length, written: created, skippedAcknowledged: skipped }
}

/**
 * 推送工资条(generated → pushed)。
 *
 * 2026-11-24 起"推送"是真投递:每位有站内账号的员工收到一条通知,
 * 通知幂等键按工资条 id 生成 ⇒ 重复点推送不会刷屏。
 * 没有账号的人**不冒充已推送**:状态留在 generated,由调用方另行线下告知。
 */
export async function pushPayslips(periodMonth: string, channel = 'inapp') {
  if (channel !== 'inapp') {
    throw new AppError(
      '目前只支持站内推送(inapp);邮件/短信渠道未接入,不冒充已送达',
      400,
      'PAYSLIP_CHANNEL_UNSUPPORTED',
    )
  }
  const rows = await db
    .select({
      id: hrPayslip.id,
      status: hrPayslip.status,
      employeeId: hrPayslip.employeeId,
      userId: hrEmployee.userId,
      name: hrEmployee.name,
      snapshot: hrPayslip.snapshot,
    })
    .from(hrPayslip)
    .innerJoin(hrEmployee, eq(hrPayslip.employeeId, hrEmployee.id))
    .where(eq(hrPayslip.periodMonth, periodMonth))
  const pending = rows.filter((r) => r.status === 'generated')
  const deliverable = pending.filter((r) => r.userId)
  const noAccount = pending.filter((r) => !r.userId)

  for (const r of deliverable) {
    const netPay = (r.snapshot as { netPay?: unknown } | null)?.netPay
    await createNotificationIdempotent({
      userId: r.userId!,
      type: 'hr.payslip',
      title: `${periodMonth} 工资条已发布`,
      content:
        netPay === undefined
          ? '本月工资条已生成,请在「我的薪资」查看明细并签收。'
          : `本月实发 ¥${String(netPay)},请在「我的薪资」查看明细并签收。`,
      data: { periodMonth, payslipId: r.id, kind: 'payslip' },
      idempotencyKey: `payslip:${r.id}:pushed`,
    })
  }

  if (deliverable.length > 0) {
    await db
      .update(hrPayslip)
      .set({ status: 'pushed', channel, pushedAt: new Date(), updatedAt: new Date() })
      .where(
        inArray(
          hrPayslip.id,
          deliverable.map((r) => r.id),
        ),
      )
  }
  return {
    pushed: deliverable.length,
    skippedNoAccount: noAccount.length,
    remaining: rows.length - deliverable.length,
    channel,
  }
}

/** 员工签收(generated/pushed → acknowledged) */
export async function acknowledgePayslip(id: string, channel = 'inapp', remark?: string | null) {
  const [row] = await db.select().from(hrPayslip).where(eq(hrPayslip.id, id))
  if (!row) throw new AppError('工资条不存在', 404, 'PAYSLIP_NOT_FOUND')
  if (row.status === 'acknowledged') return row
  const [updated] = await db
    .update(hrPayslip)
    .set({
      status: 'acknowledged',
      acknowledgedAt: new Date(),
      ackChannel: channel,
      remark: remark?.trim() || null,
      updatedAt: new Date(),
    })
    .where(eq(hrPayslip.id, id))
    .returning()
  return updated!
}

/** 发薪闭环看板:批次进度 + 工资条签收率 */
export async function payoutSummary(periodMonth: string) {
  const [batches, slips] = await Promise.all([
    db.select().from(hrPayrollPayout).where(eq(hrPayrollPayout.periodMonth, periodMonth)),
    db
      .select({ status: hrPayslip.status })
      .from(hrPayslip)
      .where(eq(hrPayslip.periodMonth, periodMonth)),
  ])
  const latest = batches.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0] ?? null
  return {
    periodMonth,
    batch: latest
      ? {
          id: latest.id,
          status: latest.status,
          headCount: latest.headCount,
          totalAmount: latest.totalAmount,
          fileHash: latest.fileHash,
          missing: latest.missingAccounts?.length ?? 0,
          exportedAt: latest.exportedAt,
          submittedAt: latest.submittedAt,
          paidAt: latest.paidAt,
        }
      : null,
    batches: batches.length,
    slips: {
      total: slips.length,
      generated: slips.filter((s) => s.status === 'generated').length,
      pushed: slips.filter((s) => s.status === 'pushed').length,
      acknowledged: slips.filter((s) => s.status === 'acknowledged').length,
    },
  }
}

/** 员工收款账户完整度(HR 视角:这个月谁还缺卡号) */
export async function bankCoverage(periodMonth?: string) {
  const rows = await db
    .select({
      employeeNo: hrEmployee.employeeNo,
      name: hrEmployee.name,
      status: hrEmployee.status,
      bankName: hrEmployee.bankName,
      bankAccountNo: hrEmployee.bankAccountNo,
    })
    .from(hrEmployee)
    .where(and(eq(hrEmployee.status, 'active'), isNull(hrEmployee.deletedAt)))
  void periodMonth
  const total = rows.length
  const covered = rows.filter((r) => Boolean(r.bankAccountNo)).length
  return {
    total,
    covered,
    missing: total - covered,
    missingList: rows
      .filter((r) => !r.bankAccountNo)
      .map((r) => ({ employeeNo: r.employeeNo, name: r.name })),
  }
}

/** 保留:供 sql 聚合的计数工具(避免各调用方各写一份) */
export async function countPayslips(periodMonth: string, status: string) {
  const [r] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(hrPayslip)
    .where(and(eq(hrPayslip.periodMonth, periodMonth), eq(hrPayslip.status, status)))
  return r?.n ?? 0
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
