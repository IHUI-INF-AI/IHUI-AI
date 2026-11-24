// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 申报取数(2026-11-24 立)。
 *
 * 补的是"账 → 表"最后一公里:此前 ai_tax_filing 与申报任务都靠人/模型传数,
 * 账套与发票台账里的数不会自己走到申报任务上。
 *
 * 口径纪律:
 *   · 每一个数都带 source(取自发票台账/账套余额/利润表),前端必须原样展示;
 *   · 取不到就抛明确错误,不回落 0 —— 0 是"真的没有",不是"没取到";
 *   · 个税(IIT)没有扣缴端接口,不在这里假装能算;返回 unsupported 并说明出路。
 */

import { and, eq, gte, isNull, lte } from 'drizzle-orm'

import { db } from '../../db/index.js'
import {
  finClient,
  finFilingTask,
  finInvoice,
  finLedger,
  finTaxProfile,
  hrPayrollItem,
  hrPayrollPeriod,
} from '@ihui/database'
import { AppError } from '../../errors/AppError.js'
import { fromCents, toCents } from './money.js'
import { buildIncomeStatement, computeTrialBalance } from './balance-service.js'

type PeriodKind = 'monthly' | 'quarterly' | 'annual'

interface PeriodInfo {
  kind: PeriodKind
  year: number
  start: string
  end: string
  monthCount: number
}

function parsePeriod(period: string): PeriodInfo {
  const monthly = /^(\d{4})-(\d{2})$/.exec(period)
  if (monthly) {
    return { kind: 'monthly', year: Number(monthly[1]), start: period, end: period, monthCount: 1 }
  }
  const quarterly = /^(\d{4})-Q([1-4])$/.exec(period)
  if (quarterly) {
    const y = Number(quarterly[1])
    const q = Number(quarterly[2])
    const startMonth = (q - 1) * 3 + 1
    const endMonth = q * 3
    return {
      kind: 'quarterly',
      year: y,
      start: `${y}-${String(startMonth).padStart(2, '0')}`,
      end: `${y}-${String(endMonth).padStart(2, '0')}`,
      monthCount: 3,
    }
  }
  const annual = /^(\d{4})$/.exec(period)
  if (annual) {
    const y = Number(annual[1])
    return { kind: 'annual', year: y, start: `${y}-01`, end: `${y}-12`, monthCount: 12 }
  }
  throw new AppError(
    `period 形态非法:${period}(应为 YYYY-MM / YYYY-Qn / YYYY)`,
    400,
    'FIN_FILING_PERIOD_INVALID',
  )
}

interface InvoiceTotals {
  salesCents: number
  outputTaxCents: number
  purchaseCents: number
  inputTaxCents: number
  deductibleInputTaxCents: number
  invoiceCount: number
}

async function invoiceTotals(ledgerId: string, info: PeriodInfo): Promise<InvoiceTotals> {
  const rows = await db
    .select({
      direction: finInvoice.direction,
      amount: finInvoice.amountExclTax,
      tax: finInvoice.taxAmount,
      deductible: finInvoice.deductible,
      status: finInvoice.status,
    })
    .from(finInvoice)
    .where(
      and(
        eq(finInvoice.ledgerId, ledgerId),
        isNull(finInvoice.deletedAt),
        gte(finInvoice.period, info.start),
        lte(finInvoice.period, info.end),
      ),
    )
  const totals: InvoiceTotals = {
    salesCents: 0,
    outputTaxCents: 0,
    purchaseCents: 0,
    inputTaxCents: 0,
    deductibleInputTaxCents: 0,
    invoiceCount: 0,
  }
  for (const r of rows) {
    if (r.status === 'voided') continue
    totals.invoiceCount += 1
    if (r.direction === 'output') {
      totals.salesCents += toCents(r.amount)
      totals.outputTaxCents += toCents(r.tax)
    } else {
      totals.purchaseCents += toCents(r.amount)
      totals.inputTaxCents += toCents(r.tax)
      if (r.deductible && (r.status === 'checked' || r.status === 'certified')) {
        totals.deductibleInputTaxCents += toCents(r.tax)
      }
    }
  }
  return totals
}

