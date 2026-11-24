// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 银行流水域服务:账户 / 流水导入(幂等) / 自动对账 / 手工匹配 / 对账汇总。
 *
 * 自动对账算法(可解释,不做"黑箱匹配"):
 *   对每笔未匹配流水,在已过账凭证的"银行存款(1002)"分录里找:
 *     金额相等(分口径) ∧ 方向一致(流水流入=凭证借方) ∧ 日期相差 ≤ 7 天 ∧ 该凭证尚未被占用
 *   命中即写 matched + matchMode='auto';否则留在 unmatched 等人工。
 *
 * 刻意不做:
 *   · 不做"金额相近就配"(会把 1000 和 999.9 配错);
 *   · 不做部分匹配(部分收款要拆凭证,应由人决定拆分口径);
 *   · 不覆盖 ignored(用户已明确判定与账无关)。
 */

import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm'

import { db } from '../../db/index.js'
import { AppError } from '../../errors/AppError.js'
import { finBankAccount, finBankStatement, finVoucher, finVoucherLine } from '@ihui/database'
import { fromCents, toCents } from './money.js'
import { assertPeriod } from './period.js'
import { getLedger } from './ledger-service.js'
import { computeTrialBalance } from './balance-service.js'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const CASH_ACCOUNT = '1002'
const DAY_MS = 86_400_000

export async function createBankAccount(
  ledgerId: string,
  input: {
    bankName: string
    accountNo: string
    accountName?: string
    currency?: string
    isDefault?: boolean
  },
) {
  await getLedger(ledgerId)
  if (!input.bankName?.trim()) throw new AppError('银行名称必填', 400, 'FIN_BANK_NAME_REQUIRED')
  if (!input.accountNo?.trim())
    throw new AppError('银行账号必填', 400, 'FIN_BANK_ACCOUNT_NO_REQUIRED')
  return db.transaction(async (tx) => {
    if (input.isDefault) {
      await tx
        .update(finBankAccount)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(eq(finBankAccount.ledgerId, ledgerId))
    }
    try {
      const [row] = await tx
        .insert(finBankAccount)
        .values({
          ledgerId,
          bankName: input.bankName.trim(),
          accountNo: input.accountNo.trim(),
          accountName: input.accountName?.trim() || null,
          currency: input.currency ?? 'CNY',
          isDefault: input.isDefault ?? false,
        })
        .returning()
      return row!
    } catch (err) {
      if (isUnique(err)) throw new AppError('该银行账号已存在', 409, 'FIN_BANK_ACCOUNT_DUPLICATE')
      throw err
    }
  })
}

export async function listBankAccounts(ledgerId: string) {
  await getLedger(ledgerId)
  return db
    .select()
    .from(finBankAccount)
    .where(eq(finBankAccount.ledgerId, ledgerId))
    .orderBy(asc(finBankAccount.accountNo))
}

export interface StatementInput {
  txnDate: string
  direction: 'in' | 'out'
  amount: string | number
  balance?: string | number | undefined
  counterparty?: string | undefined
  summary?: string | undefined
  serialNo?: string | undefined
  sourceRef?: string | undefined
}

