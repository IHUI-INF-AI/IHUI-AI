// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 余额与报表域服务:试算平衡 / 科目余额表 / 资产负债表 / 利润表 / 结账 / 反结账。
 *
 * 真相源纪律:
 *   · 余额的唯一算法 = 期初余额 + [startPeriod, 目标期间] 内所有已过账分录;
 *   · fin_account_balance 只是该算法的物化缓存,任何时候都能重算覆盖;
 *   · 结账写 fin_period_close 并把 current_period 推进一期,已结账期间拒绝写入。
 */

import { and, eq, gte, isNull, lte, ne } from 'drizzle-orm'

import { db } from '../../db/index.js'
import { AppError } from '../../errors/AppError.js'
import {
  finAccount,
  finAccountBalance,
  finOpeningBalance,
  finPeriodClose,
  finVoucher,
  finVoucherLine,
  finLedger,
  finYearEnd,
} from '@ihui/database'
import { fromCents, toCents } from './money.js'
import { getLedger } from './ledger-service.js'
import { assertPeriod, lastDayOf, nextPeriod, prevPeriod } from './period.js'
import { createVoucher } from './voucher-service.js'

interface AccountMeta {
  code: string
  name: string
  category: string
  direction: string
  isLeaf: boolean
  enabled: boolean
  level: number
  parentCode: string | null
}

export interface BalanceRow {
  code: string
  name: string
  category: string
  direction: string
  level: number
  openingDebit: string
  openingCredit: string
  periodDebit: string
  periodCredit: string
  closingDebit: string
  closingCredit: string
}

async function loadAccounts(ledgerId: string): Promise<AccountMeta[]> {
  const rows = await db
    .select({
      code: finAccount.code,
      name: finAccount.name,
      category: finAccount.category,
      direction: finAccount.direction,
      isLeaf: finAccount.isLeaf,
      enabled: finAccount.enabled,
      level: finAccount.level,
      parentCode: finAccount.parentCode,
    })
    .from(finAccount)
    .where(eq(finAccount.ledgerId, ledgerId))
  return rows
}

async function loadVoucherLines(
  ledgerId: string,
  from: string,
  to: string,
  opts?: { excludeClosing?: boolean },
) {
  const where = [
    eq(finVoucher.ledgerId, ledgerId),
    eq(finVoucher.status, 'posted'),
    isNull(finVoucher.deletedAt),
    gte(finVoucher.period, from),
    lte(finVoucher.period, to),
  ]
  // 利润表口径:期末结转凭证是"把损益搬进本年利润"的搬运工具,不是本期损益发生额。
  // 若把它算进来,结账前后同一张利润表会出现 0 与非 0 两个答案(实测踩过)。
  if (opts?.excludeClosing) where.push(ne(finVoucher.source, 'closing'))
  const rows = await db
    .select({
      accountCode: finVoucherLine.accountCode,
      direction: finVoucherLine.direction,
      amount: finVoucherLine.amount,
      period: finVoucher.period,
    })
    .from(finVoucherLine)
    .innerJoin(finVoucher, eq(finVoucherLine.voucherId, finVoucher.id))
    .where(and(...where))
  return rows
}

async function loadOpening(ledgerId: string, period: string) {
  const rows = await db
    .select({
      accountCode: finOpeningBalance.accountCode,
      debitAmount: finOpeningBalance.debitAmount,
      creditAmount: finOpeningBalance.creditAmount,
    })
    .from(finOpeningBalance)
    .where(and(eq(finOpeningBalance.ledgerId, ledgerId), eq(finOpeningBalance.period, period)))
  return rows
}

/**
 * 计算某期间余额表。
 * opening = 期初余额 + 起始期间到**上一期**的所有已过账分录(跨期连续账的核心);
 * period  = 本期已过账分录发生额;closing = opening + period。
 */
