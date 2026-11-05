// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * content-loss-gate 镜像测试(§22c):import 源脚本 __test__,零复制判据。
 * 锁两件事:
 *  1) 纠偏面 —— 活文档生成块(BEGIN/END GENERATED …)内两侧互斥数字行 **不判丢**;
 *  2) 防削面 —— 人工段落少带对侧行/键集少带 **必须仍判红**(判据没被削松)。
 *
 * 双向分叉合流后(2026-11-06)再加第 3 件事:
 *  3) 三个**独立举证来源**每一路自己的前置一个不少 ——
 *     调用方认账集(本地 `c587dd5023`)/ 折叠台账 + 摘除台账 + 底面处置权(远端 2026-11-06);
 *     任一路没举证成立 ⇒ 照旧判红(反证臂),举了证的每一处都必须报名(不许静默)。
 *     折叠判据本身不在这份测试里重写一遍:`foldLedgerOf`/`attestFoldPair` 一律 import 单源。
 */
import {
  __test__ as gate,
  __test__fold,
  __test__drop,
  missingLineCounts,
  foldPairsOf,
  foldCreditOf,
  dropCreditOf,
} from '../lib/content-loss-gate.mjs'
import { foldLedgerOf } from '../lib/union-converge-judgments.mjs'

const { stripGeneratedBlocks, judgeContentLoss } = gate

let failed = 0
let total = 0
const ok = (n, c) => {
  total++
  console.log(`${c ? '  ✅' : '  ❌'} ${n}`)
  if (!c) failed++
}

// ── 1) stripGeneratedBlocks 单元行为 ──
{
  const doc = [
    '# 标题行',
    '人工内容 A',
    '<!-- BEGIN GENERATED NUMBERS (node scripts/gen-doc-numbers.mjs --markdown) -->',
    '| 测试文件 | 4098 | `testFiles` |',
    '上表由生成器生成,最后核对日期 2026-11-04。',
    '<!-- END GENERATED NUMBERS -->',
    '人工内容 B',
    '<!-- BEGIN GENERATED NAME INDEX',
    '| 门 | x.mjs |',
    '<!-- END GENERATED NAME INDEX -->',
    '尾部人工',
  ].join('\n')
  const s = stripGeneratedBlocks(doc)
  ok('剥成对生成块(数字行不在)', !s.includes('4098') && !s.includes('门 | x.mjs'))
  ok('人工行完整保留', s.includes('人工内容 A') && s.includes('人工内容 B') && s.includes('尾部人工') && s.includes('# 标题行'))
  ok('null/undefined 直传', stripGeneratedBlocks(null) === null && stripGeneratedBlocks(undefined) === undefined)
}

// ── 2) judgeContentLoss 活文档:生成块互差 ⇒ 过;人工缺行 ⇒ 红 ──
{
  const ours = [
    '共同人工行',
    '本侧新增人工行',
    '<!-- BEGIN GENERATED NUMBERS -->',
    '| 测试文件 | 4099 |',
    '<!-- END GENERATED NUMBERS -->',
  ].join('\n')
  const theirs = [
    '共同人工行',
    '对侧独有数字行不该要求',
    '<!-- BEGIN GENERATED NUMBERS -->',
    '| 测试文件 | 4098 |',
    '<!-- END GENERATED NUMBERS -->',
  ].join('\n')
  // merged 带对侧人工行 + 本侧生成数字
  const mergedOk = [
    '共同人工行',
    '本侧新增人工行',
    '对侧独有数字行不该要求',
    '<!-- BEGIN GENERATED NUMBERS -->',
    '| 测试文件 | 4099 |',
    '<!-- END GENERATED NUMBERS -->',
  ].join('\n')
  // merged 少对侧一条人工行 ⇒ 必须红
  const mergedBad = mergedOk.replace('对侧独有数字行不该要求', '被改写的别的行')
  const readMap = (texts) => (rev, path) => texts[path]?.[rev] ?? null
  const revs = { ours: 'O', theirs: 'T', merged: 'M' }

  const r1 = judgeContentLoss({
    root: '.',
    ...revs,
    paths: ['README.md'],
    read: readMap({ 'README.md': { O: ours, T: theirs, M: mergedOk } }),
  })
  ok('生成块内数字互斥不判丢(过)', r1.ok === true)

  const r2 = judgeContentLoss({
    root: '.',
    ...revs,
    paths: ['README.md'],
    read: readMap({ 'README.md': { O: ours, T: theirs, M: mergedBad } }),
  })
  ok('人工段落少带对侧行 ⇒ 仍判红', r2.ok === false && r2.violations.some((v) => v.missingTheirs.includes('对侧独有数字行不该要求')))
}

