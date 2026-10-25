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
 *     且只删记录 owner 本字那一截：`归属:某某(补充) —— 叙述` 里的括号补充与叙述一律留着，
 *     宁可少删也不把侧车没覆盖的话一起吞掉。
 *  2. 每行改完必须过 `assertRowRewriteConservation`(勾选态 ∧ 认领租约 ∧ 归属桶) 与本器自己的
 *     主键/复合主键/租约逐维等值 —— 任一不过 ⇒ 这一行不动，并点名原因。
 *     删散文句会挪复合主键时，这条断言就是"不许删"的闸(不是注释里的一句承诺)。
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

import { parseHeader, renderHeader, stripHeader } from './lib/plan-field-line.mjs'
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
import { flagValue } from './lib/flag-value.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const MAX_LEN = 400
/** 规格 §4.3:每批 ≤40 行(与 `strip-stale-closed-rows` 的批量口径同)。 */
export const MAX_BATCH = 40
const DROP_REL = path.join('.ihui-agent', 'state', 'plan-row-drop.jsonl')
/** 散文里那段归属话(与抽取器取的是同一个槽位,判定词表一律不在这里复制)。 */
const OWNER_SPAN_RE = /归属[:：]\s*([^,，。;；\n]{1,120})/

/**
 * 只切掉"记录 owner 本字"那一截(含 `归属:` 标签),不切它后面的括号补充与叙述 ——
 * `归属:守门 130(计划…)持有人 —— 叙述` 只删到 `守门 130`,`(计划…)持有人 —— 叙述` 全留。
 * 返回 `null` ⇒ 这句散文不能逐字等价地删(被 48 字截断 / 后接字不是边界),调用方退回"只加标头"。
 */
function cutOwnerProse(rest, owner) {
  if (!owner) return null
  const m = OWNER_SPAN_RE.exec(rest)
  if (!m) return null
  const raw = m[1]
  const lead = raw.length - raw.trimStart().length
  if (!raw.trimStart().startsWith(owner)) return null
  const start = m.index + m[0].length - raw.length + lead
  let end = start + owner.length
  const next = rest[end] ?? ''
  // 后接字必须是分隔/边界;否则记录里的 owner 只是散文句的前缀(例如被 48 字截断),删了就是吞话。
  if (next !== '' && !/[\s,，;；:：。.、)）(（\]】*—–]/.test(next)) return null
  let from = m.index
  const before = rest[from - 1] ?? ''
  const tail = rest[end - 1] ?? ''
  if ((before === '(' || before === '（') && (next === ')' || next === '）' || tail === ')' || tail === '）')) {
    // `(归属:某某)` 整组只剩这一句 ⇒ 连括号一起摘,避免留下空括号
    from -= 1
  } else if (/[,，;；]/.test(before)) {
    from -= 1
    while (/\s/.test(rest[end] ?? '')) end += 1
  } else if (/[,，;；]/.test(next)) {
    end += 1
    while (/\s/.test(rest[end] ?? '')) end += 1
  }
  return { line: rest.slice(0, from) + rest.slice(end), removed: end - from }
}

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
/** 改写的四道公共闸(守恒 / 主键三面 / 侧车权威桶前后不变);两个分支共用一份。 */
function validateRewrite(line, candidate, rec) {
  const bad = assertRowRewriteConservation({ oldLine: line, newLine: candidate, newRec: rec })
  const a = dimsOf(line)
  const b = dimsOf(candidate)
  const map = new Map([[rec.key, rec]])
  const bucketOldFields = dispositionOfV2({ line, fields: { map } }).bucket
  const bucketNewFields = dispositionOfV2({ line: candidate, fields: { map } }).bucket
  const dims = { ...a, conserved: false, bucketOldFields, bucketNewFields }
  if (bad.length > 0) return { ok: false, reason: '守恒违规:' + bad.join(' | '), dims }
  for (const dim of ['key', 'composite', 'claim'])
    if (a[dim] !== b[dim])
      return {
        ok: false,
        reason: `整行改写把 ${dim} 维改动了(${a[dim]} ⇄ ${b[dim]})⇒ 不动`,
        dims,
      }
  if (bucketOldFields !== bucketNewFields)
    return { ok: false, reason: `侧车权威前后桶变了(${bucketOldFields} ⇄ ${bucketNewFields})⇒ 不动`, dims }
  dims.conserved = true
  return { ok: true, dims }
}

