#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 把 Grafana 大屏里**每一张盘、每一个面板、每一条查询表达式**(PromQL + LogQL)拿去本机
 * 数据源真跑一遍,按五档报:有数 / 全零 / 空板 / 查询失败 / 未判定。
 *
 * 立因(2026-10-17):幽灵指标门(220)只证明"大屏查的名字代码里有",数据源接线门(222)只
 * 证明"引用的 uid 存在"。这两条都不等于**面板上真有曲线**:标签名写错、正则没命中、
 * 变量在下拉里根本选不出值,都会让一个语法合法、指标存在的面板整片空白。而"有没有数"
 * 此前只有人打开浏览器一张张盘翻才知道——翻一张漏一张,漏了也没人记下。
 *
 * 本脚本把这件事变成一条命令列全表。五档里最要紧的是分清「全零」与「空板」:
 * 告警数、错误数这类**本来就该是 0** 的面板,查得到序列但值为 0 ⇒ 全零,是健康;
 * 一条序列都匹配不到 ⇒ 空板,是缺陷。把前者当缺陷去"修",就是把正确判据改坏。
 *
 * 「未判定」是第三档(§0.3):面板引用的模板变量在数据源里**一个值都解析不出来**
 * (下拉是空的),此时任何查询结果都不构成证据,既不记绿也不冒红,直接点名。
 * 这一档同时抓出另一种病:变量声明了却没有任何面板引用它 ⇒ 死控件,报在变量段。
 *
 * 与提交门的关系:**它不是守门,也不许接成守门**。它依赖运行时(本机 Prometheus/Loki
 * 真在跑),接进 pre-commit 就是 §12e 恒红门。用法是人工巡检 / 大屏改造前后的收口自证。
 *
 * 用法:
 *   node scripts/verify-grafana-panel-data.mjs                       # 近 6h,monitoring 树全量
 *   node scripts/verify-grafana-panel-data.mjs --window 24h
 *   node scripts/verify-grafana-panel-data.mjs --dashboard ai-cost    # 只看某一张(子串匹配)
 *   node scripts/verify-grafana-panel-data.mjs --dir deploy/observability/grafana/dashboards
 *   node scripts/verify-grafana-panel-data.mjs --json                # 机读(供其它器物消费)
 *   node scripts/verify-grafana-panel-data.mjs --self-test
 */
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
// 指标名取形只认一份实现(§22c 单一真相源):门 220 的形状表改了就自动跟,不留第二份会漂移的副本。
import { __test__ as metricGate } from './check-grafana-metric-exists.mjs'

const metricNames = metricGate.extractMetricNames

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DEFAULT_DIR = join(ROOT, 'monitoring', 'grafana', 'dashboards')
const PROM_PORTS = [8815, 9090]
const LOKI_PORTS = [3100, 9080]

const BUILTIN_VARS = [
  [/\$__rate_interval/g, '5m'],
  [/\${__rate_interval}/g, '5m'],
  [/\$__interval_ms/g, '1000'],
  [/\$__interval/g, '5m'],
  [/\${__interval}/g, '5m'],
  [/\$__auto/g, '5m'],
  [/\${__auto}/g, '5m'],
]

