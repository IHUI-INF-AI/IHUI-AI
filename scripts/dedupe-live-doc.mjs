#!/usr/bin/env node
// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// scripts/dedupe-live-doc.mjs
// ─────────────────────────────────────────────────────────────────────────
// 活文档重复副本收敛器(2026-10-25 立)。
//
// —— 立因(不是"文档写乱了",是器物级的重复再生,现读为证)——
// README.md 在 HEAD 面上 4,653,356 字节 / 15,334 行,其中同一形态的行最多重复 198 次;
// 逐字重复余量 8,261 行,按"数字归一"后的形态去重仍有 7,241 行。历史是单调翻倍:
// 4 → 51 → 99 → 198 → 296 → 589 → 1176 枚 `A: Yes.` 行,每一次 union 合并(a9d6e29abcd +4099/−4305)
// 就把两侧各自那份**同号不同值**的段落一起收下 —— 行级 union 的重数守恒只判"不丢行",
// 判不出"同一段落被复制了一千份",于是重复永远不会被任何一道门拦住。
// 后果是用户可见的:GitHub 上打开的 README 是 4.6MB 的重复垃圾。
//
// —— 本器做什么 ——
// 只折"重复副本",不折"内容":按**形态**(`数字→#`、空白归一)分组,长度 ≥ MIN_SHAPE_LEN 的
// 形态只保留第一次出现的那一份,其余副本逐行摘掉。因此
//  · 同一段落换个数字再抄一遍(本族的真实形态)= 同形态 ⇒ 折成一份;
//  · 代码围栏内(``` … ```)= 结构性重复(示例里合法地反复)⇒ 整区不参与;
//  · 短行(表格分隔、`- [ ]` 台账行的空行、纯符号)= 形态信息量不足 ⇒ 不收,避免有损。
// 标记块(BEGIN/END GENERATED NUMBERS、RECENT UPDATES)额外收:同名 BEGIN 只留第一对,
// 多余一对里的**内容行**同样按形态折;标记行本身多余者摘掉,否则写回器只刷新第一份、
// 其余三份永远是陈值(实测 4 份生成块即此型)。
//
// —— 自证(三档守恒,任一不过整批不落)——
// A1 形态集不缩:输入里出现的每个参与形态,输出里必须仍在(折的是副本不是内容);
// A2 每个参与形态在输出里计数恰好 1(不折就白折,折过头会把唯一内容带走也在这档露出);
// A3 逐行字节等值地"只删不改":输出每一行都必须逐字节等于输入的某一行(不改写任何一行);
// A4 水印横幅保持:前四行(可见横幅 + 载荷行)与输入逐字节相同(§5c 禁对含载荷文件做文本级改写)。
//
// 用法:node scripts/dedupe-live-doc.mjs <相对路径…> [--apply] [--json]
// 退出码:0 无重复 / 1 有重复(--apply 已收敛则为 0) / 2 未判定或守恒不过
//
// —— 射程闸(2026-10-26 立,c8fee04806ea 事故锁)——
// 只有 .md 活文档允许进入行折叠面。代码文件一律拒收:事故里"人工归并回灌"器物把
// guardian-runner.mjs 当活文档按行 union 折叠,吃掉守门条目边界行,致 13 处结构损坏、
// 调度器 node --check SyntaxError、挂在其上的全部守门静默失效(HEAD~1..~4 全坏)。
// 行折叠对代码是结构性破坏(条目/括号/逗号被逐行摘走),守恒四档判不出这种坏 ——
// A1/A2 只保"形态不丢",代码坏在"语法",所以必须在入口拒,而不是指望折叠后自证。
// ─────────────────────────────────────────────────────────────────────────
/* eslint-disable no-console -- 工具脚本需 console 输出 */
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
// 被审面取材复用面读取层(§0.4/§5b:绝对路径 git + 显式 stdio + quotepath + 数字 timeout)
import { gitRaw } from './lib/face-reader.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
/** 形态参与折叠的最小长度:低于它形态信息量不足(表格分隔符、纯符号、空行)。 */
export const MIN_SHAPE_LEN = 24
/** 活文档里成对出现的自动生成标记;同名 BEGIN 只许一份。 */
export const BLOCK_MARKERS = [
  '<!-- BEGIN GENERATED NUMBERS',
  '<!-- BEGIN RECENT UPDATES',
]

