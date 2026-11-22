// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * feedback-loop — 端到端反馈闭环的判据层(纯函数,零 IO)。
 *
 * 本票边界(台账无编号行「端到端反馈闭环」,2026-10-26 立):
 *  - 「监控异常 → 自动建单/派单」:本器只**消费仓内既有只读尺子的产出**(源清单唯一真相源
 *    `scripts/data/feedback-loop-sources.json`),聚成候选并产出**可直接喂给 live-doc-edit 的登记块文本**;
 *    本器**不写 PROJECT_PLAN.md**(落地权归主席/唯一登记入口 live-doc-edit)。
 *  - 「过门」:只做「该候选应归哪道门 / 是否已无出口」的判定与点名,**不改判据、不改注册表**;
 *    门清单取现 reader `scripts/gate-grow.mjs` 的 readRegistry(§0.6 不写第二份解析)。
 *  - 「部署后指标比对」:**只读**比对尺子;任一侧取不到 ⇒ undetermined,绝不冒绿(§0.3)。
 *  - 明确不做:自动部署、自动回滚、自动改代码(生产机面,本机无权)——三格写进报告交主席。
 *
 * 失效方向纪律(§0.10):未知源 / 读不出 / 已过期 / 命中 0 道门 ⇒ 一律点名并落 undetermined/no-exit,
 * 不得静默跳过,也不得把「读不到」当成「无异常」。
 */

import { sanitizeHexRuns } from './triage-doc-line.mjs'

export const SCHEMA_VERSION = 1
export const SOURCES_REL = 'scripts/data/feedback-loop-sources.json'
export const KINDS = Object.freeze(['json', 'jsonl', 'command'])
export const TICKET_STATUSES = Object.freeze(['dispatchable', 'observe', 'no-exit', 'undetermined'])
export const GATE_STATES = Object.freeze(['matched', 'no-exit', 'undetermined'])
export const METRIC_STATES = Object.freeze(['improved', 'worsened', 'flat', 'undetermined'])

export class FeedbackLoopShapeError extends Error {}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/

/** 源清单校验:形状坏 ⇒ 抛(调用方落 exit 2);reviewBy 到期 ⇒ 只点名不剔源(§0.7 到期要响) */
export function loadSources({ text, now = new Date() } = {}) {
  if (typeof text !== 'string' || text.trim() === '') {
    throw new FeedbackLoopShapeError(
      `源清单读不到或空文本(${SOURCES_REL}):不得当成「没有输入源」记绿`,
    )
  }
  let raw
  try {
    raw = JSON.parse(text)
  } catch (e) {
    throw new FeedbackLoopShapeError(`源清单非法 JSON(${SOURCES_REL}):${e?.message ?? e}`)
  }
  if (!Array.isArray(raw.sources) || raw.sources.length === 0) {
    throw new FeedbackLoopShapeError('形状坏:sources 必须是非空数组')
  }
  const seen = new Set()
  const problems = []
  const sources = []
  for (const [i, s] of raw.sources.entries()) {
    if (!s || typeof s !== 'object' || Array.isArray(s)) {
      throw new FeedbackLoopShapeError(`形状坏:sources[${i}] 必须是对象`)
    }
    const id = typeof s.id === 'string' ? s.id : ''
    if (!id) throw new FeedbackLoopShapeError(`形状坏:sources[${i}] 缺 id`)
    if (seen.has(id)) problems.push({ id, why: '重复登记 id(后一份被忽略,清单腐烂)' })
    seen.add(id)
    if (!KINDS.includes(s.kind)) {
      problems.push({
        id,
        why: `未知 kind「${String(s.kind)}」(闭集 ${KINDS.join('/')})⇒ 该源不采集`,
      })
      continue
    }
    const hasPath = typeof s.path === 'string' && s.path !== ''
    const hasCmd = Array.isArray(s.command) && s.command.length > 0
    if (s.kind === 'command' ? !hasCmd : !hasPath) {
      problems.push({
        id,
        why: `kind=${s.kind} 却缺 ${s.kind === 'command' ? 'command' : 'path'} ⇒ 该源不采集`,
      })
      continue
    }
    if (hasPath && hasCmd)
      problems.push({ id, why: 'path 与 command 同时给出 ⇒ 该源不采集(取材面必须唯一)' })
    if (hasPath && hasCmd) continue
    if (typeof s.why !== 'string' || [...s.why].length < 10) {
      problems.push({
        id,
        why: '缺 ≥10 码点的定向说明 why ⇒ 该源不采集(§0.10 失效方向是多要一次说明)',
      })
      continue
    }
    if (typeof s.reviewBy !== 'string' || !ISO_DAY.test(s.reviewBy)) {
      problems.push({
        id,
        why: `reviewBy 形态坏「${String(s.reviewBy)}」(须 YYYY-MM-DD)⇒ 该源不采集`,
      })
      continue
    }
    const expMs = Date.parse(`${s.reviewBy}T23:59:59Z`)
    if (Number.isFinite(expMs) && expMs < now.getTime()) {
      problems.push({
        id,
        why: `清单腐烂:reviewBy=${s.reviewBy} 已到期(源仍采集,但必须点名让人重裁,§0.7)`,
      })
    }
    sources.push(s)
  }
  const horizonHours =
    Number.isInteger(raw.horizonHours) && raw.horizonHours > 0 ? raw.horizonHours : 72
  return { sources, problems, horizonHours, gateHintsNote: raw.gateHintsNote ?? '' }
}

