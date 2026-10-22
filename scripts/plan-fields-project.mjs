// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 行内投影器物(规格 §4 第 2 步,2026-10-22 立,P2b)。
 *
 * 它做的是"把侧车已接管的那句归属，换成行首一段可读标头"：**加标头 + 删逐字等价的散文句**同批，
 * 否则投影只加长不动信息(实测:75 个侧车键里 44 枚单加标头会顶破 400 字档)。
 *
 * 三条不许漂的规矩：
 *  1. 只删**逐字等价**的散文句 —— 用抽取器同一份 `cleanOwner` 归一后必须与记录 owner 相等；
 *     不等价就是"侧车没覆盖这句"，删了就是丢信息(那是本仓最贵的一型:压缩切掉中段归属句 ⇒ 53 枚改判)。
 *  2. 每行改完必须过 `assertRowRewriteConservation`(勾选态 ∧ 认领租约 ∧ 归属桶) 与本器自己的
 *     主键/复合主键/租约逐维等值 —— 任一不过 ⇒ 这一行不动，并点名原因。
 *  3. 本器**不落台账**：它只产出 `live-doc-edit.mjs` 的整行替换档与"旧形态摘除声明"。
 *     落盘只走活文档正牌入口(CAS + 结构等值 + 门 71 自愈)，旧行逐字进
 *     `.ihui-agent/state/plan-row-drop.jsonl`(门 71 与 `scrub-declared-removals` 都读它) ——
 *     没有这份声明，别人滞后几个小时的工作树副本会把旧形态整批带回，而账面看起来是我改丢了。
 *
 * 用法：
 *   规划:`node scripts/plan-fields-project.mjs --dry-run [--batch N]`
 *   出件:`node scripts/plan-fields-project.mjs --emit <json路径> [--batch N]`(同时写旧形态声明)
 *   落地:`LIVE_DOC=PROJECT_PLAN.md LIVE_REPLACE_FILE=<json> LIVE_MSG=... node scripts/live-doc-edit.mjs`
 *   自证:`node scripts/plan-fields-project.mjs --self-test`
 */
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { renderHeader, stripHeader } from './lib/plan-field-line.mjs'
import { cleanOwner } from './plan-fields-extract.mjs'
import { assertRowRewriteConservation } from './lib/plan-row-conservation.mjs'
import {
  claimMarkOf,
  compositeKeyOf,
  dispositionOfV2,
  keyOfRow,
  parseTaskRows,
} from './lib/plan-task-index.mjs'
import { readFieldsFace, readPlan } from './plan-tasks.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const MAX_LEN = 400
const DROP_REL = path.join('.ihui-agent', 'state', 'plan-row-drop.jsonl')
/** 散文里那段归属话(与抽取器取的是同一个槽位,判定词表一律不在这里复制)。 */
const OWNER_SPAN_RE = /归属[:：]\s*([^,，。;；\n]{1,120})/

/** 逐维读数(交给断言与人工复量用;它不是第二把尺子,只是把四把既有尺子的读数摆出来)。
 *  `claim` 只取**标记本身**(不含列位):投影会在复选框与租约之间插进标头,牌的文字一字不变、
 *  列位必然挪 —— 守恒器物比的也正是 `.mark`(见 `assertRowRewriteConservation`),比列位会把
 *  合法投影判成"代摘他人认领"。 */
export function dimsOf(line) {
  return {
    key: keyOfRow(line),
    composite: compositeKeyOf(line),
    claim: claimMarkOf(line)?.mark ?? null,
  }
}

/**
 * 一行 + 一条记录 ⇒ 要不要动、怎么动。
 * 返回 `action`: `rewrite`(给新行) / `already`(标头已在位且一致) / `skip`(点名原因,一行不动)。
 */
