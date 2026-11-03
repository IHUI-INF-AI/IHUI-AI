// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 本工具是感知层记账器,机器行必须走 stdout */
/**
 * monitor-signal-intake — 监控三源 → 事故事实信号 的唯一入口(端到端反馈闭环·感知腿,2026-10-27 立)。
 *
 * 契约 `scripts/data/incident-signal-contract.json` 的 producers 段登记了三个监控来源
 * (api_logs / grafana_alert / user_feedback),此前无任何生产者 —— 监控异常进不了
 * `incident-signals.jsonl`,于是感知→建单→派单→修复→部署→回填这条链的第一段是断的。
 * 本器补上这三个 producer:把三源读到的原始记录映射成契约行,追加到
 * `.ihui-agent/state/incident-signals.jsonl`,与 `scripts/deploy-outcome-intake.mjs`
 * (部署结果源)写同一个文件、吃同一份契约、同一把身份尺子。
 *
 * 复用既有体系(不新建平行体系):
 *  - 取数面复用 `scripts/auto-triage.mjs` 已导出的三个读取器
 *    (`readApiLogs` / `readGrafanaAlerts` / `readUserFeedback`)——本器不连库、不调
 *    Grafana、不新开路由;auto-triage 仍是「分诊建单」那条腿,本器是「契约信号」这条腿,
 *    两者共用同一份取数实现与同一份地址配置(`scripts/data/auto-triage-config.json`)。
 *  - 契约/身份/聚类判据一律 import `scripts/lib/incident-cluster.mjs`,本器不写第二份
 *    "什么算同一缺陷"。
 *
 * 映射口径(source/kind/severity 一律在本文件一张表里,不许散落):
 *   source=api_logs      kind=http_error   severity: status>=500 ⇒ error,400..499 ⇒ warn
 *   source=grafana_alert kind=alert_firing  severity: labels.severity 映射(critical/error/warning/info)
 *   source=user_feedback kind=user_report  severity: warn(一条具体报障本身即一件真工作)
 *
 * 三态(§0.3):
 *  - 0 = 已判定(哪怕 0 条信号;部分源未判定会逐源点名);
 *  - 2 = 未判定(契约坏 / 三个源**全部**未判定 ⇒ 没有任何可判定面);
 *  - 3 = 写盘失败(不得声称成功)。
 *  源读不到一律落「未判定」并点名,绝不把"读不到"记成"无异常"(那会让闭环静默缺一段)。
 *
 * 去重:同 `identityOf` 在窗口内只产一次;`--out` 已有行也计入去重 ⇒ 同输入重复跑是幂等的。
 *
 * 用法:node scripts/monitor-signal-intake.mjs [--out <jsonl>] [--minutes 1440]
 *        [--api-jsonl <f>] [--feedback-jsonl <f>] [--grafana-url <u>] [--apply] [--json]
 *        | --self-test
 */
import { appendFileSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { requireFlagValue } from './lib/flag-value.mjs'
import { identityOf, loadContract, validateSignal } from './lib/incident-cluster.mjs'
import { loadConfig, readApiLogs, readGrafanaAlerts, readUserFeedback } from './auto-triage.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
export const DEFAULT_OUT = join(ROOT, '.ihui-agent', 'state', 'incident-signals.jsonl')
export const RESULT_PREFIX = 'MONITOR-INTAKE'
export const DEFAULT_MINUTES = 24 * 60
export const MAX_MESSAGE = 2000

/** 本器负责的三个来源(契约 producers 段登记的监控面;deploy_outcome 由 deploy-outcome-intake 负责)。 */
export const SOURCES = Object.freeze(['api_logs', 'grafana_alert', 'user_feedback'])

/**
 * 源 → 契约字段映射(唯一一张表):
 *   kind      契约 kind 闭集内的一个
 *   severityOf(record) 按源自己的语义定档;取不到 ⇒ null(该条判坏行,不猜)
 */
export const SOURCE_PLAN = Object.freeze({
  api_logs: {
    kind: 'http_error',
    severityOf(rec) {
      const code = Number(rec?.statusCode)
      if (!Number.isFinite(code)) return null
      if (code >= 500) return 'error'
      if (code >= 400) return 'warn'
      return null
    },
    routeOf(rec) {
      const method = String(rec?.method ?? '').trim()
      const path = String(rec?.path ?? '').trim()
      if (!path) return ''
      return method ? `${method} ${path}` : path
    },
  },
  grafana_alert: {
    kind: 'alert_firing',
    severityOf(rec) {
      const label = String(rec?.label ?? '')
      const m = /\(([^)]*)\)\s*$/.exec(label)
      const raw = String(m ? m[1] : rec?.severity ?? '').trim().toLowerCase()
      if (raw === 'critical') return 'critical'
      if (raw === 'error') return 'error'
      if (raw === 'warning' || raw === 'warn') return 'warn'
      if (raw === 'info') return 'info'
      return null
    },
    routeOf(rec) {
      const label = String(rec?.label ?? '')
      const i = label.lastIndexOf('(')
      return (i > 0 ? label.slice(0, i) : label).trim()
    },
  },
  user_feedback: {
    kind: 'user_report',
    severityOf() {
      return 'warn'
    },
    routeOf() {
      return ''
    },
  },
})

