#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 只读审计报告,grep 行必须走 stdout/stderr */
/**
 * audit-decision-chain — 可审计决策链(只读)。
 *
 * 缺口(2026-10-25 立):无人状态下"为什么这么改"散在三本 jsonl 里 —— 自进化派发台账有票面与
 * why、提交门台账有门读数与 landedSha、部署决策台账有回滚理由,但**没有一处**能按票或按提交
 * 把它们串成"改了什么 → 为什么 → 谁/哪张票 → 过了哪些门 → 落到哪个提交"。事后复盘只能靠人
 * 对照三份原始 JSON,而"对不上"时也说不清断在哪一环。
 *
 * 形态纪律:
 *  - 台账路径与语义字段映射的**唯一真相源** = `scripts/data/decision-chain-sources.json`,
 *    本脚本不另写一份字段表(§22c);
 *  - 只读:不写任何台账、不做 git 写操作、不改工作树;唯一写盘路径在 `--self-test` 的仓内
 *    夹具 `.ihui-agent/tmp/`(§26,不用 os.tmpdir);
 *  - 三态:源文件不存在 / 读不出 / 坏行 ⇒ 逐源点名"未判定",绝不折成"0 条 = 没问题";
 *  - 输出必带「理由来源」(票面/票号/why/门读数);任一环取不到 ⇒ 逐条打印"链路断在「X」"。
 *
 * 用法:
 *   node scripts/audit-decision-chain.mjs --ticket <票号|票面片段|16 位 ticketKey> [--since <ISO>] [--until <ISO>] [--json]
 *   node scripts/audit-decision-chain.mjs --commit <40 位 sha> [--json]
 *   node scripts/audit-decision-chain.mjs --since <ISO> [--until <ISO>] [--json]
 *   node scripts/audit-decision-chain.mjs --self-test
 * 退出码:0 = 报告已产出(断链也照出);1 = --self-test 有失败例;2 = 输入缺失/非法或三源全部未判定。
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { requireFlagValue } from './lib/flag-value.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
export const SOURCES_PATH = join(HERE, 'data', 'decision-chain-sources.json')
const MAX_TEXT = 400
const FULL_SHA_RE = /^[0-9a-f]{40}$/
const EPOCH_MS_FLOOR = 1e11

export class InputError extends Error {}

function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key)
}

/** 语义槽取值:按候选键优先级取第一个非空值(空串/空数组/null 都算没取到)。 */
export function pickSlot(raw, keys) {
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

/** 统一成单行文本;数组折成 `a, b`;对象保留 JSON 形态(便于机器追溯),超长截断。 */
export function textOf(v, max = MAX_TEXT) {
  if (v === null || v === undefined) return ''
  let s
  if (Array.isArray(v)) s = v.map((x) => textOf(x, max)).filter(Boolean).join(', ')
  else if (typeof v === 'object') s = JSON.stringify(v)
  else s = String(v)
  s = s.replace(/\s+/g, ' ').trim()
  return s.length > max ? `${s.slice(0, max)}…` : s
}

/**
 * 时间归一:ISO 串 / 毫秒 / 秒级 epoch 都收;解不出一律 null(调用方按"未判定"处理,不猜)。
 * 阈值 1e11:13 位毫秒(2003 起)落毫秒臂,10 位秒级落秒臂 —— 两条臂不会互相吞。
 */
export function normalizeAt(v) {
  if (typeof v === 'number' && Number.isFinite(v) && v > 0) {
    const ms = v > EPOCH_MS_FLOOR ? v : v * 1000
    const d = new Date(ms)
    return Number.isFinite(d.getTime()) ? d.toISOString() : null
  }
  const s = typeof v === 'string' ? v.trim() : ''
  if (!s) return null
  if (/^\d{10,}$/.test(s)) return normalizeAt(Number(s))
  const t = Date.parse(s)
  return Number.isFinite(t) ? new Date(t).toISOString() : null
}

export function isFullSha(v) {
  return typeof v === 'string' && FULL_SHA_RE.test(v.trim().toLowerCase())
}

/**
 * 提交指针归一:40 位才可追责(AGENTS §1 禁止短 sha 当证据指针);短 sha / 非十六进制
 * 保留原文并打 `full:false`,让断点能点名"只有短 sha"而不是静默丢失。
 */
export function normalizeCommit(v) {
  const s = textOf(v, 64).toLowerCase()
  if (!s) return null
  if (!/^[0-9a-f]+$/.test(s)) return { sha: s, full: false, why: '非十六进制提交指针' }
  return s.length === 40 ? { sha: s, full: true, why: '' } : { sha: s, full: false, why: `短 sha(${s.length} 位)` }
}

/** 门读数:把该源登记的字段原样摊平成 `k=v; k=v`;一个字段都没有 ⇒ null(断点)。 */
export function gateReadoutOf(raw, keys) {
  const parts = []
  for (const key of keys || []) {
    if (!hasOwn(raw, key)) continue
    const v = raw[key]
    if (v === null || v === undefined || v === '') continue
    if (Array.isArray(v) && v.length === 0) continue
    parts.push(`${key}=${Array.isArray(v) ? v.join(',') : textOf(v, 120)}`)
  }
  return parts.length ? parts.join('; ') : null
}

/** 票号提取:模式表来自单一真相源配置,不在脚本里另写一份正则。 */
export function extractTicketNo(text, patterns = []) {
  const s = textOf(text, MAX_TEXT)
  if (!s) return null
  for (const p of patterns || []) {
    let re
    try {
      re = new RegExp(p)
    } catch {
      continue
    }
    const m = re.exec(s)
    if (m) return m[1] ?? m[0]
  }
  return null
}

/**
 * 一条原始事件 → 决策链节点。`source` 与 `patterns` 显式入参(纯函数,§22c 可构造面证明)。
 * 非对象/数组行返回 null,由调用方计入坏行(不参与结论)。
 */
export function normalizeRecord(source, raw, patterns = []) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const f = source.fields || {}
  const ticketFace = textOf(pickSlot(raw, f.ticketFace))
  return {
    source: source.id,
    sourceLabel: source.label || source.id,
    at: normalizeAt(pickSlot(raw, f.at)),
    kind: textOf(pickSlot(raw, f.kind), 80),
    actor: textOf(pickSlot(raw, f.actor), 120),
    change: textOf(pickSlot(raw, f.change)),
    why: textOf(pickSlot(raw, f.why)),
    ticketKey: textOf(pickSlot(raw, f.ticketKey), 80),
    ticketFace,
    ticketNo: extractTicketNo(ticketFace, patterns),
    gateReadout: gateReadoutOf(raw, f.gateReadout),
    commit: normalizeCommit(pickSlot(raw, f.commit)),
  }
}