/** 形态键:数字归一 + 空白折叠(同一句话换个数再抄一遍,形态必须相同)。 */
export function shapeOf(line) {
  return line.replace(/[0-9]+/g, '#').replace(/\s+/g, ' ').trim()
}

/** 标记每一行是否落在 ``` 围栏内(围栏内整区不参与折叠)。 */
export function fencedFlags(lines) {
  const flags = new Array(lines.length).fill(false)
  let inFence = false
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*(```|~~~)/.test(lines[i])) {
      inFence = !inFence
      flags[i] = true
      continue
    }
    flags[i] = inFence
  }
  return flags
}

/**
 * 找出应被摘掉的行下标:每个参与形态保留第一次出现,其余副本入删除集;
 * 多余的 BEGIN 标记所在块的标记行也入删除集(只留第一对)。
 * @returns {{drop:Set<number>, groups:Map<string,{kept:number,dropped:number[]}>, fencedSkipped:number}}
 */
export function planCollapse(text) {
  const lines = text.split('\n')
  const fenced = fencedFlags(lines)
  const firstSeen = new Map()
  const groups = new Map()
  const drop = new Set()
  let fencedSkipped = 0
  for (let i = 0; i < lines.length; i++) {
    if (fenced[i]) {
      fencedSkipped++
      continue
    }
    const shape = shapeOf(lines[i])
    if (shape.length < MIN_SHAPE_LEN) continue
    const seen = firstSeen.get(shape)
    if (seen === undefined) {
      firstSeen.set(shape, i)
      groups.set(shape, { kept: i, dropped: [] })
      continue
    }
    drop.add(i)
    groups.get(shape).dropped.push(i)
  }
  // 标记行:同一 BEGIN 只许一份(第二对里的内容行已被形态档折掉,标记行本身短 ⇒ 单独摘)
  for (const marker of BLOCK_MARKERS) {
    const hits = []
    for (let i = 0; i < lines.length; i++) if (lines[i].startsWith(marker)) hits.push(i)
    for (const i of hits.slice(1)) drop.add(i)
    if (hits.length > 1 && groups.size >= 0) groups.set(marker, { kept: hits[0], dropped: hits.slice(1) })
  }
  return { drop, groups, fencedSkipped }
}

/** 执行折叠并做四档守恒自证;不过 ⇒ 返回 refused(不落盘)。 */
export function collapse(text) {
  const { drop, groups, fencedSkipped } = planCollapse(text)
  const lines = text.split('\n')
  const out = lines.filter((_, i) => !drop.has(i))
  const violations = []

  // A1/A2:形态集合不缩,且每个参与形态计数恰好 1
  const outShapes = new Map()
  const outFenced = fencedFlags(out)
  out.forEach((l, i) => {
    if (outFenced[i]) return
    const s = shapeOf(l)
    if (s.length < MIN_SHAPE_LEN) return
    outShapes.set(s, (outShapes.get(s) || 0) + 1)
  })
  for (const [shape] of groups) {
    if (shape.startsWith('<!-- BEGIN')) continue
    const n = outShapes.get(shape) || 0
    if (n === 0) violations.push(`A1 形态被整体带走:${shape.slice(0, 60)}`)
    else if (n > 1) violations.push(`A2 折叠后仍剩 ${n} 份:${shape.slice(0, 60)}`)
  }
  // A3:只删不改 —— 输出每一行必须逐字节等于输入的某一行
  const inputSet = new Set(lines)
  for (const l of out) if (!inputSet.has(l)) violations.push(`A3 输出含改写行:${l.slice(0, 50)}`)
  // A4:水印横幅保持 —— 前三行(可见横幅 + 载荷 + 声明行)既不许被摘,也不许被挪位。
  // 真实文档里横幅永不重复 ⇒ 它落进删除集本身就是"折叠面越界"的信号,不是巧合。
  for (let i = 0; i < Math.min(3, lines.length); i++) {
    if (drop.has(i)) violations.push(`A4 第 ${i + 1} 行横幅被摘除`)
    else if (out[i] !== lines[i]) violations.push(`A4 第 ${i + 1} 行横幅被挪位`)
  }

  return {
    text: out.join('\n'),
    dropped: drop.size,
    groups: [...groups.entries()]
      .filter(([, g]) => g.dropped.length > 0)
      .sort((a, b) => b[1].dropped.length - a[1].dropped.length)
      .slice(0, 12)
      .map(([shape, g]) => ({ shape: shape.slice(0, 70), keptLine: g.kept + 1, dropped: g.dropped.length })),
    fencedSkipped,
    violations,
  }
}

/** 射程闸判定:只有 .md 活文档允许进入行折叠面(大小写不敏感);其余一律拒收。 */
export function isLiveDocTarget(rel) {
  return rel.toLowerCase().endsWith('.md')
}

/** 面读取(§0.4):全量档判 HEAD blob、--staged 判索引 blob、--worktree 判盘上。 */
function readFace(relPath, face) {
  if (face === 'worktree') {
    try {
      return readFileSync(path.join(ROOT, relPath), 'utf8')
    } catch {
      return null
    }
  }
  const ref = face === 'staged' ? ':./' + relPath : 'HEAD:' + relPath
  // 一律走面读取层(§0.4/§5b:绝对路径 git + 显式 stdio + quotepath);活文档可达数 MB,
  // 缓冲保持 256MB。取不到 ⇒ null 交调用方落「未判定」,绝不回落另一个面。
  try {
    return gitRaw(['show', ref], ROOT, { binary: true, maxBuffer: 1 << 28 }).toString('utf8')
  } catch {
    return null
  }
}

export function selfTest() {
  const cases = []
  const ok = (name, cond) => cases.push({ name, pass: Boolean(cond) })
  const dup = [
    '#!/usr/bin/env node',
    '© 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top',
    '// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。',
    'Intro line short',
    'This README answers: does the platform ship 3204 test files and 4558 API routes today?',
    'This README answers: does the platform ship 3179 test files and 4556 API routes today?',
    'tail',
  ].join('\n')
  const c = collapse(dup)
  ok('同形态换数字 ⇒ 折成一份', c.text.split('\n').length === 6 && c.dropped === 1)
  ok('保留的是第一次出现的那份', c.text.includes('3204 test files') && !c.text.includes('3179 test files'))
  ok('守恒四档全过', c.violations.length === 0)
  // A4 变异锁:横幅第 3 行恰好是第 2 行的副本(真实文档里横幅永不重复,这一格只为锁住守卫本身)
  // ⇒ 折叠会把第 3 行摘掉,这一档必须出声,而不是安静地把载荷横幅挪位(§5c:载荷挪位=溯源链断)
  const lines = dup.split('\n')
  lines[2] = lines[1]
  const bannerHit = lines.join('\n')
  ok('横幅位被副本命中时 A4 出声(而不是把横幅挪走)', collapse(bannerHit).violations.some((v) => v.startsWith('A4')))
  const short = ['---', '| - | - |', '短行 abc', '短行 abc'].join('\n')
  ok('短行不参与折叠(形态信息量不足)', collapse(short).dropped === 0)
  const fenced = [
    '```ts',
    'const answer = "this line is long enough to be collapsed if it were outside a fence"',
    'const answer = "this line is long enough to be collapsed if it were outside a fence"',
    '```',
  ].join('\n')
  ok('代码围栏内的结构性重复不动', collapse(fenced).dropped === 0)
  const marker = [
    '<!-- BEGIN GENERATED NUMBERS (x) -->',
    '| 表 | 606 |',
    '<!-- END GENERATED NUMBERS -->',
    '<!-- BEGIN GENERATED NUMBERS (x) -->',
    '| 表 | 608 |',
    '<!-- END GENERATED NUMBERS -->',
  ].join('\n')
  const m = collapse(marker)
  ok('同名 BEGIN 标记只留第一对', m.text.split('\n').filter((l) => l.startsWith('<!-- BEGIN')).length === 1)
  ok('多余标记块的内容行按形态折掉', m.dropped >= 2)
  ok('横幅保持(前四行逐字节不变)', m.violations.every((v) => !v.startsWith('A4')))
  // 反向锁:改一行让它与首行不再同形态 ⇒ 不该被折(证明折的是副本,不是内容)
  const distinct = dup.replace('4558 API routes today?', '4558 API routes tomorrow?')
  ok('形态不同即两份都留(不误伤唯一内容)', collapse(distinct).dropped === 0)
  // 射程闸锁(2026-10-26,c8fee04806ea 事故):代码文件不得进折叠面
  ok(
    '射程闸:非 .md 目标被拒(.mjs/.ts/rs 等)',
    !isLiveDocTarget('scripts/guardian-runner.mjs') &&
      !isLiveDocTarget('src/App.tsx') &&
      !isLiveDocTarget('crates/hui-cli/src/main.rs') &&
      !isLiveDocTarget('notes')
  )
  ok('射程闸:.md 目标放行(含大写后缀)', isLiveDocTarget('README.md') && isLiveDocTarget('docs/Guide.MD'))
  let rc = 0
  for (const x of cases) {
    console.log(`${x.pass ? '✅' : '❌'} ${x.name}`)
    if (!x.pass) rc = 1
  }
  console.log(`self-test ${cases.filter((x) => x.pass).length}/${cases.length}`)
  return rc
}

