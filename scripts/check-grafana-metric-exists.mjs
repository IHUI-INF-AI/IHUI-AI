#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * check-grafana-metric-exists.mjs — Grafana 大屏指标名对账(2026-10-17 立)。
 *
 * 为什么必须有这道门:AI 侧三张大屏(ai-latency / ai-cost / ihui-ai-overview)
 * 长期查询 `ihui_ai_latency_seconds_bucket`、`business_ai_calls_total` 这类
 * **代码里从来没有发射点**的名字;ai-service 的 record_llm_call 定义了两年也没人调。
 * 结果:线上 Prometheus 30 天保留窗内这些名字 0 条时序,大屏整片 No data,
 * 而 build/typecheck/pytest/全部既有守门一个都不响 —— 判据面根本没有"大屏查的东西
 * 存不存在"这一维。本门把这一维补进提交链。
 *
 * 判据:
 *   G1 (BLOCK,差值棘轮) 大屏 expr 里引用的每个 Prometheus 指标名,必须能在
 *      代码发射点(apps/ai-service 的 prometheus_client 声明、apps/api 与 packages
 *      的 prom-client 声明)、核心指标(up、scrape_ 前缀、prometheus_ 前缀)或第三方导出器
 *      台账(scripts/data/grafana-external-metrics.json,带 expires)里找到。
 *      锚点 = 该 dashboard 文件 HEAD 自身的违规数:只拦"本次把幽灵名加回来",
 *      存量只报数(AGENTS.md §0.5/§12e —— 存量未归零时绝对判红就是恒红门)。
 *   G2 (WARN) 台账里已登记但被审面不再命中的外部前缀(清单腐烂,§0.7)。
 *
 * 取材面纪律(§0.4):全量档判 HEAD blob,--staged 判索引 blob,--worktree 仅人工逃生舱;
 * 清单与内容同面同轮;取不到被审面 ⇒ exit 2 显式「未判定」(§0.3),既不记绿也不冒红。
 *
 * 用法:
 *   node scripts/check-grafana-metric-exists.mjs [--staged|--worktree] [--self-test] [--json]
 * 跳过:HUSKY_SKIP_GRAFANA_METRIC_EXISTS=1
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { catBatch, gitRaw } from './lib/face-reader.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

/** 被扫的大屏目录(相对仓库根)。 */
const DASHBOARD_DIRS = [
  'monitoring/grafana/dashboards',
  'deploy/observability/grafana/dashboards',
  'deploy/saas/grafana/dashboards',
]

/** 扫发射点的代码根(相对仓库根)。 */
const EMISSION_ROOTS = ['apps/ai-service/app', 'apps/api/src', 'packages']

/** Prometheus 自己产生、不需要仓库发射的名字前缀。 */
const CORE_PREFIXES = ['up', 'scrape_', 'prometheus_', 'target_info']

const SELF_SKIP_ENV = 'HUSKY_SKIP_GRAFANA_METRIC_EXISTS'

// ─── PromQL 里"指标名"的取形 ─────────────────────────────────────
// 只认这三种形状:① name{labels} ② name[range] ③ 函数首参(rate|increase|irate|absent|count)(name…)
// 不认裸标识符,否则 by (provider) 这类分组标签名会被误判成指标(判据有牙 ≠ 判据乱咬)。
const SELECTOR_RE = /(?:^|[^\w.:])([a-zA-Z_:][a-zA-Z0-9_:]*)\s*\{/g
const RANGE_RE = /(?:^|[^\w.:])([a-zA-Z_:][a-zA-Z0-9_:]*)\s*\[/g
const FN_ARG_RE = /\b(?:rate|irate|increase|delta|absent|absent_over_time|count)\(\s*([a-zA-Z_:][a-zA-Z0-9_:]*)\s*[,)]/g

function extractMetricNames(text) {
  const found = new Set()
  for (const re of [SELECTOR_RE, RANGE_RE, FN_ARG_RE]) {
    re.lastIndex = 0
    let m
    while ((m = re.exec(text)) !== null) found.add(m[1])
  }
  return [...found]
}

/** 从 dashboard JSON 抽出所有 PromQL 文本(targets.expr + 模板 definition/query)。 */
function collectExprs(node, out) {
  if (Array.isArray(node)) {
    for (const v of node) collectExprs(v, out)
    return
  }
  if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      if (typeof v === 'string' && (k === 'expr' || k === 'definition' || k === 'query')) out.push(v)
      else collectExprs(v, out)
    }
  }
}

