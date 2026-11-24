// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 全量 typecheck 分包计时读数(纯函数)。
 *
 * 为什么单独成模块:scripts/typecheck-full.mjs 顶层即 CLI 主流程(无 isDirectRun 守卫),
 * import 它会清 .tsbuildinfo 并真跑一遍全量 typecheck。判据函数必须能被 node:test 直接
 * import 审阅,所以住在这里;产出侧(typecheck-full)与消费侧(check-typecheck)共用同一份
 * 记录格式与排序口径,不允许各写一份。
 *
 * 记录格式(JSONL,每行一条):
 *   {runId, event:'run-start', at, packages}
 *   {runId, event:'start', package, at}
 *   {runId, event:'finish', package, elapsedMs, status, done, at}
 *   {runId, event:'phase', phase, elapsedMs, status, done, at}
 *   {runId, event:'run-end', at, totalMs, wallMs, ok, slowest}
 */

import { readFileSync } from 'node:fs'

/** 秒数展示:保留 1 位小数,避免日志里出现 120.229999999 这种噪声。 */
export function formatDuration(ms) {
  const n = Number(ms)
  if (!Number.isFinite(n) || n <= 0) return '0.0s'
  return `${(n / 1000).toFixed(1)}s`
}

/** 读 JSONL 读数文件;文件不存在/半行 JSON 都只是丢那一条,不抛。 */
export function readTimings(filePath) {
  try {
    return readFileSync(filePath, 'utf8')
      .split(/\r?\n/)
      .filter((line) => line.trim().length > 0)
      .map((line) => {
        try {
          return JSON.parse(line)
        } catch {
          return null
        }
      })
      .filter((r) => r && typeof r === 'object')
  } catch {
    return []
  }
}

/**
 * 汇总读数。`nowMs` 用于计算在飞包已运行时长(超时被杀时没有 finish 记录)。
 *
 * 排序口径:已完成包按 elapsedMs 降序,第一条即最慢包;phase 单独列出,不参与包排名,
 * 否则 e2e/mypy 会把「最慢包」抢走,回答不了「哪个包卡住」。
 */
export function summarizeTimings(records, nowMs = Date.now()) {
  const runStart = records.find((r) => r && r.event === 'run-start')
  const starts = new Map()
  const finishes = new Map()
  const phases = []

  for (const r of records) {
    if (!r) continue
    if (r.event === 'start' && typeof r.package === 'string') starts.set(r.package, r)
    else if (r.event === 'finish' && typeof r.package === 'string') finishes.set(r.package, r)
    else if (r.event === 'phase' && typeof r.phase === 'string') phases.push(r)
  }

  const packages = [...finishes.values()]
    .map((r) => ({
      name: r.package,
      elapsedMs: Number.isFinite(Number(r.elapsedMs)) ? Number(r.elapsedMs) : 0,
      status: r.status ?? null,
      done: r.done === true,
    }))
    .sort((a, b) => b.elapsedMs - a.elapsedMs)

  const inFlight = [...starts.values()]
    .filter((s) => !finishes.has(s.package))
    .map((s) => ({
      name: s.package,
      elapsedMs: Math.max(0, nowMs - (Number.isFinite(Number(s.at)) ? Number(s.at) : nowMs)),
      done: false,
    }))
    .sort((a, b) => b.elapsedMs - a.elapsedMs)

  const totalMs = packages.reduce((sum, p) => sum + p.elapsedMs, 0)
  const wallMs = Number.isFinite(Number(runStart?.at))
    ? Math.max(0, nowMs - Number(runStart.at))
    : totalMs
  const slowest = packages[0] ?? null

  return {
    packages,
    inFlight,
    phases,
    slowest,
    totalMs,
    wallMs,
    runId: runStart?.runId ?? null,
  }
}

/** 给日志用的一行摘要;没有已完成包时明确说「尚无完成读数」,不伪装成 0 个包通过。 */
export function formatSummaryLine(summary) {
  if (summary.packages.length === 0) {
    return '尚无已完成包读数'
  }
  const slowest = summary.slowest
  return `已完成 ${summary.packages.length} 个包,串行相加 ${formatDuration(summary.totalMs)},最慢包 ${slowest.name} ${formatDuration(slowest.elapsedMs)}`
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
