#!/usr/bin/env node
/* eslint-disable no-console -- 守门脚本为 CLI 工具,需 console 输出诊断信息 */
/**
 * measure-guardian-performance.mjs — 守门项执行性能监控(P2-E)
 *
 * 功能:
 *   测量每个守门脚本的执行时间,输出性能报告(平均/最大/P95),
 *   帮助识别慢速守门项,指导性能优化。
 *
 * CLI 用法:
 *   node scripts/measure-guardian-performance.mjs                    # 测量所有非 blocking 项(默认 3 次取平均)
 *   node scripts/measure-guardian-performance.mjs --filter=<id>      # 只测量指定守门项
 *   node scripts/measure-guardian-performance.mjs --runs=<N>         # 每项运行 N 次取平均(默认 3)
 *   node scripts/measure-guardian-performance.mjs --json             # 输出 JSON 格式(供 CI 消费)
 *   node scripts/measure-guardian-performance.mjs --threshold=<ms>   # 超过阈值的项标记 SLOW(默认 5000ms)
 *   node scripts/measure-guardian-performance.mjs --help             # 显示帮助
 *
 * 实现要点:
 *   - 用 performance.now() 测量(perf_hooks)
 *   - 跳过 blocking 模式的守门项(避免阻塞/副作用,只测量 warn/info 模式)
 *   - 失败的守门项记录 FAIL 状态,不中断测量
 *   - 用 spawnSync 子进程执行每个脚本(隔离测量,含 Node.js 启动开销)
 *   - 守门项清单从 guardian-runner.mjs 源码动态提取(不修改原文件,零配置漂移)
 *
 * 退出码:
 *   0  测量完成(含 SLOW/FAIL 项)
 *   2  CLI 参数错误
 *   3  guardian-runner.mjs 解析失败(无法提取 checks 数组)
 */
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { performance } from 'node:perf_hooks'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

// ─── 路径推导(AGENTS.md §15:用 import.meta.url,不硬编码) ───
const __dirname = fileURLToPath(new URL('.', import.meta.url))
const ROOT = join(__dirname, '..')
const RUNNER_PATH = join(__dirname, 'guardian-runner.mjs')

// ─── 颜色 ───
const C = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  reset: '\x1b[0m',
}

// ─── 类型定义(JSDoc) ───
/**
 * @typedef {Object} CheckConfig
 * @property {string} id
 * @property {string} label
 * @property {string} script
 * @property {string[]} args
 * @property {'blocking'|'warn'|'info'} mode
 */

/**
 * @typedef {Object} MeasureResult
 * @property {string} id
 * @property {string} label
 * @property {string} mode
 * @property {number} avgMs
 * @property {number} maxMs
 * @property {number} p95Ms
 * @property {number} runs
 * @property {'OK'|'SLOW'|'FAIL'|'SKIP'} status
 * @property {string} [errorMsg]
 */

// ─── 默认值 ───
const DEFAULT_RUNS = 3
const DEFAULT_THRESHOLD_MS = 5000
const DEFAULT_TIMEOUT_MS = 30000

// ─── 从 guardian-runner.mjs 源码提取 checks 数组 ───
// guardian-runner.mjs 在 import 时会执行 main 逻辑,无法直接 import。
// 这里用源码解析方式提取 checks 数组,保持零配置漂移(不修改原文件)。
/**
 * @returns {CheckConfig[]}
 */
function loadChecks() {
  const src = readFileSync(RUNNER_PATH, 'utf8')
  const marker = 'const checks = ['
  const startIdx = src.indexOf(marker)
  if (startIdx === -1) {
    throw new Error(`无法在 guardian-runner.mjs 中找到 "${marker}" 声明`)
  }

  const arrStart = src.indexOf('[', startIdx)
  if (arrStart === -1) {
    throw new Error('guardian-runner.mjs 中 checks 数组起始 [ 未找到')
  }

  // 逐字符扫描,跟踪方括号深度,跳过字符串和注释
  let depth = 0
  let inString = false
  let stringChar = ''
  let inLineComment = false
  let inBlockComment = false

  for (let i = arrStart; i < src.length; i++) {
    const ch = src[i]
    const next = src[i + 1]

    // 注释处理
    if (inLineComment) {
      if (ch === '\n') inLineComment = false
      continue
    }
    if (inBlockComment) {
      if (ch === '*' && next === '/') {
        inBlockComment = false
        i++
      }
      continue
    }
    if (!inString && ch === '/' && next === '/') {
      inLineComment = true
      i++
      continue
    }
    if (!inString && ch === '/' && next === '*') {
      inBlockComment = true
      i++
      continue
    }

    // 字符串处理(跳过转义字符)
    if (inString) {
      if (ch === '\\') {
        i++
        continue
      }
      if (ch === stringChar) inString = false
      continue
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      inString = true
      stringChar = ch
      continue
    }

    // 方括号平衡匹配
    if (ch === '[') depth++
    else if (ch === ']') {
      depth--
      if (depth === 0) {
        const arrStr = src.slice(arrStart, i + 1)
        try {
          // 用 new Function 解析(隔离作用域,不污染全局)
          const fn = new Function(`return ${arrStr}`)
          const checks = fn()
          if (!Array.isArray(checks)) {
            throw new Error('提取的 checks 不是数组')
          }
          return checks
        } catch (e) {
          throw new Error(`解析 checks 数组失败: ${e.message}`)
        }
      }
    }
  }
  throw new Error('未找到 checks 数组的闭合 ](方括号不平衡)')
}