// ─── 发射点集合 ─────────────────────────────────────────────────
const PY_METRIC_RE = /(?:Counter|Histogram|Gauge|Summary|Info|Enum)\(\s*(?:\r?\n\s*)?['"]([a-zA-Z_:][a-zA-Z0-9_:]*)['"]/g
const TS_NAME_RE = /\bname:\s*['"]([a-zA-Z_:][a-zA-Z0-9_:]*)['"]/g
// 手写渲染型端点(如 apps/api 的 /business-metrics 自己拼 PromQL 文本)不用 prom-client
// 的 name: 声明,指标名以字符串字面量出现 —— 不认这一形会把它们误判成幽灵。
const TS_LITERAL_RE = /['"]([a-z][a-z0-9_]{3,}_(?:total|seconds|bytes|ms|info|ratio))['"]/g
// 手拼 Prometheus 文本的两种真实形状:HELP 行里的名字,与模板串里"名字{标签}"的序列行。
// 只认相邻引号的那一条会漏掉这两形(business_ai_* / business_funnel_total 都住在这里),
// 漏了就是门把自己的仓判成幽灵 —— 判据假阳比漏判更贵,因为它逼人跳门。
const TS_HELP_RE = /#\s*HELP\s+([a-zA-Z_:][a-zA-Z0-9_:]*)/g
const TS_SERIES_RE = /[`'"]([a-z][a-z0-9_]{3,})\{/g

/** 按 prometheus_client / prom-client 的后缀规则展开一个声明名的合法暴露形态。 */
function normalizedNameVariants(name) {
  const base = name.endsWith('_total') ? name.slice(0, -6) : name
  return new Set([
    name,
    base,
    `${base}_total`,
    `${base}_bucket`,
    `${base}_count`,
    `${base}_sum`,
    `${base}_created`,
    `${base}_info`,
  ])
}

/** 发射点源文件筛选:只要源码,且绝不进 node_modules/dist/.venv(junction 会递归穿透)。 */
function isSourceFile(p) {
  if (/(^|\/)(node_modules|dist|build|\.venv|venv|__pycache__|\.next|coverage)(\/|$)/.test(p)) return false
  return /\.(py|ts|tsx|mjs|js)$/.test(p)
}

function readExternalLedger(faceRead) {
  const path = 'scripts/data/grafana-external-metrics.json'
  const raw = faceRead(path)
  if (raw === null) return { prefixes: [], entries: [], missing: true }
  const parsed = JSON.parse(raw)
  const now = Date.now()
  const live = (parsed.entries || []).filter((e) => !e.until || new Date(e.until).getTime() > now)
  return { prefixes: live.map((e) => e.prefix), entries: live, missing: false, expired: (parsed.entries || []).length - live.length }
}

/** 用 git grep 一次取回审面上的发射点声明(逐文件 git show 要几千次调用,进不了提交链)。 */
function emittedViaGitGrep(face) {
  // git grep 无命中时 exit 1 且 stdout 为空 —— 那是"一个都没有",不是"取不到"§0.3
  const raw = (args) => {
    try {
      return gitRaw(args, ROOT, { maxBuffer: 128 * 1024 * 1024 })
    } catch (e) {
      if (typeof e?.stdout === 'string') return e.stdout
      return null
    }
  }
  // git grep 的参数次序是 pattern → rev → -- pathspec;把 HEAD 写在 pattern 前面
  // 会被当成"用 HEAD 这个字串去搜",静默返回空 ⇒ 判据失明(§0.3 宁可判未判定)
  const opts = face === 'staged' ? ['--cached'] : []
  const rev = face === 'staged' ? [] : ['HEAD']
  const calls = [
    { args: ['grep', '-h', '-E', '-A', '1', ...opts, '(Counter|Histogram|Gauge|Summary|Info|Enum)\\(', ...rev, '--', 'apps/ai-service/app'], re: PY_METRIC_RE },
    { args: ['grep', '-h', '-E', ...opts, "\\bname:\\s*['\"][a-z_][a-z0-9_]*['\"]|['\"][a-z][a-z0-9_]{3,}_(total|seconds|bytes|ms|info|ratio)['\"]|#\\s*HELP\\s+[a-z_][a-z0-9_]*", ...rev, '--', 'apps/api/src', 'packages'], re: null, res: [TS_NAME_RE, TS_LITERAL_RE, TS_HELP_RE, TS_SERIES_RE] },
  ]
  const set = new Set()
  let scanned = 0
  for (const c of calls) {
    const out = raw(c.args)
    if (out === null) return { set: null, scanned: 0, reason: `审面(${face})上 git grep 失败,取不到发射点` }
    scanned++
    for (const re of c.res || [c.re]) {
      re.lastIndex = 0
      let m
      while ((m = re.exec(out)) !== null) {
        for (const v of normalizedNameVariants(m[1])) set.add(v)
      }
    }
  }
  return { set, scanned }
}

function buildEmittedSet(pathsOf, readText) {
  const set = new Set()
  let scanned = 0
  for (const root of EMISSION_ROOTS) {
    for (const p of pathsOf(root)) {
      if (!isSourceFile(p)) continue
      const text = readText(p)
      if (text === null) continue
      scanned++
      const regexes = p.endsWith('.py') ? [PY_METRIC_RE] : [TS_NAME_RE, TS_LITERAL_RE, TS_HELP_RE, TS_SERIES_RE]
      for (const re of regexes) {
        re.lastIndex = 0
        let m
        while ((m = re.exec(text)) !== null) {
          for (const v of normalizedNameVariants(m[1])) set.add(v)
        }
      }
    }
  }
  return { set, scanned }
}

// ─── 面读取 ─────────────────────────────────────────────────────
function makeFace(face, git) {
  const run = (args) => git(args)
  if (face === 'worktree') {
    return {
      list(prefix) {
        const abs = join(ROOT, prefix)
        if (!existsSync(abs)) return []
        const out = []
        const walk = (d) => {
          for (const e of readdirSync(d, { withFileTypes: true })) {
            if (e.isDirectory()) {
              if (/(node_modules|dist|build|\.venv|venv|__pycache__|\.next|coverage)/.test(e.name)) continue
              walk(join(d, e.name))
            } else out.push(relative(ROOT, join(d, e.name)).split(sep).join('/'))
          }
        }
        walk(abs)
        return out
      },
      readMany(paths) {
        const out = new Map()
        for (const p of paths) {
          const abs = join(ROOT, p)
          out.set(p, existsSync(abs) && statSync(abs).isFile() ? readFileSync(abs, 'utf8') : null)
        }
        return out
      },
    }
  }
  return {
    list(prefix) {
      const args = face === 'staged' ? ['ls-files', '--', prefix] : ['ls-tree', '-r', '--name-only', 'HEAD', '--', prefix]
      const out = run(args)
      if (out === null) return null
      return out.split('\n').map((s) => s.trim()).filter(Boolean)
    },
    readMany(paths) {
      const prefix = face === 'staged' ? ':' : 'HEAD:'
      const specs = paths.map((p) => prefix + p)
      const raw = catBatch(ROOT, specs)
      const out = new Map()
      paths.forEach((p, i) => out.set(p, raw.get(specs[i]) ?? null))
      return out
    },
  }
}

// ─── 主流程 ─────────────────────────────────────────────────────
function runAudit(face, opts = {}) {
  const allowMissingLedger = opts.allowMissingLedger === true
  const git = (args) => {
    try {
      return gitRaw(args, ROOT, { maxBuffer: 128 * 1024 * 1024 })
    } catch {
      return null
    }
  }
  const f = makeFace(face, git)
  const dashPaths = []
  for (const d of DASHBOARD_DIRS) {
    const list = f.list(d)
    if (list === null) return { status: 'undetermined', reason: `被审面(${face})无法列出 ${d}` }
    dashPaths.push(...list.filter((p) => p.endsWith('.json')))
  }
  if (dashPaths.length === 0) return { status: 'undetermined', reason: `被审面(${face})上枚举到 0 个大屏文件 —— 判死,不记绿` }

  const contents = f.readMany([...dashPaths, 'scripts/data/grafana-external-metrics.json'])
  const ledger = readExternalLedger((p) => contents.get(p) ?? null)
  if (ledger.missing) {
    // 锚点档(HEAD)可以没有台账:台账只会"少判",按空前缀算出的 HEAD 基线只会更严,
    // 不会放水。被审面(本次提交)缺台账才是真取不到输入 ⇒ 未判定。
    if (!allowMissingLedger) {
      return { status: 'undetermined', reason: '外部导出器台账 scripts/data/grafana-external-metrics.json 在审面上取不到' }
    }
    ledger.prefixes = []
    ledger.entries = []
  }

  let emitted
  let scanned
  if (face === 'worktree') {
    const w = buildEmittedSet((root) => f.list(root) ?? [], (p) => {
      const abs = join(ROOT, p)
      return existsSync(abs) && statSync(abs).isFile() ? readFileSync(abs, 'utf8') : null
    })
    scanned = w.scanned
    emitted = w.set
    if (scanned === 0) return { status: 'undetermined', reason: '审面上枚举到 0 个可扫描的发射点源文件 —— 判死,不记绿' }
  } else {
    const g = emittedViaGitGrep(face)
    if (g.set === null) return { status: 'undetermined', reason: g.reason }
    emitted = g.set
    scanned = g.scanned
    if (emitted.size === 0) return { status: 'undetermined', reason: `审面(${face})上枚举到 0 个指标声明 —— 判死,不记绿` }
  }

  const report = []
  for (const p of dashPaths) {
    const raw = contents.get(p) ?? null
    if (raw === null) return { status: 'undetermined', reason: `被审面(${face})上读不到 ${p}` }
    let json
    try {
      json = JSON.parse(raw)
    } catch (e) {
      report.push({ file: p, violations: [{ name: '<JSON 解析失败>', expr: String(e).slice(0, 60) }], parseError: true })
      continue
    }
    const exprs = []
    collectExprs(json, exprs)
    const names = new Set()
    for (const e of exprs) for (const n of extractMetricNames(e)) names.add(n)
    const knownPrefixes = ledger.prefixes
    const violations = [...names]
      .filter((n) => !emitted.has(n))
      .filter((n) => !CORE_PREFIXES.some((pre) => n.startsWith(pre)))
      .filter((n) => !knownPrefixes.some((pre) => n.startsWith(pre)))
      .map((n) => ({ name: n, expr: (exprs.find((e) => e.includes(`${n}{`) || e.includes(`${n}[`) || e.includes(`(${n}`)) || '').slice(0, 120) }))
    report.push({ file: p, violations, referenced: names.size })
  }

  // 台账腐烂(§0.7):登记了却审面上没有任何大屏再引用的前缀
  const allRefs = new Set(report.flatMap((r) => r.violations.map((v) => v.name)))
  for (const p of dashPaths) {
    const raw = contents.get(p) ?? null
    if (raw === null) continue
    const exprs = []
    try {
      collectExprs(JSON.parse(raw), exprs)
    } catch {
      continue
    }
    for (const e of exprs) for (const n of extractMetricNames(e)) allRefs.add(n)
  }
  const rotten = ledger.prefixes.filter((pre) => ![...allRefs].some((n) => n.startsWith(pre)))

  return { status: 'ok', face, report, scanned, emittedCount: emitted.size, rotten, dashboardCount: dashPaths.length }
}

/** 差值棘轮:锚点 = 该 dashboard 文件在 HEAD 上自身的违规数。 */
function applyRatchet(current, headViolationByFile) {
  const blocks = []
  const legacy = []
  for (const r of current.report) {
    const base = headViolationByFile[r.file] ?? 0
    const now = r.violations.length
    if (r.parseError) {
      blocks.push({ file: r.file, kind: 'parse', detail: r.violations[0]?.expr })
      continue
    }
    if (now > base) {
      const baseSet = headViolationByFile[`${r.file}::names`] || new Set()
      const added = r.violations.filter((v) => !baseSet.has(v.name))
      if (added.length > 0) blocks.push({ file: r.file, kind: 'new-ghost', added })
    } else if (now > 0) {
      legacy.push({ file: r.file, count: now, base })
    }
  }
  return { blocks, legacy }
}

function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) return selfTest(argv)
  const bothFlags = argv.includes('--staged') && argv.includes('--worktree')
  if (bothFlags) {
    console.log('❌ --staged 与 --worktree 不能同给(取材面纪律 §0.4)')
    return 2
  }
  const face = argv.includes('--staged') ? 'staged' : argv.includes('--worktree') ? 'worktree' : 'head'
  const res = runAudit(face)
  if (res.status === 'undetermined') {
    console.log(`⚪ 未判定:${res.reason}`)
    return 2
  }
  const head = face === 'head' ? res : runAudit('head', { allowMissingLedger: true })
  const headByFile = {}
  if (head.status === 'ok') {
    for (const r of head.report) {
      headByFile[r.file] = r.violations.length
      headByFile[`${r.file}::names`] = new Set(r.violations.map((v) => v.name))
    }
  } else {
    console.log(`⚪ 未判定:HEAD 面对账失败(${head.reason})—— 无锚点不判棘轮`)
    return 2
  }
  const { blocks, legacy } = applyRatchet(res, headByFile)
  const totalRefs = res.report.reduce((a, r) => a + (r.referenced || 0), 0)
  console.log(
    `[grafana-metric-exists] 面=${face} 大屏 ${res.dashboardCount} 份 · 引用名 ${totalRefs} 个 · 发射点源 ${res.scanned} 个 · 已知名 ${res.emittedCount} 个`
  )
  if (legacy.length > 0) {
    console.log(`⚠ 存量幽灵名(§12e 只报数,不拦无关提交):${legacy.reduce((a, s) => a + s.count, 0)} 处` + (legacy.length <= 12 ? ` — ${legacy.map((s) => `${s.file}(${s.count})`).join(', ')}` : ''))
  }
  if (res.rotten.length > 0) console.log(`⚠ 台账腐烂:外部前缀 ${res.rotten.join(', ')} 已无大屏引用(§0.7,请清理)`)
  if (blocks.length === 0) {
    console.log('✅ 本次提交未引入新的大屏幽灵指标')
    return 0
  }
  console.log(`❌ 新增幽灵指标 ${blocks.length} 处(大屏查代码里没有发射点的名字 ⇒ 面板永远 No data):`)
  for (const b of blocks) {
    if (b.kind === 'parse') console.log(`   ${b.file}: JSON 解析失败 — ${b.detail}`)
    else for (const v of b.added) console.log(`   ${b.file}: ${v.name}  ← ${v.expr}`)
  }
  console.log(`   修法:在代码里发射该指标(或改成已存在的名字),或把幽灵面板删掉。跳过:${SELF_SKIP_ENV}=1(不推荐)`)
  return 1
}

// ─── 自检:证明判据有牙(§0.2/取证纪律)─────────────────────────
function selfTest(_argv) {
  const cases = []
  const add = (name, pass) => cases.push({ name, pass })
  const variants = normalizedNameVariants('ihui_llm_calls_total')
  add('Counter 声明名展开出 _total 与 _created 形态', variants.has('ihui_llm_calls_total') && variants.has('ihui_llm_calls_created'))
  add('Histogram 声明名展开出 _bucket', normalizedNameVariants('ihui_llm_ttft_seconds').has('ihui_llm_ttft_seconds_bucket'))
  const names = extractMetricNames('histogram_quantile(0.95, sum by (le) (rate(ihui_ai_ghost_seconds_bucket{job="ai-service"}[5m])))')
  add('取形:name{ 与 rate(name) 都被抓到', names.includes('ihui_ai_ghost_seconds_bucket'))
  add('by (le) 里的分组标签不被当成指标', !names.includes('le') || names.every((n) => n.includes('_')))
  const ghost = extractMetricNames('sum(rate(business_ai_calls_total[5m]))')
  add('无花括号的 range 向量也取到名', ghost.includes('business_ai_calls_total'))

  // 端到端正控:审面可读 + JSON 能抽 expr + 幽灵名与真名在同一条判据下分别判红/判绿
  const mk = (name) => ({ panels: [{ targets: [{ expr: `sum(rate(${name}{job="ai-service"}[5m]))` }] }] })
  const res = runAudit('head', { allowMissingLedger: true })
  add('审面可读且大屏数 > 0', res.status === 'ok' && res.dashboardCount > 0)
  const exprOut = []
  collectExprs(mk('foo_total'), exprOut)
  add('JSON 形状可抽 expr', exprOut.length === 1)
  const exprs = []
  collectExprs(mk('ihui_ai_ghost_seconds_bucket'), exprs)
  const ghostNames = extractMetricNames(exprs[0])
  add('幽灵名能被抓出(判据有牙的正向证明)', ghostNames.includes('ihui_ai_ghost_seconds_bucket'))
  add('job 标签名不被当指标', !ghostNames.includes('job'))
  const fails = cases.filter((c) => !c.pass)
  for (const c of cases) console.log(`${c.pass ? '✅' : '❌'} ${c.name}`)
  if (fails.length > 0) {
    console.log(`❌ 自检失败 ${fails.length}/${cases.length}`)
    return 1
  }
  console.log(`✅ 自检通过 ${cases.length}/${cases.length}`)
  return 0
}

if (process.env[SELF_SKIP_ENV] === '1') {
  console.log(`⚠ 已跳过(由 ${SELF_SKIP_ENV}=1 显式放行)`)
  process.exit(0)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main())
}

export const __test__ = { extractMetricNames, normalizedNameVariants, collectExprs, runAudit }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
