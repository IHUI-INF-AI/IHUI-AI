// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 本工具是运维记账器,机器行必须走 stdout */
/**
 * deploy-outcome-intake — 部署结果 → 事故事实信号 的唯一入口(L28812 端到端反馈闭环·第一切片,2026-10-26 立)。
 *
 * 消费 `.ihui-agent/deploy-decisions.jsonl`(scripts/deploy-decision.mjs 生产,一行一 JSON),
 * 把失败型出口映射成 `scripts/data/incident-signal-contract.json` 的 incident signal 行,
 * 去重后追加到 `.ihui-agent/state/incident-signals.jsonl`,供 scripts/triage-incidents.mjs 离线归类。
 *
 * 映射表(action 闭集与 deploy-decision.mjs 的 DECISION_ACTIONS 逐项对齐):
 *   action             产出  kind               severity  说明
 *   pass               否    —                  —         健康门禁全绿后切流
 *   canary-pass        否    —                  —         金丝雀观察窗通过
 *   pass-unproven      是    alert_firing       warn      已切流但没有三项全绿(放行≠通过)
 *   pass-entry-broken  是    alert_firing       warn      已切流但公网入口读不到
 *   rollback           是    alert_firing       error     健康门禁未过,整份退回上一可用包
 *   manual-rollback    是    alert_firing       warn      人工回滚,归人工处置(不是 error)
 *   build-fail         是    alert_firing       error     构建失败,未切流
 *   canary-rollback    是    perf_degradation   error     观察窗异常,自动回滚
 *   canary-unproven    否    —                  —         未判定(样本不足),不冒充失败
 *
 * 形态纪律:
 *  - 身份去重只问 `scripts/lib/incident-cluster.mjs` 的 `identityOf`(全仓唯一身份定义),
 *    不得自造第二份 key 规则;默认 24h 窗口内同身份只产一次;`--out` 已有文件的同身份行
 *    也计入去重 ⇒ 同一份输入重复跑是追加幂等的;
 *  - message 只放 action / 完整 40 位 sha(若有) / dims / reason 摘要。7~39 位短 sha 一律
 *    折成 `[sha-redacted:<len>]`;密钥形状走 `scripts/lib/secret-shape-redact.mjs` 的唯一实现;
 *  - 不联网、不连库、不 spawn 外部进程;`--self-test` 全部走纯判据(零网络)。
 *
 * 三态(§0.3):
 *  0 = 已判定(含 0 条信号);2 = 未判定(输入文件缺失 / JSON 坏 / 契约坏 / 参数错,末行点名原因);
 *  3 = 写盘失败(不得声称成功)。
 *
 * 用法:
 *   node scripts/deploy-outcome-intake.mjs [--in <jsonl>] [--out <jsonl>] [--minutes 1440] [--json]
 *   node scripts/deploy-outcome-intake.mjs --self-test
 */
import { appendFileSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { requireFlagValue } from './lib/flag-value.mjs'
import { deployDecisionsFace } from './lib/deploy-decisions-face.mjs'
import { identityOf, loadContract, validateSignal } from './lib/incident-cluster.mjs'
import { redactAlertDetail } from './lib/secret-shape-redact.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
export const DEFAULT_IN = join(ROOT, '.ihui-agent', 'deploy-decisions.jsonl')
export const DEFAULT_OUT = join(ROOT, '.ihui-agent', 'state', 'incident-signals.jsonl')
/** 末行前缀 —— 机器读末行,人不猜。 */
export const RESULT_PREFIX = 'DEPLOY-INTAKE'
export const DEFAULT_MINUTES = 24 * 60
const SOURCE = 'deploy_outcome'
const DECISION_VERSION = 1
const MAX_REASON = 200
const MAX_DIMS = 12
const MAX_MESSAGE = 2000

/** 与 deploy-decision.mjs DECISION_ACTIONS 逐项对齐;null = 不产出信号。 */
export const OUTCOME_MAP = Object.freeze({
  pass: null,
  'pass-unproven': { kind: 'alert_firing', severity: 'warn' },
  'pass-entry-broken': { kind: 'alert_firing', severity: 'warn' },
  rollback: { kind: 'alert_firing', severity: 'error' },
  'manual-rollback': { kind: 'alert_firing', severity: 'warn' },
  'build-fail': { kind: 'alert_firing', severity: 'error' },
  'canary-pass': null,
  'canary-rollback': { kind: 'perf_degradation', severity: 'error' },
  'canary-unproven': null,
})

const FULL_SHA_RE = /^[0-9a-f]{40}$/i
/** 7~39 位 hex = 短 sha(守门 117 同族);完整 40 位不在射程内(见 sanitizeShortHex 注释)。 */
const SHORT_HEX_RE = /(^|[^0-9a-zA-Z_])([0-9a-fA-F]{7,39})(?=$|[^0-9a-zA-Z_])/g

/** 决策台账/契约形状坏 —— 调用方必须落「未判定」,不得当空集处理(§0.3)。 */
export class IntakeShapeError extends Error {
  constructor(message) {
    super(message)
    this.name = 'IntakeShapeError'
  }
}

function asText(v) {
  if (typeof v === 'string') return v.trim()
  if (v === null || v === undefined) return ''
  return String(v).trim()
}

function normalizeDims(v) {
  const arr = Array.isArray(v) ? v : asText(v).split(/[,+]/)
  const out = []
  for (const raw of arr) {
    const d = asText(raw)
    if (!d || out.includes(d)) continue
    out.push(d)
    if (out.length >= MAX_DIMS) break
  }
  return out
}

function reasonSummary(v) {
  const s = asText(v).replace(/\s+/g, ' ').trim()
  const cut = s.length > MAX_REASON ? `${s.slice(0, MAX_REASON)}…` : s
  return redactAlertDetail(cut)
}

/**
 * 把 message 里的 7~39 位 hex 折成 `[sha-redacted:<len>]`。
 * 完整 40 位 sha 刻意不折叠(`{7,39}` + 前后边界:40 位串任何 39 位子串的下一字符仍是 hex,
 * 故整串永不命中),否则"必须含完整 sha"与本条互相抵消。
 */
export function sanitizeShortHex(text) {
  return String(text ?? '').replace(SHORT_HEX_RE, (_m, pre, hex) => `${pre}[sha-redacted:${hex.length}]`)
}

/**
 * 一条部署决策 → `{produce:false,action}` 或 `{produce:true,action,signal}`。
 * 纯函数(不碰盘),非法形状一律 throw —— 本器不替调用方猜"这大概是回滚"。
 */
export function decisionToSignal(raw, contract = loadContract()) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new IntakeShapeError('部署决策必须是 JSON 对象')
  }
  if (raw.v !== DECISION_VERSION) {
    throw new IntakeShapeError(`部署决策 v 必须是 ${DECISION_VERSION}(实得 ${JSON.stringify(raw.v)})`)
  }
  const action = asText(raw.action)
  if (!(action in OUTCOME_MAP)) {
    throw new IntakeShapeError(`action 非法:「${action || '(空)'}」(闭集:${Object.keys(OUTCOME_MAP).join('/')})`)
  }
  const rule = OUTCOME_MAP[action]
  if (!rule) return { produce: false, action }

  const atMs = Date.parse(asText(raw.ts))
  if (!Number.isFinite(atMs)) {
    throw new IntakeShapeError(`ts 不是可解析的时刻:${JSON.stringify(raw.ts)}`)
  }
  const shaRaw = asText(raw.sha).toLowerCase()
  const fullSha = FULL_SHA_RE.test(shaRaw) ? shaRaw : ''
  const dims = normalizeDims(raw.failDims)
  const reason = reasonSummary(raw.reason)

  const parts = [`deploy_outcome action=${action}`]
  if (fullSha) parts.push(`sha=${fullSha}`)
  parts.push(`dims=${dims.length ? dims.join('+') : '(none)'}`)
  parts.push(`reason="${reason}"`)
  const message = sanitizeShortHex(parts.join(' ')).slice(0, MAX_MESSAGE)

  const candidate = {
    at: new Date(atMs).toISOString(),
    source: SOURCE,
    kind: rule.kind,
    severity: rule.severity,
    message,
    route: `deploy/${action}`,
  }
  const checked = validateSignal(candidate, contract)
  if (!checked.ok) throw new IntakeShapeError(`生成的信号不过契约:${checked.error}`)
  return { produce: true, action, signal: checked.signal }
}