// ─── CLI 解析 ───
/**
 * @returns {{ filter?: string, runs: number, json: boolean, threshold: number, help: boolean }}
 */
function parseArgs() {
  const argv = process.argv.slice(2)
  const result = {
    filter: undefined,
    runs: DEFAULT_RUNS,
    json: false,
    threshold: DEFAULT_THRESHOLD_MS,
    help: false,
  }

  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') {
      result.help = true
    } else if (arg === '--json') {
      result.json = true
    } else if (arg.startsWith('--filter=')) {
      result.filter = arg.slice('--filter='.length)
    } else if (arg.startsWith('--runs=')) {
      const n = parseInt(arg.slice('--runs='.length), 10)
      if (Number.isFinite(n) && n > 0) {
        result.runs = n
      } else {
        console.error(`${C.red}错误:${C.reset} --runs 必须是正整数,实际: ${arg}`)
        process.exit(2)
      }
    } else if (arg.startsWith('--threshold=')) {
      const n = parseInt(arg.slice('--threshold='.length), 10)
      if (Number.isFinite(n) && n >= 0) {
        result.threshold = n
      } else {
        console.error(`${C.red}错误:${C.reset} --threshold 必须是非负整数,实际: ${arg}`)
        process.exit(2)
      }
    } else {
      console.error(`${C.red}错误:${C.reset} 未知参数: ${arg}`)
      console.error(`用 ${C.cyan}node scripts/measure-guardian-performance.mjs --help${C.reset} 查看用法`)
      process.exit(2)
    }
  }

  return result
}

// ─── 测量单个守门项 ───
/**
 * @param {CheckConfig} check
 * @param {number} runs
 * @param {number} thresholdMs
 * @returns {MeasureResult}
 */
function measureCheck(check, runs, thresholdMs) {
  const scriptPath = join('scripts', check.script)
  const fullArgs = [...check.args]
  const times = []
  let errorMsg = ''

  for (let i = 0; i < runs; i++) {
    const start = performance.now()
    try {
      const result = spawnSync('node', [scriptPath, ...fullArgs], {
        cwd: ROOT,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: DEFAULT_TIMEOUT_MS,
      })
      const elapsed = performance.now() - start
      times.push(elapsed)

      // exit 0/1 是正常完成(1 = 守门项检测到违规,不是脚本故障)
      // exit null(超时/信号)或 exit >= 2 才算脚本故障
      if (result.status === null) {
        errorMsg = `超时或信号终止: ${result.signal ?? 'unknown'}`
      } else if (result.status >= 2) {
        errorMsg = `exit ${result.status}`
      }
    } catch (e) {
      errorMsg = e.message ?? String(e)
      break
    }
  }

  if (times.length === 0) {
    return {
      id: check.id,
      label: check.label,
      mode: check.mode,
      avgMs: 0,
      maxMs: 0,
      p95Ms: 0,
      runs: 0,
      status: 'FAIL',
      errorMsg,
    }
  }

  // 排序后计算统计值
  times.sort((a, b) => a - b)
  const avg = times.reduce((sum, t) => sum + t, 0) / times.length
  const max = times[times.length - 1]
  // P95:最近秩法,rank = ceil(0.95 * n),取排序后第 rank 个元素(1-based)
  const p95Rank = Math.min(Math.ceil(0.95 * times.length), times.length)
  const p95 = times[p95Rank - 1]

  let status
  if (errorMsg) {
    status = 'FAIL'
  } else if (avg > thresholdMs) {
    status = 'SLOW'
  } else {
    status = 'OK'
  }

  return {
    id: check.id,
    label: check.label,
    mode: check.mode,
    avgMs: Math.round(avg),
    maxMs: Math.round(max),
    p95Ms: Math.round(p95),
    runs: times.length,
    status,
    errorMsg: errorMsg || undefined,
  }
}