// ── 3) 键集面不受纠偏影响(data JSON 少键仍红) ──
{
  const O = JSON.stringify({ a: 1, b: { c: 2 } })
  const T = JSON.stringify({ a: 1, d: 3 })
  const M = JSON.stringify({ a: 1, b: { c: 2 } }) // 少对侧的 d 键
  const r3 = judgeContentLoss({
    root: '.',
    ours: 'O',
    theirs: 'T',
    merged: 'M',
    paths: ['scripts/data/x.json'],
    read: (rev) => ({ O, T, M })[rev],
  })
  ok('键集面:少对侧键仍判红(纠偏未波及)', r3.ok === false && r3.violations.some((v) => v.kind === 'keys' && v.missingTheirs.includes('d')))
}

// ── 4) PROJECT_PLAN 无标记 ⇒ 行为等价(全含判行) ──
{
  const O = '- [ ] RP-1 本侧票\n- [x] 已结清'
  const T = '- [ ] RP-1 本侧票\n- [ ] Y-9 对侧票'
  const M = '- [ ] RP-1 本侧票\n- [ ] Y-9 对侧票\n- [x] 已结清'
  const r4 = judgeContentLoss({
    root: '.',
    ours: 'O',
    theirs: 'T',
    merged: 'M',
    paths: ['PROJECT_PLAN.md'],
    read: (rev) => ({ O, T, M })[rev],
  })
  ok('PROJECT_PLAN 两侧全含 ⇒ 过(等价)', r4.ok === true)
}

// ── 5) 纠偏二:已认账折叠行免复读;未入账缺口不放 ──
{
  const O = '账内被折叠的原行\n另一条本侧行'
  const T = '对侧行'
  const M = '另一条本侧行\n对侧行' // 合并结果刻意不含"账内被折叠的原行"(去向由折叠台账举证)
  const read = (rev) => ({ O, T, M })[rev]
  const base = { root: '.', ours: 'O', theirs: 'T', merged: 'M', paths: ['PROJECT_PLAN.md'], read }
  const rNoCredit = judgeContentLoss(base)
  ok('未认账的少带 ⇒ 照判红(不放水)', rNoCredit.ok === false)
  const rCredited = judgeContentLoss({ ...base, creditedDrops: ['  账内被折叠的原行  '] })
  ok('折叠台账认过账的行 ⇒ 本层免复读(过)', rCredited.ok === true)
}