/** 契约/参数/源形状坏 —— 调用方必须落「未判定」,不得当空集处理(§0.3)。 */
export class MonitorShapeError extends Error {
  constructor(message) {
    super(message)
    this.name = 'MonitorShapeError'
  }
}

/**
 * 时刻归一:只接受**带明确时区**的输入。
 * `api_logs.created_at::text` 给的是 `2026-10-26 10:00:00+00`(空格分隔、偏移两字)、
 * 导出件给的多半是 ISO —— 两种都要归到契约要的 `YYYY-MM-DDTHH:MM:SS(.sss)?(Z|±HH:MM)`。
 * 无时区 ⇒ 判坏行(当本地时间静默解读会让跨机取数漂移,契约明令判坏)。
 */
export function toIsoAt(value) {
  const raw = String(value ?? '').trim()
  if (!raw) return { ok: false, why: '缺时刻' }
  let s = raw.replace(' ', 'T')
  if (/[+-]\d{2}$/.test(s)) s += ':00'
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s)) s += ':00'
  const ms = Date.parse(s)
  if (!Number.isFinite(ms)) return { ok: false, why: `时刻不可解析:${raw}` }
  if (!/(Z|[+-]\d{2}:?\d{2})$/.test(s)) return { ok: false, why: `时刻缺时区(契约要求带 Z 或 ±HH:MM):${raw}` }
  return { ok: true, at: new Date(ms).toISOString() }
}

/**
 * 一条原始记录 → 契约信号(纯函数,不碰盘)。
 * 返回 `{produce:false,why}` 或 `{produce:true,signal}`;形状坏一律 throw,本器不替调用方猜。
 */
export function recordToSignal(source, record, contract = loadContract()) {
  const plan = SOURCE_PLAN[source]
  if (!plan) throw new MonitorShapeError(`未知来源「${source}」(本器只做:${SOURCES.join('/')})`)
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    throw new MonitorShapeError(`${source} 记录必须是对象`)
  }
  const at = toIsoAt(record.at)
  if (!at.ok) throw new MonitorShapeError(`${source} 记录时刻不合契约:${at.why}`)
  const severity = plan.severityOf(record)
  if (!severity) {
    throw new MonitorShapeError(`${source} 记录判不出严重度档位(不猜):${JSON.stringify(record.label ?? record.statusCode ?? '')}`)
  }
  const message = String(record.objectText ?? record.evidence ?? '').trim()
  if (!message) throw new MonitorShapeError(`${source} 记录无可用原文(message 为空)`)
  const candidate = {
    at: at.at,
    source,
    kind: plan.kind,
    severity,
    message: message.slice(0, MAX_MESSAGE),
  }
  const route = plan.routeOf(record)
  if (route) candidate.route = route.slice(0, 300)
  const checked = validateSignal(candidate, contract)
  if (!checked.ok) throw new MonitorShapeError(`生成的信号不过契约:${checked.error}`)
  return { produce: true, signal: checked.signal }
}

/**
 * 一轮判定(纯函数):各源记录 → 契约信号,按 `identityOf` 在窗口内去重。
 * `existing` = `--out` 已有行(已解析对象),与本轮产出行合并计入去重。
 */