export async function computeTrialBalance(
  ledgerId: string,
  period: string,
): Promise<{
  period: string
  rows: BalanceRow[]
  totalDebit: string
  totalCredit: string
  balanced: boolean
}> {
  const ledger = await getLedger(ledgerId)
  assertPeriod(period, 'period')
  if (period < ledger.startPeriod) {
    throw new AppError(
      `期间 ${period} 早于账套启用期间 ${ledger.startPeriod}`,
      400,
      'FIN_PERIOD_BEFORE_START',
    )
  }
  const accounts = await loadAccounts(ledgerId)
  const start = ledger.startPeriod
  const upper = prevPeriod(period)
  const openingRows = await loadOpening(ledgerId, start)
  const priorLines = start <= upper ? await loadVoucherLines(ledgerId, start, upper) : []
  const currentLines = await loadVoucherLines(ledgerId, period, period)

  const acc = new Map<string, { od: number; oc: number; pd: number; pc: number }>()
  const bump = (code: string, key: 'od' | 'oc' | 'pd' | 'pc', cents: number) => {
    const cur = acc.get(code) ?? { od: 0, oc: 0, pd: 0, pc: 0 }
    cur[key] += cents
    acc.set(code, cur)
  }
  for (const r of openingRows) {
    bump(r.accountCode, 'od', toCents(r.debitAmount))
    bump(r.accountCode, 'oc', toCents(r.creditAmount))
  }
  for (const l of priorLines) {
    bump(l.accountCode, l.direction === 'debit' ? 'od' : 'oc', toCents(l.amount))
  }
  for (const l of currentLines) {
    bump(l.accountCode, l.direction === 'debit' ? 'pd' : 'pc', toCents(l.amount))
  }

  let totalDebit = 0
  let totalCredit = 0
  const rows: BalanceRow[] = accounts
    .slice()
    .sort((a, b) => a.code.localeCompare(b.code))
    .map((a) => {
      const v = acc.get(a.code) ?? { od: 0, oc: 0, pd: 0, pc: 0 }
      const openNet = v.od - v.oc
      const closeNet = openNet + v.pd - v.pc
      const openingDebit = openNet > 0 ? openNet : 0
      const openingCredit = openNet < 0 ? -openNet : 0
      const closingDebit = closeNet > 0 ? closeNet : 0
      const closingCredit = closeNet < 0 ? -closeNet : 0
      totalDebit += closingDebit
      totalCredit += closingCredit
      return {
        code: a.code,
        name: a.name,
        category: a.category,
        direction: a.direction,
        level: a.level,
        openingDebit: fromCents(openingDebit),
        openingCredit: fromCents(openingCredit),
        periodDebit: fromCents(v.pd),
        periodCredit: fromCents(v.pc),
        closingDebit: fromCents(closingDebit),
        closingCredit: fromCents(closingCredit),
      }
    })
    .filter((r) => {
      const v = acc.get(r.code)
      return Boolean(v && (v.od || v.oc || v.pd || v.pc))
    })

  return {
    period,
    rows,
    totalDebit: fromCents(totalDebit),
    totalCredit: fromCents(totalCredit),
    balanced: totalDebit === totalCredit,
  }
}

/** 物化余额缓存(结账/查询时刷新;失败不阻断主流程时由调用方决定) */
export async function materializeBalances(ledgerId: string, period: string) {
  const tb = await computeTrialBalance(ledgerId, period)
  await db.transaction(async (tx) => {
    await tx
      .delete(finAccountBalance)
      .where(and(eq(finAccountBalance.ledgerId, ledgerId), eq(finAccountBalance.period, period)))
    if (tb.rows.length > 0) {
      await tx.insert(finAccountBalance).values(
        tb.rows.map((r) => ({
          ledgerId,
          period,
          accountCode: r.code,
          openingDebit: r.openingDebit,
          openingCredit: r.openingCredit,
          periodDebit: r.periodDebit,
          periodCredit: r.periodCredit,
          closingDebit: r.closingDebit,
          closingCredit: r.closingCredit,
        })),
      )
    }
  })
  return tb
}

/** 逐科目净额(cents):正=借方余额,负=贷方余额 */
function netMap(tb: { rows: BalanceRow[] }): Map<string, number> {
  const m = new Map<string, number>()
  for (const r of tb.rows) {
    m.set(r.code, toCents(r.closingDebit) - toCents(r.closingCredit))
  }
  return m
}

function pick(net: Map<string, number>, codes: string[]): number {
  return codes.reduce((s, c) => s + (net.get(c) ?? 0), 0)
}

