// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * deploy-feedback — 消费「部署结果信号」→ 可派单候选 → 自动登记台账(端到端反馈闭环第二切片,2026-10-26 立)。
 *
 * 边界(与 auto-triage 同一套分诊纪律,只换输入面):
 *  - 输入只吃 `.ihui-agent/state/incident-signals.jsonl` 里 `source === 'deploy_outcome'` 的行,
 *    按契约 v2 的字段校验;非本源的行走「不是我的面」,不参与聚类也不判坏;
 *  - 聚类/身份一律复用 `scripts/lib/incident-cluster.mjs`:validateSignal / identityOf / clusterSignals,
 *    本器不写第二份"什么算同一缺陷";部署失败单次即真事故 ⇒ minOccurrences 默认 1(不降级成 2);
 *  - 达标簇构造「台账登记行」,标题含 action 与稳定 route,证据含 dims/action/时间窗;行宽 ≤400;
 *    行内 7~64 位 hex 一律过 `sanitizeHexRuns`(守门 117 会把短 sha 判住、整块拒落);
 *  - 编号**只写 live-doc-edit 的取号令牌**,不在本器拼号。族前缀现读 `scripts/lib/plan-task-index.mjs`
 *    的 usedIdsOfPrefix/nextTaskIdLabel 验证可行;`{{NEXT_ID:G}}` 现读已满,不使用。
 *    `O65` 是自进化系列的总纲标题,live-doc-edit 的令牌族只吃 `[A-Za-z]+`(数字不可进族名),
 *    故落成 `{{NEXT_ID:O}}`;若 O 族现读不可用,按 D/B/A 顺序退一个有余量的族并点名依据。
 *  - 登记唯一入口 = `scripts/live-doc-edit.mjs` 子进程(LIVE_DOC / LIVE_BLOCK_FILE / LIVE_MSG),
 *    默认 dry-run 只打印行、不 spawn;`--apply` 才真登记,每轮最多 `--max-per-run` 条(默认 3);
 *  - 去重台账 `.ihui-agent/state/deploy-feedback-ledger.jsonl`:同身份(identityOf)24h 内结果
 *    `registered` 的不重复登记;逐条记 action/identity/result(skip|dry-run|registered|undetermined)/ts;
 *  - 取不到输入/契约未声明 deploy_outcome/取号不可行 ⇒ 打印「未判定」并 exit 2,绝不把读不到当"无发现";
 *    写盘失败(临时块/台账)⇒ exit 3。
 *
 * 用法:node scripts/deploy-feedback.mjs [--once] [--apply] [--in <jsonl>] [--minutes 1440]
 *        [--max-per-run 3] [--json] | --status | --self-test
 * 退出码:0 已判定 / 2 未判定 / 3 写盘失败。
 */
