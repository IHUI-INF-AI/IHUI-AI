#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- CLI 工具,需 console 输出对账报告 */
/**
 * decide-style-tier-forks.mjs — web↔RN 非色档分叉的「允许额度 / 决策」对账与账本维护(P0-3)
 *
 * 立因(2026-11-03):`check-web-rn-style-tiers.mjs` 的分叉登记表 `cross-end-allowed-diffs.json` 只解决「已登记额度」,
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
 *   ③ 账本里存在已到期的 decision(整本账腐烂也判红,不管该行现在是否已被额度覆盖);
 *   ④ 档表缺位(`missingTier` = 值 ∉ 档表 ∧ 对端同值在用)逐值问准入线
 *      `MISSING_TIER_ADMISSION_LINE`:两端各自 ≥ 线 ⇒ 出路是补表(本器**不代写档表**,只点名);
 *      未达线 ⇒ 必须有在期 decision(按 `kind:值` 值级核销),否则进 pending 判红。
 *      立因:`spacing.ts` 头注那句"两端各自 ≥100 处才进表"自 2026-10-31 起没有器物实现,
 *      尺子又每轮把缺位报成"出路=补表" —— 于是一格既不进表也不落档、且无任何核销面
 *      (fork 有账可销,缺位什么都没有)。2026-11-05 接上这一腿。
 *   首跑现读 `pending=146`(RN 分叉 229 处 − 允许 83 处),必须红 —— 这是验收证据,
 *   不是把账本补成绿的理由。④ 同一条:2026-11-05 现读 9 个缺位值 0 条达线,
 *   要么逐值定档登记,要么就地落档,**不得为消红下调准入线**(§12e)。
 *
 * 账本 `scripts/data/style-tier-fork-decisions.jsonl`,每行:
 *   {side:"rn", kind, prop, value, targetTier, owner, expires, evidence}
 *   - owner=`unassigned` 是**草稿占位**,不算有效 decision(写明未指派原因,不消红);
 *   - expires 当天仍算在期;targetTier 必须 ∈ 该 kind 的档表;
 *   - 缺位桶同本账,靠 `bucket:"missingTier"` 分家,键为 `缺位:<kind>:<值>`(值级,`prop:"*"`,
 *     `side:"both"`);owner/expires/targetTier/evidence 四项与 fork 桶同等生效,未做任何削弱;
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
 * 缺位桶的决策键 = `缺位:<kind>:<值>`。
 * 缺位是**值级**问题(补表补的是一个值,落档落的也是一个值),不像分叉要逐 prop 定档,
 * 所以键里不带 prop/side;账本仍与 fork 同用一本 jsonl,靠 `bucket` 字段分家。
 */
export function missingDecisionKey(kind, value) {
  return `缺位:${kind}:${String(value)}`
}

/**
 * 档表缺位的准入线 —— **这条线只住这一处**(§0.6)。
 * `spacing.ts` 头注从 2026-10-31 起就写着"默认仍要求两端各自 ≥100 处同值取用才进表",
 * 但那句话从来没有器物实现:尺子把表外且对端在用的取值报成 `missingTier` 并印一句
 * "出路=补表,零端内改动",却没有任何东西能机械回答"这个值到底够不够格进表"。
 * 后果不是读数难看,而是这一格**既不进表也不落档、且无核销面** —— fork 有账本可销,
 * 缺位什么都没有,于是每轮报数都落在无人负责的位置上(§0.9「判据指向出路而出路上没有器物」)。
 * 本常量把那句散文变成可跑判据:达线 ⇒ 出路确为补表;未达线 ⇒ 必须有在期 decision,
 * 否则计入 pending 并判红。
 * **不得为消红下调本值**(§12e/门 128「为消红补数字都违规」):2026-11-05 现读 9 个缺位值
 * (1/3/5/7/9/26/28/80/96)按此线全部未达,最大的 `spacing:1` 也只有 RN 30 处 / web 56 处。
 */
export const MISSING_TIER_ADMISSION_LINE = 100

/**
 * 两侧 `missingTier` 行按 `kind:值` 聚合成值级台账。
 * 纯函数:输入是 runJudge 已经给好的行(含本侧处数 n),本层不重扫文件、不复算三桶。
 * 每值的 `rnN`/`webN` 取的是**该侧全部行**(不分 inTier/missingTier)—— 准入线要问的是
 * "两端各自在这个值上取用了多少处",而不是"这一侧把它报成了哪一桶";按 state 过滤会系统性
 * 读小(同一值若一侧已 inTier 就漏计),那正是本尺 356-361 行记过的"量纲静默丢失"同型。
 */
