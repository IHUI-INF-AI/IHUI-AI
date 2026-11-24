// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 年终奖单独计税 + 经济补偿金测算(2026-11-24 补口)。
 *
 * 为什么要独立成文:此前系统只有"工资薪金累计预扣"一条口径,
 *   · 年终奖只能由人在表单里写死税额(工具层无参数、无法复算);
 *   · 离职经济补偿完全没有测算,离职结算只走交接清单。
 * 两件事的政策口径与月度工资不同,混进 hr-payroll 会让"算薪可复算"这条铁律破功。
 *
 * 口径(全部金额先转整数分再算,出口再转元,零浮点):
 *   1) 全年一次性奖金(单独计税):应纳税额 = 奖金 × 适用税率 − 速算扣除数,
 *      税率按 奖金 ÷ 12 落在**月度税率表**哪一档确定(财税〔2018〕164 号)。
 *   2) 经济补偿:月工资高于当地上年度职工月平均工资 3 倍的,按 3 倍封顶且年限≤12 年;
 *      补偿总额在当地上年职工平均工资 3 倍(即月均 ×36)以内免征个税;
 *      超过部分以"工作年限"分摊为月工资薪金,按月度税率表计税后再乘回年限(国税发〔1999〕192 号口径)。
 *
 * 所有"取不到的输入"一律抛错点名,绝不猜社平工资或年限。
 */
import { and, desc, eq } from 'drizzle-orm'

import { db } from '../db/index.js'
import { hrBonusPayment, hrEmployee, hrSeveranceRecord } from '@ihui/database'
import { AppError } from '../errors/AppError.js'

function toCents(yuan: number, field: string): number {
  if (!Number.isFinite(yuan)) throw new AppError(`${field} 不是有效金额`, 400, 'HR_AMOUNT_INVALID')
  return Math.round(yuan * 100)
}

function fromCents(cents: number): number {
  return Math.round(cents) / 100
}

function yuan(value: string | number | null | undefined, field: string): number {
  if (value === null || value === undefined || value === '') {
    throw new AppError(`缺少 ${field},拒绝按 0 计算`, 400, 'HR_FIELD_REQUIRED')
  }
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) throw new AppError(`${field} 不是有效数字`, 400, 'HR_AMOUNT_INVALID')
  return n
}

/**
 * 月度税率表(年终奖单独计税与经济补偿分摊共用):
 * [上限(分), 税率, 速算扣除数(分)]。
 * 上限是按"月应纳税所得额"口径的 3000/12000/25000/35000/55000/80000 元。
 */
const MONTHLY_BRACKETS: readonly (readonly [number, number, number])[] = [
  [300_000, 0.03, 0],
  [1_200_000, 0.1, 21_000],
  [2_500_000, 0.2, 141_000],
  [3_500_000, 0.25, 266_000],
  [5_500_000, 0.3, 441_000],
  [8_000_000, 0.35, 716_000],
  [Number.POSITIVE_INFINITY, 0.45, 1_516_000],
]

function monthlyBracket(cents: number): { rate: number; quickDeductionCents: number } {
  for (const [cap, rate, quick] of MONTHLY_BRACKETS) {
    if (cents <= cap) return { rate, quickDeductionCents: quick }
  }
  return { rate: 0.45, quickDeductionCents: 1_516_000 }
}

export interface AnnualBonusTaxResult {
  bonusAmount: number
  /** 用于定档的月均摊额(奖金 ÷ 12) */
  monthlyEquivalent: number
  rate: number
  quickDeduction: number
  taxAmount: number
  netAmount: number
  policy: string
}

/** 全年一次性奖金单独计税。 */
export function calcAnnualBonusTax(bonusYuan: number): AnnualBonusTaxResult {
  const cents = toCents(bonusYuan, 'bonusAmount')
  if (cents <= 0) throw new AppError('奖金必须大于 0', 400, 'HR_BONUS_AMOUNT_INVALID')
  const monthlyEquivalentCents = Math.round(cents / 12)
  const { rate, quickDeductionCents } = monthlyBracket(monthlyEquivalentCents)
  const taxCents = Math.max(0, Math.round(cents * rate) - quickDeductionCents)
  return {
    bonusAmount: fromCents(cents),
    monthlyEquivalent: fromCents(monthlyEquivalentCents),
    rate,
    quickDeduction: fromCents(quickDeductionCents),
    taxAmount: fromCents(taxCents),
    netAmount: fromCents(cents - taxCents),
    policy: '财税〔2018〕164号:全年一次性奖金单独计税,按奖金÷12 定月度税率档',
  }
}

export interface SeveranceCalcInput {
  /** 入职日期 YYYY-MM-DD */
  hireDate: string
  /** 最后工作日 YYYY-MM-DD */
  lastWorkDate: string
  /** 离职前 12 个月平均工资(元) */
  monthlyAvgWage: number
  /** 当地上年度职工月平均工资(元) */
  localAvgMonthlyWage: number
}

