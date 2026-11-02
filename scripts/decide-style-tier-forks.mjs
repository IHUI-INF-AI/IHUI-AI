#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- CLI 工具,需 console 输出对账报告 */
/**
 * decide-style-tier-forks.mjs — web↔RN 非色档分叉的「允许额度 / 决策」对账与账本维护(P0-3)
 *
 * 立因(2026-11-03):门 275 的分叉登记表 `cross-end-allowed-diffs.json` 只解决「已登记额度」,
 * 未登记的分叉(`forkAllowance.pending`)一直是只读读数 —— 没有账本记录「谁认领、何时复核、
 * 落到哪一档」,也没有判据把「不在额度内又无决策」折成红。本脚本补这一格。
 *
 * 取数(§0.6 零复算):直接 import `check-web-rn-style-tiers.mjs` 的 `runJudge()`(与
 * `node scripts/check-web-rn-style-tiers.mjs --json` 同一个判定器、同一本 allowed-diffs 账本),
 * 本文件不另写一套「什么算分叉 / 额度怎么核销」。`runJudge` 的 `forkAllowance.rows` 逐行给
 * `{kind, prop, val, n, allowed}`,本脚本把它折成 0/1/2。
 *
 * 判据(`--check`,任一 ⇒ exit 1 并点名):
 *   ① 非色档分叉处数不在 83 处允许额度内(行内按处数核销,不足的差额进 pending);
 *   ② 差额部分没有 decision,或 decision 缺 owner / owner=unassigned / 缺 expires / 已到期 /
 *      targetTier 不是该 kind 的档值 / evidence 缺失;
 *   ③ 账本里存在已到期的 decision(整本账腐烂也判红,不管该行现在是否已被额度覆盖)。
 *   首跑现读 `pending=146`(RN 分叉 229 处 − 允许 83 处),必须红 —— 这是验收证据,
 *   不是把账本补成绿的理由。
 *
 * 账本 `scripts/data/style-tier-fork-decisions.jsonl`,每行:
 *   {side:"rn", kind, prop, value, targetTier, owner, expires, evidence}
 *   - owner=`unassigned` 是**草稿占位**,不算有效 decision(写明未指派原因,不消红);
 *   - expires 当天仍算在期;targetTier 必须 ∈ 该 kind 的档表;
 *   - `--apply` 幂等:按 `side:kind:prop:value` 去重,已存在条目只更新不重复;默认只给
 *     缺账本的待决策行补 `unassigned` 草稿,已有有效 decision 不会被草稿覆盖。
 *
 * 用法:
 *   node scripts/decide-style-tier-forks.mjs --check [--json] [--gate]
 *   node scripts/decide-style-tier-forks.mjs --apply [--decisions=<jsonl>] [--json]
 * 退出码:0 全在额度/decision 在期 · 1 有未认领或到期 · 2 取不到输入/账本形态坏(未判定,§0.3)
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { readWorktreeFile } from './lib/face-reader.mjs'
import { runJudge } from './check-web-rn-style-tiers.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const ROOT = join(here, '..')
const DECISIONS_REL = 'scripts/data/style-tier-fork-decisions.jsonl'
const DECISIONS_PATH = join(ROOT, DECISIONS_REL)

const argv = process.argv.slice(2)
const jsonMode = argv.includes('--json')
const gateMode = argv.includes('--gate')
const applyMode = argv.includes('--apply')
const checkMode = argv.includes('--check') || !applyMode
const decisionsArg = argv.find((a) => a.startsWith('--decisions='))
const decisionsInput = decisionsArg ? decisionsArg.slice('--decisions='.length) : null

function isoToday() {
  return new Date().toISOString().slice(0, 10)
}

const TIER_FIELD = { spacing: 'spacing', fontSize: 'type', radius: 'radius' }

function tierSetOf(kind, tier) {
  const field = TIER_FIELD[kind]
  const arr = field ? tier?.[field] : null
  return Array.isArray(arr) ? new Set(arr.map(Number)) : null
}

/** 最近档(绝对差最小,平手取小档):只给草稿建议,不替人拍板。 */
export function nearestTier(kind, value, tier) {
  const set = tierSetOf(kind, tier)
  if (!set || set.size === 0) return null
  const v = Number(value)
  let best = null
  for (const t of [...set].sort((a, b) => a - b)) {
    if (best === null || Math.abs(t - v) < Math.abs(best - v)) best = t
  }
  return best
}

