// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 可审计决策链的**写入/读取唯一出口**(2026-10-25 立,票面:无人状态下"为什么这么改"的决策理由留痕可追责)。
 *
 * 要补的那一格:仓里已有三本"事后可查"的台账(`mail-send-ledger.jsonl` 记发信、
 * `safe-commit-attestation.jsonl` 记提交门读数、`plan-row-drop.jsonl` 记摘行),但它们回答的都是
 * **"发生了什么"**;没有一处回答 **"当时为什么选这一档"**。无人值守时这个缺口最贵:事后只能看到
 * diff,看不到"为什么不是另一档",于是同样的岔路下次还得有人重新拍一遍。
 *
 * 三条口径:
 *  1. **形状即契约**:必填 `{at, seat, action, why, evidence}`,可选 `{target, ticket, commit}`;
 *     `why` 少于 10 个字符 ⇒ 拒收(§0.10:不说明理由等于替人猜)。未知字段**不拒**(向前兼容),
 *     原样保留 —— 拒掉未知字段会让"未来加一格"变成一次全仓改写的破坏性变更。
 *  2. **append-only 且先验后写**:先 `validateDecision()` 全字段判完再落盘,坏条目一条不落;
 *     写用 `appendFileSync`(O_APPEND),既有字节一个不动,同一输入两次写 = 两条逐字相同的行,
 *     第一条永远不变(这是"两次跑幂等"的可验证形态)。
 *  3. **取不到 ≠ 没有**:`readDecisions()` 把 `missing` / `unreadable` / `bad-line` 分开如实报出,
 *     调用方不得把"读不出"折成"0 条 ⇒ 没问题"(§0.3)。
 *
 * 台账落 `.ihui-agent/state/decision-log.jsonl`(gitignored,不注水印;ASCII 键 + ISO 时刻,
 * 与 `mail-send-ledger.jsonl` / `safe-commit-attestation.jsonl` 同族)。
 *
 * 用法(只建出口,不做判据,不进提交链):
 *   import { appendDecision, readDecisions } from './lib/decision-log.mjs'
 *   const r = appendDecision({ at, seat: 'r5', action: 'pick-plan-branch', why: '…', evidence: ['…'], ticket: 'G-123' })
 *   if (!r.ok) console.warn(`⚠️ 决策未留痕:${r.why}`)
 *   const rd = readDecisions({ seat: 'r5', since: '2026-10-25T00:00:00.000Z' })
 *   if (!rd.ok) console.error(`决策台账未判定:${rd.why}`)
 */

import { appendFileSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..', '..')

/** 台账相对路径 —— 全仓唯一,任何调用方不得再拼一次(拼两份就是两份真相)。 */
export const DECISION_LEDGER_REL = join('.ihui-agent', 'state', 'decision-log.jsonl')

/** 必填字段。顺序即报错顺序,坏条目点名时按这个顺序走。 */
export const REQUIRED_FIELDS = Object.freeze(['at', 'seat', 'action', 'why', 'evidence'])

/** 可选字段。给定即校验,未给不补默认值(不替人编"目标/票号")。 */
export const OPTIONAL_FIELDS = Object.freeze(['target', 'ticket', 'commit'])

/** `why` 最短长度(码点)。10 是票面定档,不是拍的整数:低于它只剩"修了个 bug"这类无法追责的句子。 */
export const MIN_WHY_CHARS = 10

/** 各文本字段上限(码点)。上限是"行必须还能被人读",不是存储限制。 */
export const MAX_TEXT = Object.freeze({
  seat: 64,
  action: 120,
  why: 2000,
  target: 400,
  ticket: 120,
  evidenceItem: 1000,
  evidenceItems: 32,
})

const FULL_SHA_RE = /^[0-9a-f]{40}$/
const CONTROL_RE = /[\u0000-\u001f\u007f]/
const ISO_HINT_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/

export function ledgerPath(root = REPO_ROOT) {
  return resolve(root, DECISION_LEDGER_REL)
}

function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key)
}

/** 码点计数:`[...s].length` —— 代理对(emoji/生僻字)按 1 个字符算,不按 UTF-16 单元虚高。 */
export function countChars(v) {
  return typeof v === 'string' ? Array.from(v).length : 0
}

/** 单行文本归一:折叠所有空白为单空格并 trim。只用于判定与展示,不改写原始对象。 */
export function oneLine(v, max = MAX_TEXT.why) {
  if (typeof v !== 'string') return ''
  const s = v.replace(/\s+/g, ' ').trim()
  return countChars(s) > max ? Array.from(s).slice(0, max).join('') : s
}