export interface StatementLine {
  label: string
  amount: string
  codes: string[]
}

export interface PnlLine extends StatementLine {
  /** 本年累计(从 max(startPeriod, 当年 01) 至本期间) */
  ytd: string
}

/** 资产负债表(期末余额口径)。资产 = 负债 + 所有者权益,差额单列供核对。 */
export async function buildBalanceSheet(ledgerId: string, period: string) {
  const tb = await computeTrialBalance(ledgerId, period)
  const net = netMap(tb)
  const assets: StatementLine[] = [
    { label: '货币资金', codes: ['1001', '1002', '1012'] },
    { label: '应收票据', codes: ['1121'] },
    { label: '应收账款', codes: ['1122'] },
    { label: '预付账款', codes: ['1123'] },
    { label: '其他应收款', codes: ['1221'] },
    {
      label: '存货',
      codes: ['1401', '1402', '1403', '1405', '1408', '1411', '4001', '4002', '4101', '4301'],
    },
    { label: '固定资产原价', codes: ['1601'] },
    { label: '减:累计折旧', codes: ['1602'] },
    { label: '在建工程', codes: ['1604'] },
    { label: '无形资产', codes: ['1701', '1702'] },
    { label: '长期待摊费用', codes: ['1801'] },
  ].map((l) => ({ ...l, amount: fromCents(pick(net, l.codes)) }))

  const liabilities: StatementLine[] = [
    { label: '短期借款', codes: ['2001'] },
    { label: '应付票据', codes: ['2201'] },
    { label: '应付账款', codes: ['2202'] },
    { label: '预收账款', codes: ['2203'] },
    { label: '应付职工薪酬', codes: ['2211'] },
    {
      label: '应交税费',
      codes: [
        '2221',
        '222101',
        '222102',
        '222103',
        '222104',
        '222105',
        '222106',
        '222107',
        '222108',
        '222109',
        '222110',
        '222111',
        '222112',
      ],
    },
    { label: '其他应付款', codes: ['2241'] },
    { label: '长期借款', codes: ['2501'] },
    { label: '长期应付款', codes: ['2701'] },
  ].map((l) => ({ ...l, amount: fromCents(-pick(net, l.codes)) }))

  const equity: StatementLine[] = [
    { label: '实收资本', codes: ['3001'] },
    { label: '资本公积', codes: ['3002'] },
    { label: '盈余公积', codes: ['3101'] },
    { label: '未分配利润', codes: ['3103', '3104'] },
  ].map((l) => ({ ...l, amount: fromCents(-pick(net, l.codes)) }))

  const sum = (lines: StatementLine[]) => lines.reduce((s, l) => s + toCents(l.amount), 0)
  const assetTotal = sum(assets)
  const liabilityTotal = sum(liabilities)
  const equityTotal = sum(equity)
  return {
    period,
    assets,
    liabilities,
    equity,
    totalAssets: fromCents(assetTotal),
    totalLiabilities: fromCents(liabilityTotal),
    totalEquity: fromCents(equityTotal),
    equationDelta: fromCents(assetTotal - liabilityTotal - equityTotal),
    balanced: assetTotal === liabilityTotal + equityTotal,
  }
}

