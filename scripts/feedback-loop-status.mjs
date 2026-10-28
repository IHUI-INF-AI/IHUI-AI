// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 只读闭环报告,机器行必须走 stdout */
/**
 * feedback-loop-status — 端到端反馈闭环阶段审计器(只读)。
 *
 * 缺的那一格(2026-10-26 立):信号(producter 写 incident-signals.jsonl)、建单(feedback 台账)、
 * 派单(auto-evolve 台账)、修复提交(git log)、部署裁决(deploy-decisions 台账)各自有账,
 * 但没有任何一处能按「同一事故」把它们逐段串起来并如实标出链路断点。本器只读聚合,不猜:
 *
 *   perceived  → incident-signals.jsonl 里有该 identity 的行
 *   ticketed   → deploy-feedback-ledger.jsonl 里有该 identity 的登记行
 *   dispatched → auto-evolve-ledger.jsonl 里 mode=dispatch 且与登记行同票的行;
 *                无同票行时,若 --commits 给出了「subject 含票号」的提交 ⇒ 判 bypassed(旁路),
 *                如实标明「未走派单环」并继续评估后续阶段(不猜、不按时间相近硬凑;无提交为证仍判 no)
 *   fixed      → 提交 subject 含票号(仅 --commits 给了才跑 git;默认不跑)
 *   deployed   → 晚于派单/旁路修复时刻的 deploy-decisions 行;对齐修复提交时接受两种证据:
 *                「同 sha」或「部署 sha 包含该修复提交」(merge-base --is-ancestor) —— 后者才是常态
 *                (部署的是修复之后推进的 HEAD)。决策台账路径走 lib/deploy-decisions-face.mjs 的
 *                线上 oracle 面(生产 checkout 优先 → 回落主仓),**不钉死主仓**:部署环跑在生产
 *                checkout,其决策落那一侧,钉死主仓会让 deployed 永远看不见真部署。
 *   verified   → 最新部署裁决 action=pass/canary-pass
 *   rolled_back→ 最新部署裁决 action=rollback/manual-rollback/canary-rollback
 *
 * 判据纪律:
 *  - **缺键就是 undetermined**:登记行没有票键/票号、派单没有时间、部署行没有 sha 或时间
 *    ⇒ 相关阶段判「未判定」并在 why 里点名断在哪一段,绝不用标题相似/时间相近硬猜。
 *    票→提交环的已知缺口(台账 L28822)就落在这里:没有票号即 fixed 未判定。
 *  - **源缺失不连坐**:某一本台账取不到 ⇒ 依赖它的阶段未判定,其余阶段照常判定;
 *    坏行逐条点名 line+原因,同一本台账里的好行照常参与。
 *  - **没跑 git ≠ 没修复**:--commits 未给时 fixed 记 `not-requested`(不据此判死,也不冒充已固定);
 *    给了 --commits 却没有票号/没有命中 ⇒ undetermined。
 *  - **旁路要凭证**:派单环无同票行但有含票号提交 ⇒ 记 `bypassed`(图形 `b`)而非 `no`,
 *    否则「人工直接修复」这条真实路径会被永久误报成「尚未派单」;证不足(无票号/未跑 git)仍判 `no`,
 *    绝不因为「时间上像」就认定走过某环。
 *  - **只读**:不写任何台账、不跑 git 写操作、不改工作树;--self-test 的夹具只经
 *    scripts/lib/scratch-dir.mjs 的 mkScratch/rmScratch 落 §15b scratch 根并清理。
 *
 * 状态口径:
 *   verified / rolled_back = 闭环(closed);open = 链路已判定但尚未走到终态(未建单/未派单/未部署
 *   或构建失败);undetermined = 有环节拿不准(源缺失/缺键/裁决未判定)。
 *   配平:N = closed + open + undetermined。
 *
 * 用法:
 *   node scripts/feedback-loop-status.mjs [--state-dir <path>] [--since-hours <n>]
 *        [--commits <n>] [--json] [--self-test]
 *   末行固定:LOOP-STATUS incidents=N closed=M open=K undetermined=U
 * 退出码:0 = 已产出判定报告(含 open/undetermined 条目);2 = 上游必需输入全缺或参数形状坏;
 *         3 = 写盘失败(本器只读,不应发生)。
 */
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { extractTicketNo, loadSourcesConfig, normalizeAt, SOURCES_PATH } from './audit-decision-chain.mjs'
import { deployDecisionsFace } from './lib/deploy-decisions-face.mjs'
import { identityOf } from './lib/incident-cluster.mjs'
import { mkScratch, rmScratch } from './lib/scratch-dir.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const SCHEMA_VERSION = 1
export const DEFAULT_SINCE_HOURS = 168

export const SOURCE_FILES = Object.freeze({
  signals: 'incident-signals.jsonl',
  feedback: 'deploy-feedback-ledger.jsonl',
  dispatch: 'auto-evolve-ledger.jsonl',
  decisions: 'deploy-decisions.jsonl',
})

export const DEFAULT_PATHS = Object.freeze({
  signals: join(ROOT, '.ihui-agent', 'state', SOURCE_FILES.signals),
  feedback: join(ROOT, '.ihui-agent', 'state', SOURCE_FILES.feedback),
  dispatch: join(ROOT, '.ihui-agent', 'state', SOURCE_FILES.dispatch),
  decisions: join(ROOT, '.ihui-agent', SOURCE_FILES.decisions),
})

export const DEPLOY_ACTIONS = Object.freeze([
  'pass',
  'pass-unproven',
  'pass-entry-broken',
  'rollback',
  'manual-rollback',
  'build-fail',
  'canary-pass',
  'canary-rollback',
  'canary-unproven',
])
export const VERIFIED_ACTIONS = Object.freeze(['pass', 'canary-pass'])
export const ROLLED_BACK_ACTIONS = Object.freeze(['rollback', 'manual-rollback', 'canary-rollback'])
export const UNPROVEN_ACTIONS = Object.freeze(['pass-unproven', 'pass-entry-broken', 'canary-unproven'])
/** auto-evolve 台账里"本轮没派"的记账 action:出现它们不能算作派单证据。 */
export const NON_DISPATCH_ACTIONS = Object.freeze(['no-ticket', 'no-whitelist-hit', 'budget-exhausted', 'decision-undetermined'])

const MAX_TEXT = 400
const FULL_SHA_RE = /^[0-9a-f]{7,40}$/

export class InputError extends Error {}

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key)

export function textOf(v, max = MAX_TEXT) {
  if (v === null || v === undefined) return ''
  let s
  if (Array.isArray(v)) s = v.map((x) => textOf(x, max)).filter(Boolean).join(', ')
  else if (typeof v === 'object') s = JSON.stringify(v)
  else s = String(v)
  s = s.replace(/\s+/g, ' ').trim()
  return s.length > max ? `${s.slice(0, max)}…` : s
}