export function planRow(line, rec, { maxLen = MAX_LEN } = {}) {
  const want = renderHeader(rec)
  const informative =
    String(rec.owner ?? '').trim() !== '' || String(rec.blocking ?? '').trim() !== ''
  if (want === '' || !informative)
    return { action: 'skip', reason: '记录里没有可渲染的信息(owner 与 blocking 都空) ⇒ 不造空标头' }
  if (line.includes(want)) return { action: 'already' }

  const bare = stripHeader(line)
  const prefix = /^\s*-\s*\[[ xX]\]\s*/.exec(bare)
  if (!prefix) return { action: 'skip', reason: '不是登记行形,不动' }
  const rest = bare.slice(prefix[0].length).replace(/^\s+/, '')
  const span = OWNER_SPAN_RE.exec(rest)
  if (span && cleanOwner(span[1]) !== String(rec.owner ?? '').trim())
    return {
      action: 'skip',
      reason: `散文说的持有人与记录不等价(散文=${cleanOwner(span[1]) ?? '(截后无意义)'} / 记录=${rec.owner ?? '(空)'})⇒ 记录多半已被别人改散文顶掉,先复算侧车再投影`,
    }
  // **只做加法**:一行正文一个字符都不删。删掉"已被侧车接管的那句散文"看着是等价的,实测会把
  // 复合主键挪掉(现读:74 枚里两枚一插标头就取不到键,而删散文句会挪更多)—— 复合主键是
  // 同题查重(F4/门 203)、归并裁决账、守恒器物共同的寻行键,挪键 = 把别人做完的事当成新事项。
  const candidate = prefix[0] + want + ' ' + rest
  if (candidate.length > maxLen)
    return {
      action: 'skip',
      reason: `投影后 ${candidate.length} 字 > 预算 ${maxLen}(差值棘轮会把这算成我新增的违规)`,
      len: candidate.length,
    }

  const bad = assertRowRewriteConservation({ oldLine: line, newLine: candidate, newRec: rec })
  const a = dimsOf(line)
  const b = dimsOf(candidate)
  const map = new Map([[rec.key, rec]])
  const bucketOldFields = dispositionOfV2({ line, fields: { map } }).bucket
  const bucketNewFields = dispositionOfV2({ line: candidate, fields: { map } }).bucket
  const dims = { ...a, conserved: false, bucketOldFields, bucketNewFields }
  if (bad.length > 0) return { action: 'skip', reason: '守恒违规:' + bad.join(' | '), dims }
  for (const dim of ['key', 'composite', 'claim'])
    if (a[dim] !== b[dim])
      return {
        action: 'skip',
        reason: `整行改写把 ${dim} 维改动了(${a[dim]} ⇄ ${b[dim]})⇒ 不动`,
        dims,
      }
  if (bucketOldFields !== bucketNewFields)
    return {
      action: 'skip',
      reason: `侧车权威前后桶变了(${bucketOldFields} ⇄ ${bucketNewFields})⇒ 不动`,
      dims,
    }
  dims.conserved = true
  return { action: 'rewrite', line: candidate, additive: true, len: candidate.length, dims }
}

/** 全量规划:台账面 ⊕ 同轮侧车面 ⇒ 三类读数。纯 IO 只在这一个出口里发生。 */
export function planAll({ root = ROOT, face = 'head', maxLen = MAX_LEN } = {}) {
  const doc = readPlan(root, face)
  const side = readFieldsFace(root, face)
  if (side.undetermined) return { undetermined: true, why: side.why ?? '(未点名原因)' }
  const rows = parseTaskRows(doc).filter((r) => r.state === 'open')
  const rewrite = []
  const skip = []
  let already = 0
  let noRecord = 0
  for (const r of rows) {
    const key = compositeKeyOf(r.raw)
    const rec = key ? (side.map.get(key) ?? null) : null
    if (!rec) {
      noRecord++
      continue
    }
    const p = planRow(r.raw, rec, { maxLen })
    if (p.action === 'rewrite')
      rewrite.push({ before: r.raw, after: p.line, delta: p.line.length - r.raw.length, len: p.len, key })
    else if (p.action === 'already') already++
    else skip.push({ key, reason: p.reason ?? '(未点名)' })
  }
  return {
    undetermined: false,
    face,
    rows: rows.length,
    records: side.map.size,
    noRecord,
    already,
    rewrite,
    skip,
    totalDelta: rewrite.reduce((s, x) => s + x.delta, 0),
  }
}

function reportPlan(p, { limit, showSkip }) {
  if (p.undetermined) {
    console.log(`⚠️ 未判定 —— ${p.why}`)
    console.log('PROJECT-RESULT state=undetermined rewrite=0 already=0 skip=0')
    return 2
  }
  console.log(
    `判定面:${p.face} 台账未勾行 ${p.rows} / 侧车记录 ${p.records}(其中 ${p.noRecord} 行还没有记录)`,
  )
  console.log(
    `可投影 ${p.rewrite.length} 行(只做加法,合计加长 ${p.totalDelta} 字) / 标头已在位 ${p.already} 行 / 不动 ${p.skip.length} 行`,
  )
  const shown = p.rewrite.slice(0, limit)
  for (const r of shown)
    console.log(`  · ${r.key} ${r.before.length}→${r.len} 字(加 ${r.delta})`)
  if (p.rewrite.length > shown.length)
    console.log(`  …另 ${p.rewrite.length - shown.length} 行未逐条打印`)
  if (showSkip) for (const s of p.skip.slice(0, limit)) console.log(`  ✗ ${s.key} —— ${s.reason}`)
  if (p.skip.length > (showSkip ? limit : 0) && showSkip)
    console.log(`  ✗ 另 ${p.skip.length - limit} 行同型未逐条打印`)
  console.log(
    `PROJECT-RESULT state=${p.rewrite.length > 0 ? 'changed' : 'clean'} rewrite=${p.rewrite.length} already=${p.already} skip=${p.skip.length}`,
  )
  return 0
}