/**
 * 时刻归一:ISO 串 / 毫秒 / 秒级 epoch 都收;解不出一律 null(调用方按"未判定"处理,不猜)。
 * 阈值 1e11:13 位毫秒(2003 起)落毫秒臂,10 位秒级落秒臂。
 */
export function normalizeAt(v) {
  if (v instanceof Date) return Number.isFinite(v.getTime()) ? v.toISOString() : null
  if (typeof v === 'number' && Number.isFinite(v) && v > 0) {
    const d = new Date(v > 1e11 ? v : v * 1000)
    return Number.isFinite(d.getTime()) ? d.toISOString() : null
  }
  const s = typeof v === 'string' ? v.trim() : ''
  if (!s) return null
  if (/^\d{10,}$/.test(s)) return normalizeAt(Number(s))
  const t = Date.parse(s)
  return Number.isFinite(t) ? new Date(t).toISOString() : null
}

/** 40 位全量提交指针才可追责(AGENTS §1 禁短 sha 当证据指针)。 */
export function isFullSha(v) {
  return typeof v === 'string' && FULL_SHA_RE.test(v.trim().toLowerCase())
}

function pushError(errors, field, why) {
  errors.push({ field, why })
}

/**
 * 纯函数:逐字段校验一条决策。**不碰磁盘、不读时钟**。
 *
 * 返回 `{ ok, errors, entry }`:
 *  - `ok:true` ⇒ `entry` 是**规范化后**的对象(键序固定,at 归一为 ISO,commit 小写,文本 trim),
 *    未知字段原样跟在后面(向前兼容);
 *  - `ok:false` ⇒ `errors` 逐字段点名,`entry:null`。
 */