export function planRow(line, rec, { maxLen = MAX_LEN } = {}) {
  const want = renderHeader(rec)
  const informative =
    String(rec.owner ?? '').trim() !== '' || String(rec.blocking ?? '').trim() !== ''
  if (want === '' || !informative) {
    // 侧车没有可渲染的信息 ⇒ 陈旧标头必须被**摘除**:它已不可能再被渲染出来,留着只会让
    // 门 234 A2 永远报"标头⇄侧车不一致"。摘除同样是整行改写,走同一套守恒/主键/桶断言。
    const hp = parseHeader(line)
    // 读得回的标头、以及 malformed(含旧版截断 `…`)都算"有标头形态":后者更要摘 ——
    // 它永远不会被重渲染成有效形态(parse 拒 `…`),留着就是门 234 A2 的恒红源。
    if (!hp.rec && !hp.malformed)
      return { action: 'skip', reason: '记录里没有可渲染的信息(owner 与 blocking 都空) ⇒ 不造空标头' }
    const bare = stripHeader(line)
    if (bare === line) return { action: 'skip', reason: '标头形态读不回(非本层生成的形态),不代裁' }
    const v = validateRewrite(line, bare, rec)
    if (!v.ok) return { action: 'skip', reason: v.reason, dims: v.dims }
    return { action: 'rewrite', line: bare, removedProse: 0, len: bare.length, dims: v.dims }
  }
  if (line.includes(want)) return { action: 'already' }

  const bare = stripHeader(line)
  const prefix = /^\s*-\s*\[[ xX]\]\s*/.exec(bare)
  if (!prefix) return { action: 'skip', reason: '不是登记行形,不动' }
  let rest = bare.slice(prefix[0].length).replace(/^\s+/, '')
  const owner = String(rec.owner ?? '').trim()
  const span = OWNER_SPAN_RE.exec(rest)
  if (span && cleanOwner(span[1]) !== owner)
    return {
      action: 'skip',
      reason: `散文说的持有人与记录不等价(散文=${cleanOwner(span[1]) ?? '(截后无意义)'} / 记录=${rec.owner ?? '(空)'})⇒ 记录多半已被别人改散文顶掉,先复算侧车再投影`,
    }
  // **加标头 + 删逐字等价的归属句同批**(规格 §4.3):只加标头会让 44/75 行顶破 400 字档,
  // 只删不补则判据落空。删的仅是记录 owner 的本字那一截,括号补充与后续叙述一律留(见 cutOwnerProse)。
  // 删散文会挪复合主键时由下面守恒断言拒绝 —— 那是"不许删"的闸,不是注释里的承诺。
  const cut = span ? cutOwnerProse(rest, owner) : null
  const restBeforeCut = rest
  if (cut) rest = cut.line
  // **预算只拦"新增长行"**,不是"候选超预算就拦":门 63(`scripts/check-plan-row-length.mjs`)的
  // 违规身份是 `violationKey` = 复合主键(编号 + 题面前缀),存量长行被改写时仍按同一主键认作存量。
  // 所以"原行本就 >maxLen、候选也 >maxLen"不是新增,拦它只会让存量长行永远投不了影;
  // 只有"原行 ≤maxLen 而候选 >maxLen"才会让门 63 读到一条新的超长主键。
  const candidate = prefix[0] + want + ' ' + rest
  if (candidate.length > maxLen && line.length <= maxLen)
    return {
      action: 'skip',
      reason: `投影后 ${candidate.length} 字 > 预算 ${maxLen},而原行 ${line.length} 字本就在预算内 ⇒ 会新增一条长行(门 63 按复合主键认领存量,改写存量长行不算新增)`,
      len: candidate.length,
    }

  let v = validateRewrite(line, candidate, rec)
  let finalLine = candidate
  let removed = cut?.removed ?? 0
  if (!v.ok && cut) {
    // 删散文是**长度优化**,不是投影的必要条件:若删了会让散文面的归属桶漂掉
    // (实测 G-47/G-48/G-49:散文 `归属:…` 被删后,行内标头的 owner 不被 prose 判据识别,
    // owned → actionable 被守恒闸拒绝),就退回"只加标头、保留散文句"再验一次。
    const keepsProse = prefix[0] + want + ' ' + restBeforeCut
    if (keepsProse.length <= maxLen || line.length > maxLen) {
      const v2 = validateRewrite(line, keepsProse, rec)
      if (v2.ok) {
        v = v2
        finalLine = keepsProse
        removed = 0
      }
    }
  }
  if (!v.ok) return { action: 'skip', reason: v.reason, dims: v.dims }
  return {
    action: 'rewrite',
    line: finalLine,
    removedProse: removed,
    len: finalLine.length,
    dims: v.dims,
  }
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
      // 没有侧车记录、却还挂着标头(尤其 malformed `…`)的行也要过一遍:
      // 空记录渲染不出任何标头 ⇒ 走 planRow 的摘除分支,清掉陈旧投影(门 234 A2 的恒红源)。
      const hp = parseHeader(r.raw)
      if (hp.rec || hp.malformed) {
        const synthetic = { key, waiting: 'none', updatedAt: new Date(0).toISOString() }
        const p = planRow(r.raw, synthetic, { maxLen })
        if (p.action === 'rewrite')
          rewrite.push({
            before: r.raw,
            after: p.line,
            delta: p.line.length - r.raw.length,
            len: p.len,
            removedProse: 0,
            key,
          })
        else if (p.action !== 'already') skip.push({ key, reason: p.reason ?? '(未点名)' })
      }
      continue
    }
    const p = planRow(r.raw, rec, { maxLen })
    if (p.action === 'rewrite')
      rewrite.push({
        before: r.raw,
        after: p.line,
        delta: p.line.length - r.raw.length,
        len: p.len,
        removedProse: p.removedProse,
        key,
      })
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
    totalRemoved: rewrite.reduce((s, x) => s + x.removedProse, 0),
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
    `可投影 ${p.rewrite.length} 行(加标头并删等价归属句 ${p.totalRemoved} 字,净 ${p.totalDelta >= 0 ? '加' : '减'} ${Math.abs(p.totalDelta)} 字) / 标头已在位 ${p.already} 行 / 不动 ${p.skip.length} 行`,
  )
  const shown = p.rewrite.slice(0, limit)
  for (const r of shown)
    console.log(`  · ${r.key} ${r.before.length}→${r.len} 字(净 ${r.delta >= 0 ? '+' : ''}${r.delta},删句 ${r.removedProse})`)
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

