// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 发票台账域服务(进项/销项)。
 *
 * 三条硬约束:
 *   1. 价税合计 = 不含税金额 + 税额,差超过 1 分拒绝(实际开票允许 1 分尾差,再多就是算错);
 *   2. 税额 = 不含税 × 税率,差超过 1 分拒绝;
 *   3. 同一账套同一方向同一发票号唯一(幂等导入靠这条)。
 *
 * 台账是报税的前置数据源:本期销项、进项、可抵扣、已认证四个数都从这里出,
 * 不再每次现场去税局拉。
 */

import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm'

import { db } from '../../db/index.js'
import { AppError } from '../../errors/AppError.js'
import { finInvoice } from '@ihui/database'
import { fromCents, toCents } from './money.js'
import { assertPeriod } from './period.js'
import { getLedger } from './ledger-service.js'

export type InvoiceDirection = 'output' | 'input'
export type InvoiceStatus = 'unchecked' | 'checked' | 'certified' | 'voided'

const DIRECTIONS: InvoiceDirection[] = ['output', 'input']
const STATUSES: InvoiceStatus[] = ['unchecked', 'checked', 'certified', 'voided']
const TYPES = ['special', 'general', 'electronic', 'electronic_special'] as const

export interface InvoiceInput {
  direction: InvoiceDirection
  invoiceType?: (typeof TYPES)[number] | undefined
  invoiceCode?: string | undefined
  invoiceNo: string
  invoiceDate: string
  period: string
  sellerName?: string | undefined
  sellerTaxNo?: string | undefined
  buyerName?: string | undefined
  buyerTaxNo?: string | undefined
  amountExclTax: string | number
  taxRate?: string | number | undefined
  taxAmount?: string | number | undefined
  totalAmount?: string | number | undefined
  deductible?: boolean | undefined
  source?: 'platform' | 'import' | 'manual' | undefined
  sourceRef?: string | undefined
  remark?: string | undefined
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** 纯校验 + 规范化(零 IO),导出供单测直接钉住税额尾差口径 */
export function normalizeInvoice(input: InvoiceInput, ledgerId: string, userId?: string | null) {
  if (!DIRECTIONS.includes(input.direction)) {
    throw new AppError('direction 必须是 output/input', 400, 'FIN_INVOICE_BAD_DIRECTION')
  }
  const type = input.invoiceType ?? 'general'
  if (!TYPES.includes(type)) throw new AppError('发票类型非法', 400, 'FIN_INVOICE_BAD_TYPE')
  const no = input.invoiceNo?.trim()
  if (!no || no.length > 20)
    throw new AppError('发票号码必填且不超过 20 位', 400, 'FIN_INVOICE_NO_REQUIRED')
  if (!DATE_RE.test(input.invoiceDate ?? '')) {
    throw new AppError('invoiceDate 必须是 YYYY-MM-DD', 400, 'FIN_INVOICE_BAD_DATE')
  }
  assertPeriod(input.period, 'period')
  if (!input.invoiceDate.startsWith(input.period)) {
    throw new AppError('发票日期不在所属期间内', 400, 'FIN_INVOICE_DATE_OUT_OF_PERIOD')
  }
  const amount = toCents(input.amountExclTax, 'amountExclTax')
  if (amount <= 0) throw new AppError('不含税金额必须大于 0', 400, 'FIN_INVOICE_BAD_AMOUNT')
  const rateRaw = input.taxRate ?? 0
  const rate = Number(rateRaw)
  if (!Number.isFinite(rate) || rate < 0 || rate > 1) {
    throw new AppError('taxRate 必须是 0~1 之间的小数(如 0.13)', 400, 'FIN_INVOICE_BAD_RATE')
  }
  const expectedTax = Math.round(amount * rate)
  const tax = input.taxAmount === undefined ? expectedTax : toCents(input.taxAmount, 'taxAmount')
  if (Math.abs(tax - expectedTax) > 1) {
    throw new AppError(
      `税额与"不含税×税率"相差 ${fromCents(Math.abs(tax - expectedTax))}(超过 1 分),请核对`,
      400,
      'FIN_INVOICE_TAX_MISMATCH',
    )
  }
  const total =
    input.totalAmount === undefined ? amount + tax : toCents(input.totalAmount, 'totalAmount')
  if (Math.abs(total - (amount + tax)) > 1) {
    throw new AppError(
      '价税合计与"金额+税额"相差超过 1 分,请核对',
      400,
      'FIN_INVOICE_TOTAL_MISMATCH',
    )
  }
  const deductible =
    input.deductible ??
    (input.direction === 'input' && (type === 'special' || type === 'electronic_special'))
  return {
    ledgerId,
    direction: input.direction,
    invoiceType: type,
    invoiceCode: input.invoiceCode?.trim() || null,
    invoiceNo: no,
    invoiceDate: input.invoiceDate,
    period: input.period,
    sellerName: input.sellerName?.trim() || null,
    sellerTaxNo: input.sellerTaxNo?.trim() || null,
    buyerName: input.buyerName?.trim() || null,
    buyerTaxNo: input.buyerTaxNo?.trim() || null,
    amountExclTax: fromCents(amount),
    taxRate: rate.toFixed(4),
    taxAmount: fromCents(tax),
    totalAmount: fromCents(total),
    deductible,
    source: input.source ?? 'manual',
    sourceRef: input.sourceRef ?? null,
    remark: input.remark?.trim() || null,
    createdBy: userId ?? null,
  }
}

export async function createInvoice(ledgerId: string, input: InvoiceInput, userId?: string | null) {
  await getLedger(ledgerId)
  const row = normalizeInvoice(input, ledgerId, userId)
  try {
    const [created] = await db.insert(finInvoice).values(row).returning()
    return created!
  } catch (err) {
    if (isUnique(err)) {
      throw new AppError(
        '同一方向同一发票号已存在(重复采集);如需修改请先作废原票',
        409,
        'FIN_INVOICE_DUPLICATE',
      )
    }
    throw err
  }
}

/** 幂等批量导入(税局/Excel 采集入口)。 */
export async function importInvoices(
  ledgerId: string,
  inputs: InvoiceInput[],
  userId?: string | null,
) {
  await getLedger(ledgerId)
  const imported: string[] = []
  const skipped: string[] = []
  const failed: Array<{ invoiceNo: string; errorCode: string; message: string }> = []
  for (const input of inputs) {
    try {
      const existing = await db
        .select({ id: finInvoice.id })
        .from(finInvoice)
        .where(
          and(
            eq(finInvoice.ledgerId, ledgerId),
            eq(finInvoice.direction, input.direction),
            eq(finInvoice.invoiceNo, input.invoiceNo),
            isNull(finInvoice.deletedAt),
          ),
        )
      if (existing.length > 0) {
        skipped.push(input.invoiceNo)
        continue
      }
      const created = await createInvoice(
        ledgerId,
        { ...input, source: input.source ?? 'import' },
        userId,
      )
      imported.push(created.id)
    } catch (err) {
      if (err instanceof AppError) {
        failed.push({ invoiceNo: input.invoiceNo, errorCode: err.errorCode, message: err.message })
      } else throw err
    }
  }
  return { imported, skipped, failed }
}

export async function listInvoices(
  ledgerId: string,
  params: { period?: string; direction?: string; status?: string; page?: number; limit?: number },
) {
  const page = Math.max(1, params.page ?? 1)
  const limit = Math.min(200, Math.max(1, params.limit ?? 20))
  const where = [eq(finInvoice.ledgerId, ledgerId), isNull(finInvoice.deletedAt)]
  if (params.period) {
    assertPeriod(params.period, 'period')
    where.push(eq(finInvoice.period, params.period))
  }
  if (params.direction) where.push(eq(finInvoice.direction, params.direction))
  if (params.status) where.push(eq(finInvoice.status, params.status))
  const cond = and(...where)
  const [rows, count] = await Promise.all([
    db
      .select()
      .from(finInvoice)
      .where(cond)
      .orderBy(desc(finInvoice.invoiceDate), asc(finInvoice.invoiceNo))
      .limit(limit)
      .offset((page - 1) * limit),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(finInvoice)
      .where(cond),
  ])
  return { list: rows, page, limit, total: count[0]?.n ?? 0 }
}

/** 勾选/认证流转:只允许向前,不允许把已认证退回未勾选。 */
export async function setInvoiceStatus(id: string, status: InvoiceStatus, checkPeriod?: string) {
  if (!STATUSES.includes(status)) throw new AppError('发票状态非法', 400, 'FIN_INVOICE_BAD_STATUS')
  const [row] = await db
    .select()
    .from(finInvoice)
    .where(and(eq(finInvoice.id, id), isNull(finInvoice.deletedAt)))
  if (!row) throw new AppError('发票不存在或已删除', 404, 'FIN_INVOICE_NOT_FOUND')
  if (row.status === 'voided' && status !== 'voided') {
    throw new AppError('已作废发票不可恢复', 409, 'FIN_INVOICE_VOIDED')
  }
  const order: Record<InvoiceStatus, number> = { unchecked: 0, checked: 1, certified: 2, voided: 9 }
  if (order[status] < order[row.status as InvoiceStatus] && status !== 'voided') {
    throw new AppError(
      '发票状态只能向前流转(未勾选 → 已勾选 → 已认证)',
      409,
      'FIN_INVOICE_STATUS_BACKWARD',
    )
  }
  if (status === 'certified' && !row.deductible) {
    throw new AppError(
      '该发票不可抵扣(普票或用于集体福利),不能标记为已认证',
      409,
      'FIN_INVOICE_NOT_DEDUCTIBLE',
    )
  }
  if (checkPeriod && status !== 'voided') assertPeriod(checkPeriod, 'checkPeriod')
  const [updated] = await db
    .update(finInvoice)
    .set({
      status,
      checkPeriod: status === 'voided' ? row.checkPeriod : (checkPeriod ?? row.checkPeriod),
      certifiedAt: status === 'certified' ? new Date() : row.certifiedAt,
      updatedAt: new Date(),
    })
    .where(eq(finInvoice.id, id))
    .returning()
  return updated!
}

export async function linkInvoiceToVoucher(id: string, voucherId: string) {
  const [updated] = await db
    .update(finInvoice)
    .set({ voucherId, updatedAt: new Date() })
    .where(and(eq(finInvoice.id, id), isNull(finInvoice.deletedAt)))
    .returning()
  if (!updated) throw new AppError('发票不存在或已删除', 404, 'FIN_INVOICE_NOT_FOUND')
  return updated
}

export async function deleteInvoice(id: string) {
  const [row] = await db
    .select()
    .from(finInvoice)
    .where(and(eq(finInvoice.id, id), isNull(finInvoice.deletedAt)))
  if (!row) throw new AppError('发票不存在或已删除', 404, 'FIN_INVOICE_NOT_FOUND')
  if (row.status !== 'unchecked') {
    throw new AppError(
      '只有未勾选发票可删除(已勾选/已认证请走作废)',
      409,
      'FIN_INVOICE_NOT_DELETABLE',
    )
  }
  if (row.voucherId) {
    throw new AppError('该发票已生成凭证,请先解除凭证关联', 409, 'FIN_INVOICE_HAS_VOUCHER')
  }
  await db.update(finInvoice).set({ deletedAt: new Date() }).where(eq(finInvoice.id, id))
  return { deleted: true, id }
}

/**
 * 报税前置汇总:本期销项/进项/可抵扣/已认证。
 * 这是"申报表能算出来"的数据基础;拿不到就返回 0 并显式标注 empty=true。
 */
export async function summarizeInvoices(ledgerId: string, period: string) {
  assertPeriod(period, 'period')
  const rows = await db
    .select()
    .from(finInvoice)
    .where(
      and(
        eq(finInvoice.ledgerId, ledgerId),
        eq(finInvoice.period, period),
        isNull(finInvoice.deletedAt),
        sql`${finInvoice.status} <> 'voided'`,
      ),
    )
  const output = rows.filter((r) => r.direction === 'output')
  const input = rows.filter((r) => r.direction === 'input')
  const deductible = input.filter((r) => r.deductible)
  const certified = input.filter((r) => r.status === 'certified')
  const sum = (list: typeof rows, key: 'amountExclTax' | 'taxAmount' | 'totalAmount') =>
    fromCents(list.reduce((s, r) => s + toCents(r[key]), 0))
  return {
    period,
    empty: rows.length === 0,
    outputCount: output.length,
    outputAmount: sum(output, 'amountExclTax'),
    outputTax: sum(output, 'taxAmount'),
    inputCount: input.length,
    inputAmount: sum(input, 'amountExclTax'),
    inputTax: sum(input, 'taxAmount'),
    deductibleCount: deductible.length,
    deductibleTax: sum(deductible, 'taxAmount'),
    certifiedCount: certified.length,
    certifiedTax: sum(certified, 'taxAmount'),
    /** 本期可抵扣进项 − 已认证 = 尚未勾选的进项税 */
    pendingCertifyTax: fromCents(
      deductible.reduce((s, r) => s + toCents(r.taxAmount), 0) -
        certified.reduce((s, r) => s + toCents(r.taxAmount), 0),
    ),
  }
}

function isUnique(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: string }).code === '23505'
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