/** 利润表:本期发生 + 本年累计(从 max(startPeriod, 当年 01) 起算)。 */
export async function buildIncomeStatement(ledgerId: string, period: string) {
  const ledger = await getLedger(ledgerId)
  const currentLines = await loadVoucherLines(ledgerId, period, period, { excludeClosing: true })
  const current = new Map<string, number>()
  for (const l of currentLines) {
    const delta = l.direction === 'debit' ? toCents(l.amount) : -toCents(l.amount)
    current.set(l.accountCode, (current.get(l.accountCode) ?? 0) + delta)
  }
  const yearStart = `${period.slice(0, 4)}-01`
  const ytdFrom = yearStart > ledger.startPeriod ? yearStart : ledger.startPeriod
  const ytdTb = ytdFrom === period ? null : await computeYtd(ledgerId, ytdFrom, period)
  const ytd = ytdTb ?? current

  const line = (label: string, codes: string[], sign: 1 | -1): PnlLine => {
    const cur = codes.reduce((s, c) => s + (current.get(c) ?? 0), 0) * sign
    const acc = codes.reduce((s, c) => s + (ytd.get(c) ?? 0), 0) * sign
    return { label, amount: fromCents(cur), codes, ytd: fromCents(acc) }
  }
  // 收入类为贷方余额(取负),成本费用类为借方余额(取正)
  const revenue = line('营业收入', ['5001', '5051'], -1)
  const cost = line('营业成本', ['5401', '5402'], 1)
  const taxSurcharge = line('税金及附加', ['5403'], 1)
  const selling = line('销售费用', ['5501'], 1)
  const admin = line('管理费用', ['5502'], 1)
  const rd = line('研发费用', ['5504'], 1)
  const finance = line('财务费用', ['5503'], 1)
  const investment = line('投资收益', ['5111'], -1)
  const nonOpIncome = line('营业外收入', ['5301'], -1)
  const nonOpExpense = line('营业外支出', ['5601'], 1)
  const incomeTax = line('所得税费用', ['5701'], 1)

  const operatingProfit =
    toCents(revenue.amount) -
    toCents(cost.amount) -
    toCents(taxSurcharge.amount) -
    toCents(selling.amount) -
    toCents(admin.amount) -
    toCents(rd.amount) -
    toCents(finance.amount) +
    toCents(investment.amount)
  const totalProfit = operatingProfit + toCents(nonOpIncome.amount) - toCents(nonOpExpense.amount)
  const netProfit = totalProfit - toCents(incomeTax.amount)

  const ytdOf = (l: StatementLine) => toCents((l as StatementLine & { ytd: string }).ytd)
  const ytdOperating =
    ytdOf(revenue) -
    ytdOf(cost) -
    ytdOf(taxSurcharge) -
    ytdOf(selling) -
    ytdOf(admin) -
    ytdOf(rd) -
    ytdOf(finance) +
    ytdOf(investment)
  const ytdTotal = ytdOperating + ytdOf(nonOpIncome) - ytdOf(nonOpExpense)
  const ytdNet = ytdTotal - ytdOf(incomeTax)

  return {
    period,
    ytdFrom,
    current: {
      revenue,
      cost,
      taxSurcharge,
      selling,
      admin,
      rd,
      finance,
      investment,
      nonOpIncome,
      nonOpExpense,
      incomeTax,
      operatingProfit: fromCents(operatingProfit),
      totalProfit: fromCents(totalProfit),
      netProfit: fromCents(netProfit),
    },
    ytd: {
      operatingProfit: fromCents(ytdOperating),
      totalProfit: fromCents(ytdTotal),
      netProfit: fromCents(ytdNet),
    },
  }
}

async function computeYtd(ledgerId: string, from: string, to: string) {
  if (to < from) return new Map<string, number>()
  const lines = await loadVoucherLines(ledgerId, from, to, { excludeClosing: true })
  const m = new Map<string, number>()
  for (const l of lines) {
    const delta = l.direction === 'debit' ? toCents(l.amount) : -toCents(l.amount)
    m.set(l.accountCode, (m.get(l.accountCode) ?? 0) + delta)
  }
  return m
}

/**
 * 结账。
 *
 * 步骤:
 *   1. 该期间无未过账草稿(草案必须处理完,不能带着半成品结账);
 *   2. 计算结转前余额,生成"损益结转"凭证并过账(收入/费用 → 本年利润);
 *   3. 物化余额缓存 → 校验损益类余额归零;
 *   4. 写 fin_period_close(closed + profitAmount)、账套 currentPeriod 推进。
 */