/** JSONL 逐行解析:空行跳过;坏行计数,不让整本台账作废,也不让坏行进结论。 */
export function parseJsonl(text) {
  const records = []
  let totalLines = 0
  let badLines = 0
  for (const line of String(text).split(/\r?\n/)) {
    const t = line.trim()
    if (!t) continue
    totalLines += 1
    try {
      const obj = JSON.parse(t)
      if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
        badLines += 1
        continue
      }
      records.push(obj)
    } catch {
      badLines += 1
    }
  }
  return { records, badLines, totalLines }
}

/** 源配置:取不到/不是合法 JSON/无 sources ⇒ ok:false(整次审计未判定,exit 2)。 */
export function loadSourcesConfig(sourcesPath = SOURCES_PATH) {
  let text
  try {
    text = readFileSync(sourcesPath, 'utf8')
  } catch (e) {
    return { ok: false, why: `源配置取不到(${sourcesPath}):${e?.code ?? e?.message}`, sources: [] }
  }
  let cfg
  try {
    cfg = JSON.parse(text)
  } catch (e) {
    return { ok: false, why: `源配置不是合法 JSON(${sourcesPath}):${e?.message}`, sources: [] }
  }
  const sources = Array.isArray(cfg?.sources) ? cfg.sources : []
  if (sources.length === 0) return { ok: false, why: `源配置无 sources 条目(${sourcesPath})`, sources: [] }
  const bad = sources.filter((s) => !s || typeof s.id !== 'string' || typeof s.path !== 'string' || !s.fields)
  if (bad.length > 0) return { ok: false, why: `源配置有 ${bad.length} 条缺 id/path/fields(${sourcesPath})`, sources: [] }
  return {
    ok: true,
    version: cfg.version ?? 1,
    ticketNoPatterns: Array.isArray(cfg.ticketNoPatterns) ? cfg.ticketNoPatterns : [],
    sources,
  }
}