export function aggregateMissingByValue(rnRows = [], webRows = []) {
  const countAll = (rows) => {
    const m = new Map()
    for (const r of rows ?? []) {
      const k = `${r.kind}:${String(r.val)}`
      m.set(k, (m.get(k) ?? 0) + (Number(r.n) || 0))
    }
    return m
  }
  const rnAll = countAll(rnRows)
  const webAll = countAll(webRows)
  const map = new Map()
  for (const rows of [rnRows, webRows]) {
    for (const r of rows ?? []) {
      if (r.state !== 'missingTier') continue
      const key = missingDecisionKey(r.kind, r.val)
      let e = map.get(key)
      if (!e) {
        e = {
          kind: r.kind,
          value: r.val,
          rnN: Number(rnAll.get(`${r.kind}:${String(r.val)}`)) || 0,
          webN: Number(webAll.get(`${r.kind}:${String(r.val)}`)) || 0,
          props: new Set(),
        }
        map.set(key, e)
      }
      e.props.add(r.prop)
    }
  }
  return [...map.values()]
    .map((e) => ({ ...e, props: [...e.props].sort(), site: e.rnN + e.webN }))
    .sort((a, b) => a.kind.localeCompare(b.kind) || Number(a.value) - Number(b.value))
}

/**
 * 缺位桶裁决(与 judgeForkDecisions 同构,但按值不按位置)。
 * @param {{missing:Array, decisions:Array, tier:object, today:string, line:number}} p
 */
export function judgeMissingTier({
  missing = [],
  decisions = [],
  tier = null,
  today = isoToday(),
  line = MISSING_TIER_ADMISSION_LINE,
} = {}) {
  const failures = []
  const byKey = new Map()
  for (const d of decisions) {
    if (d?.bucket !== 'missingTier') continue
    const key = missingDecisionKey(d.kind, d.value)
    if (byKey.has(key)) failures.push({ rule: 'missing-decision-duplicate', key })
    else byKey.set(key, d)
  }
  const extendable = []
  const settled = []
  const rowsNeeding = []
  let pending = 0
  for (const m of missing) {
    const admitted = m.rnN >= line && m.webN >= line
    const key = missingDecisionKey(m.kind, m.value)
    if (admitted) {
      extendable.push({ ...m, key, line })
      continue
    }
    const d = byKey.get(key)
    const v = d ? validDecision(d, { today, tier }) : { ok: false, reason: 'no-decision' }
    if (v.ok) {
      settled.push({ ...m, key, expires: d.expires, targetTier: d.targetTier })
      continue
    }
    pending += m.site
    failures.push({
      bucket: 'missingTier',
      kind: m.kind,
      value: m.value,
      rnN: m.rnN,
      webN: m.webN,
      need: m.site,
      line,
      props: m.props,
      reason: v.reason,
    })
    rowsNeeding.push({ ...m, key, line })
  }
  let ledgerExpired = 0
  let ledgerUnassigned = 0
  let ledgerValid = 0
  for (const d of decisions) {
    if (d?.bucket !== 'missingTier') continue
    const expires = String(d?.expires ?? '')
    if (/^\d{4}-\d{2}-\d{2}$/.test(expires) && expires < today) ledgerExpired += 1
    if (typeof d?.owner === 'string' && d.owner.trim() === 'unassigned') ledgerUnassigned += 1
    if (validDecision(d, { today, tier }).ok) ledgerValid += 1
  }
  if (ledgerExpired > 0)
    failures.push({
      rule: 'missing-decision-expired-ledger',
      detail: `缺位账本里 ${ledgerExpired} 条 decision 已到期`,
    })
  return {
    ok: failures.length === 0,
    total: missing.length,
    pending,
    line,
    extendable,
    settled,
    failures,
    rowsNeeding,
    ledgerTotal: [...byKey.values()].length,
    ledgerValid,
    ledgerUnassigned,
    ledgerExpired,
  }
}

/**
 * 单条 decision 是否有效。纯函数:只认三件套 + 档值,不读盘。
 * @returns {{ok:boolean, reason:string|null}}
 */