/** 票上没有数时,退到账套应交增值税明细科目(222101 进项 / 222102 销项)。 */
async function vatFromLedger(ledgerId: string, endMonth: string) {
  const tb = await computeTrialBalance(ledgerId, endMonth)
  const output = tb.rows.find((r) => r.code === '222102')
  const input = tb.rows.find((r) => r.code === '222101')
  return {
    outputCents: output ? toCents(output.periodCredit) - toCents(output.periodDebit) : 0,
    inputCents: input ? toCents(input.periodDebit) - toCents(input.periodCredit) : 0,
  }
}

interface Derivation {
  taxableBase: string
  taxAmount: string
  sources: string[]
  warnings: string[]
}

async function deriveVat(
  ledgerId: string,
  info: PeriodInfo,
  taxpayerType: 'general' | 'small',
  rate: number,
  cycle: string,
): Promise<Derivation> {
  const totals = await invoiceTotals(ledgerId, info)
  const warnings: string[] = []
  const sources: string[] = [`发票台账 ${info.start}~${info.end} 共 ${totals.invoiceCount} 张`]
  let sales = totals.salesCents
  let outputTax = totals.outputTaxCents
  let inputTax = totals.deductibleInputTaxCents

  if (totals.invoiceCount === 0) {
    const fb = await vatFromLedger(ledgerId, info.end)
    sales = 0
    outputTax = fallbackGuard(fb.outputCents)
    inputTax = fallbackGuard(fb.inputCents)
    warnings.push('发票台账本期为空,销项/进项退到账套 222102/222101 明细科目发生额')
    sources.push('账套应交增值税明细科目')
  }

  let payable = 0
  if (taxpayerType === 'general') {
    payable = Math.max(0, outputTax - inputTax)
    if (inputTax > outputTax)
      warnings.push(`进项大于销项,留抵 ${fromCents(inputTax - outputTax)} 结转下期`)
  } else {
    const threshold = cycle === 'quarterly' ? 300_000 * 100 : 100_000 * 100 // 季度 30 万 / 月度 10 万(分)
    if (sales <= threshold) {
      payable = 0
      warnings.push(`小规模销售额 ${fromCents(sales)} 未超起征点,本期免征增值税`)
    } else {
      payable = Math.round(sales * (rate > 0 ? rate : 0.03))
    }
  }

  return {
    taxableBase: fromCents(sales),
    taxAmount: fromCents(payable),
    sources,
    warnings,
  }
}

/** 账套退化取数只接受非负,负值说明科目被反用,宁可报 0 并给警告由人核 */
function fallbackGuard(cents: number) {
  return cents > 0 ? cents : 0
}

async function deriveSurtax(clientId: string, period: string, taxpayerType: 'general' | 'small') {
  const [vatTask] = await db
    .select({ taxAmount: finFilingTask.taxAmount })
    .from(finFilingTask)
    .where(
      and(
        eq(finFilingTask.clientId, clientId),
        eq(finFilingTask.taxType, 'VAT'),
        eq(finFilingTask.period, period),
      ),
    )
  if (!vatTask || vatTask.taxAmount === null) {
    throw new AppError(
      '附加税取数需要同客户同期间的增值税申报任务已算出税额(先跑一次增值税取数)',
      409,
      'FIN_DERIVE_SURTAX_NEEDS_VAT',
    )
  }
  const base = toCents(vatTask.taxAmount)
  const factor = taxpayerType === 'small' ? 0.06 : 0.12 // 7+3+2;小规模/小微按六税两费减半
  return {
    taxableBase: fromCents(base),
    taxAmount: fromCents(Math.round(base * factor)),
    sources: ['同客户同期间增值税申报任务 taxAmount'],
    warnings: [
      `城建税按 7% + 教育费附加 3% + 地方教育附加 2%${taxpayerType === 'small' ? '(小规模减半)' : ''}`,
    ],
  }
}

async function deriveStamp(
  ledgerId: string,
  info: PeriodInfo,
  taxpayerType: 'general' | 'small',
  rate: number,
) {
  const totals = await invoiceTotals(ledgerId, info)
  if (totals.invoiceCount === 0) {
    throw new AppError(
      '印花税取数需要本期发票台账(购销合同金额)',
      409,
      'FIN_DERIVE_STAMP_NO_INVOICE',
    )
  }
  const base = totals.salesCents + totals.purchaseCents
  const effective = rate > 0 ? rate : 0.0003
  const factor = taxpayerType === 'small' ? 0.5 : 1
  return {
    taxableBase: fromCents(base),
    taxAmount: fromCents(Math.round(base * effective * factor)),
    sources: [
      `发票台账销项 ${fromCents(totals.salesCents)} + 进项 ${fromCents(totals.purchaseCents)}`,
    ],
    warnings: ['按买卖合同 0.03% 简化口径计算;借款/租赁/产权转移书据等税目需人工复核'],
  }
}

