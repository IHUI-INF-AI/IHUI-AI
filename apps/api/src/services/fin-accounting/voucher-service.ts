// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 凭证域服务:建单 / 过账 / 红冲 / 查询 / 幂等导入。
 *
 * 四条硬约束(逐条机器拒绝,不做"尽量通过"):
 *   1. 凭证日期必须在所属期间内;
 *   2. 科目必须存在、启用且为末级科目;
 *   3. `posted` 之前必须借贷合计相等;不平只能留在 `draft`;
 *   4. 已结账期间拒绝任何凭证写入(红冲也只能开在未结账期间)。
 *
 * 金额全链路走整数分;写库值一律两位小数字符串。
 */

import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm'

import { db } from '../../db/index.js'
import { AppError } from '../../errors/AppError.js'
import { finAccount, finLedger, finPeriodClose, finVoucher, finVoucherLine } from '@ihui/database'
import { fromCents, toCents } from './money.js'
import { assertPeriod } from './period.js'

export interface VoucherLineInput {
  accountCode: string
  direction: 'debit' | 'credit'
  amount: string | number
  summary?: string | undefined
  aux?: Record<string, string> | undefined
}

export interface VoucherInput {
  period: string
  voucherDate: string
  summary?: string | undefined
  source?: 'manual' | 'auto' | 'import' | 'payroll' | 'closing' | 'reverse' | 'asset-dep' | undefined
  sourceRef?: string | undefined
  post?: boolean | undefined
  lines: VoucherLineInput[]
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const VOUCHER_SOURCES = ['manual', 'auto', 'import', 'payroll', 'closing', 'reverse', 'asset-dep'] as const

async function assertPeriodOpen(ledgerId: string, period: string): Promise<void> {
  assertPeriod(period, 'period')
  const [ledger] = await db
    .select()
    .from(finLedger)
    .where(and(eq(finLedger.id, ledgerId), isNull(finLedger.deletedAt)))
  if (!ledger) throw new AppError('账套不存在或已删除', 404, 'FIN_LEDGER_NOT_FOUND')
  const [close] = await db
    .select()
    .from(finPeriodClose)
    .where(and(eq(finPeriodClose.ledgerId, ledgerId), eq(finPeriodClose.period, period)))
  if (close?.status === 'closed') {
    throw new AppError(`期间 ${period} 已结账,拒绝写入凭证`, 409, 'FIN_PERIOD_CLOSED')
  }
}

async function nextVoucherNo(ledgerId: string, period: string): Promise<string> {
  const rows = await db
    .select({ voucherNo: finVoucher.voucherNo })
    .from(finVoucher)
    .where(
      and(
        eq(finVoucher.ledgerId, ledgerId),
        eq(finVoucher.period, period),
        isNull(finVoucher.deletedAt),
      ),
    )
  let max = 0
  for (const r of rows) {
    const digits = r.voucherNo.replace(/[^0-9]/g, '')
    const n = digits ? Number.parseInt(digits, 10) : 0
    if (Number.isFinite(n) && n > max) max = n
  }
  return `记-${String(max + 1).padStart(4, '0')}`
}

function normalizeLines(
  lines: VoucherLineInput[],
  accountMap: Map<string, { name: string; isLeaf: boolean; enabled: boolean }>,
): {
  rows: Array<{
    lineNo: number
    accountCode: string
    accountName: string
    direction: string
    amount: string
    summary: string | null
    aux: Record<string, string>
  }>
  debit: number
  credit: number
} {
  if (!Array.isArray(lines) || lines.length < 2) {
    throw new AppError('凭证至少需要两条分录(一借一贷)', 400, 'FIN_VOUCHER_TOO_FEW_LINES')
  }
  let debit = 0
  let credit = 0
  const rows = lines.map((line, idx) => {
    const code = line.accountCode?.trim()
    const acc = code ? accountMap.get(code) : undefined
    if (!acc)
      throw new AppError(
        `第 ${idx + 1} 行科目 ${code ?? '(空)'} 不存在`,
        400,
        'FIN_VOUCHER_ACCOUNT_MISSING',
      )
    if (!acc.enabled)
      throw new AppError(`第 ${idx + 1} 行科目 ${code} 已停用`, 400, 'FIN_VOUCHER_ACCOUNT_DISABLED')
    if (!acc.isLeaf)
      throw new AppError(
        `第 ${idx + 1} 行科目 ${code} 不是末级科目`,
        400,
        'FIN_VOUCHER_ACCOUNT_NOT_LEAF',
      )
    if (line.direction !== 'debit' && line.direction !== 'credit') {
      throw new AppError(
        `第 ${idx + 1} 行方向必须是 debit/credit`,
        400,
        'FIN_VOUCHER_BAD_DIRECTION',
      )
    }
    const amount = toCents(line.amount, `lines[${idx}].amount`)
    if (amount <= 0) {
      throw new AppError(`第 ${idx + 1} 行金额必须大于 0`, 400, 'FIN_VOUCHER_BAD_AMOUNT')
    }
    if (line.direction === 'debit') debit += amount
    else credit += amount
    return {
      lineNo: idx + 1,
      accountCode: code!,
      accountName: acc.name,
      direction: line.direction,
      amount: fromCents(amount),
      summary: line.summary?.trim() || null,
      aux: line.aux ?? {},
    }
  })
  return { rows, debit, credit }
}

export async function createVoucher(ledgerId: string, input: VoucherInput, userId?: string | null) {
  if (!DATE_RE.test(input.voucherDate ?? '')) {
    throw new AppError('voucherDate 必须是 YYYY-MM-DD', 400, 'FIN_VOUCHER_BAD_DATE')
  }
  if (!input.voucherDate.startsWith(input.period)) {
    throw new AppError(
      `凭证日期 ${input.voucherDate} 不在所属期间 ${input.period} 内`,
      400,
      'FIN_VOUCHER_DATE_OUT_OF_PERIOD',
    )
  }
  if (input.source && !VOUCHER_SOURCES.includes(input.source)) {
    throw new AppError('凭证来源档非法', 400, 'FIN_VOUCHER_BAD_SOURCE')
  }
  await assertPeriodOpen(ledgerId, input.period)

  const accounts = await db
    .select({
      code: finAccount.code,
      name: finAccount.name,
      isLeaf: finAccount.isLeaf,
      enabled: finAccount.enabled,
    })
    .from(finAccount)
    .where(eq(finAccount.ledgerId, ledgerId))
  const accountMap = new Map(accounts.map((a) => [a.code, a]))
  const normalized = normalizeLines(input.lines, accountMap)
  const post = input.post === true
  if (post && normalized.debit !== normalized.credit) {
    throw new AppError(
      `借贷不平衡(借 ${fromCents(normalized.debit)} / 贷 ${fromCents(normalized.credit)}),只有平衡凭证才能过账`,
      400,
      'FIN_VOUCHER_UNBALANCED',
    )
  }

  const voucherNo = await nextVoucherNo(ledgerId, input.period)
  try {
    return await db.transaction(async (tx) => {
      const [head] = await tx
        .insert(finVoucher)
        .values({
          ledgerId,
          period: input.period,
          voucherNo,
          voucherDate: input.voucherDate,
          summary: input.summary?.trim() || null,
          source: input.source ?? 'manual',
          sourceRef: input.sourceRef ?? null,
          status: post ? 'posted' : 'draft',
          totalDebit: fromCents(normalized.debit),
          totalCredit: fromCents(normalized.credit),
          createdBy: userId ?? null,
          postedBy: post ? (userId ?? null) : null,
          postedAt: post ? new Date() : null,
        })
        .returning()
      const headRow = head!
      await tx.insert(finVoucherLine).values(
        normalized.rows.map((r) => ({
          voucherId: headRow.id,
          lineNo: r.lineNo,
          accountCode: r.accountCode,
          accountName: r.accountName,
          direction: r.direction,
          amount: r.amount,
          summary: r.summary,
          aux: r.aux,
        })),
      )
      return headRow
    })
  } catch (err) {
    if (isUnique(err)) {
      throw new AppError('凭证号冲突或同一来源凭证已存在(幂等键命中)', 409, 'FIN_VOUCHER_DUPLICATE')
    }
    throw err
  }
}

export async function getVoucher(id: string) {
  const [head] = await db
    .select()
    .from(finVoucher)
    .where(and(eq(finVoucher.id, id), isNull(finVoucher.deletedAt)))
  if (!head) throw new AppError('凭证不存在或已删除', 404, 'FIN_VOUCHER_NOT_FOUND')
  const lines = await db
    .select()
    .from(finVoucherLine)
    .where(eq(finVoucherLine.voucherId, id))
    .orderBy(asc(finVoucherLine.lineNo))
  return { ...head, lines }
}

export async function listVouchers(
  ledgerId: string,
  params: { period?: string; status?: string; page?: number; limit?: number },
) {
  const page = Math.max(1, params.page ?? 1)
  const limit = Math.min(200, Math.max(1, params.limit ?? 20))
  const where = [eq(finVoucher.ledgerId, ledgerId), isNull(finVoucher.deletedAt)]
  if (params.period) {
    assertPeriod(params.period, 'period')
    where.push(eq(finVoucher.period, params.period))
  }
  if (params.status) where.push(eq(finVoucher.status, params.status))
  const cond = and(...where)
  const [rows, totalRows] = await Promise.all([
    db
      .select()
      .from(finVoucher)
      .where(cond)
      .orderBy(desc(finVoucher.period), asc(finVoucher.voucherNo))
      .limit(limit)
      .offset((page - 1) * limit),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(finVoucher)
      .where(cond),
  ])
  return { list: rows, page, limit, total: totalRows[0]?.n ?? 0 }
}

/** 过账:draft → posted。已结账期间与不平衡一律拒绝。 */
export async function postVoucher(id: string, userId?: string | null) {
  const voucher = await getVoucher(id)
  if (voucher.status === 'posted') return voucher
  if (voucher.status === 'reversed') {
    throw new AppError('已红冲的凭证不能再过账', 409, 'FIN_VOUCHER_REVERSED')
  }
  await assertReviewGate(voucher)
  await assertPeriodOpen(voucher.ledgerId, voucher.period)
  const debit = voucher.lines
    .filter((l) => l.direction === 'debit')
    .reduce((s, l) => s + toCents(l.amount), 0)
  const credit = voucher.lines
    .filter((l) => l.direction === 'credit')
    .reduce((s, l) => s + toCents(l.amount), 0)
  if (debit !== credit || debit === 0) {
    throw new AppError(
      `借贷不平衡(借 ${fromCents(debit)} / 贷 ${fromCents(credit)}),拒绝过账`,
      400,
      'FIN_VOUCHER_UNBALANCED',
    )
  }
  const [row] = await db
    .update(finVoucher)
    .set({
      status: 'posted',
      totalDebit: fromCents(debit),
      totalCredit: fromCents(credit),
      postedBy: userId ?? null,
      postedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(finVoucher.id, id))
    .returning()
  return { ...row!, lines: voucher.lines }
}

/** 修改草稿凭证(已过账/已结账/已红冲一律拒绝)。 */
export async function updateVoucher(
  id: string,
  patch: { summary?: string; voucherDate?: string; lines?: VoucherLineInput[] },
) {
  const voucher = await getVoucher(id)
  if (voucher.status !== 'draft') {
    throw new AppError('只有草稿状态凭证可修改(已过账请先红冲)', 409, 'FIN_VOUCHER_NOT_DRAFT')
  }
  await assertPeriodOpen(voucher.ledgerId, voucher.period)
  const accounts = await db
    .select({
      code: finAccount.code,
      name: finAccount.name,
      isLeaf: finAccount.isLeaf,
      enabled: finAccount.enabled,
    })
    .from(finAccount)
    .where(eq(finAccount.ledgerId, voucher.ledgerId))
  const accountMap = new Map(accounts.map((a) => [a.code, a]))
  const normalized = patch.lines ? normalizeLines(patch.lines, accountMap) : null

  return db.transaction(async (tx) => {
    const values: Record<string, unknown> = { updatedAt: new Date() }
    if (patch.summary !== undefined) values['summary'] = patch.summary.trim() || null
    if (patch.voucherDate !== undefined) {
      if (!DATE_RE.test(patch.voucherDate) || !patch.voucherDate.startsWith(voucher.period)) {
        throw new AppError('凭证日期非法或不在所属期间内', 400, 'FIN_VOUCHER_BAD_DATE')
      }
      values['voucherDate'] = patch.voucherDate
    }
    if (normalized) {
      values['totalDebit'] = fromCents(normalized.debit)
      values['totalCredit'] = fromCents(normalized.credit)
      await tx.delete(finVoucherLine).where(eq(finVoucherLine.voucherId, id))
      await tx.insert(finVoucherLine).values(
        normalized.rows.map((r) => ({
          voucherId: id,
          lineNo: r.lineNo,
          accountCode: r.accountCode,
          accountName: r.accountName,
          direction: r.direction,
          amount: r.amount,
          summary: r.summary,
          aux: r.aux,
        })),
      )
    }
    const [row] = await tx.update(finVoucher).set(values).where(eq(finVoucher.id, id)).returning()
    return row!
  })
}

export async function deleteVoucher(id: string) {
  const voucher = await getVoucher(id)
  if (voucher.status !== 'draft') {
    throw new AppError('只有草稿凭证可删除(已过账请走红冲)', 409, 'FIN_VOUCHER_NOT_DRAFT')
  }
  await assertPeriodOpen(voucher.ledgerId, voucher.period)
  await db
    .update(finVoucher)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(finVoucher.id, id))
  return { deleted: true, id }
}

/**
 * 红冲:为一张已过账凭证生成反向凭证(方向互换、金额不变),原凭证标记 reversed。
 * 历史金额不改 —— 这是审计可追溯的最低要求。
 */
export async function reverseVoucher(id: string, userId?: string | null, period?: string) {
  const voucher = await getVoucher(id)
  if (voucher.status !== 'posted') {
    throw new AppError('只有已过账凭证可红冲', 409, 'FIN_VOUCHER_NOT_POSTED')
  }
  const targetPeriod = period ?? voucher.period
  await assertPeriodOpen(voucher.ledgerId, targetPeriod)
  const reversed: VoucherLineInput[] = voucher.lines.map((l) => ({
    accountCode: l.accountCode,
    direction: l.direction === 'debit' ? 'credit' : 'debit',
    amount: l.amount,
    summary: l.summary ?? `红冲 ${voucher.voucherNo}`,
    aux: l.aux as Record<string, string>,
  }))
  const newVoucher = await createVoucher(
    voucher.ledgerId,
    {
      period: targetPeriod,
      voucherDate: `${targetPeriod}-${voucher.voucherDate.slice(8, 10)}`,
      summary: `红冲凭证 ${voucher.voucherNo}`,
      source: 'reverse',
      post: true,
      lines: reversed,
    },
    userId,
  )
  await db
    .update(finVoucher)
    .set({ status: 'reversed', reversesVoucherId: newVoucher.id, updatedAt: new Date() })
    .where(eq(finVoucher.id, id))
  return { original: voucher.voucherNo, reversal: newVoucher.voucherNo, reversalId: newVoucher.id }
}

/**
 * 幂等批量导入(AI 代账产物落库入口)。
 * 同一 sourceRef 第二次进来直接跳过,不重复入账。
 */
export async function importVouchers(
  ledgerId: string,
  inputs: Array<VoucherInput & { sourceRef: string }>,
  userId?: string | null,
) {
  const imported: string[] = []
  const skipped: string[] = []
  const failed: Array<{ sourceRef: string; errorCode: string; message: string }> = []
  for (const input of inputs) {
    try {
      const existing = await db
        .select({ id: finVoucher.id })
        .from(finVoucher)
        .where(
          and(
            eq(finVoucher.ledgerId, ledgerId),
            eq(finVoucher.sourceRef, input.sourceRef),
            isNull(finVoucher.deletedAt),
          ),
        )
      if (existing.length > 0) {
        skipped.push(input.sourceRef)
        continue
      }
      const row = await createVoucher(ledgerId, { ...input, source: 'auto' }, userId)
      imported.push(row.id)
    } catch (err) {
      if (err instanceof AppError) {
        failed.push({ sourceRef: input.sourceRef, errorCode: err.errorCode, message: err.message })
      } else throw err
    }
  }
  return { imported, skipped, failed }
}

/** 批量过账(给定凭证 id,逐张校验) */
export async function postVouchers(ids: string[], userId?: string | null) {
  if (ids.length === 0) return { posted: 0, failed: [] as Array<{ id: string; message: string }> }
  const rows = await db
    .select({ id: finVoucher.id })
    .from(finVoucher)
    .where(and(inArray(finVoucher.id, ids), isNull(finVoucher.deletedAt)))
  const failed: Array<{ id: string; message: string }> = []
  let posted = 0
  for (const row of rows) {
    try {
      await postVoucher(row.id, userId)
      posted += 1
    } catch (err) {
      failed.push({ id: row.id, message: err instanceof Error ? err.message : String(err) })
    }
  }
  return { posted, failed }
}

function isUnique(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: string }).code === '23505'
  )
}

/** 复核闸豁免的系统凭证来源:结转与红冲由系统生成,正确性由生成方保证 */
const REVIEW_GATE_EXEMPT = new Set(['closing', 'reverse'])

/**
 * 过账前复核闸(仅在账套 review_required=true 时生效)。
 * 校验放在这里而不是路由层:AI 工具、批量过账、内部服务调用同样过这道闸。
 */
async function assertReviewGate(voucher: {
  ledgerId: string
  source: string
  reviewStatus: number
  voucherNo: string
}) {
  if (REVIEW_GATE_EXEMPT.has(voucher.source)) return
  const [ledger] = await db
    .select({ reviewRequired: finLedger.reviewRequired })
    .from(finLedger)
    .where(eq(finLedger.id, voucher.ledgerId))
  if (!ledger?.reviewRequired) return
  if (voucher.reviewStatus === 2) return
  throw new AppError(
    `账套已开启复核闸,凭证 ${voucher.voucherNo} 尚未复核通过(当前 reviewStatus=${voucher.reviewStatus}),拒绝过账`,
    409,
    'FIN_REVIEW_REQUIRED',
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
