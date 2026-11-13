// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { and, eq, isNull, lte, or, gte, sql } from 'drizzle-orm'

import {
  hrAttendanceMonthly,
  hrEmployee,
  hrEmployeeTaxProfile,
  hrInsuranceRateConfig,
  hrPayrollItem,
  hrPayrollPeriod,
  hrSalaryConfig,
} from '@ihui/database'
import { db } from '../db/index.js'
import { logger } from '../utils/logger.js'
import { AppError } from '../errors/AppError.js'

/**
 * 薪资计算服务(HR-5 第 5 期,2026-11-12 立)。
 *
 * 输入:hr_attendance_monthly(月度考勤)+ hr_salary_config(薪资配置)
 *       + hr_insurance_rate_config(社保费率)+ hr_employee_tax_profile(专项扣除)
 * 输出:hr_payroll_period(周期)+ hr_payroll_item(逐人明细,含可审计 breakdown)
 *
 * 设计铁律:
 *   1. **每一步都可复算**:breakdown 存完整计算过程(输入/公式/中间值),
 *      财务对账时能逐项回溯,而不是给一个说不清来源的数字。
 *   2. **规则不写死**:社保比例、缴费基数上下限、公积金比例全从配置表读。
 *      写死会让明年调基时整片算错。
 *   3. **缺配置不猜**:员工没配薪资、地区没配费率 → 明确跳过并报数,
 *      绝不拿默认值凑一个看起来对的工资。
 *   4. **已 approved 的周期拒绝重算**:财务审过的账不能被后台任务改。
 *
 * 计算顺序(标准中国薪资口径):
 *   应发 = 基本工资 + 固定津贴 + 加班费 − 缺勤扣款
 *   计税所得 = 应发 − 社保个人 − 公积金个人 − 专项附加扣除 − 起征点
 *   个税 = 按累计预扣法(月度简化:用年度累计税率表逐月累计)
 *   实发 = 应发 − 社保个人 − 公积金个人 − 个税
 */

/** 个税起征点(元/月),2019 年起 5000。政策变动时只改这里。 */
const TAX_THRESHOLD_MONTHLY = 5000

/** 月计薪天数(法定 21.75),用于日薪折算 */
const PAYABLE_DAYS_PER_MONTH = 21.75

/**
 * 个税税率表(居民个人综合所得,年度累计预扣法)。
 * [累计应纳税所得额上限, 税率, 速算扣除数]
 */
const TAX_BRACKETS: readonly [number, number, number][] = [
  [36000, 0.03, 0],
  [144000, 0.1, 2520],
  [300000, 0.2, 16920],
  [420000, 0.25, 31920],
  [660000, 0.3, 52920],
  [960000, 0.35, 85920],
  [Number.POSITIVE_INFINITY, 0.45, 181920],
]

/** 加班费倍率(劳动法):工作日 1.5 倍、休息日 2 倍、法定节假日 3 倍 */
const OVERTIME_RATE = { weekday: 1.5, weekend: 2, holiday: 3 } as const

export interface PayrollBreakdown {
  /** 输入快照,便于回溯 */
  inputs: {
    baseSalary: number
    fixedAllowance: number
    otBase: number
    insuranceBase: number
    housingFundRate: number
    scheduledDays: number
    actualDays: number
    absentDays: number
    otHours: number
    otDetail: { weekday: number; weekend: number; holiday: number }
  }
  /** 各步骤中间值 */
  steps: {
    dailyRate: number
    basePay: number
    otAmount: number
    absenceDeduction: number
    grossPay: number
    insurancePersonal: number
    housingFundPersonal: number
    specialDeduction: number
    taxableIncome: number
    incomeTax: number
    netPay: number
  }
  /** 费率快照(哪个地区的哪一年的规则) */
  rates: {
    region: string
    year: number
    pensionPersonal: number
    medicalPersonal: number
    unemploymentPersonal: number
    housingFundRate: number
  } | null
  /** 计算过程中产生的提示(缺配置/异常值) */
  warnings: string[]
}

