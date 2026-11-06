// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 自包含 agent 轨迹诊断报告(单文件 HTML:KPI + 阶段瀑布 + findings + 术语表)。
 *
 * 复现对象:对侧程序随产品分发的两枚单文件报告(实测 externalScripts=0 / inlineScripts=1 /
 * iframeCount=0 / mediaQueries=0 / hasPrintStyle=false / hasDark=false)—— 即"喂一份日志进去
 * 就出诊断视图"的离线单件工具。本层复现它的**行为与设计**(自包含、KPI、瀑布、findings、术语表、
 * 过滤、复制),代码自研;并在四条轴上超越(下方 ①—④,逐条有测试钉住):
 *   ① 深浅色 `prefers-color-scheme`(对侧只有暗色面)
 *   ② `@media print` 版式(对侧无)
 *   ③ 文案注入式取词 + 缺键回显键名并把欠账写回文档(对侧文案硬编码)
 *   ④ 判据阈值可注入 + 结构化读数(KPI/findings/欠账键)与文档同批产出(对侧阈值埋在它自己的
 *      内联脚本里,既取不到也不可改,更没有机器可读出口)
 *
 * 本模块零 DOM、零 IO、零时钟:同一输入必得同一文档 ⇒ 可 diff、可测。DOM API 只出现在**产出的
 * 字符串**里(REPORT_INTERACTION_JS),由打开该文档的浏览器执行。
 */
import type {
  AgentTrace,
  AgentTraceReport,
  BuildAgentTraceReportOptions,
} from './agent-trace-types'
import { AGENT_REPORT_COPY_KEYS as K, createCopyCollector } from './report-copy'
import { buildAgentReportCss } from './report-styles'
import { makeNumberFormatter } from './report-format'
import {
  admitDroppedTrace,
  computeAgentTraceKpi,
  evaluateAgentTraceFindings,
  layoutTraceLanes,
} from './trace-metrics'
import {
  renderCopyGap,
  renderFindings,
  renderFooter,
  renderGlossary,
  renderHead,
  renderKpis,
  renderMessages,
  renderTraceLanes,
  renderWaterfall,
} from './report-views'
import { escapeHtml } from '../artifact/render'

/**
 * 内联交互脚本(过滤 + 复制)。
 * 为什么整段是常量而不插值:文案与数据一律留在标记属性(`data-template` / `data-done-text`)里,
 * 脚本只读它们 ⇒ 本层没有任何"把动态值拼进 JS"的暴露面,注入阳性对照也就无从命中。
 */