export function validateDecision(raw) {
  const errors = []
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, errors: [{ field: '(root)', why: '条目必须是 JSON 对象(数组/标量/空值一律拒收)' }], entry: null }
  }

  for (const f of REQUIRED_FIELDS) {
    if (!hasOwn(raw, f) || raw[f] === null || raw[f] === undefined || raw[f] === '') {
      pushError(errors, f, '必填字段缺失或为空')
    }
  }

  let at = null
  if (hasOwn(raw, 'at') && raw.at !== null && raw.at !== undefined && raw.at !== '') {
    if (typeof raw.at !== 'string') pushError(errors, 'at', '必须是 ISO 时刻字符串')
    else if (!ISO_HINT_RE.test(raw.at.trim())) pushError(errors, 'at', '必须是 ISO 日期时刻(形如 2026-10-25T00:00:00.000Z),不接受纯日期')
    else {
      at = normalizeAt(raw.at)
      if (!at) pushError(errors, 'at', `解不出的时刻:「${oneLine(raw.at, 40)}」`)
    }
  }

  let seat = null
  if (hasOwn(raw, 'seat') && typeof raw.seat === 'string' && raw.seat.trim()) {
    seat = raw.seat.trim()
    if (CONTROL_RE.test(seat)) pushError(errors, 'seat', '不得含换行/制表等控制字符')
    else if (countChars(seat) > MAX_TEXT.seat) pushError(errors, 'seat', `超过 ${MAX_TEXT.seat} 字符`)
  } else if (hasOwn(raw, 'seat') && raw.seat !== null && raw.seat !== undefined && raw.seat !== '') {
    pushError(errors, 'seat', '必须是字符串')
  }

  let action = null
  if (hasOwn(raw, 'action') && typeof raw.action === 'string' && raw.action.trim()) {
    action = oneLine(raw.action, MAX_TEXT.action)
    if (CONTROL_RE.test(raw.action)) pushError(errors, 'action', '不得含换行/制表等控制字符')
    else if (countChars(raw.action) > MAX_TEXT.action) pushError(errors, 'action', `超过 ${MAX_TEXT.action} 字符`)
  } else if (hasOwn(raw, 'action') && raw.action !== null && raw.action !== undefined && raw.action !== '') {
    pushError(errors, 'action', '必须是字符串')
  }

  let why = null
  if (hasOwn(raw, 'why') && typeof raw.why === 'string' && raw.why.trim()) {
    why = oneLine(raw.why, MAX_TEXT.why)
    const n = countChars(raw.why.trim())
    if (n < MIN_WHY_CHARS) pushError(errors, 'why', `少于 ${MIN_WHY_CHARS} 字(实得 ${n})—— 不说明理由等于替人猜`)
    else if (countChars(raw.why) > MAX_TEXT.why) pushError(errors, 'why', `超过 ${MAX_TEXT.why} 字符`)
  } else if (hasOwn(raw, 'why') && raw.why !== null && raw.why !== undefined && raw.why !== '') {
    pushError(errors, 'why', '必须是字符串')
  }

  let evidence = null
  if (hasOwn(raw, 'evidence')) {
    const ev = raw.evidence
    if (typeof ev === 'string' && ev.trim()) {
      evidence = [oneLine(ev, MAX_TEXT.evidenceItem)]
    } else if (Array.isArray(ev)) {
      if (ev.length === 0) pushError(errors, 'evidence', '必须至少给出一条凭据')
      else if (ev.length > MAX_TEXT.evidenceItems) pushError(errors, 'evidence', `最多 ${MAX_TEXT.evidenceItems} 条`)
      else {
        const out = []
        ev.forEach((item, i) => {
          if (typeof item !== 'string' || !item.trim()) pushError(errors, `evidence[${i}]`, '必须是非空字符串')
          else if (countChars(item) > MAX_TEXT.evidenceItem) pushError(errors, `evidence[${i}]`, `超过 ${MAX_TEXT.evidenceItem} 字符`)
          else out.push(oneLine(item, MAX_TEXT.evidenceItem))
        })
        if (out.length > 0) evidence = out
      }
    } else if (ev !== null && ev !== undefined && ev !== '') {
      pushError(errors, 'evidence', '必须是字符串或非空字符串数组')
    }
  }

  let target = null
  if (hasOwn(raw, 'target') && raw.target !== null && raw.target !== undefined && raw.target !== '') {
    if (typeof raw.target !== 'string') pushError(errors, 'target', '必须是字符串')
    else if (countChars(raw.target) > MAX_TEXT.target) pushError(errors, 'target', `超过 ${MAX_TEXT.target} 字符`)
    else target = oneLine(raw.target, MAX_TEXT.target)
  }

  let ticket = null
  if (hasOwn(raw, 'ticket') && raw.ticket !== null && raw.ticket !== undefined && raw.ticket !== '') {
    if (typeof raw.ticket !== 'string') pushError(errors, 'ticket', '必须是字符串')
    else if (CONTROL_RE.test(raw.ticket)) pushError(errors, 'ticket', '不得含换行/制表等控制字符')
    else if (countChars(raw.ticket) > MAX_TEXT.ticket) pushError(errors, 'ticket', `超过 ${MAX_TEXT.ticket} 字符`)
    else ticket = raw.ticket.trim()
  }

  let commit = null
  if (hasOwn(raw, 'commit') && raw.commit !== null && raw.commit !== undefined && raw.commit !== '') {
    if (!isFullSha(raw.commit)) pushError(errors, 'commit', '必须是 40 位全量 sha(短 sha 会腐烂,AGENTS §1)')
    else commit = raw.commit.trim().toLowerCase()
  }

  if (errors.length > 0) return { ok: false, errors, entry: null }

  const entry = { at, seat, action, why, evidence }
  if (target !== null) entry.target = target
  if (ticket !== null) entry.ticket = ticket
  if (commit !== null) entry.commit = commit
  // 未知字段原样保留(向前兼容),已规范化的键优先,不允许未知字段覆盖它们。
  for (const k of Object.keys(raw)) {
    if (hasOwn(entry, k) || REQUIRED_FIELDS.includes(k) || OPTIONAL_FIELDS.includes(k)) continue
    entry[k] = raw[k]
  }
  return { ok: true, errors: [], entry }
}

/** 规范化后的一行 JSONL(不含换行符)。坏条目调用方先过 validateDecision。 */
export function decisionLine(entry) {
  return JSON.stringify(entry)
}

/**
 * 薄封装:先校验再 append(append-only)。**绝不抛** —— 返回 `{ok, written, path, errors, why}`。
 * 坏条目一条不落:校验失败时既不建目录也不碰文件(测试里以"文件不存在/字节不变"钉住)。
 */
export function appendDecision(entry, { root = REPO_ROOT, ledger = null } = {}) {
  const v = validateDecision(entry)
  if (!v.ok) {
    return {
      ok: false,
      written: false,
      path: ledger ? resolve(ledger) : ledgerPath(root),
      errors: v.errors,
      why: `坏条目拒收(${v.errors.map((e) => `${e.field}: ${e.why}`).join('; ')})`,
    }
  }
  const path = ledger ? resolve(ledger) : ledgerPath(root)
  try {
    mkdirSync(dirname(path), { recursive: true })
    appendFileSync(path, `${decisionLine(v.entry)}\n`, { encoding: 'utf8', flag: 'a' })
    return { ok: true, written: true, path, errors: [], why: '', entry: v.entry }
  } catch (e) {
    return { ok: false, written: false, path, errors: [], why: `写盘失败:${e?.message ?? String(e)}`, entry: v.entry }
  }
}