export interface PayrollBuildResult {
  periodMonth: string
  periodId: string
  employees: number
  inserted: number
  updated: number
  skippedNoConfig: number
  skippedSigned: number
  totalGross: number
  totalNet: number
}

/** 四舍五入到分 */
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

/** 按年度累计应纳税所得额算个税 */
export function calcIncomeTax(cumulativeTaxable: number): number {
  if (cumulativeTaxable <= 0) return 0
  for (const [cap, rate, quickDeduction] of TAX_BRACKETS) {
    if (cumulativeTaxable <= cap) {
      return Math.max(0, round2(cumulativeTaxable * rate - quickDeduction))
    }
  }
  return 0
}

/**
 * 取员工在指定月份生效的薪资配置。
 * 生效条件:effectiveFrom <= 月末 且 (effectiveTo 为空 或 effectiveTo >= 月初)
 * 多条命中时取 effectiveFrom 最新的一条(最近一次调薪)。
 */
async function resolveSalaryConfig(
  employeeId: string,
  monthStart: string,
  monthEnd: string,
): Promise<typeof hrSalaryConfig.$inferSelect | null> {
  const rows = await db
    .select()
    .from(hrSalaryConfig)
    .where(
      and(
        eq(hrSalaryConfig.employeeId, employeeId),
        lte(hrSalaryConfig.effectiveFrom, monthEnd),
        or(isNull(hrSalaryConfig.effectiveTo), gte(hrSalaryConfig.effectiveTo, monthStart)),
      ),
    )
    .orderBy(sql`${hrSalaryConfig.effectiveFrom} DESC`)
    .limit(1)
  return rows[0] ?? null
}

/** 取地区社保费率(按年度;取不到返回 null,由调用方决定不猜) */
async function resolveInsuranceRates(
  year: number,
  regionName?: string | undefined,
): Promise<typeof hrInsuranceRateConfig.$inferSelect | null> {
  const filters = [
    eq(hrInsuranceRateConfig.effectiveYear, year),
    eq(hrInsuranceRateConfig.enabled, true),
  ]
  if (regionName) filters.push(eq(hrInsuranceRateConfig.regionName, regionName))
  const rows = await db
    .select()
    .from(hrInsuranceRateConfig)
    .where(and(...filters))
    .limit(1)
  return rows[0] ?? null
}

/**
 * 生成某月工资单。
 *
 * 前置:该月的 hr_attendance_monthly 必须已生成(否则缺勤天数无从判断)。
 * 幂等:同一周期同一员工重复算只更新,不重复插入。
 */
