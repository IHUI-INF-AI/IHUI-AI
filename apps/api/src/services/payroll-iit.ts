// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 个人所得税 —— 居民工资薪金累计预扣法(唯一真相源)。
 *
 * 为什么要这个文件:2026-11-23 前系统里有**两套口径**同时活着 ——
 *   · HR 发薪(hr-payroll.ts)把"单月应税所得"直接套年度累计税率表 ⇒ 每月都从 3% 起,
 *     等于每个人全年都被少扣(高薪者尤其明显);
 *   · AI 报税工具(finance_tools.py)是真累计,但它只在一张工资表内累计,
 *     拿不到历史月份时就退化成单月。
 * 同一个员工在"发薪单"和"申报草案"里算出两个个税,是账实不符的直接来源。
 *
 * 本文件按国家税务总局口径实现:
 *   累计应纳税所得额 = 累计收入 − 累计减除费用(5000×月数) − 累计专项扣除(三险一金个人)
 *                     − 累计专项附加扣除
 *   本期应预扣预缴税额 = 累计应纳税额 − 截至上期已预扣税额(不为负)
 *
 * 金额单位:整数分。调用方(hr-payroll)用元记账,进出各转一次,内部零浮点。
 * AI 侧(apps/ai-service/app/tools/finance_tools.py 的 _iit_cumulative)与本文件同表同式,
 * 改动时必须两边同步并跑各自单测(载荷见 tests/payroll-iit-unit.test.ts 与 ai-service 对应用例)。
 */

/** 基本减除费用 5000 元/月 */
export const IIT_MONTHLY_DEDUCTION_CENTS = 500_000

/**
 * 综合所得年度税率表:[累计应纳税所得额上限(分), 税率, 速算扣除数(分)]
 * 与个税法附件一致,政策变动时只改这一处。
 */
const IIT_BRACKETS: readonly (readonly [number, number, number])[] = [
  [3_600_000, 0.03, 0],
  [14_400_000, 0.1, 252_000],
  [30_000_000, 0.2, 1_692_000],
  [42_000_000, 0.25, 3_192_000],
  [66_000_000, 0.3, 5_292_000],
  [96_000_000, 0.35, 8_592_000],
  [Number.POSITIVE_INFINITY, 0.45, 18_192_000],
]

/** 累计应纳税所得额(分) ⇒ 累计应纳税额(分) */
export function cumulativeIncomeTax(cumulativeTaxableCents: number): number {
  if (!Number.isFinite(cumulativeTaxableCents) || cumulativeTaxableCents <= 0) return 0
  for (const [capCents, rate, quickDeductionCents] of IIT_BRACKETS) {
    if (cumulativeTaxableCents <= capCents) {
      return Math.max(0, Math.round(cumulativeTaxableCents * rate) - quickDeductionCents)
    }
  }
  return 0
}

export interface CumulativeWithholdingInput {
  /** 本年 1 月至本月累计工资收入(分) */
  cumulativeIncomeCents: number
  /** 本年累计专项扣除:社保个人 + 公积金个人(分) */
  cumulativeSocialCents: number
  /** 本年累计专项附加扣除:子女教育/房贷/租金/赡养老人等(分) */
  cumulativeSpecialCents: number
  /** 本年截至本月已过的月份数(含本月,1~12) */
  months: number
  /** 截至上月已预扣税额(分) */
  priorWithheldCents: number
}

export interface CumulativeWithholdingResult {
  cumulativeTaxableCents: number
  cumulativeTaxCents: number
  /** 本期应预扣(累计税额 − 已预扣,不为负) */
  withholdingCents: number
}

/**
 * 累计预扣法一次结算。
 *
 * 注意:累计应纳税所得额是**整体**取 max(0),不是逐月取 max 再累加 ——
 * 某月工资为 0 时,当月减除费用仍计入累计,后续月份会因此少缴,这是政策设计。
 */
export function computeWithholding(input: CumulativeWithholdingInput): CumulativeWithholdingResult {
  const months = Math.min(12, Math.max(1, Math.floor(input.months)))
  const deductionCents = IIT_MONTHLY_DEDUCTION_CENTS * months
  const cumulativeTaxableCents = Math.max(
    0,
    input.cumulativeIncomeCents -
      deductionCents -
      input.cumulativeSocialCents -
      input.cumulativeSpecialCents,
  )
  const cumulativeTaxCents = cumulativeIncomeTax(cumulativeTaxableCents)
  const withholdingCents = Math.max(0, cumulativeTaxCents - input.priorWithheldCents)
  return { cumulativeTaxableCents, cumulativeTaxCents, withholdingCents }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