/** 按 pick 数组取嵌套值(纯函数;取不到 ⇒ undefined,不猜) */
export function pickPath(obj, pick = []) {
  let cur = obj
  for (const k of pick) {
    if (cur === null || typeof cur !== 'object') return undefined
    cur = cur[k]
  }
  return cur
}

function textOf(v) {
  if (typeof v === 'string') return v
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  if (v && typeof v === 'object') {
    try {
      return JSON.stringify(v)
    } catch {
      return ''
    }
  }
  return ''
}

/** 时间地平线单源:信号采集与指标投影共用这一把尺(§0.6 不写第二份) */
function withinWindow(row, now, windowMs) {
  const ts = Date.parse(String(row?.ts ?? row?.at ?? ''))
  if (!Number.isFinite(ts)) return false
  return now.getTime() - ts <= windowMs
}

function firstField(obj, keys = []) {
  for (const k of keys) {
    const v = pickPath(obj, [k])
    if (v !== undefined && v !== null && textOf(v) !== '') return textOf(v)
  }
  return ''
}

/**
 * 从单个源的读数聚出信号(纯函数,零 IO)。
 * payload: json ⇒ 对象 | jsonl ⇒ 行对象数组 | command ⇒ {stdout}
 * 返回 { signals, undetermined(原因|null) };枚举到 0 条不判死(源绿就是绿),
 * 但读数缺失/形状坏 ⇒ undetermined 点名(§0.3)。
 */
