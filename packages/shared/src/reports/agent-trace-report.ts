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
import type { AgentTraceReport, BuildAgentTraceReportOptions } from './agent-trace-types'
import { AGENT_REPORT_COPY_KEYS as K, createCopyCollector } from './report-copy'
import { buildAgentReportCss } from './report-styles'
import { makeNumberFormatter } from './report-format'
import { computeAgentTraceKpi, evaluateAgentTraceFindings } from './trace-metrics'
import {
  renderCopyGap,
  renderFindings,
  renderFooter,
  renderGlossary,
  renderHead,
  renderKpis,
  renderMessages,
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
  const main = [
    renderHead(trace, copy, nf),
    renderKpis(kpi, copy, nf),
    renderWaterfall(trace, kpi, copy),
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
    `<main id="report">${main}${gap}${footer}</main>`,
    '<script>' + REPORT_INTERACTION_JS + '</script>',
    '</body>',
    '</html>',
  ].join('')

  return { kpi, findings, missingCopyKeys, html }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