export function decisionKey(d) {
  return `${d?.side ?? ''}:${d?.kind ?? ''}:${d?.prop ?? ''}:${String(d?.value ?? '')}`
}

/**
 * 单条 decision 是否有效。纯函数:只认三件套 + 档值,不读盘。
 * @returns {{ok:boolean, reason:string|null}}
 */
export function validDecision(d, { today = isoToday(), tier = null } = {}) {
  if (!d || d.side !== 'rn') return { ok: false, reason: 'shape(side!=rn)' }
  if (!['spacing', 'fontSize', 'radius'].includes(d.kind))
    return { ok: false, reason: 'shape(kind)' }
  if (typeof d.prop !== 'string' || d.prop.trim() === '')
    return { ok: false, reason: 'shape(prop)' }
  if (!Number.isFinite(Number(d.value))) return { ok: false, reason: 'shape(value)' }
  const owner = typeof d.owner === 'string' ? d.owner.trim() : ''
  if (!owner) return { ok: false, reason: 'owner-missing' }
  if (owner === 'unassigned') return { ok: false, reason: 'unassigned' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(d.expires ?? '')))
    return { ok: false, reason: 'expires-missing' }
  if (String(d.expires) < today) return { ok: false, reason: 'expired' }
  const target = Number(d.targetTier)
  if (!Number.isFinite(target)) return { ok: false, reason: 'targetTier-missing' }
  const set = tierSetOf(d.kind, tier)
  if (set && !set.has(target))
    return { ok: false, reason: `targetTier(${target}) 不在 ${d.kind} 档表` }
  if (typeof d.evidence !== 'string' || d.evidence.trim().length < 8)
    return { ok: false, reason: 'evidence-missing' }
  return { ok: true, reason: null }
}

/**
 * 纯判据。rows 是 runJudge 的 fork 行摊平后附 `status`(allowed|pending|expired)。
 * @param {{rows:Array<object>, decisions:Array<object>, tier:object, today:string}} p
 */
export function judgeForkDecisions({
  rows = [],
  decisions = [],
  tier = null,
  today = isoToday(),
} = {}) {
  const failures = []
  const byKey = new Map()
  for (const d of decisions) {
    const key = decisionKey(d)
    if (byKey.has(key)) failures.push({ rule: 'decision-duplicate', key })
    else byKey.set(key, d)
  }
  let pending = 0
  let allowed = 0
  let allowanceExpired = 0
  const rowsNeeding = []
  for (const r of rows) {
    const n = Number(r.n) || 0
    const covered =
      r.status === 'allowed' ? n : r.status === 'pending' ? Math.min(Number(r.allowed) || 0, n) : 0
    if (r.status === 'expired') allowanceExpired += 1
    const need = n - covered
    if (need <= 0) {
      allowed += n
      continue
    }
    const d = byKey.get(decisionKey({ side: 'rn', kind: r.kind, prop: r.prop, value: r.val }))
    const v = d ? validDecision(d, { today, tier }) : { ok: false, reason: 'no-decision' }
    if (v.ok) {
      allowed += covered
      continue
    }
    pending += need
    failures.push({
      kind: r.kind,
      prop: r.prop,
      value: r.val,
      need,
      allowed: covered,
      reason: v.reason,
    })
    rowsNeeding.push({
      side: 'rn',
      kind: r.kind,
      prop: r.prop,
      value: r.val,
      need,
      allowed: covered,
    })
  }
  // 台账腐烂:已到期 decision 即使对应行现在已被额度覆盖,也必须复核/续期(白名单不得腐化)。
  let decisionsExpired = 0
  let decisionsUnassigned = 0
  let decisionsValid = 0
  for (const d of decisions) {
    const expires = String(d?.expires ?? '')
    if (/^\d{4}-\d{2}-\d{2}$/.test(expires) && expires < today) decisionsExpired += 1
    if (typeof d?.owner === 'string' && d.owner.trim() === 'unassigned') decisionsUnassigned += 1
    if (validDecision(d, { today, tier }).ok) decisionsValid += 1
  }
  if (decisionsExpired > 0)
    failures.push({
      rule: 'decision-expired-ledger',
      detail: `账本里 ${decisionsExpired} 条 decision 已到期`,
    })
  return {
    ok: failures.length === 0,
    pending,
    allowed,
    allowanceExpired,
    decisionsTotal: decisions.length,
    decisionsValid,
    decisionsExpired,
    decisionsUnassigned,
    failures,
    rowsNeeding,
  }
}