export function collectSignals(source, payload, { now = new Date(), horizonHours = 72 } = {}) {
  if (!source || typeof source !== 'object') return { signals: [], undetermined: '源定义缺失' }
  if (payload === undefined || payload === null) {
    return { signals: [], undetermined: `${source.id}:读数取不到(源不存在/命令失败/JSON 坏)` }
  }
  if (source.signals === false) return { signals: [], undetermined: null }
  const signals = []
  const windowMs = horizonHours * 3600_000
  const inWindow = (row) => withinWindow(row, now, windowMs)

  if (source.kind === 'jsonl') {
    if (!Array.isArray(payload))
      return { signals: [], undetermined: `${source.id}:jsonl 读数不是行数组` }
    const want =
      source.whereEquals && typeof source.whereEquals === 'object' ? source.whereEquals : null
    const fresh = payload.filter((r) => (want ? inWindow(r) : true))
    for (const row of fresh) {
      if (!row || typeof row !== 'object') continue
      if (want && Object.entries(want).some(([k, v]) => row[k] !== v)) continue
      const detail = firstField(row, source.signalDetail ?? ['why', 'detail'])
      if (detail === '') continue
      signals.push({
        sourceId: source.id,
        id: firstField(row, source.signalId ?? ['id']) || source.id,
        detail: detail.slice(0, 220),
        domain: row.source ?? source.id,
        at: row.ts ?? row.at ?? null,
      })
    }
    return { signals, undetermined: null }
  }

  if (source.kind === 'command') {
    const out = typeof payload?.stdout === 'string' ? payload.stdout : ''
    if (out.trim() === '') return { signals: [], undetermined: `${source.id}:命令无输出` }
    return { signals: [], undetermined: null, raw: out }
  }

  // kind === 'json'
  if (typeof payload !== 'object' || Array.isArray(payload)) {
    return { signals: [], undetermined: `${source.id}:json 读数不是对象` }
  }
  if (Array.isArray(payload.findings)) {
    for (const f of payload.findings) {
      const detail = firstField(f, source.signalDetail ?? ['detail'])
      if (detail === '') continue
      signals.push({
        sourceId: source.id,
        id: firstField(f, source.signalId ?? ['id']) || source.id,
        detail: detail.slice(0, 220),
        domain: source.id,
        at: payload.at ?? null,
      })
    }
  }
  if (
    source.nestedDims &&
    payload[source.nestedDims] &&
    typeof payload[source.nestedDims] === 'object'
  ) {
    for (const [dim, v] of Object.entries(payload[source.nestedDims])) {
      const verdict = v && typeof v === 'object' ? v.verdict : undefined
      if (typeof verdict !== 'string') continue
      if (source.verdictNotOk && verdict === 'ok') continue
      signals.push({
        sourceId: source.id,
        id: `${source.id}:${dim}`,
        detail: `${dim} verdict=${verdict}`.slice(0, 220),
        domain: source.id,
        at: payload.at ?? null,
      })
    }
  }
  if (source.whereNotEquals && typeof payload === 'object' && !Array.isArray(payload)) {
    const hit = Object.entries(source.whereNotEquals).some(
      ([k, v]) => payload[k] === undefined || payload[k] !== v,
    )
    if (hit) {
      const detail = firstField(payload, source.signalDetail ?? ['detail'])
      signals.push({
        sourceId: source.id,
        id: firstField(payload, source.signalId ?? ['state']) || source.id,
        detail: (detail || `${source.id} 读数≠期望档`).slice(0, 220),
        domain: source.id,
        at: payload.at ?? payload.ts ?? null,
      })
    }
  }
  if (source.whereEquals && typeof payload === 'object' && !Array.isArray(payload)) {
    const hit = Object.entries(source.whereEquals).every(([k, v]) => payload[k] === v)
    if (hit) {
      const detail = firstField(payload, source.signalDetail ?? ['detail'])
      signals.push({
        sourceId: source.id,
        id: firstField(payload, source.signalId ?? ['state']) || source.id,
        detail: (detail || `${source.id} 命中条件`).slice(0, 220),
        domain: source.id,
        at: payload.at ?? payload.ts ?? null,
      })
    }
  }
  return { signals, undetermined: null }
}

/** 源清单声明的 metrics 维投影成 { 指标名: 数值|null }(比对尺子的唯一取值实现,两侧同基准) */
export function projectMetrics(source, payload, { now = new Date(), horizonHours = 72 } = {}) {
  const rows = Array.isArray(source?.metrics) ? source.metrics : []
  const out = {}
  if (payload === undefined || payload === null) {
    for (const m of rows) out[m.name] = null
    return out
  }
  const windowMs = horizonHours * 3600_000
  const inWindow = (row) => withinWindow(row, now, windowMs)
  for (const m of rows) {
    let v
    if (m.countMatches && typeof m.countMatches === 'object' && !Array.isArray(m.countMatches)) {
      const arr = Array.isArray(payload) ? payload : []
      // 与 collectSignals 同一条地平线:窗外旧行不计入读数(否则"24h 内失败数"会读成全量)
      v = arr.filter(
        (r) =>
          r &&
          Object.entries(m.countMatches).every(([k, val]) => r[k] === val) &&
          (source.kind !== 'jsonl' || inWindow(r)),
      ).length
    } else if (Array.isArray(m.pick)) {
      const got = pickPath(payload, m.pick)
      // numericMap 未命中 ⇒ null(未判定),绝不落成 0 冒充「数值为零」(§0.3)
      if (m.numericMap && typeof m.numericMap === 'object')
        v = typeof got === 'string' ? (m.numericMap[got] ?? null) : null
      else v = typeof got === 'number' ? got : null
    } else v = null
    out[m.name] = Number.isFinite(v) ? v : null
  }
  void now
  return out
}

