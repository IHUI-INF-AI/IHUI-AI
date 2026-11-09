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
 *   swap-fail          是    alert_firing       error     web 蓝绿切换失败/灰度对照判红,未切流
 *   canary-rollback    是    perf_degradation   error     观察窗异常,自动回滚
 *   canary-unproven    否    —                  —         未判定(样本不足),不冒充失败
 *
 * 演练绝缘(B69,2026-11-02):`synthetic === true` 的决策(联测/演练构造记录)不产信号,
 * 只计入 `synthetic` 读数。旧形态(2026-10-31 那枚先于 `--synthetic` 存在的记录)按其
 * reason 的显式前缀「联测构造记录」识别 —— 这是对既有脏账的一次性归位,不是猜;
 * 真实回滚的 reason 绝不会以该前缀开头。演练不得变成生产 error 告警。
 *
 * 形态纪律:
 *  - 身份去重只问 `scripts/lib/incident-cluster.mjs` 的 `identityOf`(全仓唯一身份定义),
 *    不得自造第二份 key 规则;默认按**固定 24h 桶**(UTC 对齐)同身份只产一次;
 *    `--out` 已有文件的同身份行也计入去重 ⇒ 同一份输入重复跑是追加幂等的;
 *    固定桶取代 2026-11-04 之前的滑窗(实测每跑一次重复追加 2 条,详见 planIntake 头注);
 *  - message 只放 action / 完整 40 位 sha(若有) / dims / reason 摘要。7~39 位短 sha 一律
 *    折成 `[sha-redacted:<len>]`;密钥形状走 `scripts/lib/secret-shape-redact.mjs` 的唯一实现;
 *  - 不联网、不连库、不 spawn 外部进程;`--self-test` 全部走纯判据(零网络)。
 *  - **单行坏不拖垮整趟(2026-11-04 立)**:实测生产台账仅 1 行 `action:"swap-fail"`
 *    未登记于映射表,旧实现直接 `return 2` ⇒ 整本台账零信号、下游 `incident-signals.jsonl`
 *    静默 6 天,而派发戳每 20 分钟照刷。现改为逐行剔除 + 显式 `badRows=N` 上报 + 好行照常
 *    产出;**未判定仍如实落 exit 2**,不把"没判"写成"判过"(§0.3)。并发追加撕裂出的
 *    「文件末段、无换行结尾、JSON 坏」单列 `torn=N` 剔除(它不是一条完整记录,不算未判定)。
 *
 * 三态(§0.3):
 *  0 = 已判定(含 0 条信号);2 = 未判定(输入文件缺失 / JSON 坏 / 契约坏 / 参数错 /
 *      存在形状坏行,末行点名原因 —— 此时好行的信号**仍照常写出**,不整趟零产出);
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
// §0.6 单一真相源:action 闭集与其信号映射同生共死,本文件不再自抄清单。
import { OUTCOME_SIGNAL_RULES, assertActionParity } from './lib/deploy-decision-actions.mjs'
import { identityOf, loadContract, validateSignal } from './lib/incident-cluster.mjs'
import { redactAlertDetail } from './lib/secret-shape-redact.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
export const DEFAULT_IN = join(ROOT, '.ihui-agent', 'deploy-decisions.jsonl')
export const DEFAULT_OUT = join(ROOT, '.ihui-agent', 'state', 'incident-signals.jsonl')
/** 末行前缀 —— 机器读末行,人不猜。 */
export const RESULT_PREFIX = 'DEPLOY-INTAKE'
export const DEFAULT_MINUTES = 24 * 60
const SOURCE = 'deploy_outcome'
/** 旧演练记录的显式 reason 前缀(2026-10-31 那枚记录早于 `--synthetic` 字段存在)。 */
export const LEGACY_DRILL_REASON_PREFIX = '联测构造记录'
const DECISION_VERSION = 1
const MAX_REASON = 200
const MAX_DIMS = 12
const MAX_MESSAGE = 2000

/** 与 deploy-decision.mjs DECISION_ACTIONS 同源(同一张表);null = 不产出信号。 */
export const OUTCOME_MAP = OUTCOME_SIGNAL_RULES

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
 * 演练/联测记录识别:显式 `synthetic:true` 优先;旧记录按 reason 的显式前缀归位。
 * 只认这两个有据可查的形态 —— 不按 host/pid/时间窗口猜"这大概是演练"。
 */