/** `--batch` 解析:未给 ⇒ 10;非 1..MAX_BATCH 整数 ⇒ null(交给 main 报用法错)。 */
export function parseBatchArg(argv, fallback = 10) {
  const at = argv.indexOf('--batch')
  if (at < 0) return fallback
  const n = Number(argv[at + 1])
  return Number.isInteger(n) && n >= 1 && n <= MAX_BATCH ? n : null
}

/** 出件:整行替换档 + 旧形态摘除声明(声明必须在落地前就在位,门 71 与收编器都读它)。
 *  `opts.root/dropRel` 只为测试注入临时落点;生产调用一律用默认根,不得拿它绕开正式状态文件。 */
export function emit(p, jsonPath, batch, { root = ROOT, dropRel = DROP_REL } = {}) {
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
  const abs = path.join(root, dropRel)
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
        why: '行内投影:加标头并删逐字等价的散文归属句(逐维守恒已过)',
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
  ok(
    'T1 标头在位且逐字等价的归属句同批删掉,其余正文一字不动',
    p.action === 'rewrite' &&
      p.line.includes('细节一:细节二') &&
      !p.line.includes('归属:门 130 持有人'),
  )
  ok(
    'T2 净变化 = 标头 + 一个空格 − 删掉的归属句(逐字可核对)',
    p.action === 'rewrite' &&
      p.line.length - line.length ===
        renderHeader(rec).length + 1 - p.removedProse &&
      p.removedProse > 0,
  )
  ok('T3 幂等(再跑一次判 already)', planRow(p.line, rec).action === 'already')
  const mismatch = '- [ ] **G-2 乙题** 归属:另一个组持有'
  ok(
    'T4 不等价就不动',
    planRow(mismatch, { ...rec, key: compositeKeyOf(mismatch) }).action === 'skip',
  )
  const near = '- [ ] **G-3 丙题说明** 不归本线 ' + '细'.repeat(373)
  const pNear = planRow(near, {
    ...rec,
    key: compositeKeyOf(near),
    waiting: 'env',
    blocking: '细'.repeat(33),
  })
  ok(
    'T5 原行在预算内被顶过预算 ⇒ 不动(只有这一档才会新增长行)',
    near.length <= 400 && pNear.action === 'skip' && /原行/.test(pNear.reason ?? ''),
  )
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
  const batch = parseBatchArg(argv)
  if (batch === null) {
    console.log(
      `❌ 用法错 —— --batch 必须是 1..${MAX_BATCH} 的整数(规格 §4.3:每批最多 ${MAX_BATCH} 行,超了就不是"小批"而是批量改写)`,
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
  // --emit 取值走 G-322 单源:紧邻 token 是旗标/结尾无值/空串一律算无效(与旧校验同语义,
  // 值被旗标顶掉时不再经 startsWith 分支,统一按"没给合法值"点名)。
  const jsonPath = flagValue(argv, '--emit').valid ? flagValue(argv, '--emit').value : null
  if (!jsonPath) {
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

export const __test__ = {
  planRow,
  planAll,
  dimsOf,
  emit,
  parseBatchArg,
  MAX_LEN,
  MAX_BATCH,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
