// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:watermarked

/**
 * HR 月度薪资「一键代办」编排模板(HR-6 第 1 期,2026-11-13 立)。
 *
 * 把散在多处的 5 个动作串成一条可一键执行、失败可续跑的流水线:
 *
 *   ① 生成日结      POST /hr-settle/daily
 *   ② 生成月结      POST /hr-settle/monthly
 *   ③ 校验月结就绪  GET  /hr-settle/monthly   ← 门禁:没有月结数据就不许往下走
 *   ④ 计算工资      POST /hr-payroll/calculate
 *   ⑤ 拉取工资单    GET  /hr-payroll/items    ← 产出物:人/应发/实发
 *
 * 为什么用「先日结再月结」两步而不是合成一个端点:
 *   日结是逐日明细(可单独核对某天),月结是它的汇总。合成一步会让"某天算错"
 *   无法定位到具体哪一天。保持两步 = 出错时能精确知道是日结还是汇总的问题。
 *
 * 为什么第 ③ 步单独设门禁:
 *   `buildMonthlyAttendance` 在没有日结数据时会抛 400,但那时第 ①② 步已经跑完、
 *   时间已浪费。更关键的是:月结为空往往意味着"这个月还没人打卡/导入"——
 *   这是**该停下来问人**的信号,不该继续算出一堆 0 元工资。
 *
 * 幂等与续跑(执行器已具备,本模板直接受益):
 *   · 幂等键 = `hr.monthly-payroll:<业务日>`,同日重复触发自动 skip;
 *   · 失败时 `failedStepIndex` 落库,可带 `replayFromStep` 从失败步续跑,
 *     不需要重跑前面的步骤(日结/月结本身也是幂等 upsert)。
 *
 * 已知边界(不藏):
 *   · 本模板不会自动裁决考勤差异 —— 有未裁决差异时第 ④ 步会 409 失败,
 *     这是**正确行为**:差异必须人看过才能算钱;
 *   · 缺薪资配置的员工会被 `buildPayroll` 跳过并在结果里报数,
 *     本模板不自动补配置(补什么数只有 HR 知道)。
 */

/** 单步定义(与 ai_task_executor.TaskStep 逐字对齐) */
export interface HrPayrollTemplateStep {
  method: string
  path: string
  params?: Record<string, unknown>
  injectFromPrev?: { into: string }
  /** 步骤级重试(见 ai-task-executor 的 TaskStep.retry);缺省不重试 */
  retry?: {
    maxAttempts: number
    backoffMs?: number
    retryOnStatus?: number[]
  }
  /** 失败补偿(见 ai-task-executor 的 TaskStep.compensate) */
  compensate?: {
    method: string
    path: string
    params?: Record<string, unknown>
    fromOutput?: Record<string, string>
  }
}

export interface HrPayrollTemplateSeed {
  name: string
  goal: string
  steps: HrPayrollTemplateStep[]
  triggerType: 'manual' | 'cron'
  cron: string | null
  enabled: boolean
}

/**
 * 模板定义。
 *
 * `periodMonth` 由调用方在执行时通过模板参数覆盖(TaskStep.params 是静态 jsonb,
 * 因此这里的占位值 `{{periodMonth}}` 需要调用侧替换;见 runMonthlyPayroll 的说明)。
 */
export const HR_MONTHLY_PAYROLL_TEMPLATE_NAME = 'hr.monthly-payroll'