function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) return selfTest()
  const face = argv.includes('--staged') ? 'staged' : argv.includes('--worktree') ? 'worktree' : 'head'
  const apply = argv.includes('--apply')
  const targets = argv.filter((a) => !a.startsWith('--'))
  if (targets.length === 0) {
    console.error('❌ 未给出目标文档 ⇒ 未判定(不许"枚举到 0 个候选"记绿)')
    return 2
  }
  // 射程闸(c8fee04806ea 事故锁):非 .md 目标一律拒执行 —— 行折叠对代码是结构性破坏,
  // 守恒四档判不出"语法坏",只能靠入口拒。事故形态:guardian-runner.mjs 被按行 union
  // 折叠,守门条目边界行被吃掉,13 处结构损坏,调度器 SyntaxError,全部守门静默失效。
  const offRange = targets.filter((r) => !isLiveDocTarget(r))
  if (offRange.length) {
    console.error(`❌ 射程闸:${offRange.join(', ')} 不是 .md 活文档 ⇒ 拒执行(exit 2),整批不落。`)
    console.error('   立闸依据:c8fee04806ea 把 guardian-runner.mjs 当活文档按行折叠,')
    console.error('   致 13 处结构损坏、调度器 node --check SyntaxError、全部守门静默失效。')
    console.error('   代码文件不得进活文档行 union 面;若需收敛代码重复,走结构级工具(eslint/格式化),不走本器。')
    return 2
  }
  let bad = 0
  for (const rel of targets) {
    const text = readFace(rel, face)
    if (text === null) {
      console.error(`❌ ${rel} 在 ${face} 面取不到 ⇒ 未判定,不出具合格证`)
      return 2
    }
    const c = collapse(text)
    if (c.violations.length) {
      console.error(`❌ ${rel} 守恒不过 ${c.violations.length} 条 ⇒ 整批不落(§0.3 不猜):`)
      for (const v of c.violations.slice(0, 10)) console.error(`   ${v}`)
      return 2
    }
    if (c.dropped === 0) {
      console.log(`✅ ${rel} 无重复副本(${text.split('\n').length} 行,围栏内 ${c.fencedSkipped} 行不参与)`)
      continue
    }
    bad++
    console.log(
      `❌ ${rel} 重复副本 ${c.dropped} 行(原 ${text.split('\n').length} 行 → 应收 ${text.split('\n').length - c.dropped} 行)。Top 形态:`
    )
    for (const g of c.groups) console.log(`   ×${g.dropped} 保留第 ${g.keptLine} 行:${g.shape}`)
    if (!apply) {
      console.log('   出路:node scripts/dedupe-live-doc.mjs ' + targets.join(' ') + ' --apply')
      continue
    }
    writeFileSync(path.join(ROOT, rel), c.text.endsWith('\n') ? c.text : c.text + '\n')
    console.log(`   ✅ 已就地收敛(写盘 ${rel})`)
  }
  return bad && !apply ? 1 : 0
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirectRun) process.exit(main())

export const __test__ = { shapeOf, fencedFlags, planCollapse, collapse, isLiveDocTarget, MIN_SHAPE_LEN, BLOCK_MARKERS }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