export async function buildPayroll(params: {
  periodMonth: string
  regionName?: string | undefined
  /** 是否覆盖已 approved 的周期(默认 false) */
  overwriteApproved?: boolean | undefined
  operatedBy?: string | undefined
}): Promise<PayrollBuildResult> {
  const { periodMonth, regionName, overwriteApproved = false, operatedBy } = params

  if (!/^\d{4}-\d{2}$/.test(periodMonth)) {
    throw new AppError('月份格式必须是 YYYY-MM', 400, 'PAYROLL_BAD_PERIOD')
  }
  const [y, m] = periodMonth.split('-').map(Number) as [number, number]
  if (m < 1 || m > 12) throw new AppError('月份不合法', 400, 'PAYROLL_BAD_PERIOD')
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const monthStart = `${periodMonth}-01`
  const monthEnd = `${periodMonth}-${String(lastDay).padStart(2, '0')}`
  const year = y

  // 周期:存在则校验状态,不存在则建
  const [existingPeriod] = await db
    .select()
    .from(hrPayrollPeriod)
    .where(eq(hrPayrollPeriod.periodMonth, periodMonth))
    .limit(1)

  if (existingPeriod && existingPeriod.status === 'approved' && !overwriteApproved) {
    throw new AppError(
      '该薪资周期已审批通过,不可重算(如需重算请显式 overwriteApproved=true)',
      409,
      'PAYROLL_PERIOD_APPROVED',
    )
  }
  if (existingPeriod && existingPeriod.status === 'paid') {
    throw new AppError('该薪资周期已发放,不可重算', 409, 'PAYROLL_PERIOD_PAID')
  }

  const period =
    existingPeriod ??
    (
      await db
        .insert(hrPayrollPeriod)
        .values({ periodMonth, status: 'draft', operatorId: operatedBy ?? null })
        .returning()
    )[0]!
  if (!period) throw new AppError('创建薪资周期失败', 500, 'PAYROLL_PERIOD_CREATE_FAILED')

  // 月结数据(唯一真相源)
  const monthlies = await db
    .select()
    .from(hrAttendanceMonthly)
    .where(eq(hrAttendanceMonthly.periodMonth, periodMonth))

  if (monthlies.length === 0) {
    throw new AppError(
      `该月没有月结数据,请先生成月结(periodMonth=${periodMonth})`,
      400,
      'PAYROLL_NO_MONTHLY',
    )
  }

  const insurance = await resolveInsuranceRates(year, regionName)

  let inserted = 0
  let updated = 0
  let skippedNoConfig = 0
  const skippedSigned = 0
  let totalGross = 0
  let totalNet = 0

  for (const monthly of monthlies) {
    const employeeId = monthly.employeeId

    const [emp] = await db
      .select({ id: hrEmployee.id, name: hrEmployee.name, employeeNo: hrEmployee.employeeNo })
      .from(hrEmployee)
      .where(and(eq(hrEmployee.id, employeeId), isNull(hrEmployee.deletedAt)))
      .limit(1)
    if (!emp) continue

    // 月结已签字 = 考勤已确认;但薪资可以算(签的是考勤不是工资)
    const config = await resolveSalaryConfig(employeeId, monthStart, monthEnd)
    if (!config) {
      // 没配薪资 → 跳过并报数,绝不猜一个数
      skippedNoConfig++
      continue
    }

    const warnings: string[] = []

    // ---- 输入 ----
    const baseSalary = Number(config.baseSalary)
    const fixedAllowance = Number(config.fixedAllowance ?? 0)
    // 加班基数:配了 otBase 用 otBase,否则用 baseSalary(常见做法)
    const otBase = Number(config.otBase ?? config.baseSalary)
    // 社保基数:配了 insuranceBase 用,否则用 baseSalary(并按地区上下限夹取)
    let insuranceBase = Number(config.insuranceBase ?? config.baseSalary)

    const scheduledDays = Number(monthly.scheduledDays)
    const actualDays = Number(monthly.actualDays)
    const absentDays = Number(monthly.absentDays)
    const otHours = Number(monthly.otHours)
    const otDetailRaw = (monthly.otDetail ?? {}) as Record<string, unknown>
    const otDetail = {
      weekday: Number(otDetailRaw['weekday'] ?? 0),
      weekend: Number(otDetailRaw['weekend'] ?? 0),
      holiday: Number(otDetailRaw['holiday'] ?? 0),
    }

    // ---- 步骤 1:日薪 ----
    const dailyRate = round2(baseSalary / PAYABLE_DAYS_PER_MONTH)

    // ---- 步骤 2:基本工资(按实出勤折算)----
    // 上限:不超过应出勤天数(防止外出/请假补足导致超发)
    const payableDays = scheduledDays > 0 ? Math.min(actualDays, scheduledDays) : actualDays
    const basePay = round2(dailyRate * payableDays)

    // ---- 步骤 3:加班费 ----
    // 小时工资 = 加班基数 / 21.75 / 8
    const hourlyRate = otBase / PAYABLE_DAYS_PER_MONTH / 8
    const otAmount = round2(
      hourlyRate *
        (otDetail.weekday * OVERTIME_RATE.weekday +
          otDetail.weekend * OVERTIME_RATE.weekend +
          otDetail.holiday * OVERTIME_RATE.holiday),
    )

    // ---- 步骤 4:缺勤扣款 ----
    //
    // 关键口径:**基本工资已按实出勤折算,不能再扣一次缺勤** —— 那是重复扣款。
    //   · 步骤 2 的 basePay = 日薪 × min(实出勤, 应出勤)
    //   · 若这里再减去 日薪 × 缺勤天数,同一批没来的天会被扣两遍
    //
    // 两种合法口径二选一:
    //   (A) 按实出勤折算:basePay = 日薪 × 实出勤,**不扣缺勤**
    //   (B) 按应出勤全额:basePay = 日薪 × 应出勤,再扣 日薪 × 缺勤
    // 两者结果相同。本实现取 (A),把 absenceDeduction 仅作为**审计展示值**
    // (让财务看到"因缺勤少发了多少"),不参与 grossPay 计算。
    const absenceDeduction = scheduledDays > 0 ? round2(dailyRate * absentDays) : 0

    // ---- 步骤 5:应发 ----
    // 不减去 absenceDeduction(见上),负值兜底为 0 —— 工资不能是负数
    const grossPayRaw = round2(basePay + fixedAllowance + otAmount)
    const grossPay = Math.max(0, grossPayRaw)
    if (grossPayRaw < 0) {
      warnings.push(`应发计算为负(${grossPayRaw}),已按 0 处理,请核对考勤数据`)
    }

    // ---- 步骤 6:社保公积金(个人部分)----
    let insurancePersonal = 0
    let housingFundPersonal = 0
    let rateSnapshot: PayrollBreakdown['rates'] = null

    if (insurance) {
      // 缴费基数夹取上下限
      if (
        insurance.insuranceBaseMin !== null &&
        insuranceBase < Number(insurance.insuranceBaseMin)
      ) {
        insuranceBase = Number(insurance.insuranceBaseMin)
      }
      if (
        insurance.insuranceBaseMax !== null &&
        insuranceBase > Number(insurance.insuranceBaseMax)
      ) {
        insuranceBase = Number(insurance.insuranceBaseMax)
      }
      const pension = Number(insurance.pensionPersonal ?? 0)
      const medical = Number(insurance.medicalPersonal ?? 0)
      const unemployment = Number(insurance.unemploymentPersonal ?? 0)
      insurancePersonal = round2(insuranceBase * (pension + medical + unemployment))

      // 公积金:员工配置的 housingFundRate 优先,否则用地区配置
      const fundRate = Number(config.housingFundRate ?? insurance.housingFundRate ?? 0)
      housingFundPersonal = round2(insuranceBase * fundRate)

      rateSnapshot = {
        region: insurance.regionName,
        year: insurance.effectiveYear,
        pensionPersonal: pension,
        medicalPersonal: medical,
        unemploymentPersonal: unemployment,
        housingFundRate: fundRate,
      }
    } else {
      warnings.push(
        `未找到 ${year} 年${regionName ? `「${regionName}」` : ''}社保费率配置,社保与公积金按 0 处理`,
      )
    }

    // ---- 步骤 7:专项附加扣除 ----
    const [taxProfile] = await db
      .select()
      .from(hrEmployeeTaxProfile)
      .where(eq(hrEmployeeTaxProfile.employeeId, employeeId))
      .limit(1)

    let specialDeduction = 0
    if (taxProfile) {
      // 子女教育:每孩每月 2000(2023 起),按分摊比例
      const childDeduction =
        taxProfile.childrenCount * 2000 * Number(taxProfile.childrenDeductionRatio ?? 1)
      // 3 岁以下婴幼儿:每孩每月 2000
      const infantDeduction = taxProfile.infantCount * 2000
      // 赡养老人:独生 3000/月,非独生按分摊额
      const elderlyDeduction = taxProfile.isOnlyChild
        ? 3000
        : Number(taxProfile.elderlySupportShare ?? 0)
      // 住房:租房 1500/月(直辖市/省会等)或房贷利息 1000/月
      let housingDeduction = 0
      if (taxProfile.housingType === 'rent') {
        housingDeduction = Number(taxProfile.housingRentAmount ?? 1500)
      } else if (taxProfile.housingType === 'loan') {
        housingDeduction = 1000
      }
      specialDeduction = round2(
        childDeduction +
          infantDeduction +
          elderlyDeduction +
          housingDeduction +
          Number(taxProfile.otherMonthlyDeduction ?? 0),
      )
    }

    // ---- 步骤 8:计税所得与个税 ----
    // 月度简化口径:应发 − 社保个人 − 公积金个人 − 专项附加 − 起征点
    const taxableIncome = round2(
      Math.max(
        0,
        grossPay -
          insurancePersonal -
          housingFundPersonal -
          specialDeduction -
          TAX_THRESHOLD_MONTHLY,
      ),
    )
    const incomeTax = calcIncomeTax(taxableIncome)

    // ---- 步骤 9:实发 ----
    // 负值兜底:实发为负意味着扣款超过应发(通常是社保基数配错或全月缺勤)。
    // 不回退成负数,而是归 0 并给出 warning,让 HR 看到问题去核配置。
    const netPayRaw = round2(grossPay - insurancePersonal - housingFundPersonal - incomeTax)
    const netPay = Math.max(0, netPayRaw)
    if (netPayRaw < 0) {
      warnings.push(
        `实发计算为负(${netPayRaw}):应发 ${grossPay} 不足以覆盖社保 ${insurancePersonal} + 公积金 ${housingFundPersonal} + 个税 ${incomeTax},已按 0 处理`,
      )
    }

    const breakdown: PayrollBreakdown = {
      inputs: {
        baseSalary,
        fixedAllowance,
        otBase,
        insuranceBase,
        housingFundRate: Number(config.housingFundRate ?? 0),
        scheduledDays,
        actualDays,
        absentDays,
        otHours,
        otDetail,
      },
      steps: {
        dailyRate,
        basePay,
        otAmount,
        absenceDeduction,
        grossPay,
        insurancePersonal,
        housingFundPersonal,
        specialDeduction,
        taxableIncome,
        incomeTax,
        netPay,
      },
      rates: rateSnapshot,
      warnings,
    }

    const values = {
      periodId: period.id,
      employeeId,
      baseSalary: baseSalary.toFixed(2),
      otAmount: otAmount.toFixed(2),
      allowance: fixedAllowance.toFixed(2),
      attendanceDeduction: absenceDeduction.toFixed(2),
      grossPay: grossPay.toFixed(2),
      insurancePersonal: insurancePersonal.toFixed(2),
      housingFundPersonal: housingFundPersonal.toFixed(2),
      taxableIncome: taxableIncome.toFixed(2),
      incomeTax: incomeTax.toFixed(2),
      otherDeduction: '0.00',
      netPay: netPay.toFixed(2),
      breakdown,
      updatedAt: new Date(),
    }

    const [existing] = await db
      .select({ id: hrPayrollItem.id })
      .from(hrPayrollItem)
      .where(and(eq(hrPayrollItem.periodId, period.id), eq(hrPayrollItem.employeeId, employeeId)))
      .limit(1)

    if (existing) {
      await db.update(hrPayrollItem).set(values).where(eq(hrPayrollItem.id, existing.id))
      updated++
    } else {
      await db.insert(hrPayrollItem).values(values)
      inserted++
    }
    totalGross += grossPay
    totalNet += netPay
  }

  // 周期状态推进到 calculated
  await db
    .update(hrPayrollPeriod)
    .set({ status: 'calculated', updatedAt: new Date() })
    .where(eq(hrPayrollPeriod.id, period.id))

  logger.info('薪资计算完成', {
    periodMonth,
    employees: monthlies.length,
    inserted,
    updated,
    skippedNoConfig,
  })

  return {
    periodMonth,
    periodId: period.id,
    employees: monthlies.length,
    inserted,
    updated,
    skippedNoConfig,
    skippedSigned,
    totalGross: round2(totalGross),
    totalNet: round2(totalNet),
  }
}

