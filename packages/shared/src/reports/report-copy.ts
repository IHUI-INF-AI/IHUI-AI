// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 报告文案键清单与取词收集器。
 *
 * 为什么键名要集中登记成一张表:超越轴③要求"缺键回显键名而不是静默",那么"缺了哪些键"本身
 * 就是可交付的读数 —— 只有键名是常量,渲染层才可能把它统计出来并写回文档。
 * 对侧那份报告是硬编码中文,没有这一维(实测 mediaQueries=0、无取词函数)。
 */
import type { ReportTranslate } from './agent-trace-types'

/** 界面文案键:值即语言包键名(五语言 JSON 面由消费端归属,shared 层只出键不出文案) */
export const AGENT_REPORT_COPY_KEYS = {
  documentTitleSuffix: 'agentReport.documentTitleSuffix',
  sourceExportedAt: 'agentReport.sourceExportedAt',
  localeLabel: 'agentReport.localeLabel',
  timeZoneLabel: 'agentReport.timeZoneLabel',
  stepTotalLabel: 'agentReport.stepTotal',
  kpiTitle: 'agentReport.kpi.title',
  kpiSteps: 'agentReport.kpi.steps',
  kpiSuccess: 'agentReport.kpi.success',
  kpiError: 'agentReport.kpi.error',
  kpiCancelled: 'agentReport.kpi.cancelled',
  kpiRunning: 'agentReport.kpi.running',
  kpiMeasured: 'agentReport.kpi.measured',
  kpiUnmeasured: 'agentReport.kpi.unmeasured',
  kpiMeasuredTotal: 'agentReport.kpi.measuredTotal',
  kpiSlowest: 'agentReport.kpi.slowest',
  kpiSlowestShare: 'agentReport.kpi.slowestShare',
  waterfallTitle: 'agentReport.waterfall.title',
  waterfallFilter: 'agentReport.waterfall.filter',
  waterfallFilterClear: 'agentReport.waterfall.filterClear',
  waterfallCopy: 'agentReport.waterfall.copy',
  waterfallCopyDone: 'agentReport.waterfall.copyDone',
  waterfallEmpty: 'agentReport.waterfall.empty',
  waterfallUnmeasuredMark: 'agentReport.waterfall.unmeasuredMark',
  waterfallHiddenCount: 'agentReport.waterfall.hiddenCount',
  findingsTitle: 'agentReport.findings.title',
  findingsEmpty: 'agentReport.findings.empty',
  findingSeverityHigh: 'agentReport.finding.severity.high',
  findingSeverityMedium: 'agentReport.finding.severity.medium',
  findingSeverityLow: 'agentReport.finding.severity.low',
  findingFailuresPresent: 'agentReport.finding.failuresPresent',
  findingSlowestStepDominant: 'agentReport.finding.slowestStepDominant',
  findingUnmeasuredSteps: 'agentReport.finding.unmeasuredSteps',
  findingEmptyTrace: 'agentReport.finding.emptyTrace',
  findingMeasuredTotalOverBudget: 'agentReport.finding.measuredTotalOverBudget',
  messagesTitle: 'agentReport.messages.title',
  messagesTruncated: 'agentReport.messages.truncated',
  glossaryTitle: 'agentReport.glossary.title',
  glossaryMeasured: 'agentReport.glossary.measured',
  glossaryMeasuredDef: 'agentReport.glossary.measuredDef',
  glossaryUnmeasured: 'agentReport.glossary.unmeasured',
  glossaryUnmeasuredDef: 'agentReport.glossary.unmeasuredDef',
  glossarySlowestShare: 'agentReport.glossary.slowestShare',
  glossarySlowestShareDef: 'agentReport.glossary.slowestShareDef',
  glossaryFinding: 'agentReport.glossary.finding',
  glossaryFindingDef: 'agentReport.glossary.findingDef',
  copyGapTitle: 'agentReport.copyGap.title',
  copyGapBody: 'agentReport.copyGap.body',
  timeFallback: 'agentReport.time.fallback',
  offlineNote: 'agentReport.offlineNote',
} as const

export type AgentReportCopyKey =
  (typeof AGENT_REPORT_COPY_KEYS)[keyof typeof AGENT_REPORT_COPY_KEYS]

/** finding id → 文案键(渲染层与判据层之间只有这一张对照表) */
export const FINDING_COPY_KEYS = {
  failuresPresent: AGENT_REPORT_COPY_KEYS.findingFailuresPresent,
  slowestStepDominant: AGENT_REPORT_COPY_KEYS.findingSlowestStepDominant,
  unmeasuredSteps: AGENT_REPORT_COPY_KEYS.findingUnmeasuredSteps,
  emptyTrace: AGENT_REPORT_COPY_KEYS.findingEmptyTrace,
  measuredTotalOverBudget: AGENT_REPORT_COPY_KEYS.findingMeasuredTotalOverBudget,
} as const

/** 缺省取词:原样回显键名(AGENTS §0.3 同族 —— 缺输入要"多要一次说明",不能静默出空) */
export const echoTranslate = (key: string): string => key

export interface CopyCollector {
  copy(key: string, params?: Record<string, string | number>): string
  missingKeys(): string[]
}

/**
 * 取词 + 欠账登记:译文为空或等于键名 ⇒ 判定缺键,回显键名并计入 missingKeys。
 * 为什么不在这里抛错:报告本身仍要出得来(离线诊断工具在翻译缺失时哑掉是更坏的失效方向)。
 */
export function createCopyCollector(translate: ReportTranslate = echoTranslate): CopyCollector {
  const missing = new Set<string>()
  return {
    copy(key, params) {
      let text: string
      try {
        text = translate(key, params)
      } catch {
        // 消费端取词引擎自身抛错(坏 ICU 等)同样落欠账,而不是让整份文档崩掉
        text = key
      }
      if (typeof text !== 'string' || text.trim() === '' || text === key) {
        missing.add(key)
        return key
      }
      return text
    },
    missingKeys() {
      return [...missing].sort()
    },
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