/** 出件:整行替换档 + 旧形态摘除声明(声明必须在落地前就在位,门 71 与收编器都读它)。 */
function emit(p, jsonPath, batch) {
  const take = p.rewrite.slice(0, batch)
  if (take.length === 0) {
    console.log('本轮没有可投影的行 ⇒ 不出件(空替换档会让活文档器物报"未命中"而不是"没活")')
    return 0
  }
  writeFileSync(
    jsonPath,
    JSON.stringify(
      take.map((r) => ({ before: r.before, after: r.after })),
      null,
      2,
    ),
    'utf8',
  )
  const abs = path.join(ROOT, DROP_REL)
  mkdirSync(path.dirname(abs), { recursive: true })
  const stamp = new Date().toISOString()
  for (const r of take)
    appendFileSync(
      abs,
      JSON.stringify({
        at: stamp,
        seat: 'plan-fields-project',
        file: 'PROJECT_PLAN.md',
        rowBefore: r.before,
        rowAfter: r.after,
        why: '行内投影:标头替换等价的散文归属句(逐维守恒已过)',
      }) + '\n',
      'utf8',
    )
  console.log(`已出件 ${take.length} 条整行替换 → ${path.relative(ROOT, jsonPath)}`)
  console.log(
    `旧形态逐行声明 ${take.length} 条 → ${DROP_REL}(在位后落地;落地失败也不回滚声明——它只豁免,不害人)`,
  )
  return 0
}

function selfTest() {
  const checks = []
  const ok = (n, c) => checks.push([n, !!c])
  const line = '- [ ] **G-1 甲题** 细节一:归属:门 130 持有人,细节二'
  const rec = {
    key: compositeKeyOf(line),
    owner: '门 130 持有人',
    waiting: 'none',
    updatedAt: '2026-10-22T00:00:00.000Z',
  }
  const p = planRow(line, rec)
  ok('T1 等价散文句可换成标头', p.action === 'rewrite' && !p.line.includes('归属:门 130 持有人'))
  ok('T2 长度近似不变', Math.abs(p.line.length - line.length) <= 4)
  ok('T3 幂等(再跑一次判 already)', planRow(p.line, rec).action === 'already')
  const mismatch = '- [ ] **G-2 乙题** 归属:另一个组持有'
  ok(
    'T4 不等价就不动',
    planRow(mismatch, { ...rec, key: compositeKeyOf(mismatch) }).action === 'skip',
  )
  const long = '- [ ] **G-3 丙题** 归属:门 130 持有人 ' + '细'.repeat(397)
  ok('T5 顶预算不动', planRow(long, { ...rec, key: compositeKeyOf(long) }).action === 'skip')
  ok(
    'T6 无信息记录不造空标头',
    planRow('- [ ] **G-4 丁题** x', {
      key: 'G-4#丁题x',
      waiting: 'none',
      updatedAt: '2026-10-22T00:00:00.000Z',
    }).action === 'skip',
  )
  const fails = checks.filter(([, v]) => !v).length
  for (const [n, v] of checks) console.log(`${v ? '✅' : '❌'} ${n}`)
  console.log(`\n自检:${checks.length - fails} 通过 / ${fails} 失败`)
  return fails === 0 ? 0 : 1
}

function main() {
  const argv = process.argv.slice(2)
  const has = (f) => argv.includes(f)
  if (has('--self-test')) return selfTest()
  if (has('--staged') && has('--worktree')) {
    console.log('❌ 用法错 —— --staged 与 --worktree 不得同用(§0.4)')
    return 2
  }
  const face = has('--staged') ? 'staged' : has('--worktree') ? 'worktree' : 'head'
  const at = argv.indexOf('--batch')
  const batch = at > -1 ? Number(argv[at + 1]) : 10
  if (!Number.isInteger(batch) || batch < 1 || batch > 10) {
    console.log(
      '❌ 用法错 —— --batch 必须是 1..10 的整数(共享活文档上每批最多 10 行,超了就不是"小批"而是批量改写)',
    )
    return 2
  }
  if (!has('--dry-run') && !has('--emit')) {
    console.log(
      '❌ 用法 —— 必须给 --dry-run 或 --emit <json路径>(不给默认模式是刻意的:本器能改台账行文本)',
    )
    return 2
  }
  const p = planAll({ root: ROOT, face })
  const code = reportPlan(p, { limit: batch, showSkip: has('--dry-run') })
  if (code !== 0 || !has('--emit')) return code
  const jsonPath = argv[argv.indexOf('--emit') + 1]
  if (!jsonPath || jsonPath.startsWith('--')) {
    console.log('❌ 用法错 —— --emit 需要紧跟一个 json 路径')
    return 2
  }
  if (p.undetermined) return code
  return emit(p, path.resolve(ROOT, jsonPath), batch)
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) {
  try {
    process.exit(main())
  } catch (e) {
    console.error(`❌ ${e?.message ?? e}\n${e?.stack ?? ''}`)
    process.exit(2)
  }
}

export const __test__ = { planRow, planAll, dimsOf, MAX_LEN }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