/** 幂等导入:优先用调用方给的 sourceRef;未给时用"账户+日期+方向+金额+流水号"派生。 */
export async function importStatements(
  ledgerId: string,
  bankAccountId: string,
  inputs: StatementInput[],
) {
  await getLedger(ledgerId)
  const [account] = await db
    .select()
    .from(finBankAccount)
    .where(and(eq(finBankAccount.id, bankAccountId), eq(finBankAccount.ledgerId, ledgerId)))
  if (!account) throw new AppError('银行账户不存在', 404, 'FIN_BANK_ACCOUNT_NOT_FOUND')

  const imported: string[] = []
  const skipped: string[] = []
  const failed: Array<{ index: number; errorCode: string; message: string }> = []
  for (let i = 0; i < inputs.length; i += 1) {
    const input = inputs[i]!
    try {
      if (!DATE_RE.test(input.txnDate ?? ''))
        throw new AppError('txnDate 必须是 YYYY-MM-DD', 400, 'FIN_BANK_BAD_DATE')
      const period = input.txnDate.slice(0, 7)
      assertPeriod(period, 'period')
      if (input.direction !== 'in' && input.direction !== 'out') {
        throw new AppError('direction 必须是 in/out', 400, 'FIN_BANK_BAD_DIRECTION')
      }
      const amount = toCents(input.amount, 'amount')
      if (amount <= 0) throw new AppError('流水金额必须大于 0', 400, 'FIN_BANK_BAD_AMOUNT')
      const sourceRef =
        input.sourceRef?.trim() ||
        `bank:${account.accountNo}:${input.txnDate}:${input.direction}:${fromCents(amount)}:${input.serialNo ?? ''}:${input.summary ?? ''}`
      const dup = await db
        .select({ id: finBankStatement.id })
        .from(finBankStatement)
        .where(
          and(
            eq(finBankStatement.ledgerId, ledgerId),
            eq(finBankStatement.sourceRef, sourceRef),
            isNull(finBankStatement.deletedAt),
          ),
        )
      if (dup.length > 0) {
        skipped.push(sourceRef)
        continue
      }
      const [row] = await db
        .insert(finBankStatement)
        .values({
          ledgerId,
          bankAccountId,
          txnDate: input.txnDate,
          period,
          direction: input.direction,
          amount: fromCents(amount),
          balance:
            input.balance === undefined ? null : fromCents(toCents(input.balance, 'balance')),
          counterparty: input.counterparty?.trim() || null,
          summary: input.summary?.trim() || null,
          serialNo: input.serialNo?.trim() || null,
          source: 'import',
          sourceRef,
        })
        .returning()
      imported.push(row!.id)
    } catch (err) {
      if (err instanceof AppError)
        failed.push({ index: i, errorCode: err.errorCode, message: err.message })
      else throw err
    }
  }
  return { imported, skipped, failed }
}

export async function listStatements(
  ledgerId: string,
  params: { period?: string; matchStatus?: string; page?: number; limit?: number },
) {
  const page = Math.max(1, params.page ?? 1)
  const limit = Math.min(200, Math.max(1, params.limit ?? 20))
  const where = [eq(finBankStatement.ledgerId, ledgerId), isNull(finBankStatement.deletedAt)]
  if (params.period) {
    assertPeriod(params.period, 'period')
    where.push(eq(finBankStatement.period, params.period))
  }
  if (params.matchStatus) where.push(eq(finBankStatement.matchStatus, params.matchStatus))
  const cond = and(...where)
  const [rows, count] = await Promise.all([
    db
      .select()
      .from(finBankStatement)
      .where(cond)
      .orderBy(asc(finBankStatement.txnDate))
      .limit(limit)
      .offset((page - 1) * limit),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(finBankStatement)
      .where(cond),
  ])
  return { list: rows, page, limit, total: count[0]?.n ?? 0 }
}

export interface Candidate {
  voucherId: string
  voucherNo: string
  direction: 'in' | 'out'
  amountCents: number
  txnMs: number
}

/**
 * 自动对账的匹配判据(纯函数,零 IO,单测直接钉住)。
 *
 * 精确相等 + 方向一致 + 窗口内 + 凭证未占用;命中多条时取日期最近的一条。
 * 刻意不做近似/部分匹配:把 1000 和 999.9 配上比不配更糟。
 */
export function pickMatch(
  statement: { direction: 'in' | 'out'; amountCents: number; txnMs: number },
  candidates: Candidate[],
  usedVoucherIds: ReadonlySet<string>,
  windowDays: number,
): Candidate | null {
  return (
    candidates
      .filter(
        (c) =>
          !usedVoucherIds.has(c.voucherId) &&
          c.direction === statement.direction &&
          c.amountCents === statement.amountCents &&
          Math.abs(c.txnMs - statement.txnMs) <= windowDays * DAY_MS,
      )
      .sort(
        (a, b) => Math.abs(a.txnMs - statement.txnMs) - Math.abs(b.txnMs - statement.txnMs),
      )[0] ?? null
  )
}