export interface SeveranceCalcResult {
  yearsOfService: number
  /** 未封顶的协商年限(满 1 年 1 个月,满 6 个月不满 1 年按 1,不满 6 个月按 0.5) */
  rawYears: number
  capped: boolean
  effectiveMonthlyWage: number
  compensationAmount: number
  exemptAmount: number
  taxableExcess: number
  /** 应税部分分摊到的月数(用于税率定档) */
  spreadMonths: number
  rate: number
  quickDeduction: number
  taxAmount: number
  netAmount: number
  policy: string
  warnings: string[]
}

/** 按入职/离职日期算补偿年限(按月计,不按日历天数)。 */
export function serviceYears(
  hireDate: string,
  lastWorkDate: string,
): { rawYears: number; months: number } {
  const hire = new Date(`${hireDate}T00:00:00Z`)
  const last = new Date(`${lastWorkDate}T00:00:00Z`)
  if (Number.isNaN(hire.getTime()) || Number.isNaN(last.getTime())) {
    throw new AppError('入职/离职日期格式必须是 YYYY-MM-DD', 400, 'HR_DATE_INVALID')
  }
  if (last < hire) throw new AppError('最后工作日早于入职日期', 400, 'HR_DATE_ORDER_INVALID')
  let months =
    (last.getUTCFullYear() - hire.getUTCFullYear()) * 12 + (last.getUTCMonth() - hire.getUTCMonth())
  if (last.getUTCDate() < hire.getUTCDate()) months -= 1
  if (months < 0) months = 0
  const fullYears = Math.floor(months / 12)
  const restMonths = months % 12
  const rawYears = fullYears + (restMonths >= 6 ? 1 : restMonths > 0 ? 0.5 : 0)
  return { rawYears, months }
}

/** 经济补偿金测算(含免税额度与个税)。 */
export function calcSeverance(input: SeveranceCalcInput): SeveranceCalcResult {
  const monthlyAvgWage = yuan(input.monthlyAvgWage, 'monthlyAvgWage')
  const localAvgMonthlyWage = yuan(input.localAvgMonthlyWage, 'localAvgMonthlyWage')
  if (monthlyAvgWage <= 0) throw new AppError('月平均工资必须大于 0', 400, 'HR_WAGE_INVALID')
  if (localAvgMonthlyWage <= 0) {
    throw new AppError('当地社平工资必须大于 0(请在社保配置维护)', 400, 'HR_LOCAL_WAGE_INVALID')
  }

  const yearsInfo = serviceYears(input.hireDate, input.lastWorkDate)
  const rawYears = yearsInfo.rawYears
  if (rawYears <= 0) {
    throw new AppError('工作年限不足 1 个月,不产生经济补偿', 400, 'HR_SEVERANCE_NO_SERVICE')
  }

  const capWage = localAvgMonthlyWage * 3
  const capped = monthlyAvgWage > capWage
  const effectiveMonthlyWage = capped ? capWage : monthlyAvgWage
  const effectiveYears = capped ? Math.min(rawYears, 12) : rawYears
  const warnings: string[] = []
  if (capped) warnings.push('月工资高于当地社平 3 倍,已按 3 倍封顶且年限按 12 年封顶')
  if (!capped && rawYears > 12) warnings.push('未触发 3 倍封顶,年限不封顶(按实际年限计算)')

  const compensationCents = Math.round(
    toCents(effectiveMonthlyWage, 'effectiveWage') * effectiveYears,
  )
  const exemptCents = Math.round(toCents(localAvgMonthlyWage, 'localAvgMonthlyWage') * 36)
  const taxableExcessCents = Math.max(0, compensationCents - exemptCents)
  const spreadMonths = Math.min(12, Math.max(1, Math.ceil(effectiveYears)))
  const perMonthCents = Math.round(taxableExcessCents / spreadMonths)
  const { rate, quickDeductionCents } = monthlyBracket(perMonthCents)
  const taxCents =
    Math.max(0, Math.round(perMonthCents * rate) - quickDeductionCents) * spreadMonths

  return {
    yearsOfService: effectiveYears,
    rawYears,
    capped,
    effectiveMonthlyWage: fromCents(toCents(effectiveMonthlyWage, 'effectiveWage')),
    compensationAmount: fromCents(compensationCents),
    exemptAmount: fromCents(Math.min(compensationCents, exemptCents)),
    taxableExcess: fromCents(taxableExcessCents),
    spreadMonths,
    rate,
    quickDeduction: fromCents(quickDeductionCents),
    taxAmount: fromCents(taxCents),
    netAmount: fromCents(compensationCents - taxCents),
    policy:
      '财税〔2018〕164号:补偿收入在当地上年职工平均工资 3 倍以内免征;超过部分按工作年限分摊为月工资薪金计征',
    warnings,
  }
}