export function buildHrMonthlyPayrollTemplate(seed: {
  periodMonth: string
  regionName?: string | undefined
}): HrPayrollTemplateSeed {
  const { periodMonth, regionName } = seed

  return {
    name: HR_MONTHLY_PAYROLL_TEMPLATE_NAME,
    goal:
      '月度薪资一键代办:生成日结 → 生成月结 → 校验月结就绪 → 计算工资 → 输出工资单。' +
      '任一环节失败即停并留痕,可用 replayFromStep 从失败步续跑。',
    triggerType: 'manual',
    // 刻意不设 cron:自动发工资必须由人触发。定时化是下一步(需要先有"结果自检"能力),
    // 在那之前挂 cron 等于让机器在无人确认时改财务数据。
    cron: null,
    enabled: true,
    steps: [
      {
        // 日结是幂等 upsert(同员工同日只更新),重试安全
        method: 'POST',
        path: '/hr-settle/daily',
        params: { periodMonth },
        retry: { maxAttempts: 3, backoffMs: 400 },
      },
      {
        // 月结按 (periodMonth, employeeId) 唯一键 upsert,重试安全
        method: 'POST',
        path: '/hr-settle/monthly',
        params: { periodMonth },
        retry: { maxAttempts: 3, backoffMs: 400 },
      },
      {
        // 门禁:确认月结真的有数据。返回 { periodMonth, rows: [...] }
        method: 'GET',
        path: '/hr-settle/monthly',
        params: { periodMonth },
        retry: { maxAttempts: 3, backoffMs: 300 },
      },
      {
        // 算薪:周期按 periodMonth 唯一、工资单按 (periodId, employeeId) upsert ⇒ 重试安全。
        // 但注意:若因"未裁决考勤差异"返回 409,重试也无意义 ⇒ 409 不在默认重试码里,直接失败。
        method: 'POST',
        path: '/hr-payroll/calculate',
        params: regionName ? { periodMonth, regionName } : { periodMonth },
        retry: { maxAttempts: 2, backoffMs: 500 },
        // 补偿:若第 5 步(拉工资单)失败,把本次算薪撤回,不留"算完了但没出单"的半成品。
        // revertPayrollCalculation 只删 draft 周期的工资单,calculated 及以上拒绝 —— 安全。
        compensate: {
          method: 'POST',
          path: '/hr-payroll/revert',
          params: { periodMonth },
        },
      },
      {
        // 产出物:工资单(含每人 breakdown)
        method: 'GET',
        path: '/hr-payroll/items',
        params: { periodMonth },
        retry: { maxAttempts: 3, backoffMs: 300 },
      },
    ],
  }
}

/**
 * 从执行留痕里提取「人可读的结论」。
 *
 * 执行器只负责"跑没跑通",不解释业务结果。这一层把 stepResults 翻译成
 * HR 真正想看的四件事:算了多少人、应发多少、实发多少、有什么需要人处理。
 *
 * 纯函数,不碰数据库 —— 便于单测,也便于在 UI / 通知里复用。
 */
export interface PayrollRunSummary {
  ok: boolean
  /** 月结覆盖人数(第 ③ 步) */
  monthlyEmployees: number
  /** 算薪实际写入人数(第 ④ 步) */
  payrollInserted: number
  /** 因缺薪资配置被跳过的人数(第 ④ 步) */
  skippedNoConfig: number
  totalGross: string
  totalNet: string
  /** 工资单条数(第 ⑤ 步) */
  payslipCount: number
  /** 需要人处理的事项(非空即"不能直接发") */
  itemsNeedingHuman: string[]
  /** 失败步与原因(ok=false 时) */
  failedStepIndex: number | null
  errorMessage: string | null
  /** 结果自检报告(仅在流程本身成功时产出) */
  selfCheck: SelfCheckReport | null
}

import { selfCheckPayroll, type SelfCheckReport } from './ai-task-self-check.js'

interface StepResultLike {
  stepIndex: number
  ok: boolean
  output?: unknown
  error?: string
}

/** 从统一响应包装里取 data(端点返回 { code, message, data }) */
function unwrap(output: unknown): Record<string, unknown> | null {
  if (!output || typeof output !== 'object') return null
  const o = output as Record<string, unknown>
  const d = o['data']
  if (d && typeof d === 'object') return d as Record<string, unknown>
  return o
}

function num(v: unknown): number {
  const n = Number(v ?? 0)
  return Number.isFinite(n) ? n : 0
}