function parseArgs(argv) {
  const out = {
    window: '6h',
    prometheus: null,
    loki: null,
    dashboard: null,
    dir: DEFAULT_DIR,
    json: false,
    selfTest: false,
    help: false,
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--window') out.window = argv[++i]
    else if (a === '--prometheus') out.prometheus = argv[++i]
    else if (a === '--loki') out.loki = argv[++i]
    else if (a === '--dashboard') out.dashboard = argv[++i]
    else if (a === '--dir') out.dir = resolve(ROOT, argv[++i])
    else if (a === '--json') out.json = true
    else if (a === '--self-test') out.selfTest = true
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

/** Grafana 变量在面板里是字面量;先把内置量换成能落地的区间,再把 $name / [[name]] 换成解析出的值。 */
function substitute(expr, varValues, window) {
  let out = String(expr)
  out = out.replace(/\$__range/g, window).replace(/\${__range}/g, window)
  for (const [re, to] of BUILTIN_VARS) out = out.replace(re, to)
  for (const [name, value] of Object.entries(varValues || {})) {
    out = out
      .split(`\${${name}}`)
      .join(value)
      .split(`[[${name}]]`)
      .join(value)
      // 函数形态的 replacement:value 里的 `$&`、`$1` 才会被当字面量而不是捕获组引用
      .replace(new RegExp(`\\$${name}(?![A-Za-z0-9_])`, 'g'), () => value)
  }
  return out
}

/**
 * 下拉里的真值并进正则匹配串:逐个再用 | 连。
 * **不做转义** —— Grafana 替换变量时也不转义(`.` 在正则里匹配任意字符,照样命中真实值)。
 * 在这里转义会得到 `127\.0\.0\.1`,而 PromQL 字符串字面量不吃 `\.` 这个转义形 ⇒ 整条查询 400。
 */
function toMatcherValue(values) {
  return values.map((v) => String(v)).join('|')
}

/** 变量在表达式里到底有没有被引用——没引用就是下拉死控件,不必为它连数据源。 */
function usesVar(expr, name) {
  return (
    expr.includes(`$${name}`) ||
    expr.includes(`[[${name}]]`) ||
    new RegExp(`\\$\\{${name}(?::[^}]*)?\\}`).test(expr)
  )
}

/** label_values(metric, label) / label_values(metric, label, filter) → 取该 label 的现值。 */
function parseLabelValuesQuery(q) {
  const m = String(q || '').match(/^label_values\(\s*([^,]+),\s*([^,)]+)(?:,[^)]*)?\)/)
  if (!m) return null
  return { metric: m[1].trim(), label: m[2].trim() }
}

function isMetricQuery(expr) {
  return /\b(rate|count_over_time|sum_over_time|avg_over_time|quantile_over_time|bytes_rate|bytes_over_time)\s*\(/.test(
    expr
  )
}

async function fetchJson(url, ms) {
  const res = await fetch(url, { signal: AbortSignal.timeout(ms) })
  const text = await res.text()
  let body = null
  try {
    body = JSON.parse(text)
  } catch {
    /* 非 JSON:交给调用方按 status 判 */
  }
  return { status: res.status, ok: res.ok, body, text }
}

async function probeBaseUrl(ports, path) {
  for (const port of ports) {
    const base = `http://127.0.0.1:${port}`
    try {
      const r = await fetchJson(new URL(path, base), 3000)
      if (r.ok || r.status === 404) return base
    } catch {
      /* 换下一个候选 */
    }
  }
  return null
}

/** 变量的查询文本有三种历史形状:字符串、{qry}、CloudWatch 遗留下的 {expression}。都认。 */
function varQueryText(v) {
  if (typeof v.query === 'string') return v.query
  if (v.query && typeof v.query === 'object') return v.query.qry || v.query.expression || ''
  return v.definition || ''
}

/** 变量解析:返回 {status:'ok'|'empty', values};解析不出值 ⇒ 用它的面板一律「未判定」。 */
async function resolveVar(promBase, v) {
  if (v.type === 'custom' || v.type === 'constant') {
    const raw = String(v.query || v.current?.value || '').split(',').map((s) => s.trim()).filter(Boolean)
    return raw.length ? { status: 'ok', values: raw } : { status: 'empty', values: [] }
  }
  if (v.type === 'textbox') return { status: 'ok', values: [v.current?.value ?? '.*'] }
  const lv = parseLabelValuesQuery(varQueryText(v) || v.definition || '')
  if (!lv) return { status: 'empty', values: [], note: '非 label_values 形态,无法离线解析取值' }
  // 第一个参数既可能是裸指标名(up),也可能已经是选择器(up{job=~"a|b"})——后者要原样送进 match[],
  // 再包一层 {__name__="..."} 会得到一个永不匹配的表达式,把活下拉读成死下拉。
  const selector = lv.metric.includes('{') ? lv.metric : `{__name__="${lv.metric}"}`
  const url = new URL(`/api/v1/label/${encodeURIComponent(lv.label)}/values`, promBase)
  url.searchParams.set('match[]', selector)
  const r = await fetchJson(url, 20000)
  if (!r.ok || !r.body) return { status: 'empty', values: [], note: `HTTP ${r.status}` }
  const values = (r.body.data || []).filter((s) => s !== '')
  return values.length ? { status: 'ok', values } : { status: 'empty', values: [] }
}

async function promRange(base, expr, startSec, endSec, stepSec) {
  const url = new URL('/api/v1/query_range', base)
  url.searchParams.set('query', expr)
  url.searchParams.set('start', String(startSec))
  url.searchParams.set('end', String(endSec))
  url.searchParams.set('step', String(stepSec))
  const r = await fetchJson(url, 45000)
  if (!r.ok) {
    return { verdict: 'failed', detail: `HTTP ${r.status} ${(r.body?.error || r.text).slice(0, 160)}` }
  }
  return classifyMatrix(r.body?.data?.result || [])
}

function classifyMatrix(result) {
  let nonZero = 0
  let total = 0
  let max = 0
  for (const s of result) {
    const points = s.values || s.samples || []
    for (const [, v] of points) {
      total++
      const n = Number(v)
      if (Number.isFinite(n) && n !== 0) nonZero++
      if (Number.isFinite(n) && n > max) max = n
    }
  }
  if (!result.length) return { verdict: 'empty', detail: '0 条序列' }
  if (nonZero === 0) return { verdict: 'allzero', detail: `${result.length} 条序列,${total} 个点全零` }
  return { verdict: 'data', detail: `${result.length} 条序列,${nonZero}/${total} 个点非零,峰值 ${max}` }
}

async function lokiRange(base, expr, startSec, endSec) {
  const url = new URL('/loki/api/v1/query_range', base)
  url.searchParams.set('query', expr)
  url.searchParams.set('start', String(startSec))
  url.searchParams.set('end', String(endSec))
  url.searchParams.set('limit', '200')
  url.searchParams.set('direction', 'backward')
  url.searchParams.set('step', '60')
  const r = await fetchJson(url, 40000)
  if (!r.ok) return { verdict: 'failed', detail: `HTTP ${r.status} ${(r.body?.error || r.text).slice(0, 160)}` }
  const result = r.body?.data?.result || []
  const lines = result.reduce((acc, s) => acc + (s.values ? s.values.length : 0), 0)
  return { verdict: lines === 0 ? 'empty' : 'data', detail: `${lines} 行(上限 200)` }
}

function loadDashboards(dir, filter) {
  const out = []
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.json'))) {
    if (filter && !f.includes(filter)) continue
    let json
    try {
      json = JSON.parse(readFileSync(join(dir, f), 'utf8'))
    } catch (e) {
      out.push({ file: f, error: `JSON 解析失败: ${e.message}` })
      continue
    }
    out.push({ file: f, json })
  }
  return out
}

