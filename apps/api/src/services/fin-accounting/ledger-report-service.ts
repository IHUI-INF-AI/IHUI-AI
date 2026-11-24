// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 账簿报表域(明细账/总账/序时账/现金流量表)。
 *
 * 为什么单独一层:凭证与余额是真相源,报表是"给人看的口径"。把口径集中在本文件,
 * 避免路由里各写一份取数规则(必然漂移)。所有金额走整数分,出参两位小数字符串。
 *
 * 现金流量表口径:直接法简化版 —— 现金及等价物(1001/1002/1012)逐张凭证识别,
 * 按对方科目归类到经营/投资/筹资。它不是审计口径(不作纳税调整/不拆分票据贴现),
 * 结果里带 method='direct_simplified' 与 warnings,前端必须原样展示口径说明。
 */

import { and, asc, eq, gte, inArray, isNull, lte } from 'drizzle-orm'

import { db } from '../../db/index.js'
import { finAccount, finLedger, finVoucher, finVoucherLine } from '@ihui/database'
import { AppError } from '../../errors/AppError.js'
import { fromCents, toCents } from './money.js'
import { assertPeriod } from './period.js'
import { computeTrialBalance } from './balance-service.js'

const CASH_CODES = ['1001', '1002', '1012']
const INVESTING_CODES = ['1511', '1601', '1602', '1604', '1606', '1701', '1702', '1801', '5111']
const FINANCING_CODES = ['2001', '2501', '2701', '3001', '3002', '3101', '3104']

async function loadLedger(ledgerId: string) {
  const [ledger] = await db
    .select()
    .from(finLedger)
    .where(and(eq(finLedger.id, ledgerId), isNull(finLedger.deletedAt)))
  if (!ledger) throw new AppError('账套不存在或已删除', 404, 'FIN_LEDGER_NOT_FOUND')
  return ledger
}

async function loadAccount(ledgerId: string, code: string) {
  const [row] = await db
    .select()
    .from(finAccount)
    .where(and(eq(finAccount.ledgerId, ledgerId), eq(finAccount.code, code)))
  if (!row) throw new AppError(`科目 ${code} 不存在或已停用`, 404, 'FIN_ACCOUNT_NOT_FOUND')
  return row
}

function periodBounds(from: string, to: string) {
  assertPeriod(from, 'periodFrom')
  assertPeriod(to, 'periodTo')
  if (from > to) throw new AppError('periodFrom 不能晚于 periodTo', 400, 'FIN_PERIOD_RANGE_INVALID')
}

/**
 * 明细账:某科目一段期间的逐笔发生额 + 期初/期末余额。
 * opening 取 computeTrialBalance(from) 的期初口径(含启用期初与之前所有已过账分录)。
 */
export async function getDetailLedger(
  ledgerId: string,
  accountCode: string,
  periodFrom: string,
  periodTo: string,
) {
  await loadLedger(ledgerId)
  periodBounds(periodFrom, periodTo)
  const account = await loadAccount(ledgerId, accountCode)
  const tb = await computeTrialBalance(ledgerId, periodFrom)
  const openRow = tb.rows.find((r) => r.code === accountCode)
  const openingNet = openRow ? toCents(openRow.openingDebit) - toCents(openRow.openingCredit) : 0

  const raw = await db
    .select({
      voucherId: finVoucher.id,
      voucherNo: finVoucher.voucherNo,
      voucherDate: finVoucher.voucherDate,
      voucherSummary: finVoucher.summary,
      source: finVoucher.source,
      lineNo: finVoucherLine.lineNo,
      summary: finVoucherLine.summary,
      direction: finVoucherLine.direction,
      amount: finVoucherLine.amount,
      aux: finVoucherLine.aux,
    })
    .from(finVoucherLine)
    .innerJoin(finVoucher, eq(finVoucherLine.voucherId, finVoucher.id))
    .where(
      and(
        eq(finVoucher.ledgerId, ledgerId),
        eq(finVoucher.status, 'posted'),
        isNull(finVoucher.deletedAt),
        gte(finVoucher.period, periodFrom),
        lte(finVoucher.period, periodTo),
        eq(finVoucherLine.accountCode, accountCode),
      ),
    )
    .orderBy(asc(finVoucher.voucherDate), asc(finVoucher.voucherNo), asc(finVoucherLine.lineNo))

  let running = openingNet
  let totalDebit = 0
  let totalCredit = 0
  const rows = raw.map((r) => {
    const debit = r.direction === 'debit' ? toCents(r.amount) : 0
    const credit = r.direction === 'credit' ? toCents(r.amount) : 0
    totalDebit += debit
    totalCredit += credit
    running += debit - credit
    const signed = account.direction === 'debit' ? running : -running
    return {
      voucherId: r.voucherId,
      voucherNo: r.voucherNo,
      voucherDate: r.voucherDate,
      summary: r.summary ?? r.voucherSummary ?? '',
      source: r.source,
      lineNo: r.lineNo,
      debit: fromCents(debit),
      credit: fromCents(credit),
      balance: fromCents(Math.abs(signed)),
      balanceSide:
        signed >= 0 ? account.direction : account.direction === 'debit' ? 'credit' : 'debit',
      aux: r.aux,
    }
  })

  const closingNet = openingNet + totalDebit - totalCredit
  return {
    ledgerId,
    account: {
      code: account.code,
      name: account.name,
      category: account.category,
      direction: account.direction,
    },
    periodFrom,
    periodTo,
    opening: fromCents(Math.abs(openingNet)),
    openingSide: openingNet === 0 ? null : openingNet > 0 ? 'debit' : 'credit',
    totalDebit: fromCents(totalDebit),
    totalCredit: fromCents(totalCredit),
    closing: fromCents(Math.abs(closingNet)),
    closingSide: closingNet === 0 ? null : closingNet > 0 ? 'debit' : 'credit',
    rows,
  }
}

