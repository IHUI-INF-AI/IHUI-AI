#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 本工具是巡检记账器,机器行必须走 stdout */
/**
 * evolution-retro — 失败票归因沉淀器(O65 四期系列 · 第 3 期「进化回流」,2026-10-25 立)。
 *
 * 补的是"部署失败之后谁去把教训变成票"这一格:第 2 期已把每轮部署出口写成机读决策行
 * (scripts/deploy-decision.mjs 的 action 闭集),但那些行此前只被当流水看 —— 同一个病灶
 * 连续失败三次,既不会自动浮出来,也不会变成可派单的改进项。
 *
 * 归因桶口径(为什么这样定):
 *  - 桶键 = **出口 × 失败维度**(`action|dim1+dim2`,维度排序),**不含 reason 自由文本** ——
 *    同一病灶每轮携带的路径/sha 不同,把明细并进身份 = 每轮一个新桶,永远凑不到两次(§5e-1);
 *  - 24h 窗内同桶 ≥2 次 ⇒ 判「复发」,输出一条可派单机器行 + ≤8 行紧凑摘要(供 AGENTS.md
 *    增补;体积门约束下摘要必须短,明细一律留在台账里);
 *  - 同桶在 24h 内已经派过 ⇒ 本轮只报数不重复派单(去重台账 = `.ihui-agent/state/evolution-retro.jsonl`,
 *    只追加不改写,与 triage / mail 台账同形);
 *  - 决策台账读不到 ⇒ **未判定不带过**(§0.3:取不到输入不许写成"没有失败"),退出码 2。
 *
 * 用法:
 *   node scripts/evolution-retro.mjs [--decisions <path>] [--ledger <path>]
 *        [--window-hours 24] [--min-count 2] [--dry-run] [--json] [--self-test]
 *        [--lessons <path>] [--digest <path>] [--policy <path>] [--apply]
 *
 * 教训写回腿(2026-10-25 立):
 *  - 判据单源 = `scripts/data/lesson-writeback-policy.json`(目标白名单 / 指纹口径 / 条数上限);
 *  - **默认只预览不写盘**,显式 `--apply` 才落 `.ihui-agent/state/lessons.jsonl`(按键控单行,
 *    重复指纹只增计数不新增行)与 `.ihui-agent/state/lessons-digest.md`(人读,按指纹合并带计数);
 *  - `AGENTS.md`(§0 铁律段受 root-guard 哈希锁)/ `PROJECT_PLAN.md` / 根护栏清单一律禁写,
 *    目标越出 `.ihui-agent` 沙箱根也当场 exit 2(§0.3:未判定不冒充通过)。
 */
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { readDecisions } from './deploy-decision.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DEFAULT_DECISIONS = join(ROOT, '.ihui-agent', 'deploy-decisions.jsonl')
const DEFAULT_LEDGER = join(ROOT, '.ihui-agent', 'state', 'evolution-retro.jsonl')
const DEFAULT_POLICY = join(ROOT, 'scripts', 'data', 'lesson-writeback-policy.json')

const SCHEMA_VERSION = 1
const DEFAULT_WINDOW_HOURS = 24
const DEFAULT_MIN_COUNT = 2
export const MAX_SUMMARY_LINES = 8
const MAX_REASON = 160

/** 归因射程:只有"没走成"的出口进回流;pass 是成功出口,不参与归因。 */
export const FAILURE_ACTIONS = Object.freeze([
  'rollback',
  'manual-rollback',
  'build-fail',
  'pass-entry-broken',
  'pass-unproven',
])

export class RetroShapeError extends Error {}

function asText(v) {
  return typeof v === 'string' ? v.trim() : v === null || v === undefined ? '' : String(v).trim()
}

/** 决策行 → 归因桶键;非失败出口返回空串(调用方跳过)。 */
export function bucketKeyOf(decision) {
  const action = asText(decision?.action)
  if (!FAILURE_ACTIONS.includes(action)) return ''
  const dims = Array.isArray(decision?.failDims) ? decision.failDims.map(asText).filter(Boolean) : []
  // 维度集是集合语义:顺序不该把同一病灶拆成两个桶。
  return `${action}|${[...dims].sort().join('+')}`
}

/** 单条决策 → 台账口径的归因样本(与纯函数共用,自检/镜像测试同源)。 */
export function sampleOf(decision) {
  const reason = asText(decision?.reason).replace(/\s+/g, ' ')
  return {
    ts: asText(decision?.ts),
    sha: asText(decision?.sha),
    sampleReason: reason.length > MAX_REASON ? `${reason.slice(0, MAX_REASON)}…` : reason,
  }
}

/**
 * 按时间窗聚合决策行(纯函数,不碰盘)。
 * 返回桶列表按"窗内次数降序、最近发生降序"排 —— 派单面只看头部,排序必须稳定可复现。
 */