/** 逐行解析决策台账:坏行单列(带行号与原因),好行交给 decisionToSignal。 */
export function readDecisionText(text) {
  const rows = []
  const bad = []
  String(text ?? '')
    .split(/\r?\n/)
    .forEach((raw, i) => {
      const line = raw.trim()
      if (!line) return
      try {
        rows.push({ line: i + 1, object: JSON.parse(line) })
      } catch (e) {
        bad.push({ line: i + 1, reason: `JSON 解析失败:${e?.message ?? e}` })
      }
    })
  return { rows, bad }
}

/**
 * 读 `--out` 已有台账:只为去重取 `source=deploy_outcome` 行的 at/身份。
 * 坏 JSON 不静默吞 —— 去重面读不懂时不能保证幂等,调用方必须落未判定。
 */
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
      if (obj.source !== SOURCE) return
      if (typeof obj.at !== 'string' || !Number.isFinite(Date.parse(obj.at))) {
        bad.push({ line: i + 1, reason: `source=${SOURCE} 的行 at 不可解析:${JSON.stringify(obj.at)}` })
        return
      }
      signals.push(obj)
    })
  return { signals, bad }
}

/**
 * 主判据:决策行 → 信号,按 `identityOf` 在同身份窗口内去重。
 * `existing` 是 `--out` 已有行(已解析对象),与 `decisions` 里已产出的行合并计入 seen。
 */
export function planIntake({ decisions, contract, minutes, existing = [] }) {
  if (!Array.isArray(decisions)) throw new IntakeShapeError('decisions 必须是数组')
  if (!Number.isInteger(minutes) || minutes < 1) {
    throw new IntakeShapeError(`minutes 必须是正整数(实得 ${minutes})`)
  }
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
  decisions.forEach((row, i) => {
    const line = row?.line ?? i + 1
    try {
      const r = decisionToSignal(row?.object, contract)
      if (!r.produce) {
        skipped += 1
        return
      }
      const t = Date.parse(r.signal.at)
      const key = identityOf(r.signal)
      const duplicate = seen.some((s) => s.identity === key && Math.abs(t - s.atMs) <= windowMs)
      if (duplicate) {
        skipped += 1
        return
      }
      seen.push({ identity: key, atMs: t })
      signals.push(r.signal)
    } catch (e) {
      bad.push({ line, reason: e?.message ?? String(e) })
    }
  })
  return { signals, skipped, bad, undetermined: bad.length }
}

/** 追加写(仅追加不改写,与既有台账同形)。0 条时不建目录、不落空文件。 */
export function appendSignals(outPath, signals) {
  if (!Array.isArray(signals) || signals.length === 0) return outPath
  mkdirSync(dirname(resolve(outPath)), { recursive: true })
  appendFileSync(outPath, signals.map((s) => `${JSON.stringify(s)}\n`).join(''), 'utf8')
  return outPath
}

const KNOWN_FLAGS = new Set(['--in', '--out', '--minutes', '--json', '--self-test'])

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

/** 解析 CLI 参数:未知旗标、吞值、非正整数一律记 usage 错(调用方据此 exit 2)。 */
export function parseArgs(argv = []) {
  const errors = []
  for (const t of argv) {
    if (typeof t === 'string' && t.startsWith('-') && !KNOWN_FLAGS.has(t)) errors.push(`未知旗标 ${t}`)
  }
  const input = pathFlag(argv, '--in', errors)
  const out = pathFlag(argv, '--out', errors)
  const minutes = intFlag(argv, '--minutes', '窗口分钟数', DEFAULT_MINUTES, errors)
  return {
    input,
    out,
    minutes,
    json: argv.includes('--json'),
    selfTest: argv.includes('--self-test'),
    errors,
  }
}