import { spawnSync } from 'node:child_process'
import { appendFileSync, existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { requireFlagValue } from './lib/flag-value.mjs'
import { gitBinary } from './lib/face-reader.mjs'
import { sanitizeHexRuns } from './lib/triage-doc-line.mjs'
import { clusterSignals, identityOf, loadContract, validateSignal } from './lib/incident-cluster.mjs'
import { nextTaskIdLabel, usedIdsOfPrefix } from './lib/plan-task-index.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

export const DEPLOY_SOURCE = 'deploy_outcome'
export const DEFAULT_INPUT = join(ROOT, '.ihui-agent', 'state', 'incident-signals.jsonl')
export const LEDGER_PATH = join(ROOT, '.ihui-agent', 'state', 'deploy-feedback-ledger.jsonl')
export const PLAN_PATH = join(ROOT, 'PROJECT_PLAN.md')
export const TMP_DIR = join(ROOT, '.ihui-agent', 'tmp', 'deploy-feedback')
export const LIVE_DOC_EDIT = join(ROOT, 'scripts', 'live-doc-edit.mjs')
export const LINE_MAX = 400
export const TITLE_MAX = 120
export const EVIDENCE_MAX = 220
export const DEFAULT_MINUTES = 1440
export const DEFAULT_MAX_PER_RUN = 3
export const DEDUPE_MS = 24 * 3600_000
/** 候选族顺序:O65(自进化系列)⇒ D ⇒ B ⇒ A。族字母由 live-doc-edit 令牌正则 [A-Za-z]+ 决定。 */
export const FAMILY_CANDIDATES = ['O65', 'D', 'B', 'A']
const RESULT_VALUES = new Set(['skip', 'dry-run', 'registered', 'undetermined'])
const KNOWN_FLAGS = new Set(['--once', '--apply', '--status', '--json', '--self-test', '--in', '--minutes', '--max-per-run'])

export class DeployFeedbackShapeError extends Error {}

/** 写盘失败(临时块/台账)单独成类 —— 调用方据此 exit 3,不与「未判定」混成一档。 */
export class DeployFeedbackWriteError extends Error {}

const readFileDefault = (p) => readFileSync(p, 'utf8')
const defaultSpawn = (...args) => spawnSync(...args)

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

/** CLI 解析:未知旗标 / 吞值 / 非正整数一律记 usage 错(调用方 exit 2)。 */
export function parseArgs(argv = []) {
  const errors = []
  for (const t of argv) {
    if (typeof t === 'string' && t.startsWith('-') && !KNOWN_FLAGS.has(t)) errors.push(`未知旗标 ${t}`)
  }
  return {
    once: argv.includes('--once'),
    apply: argv.includes('--apply'),
    status: argv.includes('--status'),
    json: argv.includes('--json'),
    selfTest: argv.includes('--self-test'),
    input: pathFlag(argv, '--in', errors),
    minutes: intFlag(argv, '--minutes', '窗口分钟数', DEFAULT_MINUTES, errors),
    maxPerRun: intFlag(argv, '--max-per-run', '每轮登记上限', DEFAULT_MAX_PER_RUN, errors),
    errors,
  }
}

/** 逐行解析 JSONL:坏行单列(带行号与原因),好行原样返回给来源过滤。 */
export function parseSignalRows(text) {
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

/** 契约是否声明了 source=deploy_outcome(契约仍是 v1 时本器必须落未判定,不得猜字段)。 */
export function contractSupportsDeployOutcome(contract) {
  return Array.isArray(contract?.fields?.source?.enum) && contract.fields.source.enum.includes(DEPLOY_SOURCE)
}

/** 载入并断言契约;读不到/形状坏/未声明本来源 ⇒ 抛(调用方 exit 2)。 */
export function loadDeployContract({ readFile = readFileDefault } = {}) {
  let contract
  try {
    contract = loadContract(readFile)
  } catch (e) {
    throw new DeployFeedbackShapeError(`契约读不到或非法:${e?.message ?? e}`)
  }
  return ensureDeployContract(contract)
}

export function ensureDeployContract(contract) {
  if (!contractSupportsDeployOutcome(contract)) {
    const v = contract?.version ?? '?'
    throw new DeployFeedbackShapeError(
      `契约 v${v} 未声明 source=${DEPLOY_SOURCE}(等契约 v2 落地;本器不猜字段、不把读不到当无发现)`,
    )
  }
  return contract
}

/** 已校验信号的稳定身份(测试/台账共用同一出口,不另算)。 */
export function identityOfSignal(raw, contract) {
  const v = validateSignal(raw, contract ?? loadDeployContract())
  if (!v.ok) throw new DeployFeedbackShapeError(`信号形状坏:${v.error}`)
  return identityOf(v.signal)
}

function clip(text, max) {
  const s = String(text ?? '')
  if (max <= 0) return ''
  if (s.length <= max) return s
  return s.slice(0, max - 1) + '…'
}

function textOfValue(v) {
  if (v === null || v === undefined) return ''
  if (typeof v === 'string') return v
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  try {
    return JSON.stringify(v)
  } catch {
    return ''
  }
}

/** 部署动作:优先显式 action/stage/operation 字段,再退稳定 route( deploy/<action> ),再退消息里的 action=,最后才退 kind。 */
export function actionOf(raw, cluster) {
  for (const key of ['action', 'deployAction', 'stage', 'operation']) {
    const v = raw?.[key]
    if (typeof v === 'string' && v.trim() !== '') return clip(v.trim(), 48)
  }
  const route = String(cluster?.route ?? raw?.route ?? '')
  const routeMatch = /^\/?deploy\/([^/]+)$/.exec(route)
  if (routeMatch) return clip(routeMatch[1], 48)
  const msgMatch = /\baction=([A-Za-z0-9_.-]+)/.exec(String(raw?.message ?? cluster?.sample ?? ''))
  if (msgMatch) return clip(msgMatch[1], 48)
  return clip(String(cluster?.kind ?? DEPLOY_SOURCE), 48)
}

export function dimsTextOf(raw) {
  for (const key of ['dims', 'dimensions']) {
    if (raw && key in raw) {
      const t = textOfValue(raw[key])
      if (t !== '') return clip(t, 80)
    }
  }
  const m = /\bdims=([^\s]+)/.exec(String(raw?.message ?? ''))
  if (m && m[1] !== '(none)') return clip(m[1], 80)
  return ''
}

/** 稳定定位面:归一 route 优先,其次错误码,最后才退归一消息首行(与 identityOf 同序)。 */
export function locatorOf(cluster) {
  if (cluster?.route) return String(cluster.route)
  if (cluster?.code) return `错误码 ${cluster.code}`
  const first = String(cluster?.sample ?? '').split(/\r?\n/)[0].trim()
  return first ? `「${clip(first, 60)}」` : '(无可定位面)'
}

export function buildTitle({ cluster, raw }) {
  const action = actionOf(raw, cluster)
  const title = `[${DEPLOY_SOURCE}/${cluster.kind}] ${action} ${locatorOf(cluster)} 部署异常 ⇒ 排查链路并修复`
  return clip(sanitizeHexRuns(title), TITLE_MAX)
}

/** 证据必须含 dims / action / 时间窗(窗口长度 + first/last),另带计数与样本。 */
export function buildEvidence({ cluster, raw, minutes }) {
  const bits = []
  const dims = dimsTextOf(raw)
  bits.push(`dims=${dims || '(none)'}`)
  bits.push(`action=${actionOf(raw, cluster)}`)
  bits.push(`窗口=${minutes}min`)
  bits.push(`count=${cluster.count}`)
  bits.push(`first=${cluster.firstAt}`)
  bits.push(`last=${cluster.lastAt}`)
  if (cluster.route) bits.push(`route=${cluster.route}`)
  if (cluster.code) bits.push(`code=${cluster.code}`)
  const sample = String(cluster.sample ?? '').trim()
  if (sample) bits.push(`sample=${JSON.stringify(clip(sample, 80))}`)
  return clip(sanitizeHexRuns(bits.join(' ')), EVIDENCE_MAX)
}

/**
 * 登记行(纯函数):`- [ ] {{NEXT_ID:族}} [deploy-feedback] 标题(登记@日期;来源;证据)`。
 * 标题/证据先过 sanitizeHexRuns(扩写只可能变短),再按剩余预算逐段收紧,最终保证 ≤400。
 */
export function buildRegistrationLine({ token, title, evidence, date }) {
  const head = `- [ ] ${token} [deploy-feedback] `
  const tailOf = (ev) => `（登记@${date}/deploy-feedback;来源:${DEPLOY_SOURCE};证据:${ev}）`
  let t = clip(sanitizeHexRuns(title), TITLE_MAX)
  let e = clip(sanitizeHexRuns(evidence), EVIDENCE_MAX)
  let line = `${head}${t}${tailOf(e)}`
  if (line.length > LINE_MAX) {
    const overhead = `${head}${t}${tailOf('')}`.length
    e = clip(e, Math.max(0, LINE_MAX - overhead))
    line = `${head}${t}${tailOf(e)}`
  }
  if (line.length > LINE_MAX) {
    const overhead = `${head}${tailOf(e)}`.length
    t = clip(t, Math.max(0, LINE_MAX - overhead))
    line = `${head}${t}${tailOf(e)}`
  }
  return line.length > LINE_MAX ? line.slice(0, LINE_MAX) : line
}

/**
 * 取号族现读:先 O65(自进化系列),再 D/B/A。返回 {ok, requested, family, token, nextLabel, ...}。
 * `requested` 可带数字(如 O65),但 live-doc-edit 的令牌族只吃字母 ⇒ family/token 用剥数字后的族字母。
 */
export function chooseIdFamily(content) {
  if (typeof content !== 'string' || content.trim() === '') {
    return { ok: false, why: 'PROJECT_PLAN.md 内容读不到 ⇒ 无法现读取号族' }
  }
  const reasons = []
  for (const requested of FAMILY_CANDIDATES) {
    const family = String(requested).replace(/[^A-Za-z]/g, '').toUpperCase()
    if (!family) continue
    const used = usedIdsOfPrefix(content, requested)
    if (!used) {
      reasons.push(`${requested} 族现读无登记行 ⇒ 取号不可行`)
      continue
    }
    const nextLabel = nextTaskIdLabel(content, requested)
    if (!nextLabel) {
      reasons.push(`${requested} 族无空闲号`)
      continue
    }
    const token = `{{NEXT_ID:${family}}}`
    const basis =
      `${requested}${requested !== family ? `(族字母 ${family}:live-doc-edit 令牌只吃 [A-Za-z]+)` : ''}` +
      ` 现读 max=${used.max} used=${used.used} 下一号=${nextLabel}`
    return { ok: true, requested, family, token, nextLabel, usedMax: used.max, usedCount: used.used, basis }
  }
  return { ok: false, why: `无可用取号族(${reasons.join(';')})` }
}

/** 读本器台账(坏行跳过;文件不存在 = 空账,不是未判定)。 */
export function readLedger(path = LEDGER_PATH, readFile = readFileDefault) {
  let text
  try {
    text = readFile(path)
  } catch {
    return []
  }
  return String(text)
    .split(/\r?\n/)
    .filter(Boolean)
    .map((l) => {
      try {
        return JSON.parse(l)
      } catch {
        return null
      }
    })
    .filter(Boolean)
}

/** 追加一条台账(action/identity/result/ts);写盘失败抛 DeployFeedbackWriteError(调用方 exit 3)。 */
export function appendLedger(entry, path = LEDGER_PATH) {
  if (!RESULT_VALUES.has(entry?.result)) {
    throw new DeployFeedbackShapeError(`台账 result 非法:${String(entry?.result)}`)
  }
  try {
    mkdirSync(dirname(path), { recursive: true })
    appendFileSync(path, JSON.stringify(entry) + '\n', 'utf8')
  } catch (e) {
    throw new DeployFeedbackWriteError(`台账写盘失败(${path}):${e?.message ?? e}`)
  }
}

/** 同身份 24h 内已有 registered ⇒ 不重复登记(只认 registered;dry-run/skip 不拦)。 */
export function recentlyRegistered(ledger, identity, nowMs = Date.now()) {
  return (ledger ?? []).some((e) => {
    if (e?.result !== 'registered' || e?.identity !== identity) return false
    const ts = Date.parse(String(e.ts ?? ''))
    return Number.isFinite(ts) && nowMs - ts < DEDUPE_MS
  })
}

function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * 登记:构造块文件 → 子进程 live-doc-edit(唯一入口)→ 用完即删块文件。
 * 返回 {ok, line, why};临时块写失败抛 DeployFeedbackWriteError(调用方 exit 3)。
 */
export function registerToPlan({ token, title, evidence, identity = '', now = new Date(), spawn = defaultSpawn, tmpDir = TMP_DIR, readPlanHead = null }) {
  const line = buildRegistrationLine({ token, title, evidence, date: ymd(now) })
  const tag = createHash('sha256').update(String(identity || `${title}|${evidence}`)).digest('hex').slice(0, 16)
  let blockFile
  try {
    mkdirSync(tmpDir, { recursive: true })
    blockFile = join(tmpDir, `reg-${tag}.md`)
    writeFileSync(blockFile, line + '\n', 'utf8')
  } catch (e) {
    throw new DeployFeedbackWriteError(`临时登记块写盘失败(${tmpDir}):${e?.message ?? e}`)
  }
  let r
  try {
    r = spawn(process.execPath, [LIVE_DOC_EDIT], {
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: ROOT,
      windowsHide: true,
      timeout: 120_000,
      encoding: 'utf8',
      env: {
        ...process.env,
        LIVE_DOC: 'PROJECT_PLAN.md',
        LIVE_BLOCK_FILE: blockFile,
        LIVE_MSG: `docs(plan): deploy-feedback 自动登记(${DEPLOY_SOURCE};端到端反馈闭环第二切片,O65 自进化系列)`,
      },
    })
  } finally {
    try {
      unlinkSync(blockFile)
    } catch {
      /* 用完即删 */
    }
  }
  const okOut = /回读|已在位/.test(String(r?.stdout ?? ''))
  if (r?.status !== 0 && !okOut) {
    return {
      ok: false,
      line,
      why: `live-doc-edit rc=${r?.status ?? '?'}:${String(r?.stderr ?? r?.stdout ?? '').trim().slice(-160)}`,
    }
  }
  // —— 真实落账链路补环(2026-10-28,L28696「票→提交环」点名缺口之二)——
  // live-doc-edit 把 `{{NEXT_ID:O}}` 展开成真实号并只推进 HEAD(旁路落地不写工作树)⇒ 回读必须取 HEAD 面。
  // 读回的行文本随 ledger 条目落 `ticketLine`:feedback-loop-status 的 dispatched 对齐(face→extractTicketNo)
  // 与 auto-evolve 的 dispatch 行由此才可能接上;读不回不阻断登记(条目退回无键形态,status 判 undetermined 点名,§0.3)。
  let landed = null
  try {
    const read = typeof readPlanHead === 'function' ? readPlanHead : defaultReadPlanHead
    const text = read()
    if (typeof text === 'string' && text !== '') {
      landed = findLandedRegistrationLine(text, identity)
    }
  } catch {
    landed = null
  }
  return { ok: true, line, landed }
}

/** 从 HEAD 面台账文本里找回本枚刚落地的登记行:行首 `- [ ] ` + 行头标记 + (identity 带 route 时)route 串。
 *  route 取自 `deploy_outcome|kind|route:/deploy/x` 的第三段 ⇒ 行体内必有 `route=/deploy/x`(buildEvidence 原样落笔)。 */
export function findLandedRegistrationLine(text, identity = '') {
  if (typeof text !== 'string') return null
  // identity 形如 `deploy_outcome|<kind>|route:<route>`;route 段可含空格与 `/`(如 `post /api/deploy/release`)。
  // 行体内 buildRegistrationLine 的证据带同款 `route=<原样值>`(同一 bits.push 出口,§0.6 不另立)。
  const segs = String(identity).split('|')
  const lastSeg = segs.length > 0 ? segs[segs.length - 1] : ''
  const routeVal = lastSeg.startsWith('route:') ? lastSeg.slice(6) : ''
  const routeNeedle = routeVal ? `route=${routeVal}` : null
  for (const l of text.split(/\r?\n/)) {
    if (!l.startsWith('- [ ] ')) continue
    if (!l.includes(' [deploy-feedback] ')) continue
    if (routeNeedle && !l.includes(routeNeedle)) continue
    return l
  }
  return null
}

function defaultReadPlanHead() {
  // git 可执行体走 face-reader 单源(§0.6);HEAD 面而非工作树——多会话共享工作区的工作树副本常年滞后,
  // 且 live-doc-edit 的旁路落地只推进 HEAD。stdio 显式接管(§12g)。
  const r = spawnSync(gitBinary(), ['show', 'HEAD:PROJECT_PLAN.md'], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 60_000,
    windowsHide: true,
  })
  if (r?.status !== 0) throw new Error(`git show HEAD:PROJECT_PLAN.md rc=${r?.status ?? '?'}`)
  return String(r.stdout ?? '')
}

/** 取某身份簇里最新一条原始行(action/dims 只在原文里,validateSignal 后的 signal 不保留扩展字段)。 */
function latestRawOf(pairs) {
  let best = null
  let bestTs = -Infinity
  for (const p of pairs ?? []) {
    const ts = Date.parse(String(p?.signal?.at ?? ''))
    if (Number.isFinite(ts) && ts > bestTs) {
      best = p
      bestTs = ts
    }
  }
  return best
}

function candidateOf(cluster, pairs, minutes = DEFAULT_MINUTES) {
  const latest = latestRawOf(pairs)
  const raw = latest?.raw ?? {}
  const title = buildTitle({ cluster, raw })
  const evidence = buildEvidence({ cluster, raw, minutes })
  return {
    identity: cluster.clusterKey,
    action: actionOf(raw, cluster),
    title,
    evidence,
    line: '',
    count: cluster.count,
    firstAt: cluster.firstAt,
    lastAt: cluster.lastAt,
    route: cluster.route,
    code: cluster.code,
    kind: cluster.kind,
    severity: cluster.severity,
    dispatchable: cluster.dispatchable,
    why: cluster.why,
  }
}

/**
 * 一轮判定/登记(纯编排,IO 全可注入)。
 * 返回 {code,status,why,input,family,candidates,clusters,results,entries,ledgerPath}。
 * code:0 已判定 / 2 未判定 / 3 写盘失败。
 */
export function runRound({
  inputPath = DEFAULT_INPUT,
  minutes = DEFAULT_MINUTES,
  maxPerRun = DEFAULT_MAX_PER_RUN,
  apply = false,
  contract = null,
  now = new Date(),
  readFile = readFileDefault,
  ledgerPath = LEDGER_PATH,
  planPath = PLAN_PATH,
  planContent,
  spawn = defaultSpawn,
  tmpDir = TMP_DIR,
  readPlanHead = null,
  log = console.log,
  warn = (...a) => console.error(...a),
} = {}) {
  const out = {
    code: 0,
    status: 'undetermined',
    why: null,
    input: { path: inputPath, total: 0, deployRows: 0, badRows: 0, invalidRows: 0 },
    family: null,
    candidates: [],
    clusters: [],
    results: [],
    entries: [],
    ledgerPath,
  }

  let c
  try {
    c = contract ? ensureDeployContract(contract) : loadDeployContract({ readFile })
  } catch (e) {
    out.why = e?.message ?? String(e)
    warn(`未判定:${out.why}`)
    out.code = 2
    return out
  }

  let text
  try {
    text = readFile(inputPath)
  } catch (e) {
    out.why = `信号输入读不到(${inputPath}):${e?.message ?? e}`
    warn(`未判定:${out.why}`)
    out.code = 2
    return out
  }

  const parsed = parseSignalRows(text)
  out.input.total = parsed.rows.length + parsed.bad.length
  out.input.badRows = parsed.bad.length
  const deployRows = parsed.rows.filter((r) => r.object?.source === DEPLOY_SOURCE)
  out.input.deployRows = deployRows.length

  const valid = []
  const invalid = []
  for (const row of deployRows) {
    const v = validateSignal(row.object, c)
    if (v.ok) valid.push({ line: row.line, raw: row.object, signal: v.signal })
    else invalid.push({ line: row.line, reason: v.error })
  }
  out.input.invalidRows = invalid.length

  log(
    `分诊轮:输入=${inputPath}(总行 ${out.input.total},deploy_outcome ${deployRows.length},坏行 ${parsed.bad.length},形状坏 ${invalid.length}) 窗口=${minutes}min 单次门槛=1`,
  )
  for (const b of parsed.bad) warn(`BAD-LINE line=${b.line} ${b.reason}`)
  for (const b of invalid) warn(`BAD-SIGNAL line=${b.line} ${b.reason}`)

  if (valid.length === 0) {
    if (deployRows.length === 0 && parsed.bad.length === 0) {
      out.status = 'judged'
      log(`✅ 判定:输入里没有 source=${DEPLOY_SOURCE} 的行 ⇒ 无可派单候选`)
      return out
    }
    out.why = `没有一条通过契约校验的 ${DEPLOY_SOURCE} 信号(坏行 ${parsed.bad.length},形状坏 ${invalid.length})`
    warn(`未判定:${out.why}`)
    out.code = 2
    return out
  }

  let clusters
  try {
    clusters = clusterSignals(
      valid.map((x) => x.signal),
      { minCount: 1, windowMinutes: minutes, contract: c },
    )
  } catch (e) {
    out.why = `聚类未判定:${e?.message ?? e}`
    warn(`未判定:${out.why}`)
    out.code = 2
    return out
  }
  out.clusters = clusters

  const byIdentity = new Map()
  for (const x of valid) {
    const id = identityOf(x.signal)
    const arr = byIdentity.get(id) ?? []
    arr.push(x)
    byIdentity.set(id, arr)
  }

  const dispatchable = clusters.filter((x) => x.dispatchable)
  for (const x of clusters.filter((y) => !y.dispatchable)) {
    log(`⚠ 观察类(${x.clusterKey}):${x.why}`)
  }
  if (dispatchable.length === 0) {
    out.status = 'judged'
    log(`✅ 判定:${clusters.length} 个簇均未达可派单口径 ⇒ 无可登记候选`)
    return out
  }

  let content = planContent
  if (typeof content !== 'string') {
    try {
      content = readFile(planPath)
    } catch (e) {
      out.why = `PROJECT_PLAN.md 读不到,取号不可行:${e?.message ?? e}`
      warn(`未判定:${out.why}`)
      out.code = 2
      return out
    }
  }
  const family = chooseIdFamily(content)
  out.family = family
  if (!family.ok) {
    out.why = `取号不可行:${family.why}`
    warn(`未判定:${out.why}`)
    for (const cluster of dispatchable) {
      const cand = candidateOf(cluster, byIdentity.get(cluster.clusterKey), minutes)
      const entry = { ts: now.toISOString(), action: cand.action, identity: cand.identity, result: 'undetermined' }
      try {
        appendLedger(entry, ledgerPath)
        out.entries.push(entry)
      } catch (e) {
        out.why = e?.message ?? String(e)
        out.code = 3
        return out
      }
    }
    out.code = 2
    return out
  }
  log(`取号族现读:${family.basis} 令牌=${family.token}`)

  const ledger = readLedger(ledgerPath, readFile)
  let attempts = 0
  for (const cluster of dispatchable) {
    const pairs = byIdentity.get(cluster.clusterKey)
    const cand = candidateOf(cluster, pairs, minutes)
    cand.line = buildRegistrationLine({
      token: family.token,
      title: cand.title,
      evidence: cand.evidence,
      date: ymd(now),
    })
    out.candidates.push(cand)

    const record = (result, extra = {}) => {
      const entry = { ts: now.toISOString(), action: cand.action, identity: cand.identity, result, ...extra }
      try {
        appendLedger(entry, ledgerPath)
      } catch (e) {
        out.why = e?.message ?? String(e)
        out.code = 3
        warn(`❌ 写盘失败:${out.why}`)
        return false
      }
      ledger.push(entry)
      out.entries.push(entry)
      out.results.push({ identity: cand.identity, action: cand.action, result })
      return true
    }

    if (recentlyRegistered(ledger, cand.identity, now.getTime())) {
      log(`⏭ 同身份 24h 内已登记 ⇒ 跳过(${cand.identity})`)
      if (!record('skip')) break
      continue
    }
    if (attempts >= maxPerRun) {
      log(`⏸ 每轮登记上限 ${maxPerRun} 条已达 ⇒ 留待下一轮(${cand.identity})`)
      if (!record('skip')) break
      continue
    }
    attempts += 1

    if (!apply) {
      log(`· dry-run 将登记(未落地):${cand.line}`)
      if (!record('dry-run')) break
      continue
    }

    let reg
    try {
      reg = registerToPlan({ token: family.token, title: cand.title, evidence: cand.evidence, identity: cand.identity, now, spawn, tmpDir, readPlanHead })
    } catch (e) {
      out.why = e?.message ?? String(e)
      out.code = 3
      warn(`❌ 写盘失败:${out.why}`)
      break
    }
    if (!reg.ok) {
      warn(`❌ 登记未判定:${reg.why}`)
      out.why = reg.why
      if (out.code === 0) out.code = 2
      if (!record('undetermined')) break
      continue
    }
    log(`✅ 已登记:${cand.title}`)
    // landed 读回才写 ticketLine;读不到 ⇒ 条目退回无键形态(status 判 undetermined 并点名),不伪造对齐键。
    if (!record('registered', reg.landed ? { ticketLine: reg.landed } : {})) break
  }

  if (out.code === 3) {
    out.status = 'undetermined'
    return out
  }
  out.status = out.code === 0 ? 'judged' : 'undetermined'
  if (out.code === 0) {
    const counts = { registered: 0, 'dry-run': 0, skip: 0, undetermined: 0 }
    for (const r of out.results) counts[r.result] = (counts[r.result] ?? 0) + 1
    log(
      `DEPLOY-FEEDBACK judged deploy_outcome=${deployRows.length} dispatchable=${dispatchable.length} ` +
        `registered=${counts.registered} dry-run=${counts['dry-run']} skip=${counts.skip} undetermined=${counts.undetermined}`,
    )
  } else {
    warn(`未判定:${out.why ?? '存在登记未判定/部分失败'}`)
  }
  return out
}

/** --status:只读汇总(契约/输入/取号族/台账最近 5 条),不 spawn、不写盘。 */
export function statusReport({
  contract = null,
  inputPath = DEFAULT_INPUT,
  ledgerPath = LEDGER_PATH,
  planPath = PLAN_PATH,
  planContent,
  minutes = DEFAULT_MINUTES,
  now = new Date(),
  readFile = readFileDefault,
} = {}) {
  const lines = []
  const rep = { code: 0, status: 'judged', why: null, lines, contract: null, family: null, input: null, ledger: [] }

  try {
    rep.contract = contract ? ensureDeployContract(contract) : loadDeployContract({ readFile })
    lines.push(`契约: v${rep.contract.version} reviewBy=${rep.contract.reviewBy} source=${DEPLOY_SOURCE} 已声明`)
  } catch (e) {
    rep.code = 2
    rep.why = e?.message ?? String(e)
    lines.push(`契约: 未判定(${rep.why})`)
  }

  try {
    const text = readFile(inputPath)
    const parsed = parseSignalRows(text)
    const deployRows = parsed.rows.filter((r) => r.object?.source === DEPLOY_SOURCE)
    rep.input = { path: inputPath, total: parsed.rows.length + parsed.bad.length, deployRows: deployRows.length, badRows: parsed.bad.length }
    lines.push(`信号输入: ${inputPath} 可读,总行 ${rep.input.total} / deploy_outcome ${deployRows.length} / 坏行 ${parsed.bad.length}`)
  } catch (e) {
    rep.code = 2
    rep.why = rep.why ?? `信号输入读不到(${inputPath})`
    rep.input = { path: inputPath, missing: true }
    lines.push(`信号输入: 未判定(${inputPath} 读不到:${e?.message ?? e})`)
  }

  let content = planContent
  if (typeof content !== 'string') {
    try {
      content = readFile(planPath)
    } catch (e) {
      lines.push(`取号族: 未判定(PROJECT_PLAN.md 读不到:${e?.message ?? e})`)
      rep.code = 2
      rep.why = rep.why ?? '取号不可行:PROJECT_PLAN.md 读不到'
      content = ''
    }
  }
  const family = chooseIdFamily(content)
  rep.family = family
  lines.push(`取号族: ${family.ok ? `${family.basis} 令牌=${family.token}` : `未判定(${family.why})`}`)
  if (!family.ok) {
    rep.code = 2
    rep.why = rep.why ?? `取号不可行:${family.why}`
  }

  const ledger = readLedger(ledgerPath, readFile)
  rep.ledger = ledger
  const dedupeWindow = ledger.filter((e) => {
    const ts = Date.parse(String(e?.ts ?? ''))
    return e?.result === 'registered' && Number.isFinite(ts) && now.getTime() - ts < DEDUPE_MS
  }).length
  lines.push(`窗口: ${minutes}min / 单次事故门槛 1 / 同身份去重 ${DEDUPE_MS / 3600_000}h`)
  lines.push(`台账: ${ledgerPath} 共 ${ledger.length} 行,24h 内 registered ${dedupeWindow} 条`)
  lines.push('台账最近 5 条:')
  for (const e of ledger.slice(-5)) {
    lines.push(`  ${e.ts} action=${e.action} identity=${e.identity} result=${e.result}`)
  }

  rep.status = rep.code === 0 ? 'judged' : 'undetermined'
  return rep
}

/** --self-test:全部走生产判据 + scratch 台账(绝不碰真实 .ihui-agent/state/deploy-feedback-ledger.jsonl)。 */
export async function runSelfTest({ log = console.log, readFile = readFileDefault } = {}) {
  let failed = 0
  const ok = (name, cond) => {
    if (cond) log(`  ✅ ${name}`)
    else {
      console.error(`  ❌ ${name}`)
      failed++
    }
  }
  const { mkScratch, rmScratch } = await import('./lib/scratch-dir.mjs')
  const dir = mkScratch('deploy-feedback-')
  try {
    const V2 = {
      version: 2,
      reviewBy: '2027-01-31',
      required: ['at', 'source', 'kind', 'severity', 'message'],
      fields: {
        source: { enum: ['api_logs', 'grafana_alert', 'user_feedback', DEPLOY_SOURCE] },
        kind: { enum: ['http_error', 'runtime_error', 'alert_firing', 'user_report', 'perf_degradation', 'deploy_failure'] },
        severity: { enum: ['debug', 'info', 'warn', 'error', 'critical'] },
        message: { maxLength: 2000 },
        traceId: { maxLength: 128 },
        route: { maxLength: 300 },
      },
      dispatch: { minSeverity: 'warn' },
      owners: { api_logs: '后端', grafana_alert: '运维', user_feedback: '产品', [DEPLOY_SOURCE]: '运维值班' },
    }
    const V1 = { ...V2, version: 1, fields: { ...V2.fields, source: { enum: ['api_logs', 'grafana_alert', 'user_feedback'] } }, owners: { api_logs: '后端', grafana_alert: '运维', user_feedback: '产品' } }
    ok('契约 v2 声明 source=deploy_outcome ⇒ 可消费', contractSupportsDeployOutcome(V2) === true)
    ok('契约 v1 未声明 ⇒ 判未判定(不猜字段)', contractSupportsDeployOutcome(V1) === false)

    const now = new Date('2026-10-26T12:00:00Z')
    const at = (minAgo) => new Date(now.getTime() - minAgo * 60_000).toISOString()
    const signal = (over = {}) => ({
      at: at(60),
      source: DEPLOY_SOURCE,
      kind: 'deploy_failure',
      severity: 'error',
      message: 'deploy failed code=DEPLOY_FAIL',
      route: 'post /api/deploy/release',
      action: 'deploy',
      dims: { env: 'prod', service: 'api' },
      ...over,
    })

    const planText = ['- [ ] O88 假登记行', '- [ ] D16 另一族'].join('\n')
    const fam = chooseIdFamily(planText)
    ok('取号族现读可行且不使用 G 族', fam.ok === true && fam.family !== 'G' && /^\{\{NEXT_ID:[A-Za-z]+\}\}$/.test(fam.token))
    ok('O65 系列落成字母族令牌、下一号现读', fam.token === '{{NEXT_ID:O}}' && fam.nextLabel === 'O89')
    const intake = { message: 'deploy_outcome action=rollback dims=web+llm reason=canary failed', route: 'deploy/rollback' }
    ok(
      'intake 形态从 route/message 回读 action 与 dims',
      actionOf(intake, { kind: 'alert_firing', route: '/deploy/rollback' }) === 'rollback' && dimsTextOf(intake) === 'web+llm',
    )

    const line = buildRegistrationLine({ token: fam.token, title: 'deploy ' + 'x'.repeat(600), evidence: 'y'.repeat(600), date: '2026-10-26' })
    ok('登记行 ≤400 字', line.length <= LINE_MAX)
    ok('登记行是 - [ ] 令牌形态', line.startsWith(`- [ ] ${fam.token} [deploy-feedback] `))
    const dirty = buildRegistrationLine({ token: fam.token, title: '部署 abc123def456 失败', evidence: 'id=deadbeefcafe', date: '2026-10-26' })
    ok('7~64 位短 sha 被清洗', /\[hex:12\]/.test(dirty) && !/(^|[^0-9a-zA-Z_])[0-9a-fA-F]{7,64}(?=$|[^0-9a-zA-Z_])/.test(dirty))

    const inputPath = join(dir, 'signals.jsonl')
    writeFileSync(inputPath, [JSON.stringify(signal()), JSON.stringify(signal({ at: at(30) }))].join('\n') + '\n', 'utf8')
    const ledgerA = join(dir, 'ledger-a.jsonl')
    const tmpA = join(dir, 'tmp-a')

    let dryCalls = 0
    const dry = runRound({
      inputPath,
      contract: V2,
      now,
      ledgerPath: ledgerA,
      planContent: planText,
      tmpDir: tmpA,
      spawn: () => {
        dryCalls++
        return { status: 0, stdout: '', stderr: '' }
      },
      log: () => {},
      warn: () => {},
    })
    ok('dry-run 判定完成且不 spawn', dry.code === 0 && dryCalls === 0)
    ok('dry-run 只记台账 result=dry-run', dry.results.length === 1 && dry.results[0].result === 'dry-run' && readLedger(ledgerA)[0]?.result === 'dry-run')
    ok('dry-run 产出登记行样例(含 action 与 route)', dry.candidates.length === 1 && /deploy/.test(dry.candidates[0].line) && /\/api\/deploy\/release/i.test(dry.candidates[0].line))

    const ledgerB = join(dir, 'ledger-b.jsonl')
    const tmpB = join(dir, 'tmp-b')
    const calls = []
    let block = ''
    const fakeSpawn = (_cmd, argv, opts) => {
      calls.push({ argv, opts })
      block = readFileSync(opts.env.LIVE_BLOCK_FILE, 'utf8')
      return { status: 0, stdout: '✅ 回读:本块每一条非空行都在 HEAD 里', stderr: '' }
    }
    const applied = runRound({
      inputPath,
      contract: V2,
      now,
      ledgerPath: ledgerB,
      planContent: planText,
      tmpDir: tmpB,
      apply: true,
      spawn: fakeSpawn,
      // 密闭夹具:self-test 绝不触真 git;给一棵「已落地」假 HEAD 面,同时钉 ticketLine 带回链。
      readPlanHead: () => `- [ ] O67 [deploy-feedback] [deploy_outcome/alert_firing] rollback post /api/deploy/release 部署异常 ⇒ 排查链路并修复（登记@2026-10-26/deploy-feedback;来源:deploy_outcome;证据:dims=web action=rollback route=post /api/deploy/release sample="x"）\n`,
      log: () => {},
      warn: () => {},
    })
    ok('--apply 只调一次 live-doc-edit', applied.code === 0 && applied.results[0]?.result === 'registered' && calls.length === 1)
    ok('registered 条目带 ticketLine 回读(闭环对齐键)', (() => {
      const e = readLedger(ledgerB).find((x) => x.result === 'registered')
      return Boolean(e?.ticketLine) && e.ticketLine.includes('[deploy-feedback]') && /^[O]\d+/.test(e.ticketLine.replace('- [ ] ', '').trim())
    })())
    ok(
      'live-doc-edit 调用参数(LIVE_DOC/LIVE_BLOCK_FILE/LIVE_MSG/令牌族)',
      String(calls[0]?.argv?.[0] ?? '').endsWith('live-doc-edit.mjs') &&
        calls[0]?.opts?.env?.LIVE_DOC === 'PROJECT_PLAN.md' &&
        String(calls[0]?.opts?.env?.LIVE_BLOCK_FILE ?? '').startsWith(tmpB) &&
        /deploy-feedback/.test(String(calls[0]?.opts?.env?.LIVE_MSG ?? '')) &&
        block.includes('{{NEXT_ID:O}}'),
    )
    ok('登记块行宽 ≤400 且无裸短 sha', block.trim().length <= LINE_MAX && !/(^|[^0-9a-zA-Z_])[0-9a-fA-F]{7,64}(?=$|[^0-9a-zA-Z_])/.test(block))

    const identity = identityOfSignal(signal(), V2)
    const ledgerC = join(dir, 'ledger-c.jsonl')
    appendLedger({ ts: new Date(now.getTime() - 3600_000).toISOString(), action: 'deploy', identity, result: 'registered' }, ledgerC)
    let dedupCalls = 0
    const dedup = runRound({
      inputPath,
      contract: V2,
      now,
      ledgerPath: ledgerC,
      planContent: planText,
      apply: true,
      spawn: () => {
        dedupCalls++
        return { status: 0, stdout: '✅ 回读', stderr: '' }
      },
      log: () => {},
      warn: () => {},
    })
    ok('同身份 24h 内已登记 ⇒ 跳过不 spawn', dedup.code === 0 && dedup.results[0]?.result === 'skip' && dedupCalls === 0)

    const missing = runRound({ inputPath: join(dir, 'nope.jsonl'), contract: V2, now, ledgerPath: join(dir, 'ledger-d.jsonl'), log: () => {}, warn: () => {} })
    ok('输入缺失 ⇒ exit 2 未判定', missing.code === 2 && missing.status === 'undetermined' && /读不到/.test(missing.why ?? ''))

    const ledgerE = join(dir, 'ledger-e.jsonl')
    const status = statusReport({ contract: V2, inputPath, ledgerPath: ledgerE, planContent: planText, now })
    ok('--status 只读:不创建台账/不 spawn', status.code === 0 && readLedger(ledgerE).length === 0 && !existsSync(ledgerE))
    ok('--status 末行含取号族与台账读数', status.lines.some((l) => l.startsWith('取号族:')) && status.lines.some((l) => l.startsWith('台账:')))

    // 真实计划的取号可行面(只读;读不到就以 fixture 的检查为准,不把夹具当真实读数)
    let realPlan = ''
    try {
      realPlan = readFile(PLAN_PATH)
    } catch {
      /* 读不到真实计划就只保留 fixture 检查 */
    }
    if (realPlan) {
      const realFam = chooseIdFamily(realPlan)
      ok('真实 PROJECT_PLAN.md 现读取号可行(非 G)', realFam.ok === true && realFam.family !== 'G')
      if (realFam.ok) log(`  取号族现读:${realFam.basis} 令牌=${realFam.token}`)
    }
  } finally {
    try {
      rmScratch(dir)
    } catch {
      /* 清理失败不改写用例结论 */
    }
  }
  if (failed > 0) {
    console.error(`self-test: ${failed} 例红`)
    return false
  }
  log('self-test: 全绿')
  return true
}

async function main(argv) {
  const args = parseArgs(argv)
  if (args.selfTest) return (await runSelfTest()) ? 0 : 1
  if (args.errors.length > 0) {
    for (const e of args.errors) console.error(`❌ ${e}`)
    console.error('未判定:参数错误,未产生任何登记')
    return 2
  }

  if (args.status) {
    const rep = statusReport({ inputPath: args.input ?? DEFAULT_INPUT, minutes: args.minutes })
    if (args.json) {
      console.log(JSON.stringify({ code: rep.code, status: rep.status, why: rep.why, lines: rep.lines, family: rep.family, input: rep.input }))
    } else {
      for (const l of rep.lines) console.log(l)
      if (rep.code === 2) console.error(`未判定:${rep.why ?? '状态读不全'}`)
    }
    return rep.code
  }

  const quiet = args.json ? () => {} : console.log
  const quietWarn = args.json ? () => {} : (...a) => console.error(...a)
  const res = runRound({
    inputPath: args.input ?? DEFAULT_INPUT,
    minutes: args.minutes,
    maxPerRun: args.maxPerRun,
    apply: args.apply,
    now: new Date(),
    log: quiet,
    warn: quietWarn,
  })
  if (args.json) {
    console.log(
      JSON.stringify({
        code: res.code,
        status: res.status,
        why: res.why,
        input: res.input,
        family: res.family,
        candidates: res.candidates,
        results: res.results,
        entries: res.entries,
        ledgerPath: res.ledgerPath,
      }),
    )
  }
  return res.code
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  main(process.argv.slice(2))
    .then((code) => {
      process.exitCode = code
    })
    .catch((e) => {
      console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
      process.exitCode = 2
    })
}

export const __test__ = {
  parseArgs,
  parseSignalRows,
  contractSupportsDeployOutcome,
  loadDeployContract,
  ensureDeployContract,
  identityOfSignal,
  actionOf,
  dimsTextOf,
  locatorOf,
  buildTitle,
  buildEvidence,
  buildRegistrationLine,
  chooseIdFamily,
  readLedger,
  appendLedger,
  recentlyRegistered,
  registerToPlan,
  findLandedRegistrationLine,
  defaultReadPlanHead,
  runRound,
  statusReport,
  runSelfTest,
  DEPLOY_SOURCE,
  DEFAULT_INPUT,
  LEDGER_PATH,
  PLAN_PATH,
  TMP_DIR,
  LIVE_DOC_EDIT,
  LINE_MAX,
  TITLE_MAX,
  EVIDENCE_MAX,
  DEFAULT_MINUTES,
  DEFAULT_MAX_PER_RUN,
  FAMILY_CANDIDATES,
  DeployFeedbackShapeError,
  DeployFeedbackWriteError,
}