/** 单本源读取:文件缺失/不可读 ⇒ state=undetermined(显式原因),绝不返回"空账本 = 绿"。 */
export function loadSource(source, { root = ROOT, patterns = [] } = {}) {
  const abs = resolve(root, source.path)
  const base = { id: source.id, label: source.label || source.id, path: abs }
  let text
  try {
    text = readFileSync(abs, 'utf8')
  } catch (e) {
    const why = e?.code === 'ENOENT' ? `文件不存在:${abs}` : `读取失败(${e?.code ?? e?.message}):${abs}`
    return { ...base, state: 'undetermined', why, records: [], badLines: 0, totalLines: 0 }
  }
  const parsed = parseJsonl(text)
  const records = []
  let badLines = parsed.badLines
  for (const raw of parsed.records) {
    const rec = normalizeRecord(source, raw, patterns)
    if (rec) records.push(rec)
    else badLines += 1
  }
  return {
    ...base,
    state: badLines === 0 ? 'ok' : 'partial',
    why: badLines === 0 ? '' : `${badLines}/${parsed.totalLines} 行不可解析`,
    records,
    badLines,
    totalLines: parsed.totalLines,
  }
}

/** 时间窗判定的唯一出口;窗口内才参与聚合。 */
export function inWindow(rec, sinceMs, untilMs) {
  if (sinceMs === null && untilMs === null) return true
  if (!rec.at) return false
  const t = Date.parse(rec.at)
  if (!Number.isFinite(t)) return false
  if (sinceMs !== null && t < sinceMs) return false
  if (untilMs !== null && t > untilMs) return false
  return true
}

/** `--ticket` 的键可以是票号 / 票面片段 / 16 位 ticketKey(三种都按大小写不敏感包含判定)。 */
export function matchTicket(rec, key) {
  const k = String(key || '').trim().toLowerCase()
  if (!k) return false
  return [rec.ticketKey, rec.ticketNo, rec.ticketFace].some((v) => v && String(v).toLowerCase().includes(k))
}

export function parseTimeFlag(raw, flag) {
  const s = String(raw ?? '').trim()
  if (!s) throw new InputError(`${flag} 需要一个时间值`)
  if (/^\d+$/.test(s)) {
    const iso = normalizeAt(Number(s))
    if (iso === null) throw new InputError(`${flag} 时间不可解析:「${s}」`)
    return Date.parse(iso)
  }
  const t = Date.parse(s)
  if (!Number.isFinite(t)) throw new InputError(`${flag} 时间不可解析:「${s}」`)
  return t
}

function uniqueNonEmpty(values) {
  const out = []
  const seen = new Set()
  for (const v of values) {
    const s = typeof v === 'string' ? v.trim() : ''
    if (!s || seen.has(s)) continue
    seen.add(s)
    out.push(s)
  }
  return out
}

function sortByAt(records) {
  return [...records].sort((a, b) => {
    if (!a.at && !b.at) return 0
    if (!a.at) return 1
    if (!b.at) return -1
    return a.at.localeCompare(b.at)
  })
}

/**
 * 把一组事件串成五环链路,并对每一环缺证据显式点名"链路断在「X」"。
 * 纯函数:输入事件 + 源状态汇总,不碰盘。
 */