/** 稳定指纹:源 + 归一后的信号正文(数字/长 hex 折掉,防同型异常各记一枚) */
export function fingerprintOf(signal) {
  const norm = `${signal.sourceId}|${String(signal.detail)
    .replace(/\d+/g, '#')
    .replace(/[0-9a-f]{8,}/gi, '#')
    .slice(0, 120)}`
  let h = 5381
  for (let i = 0; i < norm.length; i++) h = ((h << 5) + h + norm.charCodeAt(i)) >>> 0
  return `fl${h.toString(36)}`
}

/**
 * 过门段判定:该候选应归哪道门 / 是否已无出口。
 * registry ⇒ [{ id, script }](由调用方经 gate-grow 的 readRegistry 现读;取不到 ⇒ undetermined)
 * 命中 0 道 ⇒ no-exit(点名「该候选在提交链上没有出口」),绝不为了变绿去放宽关键词。
 */
export function matchGate(signal, registry, sources = []) {
  if (!signal || typeof signal !== 'object')
    return { state: 'undetermined', gates: [], why: '信号缺失' }
  if (!Array.isArray(registry)) {
    return {
      state: 'undetermined',
      gates: [],
      why: '守门注册表取不到 ⇒ 不判「无出口」也不判「有出口」(§0.3)',
    }
  }
  if (registry.length === 0) {
    return { state: 'undetermined', gates: [], why: '守门注册表枚举到 0 条 ⇒ 判死,不记绿' }
  }
  const src = sources.find((s) => s.id === signal.sourceId)
  // 分级匹配:gateHints 是**点名用的检索键**,只许撞 script 名(撞 label 会把
  // "public/service" 这类通用词打成一片假出口 —— 实测 202 号门因标签含
  // EXPO_PUBLIC_API_BASE_URL 被 'public' 误命中,故 hints 只按脚本名判);
  // 域名/源 id 才允许兼顾标签(找"这一族"的门)。
  const hintKeys = [
    ...new Set(
      (src?.gateHints ?? []).map((h) => String(h).toLowerCase()).filter((h) => h.length >= 3),
    ),
  ]
  const looseKeys = [
    ...new Set(
      [String(signal.domain ?? ''), String(signal.sourceId ?? '')].filter((h) => h.length >= 3),
    ),
  ]
  if (hintKeys.length === 0 && looseKeys.length === 0) {
    return { state: 'no-exit', gates: [], why: '该源未登记 gateHints 且无可检索域名' }
  }
  const gates = registry
    .filter((e) => {
      const script = String(e?.script ?? '').toLowerCase()
      const label = String(e?.label ?? '').toLowerCase()
      return (
        hintKeys.some((k) => script.includes(k)) ||
        looseKeys.some((k) => script.includes(k) || label.includes(k))
      )
    })
    .slice(0, 6)
    .map((e) => ({ id: e.id, script: e.script }))
  if (gates.length === 0) {
    const keys = [...hintKeys, ...looseKeys]
    return {
      state: 'no-exit',
      gates: [],
      why: `关键词 ${keys.slice(0, 4).join('/')} 在注册表 ${registry.length} 条里 0 命中 ⇒ 本仓没有对应出口`,
    }
  }
  return {
    state: 'matched',
    gates,
    why: `命中 ${gates.length} 道(检索键 ${[...hintKeys, ...looseKeys].slice(0, 3).join('/')})`,
  }
}

/**
 * 建单/派单段:把一条信号折成「可直接喂给 live-doc-edit 的登记块」。
 * 块形 = `- [ ] {{NEXT_ID:G}} [feedback-loop] 标题(登记@日/席;来源:…;门:…)`,
 * 取号令牌交 live-doc-edit 现算(本器不自拼号,§1);行内不留裸 hex 指纹(守门 117)。
 */