export function planIntake({ bySource, contract, minutes, existing = [] }) {
  if (!bySource || typeof bySource !== 'object') throw new MonitorShapeError('bySource 必须是对象')
  if (!Number.isInteger(minutes) || minutes < 1) throw new MonitorShapeError(`minutes 必须是正整数(实得 ${minutes})`)
  const windowMs = minutes * 60_000
  const seen = []
  for (const e of existing) {
    const t = Date.parse(e?.at)
    if (!Number.isFinite(t)) continue
    seen.push({ identity: identityOf(e), atMs: t })
  }
  const bad = []
  const signals = []
  let skipped = 0
  for (const source of SOURCES) {
    const records = bySource[source]
    if (!Array.isArray(records)) continue
    records.forEach((record, i) => {
      try {
        const r = recordToSignal(source, record, contract)
        if (!r.produce) {
          skipped += 1
          return
        }
        const t = Date.parse(r.signal.at)
        const key = identityOf(r.signal)
        if (seen.some((s) => s.identity === key && Math.abs(t - s.atMs) <= windowMs)) {
          skipped += 1
          return
        }
        seen.push({ identity: key, atMs: t })
        signals.push(r.signal)
      } catch (e) {
        bad.push({ source, index: i, reason: e?.message ?? String(e) })
      }
    })
  }
  return { signals, skipped, bad, undetermined: bad.length }
}

/** 读 `--out` 已有台账:只为去重取本器三源行的 at/身份;坏行单列(不连坐)。 */
export function parseExistingSignals(text) {
  const signals = []
  const bad = []
  String(text ?? '')
    .split(/\r?\n/)
    .forEach((raw, i) => {
      const line = raw.trim()
      if (!line) return
      let obj
      try {
        obj = JSON.parse(line)
      } catch (e) {
        bad.push({ line: i + 1, reason: `JSON 解析失败:${e?.message ?? e}` })
        return
      }
      if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
        bad.push({ line: i + 1, reason: '信号必须是 JSON 对象' })
        return
      }
      if (!SOURCES.includes(obj.source)) return
      if (typeof obj.at !== 'string' || !Number.isFinite(Date.parse(obj.at))) {
        bad.push({ line: i + 1, reason: `source=${obj.source} 的行 at 不可解析:${JSON.stringify(obj.at)}` })
        return
      }
      signals.push(obj)
    })
  return { signals, bad }
}

/** 追加写(仅追加不改写,与既有台账同形)。0 条时不建目录、不落空文件。 */
export function appendSignals(outPath, signals) {
  if (!Array.isArray(signals) || signals.length === 0) return outPath
  mkdirSync(dirname(resolve(outPath)), { recursive: true })
  appendFileSync(outPath, signals.map((s) => `${JSON.stringify(s)}\n`).join(''), 'utf8')
  return outPath
}

const KNOWN_FLAGS = new Set([
  '--out',
  '--minutes',
  '--api-jsonl',
  '--feedback-jsonl',
  '--grafana-url',
  '--apply',
  '--json',
  '--self-test',
])

/** 带值旗标一律走 `requireFlagValue`(G-322):给了旗标却吞掉值 ⇒ 用法错,绝不回落默认。 */
function pathFlag(argv, flag, errors) {
  const r = requireFlagValue(argv, flag, { noun: '路径' })
  if (r.error) {
    errors.push(r.error)
    return null
  }
  return r.value
}

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

/** 解析 CLI 参数:未知旗标、吞值、非正整数一律记 usage 错(调用方 exit 2)。 */
export function parseArgs(argv = []) {
  const errors = []
  for (const t of argv) {
    if (typeof t === 'string' && t.startsWith('-') && !KNOWN_FLAGS.has(t)) errors.push(`未知旗标 ${t}`)
  }
  return {
    out: pathFlag(argv, '--out', errors),
    minutes: intFlag(argv, '--minutes', '窗口分钟数', DEFAULT_MINUTES, errors),
    apiJsonl: pathFlag(argv, '--api-jsonl', errors),
    feedbackJsonl: pathFlag(argv, '--feedback-jsonl', errors),
    grafanaUrl: pathFlag(argv, '--grafana-url', errors),
    apply: argv.includes('--apply'),
    json: argv.includes('--json'),
    selfTest: argv.includes('--self-test'),
    errors,
  }
}

