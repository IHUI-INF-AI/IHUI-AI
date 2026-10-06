// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `measureMixedSplit`(F1 第二层量表)的独立自检 —— 与被审脚本内嵌的 `--self-test` **互为交叉验证**。
 *
 * 为什么要有这一份(不是重复劳动):
 *  -内嵌自检跑在**被审脚本自己进程里**。判据与自检同文件时,一个写错的判据会让自检一起错
 *    (本仓 S14 那次同型:夹具缺这一维,判据退一步没人看见)。本文件从**外部** import 判据,
 *    判据改错时本文件不会跟着错。
 *  - `measure-plan-block-migration.mjs` 的 `--self-test` **不在 `node --test` 面上**
 *    ⇒ 只跑 `node --test scripts/tests/` 的 CI/守门看不到那29 条断言。这一条把它们接进同一面。
 *
 * ⚠️ **档 B 的结论钉在这一份里**(2026-10-06):拟议的「持有行只报数不问责」判据**不可实施**。
 * 真语料实测(`git show HEAD:PROJECT_PLAN.md`):那条持有行已随整组结清,`holderGroups` 现读 **0**;
 * 且三条文本候选判据在真语料上的假阳性是 18 行里 17 行 / 7 行里 7 行。
 * D 组(下方)是这个结论的**反例组**:三个夹具都形似持有行、但都是真活票,
 * 任何按措辞落地档 B 的改法必在D 组翻红。
 *
 * §5c 溯源水印:本文件受 `scripts/watermark.mjs` 管理。
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { __test__, measureMixedSplit } from '../measure-plan-block-migration.mjs'
import { findForks, DUP_POINTER_RE } from '../lib/plan-task-index.mjs'

const SRC = fileURLToPath(new URL('../measure-plan-block-migration.mjs', import.meta.url))
const DUP = '〔【归并】重复登记副本(2026-09-27):同主键的另一条登记,派单以那条为准,本行不再单独派单。〕'
const TITLE = '**G-900020 某条待办的标题占位,长度足够让主键前缀稳定下来**'
const holder = (tail = '') => `- [ ] ${TITLE} —— 持有行,它是归并的目标行。${tail}`
const dupRow = (tail = '') => `- [ ] ${TITLE} —— 副本行。${DUP} ${tail}`
const doneRow = () => `- [x] ${TITLE} —— 同主键的已完成行。`