export async function closePeriod(ledgerId: string, period: string, userId?: string | null) {
  const ledger = await getLedger(ledgerId)
  assertPeriod(period, 'period')
  if (period !== ledger.currentPeriod) {
    throw new AppError(
      `只能按顺序结账:当前待结期间是 ${ledger.currentPeriod},收到 ${period}`,
      409,
      'FIN_CLOSE_ORDER_VIOLATION',
    )
  }
  const drafts = await db
    .select({ id: finVoucher.id, no: finVoucher.voucherNo })
    .from(finVoucher)
    .where(
      and(
        eq(finVoucher.ledgerId, ledgerId),
        eq(finVoucher.period, period),
        eq(finVoucher.status, 'draft'),
        isNull(finVoucher.deletedAt),
      ),
    )
  if (drafts.length > 0) {
    throw new AppError(
      `该期间有 ${drafts.length} 张未过账凭证(${drafts.map((d) => d.no).join('、')}),请先过账或删除再结账`,
      409,
      'FIN_CLOSE_HAS_DRAFTS',
    )
  }

  const tbBefore = await computeTrialBalance(ledgerId, period)
  const accounts = await loadAccounts(ledgerId)
  const byCode = new Map(accounts.map((a) => [a.code, a]))
  const pnlRows = tbBefore.rows.filter((r) => {
    const cat = byCode.get(r.code)?.category
    return cat === 'revenue' || cat === 'expense'
  })

  let revenueCents = 0
  let expenseCents = 0
  const closeLines: Array<{
    accountCode: string
    direction: 'debit' | 'credit'
    amount: string
    summary: string
  }> = []
  for (const r of pnlRows) {
    const cat = byCode.get(r.code)!.category
    const debit = toCents(r.closingDebit)
    const credit = toCents(r.closingCredit)
    if (cat === 'revenue') {
      const amount = credit - debit
      if (amount === 0) continue
      revenueCents += amount
      if (amount > 0) {
        closeLines.push({
          accountCode: r.code,
          direction: 'debit',
          amount: fromCents(amount),
          summary: '期末结转',
        })
      } else {
        closeLines.push({
          accountCode: r.code,
          direction: 'credit',
          amount: fromCents(-amount),
          summary: '期末结转',
        })
      }
    } else {
      const amount = debit - credit
      if (amount === 0) continue
      expenseCents += amount
      if (amount > 0) {
        closeLines.push({
          accountCode: r.code,
          direction: 'credit',
          amount: fromCents(amount),
          summary: '期末结转',
        })
      } else {
        closeLines.push({
          accountCode: r.code,
          direction: 'debit',
          amount: fromCents(-amount),
          summary: '期末结转',
        })
      }
    }
  }

  let closingVoucherNo: string | null = null
  const netProfit = revenueCents - expenseCents
  if (closeLines.length > 0) {
    if (netProfit > 0) {
      closeLines.push({
        accountCode: '3103',
        direction: 'credit',
        amount: fromCents(netProfit),
        summary: '本期利润结转',
      })
    } else if (netProfit < 0) {
      closeLines.push({
        accountCode: '3103',
        direction: 'debit',
        amount: fromCents(-netProfit),
        summary: '本期亏损结转',
      })
    }
    const voucher = await createVoucher(
      ledgerId,
      {
        period,
        voucherDate: `${period}-${lastDayOf(period)}`,
        summary: `期末损益结转(${period})`,
        source: 'closing',
        sourceRef: `closing:${ledgerId}:${period}`,
        post: true,
        lines: closeLines,
      },
      userId,
    )
    closingVoucherNo = voucher.voucherNo
  }

  const tbAfter = await materializeBalances(ledgerId, period)
  const pnlLeak = tbAfter.rows.filter((r) => {
    const cat = byCode.get(r.code)?.category
    if (cat !== 'revenue' && cat !== 'expense') return false
    return toCents(r.closingDebit) !== 0 || toCents(r.closingCredit) !== 0
  })

  const countRows = await db
    .select({ n: finVoucher.id })
    .from(finVoucher)
    .where(
      and(
        eq(finVoucher.ledgerId, ledgerId),
        eq(finVoucher.period, period),
        eq(finVoucher.status, 'posted'),
        isNull(finVoucher.deletedAt),
      ),
    )

  await db.transaction(async (tx) => {
    await tx
      .insert(finPeriodClose)
      .values({
        ledgerId,
        period,
        status: 'closed',
        profitAmount: fromCents(netProfit),
        voucherCount: countRows.length,
        closedBy: userId ?? null,
        closedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [finPeriodClose.ledgerId, finPeriodClose.period],
        set: {
          status: 'closed',
          profitAmount: fromCents(netProfit),
          closedBy: userId ?? null,
          closedAt: new Date(),
          reopenedBy: null,
          reopenedAt: null,
          updatedAt: new Date(),
        },
      })
    await tx
      .update(finLedger)
      .set({ currentPeriod: nextPeriod(period), updatedAt: new Date() })
      .where(eq(finLedger.id, ledgerId))
  })

  return {
    period,
    nextPeriod: nextPeriod(period),
    closingVoucherNo,
    revenue: fromCents(revenueCents),
    expense: fromCents(expenseCents),
    netProfit: fromCents(netProfit),
    pnlResidue: pnlLeak.map((r) => `${r.code} ${r.name} 借${r.closingDebit}/贷${r.closingCredit}`),
    balanced: tbAfter.balanced,
  }
}