async function deriveCit(
  ledgerId: string,
  info: PeriodInfo,
  collectionMethod: string,
  taxpayerType: 'general' | 'small',
  rate: number,
  deemedRate: number | null,
) {
  const endMonth = info.end
  const pnl = await buildIncomeStatement(ledgerId, endMonth)
  const revenue = toCents(pnl.current.revenue.ytd)
  const profit = toCents(pnl.ytd.totalProfit)
  const warnings = [
    '企业所得税取数用利润表本年累计数,未做纳税调整(业务招待费/广告费/罚款等需人工调增调减)',
  ]
  let base = 0
  if (collectionMethod === 'deemed') {
    if (!deemedRate || deemedRate <= 0) {
      throw new AppError('核定征收缺少应税所得率(deemedRate)', 409, 'FIN_DERIVE_CIT_NO_DEEMED_RATE')
    }
    base = Math.max(0, Math.round(revenue * deemedRate))
    warnings.push(
      `核定征收:营业收入 ${fromCents(revenue)} × 应税所得率 ${(deemedRate * 100).toFixed(2)}%`,
    )
  } else {
    base = Math.max(0, profit)
    if (profit <= 0) warnings.push('本年累计利润为负,应纳税所得额按 0')
  }
  const effective = rate > 0 ? rate : taxpayerType === 'small' ? 0.05 : 0.25
  return {
    taxableBase: fromCents(base),
    taxAmount: fromCents(Math.round(base * effective)),
    sources: [
      `利润表 ${pnl.ytdFrom}~${endMonth} 本年累计(营业收入 ${fromCents(revenue)}/利润总额 ${fromCents(profit)})`,
    ],
    warnings,
  }
}

/**
 * 个税(IIT)从 HR 工资批次确定性回流(2026-11-24 二波,补 P1#5 末段串联)。
 * 口径:只认 status = approved/paid 的当期批次(未批工资不算税 base);
 * 应纳税额 = 逐人 incomeTax(累计预扣法在算薪引擎已实现,这里只做汇总,不复算税率表)。
 * 纯聚合函数单测钉死;没有已批批次 ⇒ fail-closed,指回算薪链路而不猜数。
 */
export function sumPayrollTaxRows(
  rows: ReadonlyArray<{ taxableIncome: string; incomeTax: string }>,
): { baseCents: number; taxCents: number; headcount: number } {
  let baseCents = 0
  let taxCents = 0
  for (const r of rows) {
    baseCents += toCents(r.taxableIncome)
    taxCents += toCents(r.incomeTax)
  }
  return { baseCents, taxCents, headcount: rows.length }
}

async function deriveIit(period: string) {
  const [periodRow] = await db
    .select()
    .from(hrPayrollPeriod)
    .where(eq(hrPayrollPeriod.periodMonth, period))
  if (!periodRow || (periodRow.status !== 'approved' && periodRow.status !== 'paid')) {
    throw new AppError(
      `个税取数需要 ${period} 的工资批次处于已批准/已发放状态(当前:${periodRow ? periodRow.status : '无批次'});请先跑完算薪与复核再取数`,
      409,
      'FIN_DERIVE_IIT_NO_PAYROLL',
    )
  }
  const rows = await db
    .select({
      taxableIncome: hrPayrollItem.taxableIncome,
      incomeTax: hrPayrollItem.incomeTax,
      employeeId: hrPayrollItem.employeeId,
    })
    .from(hrPayrollItem)
    .where(eq(hrPayrollItem.periodId, periodRow.id))
  const agg = sumPayrollTaxRows(rows)
  if (agg.headcount === 0) {
    throw new AppError(`${period} 工资批次已批准但没有明细行,无法取数`, 409, 'FIN_DERIVE_IIT_EMPTY')
  }
  return {
    taxableBase: fromCents(Math.max(0, agg.baseCents)),
    taxAmount: fromCents(Math.max(0, agg.taxCents)),
    sources: [`HR 工资批次 ${period}(${periodRow.status})共 ${agg.headcount} 人,计税依据/税额逐人汇总`],
    warnings: [
      '汇总数与扣缴端明细可能有个别差异(离职补发/更正申报),正式提交前按人比对;申报提交仍须人工点提交闸',
    ],
  }
}