export function scanWindow(decisions, { now = Date.now(), windowHours = DEFAULT_WINDOW_HOURS } = {}) {
  const windowMs = windowHours * 3600_000
  const byKey = new Map()
  for (const d of Array.isArray(decisions) ? decisions : []) {
    const key = bucketKeyOf(d)
    if (!key) continue
    const ts = Date.parse(asText(d?.ts))
    if (!Number.isFinite(ts) || now - ts > windowMs) continue
    const s = sampleOf(d)
    const cur = byKey.get(key) || { key, count: 0, dims: Array.isArray(d?.failDims) ? [...d.failDims] : [], lastTs: '', shas: [], sampleReason: '' }
    cur.count += 1
    if (s.ts >= cur.lastTs) {
      cur.lastTs = s.ts
      cur.sampleReason = s.sampleReason
    }
    if (s.sha && !cur.shas.includes(s.sha)) cur.shas.push(s.sha)
    byKey.set(key, cur)
  }
  const out = [...byKey.values()]
  for (const b of out) {
    const [action, dimsText] = b.key.split('|')
    b.action = action
    b.dims = dimsText ? dimsText.split('+') : []
  }
  out.sort((a, b) => b.count - a.count || String(b.lastTs).localeCompare(String(a.lastTs)))
  return out
}

/** 读本器去重台账(坏行跳过,不让半截行作废整本)。 */
export function readRetroLedger(readFile = (p) => readFileSync(p, 'utf8'), ledgerPath = DEFAULT_LEDGER) {
  try {
    return readFile(ledgerPath)
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
  } catch {
    return []
  }
}

/** 同桶 24h 内已派过 ⇒ 本轮不再派(去重窗口与归因窗口同长,两把尺子同源)。 */
export function recentlyDispatched(ledger, bucketKey, { now = Date.now(), windowHours = DEFAULT_WINDOW_HOURS } = {}) {
  const windowMs = windowHours * 3600_000
  return (Array.isArray(ledger) ? ledger : []).some((e) => {
    if (e?.action !== 'dispatched' || e?.bucket !== bucketKey) return false
    const ts = Date.parse(asText(e?.ts))
    return Number.isFinite(ts) && now - ts <= windowMs
  })
}

/** 桶 → 派单计划(纯函数):达阈且未在窗内派过才算一枚。 */
export function planDispatch(buckets, ledger, { now = Date.now(), windowHours = DEFAULT_WINDOW_HOURS, minCount = DEFAULT_MIN_COUNT } = {}) {
  const dispatched = []
  const skipped = []
  for (const b of Array.isArray(buckets) ? buckets : []) {
    if (b.count < minCount) continue
    const dup = recentlyDispatched(ledger, b.key, { now, windowHours })
    const item = {
      bucket: b.key,
      action: b.action,
      dims: b.dims,
      count: b.count,
      lastTs: b.lastTs,
      shas: b.shas.slice(0, 6),
      sampleReason: b.sampleReason,
      windowHours,
      title: `部署失败复发:${b.action}${b.dims.length ? `(${b.dims.join('+')})` : ''} 24h 内 ${b.count} 次`,
    }
    if (dup) skipped.push({ ...item, why: '同桶已在 24h 内派过(去重台账命中)' })
    else dispatched.push(item)
  }
  return { dispatched, skipped }
}

/** 可派单机器行(grep 面:纯 ASCII 前缀 + 单行 JSON)。 */
export function formatDispatchLine(item) {
  return `EVOLUTION-RETRO ${JSON.stringify({ v: SCHEMA_VERSION, kind: 'dispatch', ...item })}`
}

/** ≤8 行紧凑摘要(供 AGENTS.md 增补;超限只截断条目,不改口径)。 */
export function formatSummary(dispatched, skipped = [], minCount = DEFAULT_MIN_COUNT) {
  if (!dispatched.length && !skipped.length) return ''
  const head = `失败票归因(24h 窗 ≥${minCount} 次,进化回流候选):`
  const rows = []
  for (const it of dispatched) {
    rows.push(`- ${it.action}${it.dims.length ? `(${it.dims.join('+')})` : ''} ×${it.count} —— ${it.sampleReason || '(无 reason)'}`)
  }
  for (const it of skipped) {
    rows.push(`- ${it.action}${it.dims.length ? `(${it.dims.join('+')})` : ''} ×${it.count} —— 已在 24h 内派过,本轮只报数`)
  }
  const tail = '处置:以 scripts/evolution-retro.mjs 的机器行为证据登记改进票(台账只记真工作)。'
  const lines = [head, ...rows]
  lines.push(tail)
  return lines.slice(0, MAX_SUMMARY_LINES).join('\n')
}

export function appendRetro(ledgerPath, item) {
  mkdirSync(dirname(resolve(ledgerPath)), { recursive: true })
  const record = {
    v: SCHEMA_VERSION,
    ts: new Date().toISOString(),
    action: 'dispatched',
    bucket: item.bucket,
    count: item.count,
    windowHours: item.windowHours,
    lastTs: item.lastTs,
    shas: item.shas,
    sampleReason: item.sampleReason,
  }
  appendFileSync(ledgerPath, `${JSON.stringify(record)}\n`, 'utf8')
  return record
}