export function validDecision(d, { today = isoToday(), tier = null } = {}) {
  // side 三值:`rn` 是 fork 桶的位置级条目;`web`/`both` 只可能来自缺位桶(值级,prop 固定 `*`)。
  // 放宽是必需的 —— 缺位按定义就是"两端各自都在用同一个表外值",只准登记 RN 侧会漏掉 web 那一半。
  // owner/expires/targetTier/evidence 四项检查对两桶同等生效,未做任何削弱。
  if (!d || !['rn', 'web', 'both'].includes(d.side)) return { ok: false, reason: 'shape(side)' }
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
  const missing = aggregateMissingByValue(r?.rn?.rows, r?.web?.rows)
  if (missing.length === 0 && (r?.rn?.missingTier ?? 0) + (r?.web?.missingTier ?? 0) > 0)
    throw new Error('尺子报了缺位行而聚合到 0 条 ⇒ 未判定(坏尺子的失效形态永远是安静的,§0.3)')
  const m = judgeMissingTier({ missing, decisions, tier, today: isoToday() })
  return { face: r.face, tier, rows, decisions, ...v, ok: v.ok && m.ok, missing: m }
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
    // 缺位桶草稿同批补(与 fork 同一哲学:owner=unassigned 的草稿**不算有效 decision**,
    // 所以补草稿只会把"无人认领"点名出来,结构上消不掉红 —— 防"以草稿洗绿"。
    const existingMissingKeys = new Set(
      existing
        .filter((d) => d?.bucket === 'missingTier')
        .map((d) => missingDecisionKey(d.kind, d.value)),
    )
    const m0 = judgeMissingTier({
      missing: aggregateMissingByValue(r?.rn?.rows, r?.web?.rows),
      decisions: existing,
      tier,
      today: isoToday(),
    })
    drafts = drafts.concat(
      m0.rowsNeeding
        .filter((x) => !existingMissingKeys.has(missingDecisionKey(x.kind, x.value)))
        .map((x) => ({
          bucket: 'missingTier',
          side: 'both',
          kind: x.kind,
          prop: '*',
          value: x.value,
          targetTier: nearestTier(x.kind, x.value, tier),
          owner: 'unassigned',
          expires: '',
          evidence:
            `未指派:缺位值 ${x.kind}=${x.value} 现读 RN ${x.rnN} 处 / web ${x.webN} 处,` +
            `未过准入线 ${x.line} 处/端(补表要过线,落档要定档);不得以草稿消红`,
        })),
    )
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
  console.log(
    '\n🧭 非色档分叉 decision 对账(复用 check-web-rn-style-tiers 的 runJudge;只读 --check)',
  )
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
  const m = out.missing
  if (m) {
    const mf = m.failures.filter((f) => !f.rule)
    console.log(`\n🟡 档表缺位(missingTier)准入裁决 —— 准入线 = 两端各自 ≥${m.line} 处`)
    console.log(
      `缺位值        : ${m.total} 种(达线可补表 ${m.extendable.length} / 在期决策已覆盖 ${m.settled.length} / 待决策 ${mf.length})`,
    )
    for (const x of m.extendable)
      console.log(
        `  ⬆️ 达线待补表:${x.kind}=${x.value}(RN ${x.rnN} / web ${x.webN})—— 本器不代写档表,补表后须跑 sync-css-tokens --write`,
      )
    if (mf.length === 0 && m.ledgerExpired === 0)
      console.log('  ✅ 每个缺位值要么达线待补,要么有在期 decision')
    else {
      console.log(`  ❌ 待决策 ${m.pending} 处:`)
      for (const f of mf.slice(0, 40))
        console.log(
          `    ✗ ${f.kind}=${f.value} RN ${f.rnN} / web ${f.webN}(未过线 ${f.line};属性 ${f.props.join('/')}):${f.reason}`,
        )
      if (mf.length > 40) console.log(`    … 另有 ${mf.length - 40} 条`)
      for (const f of m.failures.filter((x) => x.rule)) console.log(`    ✗ [${f.rule}] ${f.detail}`)
    }
    console.log(
      `  缺位账本      : ${m.ledgerTotal} 条(有效 ${m.ledgerValid} / 未指派 ${m.ledgerUnassigned} / 到期 ${m.ledgerExpired})`,
    )
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
    missing: {
      total: out.missing.total,
      line: out.missing.line,
      pending: out.missing.pending,
      extendable: out.missing.extendable.map((x) => ({
        kind: x.kind,
        value: x.value,
        rnN: x.rnN,
        webN: x.webN,
      })),
      settled: out.missing.settled.length,
      ledger: {
        total: out.missing.ledgerTotal,
        valid: out.missing.ledgerValid,
        unassigned: out.missing.ledgerUnassigned,
        expired: out.missing.ledgerExpired,
      },
    },
    ok: out.ok,
    failures: out.failures,
    rowsNeeding: out.rowsNeeding,
    missingFailures: out.missing.failures,
    missingRowsNeeding: out.missing.rowsNeeding,
  }
  if (jsonMode) console.log(JSON.stringify(json, null, 2))
  else if (gateMode)
    console.log(
      `STYLE-TIER-FORK-DECISIONS pending=${out.pending} allowed=${out.allowed} decisions=${out.decisionsValid}/${out.decisionsTotal} expired=${out.decisionsExpired} ` +
        `missing_pending=${out.missing.pending} missing_values=${out.missing.total}/${out.missing.settled.length}+${out.missing.extendable.length}达线 line=${out.missing.line} -> ${out.ok ? '绿' : '红'}`,
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
  missingDecisionKey,
  aggregateMissingByValue,
  judgeMissingTier,
  MISSING_TIER_ADMISSION_LINE,
  parseDecisions,
  mergeDecisions,
  serializeDecisions,
  writeDecisions,
  DECISIONS_REL,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