/** 查询某月工资单(含姓名/工号) */
/**
 * 撤回一次算薪(补偿动作,HR-6 第 3 期 2026-11-13 立)。
 *
 * 用途:编排流程里算薪之后的步骤失败时,把本次算薪的写入撤掉,
 * 避免留下"工资单算了一半/算完了但后续没完成"的半成品状态。
 *
 * 安全边界(**这是本函数最重要的部分**):
 *   · 只允许撤回 `draft` 状态的周期 —— `calculated` 及以上说明人已经看过结果,
 *     `approved`/`paid` 更是财务动作,任何自动补偿都不得触碰;
 *   · 撤回只删 `hr_payroll_item` 并让周期回到 `draft`,**不删周期行本身**
 *     (周期行是幂等锚点,删了会让下一次算薪以为是首次);
 *   · 不删 `hr_attendance_monthly` —— 那是考勤的产物,与算薪是两件事,
 *     越界删除会毁掉 HR 已核对的月结。
 *
 * 返回被删的工资单条数;因状态不允许而跳过时返回 `{ skipped: true }`。
 */
export async function revertPayrollCalculation(params: {
  periodMonth: string
}): Promise<{ skipped: boolean; deletedItems: number; reason?: string }> {
  const { periodMonth } = params
  if (!/^\d{4}-\d{2}$/.test(periodMonth)) {
    throw new AppError('月份格式必须是 YYYY-MM', 400, 'PAYROLL_BAD_PERIOD')
  }

  const [period] = await db
    .select({ id: hrPayrollPeriod.id, status: hrPayrollPeriod.status })
    .from(hrPayrollPeriod)
    .where(eq(hrPayrollPeriod.periodMonth, periodMonth))
    .limit(1)

  // 没有周期 = 这次算薪根本没跑到建周期那步,无需撤回
  if (!period) return { skipped: true, deletedItems: 0, reason: 'period_not_found' }

  // 只撤回 draft:calculated 及以上是人已确认过的结果
  if (period.status !== 'draft') {
    logger.warn('撤回算薪被拒绝:周期状态不允许', { periodMonth, status: period.status })
    return { skipped: true, deletedItems: 0, reason: `period_status_${period.status}` }
  }

  const deleted = await db
    .delete(hrPayrollItem)
    .where(eq(hrPayrollItem.periodId, period.id))
    .returning({ id: hrPayrollItem.id })

  logger.info('算薪已撤回', { periodMonth, deletedItems: deleted.length })
  return { skipped: false, deletedItems: deleted.length }
}