/**
 * 反结账:只允许撤销**最新**已结账期间。
 * 会软删该期间由系统生成的结转凭证,并把 currentPeriod 回退 —— 留痕在 close 表 reopenedBy/At。
 */
export async function reopenPeriod(ledgerId: string, period: string, userId?: string | null) {
  const ledger = await getLedger(ledgerId)
  assertPeriod(period, 'period')
  const [close] = await db
    .select()
    .from(finPeriodClose)
    .where(and(eq(finPeriodClose.ledgerId, ledgerId), eq(finPeriodClose.period, period)))
  if (!close || close.status !== 'closed') {
    throw new AppError(`期间 ${period} 未结账`, 409, 'FIN_PERIOD_NOT_CLOSED')
  }
  if (ledger.currentPeriod !== nextPeriod(period)) {
    throw new AppError(
      `只能反结账最新一期:当前待结期间是 ${ledger.currentPeriod},而 ${period} 的下一期是 ${nextPeriod(period)}`,
      409,
      'FIN_REOPEN_NOT_LATEST',
    )
  }
  await db.transaction(async (tx) => {
    await tx
      .update(finVoucher)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(finVoucher.ledgerId, ledgerId),
          eq(finVoucher.period, period),
          eq(finVoucher.source, 'closing'),
          isNull(finVoucher.deletedAt),
        ),
      )
    await tx
      .update(finPeriodClose)
      .set({
        status: 'open',
        profitAmount: '0.00',
        reopenedBy: userId ?? null,
        reopenedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(finPeriodClose.id, close.id))
    // 反结账 12 月必须同时撤销年结:年结凭证开在次年 1 月,不清掉就会留下
    // 「12 月已重开但 3103 已被转走」的断链。年结台账同步标记 reopened。
    if (period.endsWith('-12')) {
      const year = Number(period.slice(0, 4))
      await tx
        .update(finVoucher)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(
          and(
            eq(finVoucher.ledgerId, ledgerId),
            eq(finVoucher.sourceRef, `year-end:${ledgerId}:${year}`),
            isNull(finVoucher.deletedAt),
          ),
        )
      await tx
        .update(finYearEnd)
        .set({
          status: 'reopened',
          reopenedBy: userId ?? null,
          reopenedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(and(eq(finYearEnd.ledgerId, ledgerId), eq(finYearEnd.year, year)))
    }
    await tx
      .delete(finAccountBalance)
      .where(and(eq(finAccountBalance.ledgerId, ledgerId), eq(finAccountBalance.period, period)))
    await tx
      .update(finLedger)
      .set({ currentPeriod: period, updatedAt: new Date() })
      .where(eq(finLedger.id, ledgerId))
  })
  return { period, status: 'open', currentPeriod: period }
}

export async function getPeriodStatus(ledgerId: string) {
  const ledger = await getLedger(ledgerId)
  const rows = await db.select().from(finPeriodClose).where(eq(finPeriodClose.ledgerId, ledgerId))
  return {
    currentPeriod: ledger.currentPeriod,
    startPeriod: ledger.startPeriod,
    periods: rows
      .slice()
      .sort((a, b) => a.period.localeCompare(b.period))
      .map((r) => ({
        period: r.period,
        status: r.status,
        profitAmount: r.profitAmount,
        closedAt: r.closedAt,
      })),
  }
}

// 期间工具(assertPeriod/lastDayOf/nextPeriod/prevPeriod)的唯一实现已迁至 ./period.js,
// 本文件只 import,不再保留第二份 —— 两份实现必然漂移(如闰年/12 月边界)。
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
