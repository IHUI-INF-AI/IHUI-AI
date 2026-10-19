#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/* eslint-disable no-console -- 运维脚本为 CLI 工具,需 console 输出诊断信息 */

/**
 * heal-generated-artifact-union.mjs — 生成物"合并丢失"偿还器(2026-10-13 立)
 *
 * 立因(两次实证,不是推测):
 *   union-converge 对带自证标记的生成物按"本侧留下"处置(G-814415),并处方"落地后跑生成器重生成"。
 *   对 **append-only 归档型生成物** 这条路结构上兑现不了:生成器(archive-completed-tasks.mjs)
 *   只从 PROJECT_PLAN.md 搬**尚未搬**的已完成条目;而对侧已经搬进归档件的那些行,在本线的台账里
 *   早就因为占位替换而不存在了 ⇒ 重生成补不回来,而"取本侧"又把对侧的追加整段丢掉。
 *   2026-10-13 同一天实证两次:
 *     · 枚 f3108c5eb9 —— 丢了 union 两侧归档件差集里的 14 行(人工逐字偿还)
 *     · 枚 f3cff5e2db2 —— 又丢了 2 行(同一形态)
 *   ⇒ 这不是偶发,是"每次含生成物的 union 合并都必然发生"的机制性缺口;唯一机械出口是**后置偿还**。
 *
 * 判据(只有一份,跟视觉判"有无等差"无关):
 *   lost = union(ours ∪ theirs) ⊖ merged —— 逐行按**重数**做多重集差。
 *   ours/theirs 缺省取合并提交的两个父(parent1/parent2);非合并提交必须显式给 --ours --theirs。
 *   为什么用多重集而不是集合:归档件允许同一条登记被归档多次(重数本身就是信息),
 *   按集合去重会把"少了一份"这种真实缺口读成已偿还。
 *
 * 修复形态:merged 面内容末尾逐字追加 lost 行(保持并集语义),前置一行 HTML 留痕注释写明取证出处,
 *   然后走与 object-space-land 同一套 plumbing 落地一枚 fix 提交(commit-tree + CAS,不碰工作区、
 *   不碰他人共享暂存)。
 *
 * 用法:
 *   node scripts/heal-generated-artifact-union.mjs --path <rel> [--merged <rev>] [--ours <rev>] [--theirs <rev>] [--apply]
 *   --merged 缺省 HEAD,即"看当前 HEAD 这一面有无缺口";给司法 rev 可回头验任意一面的成果。
 *   --apply 才真落;缺省只报数(报告模式永不写任何东西 —— "脚本上手就改仓库"是本仓反复记过的失效型)。
 *
 * 退出码:0 无需偿还 / 已成功偿还   1 有缺口但未给 --apply(或落地失败)   2 用法错或取证不到(**未判定**)
 */
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync } from 'node:fs'

const HERE = dirname(fileURLToPath(import.meta.url))
// 本脚本住在 scripts/ 下 ⇒ 仓库根是**上一级**;写成两级会把 ROOT 推到盘符根,
// 而那里未必是 git 仓(也不该是),取证会失败 ⇒ 本工具按 fail-closed 报错退出,
// 不会把"没取到"读成"没有缺口"。
const ROOT = resolve(HERE, '..')

const {
  git,
  headBlobOf,
  writeBlob,
  commitTreeWithIndex,
  casUpdateRef,
  attestBypassCommit,
  alignSharedIndex,
  ABSENT,
  UNKNOWN,
} = await import('./lib/bypass-git.mjs')

function pick(flag) {
  const i = process.argv.indexOf(flag)
  return i >= 0 ? process.argv[i + 1] : null
}
const args = new Set(process.argv.slice(2))
const HELP = args.has('--help')

const pathArg = pick('--path')
const mergedRev = pick('--merged') ?? 'HEAD'
const apply = args.has('--apply')
/**
 * `--pool <rel>`(可重复):**内容存活面**。对 append-only 归档件,"这一分 usefulness
 * 没归档" 不等于 "内容丢了" —— 那个条目可能还好好躺在 PROJECT_PLAN.md 里等着下一次搬运。
 * 只比归档件本身会把"形态差异"读成"丢失",从而把 3581 行(2026-10-13 实测)判成待偿还,
 * 偿还的结果是归档件在下一轮 looked comprimir 重复数十份、而真正丢的那几十份混在里面看不出来。
 * 所以判活.level스터=(本文件 ∪ 各 pool)里出现过 ⇨ 内容未丢,不计入偿还。
 */
