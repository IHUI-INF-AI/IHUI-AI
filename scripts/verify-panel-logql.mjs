#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 把 Grafana 大屏里所有 **Loki 面板**的 LogQL 拿去本机 Loki 上真跑一遍,报「有数 / 空板」。
 *
 * 立因(2026-10-17):AI 指标那条链的病是「大屏查的指标代码里根本没有」——日志这条链
 * 会有同型病,而且更隐蔽:数据源配上了、LogQL 语法也合法、面板照样一片空白,
 * 因为标签名写错 / 正则没命中 / job 名对不上。24 张盘曾 100% 是 Prometheus,
 * 而 Loki provisioning 了却零个日志面板,就是没人能一眼看出"这板到底有没有数"。
 *
 * 本脚本干的事:把「面板有没有数」从"人打开浏览器翻一遍"变成"一条命令列全表"。
 *
 * 与提交门的关系:**它不是守门,也不许接成守门**。它依赖运行时(本机 Loki 真在跑),
 * 接进 pre-commit 就是 §12e 恒红门 —— 凡判机器运行状态的一律 warn/只读,不做 blocking。
 * 用法是人工巡检或放进运维台账的周期性自查。
 *
 * 用法:
 *   node scripts/verify-grafana-logql-panels.mjs                 # 近 6h 全量核验
 *   node scripts/verify-grafana-logql-panels.mjs --window 24h
 *   node scripts/verify-grafana-logql-panels.mjs --loki http://127.0.0.1:3100
 *   node scripts/verify-grafana-logql-panels.mjs --dashboard ai-logs   # 只看某一张
 */
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DASHBOARD_DIR = join(ROOT, 'monitoring', 'grafana', 'dashboards')

// Grafana 变量在面板里是字面量,真跑时要换成能落地的区间。
const VAR_SUBSTITUTIONS = [
  [/\$__interval/g, '5m'],
  [/\$__range/g, '6h'],
  [/\$__auto/g, '5m'],
  [/\$\{__interval\}/g, '5m'],
  [/\$\{__range\}/g, '6h'],
]

function parseArgs(argv) {
  const out = { window: '6h', loki: null, dashboard: null, help: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--window') out.window = argv[++i]
    else if (a === '--loki') out.loki = argv[++i]
    else if (a === '--dashboard') out.dashboard = argv[++i]
    else if (a === '--help' || a === '-h') out.help = true
  }
  return out
}

function parseWindow(w) {
  const m = String(w).match(/^(\d+)([smhd])$/)
  if (!m) return null
  const mult = { s: 1, m: 60, h: 3600, d: 86400 }
  return Number(m[1]) * mult[m[2]]
}

function substitute(expr) {
  let out = expr
  for (const [re, to] of VAR_SUBSTITUTIONS) out = out.replace(re, to)
  return out
}