// ── 教训写回腿(2026-10-25 立)──────────────────────────────────────────────────
// 目标白名单 / 去重指纹口径 / 条数上限的唯一真相源 = scripts/data/lesson-writeback-policy.json。
// 护栏纪律:只写 `.ihui-agent` 沙箱内的 state 台账与人读 digest;AGENTS.md 铁律段受 root-guard
// 哈希锁(mode=section),本腿一条都不写 —— 要改非铁律段也只能人工另行 --unlock/--seal。

export class LessonPolicyError extends Error {}

/** 归一化:去 BOM、CRLF→LF、空白折叠、首尾裁剪、小写。指纹只认这一份口径。 */
export function normalizeLessonText(raw) {
  let s = String(raw ?? '')
  if (s.charCodeAt(0) === 0xfeff) s = s.slice(1)
  s = s.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\s+/g, ' ')
  return s.trim().toLowerCase()
}

/** 去重指纹 = 教训正文归一化后的 sha256 前缀(长度取策略,单源不另写常量)。 */
export function fingerprintOf(text, policy) {
  const algorithm = policy?.fingerprint?.algorithm
  if (algorithm !== 'sha256') throw new LessonPolicyError('策略 fingerprint.algorithm 只支持 sha256')
  const length = Number(policy?.fingerprint?.length)
  if (!Number.isInteger(length) || length < 8 || length > 64)
    throw new LessonPolicyError('策略 fingerprint.length 必须是 8..64 的整数')
  return createHash('sha256').update(normalizeLessonText(text), 'utf8').digest('hex').slice(0, length)
}

/** 路径 → 仓库根相对(正斜杠);越出仓库根或无法解析 ⇒ null。 */
function repoRelative(p, root = ROOT) {
  let s = String(p ?? '').trim().replace(/\\/g, '/')
  if (!s) return ''
  const base = String(root ?? '').replace(/\\/g, '/').replace(/\/+$/, '')
  if (/^[A-Za-z]:\//.test(s) || s.startsWith('//')) {
    const lower = s.toLowerCase()
    const baseLower = base.toLowerCase()
    if (!baseLower || !(lower === baseLower || lower.startsWith(`${baseLower}/`))) return null
    s = s.slice(base.length).replace(/^\/+/, '')
  }
  const parts = []
  for (const seg of s.split('/')) {
    if (!seg || seg === '.') continue
    if (seg === '..') {
      if (!parts.length) return null
      parts.pop()
      continue
    }
    parts.push(seg)
  }
  return parts.join('/')
}

/**
 * 目标白名单判定(纯函数):必须落在沙箱根内、不在禁写名单、不是 AGENTS.md。
 * 返回绝对路径;任一不成立 ⇒ 抛 LessonPolicyError(调用方落 exit 2)。
 */
export function assertWritableTarget({ kind, override, policy, root = ROOT } = {}) {
  const declared = policy?.targets?.[kind]
  if (typeof declared !== 'string' || !declared.trim())
    throw new LessonPolicyError(`策略缺 targets.${String(kind)}`)
  const raw = override === undefined || override === null || override === '' ? declared : override
  const relPath = repoRelative(raw, root)
  if (!relPath) throw new LessonPolicyError(`写回目标不可解析或越出仓库根:${String(raw)}`)
  const never = (Array.isArray(policy?.neverWrite) ? policy.neverWrite : [])
    .map((p) => repoRelative(p, root))
    .filter(Boolean)
  if (never.some((n) => relPath === n || relPath.startsWith(`${n}/`)))
    throw new LessonPolicyError(`写回目标在禁写名单里:${relPath}`)
  if (relPath.split('/').pop() === 'AGENTS.md')
    throw new LessonPolicyError(`AGENTS.md 受根护栏哈希锁,禁止写回:${relPath}`)
  const sandboxes = (Array.isArray(policy?.sandboxRoots) ? policy.sandboxRoots : [])
    .map((p) => repoRelative(p, root))
    .filter(Boolean)
  if (!sandboxes.some((s) => relPath === s || relPath.startsWith(`${s}/`)))
    throw new LessonPolicyError(
      `写回目标不在沙箱根内(${sandboxes.join('/') || '无'}):${relPath}`,
    )
  return join(root, relPath)
}

/** 策略形状锁:缺字段/指纹口径非法/目标越界 ⇒ 抛(调用方落 exit 2)。 */
export function loadLessonPolicy(rawText) {
  let doc
  try {
    doc = JSON.parse(String(rawText ?? ''))
  } catch (e) {
    throw new LessonPolicyError(`策略不是合法 JSON:${e?.message ?? e}`)
  }
  if (!doc || typeof doc !== 'object' || Array.isArray(doc))
    throw new LessonPolicyError('策略不是对象')
  if (!Array.isArray(doc.sandboxRoots) || doc.sandboxRoots.length === 0)
    throw new LessonPolicyError('策略 sandboxRoots 必须是非空数组')
  for (const sandbox of doc.sandboxRoots) {
    if (typeof sandbox !== 'string' || !repoRelative(sandbox))
      throw new LessonPolicyError(`策略 sandboxRoots 出现非法项:${JSON.stringify(sandbox)}`)
  }
  if (!doc.targets || typeof doc.targets !== 'object')
    throw new LessonPolicyError('策略 targets 必须是对象')
  for (const kind of ['lessons', 'digest']) assertWritableTarget({ kind, policy: doc })
  if (!Array.isArray(doc.neverWrite) || doc.neverWrite.length === 0)
    throw new LessonPolicyError('策略 neverWrite 必须是非空数组(护栏锁定的文件必须显式登记)')
  const fp = doc.fingerprint
  if (!fp || fp.algorithm !== 'sha256')
    throw new LessonPolicyError('策略 fingerprint.algorithm 只支持 sha256')
  const length = Number(fp.length)
  if (!Number.isInteger(length) || length < 8 || length > 64)
    throw new LessonPolicyError('策略 fingerprint.length 必须是 8..64 的整数')
  for (const key of ['maxLessons', 'maxDigestEntries', 'maxLessonChars']) {
    const n = Number(doc.limits?.[key])
    if (!Number.isInteger(n) || n <= 0) throw new LessonPolicyError(`策略 limits.${key} 必须是正整数`)
  }
  return doc
}