/** 总账:一段期间逐科目期初/本期/期末(与试算平衡同一取数实现,只补 category 展示)。 */
export async function getGeneralLedger(ledgerId: string, period: string) {
  await loadLedger(ledgerId)
  assertPeriod(period, 'period')
  const tb = await computeTrialBalance(ledgerId, period)
  return {
    ledgerId,
    period,
    rows: tb.rows.map((r) => ({
      code: r.code,
      name: r.name,
      category: r.category,
      direction: r.direction,
      openingDebit: r.openingDebit,
      openingCredit: r.openingCredit,
      periodDebit: r.periodDebit,
      periodCredit: r.periodCredit,
      closingDebit: r.closingDebit,
      closingCredit: r.closingCredit,
    })),
    totalDebit: tb.totalDebit,
    totalCredit: tb.totalCredit,
    balanced: tb.balanced,
  }
}

/** 序时账:按凭证日期/号排序的已过账凭证与分录。 */
export async function getJournal(
  ledgerId: string,
  periodFrom: string,
  periodTo: string,
  limit = 200,
) {
  await loadLedger(ledgerId)
  periodBounds(periodFrom, periodTo)
  const cap = Math.min(Math.max(1, limit), 1000)
  const heads = await db
    .select({
      id: finVoucher.id,
      voucherNo: finVoucher.voucherNo,
      voucherDate: finVoucher.voucherDate,
      period: finVoucher.period,
      summary: finVoucher.summary,
      source: finVoucher.source,
      totalDebit: finVoucher.totalDebit,
      totalCredit: finVoucher.totalCredit,
    })
    .from(finVoucher)
    .where(
      and(
        eq(finVoucher.ledgerId, ledgerId),
        eq(finVoucher.status, 'posted'),
        isNull(finVoucher.deletedAt),
        gte(finVoucher.period, periodFrom),
        lte(finVoucher.period, periodTo),
      ),
    )
    .orderBy(asc(finVoucher.voucherDate), asc(finVoucher.voucherNo))
    .limit(cap)

  const ids = heads.map((h) => h.id)
  const allLines = ids.length
    ? await db
        .select({
          voucherId: finVoucherLine.voucherId,
          lineNo: finVoucherLine.lineNo,
          accountCode: finVoucherLine.accountCode,
          accountName: finVoucherLine.accountName,
          direction: finVoucherLine.direction,
          amount: finVoucherLine.amount,
          summary: finVoucherLine.summary,
          aux: finVoucherLine.aux,
        })
        .from(finVoucherLine)
        .where(inArray(finVoucherLine.voucherId, ids))
        .orderBy(asc(finVoucherLine.lineNo))
    : []
  const byVoucher = new Map<string, typeof allLines>()
  for (const l of allLines) {
    const list = byVoucher.get(l.voucherId) ?? []
    list.push(l)
    byVoucher.set(l.voucherId, list)
  }

  return {
    ledgerId,
    periodFrom,
    periodTo,
    limit: cap,
    vouchers: heads.map((h) => ({
      ...h,
      lines: (byVoucher.get(h.id) ?? []).map((l) => ({
        lineNo: l.lineNo,
        accountCode: l.accountCode,
        accountName: l.accountName,
        direction: l.direction,
        amount: l.amount,
        summary: l.summary,
        aux: l.aux,
      })),
    })),
  }
}

type CashSection = 'operating' | 'investing' | 'financing'

function classifyCashLine(accountCode: string, summary: string | null): CashSection {
  if (INVESTING_CODES.includes(accountCode)) return 'investing'
  if (FINANCING_CODES.includes(accountCode)) return 'financing'
  if (accountCode === '5503') {
    // 财务费用里只有利息收支属筹资,手续费/汇兑损益按经营。
    return /利息/.test(summary ?? '') ? 'financing' : 'operating'
  }
  return 'operating'
}

/**
 * 现金流量表(直接法简化口径)。
 * 逐张已过账凭证:现金科目净变动 = 现金净流入;对方科目按科目表映射归类。
 * 现金与现金之间的划转(净变动为 0)不产生现金流,直接跳过。
 */