// ── 6) 双向分叉合流(2026-11-06):三个独立举证来源,每一路自己的前置一个不少 ──
{
  // 夹具:三条活文档少带行,分别由三个不同来源举证,另一个来源永远不许替它背书。
  const FOLD = '- [ ] T-7 同一件事'
  const Ours = { 'AGENTS.md': `${FOLD}\n共同行A`, 'PROJECT_PLAN.md': '共同行P\n本侧行', 'README.md': '共同行R' }
  const Theirs = { 'AGENTS.md': `${FOLD}\n${FOLD}\n${FOLD}\n共同行A`, 'PROJECT_PLAN.md': '共同行P\n对侧行', 'README.md': `共同行R\n${FOLD}` }
  const Merged = { 'AGENTS.md': `${FOLD}\n共同行A`, 'PROJECT_PLAN.md': '共同行P\n本侧行', 'README.md': '共同行R' }
  const Base = { 'README.md': `共同行R\n${FOLD}` } // 基底有、本侧已删 ⇒ 归并不补回(远端那一维)
  const read = (faces) => (rev, path) => faces[rev]?.[path] ?? null
  const call = (over = {}) =>
    judgeContentLoss({
      root: '.',
      ours: 'O',
      theirs: 'T',
      merged: 'M',
      base: null,
      paths: ['AGENTS.md', 'PROJECT_PLAN.md', 'README.md'],
      read: read({ O: Ours, T: Theirs, M: Merged, ...over.faces }),
      ...over.args,
    })

  // 折叠台账用**单源出口**造(不在测试里复算"什么叫折了几份")
  const foldLedgers = new Map([['AGENTS.md', foldLedgerOf(Theirs['AGENTS.md'], Merged['AGENTS.md'])]])

  // ① 什么都不喂 ⇒ 三处少带全判红(旧调用方一条都不放松;本地/远端初版同形)
  const none = call()
  ok('6.1 无认账集 ∧ 无台账 ∧ 无底面 ⇒ 三处少带全红', none.ok === false && none.violations.length === 3)

  // ② 远端那一维在位:折叠台账销 AGENTS.md、底面处置权销 README.md,两者互不相干
  const remoteSide = call({ args: { foldLedgers, base: 'B' }, faces: { B: Base } })
  ok(
    '6.2 折叠台账 + 底面处置权同时在位 ⇒ 各自只销自己那一处(远端能力未被合流削掉)',
    remoteSide.ok === false &&
      remoteSide.violations.length === 1 &&
      remoteSide.violations[0].path === 'PROJECT_PLAN.md' &&
      remoteSide.folded.length === 1 &&
      remoteSide.folded[0].copies === 2 &&
      remoteSide.dropped.some((d) => d.path === 'README.md' && d.via.includes('本侧处置权已行使')),
  )

  // ③ 本地那一维在位:调用方认账集只免 PROJECT_PLAN.md 一行
  const localSide = call({ args: { creditedDrops: ['对侧行'] } })
  ok(
    '6.3 只喂认账集 ⇒ 只免它举证的那一行(AGENTS/README 两处照旧红)',
    localSide.ok === false &&
      localSide.violations.length === 2 &&
      !localSide.violations.some((v) => v.path === 'PROJECT_PLAN.md') &&
      localSide.dropped.some((d) => d.via === '调用方认账集(creditedDrops)'),
  )

  // ④ 三源合喂 ⇒ 全绿,且每一处免复读都留了名(§0.10 不许静默折进"0 丢失")
  const all = call({ args: { creditedDrops: ['对侧行'], foldLedgers, base: 'B' }, faces: { B: Base } })
  ok('6.4 三路各自举证成立 ⇒ 整面过 ∧ 免掉的三行逐条报名', all.ok === true && all.folded.length + all.dropped.length === 3)

  // ⑤ 反证(核心牙):认账集里的行**不在** AGENTS/README ⇒ 那两处仍红,一路成立不放宽别的路
  const oneSided = call({ args: { creditedDrops: ['对侧行', '这一行本轮没人少带'] } })
  ok('6.5 认账集不得替"它没举证的那一行"背书 ⇒ 其余缺口一分不放', oneSided.ok === false && oneSided.violations.length === 2)

  // ⑥ 认账集**不压过**折叠台账的积极结论:台账额度只报 1 份、deficit 是 2 ⇒ 仍红
  const partial = call({
    args: {
      foldLedgers: new Map([['AGENTS.md', { pairs: [{ dropped: FOLD, kept: FOLD, droppedCopies: 1 }] }]]),
      creditedDrops: [FOLD],
    },
  })
  ok(
    '6.6 台账只解释部分份数 ⇒ 认账集不许把数量缺口一起消掉(行级集没有份数维度)',
    partial.ok === false && partial.violations.some((v) => v.path === 'AGENTS.md' && v.missingTheirs.includes(FOLD)),
  )

  // ⑦ 认账集**不压过**产物面上的积极反证:台账报的去向行在产物面一份都没有 ⇒ lost ⇒ 仍红
  const refuted = call({
    args: {
      foldLedgers: new Map([['AGENTS.md', { pairs: [{ dropped: FOLD, kept: '产物面根本没有这一行', droppedCopies: 2 }] }]]),
      creditedDrops: [FOLD],
    },
  })
  ok(
    '6.7 折叠举证为 lost(反证)⇒ 认账集不许言下撤回 ⇒ 照判红',
    refuted.ok === false && refuted.violations.some((v) => v.path === 'AGENTS.md' && v.missingTheirs.includes(FOLD)),
  )

  // ⑧ 未判定不是放行许可证(§0.3):去向给不出 ⇒ 记未判定 ∧ 注记不因认账集而洗掉
  const blind = call({
    args: { foldLedgers: new Map([['AGENTS.md', { pairs: [{ dropped: FOLD, kept: null, droppedCopies: 2 }] }]]), creditedDrops: [FOLD] },
  })
  ok(
    '6.8 去向未判定 ⇒ 认账集在位也仍记「未判定」(不当成"没丢",也不记通过)',
    blind.ok === false && blind.undetermined.some((u) => u.includes('折叠去向未判定')),
  )

  // ⑨ 摘除台账逐字族(远端维)仍按 declaredDropCaps 三条走,与认账集互不遮蔽
  const dropLedger = new Set([FOLD])
  const dropOk = judgeContentLoss({
    root: '.',
    ours: 'O',
    theirs: 'T',
    merged: 'M',
    paths: ['README.md'],
    read: read({ O: { 'README.md': '共同行R' }, T: Theirs, M: Merged }),
    declaredRemovals: dropLedger,
  })
  ok('6.9 摘除台账逐字族在位(登记行形 ∧ 产物面已无 ∧ 逐字命中 ⇒ 才销)', dropOk.ok === true && dropOk.dropped[0]?.via === '逐字')

  // ⑩ 两侧调用形互不污染:本地形(只喂认账集)下远端三维一条都不开;远端形(不喂认账集)下行为与 .theirs 同形
  ok(
    '6.10 合流不改变"另一侧输入形"的结论(本地形 ⇒ 远端维度全关)',
    JSON.stringify(localSide.violations.map((v) => [v.path, v.missingOurs, v.missingTheirs])) ===
      JSON.stringify(none.violations.filter((v) => v.path !== 'PROJECT_PLAN.md').map((v) => [v.path, v.missingOurs, v.missingTheirs])),
  )
}