function money(v: unknown): string {
  const n = num(v)
  return n.toFixed(2)
}

export function summarizePayrollRun(
  stepResults: readonly StepResultLike[],
  selfCheck?: { previousMonthGross?: string | number | null; grossToleranceRatio?: number },
): PayrollRunSummary {
  const byIndex = new Map<number, StepResultLike>()
  for (const r of stepResults) byIndex.set(r.stepIndex, r)

  const failed = stepResults.find((r) => !r.ok) ?? null
  const monthly = unwrap(byIndex.get(2)?.output)
  const calc = unwrap(byIndex.get(3)?.output)
  const items = unwrap(byIndex.get(4)?.output)

  const monthlyRows = Array.isArray(monthly?.['rows']) ? (monthly['rows'] as unknown[]) : []
  const itemRows = Array.isArray(items?.['rows']) ? (items['rows'] as unknown[]) : []

  const itemsNeedingHuman: string[] = []

  // 月结为空 = 这个月没有任何考勤数据,算出来全是 0,必须人先确认
  if (!failed && monthlyRows.length === 0) {
    itemsNeedingHuman.push('该月没有月结数据(可能还没导入考勤),请先核对数据源再算薪')
  }

  const skippedNoConfig = num(calc?.['skippedNoConfig'])
  if (skippedNoConfig > 0) {
    itemsNeedingHuman.push(`${skippedNoConfig} 人缺少薪资配置,已被跳过,需补齐后重算`)
  }

  // 负值兜底若被触发,说明数据有问题(见 hr-payroll 的负数保护)
  if (!failed && num(calc?.['totalGross']) <= 0 && monthlyRows.length > 0) {
    itemsNeedingHuman.push('应发合计为 0,请检查出勤天数与薪资配置是否异常')
  }

  const summary: PayrollRunSummary = {
    ok: !failed,
    monthlyEmployees: monthlyRows.length,
    payrollInserted: num(calc?.['inserted']),
    skippedNoConfig,
    totalGross: money(calc?.['totalGross']),
    totalNet: money(calc?.['totalNet']),
    payslipCount: itemRows.length,
    itemsNeedingHuman,
    failedStepIndex: failed ? failed.stepIndex : null,
    errorMessage: failed ? (failed.error ?? '未知错误') : null,
    selfCheck: null,
  }

  // 结果自检:跑通了 ≠ 算对了。只在流程成功时判,失败时已由 failedStepIndex 说明问题。
  if (summary.ok) {
    const report = selfCheckPayroll({
      monthlyEmployees: summary.monthlyEmployees,
      payslipCount: summary.payslipCount,
      totalGross: summary.totalGross,
      totalNet: summary.totalNet,
      skippedNoConfig: summary.skippedNoConfig,
      previousMonthGross: selfCheck?.previousMonthGross ?? null,
      grossToleranceRatio: selfCheck?.grossToleranceRatio,
    })
    summary.selfCheck = report
    // 自检不通过 ⇒ 整体判为"需人工处理",不让它被当成可直接发的结果
    if (!report.passed) {
      summary.ok = false
      summary.itemsNeedingHuman.push(...report.problems)
    }
  }

  return summary
}


/**
 * 把一次流程运行的结论翻译成「待办」(HR-6 第 4 期)。
 *
 * 为什么单独一层而不是直接塞进 summarize:
 *   summarize 是**纯函数**(便于单测与前端复用),落库是副作用。
 *   分开后:想只看摘要就不碰库;想生成待办就显式调这个函数。
 *
 * 幂等由 dedupeKey 保证:`sourceRef`(月份)+ 问题类型。
 * 同一月重复跑流程,只会刷新影响规模与 lastSeenAt,不会堆重复待办。
 */
export interface TodoDraft {
  dedupeKey: string
  sourceType: string
  sourceRef: string
  severity: 'blocker' | 'warn' | 'info'
  title: string
  detail: string
  affectedCount: number | null
  affectedAmountCents: number | null
  actionPath: string | null
  actionHint: string | null
  context: Record<string, unknown>
}

