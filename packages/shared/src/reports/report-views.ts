// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 报告的分区渲染(纯字符串拼接:数据进,HTML 出;零 DOM API)。
 *
 * 转义纪律:每一枚动态值只在**进入模板的那一刻**过 escapeHtml 一次,
 * 内部辅助串一律保持未转义(否则 `&` 会变 `&amp;amp;`,读数失真)。
 */
import { escapeHtml } from '../artifact/render'
import { AGENT_REPORT_COPY_KEYS as K, FINDING_COPY_KEYS } from './report-copy'
import type { AgentTrace, AgentTraceKpi, TraceFinding } from './agent-trace-types'
import { isMeasuredDuration } from './trace-metrics'
import { formatDurationMs, formatShare, formatTraceInstant } from './report-format'
import type { NumberFormatter } from './report-format'
import type { createCopyCollector } from './report-copy'

type Copy = ReturnType<typeof createCopyCollector>

/** 消息正文预览长度:超出即显式标注截断(截断必须可见,不静默丢尾) */
const MESSAGE_PREVIEW_CHARS = 160

const SEVERITY_KEYS = {
  high: K.findingSeverityHigh,
  medium: K.findingSeverityMedium,
  low: K.findingSeverityLow,
} as const

const GLOSSARY_PAIRS = [
  [K.glossaryMeasured, K.glossaryMeasuredDef],
  [K.glossaryUnmeasured, K.glossaryUnmeasuredDef],
  [K.glossarySlowestShare, K.glossarySlowestShareDef],
  [K.glossaryFinding, K.glossaryFindingDef],
] as const

export function renderHead(trace: AgentTrace, copy: Copy, nf: NumberFormatter): string {
  const meta = [
    `${copy.copy(K.sourceExportedAt)}: ${formatTraceInstant(trace.exportedAt, trace.locale, trace.timeZone, copy)}`,
    `${copy.copy(K.stepTotalLabel)}: ${nf(trace.toolCalls.length)}`,
    `${copy.copy(K.localeLabel)}: ${trace.locale ?? ''}`,
    `${copy.copy(K.timeZoneLabel)}: ${trace.timeZone ?? ''}`,
  ].join(' · ')
  return `<header class="head section"><h1>${escapeHtml(trace.title)}</h1><p class="meta readout">${escapeHtml(meta)}</p></header>`
}

export function kpiCells(
  kpi: AgentTraceKpi,
  copy: Copy,
  nf: NumberFormatter,
): Array<[string, string]> {
  const unmeasured = copy.copy(K.waterfallUnmeasuredMark)
  return [
    [copy.copy(K.kpiSteps), nf(kpi.stepCount)],
    [copy.copy(K.kpiSuccess), nf(kpi.successCount)],
    [copy.copy(K.kpiError), nf(kpi.errorCount)],
    [copy.copy(K.kpiCancelled), nf(kpi.cancelledCount)],
    [copy.copy(K.kpiRunning), nf(kpi.runningCount)],
    [copy.copy(K.kpiMeasured), `${nf(kpi.measuredStepCount)} / ${nf(kpi.stepCount)}`],
    [copy.copy(K.kpiUnmeasured), nf(kpi.unmeasuredStepCount)],
    [copy.copy(K.kpiMeasuredTotal), formatDurationMs(kpi.measuredTotalMs)],
    [
      copy.copy(K.kpiSlowest),
      kpi.slowestMs === null
        ? unmeasured
        : `${kpi.slowestToolName ?? ''} · ${formatDurationMs(kpi.slowestMs)}`,
    ],
    [
      copy.copy(K.kpiSlowestShare),
      kpi.slowestShare === null ? unmeasured : formatShare(kpi.slowestShare, nf),
    ],
  ]
}

export function renderKpis(kpi: AgentTraceKpi, copy: Copy, nf: NumberFormatter): string {
  const body = kpiCells(kpi, copy, nf)
    .map(
      ([label, value]) =>
        `<div class="cell"><span class="k">${escapeHtml(label)}</span>` +
        `<span class="v readout">${escapeHtml(value)}</span></div>`,
    )
    .join('')
  return `<section id="kpis"><h2>${escapeHtml(copy.copy(K.kpiTitle))}</h2><div class="grid">${body}</div></section>`
}