/**
 * 给申报任务取数(幂等:可反复跑,每次按当前账/票重算)。
 * 已提交/已受理的任务拒绝重算 —— 否则会把"已经报出去的数"改掉。
 */
export async function deriveFilingTask(taskId: string, _userId?: string | null) {
  const [task] = await db.select().from(finFilingTask).where(eq(finFilingTask.id, taskId))
  if (!task) throw new AppError('申报任务不存在', 404, 'FIN_FILING_TASK_NOT_FOUND')
  if (task.status === 'submitted' || task.status === 'accepted') {
    throw new AppError(
      '任务已提交/已受理,拒绝重算(防止改掉已报出的数)',
      409,
      'FIN_DERIVE_TASK_LOCKED',
    )
  }
  const [profile] = await db
    .select()
    .from(finTaxProfile)
    .where(eq(finTaxProfile.id, task.taxProfileId))
  if (!profile) throw new AppError('税种核定不存在', 404, 'FIN_TAX_PROFILE_NOT_FOUND')
  const [client] = await db.select().from(finClient).where(eq(finClient.id, task.clientId))
  if (!client) throw new AppError('客户不存在', 404, 'FIN_CLIENT_NOT_FOUND')
  // IIT 从 HR 工资批次回流,不依赖账套;其余税种的取数器都要账套
  if (!task.ledgerId && task.taxType !== 'IIT') {
    throw new AppError('申报任务未绑定账套,无法取数(先 bind-ledger)', 409, 'FIN_DERIVE_NO_LEDGER')
  }
  if (task.ledgerId) {
    const [ledger] = await db.select().from(finLedger).where(eq(finLedger.id, task.ledgerId))
    if (!ledger) throw new AppError('账套不存在', 404, 'FIN_LEDGER_NOT_FOUND')
  }

  const info = parsePeriod(task.period)
  const taxpayerType = (profile.taxpayerType ?? client.taxpayerType) as 'general' | 'small'
  const rate = Number(profile.rate)
  const deemedRate = profile.deemedRate === null ? null : Number(profile.deemedRate)

  let result: {
    taxableBase: string
    taxAmount: string
    sources: string[]
    warnings: string[]
  } | null = null

  switch (task.taxType) {
    case 'VAT': {
      const r = await deriveVat(task.ledgerId!, info, taxpayerType, rate, profile.filingCycle)
      result = {
        taxableBase: r.taxableBase,
        taxAmount: r.taxAmount,
        sources: r.sources,
        warnings: r.warnings,
      }
      break
    }
    case 'SURTAX': {
      const r = await deriveSurtax(task.clientId, task.period, taxpayerType)
      result = r
      break
    }
    case 'STAMP': {
      const r = await deriveStamp(task.ledgerId!, info, taxpayerType, rate)
      result = r
      break
    }
    case 'CIT': {
      const r = await deriveCit(
        task.ledgerId!,
        info,
        profile.collectionMethod,
        taxpayerType,
        rate,
        deemedRate,
      )
      result = r
      break
    }
    case 'IIT': {
      const r = await deriveIit(task.period)
      result = r
      break
    }

    default:
      throw new AppError(
        `${task.taxType} 暂无确定性取数器(房产税/土地使用税/车船税/消费税/文化事业费按台账或手工填)`,
        409,
        'FIN_DERIVE_UNSUPPORTED',
      )
  }

  const [updated] = await db
    .update(finFilingTask)
    .set({
      taxableBase: result.taxableBase,
      taxAmount: result.taxAmount,
      status: 'computed',
      updatedAt: new Date(),
    })
    .where(eq(finFilingTask.id, taskId))
    .returning()

  return {
    task: updated!,
    derivation: {
      ...result,
      period: task.period,
      taxType: task.taxType,
      ledgerId: task.ledgerId ?? null,
      computedAt: new Date().toISOString(),
    },
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