export function buildPayrollTodoDrafts(summary: PayrollRunSummary, periodMonth: string): TodoDraft[] {
  const sourceType = 'hr.monthly-payroll'
  const base = { sourceType, sourceRef: periodMonth }
  const drafts: TodoDraft[] = []

  // ① 流程本身失败(步骤抛错)—— blocker,不能继续
  if (summary.failedStepIndex !== null) {
    drafts.push({
      ...base,
      dedupeKey: `${sourceType}:${periodMonth}:step_failed:${summary.failedStepIndex}`,
      severity: 'blocker',
      title: `月度薪资流程在第 ${summary.failedStepIndex + 1} 步失败`,
      detail:
        `失败原因:${summary.errorMessage ?? '未知'}\n` +
        '流程已停止,若前面步骤声明了补偿会自动撤回。修掉原因后可从未完成处继续。',
      affectedCount: null,
      affectedAmountCents: null,
      actionPath: `/admin/hr-data?period=${periodMonth}`,
      actionHint: '查看流程步骤明细,定位失败原因',
      context: { failedStepIndex: summary.failedStepIndex, errorMessage: summary.errorMessage },
    })
    return drafts // 流程失败时不再生成后续业务待办(信息已足够)
  }

  // ② 缺薪资配置 —— warn,有人会漏发
  if (summary.skippedNoConfig > 0) {
    drafts.push({
      ...base,
      dedupeKey: `${sourceType}:${periodMonth}:missing_salary_config`,
      severity: 'warn',
      title: `${summary.skippedNoConfig} 人缺少薪资配置,本次未算薪`,
      detail:
        '这些员工在 hr_salary_config 里没有当月生效的配置,被跳过后不会出现在工资单里。\n' +
        '若直接发放,这部分人会漏发。补齐配置后重跑本流程即可。',
      affectedCount: summary.skippedNoConfig,
      affectedAmountCents: null,
      actionPath: `/admin/hr-data?period=${periodMonth}&tab=payroll`,
      actionHint: '补齐薪资配置后重新计算',
      context: { skippedNoConfig: summary.skippedNoConfig, periodMonth },
    })
  }

  // ③ 月结为空 —— blocker,算出来全是 0
  if (summary.monthlyEmployees === 0) {
    drafts.push({
      ...base,
      dedupeKey: `${sourceType}:${periodMonth}:empty_monthly`,
      severity: 'blocker',
      title: `${periodMonth} 没有月结数据,无法算薪`,
      detail:
        '该月没有任何考勤月结记录。通常意味着:考勤还没导入,或日结/月结尚未生成。\n' +
        '先确认数据源(飞书/钉钉打卡表是否导入)再重跑。',
      affectedCount: null,
      affectedAmountCents: null,
      actionPath: `/admin/hr-data?period=${periodMonth}&tab=import`,
      actionHint: '导入考勤数据后重新生成日结与月结',
      context: { periodMonth, monthlyEmployees: 0 },
    })
  }

  // ④ 自检失败项 —— 按断言 id 逐条生成,便于分别处理
  if (summary.selfCheck && !summary.selfCheck.passed) {
    for (const r of summary.selfCheck.results) {
      if (r.passed) continue
      drafts.push({
        ...base,
        dedupeKey: `${sourceType}:${periodMonth}:selfcheck:${r.id}`,
        severity: 'blocker',
        title: `薪资自检未通过:${r.label}`,
        detail: `实际值:${r.actual}\n期望:${r.expected}\n\n这是自动核对发现的异常,发放前必须确认。`,
        affectedCount: summary.payslipCount || null,
        affectedAmountCents: null,
        actionPath: `/admin/hr-data?period=${periodMonth}&tab=payroll`,
        actionHint: '核对数据后修正,或确认属正常情况并结清此待办',
        context: { assertionId: r.id, actual: r.actual, expected: r.expected },
      })
    }
  }

  return drafts
}
