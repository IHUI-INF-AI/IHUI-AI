// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:watermarked

/**
 * 任务结果自检断言层(HR-6 第 2 期,2026-11-13 立)。
 *
 * 解决的问题(实测痛点):
 *   `ai-task-executor` 只判「端点有没有返回 2xx」。算薪算错、把工资算成负数、
 *   把 200 人的薪资算成 3 个人 —— 这些**接口全部返回 200**,系统发现不了,
 *   等 HR 在 Excel 里看到才会知道。这是"一键代办"最危险的失效模式:
 *   静默错误比报错更贵。
 *
 * 本层把「跑通了」升级为「结果合理」:
 *   · 每条断言只描述一个业务不变量,失败时给出**具体数字**而非笼统"校验失败";
 *   · 断言非阻塞 —— 收集全部问题后一次性返回,让 HR 一次看到所有异常,
 *     而不是修一个又冒一个;
 *   · 纯函数,不碰数据库、不调端点,便于单测与在 UI/通知里复用。
 */

/** 单条断言的结论 */
export interface AssertionResult {
  /** 断言标识(稳定,供前端/告警按 id 归类) */
  id: string
  /** 人可读名称 */
  label: string
  passed: boolean
  /** 实际观察到的值(格式化后的字符串,便于直接展示) */
  actual: string
  /** 期望描述 */
  expected: string
}

/** 一次自检的整体结论 */
export interface SelfCheckReport {
  /** 全部断言是否通过 */
  passed: boolean
  /** 通过的条数 */
  passedCount: number
  /** 失败条数 */
  failedCount: number
  results: AssertionResult[]
  /** 失败项的人话汇总(直接可展示) */
  problems: string[]
}

/** 薪资流程的自检输入(与 summarizePayrollRun 的输出对齐) */
export interface PayrollSelfCheckInput {
  monthlyEmployees: number
  payslipCount: number
  totalGross: string | number
  totalNet: string | number
  skippedNoConfig: number
  /** 上月应发合计(可选;用于环比异常检测) */
  previousMonthGross?: string | number | null
  /** 环比允许的波动比例(缺省 0.5 = ±50%) */
  grossToleranceRatio?: number
}

function n(v: string | number | null | undefined): number {
  const x = Number(v ?? 0)
  return Number.isFinite(x) ? x : 0
}

function fmt(v: number): string {
  return v.toFixed(2)
}

/**
 * 薪资流程自检。
 *
 * 五条不变量(每条都对应一种真实发生过的算错方式):
 *   1. 月结有人 ⇒ 必须有工资单 —— 防"月结生成了但没算薪"
 *   2. 应发 > 0(有人时)—— 防"全员算出 0 元"(薪资配置全缺时的典型结果)
 *   3. 实发 ≥ 0 —— 防负数工资(2026-11-12 实测踩过:双重扣款算成 -12350)
 *   4. 实发 ≤ 应发 —— 防"发的比挣的多"(个税/社保算成负数时的表现)
 *   5. 环比不超阈值 —— 防"漏算/多算一大批人"(最容易被忽略的静默错误)
 *
 * 环比断言只在调用方提供 previousMonthGross 时生效 —— 首次运行没有基准,
 * 强行断言会误报。
 */
export function selfCheckPayroll(input: PayrollSelfCheckInput): SelfCheckReport {
  const results: AssertionResult[] = []

  const employees = n(input.monthlyEmployees)
  const payslips = n(input.payslipCount)
  const gross = n(input.totalGross)
  const net = n(input.totalNet)
  const skipped = n(input.skippedNoConfig)

  // 1. 月结有人 ⇒ 必须有工资单
  results.push({
    id: 'payslip_expected',
    label: '月结有人就必须产出工资单',
    passed: employees === 0 || payslips > 0,
    actual: `月结 ${employees} 人 / 工资单 ${payslips} 条`,
    expected: employees === 0 ? '月结为空时无需工资单' : '工资单条数 > 0',
  })

  // 2. 有人时应发必须 > 0
  const grossPositive = employees === 0 ? true : gross > 0
  results.push({
    id: 'gross_positive',
    label: '应发合计为正',
    passed: grossPositive,
    actual: fmt(gross),
    expected: employees === 0 ? '月结为空,不判' : '> 0',
  })

  // 3. 实发不得为负
  results.push({
    id: 'net_non_negative',
    label: '实发合计不为负',
    passed: net >= 0,
    actual: fmt(net),
    expected: '>= 0',
  })

  // 4. 实发不得超过应发(扣款不能是负数)
  results.push({
    id: 'net_not_exceed_gross',
    label: '实发不超过应发',
    passed: net <= gross + 0.005, // 容忍分位舍入
    actual: `实发 ${fmt(net)} / 应发 ${fmt(gross)}`,
    expected: '实发 <= 应发',
  })

  // 5. 环比波动(仅在提供上月基准时)
  const prev = input.previousMonthGross === null || input.previousMonthGross === undefined
    ? null
    : n(input.previousMonthGross)
  if (prev !== null && prev > 0) {
    const ratio = input.grossToleranceRatio ?? 0.5
    const delta = Math.abs(gross - prev) / prev
    results.push({
      id: 'gross_mom_within_tolerance',
      label: '应发环比波动在阈值内',
      passed: delta <= ratio,
      actual: `本月 ${fmt(gross)} / 上月 ${fmt(prev)}(波动 ${(delta * 100).toFixed(1)}%)`,
      expected: `波动 <= ${(ratio * 100).toFixed(0)}%`,
    })
  }

  const failed = results.filter((r) => !r.passed)
  const problems = failed.map((r) => `${r.label}:实际 ${r.actual},期望 ${r.expected}`)

  // 缺薪资配置单独提示:它不是"算错",而是"没算全",值不值得拦由人判
  if (skipped > 0) {
    problems.push(`${skipped} 人因缺少薪资配置被跳过(需补齐后重算,否则这部分人会漏发)`)
  }

  return {
    passed: failed.length === 0,
    passedCount: results.length - failed.length,
    failedCount: failed.length,
    results,
    problems,
  }
}