/** 语义槽取值:按候选键优先级取第一个非空值(空串/null/空数组都算没取到)。 */
export function pickSlot(raw, keys) {
  if (!isPlainObject(raw)) return null
  for (const key of keys || []) {
    if (!hasOwn(raw, key)) continue
    const v = raw[key]
    if (v === null || v === undefined) continue
    if (typeof v === 'string' && !v.trim()) continue
    if (Array.isArray(v) && v.length === 0) continue
    return v
  }
  return null
}

/** JSONL 逐行解析:坏行带原始行号与原因;好行不受坏行连坐。 */
export function readJsonl(path) {
  let text
  try {
    text = readFileSync(path, 'utf8')
  } catch (e) {
    if (e && e.code === 'ENOENT') {
      return { path, state: 'missing', why: `文件不存在:${path}`, records: [], badLines: [], totalLines: 0 }
    }
    return { path, state: 'error', why: `读取失败(${e?.code ?? e?.message}):${path}`, records: [], badLines: [], totalLines: 0 }
  }
  const records = []
  const badLines = []
  let totalLines = 0
  const lines = String(text).split(/\r?\n/)
  for (let i = 0; i < lines.length; i += 1) {
    const t = lines[i].trim()
    if (!t) continue
    totalLines += 1
    let obj
    try {
      obj = JSON.parse(t)
    } catch {
      badLines.push({ line: i + 1, why: 'JSON 解析失败' })
      continue
    }
    if (!isPlainObject(obj)) {
      badLines.push({ line: i + 1, why: '不是 JSON 对象' })
      continue
    }
    records.push({ ...obj, __line: i + 1 })
  }
  return { path, state: badLines.length > 0 ? 'partial' : 'ok', why: '', records, badLines, totalLines }
}

/** 路径面:默认三本在 .ihui-agent/state/、部署决策在 .ihui-agent/;--state-dir 则四本平铺。 */
export function resolvePaths({ root = ROOT, stateDir = null } = {}) {
  if (stateDir) {
    const d = resolve(stateDir)
    return {
      signals: join(d, SOURCE_FILES.signals),
      feedback: join(d, SOURCE_FILES.feedback),
      dispatch: join(d, SOURCE_FILES.dispatch),
      decisions: join(d, SOURCE_FILES.decisions),
    }
  }
  // 部署决策台账按「线上 oracle 面」解析,不钉死主仓:部署环(nssm IHUI-DEPLOYLOOP)跑的是
  // 生产 checkout,决策行落在那一侧(实测 2026-10-28 22:48:主仓 3 行 vs 生产 88 行,含当轮
  // pass sha=75b5ffdc897),钉死主仓会让 deployed 阶段永远看不见真部署、把已闭环的事故报成未部署。
  // 复用 lib/deploy-decisions-face.mjs 的唯一出口(生产优先 → 回落主仓),不在此另立第二套候选。
  let decisions = join(root, '.ihui-agent', SOURCE_FILES.decisions)
  try {
    const face = deployDecisionsFace({ repoRoot: root })
    if (face.found && face.path) decisions = face.path
  } catch {
    /* 面解析异常 ⇒ 保持主仓候选;readJsonl 会判 missing/error 并在报告里点名路径,读错面可见 */
  }
  return {
    signals: join(root, '.ihui-agent', 'state', SOURCE_FILES.signals),
    feedback: join(root, '.ihui-agent', 'state', SOURCE_FILES.feedback),
    dispatch: join(root, '.ihui-agent', 'state', SOURCE_FILES.dispatch),
    decisions,
  }
}

/**
 * 信号身份:显式字段优先;否则一律复用 `scripts/lib/incident-cluster.mjs` 的 `identityOf`
 * (全仓唯一身份判据,与 intake/deploy-feedback 同一把尺子)。
 * 本函数只做槽取值与「取不到身份时返回 why」的适配,不在此另写第二套格式。
 * 两段源键都缺 ⇒ identity 为空并由 why 点名,调用方不得用消息相似度补身份。
 */
export function signalIdentityOf(raw) {
  const explicit = textOf(pickSlot(raw, ['identity', 'incidentIdentity', 'signalIdentity', 'clusterKey', 'signalKey']))
  if (explicit) return { identity: explicit, basis: 'explicit', why: '' }
  const source = textOf(pickSlot(raw, ['source', 'producer', 'channel']))
  const kind = textOf(pickSlot(raw, ['kind', 'type', 'category']))
  if (!source || !kind) return { identity: '', basis: '', why: '缺 identity 且缺 source/kind 键' }
  const route = textOf(pickSlot(raw, ['route', 'path', 'endpoint']))
  const message = textOf(pickSlot(raw, ['message', 'msg', 'text', 'title', 'summary']))
  if (!route && !message) return { identity: '', basis: '', why: '缺 identity 且缺 route/code/message 键' }
  return { identity: identityOf({ source, kind, route, message }), basis: 'derived', why: '' }
}

export function normalizeSignal(raw) {
  const id = signalIdentityOf(raw)
  return {
    line: raw.__line ?? null,
    at: normalizeAt(pickSlot(raw, ['at', 'ts', 'timestamp', 'time', 'observedAt'])),
    source: textOf(pickSlot(raw, ['source', 'producer', 'channel']), 80),
    kind: textOf(pickSlot(raw, ['kind', 'type', 'category']), 80),
    severity: textOf(pickSlot(raw, ['severity', 'level']), 40),
    message: textOf(pickSlot(raw, ['message', 'msg', 'text', 'title', 'summary'])),
    identity: id.identity,
    identityBasis: id.basis,
    identityWhy: id.why,
  }
}

function ticketOf(raw) {
  const nested = isPlainObject(raw.ticket) ? raw.ticket : null
  const key = textOf(pickSlot(raw, ['ticketKey', 'ticket_key']), 80) || textOf(pickSlot(nested, ['key', 'ticketKey']), 80)
  const face =
    textOf(pickSlot(raw, ['ticketLine', 'ticketText', 'ticket', 'ticketNo', 'ticketNumber', 'ticketId', 'row'])) ||
    textOf(pickSlot(nested, ['line', 'text', 'face', 'no', 'number', 'id']))
  const no =
    textOf(pickSlot(raw, ['ticketNo', 'ticketNumber', 'ticketId']), 40) ||
    textOf(pickSlot(nested, ['no', 'number', 'id']), 40)
  return { key, face, no }
}