/** 解析 JSONL;空行跳过,坏行抛错(未判定,不记绿)。 */
export function parseDecisions(text, source = DECISIONS_REL) {
  if (typeof text !== 'string' || text.trim() === '') return []
  const out = []
  for (const [i, line] of text.split(/\r?\n/).entries()) {
    if (!line.trim()) continue
    try {
      out.push(JSON.parse(line))
    } catch (e) {
      throw new Error(`${source} 第 ${i + 1} 行不是合法 JSON:${e.message}`)
    }
  }
  return out
}

/** 按 `side:kind:prop:value` 去重合并:已存在条目只更新字段,不重复追加。 */
export function mergeDecisions(existing = [], incoming = []) {
  const map = new Map()
  for (const d of existing) map.set(decisionKey(d), { ...d })
  for (const d of incoming) {
    const key = decisionKey(d)
    map.set(key, { ...(map.get(key) ?? {}), ...d })
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([, d]) => d)
}

/** 确定性 JSONL(无时间戳)⇒ 重复 --apply 字节一致。 */
export function serializeDecisions(entries) {
  return entries.map((d) => JSON.stringify(d)).join('\n') + (entries.length ? '\n' : '')
}

export function writeDecisions(path, entries) {
  const text = serializeDecisions(entries)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, text, 'utf8')
  return { path, bytes: text.length, text }
}

function readDecisionsText(rel) {
  try {
    return readWorktreeFile(ROOT, rel)
  } catch (e) {
    throw new Error(`${rel} 取不到:${e.message}`)
  }
}

/** 把 runJudge 的 forkAllowance 摊平成带 status 的行。 */
function forkRowsOf(r) {
  const fa = r?.forkAllowance?.rows
  if (!fa || !Array.isArray(fa.allowed) || !Array.isArray(fa.pending) || !Array.isArray(fa.expired))
    throw new Error('runJudge 未返回 forkAllowance.rows ⇒ 未判定')
  return [
    ...fa.allowed.map((x) => ({ ...x, status: 'allowed' })),
    ...fa.pending.map((x) => ({ ...x, status: 'pending' })),
    ...fa.expired.map((x) => ({ ...x, status: 'expired' })),
  ]
}

function judgeReal() {
  const r = runJudge()
  if (r?.forkAllowance?.problem) throw new Error(`允许差异账本不可用:${r.forkAllowance.problem}`)
  const tier = r.tier
  if (
    !tier ||
    !Array.isArray(tier.spacing) ||
    !Array.isArray(tier.type) ||
    !Array.isArray(tier.radius)
  )
    throw new Error('档表未返回(spacing/type/radius)⇒ 未判定')
  const rows = forkRowsOf(r)
  const decisions = parseDecisions(readDecisionsText(DECISIONS_REL))
  const v = judgeForkDecisions({ rows, decisions, tier, today: isoToday() })
  return { face: r.face, tier, rows, decisions, ...v }
}