export function buildChain(records, ctx = {}) {
  const rows = sortByAt(records)
  const change = uniqueNonEmpty(rows.map((r) => r.change))
  const why = uniqueNonEmpty(rows.map((r) => r.why))
  const actors = uniqueNonEmpty(rows.map((r) => r.actor))
  const ticketKeys = uniqueNonEmpty(rows.map((r) => r.ticketKey))
  const ticketFaces = uniqueNonEmpty(rows.map((r) => r.ticketFace))
  const ticketNos = uniqueNonEmpty(rows.map((r) => r.ticketNo))
  const gateReadouts = uniqueNonEmpty(rows.map((r) => r.gateReadout))
  const fullCommits = []
  const shortCommits = []
  for (const r of rows) {
    if (!r.commit) continue
    if (r.commit.full) {
      if (!fullCommits.includes(r.commit.sha)) fullCommits.push(r.commit.sha)
      continue
    }
    const tag = `${r.commit.sha}(${r.commit.why})`
    if (!shortCommits.includes(tag)) shortCommits.push(tag)
  }
  // 40 位指针在前、短 sha 在后:读报告的人先看到可追责的那一枚。
  const commitPointers = [...fullCommits, ...shortCommits]

  const breaks = []
  if (change.length === 0) breaks.push('链路断在「改了什么」:本链 0 条事件带变更面(commitFiles/declaredFiles/ticketLine/action)')
  if (why.length === 0) breaks.push('链路断在「为什么」:本链 0 条事件带 why/reason/note(决策理由未留痕)')
  if (ticketKeys.length === 0 && ticketFaces.length === 0 && ticketNos.length === 0) {
    breaks.push('链路断在「谁/哪张票」:本链 0 条事件带票键/票面(提交与部署台账均未记录 ticketKey/ticketLine ⇒ 票→提交无共有键)')
  }
  if (gateReadouts.length === 0) breaks.push('链路断在「过了哪些门」:本链 0 条事件带门读数(executed/blockingFailed/gatesRan/gateVerdict 全缺)')
  if (fullCommits.length === 0) {
    const safe = (ctx.sources || []).find((s) => s.id === 'safe-commit')
    let reason
    if (shortCommits.length > 0) reason = `仅有非 40 位指针(${shortCommits.join(', ')}),不满足可追责 sha`
    else if (safe && safe.state === 'undetermined') reason = `提交门台账未判定(${safe.why})`
    else if (safe && safe.state === 'partial') reason = `提交门台账有坏行(${safe.why}),且本链未读到 40 位 landedSha`
    else reason = '本链无 40 位提交指针(提交门台账未记录 landedSha / 票→提交无共有键)'
    breaks.push(`链路断在「落到哪个提交」:${reason}`)
  }

  return {
    key: ctx.key ?? '',
    mode: ctx.mode ?? '',
    status: breaks.length === 0 ? 'complete' : 'broken',
    links: {
      改了什么: change,
      为什么: why,
      '谁/哪张票': { 谁: actors, 票号: ticketNos, 票面: ticketFaces, 票键: ticketKeys },
      过了哪些门: gateReadouts,
      落到哪个提交: commitPointers,
    },
    理由来源: { 票面: ticketFaces, 票号: ticketNos, why, 门读数: gateReadouts },
    链路断点: breaks,
    events: rows.map((r) => ({
      at: r.at,
      source: r.source,
      kind: r.kind,
      actor: r.actor,
      change: r.change,
      why: r.why,
      ticketKey: r.ticketKey,
      ticketNo: r.ticketNo,
      gateReadout: r.gateReadout,
      commit: r.commit ? r.commit.sha : '',
      commitFull: r.commit ? r.commit.full : false,
    })),
  }
}

/**
 * 主报告构建:读配置 → 逐源读账(未判定三态) → 时间窗过滤 → 按票/提交/窗口聚合。
 * 纯函数式(可注入 root/sourcesPath),供 CLI、自检与镜像测试共用同一套判据。
 */