test('M1 入口守卫:import 本模块不得触发量表(§22c 镜像模式)', () => {
  // 被审脚本有 `isDirectRun` 外层守卫;若守卫被摘,import 就会把整份台账读一遍并打印。
  const src = readFileSync(SRC, 'utf8')
  assert.match(src, /const isDirectRun = process\.argv\[1\] && import\.meta\.url === pathToFileURL\(process\.argv\[1\]\)\.href/)
  assert.match(src, /if \(isDirectRun\) \{/)
  // ⚠ 真正的不变量是「`main()` 只在守卫内被调用」,**不是**「量表调用点在守卫之后」。
  //第一版写成后者(`measureMixedSplit(content)` 的位置 > `if (isDirectRun)`)恒假:
  //那些调用点在 `main()` **函数体内部**,而 `main()` 的文本位置在守卫之前 ——
  // 位置比较量的是文本先后,量不到调用关系。这类恒假断言比没有断言更坏:它永远红,
  // 于是所有人把它当"环境坏了"跳过,真正的守卫回归反而没人看。
  const guardAt = src.indexOf('if (isDirectRun) {')
  const callAt = src.indexOf('const code = main()')
  assert.ok(guardAt !== -1 && callAt !== -1, '必须同时找得到守卫与 main() 调用点')
  // `main()` 的调用必须落在守卫**块内**。⚠ 块的配对 `}` 不能用 `indexOf('\n}')`找 ——
  // 那会撞上 main() 函数体自己的收尾(它在守卫之前)。这里量的是**文本区间**,
  // 而真正的调用关系由上面两条 assert.match + 调用点在守卫之后共同钉住。
  assert.ok(callAt > guardAt, `main() 调用(${callAt})必须排在守卫(${guardAt})之后`)
  // `main()` 在守卫之外不得被调用:全文件只许出现一次调用形态 `const code = main()`
  // 加上函数**定义** `function main()`。第二版误把 `indexOf('main()')` 当调用计数 ——
  // 它命中的是 22266 处的**函数定义**,恒不等于调用点,又是一条恒假断言。
  const calls = src.match(/const code = main\(\)/g) ?? []
  assert.equal(calls.length, 1, 'main() 只许在守卫内被调用一次')
})

test('M2 镜像出口:`__test__` 必须导出本文件要用的那两个量表', () => {
  assert.equal(typeof __test__.measureMixedSplit, 'function', '__test__ 缺 measureMixedSplit')
  assert.equal(__test__.measureMixedSplit, measureMixedSplit, '__test__ 与具名导出必须是同一实现')
})

test('M3 holderGroups = 剔掉带注记 open 行后仍混态的组', () => {
  const r = measureMixedSplit([holder(), dupRow(), doneRow()].join('\n'))
  assert.equal(r.ok, true)
  assert.equal(r.groups.length, 1)
  assert.equal(r.openAnnotated, 1, '副本行 1 条')
  assert.equal(r.openHolders, 1, '持有行 1 条')
  assert.equal(r.holderGroups.length, 1, '剔副本后仍有持有行 ⇒ 机器判不了的那一格')
  assert.equal(r.holderGroups[0].holderOnlyFork, true)
})

test('M4 open 侧全带注记 ⇒ 剔完不剩 open ⇒ 不是 holderGroups(与 M3 成对)', () => {
  const r = measureMixedSplit([dupRow(), dupRow(' 之二'), doneRow()].join('\n'))
  assert.equal(r.openAnnotated, 2)
  assert.equal(r.openHolders, 0)
  assert.equal(r.holderGroups.length, 0, '没有持有行 ⇒ 这一格不是"机器判不了",是没得判')
})

test('M5 同块内混态照样算混态(本档与 `###` 块无关)', () => {
  // 与 measureBlockMigration 的根本区别:那把尺子只量跨 ### 块。这一条钉住"两把尺不可互相代答"。
  const r = measureMixedSplit([holder(), doneRow()].join('\n'))
  assert.equal(r.groups.length, 1)
  assert.equal(r.holderGroups.length, 1)
})

test('M6 判不出 ≠ 量到 0:非字符串输入四档全为 null', () => {
  for (const bad of [null, undefined, 42, {}, []]) {
    const r = measureMixedSplit(bad)
    assert.equal(r.ok, false, `输入 ${String(bad)} 必须 ok=false`)
    assert.equal(r.groups, null, 'groups 必须是 null 而不是 []')
    assert.equal(r.holderGroups, null)
    assert.equal(r.openAnnotated, null)
    assert.equal(r.openHolders, null)
  }
  // 与之成对:空台账是"量到了且零组",与"判不出"必须可区分。
  const empty = measureMixedSplit('')
  assert.equal(empty.ok, true)
  assert.deepEqual(empty.groups, [])
})

test('M7 本档与 F1 判据必须同口径:同一份夹具,两把尺对同一组给同一个数', () => {
  // 量表与判据若是两把独立的尺,就会出现"量表说 holderGroups=1、F1 报 0"这种无法对账的账面。
  const content = [holder(), dupRow(), doneRow()].join('\n')
  assert.equal(measureMixedSplit(content).holderGroups.length, 1)
  assert.equal(findForks(content).forks.length, 1, '档 A 之后仍混态 ⇒ 两把尺必须一致')
})

/**
 * ── D 组:档 B(「持有行只报数不问责」)的反例组 ──────────────────────────
 *
 * 拟议改法:把"同主键下不带注记的未勾选行"当指针,从问责面上剔掉。
 * 下面三个夹具**都形似持有行**,但 open 行**都是真活票** —— 按措辞豁免必在这里翻红。
 */

/** D1:同主键 done 行自述"已另开票 G-XXXX",而 open 行那一半确实还没干完(逐字形态取自真语料)。 */
test('D1 反例:done 自述"已另开票"的真活票必须仍混态', () => {
  const open = `- [ ]（进行中@2026-10-05/OWNER）${TITLE} —— ② 仍开着:等owner 对 metadata 与 extraMetadata 定权威,不猜。`
  const done = `- [x] （✅@2026-10-05/g2-alltasks）${TITLE} —— 拍板②已裁决并执行(枚 5c3abb296f),列+GIN 下线另开迁移票 G-900011。`
  const content = [open, done].join('\n')
  assert.equal(findForks(content).forks.length, 1, '档 B 式豁免必使本条翻红')
  const r = measureMixedSplit(content)
  assert.equal(r.holderGroups.length, 1, '量表侧同样必须仍认它是"机器判不了的那一格"')
  assert.equal(r.openHolders, 1)
})

/** D2:open 行正文含「(另开|已开|新开|立|拆)…票」交接措辞 —— 真语料 18 行命中里 17 行是真活票。 */
test('D2 反例:含交接措辞的真活票必须仍混态', () => {
  const open = `- [ ]${TITLE} —— 本行是**四件事捆成一行**,按 §9 拆成可独立验收的四票:①容器隔离执行面 ②任务派发。**验收**:并发跑两个互不可见的会话。`
  const done = `- [x]${TITLE} —— 上一轮只做了 ①,其余三项仍开着。`
  const content = [open, done].join('\n')
  assert.equal(findForks(content).forks.length, 1)
  assert.equal(measureMixedSplit(content).holderGroups.length, 1)
})

/**
 * D3:open 行正文把 `【归并】` 当**议题对象**而非自我标注 —— 真语料 7 行命中 **7 行全是真活票**。
 * 形态逐字取自真语料 L8266 `G-814417`:那一票的主题**就是**归并器产出的指针。
 */
test('D3 反例:把【归并】当议题的真活票必须仍混态', () => {
  // ⚠ done 行必须与 open 行**同主键**,且题面段逐字相同、长于 24 字(`compositeKeyOf`
  //   只取正文前 24 字)。第一版 done 行用了另一个编号 ⇒ 两组各成一组、forks 读 0,
  //   而"0"看着像"判据已放过" —— 实为夹具散了。本仓最容易骗过自己的假绿形态。
  const HEAD = '**G-900021 归并器产出的指针被 titleOf 当标题 ⇒ 凭空撞号**'
  const open = `- [ ]${HEAD} —— 现读实证:归并器自己产出的〔【归并】…〕行尾注记被当成题面,同一组 3 个"不同标题"实为同一任务的副本。`
  const done = `- [x]${HEAD} —— 已登记现象,根因与落点未定。`
  const content = [open, done].join('\n')
  assert.equal(
    findForks(content).forks.length,
    1,
    '档 A 只认 DUP_POINTER_RE 这句自我标注,不认"正文里出现过【归并】"',
  )
  assert.ok(!DUP_POINTER_RE.test(open), '本夹具刻意不含自我标注 ⇒ 正是档 A 豁免不掉的作用面')
  assert.equal(measureMixedSplit(content).holderGroups.length, 1)
})

test('D4 判据字面锁:`DUP_POINTER_RE` 必须逐字是那一句自我标注,不得放宽成"含【归并】"', () => {
  // 判据输入被放宽 ⇒ 真语料上会多吃 7 行真活票。逐字钉住输入,让放宽这条改法当场炸。
  assert.equal(DUP_POINTER_RE.source, '【归并】重复登记副本')
  assert.ok(DUP_POINTER_RE.test(`- [ ] 某行 ${DUP} 后文`), '自我标注形态必须仍被认')
  assert.ok(
    !DUP_POINTER_RE.test('- [ ] 某行正文讨论〔【归并】…〕指针为何被当标题'),
    '把【归并】当议题的行不得被判成副本行',
  )
})
// ⁠‌‌‌‍‍‌‌‍‍‌‌‌‌‍‍‌‌‌‍‌‌‌‌‌Currently-placeholder⁠
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