export async function getCashFlowStatement(ledgerId: string, period: string) {
  const ledger = await loadLedger(ledgerId)
  assertPeriod(period, 'period')
  if (period < ledger.startPeriod) {
    throw new AppError(`期间早于账套启用期间 ${ledger.startPeriod}`, 400, 'FIN_PERIOD_BEFORE_START')
  }

  const raw = await db
    .select({
      voucherId: finVoucher.id,
      voucherNo: finVoucher.voucherNo,
      voucherDate: finVoucher.voucherDate,
      voucherSummary: finVoucher.summary,
      accountCode: finVoucherLine.accountCode,
      accountName: finVoucherLine.accountName,
      direction: finVoucherLine.direction,
      amount: finVoucherLine.amount,
      lineSummary: finVoucherLine.summary,
    })
    .from(finVoucherLine)
    .innerJoin(finVoucher, eq(finVoucherLine.voucherId, finVoucher.id))
    .where(
      and(
        eq(finVoucher.ledgerId, ledgerId),
        eq(finVoucher.period, period),
        eq(finVoucher.status, 'posted'),
        isNull(finVoucher.deletedAt),
      ),
    )
    .orderBy(asc(finVoucher.voucherDate), asc(finVoucher.voucherNo), asc(finVoucherLine.lineNo))

  const byVoucher = new Map<
    string,
    Array<{
      accountCode: string
      accountName: string
      direction: string
      amount: string
      summary: string | null
    }>
  >()
  for (const r of raw) {
    const list = byVoucher.get(r.voucherId) ?? []
    list.push({
      accountCode: r.accountCode,
      accountName: r.accountName,
      direction: r.direction,
      amount: r.amount,
      summary: r.lineSummary ?? r.voucherSummary,
    })
    byVoucher.set(r.voucherId, list)
  }

  const buckets: Record<CashSection, Map<string, { name: string; cents: number }>> = {
    operating: new Map(),
    investing: new Map(),
    financing: new Map(),
  }
  const warnings: string[] = []
  let netChange = 0
  let skippedInternal = 0

  for (const lines of byVoucher.values()) {
    let cashNet = 0
    for (const l of lines) {
      if (!CASH_CODES.includes(l.accountCode)) continue
      cashNet += (l.direction === 'debit' ? 1 : -1) * toCents(l.amount)
    }
    if (cashNet === 0) {
      skippedInternal += 1
      continue
    }
    netChange += cashNet
    for (const l of lines) {
      if (CASH_CODES.includes(l.accountCode)) continue
      const signed = (l.direction === 'debit' ? 1 : -1) * toCents(l.amount)
      const effect = -signed
      if (effect === 0) continue
      const section = classifyCashLine(l.accountCode, l.summary)
      const key = `${l.accountCode}`
      const cur = buckets[section].get(key) ?? { name: l.accountName, cents: 0 }
      cur.cents += effect
      buckets[section].set(key, cur)
    }
  }

  const tb = await computeTrialBalance(ledgerId, period)
  const openingCash = CASH_CODES.reduce((s, code) => {
    const r = tb.rows.find((x) => x.code === code)
    return s + (r ? toCents(r.openingDebit) - toCents(r.openingCredit) : 0)
  }, 0)
  const closingCash = CASH_CODES.reduce((s, code) => {
    const r = tb.rows.find((x) => x.code === code)
    return s + (r ? toCents(r.closingDebit) - toCents(r.closingCredit) : 0)
  }, 0)

  const sectionOf = (b: Map<string, { name: string; cents: number }>) => {
    const items = [...b.entries()]
      .map(([code, v]) => ({ code, name: v.name, amount: fromCents(v.cents) }))
      .filter((i) => i.amount !== '0.00')
      .sort((a, b2) => Math.abs(toCents(b2.amount)) - Math.abs(toCents(a.amount)))
    const net = items.reduce((s, i) => s + toCents(i.amount), 0)
    return { items, net: fromCents(net) }
  }

  const operating = sectionOf(buckets.operating)
  const investing = sectionOf(buckets.investing)
  const financing = sectionOf(buckets.financing)
  const totalNet = toCents(operating.net) + toCents(investing.net) + toCents(financing.net)
  if (totalNet !== netChange) {
    warnings.push(
      `归类合计 ${fromCents(totalNet)} 与现金净增加 ${fromCents(netChange)} 不一致(可能存在未平衡分录)`,
    )
  }
  if (skippedInternal > 0) {
    warnings.push(`${skippedInternal} 张凭证为现金内部划转,未计入现金流`)
  }

  return {
    ledgerId,
    period,
    method: 'direct_simplified' as const,
    methodNote: '直接法简化口径:按对方科目映射归类,不作纳税调整与票据贴现拆分',
    openingCash: fromCents(openingCash),
    closingCash: fromCents(closingCash),
    netIncrease: fromCents(closingCash - openingCash),
    netChange: fromCents(netChange),
    operating,
    investing,
    financing,
    reconciled: closingCash - openingCash === netChange && totalNet === netChange,
    warnings,
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
