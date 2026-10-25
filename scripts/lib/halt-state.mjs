// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * halt-state — 运行期「安全停机」状态机(2026-10-26 立)。
 *
 * 票面:安全停机而非硬失败 —— 异常时进入受控停机态并通知人工,而不是放任失败扩散。
 *
 * 与邻席的边界(§0.6 单一真相源,不重复造轮子):
 *   - `scripts/lib/human-valve.mjs` 判的是「**一段动作文本**该不该停」(self-serve / stop-for-human);
 *   - 本模块判的是「**机器现在停没停**」(running / halted / resuming),只提供状态机 + 落盘留痕 + 恢复出口。
 *   本模块不复制 human-valve 的判桶,也不替它决定"能不能干"。
 *
 * 为什么必须有状态:
 *   停机若只写在日志里,下一位会话/下一轮守护看不到 ⇒ 会照常重试、照常推进,失效方向变成
 *   "多放一次跳门"(§0.10)。停机态必须落盘、可读、可判,恢复必须带证据。
 *
 * 失效方向(§0.10):
 *   - 读不到 / 形状坏 ⇒ 抛 HaltStateUnjudgedError,调用方落 exit 2「未判定」,绝不当成 running;
 *   - 恢复不成立 ⇒ 只允许经 abort 回 halted,不存在 resuming → running 的"无声"捷径;
 *   - 非法转移一律拒并点名当前态与合法事件列表,不猜调用方意图。
 *
 * 三态四边(对象结构即真相源,见 HALT_TRANSITIONS):
 *   enter : running  -> halted
 *   resume: halted   -> resuming
 *   settle: resuming -> running
 *   abort : resuming -> halted
 *   (halted 上重复 enter 不是状态转移,只追加一条 attempt,不改状态 —— 幂等。)
 */

import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs'
import { hostname } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))

/** 仓库根按脚本自身位置推导(§15:禁 process.cwd() 定根,共享工作区 cwd 不可靠)。 */
export const REPO_ROOT = join(HERE, '..', '..')

/** 状态文件默认落点(在 .ihui-agent/state/ 下,gitignored)。 */
export const DEFAULT_HALT_FILE = join(REPO_ROOT, '.ihui-agent', 'state', 'halt.json')

export const HALT_STATES = /** @type {const} */ (['running', 'halted', 'resuming'])

export const HALT_INITIAL_STATE = 'running'

/**
 * 转移表:事件 -> {from, to}。封闭枚举 = 单一真相源。
 * 任何不在表内的 (from, to) 组合都判非法,包括"从 halted 直接回 running"——
 * 恢复必须先经过 resuming,让恢复动作本身也留下一条带证据的痕。
 */
export const HALT_TRANSITIONS = Object.freeze({
  enter: Object.freeze({ from: 'running', to: 'halted' }),
  resume: Object.freeze({ from: 'halted', to: 'resuming' }),
  settle: Object.freeze({ from: 'resuming', to: 'running' }),
  abort: Object.freeze({ from: 'resuming', to: 'halted' }),
})

export const HALT_EVENTS = Object.freeze(Object.keys(HALT_TRANSITIONS))

/** §0.10:原因与证据都必须足够定向,短句一律拒。 */
export const MIN_REASON_CHARS = 10
export const MIN_EVIDENCE_CHARS = 10

export const HALT_SCHEMA_VERSION = 1

/** 状态文件读不了 / 形状坏 ⇒ 未判定(CLI exit 2),不猜成 running。 */
export class HaltStateUnjudgedError extends Error {
  constructor(message) {
    super(message)
    this.name = 'HaltStateUnjudgedError'
    this.code = 'HALT_STATE_UNJUDGED'
  }
}

/** 调用被拒:非法转移、reason/evidence 不合规(CLI exit 1)。 */
export class HaltTransitionError extends Error {
  constructor(message, detail = {}) {
    super(message)
    this.name = 'HaltTransitionError'
    this.code = 'HALT_TRANSITION_REFUSED'
    this.detail = detail
  }
}

/** 按码点数计长(中文一个字算一字,emoji 不劈成两字)。 */
export function charCount(text) {
  return [...String(text ?? '')].length
}

export function isHaltState(value) {
  return HALT_STATES.includes(value)
}

export function edgeOf(event) {
  return Object.prototype.hasOwnProperty.call(HALT_TRANSITIONS, event)
    ? HALT_TRANSITIONS[event]
    : null
}

export function isLegalTransition(from, to) {
  return Object.values(HALT_TRANSITIONS).some((edge) => edge.from === from && edge.to === to)
}

/** 合法事件 = 当前态作为 from 的全部边;用于拒绝时的点名与 CLI 提示。 */
export function legalEventsFrom(state) {
  return HALT_EVENTS.filter((event) => HALT_TRANSITIONS[event].from === state)
}