// ── 7) 形状锁:两侧的单源出口都得在位(合流不许以"选一边"的方式删掉任何一侧的出口)──
{
  const need = {
    __test__: ['judgeContentLoss', 'formatLossReport', 'missingLines', 'lineMultiset', 'stripGeneratedBlocks', 'textKeySet'],
    __test__fold: ['missingLineCounts', 'foldPairsOf', 'foldCreditOf'],
    __test__drop: ['dropCreditOf'],
  }
  const surfaces = { __test__: gate, __test__fold, __test__drop }
  const absent = Object.entries(need).flatMap(([k, keys]) => keys.filter((f) => typeof surfaces[k]?.[f] !== 'function'))
  ok('7.1 三个出口面(公共/__test__fold/__test__drop)逐键可解析 ⇒ 没有任何一侧的出口在合流中被摘掉', absent.length === 0)
  ok(
    '7.2 远端新增的四个具名出口在位(missingLineCounts/foldPairsOf/foldCreditOf/dropCreditOf)',
    [missingLineCounts, foldPairsOf, foldCreditOf, dropCreditOf].every((f) => typeof f === 'function'),
  )
}

console.log(failed ? `❌ ${failed} 例失败(共 ${total} 例)` : `✅ content-loss-gate 镜像 ${total} 例全绿`)
process.exit(failed ? 1 : 0)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