/** 摊平面板(含 row 的子面板),row/文本面板不产表达式,但要进"死控件"统计的分母。 */
function collectTargets(json) {
  const rows = []
  const walk = (panels) => {
    for (const p of panels || []) {
      if (Array.isArray(p.panels) && p.panels.length) walk(p.panels)
      if (p.type === 'row') continue
      for (const t of p.targets || []) {
        const expr = String(t.expr ?? t.query ?? '').trim()
        if (!expr) continue
        const ds = p.datasource || {}
        rows.push({
          panel: p.title || '(无标题)',
          panelId: p.id,
          panelType: p.type,
          dsKind: ds.type === 'loki' || ds.uid === 'Loki' ? 'loki' : 'prometheus',
          expr,
        })
      }
    }
  }
  walk(json.panels)
  return rows
}

function varNames(json) {
  return (json.templating?.list || []).filter((v) => v && v.name)
}

/**
 * 版面坐标对账(与"有没有数"是两件事,但都属于"这张盘打开来看是对的"):
 * 两块面板 gridPos 相交 ⇒ 其中一块被压在下面,肉眼看就是"面板不见了";
 * x+w>24 ⇒ Grafana 24 列栅格溢出,右侧被裁。2026-10-17 实测 24 张盘里 hls 盘的流水账文本板
 * 正是压住了唯一图表(24×3@y0 覆 12×8@y0),而全部静态门对此一无所觉。
 */
function gridPosIssues(json) {
  const cells = (json.panels || []).filter((p) => p.type !== 'row' && p.gridPos)
  const out = []
  for (const p of cells) {
    const g = p.gridPos
    if (g.x + g.w > 24) out.push(`「${p.title}」超出 24 列(x=${g.x} w=${g.w})`)
  }
  for (let i = 0; i < cells.length; i++)
    for (let k = i + 1; k < cells.length; k++) {
      const a = cells[i].gridPos
      const b = cells[k].gridPos
      if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h)
        out.push(`「${cells[i].title}」与「${cells[k].title}」重叠(a=[${a.x},${a.y},${a.w},${a.h}] b=[${b.x},${b.y},${b.w},${b.h}])`)
    }
  const noPos = (json.panels || []).filter((p) => p.type !== 'row' && !p.gridPos).map((p) => `「${p.title || '(无标题)'}」没有 gridPos`)
  return [...out, ...noPos]
}