async function loadCandidates(ledgerId: string, period: string): Promise<Candidate[]> {
  const rows = await db
    .select({
      voucherId: finVoucher.id,
      voucherNo: finVoucher.voucherNo,
      voucherDate: finVoucher.voucherDate,
      direction: finVoucherLine.direction,
      amount: finVoucherLine.amount,
    })
    .from(finVoucherLine)
    .innerJoin(finVoucher, eq(finVoucherLine.voucherId, finVoucher.id))
    .where(
      and(
        eq(finVoucher.ledgerId, ledgerId),
        eq(finVoucher.period, period),
        eq(finVoucher.status, 'posted'),
        isNull(finVoucher.deletedAt),
        eq(finVoucherLine.accountCode, CASH_ACCOUNT),
      ),
    )
  return rows.map((r) => ({
    voucherId: r.voucherId,
    voucherNo: r.voucherNo,
    direction: r.direction === 'debit' ? 'in' : 'out',
    amountCents: toCents(r.amount),
    txnMs: Date.parse(`${r.voucherDate}T00:00:00Z`),
  }))
}

export async function autoMatch(
  ledgerId: string,
  period: string,
  options?: { dateWindowDays?: number },
) {
  assertPeriod(period, 'period')
  const windowDays = Math.min(30, Math.max(0, options?.dateWindowDays ?? 7))
  const statements = await db
    .select()
    .from(finBankStatement)
    .where(
      and(
        eq(finBankStatement.ledgerId, ledgerId),
        eq(finBankStatement.period, period),
        eq(finBankStatement.matchStatus, 'unmatched'),
        isNull(finBankStatement.deletedAt),
      ),
    )
    .orderBy(asc(finBankStatement.txnDate))
  if (statements.length === 0) return { matched: 0, remaining: 0, details: [] as string[] }

  const candidates = await loadCandidates(ledgerId, period)
  const usedVouchers = new Set<string>()
  const already = await db
    .select({ voucherId: finBankStatement.matchedVoucherId })
    .from(finBankStatement)
    .where(
      and(eq(finBankStatement.ledgerId, ledgerId), eq(finBankStatement.matchStatus, 'matched')),
    )
  for (const row of already) if (row.voucherId) usedVouchers.add(row.voucherId)

  const details: string[] = []
  let matched = 0
  for (const st of statements) {
    const cents = toCents(st.amount)
    const stMs = Date.parse(`${st.txnDate}T00:00:00Z`)
    const hit = pickMatch(
      { direction: st.direction as 'in' | 'out', amountCents: cents, txnMs: stMs },
      candidates,
      usedVouchers,
      windowDays,
    )
    if (!hit) continue
    usedVouchers.add(hit.voucherId)
    await db
      .update(finBankStatement)
      .set({
        matchStatus: 'matched',
        matchedVoucherId: hit.voucherId,
        matchedAt: new Date(),
        matchMode: 'auto',
        updatedAt: new Date(),
      })
      .where(eq(finBankStatement.id, st.id))
    matched += 1
    details.push(
      `流水 ${st.txnDate} ${st.direction === 'in' ? '收' : '付'} ${fromCents(cents)} → ${hit.voucherNo}`,
    )
  }
  return { matched, remaining: statements.length - matched, details }
}

export async function manualMatch(statementId: string, voucherId: string) {
  const [st] = await db
    .select()
    .from(finBankStatement)
    .where(and(eq(finBankStatement.id, statementId), isNull(finBankStatement.deletedAt)))
  if (!st) throw new AppError('流水不存在或已删除', 404, 'FIN_BANK_STATEMENT_NOT_FOUND')
  if (st.matchStatus === 'matched')
    throw new AppError('该流水已匹配,请先取消匹配', 409, 'FIN_BANK_ALREADY_MATCHED')
  const [v] = await db
    .select()
    .from(finVoucher)
    .where(and(eq(finVoucher.id, voucherId), isNull(finVoucher.deletedAt)))
  if (!v) throw new AppError('凭证不存在', 404, 'FIN_VOUCHER_NOT_FOUND')
  if (v.status !== 'posted') throw new AppError('只能匹配已过账凭证', 409, 'FIN_VOUCHER_NOT_POSTED')
  if (v.ledgerId !== st.ledgerId)
    throw new AppError('凭证与流水不属于同一账套', 400, 'FIN_BANK_LEDGER_MISMATCH')
  const [row] = await db
    .update(finBankStatement)
    .set({
      matchStatus: 'matched',
      matchedVoucherId: voucherId,
      matchedAt: new Date(),
      matchMode: 'manual',
      updatedAt: new Date(),
    })
    .where(eq(finBankStatement.id, statementId))
    .returning()
  return row!
}