/** 聚合型(带 rate/count_over_time/sum/avg/topk/quantile)→ instant query;纯日志 → query_range。 */
function isMetricQuery(expr) {
  return /\b(rate|count_over_time|sum_over_time|avg_over_time|quantile_over_time|bytes_rate|bytes_over_time)\s*\(/.test(
    expr
  )
}

/**
 * 聚合型查询也走 **query_range**:面板画的是整个时间窗的曲线,不是"此刻一个点"。
 * 首版用 instant query,于是「6h 内 4827 行错误、但最近 15 分钟恰好 0 行」被判成空板 ——
 * 那是判据错了不是面板错了(AI 错误是突发型)。真正的判据是:窗口内**有没有非零数据点**。
 */
async function lokiMetricRange(base, expr, startSec, endSec, stepSec) {
  const url = new URL('/loki/api/v1/query_range', base)
  url.searchParams.set('query', expr)
  url.searchParams.set('start', String(startSec))
  url.searchParams.set('end', String(endSec))
  url.searchParams.set('step', String(stepSec))
  const res = await fetch(url, { signal: AbortSignal.timeout(45000) })
  if (!res.ok) return { ok: false, detail: `HTTP ${res.status}` }
  const j = await res.json()
  const result = (j.data && j.data.result) || []
  let nonZero = 0
  let total = 0
  let max = 0
  for (const r of result) {
    for (const [, v] of r.values || []) {
      total++
      const n = Number(v)
      if (Number.isFinite(n) && n !== 0) nonZero++
      if (Number.isFinite(n) && n > max) max = n
    }
  }
  if (!result.length) return { ok: true, empty: true, detail: '0 条序列' }
  return {
    ok: true,
    empty: nonZero === 0,
    detail: `${result.length} 条序列,${nonZero}/${total} 个点非零,峰值 ${max}`,
  }
}

async function lokiRange(base, expr, startSec, endSec) {
  const url = new URL('/loki/api/v1/query_range', base)
  url.searchParams.set('query', expr)
  url.searchParams.set('start', String(startSec))
  url.searchParams.set('end', String(endSec))
  url.searchParams.set('limit', '200')
  url.searchParams.set('direction', 'backward')
  url.searchParams.set('step', '60')
  const res = await fetch(url, { signal: AbortSignal.timeout(40000) })
  if (!res.ok) return { ok: false, detail: `HTTP ${res.status}` }
  const j = await res.json()
  const result = (j.data && j.data.result) || []
  const lines = result.reduce((acc, r) => acc + (r.values ? r.values.length : 0), 0)
  return { ok: true, empty: lines === 0, detail: `${lines} 行(上限 200)` }
}

function collectLokiPanels(filter) {
  const files = readdirSync(DASHBOARD_DIR)
    .filter((f) => f.endsWith('.json'))
    .filter((f) => !filter || f.includes(filter))
  const out = []
  for (const f of files) {
    let json
    try {
      json = JSON.parse(readFileSync(join(DASHBOARD_DIR, f), 'utf8'))
    } catch {
      continue
    }
    const walk = (panels) => {
      for (const p of panels || []) {
        if (p.panels && p.panels.length) walk(p.panels)
        const ds = p.datasource || {}
        if (ds.type === 'loki' || ds.uid === 'Loki') {
          for (const t of p.targets || []) {
            if (t && typeof t.expr === 'string' && t.expr.trim()) {
              out.push({ file: f, title: p.title || '(无标题)', type: p.type, expr: t.expr.trim() })
            }
          }
        }
      }
    }
    walk(json.panels)
  }
  return out
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    console.info(
      '用法: node scripts/verify-grafana-logql-panels.mjs [--window 6h] [--loki http://127.0.0.1:3100] [--dashboard ai-logs]'
    )
    process.exit(0)
  }
  const windowSec = parseWindow(args.window)
  if (!windowSec) {
    console.error(`❌ --window 格式不对: ${args.window}(示例 30m / 6h / 24h)`)
    process.exit(2)
  }

  // Loki 地址也是现读:先探默认回环端口,通就用,不通就把候选都试一遍。
  let base = args.loki
  if (!base) {
    for (const port of [3100, 9080]) {
      const candidate = `http://127.0.0.1:${port}`
      try {
        const res = await fetch(new URL('/loki/api/v1/labels', candidate), { signal: AbortSignal.timeout(3000) })
        if (res.ok || res.status === 404) {
          base = candidate
          break
        }
      } catch {
        /* 换下一个候选 */
      }
    }
  }
  if (!base) {
    console.error('❌ 探不到本机 Loki(试过 3100 / 9080)。用 --loki 显式指定。')
    process.exit(2)
  }

  const panels = collectLokiPanels(args.dashboard)
  if (!panels.length) {
    console.info(`ℹ️  未找到 Loki 面板${args.dashboard ? '(过滤:' + args.dashboard + ')' : ''}`)
    process.exit(0)
  }

  const stepSec = Math.max(60, Math.floor(windowSec / 200))
  const endSec = Math.floor(Date.now() / 1000)
  const startSec = endSec - windowSec
  console.info(`Loki: ${base}   窗口: ${args.window}(${startSec} → ${endSec})   step: ${stepSec}s`)
  console.info(`待核验 Loki 面板表达式: ${panels.length} 条\n`)

  const empty = []
  const failed = []
  for (const p of panels) {
    const expr = substitute(p.expr)
    const r = isMetricQuery(expr)
      ? await lokiMetricRange(base, expr, startSec, endSec, stepSec)
      : await lokiRange(base, expr, startSec, endSec)
    const mark = !r.ok ? '❌' : r.empty ? '⚠️ ' : '✅'
    console.info(`${mark} [${p.file}] ${p.title} :: ${r.detail}`)
    if (!r.ok) failed.push({ ...p, detail: r.detail })
    else if (r.empty) empty.push({ ...p, detail: r.detail })
  }

  console.info('')
  console.info(`汇总: ${panels.length} 条表达式,有数 ${panels.length - empty.length - failed.length},空板 ${empty.length},查询失败 ${failed.length}`)
  if (empty.length) {
    console.info('\n空板明细(这些面板在所选窗口内零命中 —— 要么真没事件,要么 LogQL 没对上):')
    for (const e of empty) console.info(`  · [${e.file}] ${e.title}\n      ${e.expr}`)
  }
  if (failed.length) {
    console.info('\n查询失败明细:')
    for (const f of failed) console.info(`  · [${f.file}] ${f.title}: ${f.detail}\n      ${f.expr}`)
  }
  // 有空板/失败 ⇒ 退出码 1,方便排期脚本与人工巡检接住;但**不要**接成提交门(依赖运行时)。
  process.exit(empty.length || failed.length ? 1 : 0)
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main().catch((e) => {
    console.error('❌ ' + (e && e.stack ? e.stack : e))
    process.exit(1)
  })
}

export { substitute, isMetricQuery, collectLokiPanels, parseWindow }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