/** 派单项 → 教训候选(字段:at/fingerprint/kind/lesson/evidence/ticket/commit)。 */
export function lessonCandidateOf(item, { now = Date.now(), ticket = '', commit = '', policy } = {}) {
  if (!policy) throw new LessonPolicyError('lessonCandidateOf 需要 policy(指纹与上限单源)')
  const dims = Array.isArray(item?.dims) ? item.dims.map(asText).filter(Boolean).join('+') : ''
  const raw = `部署失败复发:${asText(item?.action)}${dims ? `(${dims})` : ''} 24h 内 ${Number(item?.count) || 0} 次 —— ${asText(item?.sampleReason) || '(无 reason)'}`
  const cap = Number(policy.limits.maxLessonChars)
  const lesson = raw.length > cap ? `${raw.slice(0, cap - 1)}…` : raw
  return {
    at: new Date(now).toISOString(),
    fingerprint: fingerprintOf(lesson, policy),
    kind: 'deploy-retro',
    lesson,
    evidence: {
      bucket: asText(item?.bucket),
      buckets: [asText(item?.bucket)].filter(Boolean),
      count: Number(item?.count) || 0,
      lastTs: asText(item?.lastTs),
      shas: Array.isArray(item?.shas) ? item.shas.map(asText).filter(Boolean) : [],
      windowHours: Number(item?.windowHours) || DEFAULT_WINDOW_HOURS,
    },
    ticket: asText(ticket),
    commit: asText(commit),
  }
}

/** 读教训台账:文件不存在 ⇒ 空库(首次运行);存在但读不了 ⇒ ok:false(不冒绿)。 */
export function readLessons({
  lessonsPath,
  readFile = (p) => readFileSync(p, 'utf8'),
  exists = existsSync,
} = {}) {
  if (!lessonsPath) return { ok: false, records: [], why: '未给 lessons 台账路径' }
  if (!exists(lessonsPath)) return { ok: true, records: [], why: '' }
  let text
  try {
    text = readFile(lessonsPath)
  } catch (e) {
    return { ok: false, records: [], why: `教训台账读不到:${e?.message ?? e}` }
  }
  const records = []
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue
    try {
      records.push(JSON.parse(line))
    } catch {
      // 半截坏行不作废整本(与 retro 台账同形)
    }
  }
  return { ok: true, records, why: '' }
}

function normalizeLessonRecord(raw, policy) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const lesson = asText(raw.lesson)
  if (!lesson) return null
  const at = asText(raw.at)
  const count = Number(raw.count)
  return {
    at,
    fingerprint: asText(raw.fingerprint) || fingerprintOf(lesson, policy),
    kind: asText(raw.kind) || 'deploy-retro',
    lesson,
    evidence:
      raw.evidence && typeof raw.evidence === 'object' && !Array.isArray(raw.evidence)
        ? { ...raw.evidence }
        : {},
    ticket: asText(raw.ticket),
    commit: asText(raw.commit),
    count: Number.isInteger(count) && count > 0 ? count : 1,
    lastAt: asText(raw.lastAt) || at,
  }
}

function mergeEvidence(a, b) {
  const ea = a && typeof a === 'object' ? a : {}
  const eb = b && typeof b === 'object' ? b : {}
  const buckets = [
    ...new Set(
      [
        ...(Array.isArray(ea.buckets) ? ea.buckets : []),
        ea.bucket,
        ...(Array.isArray(eb.buckets) ? eb.buckets : []),
        eb.bucket,
      ]
        .map(asText)
        .filter(Boolean),
    ),
  ]
  const shas = [
    ...new Set(
      [
        ...(Array.isArray(ea.shas) ? ea.shas : []),
        ...(Array.isArray(eb.shas) ? eb.shas : []),
      ]
        .map(asText)
        .filter(Boolean),
    ),
  ].slice(0, 12)
  const lastTs = [asText(ea.lastTs), asText(eb.lastTs)].filter(Boolean).sort().pop() || ''
  const count = Math.max(Number(ea.count) || 0, Number(eb.count) || 0)
  const windowHours = eb.windowHours ?? ea.windowHours
  return { bucket: buckets[buckets.length - 1] || '', buckets, count, lastTs, shas, windowHours }
}