export function buildLoopTicket(
  signal,
  {
    gate = { state: 'undetermined', gates: [], why: '未判' },
    now = new Date(),
    seat = 'feedback-loop',
  } = {},
) {
  if (!signal || typeof signal !== 'object' || !signal.sourceId) {
    throw new FeedbackLoopShapeError('buildLoopTicket:信号缺 sourceId')
  }
  const day = now.toISOString().slice(0, 10)
  const plain = String(signal.detail).replace(/\s+/g, ' ').trim()
  const short = [...plain].slice(0, 88).join('')
  // 信号 id 若已自带 `源id:` 前缀(dims 类源就是这么造的)则剥掉,免得票面把源名写两遍
  const rawId = String(signal.id ?? '')
  const tidyId = rawId.startsWith(`${signal.sourceId}:`)
    ? rawId.slice(signal.sourceId.length + 1)
    : rawId
  const title = `${signal.sourceId}/${tidyId}:${short}`
  const gateFace =
    gate.state === 'matched'
      ? `门 ${gate.gates.map((g) => `${g.id}:${g.script}`).join('+')}`
      : gate.state === 'no-exit'
        ? `无出口(${gate.why})`
        : `未判定(${gate.why})`
  const line = sanitizeHexRuns(
    `- [ ] {{NEXT_ID:G}} [feedback-loop] ${title}(登记@${day}/${seat};来源:${signal.sourceId};${gateFace})`,
  )
  const status =
    gate.state === 'matched'
      ? 'dispatchable'
      : gate.state === 'no-exit'
        ? 'no-exit'
        : 'undetermined'
  return {
    fingerprint: fingerprintOf(signal),
    status,
    title,
    line,
    block: `${line}\n`,
    gate,
    why: `信号来自 ${signal.sourceId}(${String(signal.at ?? '时刻未知')})|${gate.why}`,
  }
}

/**
 * 部署后指标比对尺子(只读)。before/after 同为 { 指标名: 数值|null }。
 * 任一侧非对象/全 null ⇒ undetermined;单指标缺值 ⇒ 该行 undetermined,不并桶、不冒绿。
 * lowerIsBetter:数值越低越好的指标名数组(默认空)。tolerance 比例内算 flat。
 */
export function compareMetrics(before, after, { lowerIsBetter = [], tolerance = 0.02 } = {}) {
  const ok = (v) => v !== null && typeof v === 'number' && Number.isFinite(v)
  if (!before || typeof before !== 'object' || !after || typeof after !== 'object') {
    return {
      state: 'undetermined',
      rows: [],
      why: '前后任一侧读数取不到 ⇒ 未判定(§0.3 不记绿也不冒红)',
    }
  }
  const names = [...new Set([...Object.keys(before), ...Object.keys(after)])]
  if (names.length === 0)
    return { state: 'undetermined', rows: [], why: '两侧指标集为空 ⇒ 无采集面,未判定' }
  const rows = names.map((name) => {
    const b = before[name]
    const a = after[name]
    if (!ok(b) || !ok(a)) {
      return {
        name,
        before: ok(b) ? b : null,
        after: ok(a) ? a : null,
        delta: null,
        verdict: 'undetermined',
      }
    }
    const delta = a - b
    const base = Math.abs(b) > 0 ? Math.abs(b) : 1
    if (Math.abs(delta) / base <= tolerance)
      return { name, before: b, after: a, delta, verdict: 'flat' }
    const worse = lowerIsBetter.includes(name) ? delta > 0 : delta < 0
    return { name, before: b, after: a, delta, verdict: worse ? 'worsened' : 'improved' }
  })
  const judged = rows.filter((r) => r.verdict !== 'undetermined')
  if (judged.length === 0) return { state: 'undetermined', rows, why: '全部指标单侧缺值 ⇒ 未判定' }
  const state = judged.some((r) => r.verdict === 'worsened')
    ? 'worsened'
    : judged.every((r) => r.verdict === 'flat')
      ? 'flat'
      : 'improved'
  const undRows = rows.length - judged.length
  return {
    state,
    rows,
    why: `判定 ${state}(可比 ${judged.length}/${rows.length}${undRows > 0 ? `;未判定 ${undRows} 条` : ''})`,
  }
}

/**
 * 多源指标折成一张可比对的快照:键 = `<源id>.<指标名>`(跨源不撞名、不并桶)。
 * 入参形如 [{ id, metrics: { 指标名: 数值|null } }];缺源 ⇒ 该键不出现(比对侧落 undetermined)。
 */
export function snapshotMetrics(bySource = []) {
  const out = {}
  for (const s of bySource) {
    if (!s || typeof s.id !== 'string' || !s.metrics || typeof s.metrics !== 'object') continue
    for (const [k, v] of Object.entries(s.metrics)) {
      out[`${s.id}.${k}`] = Number.isFinite(v) ? v : null
    }
  }
  return out
}

export const __test__ = {
  loadSources,
  collectSignals,
  projectMetrics,
  matchGate,
  buildLoopTicket,
  compareMetrics,
  fingerprintOf,
  snapshotMetrics,
  pickPath,
  SCHEMA_VERSION,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