export function normalizeFeedback(raw, patterns = []) {
  const ticket = ticketOf(raw)
  const id =
    textOf(pickSlot(raw, ['identity', 'incidentIdentity', 'signalIdentity', 'clusterKey', 'signalKey'])) ||
    textOf(pickSlot(isPlainObject(raw.signal) ? raw.signal : null, ['identity', 'id', 'key']))
  return {
    line: raw.__line ?? null,
    at: normalizeAt(pickSlot(raw, ['at', 'ts', 'timestamp', 'registeredAt', 'createdAt'])),
    identity: id,
    ticketKey: ticket.key,
    ticketFace: ticket.face,
    ticketNo: ticket.no || extractTicketNo(ticket.face, patterns) || '',
    result: textOf(pickSlot(raw, ['result', 'outcome', 'status']), 40),
    why: textOf(pickSlot(raw, ['why', 'reason', 'note'])),
  }
}

export function normalizeDispatch(raw) {
  const action = textOf(pickSlot(raw, ['action', 'event', 'kind']), 80)
  const mode = textOf(pickSlot(raw, ['mode', 'phase']), 40)
  return {
    line: raw.__line ?? null,
    at: normalizeAt(pickSlot(raw, ['ts', 'at', 'timestamp', 'time'])),
    action,
    mode,
    ticketKey: textOf(pickSlot(raw, ['ticketKey']), 80),
    ticketLine: textOf(pickSlot(raw, ['ticketLine', 'ticket', 'ticketText', 'ticketFace'])),
    reason: textOf(pickSlot(raw, ['why', 'note', 'reason'])),
    isDispatch: mode === 'dispatch' && !NON_DISPATCH_ACTIONS.includes(action),
  }
}

export function normalizeDecision(raw) {
  return {
    line: raw.__line ?? null,
    at: normalizeAt(pickSlot(raw, ['ts', 'at', 'timestamp', 'time'])),
    action: textOf(pickSlot(raw, ['action', 'decision']), 80),
    sha: textOf(pickSlot(raw, ['sha', 'deploySha', 'landedSha'])).toLowerCase(),
    prevSha: textOf(pickSlot(raw, ['prevSha', 'previousSha'])).toLowerCase(),
    reason: textOf(pickSlot(raw, ['reason', 'why', 'note'])),
  }
}

/**
 * 提交包含判据:descendantSha 是否包含 ancestorSha(即 ancestorSha 是它的祖先或本身)。
 * 为什么需要:「部署了修复之后的提交」同样是「修复已上线」的充分证据;只认同 sha 会把真实上线
 * 判成「未部署」。只读(git merge-base --is-ancestor),任何失败一律 false —— 不把「判不了」说成「包含」。
 * 带进程内缓存,同一对 sha 只查一次。可注入 spawn 供测试隔离。
 */