/**
 * 读台账。`missing` / `unreadable` 一律 `ok:false`(调用方据此走"未判定",不得记绿)。
 * `records` 保持**文件物理顺序**(时间倒序判据要靠它),每条附 `validation` 诊断。
 */
export function readDecisions(filter = {}, { root = REPO_ROOT, ledger = null } = {}) {
  const path = ledger ? resolve(ledger) : ledgerPath(root)
  let text
  try {
    text = readFileSync(path, 'utf8')
  } catch (e) {
    const missing = e && (e.code === 'ENOENT' || e.code === 'ENOTDIR')
    return {
      ok: false,
      state: missing ? 'missing' : 'unreadable',
      path,
      why: missing ? `台账不存在:${path}` : `台账读不出(${e?.code ?? e?.message ?? e})`,
      total: 0,
      badLines: [],
      records: [],
      filtered: 0,
    }
  }

  const rawRecords = []
  const badLines = []
  const lines = text.split(/\r?\n/)
  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i]
    if (!raw.trim()) continue
    const line = i + 1
    let obj
    try {
      obj = JSON.parse(raw)
    } catch (e) {
      badLines.push({ line, why: `JSON 解不出(${e?.message ?? e})`, raw: oneLine(raw, 160) })
      continue
    }
    if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
      badLines.push({ line, why: '不是 JSON 对象', raw: oneLine(raw, 160) })
      continue
    }
    rawRecords.push({ line, raw: obj, validation: validateDecision(obj) })
  }

  // 时间过滤档:先归一成 ISO 再取毫秒。`normalizeAt` 返回的是 ISO 串,**不能**直接拿去和
  // `Date.parse()` 的毫秒比大小(字符串 vs 数字会退化成 NaN 比较 ⇒ 整本台账被静默滤空)。
  const wantsSince = filter.since !== undefined && filter.since !== null
  const wantsUntil = filter.until !== undefined && filter.until !== null
  const sinceIso = wantsSince ? normalizeAt(filter.since) : null
  const untilIso = wantsUntil ? normalizeAt(filter.until) : null
  if ((wantsSince && !sinceIso) || (wantsUntil && !untilIso)) {
    return {
      ok: false,
      state: 'bad-filter',
      path,
      why: `过滤时刻解不出(since=${wantsSince ? String(filter.since) : '(未给)'}, until=${wantsUntil ? String(filter.until) : '(未给)'})`,
      total: 0,
      badLines: [],
      invalidRecords: [],
      records: [],
      filtered: 0,
    }
  }
  const sinceMs = sinceIso ? Date.parse(sinceIso) : null
  const untilMs = untilIso ? Date.parse(untilIso) : null
  const seat = typeof filter.seat === 'string' && filter.seat.trim() ? filter.seat.trim() : null
  const ticket = typeof filter.ticket === 'string' && filter.ticket.trim() ? filter.ticket.trim() : null
  const commit = typeof filter.commit === 'string' && filter.commit.trim() ? filter.commit.trim().toLowerCase() : null
  const action = typeof filter.action === 'string' && filter.action.trim() ? filter.action.trim() : null

  const records = rawRecords.filter(({ raw, validation }) => {
    if (!validation.ok) return false // 坏条目只进 invalidRecords,不参与正常过滤
    const atMs = Date.parse(validation.entry.at)
    if (sinceMs !== null && !(atMs >= sinceMs)) return false
    if (untilMs !== null && !(atMs <= untilMs)) return false
    if (seat !== null && validation.entry.seat !== seat) return false
    if (ticket !== null && validation.entry.ticket !== ticket) return false
    if (action !== null && validation.entry.action !== action) return false
    if (commit !== null && !String(validation.entry.commit || '').startsWith(commit)) return false
    return true
  })

  return {
    ok: true,
    state: 'ok',
    path,
    why: '',
    total: rawRecords.length,
    badLines,
    invalidRecords: rawRecords.filter((r) => !r.validation.ok),
    records,
    filtered: records.length,
  }
}

export const __test__ = {
  REQUIRED_FIELDS,
  OPTIONAL_FIELDS,
  MIN_WHY_CHARS,
  MAX_TEXT,
  DECISION_LEDGER_REL,
  countChars,
  oneLine,
  normalizeAt,
  isFullSha,
  validateDecision,
  decisionLine,
  appendDecision,
  readDecisions,
  ledgerPath,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
