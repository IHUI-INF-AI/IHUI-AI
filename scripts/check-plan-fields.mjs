// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 守门 台账侧车字段一致性(2026-10-22 立,blocking 档,只判差值维)。规格:
 * `docs/superpowers/specs/2026-10-22-plan-ledger-schema-design.md` §4 第 3 步。
 *
 * 判两维,取材一律同面同轮(§0.4:全量档 HEAD blob、`--staged` 索引 blob、`--worktree` 只作人工逃生舱):
 *  A1 **本次提交新带入**的未勾登记行里,既没有行内租约、也没有侧车记录的枚数。
 *     租约算交代(它已机器可读地指名持有者),侧车记录算交代(它结构化地指名持有者或等待条件),
 *     两者皆无才是 P1 要收的那种"靠散文猜"的新账 —— 存量一律只报数(下面 stock),
 *     因为 237 行历史账不可能在上线当天补齐:那是一台与任何提交都无关的恒红门(§12e)。
 *  A2 行内投影标头与侧车不一致:读不回(malformed)或投影 `renderHeader(侧车)` 不在行内 ⇒ 点名。
 *     投影本身属 P2,所以今天 A2 的射程只有"手工写了个不对的标头"这一型 —— 正是必须现在就拦的那型。
 *
 * 为什么 A1 只在有基准面时才算:全量档(HEAD 面)结构上没有"本次新增"这一维。拿不到基准就写成 0,
 * 等于把"没判"报成"判过"(§0.3),所以那一档明写 `a1=NA` 且不参与 verdict。
 *
 * 为什么可以 blocking(§12e/票 G-965):本门的 verdict **只由差值维构成** —— A1 仅在拿得到基准面时
 * 数"本次新带入"的行,A2 只数被审面上标头与侧车不一致的枚数;存量 stock 只报数、不进判定。
 * 于是全量档存量 109 枚缺侧车仍是 exit 0 —— 不构成与提交内容无关的恒红门;存量维(哪天把 stock
 * 也判红)仍未升档,那一步的前置才是存量归零。
 *
 * 机读末行:`PLAN-FIELDS-RESULT state=clean|warn|red|undetermined a1=<n|NA> a2=<n> stock=<n> face=<head|staged|worktree>`
 * 退出码:0 = clean/warn / 1 = red / 2 = 未判定(取不到台账或侧车面)。
 */
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { MAX as HEADER_MAX } from './lib/plan-field-line.mjs'
import { parseHeader, renderHeader, stripHeader } from './lib/plan-field-line.mjs'
import { claimMarkOf, compositeKeyOf, parseTaskRows, titleOf } from './lib/plan-task-index.mjs'
import { readFieldsFace, readPlan } from './plan-tasks.mjs'
import { mkScratch, rmScratch } from './lib/scratch-dir.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const LABEL = { head: 'HEAD blob', staged: '索引 blob', worktree: '工作树(人工逃生舱)' }

/** 未判定臂的夹具落**仓外** scratch(§15b):那里没有 git 库,取材必然失败 ⇒ 这一臂不是摆设。 */
function withScratch(fn) {
  const dir = mkScratch('check-plan-fields')
  try {
    return fn(dir)
  } finally {
    rmScratch(dir)
  }
}

const isOpenRow = (r) => r.state === 'open'
const hasLease = (line) => claimMarkOf(line)?.form === 'lease'

/**
 * 两维判定。纯函数:输入是已取好的行与已读好的侧车映射,不碰 git ——
 * 这样 `--self-test` 与镜像测试能用同一份实现跑构造面,而不是另抄一套判据(§22c)。
 */
export function judge(rows, { baseRowTexts = null, map = new Map() } = {}) {
  const a1List = []
  const a2List = []
  let stock = 0
  for (const r of rows.filter(isOpenRow)) {
    const line = r.raw
    const key = compositeKeyOf(line)
    const rec = key ? (map.get(key) ?? null) : null
    if (!rec && !hasLease(line)) {
      if (baseRowTexts && !baseRowTexts.has(line))
        a1List.push(`  L${r.line}  ${key ?? '(无主键)'}  ${titleOf(line) ?? clip(line)}`)
      else stock++
    }
    const p = parseHeader(line)
    if (p.malformed) {
      a2List.push(`  L${r.line}  标头读不回(malformed):${clip(headerOf(line))}`)
    } else if (p.rec && rec) {
      const want = renderHeader(rec)
      if (want !== '' && !line.includes(want))
        a2List.push(
          `  L${r.line}  标头 ⇄ 侧车不一致 行内=${clip(headerOf(line))} 侧车=${clip(want)}`,
        )
    }
  }
  return {
    a1: a1List.length,
    a2: a2List.length,
    stock,
    hasBase: !!baseRowTexts,
    a1List,
    a2List,
  }
}