async function run(opts) {
  const windowSec = parseWindow(opts.window)
  if (!windowSec) throw new Error(`--window 格式不对: ${opts.window}(示例 30m / 6h / 24h)`)

  const dashboards = loadDashboards(opts.dir, opts.dashboard)
  if (!dashboards.length) throw new Error(`目录里没有大屏:${opts.dir}(过滤:${opts.dashboard || '无'})`)

  const needProm = dashboards.some((d) => d.json && collectTargets(d.json).some((t) => t.dsKind === 'prometheus'))
  const needLoki = dashboards.some((d) => d.json && collectTargets(d.json).some((t) => t.dsKind === 'loki'))
  const promBase = opts.prometheus || (needProm ? await probeBaseUrl(PROM_PORTS, '/api/v1/status/buildinfo') : null)
  const lokiBase = opts.loki || (needLoki ? await probeBaseUrl(LOKI_PORTS, '/loki/api/v1/labels') : null)
  if (needProm && !promBase) throw new Error(`探不到本机 Prometheus(试过 ${PROM_PORTS.join(' / ')}),用 --prometheus 指定`)
  if (needLoki && !lokiBase) throw new Error(`探不到本机 Loki(试过 ${LOKI_PORTS.join(' / ')}),用 --loki 指定`)

  const stepSec = Math.max(60, Math.floor(windowSec / 200))
  const endSec = Math.floor(Date.now() / 1000)
  const startSec = endSec - windowSec

  const report = { prometheus: promBase, loki: lokiBase, window: opts.window, start: startSec, end: endSec, step: stepSec, dashboards: [] }

  // 指标全集现读一次:同一条"面板空白"有两个完全不同的成因 ——
  // ① 本机 Prometheus 里**没有这个指标名**(发射点没接线/没被抓取);② 指标在但标签组合匹配不到序列。
  // 不取全集就只能看到"0 条序列",修法会猜错方向。
  let liveNames = null
  if (promBase) {
    const r = await fetchJson(new URL('/api/v1/label/__name__/values', promBase), 30000)
    if (r.ok && Array.isArray(r.body?.data)) liveNames = new Set(r.body.data)
    else report.liveMetricUniverse = `取不到指标全集(HTTP ${r.status})⇒「本机无此指标」与「有指标无序列」两型不做区分`
  }

  for (const d of dashboards) {
    if (d.error) {
      report.dashboards.push({ file: d.file, broken: d.error })
      continue
    }
    const vars = varNames(d.json)
    const targets = collectTargets(d.json)
    const allExprs = targets.map((t) => t.expr).join('\n')
    const entry = { file: d.file, title: d.json.title, vars: [], panels: [], gridIssues: gridPosIssues(d.json) }

    for (const v of vars) {
      const referenced = usesVar(allExprs, v.name)
      const rec = { name: v.name, label: v.label || v.name, referenced }
      if (!referenced) {
        rec.status = 'dead-control'
        entry.vars.push(rec)
        continue
      }
      if (v.type === 'query' && !promBase) {
        rec.status = 'unjudged'
        rec.note = '未连 Prometheus'
        entry.vars.push(rec)
        continue
      }
      const resolved = await resolveVar(promBase, v)
      rec.status = resolved.status === 'ok' ? 'resolved' : 'empty'
      rec.count = resolved.values.length
      rec.sample = resolved.values.slice(0, 3)
      if (resolved.note) rec.note = resolved.note
      rec._values = resolved.values
      entry.vars.push(rec)
    }

    const varValues = {}
    const unjudgedVars = []
    for (const rec of entry.vars) {
      if (rec.status === 'resolved') varValues[rec.name] = toMatcherValue(rec._values)
      else if (rec.referenced && rec.status !== 'dead-control') unjudgedVars.push(rec.name)
    }

    for (const t of targets) {
      const referencedNames = entry.vars.filter((r) => r.referenced && usesVar(t.expr, r.name)).map((r) => r.name)
      const missing = referencedNames.filter((n) => unjudgedVars.includes(n))
      if (missing.length) {
        entry.panels.push({ ...t, verdict: 'unjudged', detail: `变量取不到值:${missing.join(', ')}` })
        continue
      }
      const expr = substitute(t.expr, varValues, opts.window)
      let r
      if (t.dsKind === 'loki') {
        r = isMetricQuery(expr)
          ? await lokiMetricRange(lokiBase, expr, startSec, endSec, stepSec)
          : await lokiRange(lokiBase, expr, startSec, endSec)
      } else {
        r = await promRange(promBase, expr, startSec, endSec, stepSec)
      }
      entry.panels.push({
        ...t,
        verdict: r.verdict,
        detail: r.detail,
        absent:
          t.dsKind === 'prometheus' && liveNames
            ? metricNames(t.expr).filter((n) => !liveNames.has(n))
            : [],
        resolved: expr === t.expr ? null : expr,
      })
    }
    for (const v of entry.vars) delete v._values
    report.dashboards.push(entry)
  }
  return report
}

