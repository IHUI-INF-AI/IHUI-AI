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
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { readDecisions } from './deploy-decision.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DEFAULT_DECISIONS = join(ROOT, '.ihui-agent', 'deploy-decisions.jsonl')
const DEFAULT_LEDGER = join(ROOT, '.ihui-agent', 'state', 'evolution-retro.jsonl')

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
  const now = Date.now()

  if (!existsSync(decisionsPath)) {
    const payload = { v: SCHEMA_VERSION, overall: 'undetermined', why: `决策台账不存在(部署环尚未产生过决策):${decisionsPath}` }
    if (args.json) console.log(JSON.stringify(payload))
    else console.log(`❓ 进化回流:未判定 —— ${payload.why}`)
    return 2
  }

  let decisions
  try {
    decisions = readDecisions(decisionsPath)
  } catch (e) {
    const payload = { v: SCHEMA_VERSION, overall: 'undetermined', why: `决策台账读不了:${e?.message ?? e}` }
    if (args.json) console.log(JSON.stringify(payload))
    else console.log(`❓ 进化回流:未判定 —— ${payload.why}`)
    return 2
  }

  const buckets = scanWindow(decisions, { now, windowHours })
  const plan = planDispatch(buckets, readRetroLedger(undefined, ledgerPath), { now, windowHours, minCount })

  if (!args['dry-run']) {
    for (const it of plan.dispatched) appendRetro(ledgerPath, it)
  }

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
    }))
  } else {
    console.log(`进化回流:窗内失败桶 ${buckets.length} 个 / 决策行 ${decisions.length} 条(窗 ${windowHours}h,阈 ${minCount})`)
    for (const it of plan.dispatched) console.log(formatDispatchLine(it))
    for (const it of plan.skipped) console.log(`↻ 跳过派单(24h 内已派):${it.bucket} ×${it.count}`)
    const summary = formatSummary(plan.dispatched, plan.skipped, minCount)
    if (summary) console.log(`\n${summary}`)
    if (!plan.dispatched.length && !plan.skipped.length) console.log('✅ 无复发归因(窗内没有 ≥阈 的失败桶)')
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
  DEFAULT_DECISIONS,
  DEFAULT_LEDGER,
  MAX_SUMMARY_LINES,
  DEFAULT_MIN_COUNT,
  DEFAULT_WINDOW_HOURS,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
