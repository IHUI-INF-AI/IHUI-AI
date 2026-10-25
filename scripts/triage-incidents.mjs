#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 需求/异常自动发现器 · 离线归类器 CLI(2026-10-26 立,票面见 PROJECT_PLAN「需求/异常自动发现器」)。
//
// 职责边界(票面明令):
//  - 只吃本地 JSONL(按 `scripts/data/incident-signal-contract.json` 导出),不连生产库、
//    不调 Grafana —— 本机没有凭据,`api_logs` 属他席面;
//  - **不写 PROJECT_PLAN.md**:只产出「可派单候选」JSONL + 渲染成 `- [ ]` 行的预览,
//    写台账是 live-doc-edit 的事(主席面);
//  - 不接线进提交链(`guardian-runner.mjs` 零改动),不新增路由/连接层。
//
// 三态口径(§0.3):
//  - 输入读不到 / 契约坏 / 参数错 / 一条合法信号都没有 ⇒ exit 2 并显式写「未判定」;
//  - 坏行逐条点名单列(line + 原因),不连坐同批好行,计入 `undetermined=`;
//  - 判完(哪怕 0 个簇)⇒ exit 0,末行恒为 `TRIAGE-RESULT clusters=N dispatchable=M undetermined=K`。
//
// 台账行的两道既有约束(本器提前满足,免得住席登记时被门拒):
//  ① 守门 117 把 7~64 位 hex 当短 sha ⇒ 预览行整行过 `sanitizeHexRuns`(单源复用,不另写);
//  ② §1 行宽 ≤400 且要有一句交代 ⇒ 标题/证据各自设上限,行尾带新鲜日期(批次 lastAt 的日期)。
//
// 用法:node scripts/triage-incidents.mjs --in <jsonl> [--out <jsonl>] [--minutes 60]
//        [--min-count 3] [--json] | --self-test
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { requireFlagValue } from './lib/flag-value.mjs'
import { sanitizeHexRuns } from './lib/triage-doc-line.mjs'
import { clusterSignals, loadContract, normalizeSignature, validateSignal, windowOf } from './lib/incident-cluster.mjs'

/** 末行前缀 —— 机器读末行,人不猜。 */
export const RESULT_PREFIX = 'TRIAGE-RESULT'
const KNOWN_FLAGS = new Set(['--in', '--out', '--minutes', '--min-count', '--json', '--self-test'])
const TITLE_MAX = 120
const EVIDENCE_MAX = 180
const LINE_MAX = 400

/** 带值旗标一律走 `requireFlagValue`(G-322):给了旗标却吞掉值 ⇒ 用法错,绝不回落默认。 */
function intFlag(argv, flag, noun, fallback, errors) {
  const r = requireFlagValue(argv, flag, { noun })
  if (r.error) {
    errors.push(r.error)
    return fallback
  }
  if (!r.present) return fallback
  if (!/^\d+$/.test(r.value) || Number(r.value) < 1) {
    errors.push(`${flag} 需要正整数,实得 ${JSON.stringify(r.value)}`)
    return fallback
  }
  return Number(r.value)
}

function pathFlag(argv, flag, errors) {
  const r = requireFlagValue(argv, flag, { noun: '路径' })
  if (r.error) {
    errors.push(r.error)
    return null
  }
  return r.value
}

/** 解析 CLI 参数:未知旗标、吞值、非正整数一律记 usage 错(调用方据此 exit 2)。 */
export function parseArgs(argv = []) {
  const errors = []
  for (const t of argv) {
    if (typeof t === 'string' && t.startsWith('-') && !KNOWN_FLAGS.has(t)) errors.push(`未知旗标 ${t}`)
  }
  const input = pathFlag(argv, '--in', errors)
  const out = pathFlag(argv, '--out', errors)
  const minutes = intFlag(argv, '--minutes', '窗口分钟数', 60, errors)
  const minCount = intFlag(argv, '--min-count', '最小样本数', 3, errors)
  return {
    input,
    out,
    minutes,
    minCount,
    json: argv.includes('--json'),
    selfTest: argv.includes('--self-test'),
    errors,
  }
}

/** 逐行解析 JSONL:坏行单列(带行号与原因),好行原样交给契约校验。 */
export function parseJsonlText(text) {
  const rows = []
  const bad = []
  const lines = String(text ?? '').split(/\r?\n/)
  lines.forEach((raw, i) => {
    const line = raw.trim()
    if (!line) return
    try {
      rows.push({ line: i + 1, object: JSON.parse(line) })
    } catch (e) {
      bad.push({ line: i + 1, reason: `JSON 解析失败:${e?.message ?? e}`, excerpt: line.slice(0, 120) })
    }
  })
  return { rows, bad }
}

function focusOf(cluster) {
  if (cluster.route) return cluster.route
  if (cluster.code) return `错误码 ${cluster.code}`
  const first = String(cluster.sample ?? '').split(/\r?\n/)[0].trim()
  return `「${first.slice(0, 60)}」`
}