function tallyPanels(report) {
  const t = { data: 0, allzero: 0, empty: 0, failed: 0, unjudged: 0 }
  for (const d of report.dashboards) for (const p of d.panels || []) t[p.verdict] = (t[p.verdict] || 0) + 1
  return t
}

async function lokiMetricRange(base, expr, startSec, endSec, stepSec) {
  const url = new URL('/loki/api/v1/query_range', base)
  url.searchParams.set('query', expr)
  url.searchParams.set('start', String(startSec))
  url.searchParams.set('end', String(endSec))
  url.searchParams.set('step', String(stepSec))
  const r = await fetchJson(url, 45000)
  if (!r.ok) return { verdict: 'failed', detail: `HTTP ${r.status} ${(r.body?.error || r.text).slice(0, 160)}` }
  return classifyMatrix(r.body?.data?.result || [])
}

const VERDICT_LABEL = {
  data: '✅ 有数',
  allzero: '◽ 全零',
  empty: '⚠️ 空板',
  failed: '❌ 查询失败',
  unjudged: '❔ 未判定',
}

function printReport(report, tally) {
  console.info(
    `Prometheus: ${report.prometheus || '—'}   Loki: ${report.loki || '—'}   窗口: ${report.window}(${report.start} → ${report.end})   step: ${report.step}s`
  )
  const deadControls = []
  for (const d of report.dashboards) {
    if (d.broken) {
      console.info(`\n━━━ ${d.file} ━━━\n❌ ${d.broken}`)
      continue
    }
    console.info(`\n━━━ ${d.file}(${d.title})━━━`)
    for (const v of d.vars) {
      if (v.status === 'dead-control') {
        deadControls.push(`${d.file}: $${v.name}(${v.label})`)
        console.info(`  ⚠️  变量 $${v.name}(${v.label})声明了但没有任何面板引用 ⇒ 下拉死控件`)
      } else if (v.status === 'empty') {
        console.info(`  ❔ 变量 $${v.name}(${v.label})取不到任何值 ⇒ 依赖它的面板一律未判定${v.note ? ' · ' + v.note : ''}`)
      } else if (v.status === 'unjudged') {
        console.info(`  ❔ 变量 $${v.name}(${v.label})未判定:${v.note}`)
      } else {
        console.info(`  ✅ 变量 $${v.name}(${v.label})解析出 ${v.count} 个值${v.count ? ',如 ' + v.sample.join(' / ') : ''}`)
      }
    }
    for (const p of d.panels) {
      const miss = p.absent && p.absent.length ? `  ⟪本机无此指标:${p.absent.join(', ')}⟫` : ''
      console.info(`  ${VERDICT_LABEL[p.verdict]} [${p.panelType}] ${p.panel} :: ${p.detail}${miss}`)
      if ((p.verdict === 'empty' || p.verdict === 'failed') && p.resolved) {
        console.info(`        实际跑的:${p.resolved.slice(0, 300)}`)
      }
    }
  }
  const total = Object.values(tally).reduce((a, b) => a + b, 0)
  const gridTotal = report.dashboards.reduce((a, d) => a + (d.gridIssues || []).length, 0)
  console.info(
    `\n汇总:${report.dashboards.length} 张盘 · ${total} 条表达式 —— 有数 ${tally.data} · 全零 ${tally.allzero} · 空板 ${tally.empty} · 失败 ${tally.failed} · 未判定 ${tally.unjudged}${deadControls.length ? ` · 死控件 ${deadControls.length}` : ''}${gridTotal ? ` · 版面异常 ${gridTotal}` : ''}`
  )
  if (gridTotal) {
    console.info('\n版面坐标异常(重叠=有面板被压住看不见;溢出 24 列=右侧被裁):')
    for (const d of report.dashboards) for (const g of d.gridIssues || []) console.info(`  · [${d.file}] ${g}`)
  }
  if (tally.empty) {
    console.info('\n空板明细(序列一条都没匹配到 —— 标签名/正则/指标族出了问题):')
    for (const d of report.dashboards)
      for (const p of d.panels || []) if (p.verdict === 'empty') console.info(`  · [${d.file}] ${p.panel}`)
  }
  if (tally.unjudged) {
    console.info('\n未判定明细(不记绿也不冒红,点名等处置):')
    for (const d of report.dashboards)
      for (const p of d.panels || []) if (p.verdict === 'unjudged') console.info(`  · [${d.file}] ${p.panel}: ${p.detail}`)
  }
  if (tally.failed) {
    console.info('\n查询失败明细:')
    for (const d of report.dashboards)
      for (const p of d.panels || [])
        if (p.verdict === 'failed') console.info(`  · [${d.file}] ${p.panel}: ${p.detail}\n      ${p.expr.slice(0, 240)}`)
  }
  const missing = new Map()
  for (const d of report.dashboards)
    for (const p of d.panels || []) for (const m of p.absent || []) missing.set(m, (missing.get(m) || 0) + 1)
  if (missing.size) {
    console.info(`\n本机 Prometheus 里没有这些指标名(${missing.size} 个,按被引用次数):`)
    for (const [m, c] of [...missing].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])))
      console.info(`  · ${m}(${c} 处面板引用)`)
    console.info('  ⇒ 每条只有两种正解:把发射点接上并被抓取,或把面板改成查真在场的指标。留着就是空板。')
  }
}