export async function unmatchStatement(statementId: string) {
  const [row] = await db
    .update(finBankStatement)
    .set({
      matchStatus: 'unmatched',
      matchedVoucherId: null,
      matchedAt: null,
      matchMode: null,
      updatedAt: new Date(),
    })
    .where(eq(finBankStatement.id, statementId))
    .returning()
  if (!row) throw new AppError('流水不存在', 404, 'FIN_BANK_STATEMENT_NOT_FOUND')
  return row
}

export async function ignoreStatement(statementId: string, reason?: string) {
  const [row] = await db
    .update(finBankStatement)
    .set({
      matchStatus: 'ignored',
      matchedVoucherId: null,
      matchMode: reason?.trim() || 'manual-ignore',
      updatedAt: new Date(),
    })
    .where(eq(finBankStatement.id, statementId))
    .returning()
  if (!row) throw new AppError('流水不存在', 404, 'FIN_BANK_STATEMENT_NOT_FOUND')
  return row
}

/** 对账汇总:流水口径 vs 账面银行存款余额。差额非 0 即"未达账项/漏记"。 */
export async function reconcileSummary(ledgerId: string, period: string) {
  assertPeriod(period, 'period')
  const rows = await db
    .select()
    .from(finBankStatement)
    .where(
      and(
        eq(finBankStatement.ledgerId, ledgerId),
        eq(finBankStatement.period, period),
        isNull(finBankStatement.deletedAt),
      ),
    )
  const tb = await computeTrialBalance(ledgerId, period)
  const bookRow = tb.rows.find((r) => r.code === CASH_ACCOUNT)
  const bookBalance = bookRow ? toCents(bookRow.closingDebit) - toCents(bookRow.closingCredit) : 0
  const inTotal = rows
    .filter((r) => r.direction === 'in')
    .reduce((s, r) => s + toCents(r.amount), 0)
  const outTotal = rows
    .filter((r) => r.direction === 'out')
    .reduce((s, r) => s + toCents(r.amount), 0)
  const matched = rows.filter((r) => r.matchStatus === 'matched')
  const matchedNet = matched.reduce(
    (s, r) => s + (r.direction === 'in' ? toCents(r.amount) : -toCents(r.amount)),
    0,
  )
  const unmatched = rows.filter((r) => r.matchStatus === 'unmatched')
  return {
    period,
    statementCount: rows.length,
    inTotal: fromCents(inTotal),
    outTotal: fromCents(outTotal),
    netTotal: fromCents(inTotal - outTotal),
    matchedCount: matched.length,
    unmatchedCount: unmatched.length,
    ignoredCount: rows.filter((r) => r.matchStatus === 'ignored').length,
    unmatchedNet: fromCents(
      unmatched.reduce(
        (s, r) => s + (r.direction === 'in' ? toCents(r.amount) : -toCents(r.amount)),
        0,
      ),
    ),
    bookBankBalance: fromCents(bookBalance),
    matchedNet: fromCents(matchedNet),
    /** 账面 − 已匹配净额:非 0 说明还有未入账流水或账面漏记 */
    gap: fromCents(bookBalance - matchedNet),
  }
}

/** 把一批未匹配流水标记为"已用于生成凭证"(由代账流程调用后回填) */
export async function attachStatementsToVoucher(statementIds: string[], voucherId: string) {
  if (statementIds.length === 0) return { updated: 0 }
  const rows = await db
    .select({ id: finBankStatement.id })
    .from(finBankStatement)
    .where(
      and(
        inArray(finBankStatement.id, statementIds),
        eq(finBankStatement.matchStatus, 'unmatched'),
      ),
    )
  await db
    .update(finBankStatement)
    .set({
      matchStatus: 'matched',
      matchedVoucherId: voucherId,
      matchedAt: new Date(),
      matchMode: 'voucher',
      updatedAt: new Date(),
    })
    .where(
      inArray(
        finBankStatement.id,
        rows.map((r) => r.id),
      ),
    )
  return { updated: rows.length }
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