export function isSyntheticDecision(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false
  if (raw.synthetic === true) return true
  return asText(raw.reason).startsWith(LEGACY_DRILL_REASON_PREFIX)
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
  // action 形状仍先校验(坏形状照旧落未判定);演练行在映射到告警之前绝缘。
  if (isSyntheticDecision(raw)) return { produce: false, action, synthetic: true }
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

/**
 * 逐行解析决策台账:坏行单列(带行号与原因),好行交给 decisionToSignal。
 *
 * `torn` = 共享台账并发追加时读到的**半条记录**:它必须同时满足三格才认 ——
 *   ① 是文件最后一段;② 文件不以换行结尾(本仓 appendDecision 写的每条都带 `\n`);
 *   ③ JSON 解析失败。三格缺一即按真坏行 fail-closed,绝不靠"看起来像"就放宽。
 * 它不是一条完整记录 ⇒ 剔除并显式计数,不算"未判定";真坏行仍原样留在 `bad`。
 * 刻意不把「末段解析成功但无换行」也判 torn:那会丢一条合法记录,失效方向不能是丢输入。
 */
export function readDecisionText(text) {
  const rows = []
  const bad = []
  const torn = []
  const rawText = String(text ?? '')
  const parts = rawText.split(/\r?\n/)
  const endsWithNewline = /\r?\n$/.test(rawText)
  parts.forEach((raw, i) => {
    const line = raw.trim()
    if (!line) return
    try {
      rows.push({ line: i + 1, object: JSON.parse(line) })
    } catch (e) {
      const entry = { line: i + 1, reason: `JSON 解析失败:${e?.message ?? e}` }
      if (!endsWithNewline && i === parts.length - 1) torn.push(entry)
      else bad.push(entry)
    }
  })
  return { rows, bad, torn }
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
 * 主判据:决策行 → 信号,按 `identityOf` + **固定时间桶**去重。
 * `existing` 是 `--out` 已有行(已解析对象),与 `decisions` 里本批已产出的行同入 covered。
 *
 * 去重口径(B87/B88/B91 立因,2026-11-02):身份已按 route 归一(deploy_outcome 不带 TS 码),
 * 同一轮重试只产一条信号。**同桶内若后一轮更晚**,用后一条替换待写的那条 —— 部署失败的原因
 * 在最后一轮最可诊断(末次报错指纹/维度都在里面),保留首轮会把"原因不可读"的那条固化下来。
 * 已在 `--out` 落盘的行只跳过、不替换:追加写器不改写既有台账(幂等)。
 *
 * 固定桶取代滑窗(2026-11-04 立,治实测重复写盘):
 *   旧实现用 `|t - seen.atMs| <= windowMs` 判重,且同批更晚的一轮会**原位替换**待写信号的
 *   `at`。两者叠加 ⇒ 同一身份跨多天的决策串被压成 1 条、at 落在串尾,而串中更早的决策
 *   与这个 at 相差可能 >24h ⇒ 下一轮重跑它们又从 covered 里漏出,再被压成同样 at 的一条
 *   并再次写盘。实测每跑一次重复追加 2 条完全相同(at/身份/内容)的信号;派发戳 20min
 *   一刷 ⇒ 信号账被灌水,下游 triage 把同一事故读成多次。
 *   固定桶按 UTC 对齐 `Math.floor(at / windowMs)`,每桶至多一条,落盘 at 与桶内任意决策
 *   时刻相差恒 < windowMs ⇒ 重跑时整桶都被覆盖,幂等成立。跨桶边界时宁可多产一条
 *   (失效方向朝多报),也不把"没判过"写成"判过了"。
 */
export function planIntake({ decisions, contract, minutes, existing = [] }) {
  if (!Array.isArray(decisions)) throw new IntakeShapeError('decisions 必须是数组')
  if (!Number.isInteger(minutes) || minutes < 1) {
    throw new IntakeShapeError(`minutes 必须是正整数(实得 ${minutes})`)
  }
  const windowMs = minutes * 60_000
  /** `${identity}|${bucket}` —— 已被 `--out` 或本批覆盖的槽位。 */
  const covered = new Set()
  for (const e of existing) {
    const t = Date.parse(e?.at)
    if (!Number.isFinite(t)) continue
    covered.add(`${identityOf(e)}|${Math.floor(t / windowMs)}`)
  }
  /** 本批待写信号的槽位 → 数组下标(只替换本批,不碰 --out 既有行)。 */
  const pending = new Map()
  const bad = []
  const signals = []
  let skipped = 0
  let synthetic = 0
  decisions.forEach((row, i) => {
    const line = row?.line ?? i + 1
    try {
      const r = decisionToSignal(row?.object, contract)
      if (!r.produce) {
        // 演练行单列读数:它与「pass 不产信号」是两件事,混在 skipped 里会让
        // 「演练被绝缘」看起来像「本轮正常出口」,审计时无法区分。
        if (r.synthetic) synthetic += 1
        else skipped += 1
        return
      }
      const t = Date.parse(r.signal.at)
      const key = `${identityOf(r.signal)}|${Math.floor(t / windowMs)}`
      if (covered.has(key)) {
        skipped += 1
        const at = pending.get(key)
        // 同桶更晚的一轮 ⇒ 原位替换(更可诊断),仍只产一条;更早/同刻的重复丢弃。
        // 来自 --out 的已覆盖槽位没有 pending 下标 ⇒ 绝不改写既有台账。
        if (at !== undefined && t > Date.parse(signals[at].at)) signals[at] = r.signal
        return
      }
      covered.add(key)
      pending.set(key, signals.length)
      signals.push(r.signal)
    } catch (e) {
      bad.push({ line, reason: e?.message ?? String(e) })
    }
  })
  return { signals, skipped, synthetic, bad, undetermined: bad.length }
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
    'swap-fail': { kind: 'alert_firing', severity: 'error' },
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
  ok('十种 action 映射全覆盖(kind/severity/route/message)', mapOk)
  ok('映射表由单一真源派生且与记账闭集逐字同源', assertActionParity().ok, assertActionParity().why)
  const swap = decisionToSignal(mk({ action: 'swap-fail', reason: 'web 蓝绿切换失败,未切流' }), contract)
  ok(
    'swap-fail(切流失败)产 error 告警且 route 独立',
    swap.produce === true && swap.signal.severity === 'error' && swap.signal.route === 'deploy/swap-fail',
  )

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
  // 2026-11-04 实测回归锁:滑窗去重 + 同批替换会让"每跑一次重复追加 2 条信号"成立。
  // 夹具刻意排成「相邻间隔 <24h、首尾跨度 >24h」的链式串 —— 旧实现把它压成 1 条、
  // at 落在串尾,下一轮串首重新漏出 ⇒ 又产出同一条并再次写盘;派发戳 20min 一刷即灌水。
  const chainTs = [
    '2026-10-26T10:00:00.000Z',
    '2026-10-27T08:00:00.000Z',
    '2026-10-27T22:00:00.000Z',
    '2026-10-28T18:00:00.000Z',
  ]
  const chain = chainTs.map((ts, i) => ({ line: i + 1, object: mk({ action: 'build-fail', ts }) }))
  const c1 = planIntake({ decisions: chain, contract, minutes: DEFAULT_MINUTES, existing: [] })
  const c2 = planIntake({ decisions: chain, contract, minutes: DEFAULT_MINUTES, existing: c1.signals })
  const c3 = planIntake({ decisions: chain, contract, minutes: DEFAULT_MINUTES, existing: [...c1.signals, ...c2.signals] })
  ok('跨桶链式决策:按固定桶产 3 条(不是被压成 1 条)', c1.signals.length === 3)
  ok('追加幂等(跨桶链式):第二轮 0 新行,绝不重复写盘', c2.signals.length === 0 && c2.skipped === 4)
  ok('追加幂等(跨桶链式):第三轮仍 0 新行(收敛,不是隔轮复发)', c3.signals.length === 0)

  const zero = planIntake({ decisions: [{ line: 1, object: mk({ action: 'pass' }) }], contract, minutes: DEFAULT_MINUTES, existing: [] })
  ok('0 信号仍是已判定(undetermined=0)', zero.signals.length === 0 && zero.undetermined === 0 && zero.skipped === 1)

  const unknown = planIntake({ decisions: [{ line: 1, object: mk({ action: 'auto-heal' }) }], contract, minutes: DEFAULT_MINUTES, existing: [] })
  ok('未知 action 落未判定(不猜)', unknown.undetermined === 1 && unknown.signals.length === 0)

  // —— 2026-11-04:单行坏不拖垮整趟 + 撕裂行剔除(生产台账断链的成对反向锁)——
  const goodLine = JSON.stringify(mk({}))
  const tornText = `${goodLine}\n${goodLine}\n{"v":1,"ts":"2026-10-26T10:00:00.000Z","action":"roll` // 无尾换行、末段半条
  const tornParsed = readDecisionText(tornText)
  ok(
    '末段半条(无尾换行)判 torn 剔除,好行一条不丢',
    tornParsed.torn.length === 1 && tornParsed.bad.length === 0 && tornParsed.rows.length === 2,
  )
  const midBad = readDecisionText(`${goodLine}\n{broken json}\n${goodLine}\n`)
  ok('中间行坏 + 有尾换行 ⇒ 是真坏行不是 torn', midBad.bad.length === 1 && midBad.torn.length === 0 && midBad.rows.length === 2)
  ok('末段无尾换行但 JSON 合法 ⇒ 不误判 torn(绝不丢合法记录)', readDecisionText(goodLine).rows.length === 1 && readDecisionText(goodLine).torn.length === 0)
  const mixedBad = planIntake({
    decisions: [
      { line: 1, object: mk({ action: 'auto-heal' }) },
      { line: 2, object: mk({ action: 'build-fail', ts: '2026-10-26T11:00:00.000Z' }) },
    ],
    contract,
    minutes: DEFAULT_MINUTES,
    existing: [],
  })
  ok(
    '一行形状坏 + 一行好 ⇒ 好行照常产出(旧实现会整趟零信号)',
    mixedBad.signals.length === 1 && mixedBad.bad.length === 1 && mixedBad.undetermined === 1,
  )
  ok('swap-fail 与 build-fail 身份不同(切流失败不被构建失败吞掉)', identityOf(decisionToSignal(mk({ action: 'swap-fail' }), contract).signal) !== identityOf(decisionToSignal(mk({ action: 'build-fail' }), contract).signal))

  // —— B69 演练绝缘(2026-11-02):synthetic 与旧 reason 标记都不得产 error 告警 ——
  const drill = decisionToSignal(mk({ synthetic: true }), contract)
  ok('synthetic 记录不产信号且单列标记', drill.produce === false && drill.synthetic === true)
  const legacy = decisionToSignal(mk({ reason: `${LEGACY_DRILL_REASON_PREFIX}:本机无生产部署决策账` }), contract)
  ok('旧演练 reason 前缀按 synthetic 绝缘(不产信号)', legacy.produce === false && legacy.synthetic === true)
  const real = decisionToSignal(mk({}), contract)
  ok('反向:同形真实回滚仍产 error 告警', real.produce === true && real.signal.severity === 'error' && real.signal.route === 'deploy/rollback')
  const mixed = planIntake({
    decisions: [
      { line: 1, object: mk({ synthetic: true }) },
      { line: 2, object: mk({ ts: '2026-10-26T11:00:00.000Z' }) },
    ],
    contract,
    minutes: DEFAULT_MINUTES,
    existing: [],
  })
  ok('演练计数与正常出口分开(synthetic=1 / skipped=0 / signals=1)', mixed.synthetic === 1 && mixed.skipped === 0 && mixed.signals.length === 1)

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
  // 撕裂行(末段半条、由并发追加造成)剔除并显式计数:它不是一条完整记录,
  // 让它把整本台账拖成"未判定"就是 §8 记下的那一型可整改性缺口。
  for (const t of parsed.torn) console.error(`TORN-LINE line=${t.line} ${t.reason}`)
  if (parsed.torn.length) {
    console.error(`ℹ 输入末段 ${parsed.torn.length} 行是并发追加的半条记录 ⇒ 剔除,其余行照常判`)
  }
  // 真坏行同样逐行剔除 + 显式计数,不再 `return 2` 把好行的信号一起丢掉。
  for (const b of parsed.bad) console.error(`BAD-LINE line=${b.line} ${b.reason}`)

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
  }
  // 坏行数 = JSON 坏 + 形状坏。两者都**如实落未判定**(exit 2 / undetermined=N),
  // 但好行的信号照常写出 —— "没判"绝不写成"判过",也不拿一行坏行当整趟零产出的理由。
  const badRows = parsed.bad.length + result.bad.length
  if (badRows > 0) {
    console.error(
      `未判定:输入有 ${badRows} 行坏(已逐行剔除,不冒充已判);其余行仍产出 ${result.signals.length} 条信号`,
    )
  }

  if (args.json) {
    console.log(
      JSON.stringify({
        contract: { version: contract.version, reviewBy: contract.reviewBy },
        params: { minutes: args.minutes, input: inPath, out: outPath },
        judged: badRows === 0,
        signals: result.signals.length,
        skipped: result.skipped,
        synthetic: result.synthetic,
        badRows,
        torn: parsed.torn.length,
        undetermined: badRows,
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
  console.log(
    `${RESULT_PREFIX} signals=${result.signals.length} skipped=${result.skipped} synthetic=${result.synthetic} badRows=${badRows} torn=${parsed.torn.length} undetermined=${badRows}`,
  )
  return badRows > 0 ? 2 : 0
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
  isSyntheticDecision,
  LEGACY_DRILL_REASON_PREFIX,
  parseArgs,
  parseExistingSignals,
  planIntake,
  readDecisionText,
  runSelfTest,
  sanitizeShortHex,
}