/** 行内那一段投影标头的原文(复用单源 stripHeader 的定位,不写第二份括号语法)。 */
function headerOf(line) {
  const stripped = stripHeader(line)
  if (stripped === line) return ''
  const m = /^\s*-\s*\[[ xX]\]\s*/.exec(stripped)
  const prefixLen = m ? m[0].length : 0
  const tail = stripped.slice(prefixLen)
  return line.slice(prefixLen, line.length - tail.length).trim()
}

const clip = (s, n = HEADER_MAX + 8) =>
  String(s ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, n)

/** 取两面(台账 + 侧车)。任一面取不到 ⇒ 未判定,绝不回落另一个面(§0.4)。 */
export function readFaces(root = ROOT, face = 'head') {
  let content
  try {
    content = readPlan(root, face)
  } catch (e) {
    return {
      ok: false,
      why: `${LABEL[face] ?? face} 取不到 PROJECT_PLAN.md:${String(e?.message ?? e).split('\n')[0]}`,
    }
  }
  const side = readFieldsFace(root, face)
  if (side.undetermined) return { ok: false, why: `侧车面取不到:${side.why ?? '(未点名原因)'}` }
  let base = null
  if (face !== 'head') {
    try {
      base = new Set(
        parseTaskRows(readPlan(root, 'head'))
          .filter(isOpenRow)
          .map((r) => r.raw),
      )
    } catch (e) {
      return {
        ok: false,
        why: `基准面(HEAD)取不到 ⇒ A1 未判定:${String(e?.message ?? e).split('\n')[0]}`,
      }
    }
  }
  return {
    ok: true,
    rows: parseTaskRows(content),
    baseRowTexts: base,
    map: side.map,
    malformedSide: side.malformed ?? 0,
  }
}

export function verdict(v, face) {
  const a1Text = v.hasBase ? String(v.a1) : 'NA'
  const red = v.a2 > 0 || (v.hasBase && v.a1 > 0)
  const state = red ? 'red' : v.stock > 0 ? 'warn' : 'clean'
  return {
    state,
    code: red ? 1 : 0,
    line: `PLAN-FIELDS-RESULT state=${state} a1=${a1Text} a2=${v.a2} stock=${v.stock} face=${face}`,
  }
}

function run({ root = ROOT, face = 'head' } = {}) {
  const f = readFaces(root, face)
  if (!f.ok) {
    console.log(`⚠️ 未判定 —— ${f.why}`)
    console.log(`PLAN-FIELDS-RESULT state=undetermined a1=NA a2=NA stock=NA face=${face}`)
    return 2
  }
  const v = judge(f.rows, { baseRowTexts: f.baseRowTexts, map: f.map })
  console.log(
    `判定面:${LABEL[face]} ⊕ 同轮侧车 ${f.map.size} 条记录(侧车畸形行 ${f.malformedSide} 条,畸形行不参与判定但必须报名)` +
      (v.hasBase ? '' : ' —— 全量档没有"本次新增"这一维 ⇒ A1=NA,不得读成 0'),
  )
  console.log(
    `A1 新增行缺交代 ${v.hasBase ? v.a1 : 'NA'} 枚 / A2 标头不一致 ${v.a2} 枚 / 存量缺侧车记录 ${v.stock} 枚(只报数)`,
  )
  for (const l of v.a1List.slice(0, 20)) console.log(`  · A1 ${l}`)
  if (v.a1List.length > 20) console.log(`  · A1 …另 ${v.a1List.length - 20} 枚同型未逐条打印`)
  for (const l of v.a2List.slice(0, 20)) console.log(`  · A2 ${l}`)
  if (v.a2List.length > 20) console.log(`  · A2 …另 ${v.a2List.length - 20} 枚同型未逐条打印`)
  if (v.stock > 0)
    console.log(
      `   存量 ${v.stock} 枚 = P1 的迁移分母,结清出口:node scripts/plan-fields-extract.mjs --apply(只搬说辞,不改一行台账文本)`,
    )
  const r = verdict(v, face)
  console.log(r.line)
  return r.code
}

/**
 * 自检:全部跑**构造面**,一条真台账都不碰。含阳性对照(A1/A2 必须能报出来)与未判定臂
 * (取不到面 ⇒ 不记绿也不冒红)。
 */