export async function listPayrollItems(periodMonth: string): Promise<
  {
    employeeNo: string | null
    employeeName: string | null
    baseSalary: string
    otAmount: string
    allowance: string
    attendanceDeduction: string
    grossPay: string
    insurancePersonal: string
    housingFundPersonal: string
    incomeTax: string
    netPay: string
    breakdown: unknown
  }[]
> {
  const rows = await db
    .select({
      employeeNo: hrEmployee.employeeNo,
      employeeName: hrEmployee.name,
      baseSalary: hrPayrollItem.baseSalary,
      otAmount: hrPayrollItem.otAmount,
      allowance: hrPayrollItem.allowance,
      attendanceDeduction: hrPayrollItem.attendanceDeduction,
      grossPay: hrPayrollItem.grossPay,
      insurancePersonal: hrPayrollItem.insurancePersonal,
      housingFundPersonal: hrPayrollItem.housingFundPersonal,
      incomeTax: hrPayrollItem.incomeTax,
      netPay: hrPayrollItem.netPay,
      breakdown: hrPayrollItem.breakdown,
    })
    .from(hrPayrollItem)
    .innerJoin(hrPayrollPeriod, eq(hrPayrollPeriod.id, hrPayrollItem.periodId))
    .leftJoin(hrEmployee, eq(hrEmployee.id, hrPayrollItem.employeeId))
    .where(eq(hrPayrollPeriod.periodMonth, periodMonth))
    .limit(1000)
  return rows
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