/**
 * 按键合并(纯函数):同指纹 ⇒ 只增计数/更新最后发生,不新增行;新指纹 ⇒ 追加。
 * 超过 limits.maxLessons 时从最旧一端淘汰(淘汰名单进 evicted,便于机器行报数)。
 */
export function mergeLessons(records, candidates, policy) {
  const max = Number(policy?.limits?.maxLessons)
  if (!Number.isInteger(max) || max <= 0)
    throw new LessonPolicyError('策略 limits.maxLessons 必须是正整数')
  const byFp = new Map()
  const out = []
  for (const raw of Array.isArray(records) ? records : []) {
    const rec = normalizeLessonRecord(raw, policy)
    if (!rec || byFp.has(rec.fingerprint)) continue
    byFp.set(rec.fingerprint, rec)
    out.push(rec)
  }
  const appended = []
  const merged = []
  for (const cand of Array.isArray(candidates) ? candidates : []) {
    const rec = normalizeLessonRecord(cand, policy)
    if (!rec) continue
    const hit = byFp.get(rec.fingerprint)
    if (hit) {
      hit.count += 1
      hit.lastAt = rec.lastAt || new Date().toISOString()
      hit.evidence = mergeEvidence(hit.evidence, rec.evidence)
      if (!hit.ticket && rec.ticket) hit.ticket = rec.ticket
      if (!hit.commit && rec.commit) hit.commit = rec.commit
      merged.push(rec.fingerprint)
      continue
    }
    const fresh = { ...rec, count: 1 }
    byFp.set(fresh.fingerprint, fresh)
    out.push(fresh)
    appended.push(fresh.fingerprint)
  }
  const evicted = []
  while (out.length > max) {
    const gone = out.shift()
    byFp.delete(gone.fingerprint)
    evicted.push(gone.fingerprint)
  }
  return { records: out, appended, merged, evicted }
}

function markdownCell(value) {
  return String(value ?? '')
    .replace(/\r?\n/g, ' ')
    .replace(/\|/g, '\\|')
}

function evidenceText(record) {
  const e = record?.evidence && typeof record.evidence === 'object' ? record.evidence : {}
  const buckets = Array.isArray(e.buckets) && e.buckets.length ? e.buckets : e.bucket ? [e.bucket] : []
  const shas = Array.isArray(e.shas) ? e.shas.filter(Boolean).slice(0, 3) : []
  const parts = []
  if (buckets.length) parts.push(`桶=${buckets.join(',')}`)
  if (shas.length) parts.push(`sha=${shas.join(',')}`)
  return parts.join(' ') || '-'
}

/** digest 人读摘要(纯函数,确定性排序:计数降序 → 最近降序 → 指纹序)。 */
export function formatLessonsDigest(records, policy, { generatedAt = new Date().toISOString() } = {}) {
  const maxEntries = Number(policy?.limits?.maxDigestEntries)
  const rows = [...(Array.isArray(records) ? records : [])].sort(
    (a, b) =>
      Number(b.count) - Number(a.count) ||
      String(b.lastAt ?? b.at).localeCompare(String(a.lastAt ?? a.at)) ||
      String(a.fingerprint).localeCompare(String(b.fingerprint)),
  )
  const shown = rows.slice(0, Number.isInteger(maxEntries) && maxEntries > 0 ? maxEntries : rows.length)
  const lines = [
    '# 教训摘要(自动生成,勿手改)',
    '',
    '> 单一真相源:`.ihui-agent/state/lessons.jsonl`(写回 = `node scripts/evolution-retro.mjs --apply`)。',
    '> 去重指纹 = 教训正文归一化后 sha256 前缀;重复只增计数不新增行。',
    `> 生成时间:${generatedAt} · 条目 ${rows.length}/${policy?.limits?.maxLessons ?? '?'}`,
    '',
    '| # | 计数 | 类型 | 教训 | 证据 | 首次 / 最近 |',
    '| --- | --- | --- | --- | --- | --- |',
  ]
  if (!shown.length) lines.push('| - | - | - | (空) | - | - |')
  shown.forEach((r, i) => {
    lines.push(
      `| ${i + 1} | ${Number(r.count) || 1} | ${markdownCell(r.kind)} | ${markdownCell(r.lesson)} | ${markdownCell(evidenceText(r))} | ${markdownCell(`${r.at || '-'} / ${r.lastAt || r.at || '-'}`)} |`,
    )
  })
  if (rows.length > shown.length)
    lines.push('', `> 共 ${rows.length} 条,仅列计数最高的前 ${shown.length} 条(上限 ${maxEntries})。`)
  return `${lines.join('\n')}\n`
}

function atomicWrite(target, text) {
  mkdirSync(dirname(resolve(target)), { recursive: true })
  const tmp = `${target}.tmp-${process.pid}`
  writeFileSync(tmp, text, 'utf8')
  renameSync(tmp, target)
}