function applyReal() {
  const r = runJudge()
  if (r?.forkAllowance?.problem) throw new Error(`允许差异账本不可用:${r.forkAllowance.problem}`)
  const tier = r.tier
  const rows = forkRowsOf(r)
  const existing = parseDecisions(readDecisionsText(DECISIONS_REL))
  const explicit = decisionsInput
    ? parseDecisions(readDecisionsText(decisionsInput), decisionsInput)
    : null
  let drafts = []
  if (explicit === null) {
    // 默认只补缺账本的草稿:已有条目(无论有效/草稿)一律不动,避免草稿覆盖人工 decision。
    const existingKeys = new Set(existing.map(decisionKey))
    const v0 = judgeForkDecisions({ rows, decisions: existing, tier, today: isoToday() })
    drafts = v0.rowsNeeding
      .filter(
        (x) =>
          !existingKeys.has(
            decisionKey({ side: 'rn', kind: x.kind, prop: x.prop, value: x.value }),
          ),
      )
      .map((x) => ({
        side: 'rn',
        kind: x.kind,
        prop: x.prop,
        value: x.value,
        targetTier: nearestTier(x.kind, x.value, tier),
        owner: 'unassigned',
        expires: '',
        evidence: `未指派:该分叉值无 owner 认领,待决策 ${x.need} 处;先定档后指派,不得以草稿消红`,
      }))
  }
  const merged = mergeDecisions(existing, explicit ?? drafts)
  writeDecisions(DECISIONS_PATH, merged)
  return {
    face: r.face,
    applied: explicit ?? drafts,
    existing: existing.length,
    total: merged.length,
    appended: merged.length - existing.length,
    path: DECISIONS_REL,
  }
}

function reportCheck(out) {
  console.log('\n🧭 非色档分叉 decision 对账(复用门 275 runJudge;只读 --check)')
  console.log('─'.repeat(72))
  console.log(`判定面        : ${out.face}`)
  console.log(
    `分叉行        : ${out.rows.length}(额度内 ${out.allowed} 处 / 待决策 ${out.pending} 处 / 额度到期 ${out.allowanceExpired} 行)`,
  )
  console.log(
    `decision 账本 : ${out.decisionsTotal} 条(有效 ${out.decisionsValid} / 未指派 ${out.decisionsUnassigned} / 到期 ${out.decisionsExpired})`,
  )
  if (out.failures.length === 0) {
    console.log('\n✅ 每个分叉处数都在允许额度内,或有在期 decision')
  } else {
    console.log(`\n❌ 共 ${out.failures.length} 条判红(pending=${out.pending} 处):`)
    for (const f of out.failures.slice(0, 40)) {
      if (f.rule) console.log(`  ✗ [${f.rule}] ${f.detail}`)
      else
        console.log(
          `  ✗ ${f.kind} ${f.prop}=${f.value}px 待决策 ${f.need} 处(${f.allowed} 处已有额度):${f.reason}`,
        )
    }
    if (out.failures.length > 40) console.log(`  … 另有 ${out.failures.length - 40} 条`)
  }
}

function main() {
  if (applyMode && !checkMode) {
    const out = applyReal()
    if (jsonMode) console.log(JSON.stringify(out, null, 2))
    else
      console.log(
        `✅ decision 账本已写 ${out.path}:本次处理 ${out.applied.length} 条,账本 ${out.existing} → ${out.total} 条(新增 ${out.appended})`,
      )
    return 0
  }
  const out = judgeReal()
  const json = {
    face: out.face,
    forkRows: out.rows.length,
    pending: out.pending,
    allowed: out.allowed,
    allowanceExpired: out.allowanceExpired,
    decisions: {
      total: out.decisionsTotal,
      valid: out.decisionsValid,
      unassigned: out.decisionsUnassigned,
      expired: out.decisionsExpired,
    },
    ok: out.ok,
    failures: out.failures,
    rowsNeeding: out.rowsNeeding,
  }
  if (jsonMode) console.log(JSON.stringify(json, null, 2))
  else if (gateMode)
    console.log(
      `STYLE-TIER-FORK-DECISIONS pending=${out.pending} allowed=${out.allowed} decisions=${out.decisionsValid}/${out.decisionsTotal} expired=${out.decisionsExpired} -> ${out.ok ? '绿' : '红'}`,
    )
  else reportCheck(out)
  return out.ok ? 0 : 1
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  try {
    process.exit(main())
  } catch (e) {
    console.error(`❌ 未判定: ${e?.message ?? e}(取不到输入不记绿也不冒红,§0.3)`)
    process.exit(2)
  }
}

export const __test__ = {
  nearestTier,
  decisionKey,
  validDecision,
  judgeForkDecisions,
  parseDecisions,
  mergeDecisions,
  serializeDecisions,
  writeDecisions,
  DECISIONS_REL,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