// ── 持久化 ────────────────────────────────────────────────────────────────

export async function createBonusPayment(input: {
  employeeId: string
  periodMonth: string
  bonusType?: string
  bonusAmount: number
  taxMethod?: 'separate' | 'merged'
  createdBy?: string | null
}) {
  if (!/^\d{4}-\d{2}$/.test(input.periodMonth)) {
    throw new AppError('periodMonth 必须是 YYYY-MM', 400, 'HR_PERIOD_INVALID')
  }
  const [emp] = await db
    .select({ id: hrEmployee.id, status: hrEmployee.status })
    .from(hrEmployee)
    .where(eq(hrEmployee.id, input.employeeId))
  if (!emp) throw new AppError('员工不存在', 404, 'HR_EMPLOYEE_NOT_FOUND')
  if (emp.status === 'left') throw new AppError('离职员工不发放年终奖', 400, 'HR_EMPLOYEE_LEFT')

  const method = input.taxMethod ?? 'separate'
  if (method === 'merged') {
    throw new AppError(
      '并入综合所得由算薪累计预扣处理,本接口只受理单独计税',
      400,
      'HR_BONUS_METHOD_UNSUPPORTED',
    )
  }
  const result = calcAnnualBonusTax(input.bonusAmount)
  const [row] = await db
    .insert(hrBonusPayment)
    .values({
      employeeId: input.employeeId,
      periodMonth: input.periodMonth,
      bonusType: input.bonusType ?? 'annual',
      bonusAmount: result.bonusAmount.toFixed(2),
      taxMethod: 'separate',
      taxableAmount: result.bonusAmount.toFixed(2),
      taxAmount: result.taxAmount.toFixed(2),
      netAmount: result.netAmount.toFixed(2),
      calcDetail: result as unknown as Record<string, unknown>,
      createdBy: input.createdBy ?? null,
    })
    .returning()
  return row
}

export async function listBonusPayments(params: { periodMonth?: string; employeeId?: string }) {
  const conds = []
  if (params.periodMonth) conds.push(eq(hrBonusPayment.periodMonth, params.periodMonth))
  if (params.employeeId) conds.push(eq(hrBonusPayment.employeeId, params.employeeId))
  return db
    .select()
    .from(hrBonusPayment)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(hrBonusPayment.createdAt))
    .limit(200)
}

export async function createSeveranceRecord(input: {
  employeeId: string
  resignationId?: string | null
  hireDate?: string
  lastWorkDate?: string
  monthlyAvgWage: number
  localAvgMonthlyWage: number
  createdBy?: string | null
}) {
  const [emp] = await db
    .select({ id: hrEmployee.id, hireDate: hrEmployee.hireDate, name: hrEmployee.name })
    .from(hrEmployee)
    .where(eq(hrEmployee.id, input.employeeId))
  if (!emp) throw new AppError('员工不存在', 404, 'HR_EMPLOYEE_NOT_FOUND')
  const hireDate = input.hireDate ?? emp.hireDate
  if (!hireDate) throw new AppError('缺少入职日期,请补录后再测算', 400, 'HR_HIRE_DATE_REQUIRED')
  const lastWorkDate = input.lastWorkDate
  if (!lastWorkDate) throw new AppError('缺少最后工作日', 400, 'HR_LAST_WORK_DATE_REQUIRED')

  const result = calcSeverance({
    hireDate,
    lastWorkDate,
    monthlyAvgWage: input.monthlyAvgWage,
    localAvgMonthlyWage: input.localAvgMonthlyWage,
  })
  const [row] = await db
    .insert(hrSeveranceRecord)
    .values({
      employeeId: input.employeeId,
      resignationId: input.resignationId ?? null,
      yearsOfService: result.yearsOfService.toFixed(2),
      monthlyAvgWage: input.monthlyAvgWage.toFixed(2),
      localAvgMonthlyWage: input.localAvgMonthlyWage.toFixed(2),
      capped: result.capped,
      compensationAmount: result.compensationAmount.toFixed(2),
      exemptAmount: result.exemptAmount.toFixed(2),
      taxableExcess: result.taxableExcess.toFixed(2),
      taxAmount: result.taxAmount.toFixed(2),
      netAmount: result.netAmount.toFixed(2),
      calcDetail: result as unknown as Record<string, unknown>,
      createdBy: input.createdBy ?? null,
    })
    .returning()
  return { record: row, calc: result }
}

export async function listSeveranceRecords(params: { employeeId?: string }) {
  return db
    .select()
    .from(hrSeveranceRecord)
    .where(params.employeeId ? eq(hrSeveranceRecord.employeeId, params.employeeId) : undefined)
    .orderBy(desc(hrSeveranceRecord.createdAt))
    .limit(200)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