const pools = process.argv.filter((_, i) => process.argv[i - 1] === '--pool')

if (HELP) {
  console.log(
    [
      '用法: node scripts/heal-generated-artifact-union.mjs --path <rel> [--merged <rev>] [--ours <rev>] [--theirs <rev>] [--apply]',
      '  --path   必填,要偿还的生成物相对路径(如 .ihui-agent/archive/PROJECT_PLAN_ARCHIVE.md)',
      '  --merged 缺省 HEAD;给 rev 可回头验任意一面有无缺口',
      '  --ours/--theirs 缺省取 --merged 的两个父;非合并提交必须显式给',
      '  --apply  真落一枚偿还提交;缺省只报数',
    ].join('\n'),
  )
  process.exit(0)
}
if (!pathArg) {
  console.error('❌ 缺 --path(用法见 --help)')
  process.exit(2)
}

const mergedResolved = git(['rev-parse', '--verify', `${mergedRev}^{commit}`], {
  root: ROOT,
  allowFail: true,
})
if (!mergedResolved) {
  console.error(`❌ --merged ${mergedRev} 问不到 ⇒ 未判定,不猜`)
  process.exit(2)
}

let oursRev = pick('--ours')
let theirsRev = pick('--theirs')
if (!oursRev || !theirsRev) {
  const p1 = git(['rev-parse', '--verify', '--quiet', `${mergedResolved}^1`], { root: ROOT, allowFail: true })
  const p2 = git(['rev-parse', '--verify', '--quiet', `${mergedResolved}^2`], { root: ROOT, allowFail: true })
  if (!p1 || !p2) {
    console.error('❌ 两侧 ref 给不全,且 --merged 不是双亲合并提交 ⇒ 无法判定 union 输入面')
    process.exit(2)
  }
  oursRev = oursRev ?? p1
  theirsRev = theirsRev ?? p2
}

/** 取某 ref 下该路径的 blob 正文;取不到一律返回 null 而不是空串 ——
 *  空串会被读成"那一侧本来就没内容",于是缺口被静默读成"无需偿还"。 */
function textOf(ref, label) {
  const oid = headBlobOf(ref, pathArg, { root: ROOT })
  if (oid === ABSENT) return { texts: null, oid, why: `${label}(${ref}) 里没有该路径` }
  if (oid === UNKNOWN) return { texts: null, oid, why: `${label}(${ref}) 的 blob 问不到` }
  const t = git(['cat-file', 'blob', oid], { root: ROOT, raw: true, allowFail: true })
  if (t === null) return { texts: null, oid, why: `${label}(${ref}) 的正文读不到` }
  return { texts: t, oid, why: null }
}

function lineCounts(text) {
  const lines = text.split('\n')
  const m = new Map()
  for (const l of lines) m.set(l, (m.get(l) ?? 0) + 1)
  return { lines: lines.length, m }
}

const O = textOf(oursRev, 'ours')
const T = textOf(theirsRev, 'theirs')
const M = textOf(mergedResolved, 'merged')
for (const side of [O, T, M]) {
  if (side.texts === null) {
    console.error(`❌ 取证失败:${side.why} ⇒ 未判定,不动仓库`)
    process.exit(2)
  }
}

const o = lineCounts(O.texts)
const t = lineCounts(T.texts)
const g = lineCounts(M.texts)

const unionK = new Set([...o.m.keys(), ...t.m.keys()])
const lost = []
for (const line of unionK) {
  const need = Math.max(o.m.get(line) ?? 0, t.m.get(line) ?? 0)
  const have = g.m.get(line) ?? 0
  for (let i = have; i < need; i++) lost.push(line)
}

console.log(
  `ours(${oursRev.slice(0, 9)})=${o.lines} 行 / theirs(${theirsRev.slice(0, 9)})=${t.lines} 行 / merged(${mergedResolved.slice(0, 9)})=${g.lines} 行`,
)
console.log(`并集 ⊖ 合并面 = ${lost.length} 行(去重 ${new Set(lost).size} 行)`)