/** 自检:契约/映射/时刻/去重/幂等/坏行单列/未知源 —— 全部走生产判据(零网络)。 */
export function runSelfTest() {
  const checks = []
  const ok = (name, cond, why = '') => checks.push({ name, ok: Boolean(cond), why })
  let contract
  try {
    contract = loadContract()
    ok('契约可读且形状合法', contract.version >= 1)
  } catch (e) {
    ok(`契约可读(${e?.message ?? e})`, false)
    return { ok: false, checks }
  }
  ok(
    '契约 source 枚举含本器三源',
    SOURCES.every((s) => contract.fields.source.enum.includes(s)),
    contract.fields.source.enum.join('/'),
  )
  ok(
    '契约 owners 登记本器三源',
    SOURCES.every((s) => typeof contract.owners?.[s] === 'string' && contract.owners[s] !== ''),
  )

  const at = '2026-10-26T10:00:00.000Z'
  const apiRec = { at, method: 'GET', path: '/api/x/42', statusCode: 503, objectText: 'GET /api/x/42 503 boom', evidence: 'GET /api/x/42 → 503 boom' }
  const api = recordToSignal('api_logs', apiRec, contract)
  ok('api_logs → http_error/error', api.produce && api.signal.kind === 'http_error' && api.signal.severity === 'error')
  ok('api_logs 4xx ⇒ warn', recordToSignal('api_logs', { ...apiRec, statusCode: 404 }, contract).signal.severity === 'warn')
  ok('api_logs route 带方法与路径', api.signal.route === 'GET /api/x/42', api.signal.route)

  const gRec = { at, label: 'HighErrorRate(critical)', objectText: 'HighErrorRate|critical|5xx 激增', evidence: 'HighErrorRate severity=critical' }
  const g = recordToSignal('grafana_alert', gRec, contract)
  ok('grafana_alert → alert_firing/critical', g.produce && g.signal.kind === 'alert_firing' && g.signal.severity === 'critical')
  ok('grafana_alert route 取告警名', g.signal.route === 'HighErrorRate', g.signal.route)

  const uRec = { at, label: 'bug:按钮点不动', objectText: 'bug|按钮点不动|点了没反应', evidence: 'type=bug title=按钮点不动' }
  const u = recordToSignal('user_feedback', uRec, contract)
  ok('user_feedback → user_report/warn', u.produce && u.signal.kind === 'user_report' && u.signal.severity === 'warn')

  const tz = toIsoAt('2026-10-26 10:00:00+00')
  ok('时刻归一:DB 文本(+00)⇒ ISO', tz.ok && tz.at === '2026-10-26T10:00:00.000Z', JSON.stringify(tz))
  ok('时刻归一:无时区判坏', toIsoAt('2026-10-26 10:00:00').ok === false)

  let threw = false
  try {
    recordToSignal('api_logs', { at, method: 'GET', path: '/x', statusCode: 200, objectText: 'ok' }, contract)
  } catch {
    threw = true
  }
  ok('判不出严重度 ⇒ 抛(不猜档位)', threw)

  const bySource = { api_logs: [apiRec, { ...apiRec }] }
  const p1 = planIntake({ bySource, contract, minutes: DEFAULT_MINUTES, existing: [] })
  ok('同身份 24h 内只产一次', p1.signals.length === 1 && p1.skipped === 1, JSON.stringify(p1))
  const p2 = planIntake({ bySource, contract, minutes: DEFAULT_MINUTES, existing: p1.signals })
  ok('追加幂等(已有行计入去重)', p2.signals.length === 0 && p2.skipped === 2)

  const badOne = planIntake({ bySource: { api_logs: [{ at: 'nope', method: 'GET', path: '/x', statusCode: 500, objectText: 'x' }] }, contract, minutes: DEFAULT_MINUTES, existing: [] })
  ok('坏行单列(不连坐)', badOne.undetermined === 1 && badOne.signals.length === 0)

  for (const c of checks) console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name}${c.ok ? '' : ` — ${c.why}`}`)
  const failed = checks.filter((c) => !c.ok)
  console.log(`# monitor-signal-intake self-test ${checks.length - failed.length}/${checks.length}`)
  return failed.length === 0 ? 0 : 1
}

