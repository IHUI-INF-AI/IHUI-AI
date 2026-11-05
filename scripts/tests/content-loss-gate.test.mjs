// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * content-loss-gate 镜像测试(§22c):import 源脚本 __test__,零复制判据。
 * 锁两件事:
 *  1) 纠偏面 —— 活文档生成块(BEGIN/END GENERATED …)内两侧互斥数字行 **不判丢**;
 *  2) 防削面 —— 人工段落少带对侧行/键集少带 **必须仍判红**(判据没被削松)。
 */
import { __test__ as gate } from '../lib/content-loss-gate.mjs'

const { stripGeneratedBlocks, judgeContentLoss } = gate

let failed = 0
const ok = (n, c) => {
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

console.log(failed ? `❌ ${failed} 例失败` : '✅ content-loss-gate 镜像 12 例全绿')
process.exit(failed ? 1 : 0)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