function nowIso(now) {
  const dt = now instanceof Date ? now : new Date()
  return dt.toISOString()
}

function requireReason(reason) {
  if (typeof reason !== 'string' || reason.trim() === '') {
    throw new HaltTransitionError('reason 必填:停机/恢复原因不能为空')
  }
  const text = reason.trim()
  if (charCount(text) < MIN_REASON_CHARS) {
    throw new HaltTransitionError(
      `reason 太短(${charCount(text)} 字 < ${MIN_REASON_CHARS} 字):必须写清"停在哪、什么异常",短句无法定向(§0.10)`,
    )
  }
  return text
}

function requireEvidence(evidence, { required }) {
  if (evidence === undefined || evidence === null) {
    if (required) {
      throw new HaltTransitionError(
        'evidence 必填:恢复必须说明"凭什么说异常已消除",缺失即拒(§0.10 多要一次定向说明)',
      )
    }
    return ''
  }
  if (typeof evidence !== 'string') {
    throw new HaltTransitionError('evidence 必须是字符串')
  }
  const text = evidence.trim()
  if (required && text === '') {
    throw new HaltTransitionError('evidence 必填:空串等于没有证据,恢复一律拒')
  }
  if (required && charCount(text) < MIN_EVIDENCE_CHARS) {
    throw new HaltTransitionError(
      `evidence 太短(${charCount(text)} 字 < ${MIN_EVIDENCE_CHARS} 字):必须写清验证方式与现读结果`,
    )
  }
  return text
}

function requireBy(by) {
  if (by === undefined || by === null || by === '') return `haltctl@${hostname()}#${process.pid}`
  if (typeof by !== 'string' || by.trim() === '') {
    throw new HaltTransitionError('by 必须是非空字符串')
  }
  return by.trim()
}

function makeTransition({ from, to, reason, by, evidence, now }) {
  return Object.freeze({
    at: nowIso(now),
    from,
    to,
    reason,
    by,
    evidence,
  })
}

export function emptyHaltDoc() {
  return {
    schema: HALT_SCHEMA_VERSION,
    state: HALT_INITIAL_STATE,
    updatedAt: '',
    transitions: [],
    attempts: [],
  }
}

/**
 * 解析状态文件正文。任何形状问题一律抛 HaltStateUnjudgedError —— 坏文件不许被读成某个态。
 * 历史里出现"不在转移表内的边"也算坏:说明这份文件不是本状态机写的,或被人手改过。
 */
export function parseHaltState(rawText) {
  if (typeof rawText !== 'string' || rawText.trim() === '') {
    throw new HaltStateUnjudgedError('停机状态文件为空')
  }
  let doc
  try {
    doc = JSON.parse(rawText)
  } catch (e) {
    throw new HaltStateUnjudgedError(`停机状态文件不是合法 JSON:${e?.message ?? e}`)
  }
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
    throw new HaltStateUnjudgedError('停机状态文件顶层必须是对象')
  }
  if (doc.schema !== HALT_SCHEMA_VERSION) {
    throw new HaltStateUnjudgedError(
      `停机状态文件 schema=${JSON.stringify(doc.schema)} 不是本模块认识的 ${HALT_SCHEMA_VERSION}`,
    )
  }
  if (!isHaltState(doc.state)) {
    throw new HaltStateUnjudgedError(
      `停机状态「${String(doc.state)}」不在 ${HALT_STATES.join(' / ')} 内`,
    )
  }
  if (!Array.isArray(doc.transitions)) {
    throw new HaltStateUnjudgedError('停机状态文件 transitions 必须是数组')
  }
  if (!Array.isArray(doc.attempts)) {
    throw new HaltStateUnjudgedError('停机状态文件 attempts 必须是数组')
  }
  const transitions = doc.transitions.map((raw, i) => {
    const at = `transitions[${i}]`
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new HaltStateUnjudgedError(`${at} 必须是对象`)
    }
    for (const key of ['at', 'from', 'to', 'reason', 'by', 'evidence']) {
      if (typeof raw[key] !== 'string') {
        throw new HaltStateUnjudgedError(`${at}.${key} 必须是字符串`)
      }
    }
    if (Number.isNaN(Date.parse(raw.at))) {
      throw new HaltStateUnjudgedError(`${at}.at「${raw.at}」不是可解析的时刻`)
    }
    if (!isLegalTransition(raw.from, raw.to)) {
      throw new HaltStateUnjudgedError(
        `${at} 记录了一条未登记的转移 ${raw.from} -> ${raw.to}(转移表封闭,非法边不得入账)`,
      )
    }
    if (raw.reason.trim() === '' || raw.by.trim() === '') {
      throw new HaltStateUnjudgedError(`${at} 缺 reason/by`)
    }
    return Object.freeze({
      at: raw.at,
      from: raw.from,
      to: raw.to,
      reason: raw.reason,
      by: raw.by,
      evidence: raw.evidence,
    })
  })
  const attempts = doc.attempts.map((raw, i) => {
    const at = `attempts[${i}]`
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new HaltStateUnjudgedError(`${at} 必须是对象`)
    }
    for (const key of ['at', 'state', 'reason', 'by', 'evidence']) {
      if (typeof raw[key] !== 'string') {
        throw new HaltStateUnjudgedError(`${at}.${key} 必须是字符串`)
      }
    }
    if (!isHaltState(raw.state)) {
      throw new HaltStateUnjudgedError(`${at}.state「${raw.state}」不在枚举内`)
    }
    return Object.freeze({
      at: raw.at,
      state: raw.state,
      reason: raw.reason,
      by: raw.by,
      evidence: raw.evidence,
    })
  })
  // 历史自洽性:最后一条转移的 to 必须等于当前 state(否则这份文件自相矛盾)。
  const last = transitions[transitions.length - 1]
  if (last && last.to !== doc.state) {
    throw new HaltStateUnjudgedError(
      `停机状态文件自相矛盾:state=${doc.state} 但最后一条转移落到 ${last.to}`,
    )
  }
  return {
    schema: HALT_SCHEMA_VERSION,
    state: doc.state,
    updatedAt: typeof doc.updatedAt === 'string' ? doc.updatedAt : '',
    transitions,
    attempts,
  }
}