/** 落盘腿:仅在有变化时写(新增/合并/淘汰),lessons 键控单行 + digest 派生重写。 */
export function applyLessonWriteback({
  policy,
  plan,
  lessonsPath,
  digestPath,
  write = atomicWrite,
} = {}) {
  const changed =
    plan.appended.length > 0 || plan.merged.length > 0 || plan.evicted.length > 0
  if (!changed) return { wrote: false, lessonsPath, digestPath, records: plan.records.length }
  write(lessonsPath, `${plan.records.map((r) => JSON.stringify(r)).join('\n')}\n`)
  write(digestPath, formatLessonsDigest(plan.records, policy))
  return { wrote: true, lessonsPath, digestPath, records: plan.records.length }
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

function positiveInt(v, fallback, name) {
  if (v === undefined || v === true) return fallback
  const n = Number(v)
  if (!Number.isInteger(n) || n <= 0) throw new RetroShapeError(`${name} 必须是正整数:「${v}」`)
  return n
}

function selfTest() {
  const checks = []
  const t = (name, fn) => {
    try {
      fn()
      checks.push({ name, ok: true })
    } catch (e) {
      checks.push({ name, ok: false, why: e?.message ?? String(e) })
    }
  }
  const now = Date.parse('2026-10-25T12:00:00.000Z')
  const at = (h) => new Date(now - h * 3600_000).toISOString()
  const row = (extra) => ({ v: 1, ts: at(1), action: 'rollback', failDims: ['web', 'llm'], reason: '门禁未过', sha: 'aaaaaaa', ...extra })

  t('桶键:维度顺序无关,reason 漂移不合新桶', () => {
    const a = bucketKeyOf(row({ failDims: ['web', 'llm'], reason: 'x' }))
    const b = bucketKeyOf(row({ failDims: ['llm', 'web'], reason: 'y' }))
    if (a !== b) throw new Error(`同病灶被拆桶:${a} vs ${b}`)
    if (!a.startsWith('rollback|')) throw new Error(`桶键形状错:${a}`)
  })
  t('成功出口不进归因', () => {
    if (bucketKeyOf({ action: 'pass', failDims: [] })) throw new Error('pass 不该有桶')
    if (bucketKeyOf({ action: 'auto-heal' })) throw new Error('未知出口不该有桶')
  })
  t('24h 窗外不计入', () => {
    const buckets = scanWindow([row({ ts: at(1) }), row({ ts: at(30) })], { now, windowHours: 24 })
    if (buckets.length !== 1 || buckets[0].count !== 1) throw new Error(`窗外未剔除:${JSON.stringify(buckets)}`)
  })
  t('达阈派遣、未达阈不派', () => {
    const two = scanWindow([row({ ts: at(1) }), row({ ts: at(2) })], { now, windowHours: 24 })
    if (planDispatch(two, [], { now }).dispatched.length !== 1) throw new Error('≥2 未派单')
    const one = scanWindow([row()], { now, windowHours: 24 })
    if (planDispatch(one, [], { now }).dispatched.length !== 0) throw new Error('1 次不该派单')
  })
  t('同桶 24h 内已派 ⇒ 去重', () => {
    const buckets = scanWindow([row({ ts: at(1) }), row({ ts: at(2) })], { now, windowHours: 24 })
    const key = buckets[0].key
    const ledger = [{ action: 'dispatched', bucket: key, ts: at(3) }]
    const plan = planDispatch(buckets, ledger, { now })
    if (plan.dispatched.length !== 0) throw new Error('已派过仍重复派')
    if (plan.skipped.length !== 1) throw new Error('去重未进 skipped')
    const stale = [{ action: 'dispatched', bucket: key, ts: at(30) }]
    if (planDispatch(buckets, stale, { now }).dispatched.length !== 1) throw new Error('窗外旧派单不该拦')
  })
  t('摘要 ≤8 行且不含换行污染', () => {
    const buckets = scanWindow([row({ ts: at(1) }), row({ ts: at(2) })], { now, windowHours: 24 })
    const plan = planDispatch(buckets, [], { now })
    const text = formatSummary(plan.dispatched, plan.skipped)
    const lines = text.split('\n')
    if (lines.length > MAX_SUMMARY_LINES) throw new Error(`摘要 ${lines.length} 行超限`)
    if (text.includes('\r')) throw new Error('摘要含 CR')
  })
  t('机器行单行可解析', () => {
    const buckets = scanWindow([row({ ts: at(1) }), row({ ts: at(2) })], { now, windowHours: 24 })
    const it = planDispatch(buckets, [], { now }).dispatched[0]
    const line = formatDispatchLine(it)
    if (!line.startsWith('EVOLUTION-RETRO ')) throw new Error('前缀错')
    if (line.includes('\n')) throw new Error('机器行含换行')
    const obj = JSON.parse(line.slice('EVOLUTION-RETRO '.length))
    if (obj.bucket !== it.bucket || obj.count !== 2) throw new Error('机器行字段丢')
  })

  const policy = loadLessonPolicy(readFileSync(DEFAULT_POLICY, 'utf8'))
  t('教训指纹:归一化后同文同指纹、异文异指纹', () => {
    const a = fingerprintOf('  门禁 未过\r\n', policy)
    const b = fingerprintOf('门禁 未过', policy)
    if (a !== b) throw new Error(`同文异指纹:${a} vs ${b}`)
    if (a === fingerprintOf('门禁 已过', policy)) throw new Error('异文同指纹')
    if (!new RegExp(`^[a-f0-9]{${policy.fingerprint.length}}$`).test(a))
      throw new Error(`指纹形状错:${a}`)
  })
  t('教训去重:同指纹只增计数不新增行', () => {
    const cand = lessonCandidateOf(
      { bucket: 'rollback|llm+web', action: 'rollback', dims: ['llm', 'web'], count: 2, lastTs: at(1), shas: ['aaaaaaa'], sampleReason: '门禁未过', windowHours: 24 },
      { now, policy },
    )
    const plan = mergeLessons([{ ...cand, count: 1, lastAt: at(1) }], [cand], policy)
    if (plan.records.length !== 1) throw new Error(`同指纹新增了行:${plan.records.length}`)
    if (plan.records[0].count !== 2) throw new Error(`计数未增:${plan.records[0].count}`)
    if (plan.appended.length !== 0 || plan.merged.length !== 1) throw new Error('新增/合并分桶错')
    for (const k of ['at', 'fingerprint', 'kind', 'lesson', 'evidence', 'ticket', 'commit'])
      if (!(k in plan.records[0])) throw new Error(`台账字段缺 ${k}`)
  })
  t('条数上限:超限淘汰最旧条目', () => {
    const small = { ...policy, limits: { ...policy.limits, maxLessons: 2 } }
    const mk = (text, h) => lessonCandidateOf({ bucket: text, action: 'rollback', dims: [], count: 2, lastTs: at(h), shas: [], sampleReason: text, windowHours: 24 }, { now, policy: small })
    const plan = mergeLessons([], [mk('甲', 3), mk('乙', 2), mk('丙', 1)], small)
    if (plan.records.length !== 2) throw new Error(`上限未生效:${plan.records.length}`)
    if (plan.evicted.length !== 1) throw new Error(`淘汰未报数:${plan.evicted.length}`)
  })
  t('白名单:AGENTS.md / 护栏清单 / 沙箱外目标一律拒写', () => {
    const bad = ['AGENTS.md', 'PROJECT_PLAN.md', 'scripts/data/root-guard-manifest.json', 'scripts/evolution-retro.mjs', './.ihui-agent/../../AGENTS.md']
    let blocked = 0
    for (const target of bad) {
      try {
        assertWritableTarget({ kind: 'lessons', override: target, policy })
      } catch {
        blocked += 1
      }
    }
    if (blocked !== bad.length) throw new Error(`应拦 ${bad.length} 条,实拦 ${blocked}`)
    const okPath = assertWritableTarget({ kind: 'lessons', policy })
    if (!okPath.replace(/\\/g, '/').endsWith('.ihui-agent/state/lessons.jsonl'))
      throw new Error(`默认目标解析错:${okPath}`)
  })
  t('digest:带计数、确定序、受条数上限约束', () => {
    const mk = (text, count) => lessonCandidateOf(
      { bucket: text, action: 'build-fail', dims: [], count, lastTs: at(1), shas: ['bbbbbbb'], sampleReason: text, windowHours: 24 },
      { now, policy },
    )
    const cand = mk('构建失败', 3)
    const plan = mergeLessons([{ ...cand, count: 1, lastAt: at(1) }], [cand, mk('健康门禁未过', 2)], policy)
    const text = formatLessonsDigest(plan.records, policy, { generatedAt: '2026-10-25T00:00:00.000Z' })
    if (!text.includes('| 1 | 2 |')) throw new Error('计数未进 digest')
    if (text.includes('\r')) throw new Error('digest 含 CR')
    const again = formatLessonsDigest(plan.records, policy, { generatedAt: '2026-10-25T00:00:00.000Z' })
    if (text !== again) throw new Error('digest 非同输入同输出')
    const capped = formatLessonsDigest(plan.records, { ...policy, limits: { ...policy.limits, maxDigestEntries: 1 } }, { generatedAt: '2026-10-25T00:00:00.000Z' })
    if (capped.split('\n').filter((l) => /^\| \d+ \|/.test(l)).length !== 1)
      throw new Error(`digest 上限未生效:${capped}`)
    if (!capped.includes('仅列计数最高的前 1 条')) throw new Error('digest 截断未标注')
  })

  for (const c of checks) console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name}${c.ok ? '' : ` — ${c.why}`}`)
  const bad = checks.filter((c) => !c.ok)
  console.log(`# self-test ${checks.length - bad.length}/${checks.length}`)
  return bad.length === 0 ? 0 : 1
}