function selfTest() {
  const cases = []
  const ok = (name, cond, detail) => cases.push({ name, pass: !!cond, detail })

  ok('parseWindow 合法', parseWindow('6h') === 21600 && parseWindow('30m') === 1800)
  ok('parseWindow 非法返回 null', parseWindow('6x') === null)
  ok('内置量替换', substitute('rate(x[$__rate_interval])', {}, '6h') === 'rate(x[5m])')
  ok('$__range 换成窗口', substitute('increase(x[$__range])', {}, '24h') === 'increase(x[24h])')
  ok('变量值管道拼接不破坏正则', substitute('{instance=~"$instance"}', { instance: 'a:1|b:2' }, '6h') === '{instance=~"a:1|b:2"}')
  ok('toMatcherValue 与 Grafana 同形:不转义,只用 | 连(转义会让 PromQL 字符串 400)', toMatcherValue(['127.0.0.1:8802', 'localhost:9121']) === '127.0.0.1:8802|localhost:9121')
  ok('变量名后跟字符不误替换', substitute('{job=~"$jobx"}', { job: 'V' }, '6h') === '{job=~"$jobx"}')
  ok('[[name]] 形态也替换', substitute('{instance=~"[[instance]]"}', { instance: 'A' }, '6h') === '{instance=~"A"}')
  ok('usesVar 认 $name', usesVar('up{instance=~"$instance"}', 'instance') === true)
  ok('usesVar 不被长名误判', usesVar('up{a="$instx"}', 'instance') === false)
  ok('parseLabelValuesQuery 二参', JSON.stringify(parseLabelValuesQuery('label_values(a_total, instance)')) === '{"metric":"a_total","label":"instance"}')
  ok('parseLabelValuesQuery 三参', parseLabelValuesQuery('label_values(a, instance, b="c")').label === 'instance')
  ok('parseLabelValuesQuery 第一参允许整段选择器', parseLabelValuesQuery('label_values(up{job=~"a|b"}, instance)').metric === 'up{job=~"a|b"}')
  ok('classifyMatrix 零序列=空板', classifyMatrix([]).verdict === 'empty')
  ok('classifyMatrix 有序列全零=全零(不是空板)', classifyMatrix([{ values: [[1, '0'], [2, '0']] }]).verdict === 'allzero')
  ok('classifyMatrix 有非零=有数', classifyMatrix([{ values: [[1, '0'], [2, '3']] }]).verdict === 'data')
  ok('loki 聚合型判定', isMetricQuery('sum by (job) (rate({job="a"}[5m]))') === true && isMetricQuery('{job="a"}') === false)
  {
    // 版面档成对正反:证明它真能判出,也证明它不乱咬(hls 盘那块流水账文本板压住唯一图表即此型)
    const mkPanels = (y2) => ({ panels: [{ type: 'stat', title: 'A', gridPos: { h: 3, w: 24, x: 0, y: 0 } }, { type: 'timeseries', title: 'B', gridPos: { h: 8, w: 12, x: 0, y: y2 } }] })
    const hit = gridPosIssues(mkPanels(0))
    const miss = gridPosIssues(mkPanels(3))
    ok('版面档能判出重叠(正控)', hit.some((s) => s.includes('重叠')), JSON.stringify(hit))
    ok('版面档在错开后不咬人(反控)', miss.length === 0, JSON.stringify(miss))
    ok('版面档判出超出 24 列', gridPosIssues({ panels: [{ type: 'stat', title: 'C', gridPos: { h: 4, w: 20, x: 8, y: 0 } }] }).some((s) => s.includes('24 列')))
    ok('版面档判出缺 gridPos', gridPosIssues({ panels: [{ type: 'stat', title: 'D' }] }).some((s) => s.includes('没有 gridPos')))
    ok('row 容器不参与逐格判(子板坐标是行内相对值)', gridPosIssues({ panels: [{ type: 'row', gridPos: { h: 1, w: 24, x: 0, y: 0 } }] }).length === 0)
  }
  {
    // 报表翻倍这一型:printReport 曾对调用方传进来的 tally 再累加一遍 ⇒ 人读的汇总永远是真数×2。
    const fake = { window: '6h', start: 0, end: 1, step: 60, prometheus: null, loki: null, dashboards: [{ file: 'x.json', title: 'x', vars: [], panels: [{ verdict: 'data', panel: 'a', panelType: 'stat', detail: 'd' }, { verdict: 'empty', panel: 'b', panelType: 'stat', detail: 'd' }] }] }
    const t = tallyPanels(fake)
    const snapshot = JSON.stringify(t)
    printReport(fake, t)
    ok('打印档不改动计数(汇总=真数,不是×2)', JSON.stringify(t) === snapshot && t.data === 1 && t.empty === 1)
  }
  ok('变量查询:字符串形状', varQueryText({ query: 'label_values(a, instance)' }) === 'label_values(a, instance)')
  ok('变量查询:CloudWatch 遗留形状也能取出表达式', varQueryText({ query: { expression: 'label_values(a, provider)' } }) === 'label_values(a, provider)')
  ok('变量查询:qry 形状优先', varQueryText({ query: { qry: 'label_values(a, x)', expression: '噪声' } }) === 'label_values(a, x)')

  let pass = 0
  for (const c of cases) {
    console.info(`${c.pass ? '✅' : '❌'} ${c.name}${c.pass ? '' : c.detail ? `\n      读数:${c.detail}` : ''}`)
    if (c.pass) pass++
  }
  console.info(`自检 ${pass}/${cases.length}`)
  process.exit(pass === cases.length ? 0 : 1)
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  if (opts.selfTest) return selfTest()
  if (opts.help) {
    console.info(
      '用法: node scripts/verify-grafana-panel-data.mjs [--window 6h] [--dashboard ai-cost] [--dir <相对路径>] [--prometheus URL] [--loki URL] [--json]'
    )
    return
  }
  const report = await run(opts)
  const tally = tallyPanels(report)
  if (opts.json) console.info(JSON.stringify({ ...report, tally }, null, 2))
  else printReport(report, tally)
  const dead = report.dashboards.flatMap((d) => (d.vars || []).filter((v) => v.status === 'dead-control'))
  const grid = report.dashboards.reduce((a, d) => a + (d.gridIssues || []).length, 0)
  // 空板/失败/未判定/死控件/版面异常 ⇒ 1(有待处置);全零只报数不算缺陷。
  process.exit(tally.empty || tally.failed || tally.unjudged || dead.length || grid ? 1 : 0)
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  main().catch((e) => {
    console.error('❌ ' + (e && e.stack ? e.stack : e))
    process.exit(2)
  })
}

export const __test__ = {
  parseWindow,
  substitute,
  toMatcherValue,
  usesVar,
  parseLabelValuesQuery,
  varQueryText,
  isMetricQuery,
  classifyMatrix,
  gridPosIssues,
  tallyPanels,
  collectTargets,
  varNames,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