/** 候选行:严格四键 `{title, evidence, suggestedOwner, severity}`(票面形状,不多不少)。 */
export function buildCandidate(cluster, contract) {
  const owner = contract.owners?.[cluster.source]
  const title = sanitizeHexRuns(`[${cluster.source}/${cluster.kind}] ${focusOf(cluster)} 反复出现 ⇒ 排查并修复`).slice(0, TITLE_MAX)
  const bits = [
    `count=${cluster.count}`,
    `first=${cluster.firstAt}`,
    `last=${cluster.lastAt}`,
    `severity=${cluster.severity}`,
  ]
  if (cluster.route) bits.push(`route=${cluster.route}`)
  if (cluster.code) bits.push(`code=${cluster.code}`)
  bits.push(`sample=${JSON.stringify(String(cluster.sample ?? '').slice(0, 120))}`)
  return {
    title,
    evidence: sanitizeHexRuns(bits.join(' ')).slice(0, EVIDENCE_MAX),
    suggestedOwner: owner ?? '未登记',
    severity: cluster.severity,
  }
}

/**
 * 把候选渲染成台账预览行(`- [ ]` 形态)。**只渲染不写盘**:写台账必须走 live-doc-edit。
 * 日期取该簇 lastAt 的日期 —— 用输入自己的时间轴,不读时钟,保证同一份输入同一份预览。
 */
export function renderPlanLine(candidate, date) {
  const line = `- [ ] (${date})[自动发现] ${candidate.title}；证据:${candidate.evidence}；建议归属:${candidate.suggestedOwner}`
  return sanitizeHexRuns(line).slice(0, LINE_MAX)
}

/**
 * 主判据流水(纯函数面,便于镜像测试):文本 → 坏行单列 → 窗口 → 聚类 → 候选 → 预览行。
 * 返回 `judged:false` 表示一条合法信号都没有(调用方必须 exit 2)。
 */
export function triageText({ text, contract, minutes, minCount }) {
  const parsed = parseJsonlText(text)
  const bad = [...parsed.bad]
  const signals = []
  for (const row of parsed.rows) {
    const v = validateSignal(row.object, contract)
    if (v.ok) signals.push(v.signal)
    else bad.push({ line: row.line, reason: v.error, excerpt: JSON.stringify(row.object).slice(0, 120) })
  }
  if (signals.length === 0) {
    return {
      judged: false,
      bad,
      signals: 0,
      window: null,
      clusters: [],
      candidates: [],
      previewLines: [],
      resultLine: `${RESULT_PREFIX} clusters=0 dispatchable=0 undetermined=${bad.length}`,
    }
  }
  const win = windowOf(signals, minutes)
  const clusters = clusterSignals(signals, { minCount, windowMinutes: minutes, contract })
  const dispatchable = clusters.filter((c) => c.dispatchable)
  const candidates = dispatchable.map((c) => buildCandidate(c, contract))
  const previewLines = dispatchable.map((c, i) => renderPlanLine(candidates[i], c.lastAt.slice(0, 10)))
  return {
    judged: true,
    bad,
    signals: signals.length,
    window: {
      referenceAt: win.referenceAt,
      startAt: win.startAt,
      windowMinutes: win.windowMinutes,
      outOfWindow: win.outOfWindow.length,
    },
    clusters,
    candidates,
    previewLines,
    resultLine: `${RESULT_PREFIX} clusters=${clusters.length} dispatchable=${dispatchable.length} undetermined=${bad.length}`,
  }
}