/** 自检:契约/映射/短 sha/去重/幂等/零信号/未知 action —— 全部走生产判据。 */
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
  ok('契约 version>=2 且 source 含 deploy_outcome', contract.version >= 2 && contract.fields.source.enum.includes(SOURCE))
  ok('契约 owners 登记 deploy_outcome', typeof contract.owners?.[SOURCE] === 'string' && contract.owners[SOURCE] !== '')

  const ts = '2026-10-26T10:00:00.000Z'
  const sha = '0123456789abcdef0123456789abcdef01234567'
  const mk = (over = {}) => ({
    v: DECISION_VERSION,
    ts,
    action: 'rollback',
    sha,
    failDims: ['web', 'llm'],
    reason: '健康门禁未过',
    ...over,
  })
  const expected = {
    pass: null,
    'canary-pass': null,
    'canary-unproven': null,
    'pass-unproven': { kind: 'alert_firing', severity: 'warn' },
    'pass-entry-broken': { kind: 'alert_firing', severity: 'warn' },
    rollback: { kind: 'alert_firing', severity: 'error' },
    'manual-rollback': { kind: 'alert_firing', severity: 'warn' },
    'build-fail': { kind: 'alert_firing', severity: 'error' },
    'canary-rollback': { kind: 'perf_degradation', severity: 'error' },
  }
  let mapOk = true
  for (const [action, exp] of Object.entries(expected)) {
    const r = decisionToSignal(mk({ action }), contract)
    if (!exp) {
      if (r.produce) mapOk = false
      continue
    }
    if (
      !r.produce ||
      r.signal.kind !== exp.kind ||
      r.signal.severity !== exp.severity ||
      r.signal.route !== `deploy/${action}` ||
      r.signal.source !== SOURCE ||
      !r.signal.message.includes(`action=${action}`)
    ) mapOk = false
  }
  ok('九种 action 映射全覆盖(kind/severity/route/message)', mapOk)

  const full = decisionToSignal(mk({}), contract).signal
  ok('完整 40 位 sha 保留', full.message.includes(sha) && !full.message.includes('[sha-redacted'))
  ok('message 带 dims 与 reason 摘要', full.message.includes('dims=web+llm') && full.message.includes('reason='))

  const short = decisionToSignal(mk({ sha: '8486d01d', reason: '回滚到 8486d01d' }), contract).signal
  ok('短 sha 拒绝(7~39 hex 折占位,不写进 message)', !short.message.includes('8486d01d') && short.message.includes('[sha-redacted:8]'))

  const secret = decisionToSignal(mk({ reason: 'api_key=sk-live-123456' }), contract).signal
  ok('密钥形状不落 message', !/sk-live-123456/.test(secret.message))

  const decisions = [
    { line: 1, object: mk({ action: 'rollback', ts: '2026-10-26T10:00:00.000Z' }) },
    { line: 2, object: mk({ action: 'rollback', ts: '2026-10-26T11:00:00.000Z' }) },
  ]
  const d1 = planIntake({ decisions, contract, minutes: DEFAULT_MINUTES, existing: [] })
  ok('同身份 24h 内只产一次', d1.signals.length === 1 && d1.skipped === 1)
  const far = [
    { line: 1, object: mk({ action: 'rollback', ts: '2026-10-26T10:00:00.000Z' }) },
    { line: 2, object: mk({ action: 'rollback', ts: '2026-10-27T12:00:00.000Z' }) },
  ]
  ok('超 24h 同身份可再产', planIntake({ decisions: far, contract, minutes: DEFAULT_MINUTES, existing: [] }).signals.length === 2)
  const d2 = planIntake({ decisions, contract, minutes: DEFAULT_MINUTES, existing: d1.signals })
  ok('追加幂等(--out 已有同身份行计入去重)', d2.signals.length === 0 && d2.skipped === 2)

  const zero = planIntake({ decisions: [{ line: 1, object: mk({ action: 'pass' }) }], contract, minutes: DEFAULT_MINUTES, existing: [] })
  ok('0 信号仍是已判定(undetermined=0)', zero.signals.length === 0 && zero.undetermined === 0 && zero.skipped === 1)

  const unknown = planIntake({ decisions: [{ line: 1, object: mk({ action: 'auto-heal' }) }], contract, minutes: DEFAULT_MINUTES, existing: [] })
  ok('未知 action 落未判定(不猜)', unknown.undetermined === 1 && unknown.signals.length === 0)

  for (const c of checks) console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name}${c.ok ? '' : ` — ${c.why}`}`)
  const failed = checks.filter((c) => !c.ok)
  console.log(`# deploy-outcome-intake self-test ${checks.length - failed.length}/${checks.length}`)
  return failed.length === 0 ? 0 : 1
}

