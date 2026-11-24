// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 年结(2026-11-24 立)。
 *
 * 为什么不能把年结凭证开在 12 月:closePeriod 之后该期间已封账,任何写入都会被
 * FIN_PERIOD_CLOSED 拒绝。所以 3103 本年利润 → 3104 利润分配 的结转凭证开在
 * 次年 1 月 1 日(此时 3103 的期初余额就是上年年末余额,账务链条连续)。
 *
 * 次年 fin_opening_balance 不写:账务引擎的期初只在启用期间读一次,其余期间
 * 由"期初 + 已过账分录"滚出来。再写一份次年 opening 不会被计算,只会制造两套口径。
 * 需要的"年初数"以 openingSnapshot 冻结在本表,供导出/备查。
 */

import { and, eq, isNull } from 'drizzle-orm'

import { db } from '../../db/index.js'
import { finAccount, finLedger, finPeriodClose, finYearEnd } from '@ihui/database'
import { AppError } from '../../errors/AppError.js'
import { fromCents, toCents } from './money.js'
import { assertPeriod, nextPeriod } from './period.js'
import { computeTrialBalance } from './balance-service.js'
import { createVoucher } from './voucher-service.js'

async function loadLedger(ledgerId: string) {
  const [ledger] = await db
    .select()
    .from(finLedger)
    .where(and(eq(finLedger.id, ledgerId), isNull(finLedger.deletedAt)))
  if (!ledger) throw new AppError('账套不存在或已删除', 404, 'FIN_LEDGER_NOT_FOUND')
  return ledger
}

/** 年度参数必须是 2000~2100 的整数(防止把期间字符串直接塞进来) */
function assertYear(year: number) {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new AppError('year 必须是 2000~2100 的整数', 400, 'FIN_YEAR_INVALID')
  }
}

export async function getYearEnd(ledgerId: string, year: number) {
  const rows = await db
    .select()
    .from(finYearEnd)
    .where(and(eq(finYearEnd.ledgerId, ledgerId), eq(finYearEnd.year, year)))
  return rows[0] ?? null
}

export async function listYearEnds(ledgerId: string) {
  return db
    .select()
    .from(finYearEnd)
    .where(eq(finYearEnd.ledgerId, ledgerId))
    .orderBy(finYearEnd.year)
}

/**
 * 执行年结。
 *
 * 前置(硬闸,不做"尽量"):
 *   1. 12 月必须已结账;
 *   2. 次年 1 月必须未结账(否则凭证无处可开);
 *   3. 同一年度已年结 ⇒ 幂等返回既有记录,不重复开凭证。
 */
export async function closeYear(ledgerId: string, year: number, userId?: string | null) {
  const ledger = await loadLedger(ledgerId)
  assertYear(year)
  const dec = `${year}-12`
  const jan = nextPeriod(dec)
  assertPeriod(dec, 'period')

  const [decClose] = await db
    .select()
    .from(finPeriodClose)
    .where(and(eq(finPeriodClose.ledgerId, ledgerId), eq(finPeriodClose.period, dec)))
  if (!decClose || decClose.status !== 'closed') {
    throw new AppError(`年结前必须先结账 ${dec}`, 409, 'FIN_YEAR_END_DEC_NOT_CLOSED')
  }

  const [janClose] = await db
    .select()
    .from(finPeriodClose)
    .where(and(eq(finPeriodClose.ledgerId, ledgerId), eq(finPeriodClose.period, jan)))
  if (janClose?.status === 'closed') {
    throw new AppError(`次年 ${jan} 已结账,无法再落年结凭证`, 409, 'FIN_YEAR_END_JAN_CLOSED')
  }

  const existing = await getYearEnd(ledgerId, year)
  if (existing?.status === 'closed') {
    return { ...existing, idempotent: true }
  }

  const tbDec = await computeTrialBalance(ledgerId, dec)
  const chart = await db
    .select({ code: finAccount.code, name: finAccount.name, category: finAccount.category })
    .from(finAccount)
    .where(eq(finAccount.ledgerId, ledgerId))
  const catOf = new Map(chart.map((a) => [a.code, a.category]))

  const snapshotRows = tbDec.rows
    .filter((r) => {
      const cat = catOf.get(r.code)
      return cat !== 'revenue' && cat !== 'expense'
    })
    .map((r) => ({
      code: r.code,
      name: r.name,
      debit: r.closingDebit,
      credit: r.closingCredit,
    }))

  const tbJan = await computeTrialBalance(ledgerId, jan)
  const row = tbJan.rows.find((r) => r.code === '3103')
  const profitBalance = row ? toCents(row.openingDebit) - toCents(row.openingCredit) : 0
  const amount = Math.abs(profitBalance)

  let voucherId: string | null = null
  let voucherNo: string | null = null
  if (amount > 0) {
    const lines =
      profitBalance > 0
        ? [
            // 借余 = 累计亏损:冲平 3103,转入利润分配借方
            {
              accountCode: '3103',
              direction: 'credit' as const,
              amount: fromCents(amount),
              summary: '年结结转本年利润',
            },
            {
              accountCode: '3104',
              direction: 'debit' as const,
              amount: fromCents(amount),
              summary: '年结结转未分配利润',
            },
          ]
        : [
            // 贷余 = 累计盈利:借 3103,贷 3104
            {
              accountCode: '3103',
              direction: 'debit' as const,
              amount: fromCents(amount),
              summary: '年结结转本年利润',
            },
            {
              accountCode: '3104',
              direction: 'credit' as const,
              amount: fromCents(amount),
              summary: '年结结转未分配利润',
            },
          ]
    const voucher = await createVoucher(
      ledgerId,
      {
        period: jan,
        voucherDate: `${jan}-01`,
        summary: `年结:结转 ${year} 年度本年利润`,
        source: 'closing',
        sourceRef: `year-end:${ledgerId}:${year}`,
        post: true,
        lines,
      },
      userId,
    )
    voucherId = voucher.id
    voucherNo = voucher.voucherNo
  }

  const values = {
    ledgerId,
    year,
    status: 'closed' as const,
    profitBalance: fromCents(profitBalance),
    transferAmount: fromCents(amount),
    voucherId,
    voucherNo,
    openingSnapshot: {
      takenAt: new Date().toISOString(),
      period: jan,
      rows: snapshotRows,
    },
    closedBy: userId ?? null,
    closedAt: new Date(),
    reopenedBy: null,
    reopenedAt: null,
    updatedAt: new Date(),
  }

  const [record] = await db
    .insert(finYearEnd)
    .values(values)
    .onConflictDoUpdate({
      // 唯一键 (ledger, year):反结账后重跑原地复活,不新增副本
      target: [finYearEnd.ledgerId, finYearEnd.year],
      set: {
        status: values.status,
        profitBalance: values.profitBalance,
        transferAmount: values.transferAmount,
        voucherId: values.voucherId,
        voucherNo: values.voucherNo,
        openingSnapshot: values.openingSnapshot,
        closedBy: values.closedBy,
        closedAt: values.closedAt,
        reopenedBy: null,
        reopenedAt: null,
        updatedAt: values.updatedAt,
      },
    })
    .returning()

  return {
    ...record!,
    idempotent: false,
    currentPeriod: ledger.currentPeriod,
    snapshotCount: snapshotRows.length,
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