export function makeAncestorCheck({ root = ROOT, spawn = spawnSync } = {}) {
  const cache = new Map()
  return (ancestorSha, descendantSha) => {
    const a = String(ancestorSha || '').toLowerCase()
    const d = String(descendantSha || '').toLowerCase()
    if (!a || !d) return false
    const key = `${a}..${d}`
    if (cache.has(key)) return cache.get(key)
    let ok = false
    try {
      // stdio 必须显式写(2026-10-28 修):本机派生面不接管 stdio 时 0/30 成功(EBUSY),
      // 而这一格判的是「修复是否已上线」——它一旦恒 false,真实上线会被判成未部署(安静假红)。
      // 判据只认属性名,取值仍要 pipe 以保住 stdout 捕获。
      const r = spawn('git', ['merge-base', '--is-ancestor', a, d], {
        cwd: root,
        encoding: 'utf8',
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      ok = !!(r && r.status === 0)
    } catch {
      ok = false
    }
    cache.set(key, ok)
    return ok
  }
}

/** git log 取数:只在 --commits 显式给了才调用;失败返回 ok:false(由调用方判未判定)。 */
export function runGitLog({ root = ROOT, commits = 0, spawn = spawnSync } = {}) {
  if (!Number.isInteger(commits) || commits <= 0) {
    return { ok: true, why: '未请求 git', commits: [] }
  }
  const r = spawn('git', ['log', `-n${commits}`, '--format=%H%x09%cI%x09%s'], {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  if (r && r.error) return { ok: false, why: `git 不可用:${r.error.message}`, commits: [] }
  if (!r || r.status !== 0) {
    return { ok: false, why: `git log 退出码 ${r?.status ?? 'null'}:${String(r?.stderr ?? '').trim().slice(-200)}`, commits: [] }
  }
  const out = []
  for (const line of String(r.stdout ?? '').split(/\r?\n/)) {
    if (!line.trim()) continue
    const [sha, at, ...rest] = line.split('\t')
    out.push({ sha: textOf(sha).toLowerCase(), at: normalizeAt(at), subject: rest.join('\t').trim() })
  }
  return { ok: true, why: '', commits: out }
}

function loadTicketPatterns() {
  try {
    const cfg = loadSourcesConfig(SOURCES_PATH)
    return cfg.ok && Array.isArray(cfg.ticketNoPatterns) ? cfg.ticketNoPatterns : []
  } catch {
    return []
  }
}

function uniqTickets(list) {
  const out = []
  const seen = new Set()
  for (const t of list) {
    const tag = `${t.key}\u0000${t.face}\u0000${t.no}`
    if (seen.has(tag)) continue
    seen.add(tag)
    out.push(t)
  }
  return out
}

function dispatchMatchesTicket(d, ticket) {
  if (!d || !ticket) return false
  if (ticket.key && d.ticketKey && ticket.key === d.ticketKey) return true
  if (ticket.no && d.ticketLine && d.ticketLine.includes(ticket.no)) return true
  return false
}

function shaMatches(a, b) {
  if (!a || !b) return false
  if (!FULL_SHA_RE.test(a) || !FULL_SHA_RE.test(b)) return false
  return a === b || (a.length >= 7 && b.length >= 7 && (a.startsWith(b) || b.startsWith(a)))
}

function latestByAt(rows) {
  let best = null
  for (const r of rows) {
    if (!r.at) continue
    if (!best || r.at > best.at) best = r
  }
  return best
}

function inWindowAt(at, sinceMs) {
  if (sinceMs === null) return true
  if (!at) return true // 无时间戳不静默丢弃,由报告注记
  const t = Date.parse(at)
  return Number.isFinite(t) && t >= sinceMs
}

const STAGE_MARKS = { yes: 'Y', no: '.', undetermined: '?', bypassed: 'b', 'not-requested': 'skip', 'not-reached': '-' }

function mark(v) {
  return STAGE_MARKS[v] ?? String(v ?? '?')
}

function shortText(s, n = 50) {
  const t = String(s ?? '')
  return t.length > n ? `${t.slice(0, n - 1)}…` : t
}

/**
 * 单条事故的阶段判定(纯函数):输入已归一的信号/登记/派单/部署行与各源状态。
 * 任何一处拿不准都写入 why 并点名阶段;状态最终由 verified/rolled_back/undetermined 决定。
 */
export function judgeIncident({ identity, signals, feedback, dispatchRows, decisionRows, sourceStates, commitsRequested, git, isAncestor = null }) {
  const stages = {
    perceived: 'no',
    ticketed: 'no',
    dispatched: 'not-reached',
    fixed: commitsRequested ? 'undetermined' : 'not-requested',
    deployed: 'not-reached',
    verified: 'not-reached',
    rolled_back: 'not-reached',
  }
  const breaks = []
  const notes = []
  const evidence = {}
  let undetermined = false
  const undet = (msg) => {
    undetermined = true
    breaks.push(msg)
  }

  const sigRows = signals.filter((s) => s.identity === identity)
  const fbRows = feedback.filter((f) => f.identity === identity)
  const fbSourceState = sourceStates.feedback
  const dispatchState = sourceStates.dispatch
  const decisionState = sourceStates.decisions

  // —— perceived ——
  if (sigRows.length > 0) {
    stages.perceived = 'yes'
    const first = sigRows.map((s) => s.at).filter(Boolean).sort()[0] || null
    evidence.signalAt = first
    evidence.signalSeverity = sigRows.map((s) => s.severity).filter(Boolean)[0] || ''
  } else if (sourceStates.signals === 'missing' || sourceStates.signals === 'error') {
    stages.perceived = 'undetermined'
    undet(`断在 perceived:信号台账${sourceStates.signals === 'missing' ? '不存在' : '读不出'}`)
  } else if (fbRows.length > 0) {
    stages.perceived = 'no'
    undet('断在 perceived:登记台账已登记该身份,但信号台账无对应行(感知环未闭环)')
  } else {
    stages.perceived = 'no'
  }

  // —— ticketed ——
  if (fbSourceState === 'missing' || fbSourceState === 'error') {
    stages.ticketed = 'undetermined'
    undet(`断在 ticketed:登记台账${fbSourceState === 'missing' ? '不存在' : '读不出'}`)
  } else if (fbRows.length > 0) {
    // 台账有行 ≠ 建单成功:result=undetermined/failed 是「写盘被打断」,dry-run/skip 是演练或跳过,
    // 三者都不算真建单。只有真空或明确成功态才算 ticketed=yes,否则如实判未判定并点名 result 分布。
    const OK_RESULTS = new Set(['', 'registered', 'ok', 'created'])
    const okRows = fbRows.filter((f) => OK_RESULTS.has(String(f.result ?? '').toLowerCase()))
    if (okRows.length > 0) {
      stages.ticketed = 'yes'
      evidence.feedbackAt = okRows.map((f) => f.at).filter(Boolean).sort()[0] || null
    } else {
      stages.ticketed = 'undetermined'
      const dist = [...new Set(fbRows.map((f) => String(f.result ?? '').toLowerCase() || '空'))].join('/')
      undet(`断在 ticketed:登记台账有该身份 ${fbRows.length} 行,但 result 均非成功态(${dist}) —— 建单未落地`)
    }
  }

  const tickets = uniqTickets(fbRows.map((f) => ({ key: f.ticketKey, face: f.ticketFace, no: f.ticketNo })))
  if (tickets.length > 0) {
    evidence.ticketKey = tickets.map((t) => t.key).filter(Boolean).join(',')
    evidence.ticketNo = tickets.map((t) => t.no).filter(Boolean).join(',')
  }

  // 上游没建单 ⇒ 后续阶段尚未到达(不是断链);但若上游源缺失则保持未判定。
  if (stages.ticketed === 'no' && sigRows.length > 0) {
    notes.push('尚未建单(登记台账已读,无该身份行)')
    return finish()
  }

  // —— dispatched ——
  if (stages.ticketed === 'undetermined') {
    stages.dispatched = 'not-reached'
    stages.fixed = stages.fixed === 'not-requested' ? 'not-requested' : 'not-reached'
    return finish()
  }
  if (dispatchState === 'missing' || dispatchState === 'error') {
    stages.dispatched = 'undetermined'
    undet(`断在 dispatched:派单台账${dispatchState === 'missing' ? '不存在' : '读不出'}`)
    return finish()
  }
  // 只有票键或可解析票号才算"有关联键";整段自由文本的 ticket 不参与对齐(避免相似标题硬猜)。
  const hasLookupKey = tickets.some((t) => t.key || t.no)
  if (!hasLookupKey) {
    stages.dispatched = 'undetermined'
    undet('断在 dispatched:登记行未带票键/票号(票面无可解析票号),无法与派单台账对齐')
    return finish()
  }
  const matchedDispatch = dispatchRows.filter((d) => d.isDispatch && tickets.some((t) => dispatchMatchesTicket(d, t)))
  // 派单台账无同票行时不立刻判死:真实工作流存在「跳过派单、人工直接修复并提交」的旁路。
  // 旁路必须有「subject 含票号」的提交为证(不猜、不按时间相近硬凑);无证则如实判「尚未派单」。
  let bypassFix = null
  if (matchedDispatch.length === 0) {
    if (commitsRequested && git && git.ok === true && evidence.ticketNo) {
      const nos = String(evidence.ticketNo).split(',').filter(Boolean)
      const hitsB = git.commits.filter((c) => nos.some((no) => c.subject.toLowerCase().includes(no.toLowerCase())))
      // 与 fixed 阶段同一把尺子:取最早命中。否则旁路时间基准会被最新的同票提交推到部署之后,
      // 出现「修复在部署之后」的假象而误报未部署。
      bypassFix = hitsB.length
        ? hitsB.slice().sort((a, b) => String(a.at || '').localeCompare(String(b.at || '')))[0]
        : null
    }
    if (!bypassFix) {
      stages.dispatched = 'no'
      notes.push('尚未派单(派单台账已读,无同票 dispatch 行)')
      return finish()
    }
    stages.dispatched = 'bypassed'
    notes.push(`未走派单环(派单台账无同票行),但有含票号 ${evidence.ticketNo} 的提交 ${bypassFix.sha.slice(0, 7)} —— 按旁路修复认定`)
    evidence.bypassFixSha = bypassFix.sha
    evidence.bypassFixAt = bypassFix.at || null
  } else {
    stages.dispatched = 'yes'
    const firstDispatch = matchedDispatch.filter((d) => d.at).sort((a, b) => a.at.localeCompare(b.at))[0] || matchedDispatch[0]
    evidence.dispatchAt = matchedDispatch.map((d) => d.at).filter(Boolean).sort()[0] || null
    evidence.dispatchAction = firstDispatch.action
    evidence.dispatchLine = firstDispatch.line

    const dispatchFailures = matchedDispatch.filter((d) => d.action === 'session-failed' || d.action === 'session-timeout' || d.action === 'mint-failed' || d.action === 'quarantined')
    if (dispatchFailures.length > 0 && !matchedDispatch.some((d) => d.action === 'session-ok' || d.action === 'dispatched')) {
      notes.push(`派单未成功(action=${dispatchFailures[0].action})`)
    }
  }

  // —— fixed ——
  let fixSha = ''
  if (!commitsRequested) {
    stages.fixed = 'not-requested'
    notes.push('修复环未评估(--commits 未给,git 不是必选输入)')
  } else if (!git || git.ok !== true) {
    stages.fixed = 'undetermined'
    undet(`断在 fixed:git 取数失败(${git?.why || '未提供'})`)
  } else if (!evidence.ticketNo) {
    stages.fixed = 'undetermined'
    undet('断在 fixed:登记行票面无票号,commit subject 无从对齐(票→提交环未闭环,见台账 L28822)')
  } else {
    const nos = String(evidence.ticketNo).split(',').filter(Boolean)
    const hits = git.commits.filter((c) => nos.some((no) => c.subject.toLowerCase().includes(no.toLowerCase())))
    if (hits.length === 0) {
      stages.fixed = 'undetermined'
      undet(`断在 fixed:最近 ${git.commits.length} 条 commit subject 均未含票号 ${nos.join('/')}(票→提交环未闭环)`)
    } else {
      stages.fixed = 'yes'
      // 取最早命中的那枚:修复的语义是「第一次修好」,更晚的同票提交多是结清/注记/器件补强。
      // 取最新会把 fixAt 推到部署之后,连带把「已上线的部署」判成「早于修复」而误报未部署。
      const earliest = hits
        .slice()
        .sort((a, b) => String(a.at || '').localeCompare(String(b.at || '')))[0]
      fixSha = earliest.sha
      evidence.fixSha = earliest.sha
      evidence.fixSubject = earliest.subject
      evidence.fixAt = earliest.at
      if (hits.length > 1) notes.push(`同票提交 ${hits.length} 枚,修复环按最早 ${String(earliest.sha).slice(0, 7)} 认定`)
    }
  }

  // —— deployed ——
  if (decisionState === 'missing' || decisionState === 'error') {
    stages.deployed = 'undetermined'
    undet(`断在 deployed:部署决策台账${decisionState === 'missing' ? '不存在' : '读不出'}`)
    return finish()
  }
  const deployBaselineAt = evidence.dispatchAt || evidence.bypassFixAt || null
  if (!deployBaselineAt) {
    stages.deployed = 'undetermined'
    undet(stages.dispatched === 'bypassed'
      ? '断在 deployed:旁路修复提交无时间键,无法判断哪次部署晚于修复'
      : '断在 deployed:同票 dispatch 行无时间键,无法判断哪次部署晚于派单')
    return finish()
  }
  if (!evidence.dispatchAt) evidence.deployBaseline = 'bypass-fix'
  const baselineWord = evidence.dispatchAt ? '派单' : '旁路修复'
  const dispatchMs = Date.parse(deployBaselineAt)
  // 变量名沿用 afterDispatch:语义是「基准时刻之后的部署决策行」,基准可能是派单时刻或旁路修复提交时刻。
  const afterDispatch = decisionRows.filter((d) => d.at && Date.parse(d.at) > dispatchMs)
  const deployFacts = afterDispatch.filter((d) => d.action !== 'build-fail')
  const buildFails = afterDispatch.filter((d) => d.action === 'build-fail')

  let chosen = null
  if (fixSha) {
    // 「同 sha」或「部署提交包含修复提交」都算修复已上线:后者才是常态(部署的是修复之后推进的 HEAD)。
    const sameSha = deployFacts.filter(
      (d) => shaMatches(d.sha, fixSha) || (typeof isAncestor === 'function' && isAncestor(fixSha, d.sha)),
    )
    if (sameSha.length > 0) {
      chosen = latestByAt(sameSha)
      evidence.deployBasis = shaMatches(chosen.sha, fixSha) ? 'sha' : 'contains-fix'
      if (evidence.deployBasis === 'contains-fix') {
        notes.push(`部署提交 ${String(chosen.sha).slice(0, 7)} 包含修复提交 ${String(fixSha).slice(0, 7)} ⇒ 修复已上线`)
      }
    } else if (deployFacts.length > 0) {
      stages.deployed = 'undetermined'
      undet(`断在 deployed:晚于${baselineWord}的部署决策均不含修复提交 ${String(fixSha).slice(0, 7)}(同 sha 与祖先包含皆非)`)
      return finish()
    }
  } else if (deployFacts.length > 0) {
    chosen = latestByAt(deployFacts)
    evidence.deployBasis = 'time'
    notes.push('部署环仅按时间关联(无修复 sha 可对齐)')
  }

  if (!chosen) {
    stages.deployed = 'no'
    if (buildFails.length > 0) {
      notes.push(`构建失败未部署(action=build-fail,${buildFails[0].reason || '无原因'})`)
    } else {
      notes.push(`尚未部署(部署决策台账已读,无晚于${baselineWord}的部署行)`)
    }
    return finish()
  }

  if (!DEPLOY_ACTIONS.includes(chosen.action)) {
    stages.deployed = 'undetermined'
    undet(`断在 deployed:部署决策 action 不在闭集内(「${chosen.action || '(空)'}」)`)
    return finish()
  }

  stages.deployed = 'yes'
  evidence.deployAt = chosen.at
  evidence.deployAction = chosen.action
  evidence.deploySha = chosen.sha
  evidence.deployReason = chosen.reason

  // —— verified / rolled_back ——
  if (VERIFIED_ACTIONS.includes(chosen.action)) {
    stages.verified = 'yes'
    stages.rolled_back = 'no'
  } else if (ROLLED_BACK_ACTIONS.includes(chosen.action)) {
    stages.verified = 'no'
    stages.rolled_back = 'yes'
  } else if (UNPROVEN_ACTIONS.includes(chosen.action)) {
    stages.verified = 'undetermined'
    stages.rolled_back = 'undetermined'
    undet(`断在 verified/rolled_back:最新部署裁决未判定(action=${chosen.action})`)
  } else if (chosen.action === 'build-fail') {
    stages.deployed = 'no'
    notes.push('构建失败未部署(action=build-fail)')
  }

  return finish()

  function finish() {
    let status
    if (undetermined) status = 'undetermined'
    else if (stages.verified === 'yes') status = 'verified'
    else if (stages.rolled_back === 'yes') status = 'rolled_back'
    else status = 'open'
    const why = breaks.concat(notes).join(';')
    return { identity, stages, status, why, evidence }
  }
}

/**
 * 主报告构建(只读):四源读取三态 → 时间窗 → 按 identity 聚合成事故 → 逐段判定。
 * 纯函数式(可注入 root/stateDir/git),供 CLI、自检与镜像测试共用同一套判据。
 */
export function buildStatus({
  root = ROOT,
  stateDir = null,
  sinceHours = DEFAULT_SINCE_HOURS,
  commits = 0,
  git = null,
  isAncestor = null,
  now = new Date(),
  ticketNoPatterns = null,
} = {}) {
  const paths = resolvePaths({ root, stateDir })
  const patterns = Array.isArray(ticketNoPatterns) ? ticketNoPatterns : loadTicketPatterns()
  const sinceMs = sinceHours === 0 ? null : now.getTime() - sinceHours * 3600_000

  const loaded = {
    signals: readJsonl(paths.signals),
    feedback: readJsonl(paths.feedback),
    dispatch: readJsonl(paths.dispatch),
    decisions: readJsonl(paths.decisions),
  }
  const labels = {
    signals: '信号台账(incident-signals)',
    feedback: '登记台账(deploy-feedback)',
    dispatch: '派单台账(auto-evolve)',
    decisions: '部署决策台账(deploy-decisions)',
  }
  const sources = []
  const badLines = []
  for (const key of ['signals', 'feedback', 'dispatch', 'decisions']) {
    const src = loaded[key]
    sources.push({
      id: key,
      label: labels[key],
      path: src.path,
      state: src.state,
      why: src.why,
      totalLines: src.totalLines,
      records: src.records.length,
      badLines: src.badLines,
    })
    for (const b of src.badLines) badLines.push({ source: key, line: b.line, why: b.why })
  }
  const notes = []
  for (const s of sources) {
    if (s.state === 'missing') notes.push(`源 ${s.id} 未判定:${s.why}`)
    else if (s.state === 'error') notes.push(`源 ${s.id} 未判定:${s.why}`)
    else if (s.state === 'partial') notes.push(`源 ${s.id} 有 ${s.badLines.length} 条坏行(好行照常参与)`)
  }

  const signalsAll = loaded.signals.records.map(normalizeSignal)
  const feedbackAll = loaded.feedback.records.map((r) => normalizeFeedback(r, patterns))
  const dispatchAll = loaded.dispatch.records.map(normalizeDispatch)
  const decisionsAll = loaded.decisions.records.map(normalizeDecision)

  let excludedSignals = 0
  let excludedFeedback = 0
  let untimedSignals = 0
  let untimedFeedback = 0
  const signals = []
  for (const s of signalsAll) {
    if (!s.identity) {
      notes.push(`信号行 line ${s.line} 身份未判定:${s.identityWhy}`)
      continue
    }
    if (!s.at) untimedSignals += 1
    if (!inWindowAt(s.at, sinceMs)) {
      excludedSignals += 1
      continue
    }
    signals.push(s)
  }
  const feedback = []
  for (const f of feedbackAll) {
    if (!f.identity) {
      notes.push(`登记行 line ${f.line} 身份未判定(缺 identity),无法归属事故`)
      continue
    }
    if (!f.at) untimedFeedback += 1
    if (!inWindowAt(f.at, sinceMs)) {
      excludedFeedback += 1
      continue
    }
    feedback.push(f)
  }
  if (excludedSignals > 0) notes.push(`信号 ${excludedSignals} 条在 --since-hours ${sinceHours} 窗外,未进报告`)
  if (excludedFeedback > 0) notes.push(`登记 ${excludedFeedback} 条在时间窗外,未进报告`)
  if (untimedSignals > 0) notes.push(`信号 ${untimedSignals} 条无时间戳,按未判定时间保留`)
  if (untimedFeedback > 0) notes.push(`登记 ${untimedFeedback} 条无时间戳,按未判定时间保留`)

  const identities = []
  const seen = new Set()
  for (const s of signals) {
    if (!seen.has(s.identity)) {
      seen.add(s.identity)
      identities.push(s.identity)
    }
  }
  for (const f of feedback) {
    if (!seen.has(f.identity)) {
      seen.add(f.identity)
      identities.push(f.identity)
    }
  }

  const gitResult = git || runGitLog({ root, commits })
  if (commits > 0 && !gitResult.ok) notes.push(`git 取数未判定:${gitResult.why}`)
  // 部署环的「包含修复」判据:没给 --commits 就不必查 git;给了才默认走只读 merge-base。
  const ancestorCheck = typeof isAncestor === 'function' ? isAncestor : commits > 0 ? makeAncestorCheck({ root }) : null
  const sourceStates = {
    signals: loaded.signals.state,
    feedback: loaded.feedback.state,
    dispatch: loaded.dispatch.state,
    decisions: loaded.decisions.state,
  }

  const incidents = identities.map((identity) =>
    judgeIncident({
      identity,
      signals,
      feedback,
      dispatchRows: dispatchAll,
      decisionRows: decisionsAll,
      sourceStates,
      commitsRequested: commits > 0,
      git: gitResult,
      isAncestor: ancestorCheck,
    }),
  )

  const closed = incidents.filter((i) => i.status === 'verified' || i.status === 'rolled_back').length
  const open = incidents.filter((i) => i.status === 'open').length
  const undeterminedCount = incidents.filter((i) => i.status === 'undetermined').length
  const summary = {
    incidents: incidents.length,
    closed,
    open,
    undetermined: undeterminedCount,
    balanced: incidents.length === closed + open + undeterminedCount,
  }

  const upstreamUnavailable =
    (loaded.signals.state === 'missing' || loaded.signals.state === 'error') &&
    (loaded.feedback.state === 'missing' || loaded.feedback.state === 'error')

  return {
    tool: 'feedback-loop-status',
    version: SCHEMA_VERSION,
    status: upstreamUnavailable ? 'undetermined' : 'ok',
    sinceHours,
    commitsRequested: commits > 0,
    commits,
    sources,
    badLines,
    incidents,
    summary,
    notes,
    upstreamUnavailable,
  }
}

export function formatSummaryLine(summary) {
  return `LOOP-STATUS incidents=${summary.incidents} closed=${summary.closed} open=${summary.open} undetermined=${summary.undetermined}`
}

function stateText(s) {
  if (s.state === 'ok') return '已读'
  if (s.state === 'partial') return `部分(坏行 ${s.badLines.length})`
  if (s.state === 'missing') return '未判定(文件不存在)'
  return `未判定(${s.why})`
}

/** 人读表:阶段逐段打点(Y 已达成 / . 未达成 / ? 未判定 / skip 未评估 / - 尚未到达)。 */
export function renderHuman(report) {
  const out = []
  out.push(`FEEDBACK-LOOP status=${report.status} sinceHours=${report.sinceHours} commits=${report.commitsRequested ? report.commits : 'off'}`)
  out.push('  台账源:')
  for (const s of report.sources) {
    out.push(`    - ${s.id} ${stateText(s)} lines=${s.totalLines} records=${s.records}${s.state === 'partial' || s.state === 'missing' || s.state === 'error' ? ` why=${s.why || '(坏行)'}` : ''}`)
  }
  if (report.badLines.length > 0) {
    out.push('  坏行(逐条点名,不连坐其它行):')
    for (const b of report.badLines) out.push(`    - ${b.source} line ${b.line}:${b.why}`)
  }
  out.push('  阶段表 [感知 建单 派单 修复 部署 裁决] 图例 Y=已达成 .=未达成 ?=未判定 b=旁路(未走本环,有票号提交为证) skip=未评估 -=尚未到达')
  if (report.incidents.length === 0) {
    out.push('    (0 条事故/信号)')
  } else {
    for (const it of report.incidents) {
      const s = it.stages
      const verdict = s.verified === 'yes' ? 'verified' : s.rolled_back === 'yes' ? 'rolled_back' : 'no-verdict'
      out.push(
        `    ${shortText(it.identity, 50)}  ${mark(s.perceived)} ${mark(s.ticketed)} ${mark(s.dispatched)} ${mark(s.fixed)} ${mark(s.deployed)} ${mark(s.verified === 'yes' || s.rolled_back === 'yes' ? 'yes' : s.verified)}  ${it.status}(${verdict})`,
      )
      if (it.why) out.push(`      why: ${it.why}`)
    }
  }
  for (const n of report.notes) out.push(`  注:${n}`)
  out.push(formatSummaryLine(report.summary))
  return out.join('\n')
}

function parseArgs(argv) {
  const out = { _: [] }
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (!a.startsWith('--')) {
      out._.push(a)
      continue
    }
    const key = a.slice(2)
    const eq = key.indexOf('=')
    if (eq >= 0) {
      out[key.slice(0, eq)] = key.slice(eq + 1)
      continue
    }
    const next = argv[i + 1]
    if (next === undefined || next.startsWith('--')) {
      out[key] = true
      continue
    }
    out[key] = next
    i += 1
  }
  return out
}

function positiveInt(raw, flag, { allowZero = false } = {}) {
  const s = String(raw ?? '').trim()
  if (!/^\d+$/.test(s)) throw new InputError(`${flag} 需要非负整数,实得「${s || '(空)'}」`)
  const n = Number(s)
  if (!allowZero && n === 0) throw new InputError(`${flag} 必须大于 0`)
  return n
}

/** 自检:四本台账夹具经 mkScratch 落 §15b scratch 根(不写 os.tmpdir),跑完即清;不碰真实 .ihui-agent。 */
export function selfTest() {
  const checks = []
  const t = (name, fn) => {
    try {
      fn()
      checks.push({ name, ok: true })
    } catch (e) {
      checks.push({ name, ok: false, why: e?.message ?? String(e) })
    }
  }
  const boxes = []
  const makeBox = () => {
    const dir = mkScratch('feedback-loop-selftest-')
    boxes.push(dir)
    return dir
  }
  const writeLines = (path, rows) => writeFileSync(path, rows.map((r) => JSON.stringify(r)).join('\n') + '\n', 'utf8')
  const now = new Date('2026-10-26T12:00:00.000Z')
  const sha = 'a'.repeat(40)
  const at = (h) => `2026-10-26T${String(h).padStart(2, '0')}:00:00.000Z`
  const signal = (identity) => ({ at: at(1), source: 'api_logs', kind: 'http_error', route: '/api/x', message: 'boom', identity })
  const feedback = (identity, ticket, key) => ({ at: at(2), identity, ticket, ticketKey: key })
  const dispatch = (key, line, h) => ({ ts: at(h), mode: 'dispatch', action: 'session-ok', ticketKey: key, ticketLine: line })

  try {
    const boxA = makeBox()
    writeLines(join(boxA, SOURCE_FILES.signals), [signal('sig-1'), signal('sig-2')])
    writeLines(join(boxA, SOURCE_FILES.feedback), [
      feedback('sig-1', '- [ ] 修复 G-9001 接口错误', 'k1'),
      feedback('sig-2', '- [ ] 未带票键的登记'),
    ])
    writeLines(join(boxA, SOURCE_FILES.dispatch), [dispatch('k1', '- [ ] 修复 G-9001 接口错误', 3)])
    writeLines(join(boxA, SOURCE_FILES.decisions), [
      { v: 1, ts: at(4), action: 'canary-pass', sha, gateVerdict: 'pass', reason: '观察窗通过' },
    ])
    const git = { ok: true, why: '', commits: [{ sha, at: at(3), subject: 'fix: G-9001 修复接口错误' }] }

    t('① 全链路 happy path ⇒ verified(四本台账串起)', () => {
      const r = buildStatus({ stateDir: boxA, now, commits: 5, git })
      const one = r.incidents.find((i) => i.identity === 'sig-1')
      if (!one) throw new Error('未生成 sig-1 事故')
      if (one.status !== 'verified') throw new Error(`status 应 verified,实得 ${one.status}:${one.why}`)
      for (const stage of ['perceived', 'ticketed', 'dispatched', 'fixed', 'deployed', 'verified']) {
        if (one.stages[stage] !== 'yes') throw new Error(`阶段 ${stage} 应 yes,实得 ${one.stages[stage]}`)
      }
      if (!one.evidence.fixSha || !one.evidence.deployAt) throw new Error('证据未落 sha/deployAt')
    })
    t('② 登记行缺票键 ⇒ dispatched undetermined 且点名断点', () => {
      const r = buildStatus({ stateDir: boxA, now, commits: 5, git })
      const two = r.incidents.find((i) => i.identity === 'sig-2')
      if (!two) throw new Error('未生成 sig-2 事故')
      if (two.status !== 'undetermined') throw new Error(`status 应 undetermined,实得 ${two.status}`)
      if (two.stages.dispatched !== 'undetermined') throw new Error(`dispatched 应 undetermined,实得 ${two.stages.dispatched}`)
      if (!two.why.includes('断在 dispatched')) throw new Error(`why 未点名 dispatched:${two.why}`)
    })

    const boxB = makeBox()
    writeLines(join(boxB, SOURCE_FILES.signals), [signal('sig-3')])
    writeLines(join(boxB, SOURCE_FILES.feedback), [feedback('sig-3', '- [ ] 修复 G-9003', 'k3')])
    writeLines(join(boxB, SOURCE_FILES.dispatch), [dispatch('k3', '- [ ] 修复 G-9003', 3)])
    t('③ 缺部署决策台账 ⇒ deployed undetermined 且点名断点', () => {
      const r = buildStatus({ stateDir: boxB, now, commits: 0 })
      const one = r.incidents[0]
      if (one.status !== 'undetermined') throw new Error(`status 应 undetermined,实得 ${one.status}`)
      if (one.stages.deployed !== 'undetermined') throw new Error(`deployed 应 undetermined,实得 ${one.stages.deployed}`)
      if (!one.why.includes('断在 deployed')) throw new Error(`why 未点名 deployed:${one.why}`)
    })

    const boxC = makeBox()
    writeFileSync(
      join(boxC, SOURCE_FILES.signals),
      `${JSON.stringify(signal('sig-4'))}\n{坏行 not json\n${JSON.stringify(signal('sig-5'))}\n`,
      'utf8',
    )
    writeLines(join(boxC, SOURCE_FILES.feedback), [feedback('sig-4', '- [ ] 修复 G-9004', 'k4')])
    writeLines(join(boxC, SOURCE_FILES.dispatch), [dispatch('k4', '- [ ] 修复 G-9004', 3)])
    writeLines(join(boxC, SOURCE_FILES.decisions), [])
    t('④ 坏行逐条点名且不连坐其它行', () => {
      const r = buildStatus({ stateDir: boxC, now })
      if (r.badLines.length !== 1) throw new Error(`坏行应 1 条,实得 ${r.badLines.length}`)
      if (r.badLines[0].source !== 'signals' || r.badLines[0].line !== 2 || !r.badLines[0].why) {
        throw new Error(`坏行定位错:${JSON.stringify(r.badLines[0])}`)
      }
      if (r.incidents.length !== 2) throw new Error(`好行应保留 2 条事故,实得 ${r.incidents.length}`)
    })
    t('⑤ summary 配平 N = closed + open + undetermined', () => {
      const r = buildStatus({ stateDir: boxA, now, commits: 5, git })
      const s = r.summary
      if (s.incidents !== s.closed + s.open + s.undetermined) throw new Error(`配平失败:${JSON.stringify(s)}`)
      if (s.undetermined < 1) throw new Error('缺票键事故未被计入 undetermined')
      if (s.balanced !== true) throw new Error('balanced 应为 true')
    })
    t('⑥ 空账本 ⇒ 0 条且 exit 0 条件(upstreamUnavailable=false)', () => {
      const boxD = makeBox()
      for (const f of Object.values(SOURCE_FILES)) writeFileSync(join(boxD, f), '', 'utf8')
      const r = buildStatus({ stateDir: boxD, now })
      if (r.incidents.length !== 0 || r.summary.incidents !== 0) throw new Error(`空输入应 0 条,实得 ${r.incidents.length}`)
      if (r.upstreamUnavailable !== false) throw new Error('空文件不应判成上游全缺')
    })
    t('⑦ 四源全缺 ⇒ upstreamUnavailable=true', () => {
      const boxE = makeBox()
      const r = buildStatus({ stateDir: boxE, now })
      if (r.upstreamUnavailable !== true) throw new Error('全缺未判成 upstreamUnavailable')
    })
    t('⑧ 末行固定 LOOP-STATUS 且人读含阶段表', () => {
      const r = buildStatus({ stateDir: boxA, now, commits: 5, git })
      const text = renderHuman(r)
      const last = text.trim().split(/\r?\n/).pop()
      if (!/^LOOP-STATUS incidents=\d+ closed=\d+ open=\d+ undetermined=\d+$/.test(last)) {
        throw new Error(`末行格式错:${last}`)
      }
      if (!text.includes('阶段表')) throw new Error('缺阶段表')
    })
    t('⑨ 派生身份与 incident-cluster.identityOf 同一把尺子', () => {
      const raw = {
        at: at(1),
        source: 'deploy_outcome',
        kind: 'alert_firing',
        severity: 'error',
        message: 'deploy_outcome action=rollback reason="健康门禁未过"',
        route: 'deploy/rollback',
      }
      const expected = identityOf(raw)
      if (!expected) throw new Error('identityOf 返回空身份')
      const derived = signalIdentityOf(raw)
      if (derived.identity !== expected) throw new Error(`派生身份与 identityOf 不一致:${derived.identity} ≠ ${expected}`)
      if (normalizeSignal(raw).identity !== expected) throw new Error('normalizeSignal 身份与 identityOf 不一致')
      if (signalIdentityOf({ at: at(1), message: 'boom' }).identity !== '') throw new Error('缺 source/kind 时不得自造身份')
    })
  } catch (e) {
    checks.push({ name: '夹具准备', ok: false, why: e?.message ?? String(e) })
  } finally {
    for (const dir of boxes) {
      try {
        rmScratch(dir)
      } catch {
        /* 夹具清理失败不影响判据 */
      }
    }
  }

  for (const c of checks) console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name}${c.ok ? '' : ` — ${c.why}`}`)
  const bad = checks.filter((c) => !c.ok)
  console.log(`# self-test ${checks.length - bad.length}/${checks.length}`)
  return bad.length === 0 ? 0 : 1
}

function main(argv) {
  const args = parseArgs(argv)
  if (args['self-test'] === true || args['self-test'] === 'true') return selfTest()

  const json = args.json === true || args.json === 'true'
  let stateDir = null
  let sinceHours = DEFAULT_SINCE_HOURS
  let commits = 0
  try {
    if (args['state-dir'] !== undefined) {
      stateDir = String(args['state-dir'] ?? '').trim()
      if (!stateDir || stateDir === 'true') throw new InputError('--state-dir 需要一个非空路径')
    }
    if (args['since-hours'] !== undefined) {
      if (args['since-hours'] === true || args['since-hours'] === 'true') throw new InputError('--since-hours 需要一个非负整数')
      sinceHours = positiveInt(args['since-hours'], '--since-hours', { allowZero: true })
    }
    if (args.commits !== undefined) {
      if (args.commits === true || args.commits === 'true') throw new InputError('--commits 需要一个正整数')
      commits = positiveInt(args.commits, '--commits')
    }
  } catch (e) {
    console.error(`FEEDBACK-LOOP-INPUT ${e?.message ?? e}`)
    return 2
  }

  let report
  try {
    report = buildStatus({ stateDir, sinceHours, commits })
  } catch (e) {
    console.error(`FEEDBACK-LOOP-ERROR 取数层异常:${(e && e.stack) || e}`)
    return 2
  }

  if (json) {
    console.log(JSON.stringify(report))
  } else {
    console.log(renderHuman(report))
    return report.upstreamUnavailable ? 2 : 0
  }
  console.log(formatSummaryLine(report.summary))
  return report.upstreamUnavailable ? 2 : 0
}

// §22d 双形态入口:被测试 import 时不触发主流程。
const isDirectRun = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href === import.meta.url : false

if (isDirectRun) {
  try {
    process.exitCode = main(process.argv.slice(2))
  } catch (e) {
    console.error(`FEEDBACK-LOOP-ERROR ${e?.message ?? e}`)
    process.exitCode = 2
  }
}

export const __test__ = {
  parseArgs,
  readJsonl,
  resolvePaths,
  normalizeAt,
  signalIdentityOf,
  normalizeSignal,
  normalizeFeedback,
  normalizeDispatch,
  normalizeDecision,
  judgeIncident,
  buildStatus,
  renderHuman,
  formatSummaryLine,
  selfTest,
  InputError,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