function main(argv) {
  const args = parseArgs(argv)
  if (args['self-test']) return selfTest()
  let windowHours
  let minCount
  try {
    windowHours = positiveInt(args['window-hours'], DEFAULT_WINDOW_HOURS, 'window-hours')
    minCount = positiveInt(args['min-count'], DEFAULT_MIN_COUNT, 'min-count')
  } catch (e) {
    console.error(`❌ ${e.message}`)
    return 2
  }
  const decisionsPath = asText(args.decisions) || DEFAULT_DECISIONS
  const ledgerPath = asText(args.ledger) || DEFAULT_LEDGER
  const policyPath = asText(args.policy) || DEFAULT_POLICY
  const applyWriteback = Boolean(args.apply)
  const now = Date.now()

  const undetermined = (why) => {
    if (args.json) console.log(JSON.stringify({ v: SCHEMA_VERSION, overall: 'undetermined', why }))
    else console.log(`❓ 进化回流:未判定 —— ${why}`)
    return 2
  }

  if (applyWriteback && args['dry-run'])
    return undetermined('--apply 与 --dry-run 互斥(前者要落盘、后者明确不落盘)')

  if (!existsSync(decisionsPath))
    return undetermined(`决策台账不存在(部署环尚未产生过决策):${decisionsPath}`)

  let decisions
  try {
    decisions = readDecisions(decisionsPath)
  } catch (e) {
    return undetermined(`决策台账读不了:${e?.message ?? e}`)
  }

  let policy
  try {
    policy = loadLessonPolicy(readFileSync(policyPath, 'utf8'))
  } catch (e) {
    return undetermined(`教训写回策略读不了或形状坏(${policyPath}):${e?.message ?? e}`)
  }

  let lessonsPath
  let digestPath
  try {
    lessonsPath = assertWritableTarget({ kind: 'lessons', override: args.lessons, policy })
    digestPath = assertWritableTarget({ kind: 'digest', override: args.digest, policy })
  } catch (e) {
    return undetermined(`教训写回目标不可写:${e?.message ?? e}`)
  }

  const stored = readLessons({ lessonsPath })
  if (!stored.ok) return undetermined(stored.why)

  const buckets = scanWindow(decisions, { now, windowHours })
  const plan = planDispatch(buckets, readRetroLedger(undefined, ledgerPath), { now, windowHours, minCount })

  if (!args['dry-run']) {
    for (const it of plan.dispatched) appendRetro(ledgerPath, it)
  }

  const candidates = plan.dispatched.map((it) =>
    lessonCandidateOf(it, {
      now,
      policy,
      ticket: typeof args.ticket === 'string' ? args.ticket : '',
      commit: typeof args.commit === 'string' ? args.commit : '',
    }),
  )
  const writeback = mergeLessons(stored.records, candidates, policy)
  const wrote = applyWriteback
    ? applyLessonWriteback({ policy, plan: writeback, lessonsPath, digestPath })
    : null
  const relOf = (p) => relative(ROOT, p).replace(/\\/g, '/')

  if (args.json) {
    console.log(JSON.stringify({
      v: SCHEMA_VERSION,
      overall: plan.dispatched.length ? 'dispatch' : 'clean',
      windowHours,
      minCount,
      decisions: decisions.length,
      buckets: buckets.map((b) => ({ bucket: b.key, count: b.count, lastTs: b.lastTs })),
      dispatched: plan.dispatched,
      skipped: plan.skipped,
      writeback: {
        applied: applyWriteback,
        wrote: Boolean(wrote?.wrote),
        candidates: candidates.length,
        appended: writeback.appended,
        merged: writeback.merged,
        evicted: writeback.evicted,
        records: writeback.records.length,
        lessons: relOf(lessonsPath),
        digest: relOf(digestPath),
      },
    }))
  } else {
    console.log(`进化回流:窗内失败桶 ${buckets.length} 个 / 决策行 ${decisions.length} 条(窗 ${windowHours}h,阈 ${minCount})`)
    for (const it of plan.dispatched) console.log(formatDispatchLine(it))
    for (const it of plan.skipped) console.log(`↻ 跳过派单(24h 内已派):${it.bucket} ×${it.count}`)
    const summary = formatSummary(plan.dispatched, plan.skipped, minCount)
    if (summary) console.log(`\n${summary}`)
    if (!plan.dispatched.length && !plan.skipped.length) console.log('✅ 无复发归因(窗内没有 ≥阈 的失败桶)')
    const wbLine = `教训写回:候选 ${candidates.length} / 新增 ${writeback.appended.length} / 合并 ${writeback.merged.length} / 淘汰 ${writeback.evicted.length}`
    if (wrote?.wrote) console.log(`${wbLine} → 已落盘 ${relOf(lessonsPath)} + ${relOf(digestPath)}`)
    else if (applyWriteback) console.log(`${wbLine}(无变化,未落盘)`)
    else console.log(`${wbLine}(未加 --apply:仅预览,不写盘)`)
    if (args['dry-run']) console.log('(dry-run:未写去重台账)')
  }
  return 0
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  process.exit(main(process.argv.slice(2)))
}

export const __test__ = {
  bucketKeyOf,
  sampleOf,
  scanWindow,
  readRetroLedger,
  recentlyDispatched,
  planDispatch,
  formatDispatchLine,
  formatSummary,
  appendRetro,
  normalizeLessonText,
  fingerprintOf,
  loadLessonPolicy,
  assertWritableTarget,
  lessonCandidateOf,
  readLessons,
  mergeLessons,
  formatLessonsDigest,
  applyLessonWriteback,
  DEFAULT_DECISIONS,
  DEFAULT_LEDGER,
  DEFAULT_POLICY,
  MAX_SUMMARY_LINES,
  DEFAULT_MIN_COUNT,
  DEFAULT_WINDOW_HOURS,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