/**
 * 读状态。文件不存在 = 初始态 running(这不是"取不到":初始化有定义)。
 * 存在但读失败(权限/是目录/IO) ⇒ 未判定,绝不回落 running。
 */
export function readHaltState({ file = DEFAULT_HALT_FILE } = {}) {
  if (!existsSync(file)) {
    return Object.freeze({ ...emptyHaltDoc(), persisted: false, file })
  }
  let raw
  try {
    raw = readFileSync(file, 'utf8')
  } catch (e) {
    throw new HaltStateUnjudgedError(`停机状态文件读不到(${file}):${e?.message ?? e}`)
  }
  const doc = parseHaltState(raw)
  return Object.freeze({ ...doc, persisted: true, file })
}

function writeHaltState(doc, { file }) {
  mkdirSync(dirname(file), { recursive: true })
  const text = `${JSON.stringify(doc, null, 2)}\n`
  const tmp = `${file}.tmp-${process.pid}-${Date.now()}`
  writeFileSync(tmp, text, 'utf8')
  try {
    renameSync(tmp, file)
  } catch {
    // Windows 上被共享读卡住时退回直写;临时件必须清掉,不留残骸。
    writeFileSync(file, text, 'utf8')
    try {
      unlinkSync(tmp)
    } catch {
      /* 临时件清理失败不影响主写入 */
    }
  }
}

function applyEvent(doc, event, { reason, by, evidence, now }) {
  const edge = edgeOf(event)
  if (!edge) throw new HaltTransitionError(`未登记的事件「${event}」`)
  if (doc.state !== edge.from) {
    throw new HaltTransitionError(
      `非法转移:${doc.state} -> ${edge.to}(${event} 只允许从 ${edge.from} 出发);当前态合法的转移有:${
        legalEventsFrom(doc.state).join(', ') || '(无,终态)'
      }`,
      { from: doc.state, to: edge.to, event, allowed: legalEventsFrom(doc.state) },
    )
  }
  const transition = makeTransition({ from: edge.from, to: edge.to, reason, by, evidence, now })
  const next = {
    ...doc,
    state: edge.to,
    updatedAt: transition.at,
    transitions: [...doc.transitions, transition],
  }
  return { doc: next, transition }
}

/**
 * 进入停机态。
 * 幂等:已经 halted 时再进只追加一条 attempt(留下"谁又试了一次"的痕),状态不动。
 * running -> halted 是唯一合法的进入边;resuming 期间要回停请用 abortResume。
 */
export function enterHalt(
  reason,
  evidence,
  { file = DEFAULT_HALT_FILE, by, now = new Date() } = {},
) {
  const safeReason = requireReason(reason)
  const safeEvidence = requireEvidence(evidence, { required: false })
  const safeBy = requireBy(by)
  const current = readHaltState({ file })
  const base = {
    schema: HALT_SCHEMA_VERSION,
    state: current.state,
    updatedAt: current.updatedAt,
    transitions: [...current.transitions],
    attempts: [...current.attempts],
  }
  if (current.state === 'halted') {
    const attempt = Object.freeze({
      at: nowIso(now),
      state: 'halted',
      reason: safeReason,
      by: safeBy,
      evidence: safeEvidence,
    })
    const next = { ...base, attempts: [...base.attempts, attempt] }
    writeHaltState(next, { file })
    return Object.freeze({
      ok: true,
      changed: false,
      state: 'halted',
      doc: next,
      attempt,
      file,
    })
  }
  const { doc, transition } = applyEvent(base, 'enter', {
    reason: safeReason,
    by: safeBy,
    evidence: safeEvidence,
    now,
  })
  writeHaltState(doc, { file })
  return Object.freeze({ ok: true, changed: true, state: doc.state, doc, transition, file })
}