/** 自检:契约/键稳定性/阈值/窗口/坏行/渲染 —— 全部走生产判据,不复制一份期望值。 */
export function runSelfTest() {
  const checks = []
  const ok = (name, cond) => checks.push({ name, ok: Boolean(cond) })
  let contract
  try {
    contract = loadContract()
    ok('契约可读且形状合法(version/reviewBy/enums/owners)', contract.version >= 1)
  } catch (e) {
    ok(`契约可读(${e?.message ?? e})`, false)
    return { ok: false, checks }
  }
  const sig = (over = {}) => ({
    at: '2026-10-26T10:00:00Z',
    source: 'api_logs',
    kind: 'http_error',
    severity: 'error',
    message: 'GET /api/chat failed code=500',
    ...over,
  })
  const c1 = clusterSignals([sig(), sig({ at: '2026-10-26T10:05:00Z', traceId: 'aaaaaaaa-1111' }), sig({ at: '2026-10-26T10:09:00Z', traceId: 'bbbbbbbb-2222' })], { minCount: 3, windowMinutes: 60, contract })
  ok('同键跨时刻/traceId 聚成一簇且 count=3', c1.length === 1 && c1[0].count === 3)
  ok('traceId 不进键', c1.length === 1 && !/aaaa|bbbb/.test(c1[0].clusterKey))
  ok('达阈值且 error 档 ⇒ 可派单', c1.length === 1 && c1[0].dispatchable === true)
  const c2 = clusterSignals([sig()], { minCount: 3, windowMinutes: 60, contract })
  ok('低于阈值 ⇒ 不可派单且 why 写明阈值', c2.length === 1 && c2[0].dispatchable === false && c2[0].why.includes('阈值'))
  const c3 = clusterSignals([sig({ source: 'user_feedback', kind: 'user_report' }), sig(), sig()], { minCount: 2, windowMinutes: 60, contract })
  ok('跨 source 不混桶', new Set(c3.map((c) => c.source)).size === 2)
  const text = [
    JSON.stringify(sig()),
    JSON.stringify(sig({ at: '2026-10-26T10:03:00Z' })),
    JSON.stringify(sig({ at: '2026-10-26T10:04:00Z' })),
    '{ broken json',
    JSON.stringify(sig({ source: 'nope' })),
  ].join('\n')
  const r = triageText({ text, contract, minutes: 60, minCount: 3 })
  ok('坏行单列 2 条、好行照判(undetermined=2)', r.bad.length === 2 && r.judged === true)
  ok('结果末行形状', /^TRIAGE-RESULT clusters=\d+ dispatchable=\d+ undetermined=\d+$/.test(r.resultLine))
  ok('预览行是 - [ ] 形态且 ≤400 字', r.previewLines.length === 1 && r.previewLines[0].startsWith('- [ ] (2026-10-26)') && r.previewLines[0].length <= 400)
  ok('预览行无 7~64 位裸 hex(守门 117 同源归一)', !/(^|[^0-9a-zA-Z_])[0-9a-fA-F]{7,64}(?=$|[^0-9a-zA-Z_])/.test(r.previewLines[0]))
  const empty = triageText({ text: '\n', contract, minutes: 60, minCount: 3 })
  ok('零合法信号 ⇒ judged=false(调用方 exit 2)', empty.judged === false && empty.clusters.length === 0)
  ok('窗口外的旧信号不计入簇', clusterSignals([sig(), sig({ at: '2026-10-26T10:00:00Z' }), sig({ at: '2026-10-24T10:00:00Z' }), sig({ at: '2026-10-24T10:00:00Z' })], { minCount: 1, windowMinutes: 60, contract })[0].count === 2)
  ok('归一消息非空(单源 normalizeSignature 可用)', normalizeSignature('x 123') === 'x :n')
  return { ok: checks.every((c) => c.ok), checks }
}

function printReport(result, args) {
  for (const line of result.previewLines) console.log(line)
  for (const b of result.bad) console.error(`BAD-LINE line=${b.line} ${b.reason}${b.excerpt ? ` | ${b.excerpt}` : ''}`)
  const w = result.window
  if (w) {
    console.error(
      `TRIAGE-DETAIL signals=${result.signals} in-window=${result.signals - w.outOfWindow} out-of-window=${w.outOfWindow} window=${w.windowMinutes}min anchor=${w.referenceAt} minCount=${args.minCount}`,
    )
  }
  console.log(result.resultLine)
}

async function main(argv) {
  const args = parseArgs(argv)
  if (args.selfTest) {
    const r = runSelfTest()
    for (const c of r.checks) if (!c.ok) console.error(`❌ ${c.name}`)
    console.error(`SELF-TEST ok=${r.checks.filter((c) => c.ok).length} total=${r.checks.length}`)
    return r.ok ? 0 : 1
  }
  if (args.errors.length > 0) {
    for (const e of args.errors) console.error(`❌ ${e}`)
    console.error('未判定:参数错误,未产生任何候选')
    return 2
  }
  if (!args.input) {
    console.error('未判定:未给出 --in <jsonl>(本器不连库、不调 Grafana,只吃按契约导出的本地文件)')
    return 2
  }
  let contract
  try {
    contract = loadContract()
  } catch (e) {
    console.error(`未判定:${e?.message ?? e}`)
    return 2
  }
  let text
  try {
    text = readFileSync(resolve(args.input), 'utf8')
  } catch (e) {
    console.error(`未判定:输入读不到 ${args.input}(${e?.message ?? e})`)
    return 2
  }
  const result = triageText({ text, contract, minutes: args.minutes, minCount: args.minCount })
  if (args.out && result.judged) {
    const target = resolve(args.out)
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, result.candidates.map((c) => JSON.stringify(c)).join('\n') + (result.candidates.length ? '\n' : ''), 'utf8')
    console.error(`CANDIDATES out=${target} rows=${result.candidates.length}`)
  }
  if (args.json) {
    console.log(
      JSON.stringify({
        contract: { version: contract.version, reviewBy: contract.reviewBy },
        params: { minutes: args.minutes, minCount: args.minCount },
        judged: result.judged,
        signals: result.signals,
        window: result.window,
        clusters: result.clusters,
        candidates: result.candidates,
        previewLines: result.previewLines,
        badRows: result.bad,
      }),
    )
    console.log(result.resultLine)
  } else {
    printReport(result, args)
  }
  if (!result.judged) {
    console.error(`未判定:输入里没有一条通过契约校验的信号(坏行 ${result.bad.length})`)
    return 2
  }
  return 0
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  main(process.argv.slice(2))
    .then((code) => {
      process.exitCode = code
    })
    .catch((e) => {
      console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
      process.exit(2)
    })
}

export const __test__ = {
  parseArgs,
  parseJsonlText,
  triageText,
  buildCandidate,
  renderPlanLine,
  runSelfTest,
  RESULT_PREFIX,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