function selfTest() {
  const checks = []
  const ok = (name, cond) => checks.push([name, !!cond])
  const mk = (raw, line = 1) => ({ line, state: 'open', raw, key: compositeKeyOf(raw) })
  const fresh = '- [ ] G-1 甲 细节'
  const leased = '- [ ] （进行中@2026-10-22/holder-x） G-2 乙 细节'
  const rec = {
    key: compositeKeyOf(fresh),
    owner: '门 130 持有人',
    waiting: 'none',
    updatedAt: '2026-10-22T00:00:00.000Z',
  }

  const v1 = judge([mk(fresh)], { baseRowTexts: new Set(), map: new Map() })
  ok('S1 新行无租约无侧车 ⇒ A1=1(阳性对照)', v1.a1 === 1 && v1.stock === 0)
  const v2 = judge([mk(fresh)], { baseRowTexts: null, map: new Map() })
  ok(
    'S2 无基准面 ⇒ A1 不参与、改报存量(全量档不冒新增)',
    v2.a1 === 0 && v2.stock === 1 && !v2.hasBase,
  )
  const v3 = judge([mk(fresh)], { baseRowTexts: new Set([fresh]), map: new Map() })
  ok('S3 同一行已在基准面 ⇒ 不算新增', v3.a1 === 0 && v3.stock === 1)
  ok(
    'S4 完整租约即交代 ⇒ A1 不重复逼侧车',
    judge([mk(leased)], { baseRowTexts: new Set(), map: new Map() }).a1 === 0,
  )
  const v5 = judge([mk(fresh)], { baseRowTexts: new Set(), map: new Map([[rec.key, rec]]) })
  ok('S5 有侧车记录 ⇒ A1=0', v5.a1 === 0 && v5.stock === 0)

  const want = renderHeader(rec)
  const goodRow = `- [ ] ${want} G-1 甲 细节`
  const badRow = `- [ ] 〔归:另一个人〕 G-1 甲 细节`
  const map1 = new Map([[rec.key, rec]])
  ok('S6 标头与侧车一致 ⇒ A2=0(阳性对照的前半)', judge([mk(goodRow)], { map: map1 }).a2 === 0)
  ok('S7 标头与侧车不一致 ⇒ A2=1(阳性对照)', judge([mk(badRow)], { map: map1 }).a2 === 1)
  ok('S8 标头读不回 ⇒ A2=1', judge([mk('- [ ] 〔归:甲…〕 G-1 丙')], { map: map1 }).a2 === 1)
  ok('S9 headerOf 取回的行内原文就是那一段', headerOf(goodRow) === want)

  const empty = judge([], { baseRowTexts: new Set(), map: new Map() })
  ok(
    'S10 零行 ⇒ clean 且退出 0',
    verdict(empty, 'staged').state === 'clean' && verdict(empty, 'staged').code === 0,
  )
  ok(
    'S11 只有存量 ⇒ warn 且退出 0(warn 档不当红)',
    verdict(v2, 'head').state === 'warn' && verdict(v2, 'head').code === 0,
  )
  ok(
    'S12 有 A1 ⇒ red 且退出 1',
    verdict(v1, 'staged').state === 'red' && verdict(v1, 'staged').code === 1,
  )
  ok('S13 全量档 a1 读数必须是 NA 而不是 0', /a1=NA/.test(verdict(v2, 'head').line))

  const und = withScratch((dir) => readFaces(dir, 'head'))
  ok('S14 取不到面 ⇒ 未判定臂真的通(不记绿也不冒红)', und.ok === false && /取不到/.test(und.why))

  let fails = 0
  for (const [name, pass] of checks) {
    if (!pass) fails++
    console.log(`${pass ? '✅' : '❌'} ${name}`)
  }
  console.log(`\n自检:${checks.length - fails} 通过 / ${fails} 失败`)
  // 自检只判构造面,**不**顺手跑真台账:否则"存量 warn"或"实跑 red"会被读成自检失败,
  // 而这两种读数恰恰都是本门设计里允许的结果(§12e)。实跑结论另用不带 --self-test 的命令取。
  return fails === 0 ? 0 : 1
}

function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) return selfTest()
  if (argv.includes('--staged') && argv.includes('--worktree')) {
    console.log('❌ 用法错 —— --staged 与 --worktree 不得同用(两个判定面互斥,§0.4)')
    console.log('PLAN-FIELDS-RESULT state=undetermined a1=NA a2=NA stock=NA face=none')
    return 2
  }
  const face = argv.includes('--staged')
    ? 'staged'
    : argv.includes('--worktree')
      ? 'worktree'
      : 'head'
  return run({ root: ROOT, face })
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

export const __test__ = { judge, verdict, readFaces, headerOf, run }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