export function renderWaterfall(trace: AgentTrace, kpi: AgentTraceKpi, copy: Copy): string {
  const max = kpi.slowestMs ?? 0
  const rows = trace.toolCalls
    .map((step, index) => {
      const measured = isMeasuredDuration(step.durationMs)
      const width = measured && max > 0 ? ((step.durationMs as number) / max) * 100 : 0
      const readout = measured
        ? formatDurationMs(step.durationMs as number)
        : copy.copy(K.waterfallUnmeasuredMark)
      return (
        `<li class="step" data-status="${escapeHtml(step.status)}">` +
        `<span class="id readout">${escapeHtml(String(index + 1))}</span>` +
        `<span class="name">${escapeHtml(step.toolName)}</span>` +
        `<span class="track"><span class="bar" data-state="${escapeHtml(measured ? 'measured' : 'unmeasured')}"` +
        ` style="width:${escapeHtml(width.toFixed(1))}%"></span></span>` +
        `<span class="chip">${escapeHtml(step.status)}</span>` +
        `<span class="ms readout">${escapeHtml(readout)}</span>` +
        '</li>'
      )
    })
    .join('')
  const emptyRow =
    trace.toolCalls.length === 0
      ? `<li class="step"><span class="name">${escapeHtml(copy.copy(K.waterfallEmpty))}</span></li>`
      : ''
  const filterLabel = escapeHtml(copy.copy(K.waterfallFilter))
  const copyDone = escapeHtml(copy.copy(K.waterfallCopyDone))
  const hiddenTemplate = escapeHtml(
    copy.copy(K.waterfallHiddenCount, { hidden: '{hidden}', shown: '{shown}' }),
  )
  const toolbar =
    `<div class="toolbar"><label for="stepFilter">${filterLabel}</label>` +
    '<input id="stepFilter" type="search" autocomplete="off">' +
    `<button id="stepFilterClear" type="button">${escapeHtml(copy.copy(K.waterfallFilterClear))}</button>` +
    `<button id="copyReport" type="button" data-done-text="${copyDone}">${escapeHtml(copy.copy(K.waterfallCopy))}</button>` +
    `<span class="k readout" id="stepHiddenCount" data-template="${hiddenTemplate}"></span></div>`
  return `<section id="waterfall"><h2>${escapeHtml(copy.copy(K.waterfallTitle))}</h2>${toolbar}<ol class="steps" id="stepList">${rows}${emptyRow}</ol></section>`
}

export function renderFindings(findings: TraceFinding[], copy: Copy): string {
  const title = `<h2>${escapeHtml(copy.copy(K.findingsTitle))}</h2>`
  if (findings.length === 0) {
    return `<section id="findings">${title}<p class="meta">${escapeHtml(copy.copy(K.findingsEmpty))}</p></section>`
  }
  const items = findings
    .map((finding) => {
      const detail = Object.entries(finding.params)
        .map(([key, value]) => `${escapeHtml(key)}=${escapeHtml(String(value))}`)
        .join(' · ')
      return (
        `<li class="finding"><span class="chip" data-severity="${escapeHtml(finding.severity)}">` +
        `${escapeHtml(copy.copy(SEVERITY_KEYS[finding.severity]))}</span>` +
        `<span>${escapeHtml(copy.copy(FINDING_COPY_KEYS[finding.id], finding.params))}</span>` +
        `<code class="detail">${detail}</code></li>`
      )
    })
    .join('')
  return `<section id="findings">${title}<ul class="plain">${items}</ul></section>`
}

export function renderMessages(trace: AgentTrace, copy: Copy): string {
  const messages = trace.messages
  if (!messages || messages.length === 0) return ''
  const truncationMark = copy.copy(K.messagesTruncated)
  const items = messages
    .map((message) => {
      const content = message.content ?? ''
      const clipped = content.length > MESSAGE_PREVIEW_CHARS
      const preview =
        (clipped ? content.slice(0, MESSAGE_PREVIEW_CHARS) : content) +
        (clipped ? ` … ${truncationMark}` : '')
      return `<li class="step"><span class="chip">${escapeHtml(message.role)}</span><span>${escapeHtml(preview)}</span></li>`
    })
    .join('')
  return `<section id="messages"><h2>${escapeHtml(copy.copy(K.messagesTitle, { count: messages.length }))}</h2><ul class="steps">${items}</ul></section>`
}

export function renderGlossary(copy: Copy): string {
  const body = GLOSSARY_PAIRS.map(
    ([termKey, defKey]) =>
      `<dt>${escapeHtml(copy.copy(termKey))}</dt><dd class="meta">${escapeHtml(copy.copy(defKey))}</dd>`,
  ).join('')
  return `<section id="glossary"><h2>${escapeHtml(copy.copy(K.glossaryTitle))}</h2><dl class="glossary">${body}</dl></section>`
}

/** 本地化欠账区:缺哪些键就点名哪些键(静默出英文残迹或出空白都比"承认没取到词"更坏) */
export function renderCopyGap(missingKeys: string[], copy: Copy): string {
  if (missingKeys.length === 0) return ''
  const items = missingKeys.map((key) => `<li><code>${escapeHtml(key)}</code></li>`).join('')
  return (
    `<section id="copygap" class="gapbox"><h2>${escapeHtml(copy.copy(K.copyGapTitle))}</h2>` +
    `<p class="meta">${escapeHtml(copy.copy(K.copyGapBody, { count: missingKeys.length }))}</p>` +
    `<ul class="plain">${items}</ul></section>`
  )
}

/** 页脚:离线承诺(与"零外链"断言配成一对,写进文档而不只写在测试里) */
export function renderFooter(copy: Copy): string {
  return `<footer>${escapeHtml(copy.copy(K.offlineNote))}</footer>`
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