// pool 判活:内容在别处还活着 ⇒ 不是丢失,不偿还
const poolTexts = []
for (const p of pools) {
  const pt = git(['show', `${mergedResolved}:${p}`], { root: ROOT, raw: true, allowFail: true })
  if (pt === null) {
    console.error(`❌ --pool ${p} 在该面(${mergedResolved.slice(0, 9)})读不到 ⇒ 未判定,不动仓库`)
    process.exit(2)
  }
  poolTexts.push(pt)
}
let stillAlive = 0
const reallyLost = lost.filter((l) => {
  const alive = poolTexts.some((pt) => pt.includes(l))
  if (alive) stillAlive++
  return !alive
})
if (poolTexts.length > 0) {
  console.log(
    `   其中仍在存活面(${pools.join(' / ')})上的 ${stillAlive} 行 ⇒ 内容未丢,不计入偿还;` +
      `真丢失 ${reallyLost.length} 行(去重 ${new Set(reallyLost).size} 行)`,
  )
}
const target = reallyLost

if (target.length === 0) {
  console.log(
    pools.length > 0
      ? '✅ 无需偿还:union 两侧缺的那些行都还在存活面上 ⇒ 内容零丢失(只是尚未归档)'
      : '✅ 无需偿还:union 两侧的内容全部包含在合并面里',
  )
  process.exit(0)
}

for (const l of [...new Set(target)].slice(0, 10)) {
  console.log('   MISSING :: ' + l.slice(0, 140).replace(/\n/g, ' '))
}

if (!apply) {
  console.log('ℹ️  报告模式:未写任何东西。要偿还请加 --apply')
  process.exit(1)
}

// ── 偿还 := merged 原样 + 留痕注释 + 缺失行(按重数) ──────────────────────────────
const nl = M.texts.endsWith('\n') ? '' : '\n'
const note =
  `${nl}\n<!-- 生成物偿还(${new Date().toISOString().slice(0, 10)},脚本:heal-generated-artifact-union):` +
  ` union 合并对生成物按"本侧留下",导致对侧独有的 ${target.length} 行在合并面消失。` +
  `取证 = 多重集差 union(ours∪theirs) ⊖ merged(ours=${oursRev.slice(0, 9)} theirs=${theirsRev.slice(0, 9)} merged=${mergedResolved.slice(0, 9)});` +
  `按并集语义逐字偿还于此。根因见 scripts/union-converge.mjs 的生成物通道(G-814415)。 -->\n`
const newText = M.texts + note + target.map((l) => l + '\n').join('')

if (!newText.startsWith(M.texts)) {
  console.error('❌ 构造内容破坏了合并面前缀 ⇒ 不落')
  process.exit(1)
}
for (const l of new Set(target)) {
  if (newText.split(l).length - 1 < 1) {
    console.error(`❌ 构造后仍有未到位行:${l.slice(0, 80)}`)
    process.exit(1)
  }
}

const newBlob = writeBlob(newText, { root: ROOT })
const head = git(['rev-parse', 'HEAD'], { root: ROOT, allowFail: true })
if (!head) {
  console.error('❌ HEAD 读不到 ⇒ 不落')
  process.exit(1)
}

const built = commitTreeWithIndex({
  root: ROOT,
  parent: head,
  message:
    `fix(generated): 偿还 union 合并 ${mergedResolved.slice(0, 9)} 在生成物上的丢失 —— ` +
    `${target.length} 行按并集语义归位(${pathArg})`,
  entries: [{ path: pathArg, blob: newBlob }],
  baseRef: head,
})

if (!casUpdateRef(built.commit, head, { root: ROOT })) {
  console.error('❌ CAS 失败:HEAD 已被推进 ⇒ 请重跑本一把(它会重新取证)')
  process.exit(1)
}
attestBypassCommit(built.commit, {
  root: ROOT,
  source: 'heal-generated-artifact-union:cascade',
  reason: `生成物 union 丢失偿还 ${target.length} 行`,
  headBefore: head,
})
if (existsSync(pathArg)) {
  alignSharedIndex({ root: ROOT, paths: [pathArg], parentRef: head, rounds: 1, waitMs: 500 })
}
console.log(`✅ 已偿还并落地:${built.commit.slice(0, 9)}(失而复得 ${target.length} 行)`)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