const REPORT_INTERACTION_JS = `;(function () {
  var list = document.getElementById('stepList')
  var input = document.getElementById('stepFilter')
  var clear = document.getElementById('stepFilterClear')
  var copyBtn = document.getElementById('copyReport')
  var out = document.getElementById('stepHiddenCount')
  var status = document.getElementById('reloadStatus')
  function keep(reason) {
    if (!status) return
    status.setAttribute('data-reload', 'keep')
    status.setAttribute('data-reason', reason)
  }
  function spanIdOk(value) {
    return typeof value === 'string' && /^[a-z0-9][a-z0-9_-]{0,40}$/.test(value)
  }
  function finiteMs(value) {
    return typeof value === 'number' && isFinite(value) ? value : null
  }
  function layoutSpans(raw) {
    var origin = finiteMs(raw.spanOriginMs)
    var horizon = finiteMs(raw.spanHorizonMs)
    if (origin === null || horizon === null) return { reason: 'window-unmeasured' }
    if (horizon <= origin) return { reason: 'window-empty' }
    if (!Array.isArray(raw.spans)) return { reason: 'spans-unmeasured' }
    var whole = horizon - origin
    var pending = []
    var ids = {}
    for (var i = 0; i < raw.spans.length; i++) {
      var item = raw.spans[i]
      if (!item || typeof item !== 'object' || Array.isArray(item)) return { reason: 'span-unreadable' }
      if (!spanIdOk(item.id) || !spanIdOk(item.lane) || ids[item.id]) return { reason: 'span-unreadable' }
      var start = finiteMs(item.startMs)
      var end = finiteMs(item.endMs)
      if (start === null || end === null || end < start) return { reason: 'span-unreadable' }
      if (start < origin || end > horizon) return { reason: 'span-outside' }
      var fromId = null
      if (item.fromId !== undefined && item.fromId !== null) {
        if (!spanIdOk(item.fromId) || item.fromId === item.id) return { reason: 'edge-unknown' }
        fromId = item.fromId
      }
      ids[item.id] = 1
      pending.push({
        id: item.id,
        lane: item.lane,
        fromId: fromId,
        leftPct: Math.round(((start - origin) / whole) * 1000) / 10,
        widthPct: Math.round(((end - start) / whole) * 1000) / 10
      })
    }
    for (var j = 0; j < pending.length; j++) {
      if (pending[j].fromId !== null && !ids[pending[j].fromId]) return { reason: 'edge-unknown' }
    }
    return { lanes: pending }
  }
  function admit(raw) {
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return { reason: 'payload-unreadable' }
    var hasSteps = Object.prototype.hasOwnProperty.call(raw, 'toolCalls')
    var hasSpans = Object.prototype.hasOwnProperty.call(raw, 'spans')
    if (!hasSteps && !hasSpans) return { reason: 'payload-unmeasured' }
    if (hasSteps) {
      if (!Array.isArray(raw.toolCalls)) return { reason: 'steps-unmeasured' }
      var allowed = { running: 1, success: 1, error: 1, cancelled: 1 }
      for (var i = 0; i < raw.toolCalls.length; i++) {
        var step = raw.toolCalls[i]
        if (!step || typeof step !== 'object' || Array.isArray(step)) return { reason: 'step-unreadable' }
        if (typeof step.toolName !== 'string' || step.toolName.trim() === '') return { reason: 'step-unreadable' }
        if (typeof step.status !== 'string' || !allowed[step.status]) return { reason: 'step-unreadable' }
        if (Object.prototype.hasOwnProperty.call(step, 'durationMs') && step.durationMs !== null && step.durationMs !== undefined) {
          if (typeof step.durationMs !== 'number' || !isFinite(step.durationMs) || step.durationMs < 0) {
            return { reason: 'duration-unmeasured' }
          }
        }
      }
    }
    if (!hasSpans) return { steps: raw.toolCalls }
    var laid = layoutSpans(raw)
    if (laid.reason) return { reason: laid.reason }
    return { steps: hasSteps ? raw.toolCalls : null, lanes: laid.lanes }
  }
  function paint(raw) {
    var plan = admit(raw)
    if (plan.reason) { keep(plan.reason); return }
    if (plan.steps && list) {
      while (list.firstChild) list.removeChild(list.firstChild)
      var max = 0
      for (var i = 0; i < plan.steps.length; i++) {
        if (typeof plan.steps[i].durationMs === 'number' && plan.steps[i].durationMs > max) max = plan.steps[i].durationMs
      }
      var mark = status ? status.getAttribute('data-unmeasured') || '' : ''
      for (var n = 0; n < plan.steps.length; n++) {
        var step = plan.steps[n]
        var row = document.createElement('li')
        row.className = 'step'
        row.setAttribute('data-status', step.status)
        var name = document.createElement('span')
        name.className = 'name'
        name.textContent = step.toolName
        var ms = document.createElement('span')
        ms.className = 'ms readout'
        var measured = typeof step.durationMs === 'number'
        ms.textContent = measured ? String(step.durationMs) : mark
        var track = document.createElement('span')
        track.className = 'track'
        var bar = document.createElement('span')
        bar.className = 'bar'
        bar.setAttribute('data-state', measured ? 'measured' : 'unmeasured')
        var width = measured && max > 0 ? ((step.durationMs / max) * 100).toFixed(1) : '0.0'
        bar.setAttribute('style', 'width:' + width + '%')
        track.appendChild(bar)
        row.appendChild(name)
        row.appendChild(track)
        row.appendChild(ms)
        list.appendChild(row)
      }
    }
    if (plan.lanes) {
      var host = document.getElementById('lanes')
      if (!host) {
        host = document.createElement('section')
        host.id = 'lanes'
        var report = document.getElementById('report')
        if (report) report.appendChild(host)
      }
      while (host.firstChild) host.removeChild(host.firstChild)
      host.setAttribute('data-lanes', 'laid-out')
      host.setAttribute('data-reason', 'laid-out')
      for (var k = 0; k < plan.lanes.length; k++) {
        var span = plan.lanes[k]
        var lane = document.createElement('div')
        lane.className = 'lane'
        lane.setAttribute('data-lane', span.lane)
        var bar = document.createElement('span')
        bar.className = 'lane-bar'
        bar.setAttribute('data-span', span.id)
        if (span.fromId) bar.setAttribute('data-from', span.fromId)
        bar.setAttribute('style', 'left:' + span.leftPct + '%;width:' + span.widthPct + '%')
        lane.appendChild(bar)
        host.appendChild(lane)
      }
    }
    if (status) {
      status.setAttribute('data-reload', 'replace')
      status.setAttribute('data-reason', 'measured')
    }
  }
  function applyText(text) {
    var raw
    try { raw = JSON.parse(text) } catch (err) { keep('payload-unreadable'); return }
    paint(raw)
  }
  document.addEventListener('dragover', function (event) { event.preventDefault() })
  document.addEventListener('drop', function (event) {
    event.preventDefault()
    var file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0]
    if (!file || typeof FileReader === 'undefined') { keep('payload-unmeasured'); return }
    var reader = new FileReader()
    reader.onload = function () { applyText(String(reader.result || '')) }
    reader.onerror = function () { keep('payload-unreadable') }
    reader.readAsText(file)
  })
  document.addEventListener('paste', function (event) {
    if (event.target && event.target.id === 'stepFilter') return
    var text = event.clipboardData && event.clipboardData.getData('text/plain')
    if (!text) return
    applyText(text)
  })
  if (!list) return
  function apply() {
    var q = input ? input.value.trim().toLowerCase() : ''
    var hidden = 0
    var shown = 0
    Array.prototype.forEach.call(list.children, function (row) {
      var hit = !q || row.textContent.toLowerCase().indexOf(q) >= 0
      row.hidden = !hit
      if (hit) { shown += 1 } else { hidden += 1 }
    })
    if (out && out.getAttribute('data-template')) {
      out.textContent = out.getAttribute('data-template')
        .replace('{hidden}', String(hidden))
        .replace('{shown}', String(shown))
    }
  }
  if (input) input.addEventListener('input', apply)
  if (clear) clear.addEventListener('click', function () { if (input) input.value = '' })
  if (copyBtn) copyBtn.addEventListener('click', function () {
    try {
      var host = document.getElementById('report') || document.body
      var sel = window.getSelection()
      var range = document.createRange()
      range.selectNodeContents(host)
      if (sel) { sel.removeAllRanges(); sel.addRange(range) }
      copyBtn.textContent = copyBtn.getAttribute('data-done-text') || copyBtn.textContent
    } catch (err) { void err }
  })
})()`