export function buildReport({
  root = ROOT,
  sourcesPath = SOURCES_PATH,
  ticket = null,
  commit = null,
  sinceMs = null,
  untilMs = null,
} = {}) {
  const cfg = loadSourcesConfig(sourcesPath)
  if (!cfg.ok) return { ok: false, why: cfg.why }

  const summaries = []
  const allRecords = []
  for (const source of cfg.sources) {
    const loaded = loadSource(source, { root, patterns: cfg.ticketNoPatterns })
    let windowExcluded = 0
    let windowUndetermined = 0
    const kept = []
    for (const rec of loaded.records) {
      if (sinceMs === null && untilMs === null) {
        kept.push(rec)
        continue
      }
      if (!rec.at) {
        windowUndetermined += 1
        continue
      }
      if (inWindow(rec, sinceMs, untilMs)) kept.push(rec)
      else windowExcluded += 1
    }
    summaries.push({
      id: loaded.id,
      label: loaded.label,
      path: loaded.path,
      state: loaded.state,
      why: loaded.why,
      badLines: loaded.badLines,
      totalLines: loaded.totalLines,
      totalRecords: loaded.records.length,
      records: kept.length,
      windowExcluded,
      windowUndetermined,
    })
    for (const rec of kept) allRecords.push(rec)
  }

  const query = {
    ticket: ticket || null,
    commit: commit ? String(commit).toLowerCase() : null,
    since: sinceMs === null ? null : new Date(sinceMs).toISOString(),
    until: untilMs === null ? null : new Date(untilMs).toISOString(),
  }

  const notes = []
  for (const s of summaries) {
    if (s.state === 'undetermined') notes.push(`源 ${s.id} 未判定:${s.why}`)
    else if (s.state === 'partial') notes.push(`源 ${s.id} 部分坏行:${s.why}`)
    if (s.windowUndetermined > 0) notes.push(`源 ${s.id} 有 ${s.windowUndetermined} 条事件无时间戳,未进时间窗(未判定)`)
  }

  if (summaries.length > 0 && summaries.every((s) => s.state === 'undetermined')) {
    return {
      ok: true,
      tool: 'audit-decision-chain',
      version: cfg.version,
      mode: ticket ? 'ticket' : commit ? 'commit' : 'window',
      query,
      status: 'undetermined',
      sources: summaries,
      chains: [],
      notes: notes.length ? notes : ['三本源全部未判定'],
    }
  }

  let matched = []
  let mode = 'window'
  let key = query.since || query.until || '全部'
  if (ticket) {
    mode = 'ticket'
    key = ticket
    matched = allRecords.filter((r) => matchTicket(r, ticket))
  } else if (commit) {
    mode = 'commit'
    key = query.commit
    matched = allRecords.filter((r) => r.commit && r.commit.full && r.commit.sha === query.commit)
  } else {
    matched = allRecords
  }

  const safe = summaries.find((s) => s.id === 'safe-commit')
  if (mode === 'ticket' && safe && safe.state !== 'undetermined' && safe.records > 0 && !matched.some((r) => r.source === 'safe-commit')) {
    notes.push('提交门台账本次读到事件但无一携带票键 ⇒ 票→提交未接线;接线建议:attestation 写入侧补 ticketKey/ticketLine,或由提交信息携带票号后在此处补连接。')
  }

  const chains = matched.length > 0 ? [buildChain(matched, { mode, key, sources: summaries })] : []
  let status
  if (chains.length === 0) status = 'no-match'
  else status = chains.every((c) => c.status === 'complete') ? 'complete' : 'broken'

  return {
    ok: true,
    tool: 'audit-decision-chain',
    version: cfg.version,
    mode,
    query,
    status,
    sources: summaries,
    chains,
    notes,
  }
}

function stateText(s) {
  if (s.state === 'ok') return '已读'
  if (s.state === 'partial') return `部分(${s.why})`
  return `未判定(${s.why})`
}

function listText(list) {
  return Array.isArray(list) && list.length > 0 ? list.join(' | ') : '(无)'
}