// ─── 格式化毫秒 ───
function fmtMs(ms) {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

// ─── 输出表格 ───
/**
 * @param {MeasureResult[]} results
 * @param {number} totalTimeMs
 * @param {number} thresholdMs
 * @param {number} totalChecks
 */
function printTable(results, totalTimeMs, thresholdMs, totalChecks) {
  const ok = results.filter((r) => r.status === 'OK').length
  const slow = results.filter((r) => r.status === 'SLOW').length
  const fail = results.filter((r) => r.status === 'FAIL').length

  console.log('')
  console.log(`${C.bold}🛡️  守门项性能报告${C.reset} ${C.dim}(阈值 ${fmtMs(thresholdMs)})${C.reset}`)
  console.log('')

  // 表头
  const header =
    `${C.dim}ID${C.reset}`.padEnd(12) +
    `${C.dim}标签${C.reset}`.padEnd(42) +
    `${C.dim}模式${C.reset}`.padEnd(10) +
    `${C.dim}平均${C.reset}`.padEnd(12) +
    `${C.dim}最大${C.reset}`.padEnd(12) +
    `${C.dim}P95${C.reset}`.padEnd(12) +
    `${C.dim}状态${C.reset}`.padEnd(8) +
    `${C.dim}次数${C.reset}`
  console.log(header)
  console.log(C.dim + '─'.repeat(110) + C.reset)

  for (const r of results) {
    const statusColor =
      r.status === 'OK' ? C.green : r.status === 'SLOW' ? C.yellow : r.status === 'FAIL' ? C.red : C.dim
    const label = r.label.length > 38 ? r.label.slice(0, 36) + '..' : r.label
    const line =
      r.id.padEnd(12) +
      label.padEnd(42) +
      r.mode.padEnd(10) +
      fmtMs(r.avgMs).padEnd(12) +
      fmtMs(r.maxMs).padEnd(12) +
      fmtMs(r.p95Ms).padEnd(12) +
      `${statusColor}${r.status}${C.reset}`.padEnd(8) +
      String(r.runs)
    console.log(line)
    if (r.errorMsg) {
      console.log(`              ${C.red}└─ ${r.errorMsg}${C.reset}`)
    }
  }

  console.log(C.dim + '─'.repeat(110) + C.reset)
  console.log('')

  // 汇总
  const skipped = totalChecks - results.length
  console.log(`${C.bold}汇总:${C.reset}`)
  console.log(`  总守门项: ${totalChecks}(${C.dim}跳过 ${skipped} 个 blocking${C.reset})`)
  console.log(`  ${C.green}OK: ${ok}${C.reset}  ${C.yellow}SLOW: ${slow}${C.reset}  ${C.red}FAIL: ${fail}${C.reset}`)
  console.log(`  总耗时: ${fmtMs(totalTimeMs)}`)

  // 最慢项
  if (results.length > 0) {
    const slowest = results.reduce((s, r) => (r.avgMs > s.avgMs ? r : s), results[0])
    console.log(`  最慢: ${C.magenta}${slowest.id}${C.reset} ${C.dim}(${slowest.label})${C.reset} avg ${fmtMs(slowest.avgMs)}`)
  }

  // SLOW 项提示
  if (slow > 0) {
    console.log('')
    console.log(`${C.yellow}⚠️  ${slow} 个守门项超过阈值 ${fmtMs(thresholdMs)},建议优化:${C.reset}`)
    for (const r of results.filter((x) => x.status === 'SLOW')) {
      console.log(`   ${C.bold}${r.id}${C.reset} ${C.dim}${r.label}${C.reset} avg ${fmtMs(r.avgMs)}`)
    }
  }
}

// ─── 输出 JSON ───
/**
 * @param {MeasureResult[]} results
 * @param {number} totalTimeMs
 * @param {number} thresholdMs
 * @param {number} totalChecks
 */
function printJson(results, totalTimeMs, thresholdMs, totalChecks) {
  const ok = results.filter((r) => r.status === 'OK').length
  const slow = results.filter((r) => r.status === 'SLOW').length
  const fail = results.filter((r) => r.status === 'FAIL').length
  const slowest = results.length > 0
    ? results.reduce((s, r) => (r.avgMs > s.avgMs ? r : s), results[0])
    : null

  const output = {
    summary: {
      total: totalChecks,
      measured: results.length,
      ok,
      slow,
      fail,
      thresholdMs,
      totalTimeMs: Math.round(totalTimeMs),
      slowest: slowest
        ? { id: slowest.id, label: slowest.label, avgMs: slowest.avgMs }
        : null,
    },
    items: results.map((r) => ({
      id: r.id,
      label: r.label,
      mode: r.mode,
      avgMs: r.avgMs,
      maxMs: r.maxMs,
      p95Ms: r.p95Ms,
      runs: r.runs,
      status: r.status,
      errorMsg: r.errorMsg ?? null,
    })),
  }

  console.log(JSON.stringify(output, null, 2))
}

// ─── 帮助 ───
function printHelp() {
  console.log(`
measure-guardian-performance.mjs — 守门项执行性能监控(P2-E)

用法:
  node scripts/measure-guardian-performance.mjs [选项]

选项:
  --filter=<id>      只测量指定守门项(如 --filter=2g-web)
  --runs=<N>         每项运行 N 次取平均(默认 ${DEFAULT_RUNS})
  --json             输出 JSON 格式(供 CI 消费)
  --threshold=<ms>   超过阈值的项标记为 SLOW(默认 ${DEFAULT_THRESHOLD_MS}ms)
  --help, -h         显示此帮助

测量范围:
  默认跳过 blocking 模式的守门项(避免阻塞/副作用),只测量 warn/info 模式。
  blocking 项的测量需手动单独执行(如 node scripts/<script>.mjs)。

输出格式:
  表格模式(默认):ID / 标签 / 模式 / 平均 / 最大 / P95 / 状态 / 次数
  JSON 模式(--json):{ summary, items } 结构,供 CI 消费

状态:
  OK    平均时间 ≤ 阈值
  SLOW  平均时间 > 阈值
  FAIL  脚本崩溃/超时/exit >= 2

退出码:
  0  测量完成(含 SLOW/FAIL 项)
  2  CLI 参数错误
  3  guardian-runner.mjs 解析失败
`)
}

// ─── 主流程 ───
function main() {
  const opts = parseArgs()

  if (opts.help) {
    printHelp()
    process.exit(0)
  }

  // 加载守门项清单
  let checks
  try {
    checks = loadChecks()
  } catch (e) {
    console.error(`${C.red}❌ 无法从 guardian-runner.mjs 提取 checks 数组:${C.reset}`, e.message)
    console.error(e?.stack ?? '(no stack)')
    process.exit(3)
  }

  const totalChecks = checks.length

  // 过滤:跳过 blocking,应用 --filter
  let targets = checks.filter((c) => c.mode !== 'blocking')
  if (opts.filter) {
    targets = targets.filter((c) => c.id === opts.filter)
    if (targets.length === 0) {
      console.error(`${C.red}错误:${C.reset} --filter=${opts.filter} 未匹配任何非 blocking 守门项`)
      const availableIds = checks.filter((c) => c.mode !== 'blocking').map((c) => c.id).join(', ')
      console.error(`${C.dim}可用 ID: ${availableIds}${C.reset}`)
      process.exit(2)
    }
  }

  if (!opts.json) {
    console.log(`${C.cyan}测量 ${targets.length} 个守门项${C.reset} ${C.dim}(runs=${opts.runs}, threshold=${opts.threshold}ms, blocking 已跳过)${C.reset}`)
  }

  // 逐项测量
  const results = []
  const totalStart = performance.now()

  for (const check of targets) {
    if (!opts.json) {
      process.stdout.write(`${C.dim}  [${check.id}]${C.reset} ${check.label}...`)
    }
    const result = measureCheck(check, opts.runs, opts.threshold)
    results.push(result)
    if (!opts.json) {
      const statusColor =
        result.status === 'OK' ? C.green : result.status === 'SLOW' ? C.yellow : C.red
      process.stdout.write(`\r  ${C.dim}[${check.id}]${C.reset} ${check.label} → ${statusColor}${result.status}${C.reset} ${C.dim}avg ${fmtMs(result.avgMs)}${C.reset}${' '.repeat(20)}\n`)
    }
  }

  const totalTimeMs = performance.now() - totalStart

  // 输出报告
  if (opts.json) {
    printJson(results, totalTimeMs, opts.threshold, totalChecks)
  } else {
    printTable(results, totalTimeMs, opts.threshold, totalChecks)
  }

  process.exit(0)
}

main().catch((e) => {
  console.error(`${C.red}❌ measure-guardian-performance 脚本执行异常:${C.reset}`, e?.message ?? e)
  console.error(e?.stack ?? '(no stack)')
  process.exit(3)
})