export function buildAgentTraceReport(options: BuildAgentTraceReportOptions): AgentTraceReport {
  const trace = options.trace
  const copy = createCopyCollector(options.translate)
  const kpi = computeAgentTraceKpi(trace.toolCalls)
  const findings = evaluateAgentTraceFindings(kpi, options.thresholds)
  const nf = makeNumberFormatter(trace.locale)

  // 取词是一串求值过程 ⇒ 欠账清单必须在正文、页脚、标题都取过词之后再取快照,
  // 否则后求值的键会进机读结果却不进文档(读数与视图两套口径 = 漂移)。
  const laneHtml =
    trace.spans === undefined
      ? ''
      : renderTraceLanes(
          layoutTraceLanes({
            originMs: trace.spanOriginMs,
            horizonMs: trace.spanHorizonMs,
            spans: trace.spans,
          }),
          copy,
        )
  const main = [
    renderHead(trace, copy, nf),
    renderKpis(kpi, copy, nf),
    renderWaterfall(trace, kpi, copy),
    laneHtml,
    renderFindings(findings, copy),
    renderMessages(trace, copy),
    renderGlossary(copy),
  ].join('')
  const footer = renderFooter(copy)
  const documentTitle = `${trace.title} · ${copy.copy(K.documentTitleSuffix)}`
  const missingCopyKeys = copy.missingKeys()
  // 欠账区自身的两个键若也缺失,会以键名字面出现在那一行里(快照不递归登记,登记不等于揭示)
  const gap = renderCopyGap(missingCopyKeys, copy)

  const html = [
    '<!doctype html>',
    `<html lang="${escapeHtml(trace.locale ?? 'en')}">`,
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<meta name="generator" content="@ihui/shared/reports/agent-trace-report">',
    '<title>' + escapeHtml(documentTitle) + '</title>',
    '<style>' + buildAgentReportCss() + '</style>',
    '</head>',
    '<body>',
    `<p id="reloadStatus" class="meta" data-reload="idle" data-reason="" data-unmeasured="${escapeHtml(copy.copy(K.waterfallUnmeasuredMark))}"></p>`,
    `<main id="report">${main}${gap}${footer}</main>`,
    '<script>' + REPORT_INTERACTION_JS + '</script>',
    '</body>',
    '</html>',
  ].join('')

  return { kpi, findings, missingCopyKeys, html }
}

/** 用同一套判据重渲。读不出来就留空报告，调用方继续用原来那份。 */
export function reloadAgentTraceReport(
  previous: AgentTrace,
  raw: unknown,
  options: Omit<BuildAgentTraceReportOptions, 'trace'> = {},
): { disposition: 'keep' | 'replace'; reason: string; report: AgentTraceReport | null } {
  const plan = admitDroppedTrace(previous, raw)
  if (plan.disposition === 'keep' || plan.trace === null) {
    return { disposition: 'keep', reason: plan.reason, report: null }
  }
  return {
    disposition: 'replace',
    reason: plan.reason,
    report: buildAgentTraceReport({ ...options, trace: plan.trace }),
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