/** 人读报告:机器行前缀 + 逐源三态 + 五环链路 + 「理由来源」+ 断点/接线提示。 */
export function renderHuman(report) {
  const out = []
  out.push(`DECISION-CHAIN mode=${report.mode} status=${report.status}`)
  out.push(`  查询:ticket=${report.query.ticket ?? '(未给)'} commit=${report.query.commit ?? '(未给)'} since=${report.query.since ?? '(未给)'} until=${report.query.until ?? '(未给)'}`)
  out.push('  台账源:')
  for (const s of report.sources) out.push(`    - ${s.id}(${s.label}) ${stateText(s)} records=${s.records}/${s.totalRecords}${s.badLines ? ` badLines=${s.badLines}` : ''}`)
  if (report.chains.length === 0) {
    out.push(`  查询结论:${report.status === 'undetermined' ? '未判定 —— 三本源全部取不到,不得记绿' : '0 条匹配(未命中,不记绿)'}`)
  }
  report.chains.forEach((c, i) => {
    out.push(`  链 ${i + 1}/${report.chains.length} [${c.mode}:${c.key}] ${c.status === 'complete' ? '链路完整' : '链路有断点'}`)
    out.push(`    改了什么:${listText(c.links.改了什么)}`)
    out.push(`    为什么:${listText(c.links.为什么)}`)
    const who = c.links['谁/哪张票']
    out.push(`    谁/哪张票:票号=${listText(who.票号)} 票面=${listText(who.票面)} 票键=${listText(who.票键)} 谁=${listText(who.谁)}`)
    out.push(`    过了哪些门:${listText(c.links.过了哪些门)}`)
    out.push(`    落到哪个提交:${listText(c.links.落到哪个提交)}`)
    out.push(`    理由来源:票面=${listText(c.理由来源.票面)} | 票号=${listText(c.理由来源.票号)} | why=${listText(c.理由来源.why)} | 门读数=${listText(c.理由来源.门读数)}`)
    if (c.链路断点.length > 0) for (const b of c.链路断点) out.push(`    ${b}`)
    else out.push('    链路断点:(无)')
  })
  for (const n of report.notes) out.push(`  注:${n}`)
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

function flagValueOf(argv, flag, noun) {
  const r = requireFlagValue(argv, flag, { noun })
  if (r.error) throw new InputError(r.error)
  return r.value
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
  const box = join(ROOT, '.ihui-agent', 'tmp', `audit-decision-chain-selftest-${process.pid}-${Date.now().toString(36)}`)
  const state = join(box, '.ihui-agent', 'state')
  const sha = 'a'.repeat(40)
  const prev = 'b'.repeat(40)
  const face = '- [ ]（进行中@2026-10-25/r5b）〔归:自进化〕(2026-10-25) 可审计决策链 G-9001'
  const writeLines = (path, rows) => writeFileSync(path, rows.map((r) => JSON.stringify(r)).join('\n') + '\n', 'utf8')
  try {
    mkdirSync(state, { recursive: true })
    writeLines(join(state, 'auto-evolve-ledger.jsonl'), [
      { ts: '2026-10-24T10:00:00.000Z', mode: 'dispatch', action: 'dispatched', ticketKey: '0123456789abcdef', ticketLine: face, exitCode: 0, durationMs: 1234, why: '命中票类白名单' },
      { ts: '2026-10-24T09:00:00.000Z', mode: 'dispatch', action: 'no-ticket', note: '无票可派' },
    ])
    writeLines(join(state, 'safe-commit-attestation.jsonl'), [
      { ts: '2026-10-24T11:00:00.000Z', kind: 'gates-then-commit', landedSha: sha, commitFiles: ['scripts/audit-decision-chain.mjs'], gatesRan: true, hookSkipped: false },
    ])
    writeLines(join(box, '.ihui-agent', 'deploy-decisions.jsonl'), [
      { v: 1, ts: '2026-10-24T12:00:00.000Z', action: 'rollback', sha, prevSha: prev, gateVerdict: 'fail', failDims: ['web'], shadowRc: 1, reason: '健康门禁未过' },
    ])

    t('① 源配置可读且三本齐全', () => {
      const cfg = loadSourcesConfig(SOURCES_PATH)
      if (!cfg.ok) throw new Error(cfg.why)
      const ids = cfg.sources.map((s) => s.id)
      for (const id of ['auto-evolve', 'safe-commit', 'deploy']) if (!ids.includes(id)) throw new Error(`配置缺源 ${id}`)
    })
    t('② 缺文件 ⇒ 未判定(不记空绿)', () => {
      const r = buildReport({ root: join(box, 'empty-root') })
      if (r.status !== 'undetermined') throw new Error(`status 应 undetermined,实得 ${r.status}`)
      if (!r.sources.every((s) => s.state === 'undetermined')) throw new Error('存在被误判成已读的源')
    })
    t('③ 按票聚合:理由来源四件齐,提交环显式断点', () => {
      const r = buildReport({ root: box, ticket: 'G-9001' })
      if (r.chains.length !== 1) throw new Error(`链数应为 1,实得 ${r.chains.length}`)
      const c = r.chains[0]
      if (!c.理由来源.票号.includes('G-9001')) throw new Error('票号未进理由来源')
      if (!c.理由来源.why.length) throw new Error('why 未进理由来源')
      if (!c.理由来源.门读数.length) throw new Error('门读数未进理由来源')
      if (!c.链路断点.some((b) => b.includes('链路断在「落到哪个提交」'))) throw new Error('提交环断点未点名')
    })
    t('④ 按 40 位提交聚合:跨台账取到门读数与部署理由', () => {
      const r = buildReport({ root: box, commit: sha })
      if (r.chains.length !== 1) throw new Error(`链数应为 1,实得 ${r.chains.length}`)
      const c = r.chains[0]
      if (!c.links.过了哪些门.some((g) => g.includes('gatesRan=true'))) throw new Error('提交门读数缺失')
      if (!c.理由来源.why.some((w) => w.includes('健康门禁未过'))) throw new Error('部署 why 未串进链路')
      if (!c.链路断点.some((b) => b.includes('链路断在「谁/哪张票」'))) throw new Error('票环断点未点名')
    })
    t('⑤ 时间窗只留窗内事件', () => {
      const r = buildReport({ root: box, sinceMs: Date.parse('2026-10-24T11:30:00.000Z') })
      const n = r.sources.reduce((acc, s) => acc + s.records, 0)
      if (n !== 1) throw new Error(`窗内事件应 1 条,实得 ${n}`)
      if (r.chains.length !== 1 || r.chains[0].events[0].source !== 'deploy') throw new Error('窗内事件来源不是 deploy')
    })
    t('⑥ 非 40 位提交指针拒绝', () => {
      if (isFullSha(sha.slice(0, 12))) throw new Error('短 sha 被放行')
      if (!isFullSha(sha)) throw new Error('40 位 sha 被拒')
      let hit = false
      try {
        parseTimeFlag('不是时间', '--since')
      } catch (e) {
        hit = e instanceof InputError
      }
      if (!hit) throw new Error('坏时间未抛 InputError')
    })
    t('⑦ 坏行计入未判定面但不吞好行', () => {
      const badDir = join(box, '.ihui-agent', 'state-bad')
      mkdirSync(badDir, { recursive: true })
      writeFileSync(join(badDir, 'x.jsonl'), '{"ts":"2026-10-24T10:00:00.000Z","ticketLine":"G-1"}\n{bad json\n', 'utf8')
      const rec = loadSource({ id: 'x', label: 'x', path: '.ihui-agent/state-bad/x.jsonl', fields: { at: ['ts'], ticketFace: ['ticketLine'] } }, { root: box })
      if (rec.state !== 'partial' || rec.badLines !== 1 || rec.records.length !== 1) throw new Error(`坏行三态错:${rec.state}/${rec.badLines}/${rec.records.length}`)
    })
    t('⑧ 人读输出含「理由来源」与断点原文', () => {
      const text = renderHuman(buildReport({ root: box, ticket: '0123456789abcdef' }))
      if (!text.includes('理由来源:')) throw new Error('缺 理由来源')
      if (!text.includes('链路断在「落到哪个提交」')) throw new Error('缺 断点原文')
    })
    t('⑨ 0 条匹配判 no-match(不记绿)', () => {
      const r = buildReport({ root: box, ticket: '不存在的票' })
      if (r.status !== 'no-match') throw new Error(`status 应 no-match,实得 ${r.status}`)
    })
  } catch (e) {
    checks.push({ name: '夹具准备', ok: false, why: e?.message ?? String(e) })
  } finally {
    rmSync(box, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
  }

  for (const c of checks) console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name}${c.ok ? '' : ` — ${c.why}`}`)
  const bad = checks.filter((c) => !c.ok)
  console.log(`# self-test ${checks.length - bad.length}/${checks.length}`)
  return bad.length === 0 ? 0 : 1
}

async function main(argv) {
  const args = parseArgs(argv)
  if (args['self-test'] === true || args['self-test'] === 'true') return selfTest()
  const json = args.json === true || args.json === 'true'

  let ticket = null
  let commit = null
  let sinceMs = null
  let untilMs = null
  let root = ROOT
  let sourcesPath = SOURCES_PATH
  try {
    ticket = flagValueOf(argv, '--ticket', '票键(票号/票面片段/16 位 ticketKey)')
    commit = flagValueOf(argv, '--commit', '40 位提交 sha')
    const sinceRaw = flagValueOf(argv, '--since', '起始时间(ISO 或 epoch)')
    const untilRaw = flagValueOf(argv, '--until', '截止时间(ISO 或 epoch)')
    const rootRaw = flagValueOf(argv, '--root', '仓库根目录')
    const sourcesRaw = flagValueOf(argv, '--sources', '源配置路径')
    if (sinceRaw) sinceMs = parseTimeFlag(sinceRaw, '--since')
    if (untilRaw) untilMs = parseTimeFlag(untilRaw, '--until')
    if (rootRaw) root = resolve(rootRaw)
    if (sourcesRaw) sourcesPath = resolve(sourcesRaw)
  } catch (e) {
    console.error(`DECISION-CHAIN-INPUT ${e?.message ?? e}`)
    return 2
  }

  if (!ticket && !commit && sinceMs === null && untilMs === null) {
    console.error('DECISION-CHAIN-INPUT 缺少查询输入:至少要给 --ticket 或 --commit 或 --since/--until 之一')
    return 2
  }
  if (commit && !isFullSha(commit)) {
    console.error(`DECISION-CHAIN-INPUT --commit 必须是 40 位十六进制 sha:「${commit}」`)
    return 2
  }
  if (ticket && commit) {
    console.error('DECISION-CHAIN-INPUT --ticket 与 --commit 只能选一个(同时给会被静默忽略一半,故拒绝)')
    return 2
  }
  if (sinceMs !== null && untilMs !== null && sinceMs > untilMs) {
    console.error('DECISION-CHAIN-INPUT --since 晚于 --until')
    return 2
  }

  let report
  try {
    report = buildReport({ root, sourcesPath, ticket, commit, sinceMs, untilMs })
  } catch (e) {
    console.error(`DECISION-CHAIN-ERROR 取数层异常:${(e && e.stack) || e}`)
    return 2
  }
  if (!report.ok) {
    console.error(`DECISION-CHAIN-UNDETERMINED ${report.why}`)
    return 2
  }

  if (json) console.log(JSON.stringify(report, null, 2))
  else console.log(renderHuman(report))

  if (report.status === 'undetermined') {
    console.error('DECISION-CHAIN-UNDETERMINED 三本源全部未判定,不得记绿(见 sources[].why)')
    return 2
  }
  return 0
}

// §22d 双形态入口:被测试 import 时不得触发主流程。
const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  main(process.argv.slice(2)).then(
    (code) => {
      process.exitCode = code
    },
    (e) => {
      console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
      process.exit(2)
    },
  )
}

export const __test__ = {
  parseArgs,
  pickSlot,
  textOf,
  normalizeAt,
  isFullSha,
  normalizeCommit,
  gateReadoutOf,
  extractTicketNo,
  normalizeRecord,
  parseJsonl,
  loadSourcesConfig,
  loadSource,
  inWindow,
  matchTicket,
  parseTimeFlag,
  buildChain,
  buildReport,
  renderHuman,
  selfTest,
  sourcesPath: SOURCES_PATH,
  InputError,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