function main(argv) {
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
  // 取材面走唯一出口(2026-10-28 立):--in 显式给了仍优先;否则按「生产 checkout 优先、
  // 回落主仓」选面 —— 部署环写的是 `<DevEnv>/ihui-prod/.ihui-agent/` 那本账,主仓副本只是
  // 影子(实测主仓 2 行 vs 生产 85 行);钉死主仓会把"链没跑过"读错来源(立因见 lib 头注)。
  let inPath
  if (args.input) {
    inPath = resolve(args.input)
  } else {
    const face = deployDecisionsFace()
    if (!face.found) {
      console.error(
        `未判定:两候选台账都不在(${face.candidates.map((c) => c.path).join(' , ')}),不拿不存在的面当空集`,
      )
      return 2
    }
    inPath = resolve(face.path)
    if (process.env.IHUI_DEPLOY_DECISIONS_DEBUG === '1') console.log(`DEPLOY-INTAKE face=${face.kind} ${face.path}`)
  }
  const outPath = resolve(args.out ?? DEFAULT_OUT)

  let text
  try {
    text = readFileSync(inPath, 'utf8')
  } catch (e) {
    console.error(`未判定:输入读不到 ${inPath}(${e?.code ?? e?.message ?? e})`)
    return 2
  }
  const parsed = readDecisionText(text)
  if (parsed.bad.length > 0) {
    for (const b of parsed.bad) console.error(`BAD-LINE line=${b.line} ${b.reason}`)
    console.error(`未判定:输入有 ${parsed.bad.length} 行 JSON 坏,整本台账不作判`)
    return 2
  }

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
  if (existing.bad.length > 0) {
    for (const b of existing.bad) console.error(`BAD-LINE line=${b.line} ${b.reason}`)
    console.error(`未判定:--out 已有台账有 ${existing.bad.length} 行坏,去重面不可信`)
    return 2
  }

  const result = planIntake({
    decisions: parsed.rows,
    contract,
    minutes: args.minutes,
    existing: existing.signals,
  })
  if (result.bad.length > 0) {
    for (const b of result.bad) console.error(`BAD-ROW line=${b.line} ${b.reason}`)
    console.error(`未判定:输入有 ${result.bad.length} 行部署决策形状坏,未产生任何信号`)
    return 2
  }

  if (args.json) {
    console.log(
      JSON.stringify({
        contract: { version: contract.version, reviewBy: contract.reviewBy },
        params: { minutes: args.minutes, input: inPath, out: outPath },
        judged: true,
        signals: result.signals.length,
        skipped: result.skipped,
        undetermined: 0,
        rows: result.signals,
      }),
    )
  }
  try {
    appendSignals(outPath, result.signals)
  } catch (e) {
    console.error(`DEPLOY-INTAKE-WRITE-FAILED ${outPath}: ${e?.message ?? e}`)
    return 3
  }
  console.log(`${RESULT_PREFIX} signals=${result.signals.length} skipped=${result.skipped} undetermined=0`)
  return 0
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) process.exitCode = main(process.argv.slice(2))

export const __test__ = {
  DEFAULT_IN,
  DEFAULT_OUT,
  DEFAULT_MINUTES,
  OUTCOME_MAP,
  RESULT_PREFIX,
  SOURCE,
  IntakeShapeError,
  appendSignals,
  decisionToSignal,
  parseArgs,
  parseExistingSignals,
  planIntake,
  readDecisionText,
  runSelfTest,
  sanitizeShortHex,
}