async function main(argv) {
  const args = parseArgs(argv)
  if (args.selfTest) return runSelfTest()
  if (args.errors.length > 0) {
    for (const e of args.errors) console.error(`❌ ${e}`)
    console.error('未判定:参数错误,未产生任何信号')
    return 2
  }
  let contract
  try {
    contract = loadContract()
  } catch (e) {
    console.error(`未判定:${e?.message ?? e}`)
    return 2
  }

  // 地址/夹具面:配置优先(与 auto-triage 同一份),CLI 显式给值时覆盖。
  let cfg = {}
  try {
    cfg = loadConfig()
  } catch (e) {
    console.error(`未判定:分诊配置读不到或非法(${e?.message ?? e})`)
    return 2
  }
  const apiJsonl = args.apiJsonl ?? String(cfg.apiLogs?.jsonl ?? '')
  const feedbackJsonl = args.feedbackJsonl ?? String(cfg.userFeedback?.jsonl ?? '')
  const grafanaUrl = args.grafanaUrl ?? String(cfg.grafanaAlerts?.url ?? '')

  const sourceStates = []
  const bySource = {}

  const api = readApiLogs({
    jsonlPath: apiJsonl,
    limit: Number(cfg.apiLogs?.rowLimit ?? 500),
    minStatus: Number(cfg.apiLogs?.minStatus ?? 500),
  })
  sourceStates.push({ source: 'api_logs', status: api.status, why: api.why ?? '', count: api.records?.length ?? 0 })
  bySource.api_logs = api.status === 'ok' ? api.records : []

  const grafana = await readGrafanaAlerts({ url: grafanaUrl })
  sourceStates.push({ source: 'grafana_alert', status: grafana.status, why: grafana.why ?? '', count: grafana.records?.length ?? 0 })
  bySource.grafana_alert = grafana.status === 'ok' ? grafana.records : []

  const feedback = readUserFeedback({ jsonlPath: feedbackJsonl })
  sourceStates.push({ source: 'user_feedback', status: feedback.status, why: feedback.why ?? '', count: feedback.records?.length ?? 0 })
  bySource.user_feedback = feedback.status === 'ok' ? feedback.records : []

  for (const s of sourceStates) {
    if (s.status === 'ok') console.log(`ℹ ${s.source}:已读 ${s.count} 条`)
    else console.error(`ℹ ${s.source}:未判定(${s.why})`)
  }

  const outPath = resolve(args.out ?? DEFAULT_OUT)
  let existingText = ''
  try {
    existingText = readFileSync(outPath, 'utf8')
  } catch (e) {
    if (e?.code !== 'ENOENT') {
      console.error(`未判定:--out 读不到 ${outPath}(${e?.code ?? e?.message ?? e})`)
      return 2
    }
  }
  const existing = parseExistingSignals(existingText)
  for (const b of existing.bad) console.error(`BAD-LINE line=${b.line} ${b.reason}`)

  const result = planIntake({ bySource, contract, minutes: args.minutes, existing: existing.signals })
  for (const b of result.bad) console.error(`BAD-ROW source=${b.source} index=${b.index} ${b.reason}`)

  const judgedSources = sourceStates.filter((s) => s.status === 'ok')
  const undeterminedSources = sourceStates.filter((s) => s.status !== 'ok')
  if (judgedSources.length === 0) {
    console.error('未判定:三个监控源全部未判定(没有任何可判定面)')
    return 2
  }

  if (args.json) {
    console.log(
      JSON.stringify({
        contract: { version: contract.version, reviewBy: contract.reviewBy },
        params: { minutes: args.minutes, out: outPath, apply: args.apply },
        sources: sourceStates,
        judged: true,
        signals: result.signals.length,
        skipped: result.skipped,
        undetermined: result.undetermined,
        rows: result.signals,
      }),
    )
  }
  if (!args.apply) {
    console.log(
      `${RESULT_PREFIX} signals=${result.signals.length} skipped=${result.skipped} undetermined=${result.undetermined} dry-run=1`,
    )
    return 0
  }
  try {
    appendSignals(outPath, result.signals)
  } catch (e) {
    console.error(`MONITOR-INTAKE-WRITE-FAILED ${outPath}: ${e?.message ?? e}`)
    return 3
  }
  console.log(
    `${RESULT_PREFIX} signals=${result.signals.length} skipped=${result.skipped} undetermined=${result.undetermined} ` +
      `sources-undetermined=${undeterminedSources.length}`,
  )
  return 0
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) process.exitCode = await main(process.argv.slice(2))

export const __test__ = {
  DEFAULT_OUT,
  DEFAULT_MINUTES,
  RESULT_PREFIX,
  SOURCES,
  SOURCE_PLAN,
  MonitorShapeError,
  appendSignals,
  parseArgs,
  parseExistingSignals,
  planIntake,
  recordToSignal,
  runSelfTest,
  toIsoAt,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