/**
 * 恢复:halted -> resuming(-> running)。
 * evidence 必填:"凭什么说异常已消除"不能省,缺/空/过短一律拒。
 * settle=false 时停在 resuming,供分步恢复的调用方先做外部验证再用 settleResumeFor 收尾。
 */
export function resumeHalt(
  reason,
  evidence,
  { file = DEFAULT_HALT_FILE, by, now = new Date(), settle = true } = {},
) {
  const safeReason = requireReason(reason)
  const safeEvidence = requireEvidence(evidence, { required: true })
  const safeBy = requireBy(by)
  const current = readHaltState({ file })
  const base = {
    schema: HALT_SCHEMA_VERSION,
    state: current.state,
    updatedAt: current.updatedAt,
    transitions: [...current.transitions],
    attempts: [...current.attempts],
  }
  const first = applyEvent(base, 'resume', {
    reason: safeReason,
    by: safeBy,
    evidence: safeEvidence,
    now,
  })
  let doc = first.doc
  const transitions = [first.transition]
  if (settle) {
    const second = applyEvent(doc, 'settle', {
      reason: `${safeReason}(恢复完成:人工确认异常已消除)`,
      by: safeBy,
      evidence: safeEvidence,
      now,
    })
    doc = second.doc
    transitions.push(second.transition)
  }
  writeHaltState(doc, { file })
  return Object.freeze({
    ok: true,
    changed: true,
    state: doc.state,
    doc,
    transitions: Object.freeze(transitions),
    file,
  })
}

/**
 * 恢复失败回停:resuming -> halted。
 * 这是"恢复不成立"的唯一合法出路 —— 不允许从 resuming 静默回到 running。
 */
export function abortResume(
  reason,
  evidence,
  { file = DEFAULT_HALT_FILE, by, now = new Date() } = {},
) {
  const safeReason = requireReason(reason)
  const safeEvidence = requireEvidence(evidence, { required: true })
  const safeBy = requireBy(by)
  const current = readHaltState({ file })
  const base = {
    schema: HALT_SCHEMA_VERSION,
    state: current.state,
    updatedAt: current.updatedAt,
    transitions: [...current.transitions],
    attempts: [...current.attempts],
  }
  const { doc, transition } = applyEvent(base, 'abort', {
    reason: safeReason,
    by: safeBy,
    evidence: safeEvidence,
    now,
  })
  writeHaltState(doc, { file })
  return Object.freeze({ ok: true, changed: true, state: doc.state, doc, transition, file })
}

/**
 * 通知人工的**文本模板**(本工具只打印,绝不真发信)。
 * 发信唯一通道 = apps/api/scripts/notify-deploy-failure.ts(§5e,属他席射程)。
 */
export function humanNoticeFor(doc) {
  const last = doc.transitions[doc.transitions.length - 1] ?? null
  const lines = [
    '收件人: 经 apps/api/scripts/notify-deploy-failure.ts 投递(优先级 --to > ALERT_EMAIL_TO > env-file)',
    'subject: [IHUI-AI][halt] 运行期已进入安全停机态,需人工确认',
    'body:',
    `  当前状态: ${doc.state}`,
    `  进入时刻: ${last ? last.at : '(尚无转移记录)'}`,
    `  停机原因: ${last ? last.reason : '(无)'}`,
    `  操作者: ${last ? last.by : '(无)'}`,
    `  补充证据: ${last && last.evidence ? last.evidence : '(无)'}`,
    '  恢复方式: node scripts/haltctl.mjs --resume "<原因>" --evidence "<异常已消除的验证依据>"',
    '  说明: 安全停机不是硬失败;在人工确认前不要重试、不要绕行。',
  ]
  return lines.join('\n')
}

// §22c/§22d:导出的必须是判据本身,测试与自检直接 import,禁止另抄一份逻辑。
export const __test__ = {
  HALT_STATES,
  HALT_TRANSITIONS,
  HALT_EVENTS,
  HALT_INITIAL_STATE,
  MIN_REASON_CHARS,
  MIN_EVIDENCE_CHARS,
  HALT_SCHEMA_VERSION,
  HaltStateUnjudgedError,
  HaltTransitionError,
  charCount,
  isHaltState,
  edgeOf,
  isLegalTransition,
  legalEventsFrom,
  emptyHaltDoc,
  parseHaltState,
  readHaltState,
  enterHalt,
  resumeHalt,
  abortResume,
  humanNoticeFor,
  DEFAULT_HALT_FILE,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
